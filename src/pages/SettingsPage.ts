import type { Settings, Environment } from '../models/types.js';
import { Icons } from '../utils/icons.js';
import { applyTheme } from '../utils/helpers.js';
import { showConfirm } from '../components/Modal.js';
import { toast } from '../components/Toast.js';

interface SettingsPageOptions {
  settings: Settings;
  environments: Environment[];
  version: string;
  onSave: (settings: Settings) => void;
  onReset: () => void;
}

export function renderSettingsPage(opts: SettingsPageOptions): HTMLElement {
  const el = document.createElement('div');
  el.className = 'fade-in';
  const s = { ...opts.settings };

  el.innerHTML = `
    <div style="max-width:640px;display:flex;flex-direction:column;gap:var(--space-6)">
      <!-- Appearance -->
      <div class="card">
        <div class="card-header">
          <span style="font-weight:var(--font-semibold);display:flex;align-items:center;gap:var(--space-2)">${Icons.sun({ size: 16 })} Appearance</span>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:var(--space-5)">
          <div class="input-group">
            <label class="input-label">Theme</label>
            <div style="display:flex;gap:var(--space-3)">
              ${['light', 'dark', 'system'].map((t) => `
                <label style="flex:1;cursor:pointer">
                  <input type="radio" name="theme" value="${t}" ${s.theme === t ? 'checked' : ''} style="display:none"/>
                  <div class="theme-option ${s.theme === t ? 'selected' : ''}" data-theme-val="${t}" style="border:2px solid ${s.theme === t ? 'var(--color-primary)' : 'var(--color-border)'};border-radius:var(--radius-md);padding:var(--space-4);text-align:center;transition:all var(--duration-base)">
                    <div style="margin-bottom:var(--space-2)">
                      ${t === 'light' ? Icons.sun({ size: 20 }) : t === 'dark' ? Icons.moon({ size: 20 }) : Icons.monitor({ size: 20 })}
                    </div>
                    <div style="font-size:var(--text-sm);font-weight:var(--font-medium);text-transform:capitalize">${t}</div>
                  </div>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- Behavior -->
      <div class="card">
        <div class="card-header">
          <span style="font-weight:var(--font-semibold);display:flex;align-items:center;gap:var(--space-2)">${Icons.settings({ size: 16 })} Behavior</span>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:var(--space-5)">
          <div class="input-group">
            <label class="input-label" for="default-env">Default Environment</label>
            <select id="default-env" class="select">
              <option value="">None</option>
              ${opts.environments.map((e) => `<option value="${e.id}" ${s.defaultEnvironmentId === e.id ? 'selected' : ''}>${e.name}</option>`).join('')}
            </select>
            <span class="input-hint">The environment activated on extension startup.</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-3) 0">
            <div>
              <div style="font-size:var(--text-sm);font-weight:var(--font-medium)">Auto Backup</div>
              <div style="font-size:var(--text-xs);color:var(--color-text-secondary)">Save a snapshot to local storage on every rule save</div>
            </div>
            <label class="toggle">
              <input type="checkbox" id="auto-backup" ${s.autoBackup ? 'checked' : ''}/>
              <div class="toggle-track"></div>
              <div class="toggle-thumb"></div>
            </label>
          </div>
        </div>
        <div class="card-footer">
          <button class="btn btn-primary" id="btn-save-settings">${Icons.save({ size: 14 })} Save Settings</button>
        </div>
      </div>

      <!-- Keyboard Shortcuts -->
      <div class="card">
        <div class="card-header">
          <span style="font-weight:var(--font-semibold);display:flex;align-items:center;gap:var(--space-2)">${Icons.command({ size: 16 })} Keyboard Shortcuts</span>
        </div>
        <div class="card-body" style="padding:0">
          <table class="table">
            <tbody>
              ${[
                ['Open Command Palette', 'Ctrl+K'],
                ['New Rule (current page)', 'Ctrl+N'],
                ['Save Rule (in editor)', 'Ctrl+S'],
                ['Close Drawer / Modal', 'Escape'],
                ['Navigate fields', 'Tab'],
              ].map(([action, key]) => `
                <tr>
                  <td style="font-size:var(--text-sm)">${action}</td>
                  <td><kbd style="font-family:var(--font-mono);background:var(--color-bg);border:1px solid var(--color-border);border-radius:4px;padding:2px 8px;font-size:var(--text-xs)">${key}</kbd></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- About -->
      <div class="card">
        <div class="card-header">
          <span style="font-weight:var(--font-semibold);display:flex;align-items:center;gap:var(--space-2)">${Icons.info({ size: 16 })} About</span>
        </div>
        <div class="card-body" style="display:flex;align-items:center;gap:var(--space-5)">
          <div style="width:56px;height:56px;border-radius:var(--radius-lg);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
            <img src="../../assets/logo/request_pilot_logo.png" alt="RequestPilot" width="56" height="56" style="object-fit:contain;" />
          </div>
          <div>
            <div style="font-size:var(--text-xl);font-weight:var(--font-bold)">RequestPilot</div>
            <div style="font-size:var(--text-sm);color:var(--color-text-secondary)">Version ${opts.version}</div>
            <div style="font-size:var(--text-sm);color:var(--color-text-secondary)">Microsoft Edge Manifest V3 Extension</div>
          </div>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="card" style="border-color:var(--color-error)">
        <div class="card-header">
          <span style="font-weight:var(--font-semibold);color:var(--color-error);display:flex;align-items:center;gap:var(--space-2)">${Icons.alertTriangle({ size: 16 })} Danger Zone</span>
        </div>
        <div class="card-body" style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-4)">
          <div>
            <div style="font-size:var(--text-sm);font-weight:var(--font-medium)">Reset to Defaults</div>
            <div style="font-size:var(--text-xs);color:var(--color-text-secondary)">Clears all rules, environments, history and settings.</div>
          </div>
          <button class="btn btn-danger btn-sm" id="btn-reset">${Icons.refreshCw({ size: 14 })} Reset</button>
        </div>
      </div>
    </div>
  `;

  // Theme selection
  el.querySelectorAll('[name="theme"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const val = (radio as HTMLInputElement).value as 'light' | 'dark' | 'system';
      s.theme = val;
      applyTheme(val);
      el.querySelectorAll('.theme-option').forEach((opt) => {
        const isSelected = (opt as HTMLElement).dataset.themeVal === val;
        (opt as HTMLElement).style.borderColor = isSelected ? 'var(--color-primary)' : 'var(--color-border)';
      });
    });
  });

  (el.querySelector('#default-env') as HTMLSelectElement)?.addEventListener('change', (e) => {
    s.defaultEnvironmentId = (e.target as HTMLSelectElement).value || null;
  });

  (el.querySelector('#auto-backup') as HTMLInputElement)?.addEventListener('change', (e) => {
    s.autoBackup = (e.target as HTMLInputElement).checked;
  });

  el.querySelector('#btn-save-settings')?.addEventListener('click', () => {
    opts.onSave(s);
    toast.success('Settings saved');
  });

  el.querySelector('#btn-reset')?.addEventListener('click', async () => {
    const ok = await showConfirm({
      title: 'Reset to Defaults',
      body: 'This will permanently delete ALL rules, environments, history and settings. This cannot be undone.',
      confirmLabel: 'Reset Everything',
      variant: 'danger',
    });
    if (ok) {
      opts.onReset();
      toast.info('Resetting…', 'The page will reload with sample data.');
      setTimeout(() => window.location.reload(), 1500);
    }
  });

  return el;
}
