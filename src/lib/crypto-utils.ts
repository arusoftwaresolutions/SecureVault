/**
 * Robust client-side encryption and decryption using Web Crypto API.
 * Implements AES-256-GCM with PBKDF2 key derivation.
 */

import type { DecryptedPayload } from '../types/app';

const ITERATIONS = 100000;
const KEY_LEN = 256;
const SALT_LEN = 16;
const IV_LEN = 12;

export interface FileItem {
  name?: string;
  type: string;
  data: Uint8Array;
}

/**
 * Derives a cryptographic key from a password and salt.
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: KEY_LEN },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Converts Uint8Array to Base64 string safely and efficiently.
 * Uses chunking to avoid stack limits for large files.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000; // 32KB chunks
  let binString = "";
  
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    // Use Array.from to satisfy TypeScript's strict type checking for apply
    binString += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binString);
}

/**
 * Converts Base64 string to Uint8Array safely and efficiently.
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64);
  const len = binString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypts data (string, ArrayBuffer, or Array of FileItems) using a password.
 * Returns a combined base64 string containing: salt + iv + encryptedData.
 */
export async function encryptData(
  data: string | ArrayBuffer | FileItem[],
  password: string,
  hint?: string
): Promise<string> {
  let dataBytes: Uint8Array;

  if (Array.isArray(data)) {
    // It's a package of files/messages
    const packageData = {
      version: 1,
      hint: hint,
      items: data.map(item => ({
        name: item.name,
        type: item.type,
        data: bytesToBase64(item.data)
      }))
    };
    const encoder = new TextEncoder();
    dataBytes = encoder.encode(JSON.stringify(packageData));
  } else if (typeof data === 'string') {
    const encoder = new TextEncoder();
    dataBytes = encoder.encode(data);
  } else {
    dataBytes = new Uint8Array(data);
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt);

  const encryptedContent = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBytes
  );

  const encryptedArray = new Uint8Array(encryptedContent);
  const combined = new Uint8Array(salt.length + iv.length + encryptedArray.length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(encryptedArray, salt.length + iv.length);

  return bytesToBase64(combined);
}

/**
 * Decrypts a combined base64 string using a password.
 * Returns the original data as Uint8Array.
 */
export async function decryptData(
  combinedBase64: string,
  password: string
): Promise<Uint8Array> {
  const combined = base64ToBytes(combinedBase64);

  const salt = combined.slice(0, SALT_LEN);
  const iv = combined.slice(SALT_LEN, SALT_LEN + IV_LEN);
  const encryptedData = combined.slice(SALT_LEN + IV_LEN);

  const key = await deriveKey(password, salt);

  try {
    const decryptedContent = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );
    return new Uint8Array(decryptedContent);
  } catch (error) {
    throw new Error('Decryption failed: Invalid key or corrupted data');
  }
}

/**
 * Helper to convert Uint8Array to string.
 */
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Helper to convert Uint8Array to Blob.
 */
export function bytesToBlob(bytes: Uint8Array, mimeType: string): Blob {
  return new Blob([bytes], { type: mimeType });
}

/* ------------------------------------------------------------------ */
/*  Direct Share Link (URL hash) helpers                               */
/* ------------------------------------------------------------------ */

/** Encodes binary-ish base64 payload into a URL-safe base64url string. */
export function encodeHashPayload(payload: string): string {
  return btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** Decodes a URL-safe base64url string back into the original base64. */
export function decodeHashPayload(hashValue: string): string | null {
  try {
    const base64 = hashValue.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return atob(padded);
  } catch {
    return null;
  }
}

/**
 * Builds a one-click shareable link that carries the encrypted payload in
 * the URL hash (`#v=<...>`). Nothing is stored server-side for this link —
 * the recipient opens it and unlocks with the secure key.
 */
export function buildShareLink(encryptedBase64: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#v=${encodeHashPayload(encryptedBase64)}`;
}

/**
 * Extracts an encrypted payload from a URL hash generated by
 * buildShareLink. Returns null when the hash is absent or malformed.
 * The hash is cleared afterwards so the raw secret never lingers.
 */
export function readShareLinkHash(): string | null {
  const raw = window.location.hash;
  if (!raw || !raw.startsWith('#v=')) return null;
  const payload = decodeHashPayload(raw.slice(3));
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {
    // Ignore history restrictions (e.g. sandboxed iframes).
  }
  return payload;
}

/* ------------------------------------------------------------------ */
/*  Encrypted `.vault` file package (export & import)                  */
/* ------------------------------------------------------------------ */

const VAULT_MAGIC = 'SECUREVAULT';

export interface VaultPackage {
  magic: typeof VAULT_MAGIC;
  version: 1;
  createdAt: number;
  payload: string; // already-encrypted base64 payload (salt+iv+ciphertext)
}

/**
 * Wraps an already-encrypted payload into a versioned `.vault` envelope so
 * the receiver can import it without a cloud connection. The file itself is
 * a plain-text JSON envelope — the actual content stays encrypted inside
 * `payload` and requires the secure key to open.
 */
export function createVaultFile(encryptedBase64: string, createdAt = Date.now()): Blob {
  const envelope: VaultPackage = {
    magic: VAULT_MAGIC,
    version: 1,
    createdAt,
    payload: encryptedBase64
  };
  return new Blob([JSON.stringify(envelope)], { type: 'application/json' });
}

/**
 * Parses a `.vault` envelope file. Throws with user-friendly messages when
 * the file is not a valid vault package.
 */
export async function parseVaultFile(file: Blob): Promise<VaultPackage> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not a valid .vault package (corrupted JSON).');
  }

  const pkg = parsed as Partial<VaultPackage>;
  if (pkg?.magic !== VAULT_MAGIC || pkg.version !== 1 || typeof pkg.payload !== 'string') {
    throw new Error('This file is not a valid .vault package.');
  }

  return {
    magic: VAULT_MAGIC,
    version: 1,
    createdAt: typeof pkg.createdAt === 'number' ? pkg.createdAt : Date.now(),
    payload: pkg.payload
  };
}

/* ------------------------------------------------------------------ */
/*  Package decryption helper (payload → DecryptedPayload)             */
/* ------------------------------------------------------------------ */

/**
 * Decrypts a package payload (from cloud, direct link, or .vault file)
 * and parses it back into files/messages consumed by MessageDisplay.
 * Throws user-friendly errors for a wrong key or an invalid package.
 */
export async function decryptPackage(
  combinedBase64: string,
  password: string
): Promise<DecryptedPayload> {
  const decryptedBytes = await decryptData(combinedBase64, password);

  let parsed: {
    version?: number;
    hint?: string;
    items?: Array<{ name?: string; type?: string; data?: string }>;
  };
  try {
    parsed = JSON.parse(bytesToString(decryptedBytes));
  } catch {
    throw new Error('Decryption succeeded, but the package format is invalid.');
  }

  if (!Array.isArray(parsed?.items)) {
    throw new Error('Decryption succeeded, but the package contains no files.');
  }

  return {
    hint: parsed.hint,
    items: parsed.items.map((item) => ({
      data: base64ToBytes(item.data ?? ''),
      mimeType: item.type || 'application/octet-stream',
      fileName: item.name
    }))
  };
}