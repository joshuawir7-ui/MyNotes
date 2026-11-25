import type { Language } from "./translations"
import { ZH_INLINE } from "./zh-inline"

/**
 * Inline translation for `language === 'es' ? "es text" : "en text"` call sites.
 * - Spanish (es, es-419) -> Spanish text
 * - Chinese (zh*)        -> dictionary lookup keyed by the English text (falls back to English)
 * - Anything else        -> English text
 */
export function lt(language: Language | string | undefined, es: string, en: string): string {
    const lang = String(language || 'en')
    if (lang === 'es' || lang.startsWith('es')) return es
    if (lang === 'zh' || lang.startsWith('zh')) return ZH_INLINE[en] ?? en
    return en
}

/**
 * Tiny inline-translation helper for UI strings that live next to the component.
 * Falls back to English when a language has no dedicated string.
 * Spanish variants (es-419) use the Spanish text, Chinese variants use zh.
 */
export function pick(
    language: Language | string | undefined,
    strings: { es: string; en: string; zh?: string }
): string {
    const lang = String(language || 'en')
    if (lang === 'es' || lang.startsWith('es')) return strings.es
    if (lang === 'zh' || lang.startsWith('zh')) return strings.zh ?? strings.en
    return strings.en
}
