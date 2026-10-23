import { supabase, isSupabaseConfigured } from './supabase';
import type { StoredPackage, RecipientIndexEntry } from '../types/app';

/**
 * Hybrid storage layer: IndexedDB + localStorage fallback + Supabase Cloud Vault sync.
 * Supports multi-package indexing per recipient email so recipients can see their full inbox.
 */

export interface StoredMessage {
  payload?: string;
  storagePath?: string;
  timestamp: number;
  expiry: number | string;
  isPackage: boolean;
  mimeType?: string;
  fileName?: string;
}

/** Result of an email-based package retrieval. */
export type EmailRetrievalResult =
  | { status: 'found'; payload: string; expiry: number | string; storageKey: string }
  | { status: 'expired'; storageKey: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

const DB_NAME = 'secure-vault';
const DB_VERSION = 2; // bumped for recipient_index store
const STORE_NAME = 'messages';
const INDEX_STORE = 'recipient_index';
const LOCAL_PREFIX = 'secure-vault-local:';

const localKey = (key: string) => `${LOCAL_PREFIX}${key}`;

/* ---------------- IndexedDB helpers ---------------- */

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return; }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
        if (!db.objectStoreNames.contains(INDEX_STORE)) {
          const idxStore = db.createObjectStore(INDEX_STORE, { keyPath: 'id' });
          idxStore.createIndex('email', 'email', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

class Database {
  private memCache = new Map<string, StoredMessage | null>();

  /* ---------------- Local layer ---------------- */

  private async setLocal(key: string, value: StoredMessage | null): Promise<void> {
    this.memCache.set(key, value);
    try {
      if (typeof window === 'undefined') return;
      const db = await openDB();
      if (db) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        if (value === null) { store.delete(key); }
        else { store.put(value, key); }
        return;
      }
    } catch (err) { console.warn('[Vault] IndexedDB write failed:', err); }
    try {
      if (typeof window === 'undefined') return;
      if (value === null) { localStorage.removeItem(localKey(key)); }
      else { localStorage.setItem(localKey(key), JSON.stringify(value)); }
    } catch (err) { console.warn('[Vault] localStorage write failed:', err); }
  }

  private async getLocal(key: string): Promise<StoredMessage | null> {
    if (this.memCache.has(key)) return this.memCache.get(key) ?? null;
    try {
      if (typeof window === 'undefined') return null;
      const db = await openDB();
      if (db) {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const stored = await idbRequest(store.get(key) as IDBRequest<StoredMessage | null>);
        if (stored) { this.memCache.set(key, stored); return this.normalize(stored); }
      }
    } catch (err) { console.warn('[Vault] IndexedDB read failed:', err); }
    try {
      if (typeof window === 'undefined') return null;
      const raw = localStorage.getItem(localKey(key));
      if (raw) { const parsed = JSON.parse(raw); this.memCache.set(key, parsed); return this.normalize(parsed); }
    } catch (err) { console.warn('[Vault] localStorage read failed:', err); }
    return null;
  }

  private normalize(parsed: StoredMessage): StoredMessage {
    if (parsed.expiry !== 'burn' && !isNaN(Number(parsed.expiry))) parsed.expiry = Number(parsed.expiry);
    parsed.timestamp = Number(parsed.timestamp) || 0;
    return parsed;
  }

  /* ---------------- Index layer (multi-package per email) ---------------- */

  /** Add a package record to the recipient index. */
  async addToRecipientIndex(entry: Omit<RecipientIndexEntry, 'id'> & { id?: string }): Promise<void> {
    if (typeof window === 'undefined') return;
    const db = await openDB();
    if (!db) return;
    try {
      const tx = db.transaction(INDEX_STORE, 'readwrite');
      const store = tx.objectStore(INDEX_STORE);
      const pkgId = entry.packageId || entry.id || `${entry.email}:${Date.now()}`;
      const fullEntry: RecipientIndexEntry = {
        id: entry.id || pkgId,
        packageId: pkgId,
        email: entry.email.toLowerCase().trim(),
        timestamp: entry.timestamp,
        status: entry.status,
      };
      store.put(fullEntry);
    } catch (err) { console.warn('[Vault] Index write failed:', err); }
  }

  /** Get all index entries for an email, sorted newest first. */
  async getMessagesForEmail(email: string): Promise<RecipientIndexEntry[]> {
    if (typeof window === 'undefined') return [];
    const db = await openDB();
    if (!db) return [];
    try {
      const tx = db.transaction(INDEX_STORE, 'readonly');
      const store = tx.objectStore(INDEX_STORE);
      const index = store.index('email');
      const results = await idbRequest(index.getAll(email.toLowerCase().trim()) as IDBRequest<RecipientIndexEntry[]>);
      return (results || []).sort((a, b) => b.timestamp - a.timestamp);
    } catch { return []; }
  }

  /** Remove an index entry by package id. */
  async removeFromIndex(packageId: string): Promise<void> {
    if (typeof window === 'undefined') return;
    const db = await openDB();
    if (!db) return;
    try {
      const tx = db.transaction(INDEX_STORE, 'readwrite');
      tx.objectStore(INDEX_STORE).delete(packageId);
    } catch (err) { console.warn('[Vault] Index delete failed:', err); }
  }

  /* ---------------- Cloud layer ---------------- */

  private async cloudSetItem(key: string, value: StoredMessage): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('messages').upsert(
      { identifier: key, payload: value.payload, storage_path: value.storagePath, timestamp: value.timestamp, expiry: String(value.expiry), is_package: value.isPackage },
      { onConflict: 'identifier' }
    );
    if (error) console.warn('[Cloud Vault] Sync failed:', error.message);
  }

  private async cloudGetItem(key: string): Promise<StoredMessage | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.from('messages').select('*').eq('identifier', key).single();
    if (error) { if (error.code === 'PGRST116') return null; console.warn('[Cloud Vault] Cloud read failed:', error.message); return null; }
    if (!data) return null;
    let expiryValue: string | number = data.expiry;
    if (expiryValue !== 'burn' && !isNaN(Number(expiryValue))) expiryValue = Number(expiryValue);
    return {
      payload: data.payload ?? undefined,
      storagePath: data.storage_path ?? undefined,
      timestamp: Number(data.timestamp) || 0,
      expiry: expiryValue,
      isPackage: data.is_package ?? true,
    };
  }

  async setItem(key: string, value: StoredMessage): Promise<void> {
    await this.setLocal(key, value);
    try { await Promise.race([this.cloudSetItem(key, value), new Promise<void>((r) => setTimeout(r, 10000))]); }
    catch (err) { console.warn('[Cloud Vault] Sync failed, local retained:', err); }
  }

  async getItem(key: string): Promise<StoredMessage | null> {
    const local = await this.getLocal(key);
    try {
      const cloud = await Promise.race([this.cloudGetItem(key), new Promise<StoredMessage | null>((r) => setTimeout(() => r(null), 10000))]);
      if (cloud) { await this.setLocal(key, cloud); this.memCache.set(key, cloud); return cloud; }
    } catch (err) { console.warn('[Cloud Vault] Cloud lookup failed:', err); }
    return local;
  }

  async removeItem(key: string): Promise<void> {
    let item: StoredMessage | null = null;
    try { item = await Promise.race([this.cloudGetItem(key), new Promise<StoredMessage | null>((r) => setTimeout(() => r(null), 10000))]); }
    catch { /* ignore */ }
    if (!item) item = await this.getLocal(key);
    await this.setLocal(key, null);
    this.memCache.delete(key);
    if (!isSupabaseConfigured) return;
    try {
      if (item?.storagePath) await supabase.storage.from('vault').remove([item.storagePath]);
      await supabase.from('messages').delete().eq('identifier', key);
    } catch (err) { console.warn('[Cloud Vault] Cloud delete failed:', err); }
  }

  /**
   * Retrieve a recipient's package by email (cross-device via cloud vault).
   * Enforces expiry, resolves inline payload or cloud blob, and reports a
   * clear status so the UI can give precise feedback instead of failing silently.
   */
  async retrieveByEmail(email: string): Promise<EmailRetrievalResult> {
    const clean = (email || '').toLowerCase().trim();
    if (!clean || !clean.includes('@')) {
      return { status: 'error', message: 'Enter a valid email address.' };
    }
    const storageKey = `msg_${clean}`;
    let message: StoredMessage | null = null;
    try {
      message = await this.getItem(storageKey);
    } catch (err: any) {
      return { status: 'error', message: err?.message || 'Could not reach the vault. Try again.' };
    }
    if (!message) return { status: 'not_found' };

    // Enforce time-based expiry (skip for burn-after-reading).
    if (message.expiry !== 'burn') {
      const dur = Number(message.expiry);
      if (!isNaN(dur) && dur > 0 && message.timestamp && Date.now() > message.timestamp + dur) {
        await this.removeItem(storageKey);
        return { status: 'expired', storageKey };
      }
    }

    // Resolve the encrypted payload: prefer inline, fall back to cloud blob.
    let payload = message.payload;
    if (!payload && message.storagePath) {
      try {
        const blob = await this.downloadBlob(message.storagePath);
        if (blob) payload = await this.blobToBase64(blob);
      } catch (err: any) {
        console.warn('[Vault] Blob resolve failed:', err?.message || err);
      }
    }
    if (!payload) {
      return { status: 'error', message: 'Package found but its encrypted payload is unavailable. Ask the sender for the direct link or .vault file.' };
    }
    return { status: 'found', payload, expiry: message.expiry, storageKey };
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async uploadBlob(path: string, blob: Blob): Promise<string | null> {
    if (!isSupabaseConfigured) { console.warn('[Vault] Supabase not configured; skipping blob upload.'); return null; }
    try {
      const { data, error } = await supabase.storage.from('vault').upload(path, blob, { contentType: 'application/octet-stream', upsert: true });
      if (error) { console.warn('Storage upload failed:', error.message); return null; }
      return data.path;
    } catch (err: any) { console.warn('Storage upload exception:', err?.message || err); return null; }
  }

  async downloadBlob(path: string): Promise<Blob | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase.storage.from('vault').download(path);
      if (error) { console.warn('Storage download failed:', error.message); return null; }
      return data;
    } catch (err: any) { console.warn('Storage download exception:', err?.message || err); return null; }
  }

  async checkCloudHealth(): Promise<'cloud' | 'local'> {
    if (!isSupabaseConfigured) return 'local';
    try {
      const { error } = await Promise.race([
        supabase.from('messages').select('identifier').limit(1),
        new Promise<{ error: { message: string } }>((r) => setTimeout(() => r({ error: { message: 'timeout' } }), 5000)),
      ]);
      return error ? 'local' : 'cloud';
    } catch { return 'local'; }
  }
}

export const db = new Database();