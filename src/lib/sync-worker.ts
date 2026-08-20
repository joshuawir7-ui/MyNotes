// sync-worker.ts
self.onmessage = (e: MessageEvent) => {
    try {
        // La serialización pesada ocurre aquí, fuera del hilo principal
        const serialized = JSON.stringify(e.data.state);
        self.postMessage({ serialized, name: e.data.name });
    } catch (err) {
        self.postMessage({ error: (err as Error).message, name: e.data.name });
    }
};
