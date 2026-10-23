import { decodeHashPayload } from './crypto-utils';

/**
 * Extracts the encrypted payload from any pasted text:
 * - Full share URLs (https://domain/#v=<payload> or https://domain/?v=<payload>)
 * - Bare URL fragments (#v=<payload> or v=<payload>)
 * - Raw base64url tokens (standalone alphanumeric strings)
 * - JSON-wrapped payloads ({"token":"..."} or {"data":"..."})
 * Returns null when nothing usable is found.
 */
export function parsePastedLink(raw: string): string | null {
  const input = (raw || '').trim();
  if (!input) return null;

  // 1. Try URL hash/query param: #v=..., ?v=..., &v=...
  const urlMatch = input.match(/[#?&]v=([A-Za-z0-9_\-]+)/);
  if (urlMatch) {
    const decoded = decodeHashPayload(urlMatch[1]);
    if (decoded) return decoded;
  }

  // 2. Try JSON-wrapped payload: {"token":"..."} or {"data":"..."}
  try {
    const json = JSON.parse(input);
    const token = json.token || json.data || json.payload || json.v;
    if (typeof token === 'string') {
      const decoded = decodeHashPayload(token.trim());
      if (decoded) return decoded;
    }
  } catch {
    // Not JSON, continue to next check
  }

  // 3. Bare token (base64url without any URL wrapper).
  if (/^[A-Za-z0-9_\-]+$/.test(input) && input.length >= 16) {
    const decoded = decodeHashPayload(input);
    if (decoded) return decoded;
  }

  return null;
}
