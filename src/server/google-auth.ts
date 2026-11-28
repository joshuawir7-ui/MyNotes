/**
 * Sesión persistente de Google para MyNotes Web (flujo de código + PKCE, token de refresco SOLO en servidor).
 *
 * - Solo se importa desde los Route Handlers `src/app/api/google/* /route.server.ts`, que únicamente
 *   existen en el build web con servidor (ver `pageExtensions` en next.config.ts). Nunca desde el cliente.
 * - Sin dependencias externas: `node:crypto` (AES-256-GCM + HKDF) y `fetch` nativo.
 * - NUNCA registra tokens, códigos de autorización, el client secret ni cookies.
 */
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

/** Scopes: los actuales (drive.file) + openid/email/profile para el perfil. Nada más. */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "openid",
  "email",
  "profile",
] as const;

export const STATE_COOKIE = "mn_gstate";
export const SESSION_COOKIE = "mn_gsess";
export const COOKIE_PATH = "/api/google";
export const STATE_MAX_AGE_S = 10 * 60;
export const SESSION_MAX_AGE_S = 180 * 24 * 60 * 60;
export const CALLBACK_PATH = "/api/google/callback";
export const REQUIRED_XRW = "MyNotes";

/** Límite de peticiones por IP y minuto (por instancia de la función; best-effort en serverless). */
export const RATE_LIMITS = { token: 30, logout: 10, start: 20 } as const;
const RATE_WINDOW_MS = 60_000;
const GOOGLE_TIMEOUT_MS = 10_000;

export interface AuthConfig {
  clientId: string;
  clientSecret: string;
  sessionKey: Buffer;
  allowedOrigins: string[];
}

export interface AuthDeps {
  fetch: typeof fetch;
  now: () => number;
  env: Record<string, string | undefined>;
}

const defaultDeps = (): AuthDeps => ({
  fetch: (input, init) => fetch(input, init),
  now: () => Date.now(),
  env: process.env,
});

interface StatePayload {
  s: string; // state
  v: string; // code_verifier
  r: string; // redirect_uri
  exp: number;
}

export interface SessionPayload {
  rt: string; // refresh_token (solo servidor)
  sub: string;
  name: string;
  email: string;
  picture: string;
  iat: number;
}

// ───────────────────────────── Configuración ─────────────────────────────

function normalizeOrigin(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    const isLocal = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(isLocal && u.protocol === "http:")) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Carga la configuración. Devuelve null si falta algo (sin valores por defecto inseguros). */
export function loadAuthConfig(env: Record<string, string | undefined>): AuthConfig | null {
  const clientId = (env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (env.GOOGLE_CLIENT_SECRET || "").trim();
  const secret = env.SESSION_SECRET || "";
  const origins = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => normalizeOrigin(o))
    .filter((o): o is string => Boolean(o));
  if (!clientId || !clientSecret || secret.length < 32 || origins.length === 0) return null;
  const sessionKey = Buffer.from(
    hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.alloc(0), Buffer.from("mynotes-google-session-v1"), 32)
  );
  return { clientId, clientSecret, sessionKey, allowedOrigins: origins };
}

// ───────────────────────────── Cifrado autenticado ─────────────────────────────

const b64u = (buf: Buffer) => buf.toString("base64url");

/** AES-256-GCM; `purpose` va como AAD para que una cookie de state no valga como sesión y viceversa. */
export function sealPayload(payload: unknown, key: Buffer, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(purpose, "utf8"));
  const ct = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return "v1." + b64u(Buffer.concat([iv, tag, ct]));
}

export function unsealPayload<T>(sealed: string | undefined | null, key: Buffer, purpose: string): T | null {
  if (!sealed || !sealed.startsWith("v1.")) return null;
  try {
    const raw = Buffer.from(sealed.slice(3), "base64url");
    if (raw.length < 12 + 16 + 1) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(purpose, "utf8"));
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(pt.toString("utf8")) as T;
  } catch {
    return null;
  }
}

// ───────────────────────────── Cookies ─────────────────────────────

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k && !(k in out)) out[k] = v;
  }
  return out;
}

export function serializeCookie(name: string, value: string, maxAgeS: number): string {
  return `${name}=${value}; Path=${COOKIE_PATH}; Max-Age=${maxAgeS}; HttpOnly; Secure; SameSite=Lax`;
}

export const clearCookie = (name: string) => serializeCookie(name, "", 0);

// ───────────────────────────── Validaciones ─────────────────────────────

/** Origen de la petición SOLO si está en la lista blanca (nunca se usa Host sin validar). */
export function resolveAllowedOrigin(req: Request, cfg: AuthConfig): string | null {
  let origin: string;
  try {
    origin = new URL(req.url).origin;
  } catch {
    return null;
  }
  return cfg.allowedOrigins.includes(origin) ? origin : null;
}

export function isAllowedOriginHeader(origin: string | null, cfg: AuthConfig): boolean {
  if (!origin) return false;
  const n = normalizeOrigin(origin);
  return Boolean(n && n === origin && cfg.allowedOrigins.includes(n));
}

