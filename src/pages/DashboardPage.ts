import type { AnyRule, HistoryEntry } from '../models/types.js';
import { Icons } from '../utils/icons.js';
import { countActiveRules, countRulesByType, escapeHtml, formatRelativeTime, getRuleTypeBadgeClass, getRuleTypeLabel } from '../utils/helpers.js';
// Note: countRulesByType used for mock/redirect counts below

export function renderDashboard(
  rules: AnyRule[],
  history: HistoryEntry[],
  onNavigate: (page: string, createNew?: boolean) => void
): HTMLElement {
  const el = document.createElement('div');
  el.className = 'fade-in';

  const activeCount = countActiveRules(rules);
  const mockCount = countRulesByType(rules, 'mock');
  const redirectCount = countRulesByType(rules, 'redirect');
  const modifiedToday = history.filter((h) => {
    const d = new Date(h.timestamp);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const mostUsed = [...rules]
    .filter((r) => (r.usageCount ?? 0) > 0)
    .sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0))
    .slice(0, 5);

  const recentActivity = [...history].slice(0, 10);

  el.innerHTML = `
    <!-- Stats -->
    <div class="stats-grid">
      ${statCard(Icons.package({ size: 22 }), String(rules.length), 'Total Rules', '#dbeafe', '#2563eb')}
      ${statCard(Icons.zap({ size: 22 }), String(activeCount), 'Active Rules', '#dcfce7', '#16a34a')}
      ${statCard(Icons.activity({ size: 22 }), String(modifiedToday), 'Modified Today', '#fef3c7', '#d97706')}
      ${statCard(Icons.mock({ size: 22 }), String(mockCount), 'Mock APIs', '#ede9fe', '#7c3aed')}
      ${statCard(Icons.redirect({ size: 22 }), String(redirectCount), 'Redirects', '#fee2e2', '#dc2626')}
    </div>

    <div class="dashboard-two-column">
      <!-- Quick Actions -->
      <div class="card">
        <div class="card-header">
          <span style="font-weight:var(--font-semibold)">${Icons.zap({ size: 16 })} Quick Actions</span>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:var(--space-2)">
          <button class="btn btn-secondary" style="justify-content:flex-start" data-nav="header-rules" data-create-new="true">
            ${Icons.plus({ size: 14 })} Add Header Rule
          </button>
          <button class="btn btn-secondary" style="justify-content:flex-start" data-nav="redirect-rules" data-create-new="true">
            ${Icons.plus({ size: 14 })} Add Redirect Rule
          </button>
          <button class="btn btn-secondary" style="justify-content:flex-start" data-nav="mock-api" data-create-new="true">
            ${Icons.plus({ size: 14 })} Add Mock API
          </button>
          <button class="btn btn-secondary" style="justify-content:flex-start" data-nav="import-export">
            ${Icons.upload({ size: 14 })} Import Rules
          </button>
        </div>
      </div>

      <!-- Most Used Rules -->
      <div class="card">
        <div class="card-header">
          <span style="font-weight:var(--font-semibold)">${Icons.activity({ size: 16 })} Most Used Rules</span>
        </div>
        <div class="card-body" style="padding:0">
          ${mostUsed.length ? mostUsed.map((r) => `
            <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-5);border-bottom:1px solid var(--color-border)">
              <span class="badge ${getRuleTypeBadgeClass(r.type)}">${getRuleTypeLabel(r.type)}</span>
              <span style="flex:1;font-size:var(--text-sm);font-weight:var(--font-medium);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.name)}</span>
              <span style="font-size:var(--text-xs);color:var(--color-text-tertiary)">${r.usageCount ?? 0}x</span>
            </div>
          `).join('') : `<div style="padding:var(--space-5);color:var(--color-text-tertiary);font-size:var(--text-sm)">No usage data yet</div>`}
        </div>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="card">
      <div class="card-header">
        <span style="font-weight:var(--font-semibold)">${Icons.history({ size: 16 })} Recent Activity</span>
        <button class="btn btn-ghost btn-sm" data-nav="history">View All</button>
      </div>
      <div class="card-body" style="padding:0">
        ${recentActivity.length ? recentActivity.map((h) => `
          <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-5);border-bottom:1px solid var(--color-border)">
            <span class="badge ${h.status === 'applied' ? 'badge-green' : 'badge-red'}" style="min-width:64px;justify-content:center">
              ${h.status === 'applied' ? Icons.check({ size: 10 }) : Icons.close({ size: 10 })}
              ${h.status}
            </span>
            <span style="font-size:var(--text-xs);color:var(--color-text-tertiary);white-space:nowrap">${escapeHtml(h.method)}</span>
            <span style="flex:1;font-size:var(--text-sm);font-family:var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--color-text-secondary)">${escapeHtml(h.url)}</span>
            <span style="font-size:var(--text-sm);color:var(--color-text-primary);white-space:nowrap">${escapeHtml(h.ruleName)}</span>
            <span style="font-size:var(--text-xs);color:var(--color-text-tertiary);white-space:nowrap">${formatRelativeTime(h.timestamp)}</span>
          </div>
        `).join('') : `
          <div class="empty-state" style="padding:var(--space-10)">
            ${Icons.activity({ size: 32 })}
            <p style="color:var(--color-text-secondary);font-size:var(--text-sm)">No modifications recorded yet</p>
          </div>`}
      </div>
    </div>

    ${rules.length === 0 ? `
      <div class="empty-state" style="margin-top:var(--space-8)">
        <div class="empty-state-icon">${Icons.package({ size: 32 })}</div>
        <h3 class="empty-state-title">No Rules Yet</h3>
        <p class="empty-state-desc">Get started by creating your first rule to modify HTTP requests and responses.</p>
        <button class="btn btn-primary" data-nav="header-rules">${Icons.plus({ size: 16 })} Add Your First Rule</button>
      </div>` : ''}
  `;

  el.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => onNavigate(
      (btn as HTMLElement).dataset.nav!,
      (btn as HTMLElement).dataset.createNew === 'true'
    ));
  });

  return el;
}

function statCard(icon: string, value: string, label: string, iconBg: string, iconColor: string): string {
  return `
    <div class="stat-card">
      <div class="stat-card-icon" style="background:${iconBg};color:${iconColor}">${icon}</div>
      <div class="stat-card-info">
        <div class="stat-card-value">${value}</div>
        <div class="stat-card-label">${label}</div>
      </div>
    </div>`;
}

// Alias for Icons used inline
const mock = Icons.mock ?? Icons.dashboard;
Object.assign(Icons, { mock: mock ?? Icons.dashboard });
