import { Link } from 'react-router';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../services/api';

export function NotFoundPage() {
  useDocumentTitle('Halaman tidak ditemukan');
  return (
    <div className="xl-page xl-page-narrow py-5 text-center">
      <p className="xl-eyebrow">Galat 404</p>
      <h1>Halaman tidak ditemukan</h1>
      <p className="xl-muted">Alamat yang kamu buka tidak ada atau sudah dipindahkan. Seperti merujuk sel di luar tabel: hasilnya #REF!.</p>
      <div className="d-flex justify-content-center gap-2 flex-wrap">
        <Link to="/" className="btn btn-primary">
          Ke beranda
        </Link>
        <Link to="/belajar" className="btn btn-outline-secondary">
          Mulai belajar
        </Link>
      </div>
    </div>
  );
}

interface OverviewCounts {
  counts: { modules: number; lessons: number; exercises: number; shortcuts: number; worksheets: number; functions: number };
}

const CONTACT = (import.meta.env.VITE_CONTACT_URL as string | undefined)?.trim();

export function AboutPage() {
  useDocumentTitle('Tentang');
  // Angka diambil dari server supaya halaman ini tidak pernah memuat jumlah yang basi.
  const overview = useAsync((s) => api.get<OverviewCounts>('/public/overview', s), []);
  const c = overview.data?.counts;
  return (
    <div className="xl-page xl-page-narrow xl-prose py-4">
      <header className="xl-page-head">
        <h1>Tentang Mahir Excel</h1>
      </header>
      <p>
        Mahir Excel adalah platform belajar Microsoft Excel berbahasa Indonesia yang gratis. Fokusnya praktik: setiap pelajaran punya contoh
        dan latihan yang bisa langsung dikerjakan di browser.
      </p>

      <h2>Kenapa dibuat</h2>
      <p>
        Belajar Excel dalam Bahasa Indonesia seharusnya bisa dijangkau siapa saja. Mahir Excel dibuat untuk membantu lebih banyak orang
        menguasai Excel lewat latihan langsung, bukan hanya membaca. Belajarnya sengaja dibuat gratis. Fitur Premium ada supaya proyek ini
        bisa terus dirawat.
      </p>

      <h2>Siapa di baliknya</h2>
      <p>
        Mahir Excel dibangun dan dirawat oleh seorang pengembang independen. Proyek ini tidak berafiliasi dengan Microsoft maupun lembaga
        lain mana pun, dan isinya tidak mewakili pandangan pihak mana pun selain pembuatnya.
      </p>

      <h2>Cara materi dijaga benar</h2>
      <ul>
        <li>Pelajaran dan latihan ditulis orisinal, bukan disalin dari tempat lain.</li>
        <li>
          Playground memakai mesin rumus sendiri. Setiap contoh di pelajaran dijalankan oleh mesin itu, jadi hasil yang tertulis memang
          hasil yang dihitung.
        </li>
        <li>
          Jawaban latihan diuji terhadap data lain. Angka yang diketik langsung atau rumus yang kebetulan cocok tidak lolos, dan umpan
          baliknya menjelaskan kenapa.
        </li>
        <li>
          Daftar shortcut belum diverifikasi di setiap versi Excel, sistem operasi, dan tata letak keyboard. Itu dicatat terang-terangan.
        </li>
      </ul>

      <h2>Yang tersedia</h2>
      <ul>
        <li>
          {c
            ? `Akademi: ${c.modules} modul dan ${c.lessons} pelajaran, termasuk proyek akhir tiap modul, dari dasar sampai fungsi pencarian, teks, tanggal, dan ringkasan data.`
            : 'Akademi: modul dan pelajaran dari dasar sampai fungsi pencarian, teks, tanggal, dan ringkasan data, termasuk proyek akhir tiap modul.'}
        </li>
        <li>
          {c ? `${c.exercises} latihan` : 'Latihan'} interaktif di playground spreadsheet sederhana, dengan alat urutkan, filter, dan isi
          otomatis.
        </li>
        <li>{c ? `${c.shortcuts} shortcut` : 'Pustaka shortcut'} untuk Windows dan Mac, plus mode kuis.</li>
        <li>{c ? `${c.worksheets} worksheet` : 'Worksheet'} .xlsx siap unduh. Kunci jawabannya untuk anggota Premium.</li>
        <li>
          Progres, poin, streak, ulang terjadwal, tes penempatan, bagikan progres, dan sertifikat penyelesaian (Premium), tersimpan di
          akunmu. Akun gratis dan diperlukan untuk membuka materi belajar.
        </li>
      </ul>

      <h2>Batasan yang jujur</h2>
      <ul>
        <li>
          Playground adalah simulasi terbatas, bukan pengganti Excel.{' '}
          {c ? `Hanya ${c.functions} fungsi yang didukung` : 'Hanya sebagian fungsi yang didukung'} (agregat, logika, bersyarat, ROUND,
          teks, tanggal, dan pencarian seperti VLOOKUP dan XLOOKUP).
        </li>
        <li>Perilaku Excel dapat berbeda antar versi dan platform. Bila ada perbedaan, ikuti dokumentasi resmi Microsoft untuk versimu.</li>
        <li>PivotTable, grafik, dan array dinamis belum ada di playground; pelajarannya menjelaskan konsepnya.</li>
        <li>Pelajaran dan latihan hanya berbahasa Indonesia. Antarmuka punya versi English.</li>
      </ul>

      <h2>Kontak</h2>
      <p>
        {CONTACT ? (
          <>
            Ada saran, laporan salah, atau pertanyaan soal Premium?{' '}
            <a href={CONTACT} target="_blank" rel="noopener noreferrer">
              Hubungi pembuatnya
            </a>
            .
          </>
        ) : (
          'Ada saran atau laporan salah? Sampaikan lewat saluran tempat kamu menemukan Mahir Excel.'
        )}
      </p>
      <p className="xl-muted">
        Mahir Excel tidak berafiliasi dengan Microsoft. Microsoft dan Excel adalah merek dagang Microsoft Corporation.
      </p>
    </div>
  );
}

