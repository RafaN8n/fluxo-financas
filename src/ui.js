import { escapeHtml } from './utils.js';

const PATHS = {
  dashboard: '<rect x="3" y="3" width="7.5" height="9" rx="2"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="12" width="7.5" height="9" rx="2"/><rect x="3" y="15.5" width="7.5" height="5.5" rx="2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  tag: '<path d="M20.6 13.4 12 22l-9-9V4h9l8.6 8.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h9M17 18h3"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  external: '<path d="M14 3h7v7M21 3l-9 9"/><path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
  check: '<path d="m20 6-11 11-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
  wallet: '<path d="M20 7H6a2 2 0 0 1 0-4h12v4"/><path d="M4 5v14a2 2 0 0 0 2 2h14V7H6a2 2 0 0 0-2 2"/><path d="M16 13h.01"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  arrowUpRight: '<path d="M7 17 17 7M8 7h9v9"/>',
  arrowDownRight: '<path d="M7 7l10 10M17 8v9H8"/>',
  sparkles: '<path d="m12 3 1.8 4.9L18.7 9.7l-4.9 1.8L12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8L12 3Z"/><path d="M19 15l.9 2.4 2.4.9-2.4.9L19 21.6l-.9-2.4-2.4-.9 2.4-.9L19 15Z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',
  filter: '<path d="M4 5h16l-6.5 8v6l-3 1v-7L4 5Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.1-2.5 3.6"/><path d="M12 17h.01"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".5"/>',
  filterList: '<path d="M3 6h18M7 12h10M10 18h4"/>',
  sheet: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};

export function icon(name, size = 18, cls = '') {
  const path = PATHS[name] || '';
  return `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function googleIcon(size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>
  </svg>`;
}

export function toast(message, type = 'success', timeout = 4200) {
  const root = document.getElementById('toasts');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const ic = type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check';
  el.innerHTML = `<span class="toast-icon">${icon(ic, 18)}</span><p>${escapeHtml(message)}</p>`;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  const remove = () => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 220);
  };
  el.addEventListener('click', remove);
  setTimeout(remove, timeout);
}

export function openModal({ title, subtitle = '', content = '', footer = '', size = 'md', onMount }) {
  const root = document.getElementById('modal-root');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal-${size}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header class="modal-head">
        <div class="modal-titles">
          <h2 id="modal-title">${escapeHtml(title)}</h2>
          ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <button type="button" class="icon-btn" data-modal-close aria-label="Fechar">${icon('x', 18)}</button>
      </header>
      <div class="modal-body">${content}</div>
      ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
    </div>`;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    overlay.classList.remove('in');
    setTimeout(() => {
      overlay.remove();
      if (root && root.children.length === 0) document.body.classList.remove('modal-open');
    }, 180);
  };

  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };

  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelectorAll('[data-modal-close]').forEach((btn) => btn.addEventListener('click', close));
  document.addEventListener('keydown', onKey);

  root.appendChild(overlay);
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => overlay.classList.add('in'));

  const api = { el: overlay, close };
  if (onMount) onMount(overlay, api);
  setTimeout(() => {
    const focusable = overlay.querySelector('input:not([type="hidden"]), select, textarea, button:not([data-modal-close])');
    if (focusable) focusable.focus();
  }, 60);

  return api;
}

export function confirmDialog({
  title = 'Confirmar',
  message = '',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const modal = openModal({
      title,
      size: 'sm',
      content: `<p class="confirm-text">${escapeHtml(message)}</p>`,
      footer: `
        <button type="button" class="btn btn-ghost" data-cancel>${escapeHtml(cancelLabel)}</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${escapeHtml(confirmLabel)}</button>`,
      onMount: (el, api) => {
        el.querySelector('[data-cancel]').addEventListener('click', () => { finish(false); api.close(); });
        el.querySelector('[data-confirm]').addEventListener('click', () => { finish(true); api.close(); });
        el.addEventListener('mousedown', (e) => { if (e.target === el) finish(false); });
        el.querySelector('[data-modal-close]')?.addEventListener('click', () => finish(false));
        const onEsc = (e) => { if (e.key === 'Escape') finish(false); };
        document.addEventListener('keydown', onEsc, { once: true });
      },
    });
    modal.el.addEventListener('click', (e) => {
      if (e.target.closest('[data-modal-close]')) finish(false);
    });
  });
}

export function busy(on) {
  document.body.classList.toggle('is-busy', Boolean(on));
}

export function emptyState({ iconName = 'sparkles', title, text, action = '' }) {
  return `<div class="empty">
    <div class="empty-icon">${icon(iconName, 22)}</div>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(text)}</p>
    ${action}
  </div>`;
}

export function fieldError(form, name, message) {
  const el = form.querySelector(`[data-error="${name}"]`);
  if (el) el.textContent = message || '';
  const input = form.querySelector(`[name="${name}"]`);
  if (input) input.classList.toggle('invalid', Boolean(message));
}

export function clearErrors(form) {
  form.querySelectorAll('[data-error]').forEach((el) => { el.textContent = ''; });
  form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
}