/** Comprobación anti-CSRF de los POST: cabecera personalizada + Origin en la lista blanca. */
export function checkPostRequest(req: Request, cfg: AuthConfig): boolean {
  if (req.method !== "POST") return false;
  if (req.headers.get("x-requested-with") !== REQUIRED_XRW) return false;
  if (!isAllowedOriginHeader(req.headers.get("origin"), cfg)) return false;
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  return true;
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// ───────────────────────────── Límite de peticiones ─────────────────────────────

const rateBuckets = new Map<string, { count: number; start: number }>();

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

export function rateLimitHit(bucket: keyof typeof RATE_LIMITS, ip: string, now: number): boolean {
  const key = `${bucket}:${ip}`;
  const cur = rateBuckets.get(key);
  if (!cur || now - cur.start >= RATE_WINDOW_MS) {
    if (rateBuckets.size > 5000) {
      for (const [k, v] of rateBuckets) if (now - v.start >= RATE_WINDOW_MS) rateBuckets.delete(k);
    }
    rateBuckets.set(key, { count: 1, start: now });
    return false;
  }
  cur.count++;
  return cur.count > RATE_LIMITS[bucket];
}

export function __resetRateLimitsForTests() {
  rateBuckets.clear();
}

// ───────────────────────────── Respuestas ─────────────────────────────

const NO_STORE: Record<string, string> = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function json(status: number, body: unknown, cookies: string[] = []): Response {
  const headers = new Headers({ ...NO_STORE, "Content-Type": "application/json; charset=utf-8" });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(JSON.stringify(body), { status, headers });
}

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ ...NO_STORE, Location: location });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

const serverMisconfigured = () => json(500, { error: "server_error" });

function logSafe(event: string, info: Record<string, string | number | undefined> = {}) {
  // Solo códigos de estado y códigos de error OAuth; jamás tokens, códigos, secretos ni cookies.
  console.warn(`[google-auth] ${event}`, info);
}

async function googleForm(
  deps: AuthDeps,
  url: string,
  params: Record<string, string>
): Promise<{ ok: boolean; status: number; body: any } | { ok: false; status: 0; body: null }> {
  try {
    const res = await deps.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

function pkceChallenge(verifier: string): string {
  return b64u(createHash("sha256").update(verifier).digest());
}

function sessionCookieFor(session: SessionPayload, cfg: AuthConfig): string {
  return serializeCookie(SESSION_COOKIE, sealPayload(session, cfg.sessionKey, "session"), SESSION_MAX_AGE_S);
}

function readSession(req: Request, cfg: AuthConfig, now: number): SessionPayload | null {
  const raw = parseCookies(req.headers.get("cookie"))[SESSION_COOKIE];
  const s = unsealPayload<SessionPayload>(raw, cfg.sessionKey, "session");
  if (!s || typeof s.rt !== "string" || !s.rt) return null;
  if (typeof s.iat !== "number" || now - s.iat > SESSION_MAX_AGE_S * 1000) return null;
  return s;
}

const publicUser = (s: SessionPayload) => ({ name: s.name, email: s.email, imageUrl: s.picture });

// ───────────────────────────── Handlers ─────────────────────────────

/** GET /api/google/start */
export async function handleStart(req: Request, deps: AuthDeps = defaultDeps()): Promise<Response> {
  const cfg = loadAuthConfig(deps.env);
  if (!cfg) return serverMisconfigured();
  const origin = resolveAllowedOrigin(req, cfg);
  if (!origin) return json(400, { error: "origin_not_allowed" });
  const now = deps.now();
  if (rateLimitHit("start", clientIp(req), now)) return json(429, { error: "rate_limited" });

  const url = new URL(req.url);
  const reconnect = url.searchParams.get("reconnect") === "1";
  const session = readSession(req, cfg, now);
  const redirectUri = origin + CALLBACK_PATH;

  const state = b64u(randomBytes(32));
  const verifier = b64u(randomBytes(32));
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256",
  });
  // Google solo devuelve refresh_token en el primer consentimiento o con prompt=consent.
  if (!session || reconnect) params.set("prompt", "consent select_account");
  else if (session.email) params.set("login_hint", session.email);

  const statePayload: StatePayload = { s: state, v: verifier, r: redirectUri, exp: now + STATE_MAX_AGE_S * 1000 };
  return redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`, [
    serializeCookie(STATE_COOKIE, sealPayload(statePayload, cfg.sessionKey, "state"), STATE_MAX_AGE_S),
  ]);
}

/** Verifica el id_token con el endpoint oficial tokeninfo (firma, aud, iss y exp los valida Google). */
async function verifyIdToken(idToken: string, cfg: AuthConfig, deps: AuthDeps) {
  try {
    const res = await deps.fetch(`${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const c: any = await res.json();
    if (c.aud !== cfg.clientId) return null;
    if (c.iss !== "accounts.google.com" && c.iss !== "https://accounts.google.com") return null;
    if (!c.sub || Number(c.exp) * 1000 <= deps.now()) return null;
    return {
      sub: String(c.sub),
      email: String(c.email || ""),
      name: String(c.name || c.email || ""),
      picture: String(c.picture || ""),
    };
  } catch {
    return null;
  }
}

