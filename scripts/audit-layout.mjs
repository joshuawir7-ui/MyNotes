import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "out");
const AUDIT_DIR = path.join(ROOT, "audit-output");
const SHOTS_DIR = path.join(AUDIT_DIR, "screenshots");

const ROUTES = ["/", "/goals", "/balance", "/tasks", "/calendar", "/notes"];
const VIEWPORTS = [
  { name: "320dp", width: 320, height: 640 },
  { name: "360dp", width: 360, height: 780 },
  { name: "412dp", width: 412, height: 915 },
];
const TEXT_SCALES = [85, 100, 115, 130, 140];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};

function startStaticServer(dir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || "/").split("?")[0];
      let filePath = path.join(dir, urlPath === "/" ? "index.html" : urlPath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        const htmlCandidate = filePath + ".html";
        const indexCandidate = path.join(filePath, "index.html");
        if (fs.existsSync(htmlCandidate)) filePath = htmlCandidate;
        else if (fs.existsSync(indexCandidate)) filePath = indexCandidate;
        else filePath = path.join(dir, "index.html");
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
  });
}

async function launchBrowser() {
  for (const opts of [
    { headless: true },
    { headless: true, channel: "msedge" },
    { headless: true, channel: "chrome" },
  ]) {
    try {
      return await chromium.launch(opts);
    } catch {
      // try next channel
    }
  }
  throw new Error("No se encontró Chromium, Edge ni Chrome para Playwright.");
}

