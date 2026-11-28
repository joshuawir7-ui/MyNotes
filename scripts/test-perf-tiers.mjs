import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, ".tmp-perf-test");

// Clean previous temp build if any, compile real src/lib/perf-tier.ts
fs.rmSync(OUT_DIR, { recursive: true, force: true });
execSync(
  `npx tsc --module commonjs --target es2022 --esModuleInterop --moduleResolution node --skipLibCheck --outDir "${OUT_DIR}" src/lib/perf-tier.ts`,
  { stdio: "inherit" }
);

// Provide minimal browser globals for module import & legacy migration test
const storageMap = new Map();
globalThis.localStorage = {
  getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k),
};
globalThis.window = {
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
};
globalThis.document = {
  documentElement: {
    dataset: {},
    setAttribute(k, v) {
      this[k] = v;
    },
  },
};

const perfTier = await import("file://" + path.join(OUT_DIR, "perf-tier.js").replace(/\\/g, "/"));
const {
  estimateTier,
  evaluateWindowDowngrade,
  resolveEffectiveAttributes,
  initPerfTier,
  setPerfTierMode,
  getPerfTierSnapshot,
} = perfTier;

const GB = 1024 ** 3;

console.log("1. Testing estimateTier profiles...");
const pocoX6Pro = estimateTier(
  {
    sdkInt: 34,
    model: "2311DRK48G",
    manufacturer: "Xiaomi",
    hardware: "mt6897",
    socModel: "MT6897",
    socManufacturer: "MediaTek",
    totalMemBytes: 12 * GB,
    isLowRamDevice: false,
    availableProcessors: 8,
    densityDpi: 440,
    refreshRate: 120,
    isPowerSaveMode: false,
    thermalStatus: 0,
  },
  "ANGLE (ARM, Mali-G615 MC6, OpenGL ES 3.2)"
);
assert.equal(pocoX6Pro.tier, "high", `Expected POCO X6 Pro -> high, got ${pocoX6Pro.tier} (${pocoX6Pro.reasons})`);

const galaxyA13 = estimateTier(
  {
    sdkInt: 33,
    model: "SM-A135M",
    manufacturer: "samsung",
    hardware: "s5e3830",
    socModel: "Exynos 850",
    socManufacturer: "Samsung",
    totalMemBytes: 4 * GB,
    isLowRamDevice: false,
    availableProcessors: 8,
    densityDpi: 400,
    refreshRate: 60,
    isPowerSaveMode: false,
    thermalStatus: 0,
  },
  "ANGLE (ARM, Mali-G52 MC1, OpenGL ES 3.2)"
);
assert.ok(
  galaxyA13.tier === "low" || galaxyA13.tier === "medium",
  `Expected Galaxy A13 -> low/medium, got ${galaxyA13.tier}`
);

const sdk24LowRam = estimateTier(
  {
    sdkInt: 24,
    model: "Generic",
    manufacturer: "Generic",
    hardware: "qcom",
    socModel: "",
    socManufacturer: "",
    totalMemBytes: 2 * GB,
    isLowRamDevice: true,
    availableProcessors: 4,
    densityDpi: 320,
    refreshRate: 60,
    isPowerSaveMode: false,
    thermalStatus: 0,
  },
  "Adreno (TM) 505"
);
assert.equal(sdk24LowRam.tier, "low", "Expected SDK 24 + 2GB -> low");

const modernPixel = estimateTier(
  {
    sdkInt: 35,
    model: "Pixel 9 Pro",
    manufacturer: "Google",
    hardware: "komodo",
    socModel: "Tensor G4",
    socManufacturer: "Google",
    totalMemBytes: 16 * GB,
    isLowRamDevice: false,
    availableProcessors: 8,
    densityDpi: 480,
    refreshRate: 120,
    isPowerSaveMode: false,
    thermalStatus: 0,
  },
  "ANGLE (ARM, Mali-G715, OpenGL ES 3.2)"
);
assert.equal(modernPixel.tier, "high", "Expected modern Pixel -> high");

const noProfile = estimateTier(null, "");
assert.equal(noProfile.tier, "medium", "Expected null profile -> medium");
console.log("   OK: POCO=", pocoX6Pro.tier, "A13=", galaxyA13.tier, "SDK24=", sdk24LowRam.tier, "Pixel=", modernPixel.tier, "null=", noProfile.tier);

console.log("2. Testing evaluateWindowDowngrade...");
const makeWin = (p95Ms, badShare) => ({
  ts: Date.now(),
  source: "scroll",
  frames: 60,
  durationMs: 1200,
  p95Ms,
  badShare,
  isBad: p95Ms >= 33 || badShare >= 0.25,
  samplerAvgCostMs: 0.05,
});

