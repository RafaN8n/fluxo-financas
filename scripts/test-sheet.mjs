// Teste offline da camada de planilha (mock da API do Google Sheets)
import assert from 'node:assert/strict';

const mem = new Map([['fluxo.clientId', 'test-client']]);
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
globalThis.window = {
  google: {
    accounts: {
      oauth2: {
        initTokenClient: (cfg) => ({ requestAccessToken: () => cfg.callback({ access_token: 'token', expires_in: 3600 }) }),
        revoke: () => {},
      },
    },
  },
};
globalThis.document = {
  head: { appendChild: () => {} },
  createElement: () => ({}),
  getElementById: () => null,
  querySelector: () => null,
};

const SHEET_ID = 'SHEET1234567890abcdefghij';
const HEADER = ['Data', 'Descrição', 'Categoria', 'Subcategoria', 'Tipo', 'Valor', 'Observação'];

// Aba "Capa" + aba "Lançamentos" com cabeçalho na linha 3
const sheetRows = [
  ['Controle financeiro 2026'],
  [],
  HEADER,
  [46300, 'Salário', 'Salário', 'CLT', 'Receita', 8200, ''],
  ['05/10/2026', 'Mercado', 'Alimentação', 'Mercado', 'Saída', '-R$ 1.234,56', 'compra do mês'],
  ['2026-10-07', 'Aluguel', 'Moradia', 'Aluguel', 'Despesa', -2350, ''],
  ['', '', '', '', '', '', ''],
  ['10/10/2026', 'Freela', 'Freelance', '', 'Entrada', '800', ''],
];
const scans = {
  Capa: [['Minhas finanças'], ['']],
  Lançamentos: sheetRows,
};

const json = (data) => ({ ok: true, status: 200, json: async () => data });

function rangeRows(tab, startRow) {
  if (tab !== 'Lançamentos') return scans[tab] || [];
  return sheetRows.slice(startRow - 1);
}

globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  const path = decodeURIComponent(u.pathname);
  const method = (opts.method || 'GET').toUpperCase();

  if (path === `/v4/spreadsheets/${SHEET_ID}`) {
    return json({
      properties: { title: 'Finanças da casa', locale: 'pt_BR' },
      sheets: [
        { properties: { title: 'Capa', sheetId: 0, index: 0 } },
        { properties: { title: 'Lançamentos', sheetId: 12345, index: 1 } },
      ],
    });
  }

  if (path === `/v4/spreadsheets/${SHEET_ID}/values:batchGet`) {
    const ranges = u.searchParams.getAll('ranges');
    return json({
      valueRanges: ranges.map((r) => {
        const tab = r.split('!')[0].replace(/'/g, '');
        return { range: r, values: scans[tab] || [] };
      }),
    });
  }

  if (path === `/v4/spreadsheets/${SHEET_ID}:batchUpdate` && method === 'POST') {
    const body = JSON.parse(opts.body);
    const req = body.requests[0].deleteDimension;
    sheetRows.splice(req.range.startIndex, req.range.endIndex - req.range.startIndex);
    return json({ replies: [{}] });
  }

  const valuesMatch = path.match(new RegExp(`^/v4/spreadsheets/${SHEET_ID}/values/(.+)$`));
  if (valuesMatch) {
    const range = valuesMatch[1];
    const tab = range.split('!')[0].replace(/'/g, '');
    const rowNumber = Number(range.match(/!A(\d+)/)?.[1] || 1);

    if (method === 'POST' && range.endsWith(':append')) {
      const values = JSON.parse(opts.body).values[0];
      sheetRows.push(values);
      return json({ updates: { updatedRange: `'Lançamentos'!A${sheetRows.length}:G${sheetRows.length}` } });
    }
    if (method === 'PUT') {
      const values = JSON.parse(opts.body).values[0];
      sheetRows[rowNumber - 1] = values;
      return json({ updatedRange: range });
    }
    if (method === 'GET') {
      return json({ range, values: rangeRows(tab, rowNumber) });
    }
  }

  throw new Error('URL inesperada: ' + method + ' ' + url);
};

const { readSheet, Store, detectMapping } = await import('../src/store.js');

/* ---------- leitura ---------- */
const data = await readSheet(SHEET_ID);
assert.equal(data.tab, 'Lançamentos');
assert.equal(data.headerRow, 3);
assert.equal(data.txs.length, 4, 'ignora linhas vazias');
assert.equal(data.txs[0].date, '2026-10-05', 'serial 46300 vira data ISO');
assert.equal(data.txs[0].type, 'receita');
assert.equal(data.txs[1].date, '2026-10-05');
assert.equal(data.txs[1].amount, 1234.56);
assert.equal(data.txs[1].type, 'despesa');
assert.equal(data.txs[2].date, '2026-10-07');
assert.equal(data.txs[2].amount, 2350);
assert.equal(data.txs[3].type, 'receita');
assert.equal(data.negativeExpenses, true, 'detecta convenção de despesas negativas');
assert.equal(data.tipoLabels.receita, 'Receita');
assert.equal(data.tipoLabels.despesa, 'Saída', 'mantém o rótulo usado na planilha');

/* ---------- gravação ---------- */
const store = new Store();
store.mapping = data.mapping;
store.lastColumn = data.lastColumn;
store.negativeExpenses = data.negativeExpenses;
store.tipoLabels = data.tipoLabels;
const values = store.rowValues({ date: '2026-10-29', description: 'Padaria', category: 'Alimentação', subcategory: 'Padaria', type: 'despesa', amount: 12.5, note: 'ok' });
assert.deepEqual(values, ['2026-10-29', 'Padaria', 'Alimentação', 'Padaria', 'Saída', -12.5, 'ok']);

/* ---------- store completo (sync + CRUD) ---------- */
const s = new Store();
await s.connect(SHEET_ID);
assert.equal(s.txs.length, 4);
assert.equal(s.sheetTitle, 'Finanças da casa');

await s.addTx({ date: '2026-10-29', description: 'Padaria', category: 'Alimentação', subcategory: 'Padaria', type: 'despesa', amount: 12.5, note: '' });
assert.equal(s.txs.length, 5);
const added = s.txs.find((t) => t.description === 'Padaria');
assert.equal(added.amount, 12.5);
assert.equal(sheetRows[sheetRows.length - 1][5], -12.5, 'grava despesa negativa (convenção da planilha)');

await s.updateTx(added.row, { date: '2026-10-29', description: 'Padaria nova', category: 'Alimentação', subcategory: 'Pão', type: 'despesa', amount: 19.9, note: 'editado' });
assert.equal(s.txs.find((t) => t.row === added.row).amount, 19.9);
assert.equal(sheetRows[added.row - 1][1], 'Padaria nova');

await s.deleteTx(added.row);
assert.equal(s.txs.length, 4);
assert.equal(sheetRows.length, 8, 'linha removida da planilha');

/* ---------- mapeamento alternativo ---------- */
const alt = detectMapping(['dia', 'histórico', 'grupo', 'sub-categoria', 'natureza', 'montante', 'obs']);
assert.deepEqual(alt, { data: 0, descricao: 1, categoria: 2, subcategoria: 3, tipo: 4, valor: 5, observacao: 6 });

console.log('OK — leitura, datas, valores, tipos, CRUD e mapeamento validados');
