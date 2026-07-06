import type { AnyRule, Environment, RuleType } from '../models/types.js';

// ============================================================
// UUID
// ============================================================

export function generateId(): string {
  return crypto.randomUUID();
}

// ============================================================
// Date formatting
// ============================================================

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60)  return 'just now';
  if (diffMin < 60)  return `${diffMin}m ago`;
  if (diffHr < 24)   return `${diffHr}h ago`;
  if (diffDay < 7)   return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ============================================================
// Rule helpers
// ============================================================

export function getRuleTypeLabel(type: RuleType): string {
  const map: Record<RuleType, string> = {
    header: 'Header Rule',
    redirect: 'Redirect Rule',
    queryParam: 'Query Param Rule',
    mock: 'Mock API',
    responseOverride: 'Response Override',
    cookie: 'Cookie Rule',
  };
  return map[type] || type;
}

export function getRuleTypeBadgeClass(type: RuleType): string {
  const map: Record<RuleType, string> = {
    header: 'badge-blue',
    redirect: 'badge-purple',
    queryParam: 'badge-amber',
    mock: 'badge-green',
    responseOverride: 'badge-gray',
    cookie: 'badge-red',
  };
  return map[type] || 'badge-gray';
}

export function countRulesByType(rules: AnyRule[], type: RuleType): number {
  return rules.filter((r) => r.type === type).length;
}

export function countActiveRules(rules: AnyRule[]): number {
  return rules.filter((r) => r.enabled).length;
}

// ============================================================
// Environment variable resolution
// ============================================================

export function resolveVariables(text: string, env: Environment | null): string {
  if (!env || !text) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const variable = env.variables.find((v) => v.key === key);
    return variable ? variable.value : match;
  });
}

export function findUnresolvedVariables(text: string, env: Environment | null): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g) || [];
  const keys = matches.map((m) => m.slice(2, -2));
  if (!env) return keys;
  return keys.filter((k) => !env.variables.find((v) => v.key === k));
}

// ============================================================
// Theme helpers
// ============================================================

export function applyTheme(theme: 'light' | 'dark' | 'system'): void {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

// ============================================================
// Download helper
// ============================================================

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// Debounce
// ============================================================

export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

// ============================================================
// Status code label
// ============================================================

export function statusCodeLabel(code: number): string {
  const labels: Record<number, string> = {
    200: 'OK', 201: 'Created', 204: 'No Content',
    301: 'Moved', 302: 'Found', 304: 'Not Modified',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
    404: 'Not Found', 405: 'Method Not Allowed',
    500: 'Server Error', 502: 'Bad Gateway', 503: 'Unavailable',
  };
  return labels[code] ? `${code} ${labels[code]}` : String(code);
}

export function statusCodeBadgeClass(code: number): string {
  if (code >= 200 && code < 300) return 'badge-green';
  if (code >= 300 && code < 400) return 'badge-blue';
  if (code >= 400 && code < 500) return 'badge-amber';
  if (code >= 500) return 'badge-red';
  return 'badge-gray';
}

// ============================================================
// Escape HTML
// ============================================================

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// Common HTTP headers autocomplete list
// ============================================================

export const COMMON_HEADERS = [
  'Accept', 'Accept-Encoding', 'Accept-Language', 'Authorization',
  'Cache-Control', 'Content-Type', 'Content-Length', 'Cookie',
  'Host', 'Origin', 'Referer', 'User-Agent',
  'X-Api-Key', 'X-Auth-Token', 'X-Debug-Mode', 'X-Forwarded-For',
  'X-Request-Id', 'X-Requested-With',
  'Access-Control-Allow-Origin', 'Access-Control-Allow-Headers',
  'Access-Control-Allow-Methods', 'Access-Control-Allow-Credentials',
  'Set-Cookie', 'Strict-Transport-Security', 'WWW-Authenticate',
];
