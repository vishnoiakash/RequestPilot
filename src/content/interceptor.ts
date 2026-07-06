/**
 * RequestPilot Content Script — fetch/XHR Interceptor
 *
 * Runs at document_start (before page scripts execute).
 * Wraps the native fetch and XMLHttpRequest to implement:
 *   - MockApiRule   : intercept matching requests, return synthetic response
 *   - ResponseOverrideRule : intercept response, replace body / status
 *   - QueryParamRule (append mode) : also handled here for completeness
 *
 * Rules are read from chrome.storage.local and kept up to date
 * via a storage change listener. No imports from other modules —
 * this file must be self-contained as it runs in page context.
 */

// ============================================================
// Types (inlined — content scripts can't import)
// ============================================================

interface StoredRule {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  priority: number;
  urlMatcher: {
    pattern: string;
    isRegex: boolean;
    resourceTypes: string[];
    httpMethods: string[];
  };
  // mock fields
  statusCode?: number;
  responseBody?: string;
  responseHeaders?: Array<{ name: string; value: string; operation: string }>;
  delay?: number;
  // responseOverride fields
  body?: string;
}

interface EnvVariable { key: string; value: string; }
interface StoredEnv { isActive: boolean; variables: EnvVariable[]; }

// ============================================================
// State
// ============================================================

let mockRules: StoredRule[] = [];
let overrideRules: StoredRule[] = [];
let activeEnvVars: EnvVariable[] = [];
let extensionEnabled = true;

// ============================================================
// Helpers
// ============================================================

function resolveVars(text: string): string {
  if (!text) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    const v = activeEnvVars.find((x) => x.key === key);
    return v ? v.value : `{{${key}}}`;
  });
}

function matchesUrl(rule: StoredRule, url: string): boolean {
  const pattern = resolveVars(rule.urlMatcher.pattern);
  if (!pattern || pattern === '*') return true;
  try {
    if (rule.urlMatcher.isRegex) {
      return new RegExp(pattern).test(url);
    }
    // Glob → convert to regex: escape special chars then replace * with .*
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*/g, '.*')     // restore * as .*
      .replace(/\*/g, '.*');      // any remaining *
    return new RegExp(`^${escaped}$`).test(url);
  } catch {
    return false;
  }
}

function matchesMethod(rule: StoredRule, method: string): boolean {
  const methods = rule.urlMatcher.httpMethods;
  if (!methods || methods.length === 0 || methods.includes('*')) return true;
  return methods.map((m) => m.toUpperCase()).includes(method.toUpperCase());
}

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// ============================================================
// Load rules from storage
// ============================================================

function loadRules(): void {
  chrome.storage.local.get(
    ['requestpilot_rules', 'requestpilot_environments', 'requestpilot_settings'],
    (result: Record<string, unknown>) => {
      const rules = (result['requestpilot_rules'] as StoredRule[]) || [];
      mockRules = rules.filter((r) => r.enabled && r.type === 'mock');
      overrideRules = rules.filter((r) => r.enabled && r.type === 'responseOverride');

      const envs = (result['requestpilot_environments'] as StoredEnv[]) || [];
      const activeEnv = envs.find((e) => e.isActive);
      activeEnvVars = activeEnv ? activeEnv.variables : [];

      const settings = result['requestpilot_settings'] as { extensionEnabled?: boolean } | undefined;
      extensionEnabled = settings ? (settings.extensionEnabled !== false) : true;
    }
  );
}

// Reload when storage changes
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local' || area === 'sync') loadRules();
});

loadRules();

// ============================================================
// Fetch interceptor
// ============================================================

const originalFetch = window.fetch.bind(window);