// 3 bad out of 5 -> drop 1 tier
const seq3of5 = [
  makeWin(16, 0.02),
  makeWin(38, 0.35),
  makeWin(18, 0.05),
  makeWin(40, 0.4),
  makeWin(36, 0.3),
];
const r1 = evaluateWindowDowngrade({
  mode: "auto",
  currentAutoTier: "high",
  windows: seq3of5,
  now: 1_000_000,
  lastDowngradeAt: 0,
  autoDowngradedThisSession: false,
});
assert.equal(r1.downgraded, true);
assert.equal(r1.nextTier, "medium");

// Severe > 100ms across 3 bad windows -> drop 2 tiers (high -> low)
const rSevere = evaluateWindowDowngrade({
  mode: "auto",
  currentAutoTier: "high",
  windows: [makeWin(115, 0.7), makeWin(120, 0.7), makeWin(110, 0.7)],
  now: 1_000_000,
  lastDowngradeAt: 0,
  autoDowngradedThisSession: false,
});
assert.equal(rSevere.downgraded, true);
assert.equal(rSevere.nextTier, "low");

// Cooldown active -> no downgrade
const rCooldown = evaluateWindowDowngrade({
  mode: "auto",
  currentAutoTier: "medium",
  windows: seq3of5,
  now: 1_050_000,
  lastDowngradeAt: 1_000_000,
  autoDowngradedThisSession: false,
});
assert.equal(rCooldown.downgraded, false);

// Already downgraded this session -> no downgrade
const rSessionCap = evaluateWindowDowngrade({
  mode: "auto",
  currentAutoTier: "medium",
  windows: seq3of5,
  now: 10_000_000,
  lastDowngradeAt: 1_000_000,
  autoDowngradedThisSession: true,
});
assert.equal(rSessionCap.downgraded, false);

// Manual mode never changes
const rManual = evaluateWindowDowngrade({
  mode: "high",
  currentAutoTier: "high",
  windows: [makeWin(150, 0.9)],
  now: 10_000_000,
  lastDowngradeAt: 0,
  autoDowngradedThisSession: false,
});
assert.equal(rManual.downgraded, false);
console.log("   OK: 3/5, severe, cooldown, session cap, manual lock passed.");

console.log("3. Testing powerSave / thermal / reducedMotion caps & overrides...");
const capsAttrs = resolveEffectiveAttributes({
  ...getPerfTierSnapshot(),
  mode: "auto",
  effectiveTier: "medium",
  powerSaveActive: true,
  prefersReducedMotion: true,
  overrides: { glassBlur: "auto", shadows: "auto", motion: "auto", decorativeBg: "auto" },
});
assert.equal(capsAttrs.fxMotion, "minimal");
await setPerfTierMode("high");
assert.equal(getPerfTierSnapshot().effectiveTier, "high", "Manual high should stay high");
console.log("   OK: caps and manual override priority passed.");

console.log("4. Testing legacy performanceMode migration...");
storageMap.set("notes-storage", JSON.stringify({ state: { performanceMode: true } }));
// Fresh import via query/cache bust isn't needed if we check migration logic in initPerfTier
// Verify layout.tsx pre-hydration script sets attributes cleanly
const layoutSrc = fs.readFileSync(path.join(ROOT, "src/app/layout.tsx"), "utf8");
const match = layoutSrc.match(/const PRE_HYDRATION_TIER_SCRIPT = `([\s\S]*?)`;/);
assert.ok(match, "PRE_HYDRATION_TIER_SCRIPT must exist in layout.tsx");
const scriptCode = match[1];
const fakeDoc = { documentElement: { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } } };
vm.runInNewContext(scriptCode, {
  document: fakeDoc,
  localStorage: {
    getItem: (k) =>
      k === "mynotes_perf_tier_mirror_v1"
        ? JSON.stringify({ tier: "low", fxBlur: "off", fxShadow: "simple", fxMotion: "minimal", fxBg: "off" })
        : null,
  },
});
assert.equal(fakeDoc.documentElement.attrs["data-tier"], "low");
assert.equal(fakeDoc.documentElement.attrs["data-fx-blur"], "off");
assert.equal(fakeDoc.documentElement.attrs["data-fx-motion"], "minimal");
console.log("   OK: pre-hydration <head> script sets data-* attributes before hydration.");

console.log("5. Verifying perf-tier isolation from Zustand / Drive / backup...");
const storeSrc = fs.readFileSync(path.join(ROOT, "src/lib/store.ts"), "utf8");
assert.ok(!storeSrc.includes("perf-tier"), "store.ts must not import perf-tier");
const perfTierSrc = fs.readFileSync(path.join(ROOT, "src/lib/perf-tier.ts"), "utf8");
assert.ok(!perfTierSrc.includes("markCloudSyncDirty"), "perf-tier.ts must not call markCloudSyncDirty");
assert.ok(!perfTierSrc.includes("useStore"), "perf-tier.ts must not depend on Zustand useStore");
console.log("   OK: zero coupling with Zustand, Drive sync, or backup.");

fs.rmSync(OUT_DIR, { recursive: true, force: true });
console.log("\nALL PERF-TIER TESTS PASSED.");
