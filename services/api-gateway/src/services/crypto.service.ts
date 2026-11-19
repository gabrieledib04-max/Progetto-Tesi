import crypto from 'crypto';
import { config } from '../config.js';

export class CryptoService {
  private readonly key: Buffer;

  constructor() {
    // 32 bytes for AES-256
    const hexKey = config.tokenEncryptionKey;
    if (hexKey.length !== 64) {
      throw new Error('TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }
    this.key = Buffer.from(hexKey, 'hex');
  }

  /**
   * Encrypts plaintext using AES-256-GCM with a fresh random 12-byte IV per record.
   * Returns formatted string: ivHex:authTagHex:ciphertextHex
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypts formatted AES-256-GCM string (ivHex:authTagHex:ciphertextHex)
   */
  decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload format');
    }

    const [ivHex, authTagHex, ciphertextHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Deterministic SHA-256 hash (used for sessionIdHash)
   */
  hashSha256(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * HMAC-SHA256 pseudonymization for Spotify User ID (Privacy-by-Design)
   */
  pseudonymizeSpotifyUser(spotifyUserId: string): string {
    return crypto
      .createHmac('sha256', config.sessionSecret)
      .update(spotifyUserId)
      .digest('hex');
  }
}

export const cryptoService = new CryptoService();
