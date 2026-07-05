/**
 * AES-256-GCM encryption for small secrets at rest (per-tenant AI API keys).
 * Key is derived from JWT_SECRET; ciphertext format: v1:<iv>:<tag>:<data> (base64).
 */
import crypto from 'crypto';

function key(): Buffer {
  return crypto.createHash('sha256').update(`secretbox:${process.env.JWT_SECRET!}`).digest();
}

export function sealSecret(plain: string): string {
  if (!plain) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${enc.toString('base64')}`;
}

export function openSecret(sealed: string | undefined): string | undefined {
  if (!sealed) return undefined;
  if (!sealed.startsWith('v1:')) return sealed; // legacy/plaintext value
  try {
    const [, ivB64, tagB64, dataB64] = sealed.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return undefined; // wrong key or corrupted — treat as unset
  }
}
