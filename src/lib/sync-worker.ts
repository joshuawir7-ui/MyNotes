// sync-worker.ts
self.onmessage = (e: MessageEvent) => {
    const { id, name, state } = e.data || {};
    try {
        // La serialización pesada ocurre aquí, fuera del hilo principal
        const serialized = JSON.stringify(state);
        self.postMessage({ id, serialized, name });
    } catch (err) {
        self.postMessage({ id, error: (err as Error).message, name });
    }
};
