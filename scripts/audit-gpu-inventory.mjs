import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "out");
const DOCS_DIR = path.join(ROOT, "docs");

const SCREENS = [
  { path: "/", name: "Hoy" },
  { path: "/tasks", name: "Hábitos" },
  { path: "/notes", name: "Notas" },
  { path: "/balance", name: "Balance" },
  { path: "/goals", name: "Metas" },
  { path: "/calendar", name: "Calendario" },
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
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

async function scanGpuCost(page) {
  return await page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const screenArea = vw * vh;

    const all = Array.from(document.querySelectorAll("*"));
    let backdropFilterCount = 0;
    let filterBlurCount = 0;
    let maskImageCount = 0;
    let multiShadowCount = 0;
    let willChangeCount = 0;
    const backdropLayers = [];
    const items = [];

    const countShadows = (bs) => {
      if (!bs || bs === "none") return 0;
      let depth = 0, commas = 0;
      for (const ch of bs) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        else if (ch === "," && depth === 0) commas++;
      }
      return commas + 1;
    };

    const getSelector = (el) => {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : "";
      const cls = typeof el.className === "string" && el.className.trim()
        ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
        : "";
      return `${tag}${id}${cls}`.slice(0, 90);
    };

    for (const el of all) {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      const area = Math.max(0, Math.round(r.width * r.height));
      const areaPct = +((area / screenArea) * 100).toFixed(1);

      const bf = s.backdropFilter || s.webkitBackdropFilter || "none";
      const hasBf = bf && bf !== "none";
      const hasBlurFilter = Boolean(s.filter && s.filter !== "none" && s.filter.includes("blur"));
      const mi = s.maskImage || s.webkitMaskImage || "none";
      const hasMask = Boolean(mi && mi !== "none");
      const shadowLayers = countShadows(s.boxShadow);
      const hasMultiShadow = shadowLayers > 2;
      const hasWc = Boolean(s.willChange && s.willChange !== "auto");

      if (hasBf) {
        backdropFilterCount++;
        backdropLayers.push({ selector: getSelector(el), areaPx2: area, areaPct, bf: bf.slice(0, 40) });
      }
      if (hasBlurFilter) filterBlurCount++;
      if (hasMask) maskImageCount++;
      if (hasMultiShadow) multiShadowCount++;
      if (hasWc) willChangeCount++;

      const score =
        (hasBf ? 50 + areaPct : 0) +
        (hasBlurFilter ? 30 : 0) +
        (hasMask ? 20 : 0) +
        (hasMultiShadow ? 15 : 0) +
        (hasWc ? 10 : 0);

      if (score > 0) {
        const flags = [];
        if (hasBf) flags.push(`backdrop-filter(${bf.slice(0, 28)})`);
        if (hasBlurFilter) flags.push(`filter(${s.filter.slice(0, 28)})`);
        if (hasMask) flags.push("mask-image");
        if (hasMultiShadow) flags.push(`box-shadow(${shadowLayers} capas)`);
        if (hasWc) flags.push(`will-change(${s.willChange})`);
        items.push({ selector: getSelector(el), areaPx2: area, areaPct, flags: flags.join(", "), score });
      }
    }

    const anims = typeof document.getAnimations === "function" ? document.getAnimations() : [];
    const infiniteAnims = anims.filter((a) => a.effect?.getTiming?.().iterations === Infinity).length;

    items.sort((a, b) => b.score - a.score);
    return {
      vw,
      vh,
      backdropFilterCount,
      filterBlurCount,
      maskImageCount,
      multiShadowCount,
      willChangeCount,
      infiniteAnims,
      totalAnims: anims.length,
      backdropLayers: backdropLayers.sort((a, b) => b.areaPx2 - a.areaPx2),
      top10Worst: items.slice(0, 10),
    };
  });
}

