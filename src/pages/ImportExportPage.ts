import type { ExportSchema } from '../models/types.js';
import { Icons } from '../utils/icons.js';
import { downloadJson } from '../utils/helpers.js';
import { showConfirm } from '../components/Modal.js';
import { toast } from '../components/Toast.js';
import { asExportSchema, validateExportSchema } from '../validation/schema.js';

interface ImportExportOptions {
  onExport: () => Promise<ExportSchema>;
  onImport: (data: ExportSchema, mode: 'merge' | 'replace') => Promise<void>;
}

export function renderImportExportPage(opts: ImportExportOptions): HTMLElement {
  const el = document.createElement('div');
  el.className = 'fade-in';

  el.innerHTML = `
    <div class="transfer-grid">
      <!-- Export Card -->
      <div class="card">
        <div class="card-header">
          <div>
            <div style="font-weight:var(--font-semibold);display:flex;align-items:center;gap:var(--space-2)">${Icons.download({ size: 16 })} Export Rules</div>
            <div style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-top:2px">Download your configuration as JSON</div>
          </div>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:var(--space-3)">
          <p style="font-size:var(--text-sm);color:var(--color-text-secondary)">
            Export all rules and environment definitions to a JSON file for backup or sharing.
          </p>
          <p style="font-size:var(--text-xs);color:var(--color-warning)">
            Secret environment values are included. Review the JSON before sharing it.
          </p>
          <div style="background:var(--color-bg);border-radius:var(--radius-md);padding:var(--space-3);font-size:var(--text-xs);font-family:var(--font-mono);color:var(--color-text-secondary)">
            { version, exportedAt, rules[], environments[] }
          </div>
        </div>
        <div class="card-footer">
          <button class="btn btn-primary" id="btn-export-all">${Icons.download({ size: 14 })} Export All Rules</button>
        </div>
      </div>

      <!-- Import Card -->
      <div class="card">
        <div class="card-header">
          <div>
            <div style="font-weight:var(--font-semibold);display:flex;align-items:center;gap:var(--space-2)">${Icons.upload({ size: 16 })} Import Rules</div>
            <div style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-top:2px">Load rules from a JSON file</div>
          </div>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:var(--space-3)">
          <p style="font-size:var(--text-sm);color:var(--color-text-secondary)">
            Import rules and environments from a previously exported JSON file.
          </p>
          <div id="import-preview" style="display:none;background:var(--color-bg);border-radius:var(--radius-md);padding:var(--space-3)">
            <!-- Preview shown after file selection -->
          </div>
        </div>
        <div class="card-footer" style="flex-direction:column;align-items:stretch;gap:var(--space-3)">
          <input type="file" id="import-file-input" accept=".json" style="display:none"/>
          <button class="btn btn-secondary" id="btn-pick-file">${Icons.upload({ size: 14 })} Choose JSON File</button>
          <div id="import-actions" style="display:none;gap:var(--space-2);display:none">
            <button class="btn btn-secondary" id="btn-import-merge" style="flex:1">${Icons.plus({ size: 14 })} Merge</button>
            <button class="btn btn-primary" id="btn-import-replace" style="flex:1">${Icons.refreshCw({ size: 14 })} Replace</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Keyboard Shortcuts quick ref -->
    <div class="card" style="max-width:800px;margin-top:var(--space-6)">
      <div class="card-header">
        <span style="font-weight:var(--font-semibold);display:flex;align-items:center;gap:var(--space-2)">${Icons.command({ size: 16 })} Keyboard Shortcuts</span>
      </div>
      <div class="card-body">
        <table class="table">
          <thead><tr><th>Action</th><th>Shortcut</th></tr></thead>
          <tbody>
            <tr><td>Open Command Palette</td><td><kbd style="font-family:var(--font-mono);background:var(--color-bg);border:1px solid var(--color-border);border-radius:4px;padding:2px 8px">Ctrl+K</kbd></td></tr>
            <tr><td>New Rule</td><td><kbd style="font-family:var(--font-mono);background:var(--color-bg);border:1px solid var(--color-border);border-radius:4px;padding:2px 8px">Ctrl+N</kbd></td></tr>
            <tr><td>Save Rule (in editor)</td><td><kbd style="font-family:var(--font-mono);background:var(--color-bg);border:1px solid var(--color-border);border-radius:4px;padding:2px 8px">Ctrl+S</kbd></td></tr>
            <tr><td>Close Drawer / Modal</td><td><kbd style="font-family:var(--font-mono);background:var(--color-bg);border:1px solid var(--color-border);border-radius:4px;padding:2px 8px">Escape</kbd></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  let pendingImport: ExportSchema | null = null;

  el.querySelector('#btn-export-all')?.addEventListener('click', async () => {
    const btn = el.querySelector('#btn-export-all') as HTMLButtonElement;
    btn.innerHTML = `<span class="spinner"></span> Exporting…`;
    btn.disabled = true;
    const data = await opts.onExport();
    downloadJson(data, `requestpilot-export-${new Date().toISOString().slice(0, 10)}.json`);
    toast.success('Export complete', `${data.rules.length} rules exported`);
    btn.innerHTML = `${Icons.download({ size: 14 })} Export All Rules`;
    btn.disabled = false;
  });

  el.querySelector('#btn-pick-file')?.addEventListener('click', () => {
    (el.querySelector('#import-file-input') as HTMLInputElement).click();
  });

  (el.querySelector('#import-file-input') as HTMLInputElement)?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Import file is too large', 'Maximum supported size is 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string) as unknown;
        const validation = validateExportSchema(raw);
        if (!validation.valid) {
          toast.error('Invalid import file', validation.errors[0]);
          return;
        }
        const data = asExportSchema(raw);
        pendingImport = data;
        const preview = el.querySelector('#import-preview') as HTMLElement;
        preview.style.display = 'block';
        preview.innerHTML = `
          <div style="font-size:var(--text-sm)">
            <div style="font-weight:var(--font-semibold);margin-bottom:var(--space-2)">${Icons.checkCircle({ size: 14 })} File ready to import</div>
            <div style="color:var(--color-text-secondary)">
              ${Icons.package({ size: 13 })} ${data.rules.length} rules<br/>
              ${Icons.environment({ size: 13 })} ${data.environments?.length ?? 0} environments<br/>
              Exported: ${data.exportedAt ? new Date(data.exportedAt).toLocaleDateString() : 'unknown'}
            </div>
          </div>`;
        const actions = el.querySelector('#import-actions') as HTMLElement;
        actions.style.display = 'flex';
      } catch {
        toast.error('Invalid import file format', 'Could not parse the JSON file.');
      }
    };
    reader.readAsText(file);
  });

  const doImport = async (mode: 'merge' | 'replace') => {
    if (!pendingImport) return;
    const confirmed = await showConfirm({
      title: mode === 'replace' ? 'Replace All Rules' : 'Merge Rules',
      body: mode === 'replace'
        ? 'This will replace ALL existing rules with the imported ones. This cannot be undone.'
        : `This will add ${pendingImport.rules.length} new rules alongside your existing ones (duplicates by ID will be skipped).`,
      confirmLabel: mode === 'replace' ? 'Replace All' : 'Merge',
      variant: mode === 'replace' ? 'danger' : 'primary',
    });
    if (!confirmed) return;
    try {
      await opts.onImport(pendingImport, mode);
      toast.success('Import successful', `${pendingImport.rules.length} rules imported`);
      pendingImport = null;
      const preview = el.querySelector('#import-preview') as HTMLElement;
      preview.style.display = 'none';
      (el.querySelector('#import-actions') as HTMLElement).style.display = 'none';
      (el.querySelector('#import-file-input') as HTMLInputElement).value = '';
    } catch (error) {
      toast.error('Import failed', String(error));
    }
  };

  el.querySelector('#btn-import-merge')?.addEventListener('click', () => doImport('merge'));
  el.querySelector('#btn-import-replace')?.addEventListener('click', () => doImport('replace'));

  return el;
}
