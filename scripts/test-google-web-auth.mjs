/**
 * Pruebas reales contra src/server/google-auth.ts y src/lib/web-auth.ts (compilados con tsc, sin reimplementar).
 * REGLA ESTRICTA: jamás imprimir tokens, códigos, secretos ni valores de cookies.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, ".tmp-google-auth-test");

fs.rmSync(OUT_DIR, { recursive: true, force: true });
execSync(
  `npx tsc --strict --module commonjs --target es2022 --esModuleInterop --moduleResolution node --skipLibCheck --outDir "${OUT_DIR}" src/server/google-auth.ts src/lib/web-auth.ts`,
  { stdio: "inherit" }
);

const serverAuth = await import("file://" + path.join(OUT_DIR, "server/google-auth.js").replace(/\\/g, "/"));
const {
  loadAuthConfig,
  sealPayload,
  unsealPayload,
  parseCookies,
  handleStart,
  handleCallback,
  handleToken,
  handleLogout,
  STATE_COOKIE,
  SESSION_COOKIE,
  COOKIE_PATH,
  RATE_LIMITS,
  __resetRateLimitsForTests,
} = serverAuth;

const TEST_ENV = {
  GOOGLE_CLIENT_ID: "unit-test-client-id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "unit-test-only-not-a-real-secret",
  SESSION_SECRET: "unit-test-session-key-material-at-least-32-chars!!",
  ALLOWED_ORIGINS: "https://mynotes.example.app,http://localhost:3000",
};

function extractCookieValue(setCookieHeaders, name) {
  for (const h of setCookieHeaders) {
    const first = h.split(";")[0];
    const eq = first.indexOf("=");
    if (eq > 0 && first.slice(0, eq).trim() === name) {
      return { value: first.slice(eq + 1).trim(), raw: h };
    }
  }
  return null;
}

console.log("[T7.1] Configuración y fallo seguro sin secretos por defecto...");
assert.equal(loadAuthConfig({}), null);
assert.equal(loadAuthConfig({ ...TEST_ENV, SESSION_SECRET: "short" }), null);
assert.equal(loadAuthConfig({ ...TEST_ENV, ALLOWED_ORIGINS: "http://insecure.example.com" }), null);
const misRes = await handleStart(new Request("http://localhost:3000/api/google/start"), {
  fetch: async () => new Response(),
  now: () => 1_700_000_000_000,
  env: {},
});
assert.equal(misRes.status, 500);
assert.deepEqual(await misRes.json(), { error: "server_error" });
console.log("  OK: sin variables responde 500 genérico.");

console.log("[T7.2] Cifrado autenticado AES-256-GCM y separación de propósito (AAD)...");
const cfg = loadAuthConfig(TEST_ENV);
assert.ok(cfg);
const sample = { rt: "dummy-rt", sub: "123", name: "Test", email: "t@example.com", picture: "", iat: 1000 };
const sealed = sealPayload(sample, cfg.sessionKey, "session");
assert.ok(!sealed.includes("dummy-rt"), "El texto cifrado no debe exponer el contenido en claro");
assert.deepEqual(unsealPayload(sealed, cfg.sessionKey, "session"), sample);
assert.equal(unsealPayload(sealed, cfg.sessionKey, "state"), null, "AAD distinto debe fallar");
const tampered = sealed.slice(0, -4) + (sealed.endsWith("AAAA") ? "BBBB" : "AAAA");
assert.equal(unsealPayload(tampered, cfg.sessionKey, "session"), null, "Texto manipulado debe fallar");
console.log("  OK: AES-256-GCM + AAD + detección de manipulación verificados.");

console.log("[T7.3] GET /api/google/start: lista blanca de origen, state, PKCE S256 y atributos de cookie...");
__resetRateLimitsForTests();
let clock = 1_700_000_000_000;
const badOriginRes = await handleStart(new Request("https://evil.attacker.tld/api/google/start"), {
  fetch: async () => new Response(),
  now: () => clock,
  env: TEST_ENV,
});
assert.equal(badOriginRes.status, 400);

const startRes = await handleStart(new Request("http://localhost:3000/api/google/start"), {
  fetch: async () => new Response(),
  now: () => clock,
  env: TEST_ENV,
});
assert.equal(startRes.status, 302);
assert.equal(startRes.headers.get("cache-control"), "no-store, max-age=0");
const authLoc = new URL(startRes.headers.get("location"));
assert.equal(authLoc.origin + authLoc.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
assert.equal(authLoc.searchParams.get("response_type"), "code");
assert.equal(authLoc.searchParams.get("access_type"), "offline");
assert.equal(authLoc.searchParams.get("code_challenge_method"), "S256");
assert.equal(authLoc.searchParams.get("redirect_uri"), "http://localhost:3000/api/google/callback");
assert.equal(authLoc.searchParams.get("prompt"), "consent select_account");
assert.equal(
  authLoc.searchParams.get("scope"),
  "https://www.googleapis.com/auth/drive.file openid email profile"
);
const startStateParam = authLoc.searchParams.get("state");
const startChallenge = authLoc.searchParams.get("code_challenge");
assert.ok(startStateParam && startStateParam.length >= 40);
assert.ok(startChallenge && startChallenge.length >= 40);

const setCookiesStart = startRes.headers.getSetCookie();
const stateCookie = extractCookieValue(setCookiesStart, STATE_COOKIE);
assert.ok(stateCookie && stateCookie.value.length > 20);
assert.ok(stateCookie.raw.includes(`Path=${COOKIE_PATH}`));
assert.ok(stateCookie.raw.includes("HttpOnly"));
assert.ok(stateCookie.raw.includes("Secure"));
assert.ok(stateCookie.raw.includes("SameSite=Lax"));
console.log("  OK: /api/google/start verificado.");

console.log("[T7.4] GET /api/google/callback: verificación de state, intercambio PKCE y cookie de sesión...");
// State inválido -> rechaza y limpia cookie de state
const badCbRes = await handleCallback(
  new Request("http://localhost:3000/api/google/callback?code=fake-code&state=wrong-state", {
    headers: { cookie: `${STATE_COOKIE}=${stateCookie.value}` },
  }),
  { fetch: async () => new Response(), now: () => clock + 1000, env: TEST_ENV }
);
assert.equal(badCbRes.status, 302);
assert.equal(badCbRes.headers.get("location"), "http://localhost:3000/?google=error&reason=state");

// Callback válido: comprobamos que el servidor envía code_verifier cuyo SHA-256 coincide con code_challenge
let capturedVerifier = "";
const goodCbRes = await handleCallback(
  new Request(`http://localhost:3000/api/google/callback?code=fake-auth-code&state=${encodeURIComponent(startStateParam)}`, {
    headers: { cookie: `${STATE_COOKIE}=${stateCookie.value}` },
  }),
  {
    now: () => clock + 5000,
    env: TEST_ENV,
    fetch: async (url, init) => {
      const u = String(url);
      if (u === "https://oauth2.googleapis.com/token") {
        const params = new URLSearchParams(String(init?.body || ""));
        assert.equal(params.get("grant_type"), "authorization_code");
        assert.equal(params.get("redirect_uri"), "http://localhost:3000/api/google/callback");
        capturedVerifier = params.get("code_verifier") || "";
        return new Response(
          JSON.stringify({
            access_token: "initial-at",
            refresh_token: "initial-rt",
            expires_in: 3600,
            id_token: "fake-id-token",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (u.startsWith("https://oauth2.googleapis.com/tokeninfo")) {
        return new Response(
          JSON.stringify({
            aud: TEST_ENV.GOOGLE_CLIENT_ID,
            iss: "https://accounts.google.com",
            sub: "uid-42",
            email: "ana@example.com",
            name: "Ana",
            picture: "https://lh3.googleusercontent.com/a/default",
            exp: Math.floor((clock + 3600_000) / 1000),
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      throw new Error("Unexpected URL");
    },
  }
);
const derivedChallenge = createHash("sha256").update(capturedVerifier).digest().toString("base64url");
assert.equal(derivedChallenge, startChallenge, "PKCE code_verifier debe coincidir con code_challenge S256");
assert.equal(goodCbRes.status, 302);
const cbLocation = goodCbRes.headers.get("location");
assert.equal(cbLocation, "http://localhost:3000/?google=connected");
assert.ok(!cbLocation.includes("initial-"), "La URL de redirección jamás debe llevar tokens");

const cbCookies = goodCbRes.headers.getSetCookie();
const sessCookie = extractCookieValue(cbCookies, SESSION_COOKIE);
const clearedState = extractCookieValue(cbCookies, STATE_COOKIE);
assert.ok(sessCookie && sessCookie.value.length > 30);
assert.ok(sessCookie.raw.includes("HttpOnly") && sessCookie.raw.includes("Secure") && sessCookie.raw.includes("SameSite=Lax"));
assert.ok(sessCookie.raw.includes(`Path=${COOKIE_PATH}`));
assert.ok(clearedState && clearedState.raw.includes("Max-Age=0"));

// Si ya hay sesión activa y NO se pide reconnect, /api/google/start NO fuerza prompt=consent
const startExisting = await handleStart(
  new Request("http://localhost:3000/api/google/start", {
    headers: { cookie: `${SESSION_COOKIE}=${sessCookie.value}` },
  }),
  { fetch: async () => new Response(), now: () => clock + 10_000, env: TEST_ENV }
);
const existingLoc = new URL(startExisting.headers.get("location"));
assert.equal(existingLoc.searchParams.get("prompt"), null);
assert.equal(existingLoc.searchParams.get("login_hint"), "ana@example.com");
console.log("  OK: /api/google/callback + PKCE + sesión cifrada verificados.");

console.log("[T7.5] POST /api/google/token: anti-CSRF, rotación, error transitorio (503) vs invalid_grant (401) y rate limit...");
// Sin X-Requested-With -> 403
const noHeaderRes = await handleToken(
  new Request("http://localhost:3000/api/google/token", {
    method: "POST",
    headers: { origin: "http://localhost:3000", cookie: `${SESSION_COOKIE}=${sessCookie.value}` },
  }),
  { fetch: async () => new Response(), now: () => clock + 20_000, env: TEST_ENV }
);
assert.equal(noHeaderRes.status, 403);

// Origin ajeno -> 403
const badOriginPost = await handleToken(
  new Request("http://localhost:3000/api/google/token", {
    method: "POST",
    headers: {
      origin: "https://evil.tld",
      "x-requested-with": "MyNotes",
      cookie: `${SESSION_COOKIE}=${sessCookie.value}`,
    },
  }),
  { fetch: async () => new Response(), now: () => clock + 20_000, env: TEST_ENV }
);
assert.equal(badOriginPost.status, 403);

// Éxito + rotación de refresh_token
const okTokRes = await handleToken(
  new Request("http://localhost:3000/api/google/token", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "x-requested-with": "MyNotes",
      cookie: `${SESSION_COOKIE}=${sessCookie.value}`,
    },
  }),
  {
    now: () => clock + 30_000,
    env: TEST_ENV,
    fetch: async () =>
      new Response(
        JSON.stringify({ access_token: "fresh-at-1", expires_in: 3599, refresh_token: "rotated-rt-2" }),
        { status: 200, headers: { "content-type": "application/json" } }
      ),
  }
);
assert.equal(okTokRes.status, 200);
assert.equal(okTokRes.headers.get("cache-control"), "no-store, max-age=0");
const okTokBody = await okTokRes.json();
assert.equal(typeof okTokBody.access_token, "string");
assert.equal(okTokBody.expires_in, 3599);
assert.deepEqual(okTokBody.user, {
  name: "Ana",
  email: "ana@example.com",
  imageUrl: "https://lh3.googleusercontent.com/a/default",
});
assert.equal("refresh_token" in okTokBody, false, "El refresh_token NUNCA debe viajar al navegador");
const rotatedSessCookie = extractCookieValue(okTokRes.headers.getSetCookie(), SESSION_COOKIE);
assert.ok(rotatedSessCookie);
const unsealedRotated = unsealPayload(rotatedSessCookie.value, cfg.sessionKey, "session");
assert.equal(unsealedRotated.rt, "rotated-rt-2");

// Fallo transitorio (5xx de Google o caída de red): 503 SIN borrar la sesión
const transientRes = await handleToken(
  new Request("http://localhost:3000/api/google/token", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "x-requested-with": "MyNotes",
      cookie: `${SESSION_COOKIE}=${rotatedSessCookie.value}`,
    },
  }),
  {
    now: () => clock + 40_000,
    env: TEST_ENV,
    fetch: async () => new Response("bad gateway", { status: 502 }),
  }
);
assert.equal(transientRes.status, 503);
assert.equal(transientRes.headers.getSetCookie().length, 0, "Un 5xx transitorio NO debe borrar la cookie");

// invalid_grant (acceso revocado en myaccount.google.com/permissions): 401 reauth_required + borra cookie
const revokedRes = await handleToken(
  new Request("http://localhost:3000/api/google/token", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "x-requested-with": "MyNotes",
      cookie: `${SESSION_COOKIE}=${rotatedSessCookie.value}`,
    },
  }),
  {
    now: () => clock + 50_000,
    env: TEST_ENV,
    fetch: async () =>
      new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
  }
);
assert.equal(revokedRes.status, 401);
assert.deepEqual(await revokedRes.json(), { error: "reauth_required" });
const clearedOnRevoke = extractCookieValue(revokedRes.headers.getSetCookie(), SESSION_COOKIE);
assert.ok(clearedOnRevoke && clearedOnRevoke.raw.includes("Max-Age=0"));

// Cookies borradas por el usuario -> 401 reauth_required
const missingCookieRes = await handleToken(
  new Request("http://localhost:3000/api/google/token", {
    method: "POST",
    headers: { origin: "http://localhost:3000", "x-requested-with": "MyNotes" },
  }),
  { fetch: async () => new Response(), now: () => clock + 55_000, env: TEST_ENV }
);
assert.equal(missingCookieRes.status, 401);
assert.deepEqual(await missingCookieRes.json(), { error: "reauth_required" });

// Límite de peticiones por IP
__resetRateLimitsForTests();
let hit429 = false;
for (let i = 0; i <= RATE_LIMITS.token + 2; i++) {
  const r = await handleToken(
    new Request("http://localhost:3000/api/google/token", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "x-requested-with": "MyNotes",
        "x-forwarded-for": "203.0.113.9",
      },
    }),
    { fetch: async () => new Response(), now: () => clock + 60_000, env: TEST_ENV }
  );
  if (r.status === 429) {
    hit429 = true;
    break;
  }
}
assert.equal(hit429, true, "Debe activar 429 al superar el límite por minuto");
__resetRateLimitsForTests();
console.log("  OK: /api/google/token verificado.");

console.log("[T7.6] POST /api/google/logout: revoca en Google y borra cookies...");
let revokeCalled = false;
const logoutRes = await handleLogout(
  new Request("http://localhost:3000/api/google/logout", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "x-requested-with": "MyNotes",
      cookie: `${SESSION_COOKIE}=${rotatedSessCookie.value}`,
    },
  }),
  {
    now: () => clock + 70_000,
    env: TEST_ENV,
    fetch: async (url) => {
      if (String(url) === "https://oauth2.googleapis.com/revoke") {
        revokeCalled = true;
        return new Response("", { status: 200 });
      }
      throw new Error("Unexpected URL");
    },
  }
);
assert.equal(logoutRes.status, 200);
assert.equal(revokeCalled, true);
assert.deepEqual(await logoutRes.json(), { ok: true, revoked: true });
assert.ok(extractCookieValue(logoutRes.headers.getSetCookie(), SESSION_COOKIE)?.raw.includes("Max-Age=0"));
console.log("  OK: /api/google/logout verificado.");

console.log("[T7.7] Cliente web-auth.ts: single-flight, memoria pura, sin window.open, offline vs reauth_required...");
const webAuthCompiled = fs
  .readFileSync(path.join(OUT_DIR, "lib/web-auth.js"), "utf8")
  .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
assert.equal(/\bwindow\.open\b/.test(webAuthCompiled), false, "web-auth.ts no debe llamar a window.open");

const ls = new Map([["googleWebLinked", "1"]]);
globalThis.localStorage = {
  getItem: (k) => (ls.has(k) ? ls.get(k) : null),
  setItem: (k, v) => ls.set(k, String(v)),
  removeItem: (k) => ls.delete(k),
};
globalThis.window = {
  location: { href: "http://localhost:3000/", assign: () => {} },
  history: { state: null, replaceState: () => {} },
  addEventListener: () => {},
};
globalThis.document = { visibilityState: "visible", addEventListener: () => {} };

let tokenFetchCount = 0;
let mockResponseMode = "ok";
globalThis.fetch = async (url, init) => {
  if (url === "/api/google/token") {
    assert.equal(init?.headers?.["X-Requested-With"], "MyNotes");
    tokenFetchCount++;
    await new Promise((r) => setTimeout(r, 40));
    if (mockResponseMode === "ok") {
      return new Response(
        JSON.stringify({
          access_token: "mem-only-token-" + tokenFetchCount,
          expires_in: 3600,
          user: { name: "Ana", email: "ana@example.com", imageUrl: "" },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    if (mockResponseMode === "offline") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify({ error: "reauth_required" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

const webAuth = await import("file://" + path.join(OUT_DIR, "lib/web-auth.js").replace(/\\/g, "/"));

// Single-flight: 4 llamadas simultáneas -> 1 sola petición HTTP
const [a, b, c, d] = await Promise.all([
  webAuth.refresh({ force: true }),
  webAuth.refresh({ force: true }),
  webAuth.refresh({ force: true }),
  webAuth.refresh({ force: true }),
]);
assert.equal(tokenFetchCount, 1, "Single-flight debe emitir exactamente 1 petición en paralelo");
assert.equal(a.ok && b.ok && c.ok && d.ok, true);
assert.equal(Boolean(webAuth.getAccessToken()), true);

// Comprobar que ningún valor en localStorage contiene el token en memoria
for (const val of ls.values()) {
  assert.equal(val.includes("mem-only-token"), false, "El access_token jamás debe guardarse en localStorage");
}

// Offline -> no marca reauth_required ni borra googleWebLinked
mockResponseMode = "offline";
const offRes = await webAuth.refresh({ force: true });
assert.deepEqual(offRes, { ok: false, reason: "transient" });
assert.equal(webAuth.isWebReauthRequired(), false);
assert.equal(webAuth.isWebLinked(), true);

// Revocado -> marca reauth_required
mockResponseMode = "revoked";
const revRes = await webAuth.refresh({ force: true });
assert.deepEqual(revRes, { ok: false, reason: "reauth_required" });
assert.equal(webAuth.isWebReauthRequired(), true);

// Logout -> limpia marca local
await webAuth.logout();
assert.equal(webAuth.isWebLinked(), false);
assert.equal(webAuth.getAccessToken(), null);
console.log("  OK: cliente web-auth.ts verificado.");

fs.rmSync(OUT_DIR, { recursive: true, force: true });
console.log("\nALL GOOGLE WEB AUTH UNIT TESTS PASSED.");
