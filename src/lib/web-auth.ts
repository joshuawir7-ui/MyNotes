/**
 * Sesión de Google en MyNotes WEB (solo cuando !Capacitor.isNativePlatform()).
 *
 * - El refresh_token vive SOLO en el servidor (cookie httpOnly cifrada en /api/google).
 * - El access_token vive SOLO en memoria de esta pestaña (nunca localStorage ni store persistido).
 *   Entre pestañas se comparte por BroadcastChannel (mensajería en memoria, mismo origen).
 * - Sin popups: login() navega a /api/google/start (no usa window.open).
 * - Renovación: una sola en vuelo por pestaña (single-flight) y coordinada entre pestañas con
 *   navigator.locks (o BroadcastChannel + espera aleatoria si no existe).
 * - Este módulo NO importa el store (evita ciclos); el store/UI se conectan con initWebAuth(handlers).
 */

export const WEB_LINKED_KEY = "googleWebLinked";
const LAST_REFRESH_KEY = "googleWebLastRefreshAt"; // solo una marca de tiempo, nunca un token
const LOCK_NAME = "mynotes-google-token";
const CHANNEL_NAME = "mynotes-google-auth";
const TOKEN_ENDPOINT = "/api/google/token";
const LOGOUT_ENDPOINT = "/api/google/logout";
const START_ENDPOINT = "/api/google/start";

/** Renovar ~5 min antes de expires_in. */
export const REFRESH_MARGIN_MS = 5 * 60_000;
const MIN_TIMER_MS = 30_000;
const TRANSIENT_RETRY_MS = 60_000;
const SHARED_WAIT_MS = 400;

export type WebAuthStatus = "unlinked" | "linked" | "reauth_required";
export interface WebAuthUser {
  name: string;
  email: string;
  imageUrl: string;
}
export type RefreshResult =
  | { ok: true; token: string; user: WebAuthUser | null }
  | { ok: false; reason: "reauth_required" | "transient" | "not_linked" };

export interface WebAuthHandlers {
  onToken?: (token: string, user: WebAuthUser | null, info: { justConnected: boolean }) => void;
  onReauthRequired?: () => void;
  onLoggedOut?: () => void;
  onLoginError?: (reason: string) => void;
}

interface Mem {
  token: string | null;
  expiresAt: number;
  obtainedAt: number;
  user: WebAuthUser | null;
  status: WebAuthStatus | null;
}

const mem: Mem = { token: null, expiresAt: 0, obtainedAt: 0, user: null, status: null };
const stats = {
  refreshCalls: 0,
  networkRequests: 0,
  sharedFromOtherTab: 0,
  transientFailures: 0,
  reauthRequired: 0,
  handlerTokenCalls: 0,
};
let handlers: WebAuthHandlers = {};
let inflight: Promise<RefreshResult> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let channel: BroadcastChannel | null = null;
let initialized = false;
let pendingJustConnected = false;

const hasWindow = () => typeof window !== "undefined";
const now = () => Date.now();

function storageGet(key: string): string | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}
function storageSet(key: string, value: string | null) {
  try {
    if (typeof localStorage === "undefined") return;
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* modo privado sin almacenamiento */
  }
}

export function isWebLinked(): boolean {
  return storageGet(WEB_LINKED_KEY) === "1";
}
export function getWebAuthStatus(): WebAuthStatus {
  if (mem.status) return mem.status;
  return isWebLinked() ? "linked" : "unlinked";
}
export function isWebReauthRequired(): boolean {
  return mem.status === "reauth_required";
}

/** Access token en memoria si le queda más de 60 s. */
export function getAccessToken(): string | null {
  return mem.token && mem.expiresAt - now() > 60_000 ? mem.token : null;
}

/** Diagnóstico sin datos sensibles (para pruebas y HUD). */
export function getWebAuthDebug() {
  return {
    status: getWebAuthStatus(),
    linked: isWebLinked(),
    hasToken: Boolean(getAccessToken()),
    expiresInSec: mem.token ? Math.round((mem.expiresAt - now()) / 1000) : null,
    stats: { ...stats },
  };
}