async function dismissOverlays(page) {
  await page.evaluate(() => {
    const q = document.querySelector('div.fixed.inset-0.z-\\[99999\\]');
    if (q instanceof HTMLElement) q.click();
    document.querySelectorAll("button").forEach((b) => {
      if (b.querySelector("svg.lucide-x") || /^(Vale|Entendido|Got it|Comenzar)$/i.test((b.textContent || "").trim())) b.click();
    });
  }).catch(() => {});
  await page.waitForTimeout(300);
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
  fs.mkdirSync(DOCS_DIR, { recursive: true });

  const { server, port } = await startServer(OUT_DIR);
  const baseUrl = `http://127.0.0.1:${port}`;
  const browser = await launchBrowser();

  const entries = [];
  try {
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

    for (const s of SCREENS) {
      await page.goto(`${baseUrl}${s.path}`, { waitUntil: "networkidle" });
      await dismissOverlays(page);
      await page.waitForTimeout(400);
      entries.push({ target: `${s.name} (${s.path})`, ...(await scanGpuCost(page)) });
    }

    // Modal Ajustes (sobre /)
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    await dismissOverlays(page);
    const settingsBtn = page.locator('button[title="Ajustes"], button[title="Settings"], button[title="Configuración"]').locator("visible=true").first();
    if (await settingsBtn.count()) {
      await settingsBtn.evaluate((el) => el.click());
      await page.waitForTimeout(500);
      entries.push({ target: "Modal: Ajustes (settings-dialog.tsx)", ...(await scanGpuCost(page)) });
      await dismissOverlays(page);
    }

    // Modal Calculadora (sobre /balance)
    await page.goto(`${baseUrl}/balance`, { waitUntil: "networkidle" });
    await dismissOverlays(page);
    const calcBtn = page.locator('button[title="Calculadora"], button[title="Calculator"]').locator("visible=true").first();
    if (await calcBtn.count()) {
      await calcBtn.evaluate((el) => el.click());
      await page.waitForTimeout(500);
      entries.push({ target: "Modal: Calculadora (calculator-modal.tsx)", ...(await scanGpuCost(page)) });
    }

    // Editor de Notas (sobre /notes)
    await page.goto(`${baseUrl}/notes`, { waitUntil: "networkidle" });
    await dismissOverlays(page);
    const newNoteBtn = page.locator("button").filter({ hasText: /Nueva|New/i }).first();
    if (await newNoteBtn.count()) {
      await newNoteBtn.evaluate((el) => el.click());
      await page.waitForTimeout(500);
      entries.push({ target: "Editor de Notas (note-editor.tsx)", ...(await scanGpuCost(page)) });
    }

    await context.close();
  } finally {
    await browser.close();
    server.close();
  }

  const lines = [
    `# Inventario de Coste de GPU por Pantalla, Modal y Editor`,
    ``,
    `Viewport de referencia: \`360×780 px\` (\`280,800 px²\`). Medido en DOM renderizado sin modificar código de optimización.`,
    ``,
    `## Resumen global`,
    ``,
    `| Pantalla / Modal | \`backdrop-filter\` | \`filter: blur\` | \`mask-image\` | \`box-shadow >2\` | \`will-change\` | Anim. infinitas |`,
    `|---|---|---|---|---|---|---|`,
    ...entries.map(
      (e) =>
        `| ${e.target} | ${e.backdropFilterCount} | ${e.filterBlurCount} | ${e.maskImageCount} | ${e.multiShadowCount} | ${e.willChangeCount} | ${e.infiniteAnims} |`
    ),
    ``,
  ];

  for (const e of entries) {
    lines.push(`## ${e.target}`);
    lines.push(``);
    if (e.backdropLayers.length > 0) {
      lines.push(`**Capas con \`backdrop-filter\`:**`);
      for (const b of e.backdropLayers) {
        lines.push(`- \`${b.selector}\` — ${b.areaPx2.toLocaleString()} px² (**${b.areaPct}%** de pantalla) — \`${b.bf}\``);
      }
      lines.push(``);
    }
    lines.push(`**Top 10 peores elementos:**`);
    if (e.top10Worst.length === 0) {
      lines.push(`- Ninguno detectado.`);
    } else {
      e.top10Worst.forEach((it, i) => {
        lines.push(`${i + 1}. \`${it.selector}\` (${it.areaPx2.toLocaleString()} px², ${it.areaPct}%) — ${it.flags}`);
      });
    }
    lines.push(``);
  }

  fs.writeFileSync(path.join(DOCS_DIR, "gpu-inventory.md"), lines.join("\n"), "utf8");
  console.log("Inventario GPU generado -> docs/gpu-inventory.md");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
