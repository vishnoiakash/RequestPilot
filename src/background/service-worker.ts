/**
 * RequestPilot — Background Service Worker (Manifest V3)
 *
 * Responsibilities:
 *   1. Initialize storage with sample data on first install
 *   2. Convert RequestPilot rules → declarativeNetRequest dynamic rules
 *      and apply them whenever rules/settings/environments change
 *   3. Log history entries when matched rules fire
 *   4. Respond to messages from popup / options page
 *   5. Notify content scripts to refresh their in-memory rule cache
 */

import { storageService } from '../storage/StorageService.js';
import { applyDnrRules } from './ruleEngine.js';
import { appendHistory } from './historyManager.js';
import type { AnyRule } from '../models/types.js';

// ============================================================
// Helpers
// ============================================================

/**
 * Load everything from storage and push updated DNR rules.
 */
async function syncRules(): Promise<void> {
  try {
    const [rules, settings, activeEnv] = await Promise.all([
      storageService.getRules(),
      storageService.getSettings(),
      storageService.getActiveEnvironment(),
    ]);

    const { applied, errors } = await applyDnrRules(
      rules,
      activeEnv,
      settings.extensionEnabled
    );

    if (errors.length) {
      console.warn('[RequestPilot] DNR errors:', errors);
    } else {
      console.log(`[RequestPilot] Synced — ${applied} active DNR rules`);
    }

    // Notify all tabs so content scripts reload their mock/override rules
    notifyContentScripts();
  } catch (err) {
    console.error('[RequestPilot] syncRules error:', err);
  }
}

/**
 * Send a lightweight message to all tabs so the content script
 * re-reads storage for mock/override rules.
 */
function notifyContentScripts(): void {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id && tab.id !== chrome.tabs.TAB_ID_NONE) {
        chrome.tabs.sendMessage(tab.id, { type: 'RULES_UPDATED' }).catch(() => {
          // Tab may not have our content script — ignore
        });
      }
    }
  });
}

// ============================================================
// History logging via declarativeNetRequest matched rules feedback
// ============================================================

/**
 * Map from stable DNR rule ID → RequestPilot rule (rebuilt on sync).
 * Used to resolve which rule fired when logging history.
 */
let dnrIdToRule: Map<number, AnyRule> = new Map();

async function rebuildDnrIdMap(): Promise<void> {
  try {
    const [rules, activeEnv] = await Promise.all([
      storageService.getRules(),
      storageService.getActiveEnvironment(),
    ]);

    const { buildDnrRules } = await import('./ruleEngine.js');
    const dnrRules = buildDnrRules(rules, activeEnv);

    dnrIdToRule = new Map();
    for (const dnrRule of dnrRules) {
      // Find matching RequestPilot rule by stable ID
      const pilotRule = rules.find((r) => {
        // stableId logic: we re-derive it from the rule id string
        let hash = 0;
        for (let i = 0; i < r.id.length; i++) {
          hash = (Math.imul(31, hash) + r.id.charCodeAt(i)) | 0;
        }
        const base = (Math.abs(hash) % (30000 - 1000 - 100)) + 1000;
        return base === dnrRule.id || base + 1 === dnrRule.id || base + 2 === dnrRule.id;
      });
      if (pilotRule) dnrIdToRule.set(dnrRule.id, pilotRule);
    }
  } catch (err) {
    console.error('[RequestPilot] rebuildDnrIdMap error:', err);
  }
}

// Listen for rules that actually fired (requires declarativeNetRequestFeedback)
if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(
    async (info) => {
      const rule = dnrIdToRule.get(info.rule.ruleId);
      if (!rule) return;

      const modType =
        rule.type === 'header'   ? `Header ${rule.type === 'header' ? (rule as { target: string }).target === 'request' ? 'Request Modify' : 'Response Modify' : ''}` :
        rule.type === 'redirect' ? 'URL Redirect' :
        rule.type === 'queryParam' ? 'Query Param' :
        rule.type === 'cookie'   ? 'Cookie Modify' : rule.type;

      await appendHistory({
        ruleName:         rule.name,
        ruleId:           rule.id,
        ruleType:         rule.type,
        method:           info.request.method,
        url:              info.request.url,
        modificationType: modType,
        status:           'applied',
      });
    }
  );
}

// ============================================================
// Storage change listener — re-sync whenever rules change
// ============================================================

chrome.storage.onChanged.addListener(async (changes, area) => {
  const relevantKeys = [
    'requestpilot_rules',
    'requestpilot_environments',
    'requestpilot_settings',
  ];

  const affected = Object.keys(changes).some((k) => relevantKeys.includes(k));
  if (!affected) return;

  if (area === 'local' || area === 'sync') {
    await syncRules();
    await rebuildDnrIdMap();
  }
});

// ============================================================
// Install / Update
// ============================================================

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    try {
      await storageService.initialize();
      console.log('[RequestPilot] Initialized');
      await syncRules();
      await rebuildDnrIdMap();
    } catch (err) {
      console.error('[RequestPilot] Init error:', err);
    }
  }
});

// ============================================================
// Startup — re-apply rules (service worker restarts lose them)
// ============================================================

chrome.runtime.onStartup.addListener(async () => {
  await syncRules();
  await rebuildDnrIdMap();
});

// Also sync on service worker wake (covers all cases)
syncRules().then(() => rebuildDnrIdMap());

// ============================================================
// Browser action click → open options
// ============================================================

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// ============================================================
// Message handler
// ============================================================

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!message || typeof message !== 'object' || !('type' in message)) {
      return false;
    }

    const msg = message as { type: string };

    switch (msg.type) {
      case 'SYNC_RULES':
        syncRules()
          .then(() => rebuildDnrIdMap())
          .then(() => sendResponse({ ok: true }))
          .catch((e) => sendResponse({ ok: false, error: String(e) }));
        return true;

      case 'GET_STATUS': {
        storageService.getSettings().then((s) => {
          sendResponse({ enabled: s.extensionEnabled });
        });
        return true;
      }

      case 'TOGGLE_EXTENSION': {
        const payload = msg as { type: string; enabled: boolean };
        storageService.getSettings().then(async (s) => {
          await storageService.saveSettings({ ...s, extensionEnabled: payload.enabled });
          await syncRules();
          sendResponse({ ok: true });
        });
        return true;
      }

      case 'PING':
        sendResponse({ status: 'ok', version: chrome.runtime.getManifest().version });
        return false;

      case 'LOG_MOCK_HIT': {
        // Content script reports a mock/override rule fired
        const payload = msg as {
          type: string;
          ruleId: string;
          ruleName: string;
          ruleType: string;
          method: string;
          url: string;
          modificationType: string;
        };
        appendHistory({
          ruleName:         payload.ruleName,
          ruleId:           payload.ruleId,
          ruleType:         payload.ruleType as AnyRule['type'],
          method:           payload.method,
          url:              payload.url,
          modificationType: payload.modificationType,
          status:           'applied',
        });
        return false;
      }
    }

    return false;
  }
);

// ============================================================
// Keep-alive port
// ============================================================

chrome.runtime.onConnect.addListener((_port) => {
  // Holding a port keeps the service worker alive while
  // the popup or options page is open.
});
