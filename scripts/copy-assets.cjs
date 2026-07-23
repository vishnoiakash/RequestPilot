/**
 * Post-build asset copy script.
 * Copies static assets (CSS, HTML, icons) from src/ to dist/
 * after TypeScript compilation. Kept as CommonJS because the project output is ESM.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC  = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

// ============================================================
// Utilities
// ============================================================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

// ============================================================
// Copy Tasks
// ============================================================

// 1. CSS design system
copyDir(
  path.join(SRC, 'assets', 'css'),
  path.join(DIST, 'assets', 'css')
);
console.log('✓ CSS copied');

// 2. Options HTML
copyFile(
  path.join(SRC, 'options', 'options.html'),
  path.join(DIST, 'options', 'options.html')
);
console.log('✓ options.html copied');

// 3. Popup HTML
copyFile(
  path.join(SRC, 'popup', 'popup.html'),
  path.join(DIST, 'popup', 'popup.html')
);
console.log('✓ popup.html copied');

// Root-level icons and logo are referenced directly by the manifest and HTML.
// Remove legacy duplicate copies so release packages remain small.
for (const duplicateDir of [
  path.join(DIST, 'assets', 'icons'),
  path.join(DIST, 'assets', 'logo'),
]) {
  if (fs.existsSync(duplicateDir)) fs.rmSync(duplicateDir, { recursive: true, force: true });
}
console.log('✓ Duplicate image assets cleaned');

console.log('\n✅ RequestPilot build assets ready');
