import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "out");
const AUDIT_DIR = path.join(ROOT, "audit");

const ROUTES = [
  { path: "/", name: "Hoy" },
  { path: "/tasks", name: "Hábitos" },
  { path: "/notes", name: "Notas" },
  { path: "/balance", name: "Balance" },
  { path: "/goals", name: "Metas" },
  { path: "/calendar", name: "Calendario" },
];

const CPU_RATES = [4, 6];

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

function summarizeCpuProfile(profile, topN = 15) {
  if (!profile?.nodes?.length) return [];
  const nodeMap = new Map();
  for (const n of profile.nodes) nodeMap.set(n.id, n);

  const sampleCounts = new Map();
  const samples = profile.samples || [];
  const deltas = profile.timeDeltas || [];
  for (let i = 0; i < samples.length; i++) {
    const nid = samples[i];
    const dtUs = deltas[i] || 1000;
    sampleCounts.set(nid, (sampleCounts.get(nid) || 0) + dtUs);
  }

  const byFn = new Map();
  for (const [nid, us] of sampleCounts.entries()) {
    const node = nodeMap.get(nid);
    const cf = node?.callFrame;
    if (!cf) continue;
    const fn = cf.functionName || "(anonymous)";
    const url = (cf.url || "").replace(/^https?:\/\/127\.0\.0\.1:\d+/, "") || "(native/vm)";
    if (url === "(native/vm)" && (fn === "(idle)" || fn === "(program)" || fn === "(root)")) continue;
    const key = `${fn}@@${url}:${cf.lineNumber}`;
    const prev = byFn.get(key) || { fn, file: `${url}:${cf.lineNumber}`, selfMs: 0 };
    prev.selfMs += us / 1000;
    byFn.set(key, prev);
  }

  return Array.from(byFn.values())
    .sort((a, b) => b.selfMs - a.selfMs)
    .slice(0, topN)
    .map((x) => ({ fn: x.fn, file: x.file, selfMs: +x.selfMs.toFixed(1) }));
}

async function dismissOverlays(page) {
  await page.evaluate(() => {
    const q = document.querySelector('div.fixed.inset-0.z-\\[99999\\]');
    if (q instanceof HTMLElement) q.click();
    document.querySelectorAll("button").forEach((b) => {
      if (b.querySelector("svg.lucide-x") || /^(Vale|Entendido|Got it|Comenzar)$/i.test((b.textContent || "").trim())) b.click();
    });
  }).catch(() => {});
  await page.waitForTimeout(250);
}

async function measureScroll5s(page) {
  return await page.evaluate(async () => {
    const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
    const candidates = Array.from(document.querySelectorAll("*")).filter((el) => {
      const s = getComputedStyle(el);
      return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 24;
    });
    const scroller = candidates.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0] || document.scrollingElement;
    const maxScroll = scroller ? Math.max(0, scroller.scrollHeight - scroller.clientHeight) : 0;

    const dts = [];
    let dir = 1;
    let last = performance.now();
    const start = last;
    while (performance.now() - start < 5000) {
      const now = await nextFrame();
      const dt = now - last;
      last = now;
      dts.push(dt);
      if (scroller && maxScroll > 0) {
        scroller.scrollBy(0, 8 * dir);
        if (scroller.scrollTop >= maxScroll - 2) dir = -1;
        else if (scroller.scrollTop <= 2) dir = 1;
      }
    }
    const sorted = dts.slice().sort((a, b) => a - b);
    const total = dts.reduce((a, b) => a + b, 0) || 1;
    return {
      avgFps: +((dts.length * 1000) / total).toFixed(1),
      p50Ms: +(sorted[Math.floor(sorted.length * 0.5)] || 0).toFixed(1),
      p95Ms: +(sorted[Math.floor(sorted.length * 0.95)] || 0).toFixed(1),
      gt16_7: dts.filter((d) => d > 16.7).length,
      gt50: dts.filter((d) => d > 50).length,
    };
  });
}

