(() => {
  interface MainRule {
    id: string;
    type: 'mock' | 'responseOverride';
    name: string;
    enabled: boolean;
    priority: number;
    urlMatcher: {
      pattern: string;
      isRegex: boolean;
      resourceTypes: string[];
      httpMethods: string[];
    };
    statusCode?: number;
    responseBody?: string;
    responseHeaders?: Array<{ name: string; value: string; operation: string }>;
    delay?: number;
    body?: string;
  }

  interface MainConfig {
    extensionEnabled: boolean;
    rules: MainRule[];
  }

  let config: MainConfig = { extensionEnabled: true, rules: [] };
  let channel = '';

  function absoluteUrl(url: string): string {
    try {
      return new URL(url, location.href).href;
    } catch {
      return url;
    }
  }

  function matches(rule: MainRule, url: string, method: string): boolean {
    const methods = rule.urlMatcher.httpMethods;
    if (methods.length && !methods.includes('*') && !methods.includes(method.toUpperCase())) {
      return false;
    }
    const resources = rule.urlMatcher.resourceTypes;
    if (resources.length && !resources.includes('*') && !resources.includes('xmlhttprequest')) {
      return false;
    }
    const pattern = rule.urlMatcher.pattern;
    if (!pattern || pattern === '*') return true;
    try {
      if (rule.urlMatcher.isRegex) return new RegExp(pattern).test(url);
      const escaped = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      return new RegExp(`^${escaped}$`).test(url);
    } catch {
      return false;
    }
  }

  function firstMatchingAny(url: string, method: string): MainRule | undefined {
    return config.rules.find((rule) => matches(rule, url, method));
  }

  function responseHeaders(rule: MainRule): Headers {
    const headers = new Headers();
    for (const operation of rule.responseHeaders ?? []) {
      if (operation.operation === 'remove') headers.delete(operation.name);
      else if (operation.operation === 'append') headers.append(operation.name, operation.value);
      else headers.set(operation.name, operation.value);
    }
    if (!headers.has('content-type')) {
      try {
        JSON.parse(rule.responseBody ?? '');
        headers.set('content-type', 'application/json');
      } catch {
        headers.set('content-type', 'text/plain;charset=UTF-8');
      }
    }
    return headers;
  }

  function reportHit(rule: MainRule, method: string, url: string): void {
    if (!channel) return;
    window.postMessage({
      source: 'requestpilot-main',
      type: 'RULE_HIT',
      channel,
      payload: {
        ruleId: rule.id,
        method,
        url,
        modificationType: rule.type === 'mock' ? 'Mock Response' : 'Response Override',
      },
    }, '*');
  }

  function responseBodyForStatus(body: string, status: number): BodyInit | null {
    return status === 204 || status === 205 || status === 304 ? null : body;
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function requestPilotFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    if (!config.extensionEnabled) return nativeFetch(input, init);
    const rawUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
    const url = absoluteUrl(rawUrl);
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    const matchedRule = firstMatchingAny(url, method);
    if (matchedRule?.type === 'mock') {
      const mock = matchedRule;
      const wait = Math.max(0, mock.delay ?? 0);
      if (wait) await new Promise<void>((resolve) => setTimeout(resolve, wait));
      const status = mock.statusCode ?? 200;
      const response = new Response(
        responseBodyForStatus(mock.responseBody ?? '', status),
        { status, headers: responseHeaders(mock) }
      );
      try {
        Object.defineProperty(response, 'url', { value: url });
      } catch { /* Browser-owned fields may be non-configurable. */ }
      reportHit(mock, method, url);
      return response;
    }

    if (matchedRule?.type !== 'responseOverride') return nativeFetch(input, init);
    const override = matchedRule;
    const original = await nativeFetch(input, init);
    const status = override.statusCode ?? original.status;
    if (status < 200 || status > 599) return original;
    const overriddenHeaders = new Headers(original.headers);
    overriddenHeaders.delete('content-length');
    overriddenHeaders.delete('content-encoding');
    overriddenHeaders.delete('etag');
    const response = new Response(
      responseBodyForStatus(override.body ?? '', status),
      {
        status,
        statusText: override.statusCode ? '' : original.statusText,
        headers: overriddenHeaders,
      }
    );
    for (const property of ['url', 'redirected', 'type'] as const) {
      try {
        Object.defineProperty(response, property, { value: original[property] });
      } catch { /* Browser-owned fields may be non-configurable. */ }
    }
    reportHit(override, method, url);
    return response;
  };

  const NativeXHR = window.XMLHttpRequest;

  class RequestPilotXHR extends NativeXHR {
    private requestUrl = '';
    private requestMethod = 'GET';
    private mockRule: MainRule | null = null;
    private overrideRule: MainRule | null = null;
    private mockTimer: ReturnType<typeof setTimeout> | null = null;
    private mockHeaders = new Headers();
    private mockReadyState = 1;
    private mockComplete = false;
    private overrideApplied = false;

    constructor() {
      super();
      // Registered before page code can attach handlers, so overridden data is
      // available to application readystatechange/load listeners.
      this.addEventListener('readystatechange', () => {
        if (this.overrideRule && !this.overrideApplied && super.readyState === 4) {
          this.applyOverride(this.overrideRule);
        }
      });
    }

    open(method: string, url: string | URL, ...rest: unknown[]): void {
      this.requestMethod = method.toUpperCase();
      this.requestUrl = absoluteUrl(url instanceof URL ? url.href : String(url));
      // TypeScript's DOM overloads cannot represent forwarding this variadic call.
      // @ts-expect-error Forward the browser-supported async/user/password arguments.
      super.open(method, url, ...rest);
    }

    send(body?: Document | XMLHttpRequestBodyInit | null): void {
      if (!config.extensionEnabled) {
        super.send(body);
        return;
      }
      const matchedRule = firstMatchingAny(this.requestUrl, this.requestMethod);
      if (matchedRule?.type === 'mock') {
        this.mockRule = matchedRule;
        this.serveMock(matchedRule);
        return;
      }
      this.overrideRule = matchedRule?.type === 'responseOverride' ? matchedRule : null;
      super.send(body);
    }

    abort(): void {
      if (!this.mockRule || this.mockComplete) {
        super.abort();
        return;
      }
      if (this.mockTimer) clearTimeout(this.mockTimer);
      this.mockComplete = true;
      this.mockReadyState = 0;
      Object.defineProperty(this, 'readyState', {
        configurable: true,
        get: () => this.mockReadyState,
      });
      this.dispatchEvent(new ProgressEvent('abort'));
      this.dispatchEvent(new ProgressEvent('loadend'));
    }

    getResponseHeader(name: string): string | null {
      return this.mockRule ? this.mockHeaders.get(name) : super.getResponseHeader(name);
    }

    getAllResponseHeaders(): string {
      if (!this.mockRule) return super.getAllResponseHeaders();
      return Array.from(this.mockHeaders.entries())
        .map(([name, value]) => `${name}: ${value}\r\n`)
        .join('');
    }

    private typedResponse(text: string): unknown {
      if (this.responseType === 'json') {
        try { return JSON.parse(text); } catch { return null; }
      }
      if (this.responseType === 'blob') {
        return new Blob([text], { type: this.mockHeaders.get('content-type') ?? 'text/plain' });
      }
      if (this.responseType === 'arraybuffer') return new TextEncoder().encode(text).buffer;
      if (this.responseType === 'document') return new DOMParser().parseFromString(text, 'text/html');
      return text;
    }

    private defineResponse(
      text: string,
      status: number,
      statusText: string,
      responseUrl: string
    ): void {
      const typed = this.typedResponse(text);
      Object.defineProperties(this, {
        status: { configurable: true, get: () => status },
        statusText: { configurable: true, get: () => statusText },
        response: { configurable: true, get: () => typed },
        responseURL: { configurable: true, get: () => responseUrl },
      });
      if (!this.responseType || this.responseType === 'text') {
        Object.defineProperty(this, 'responseText', {
          configurable: true,
          get: () => text,
        });
      }
    }

    private transition(state: number): void {
      this.mockReadyState = state;
      Object.defineProperty(this, 'readyState', {
        configurable: true,
        get: () => this.mockReadyState,
      });
      this.dispatchEvent(new ProgressEvent('readystatechange'));
    }

    private serveMock(rule: MainRule): void {
      this.mockHeaders = responseHeaders(rule);
      const delay = Math.max(0, rule.delay ?? 0);
      const timeoutMs = this.timeout > 0 ? this.timeout : 0;
      const willTimeout = timeoutMs > 0 && delay > timeoutMs;
      this.mockTimer = setTimeout(() => {
        if (this.mockComplete) return;
        if (willTimeout) {
          this.mockComplete = true;
          this.transition(4);
          this.dispatchEvent(new ProgressEvent('timeout'));
          this.dispatchEvent(new ProgressEvent('loadend'));
          return;
        }
        const text = rule.responseBody ?? '';
        const status = rule.statusCode ?? 200;
        this.transition(2);
        this.transition(3);
        this.defineResponse(text, status, status === 200 ? 'OK' : '', this.requestUrl);
        this.transition(4);
        this.mockComplete = true;
        this.dispatchEvent(new ProgressEvent('load', {
          loaded: text.length,
          total: text.length,
          lengthComputable: true,
        }));
        this.dispatchEvent(new ProgressEvent('loadend'));
        reportHit(rule, this.requestMethod, this.requestUrl);
      }, willTimeout ? timeoutMs : delay);
    }

    private applyOverride(rule: MainRule): void {
      this.overrideApplied = true;
      const originalStatus = super.status;
      const text = rule.body ?? '';
      const status = rule.statusCode ?? originalStatus;
      this.defineResponse(text, status, rule.statusCode ? '' : super.statusText, super.responseURL);
      reportHit(rule, this.requestMethod, this.requestUrl);
    }
  }

  window.XMLHttpRequest = RequestPilotXHR;

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data as Record<string, unknown> | null;
    if (
      !data ||
      data.source !== 'requestpilot-isolated' ||
      data.type !== 'CONFIG' ||
      typeof data.channel !== 'string' ||
      typeof data.payload !== 'object' ||
      data.payload === null
    ) {
      return;
    }
    if (channel && data.channel !== channel) return;
    const payload = data.payload as Partial<MainConfig>;
    if (typeof payload.extensionEnabled !== 'boolean' || !Array.isArray(payload.rules)) return;
    channel = data.channel;
    config = {
      extensionEnabled: payload.extensionEnabled,
      rules: payload.rules,
    };
  });
})();
