# Store Submission Checklist

Paste-ready listing, privacy, permission, and certification text is available in
`EDGE_STORE_LISTING.md`. Store artwork is generated in `store-assets/`.

## Before packaging

1. Run `npm ci`.
2. Run `npm run package`.
3. Run `powershell -ExecutionPolicy Bypass -File scripts/generate-store-assets.ps1`.
4. Load the generated ZIP's extracted contents as an unpacked extension and complete the manual checks below.
5. Capture real 1280 × 800 screenshots listed in `EDGE_STORE_LISTING.md`.
6. Host `PRIVACY.md` at a public HTTPS URL and use that URL in the store privacy field.
7. Replace the support-contact placeholder in the privacy policy with the final support channel.

## Manual functional checks

- Create request and response header rules and verify them against a controlled endpoint.
- Verify Set and Remove query-parameter rules.
- Verify plain and regular-expression redirects, including `\1` capture substitution.
- Verify fetch and XHR mocks for text, JSON, blob, array-buffer, delay, timeout, abort, and response headers.
- Verify response overrides are visible inside application `readystatechange` and `load` handlers.
- Toggle the whole extension and switch environments from the popup.
- Confirm default-environment activation after restarting the browser.
- Confirm history, redaction, retention, usage counts, clear history, auto-backup, and restore.
- Import valid configuration and confirm malformed/duplicate configuration is rejected.
- Test light, dark, and system themes, keyboard navigation, `Ctrl+K`, `Ctrl+N`, `Ctrl+S`, and Escape.
- Check layouts at 1280 px, 768 px, and 480 px widths.

## Store disclosures

- Purpose: developer/team request modification and API mocking.
- Remote code: none.
- Analytics/telemetry: none.
- Data sale or third-party sharing: none.
- Host access rationale: users can create rules for arbitrary development endpoints.
- `webRequest` rationale: read-only local match history in packaged builds.

## Release artifact

`npm run package` produces `release/requestpilot-v<version>.zip`. The package contains only the manifest, compiled JavaScript/HTML/CSS, icons, and logo; source maps, declarations, tests, and source files are excluded.
