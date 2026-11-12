import { NoteBlock } from "@/lib/store"

export const isNoteEmpty = (titleStr: any, blocksList: NoteBlock[]): boolean => {
    const t = typeof titleStr === 'string' ? titleStr.trim() : '';
    if (t !== '' && t !== 'Nota sin título' && t !== 'Untitled Note') return false;
    for (const block of blocksList) {
        if (!block) continue;
        if (block.type === 'text') {
            const textContent = typeof block.content === 'string' ? block.content : '';
            const cleanText = textContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
            if (cleanText !== '') return false;
        } else if (block.type === 'task-list') {
            let listTitle = '';
            let items: any[] = [];
            if (block.content && typeof block.content === 'object' && !Array.isArray(block.content)) {
                listTitle = block.content.title || '';
                items = Array.isArray(block.content.items) ? block.content.items : [];
            } else {
                items = Array.isArray(block.content) ? block.content : [];
            }
            if (listTitle.trim() !== '') return false;
            for (const item of items) {
                if (item && typeof item === 'object' && typeof item.text === 'string' && item.text.trim() !== '') {
                    return false;
                }
            }
        } else if (block.type === 'table') {
            const content = block.content || { headers: [], rows: [] };
            const headers = Array.isArray(content.headers) ? content.headers : [];
            const rows = Array.isArray(content.rows) ? content.rows : [];
            for (const h of headers) {
                if (typeof h === 'string' && h.trim() !== '') return false;
            }
            for (const r of rows) {
                if (Array.isArray(r)) {
                    for (const c of r) {
                        if (typeof c === 'string' && c.trim() !== '') return false;
                    }
                }
            }
        } else if (block.type === 'image') {
            if (typeof block.content === 'string' && block.content.trim() !== '') return false;
        } else if (block.type === 'drawing') {
            if (typeof block.content === 'string' && block.content.trim() !== '') return false;
        } else if (block.type === 'file') {
            if (block.content && typeof block.content === 'object' && block.content.url !== '') return false;
        }
    }
    return true;
};

