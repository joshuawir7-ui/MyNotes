// widget-payload.ts
// Pure helpers that build the (heavy) widget payload strings. Used by widget-sync-worker.ts
// (off the main thread) and as a main-thread fallback if Workers are unavailable.

export const buildLightweightNotes = (notes: any[]) =>
    (notes || []).map((note: any) => ({
        ...note,
        blocks: Array.isArray(note.blocks)
            ? note.blocks.map((b: any) => {
                if ((b.type === 'image' || b.type === 'drawing') && typeof b.content === 'string') {
                    const src = b.content;
                    if (src.startsWith('file://') || src.startsWith('/') || src.startsWith('http') || src.startsWith('drive://') || src.includes('_capacitor_file_')) {
                        return b;
                    }
                    if (src.length > 500000) {
                        return { ...b, content: src.slice(0, 200000) };
                    }
                    return b;
                }
                if (b.type === 'text' && typeof b.content === 'string') {
                    // Strip overly large inline base64 images if they exceed 500KB to fit widget SharedPreferences
                    let contentStr = b.content;
                    if (contentStr.length > 500000) {
                        contentStr = contentStr.replace(/src=["']data:image\/[^;]+;base64,[^"']{30000,}["']/g, 'src=""');
                    }
                    return { ...b, content: contentStr };
                }
                return b;
            })
            : note.blocks
    }));

export interface WidgetPayloadInput {
    goals?: any[];
    appointments?: any[];
    tasks?: any[];
    notes?: any[];
    snapshots?: any;
}

export const buildWidgetPayload = (input: WidgetPayloadInput) => {
    const { goals, appointments, tasks, notes, snapshots } = input;
    const out: Record<string, string> = {};
    if (goals !== undefined) {
        out.goals = JSON.stringify((goals || []).map((g: any) => ({
            ...g,
            photos: undefined,
            objectives: Array.isArray(g.objectives) ? g.objectives.map((o: any) => ({ ...o, image: undefined })) : g.objectives
        })));
    }
    if (appointments !== undefined) out.appointments = JSON.stringify(appointments || []);
    if (tasks !== undefined) out.tasks = JSON.stringify((tasks || []).map((t: any) => ({ ...t, photos: undefined })));
    if (notes !== undefined) out.notes = JSON.stringify(buildLightweightNotes(notes));
    if (snapshots !== undefined) out.dailySnapshots = JSON.stringify(snapshots || {});
    return out;
};
