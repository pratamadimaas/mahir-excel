import {
  clock,
  D,
  addDays,
  dateCell,
  dayDiff,
  mess,
  numCell,
  pad,
  randDate,
  round,
  skewed,
  sortBy,
  sum,
  tally,
  task,
  topUnique,
  withDuplicates,
} from './kit';
import type { Built, Cell, DatasetSpec, Field, Fmt } from './kit';
import { people, person } from './pools';

interface Meta {
  slug: string;
  title: string;
  field: Field;
  blurb: string;
  mess: string;
}
const meta = (m: Meta): Meta => m;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const low = (s: string): string => s.toLowerCase();

const TRIM_HINT =
  'COUNTIF dan SUMIF tidak peka huruf besar dan kecil, tetapi spasi di depan atau belakang membuat teks dianggap beda. Bersihkan dulu dengan TRIM, atau pakai wildcard seperti "*nama*".';

// ================================================================ transaksi

export interface TxCfg extends Meta {
  n: number;
  prefix: string;
  items: readonly (readonly [string, number])[];
  headers: [string, string, string, string, string, string];
  extra: readonly string[];
  qtyMax: number;
  unit: string;
  noun: string;
  total: string;
}

/** Daftar transaksi: tanggal, nomor, barang, jumlah, harga, keterangan. */
export function tx(c: TxCfg): DatasetSpec {
  return {
    ...meta(c),
    build: (r): Built => {
      const base = D(2026, 10, 1);
      const raw = Array.from({ length: c.n }, () => {
        const it = skewed(r, c.items);
        return { date: randDate(r, base, 31), item: it[0], price: it[1], qty: r.int(1, c.qtyMax), extra: r.pick(c.extra) };
      });
      const recs = sortBy(raw, (x) => x.date.getTime()).map((x, i) => ({ ...x, id: `${c.prefix}-${pad(i + 1)}` }));
      const rows: Cell[][] = recs.map((x) => [dateCell(r, x.date), x.id, mess(r, x.item, 0.12), x.qty, numCell(r, x.price, 0.06), x.extra]);
      const top = topUnique(
        tally(
          recs,
          (x) => x.item,
          (x) => x.qty,
        ),
        c.slug,
      );
      return {
        headers: c.headers,
        rows: withDuplicates(r, rows, 3),
        fmt: ['date', undefined, undefined, 'int', 'rp', undefined],
        tasks: [
          task(
            `Hitung total ${c.total} (${c.headers[3]} × ${c.headers[4]}) dari seluruh ${c.noun}. ${cap(c.noun)} yang tercatat dua kali hanya dihitung sekali.`,
            'Singkirkan baris ganda lebih dulu (Data > Remove Duplicates). Harga yang tersimpan sebagai teks tidak ikut terjumlah oleh SUM biasa, jadi ubah dengan VALUE atau pakai SUMPRODUCT.',
            sum(recs.map((x) => x.qty * x.price)),
          ),
          task(
            `Berapa jumlah ${c.noun} yang berbeda? Anggap dua baris dengan nomor yang sama sebagai satu.`,
            'Pakai Remove Duplicates lalu hitung barisnya, atau SUMPRODUCT(1/COUNTIF(rentang;rentang)) pada kolom nomor.',
            recs.length,
          ),
          task(
            `Berapa total ${low(c.headers[3])} untuk "${top[0]}"? Penulisan namanya tidak seragam, dan baris ganda hanya dihitung sekali.`,
            TRIM_HINT,
            top[1],
          ),
        ],
      };
    },
  };
}

// ================================================================ catatan kegiatan

export interface LogCfg extends Meta {
  n: number;
  prefix: string;
  headers: [string, string, string, string, string, string];
  who: 'person' | readonly string[];
  cats: readonly string[];
  statuses: readonly string[];
  range: [number, number];
  step?: number;
  noun: string;
  value: string;
  valueFmt?: Fmt;
  agg?: 'sum' | 'count';
}

/** Catatan kegiatan: tanggal, nomor, pihak, kategori, nilai (boleh kosong), status. */
export function log(c: LogCfg): DatasetSpec {
  return {
    ...meta(c),
    build: (r): Built => {
      const step = c.step ?? 1;
      const base = D(2026, 10, 1);
      const raw = Array.from({ length: c.n }, () => ({
        date: randDate(r, base, 31),
        who: c.who === 'person' ? person(r) : r.pick(c.who),
        cat: skewed(r, c.cats, 1.5),
        status: r.chance(0.55) ? c.statuses[0]! : r.pick(c.statuses),
        value: r.chance(0.06) ? null : r.int(c.range[0], c.range[1]) * step,
      }));
      const recs = sortBy(raw, (x) => x.date.getTime()).map((x, i) => ({ ...x, id: `${c.prefix}-${pad(i + 1)}` }));
      const rows: Cell[][] = recs.map((x) => [
        dateCell(r, x.date),
        x.id,
        x.who,
        mess(r, x.cat, 0.14),
        x.value === null ? null : numCell(r, x.value, 0.03),
        mess(r, x.status, 0.1),
      ]);
      const cats = tally(recs, (x) => x.cat);
      const top = topUnique(cats, c.slug)[0];
      const second = [...cats.entries()].filter(([k]) => k !== top).sort((a, b) => b[1] - a[1])[0]![0];
      const s0 = c.statuses[0]!;
      const vals = (cat: string) => recs.filter((x) => x.cat === cat && x.value !== null).map((x) => x.value as number);
      const v2 = vals(second);
      const asCount = c.agg === 'count';
      return {
        headers: c.headers,
        rows,
        fmt: ['date', undefined, undefined, undefined, c.valueFmt ?? 'int', undefined],
        tasks: [
          task(
            `Berapa jumlah ${c.noun} dengan ${low(c.headers[3])} "${top}"? Penulisan kategorinya tidak seragam.`,
            TRIM_HINT,
            cats.get(top)!,
          ),
          asCount
            ? task(`Berapa jumlah ${c.noun} berstatus "${s0}"?`, TRIM_HINT, recs.filter((x) => x.status === s0).length)
            : task(
                `Berapa total ${low(c.value)} untuk ${c.noun} berstatus "${s0}"?`,
                `${TRIM_HINT} Sel nilai yang tersimpan sebagai teks tidak ikut terjumlah oleh SUM.`,
                sum(recs.filter((x) => x.status === s0 && x.value !== null).map((x) => x.value as number)),
              ),
          task(
            `Berapa rata-rata ${low(c.value)} untuk ${low(c.headers[3])} "${second}"? Baris yang kosong tidak dihitung. Bulatkan 1 desimal.`,
            `${TRIM_HINT} Pakai AVERAGEIF, lalu ROUND(...;1).`,
            round(sum(v2) / v2.length, 1),
            0.06,
          ),
        ],
      };
    },
  };
}

