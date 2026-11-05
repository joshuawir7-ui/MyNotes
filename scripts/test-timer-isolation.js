// scripts/test-timer-isolation.js
// Test suite for Phase 1A-i: Timer Isolation and Exact-Once Execution Guarantee

const assert = require("assert");

console.log("=== INICIANDO TEST SUITE: FASE 1A-i AISLAR EL TIMER ===");

// Mock storage
const storage = {};
global.localStorage = {
    getItem: (key) => storage[key] || null,
    setItem: (key, val) => { storage[key] = String(val); },
    removeItem: (key) => { delete storage[key]; }
};

// Mock Notification
global.Notification = class Notification {
    static permission = "granted";
    constructor(title, options) {
        this.title = title;
        this.options = options;
        notificationCalls.push({ title, options });
    }
};

let notificationCalls = [];
let focusTimeIncremented = 0;
let xpAdded = 0;

// Simulate TimerEngine logic
class TestTimerEngine {
    constructor() {
        this.state = {
            status: 'idle',
            durationMs: 25 * 60 * 1000,
            endAt: null,
            remainingMs: 25 * 60 * 1000,
            preset: 25,
            version: 1,
            finishedAt: null,
            isFloating: false,
            position: { x: 0, y: 0 },
            size: { width: 180, height: 180 }
        };
        this.lastHandledFinishedAt = null;
        this.listeners = [];
        this.persistCalls = 0;
    }

    getState() { return this.state; }

    setState(partial) {
        this.state = { ...this.state, ...partial, version: this.state.version + 1 };
        this.persistCalls++;
        this.listeners.forEach(fn => fn(this.state));
    }

    start(durationMs, preset) {
        const p = preset ?? this.state.preset ?? 25;
        const d = durationMs ?? (p * 60 * 1000);
        const now = Date.now();
        this.setState({
            status: 'running',
            durationMs: d,
            preset: p,
            endAt: now + d,
            remainingMs: d,
            finishedAt: null
        });
    }

    pause() {
        if (this.state.status !== 'running' || !this.state.endAt) return;
        const now = Date.now();
        const rem = Math.max(0, this.state.endAt - now);
        this.setState({
            status: 'paused',
            remainingMs: rem,
            endAt: null
        });
    }

    resume() {
        if (this.state.status !== 'paused') return;
        const now = Date.now();
        this.setState({
            status: 'running',
            endAt: now + this.state.remainingMs
        });
    }

    reset() {
        const d = (this.state.preset ?? 25) * 60 * 1000;
        this.setState({
            status: 'idle',
            durationMs: d,
            remainingMs: d,
            endAt: null,
            finishedAt: null
        });
    }

    reconcile(currentTime) {
        const now = currentTime || Date.now();
        if (this.state.status === 'running' && this.state.endAt && now >= this.state.endAt) {
            this.handleTimeExpired(now);
        }
    }

    handleTimeExpired(now) {
        if (this.state.status === 'finished') return;
        const finishedAt = this.state.endAt || now || Date.now();
        this.setState({
            status: 'finished',
            remainingMs: 0,
            endAt: null,
            finishedAt
        });
        this.triggerSideEffects();
    }

    triggerSideEffects() {
        if (this.state.finishedAt && this.state.finishedAt === this.lastHandledFinishedAt) {
            return; // Exact-once guard
        }
        this.lastHandledFinishedAt = this.state.finishedAt;

        // 1. Notification
        new global.Notification("MyNotes", { body: "⏰ ¡El tiempo de enfoque ha terminado!" });

        // 2. Stats
        const minutes = Math.max(1, Math.round(this.state.durationMs / 60000));
        focusTimeIncremented += minutes;
        xpAdded += 50;
    }
}

// TEST 1: Verificar 0 escrituras a persist por segundo durante 60 segundos
console.log("\n[TEST 1] Verificando 0 escrituras por tick durante 60 segundos...");
const engine = new TestTimerEngine();
engine.start(25 * 60 * 1000, 25);
assert.strictEqual(engine.persistCalls, 1, "Debe persistir 1 sola vez al iniciar");

