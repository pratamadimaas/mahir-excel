import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { createGoogleVerifier } from './lib/google';

const CLIENT = 'abc123.apps.googleusercontent.com';
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const otherKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;

const certsFetch = ((calls: { n: number }) => async () => {
  calls.n++;
  return new Response(JSON.stringify({ kid1: publicPem }), { status: 200, headers: { 'cache-control': 'public, max-age=3600' } });
}) as (calls: { n: number }) => typeof fetch;

const sign = (claims: Record<string, unknown>, opts: jwt.SignOptions = {}, key: crypto.KeyObject = privateKey, kid = 'kid1') =>
  jwt.sign({ sub: '1234567890', email: 'Budi@Gmail.com', email_verified: true, name: 'Budi', ...claims }, key, {
    algorithm: 'RS256',
    keyid: kid,
    audience: CLIENT,
    issuer: 'https://accounts.google.com',
    expiresIn: '1h',
    ...opts,
  });

describe('verifikasi ID token Google', () => {
  it('menerima token yang sah dan menormalkan email', async () => {
    const calls = { n: 0 };
    const v = createGoogleVerifier(CLIENT, certsFetch(calls));
    const p = await v.verify(sign({}));
    expect(p).toEqual({ sub: '1234567890', email: 'budi@gmail.com', emailVerified: true, name: 'Budi' });
    await v.verify(sign({}));
    expect(calls.n).toBe(1); // sertifikat di-cache
  });

  it('issuer tanpa skema juga diterima, email_verified string "true" dianggap benar', async () => {
    const v = createGoogleVerifier(CLIENT, certsFetch({ n: 0 }));
    const p = await v.verify(sign({ email_verified: 'true' }, { issuer: 'accounts.google.com' }));
    expect(p.emailVerified).toBe(true);
  });

  it('email_verified salah/tidak ada ditandai belum terverifikasi', async () => {
    const v = createGoogleVerifier(CLIENT, certsFetch({ n: 0 }));
    expect((await v.verify(sign({ email_verified: false }))).emailVerified).toBe(false);
    expect((await v.verify(sign({ email_verified: undefined }))).emailVerified).toBe(false);
  });

  it('menolak audience berbeda, issuer palsu, token kedaluwarsa, dan tanda tangan kunci lain', async () => {
    const v = createGoogleVerifier(CLIENT, certsFetch({ n: 0 }));
    await expect(v.verify(sign({}, { audience: 'klien-lain.apps.googleusercontent.com' }))).rejects.toThrow();
    await expect(v.verify(sign({}, { issuer: 'https://jahat.example.com' }))).rejects.toThrow();
    await expect(v.verify(sign({}, { expiresIn: -10 }))).rejects.toThrow();
    await expect(v.verify(sign({}, {}, otherKey))).rejects.toThrow();
  });

  it('menolak kid tidak dikenal, token tanpa kid, dan sampah', async () => {
    const v = createGoogleVerifier(CLIENT, certsFetch({ n: 0 }));
    await expect(v.verify(sign({}, {}, privateKey, 'kid-asing'))).rejects.toThrow();
    await expect(v.verify('bukan.jwt.sama-sekali')).rejects.toThrow();
    await expect(v.verify('')).rejects.toThrow();
  });

  it('menolak serangan algoritma (HS256 bertanda tangan kunci publik)', async () => {
    const v = createGoogleVerifier(CLIENT, certsFetch({ n: 0 }));
    const forged = jwt.sign({ sub: '1', email: 'a@b.co', email_verified: true }, publicPem, {
      algorithm: 'HS256',
      keyid: 'kid1',
      audience: CLIENT,
      issuer: 'https://accounts.google.com',
      expiresIn: '1h',
    });
    await expect(v.verify(forged)).rejects.toThrow();
    const none = `${Buffer.from('{"alg":"none","kid":"kid1"}').toString('base64url')}.${Buffer.from(
      JSON.stringify({ sub: '1', email: 'a@b.co', aud: CLIENT, iss: 'https://accounts.google.com', exp: 9999999999 }),
    ).toString('base64url')}.`;
    await expect(v.verify(none)).rejects.toThrow();
  });

  it('tanpa Client ID semua verifikasi ditolak dan clientId null', async () => {
    const v = createGoogleVerifier(undefined, certsFetch({ n: 0 }));
    expect(v.clientId).toBeNull();
    await expect(v.verify(sign({}))).rejects.toThrow();
  });

  it('gagal memuat sertifikat Google menolak token (bukan menerima)', async () => {
    const v = createGoogleVerifier(CLIENT, (async () => new Response('x', { status: 500 })) as unknown as typeof fetch);
    await expect(v.verify(sign({}))).rejects.toThrow();
  });
});
