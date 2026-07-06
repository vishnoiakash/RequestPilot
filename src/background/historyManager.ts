/**
 * HistoryManager — records HTTP modification events into storage.
 * Called from the service worker when rules fire.
 */

import type { HistoryEntry, AnyRule, RuleType } from '../models/types.js';
import { STORAGE_KEYS } from '../models/types.js';

const MAX_HISTORY = 500;

/**
 * Append a new history entry to chrome.storage.local.
 * Keeps at most MAX_HISTORY entries (oldest dropped first).
 */
export async function appendHistory(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): Promise<void> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
    const history: HistoryEntry[] = (result[STORAGE_KEYS.HISTORY] as HistoryEntry[]) || [];

    const newEntry: HistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    // Prepend newest entry, trim to max
    const updated = [newEntry, ...history].slice(0, MAX_HISTORY);
    await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: updated });
  } catch (err) {
    console.error('[RequestPilot] History write error:', err);
  }
}

/**
 * Build a history entry from a webRequest details object and a matched rule.
 */
export function buildHistoryEntry(
  details: { method: string; url: string },
  rule: AnyRule,
  modificationType: string,
  status: 'applied' | 'error' = 'applied',
  errorMessage?: string
): Omit<HistoryEntry, 'id' | 'timestamp'> {
  return {
    ruleName: rule.name,
    ruleId: rule.id,
    ruleType: rule.type as RuleType,
    method: details.method,
    url: details.url,
    modificationType,
    status,
    ...(errorMessage ? { errorMessage } : {}),
  };
}
