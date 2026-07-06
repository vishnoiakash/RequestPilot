# RequestPilot

A Microsoft Edge (Chromium) browser extension for intercepting and modifying HTTP requests and responses in real time — built with TypeScript and Manifest V3.

![RequestPilot](assets/logo/request_pilot_logo.png)

---

## Features

- **Header Rules** — Add, modify, or remove request and response headers
- **URL Redirect** — Redirect matching requests to a different URL
- **Query Parameters** — Add, modify, or remove URL query parameters
- **Mock API** — Intercept requests and return synthetic responses (no server needed)
- **Response Override** — Replace response bodies with custom content
- **Cookie Rules** — Inject or remove cookies on matching requests
- **Environments** — Define variable sets (`{{BASE_URL}}`, `{{AUTH_TOKEN}}`) and switch between Development / Staging / Production in one click
- **History** — Live log of every request modification
- **Import / Export** — Share rule sets as JSON files
- **Light & Dark theme** — Follows system preference or manually selectable
- **Command Palette** — `Ctrl+K` for instant navigation

---

## Installation (Developer / Unpacked)

> The extension is not yet published to the Edge Add-ons store. Load it manually:

1. Clone the repository
   ```bash
   git clone https://github.com/vishnoiakash/RequestPilot.git
   cd RequestPilot
   ```

2. Install dependencies and build
   ```bash
   npm install
   npm run build
   ```

3. Load in Microsoft Edge
   - Open `edge://extensions/`
   - Enable **Developer mode** (toggle, top-right)
   - Click **Load unpacked**
   - Select the `RequestPilot` folder (the root — where `manifest.json` lives)

4. Click the RequestPilot icon in the toolbar to open the popup, or right-click → **Options** for the full UI

---

## Development

```bash
# One-time build
npm run build

# Watch mode (recompiles TypeScript on save)
npm run watch
```

After any change, go to `edge://extensions/` and click the **reload** icon on the RequestPilot card.

### Project Structure

```
RequestPilot/
├── src/
│   ├── background/        # Service worker + DNR rule engine + history manager
│   ├── content/           # fetch/XHR interceptor for Mock API & Response Override
│   ├── options/           # Full-page options UI (HTML + app bootstrap)
│   ├── popup/             # Toolbar popup
│   ├── pages/             # One file per UI page
│   ├── components/        # Reusable UI components (Drawer, Toast, Modal, etc.)
│   ├── models/            # TypeScript interfaces and type definitions
│   ├── storage/           # chrome.storage abstraction layer
│   ├── utils/             # Helpers, icons, theme
│   └── assets/css/        # Design system CSS (light + dark theme)
├── assets/
│   ├── icons/             # Extension icons (PNG, all sizes)
│   └── logo/              # Source logo
├── scripts/
│   └── copy-assets.js     # Post-build asset copy script
├── dist/                  # Compiled output (generated — do not edit)
├── manifest.json
├── package.json
└── tsconfig.json
```

---

## How It Works

### Header / Redirect / Query Param / Cookie Rules
These use the browser's native [`declarativeNetRequest`](https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/) API. Rules are compiled and applied as dynamic DNR rules every time you save or toggle a rule. No page reload required — changes take effect on the next matching request.

### Mock API & Response Override
These run via a content script (`interceptor.js`) injected at `document_start` in the page's `MAIN` world. It wraps `window.fetch` and `window.XMLHttpRequest` before any page scripts run, intercepting matching requests and returning synthetic responses.

### Environment Variables
Use `{{KEY}}` placeholders in any rule field. The active environment's variables are resolved before rules are applied. Switch environments from the popup or the Environments page.

---

## Permissions Used

| Permission | Why |
|---|---|
| `storage` | Persist rules, settings, environments, history |
| `declarativeNetRequest` | Modify headers, redirect URLs, transform query params |
| `declarativeNetRequestFeedback` | Log which rules fired (History page) |
| `declarativeNetRequestWithHostAccess` | Apply dynamic rules to all URLs |
| `tabs` | Notify content scripts when rules change |
| `scripting` | Reserved for future programmatic injection |
| `<all_urls>` host permission | Intercept requests on any website |

---

## Tech Stack

- **TypeScript** — strict mode, ES2020 target
- **Manifest V3** — service worker background, declarativeNetRequest
- **Zero runtime dependencies** — no frameworks, no bundler
- **Lucide-style inline SVG icons**
- **CSS custom properties** — full light/dark design system

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and build: `npm run build`
4. Commit: `git commit -m "feat: add my feature"`
5. Push: `git push origin feature/my-feature`
6. Open a Pull Request

---

## License

MIT — see [LICENSE](LICENSE)
