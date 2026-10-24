import type ExcelJS from 'exceljs';
import { templates } from '@excellab/shared';
import { type TSheet, writeWorkbook } from './model';
import { anggaranPernikahan, invoicePiutang, keuanganPribadi, laporanPenjualan, rabSederhana, stokBarang } from './specs';

const specs: Record<string, () => TSheet[]> = {
  'laporan-penjualan': laporanPenjualan,
  'keuangan-pribadi': keuanganPribadi,
  'stok-barang': stokBarang,
  'invoice-piutang': invoicePiutang,
  'anggaran-pernikahan': anggaranPernikahan,
  'rab-sederhana': rabSederhana,
};

export const templateSheets = (slug: string): TSheet[] => {
  const make = specs[slug];
  if (!make) throw new Error(`Template tidak dikenal: ${slug}`);
  return make();
};

export function buildTemplate(slug: string, now: Date = new Date()): ExcelJS.Workbook {
  const def = templates.find((t) => t.slug === slug);
  if (!def) throw new Error(`Template tidak dikenal: ${slug}`);
  return writeWorkbook(def.title, templateSheets(slug), now);
}