// ================================================================ daftar orang

export interface RosterCfg extends Meta {
  n: number;
  prefix: string;
  headers: [string, string, string, string, string, string];
  groups: readonly string[];
  roles: readonly string[];
  amount: [number, number];
  step: number;
  amountName: string;
  groupName: string;
  noun: string;
  dateFrom: Date;
  dateDays: number;
  /** Pertanyaan ketiga, dihitung dari data yang sudah bersih. */
  third: (recs: { date: Date }[]) => { ask: string; hint: string; expected: number };
}

/** Daftar orang: ID, nama, kelompok, peran, tanggal, nominal. */
export function roster(c: RosterCfg): DatasetSpec {
  return {
    ...meta(c),
    build: (r): Built => {
      const names = people(r, c.n);
      const recs = names.map((name, i) => ({
        id: `${c.prefix}${pad(i + 1, 3)}`,
        name,
        group: skewed(r, c.groups, 1.5),
        role: r.pick(c.roles),
        date: randDate(r, c.dateFrom, c.dateDays),
        amount: Math.round(r.int(c.amount[0], c.amount[1]) / c.step) * c.step,
      }));
      const rows: Cell[][] = recs.map((x) => [
        x.id,
        r.chance(0.1) ? ` ${x.name}` : x.name,
        mess(r, x.group, 0.1),
        x.role,
        dateCell(r, x.date),
        x.amount,
      ]);
      const groups = tally(recs, (x) => x.group);
      const top = topUnique(groups, c.slug)[0];
      const second = [...groups.entries()].filter(([k]) => k !== top).sort((a, b) => b[1] - a[1])[0]![0];
      const sub = recs.filter((x) => x.group === second);
      const t3 = c.third(recs);
      return {
        headers: c.headers,
        rows: withDuplicates(r, rows, 4),
        fmt: [undefined, undefined, undefined, undefined, 'date', 'rp'],
        tasks: [
          task(
            `Berapa jumlah ${c.noun} di ${low(c.groupName)} "${top}"? Ada baris ganda (ID sama) yang hanya dihitung sekali, dan penulisan nama ${low(c.groupName)} tidak seragam.`,
            `Singkirkan baris ganda dengan Remove Duplicates. ${TRIM_HINT}`,
            groups.get(top)!,
          ),
          task(
            `Berapa rata-rata ${low(c.amountName)} di ${low(c.groupName)} "${second}"? Bulatkan ke bilangan bulat.`,
            `${TRIM_HINT} Singkirkan baris ganda lebih dulu, lalu AVERAGEIF dan ROUND(...;0).`,
            Math.round(sum(sub.map((x) => x.amount)) / sub.length),
            0.51,
          ),
          task(t3.ask, t3.hint, t3.expected),
        ],
      };
    },
  };
}

// ================================================================ buku kas

export interface LedgerCfg extends Meta {
  n: number;
  headers: [string, string, string, string, string];
  ins: readonly string[];
  outs: readonly string[];
  open: number;
  inRange: [number, number];
  outRange: [number, number];
  step: number;
  pIn: number;
  inWord: string;
  outWord: string;
  balWord: string;
}

