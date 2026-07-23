# Microsoft Edge Add-ons submission copy

Use this document as the source of truth when completing the RequestPilot listing in Partner Center.

## Availability

- Visibility: **Hidden** for team-only distribution, or **Public** for a searchable public listing.
- Markets: Select the markets where your team or intended users are located.
- Category: **Developer tools** (or the closest developer/productivity category offered).

## Store listing — English (United States)

### Extension name

RequestPilot

### Short description

Create and manage HTTP header, redirect, query, cookie, API mock, and response rules.

### Full description

RequestPilot is a network request and API testing tool for developers, QA engineers, and support teams. Create rules that modify request or response headers, redirect matching URLs, set or remove query parameters, inject or remove cookies, return mock API responses, and override response bodies without changing application code.

Organize rules with groups and tags, select HTTP methods and resource types, set priorities, and test URL matchers before enabling a rule. Environment variables make it easy to reuse rules across development, staging, and production configurations. Rule sets can be imported or exported as JSON for team collaboration.

RequestPilot also provides an optional local history of matched rules, configurable sensitive-query redaction, usage counts, automatic configuration backups, light and dark themes, keyboard navigation, and a command palette.

All rule processing happens in Microsoft Edge. RequestPilot has no analytics, advertising, telemetry, remote backend, or remotely hosted executable code. Configuration and history remain in browser extension storage unless the user explicitly exports a JSON file. Users should review environment variables before sharing exported configurations.

### Search terms

- HTTP headers
- request modifier
- API testing
- mock API
- response override
- developer tools
- QA testing

## Privacy page

### Single-purpose description

RequestPilot helps developers and testers create, manage, and apply user-defined HTTP request and response rules for API testing and debugging.

### Permission justifications

`storage`

Stores user-created rules, environments, settings, local rule-match history, usage counts, and recoverable configuration backups.

`declarativeNetRequestWithHostAccess`

Applies enabled user-created header, redirect, query-parameter, and cookie rules through Microsoft Edge's Manifest V3 declarative network API.

`webRequest`

Observes request URL, method, and resource type to record local rule-match history. It does not block requests or transmit browsing data.

`<all_urls>` host access

Users can create testing rules for arbitrary development, staging, local, or production endpoints. Broad host access is needed for those user-selected targets and for page-level fetch/XMLHttpRequest mocking.

### Remote code

Select **No, I am not using remote code**. All executable JavaScript is included in the submitted package.

### Data usage

Disclose request URLs/browsing activity and user-provided configuration or authentication values if those categories are presented by Partner Center. State that the data is processed only to provide extension functionality, is not sold or transferred to the developer or third parties, and remains in browser extension storage. Browser-synchronized settings may be synchronized by the user's browser account provider.

### Privacy policy

Host `PRIVACY.md` on a publicly accessible HTTPS page and paste that URL into Partner Center. Replace the support-contact placeholder before publishing.

## Properties

- Website: Use the RequestPilot project or product webpage.
- Support contact: Use a maintained support email address or public issue/support page.
- Mature content: No.
- Analytics/telemetry: None.
- Advertising: None.
- Paid features: None.

## Notes for certification

RequestPilot does not require an account, credentials, payment, or external service owned by the publisher.

Suggested verification:

1. Open RequestPilot Options and create an enabled Request Header rule.
2. Use URL pattern `https://httpbin.org/anything*`, method `GET`, resource `Fetch / XHR`, and set `X-RequestPilot-Test` to `enabled`.
3. Make a GET request to `https://httpbin.org/anything` from a normal webpage. The returned request headers should include `X-RequestPilot-Test: enabled`.
4. Create a Mock API rule for `https://example.com/requestpilot-test`, select `Fetch / XHR`, status `200`, and body `{"source":"RequestPilot"}`.
5. A page-level fetch to that URL should receive the configured body without making the real network request.
6. The History page shows locally matched rules. History can be disabled and cleared in Settings.
7. No remote code, analytics, advertising, telemetry, or publisher backend is used.

Additional rule types and complete usage guidance are available on the extension's **How to Use** page.

## Store assets

- Logo: `store-assets/requestpilot-logo-300.png` — 300 × 300
- Small promotional tile: `store-assets/requestpilot-small-tile-440x280.png` — 440 × 280
- Large promotional tile: `store-assets/requestpilot-large-tile-1400x560.png` — 1400 × 560
- Screenshots: optional, but capture 3–5 real screenshots at 1280 × 800 after loading the packaged extension in Edge.

Recommended screenshots:

1. Dashboard with rule statistics and recent activity.
2. Rule editor showing matcher, method, resource, group, and tag controls.
3. Rules page with multiple rule types.
4. Environment editor with secret values masked.
5. History page with sensitive query values redacted.
