import nodemailer from 'nodemailer';
import type { Config, MailMode } from '../config';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  mode: MailMode;
  /** false bila server tidak dapat mengirim email (fitur login/reset email dimatikan). */
  enabled: boolean;
  /** Hanya terisi pada mode console/memory (pengembangan dan tes); tidak pernah diisi di produksi. */
  outbox: MailMessage[];
  send(msg: MailMessage): Promise<void>;
}

/**
 * Pengirim email.
 * - smtp: kirim lewat server SMTP sungguhan (nodemailer).
 * - console: cetak ke log server (pengembangan lokal; kode login dapat dibaca di terminal API).
 * - memory: simpan di memori (tes otomatis).
 * - disabled: tidak mengirim; fitur email dimatikan.
 */
export function createMailer(config: Config): Mailer {
  const mode = config.mail.mode;
  const outbox: MailMessage[] = [];
  const keep = (m: MailMessage): void => {
    outbox.push(m);
    if (outbox.length > 20) outbox.shift();
  };

  if (mode === 'smtp' && config.mail.smtp) {
    const transport = nodemailer.createTransport({
      host: config.mail.smtp.host,
      port: config.mail.smtp.port,
      secure: config.mail.smtp.secure,
      auth: config.mail.smtp.user ? { user: config.mail.smtp.user, pass: config.mail.smtp.pass } : undefined,
    });
    return {
      mode,
      enabled: true,
      outbox,
      async send(m) {
        await transport.sendMail({ from: config.mail.from, to: m.to, subject: m.subject, text: m.text });
      },
    };
  }

  return {
    mode,
    enabled: mode === 'console' || mode === 'memory',
    outbox,
    async send(m) {
      if (mode === 'disabled') throw new Error('Pengiriman email dinonaktifkan.');
      keep(m);
      if (mode === 'console') console.log(`\n[email:dev] Kepada: ${m.to}\n[email:dev] Subjek: ${m.subject}\n${m.text}\n`);
    },
  };
}