/** Buku kas: tanggal, keterangan, masuk, keluar, saldo (kosong, untuk diisi). */
export function ledger(c: LedgerCfg): DatasetSpec {
  return {
    ...meta(c),
    build: (r): Built => {
      const base = D(2026, 10, 1);
      const raw = Array.from({ length: c.n }, () => {
        const isIn = r.chance(c.pIn);
        const [a, b] = isIn ? c.inRange : c.outRange;
        return {
          date: randDate(r, base, 31),
          isIn,
          desc: skewed(r, isIn ? c.ins : c.outs, 1.4),
          amount: Math.round(r.int(a, b) / c.step) * c.step,
        };
      });
      const recs = sortBy(raw, (x) => x.date.getTime());
      const rows: Cell[][] = recs.map((x) => [
        dateCell(r, x.date, 0.05),
        mess(r, x.desc, 0.1),
        x.isIn ? numCell(r, x.amount, 0.04) : null,
        x.isIn ? null : numCell(r, x.amount, 0.04),
        null,
      ]);
      const totalIn = sum(recs.filter((x) => x.isIn).map((x) => x.amount));
      const totalOut = sum(recs.filter((x) => !x.isIn).map((x) => x.amount));
      const outByDesc = tally(
        recs.filter((x) => !x.isIn),
        (x) => x.desc,
        (x) => x.amount,
      );
      const top = topUnique(outByDesc, c.slug);
      const opening =
        c.open > 0 ? ` Saldo awal Rp ${c.open.toLocaleString('id-ID')}, lalu tambahkan ${c.inWord} dan kurangi ${c.outWord}.` : '';
      return {
        headers: c.headers,
        rows,
        fmt: ['date', undefined, 'rp', 'rp', 'rp'],
        tasks: [
          task(
            `Berapa total ${c.inWord} selama sebulan?`,
            'Angka yang tersimpan sebagai teks diabaikan oleh SUM. Cari selnya (rata kiri atau ada tanda segitiga hijau) dan ubah jadi angka.',
            totalIn,
          ),
          task(
            `Berapa ${c.balWord} di akhir bulan?${opening}`,
            'Jumlahkan kolom masuk, kurangi kolom keluar. Kolom Saldo boleh kamu isi sebagai saldo berjalan untuk memeriksa.',
            c.open + totalIn - totalOut,
          ),
          task(`Berapa total ${c.outWord} untuk "${top[0]}"? Penulisan keterangannya tidak seragam.`, TRIM_HINT, top[1]),
        ],
      };
    },
  };
}

// ================================================================ tagihan

export interface StatusCfg extends Meta {
  n: number;
  prefix: string;
  headers: [string, string, string, string, string, string];
  parties: readonly string[];
  noun: string;
  amountName: string;
}

const AS_OF = D(2026, 10, 31);

/** Tagihan: nomor, pihak, tanggal, jatuh tempo, nilai, status bayar. */
export function status(c: StatusCfg): DatasetSpec {
  return {
    ...meta(c),
    build: (r): Built => {
      const base = D(2026, 9, 1);
      const raw = Array.from({ length: c.n }, () => {
        const date = randDate(r, base, 61);
        return {
          date,
          due: addDays(date, r.pick([14, 30, 45])),
          party: skewed(r, c.parties, 1.4),
          amount: r.int(2, 60) * 50000,
          paid: r.chance(0.55),
        };
      });
      const recs = sortBy(raw, (x) => x.date.getTime()).map((x, i) => ({ ...x, id: `${c.prefix}-${pad(i + 1)}` }));
      const rows: Cell[][] = recs.map((x) => [
        x.id,
        mess(r, x.party, 0.1),
        dateCell(r, x.date),
        dateCell(r, x.due),
        x.amount,
        mess(r, x.paid ? 'Lunas' : 'Belum Lunas', 0.15),
      ]);
      const top = topUnique(
        tally(
          recs,
          (x) => x.party,
          (x) => x.amount,
        ),
        c.slug,
      );
      const open = recs.filter((x) => !x.paid);
      return {
        headers: c.headers,
        rows: withDuplicates(r, rows, 3),
        fmt: [undefined, undefined, 'date', 'date', 'rp', undefined],
        tasks: [
          task(
            `Berapa total ${low(c.amountName)} yang statusnya belum lunas? Ada baris ganda (nomor sama) yang hanya dihitung sekali, dan penulisan status tidak seragam.`,
            `Singkirkan baris ganda dulu. ${TRIM_HINT}`,
            sum(open.map((x) => x.amount)),
          ),
          task(
            `Berapa ${c.noun} yang belum lunas dan sudah lewat jatuh tempo per 31 Oktober 2026? Sebagian tanggal tersimpan sebagai teks.`,
            'Ubah tanggal teks jadi tanggal asli (DATEVALUE), lalu COUNTIFS dengan jatuh tempo lebih kecil dari DATE(2026;10;31).',
            open.filter((x) => dayDiff(AS_OF, x.due) > 0).length,
          ),
          task(
            `Berapa total ${low(c.amountName)} untuk "${top[0]}" (semua status)? Penulisan namanya tidak seragam, baris ganda hanya sekali.`,
            TRIM_HINT,
            top[1],
          ),
        ],
      };
    },
  };
}

// ================================================================ stok

export interface InvCfg extends Meta {
  n: number;
  prefix: string;
  bases: readonly string[];
  sizes: readonly string[];
  units: readonly string[];
  price: [number, number];
  step: number;
  headers: [string, string, string, string, string, string];
  noun: string;
}