function ensureChannel() {
  if (channel || typeof BroadcastChannel === "undefined") return;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (ev: MessageEvent) => {
      const msg = ev.data || {};
      if (msg.type === "token" && typeof msg.token === "string" && msg.expiresAt > mem.expiresAt) {
        stats.sharedFromOtherTab++;
        applyToken(msg.token, msg.expiresAt, msg.user ?? null, msg.obtainedAt || now(), false);
      } else if (msg.type === "reauth_required") {
        setReauthRequired(false);
      } else if (msg.type === "logout") {
        clearLocal();
        handlers.onLoggedOut?.();
      }
    };
  } catch {
    channel = null;
  }
}

function broadcast(msg: Record<string, unknown>) {
  try {
    channel?.postMessage(msg);
  } catch {
    /* ignore */
  }
}

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function schedule() {
  clearTimer();
  if (!mem.token) return;
  const delay = Math.max(MIN_TIMER_MS, mem.expiresAt - now() - REFRESH_MARGIN_MS);
  timer = setTimeout(() => {
    void refresh();
  }, delay);
}

function scheduleRetry() {
  clearTimer();
  timer = setTimeout(() => {
    void refresh();
  }, TRANSIENT_RETRY_MS);
}

function applyToken(token: string, expiresAt: number, user: WebAuthUser | null, obtainedAt: number, own: boolean) {
  mem.token = token;
  mem.expiresAt = expiresAt;
  mem.obtainedAt = obtainedAt;
  if (user) mem.user = user;
  mem.status = "linked";
  storageSet(WEB_LINKED_KEY, "1");
  schedule();
  const justConnected = pendingJustConnected;
  pendingJustConnected = false;
  stats.handlerTokenCalls++;
  handlers.onToken?.(token, mem.user, { justConnected });
  if (own) broadcast({ type: "token", token, expiresAt, obtainedAt, user: mem.user });
}

function setReauthRequired(announce: boolean) {
  clearTimer();
  mem.token = null;
  mem.expiresAt = 0;
  mem.status = "reauth_required";
  stats.reauthRequired++;
  handlers.onReauthRequired?.();
  if (announce) broadcast({ type: "reauth_required" });
}

function clearLocal() {
  clearTimer();
  mem.token = null;
  mem.expiresAt = 0;
  mem.obtainedAt = 0;
  mem.user = null;
  mem.status = "unlinked";
  storageSet(WEB_LINKED_KEY, null);
  storageSet(LAST_REFRESH_KEY, null);
}

async function withCrossTabLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks: any = typeof navigator !== "undefined" ? (navigator as any).locks : undefined;
  if (locks?.request) {
    return locks.request(LOCK_NAME, { mode: "exclusive" }, fn);
  }
  // Sin Web Locks: pequeña espera aleatoria para que otra pestaña comparta su token por BroadcastChannel.
  await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 150)));
  return fn();
}

async function waitForSharedToken(sinceMs: number): Promise<boolean> {
  const deadline = now() + SHARED_WAIT_MS;
  while (now() < deadline) {
    if (mem.token && mem.obtainedAt >= sinceMs && getAccessToken()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return Boolean(mem.token && mem.obtainedAt >= sinceMs && getAccessToken());
}

async function doRefresh(requestedAt: number, force: boolean): Promise<RefreshResult> {
  // ¿Otra pestaña ya renovó mientras esperábamos el lock?
  if (mem.token && mem.obtainedAt >= requestedAt && getAccessToken()) {
    return { ok: true, token: mem.token, user: mem.user };
  }
  const lastOther = Number(storageGet(LAST_REFRESH_KEY) || 0);
  if (lastOther >= requestedAt && (await waitForSharedToken(requestedAt))) {
    return { ok: true, token: mem.token as string, user: mem.user };
  }
  if (!force && mem.token && mem.expiresAt - now() > REFRESH_MARGIN_MS) {
    return { ok: true, token: mem.token, user: mem.user };
  }

  stats.networkRequests++;
  console.log(`[WebAuth] refresh request #${stats.networkRequests}`);
  let res: Response;
  try {
    res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "X-Requested-With": "MyNotes" },
    });
  } catch {
    stats.transientFailures++;
    return { ok: false, reason: "transient" };
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (res.status === 401 && body?.error === "reauth_required") {
    setReauthRequired(true);
    return { ok: false, reason: "reauth_required" };
  }
  if (!res.ok || typeof body?.access_token !== "string") {
    stats.transientFailures++;
    return { ok: false, reason: "transient" };
  }

  const obtainedAt = now();
  const expiresAt = obtainedAt + Math.max(60, Number(body.expires_in) || 3600) * 1000;
  storageSet(LAST_REFRESH_KEY, String(obtainedAt));
  applyToken(body.access_token, expiresAt, body.user ?? null, obtainedAt, true);
  // Margen para que el mensaje llegue a las otras pestañas antes de soltar el lock.
  await new Promise((r) => setTimeout(r, 30));
  return { ok: true, token: body.access_token, user: mem.user };
}

