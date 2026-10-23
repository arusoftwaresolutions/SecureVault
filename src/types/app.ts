export type AppMode = 'idle' | 'send' | 'receive' | 'display' | 'docs';

export interface DecryptedItem {
  data: Uint8Array;
  mimeType: string;
  fileName?: string;
}

export interface DecryptedPayload {
  items: DecryptedItem[];
  hint?: string;
}

/** A single encrypted package stored for a recipient email. */
export interface StoredPackage {
  id: string;
  payload: string;          // base64 AES-GCM ciphertext
  storagePath?: string;     // Supabase Storage path (optional)
  timestamp: number;
  expiry: number | string;  // ms-since-epoch or 'burn'
  isPackage: boolean;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;        // original total bytes
}

/** Metadata entry in the recipient index. */
export interface RecipientIndexEntry {
  id: string;
  packageId: string;
  email: string;
  timestamp: number;
  status: 'active' | 'expired' | 'burned';
}