/** Stok: kode, nama, satuan, stok, stok minimum, harga. */
export function inventory(c: InvCfg): DatasetSpec {
  return {
    ...meta(c),
    build: (r): Built => {
      const names = r.shuffle(c.bases.flatMap((b) => c.sizes.map((s) => `${b} ${s}`))).slice(0, c.n);
      const negatives = new Set(r.shuffle(Array.from({ length: c.n }, (_, i) => i)).slice(0, 6));
      const recs = names.map((name, i) => ({
        code: `${c.prefix}-${pad(i + 1)}`,
        name,
        unit: r.pick(c.units),
        stock: negatives.has(i) ? -r.int(1, 15) : r.chance(0.07) ? 0 : r.int(1, 150),
        min: r.int(10, 40),
        price: Math.round(r.int(c.price[0], c.price[1]) / c.step) * c.step,
      }));
      const rows: Cell[][] = recs.map((x) => [mess(r, x.code, 0.08), x.name, x.unit, numCell(r, x.stock, 0.04), x.min, x.price]);
      return {
        headers: c.headers,
        rows,
        fmt: [undefined, undefined, undefined, 'int', 'int', 'rp'],
        tasks: [
          task(
            `Berapa ${c.noun} yang stoknya di bawah stok minimum? Stok minus ikut dihitung. Beberapa stok tersimpan sebagai teks.`,
            'Teks selalu dianggap lebih besar dari angka saat dibandingkan, jadi ubah stok teks jadi angka dulu (VALUE atau Text to Columns). Lalu SUMPRODUCT(--(stok<minimum)).',
            recs.filter((x) => x.stock < x.min).length,
          ),
          task(
            'Berapa nilai persediaan (stok × harga)? Abaikan stok yang minus, karena itu salah input.',
            'SUMPRODUCT((stok>0)*stok*harga). Stok yang berupa teks perlu diubah dulu.',
            sum(recs.filter((x) => x.stock > 0).map((x) => x.stock * x.price)),
          ),
          task(
            `Berapa ${c.noun} yang stoknya 0 atau minus?`,
            'COUNTIF(stok;"<=0"), tapi stok teks tidak terhitung kalau belum diubah jadi angka.',
            recs.filter((x) => x.stock <= 0).length,
          ),
        ],
      };
    },
  };
}

// ================================================================ aset

export interface AssetCfg extends Meta {
  n: number;
  prefix: string;
  items: readonly string[];
  rooms: readonly string[];
  headers: [string, string, string, string, string, string];
}

/** Daftar aset: kode, nama, ruangan, kondisi, tahun, nilai. */
export function assets(c: AssetCfg): DatasetSpec {
  return {
    ...meta(c),
    build: (r): Built => {
      const recs = Array.from({ length: c.n }, (_, i) => ({
        code: `${c.prefix}-${pad(i + 1)}`,
        name: skewed(r, c.items, 1.3),
        room: r.pick(c.rooms),
        cond: r.next() < 0.6 ? 'Baik' : r.chance(0.65) ? 'Rusak Ringan' : 'Rusak Berat',
        year: r.int(2012, 2025),
        price: r.int(2, 80) * 100000,
      }));
      const rows: Cell[][] = recs.map((x) => [
        x.code,
        r.chance(0.08) ? `${x.name} ` : x.name,
        x.room,
        mess(r, x.cond, 0.12),
        numCell(r, x.year, 0.04),
        x.price,
      ]);
      return {
        headers: c.headers,
        rows,
        fmt: [undefined, undefined, undefined, undefined, 'int', 'rp'],
        tasks: [
          task(
            'Berapa aset yang kondisinya "Baik"? Penulisan kondisi tidak seragam.',
            TRIM_HINT,
            recs.filter((x) => x.cond === 'Baik').length,
          ),
          task(
            'Berapa total nilai perolehan aset yang kondisinya "Rusak Berat"?',
            TRIM_HINT,
            sum(recs.filter((x) => x.cond === 'Rusak Berat').map((x) => x.price)),
          ),
          task(
            'Berapa aset yang diperoleh sebelum tahun 2021? Sebagian tahun tersimpan sebagai teks.',
            'Teks dianggap lebih besar dari angka saat dibandingkan, jadi ubah tahun teks jadi angka dulu. Lalu COUNTIF(tahun;"<2021").',
            recs.filter((x) => x.year < 2021).length,
          ),
        ],
      };
    },
  };
}

// ================================================================ nilai

export interface ScoreCfg extends Meta {
  n: number;
  prefix: string;
  groups: readonly string[];
  headers: [string, string, string, string, string, string];
  weights: [number, number, number];
  pass: number;
  noun: string;
  idName: string;
}

/** Nilai tiga komponen. Beberapa baris kosong (tidak hadir), beberapa nilai komponen kedua memakai skala 0 sampai 10. */
export function scores(c: ScoreCfg): DatasetSpec {
  return {
    ...meta(c),
    build: (r): Built => {
      const names = people(r, c.n);
      const w = c.weights.map((x) => Math.round(x * 10)) as [number, number, number];
      const recs = names.map((name, i) => {
        const absent = r.chance(0.05);
        const a = r.int(45, 98);
        const b = 5 * r.int(9, 19);
        let cc = r.int(45, 98);
        const total = () => w[0] * a + w[1] * b + w[2] * cc;
        if (Math.abs(total() - c.pass * 10) <= 2) cc += 3;
        return {
          id: `${c.prefix}-${pad(i + 1)}`,
          name,
          group: skewed(r, c.groups, 1.3),
          absent,
          a,
          b,
          c: cc,
          scaled: r.chance(0.08),
          final: total() / 10,
        };
      });
      const rows: Cell[][] = recs.map((x) => [
        x.id,
        x.name,
        x.group,
        x.absent ? null : x.a,
        x.absent ? null : x.scaled ? x.b / 10 : x.b,
        x.absent ? null : x.c,
      ]);
      const present = recs.filter((x) => !x.absent);
      const pct = c.weights.map((x) => `${Math.round(x * 100)}%`);
      return {
        headers: c.headers,
        rows,
        fmt: [undefined, undefined, undefined, 'int', 'dec', 'int'],
        tasks: [
          task(
            `Nilai akhir = ${pct[0]} ${c.headers[3]} + ${pct[1]} ${c.headers[4]} + ${pct[2]} ${c.headers[5]}. Berapa ${c.noun} yang nilai akhirnya ${c.pass} atau lebih? Yang tidak hadir (nilai kosong) tidak lolos. Nilai ${c.headers[4]} yang 10 atau kurang memakai skala 0 sampai 10, kalikan 10.`,
            `Ubah dulu skala ${c.headers[4]}: =IF(nilai<=10;nilai*10;nilai). Lalu hitung nilai akhir per baris dan COUNTIF(nilai akhir;">=${c.pass}").`,
            present.filter((x) => x.final >= c.pass).length,
          ),
          task(
            `Berapa rata-rata ${c.headers[3]} dari ${c.noun} yang hadir? Bulatkan 1 desimal.`,
            'AVERAGE mengabaikan sel kosong, jadi cukup AVERAGE pada kolom itu lalu ROUND(...;1).',
            round(sum(present.map((x) => x.a)) / present.length, 1),
            0.06,
          ),
          task(
            `Berapa nilai akhir tertinggi (rumus sama seperti di atas, skala sudah disamakan)? Bulatkan 1 desimal.`,
            'Hitung nilai akhir per baris di kolom bantu, lalu MAX dan ROUND(...;1).',
            round(Math.max(...present.map((x) => x.final)), 1),
            0.06,
          ),
        ],
      };
    },
  };
}

