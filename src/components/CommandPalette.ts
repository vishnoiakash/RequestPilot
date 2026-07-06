import { Icons } from '../utils/icons.js';

interface Command {
  id: string;
  label: string;
  icon: string;
  kbd?: string;
  action: () => void;
}

export class CommandPalette {
  private overlay: HTMLElement;
  private commands: Command[] = [];
  private filtered: Command[] = [];
  private focusedIdx = 0;
  private isOpen = false;

  constructor() {
    this.overlay = this.buildOverlay();
    document.body.appendChild(this.overlay);
    this.attachGlobalShortcut();
  }

  setCommands(commands: Command[]): void {
    this.commands = commands;
    this.filtered = commands;
  }

  private buildOverlay(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'command-palette-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Command palette');

    el.innerHTML = `
      <div class="command-palette" role="document">
        <div class="command-palette-input-wrap">
          <span style="color:var(--color-text-tertiary)">${Icons.command({ size: 16 })}</span>
          <input class="command-palette-input" type="text" placeholder="Search commands…" id="cmd-input" autocomplete="off" role="combobox" aria-expanded="true"/>
          <kbd style="font-size:var(--text-xs);color:var(--color-text-tertiary);background:var(--color-bg);border:1px solid var(--color-border);border-radius:4px;padding:2px 6px;font-family:var(--font-mono)">Esc</kbd>
        </div>
        <div class="command-list" id="cmd-list" role="listbox"></div>
      </div>
    `;

    el.addEventListener('click', (e) => {
      if (e.target === el) this.close();
    });

    const input = el.querySelector('#cmd-input') as HTMLInputElement;
    input.addEventListener('input', () => this.filter(input.value));
    input.addEventListener('keydown', (e) => this.handleKey(e));

    return el;
  }

  private filter(query: string): void {
    const q = query.toLowerCase().trim();
    this.filtered = q ? this.commands.filter((c) => c.label.toLowerCase().includes(q)) : this.commands;
    this.focusedIdx = 0;
    this.renderList();
  }

  private renderList(): void {
    const list = this.overlay.querySelector('#cmd-list') as HTMLElement;
    if (!this.filtered.length) {
      list.innerHTML = `<div style="padding:var(--space-4);text-align:center;color:var(--color-text-tertiary);font-size:var(--text-sm)">No commands found</div>`;
      return;
    }
    list.innerHTML = this.filtered.map((c, i) => `
      <div class="command-item ${i === this.focusedIdx ? 'focused' : ''}" data-cmd-idx="${i}" role="option" aria-selected="${i === this.focusedIdx}">
        <span class="command-item-icon">${c.icon}</span>
        <span class="command-item-label">${c.label}</span>
        ${c.kbd ? `<kbd class="command-item-kbd">${c.kbd}</kbd>` : ''}
      </div>
    `).join('');

    list.querySelectorAll('.command-item').forEach((item) => {
      item.addEventListener('click', () => {
        const idx = parseInt((item as HTMLElement).dataset.cmdIdx ?? '0');
        this.executeCommand(idx);
      });
    });
  }

  private handleKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.focusedIdx = Math.min(this.focusedIdx + 1, this.filtered.length - 1);
      this.renderList();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.focusedIdx = Math.max(this.focusedIdx - 1, 0);
      this.renderList();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.executeCommand(this.focusedIdx);
    } else if (e.key === 'Escape') {
      this.close();
    }
  }

  private executeCommand(idx: number): void {
    const cmd = this.filtered[idx];
    if (cmd) {
      this.close();
      cmd.action();
    }
  }

  open(): void {
    this.filtered = this.commands;
    this.focusedIdx = 0;
    this.renderList();
    this.overlay.classList.add('open');
    this.isOpen = true;
    const input = this.overlay.querySelector('#cmd-input') as HTMLInputElement;
    input.value = '';
    setTimeout(() => input.focus(), 50);
  }

  close(): void {
    this.overlay.classList.remove('open');
    this.isOpen = false;
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  private attachGlobalShortcut(): void {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.toggle();
      }
    });
  }
}