/** GET /api/google/callback */
export async function handleCallback(req: Request, deps: AuthDeps = defaultDeps()): Promise<Response> {
  const cfg = loadAuthConfig(deps.env);
  if (!cfg) return serverMisconfigured();
  const origin = resolveAllowedOrigin(req, cfg);
  if (!origin) return json(400, { error: "origin_not_allowed" });
  const now = deps.now();
  const clearState = clearCookie(STATE_COOKIE);
  const back = (q: string, extra: string[] = []) => redirect(`${origin}/?${q}`, [clearState, ...extra]);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error")) return back("google=denied");

  const st = unsealPayload<StatePayload>(parseCookies(req.headers.get("cookie"))[STATE_COOKIE], cfg.sessionKey, "state");
  if (!st || !state || !code || st.exp <= now || !safeEqual(st.s, state)) {
    logSafe("callback rejected", { reason: "state" });
    return back("google=error&reason=state");
  }
  const redirectUri = origin + CALLBACK_PATH;
  if (st.r !== redirectUri) return back("google=error&reason=state");

  const tok = await googleForm(deps, GOOGLE_TOKEN_URL, {
    grant_type: "authorization_code",
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: redirectUri,
    code_verifier: st.v,
  });
  if (!tok.ok || !tok.body?.id_token) {
    logSafe("code exchange failed", { status: tok.status, error: tok.body?.error });
    return back("google=error&reason=exchange");
  }

  const profile = await verifyIdToken(String(tok.body.id_token), cfg, deps);
  if (!profile) {
    logSafe("id_token verification failed");
    return back("google=error&reason=id_token");
  }

  let refreshToken: string | undefined = tok.body.refresh_token;
  if (!refreshToken) {
    // Sin refresh_token (consentimiento previo sin prompt=consent): reutiliza el de la sesión si es la misma cuenta.
    const prev = readSession(req, cfg, now);
    if (prev && prev.sub === profile.sub) refreshToken = prev.rt;
  }
  if (!refreshToken) {
    logSafe("no refresh_token returned");
    return back("google=error&reason=no_refresh");
  }

  const session: SessionPayload = { rt: refreshToken, ...profile, iat: now };
  return back("google=connected", [sessionCookieFor(session, cfg)]);
}

/** POST /api/google/token */
export async function handleToken(req: Request, deps: AuthDeps = defaultDeps()): Promise<Response> {
  const cfg = loadAuthConfig(deps.env);
  if (!cfg) return serverMisconfigured();
  if (!checkPostRequest(req, cfg)) return json(403, { error: "forbidden" });
  const now = deps.now();
  if (rateLimitHit("token", clientIp(req), now)) return json(429, { error: "rate_limited" });

  const hadCookie = Boolean(parseCookies(req.headers.get("cookie"))[SESSION_COOKIE]);
  const session = readSession(req, cfg, now);
  if (!session) {
    return json(401, { error: "reauth_required" }, hadCookie ? [clearCookie(SESSION_COOKIE)] : []);
  }

  const r = await googleForm(deps, GOOGLE_TOKEN_URL, {
    grant_type: "refresh_token",
    refresh_token: session.rt,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });

  if (r.status === 0 || r.status >= 500) {
    logSafe("refresh transient failure", { status: r.status });
    return json(503, { error: "temporarily_unavailable" });
  }
  if (!r.ok) {
    if (r.body?.error === "invalid_grant") {
      logSafe("refresh invalid_grant");
      return json(401, { error: "reauth_required" }, [clearCookie(SESSION_COOKIE)]);
    }
    logSafe("refresh rejected", { status: r.status, error: r.body?.error });
    return json(500, { error: "server_error" });
  }
  if (!r.body?.access_token) return json(503, { error: "temporarily_unavailable" });

  // Rotación: si Google devuelve un refresh_token nuevo, se guarda. La cookie se renueva (180 días deslizantes).
  const next: SessionPayload = { ...session, rt: r.body.refresh_token || session.rt, iat: now };
  return json(
    200,
    {
      access_token: String(r.body.access_token),
      expires_in: Number(r.body.expires_in) || 3600,
      user: publicUser(next),
    },
    [sessionCookieFor(next, cfg)]
  );
}

/** POST /api/google/logout */
export async function handleLogout(req: Request, deps: AuthDeps = defaultDeps()): Promise<Response> {
  const cfg = loadAuthConfig(deps.env);
  if (!cfg) return serverMisconfigured();
  if (!checkPostRequest(req, cfg)) return json(403, { error: "forbidden" });
  if (rateLimitHit("logout", clientIp(req), deps.now())) return json(429, { error: "rate_limited" });

  const session = readSession(req, cfg, deps.now());
  let revoked = false;
  if (session) {
    const r = await googleForm(deps, GOOGLE_REVOKE_URL, { token: session.rt });
    revoked = r.ok;
    if (!r.ok) logSafe("revoke failed", { status: r.status, error: r.body?.error });
  }
  return json(200, { ok: true, revoked }, [clearCookie(SESSION_COOKIE), clearCookie(STATE_COOKIE)]);
}
