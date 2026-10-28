import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { lessons } from '@excellab/shared';
import { LessonField, parseLesson } from './features/admin/LessonEditor';

const sample = lessons.find((l) => l.content.sections.length >= 2 && l.content.playgroundNote)!;
const json = JSON.stringify(sample.content, null, 2);

/** Form kecil yang memegang JSON seperti form admin yang asli, supaya hasil ketikan bisa dibaca kembali. */
function Harness({ start = json, onValue }: { start?: string; onValue?: (v: string) => void }) {
  const [value, setValue] = useState(start);
  return (
    <LessonField
      value={value}
      meta={{ title: 'Judul uji', summary: 'Ringkasan uji', minutes: 7 }}
      onChange={(v) => {
        setValue(v);
        onValue?.(v);
      }}
    />
  );
}

describe('editor isi pelajaran', () => {
  it('menampilkan bagian-bagian pelajaran di kotak teks, bukan JSON', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Tujuan belajar')).toHaveValue(sample.content.objectives.join('\n'));
    expect(screen.getByLabelText('Judul bagian', { selector: '#le-sh-0' })).toHaveValue(sample.content.sections[0]!.heading);
    expect(screen.getByRole('button', { name: 'Edit sebagai JSON' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Isi pelajaran (JSON)')).not.toBeInTheDocument();
  });

  it('mengubah satu kalimat memperbarui JSON yang disimpan dan tidak mengubah bagian lain', async () => {
    let latest = json;
    render(<Harness onValue={(v) => (latest = v)} />);
    const box = screen.getByLabelText('Judul bagian', { selector: '#le-sh-0' });
    await userEvent.clear(box);
    await userEvent.type(box, 'Judul baru');
    const saved = parseLesson(latest)!;
    expect(saved.sections[0]!.heading).toBe('Judul baru');
    expect(saved.sections.slice(1)).toEqual(sample.content.sections.slice(1));
    expect(saved.quiz).toEqual(sample.content.quiz);
    expect(saved.example.table).toEqual(sample.content.example.table);
  });

  it('baris kosong pemisah paragraf bisa diketik dan jadi paragraf baru', async () => {
    let latest = json;
    render(<Harness onValue={(v) => (latest = v)} />);
    const para = document.querySelector<HTMLTextAreaElement>('#le-sp-0')!;
    await userEvent.clear(para);
    await userEvent.type(para, 'Paragraf satu.{enter}{enter}Paragraf dua.');
    expect(para).toHaveValue('Paragraf satu.\n\nParagraf dua.');
    expect(parseLesson(latest)!.sections[0]!.paragraphs).toEqual(['Paragraf satu.', 'Paragraf dua.']);
  });

  it('menambah, menggeser, dan menghapus bagian', async () => {
    let latest = json;
    render(<Harness onValue={(v) => (latest = v)} />);
    const n = sample.content.sections.length;
    await userEvent.click(screen.getByRole('button', { name: 'Tambah bagian' }));
    expect(parseLesson(latest)!.sections).toHaveLength(n + 1);

    await userEvent.click(screen.getByRole('button', { name: 'Geser bagian 2 ke atas' }));
    expect(parseLesson(latest)!.sections[0]!.heading).toBe(sample.content.sections[1]!.heading);
    expect(parseLesson(latest)!.sections[1]!.heading).toBe(sample.content.sections[0]!.heading);
    // Kotak teks ikut pindah mengikuti isinya.
    expect(document.querySelector<HTMLInputElement>('#le-sh-0')).toHaveValue(sample.content.sections[1]!.heading);

    await userEvent.click(screen.getByRole('button', { name: `Hapus bagian ${n + 1}` }));
    expect(parseLesson(latest)!.sections).toHaveLength(n);
  });

  it('tabel contoh memakai pemisah | dan angka tetap angka', async () => {
    let latest = json;
    render(<Harness onValue={(v) => (latest = v)} />);
    const table = screen.getByLabelText('Tabel contoh');
    await userEvent.clear(table);
    await userEvent.type(table, 'Barang | Harga{enter}Beras | 15000{enter}Gula | 14.5');
    expect(parseLesson(latest)!.example.table).toEqual([
      ['Barang', 'Harga'],
      ['Beras', 15000],
      ['Gula', 14.5],
    ]);
  });

  it('pilihan jawaban kuis: jawaban benar mengikuti pilihan dan tidak keluar dari daftar', async () => {
    let latest = json;
    render(<Harness onValue={(v) => (latest = v)} />);
    const opts = document.querySelector<HTMLTextAreaElement>('#le-qo-0')!;
    await userEvent.clear(opts);
    await userEvent.type(opts, 'Satu{enter}Dua');
    await userEvent.selectOptions(document.querySelector<HTMLSelectElement>('#le-qa-0')!, '1');
    expect(parseLesson(latest)!.quiz[0]).toMatchObject({ options: ['Satu', 'Dua'], answerIndex: 1 });

    await userEvent.clear(opts);
    await userEvent.type(opts, 'Hanya satu');
    expect(parseLesson(latest)!.quiz[0]!.answerIndex).toBe(0);
  });

  it('penanda pelajaran panduan dan catatan playground bisa diubah dan dikosongkan', async () => {
    let latest = json;
    render(<Harness onValue={(v) => (latest = v)} />);
    await userEvent.click(screen.getByLabelText(/Pelajaran panduan/));
    expect(parseLesson(latest)!.guide).toBe(true);
    await userEvent.click(screen.getByLabelText(/Pelajaran panduan/));
    expect(parseLesson(latest)!.guide).toBeUndefined();

    const note = screen.getByLabelText(/Catatan \(kosongkan/);
    await userEvent.clear(note);
    expect(parseLesson(latest)!.playgroundNote).toBeUndefined();
  });

  it('pratinjau memakai judul dan isi yang sedang diedit, sebelum disimpan', async () => {
    render(<Harness />);
    const box = screen.getByLabelText('Judul bagian', { selector: '#le-sh-0' });
    await userEvent.clear(box);
    await userEvent.type(box, 'Judul yang belum disimpan');
    await userEvent.click(screen.getByRole('button', { name: 'Pratinjau' }));
    const preview = screen.getByRole('region', { name: 'Pratinjau pelajaran' });
    expect(within(preview).getByRole('heading', { name: 'Judul uji' })).toBeInTheDocument();
    expect(within(preview).getByRole('heading', { name: 'Judul yang belum disimpan' })).toBeInTheDocument();
    expect(within(preview).getByText(/Perkiraan 7 menit/)).toBeInTheDocument();
  });

  it('mode JSON dan kembali ke editor; JSON rusak tidak bisa dibuka di editor', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit sebagai JSON' }));
    const raw = screen.getByLabelText('Isi pelajaran (JSON)');
    expect((raw as HTMLTextAreaElement).value).toContain('"objectives"');

    await userEvent.type(raw, ' {{rusak');
    await userEvent.click(screen.getByRole('button', { name: 'Kembali ke editor' }));
    expect(screen.getByText(/JSON belum valid/)).toBeInTheDocument();
    expect(screen.getByLabelText('Isi pelajaran (JSON)')).toBeInTheDocument();
  });

  it('JSON yang tidak terbaca langsung dibuka di mode JSON', () => {
    render(<Harness start="bukan json" />);
    expect(screen.getByLabelText('Isi pelajaran (JSON)')).toHaveValue('bukan json');
    expect(screen.getByRole('button', { name: 'Pratinjau' })).toBeDisabled();
  });
});
