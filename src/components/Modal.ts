import { Icons } from '../utils/icons.js';

interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
}

// ============================================================
// Modal / Confirm Dialog
// ============================================================

export function showConfirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const {
      title,
      body,
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      variant = 'danger',
    } = opts;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'modal-title');

    const btnClass = variant === 'danger' ? 'btn-danger' : 'btn-primary';
    const iconHtml = variant === 'danger'
      ? `<div class="modal-icon danger">${Icons.alertTriangle({ size: 22 })}</div>`
      : '';

    overlay.innerHTML = `
      <div class="modal" role="document">
        ${iconHtml}
        <h2 class="modal-title" id="modal-title">${title}</h2>
        <p class="modal-body">${body}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-action="cancel">${cancelLabel}</button>
          <button class="btn ${btnClass}" data-action="confirm">${confirmLabel}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Trigger animation
    requestAnimationFrame(() => overlay.classList.add('open'));

    const close = (result: boolean) => {
      overlay.classList.remove('open');
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 150);
    };

    overlay.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.action === 'confirm') close(true);
      if (target.dataset.action === 'cancel' || target === overlay) close(false);
    });

    // Keyboard handling
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', handleKey); }
      if (e.key === 'Enter') { close(true); document.removeEventListener('keydown', handleKey); }
    };
    document.addEventListener('keydown', handleKey);

    // Focus the cancel button by default for safety
    setTimeout(() => {
      const cancelBtn = overlay.querySelector('[data-action="cancel"]') as HTMLButtonElement;
      cancelBtn?.focus();
    }, 50);
  });
}
