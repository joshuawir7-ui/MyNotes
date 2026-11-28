/**
 * Solo para pruebas locales E2E (se carga con NODE_OPTIONS="--import ..." en el subproceso `next start`).
 * Intercepta únicamente las llamadas salientes del servidor hacia oauth2.googleapis.com sin tocar src/.
 */
import fs from "node:fs";

const stateFile = process.env.E2E_UPSTREAM_STATE_FILE;
const origFetch = globalThis.fetch;

function readState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {
    return { mode: "ok", expiresIn: 3600, revokeCount: 0, tokenExchangeCount: 0, refreshCount: 0 };
  }
}

function writeState(next) {
  if (stateFile) fs.writeFileSync(stateFile, JSON.stringify(next));
}

globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url === "https://oauth2.googleapis.com/token") {
    const st = readState();
    const params = new URLSearchParams(String(init?.body || ""));
    const grant = params.get("grant_type");
    if (grant === "authorization_code") {
      st.tokenExchangeCount = (st.tokenExchangeCount || 0) + 1;
      writeState(st);
      return new Response(
        JSON.stringify({
          access_token: `e2e-at-init-${st.tokenExchangeCount}`,
          refresh_token: `e2e-rt-${st.tokenExchangeCount}`,
          expires_in: st.expiresIn || 3600,
          id_token: "e2e-id-token",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    if (grant === "refresh_token") {
      st.refreshCount = (st.refreshCount || 0) + 1;
      writeState(st);
      if (st.mode === "invalid_grant") {
        return new Response(JSON.stringify({ error: "invalid_grant" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      if (st.mode === "503") {
        return new Response("upstream unavailable", { status: 503 });
      }
      return new Response(
        JSON.stringify({
          access_token: `e2e-at-r${st.refreshCount}`,
          expires_in: st.expiresIn || 3600,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
  }
  if (url.startsWith("https://oauth2.googleapis.com/tokeninfo")) {
    return new Response(
      JSON.stringify({
        aud: process.env.GOOGLE_CLIENT_ID,
        iss: "https://accounts.google.com",
        sub: "e2e-user-sub-1",
        email: "alex.e2e@example.com",
        name: "Alex E2E",
        picture: "",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }
  if (url === "https://oauth2.googleapis.com/revoke") {
    const st = readState();
    st.revokeCount = (st.revokeCount || 0) + 1;
    writeState(st);
    return new Response("", { status: 200 });
  }
  return origFetch(input, init);
};
