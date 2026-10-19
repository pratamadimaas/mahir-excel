import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// Beberapa halaman memuat banyak komponen sekaligus; beri waktu lebih agar tes tidak flaky saat mesin sibuk.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// jsdom belum mengimplementasikan beberapa API browser.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
HTMLElement.prototype.scrollIntoView = vi.fn();
