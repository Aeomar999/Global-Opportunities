import crypto from 'node:crypto';
import { IntegrationConfig } from '../models/AdminPortal.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/http.js';

const ALGORITHM = 'aes-256-gcm';

/**
 * Derives a deterministic 32-byte key for AES-256-GCM encryption.
 */
const getEncryptionKey = () => {
  const seed = env.adminJwtSecret || env.jwtSecret || 'global-opportunities-integration-secret-key-salt';
  return crypto.createHash('sha256').update(seed).digest();
};

/**
 * Encrypts a plaintext secret using AES-256-GCM.
 * Returns format: `${ivHex}:${authTagHex}:${ciphertextHex}`
 */
export const encryptSecret = (plaintext) => {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    return '';
  }
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
};

/**
 * Decrypts an AES-256-GCM payload.
 */
export const decryptSecret = (encryptedPayload) => {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') {
    return null;
  }
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted secret payload');
  }
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
};

/**
 * Normalizes user-supplied integration kinds ('ga4' maps to 'analytics').
 */
export const normalizeIntegrationKind = (kind) => {
  const normalized = String(kind || '').trim().toLowerCase();
  if (normalized === 'wordpress') return 'wordpress';
  if (normalized === 'analytics' || normalized === 'ga4') return 'analytics';
  throw new ApiError(400, `Invalid integration kind: "${kind}". Supported kinds: wordpress, analytics`);
};

/**
 * Returns integration status without exposing secret values.
 */
export const getIntegrationStatus = async (kind) => {
  const key = normalizeIntegrationKind(kind);
  const doc = await IntegrationConfig.findOne({ key }).lean();

  if (doc && doc.encryptedSecret) {
    return {
      saved: true,
      tail: doc.secretTail || '',
      identifier: doc.identifier || '',
    };
  }

  if (doc && (doc.identifier || doc.secretTail)) {
    return {
      saved: !!doc.encryptedSecret,
      tail: doc.secretTail || '',
      identifier: doc.identifier || '',
    };
  }

  // Fallback to environment configuration
  if (key === 'wordpress') {
    const envSecret = env.wordpressApiKey;
    return {
      saved: !!envSecret,
      tail: envSecret ? envSecret.slice(-4) : '',
      identifier: env.wordpressSyncBaseUrl || '',
    };
  }

  if (key === 'analytics') {
    const envSecret = process.env.GA4_API_SECRET || env.ga4ApiSecret;
    const envIdentifier = process.env.GA4_PROPERTY_ID || env.ga4PropertyId;
    return {
      saved: !!envSecret,
      tail: envSecret ? envSecret.slice(-4) : '',
      identifier: envIdentifier || '',
    };
  }

  return { saved: false, tail: '', identifier: '' };
};

/**
 * Returns statuses of all supported integrations.
 */
export const getAllIntegrationsStatus = async () => {
  const [wordpress, analytics] = await Promise.all([
    getIntegrationStatus('wordpress'),
    getIntegrationStatus('analytics'),
  ]);
  return { wordpress, analytics };
};

/**
 * Saves integration identifier or encrypted secret.
 */
export const saveIntegrationSettings = async ({ kind, identifier, secret, userId, userName }) => {
  const key = normalizeIntegrationKind(kind);
  let doc = await IntegrationConfig.findOne({ key });
  if (!doc) {
    doc = new IntegrationConfig({ key });
  }

  if (identifier !== undefined) {
    doc.identifier = String(identifier).trim();
  }

  if (secret !== undefined) {
    const trimmed = String(secret).trim();
    if (trimmed.length > 0) {
      doc.encryptedSecret = encryptSecret(trimmed);
      doc.secretTail = trimmed.slice(-4);
    } else {
      doc.encryptedSecret = '';
      doc.secretTail = '';
    }
  }

  if (userId) doc.updatedBy = userId;
  if (userName) doc.updatedByName = userName;
  await doc.save();

  return {
    saved: !!doc.encryptedSecret,
    tail: doc.secretTail || '',
    identifier: doc.identifier || '',
  };
};

/**
 * Performs a live connection test without logging or returning secrets.
 */
export const testIntegrationConnection = async (kind) => {
  const key = normalizeIntegrationKind(kind);
  const doc = await IntegrationConfig.findOne({ key }).lean();

  if (key === 'wordpress') {
    const identifier = doc?.identifier || env.wordpressSyncBaseUrl || '';
    let rawSecret = '';
    if (doc?.encryptedSecret) {
      try {
        rawSecret = decryptSecret(doc.encryptedSecret) || '';
      } catch {
        return { success: false, message: 'Could not decrypt stored WordPress credentials' };
      }
    } else {
      rawSecret = env.wordpressApiKey || '';
    }

    if (!identifier) {
      return { success: false, message: 'WordPress site address is not configured' };
    }
    if (!rawSecret) {
      return { success: false, message: 'WordPress application password is not configured' };
    }

    try {
      const url = identifier.replace(/\/+$/, '') + '/wp-json';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Kredibble-Admin-Integration-Test/1.0',
            Authorization: `Basic ${Buffer.from(`admin:${rawSecret}`).toString('base64')}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (response.ok || response.status === 401 || response.status === 403) {
          return { success: true, message: `Connected to WordPress endpoint successfully (HTTP ${response.status})` };
        }
        return { success: false, message: `WordPress endpoint returned HTTP ${response.status}` };
      } catch (err) {
        clearTimeout(timer);
        return { success: false, message: `Failed to connect to WordPress site: ${err.message}` };
      }
    } catch (err) {
      return { success: false, message: `Invalid WordPress site address: ${err.message}` };
    }
  }

  if (key === 'analytics') {
    const identifier = doc?.identifier || process.env.GA4_PROPERTY_ID || env.ga4PropertyId || '';
    let rawSecret = '';
    if (doc?.encryptedSecret) {
      try {
        rawSecret = decryptSecret(doc.encryptedSecret) || '';
      } catch {
        return { success: false, message: 'Could not decrypt stored Google Analytics credentials' };
      }
    } else {
      rawSecret = process.env.GA4_API_SECRET || env.ga4ApiSecret || '';
    }

    if (!identifier) {
      return { success: false, message: 'Google Analytics property ID is not configured' };
    }
    if (!rawSecret) {
      return { success: false, message: 'Google Analytics API secret is not configured' };
    }
    if (!/^\d+$/.test(identifier.trim())) {
      return { success: false, message: 'Google Analytics property ID must be a numeric string' };
    }

    return { success: true, message: 'Google Analytics 4 connection parameters verified' };
  }

  return { success: false, message: `Unsupported integration: ${key}` };
};
