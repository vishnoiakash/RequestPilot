import { Icons } from '../utils/icons.js';
import { escapeHtml } from '../utils/helpers.js';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  title: string;
  message?: string;
  variant?: ToastVariant;
  duration?: number;
}

// ============================================================
// Toast Manager
// ============================================================

class ToastManager {
  private container: HTMLElement;

  constructor() {
    this.container = this.createContainer();
  }

  private createContainer(): HTMLElement {
    const existing = document.getElementById('toast-container');
    if (existing) return existing;

    const el = document.createElement('div');
    el.id = 'toast-container';
    el.className = 'toast-container';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(el);
    return el;
  }

  show(opts: ToastOptions): void {
    const { title, message, variant = 'info', duration = 4000 } = opts;

    const toast = document.createElement('div');
    toast.className = `toast toast-${variant}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-atomic', 'true');

    const iconMap: Record<ToastVariant, string> = {
      success: Icons.checkCircle({ size: 18 }),
      error:   Icons.xCircle({ size: 18 }),
      warning: Icons.alertTriangle({ size: 18 }),
      info:    Icons.info({ size: 18 }),
    };

    toast.innerHTML = `
      <span class="toast-icon">${iconMap[variant]}</span>
      <div class="toast-content">
        <div class="toast-title">${escapeHtml(title)}</div>
        ${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="Dismiss notification">
        ${Icons.close({ size: 14 })}
      </button>
    `;

    const closeBtn = toast.querySelector('.toast-close') as HTMLButtonElement;
    const dismiss = () => this.dismiss(toast);
    closeBtn.addEventListener('click', dismiss);

    this.container.appendChild(toast);

    if (duration > 0) {
      setTimeout(dismiss, duration);
    }
  }

  private dismiss(toast: HTMLElement): void {
    if (toast.classList.contains('dismissing')) return;
    toast.classList.add('dismissing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    // Fallback
    setTimeout(() => toast.remove(), 400);
  }

  success(title: string, message?: string): void {
    this.show({ title, message, variant: 'success' });
  }

  error(title: string, message?: string): void {
    this.show({ title, message, variant: 'error' });
  }

  warning(title: string, message?: string): void {
    this.show({ title, message, variant: 'warning' });
  }

  info(title: string, message?: string): void {
    this.show({ title, message, variant: 'info' });
  }
}

export const toast = new ToastManager();
