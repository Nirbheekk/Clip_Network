import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function getMasterKey(): Buffer {
  const hex =
    process.env['ENCRYPTION_MASTER_KEY'] ??
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) {
    throw new Error('ENCRYPTION_MASTER_KEY must be 64 hex characters (32 bytes)');
  }
  return buf;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getMasterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, encB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !encB64) {
    throw new Error('Invalid encrypted secret format');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getMasterKey(),
    Buffer.from(ivB64, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(encB64, 'base64url')),
    decipher.final(),
  ]);
  return plain.toString('utf8');
}
