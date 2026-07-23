import type { HistoryEntry } from '../models/types.js';
import { Icons } from '../utils/icons.js';
import { formatDateTime, escapeHtml, getRuleTypeBadgeClass, getRuleTypeLabel, debounce } from '../utils/helpers.js';
import { showConfirm } from '../components/Modal.js';
import { toast } from '../components/Toast.js';

interface HistoryPageOptions {
  history: HistoryEntry[];
  onClear: () => Promise<void>;
}

export function renderHistoryPage(opts: HistoryPageOptions): HTMLElement {
  const el = document.createElement('div');
  el.className = 'fade-in';
  let entries = [...opts.history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const render = () => {
    el.innerHTML = buildHtml(entries);
    attachEvents();
  };

  const attachEvents = () => {
    const searchInput = el.querySelector('#history-search') as HTMLInputElement;
    searchInput?.addEventListener('input', debounce(() => {
      const q = searchInput.value.toLowerCase();
      const filtered = q
        ? entries.filter((h) => h.url.toLowerCase().includes(q) || h.ruleName.toLowerCase().includes(q))
        : entries;
      const list = el.querySelector('#history-list');
      if (list) list.innerHTML = filtered.length ? renderEntries(filtered) : renderEmpty(true);
    }, 200) as EventListener);

    el.querySelector('#btn-clear-history')?.addEventListener('click', async () => {
      const ok = await showConfirm({ title: 'Clear History', body: 'This will remove all history entries. This cannot be undone.', confirmLabel: 'Clear All', variant: 'danger' });
      if (!ok) return;
      entries = [];
      await opts.onClear();
      toast.success('History cleared');
      render();
    });
  };

  render();
  return el;
}

function buildHtml(entries: HistoryEntry[]): string {
  return `
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="input-with-icon" style="max-width:340px;flex:1">
          <span class="input-icon">${Icons.search({ size: 15 })}</span>
          <input class="input" type="search" id="history-search" placeholder="Search by URL or rule name…"/>
        </div>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-secondary btn-sm" id="btn-clear-history" style="color:var(--color-error)">
          ${Icons.trash({ size: 14 })} Clear History
        </button>
      </div>
    </div>
    <div id="history-list">${entries.length ? renderEntries(entries) : renderEmpty(false)}</div>
  `;
}

function renderEntries(entries: HistoryEntry[]): string {
  return `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Status</th>
            <th>Method</th>
            <th>URL</th>
            <th>Rule</th>
            <th>Type</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map((h) => `
            <tr>
              <td style="white-space:nowrap;color:var(--color-text-secondary);font-size:var(--text-xs)">${formatDateTime(h.timestamp)}</td>
              <td>
                <span class="badge ${h.status === 'applied' ? 'badge-green' : 'badge-red'}">
                  ${h.status === 'applied' ? Icons.check({ size: 10 }) : Icons.close({ size: 10 })}
                  ${escapeHtml(h.status)}
                </span>
              </td>
              <td>
                <span class="badge badge-gray" style="font-family:var(--font-mono);font-size:10px">${escapeHtml(h.method)}</span>
              </td>
              <td style="max-width:300px">
                <div style="font-family:var(--font-mono);font-size:var(--text-xs);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--color-text-secondary)" title="${escapeHtml(h.url)}">${escapeHtml(h.url)}</div>
                ${h.errorMessage ? `<div style="font-size:var(--text-xs);color:var(--color-error);margin-top:2px">${escapeHtml(h.errorMessage)}</div>` : ''}
              </td>
              <td style="font-weight:var(--font-medium);white-space:nowrap">${escapeHtml(h.ruleName)}</td>
              <td><span class="badge ${getRuleTypeBadgeClass(h.ruleType)}">${getRuleTypeLabel(h.ruleType)}</span></td>
              <td style="font-size:var(--text-xs);color:var(--color-text-secondary)">${escapeHtml(h.modificationType)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderEmpty(isSearch: boolean): string {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${Icons.history({ size: 28 })}</div>
      <h3 class="empty-state-title">${isSearch ? 'No matching entries' : 'No History Yet'}</h3>
      <p class="empty-state-desc">${isSearch ? 'Try adjusting your search.' : 'No modifications recorded yet. Enable some rules to start tracking activity.'}</p>
    </div>`;
}
