// widget-sync-worker.ts
// Builds the widget payload strings off the main thread. The main thread only posts the
// changed collections; mapping/stripping + JSON.stringify happen here.
import { buildWidgetPayload } from './widget-payload';

self.onmessage = (e: MessageEvent) => {
    const { id, ...input } = e.data || {};
    try {
        (self as any).postMessage({ id, result: buildWidgetPayload(input) });
    } catch (err) {
        (self as any).postMessage({ id, error: (err as Error).message });
    }
};
