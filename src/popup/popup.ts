import { storageService } from '../storage/StorageService.js';
import { applyTheme } from '../utils/helpers.js';

// ============================================================
// Popup Bootstrap
// ============================================================

async function init(): Promise<void> {
  try {
    const [rules, environments, settings] = await Promise.all([
      storageService.getRules(),
      storageService.getEnvironments(),
      storageService.getSettings(),
    ]);

    // Apply theme
    applyTheme(settings.theme);

    // Version
    try {
      const manifest = chrome.runtime.getManifest();
      const versionEl = document.getElementById('popup-version');
      if (versionEl) versionEl.textContent = `v${manifest.version}`;
    } catch { /* non-extension context */ }

    // Master toggle
    const masterToggle = document.getElementById('master-toggle') as HTMLInputElement;
    const masterStatus = document.getElementById('master-status');
    masterToggle.checked = settings.extensionEnabled;
    if (masterStatus) {
      masterStatus.textContent = settings.extensionEnabled
        ? 'All rules are running'
        : 'Extension is paused';
    }

    masterToggle.addEventListener('change', async () => {
      const enabled = masterToggle.checked;
      masterToggle.disabled = true;
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'TOGGLE_EXTENSION',
          enabled,
        }) as { ok?: boolean; errors?: string[] };
        if (!response?.ok) throw new Error(response?.errors?.join(' ') || 'Rule sync failed.');
        settings.extensionEnabled = enabled;
        if (masterStatus) {
          masterStatus.textContent = enabled ? 'All rules are running' : 'Extension is paused';
        }
      } catch (error) {
        masterToggle.checked = !enabled;
        if (masterStatus) masterStatus.textContent = `Could not update: ${String(error)}`;
      } finally {
        masterToggle.disabled = false;
      }
    });

    // Environment selector
    const envSelect = document.getElementById('env-select') as HTMLSelectElement;
    const activeEnvId = environments.find((e) => e.isActive)?.id ?? '';
    envSelect.replaceChildren();
    if (environments.length) {
      environments.forEach((environment) => {
        const option = new Option(environment.name, environment.id);
        option.selected = environment.id === activeEnvId;
        envSelect.add(option);
      });
    } else {
      envSelect.add(new Option('No environments', ''));
    }

    envSelect.addEventListener('change', async () => {
      if (envSelect.value) {
        await storageService.setActiveEnvironment(envSelect.value);
      }
    });

    // Rule counts (active only)
    const activeRules = rules.filter((r) => r.enabled);
    const headerCount  = activeRules.filter((r) => r.type === 'header').length;
    const redirectCount = activeRules.filter((r) => r.type === 'redirect').length;
    const mockCount    = activeRules.filter((r) => r.type === 'mock').length;

    const setCount = (id: string, val: number) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };
    setCount('count-headers', headerCount);
    setCount('count-redirects', redirectCount);
    setCount('count-mocks', mockCount);

    // Open settings button
    document.getElementById('btn-open-settings')?.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
      window.close();
    });
  } catch (err) {
    console.error('RequestPilot popup error:', err);
  }
}

init();