async function inspectPage(page) {
  return await page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const docScrollW = document.documentElement.scrollWidth;
    const horizontalOverflowPx = Math.max(0, Math.round(docScrollW - vw));

    const overflowingElements = [];
    const smallTouchTargets = [];
    const edgeGluedElements = [];

    const interactive = Array.from(
      document.querySelectorAll('button, a, [role="button"], input, select')
    );

    for (const el of interactive) {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const label =
        (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "")
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 40) || el.tagName.toLowerCase();

      if (rect.right > vw + 2 || rect.left < -2) {
        overflowingElements.push({ label, left: Math.round(rect.left), right: Math.round(rect.right), vw });
      }
      if (rect.width < 48 || rect.height < 48) {
        smallTouchTargets.push({
          label,
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        });
      }
      if (
        (rect.left >= 0 && rect.left < 4) ||
        (rect.right <= vw && vw - rect.right < 4)
      ) {
        edgeGluedElements.push({ label, left: Math.round(rect.left), right: Math.round(rect.right), vw });
      }
    }

    const textScale = getComputedStyle(document.documentElement).getPropertyValue("--text-scale").trim() || "1";
    const htmlFontSize = getComputedStyle(document.documentElement).fontSize;

    return {
      vw,
      vh,
      horizontalOverflowPx,
      textScale,
      htmlFontSize,
      overflowingCount: overflowingElements.length,
      overflowingSample: overflowingElements.slice(0, 5),
      smallTouchTargetsCount: smallTouchTargets.length,
      smallTouchTargetsSample: smallTouchTargets.slice(0, 5),
      edgeGluedCount: edgeGluedElements.length,
    };
  });
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    console.error("ERROR: No existe la carpeta 'out/'. Ejecuta 'npm run build' primero.");
    process.exit(1);
  }

  fs.mkdirSync(SHOTS_DIR, { recursive: true });

  const { server, port } = await startStaticServer(OUT_DIR);
  const baseUrl = `http://127.0.0.1:${port}`;
  const browser = await launchBrowser();

  const settingsOnly = process.argv.includes("--settings-only");
  const results = [];

  try {
    // 1. Auditoría de rutas x viewports x escalas de texto
    if (!settingsOnly) for (const vp of VIEWPORTS) {
      for (const scale of TEXT_SCALES) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
        });

        await context.addInitScript((pct) => {
          localStorage.setItem("mynotes_text_zoom_local_v1", JSON.stringify({ mode: "custom", customPercent: pct }));
          // Evitar tour o modal inicial bloqueante en auditoría limpia
          localStorage.setItem("mynotes_tour_completed", "true");
        }, scale);

        const page = await context.newPage();

        for (const route of ROUTES) {
          await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
          await page.waitForTimeout(350);
          const metrics = await inspectPage(page);
          results.push({
            viewport: vp.name,
            scale: `${scale}%`,
            route,
            ...metrics,
          });

          // Capturar muestras representativas: Home y Goals a 85%, 100%, 130% en 360dp y 320dp
          if (
            (route === "/" || route === "/goals" || route === "/balance") &&
            [85, 100, 130].includes(scale) &&
            (vp.name === "360dp" || vp.name === "320dp")
          ) {
            const safeRoute = route === "/" ? "home" : route.slice(1);
            await page.screenshot({
              path: path.join(SHOTS_DIR, `${safeRoute}_${vp.name}_${scale}pct.png`),
              fullPage: false,
            });
          }
        }
        await context.close();
      }
    }

    // 2. Capturas de Ajustes en claro y oscuro (360dp, 100% y 130%)
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width: 360, height: 780 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        colorScheme: theme,
      });
      await context.addInitScript((t) => {
        localStorage.setItem("theme", t);
        localStorage.setItem("mynotes_text_zoom_local_v1", JSON.stringify({ mode: "standard", customPercent: 100 }));
      }, theme);

      const page = await context.newPage();
      await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      // Descartar frase inicial y tour si están activos
      await page.evaluate(() => {
        const quote = document.querySelector('div.fixed.inset-0.z-\\[99999\\]');
        if (quote instanceof HTMLElement) quote.click();
      });
      await page.waitForTimeout(450);
      await page.evaluate(() => {
        const closeBtn = Array.from(document.querySelectorAll("button")).find((b) =>
          b.querySelector("svg.lucide-x")
        );
        if (closeBtn instanceof HTMLElement) closeBtn.click();
      });
      await page.waitForTimeout(300);

      // Abrir Ajustes desde el botón visible en barra móvil
      const settingsBtn = page.locator('button[title="Ajustes"], button[title="Settings"], button[title="Configuración"], button[title="设置"]').locator("visible=true").first();
      if (await settingsBtn.count()) {
        await settingsBtn.evaluate((el) => el.click());
        await page.waitForTimeout(550);
        // Hacer scroll dentro del diálogo de Ajustes para mostrar la tarjeta "Tamaño de texto"
        await page.evaluate(() => {
          const cards = Array.from(document.querySelectorAll(".glass-card"));
          const textCard = cards.find((el) => /Tamaño de texto|Text Size|文字大小/i.test(el.textContent || ""));
          if (textCard) textCard.scrollIntoView({ block: "center" });
        });
        await page.waitForTimeout(350);
        await page.screenshot({
          path: path.join(SHOTS_DIR, `settings_${theme}_360dp.png`),
          fullPage: false,
        });
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (settingsOnly) {
    console.log("Capturas de Ajustes (claro y oscuro) generadas en audit-output/screenshots/.");
    return;
  }

  // Generar informe JSON y Markdown
  fs.writeFileSync(path.join(AUDIT_DIR, "report.json"), JSON.stringify(results, null, 2), "utf8");

  const overflowIssues = results.filter((r) => r.horizontalOverflowPx > 0 || r.overflowingCount > 0);
  const lines = [
    `# Informe de Auditoría Responsive (MyNotes)`,
    ``,
    `- Fecha: ${new Date().toISOString()}`,
    `- Combinaciones evaluadas: ${results.length} (${VIEWPORTS.length} anchos × ${TEXT_SCALES.length} escalas × ${ROUTES.length} rutas)`,
    `- Casos con desbordamiento horizontal (>0 px): **${overflowIssues.length}**`,
    ``,
    `## Resumen por ancho y escala`,
    ``,
    `| Ancho | Escala | Ruta | Overflow H (px) | Elem. fuera | Targets <48px |`,
    `|---|---|---|---|---|---|`,
    ...results.map(
      (r) =>
        `| ${r.viewport} | ${r.scale} | \`${r.route}\` | ${r.horizontalOverflowPx} | ${r.overflowingCount} | ${r.smallTouchTargetsCount} |`
    ),
    ``,
    `## Capturas generadas`,
    ...fs.readdirSync(SHOTS_DIR).sort().map((f) => `- \`audit-output/screenshots/${f}\``),
  ];

  fs.writeFileSync(path.join(AUDIT_DIR, "report.md"), lines.join("\n"), "utf8");
  console.log(`Auditoría completada: ${results.length} comprobaciones. Overflow horizontal en ${overflowIssues.length} casos.`);
  console.log(`Informe: ${path.join(AUDIT_DIR, "report.md")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
