import { icon, emptyState } from '../ui.js';
import { colorFor, escapeHtml, fmtBRL, monthLabel } from '../utils.js';

export function renderCategories(store, state) {
  const scopeMonth = state.catScope === 'month' ? state.month : null;
  const cats = store.categories(scopeMonth);
  const expenses = cats.filter((c) => c.types.despesa >= c.types.receita);
  const incomes = cats.filter((c) => c.types.receita > c.types.despesa);
  const totalExpense = expenses.reduce((a, c) => a + c.expense, 0);
  const totalIncome = incomes.reduce((a, c) => a + c.income, 0);

  const card = (cat) => {
    const isIncome = cat.types.receita > cat.types.despesa;
    const total = isIncome ? cat.income : cat.expense;
    const subs = [...cat.subcategories.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const extra = cat.subcategories.size - subs.length;
    const share = isIncome ? (totalIncome ? (total / totalIncome) * 100 : 0) : totalExpense ? (total / totalExpense) * 100 : 0;
    return `<article class="cat-card" style="--cat-color:${colorFor(cat.name)}">
      <div class="cat-head">
        <span class="cat-dot" style="background:${colorFor(cat.name)}"></span>
        <span class="cat-name" title="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</span>
        <span class="cat-type ${isIncome ? 'receita' : 'despesa'}">${isIncome ? 'Receita' : 'Despesa'}</span>
      </div>
      <div class="cat-total">${fmtBRL(total)}</div>
      <div class="cat-meta">
        <span>${cat.count} lançamento${cat.count === 1 ? '' : 's'}</span>
        <span>${share.toFixed(0)}% do total</span>
      </div>
      ${
        subs.length
          ? `<div class="cat-subs">${subs.map(([name, value]) => `<span class="chip sub" title="${escapeHtml(name)}: ${fmtBRL(value)}">${escapeHtml(name)}</span>`).join('')}${extra > 0 ? `<span class="chip sub">+${extra}</span>` : ''}</div>`
          : ''
      }
    </article>`;
  };

  return `<div class="filters">
    <div class="segmented" role="group" aria-label="Período das categorias">
      <button type="button" data-action="cat-scope" data-value="month" class="${state.catScope === 'month' ? 'active' : ''}">${escapeHtml(monthLabel(state.month, { year: false }))}</button>
      <button type="button" data-action="cat-scope" data-value="all" class="${state.catScope === 'all' ? 'active' : ''}">Todo o período</button>
    </div>
    <div class="spacer"></div>
    <button class="btn btn-ghost" data-action="nav" data-view="transactions">${icon('list', 16)} Ver lançamentos</button>
    <button class="btn btn-primary new-tx-btn" data-action="new-tx">${icon('plus', 16)} Novo lançamento</button>
  </div>

  ${
    cats.length
      ? `<div class="kpis cat-kpis">
          <article class="kpi income">
            <div class="kpi-top"><span class="kpi-ico">${icon('arrowDown', 15)}</span> Receitas</div>
            <div class="kpi-value">${fmtBRL(totalIncome)}</div>
            <div class="kpi-foot"><span>${incomes.length} categoria${incomes.length === 1 ? '' : 's'}</span></div>
          </article>
          <article class="kpi expense">
            <div class="kpi-top"><span class="kpi-ico">${icon('arrowUp', 15)}</span> Despesas</div>
            <div class="kpi-value">${fmtBRL(totalExpense)}</div>
            <div class="kpi-foot"><span>${expenses.length} categoria${expenses.length === 1 ? '' : 's'}</span></div>
          </article>
          <article class="kpi primary">
            <div class="kpi-top"><span class="kpi-ico">${icon('tag', 15)}</span> Categorias</div>
            <div class="kpi-value">${cats.length}</div>
            <div class="kpi-foot"><span>${scopeMonth ? escapeHtml(monthLabel(scopeMonth)) : 'todo o período'}</span></div>
          </article>
        </div>

        <div class="section-title"><h2>Despesas</h2><div class="spacer"></div><p>${scopeMonth ? escapeHtml(monthLabel(scopeMonth)) : 'Todo o período'}</p></div>
        <div class="cat-grid">${expenses.length ? expenses.map(card).join('') : emptyState({ iconName: 'tag', title: 'Sem despesas', text: 'Nenhuma despesa registrada neste período.' })}</div>

        ${incomes.length ? `<div class="section-title"><h2>Receitas</h2></div><div class="cat-grid">${incomes.map(card).join('')}</div>` : ''}

        <p style="margin-top:22px;font-size:12px;color:var(--muted-2);display:flex;align-items:center;gap:6px">
          ${icon('info', 14)} As categorias e subcategorias são lidas diretamente da sua planilha. Para renomear, edite na própria planilha.
        </p>`
      : `<div class="card"><div class="card-body">${emptyState({
          iconName: 'tag',
          title: 'Nenhuma categoria ainda',
          text: 'As categorias aparecem aqui automaticamente conforme você registra lançamentos.',
          action: `<button class="btn btn-primary" data-action="new-tx">${icon('plus', 16)} Novo lançamento</button>`,
        })}</div></div>`
  }`;
}
