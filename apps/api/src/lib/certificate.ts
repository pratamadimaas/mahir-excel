import PDFDocument from 'pdfkit';

export interface CertificateInput {
  name: string;
  /** Mis. "Modul 3: Rumus Dasar" atau "seluruh materi Mahir Excel". */
  scopeTitle: string;
  lessons: number;
  issuedAt: Date;
  code: string;
  verifyUrl: string;
  /** Judul besar; bawaan "SERTIFIKAT PENYELESAIAN". */
  heading?: string;
  /** Kalimat sebelum cakupan; bawaan "yang telah menyelesaikan". */
  intro?: string;
  /** Baris keterangan di bawah cakupan; bawaan menyebut jumlah pelajaran. */
  detail?: string;
}

const GREEN = '#217346';
const DARK = '#185c37';
const TEXT = '#242424';
const MUTED = '#616161';

/** Font bawaan PDF hanya mendukung aksara Latin dasar; karakter lain diganti agar tidak rusak. */
export const latinSafe = (s: string): string => s.replace(/[^ -~¡-ÿ]/g, '?');

/**
 * Sertifikat penyelesaian Mahir Excel (A4 lanskap). Ini tanda penyelesaian belajar di platform ini,
 * bukan sertifikasi resmi Microsoft dan tidak terakreditasi; keterangan itu dicetak pada dokumen.
 */
export function buildCertificate(input: CertificateInput): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 0,
    info: { Title: `Sertifikat Mahir Excel - ${latinSafe(input.name)}`, Author: 'Mahir Excel' },
  });
  const W = doc.page.width;
  const H = doc.page.height;
  const date = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(input.issuedAt);

  doc
    .rect(24, 24, W - 48, H - 48)
    .lineWidth(2)
    .stroke(GREEN);
  doc
    .rect(32, 32, W - 64, H - 64)
    .lineWidth(0.5)
    .stroke('#c9d1c9');

  // Simbol lembar kerja kecil
  doc.rect(W / 2 - 14, 62, 28, 28).fill(GREEN);
  doc.lineWidth(1).strokeColor('#ffffff');
  doc
    .moveTo(W / 2 - 14, 71)
    .lineTo(W / 2 + 14, 71)
    .stroke();
  doc
    .moveTo(W / 2 - 14, 80)
    .lineTo(W / 2 + 14, 80)
    .stroke();
  doc
    .moveTo(W / 2, 62)
    .lineTo(W / 2, 90)
    .stroke();

  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(14).text('Mahir Excel', 0, 100, { align: 'center' });
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(30).text(latinSafe(input.heading ?? 'SERTIFIKAT PENYELESAIAN'), 0, 130, { align: 'center' });

  doc.fillColor(MUTED).font('Helvetica').fontSize(13).text('Diberikan kepada', 0, 190, { align: 'center' });
  doc
    .fillColor(TEXT)
    .font('Helvetica-Bold')
    .fontSize(34)
    .text(latinSafe(input.name), 60, 215, { align: 'center', width: W - 120 });

  doc
    .fillColor(TEXT)
    .font('Helvetica')
    .fontSize(14)
    .text(`${latinSafe(input.intro ?? 'yang telah menyelesaikan')} ${latinSafe(input.scopeTitle)}`, 60, 280, { align: 'center', width: W - 120 });
  doc
    .fillColor(MUTED)
    .fontSize(12)
    .text(latinSafe(input.detail ?? `${input.lessons} pelajaran diselesaikan di platform belajar Excel gratis Mahir Excel`), 60, 305, {
      align: 'center',
      width: W - 120,
    });

  doc.fillColor(TEXT).fontSize(12).text(`Diterbitkan pada ${date}`, 0, 355, { align: 'center' });
  doc.fillColor(MUTED).fontSize(10).text(`Kode verifikasi: ${input.code}`, 0, 380, { align: 'center' });
  doc.fillColor(MUTED).fontSize(10).text(`Periksa keaslian di ${input.verifyUrl}`, 0, 395, { align: 'center' });

  doc
    .fillColor(MUTED)
    .fontSize(8.5)
    .text(
      'Sertifikat ini adalah tanda penyelesaian belajar di Mahir Excel. Bukan sertifikasi resmi Microsoft, tidak terakreditasi, dan tidak menyatakan tingkat kemahiran yang diakui pihak ketiga. Mahir Excel tidak berafiliasi dengan Microsoft.',
      90,
      H - 90,
      { align: 'center', width: W - 180 },
    );
  doc.end();
  return doc;
}
