import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getStorage } from '../services/progressStore';
import { en, id, type MessageKey, type Messages } from './messages';

export type Lang = 'id' | 'en';

const KEY = 'excellab.lang';
const DICT: Record<Lang, Messages> = { id, en };

interface I18nState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nState | null>(null);

function initialLang(): Lang {
  try {
    const v = getStorage()?.getItem(KEY);
    if (v === 'en' || v === 'id') return v;
  } catch {
    /* abaikan */
  }
  return 'id'; // Bahasa utama produk; pengguna memilih English secara sadar.
}

/** Menyisipkan {nama} pada teks. Kunci yang hilang di kamus aktif jatuh ke Indonesia, lalu ke nama kuncinya. */
export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const text = DICT[lang][key] ?? DICT.id[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      getStorage()?.setItem(KEY, l);
    } catch {
      /* mode privat: bahasa hanya berlaku selama halaman terbuka */
    }
  }, []);

  const t = useCallback((key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n harus dipakai di dalam I18nProvider');
  return v;
}
