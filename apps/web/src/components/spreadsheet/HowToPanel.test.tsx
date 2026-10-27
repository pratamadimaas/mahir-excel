import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HowToPanel } from './HowToPanel';

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('HowToPanel', () => {
  it('menampilkan dua cara dengan gambar bernama dan langkah-langkahnya', () => {
    render(<HowToPanel mode="katalog" />);
    expect(screen.getByRole('heading', { name: 'Cara mengerjakan latihan' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Isi langsung di sini' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kerjakan di Excel' })).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(2);
    for (const img of screen.getAllByRole('img')) expect(img.getAttribute('alt')!.length).toBeGreaterThan(30); // alt teks bermakna
    expect(screen.getByText(/Klik Kerjakan di Excel\. File \.xlsx terunduh\./)).toBeInTheDocument();
    expect(screen.getByText(/Cocok untuk HP/)).toBeInTheDocument();
  });

  it('mode katalog tanpa tombol aksi; mode latihan memanggil tiap cara', async () => {
    const { unmount } = render(<HowToPanel mode="katalog" />);
    expect(screen.queryByRole('button', { name: /Unduh file Excel|Mulai isi di sini/ })).not.toBeInTheDocument();
    unmount();

    const onHere = vi.fn();
    const onDownload = vi.fn();
    render(<HowToPanel mode="latihan" onHere={onHere} onDownload={onDownload} />);
    await userEvent.click(screen.getByRole('button', { name: /Mulai isi di sini/ }));
    await userEvent.click(screen.getByRole('button', { name: /Unduh file Excel/ }));
    expect(onHere).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('tombol unduh dinonaktifkan saat sibuk', () => {
    render(<HowToPanel mode="latihan" busy />);
    expect(screen.getByRole('button', { name: /Unduh file Excel/ })).toBeDisabled();
  });

  it('sembunyikan diingat di browser dan bisa ditampilkan lagi', async () => {
    const { unmount } = render(<HowToPanel mode="katalog" />);
    await userEvent.click(screen.getByRole('button', { name: /Sembunyikan panduan/ }));
    expect(screen.queryByRole('heading', { name: 'Cara mengerjakan latihan' })).not.toBeInTheDocument();
    expect(localStorage.getItem('xl-howto-hidden')).toBe('1');
    unmount();

    render(<HowToPanel mode="katalog" />); // halaman lain: tetap tersembunyi
    expect(screen.queryByRole('heading', { name: 'Cara mengerjakan latihan' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Tampilkan cara mengerjakan latihan/ }));
    expect(screen.getByRole('heading', { name: 'Cara mengerjakan latihan' })).toBeInTheDocument();
    expect(localStorage.getItem('xl-howto-hidden')).toBeNull();
  });

  it('gambar bisa diperbesar dan ditutup dengan tombol atau Escape', async () => {
    render(<HowToPanel mode="katalog" />);
    await userEvent.click(screen.getByRole('button', { name: /Perbesar gambar panduan: lewat Excel/ }));
    const dialog = screen.getByRole('dialog', { name: 'Kerjakan di Excel' });
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/panduan/excel.jpg');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tutup' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Perbesar gambar panduan: langsung/ }));
    expect(screen.getByRole('dialog', { name: 'Isi langsung di sini' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('tetap berfungsi bila penyimpanan browser diblokir', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('diblokir');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('diblokir');
    });
    render(<HowToPanel mode="katalog" />);
    await userEvent.click(screen.getByRole('button', { name: /Sembunyikan panduan/ }));
    expect(screen.queryByRole('heading', { name: 'Cara mengerjakan latihan' })).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