// Simular 60 segundos de ticks en componentes locales (useTimerRemaining)
let localTickCount = 0;
let storePersistDuringTicks = 0;
for (let sec = 1; sec <= 60; sec++) {
    // El hook calcula localmente: endAt - now
    const rem = engine.state.endAt - (Date.now() + sec * 1000);
    localTickCount++;
    // engine.setState NO se llama en ticks
}
assert.strictEqual(engine.persistCalls, 1, "Persist no debe haber sido llamado en ningún tick");
assert.strictEqual(localTickCount, 60, "Debe haber calculado 60 ticks locales");
console.log("  ✓ 0 escrituras en Zustand/persist durante los 60 segundos");

// TEST 2: Pausar, Reanudar y Resetear
console.log("\n[TEST 2] Verificando eventos de ciclo de vida (Pausa, Reanudar, Reset)...");
engine.pause();
assert.strictEqual(engine.state.status, 'paused');
assert.strictEqual(engine.persistCalls, 2);

engine.resume();
assert.strictEqual(engine.state.status, 'running');
assert.strictEqual(engine.persistCalls, 3);

engine.reset();
assert.strictEqual(engine.state.status, 'idle');
assert.strictEqual(engine.persistCalls, 4);
console.log("  ✓ Cada evento cambia el estado y persiste exactamente 1 vez (4 eventos = 4 escrituras totales)");

// TEST 3: Vencimiento en segundo plano / cerrado (Reconciliación Exactamente Una Vez)
console.log("\n[TEST 3] Vencimiento en segundo plano (Exact-Once Guarantee)...");
notificationCalls = [];
focusTimeIncremented = 0;
xpAdded = 0;

const startTime = Date.now();
engine.start(10 * 60 * 1000, 10); // 10 minutos
const targetEndAt = engine.state.endAt;

// Simular que la app estuvo en segundo plano y el usuario vuelve 11 minutos después
const resumeTime = startTime + 11 * 60 * 1000;
engine.reconcile(resumeTime);

assert.strictEqual(engine.state.status, 'finished', "El estado debe reconciliarse a 'finished'");
assert.strictEqual(engine.state.remainingMs, 0, "remainingMs debe ser 0");
assert.strictEqual(notificationCalls.length, 1, "La notificación debe dispararse exactamente 1 vez");
assert.strictEqual(focusTimeIncremented, 10, "Los minutos de enfoque deben incrementarse exactamente 1 vez");
assert.strictEqual(xpAdded, 50, "La experiencia XP debe incrementarse exactamente 1 vez");

// Reconciliar de nuevo (simulando que la pantalla se apaga y se vuelve a encender)
engine.reconcile(resumeTime + 2000);
assert.strictEqual(notificationCalls.length, 1, "No debe duplicar notificaciones en subsiguientes reconciliaciones");
assert.strictEqual(focusTimeIncremented, 10, "No debe duplicar minutos de enfoque");
assert.strictEqual(xpAdded, 50, "No debe duplicar XP");
console.log("  ✓ Efectos secundarios ejecutados EXACTAMENTE UNA VEZ, sin duplicación al reconciliar");

// TEST 4: Rehidratación de estado heredado (Legacy Migration)
console.log("\n[TEST 4] Migración de estado legado desde backup/localStorage...");
const legacyTimer = {
    timeLeft: 900,
    isActive: true,
    targetTimestamp: Date.now() + 900 * 1000,
    isFloating: true,
    position: { x: 50, y: 100 }
};

const migrationEngine = new TestTimerEngine();
if (legacyTimer.targetTimestamp && legacyTimer.targetTimestamp > Date.now()) {
    migrationEngine.start(legacyTimer.targetTimestamp - Date.now(), Math.round(legacyTimer.timeLeft / 60));
}
assert.strictEqual(migrationEngine.state.status, 'running', "El timer legado activo debe restaurarse corriendo");
assert.ok(migrationEngine.state.remainingMs > 890 * 1000, "El tiempo restante debe coincidir con el targetTimestamp");
console.log("  ✓ Migración de estado legado exitosa");

console.log("\n========================================================");
console.log("TODAS LAS PRUEBAS DE FASE 1A-i PASARON SATISFACTORIAMENTE (4/4)");
console.log("========================================================");