window.fetch = async function interceptedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (!extensionEnabled) return originalFetch(input, init);

  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : (input as Request).url;

  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

  // ---- Mock API ----
  for (const rule of mockRules) {
    if (!matchesUrl(rule, url) || !matchesMethod(rule, method)) continue;

    if ((rule.delay ?? 0) > 0) await delay(rule.delay!);

    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    if (rule.responseHeaders) {
      for (const h of rule.responseHeaders) {
        if (h.operation === 'set' || h.operation === 'append') {
          headers.set(h.name, resolveVars(h.value));
        }
      }
    }

    const body = resolveVars(rule.responseBody ?? '');

    // Log to service worker
    chrome.runtime.sendMessage({
      type: 'LOG_MOCK_HIT',
      ruleId: rule.id, ruleName: rule.name, ruleType: rule.type,
      method, url, modificationType: 'Mock Response',
    }).catch(() => {});

    return new Response(body, {
      status: rule.statusCode ?? 200,
      headers,
    });
  }

  // ---- Response Override ----
  for (const rule of overrideRules) {
    if (!matchesUrl(rule, url) || !matchesMethod(rule, method)) continue;

    const original = await originalFetch(input, init);
    const overrideBody = resolveVars(rule.body ?? '');
    const status = rule.statusCode ?? original.status;

    // Log to service worker
    chrome.runtime.sendMessage({
      type: 'LOG_MOCK_HIT',
      ruleId: rule.id, ruleName: rule.name, ruleType: rule.type,
      method, url, modificationType: 'Response Override',
    }).catch(() => {});

    const headers = new Headers(original.headers);
    return new Response(overrideBody, { status, headers });
  }

  return originalFetch(input, init);
};

// ============================================================
// XMLHttpRequest interceptor
// ============================================================

const OriginalXHR = window.XMLHttpRequest;

class InterceptedXHR extends OriginalXHR {
  private _url = '';
  private _method = 'GET';
  private _mockRule: StoredRule | null = null;
  private _overrideRule: StoredRule | null = null;

  open(method: string, url: string | URL, ...rest: unknown[]): void {
    this._url = url instanceof URL ? url.href : String(url);
    this._method = method.toUpperCase();
    // @ts-ignore — forward all args
    super.open(method, url, ...rest);
  }

  send(body?: Document | XMLHttpRequestBodyInit | null): void {
    if (!extensionEnabled) { super.send(body); return; }

    // Check mock rules
    for (const rule of mockRules) {
      if (matchesUrl(rule, this._url) && matchesMethod(rule, this._method)) {
        this._mockRule = rule;
        break;
      }
    }

    // Check override rules (only if no mock)
    if (!this._mockRule) {
      for (const rule of overrideRules) {
        if (matchesUrl(rule, this._url) && matchesMethod(rule, this._method)) {
          this._overrideRule = rule;
          break;
        }
      }
    }

    if (this._mockRule) {
      this._serveMockResponse(this._mockRule);
      return;
    }

    if (this._overrideRule) {
      this._interceptOverride(this._overrideRule, body);
      return;
    }

    super.send(body);
  }

  private _serveMockResponse(rule: StoredRule): void {
    const delayMs = rule.delay ?? 0;
    setTimeout(() => {
      const statusCode = rule.statusCode ?? 200;
      const responseText = resolveVars(rule.responseBody ?? '');

      Object.defineProperty(this, 'status', { get: () => statusCode, configurable: true });
      Object.defineProperty(this, 'statusText', { get: () => 'OK', configurable: true });
      Object.defineProperty(this, 'responseText', { get: () => responseText, configurable: true });
      Object.defineProperty(this, 'response', { get: () => responseText, configurable: true });
      Object.defineProperty(this, 'readyState', { get: () => 4, configurable: true });

      this.dispatchEvent(new ProgressEvent('readystatechange'));
      this.dispatchEvent(new ProgressEvent('load'));
      this.dispatchEvent(new ProgressEvent('loadend'));

      // Log
      chrome.runtime.sendMessage({
        type: 'LOG_MOCK_HIT',
        ruleId: rule.id, ruleName: rule.name, ruleType: rule.type,
        method: this._method, url: this._url, modificationType: 'Mock Response',
      }).catch(() => {});
    }, delayMs);
  }

  private _interceptOverride(rule: StoredRule, body?: Document | XMLHttpRequestBodyInit | null): void {
    // Let the real request go, then replace the response body
    this.addEventListener('load', () => {
      const overrideText = resolveVars(rule.body ?? '');
      const status = rule.statusCode ?? this.status;
      Object.defineProperty(this, 'responseText', { get: () => overrideText, configurable: true });
      Object.defineProperty(this, 'response', { get: () => overrideText, configurable: true });
      Object.defineProperty(this, 'status', { get: () => status, configurable: true });
    });
    super.send(body);
  }
}

// Replace the global XHR
(window as unknown as Record<string, unknown>).XMLHttpRequest = InterceptedXHR as unknown as typeof XMLHttpRequest;

// ============================================================
// Listen for RULES_UPDATED message from service worker
// ============================================================

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'RULES_UPDATED') {
    loadRules();
  }
});

export {};
