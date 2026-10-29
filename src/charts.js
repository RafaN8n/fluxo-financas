import { colorFor, escapeHtml, fmtBRL, fmtBRLShort, monthShort } from './utils.js';

function niceMax(value) {
  if (!value || value <= 0) return 100;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const n = value / base;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * base;
}

/** Gráfico de barras (receitas x despesas por mês) */
export function barChart(series, { height = 250 } = {}) {
  const width = 720;
  const m = { top: 16, right: 10, bottom: 30, left: 56 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;
  const max = niceMax(Math.max(...series.map((s) => Math.max(s.income, s.expense)), 1));
  const groupW = plotW / Math.max(series.length, 1);
  const barW = Math.min(22, groupW * 0.26);

  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((p) => {
      const y = m.top + plotH * (1 - p);
      return `<line x1="${m.left}" x2="${width - m.right}" y1="${y}" y2="${y}" style="stroke:var(--line)" stroke-width="1" stroke-dasharray="${p === 0 ? '0' : '3 5'}" />
        <text x="${m.left - 10}" y="${y + 4}" text-anchor="end" font-size="10.5" style="fill:var(--muted-2)">${fmtBRLShort(max * p).replace('R$ ', '')}</text>`;
    })
    .join('');

  const bars = series
    .map((s, i) => {
      const cx = m.left + groupW * i + groupW / 2;
      const hIncome = Math.max(0, (s.income / max) * plotH);
      const hExpense = Math.max(0, (s.expense / max) * plotH);
      const yIncome = m.top + plotH - hIncome;
      const yExpense = m.top + plotH - hExpense;
      const isLast = i === series.length - 1;
      return `
        <g>
          <rect x="${cx - barW - 3}" y="${yIncome}" width="${barW}" height="${hIncome}" rx="4" style="fill:var(--income)" opacity="${isLast ? 1 : 0.72}">
            <title>${monthShort(s.month)}: ${fmtBRL(s.income)} em receitas</title>
          </rect>
          <rect x="${cx + 3}" y="${yExpense}" width="${barW}" height="${hExpense}" rx="4" style="fill:var(--expense)" opacity="${isLast ? 1 : 0.72}">
            <title>${monthShort(s.month)}: ${fmtBRL(s.expense)} em despesas</title>
          </rect>
          <text x="${cx}" y="${height - 9}" text-anchor="middle" font-size="11" style="fill:${isLast ? 'var(--ink)' : 'var(--muted)'};text-transform:capitalize" font-weight="${isLast ? 650 : 500}">${monthShort(s.month)}</text>
        </g>`;
    })
    .join('');

  return `<svg class="bars" viewBox="0 0 ${width} ${height}" role="img" aria-label="Receitas e despesas dos últimos meses" preserveAspectRatio="xMidYMid meet">
    ${grid}${bars}
  </svg>`;
}

/** Prepara dados do donut, agrupando excedentes em "Outros" */
export function donutData(items, limit = 5) {
  const total = items.reduce((acc, i) => acc + i.value, 0);
  if (!total) return { total: 0, slices: [] };
  let slices = items.slice(0, limit).map((i) => ({ ...i, color: colorFor(i.name) }));
  const rest = items.slice(limit);
  if (rest.length) {
    slices.push({ name: 'Outros', value: rest.reduce((a, i) => a + i.value, 0), color: '#94a3b8' });
  }
  slices = slices.map((s) => ({ ...s, pct: (s.value / total) * 100 }));
  return { total, slices };
}

export function donutChart(items, { limit = 5, label = 'Total' } = {}) {
  const { total, slices } = donutData(items, limit);
  if (!total) {
    return `<div class="empty" style="padding:24px 10px">
      <p style="font-size:13px;color:var(--muted)">Sem despesas neste período.</p>
    </div>`;
  }
  let acc = 0;
  const stops = slices
    .map((s) => {
      const start = acc;
      acc += s.pct;
      return `${s.color} ${start.toFixed(2)}% ${Math.min(acc, 100).toFixed(2)}%`;
    })
    .join(', ');

  const legend = slices
    .map(
      (s) => `<div class="legend-row">
        <span class="dot" style="background:${s.color}"></span>
        <span class="l-name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
        <span class="l-val">${fmtBRL(s.value)}<span class="l-pct">${s.pct.toFixed(0)}%</span></span>
      </div>`
    )
    .join('');

  return `<div class="donut-layout">
    <div class="donut" style="background: conic-gradient(${stops})" role="img" aria-label="Gastos por categoria">
      <div class="donut-center">
        <div class="dc-label">${escapeHtml(label)}</div>
        <div class="dc-value">${fmtBRL(total)}</div>
      </div>
    </div>
    <div class="legend">${legend}</div>
  </div>`;
}

/** Mini gráfico de linha (saldo acumulado) */
export function sparkline(points, { width = 640, height = 120 } = {}) {
  if (!points.length) return '';
  const values = points.map((p) => p.value);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const range = max - min || 1;
  const x = (i) => (i / Math.max(points.length - 1, 1)) * width;
  const y = (v) => height - 8 - ((v - min) / range) * (height - 16);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="spark" aria-hidden="true">
    <defs><linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--primary)" stop-opacity=".22"/>
      <stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#sparkFill)"/>
    <path d="${line}" fill="none" style="stroke:var(--primary)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}
