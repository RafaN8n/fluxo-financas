import { icon, emptyState } from '../ui.js';
import { escapeHtml, fmtBRL, isoToDate, monthLabel, norm, sum } from '../utils.js';
import { txRow } from './dashboard.js';

function filterTxs(txs, state) {
  const q = norm(state.filters.q);
  return txs
    .filter((t) => {
      if (state.scope === 'month' && !t.date.startsWith(state.month)) return false;
      if (state.filters.type !== 'all' && t.type !== state.filters.type) return false;
      if (state.filters.category !== 'all' && t.category !== state.filters.category) return false;
      if (q) {
        const hay = norm([t.description, t.category, t.subcategory, t.note].join(' '));
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => (a.date === b.date ? b.row - a.row : a.date < b.date ? 1 : -1));
}

function dayLabel(iso) {
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  if (iso === todayISO) return 'Hoje';
  if (iso === yISO) return 'Ontem';
  return isoToDate(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long' }).replace('.', '');
}

export function renderTransactions(store, state) {
  const filtered = filterTxs(store.txs, state);
  const shown = filtered.slice(0, state.limit);
  const income = sum(filtered.filter((t) => t.type === 'receita'), (t) => t.amount);
  const expense = sum(filtered.filter((t) => t.type === 'despesa'), (t) => t.amount);
  const categories = store.categoryNames();

  const groups = new Map();
  shown.forEach((tx) => {
    if (!groups.has(tx.date)) groups.set(tx.date, []);
    groups.get(tx.date).push(tx);
  });

  const list = [...groups.entries()]
    .map(
      ([date, items]) => `<div class="tx-group-label">${escapeHtml(dayLabel(date))}</div>
        <div class="tx-list">${items.map((t) => txRow(t)).join('')}</div>`
    )
    .join('');

  const empty = store.txs.length === 0
    ? emptyState({
        iconName: 'list',
        title: 'Nenhum lançamento ainda',
        text: 'Adicione sua primeira receita ou despesa. Ela vai direto para a sua planilha.',
        action: `<button class="btn btn-primary" data-action="new-tx">${icon('plus', 16)} Novo lançamento</button>`,
      })
    : emptyState({
        iconName: 'search',
        title: 'Nada encontrado',
        text: 'Ajuste os filtros ou o período para ver outros lançamentos.',
        action: `<button class="btn btn-ghost" data-action="clear-filters">${icon('x', 16)} Limpar filtros</button>`,
      });

  return `<div class="filters">
    <div class="search-box">
      ${icon('search', 16)}
      <input type="search" id="tx-search" data-filter="q" value="${escapeHtml(state.filters.q)}" placeholder="Buscar descrição, categoria, observação…" aria-label="Buscar lançamentos" />
    </div>
    <select class="select-sm" data-filter="type" aria-label="Filtrar por tipo">
      <option value="all" ${state.filters.type === 'all' ? 'selected' : ''}>Todos os tipos</option>
      <option value="receita" ${state.filters.type === 'receita' ? 'selected' : ''}>Receitas</option>
      <option value="despesa" ${state.filters.type === 'despesa' ? 'selected' : ''}>Despesas</option>
    </select>
    <select class="select-sm" data-filter="category" aria-label="Filtrar por categoria">
      <option value="all">Todas as categorias</option>
      ${categories.map((c) => `<option value="${escapeHtml(c)}" ${state.filters.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
    </select>
    <div class="segmented" role="group" aria-label="Período">
      <button type="button" data-action="scope" data-value="month" class="${state.scope === 'month' ? 'active' : ''}">${escapeHtml(monthLabel(state.month, { year: false }))}</button>
      <button type="button" data-action="scope" data-value="all" class="${state.scope === 'all' ? 'active' : ''}">Tudo</button>
    </div>
    <div class="spacer"></div>
    <button class="btn btn-primary new-tx-btn" data-action="new-tx">${icon('plus', 16)} Novo lançamento</button>
  </div>

  <div class="card">
    <div class="card-body" style="padding-bottom:8px">
      ${
        filtered.length
          ? `<div class="result-count" style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:4px">
              <span><strong style="color:var(--ink)">${filtered.length}</strong> lançamento${filtered.length === 1 ? '' : 's'}</span>
              <span style="color:var(--income)">+ ${fmtBRL(income)}</span>
              <span style="color:var(--expense)">− ${fmtBRL(expense)}</span>
              <span>Saldo <strong style="color:var(--ink)">${fmtBRL(income - expense)}</strong></span>
            </div>`
          : ''
      }
      ${filtered.length ? list : empty}
      ${
        filtered.length > state.limit
          ? `<div style="display:flex;justify-content:center;padding:14px 0 4px">
              <button class="btn btn-ghost" data-action="more">Mostrar mais (${filtered.length - state.limit} restantes)</button>
            </div>`
          : ''
      }
    </div>
  </div>`;
}

export { filterTxs };
