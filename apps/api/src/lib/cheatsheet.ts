import PDFDocument from 'pdfkit';
import { lessons, modules, type LessonDef } from '@excellab/shared';
import { latinSafe } from './certificate';

const GREEN = '#217346';
const DARK = '#185c37';
const TEXT = '#242424';
const MUTED = '#616161';
const PALE = '#e6f2ea';

const MARGIN = 44;

/** Materi lembar contekan satu modul, diambil dari isi pelajaran yang sama dengan di aplikasi. */
export function cheatsheetLessons(moduleSlug: string): LessonDef[] {
  return lessons.filter((l) => l.moduleSlug === moduleSlug).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Lembar contekan PDF (A4 tegak) untuk satu modul: ringkasan, sintaks, contoh, dan kesalahan umum tiap pelajaran. */
export function buildCheatsheet(moduleSlug: string, issuedAt: Date): PDFKit.PDFDocument {
  const mod = modules.find((m) => m.slug === moduleSlug);
  if (!mod) throw new Error(`Modul tidak dikenal: ${moduleSlug}`);
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    bufferPages: true,
    info: { Title: `Lembar Contekan ${latinSafe(mod.title)} - Mahir Excel`, Author: 'Mahir Excel' },
  });
  const W = doc.page.width - MARGIN * 2;
  const bottom = (): number => doc.page.height - MARGIN - 18;
  const ensure = (h: number): void => {
    if (doc.y + h > bottom()) doc.addPage();
  };

  // Kepala
  doc.rect(0, 0, doc.page.width, 92).fill(GREEN);
  doc.fillColor('#d9f35b').font('Helvetica-Bold').fontSize(9).text('MAHIR EXCEL  |  LEMBAR CONTEKAN', MARGIN, 26, { characterSpacing: 1 });
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24).text(latinSafe(mod.title), MARGIN, 42, { width: W });
  doc.fillColor('#e6f2ea').font('Helvetica').fontSize(10).text(latinSafe(mod.summary), MARGIN, 72, { width: W, height: 14, ellipsis: true });
  doc.y = 110;

  for (const l of cheatsheetLessons(moduleSlug)) {
    const c = l.content;
    ensure(120);
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(13).text(latinSafe(l.title), MARGIN, doc.y, { width: W });
    doc.moveTo(MARGIN, doc.y + 2).lineTo(MARGIN + W, doc.y + 2).lineWidth(0.8).stroke(GREEN);
    doc.moveDown(0.5);

    doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(latinSafe(l.summary), MARGIN, doc.y, { width: W });
    doc.moveDown(0.4);

    if (c.objectives.length) {
      doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(9.5).text('Yang perlu kamu ingat');
      doc.font('Helvetica').fontSize(9.5);
      for (const o of c.objectives.slice(0, 4)) {
        ensure(24);
        doc.text(`-  ${latinSafe(o)}`, MARGIN + 8, doc.y, { width: W - 8 });
      }
      doc.moveDown(0.3);
    }

    if (c.syntax) {
      ensure(60);
      const y = doc.y;
      const sigH = doc.heightOfString(latinSafe(c.syntax.signature), { width: W - 16 }) + 10;
      doc.rect(MARGIN, y, W, sigH).fill(PALE);
      doc.fillColor(DARK).font('Courier-Bold').fontSize(10).text(latinSafe(c.syntax.signature), MARGIN + 8, y + 5, { width: W - 16 });
      doc.y = y + sigH + 4;
      doc.fillColor(TEXT).font('Helvetica').fontSize(9);
      for (const p of c.syntax.params.slice(0, 5)) {
        ensure(22);
        doc.font('Courier-Bold').text(latinSafe(p.name), MARGIN + 8, doc.y, { continued: true, width: W - 8 });
        doc.font('Helvetica').text(`  ${latinSafe(p.description)}`);
      }
      doc.moveDown(0.3);
    }

    ensure(50);
    doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(9.5).text('Contoh');
    doc.font('Helvetica').fontSize(9).text(latinSafe(c.example.description), MARGIN, doc.y, { width: W });
    doc.font('Courier-Bold').fontSize(9.5).fillColor(GREEN).text(latinSafe(c.example.formula), MARGIN + 8, doc.y + 2, { width: W - 8 });
    doc.font('Helvetica').fontSize(9).fillColor(TEXT).text(`Hasil: ${latinSafe(c.example.result)}`, MARGIN + 8, doc.y + 1, { width: W - 8 });
    doc.moveDown(0.3);

    const top = c.mistakes.slice(0, 2);
    if (top.length) {
      ensure(40);
      doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(9.5).text('Kesalahan yang sering terjadi');
      doc.font('Helvetica').fontSize(9);
      for (const m of top) {
        ensure(30);
        doc.text(`-  ${latinSafe(m.title)}. ${latinSafe(m.detail)}`, MARGIN + 8, doc.y, { width: W - 8 });
      }
    }
    doc.moveDown(1.1);
  }

  // Kaki halaman
  const date = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(issuedAt);
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    // Margin bawah dinolkan agar teks kaki tidak memicu halaman baru.
    doc.page.margins.bottom = 0;
    const y = doc.page.height - MARGIN + 8;
    doc.fillColor(MUTED).font('Helvetica').fontSize(8);
    doc.text(`Mahir Excel  |  mahirexcel.online  |  ${date}`, MARGIN, y, { width: W, align: 'left', lineBreak: false });
    doc.text(`${i + 1} / ${range.count}`, MARGIN, y, { width: W, align: 'right', lineBreak: false });
  }
  doc.end();
  return doc;
}
