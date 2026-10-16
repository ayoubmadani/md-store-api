// قائمة الدول من خدمة المواقع (locations/countries.json على R2) — ذاكرة دقيقة واحدة.
// تُستعمل لمعرفة الدول المتوقفة وعملة كل دولة (تُحفظ في المتجر لتستعملها الثيمات).
export type LevelNames = { ar?: string; fr?: string; en?: string };
export type CountryInfo = { code: string; currency?: string; active?: boolean; levels?: { region?: LevelNames; locality?: LevelNames } };

let cache: { at: number; list: CountryInfo[] } | null = null;

export async function fetchCountries(): Promise<CountryInfo[]> {
    if (cache && Date.now() - cache.at < 60_000) return cache.list;
    const base = (process.env.AWS_PUBLIC_URL || '').replace(/\/$/, '');
    let list = cache?.list ?? [];
    if (base) {
        try {
            const res = await fetch(`${base}/locations/countries.json?t=${Date.now()}`, { signal: AbortSignal.timeout(4000) });
            if (res.ok) list = (await res.json()) as CountryInfo[];
            else if (res.status === 404) list = [];
        } catch { /* نبقي آخر قيمة معروفة */ }
    }
    cache = { at: Date.now(), list };
    return list;
}

export function clearCountriesCache() {
    cache = null;
}

// عملة دولة (ISO-4217) — الجزائر DZD دائماً
export async function currencyFor(country: string): Promise<string | undefined> {
    const cc = (country || 'DZ').toUpperCase();
    if (cc === 'DZ') return 'DZD';
    return (await fetchCountries()).find((c) => c.code === cc)?.currency;
}

// أسماء مستويي التقسيم (ولاية/بلدية، ولاية/معتمدية…) — للثيمات. null للجزائر (أسماء الثيمات الأصلية)
export async function levelsFor(country: string): Promise<CountryInfo['levels'] | null> {
    const cc = (country || 'DZ').toUpperCase();
    if (cc === 'DZ') return null;
    return (await fetchCountries()).find((c) => c.code === cc)?.levels ?? null;
}
