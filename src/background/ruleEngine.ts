/**
 * RuleEngine — converts RequestPilot rules into
 * chrome.declarativeNetRequest dynamic rules and manages
 * their lifecycle. Called whenever rules or settings change.
 *
 * Supported via declarativeNetRequest:
 *   - HeaderRule   (request & response headers)
 *   - RedirectRule (URL redirect)
 *   - QueryParamRule (query string manipulation via transform)
 *   - CookieRule   (Cookie request header / Set-Cookie response header)
 *
 * NOT supported by declarativeNetRequest (handled by content script):
 *   - MockApiRule         → fetch/XHR intercept in content.ts
 *   - ResponseOverrideRule → fetch/XHR intercept in content.ts
 */

import type {
  AnyRule,
  HeaderRule,
  RedirectRule,
  QueryParamRule,
  CookieRule,
  Environment,
  ResourceType,
  HttpMethod,
} from '../models/types.js';

// ============================================================
// Constants
// ============================================================

/** Base ID offset so DNR rule IDs never clash with 0. */
const DNR_ID_BASE = 1000;

/** Max dynamic rules allowed by Chrome/Edge (currently 30 000). */
const MAX_DYNAMIC_RULES = 30000;

// ============================================================
// Helpers
// ============================================================

/**
 * Resolve {{VAR}} placeholders using the active environment.
 */
function resolve(text: string, env: Environment | null): string {
  if (!env || !text) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    const v = env.variables.find((x) => x.key === key);
    return v ? v.value : `{{${key}}}`;
  });
}

/**
 * Convert our ResourceType array to the DNR ResourceType array.
 * '*' expands to all known resource types.
 */
function toDnrResourceTypes(
  types: ResourceType[]
): chrome.declarativeNetRequest.ResourceType[] {
  const all = [
    'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
    'font', 'object', 'xmlhttprequest', 'ping', 'csp_report',
    'media', 'websocket', 'other',
  ] as chrome.declarativeNetRequest.ResourceType[];
  if (types.includes('*') || types.length === 0) return all;
  return types
    .filter((t) => t !== '*')
    .map((t) => t as chrome.declarativeNetRequest.ResourceType);
}

/**
 * Convert our pattern (glob or regex) to a DNR UrlFilter / regexFilter.
 * Returns an object to spread into the DNR condition.
 */
function toUrlFilter(
  pattern: string,
  isRegex: boolean
): { urlFilter?: string; regexFilter?: string } {
  if (!pattern || pattern === '*') return {};
  if (isRegex) return { regexFilter: pattern };

  // Convert simple glob (* wildcard) to DNR urlFilter syntax.
  // DNR urlFilter: | anchors, * wildcard — already compatible with
  // common patterns like "https://api.example.com/*"
  return { urlFilter: pattern };
}

/**
 * Convert our HttpMethod list to DNR request methods.
 * '*' means no restriction (omit the field).
 */
function toRequestMethods(
  methods: HttpMethod[]
): chrome.declarativeNetRequest.RequestMethod[] | undefined {
  if (methods.includes('*') || methods.length === 0) return undefined;
  return methods
    .filter((m) => m !== '*')
    .map((m) => m.toLowerCase() as chrome.declarativeNetRequest.RequestMethod);
}

/**
 * Stable numeric ID for a rule string ID.
 * Hashes the string into a positive integer in [DNR_ID_BASE, MAX_DYNAMIC_RULES).
 */
function stableId(ruleId: string, subIndex = 0): number {
  let hash = 0;
  for (let i = 0; i < ruleId.length; i++) {
    hash = (Math.imul(31, hash) + ruleId.charCodeAt(i)) | 0;
  }
  const base = (Math.abs(hash) % (MAX_DYNAMIC_RULES - DNR_ID_BASE - 100)) + DNR_ID_BASE;
  return base + subIndex;
}

// ============================================================
// Converters — one per rule type
// ============================================================

