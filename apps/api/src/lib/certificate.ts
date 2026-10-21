import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

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
  /** Lencana bulat di pojok kanan atas, mis. { top: "PERINTIS", value: "#7" }. */
  seal?: { top: string; value: string };
}

const GREEN = '#217346';
const DARK = '#185c37';
const TEXT = '#242424';
const MUTED = '#616161';

/** Font bawaan PDF hanya mendukung aksara Latin dasar; karakter lain diganti agar tidak rusak. */
export const latinSafe = (s: string): string => s.replace(/[^ -~¡-ÿ]/g, '?');

/**
 * Sertifikat penyelesaian Mahir Excel (A4 lanskap). Ini bukan sertifikasi resmi Microsoft; di dokumen
 * cukup dicetak bahwa Mahir Excel platform independen dan tidak berafiliasi dengan Microsoft.
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

  if (input.seal) {
    const cx = W - 110;
    const cy = 112;
    doc.circle(cx, cy, 50).fill(GREEN);
    doc.circle(cx, cy, 44).lineWidth(1).stroke('#d9f35b');
    doc.fillColor('#d9f35b').font('Helvetica-Bold').fontSize(8).text(latinSafe(input.seal.top), cx - 44, cy - 28, { width: 88, align: 'center', characterSpacing: 1 });
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(30).text(latinSafe(input.seal.value), cx - 44, cy - 14, { width: 88, align: 'center' });
  }

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
  const detail = input.detail ?? `${input.lessons} pelajaran diselesaikan di platform belajar Excel gratis Mahir Excel`;
  if (detail) {
    doc.fillColor(MUTED).fontSize(12).text(latinSafe(detail), 60, 305, { align: 'center', width: W - 120 });
  }

  // Kiri: kode QR vektor untuk memeriksa keaslian, beserta kodenya.
  const qr = QRCode.create(input.verifyUrl, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const qrSize = 84;
  const cell = qrSize / n;
  const qx = 150;
  const qy = 372;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) doc.rect(qx + c * cell, qy + r * cell, cell + 0.2, cell + 0.2).fill(DARK);
    }
  }
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(11).text('Pindai untuk memeriksa keaslian', qx + qrSize + 16, qy + 22, { width: 190 });
  doc.fillColor(MUTED).font('Helvetica').fontSize(9).text('Kode verifikasi', qx + qrSize + 16, qy + 40, { width: 190 });
  doc.fillColor(TEXT).font('Courier').fontSize(12).text(input.code, qx + qrSize + 16, qy + 53, { width: 190 });

  // Kanan: penerbit dan tanggal terbit (tanpa nama pribadi).
  const bx = W - 150 - 225;
  doc.fillColor(GREEN).font('Times-BoldItalic').fontSize(28).text('Mahir Excel', bx, qy + 6, { width: 225, align: 'center' });
  doc.moveTo(bx, qy + 46).lineTo(bx + 225, qy + 46).lineWidth(0.8).stroke('#8b958d');
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(11).text('Diterbitkan oleh Mahir Excel', bx, qy + 54, { width: 225, align: 'center' });
  doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(date, bx, qy + 69, { width: 225, align: 'center' });

  doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(latinSafe(input.verifyUrl.replace(/^https?:\/\//, '')), 0, H - 78, { align: 'center' });
  doc.end();
  return doc;
}