// ================================================================ khusus

const TIME = (n: number): [number, number] => [Math.floor(n / 60), n % 60];

export const absensi = (m: Meta): DatasetSpec => ({
  ...m,
  build: (r): Built => {
    const emps = people(r, 24).map((name, i) => ({ id: `K${pad(i + 1, 3)}`, name }));
    const days: Date[] = [];
    for (let d = D(2026, 10, 1); days.length < 22; d = addDays(d, 1)) if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) days.push(d);
    let late = 0;
    let forgot = 0;
    const target = emps[6]!;
    let targetMinutes = 0;
    const rows: Cell[][] = [];
    for (const day of days)
      for (const e of emps) {
        if (r.chance(0.03)) {
          rows.push([day, e.id, e.name, null, null]);
          continue;
        }
        const inMin = r.chance(0.18) ? r.int(8 * 60 + 1, 8 * 60 + 50) : r.int(7 * 60 + 25, 8 * 60);
        const outMin = r.int(16 * 60 + 58, 17 * 60 + 50);
        const noOut = r.chance(0.02);
        if (inMin > 8 * 60) late++;
        if (noOut) forgot++;
        else if (e.id === target.id) targetMinutes += outMin - inMin;
        rows.push([day, e.id, e.name, clock(...TIME(inMin)), noOut ? null : clock(...TIME(outMin))]);
      }
    return {
      headers: ['Tanggal', 'ID Karyawan', 'Nama', 'Jam Masuk', 'Jam Pulang'],
      rows,
      fmt: ['date', undefined, undefined, 'time', 'time'],
      tasks: [
        task(
          'Berapa kali karyawan terlambat (jam masuk lewat dari 08:00) selama sebulan, semua karyawan? Baris yang kosong berarti tidak hadir.',
          'Jam di sini angka waktu asli. COUNTIF(jam masuk;">"&TIME(8;0;0)). Sel kosong tidak ikut terhitung.',
          late,
        ),
        task(
          'Berapa kali karyawan lupa absen pulang (jam masuk terisi, jam pulang kosong)?',
          'COUNTIFS(jam masuk;"<>";jam pulang;"").',
          forgot,
        ),
        task(
          `Berapa total jam kerja ${target.id} (${target.name}) selama sebulan? Hanya hari yang jam masuk dan pulangnya terisi. Bulatkan 1 desimal.`,
          'Selisih jam pulang dikurangi jam masuk adalah pecahan hari, kalikan 24 untuk jam. Gunakan SUMPRODUCT dengan syarat ID dan sel terisi.',
          round(targetMinutes / 60, 1),
          0.06,
        ),
      ],
    };
  },
});

export const pay = (m: Meta & { n: number; roles: readonly (readonly [string, number])[] }): DatasetSpec => ({
  ...m,
  build: (r): Built => {
    const names = people(r, m.n);
    const recs = names.map((name, i) => {
      const [role, base] = skewed(r, m.roles, 1.4);
      const pokok = Math.round((base * (0.9 + r.next() * 0.3)) / 100000) * 100000;
      return {
        id: `G${pad(i + 1, 3)}`,
        name,
        role,
        pokok,
        tunj: r.chance(0.08) ? 0 : r.int(1, 6) * 250000,
        pot: Math.round((pokok * 0.03) / 1000) * 1000,
      };
    });
    const rows: Cell[][] = recs.map((x) => [
      x.id,
      x.name,
      mess(r, x.role, 0.1),
      numCell(r, x.pokok, 0.04),
      x.tunj === 0 ? null : x.tunj,
      x.pot,
    ]);
    const net = (x: (typeof recs)[number]): number => x.pokok + x.tunj - x.pot;
    const top = topUnique(
      tally(recs, (x) => x.role),
      m.slug,
    )[0];
    return {
      headers: ['ID', 'Nama', 'Jabatan', 'Gaji Pokok (Rp)', 'Tunjangan (Rp)', 'Potongan (Rp)'],
      rows,
      fmt: [undefined, undefined, undefined, 'rp', 'rp', 'rp'],
      tasks: [
        task(
          'Berapa total gaji bersih (gaji pokok + tunjangan - potongan) seluruh karyawan? Tunjangan yang kosong dianggap 0.',
          'Gaji pokok yang tersimpan sebagai teks tidak ikut terjumlah oleh SUM. Ubah dulu, lalu SUM(pokok)+SUM(tunjangan)-SUM(potongan).',
          sum(recs.map(net)),
        ),
        task(
          'Berapa karyawan yang gaji bersihnya lebih dari Rp 8.000.000?',
          'Buat kolom bantu gaji bersih per baris (pakai N() atau VALUE untuk sel teks), lalu COUNTIF(...;">8000000").',
          recs.filter((x) => net(x) > 8_000_000).length,
        ),
        task(
          `Berapa total gaji pokok jabatan "${top}"? Penulisan jabatannya tidak seragam.`,
          TRIM_HINT,
          sum(recs.filter((x) => x.role === top).map((x) => x.pokok)),
        ),
      ],
    };
  },
});

