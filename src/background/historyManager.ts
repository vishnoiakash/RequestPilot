/**
 * HistoryManager — records HTTP modification events into storage.
 * Called from the service worker when rules fire.
 */

import type { HistoryEntry, AnyRule, RuleType } from '../models/types.js';
import { STORAGE_KEYS } from '../models/types.js';
import { storageService } from '../storage/StorageService.js';

let historyWriteQueue: Promise<void> = Promise.resolve();

/**
 * Append a new history entry to chrome.storage.local.
 * Keeps at most MAX_HISTORY entries (oldest dropped first).
 */
export async function appendHistory(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): Promise<void> {
  return appendHistoryBatch([entry]);
}

export async function appendHistoryBatch(
  entries: Array<Omit<HistoryEntry, 'id' | 'timestamp'>>
): Promise<void> {
  if (!entries.length) return;
  historyWriteQueue = historyWriteQueue.then(async () => {
    try {
      const settings = await storageService.getSettings();
      if (!settings.historyEnabled) return;
      const result = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
      const history: HistoryEntry[] = (result[STORAGE_KEYS.HISTORY] as HistoryEntry[]) || [];
      const now = new Date().toISOString();
      const newEntries = entries.map((entry) => ({
        ...entry,
        id: crypto.randomUUID(),
        timestamp: now,
      }));
      await chrome.storage.local.set({
        [STORAGE_KEYS.HISTORY]: [...newEntries, ...history].slice(0, settings.historyLimit),
      });
      await storageService.incrementUsageCounts(entries.map((entry) => entry.ruleId));
    } catch (err) {
      console.error('[RequestPilot] History write error:', err);
    }
  });
  return historyWriteQueue;
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
