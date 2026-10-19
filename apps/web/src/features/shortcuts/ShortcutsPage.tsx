import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Info, Star } from 'lucide-react';
import { shortcutCategories } from '@excellab/shared';
import { EmptyState, ErrorState, Loading, Status } from '../../components/feedback/Feedback';
import { Keycaps } from '../../components/learning/Bits';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api } from '../../services/api';
import type { ShortcutCategory, ShortcutView } from '../../services/types';
import { ShortcutQuiz } from './ShortcutQuiz';
import { getPlatformPref, loadFavorites, saveFavorites, setPlatformPref, type Platform } from './prefs';

type Mode = 'referensi' | 'kuis';

export function ShortcutsPage() {
  useDocumentTitle('Shortcut Excel');
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = (params.get('kategori') ?? '') as ShortcutCategory | '';
  const [platform, setPlatform] = useState<Platform | 'semua'>(() => getPlatformPref());
  const [mode, setMode] = useState<Mode>('referensi');
  const [onlyFav, setOnlyFav] = useState(false);
  const [favs, setFavs] = useState<Set<string>>(() => loadFavorites());
  const data = useAsync((s) => api.get<ShortcutView[]>('/shortcuts?pageSize=200', s), []);

  useEffect(() => {
    if (platform !== 'semua') setPlatformPref(platform);
  }, [platform]);

  const setParam = (k: string, v: string): void => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const toggleFav = (slug: string): void => {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      saveFavorites(next);
      return next;
    });
  };

  const rows = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (data.data ?? []).filter((s) => {
      if (category && s.category !== category) return false;
      if (platform === 'windows' && !s.keysWindows) return false;
      if (platform === 'mac' && !s.keysMac) return false;
      if (onlyFav && !favs.has(s.slug)) return false;
      const hay = `${s.action} ${s.keysWindows ?? ''} ${s.keysMac ?? ''} ${s.explanation}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [data.data, q, category, platform, onlyFav, favs]);

  return (
    <div className="xl-page">
      <header className="xl-page-head">
        <p className="xl-eyebrow">Referensi</p>
        <h1>Shortcut Excel</h1>
        <p>Cari berdasarkan aksi atau kombinasi tombol, simpan favoritmu, lalu uji ingatanmu lewat kuis.</p>
      </header>

      <div role="tablist" aria-label="Mode" className="xl-tabs">
        {(['referensi', 'kuis'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            id={`tab-${m}`}
            aria-selected={mode === m}
            aria-controls={`panel-${m}`}
            tabIndex={mode === m ? 0 : -1}
            onClick={() => setMode(m)}
          >
            {m === 'referensi' ? 'Referensi' : 'Mode kuis'}
          </button>
        ))}
      </div>

      <Status tone="info">
        Pintasan dapat berbeda antar versi Excel, sistem operasi, tata letak keyboard, dan browser (untuk Excel di web). Daftar ini belum
        diuji di semua kombinasi; kolom keterangan menjelaskan statusnya. Di Mac, tombol fungsi mungkin perlu ditekan bersama Fn.
      </Status>

      {data.loading && <Loading label="Memuat shortcut…" lines={5} />}
      {data.error && <ErrorState message={data.error} onRetry={data.reload} />}

      {data.data && mode === 'kuis' && (
        <div id="panel-kuis" role="tabpanel" aria-labelledby="tab-kuis" className="mt-3">
          <ShortcutQuiz shortcuts={data.data} platform={platform === 'semua' ? 'windows' : platform} onPlatform={(p) => setPlatform(p)} />
        </div>
      )}

      {data.data && mode === 'referensi' && (
        <div id="panel-referensi" role="tabpanel" aria-labelledby="tab-referensi">
          <form className="xl-filters mt-3" onSubmit={(e) => e.preventDefault()} role="search" aria-label="Cari shortcut">
            <div className="xl-filter-grow">
              <label htmlFor="sc-q" className="form-label">
                Cari aksi atau tombol
              </label>
              <input
                id="sc-q"
                type="search"
                className="form-control"
                value={q}
                placeholder="mis. filter, Ctrl + D"
                onChange={(e) => setParam('q', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="sc-cat" className="form-label">
                Kategori
              </label>
              <select id="sc-cat" className="form-select" value={category} onChange={(e) => setParam('kategori', e.target.value)}>
                <option value="">Semua kategori</option>
                {Object.entries(shortcutCategories).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sc-plat" className="form-label">
                Platform
              </label>
              <select
                id="sc-plat"
                className="form-select"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform | 'semua')}
              >
                <option value="semua">Windows dan Mac</option>
                <option value="windows">Windows</option>
                <option value="mac">Mac</option>
              </select>
            </div>
            <div className="align-self-end">
              <div className="form-check mb-2">
                <input
                  id="sc-fav"
                  type="checkbox"
                  className="form-check-input"
                  checked={onlyFav}
                  onChange={(e) => setOnlyFav(e.target.checked)}
                />
                <label htmlFor="sc-fav" className="form-check-label">
                  Favorit saja ({favs.size})
                </label>
              </div>
            </div>
          </form>

          <p className="xl-muted xl-small" role="status">
            Menampilkan {rows.length} dari {data.data.length} shortcut
          </p>

          {rows.length === 0 ? (
            <EmptyState title={onlyFav && favs.size === 0 ? 'Belum ada favorit' : 'Shortcut tidak ditemukan'}>
              {onlyFav && favs.size === 0
                ? 'Tekan ikon bintang pada shortcut untuk menyimpannya di sini.'
                : 'Coba kata kunci lain atau hapus filter.'}
            </EmptyState>
          ) : (
            <div className="xl-table-wrap">
              <table className="xl-table xl-shortcut-table">
                <caption className="visually-hidden">Daftar shortcut Excel</caption>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: 44 }}>
                      <span className="visually-hidden">Favorit</span>
                    </th>
                    <th scope="col">Aksi</th>
                    <th scope="col">Shortcut</th>
                    <th scope="col" className="d-none d-md-table-cell">
                      Kategori
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.slug}>
                      <td>
                        <button
                          type="button"
                          className={`xl-star${favs.has(s.slug) ? ' on' : ''}`}
                          aria-pressed={favs.has(s.slug)}
                          aria-label={`${favs.has(s.slug) ? 'Hapus dari' : 'Tambah ke'} favorit: ${s.action}`}
                          onClick={() => toggleFav(s.slug)}
                        >
                          <Star className="xl-icon" aria-hidden="true" fill={favs.has(s.slug) ? 'currentColor' : 'none'} />
                        </button>
                      </td>
                      <td>
                        <div className="fw-semibold">{s.action}</div>
                        <div className="xl-muted xl-small">{s.explanation}</div>
                        {s.example && <div className="xl-small mt-1">Contoh: {s.example}</div>}
                        <details className="xl-small mt-1">
                          <summary className="xl-muted" style={{ cursor: 'pointer' }}>
                            <Info className="xl-icon me-1" aria-hidden="true" />
                            Catatan verifikasi
                          </summary>
                          <span className="xl-muted">{s.verification}</span>
                        </details>
                      </td>
                      <td>
                        <div className="d-flex flex-column gap-2">
                          {platform !== 'mac' && s.keysWindows && (
                            <div className="xl-key-row">
                              <span className="xl-plat">Win</span>
                              <Keycaps combo={s.keysWindows} />
                            </div>
                          )}
                          {platform !== 'windows' && s.keysMac && (
                            <div className="xl-key-row">
                              <span className="xl-plat">Mac</span>
                              <Keycaps combo={s.keysMac} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="d-none d-md-table-cell xl-muted">{shortcutCategories[s.category]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