export const marketplace = (m: Meta): DatasetSpec => ({
  ...m,
  build: (r): Built => {
    const items: readonly (readonly [string, number])[] = [
      ['Kaos Polos', 65000],
      ['Hoodie', 180000],
      ['Tas Ransel', 135000],
      ['Sepatu Sneakers', 250000],
      ['Topi', 35000],
      ['Jaket Denim', 220000],
      ['Kemeja Flanel', 120000],
      ['Jilbab Instan', 45000],
      ['Kaos Kaki', 15000],
      ['Dompet Kulit', 95000],
    ];
    const kota = ['Jakarta', 'Bandung', 'Surabaya', 'Semarang', 'Medan', 'Makassar', 'Palembang', 'Malang'];
    const eks = ['JNE', 'J&T', 'SiCepat', 'AnterAja', 'Pos Indonesia'];
    const raw = Array.from({ length: 300 }, () => {
      const it = skewed(r, items);
      return {
        date: randDate(r, D(2026, 10, 1), 31),
        item: it[0],
        price: it[1],
        kota: r.pick(kota),
        eks: skewed(r, eks, 1.6),
        qty: r.int(1, 4),
        ongkir: r.int(8, 30) * 1000,
        status: r.next() < 0.78 ? 'Selesai' : r.chance(0.5) ? 'Dibatalkan' : 'Dikirim',
      };
    });
    const recs = sortBy(raw, (x) => x.date.getTime()).map((x, i) => ({ ...x, id: `MP-${pad(i + 1, 5)}` }));
    const rows: Cell[][] = recs.map((x) => [
      dateCell(r, x.date),
      x.id,
      x.item,
      mess(r, x.kota, 0.1),
      mess(r, x.eks, 0.12),
      x.qty,
      x.price,
      x.ongkir,
      mess(r, x.status, 0.08),
    ]);
    return {
      headers: ['Tanggal', 'No Pesanan', 'Produk', 'Kota', 'Ekspedisi', 'Qty', 'Harga (Rp)', 'Ongkir (Rp)', 'Status'],
      rows: withDuplicates(r, rows, 4),
      fmt: ['date', undefined, undefined, undefined, undefined, 'int', 'rp', 'rp', undefined],
      tasks: [
        task(
          'Berapa omzet bersih (qty × harga) dari pesanan berstatus "Selesai"? Pesanan yang tercatat dua kali hanya dihitung sekali.',
          `Singkirkan baris ganda dulu. ${TRIM_HINT} Lalu SUMPRODUCT((status="Selesai")*qty*harga).`,
          sum(recs.filter((x) => x.status === 'Selesai').map((x) => x.qty * x.price)),
        ),
        task(
          'Ekspedisi apa yang paling sering dipakai? Tulis namanya saja. Baris ganda hanya dihitung sekali.',
          'Hitung tiap ekspedisi dengan COUNTIF (setelah membersihkan nama dan menyingkirkan baris ganda), lalu cari yang terbesar dengan INDEX dan MATCH.',
          topUnique(
            tally(recs, (x) => x.eks),
            m.slug,
          )[0],
        ),
        task(
          'Berapa pesanan yang berstatus "Dibatalkan"? Baris ganda hanya dihitung sekali.',
          `Singkirkan baris ganda dulu. ${TRIM_HINT}`,
          recs.filter((x) => x.status === 'Dibatalkan').length,
        ),
      ],
    };
  },
});

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const salesTarget = (m: Meta): DatasetSpec => ({
  ...m,
  build: (r): Built => {
    const wil = ['Barat', 'Tengah', 'Timur'];
    const sales = people(r, 10).map((name, i) => ({ name, wil: wil[i % 3]! }));
    const recs = MONTHS.flatMap((bulan) =>
      sales.map((s) => {
        const target = r.int(10, 20) * 5_000_000;
        return { bulan, ...s, target, real: Math.round((target * (0.7 + r.next() * 0.6)) / 100000) * 100000 };
      }),
    );
    const rows: Cell[][] = recs.map((x) => [x.bulan, mess(r, x.name, 0.06), mess(r, x.wil, 0.08), x.target, numCell(r, x.real, 0.04)]);
    const byWil = topUnique(
      tally(
        recs,
        (x) => x.wil,
        (x) => x.real,
      ),
      m.slug,
    );
    return {
      headers: ['Bulan', 'Sales', 'Wilayah', 'Target (Rp)', 'Realisasi (Rp)'],
      rows,
      fmt: [undefined, undefined, undefined, 'rp', 'rp'],
      tasks: [
        task(
          'Berapa kali sales mencapai atau melewati target (realisasi ≥ target) sepanjang tahun? Beberapa realisasi tersimpan sebagai teks.',
          'Ubah realisasi teks jadi angka, lalu SUMPRODUCT(--(realisasi>=target)).',
          recs.filter((x) => x.real >= x.target).length,
        ),
        task(
          `Berapa total realisasi wilayah "${byWil[0]}"? Penulisan wilayahnya tidak seragam.`,
          `${TRIM_HINT} Realisasi yang berupa teks tidak ikut terjumlah.`,
          byWil[1],
        ),
        task(
          'Siapa sales dengan total realisasi tertinggi sepanjang tahun? Tulis namanya.',
          'Rekap per sales dengan SUMIF (nama sudah dibersihkan), lalu INDEX dan MATCH pada nilai MAX.',
          topUnique(
            tally(
              recs,
              (x) => x.name,
              (x) => x.real,
            ),
            m.slug,
          )[0],
        ),
      ],
    };
  },
});

