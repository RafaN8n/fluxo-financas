// Utilitários de formatação, parsing e datas (pt-BR)
export const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export const pad2 = (n) => String(n).padStart(2, '0');

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function fmtBRL(v) {
  return BRL.format(Number(v) || 0);
}

export function fmtBRLShort(v) {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1000) return 'R$ ' + (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
  return BRL0.format(n);
}

export function fmtPct(v, digits = 0) {
  if (!Number.isFinite(v)) return '—';
  return `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`;
}

export function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function currentMonth() {
  return todayISO().slice(0, 7);
}

export function monthOf(iso) {
  return String(iso || '').slice(0, 7);
}

/** Converte "2026-10-29" em Date local (meio-dia, evita fuso) */
export function isoToDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

export function fmtDateBR(iso, opts = {}) {
  if (!iso) return '—';
  const d = isoToDate(iso);
  if (Number.isNaN(d.getTime())) return '—';
  if (opts.short) return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtDateLong(iso) {
  if (!iso) return '—';
  return isoToDate(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function weekdayShort(iso) {
  return isoToDate(iso).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
}

export function monthLabel(key, opts = {}) {
  if (!key) return '—';
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1, 12);
  const label = d.toLocaleDateString('pt-BR', { month: 'long', year: opts.year === false ? undefined : 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function monthShort(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1, 12).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
}

export function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1 + delta, 1, 12);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function lastMonths(n, endKey = currentMonth()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(shiftMonth(endKey, -i));
  return out;
}

export function daysInMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** Planilha → ISO. Aceita serial do Sheets, ISO, dd/mm/aaaa, dd/mm. */
export function parseSheetDate(value, fallbackYear = new Date().getFullYear()) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Serial do Google Sheets: 25569 = 01/01/1970
    const ms = Math.round((value - 25569) * 86400000);
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += y < 70 ? 2000 : 1900;
    return `${y}-${pad2(m[2])}-${pad2(m[1])}`;
  }
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})$/);
  if (m) return `${fallbackYear}-${pad2(m[2])}-${pad2(m[1])}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime()) && /\d{4}/.test(s)) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  return null;
}

/** "R$ 1.234,56" | "1234.56" | -50 | "(50)" → number */
export function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  let s = String(value).trim();
  if (!s) return 0;
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s);
  s = s.replace(/[^\d.,]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return negative ? -n : n;
}

export function parseTipo(value) {
  const s = norm(value);
  if (!s) return null;
  if (/(receita|entrada|credit|credito|ganho|income|recebimento|deposito)/.test(s)) return 'receita';
  if (/(despesa|saida|debit|debito|gasto|expense|pagamento|retirada|compra)/.test(s)) return 'despesa';
  return null;
}

export function parseSheetId(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s;
  return null;
}

export function columnLetter(index) {
  let n = index;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function colorFor(seed) {
  const palette = ['#0d9488', '#6366f1', '#f59e0b', '#ec4899', '#0ea5e9', '#8b5cf6', '#f43f5e', '#22c55e', '#14b8a6', '#f97316', '#64748b', '#84cc16', '#06b6d4', '#a855f7', '#ef4444'];
  let h = 0;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export function debounce(fn, ms = 180) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCSV(rows, sep = ';') {
  const cell = (v) => {
    const s = String(v ?? '');
    return /["\n;,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '\ufeff' + rows.map((r) => r.map(cell).join(sep)).join('\r\n');
}

export function sum(arr, fn = (x) => x) {
  return arr.reduce((acc, x) => acc + (Number(fn(x)) || 0), 0);
}
