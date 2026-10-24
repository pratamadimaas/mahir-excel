import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { en, id, type MessageKey } from './i18n/messages';
import { translate } from './i18n/I18n';
import { EXERCISE, MODULES, SIGNED_IN, mockApi, renderApp } from './testutil';

const base = {
  ...SIGNED_IN,
  'GET /modules': MODULES,
  'GET /exercises': () => ({ body: { data: [], meta: { page: 1, pageSize: 100, total: 0 } } }),
  'GET /exercises/total-harga-barang': { ...EXERCISE, slug: 'total-harga-barang' },
  'GET /shortcuts': [],
  'GET /worksheets': [],
  'GET /auth/config': { emailEnabled: true },
  'POST /track': { counted: true },
};

const anon = { ...base, 'GET /auth/me': { user: null, csrfToken: null } };

describe('kamus terjemahan', () => {
  const placeholders = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

  it('kamus Inggris memuat semua kunci, tidak kosong, dan variabelnya sama dengan versi Indonesia', () => {
    const keys = Object.keys(id) as MessageKey[];
    expect(Object.keys(en).sort()).toEqual([...keys].sort());
    for (const k of keys) {
      expect(en[k].trim(), k).not.toBe('');
      expect(placeholders(en[k]), `variabel ${k}`).toEqual(placeholders(id[k]));
    }
  });

  it('translate menyisipkan variabel dan tidak merusak bila variabel kurang', () => {
    expect(translate('en', 'nav.progress', { points: 12, days: 3 })).toBe('Progress (12 points · 3 days)');
    expect(translate('id', 'nav.progress', { points: 12, days: 3 })).toBe('Kemajuan (12 poin · 3 hari)');
    expect(translate('en', 'nav.progress', { points: 1 })).toContain('{days}');
  });
});

describe('ganti bahasa', () => {
  it('bawaan Indonesia; tombol mengganti ke English, tersimpan, dan mengubah <html lang>', async () => {
    mockApi(anon);
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: /Excel bisa dipelajari/ })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('id');

    await userEvent.click(screen.getByRole('button', { name: 'Ganti bahasa ke English' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Excel can be learned. Start here.' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('excellab.lang')).toBe('en');

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    // Navbar pengunjung menautkan ke bagian beranda dan ikut berganti bahasa.
    expect(within(nav).getByRole('link', { name: 'Learn' })).toHaveAttribute('href', '/#belajar');
    expect(within(nav).getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/#harga');
    expect(within(nav).getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/#faq');
    expect(within(nav).queryByRole('link', { name: 'Placement test' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up free' })).toHaveAttribute('href', '/daftar');
    expect(screen.getByRole('link', { name: 'Take the placement test' })).toHaveAttribute('href', '/tes-penempatan');
  });

  it('pilihan bahasa tersimpan antar kunjungan', async () => {
    localStorage.setItem('excellab.lang', 'en');
    mockApi(base);
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Excel can be learned. Start here.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch language to Bahasa Indonesia' })).toBeInTheDocument();
  });

  it('nilai tidak valid di localStorage diabaikan (kembali ke Indonesia)', async () => {
    localStorage.setItem('excellab.lang', 'fr');
    mockApi(base);
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: /Excel bisa dipelajari/ })).toBeInTheDocument();
  });

  it('di area konten (isi masih Indonesia) tampil catatan; di beranda tidak', async () => {
    localStorage.setItem('excellab.lang', 'en');
    mockApi(base);
    const home = renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'Excel can be learned. Start here.' });
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    home.unmount();
    renderApp('/belajar');
    expect(await screen.findByRole('note')).toHaveTextContent('currently available in Indonesian only');
  });

  it('halaman masuk dan daftar tampil dalam English beserta validasi inline', async () => {
    localStorage.setItem('excellab.lang', 'en');
    mockApi(anon);
    const login = renderApp('/masuk');
    expect(await screen.findByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Code by email' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    login.unmount();

    renderApp('/daftar');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign up' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(await screen.findByText('Display name is required.')).toBeInTheDocument();
    expect(screen.getByText('At least 8 characters.')).toBeInTheDocument();
  });

  it('alur kode email dalam English', async () => {
    localStorage.setItem('excellab.lang', 'en');
    mockApi({ ...anon, 'POST /auth/email/request': { sent: true, cooldownSeconds: 60 } });
    renderApp('/masuk?metode=kode');
    await userEvent.type(await screen.findByLabelText('Email'), 'budi@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByLabelText('6-digit code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resend code \(\d+ s\)/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Change email' })).toBeInTheDocument();
  });
});