function headerRuleToDnr(
  rule: HeaderRule,
  env: Environment | null
): chrome.declarativeNetRequest.Rule[] {
  const requestHeaders: chrome.declarativeNetRequest.ModifyHeaderInfo[] = [];
  const responseHeaders: chrome.declarativeNetRequest.ModifyHeaderInfo[] = [];

  for (const op of rule.headers) {
    const value = resolve(op.value, env);
    const entry: chrome.declarativeNetRequest.ModifyHeaderInfo = {
      header: op.name,
      operation: op.operation as chrome.declarativeNetRequest.HeaderOperation,
      ...(op.operation !== 'remove' ? { value } : {}),
    };
    if (rule.target === 'request') {
      requestHeaders.push(entry);
    } else {
      responseHeaders.push(entry);
    }
  }

  if (requestHeaders.length === 0 && responseHeaders.length === 0) return [];

  const condition: chrome.declarativeNetRequest.RuleCondition = {
    ...toUrlFilter(resolve(rule.urlMatcher.pattern, env), rule.urlMatcher.isRegex),
    resourceTypes: toDnrResourceTypes(rule.urlMatcher.resourceTypes),
    ...(toRequestMethods(rule.urlMatcher.httpMethods)
      ? { requestMethods: toRequestMethods(rule.urlMatcher.httpMethods) }
      : {}),
  };

  const action: chrome.declarativeNetRequest.RuleAction = {
    type: 'modifyHeaders',
    ...(requestHeaders.length ? { requestHeaders } : {}),
    ...(responseHeaders.length ? { responseHeaders } : {}),
  };

  return [{
    id: stableId(rule.id),
    priority: rule.priority,
    condition,
    action,
  }];
}

function redirectRuleToDnr(
  rule: RedirectRule,
  env: Environment | null
): chrome.declarativeNetRequest.Rule[] {
  const redirectUrl = resolve(rule.redirectUrl, env);
  if (!redirectUrl) return [];

  const condition: chrome.declarativeNetRequest.RuleCondition = {
    ...toUrlFilter(resolve(rule.urlMatcher.pattern, env), rule.urlMatcher.isRegex),
    resourceTypes: toDnrResourceTypes(rule.urlMatcher.resourceTypes),
    ...(toRequestMethods(rule.urlMatcher.httpMethods)
      ? { requestMethods: toRequestMethods(rule.urlMatcher.httpMethods) }
      : {}),
  };

  // If the redirect URL contains a wildcard or regex group reference,
  // use regexSubstitution; otherwise use a plain redirect.
  const hasBackref = redirectUrl.includes('\\1') || redirectUrl.includes('$1');
  const action: chrome.declarativeNetRequest.RuleAction = hasBackref
    ? { type: 'redirect', redirect: { regexSubstitution: redirectUrl } }
    : { type: 'redirect', redirect: { url: redirectUrl } };

  return [{
    id: stableId(rule.id),
    priority: rule.priority,
    condition,
    action,
  }];
}

function queryParamRuleToDnr(
  rule: QueryParamRule,
  env: Environment | null
): chrome.declarativeNetRequest.Rule[] {
  // Build the queryTransform object
  const addOrReplaceParams: chrome.declarativeNetRequest.QueryKeyValue[] = [];
  const removeParams: string[] = [];

  for (const op of rule.params) {
    const key = resolve(op.key, env);
    const value = resolve(op.value, env);
    if (!key) continue;
    if (op.operation === 'remove') {
      removeParams.push(key);
    } else {
      // 'set' and 'append' both map to addOrReplaceParams in DNR
      addOrReplaceParams.push({ key, value });
    }
  }

  if (addOrReplaceParams.length === 0 && removeParams.length === 0) return [];

  const condition: chrome.declarativeNetRequest.RuleCondition = {
    ...toUrlFilter(resolve(rule.urlMatcher.pattern, env), rule.urlMatcher.isRegex),
    resourceTypes: toDnrResourceTypes(rule.urlMatcher.resourceTypes),
    ...(toRequestMethods(rule.urlMatcher.httpMethods)
      ? { requestMethods: toRequestMethods(rule.urlMatcher.httpMethods) }
      : {}),
  };

  const action: chrome.declarativeNetRequest.RuleAction = {
    type: 'redirect',
    redirect: {
      transform: {
        queryTransform: {
          ...(addOrReplaceParams.length ? { addOrReplaceParams } : {}),
          ...(removeParams.length ? { removeParams } : {}),
        },
      },
    },
  };

  return [{
    id: stableId(rule.id),
    priority: rule.priority,
    condition,
    action,
  }];
}