export function PrivacyPage() {
  useDocumentTitle('Privasi dan data');
  return (
    <div className="xl-page xl-page-narrow xl-prose py-4">
      <header className="xl-page-head">
        <h1>Privasi dan data</h1>
      </header>
      <h2>Tanpa akun</h2>
      <p>
        Pelajaran, latihan, shortcut, dan worksheet bisa dibuka setelah kamu masuk. Tanpa akun, kamu tetap bisa melihat beranda, halaman
        info, dan mencoba <strong>tes penempatan</strong>.
      </p>
      <p>
        Hasil tes penempatan (jawaban dan skor) kami catat tanpa nama dan tanpa data pribadi, supaya kami tahu materi mana yang perlu
        diperbaiki. Kalau kamu sedang masuk, hasilnya terhubung ke akunmu dan bisa dilihat pengelola situs.
      </p>
      <h2>Statistik kunjungan</h2>
      <p>
        Kami menghitung berapa kali halaman dibuka dan berapa orang berkunjung per hari, hanya sebagai angka. Tidak ada cookie pelacak,
        alamat IP tidak disimpan, dan kamu tidak bisa dilacak dari hari ke hari. Bila browsermu mengirim sinyal <em>Do Not Track</em> atau{' '}
        <em>Global Privacy Control</em>, kunjunganmu tidak dihitung.
      </p>
      <h2>Dengan akun</h2>
      <p>
        Kami menyimpan email, nama tampilan, kata sandi (dalam bentuk terenkripsi, bukan kata sandi aslinya), dan progres belajarmu:
        pelajaran dan latihan yang selesai, poin, riwayat percobaan, hari aktif belajar, serta jawaban yang perlu ditinjau. Kami tidak
        memakai pelacak iklan atau analitik pihak ketiga.
      </p>
      <p>
        Kalau kamu masuk dengan kode lewat email atau mengatur ulang kata sandi, kami mengirim kode 6 angka ke emailmu. Kode berlaku 10
        menit dan hanya bisa dipakai sekali. Email hanya dipakai untuk akun ini, bukan untuk promosi. Pengelola situs dapat melihat daftar
        akun (nama, email, tanggal daftar, dan ringkasan belajar) untuk mengelola layanan.
      </p>
      <p>
        Akun juga menyimpan jadwal ulang latihan. Kalau kamu menyelesaikan satu modul, kamu bisa membuat sertifikat PDF atas namamu. Kami
        menyimpan kode, cakupan, dan tanggalnya agar siapa pun yang memegang kodenya bisa memeriksa keasliannya. Sertifikat ini penanda
        penyelesaian di Mahir Excel, bukan sertifikasi resmi Microsoft.
      </p>
      <p>
        Fitur “bagikan progres” bersifat pilihan dan mati secara bawaan. Kalau kamu menyalakannya, siapa pun yang punya tautannya bisa
        melihat nama tampilan, poin, streak, dan modul yang selesai, tanpa email. Kamu bisa mencabut tautannya kapan saja.
      </p>
      <p>Kalau kamu masuk dengan Google, kami menerima nama dan alamat email dari Google dan tidak pernah menerima kata sandi Google-mu.</p>
      <p>
        Status Premium (kapan masa aktifnya berakhir) disimpan di akunmu. Pembayaran dilakukan di luar aplikasi; kami tidak menyimpan data
        kartu atau rekeningmu di Mahir Excel.
      </p>
      <h2>Sprint dan papan peringkat</h2>
      <p>
        Sprint bisa dimainkan tanpa akun. Selama ronde, kami menyimpan sesi permainan sederhana (waktu mulai, soal yang sedang aktif, skor,
        jumlah benar dan salah). Nama dan skor baru masuk papan peringkat setelah kamu mengisi nama dan menekan simpan. Nama itu tampil
        untuk umum, jadi sebaiknya bukan nama lengkap atau data pribadi. Bila kamu sedang masuk, skor tertaut ke akunmu, tetapi papan hanya
        menampilkan nama yang kamu isi. Pengelola dapat menyembunyikan nama atau skor yang melanggar aturan.
      </p>
      <h2>Penyimpanan dan penghapusan</h2>
      <ul>
        <li>Data akun disimpan selama akunmu aktif.</li>
        <li>Kamu bisa menghapus akun di halaman Profil. Akun dan seluruh progresmu akan terhapus permanen.</li>
        <li>Mengimpor progres lama dari browser bersifat pilihan, dan poinnya tidak dihitung dobel.</li>
      </ul>
      <h2>Kontak</h2>
      <p>
        Pengelola situs dapat mengatur tautan kontak di footer. Bila belum tersedia, hubungi pengelola lewat saluran tempat kamu menemukan
        Mahir Excel.
      </p>
      <p>
        <Link to="/">Kembali ke beranda</Link>
      </p>
    </div>
  );
}