export const budget = (m: Meta): DatasetSpec => ({
  ...m,
  build: (r): Built => {
    const pos = ['Gaji', 'Listrik dan Air', 'Internet', 'ATK', 'Perjalanan Dinas', 'Konsumsi', 'Perawatan', 'Pelatihan', 'Iklan', 'Sewa'];
    const recs = MONTHS.flatMap((bulan) =>
      pos.map((p) => {
        const budgetAmount = r.int(4, 40) * 500000;
        return { bulan, pos: p, budgetAmount, real: Math.round((budgetAmount * (0.8 + r.next() * 0.45)) / 50000) * 50000 };
      }),
    );
    const rows: Cell[][] = recs.map((x) => [x.bulan, mess(r, x.pos, 0.08), x.budgetAmount, numCell(r, x.real, 0.04), null]);
    const over = (x: (typeof recs)[number]): number => Math.max(0, x.real - x.budgetAmount);
    return {
      headers: ['Bulan', 'Pos Anggaran', 'Anggaran (Rp)', 'Realisasi (Rp)', 'Selisih (Rp)'],
      rows,
      fmt: [undefined, undefined, 'rp', 'rp', 'rp'],
      tasks: [
        task(
          'Berapa baris yang realisasinya melebihi anggaran? Beberapa realisasi tersimpan sebagai teks.',
          'Ubah realisasi teks jadi angka, lalu SUMPRODUCT(--(realisasi>anggaran)). Kolom Selisih boleh kamu isi untuk membantu.',
          recs.filter((x) => x.real > x.budgetAmount).length,
        ),
        task(
          'Berapa total kelebihan realisasi dari anggaran (hanya baris yang melebihi)?',
          'Per baris: =MAX(0;realisasi-anggaran), lalu jumlahkan. Atau SUMPRODUCT((realisasi>anggaran)*(realisasi-anggaran)).',
          sum(recs.map(over)),
        ),
        task(
          'Pos anggaran apa yang total kelebihannya paling besar? Tulis namanya.',
          `Rekap kelebihan per pos dengan SUMIF. ${TRIM_HINT}`,
          topUnique(
            tally(recs, (x) => x.pos, over),
            m.slug,
          )[0],
        ),
      ],
    };
  },
});

const AGENCIES = [
  'Dinas Pendidikan',
  'Kantor Pajak',
  'PT Maju Bersama',
  'Bank Daerah',
  'Kecamatan',
  'Universitas Negeri',
  'CV Sinar Abadi',
  'Dinas Kesehatan',
  'Kelurahan',
  'PT Karya Mandiri',
];
const SUBJECTS = [
  'Undangan rapat',
  'Permohonan data',
  'Pemberitahuan jadwal',
  'Penawaran kerja sama',
  'Laporan bulanan',
  'Permintaan klarifikasi',
  'Konfirmasi kehadiran',
  'Pengajuan anggaran',
];

export const letters = (m: Meta): DatasetSpec => ({
  ...m,
  build: (r): Built => {
    const raw = Array.from({ length: 130 }, () => {
      const masuk = r.chance(0.65);
      const done = masuk && r.chance(0.7);
      return {
        date: randDate(r, D(2026, 9, 1), 61),
        masuk,
        agency: r.pick(AGENCIES),
        subject: r.pick(SUBJECTS),
        done,
        days: done ? r.int(1, 12) : null,
      };
    });
    let sm = 0;
    let sk = 0;
    const recs = sortBy(raw, (x) => x.date.getTime()).map((x) => ({ ...x, id: x.masuk ? `SM-${pad(++sm, 3)}` : `SK-${pad(++sk, 3)}` }));
    const rows: Cell[][] = recs.map((x) => [
      x.id,
      dateCell(r, x.date),
      mess(r, x.masuk ? 'Masuk' : 'Keluar', 0.15),
      x.agency,
      x.subject,
      x.masuk ? mess(r, x.done ? 'Sudah' : 'Belum', 0.1) : '-',
      x.days,
    ]);
    const masuk = recs.filter((x) => x.masuk);
    const days = recs.flatMap((x) => (x.days === null ? [] : [x.days]));
    return {
      headers: ['No Agenda', 'Tanggal', 'Jenis', 'Asal / Tujuan', 'Perihal', 'Disposisi', 'Lama Proses (hari)'],
      rows,
      fmt: [undefined, 'date', undefined, undefined, undefined, undefined, 'int'],
      tasks: [
        task('Berapa jumlah surat berjenis "Masuk"? Penulisan jenisnya tidak seragam.', TRIM_HINT, masuk.length),
        task(
          'Berapa surat masuk yang disposisinya masih "Belum"?',
          `${TRIM_HINT} Surat keluar tidak punya disposisi (tanda -), jadi pakai COUNTIFS dengan jenis dan disposisi.`,
          masuk.filter((x) => !x.done).length,
        ),
        task(
          'Berapa rata-rata lama proses surat yang sudah didisposisi? Sel kosong tidak dihitung. Bulatkan 1 desimal.',
          'AVERAGE mengabaikan sel kosong. Lalu ROUND(...;1).',
          round(sum(days) / days.length, 1),
          0.06,
        ),
      ],
    };
  },
});

