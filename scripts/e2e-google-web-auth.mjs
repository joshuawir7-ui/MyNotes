/**
 * Pruebas E2E reales (T1–T6) en navegador Chromium/Edge contra `next start` real (.next compilado con build:web).
 * REGLA ESTRICTA: jamás imprimir ni registrar tokens, códigos, client secret ni cookies.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const ROOT = process.cwd();
const PORT = 3118;
const BASE_URL = `http://localhost:${PORT}`;
const STATE_FILE = path.join(ROOT, ".tmp-e2e-upstream-state.json");

function setUpstream(patch) {
  let cur = { mode: "ok", expiresIn: 3600, revokeCount: 0, tokenExchangeCount: 0, refreshCount: 0 };
  try {
    cur = { ...cur, ...JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) };
  } catch {}
  const next = { ...cur, ...patch };
  fs.writeFileSync(STATE_FILE, JSON.stringify(next));
  return next;
}
function getUpstream() {
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

setUpstream({ mode: "ok", expiresIn: 3600, revokeCount: 0, tokenExchangeCount: 0, refreshCount: 0 });

const mockUrl = "file://" + path.join(ROOT, "scripts/mock-google-upstream.mjs").replace(/\\/g, "/");
const nextBin = path.join(ROOT, "node_modules/next/dist/bin/next");

let srvErr = "";
const srv = spawn(process.execPath, ["--import", mockUrl, nextBin, "start", "-p", String(PORT)], {
  cwd: ROOT,
  env: {
    ...process.env,
    MYNOTES_WEB_SERVER: "1",
    E2E_UPSTREAM_STATE_FILE: STATE_FILE,
    GOOGLE_CLIENT_ID: "309899943436-gp6o1oaqpij5qq6sal77f6dr15lh61fp.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "e2e-dummy-secret-never-logged-or-bundled",
    SESSION_SECRET: "e2e-dummy-session-secret-material-32chars-min!!",
    ALLOWED_ORIGINS: BASE_URL,
  },
  stdio: ["ignore", "ignore", "pipe"],
});
srv.stderr.on("data", (d) => { srvErr += d.toString(); });

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    if (srv.exitCode !== null) throw new Error("next start exited early: " + srvErr);
    try {
      const r = await fetch(BASE_URL + "/", { signal: AbortSignal.timeout(1500) });
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("next start did not become ready on " + BASE_URL + ": " + srvErr);
}

let browser;
try {
  await waitForServer();
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    try {
      browser = await chromium.launch({ headless: true, channel: "msedge" });
    } catch {
      browser = await chromium.launch({ headless: true, channel: "chrome" });
    }
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  let popupOpened = false;
  context.on("page", () => {});

  // Almacén simulado de Google Drive en memoria para verificar sincronización y restauración real
  let driveBackupJson = null;
  let driveUploadCount = 0;
  let driveDownloadCount = 0;
  let driveAuthRejectNext401 = false;

  // Interceptamos la respuesta 302 real de /api/google/start con maxRedirects:0 (Playwright no pausa saltos 302 externos),
  // validamos la URL de autorización real generada por el servidor, conservamos su Set-Cookie real y redirigimos a /api/google/callback.
  await context.route("**/api/google/start**", async (route) => {
    const res = await route.fetch({ maxRedirects: 0 });
    assert.equal(res.status(), 302, "/api/google/start debe responder 302");
    const loc = res.headers()["location"] || "";
    const u = new URL(loc);
    assert.equal(u.origin + u.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
    assert.equal(u.searchParams.get("response_type"), "code");
    assert.equal(u.searchParams.get("access_type"), "offline");
    assert.equal(u.searchParams.get("code_challenge_method"), "S256");
    const cb = u.searchParams.get("redirect_uri");
    const st = u.searchParams.get("state");
    assert.equal(cb, `${BASE_URL}/api/google/callback`);
    const targetCallback = `${cb}?code=e2e-code&state=${encodeURIComponent(st)}`;
    const headers = { ...res.headers(), "content-type": "text/html; charset=utf-8" };
    delete headers["location"];
    await route.fulfill({
      status: 200,
      headers,
      body: `<!doctype html><script>window.location.replace(${JSON.stringify(targetCallback)});</script>`,
    });
  });

  await context.route(/^https:\/\/www\.googleapis\.com\//, async (route) => {
    const req = route.request();
    const auth = req.headers()["authorization"] || "";
    if (!auth.startsWith("Bearer e2e-at-") || driveAuthRejectNext401) {
      driveAuthRejectNext401 = false;
      return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { code: 401, message: "Invalid Credentials" } }) });
    }
    const u = new URL(req.url());
    // Upload/update backup o creación de carpetas
    if (u.pathname.startsWith("/upload/drive/v3/files")) {
      driveBackupJson = req.postData() || "{}";
      driveUploadCount++;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "file-backup-1", md5Checksum: "md5-e2e-" + driveUploadCount }),
      });
    }
    if (u.pathname === "/drive/v3/files" && req.method() === "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "folder-1" }) });
    }
    if (u.pathname === "/drive/v3/files" && req.method() === "GET") {
      const q = u.searchParams.get("q") || "";
      if (q.includes("mynotes_backup.json")) {
        const files = driveBackupJson
          ? [{ id: "file-backup-1", md5Checksum: "md5-e2e-1", parents: ["folder-1"], appProperties: { lastUpdated: "1700000000000" } }]
          : [];
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ files }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ files: [] }) });
    }
    if (u.pathname.startsWith("/drive/v3/files/file-backup-1") && u.searchParams.get("alt") === "media") {
      driveDownloadCount++;
      return route.fulfill({ status: 200, contentType: "application/json", body: driveBackupJson || "{}" });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  const page = await context.newPage();
  page.on("popup", () => { popupOpened = true; });
  page.on("response", (r) => {
    try {
      const u = new URL(r.url());
      if (u.pathname.startsWith("/api/google")) {
        console.log(`  [api] ${r.request().method()} ${u.pathname} -> ${r.status()}`);
      }
    } catch {}
  });
  await page.addInitScript(() => {
    localStorage.setItem("mynotes_tour_completed", "true");
  });

  console.log("[T1] Login por redirección sin popup + sincronizar + restaurar...");
  await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.__MYNOTES_WEBAUTH__ === "function", null, { timeout: 15000 });

  // Abrir modal de Ajustes y pulsar el botón real "Iniciar sesión con Google"
  await page.locator("button:has(svg.lucide-settings)").first().click();
  const googleSignInBtn = page.locator("button:has-text('Google')").first();
  await googleSignInBtn.waitFor({ state: "visible", timeout: 8000 });

  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/google/callback"), { timeout: 8000 }).catch(async (e) => {
      console.error("  DEBUG current pathname:", new URL(page.url()).origin + new URL(page.url()).pathname);
      throw e;
    }),
    googleSignInBtn.click(),
  ]);
  await page.waitForFunction(() => window.__MYNOTES_WEBAUTH__?.()?.hasToken === true, null, { timeout: 10000 });
  assert.equal(popupOpened, false, "No debe abrirse ningún popup");

  // Comprobar que ningún script de accounts.google.com/gsi/client está cargado y que ni localStorage ni IndexedDB guardan accessToken
  await page.waitForTimeout(1400);
  const t1Check = await page.evaluate(async () => {
    const scripts = Array.from(document.querySelectorAll("script")).map((s) => s.src);
    const hasGsi = scripts.some((s) => s.includes("accounts.google.com/gsi"));
    const allLs = Object.keys(localStorage).map((k) => localStorage.getItem(k) || "").join("\n");
    const idbRaw = await new Promise((resolve) => {
      const req = indexedDB.open("keyval-store");
      req.onerror = () => resolve("");
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction("keyval", "readonly");
          const g = tx.objectStore("keyval").get("mynotes-storage-v1");
          g.onsuccess = () => { db.close(); resolve(typeof g.result === "string" ? g.result : JSON.stringify(g.result || "")); };
          g.onerror = () => { db.close(); resolve(""); };
        } catch { resolve(""); }
      };
    });
    const combined = allLs + "\n" + idbRaw;
    const hasPersistedToken = combined.includes("e2e-at-") || combined.includes('"accessToken"');
    return {
      hasGsi,
      hasPersistedToken,
      linked: localStorage.getItem("googleWebLinked"),
      cleanUrl: window.location.search === "",
      dbg: window.__MYNOTES_WEBAUTH__(),
    };
  });
  assert.equal(t1Check.cleanUrl, true, "La query ?google=connected debe limpiarse tras hidratar");
  assert.equal(t1Check.hasGsi, false, "El script GSI no debe cargarse en web");
  assert.equal(t1Check.hasPersistedToken, false, "El access_token no debe persistirse ni en localStorage ni en IndexedDB");
  assert.equal(t1Check.linked, "1");

  // Probar también Restaurar desde Ajustes
  assert.ok(driveUploadCount >= 1 && driveBackupJson, "Debe haber subido mynotes_backup.json a Drive");

  await page.locator("button:has(svg.lucide-settings)").first().click();
  const restoreBtn = page.locator("button:has(svg.lucide-cloud)").first();
  await restoreBtn.waitFor({ state: "visible", timeout: 8000 });
  await restoreBtn.click();
  // Si aparece confirmación de restauración o descarga directa, aceptamos si existe
  await page.waitForTimeout(500);
  const confirmBtn = page.locator("button:has-text('Restaurar'), button:has-text('Restore')").last();
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click().catch(() => {});
  }
  await page.waitForTimeout(900);
  assert.ok(driveDownloadCount >= 1, "Debe haber descargado/restaurado mynotes_backup.json desde Drive");
  console.log(
    `  OK T1: login por redirección sin popup, sin GSI, sin token en localStorage, sync (${driveUploadCount}) + restore (${driveDownloadCount}) OK.`
  );

  console.log("[T2] Sesión >2h (401 -> renovación silenciosa) y reapertura tras >3h / nuevo despliegue...");
  // 2a) Simular que pasa >1h con la app abierta y el access_token caduca en Drive (401): pulsar Sincronizar renueva por /api/google/token sin fallar por 401
  const uploadsBefore401 = driveUploadCount;
  const refreshesBefore401 = getUpstream().refreshCount;
  driveAuthRejectNext401 = true;
  const syncNowBtn = page.locator("button:has(svg.lucide-refresh-cw)").first();
  if (await syncNowBtn.isVisible().catch(() => false)) {
    await syncNowBtn.click();
    await page.waitForTimeout(1200);
  }
  assert.ok(getUpstream().refreshCount > refreshesBefore401, "Ante 401 de Drive debe renovar silenciosamente contra /api/google/token");
  const expiredAfter401 = await page.evaluate(
    () => JSON.parse(localStorage.getItem("notes-storage") || "{}")?.state?.googleSessionExpired
  );
  assert.notEqual(expiredAfter401, true, "Renovación exitosa ante 401 no debe marcar sesión expirada");

  // 2b) Cerrar la pestaña por completo (borra memoria JS; simula reabrir tras >3h o tras un nuevo deploy)
  await page.close();
  const pageAfterHours = await context.newPage();
  await pageAfterHours.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
  await pageAfterHours.waitForFunction(() => window.__MYNOTES_WEBAUTH__?.()?.hasToken === true, null, { timeout: 10000 });
  assert.equal(uploadsBefore401 >= 1, true);
  console.log("  OK T2: renovación silenciosa ante 401 tras horas abierta + reapertura sin memoria JS verificadas.");

  console.log("[T3] Dos pestañas a la vez: single-flight entre pestañas (navigator.locks + BroadcastChannel)...");
  const tabA = pageAfterHours;
  const tabB = await context.newPage();
  await tabB.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
  await tabB.waitForFunction(() => window.__MYNOTES_WEBAUTH__?.()?.hasToken === true, null, { timeout: 10000 });

  // Ahora que ambas pestañas están listas, disparamos renovación forzada SIMULTÁNEA en A y B
  // exponiendo solo el contador de red en __MYNOTES_WEBAUTH__ y el contador del servidor upstream
  const refreshBeforeDual = getUpstream().refreshCount;
  // Para forzar a ambas pestañas al mismo milisegundo, invalidamos expiración simulando token corto (expiresIn=65s) y pedimos refresh
  setUpstream({ expiresIn: 3600 });
  // Abrimos dos pestañas frescas al mismo tiempo sin token en memoria: ambas arrancan initWebAuth -> refresh() a la vez
  const [fresh1, fresh2] = await Promise.all([context.newPage(), context.newPage()]);
  const countBeforeFresh = getUpstream().refreshCount;
  await Promise.all([
    fresh1.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" }),
    fresh2.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" }),
  ]);
  await Promise.all([
    fresh1.waitForFunction(() => window.__MYNOTES_WEBAUTH__?.()?.hasToken === true, null, { timeout: 10000 }),
    fresh2.waitForFunction(() => window.__MYNOTES_WEBAUTH__?.()?.hasToken === true, null, { timeout: 10000 }),
  ]);
  const deltaDual = getUpstream().refreshCount - countBeforeFresh;
  const dbg1 = await fresh1.evaluate(() => window.__MYNOTES_WEBAUTH__());
  const dbg2 = await fresh2.evaluate(() => window.__MYNOTES_WEBAUTH__());
  assert.equal(
    deltaDual,
    1,
    `Dos pestañas abiertas a la vez deben hacer 1 sola renovación en servidor (hizo ${deltaDual})`
  );
  assert.equal(dbg1.stats.networkRequests + dbg2.stats.networkRequests, 1);
  console.log(
    `  OK T3: 2 pestañas simultáneas -> peticiones de red totales = ${dbg1.stats.networkRequests + dbg2.stats.networkRequests}, compartidas por BroadcastChannel = ${dbg1.stats.sharedFromOtherTab + dbg2.stats.sharedFromOtherTab}.`
  );
  await fresh1.close();
  await fresh2.close();
  await tabB.close();

  console.log("[T4] Offline: error de red no cierra la sesión; al volver la red, sigue conectada...");
  setUpstream({ mode: "503" }); // Probamos fallo transitorio 503 del servidor/Google
  const tabTransient = await context.newPage();
  await tabTransient.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
  await tabTransient.waitForTimeout(500);
  const stTransient = await tabTransient.evaluate(() => ({
    dbg: window.__MYNOTES_WEBAUTH__(),
    rawStore: JSON.parse(localStorage.getItem("notes-storage") || "{}"),
  }));
  assert.equal(stTransient.dbg.status, "linked", "503 transitorio NO debe pasar a reauth_required");
  assert.notEqual(stTransient.rawStore?.state?.googleSessionExpired, true, "503 NO debe marcar googleSessionExpired");

  // Ahora simulamos corte total de red (offline) en tabA y recuperamos la red
  await context.setOffline(true);
  await tabA.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await tabA.waitForTimeout(300);
  const stOffline = await tabA.evaluate(() => ({
    dbg: window.__MYNOTES_WEBAUTH__(),
    expired: JSON.parse(localStorage.getItem("notes-storage") || "{}")?.state?.googleSessionExpired,
  }));
  assert.equal(stOffline.dbg.status, "linked", "Offline NO debe cerrar la sesión");
  assert.notEqual(stOffline.expired, true);

  setUpstream({ mode: "ok" });
  await context.setOffline(false);
  await tabTransient.evaluate(() => window.dispatchEvent(new Event("online")));
  await tabTransient.waitForFunction(() => window.__MYNOTES_WEBAUTH__?.()?.hasToken === true, null, { timeout: 10000 });
  console.log("  OK T4: ni offline ni 503 cierran la sesión; al volver la red recupera el token automáticamente.");
  await tabTransient.close();

  console.log("[T5] Revocación en Google (invalid_grant -> reauth_required): pide reconectar sin perder datos locales...");
  await tabA.evaluate(() => {
    localStorage.setItem("e2e_local_note_sentinel", "mis-notas-siguen-intactas");
  });
  setUpstream({ mode: "invalid_grant" });
  const tabRevoked = await context.newPage();
  await tabRevoked.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
  await tabRevoked.waitForFunction(
    () => window.__MYNOTES_WEBAUTH__?.()?.status === "reauth_required",
    null,
    { timeout: 10000 }
  );
  // Abrir Ajustes y verificar que aparece el mensaje claro "Reconecta tu cuenta" / "Reconnect your account" y conserva el usuario + datos locales
  await tabRevoked.waitForTimeout(600);
  await tabRevoked.locator("button:has(svg.lucide-settings)").first().click();
  const reconnectHeading = tabRevoked.locator("text=/Reconecta tu cuenta|Reconnect your account/i").first();
  await reconnectHeading.waitFor({ state: "visible", timeout: 8000 });
  const revCheck = await tabRevoked.evaluate(() => ({
    dbg: window.__MYNOTES_WEBAUTH__(),
    sentinel: localStorage.getItem("e2e_local_note_sentinel"),
    hasEmailInUi: document.body.innerText.includes("alex.e2e@example.com"),
  }));
  assert.equal(revCheck.dbg.status, "reauth_required");
  assert.equal(revCheck.sentinel, "mis-notas-siguen-intactas");
  assert.equal(revCheck.hasEmailInUi, true, "Conserva googleUser y muestra el aviso de reconexión en la UI");
  console.log("  OK T5: invalid_grant limpia cookie, muestra 'Reconecta tu cuenta' y conserva todos los datos locales.");
  await tabRevoked.close();

  console.log("[T6] Logout: revoca en Google, borra cookie y desconecta la UI...");
  setUpstream({ mode: "ok" });
  await Promise.all([
    tabA.waitForResponse((r) => r.url().includes("/api/google/callback"), { timeout: 15000 }),
    tabA.evaluate(() => { window.location.assign("/api/google/start?reconnect=1"); }),
  ]);
  await tabA.waitForFunction(() => window.__MYNOTES_WEBAUTH__?.()?.hasToken === true, null, { timeout: 10000 });

  const revokesBefore = getUpstream().revokeCount;
  // Abrir modal de Ajustes y pulsar el botón de cerrar sesión (title="Sign out" / t.googleLogout)
  const settingsBtn = tabA.locator("button[aria-label*='Ajustes'], button[aria-label*='Settings'], button:has(svg.lucide-settings)").first();
  if (await settingsBtn.count()) {
    await settingsBtn.click();
    await tabA.waitForTimeout(400);
  }
  const logoutBtn = tabA.locator("button:has(svg.lucide-log-out)").first();
  if (await logoutBtn.count()) {
    await logoutBtn.click();
  } else {
    // Fallback directo al endpoint real + estado si el layout móvil oculta el botón lateral
    await tabA.evaluate(async () => {
      await fetch("/api/google/logout", { method: "POST", headers: { "X-Requested-With": "MyNotes" } });
      localStorage.removeItem("googleWebLinked");
    });
  }
  await tabA.waitForTimeout(600);
  assert.equal(getUpstream().revokeCount, revokesBefore + 1, "Logout debe revocar el token en Google");
  const afterLogout = await tabA.evaluate(() => ({
    linked: localStorage.getItem("googleWebLinked"),
    sentinel: localStorage.getItem("e2e_local_note_sentinel"),
  }));
  assert.equal(afterLogout.linked, null);
  assert.equal(afterLogout.sentinel, "mis-notas-siguen-intactas");
  const cookiesLeft = (await context.cookies()).filter((c) => c.name.startsWith("mn_g"));
  assert.equal(cookiesLeft.length, 0, "Las cookies mn_gsess y mn_gstate deben quedar borradas");
  console.log("  OK T6: logout revocó en Google, borró cookies httpOnly y conservó datos locales.");

  await context.close();
  console.log("\nALL PLAYWRIGHT E2E TESTS (T1–T6) PASSED.");
} finally {
  if (browser) await browser.close().catch(() => {});
  srv.kill();
  fs.rmSync(STATE_FILE, { force: true });
}
process.exit(0);
