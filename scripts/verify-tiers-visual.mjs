import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "out");
const SHOT_DIR = path.join(ROOT, "audit", "tiers-screenshots");
fs.mkdirSync(SHOT_DIR, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
};

function startServer(dir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || "/").split("?")[0];
      let f = path.join(dir, urlPath === "/" ? "index.html" : urlPath);
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        if (fs.existsSync(f + ".html")) f = f + ".html";
        else if (fs.existsSync(path.join(f, "index.html"))) f = path.join(f, "index.html");
        else f = path.join(dir, "index.html");
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
      fs.createReadStream(f).pipe(res);
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function mirrorPayload(tier) {
  if (tier === "high") {
    return { tier: "high", fxBlur: "on", fxShadow: "full", fxMotion: "full", fxBg: "on" };
  }
  if (tier === "medium") {
    return { tier: "medium", fxBlur: "on", fxShadow: "simple", fxMotion: "reduced", fxBg: "on" };
  }
  return { tier: "low", fxBlur: "off", fxShadow: "simple", fxMotion: "minimal", fxBg: "off" };
}

const { server, port } = await startServer(OUT_DIR);
const baseUrl = `http://127.0.0.1:${port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch {
  try {
    browser = await chromium.launch({ headless: true, channel: "msedge" });
  } catch {
    browser = await chromium.launch({ headless: true, channel: "chrome" });
  }
}

const results = { navLayers: {}, gpuCounts: {}, perf6x: {}, preHydration: {} };

try {
  for (const tier of ["high", "medium", "low"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(({ mirror, prefs }) => {
      localStorage.setItem("mynotes_perf_tier_mirror_v1", JSON.stringify(mirror));
      localStorage.setItem("CapacitorStorage.mynotes_perf_tier_v1", JSON.stringify(prefs));
      localStorage.setItem("mynotes_tour_completed", "true");
    }, {
      mirror: mirrorPayload(tier),
      prefs: {
        mode: tier,
        overrides: { glassBlur: "auto", shadows: "auto", motion: "auto", decorativeBg: "auto" },
        lastAutoTier: tier,
        reason: "verify script",
        decidedAt: Date.now(),
        appVersion: "1.0.0",
        probe: { ms: 35, at: Date.now() },
      },
    });

    const page = await context.newPage();
    await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded" });
    const preTier = await page.evaluate(() => document.documentElement.getAttribute("data-tier"));
    results.preHydration[tier] = preTier;
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(450);

    // Count backdrop-filter layers in .nav-glass and total GPU cost on page
    const gpu = await page.evaluate(() => {
      const nav = document.querySelector(".nav-glass");
      let navBackdropLayers = 0;
      if (nav) {
        const els = [nav, ...nav.querySelectorAll("*")];
        for (const el of els) {
          const cs = getComputedStyle(el);
          const bf = cs.backdropFilter || cs.webkitBackdropFilter || "none";
          if (bf !== "none" && bf !== "" && cs.display !== "none" && cs.opacity !== "0") {
            navBackdropLayers++;
          }
        }
      }
      let totalBackdrop = 0;
      let totalBlur = 0;
      let totalWillChange = 0;
      for (const el of document.querySelectorAll("*")) {
        const cs = getComputedStyle(el);
        const bf = cs.backdropFilter || cs.webkitBackdropFilter || "none";
        if (bf !== "none" && bf !== "" && cs.display !== "none") totalBackdrop++;
        if ((cs.filter || "").includes("blur")) totalBlur++;
        if (cs.willChange && cs.willChange !== "auto") totalWillChange++;
      }
      return { navBackdropLayers, totalBackdrop, totalBlur, totalWillChange };
    });
    results.navLayers[tier] = gpu.navBackdropLayers;
    results.gpuCounts[tier] = gpu;

    // 6x CPU throttling scroll FPS on /
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    const scrollStats = await page.evaluate(async () => {
      const el = document.scrollingElement || document.documentElement;
      const dts = [];
      let last = performance.now();
      const start = last;
      await new Promise((resolve) => {
        const step = (now) => {
          dts.push(now - last);
          last = now;
          el.scrollTop = ((now - start) / 2500) * 300;
          if (now - start >= 2500) return resolve();
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      const valid = dts.slice(1).sort((a, b) => a - b);
      const avg = valid.reduce((a, b) => a + b, 0) / Math.max(1, valid.length);
      const p95 = valid[Math.min(valid.length - 1, Math.floor(valid.length * 0.95))] || 0;
      return { fps: Number((1000 / Math.max(1, avg)).toFixed(1)), p95: Number(p95.toFixed(1)) };
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    results.perf6x[tier] = scrollStats;

    // Screenshots: light & dark
    for (const theme of ["light", "dark"]) {
      await page.evaluate((t) => {
        document.documentElement.classList.toggle("dark", t === "dark");
      }, theme);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(SHOT_DIR, `home-${tier}-${theme}.png`) });
      // Open Settings modal (sheet)
      const settingsBtn = page.locator("button[aria-label*='Ajustes'], button[aria-label*='Settings'], a[href*='settings']").first();
      if (await settingsBtn.count()) {
        await settingsBtn.click();
        await page.waitForTimeout(350);
        await page.screenshot({ path: path.join(SHOT_DIR, `sheet-${tier}-${theme}.png`) });
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      }
    }

    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(results, null, 2));