export const ppn = (m: Meta): DatasetSpec => ({
  ...m,
  build: (r): Built => {
    const buyers = [
      'PT Maju Bersama',
      'CV Sinar Abadi',
      'UD Sumber Rezeki',
      'PT Karya Mandiri',
      'CV Berkah Makmur',
      'PT Cahaya Utama',
      'Toko Sentosa',
    ];
    const raw = Array.from({ length: 120 }, () => ({
      date: randDate(r, D(2026, 8, 1), 92),
      buyer: skewed(r, buyers, 1.4),
      dpp: r.int(4, 120) * 500000,
      filed: r.chance(0.6),
    }));
    const recs = sortBy(raw, (x) => x.date.getTime()).map((x, i) => ({ ...x, id: `FP-${pad(i + 1)}` }));
    const rows: Cell[][] = recs.map((x) => [
      x.id,
      dateCell(r, x.date),
      mess(r, x.buyer, 0.1),
      numCell(r, x.dpp, 0.04),
      null,
      mess(r, x.filed ? 'Sudah Dilapor' : 'Belum Dilapor', 0.12),
    ]);
    const top = topUnique(
      tally(
        recs,
        (x) => x.buyer,
        (x) => x.dpp,
      ),
      m.slug,
    );
    return {
      headers: ['No Faktur', 'Tanggal', 'Pembeli', 'DPP (Rp)', 'PPN 11% (Rp)', 'Status Lapor'],
      rows,
      fmt: [undefined, 'date', undefined, 'rp', 'rp', undefined],
      tasks: [
        task(
          'Berapa total PPN (11% dari DPP) seluruh faktur? Beberapa DPP tersimpan sebagai teks.',
          'Isi kolom PPN dengan =DPP*11%, lalu SUM. DPP yang berupa teks perlu diubah dulu karena SUM mengabaikannya.',
          Math.round(sum(recs.map((x) => x.dpp)) * 0.11),
        ),
        task(
          'Berapa faktur yang statusnya "Belum Dilapor"? Penulisan status tidak seragam.',
          TRIM_HINT,
          recs.filter((x) => !x.filed).length,
        ),
        task(`Berapa total DPP pembeli "${top[0]}"? Penulisan namanya tidak seragam.`, TRIM_HINT, top[1]),
      ],
    };
  },
});

export const penyusutan = (m: Meta): DatasetSpec => ({
  ...m,
  build: (r): Built => {
    const things: readonly (readonly [string, number])[] = [
      ['Laptop', 4],
      ['Printer', 4],
      ['Meja Kerja', 8],
      ['Kursi Kantor', 8],
      ['AC Split', 8],
      ['Mesin Fotokopi', 8],
      ['Motor Operasional', 8],
      ['Mobil Operasional', 8],
      ['Server', 4],
      ['Lemari Arsip', 8],
    ];
    const recs = Array.from({ length: 100 }, (_, i) => {
      const [name, life] = skewed(r, things, 1.2);
      return { code: `AT-${pad(i + 1, 3)}`, name, year: r.int(2018, 2025), price: r.int(2, 120) * 500000, life };
    });
    const rows: Cell[][] = recs.map((x) => [x.code, x.name, numCell(r, x.year, 0.04), x.price, x.life, null]);
    return {
      headers: ['Kode', 'Nama Aset', 'Tahun Perolehan', 'Harga Perolehan (Rp)', 'Umur Ekonomis (tahun)', 'Penyusutan per Tahun (Rp)'],
      rows,
      fmt: [undefined, undefined, 'int', 'rp', 'int', 'rp'],
      tasks: [
        task('Berapa total harga perolehan seluruh aset?', 'SUM pada kolom harga perolehan.', sum(recs.map((x) => x.price))),
        task(
          'Berapa total penyusutan per tahun (metode garis lurus, tanpa nilai sisa: harga ÷ umur ekonomis)? Bulatkan ke bilangan bulat.',
          'Isi kolom penyusutan dengan =harga/umur, lalu SUM dan ROUND(...;0).',
          Math.round(sum(recs.map((x) => x.price / x.life))),
          1,
        ),
        task(
          'Berapa aset yang sudah habis disusutkan per akhir 2026 (tahun perolehan + umur ekonomis ≤ 2026)? Sebagian tahun tersimpan sebagai teks.',
          'Ubah tahun teks jadi angka, lalu SUMPRODUCT(--(tahun+umur<=2026)).',
          recs.filter((x) => x.year + x.life <= 2026).length,
        ),
      ],
    };
  },
});
