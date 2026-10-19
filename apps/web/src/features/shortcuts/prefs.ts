import { getStorage } from '../../services/progressStore';

export type Platform = 'windows' | 'mac';

const FAV_KEY = 'excellab.favorites.v1';
const PLATFORM_KEY = 'excellab.platform';

/** Favorit shortcut hanya disimpan di browser ini. */
export function loadFavorites(): Set<string> {
  try {
    const raw = getStorage()?.getItem(FAV_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string').slice(0, 200) : []);
  } catch {
    return new Set();
  }
}

export function saveFavorites(favs: Set<string>): void {
  try {
    getStorage()?.setItem(FAV_KEY, JSON.stringify([...favs]));
  } catch {
    /* mode privat: favorit hanya bertahan selama halaman terbuka */
  }
}

export function getPlatformPref(): Platform | 'semua' {
  try {
    const v = getStorage()?.getItem(PLATFORM_KEY);
    if (v === 'windows' || v === 'mac') return v;
  } catch {
    /* abaikan */
  }
  return 'semua';
}

export function setPlatformPref(p: Platform | 'semua'): void {
  try {
    if (p === 'semua') getStorage()?.removeItem(PLATFORM_KEY);
    else getStorage()?.setItem(PLATFORM_KEY, p);
  } catch {
    /* abaikan */
  }
}