async function launchBrowser() {
  for (const opts of [{ headless: true }, { headless: true, channel: "msedge" }, { headless: true, channel: "chrome" }]) {
    try { return await chromium.launch(opts); } catch {}
  }
  throw new Error("No se encontró Chromium, Edge ni Chrome para Playwright.");
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    console.error("ERROR: No existe 'out/'. Ejecuta 'npm run build' primero.");
    process.exit(1);
  }
  fs.mkdirSync(AUDIT_DIR, { recursive: true });

  const { server, port } = await startServer(OUT_DIR);
  const baseUrl = `http://127.0.0.1:${port}`;
  const browser = await launchBrowser();

  const allResults = [];

  try {
    for (const rate of CPU_RATES) {
      for (const route of ROUTES) {
        const context = await browser.newContext({
          viewport: { width: 360, height: 780 },
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
        });
        await context.addInitScript(() => {
          localStorage.setItem("mynotes_tour_completed", "true");
        });

        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate });
        await cdp.send("Profiler.enable");
        await cdp.send("Profiler.setSamplingInterval", { interval: 1000 });
        await cdp.send("Profiler.start");

        const t0 = Date.now();
        await page.goto(`${baseUrl}${route.path}`, { waitUntil: "networkidle" });
        await dismissOverlays(page);
        const coldLoadMs = Date.now() - t0;

        // 5s auto-scroll
        const scroll = await measureScroll5s(page);

        // Route-specific interactions
        let extra = {};
        if (route.path === "/") {
          // Open & close Settings modal 3 times (also covers Ajustes)
          const modalStats = await page.evaluate(async () => {
            const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
            const btn = Array.from(document.querySelectorAll("button")).find(
              (b) => /Ajustes|Settings|Configuración/i.test(b.title || "") && b.offsetParent !== null
            );
            let gt25 = 0;
            let gt50 = 0;
            for (let i = 0; i < 3; i++) {
              if (btn) btn.click();
              let last = performance.now();
              const s = last;
              while (performance.now() - s < 350) {
                const n = await nextFrame();
                const dt = n - last;
                last = n;
                if (dt > 25) gt25++;
                if (dt > 50) gt50++;
              }
              const closeBtn = Array.from(document.querySelectorAll("button")).find(
                (b) => b.querySelector("svg.lucide-x") && b.offsetParent !== null
              );
              if (closeBtn) closeBtn.click();
              last = performance.now();
              const s2 = last;
              while (performance.now() - s2 < 300) {
                const n = await nextFrame();
                const dt = n - last;
                last = n;
                if (dt > 25) gt25++;
                if (dt > 50) gt50++;
              }
            }
            return { modalOpenCloseGt25: gt25, modalOpenCloseGt50: gt50 };
          });
          extra = { ...extra, ...modalStats };
        }

        if (route.path === "/tasks") {
          // Toggle first habit checkbox if present
          const habitToggleMs = await page.evaluate(async () => {
            const cb = document.querySelector('button[role="checkbox"], input[type="checkbox"]');
            if (!cb) return null;
            const tStart = performance.now();
            cb.click();
            await new Promise((r) => requestAnimationFrame(r));
            cb.click();
            await new Promise((r) => requestAnimationFrame(r));
            return +(performance.now() - tStart).toFixed(1);
          });
          extra.habitToggleMs = habitToggleMs;
        }

        if (route.path === "/notes") {
          // Create note & type 200 chars
          const newNoteBtn = page.locator("button").filter({ hasText: /Nueva|New/i }).first();
          if (await newNoteBtn.count()) {
            await newNoteBtn.click().catch(() => {});
            await page.waitForTimeout(350);
          }
          const editable = page.locator('[contenteditable="true"]').first();
          if (await editable.count()) {
            const tType = Date.now();
            await editable.click().catch(() => {});
            await page.keyboard.type("a".repeat(200), { delay: 5 });
            extra.type200CharsMs = Date.now() - tType;
          }
        }

        const { profile } = await cdp.send("Profiler.stop");
        const top15 = summarizeCpuProfile(profile, 15);

        const tracePath = path.join(AUDIT_DIR, `cpu-${rate}x-${route.name.toLowerCase()}.cpuprofile`);
        fs.writeFileSync(tracePath, JSON.stringify(profile), "utf8");

        allResults.push({
          cpuRate: `${rate}x`,
          route: route.path,
          name: route.name,
          coldLoadMs,
          scroll,
          extra,
          top15,
        });

        await context.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  fs.writeFileSync(path.join(AUDIT_DIR, "perf-report.json"), JSON.stringify(allResults, null, 2), "utf8");

  const lines = [
    `# Auditoría de Rendimiento en PC con CPU Limitada (4x y 6x)`,
    ``,
    `> **AVISO IMPORTANTE:** Esta auditoría mide **únicamente el hilo principal JS/CPU** en PC (Playwright + \`Emulation.setCPUThrottlingRate\`). **NO captura el coste de GPU del móvil** (\`backdrop-filter\`, \`blur\`, \`mask-image\`, composición de capas en Adreno/Mali). Para el coste de GPU consulta \`docs/gpu-inventory.md\`.`,
    ``,
    `- Fecha: ${new Date().toISOString()}`,
    `- Trazas guardadas en \`audit/*.cpuprofile\` (gitignored)`,
    ``,
    `## Resumen por ruta y throttling`,
    ``,
    `| CPU | Ruta | Carga fría (ms) | Scroll FPS | p50 (ms) | p95 (ms) | >16.7ms | >50ms | Extra |`,
    `|---|---|---|---|---|---|---|---|---|`,
    ...allResults.map(
      (r) =>
        `| ${r.cpuRate} | ${r.name} (\`${r.route}\`) | ${r.coldLoadMs} | ${r.scroll.avgFps} | ${r.scroll.p50Ms} | ${r.scroll.p95Ms} | ${r.scroll.gt16_7} | ${r.scroll.gt50} | \`${JSON.stringify(r.extra)}\` |`
    ),
    ``,
    `## Top 15 mayores consumidores de tiempo por ruta (CPU 6x)`,
    ``,
  ];

  for (const r of allResults.filter((x) => x.cpuRate === "6x")) {
    lines.push(`### ${r.name} (\`${r.route}\`)`);
    lines.push(``);
    lines.push(`| # | Función | Archivo:Línea | Tiempo propio (ms) |`);
    lines.push(`|---|---|---|---|`);
    r.top15.forEach((t, idx) => {
      lines.push(`| ${idx + 1} | \`${t.fn}\` | \`${t.file}\` | ${t.selfMs} |`);
    });
    lines.push(``);
  }

  fs.writeFileSync(path.join(AUDIT_DIR, "perf-report.md"), lines.join("\n"), "utf8");
  console.log("Auditoría CPU completada -> audit/perf-report.md");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