/**
 * Renueva el access token sin interacción ni popup. Single-flight por pestaña y lock entre pestañas.
 * `force`: ignora el token en memoria (p. ej. tras un 401 de Drive).
 */
export function refresh(opts: { force?: boolean } = {}): Promise<RefreshResult> {
  stats.refreshCalls++;
  if (!isWebLinked() && !pendingJustConnected) {
    return Promise.resolve({ ok: false, reason: "not_linked" });
  }
  if (mem.status === "reauth_required") {
    return Promise.resolve({ ok: false, reason: "reauth_required" });
  }
  if (inflight) return inflight;
  ensureChannel();
  const requestedAt = now();
  const force = Boolean(opts.force);
  inflight = (async () => {
    try {
      const r = await withCrossTabLock(() => doRefresh(requestedAt, force));
      if (!r.ok && r.reason === "transient") scheduleRetry();
      return r;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Token válido en memoria o renovado. */
export async function getValidAccessToken(): Promise<string | null> {
  const t = getAccessToken();
  if (t && mem.expiresAt - now() > REFRESH_MARGIN_MS) return t;
  const r = await refresh();
  return r.ok ? r.token : t;
}

/** Inicio de sesión por REDIRECCIÓN (sin popup, sin window.open). */
export function login(opts: { reconnect?: boolean } = {}) {
  if (!hasWindow()) return;
  window.location.assign(START_ENDPOINT + (opts.reconnect ? "?reconnect=1" : ""));
}

export async function logout(): Promise<void> {
  ensureChannel();
  try {
    await fetch(LOGOUT_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "X-Requested-With": "MyNotes" },
    });
  } catch {
    /* sin red: la cookie se revocará/caducará; localmente quedamos desconectados igualmente */
  }
  clearLocal();
  broadcast({ type: "logout" });
}

function onVisibilityOrOnline() {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
  if (!isWebLinked() || mem.status === "reauth_required") return;
  if (!mem.token || mem.expiresAt - now() < REFRESH_MARGIN_MS) void refresh();
}

/**
 * Arranque (solo web). Procesa ?google=connected|denied|error tras el callback, limpia la URL
 * y, si la cuenta está vinculada, obtiene un access token sin interacción.
 */
export function initWebAuth(h: WebAuthHandlers) {
  handlers = h;
  if (!hasWindow() || initialized) return;
  initialized = true;
  ensureChannel();

  try {
    const url = new URL(window.location.href);
    const flag = url.searchParams.get("google");
    if (flag) {
      const reason = url.searchParams.get("reason") || flag;
      url.searchParams.delete("google");
      url.searchParams.delete("reason");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      if (flag === "connected") {
        storageSet(WEB_LINKED_KEY, "1");
        mem.status = "linked";
        pendingJustConnected = true;
      } else {
        handlers.onLoginError?.(reason);
      }
    }
  } catch {
    /* URL no parseable: ignorar */
  }

  document.addEventListener("visibilitychange", onVisibilityOrOnline);
  window.addEventListener("online", onVisibilityOrOnline);
  (window as any).__MYNOTES_WEBAUTH__ = getWebAuthDebug;

  if (isWebLinked()) void refresh();
}
