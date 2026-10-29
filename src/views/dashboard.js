import { barChart, donutChart } from '../charts.js';
import { categoryBreakdown, delta, monthTotals, monthlySeries, previousMonth, savingsRate, topExpenses, totals } from '../stats.js';
import { icon, emptyState } from '../ui.js';
import { colorFor, fmtBRL, fmtPct, monthLabel } from '../utils.js';

function trendChip(value, { invert = false, suffix = 'vs mês anterior' } = {}) {
  if (value === null || !Number.isFinite(value)) return `<span class="trend flat">—</span> <span>${suffix}</span>`;
  const good = invert ? value < 0 : value > 0;
  const cls = Math.abs(value) < 0.5 ? 'flat' : good ? 'up' : 'down';
  const arrow = value >= 0 ? 'arrowUpRight' : 'arrowDownRight';
  return `<span class="trend ${cls}">${icon(arrow, 12)}${fmtPct(Math.abs(value))}</span><span>${suffix}</span>`;
}

function txRow(tx, { compact = false } = {}) {
  const color = colorFor(tx.category);
  const [year, month, day] = tx.date.split('-');
  const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `<div class="tx-item${compact ? ' compact' : ''}" ${compact ? `data-action="edit-tx" data-row="${tx.row}" role="button" tabindex="0"` : ''}>
    <div class="tx-date"><strong>${day}</strong><span>${monthName}</span></div>
    <div class="tx-main">
      <div class="tx-desc">${escape(tx.description)}</div>
      <div class="tx-sub">${escape(tx.subcategory || tx.note || (tx.type === 'receita' ? 'Receita' : 'Despesa'))}</div>
    </div>
    <div class="tx-cat"><span class="chip"><span class="dot" style="background:${color}"></span>${escape(tx.category)}</span></div>
    <div class="tx-type-col"><span class="cat-type ${tx.type}">${tx.type === 'receita' ? 'Receita' : 'Despesa'}</span></div>
    <div class="amount ${tx.type === 'receita' ? 'income' : 'expense'}">${tx.type === 'receita' ? '+' : '−'} ${fmtBRL(tx.amount)}</div>
    ${compact ? '' : `<div class="tx-actions">
      <button class="icon-btn sm" data-action="edit-tx" data-row="${tx.row}" aria-label="Editar ${escape(tx.description)}">${icon('edit', 15)}</button>
      <button class="icon-btn sm danger" data-action="delete-tx" data-row="${tx.row}" aria-label="Excluir ${escape(tx.description)}">${icon('trash', 15)}</button>
    </div>`}
  </div>`;
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function renderDashboard(store, state) {
  const month = state.month;
  const txs = store.txs;
  const monthData = monthTotals(txs, month);
  const prevData = monthTotals(txs, previousMonth(month));
  const all = totals(txs);
  const rate = savingsRate(monthData);
  const series = monthlySeries(txs, month, 6);
  const breakdown = categoryBreakdown(txs, month, 'despesa');
  const top = topExpenses(txs, month, 5);
  const recent = [...txs].sort((a, b) => (a.date === b.date ? b.row - a.row : a.date < b.date ? 1 : -1)).slice(0, 6);
  const hasData = txs.length > 0;

  const kpis = `<div class="kpis">
    <article class="kpi balance">
      <div class="kpi-top"><span class="kpi-ico">${icon('wallet', 15)}</span> Saldo geral</div>
      <div class="kpi-value">${fmtBRL(all.balance)}</div>
      <div class="kpi-foot"><span>${all.count} lançamento${all.count === 1 ? '' : 's'} no total</span></div>
    </article>
    <article class="kpi income">
      <div class="kpi-top"><span class="kpi-ico">${icon('arrowDown', 15)}</span> Receitas do mês</div>
      <div class="kpi-value">${fmtBRL(monthData.income)}</div>
      <div class="kpi-foot">${trendChip(delta(monthData.income, prevData.income))}</div>
    </article>
    <article class="kpi expense">
      <div class="kpi-top"><span class="kpi-ico">${icon('arrowUp', 15)}</span> Despesas do mês</div>
      <div class="kpi-value">${fmtBRL(monthData.expense)}</div>
      <div class="kpi-foot">${trendChip(delta(monthData.expense, prevData.expense), { invert: true })}</div>
    </article>
    <article class="kpi primary">
      <div class="kpi-top"><span class="kpi-ico">${icon('target', 15)}</span> Resultado do mês</div>
      <div class="kpi-value" style="color:${monthData.balance >= 0 ? 'var(--income)' : 'var(--expense)'}">${fmtBRL(monthData.balance)}</div>
      <div class="kpi-foot">${
        rate === null
          ? '<span>Sem receitas registradas</span>'
          : `<span class="trend ${rate >= 20 ? 'up' : rate >= 0 ? 'flat' : 'down'}">${rate.toFixed(0)}%</span><span>da receita economizada</span>`
      }</div>
    </article>
  </div>`;

  const charts = `<div class="charts">
    <section class="card">
      <div class="card-head">
        <div>
          <h2>Evolução mensal</h2>
          <p>Receitas e despesas dos últimos 6 meses</p>
        </div>
        <div class="spacer"></div>
        <div class="bars-legend">
          <span><i style="background:var(--income)"></i> Receitas</span>
          <span><i style="background:var(--expense)"></i> Despesas</span>
        </div>
      </div>
      <div class="card-body chart-wrap">${barChart(series)}</div>
    </section>
    <section class="card">
      <div class="card-head">
        <div>
          <h2>Para onde vai o dinheiro</h2>
          <p>${escape(monthLabel(month))}</p>
        </div>
      </div>
      <div class="card-body">${
        breakdown.length
          ? donutChart(breakdown, { label: 'Despesas' })
          : emptyState({ iconName: 'chart', title: 'Nada por aqui ainda', text: 'Registre despesas para ver a distribuição por categoria.' })
      }</div>
    </section>
  </div>`;

  const bottom = `<div class="split">
    <section class="card">
      <div class="card-head">
        <div><h2>Últimos lançamentos</h2><p>Toque para editar</p></div>
        <div class="spacer"></div>
        <button class="btn btn-soft btn-sm" data-action="nav" data-view="transactions">Ver todos ${icon('chevronRight', 14)}</button>
      </div>
      <div class="card-body" style="padding-top:6px">
        ${recent.length ? `<div class="tx-list">${recent.map((t) => txRow(t, { compact: true })).join('')}</div>` : emptyState({ iconName: 'list', title: 'Sem lançamentos', text: 'Adicione o primeiro lançamento para começar.' })}
      </div>
    </section>
    <section class="card">
      <div class="card-head"><div><h2>Maiores gastos do mês</h2><p>${escape(monthLabel(month))}</p></div></div>
      <div class="card-body">
        ${
          top.length
            ? `<div class="top-list">${top
                .map((tx) => {
                  const pct = top[0].amount ? (tx.amount / top[0].amount) * 100 : 0;
                  return `<div class="top-item" style="--cat-color:${colorFor(tx.category)}">
                    <span class="t-name">${escape(tx.description)}</span>
                    <span class="t-val">${fmtBRL(tx.amount)}</span>
                    <div class="progress"><span style="width:${pct.toFixed(1)}%"></span></div>
                  </div>`;
                })
                .join('')}</div>`
            : emptyState({ iconName: 'wallet', title: 'Nenhuma despesa', text: 'Seus maiores gastos do mês aparecem aqui.' })
        }
      </div>
    </section>
  </div>`;

  const firstRun = !hasData
    ? `<section class="card" style="margin-bottom:16px">
        <div class="card-body">
          ${emptyState({
            iconName: 'sparkles',
            title: 'Comece registrando um lançamento',
            text: 'Se a planilha já tem dados, toque em Atualizar. Caso contrário, adicione sua primeira receita ou despesa.',
            action: `<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
              <button class="btn btn-primary" data-action="new-tx">${icon('plus', 16)} Novo lançamento</button>
              <button class="btn btn-ghost" data-action="refresh">${icon('refresh', 16)} Atualizar</button>
            </div>`,
          })}
        </div>
      </section>`
    : '';

  return `${firstRun}${kpis}${charts}${bottom}`;
}

export function demoBanner() {
  return `<div class="demo-banner">
    ${icon('sparkles', 16)}
    <span><strong>Modo demonstração.</strong> Os dados ficam só neste navegador — nada é gravado no Drive.</span>
    <button class="btn btn-ghost btn-sm" data-action="exit-demo">Conectar minha planilha</button>
  </div>`;
}

export { txRow, trendChip };