function cookieRuleToDnr(
  rule: CookieRule,
  env: Environment | null
): chrome.declarativeNetRequest.Rule[] {
  // Cookie rules map to modifyHeaders on the Cookie (request) header.
  // Each set/remove operation is a separate header modification entry.
  const requestHeaders: chrome.declarativeNetRequest.ModifyHeaderInfo[] = [];

  for (const op of rule.cookies) {
    const name = resolve(op.name, env);
    const value = resolve(op.value, env);
    if (!name) continue;

    if (op.operation === 'set') {
      // Append to Cookie header: "name=value"
      requestHeaders.push({
        header: 'Cookie',
        operation: 'append',
        value: `${name}=${value}`,
      });
    } else if (op.operation === 'remove') {
      // We can't surgically remove a single cookie from the Cookie header
      // via DNR — we remove the entire Cookie header and rely on the user
      // knowing what they're doing, or use a content script approach.
      // Best effort: append an empty override so it's documented.
      // Real removal requires content script interception.
      requestHeaders.push({
        header: 'Cookie',
        operation: 'remove',
      });
    }
  }

  if (requestHeaders.length === 0) return [];

  const condition: chrome.declarativeNetRequest.RuleCondition = {
    ...toUrlFilter(resolve(rule.urlMatcher.pattern, env), rule.urlMatcher.isRegex),
    resourceTypes: toDnrResourceTypes(rule.urlMatcher.resourceTypes),
    ...(toRequestMethods(rule.urlMatcher.httpMethods)
      ? { requestMethods: toRequestMethods(rule.urlMatcher.httpMethods) }
      : {}),
  };

  return [{
    id: stableId(rule.id),
    priority: rule.priority,
    condition,
    action: { type: 'modifyHeaders', requestHeaders },
  }];
}

// ============================================================
// Public API
// ============================================================

/**
 * Convert all enabled RequestPilot rules into DNR rules.
 * MockApiRule and ResponseOverrideRule are excluded — handled by content script.
 */
export function buildDnrRules(
  rules: AnyRule[],
  env: Environment | null
): chrome.declarativeNetRequest.Rule[] {
  const dnrRules: chrome.declarativeNetRequest.Rule[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    switch (rule.type) {
      case 'header':
        dnrRules.push(...headerRuleToDnr(rule, env));
        break;
      case 'redirect':
        dnrRules.push(...redirectRuleToDnr(rule, env));
        break;
      case 'queryParam':
        dnrRules.push(...queryParamRuleToDnr(rule, env));
        break;
      case 'cookie':
        dnrRules.push(...cookieRuleToDnr(rule, env));
        break;
      // mock and responseOverride handled by content script
    }
  }

  return dnrRules;
}

/**
 * Apply the current rule set to chrome.declarativeNetRequest.
 * Removes all existing dynamic rules first, then adds the new set.
 */
export async function applyDnrRules(
  rules: AnyRule[],
  env: Environment | null,
  extensionEnabled: boolean
): Promise<{ applied: number; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Remove all existing dynamic rules
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const removeIds = existing.map((r) => r.id);

    if (!extensionEnabled) {
      // Extension is paused — just clear all rules
      if (removeIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds });
      }
      return { applied: 0, errors: [] };
    }

    const dnrRules = buildDnrRules(rules, env);

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: removeIds,
      addRules: dnrRules,
    });

    console.log(`[RequestPilot] Applied ${dnrRules.length} DNR rules`);
    return { applied: dnrRules.length, errors };
  } catch (err) {
    const msg = String(err);
    errors.push(msg);
    console.error('[RequestPilot] DNR apply error:', msg);
    return { applied: 0, errors };
  }
}
