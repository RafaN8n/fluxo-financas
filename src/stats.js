import { lastMonths, monthOf, shiftMonth, sum } from './utils.js';

export function totals(txs) {
  const income = sum(txs.filter((t) => t.type === 'receita'), (t) => t.amount);
  const expense = sum(txs.filter((t) => t.type === 'despesa'), (t) => t.amount);
  return { income, expense, balance: income - expense, count: txs.length };
}

export function monthTotals(txs, month) {
  const inMonth = txs.filter((t) => monthOf(t.date) === month);
  return { ...totals(inMonth), txs: inMonth };
}

export function previousMonth(month) {
  return shiftMonth(month, -1);
}

export function delta(current, previous) {
  if (!previous) return current > 0 ? 100 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function monthlySeries(txs, endMonth, count = 6) {
  return lastMonths(count, endMonth).map((month) => {
    const inMonth = txs.filter((t) => monthOf(t.date) === month);
    const t = totals(inMonth);
    return { month, income: t.income, expense: t.expense, balance: t.balance };
  });
}

export function categoryBreakdown(txs, month, type = 'despesa') {
  const source = txs.filter((t) => t.type === type && (!month || monthOf(t.date) === month));
  const map = new Map();
  for (const t of source) {
    const key = t.category || 'Outros';
    map.set(key, (map.get(key) || 0) + t.amount);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function topExpenses(txs, month, limit = 5) {
  return txs
    .filter((t) => t.type === 'despesa' && monthOf(t.date) === month)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export function dailyBalance(txs, month) {
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const inMonth = txs.filter((t) => monthOf(t.date) === month);
  const out = [];
  let running = 0;
  for (let d = 1; d <= days; d++) {
    const iso = `${month}-${String(d).padStart(2, '0')}`;
    const dayTx = inMonth.filter((t) => t.date === iso);
    running += sum(dayTx.filter((t) => t.type === 'receita'), (t) => t.amount);
    running -= sum(dayTx.filter((t) => t.type === 'despesa'), (t) => t.amount);
    out.push({ day: d, value: running });
  }
  return out;
}

export function savingsRate(totalsMonth) {
  if (!totalsMonth.income) return null;
  return ((totalsMonth.income - totalsMonth.expense) / totalsMonth.income) * 100;
}
