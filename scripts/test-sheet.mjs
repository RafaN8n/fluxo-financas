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
const json = (data) => ({ ok: true, status: 200, json: async () => data });

/** Monta um mock da API para um conjunto de abas mutáveis. */
function mockApi(tabs, { title = 'Finanças' } = {}) {
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname);
    const method = (opts.method || 'GET').toUpperCase();
    const body = opts.body ? JSON.parse(opts.body) : null;

    if (path === `/v4/spreadsheets/${SHEET_ID}`) {
      return json({
        properties: { title, locale: 'pt_BR' },
        sheets: tabs.map((t, i) => ({ properties: { title: t.title, sheetId: t.gid, index: i } })),
      });
    }

    if (path === `/v4/spreadsheets/${SHEET_ID}/values:batchGet`) {
      return json({
        valueRanges: u.searchParams.getAll('ranges').map((range) => {
          const tab = tabs.find((t) => t.title === range.split('!')[0].replace(/'/g, ''));
          return { range, values: tab ? tab.rows.slice(0, 20) : [] };
        }),
      });
    }

    if (path === `/v4/spreadsheets/${SHEET_ID}:batchUpdate` && method === 'POST') {
      const req = body.requests[0].deleteDimension;
      const tab = tabs.find((t) => t.gid === req.range.sheetId);
      tab.rows.splice(req.range.startIndex, req.range.endIndex - req.range.startIndex);
      return json({ replies: [{}] });
    }

    const match = path.match(new RegExp(`^/v4/spreadsheets/${SHEET_ID}/values/(.+)$`));
    if (match) {
      const range = match[1];
      const tab = tabs.find((t) => t.title === range.split('!')[0].replace(/'/g, ''));
      const rowNumber = Number(range.match(/!A(\d+)/)?.[1] || 1);

      if (method === 'POST' && range.endsWith(':append')) {
        tab.rows.push(body.values[0]);
        return json({ updates: { updatedRange: range } });
      }
      if (method === 'PUT') {
        tab.rows[rowNumber - 1] = body.values[0];
        return json({ updatedRange: range });
      }
      if (method === 'GET') {
        return json({ range, values: tab.rows.slice(rowNumber - 1) });
      }
    }

    throw new Error('URL inesperada: ' + method + ' ' + url);
  };
}

const { readSheet, Store, detectMapping } = await import('../src/store.js');
const { parseTipo, parseSheetDate, parseAmount } = await import('../src/utils.js');

/* =====================================================================
   1. Planilha real: tipo = gasto | provento, valores positivos,
      cabeçalho na linha 1 (compatível com o Apps Script do usuário)
   ===================================================================== */
const HEADER = ['data', 'descrição', 'categoria', 'subcategoria', 'tipo', 'valor', 'observação'];
const userRows = [
  HEADER,
  ['2026-10-05', 'Salário', 'Salário', 'CLT', 'provento', 8200, ''],
  ['2026-10-05', 'Mercado', 'Alimentação', 'Mercado', 'gasto', 1234.56, 'compra do mês'],
  ['2026-10-07', 'Aluguel', 'Moradia', 'Aluguel', 'gasto', 2350, ''],
  ['', '', '', '', '', '', ''],
  ['2026-10-10', 'Rendimento CDB', 'Outros', '', 'provento', 93.4, ''],
];
mockApi([{ title: 'Lançamentos', gid: 0, rows: userRows }]);

const user = await readSheet(SHEET_ID);
assert.equal(user.tab, 'Lançamentos');
assert.equal(user.headerRow, 1);
assert.equal(user.txs.length, 4, 'ignora linhas vazias');
assert.equal(user.txs[0].type, 'receita', 'provento → receita');
assert.equal(user.txs[1].type, 'despesa', 'gasto → despesa');
assert.equal(user.txs[1].amount, 1234.56);
assert.equal(user.txs[2].amount, 2350);
assert.equal(user.txs[3].type, 'receita', 'provento com categoria "Outros" continua receita');
assert.equal(user.negativeExpenses, false, 'planilha com valores positivos');
assert.deepEqual(user.tipoLabels, { receita: 'provento', despesa: 'gasto' }, 'mantém o vocabulário da planilha');

/* gravação com o vocabulário do usuário */
const userStore = new Store();
userStore.mapping = user.mapping;
userStore.lastColumn = user.lastColumn;
userStore.negativeExpenses = user.negativeExpenses;
userStore.tipoLabels = user.tipoLabels;
const gasto = userStore.rowValues({ date: '2026-10-29', description: 'Padaria', category: 'Alimentação', subcategory: 'Padaria', type: 'despesa', amount: 12.5, note: 'ok' });
assert.deepEqual(gasto, ['2026-10-29', 'Padaria', 'Alimentação', 'Padaria', 'gasto', 12.5, 'ok']);
const provento = userStore.rowValues({ date: '2026-10-29', description: 'Freela', category: 'Freelance', subcategory: '', type: 'receita', amount: 500, note: '' });
assert.equal(provento[4], 'provento');
assert.equal(provento[5], 500, 'receita sempre positiva');

/* CRUD completo nessa planilha */
const s = new Store();
await s.connect(SHEET_ID);
assert.equal(s.txs.length, 4);
assert.equal(s.sheetTitle, 'Finanças');

await s.addTx({ date: '2026-10-29', description: 'Padaria', category: 'Alimentação', subcategory: 'Padaria', type: 'despesa', amount: 12.5, note: '' });
assert.equal(s.txs.length, 5);
const added = s.txs.find((t) => t.description === 'Padaria');
assert.equal(added.amount, 12.5);
assert.equal(userRows[userRows.length - 1][4], 'gasto', 'grava "gasto" na coluna tipo');
assert.equal(userRows[userRows.length - 1][5], 12.5, 'grava valor positivo');

await s.updateTx(added.row, { date: '2026-10-29', description: 'Padaria nova', category: 'Alimentação', subcategory: 'Pão', type: 'despesa', amount: 19.9, note: 'editado' });
assert.equal(s.txs.find((t) => t.row === added.row).amount, 19.9);
assert.equal(userRows[added.row - 1][1], 'Padaria nova');

await s.deleteTx(added.row);
assert.equal(s.txs.length, 4);
assert.equal(userRows.length, 6, 'linha removida da planilha');

/* =====================================================================
   2. Planilha com cabeçalho fora da linha 1, várias abas,
      despesas negativas e vocabulário Receita/Despesa
   ===================================================================== */
const legacyRows = [
  ['Controle financeiro 2026'],
  [],
  ['Data', 'Descrição', 'Categoria', 'Subcategoria', 'Tipo', 'Valor', 'Observação'],
  [46300, 'Salário', 'Salário', 'CLT', 'Receita', 8200, ''],
  ['05/10/2026', 'Mercado', 'Alimentação', 'Mercado', 'Saída', '-R$ 1.234,56', 'compra do mês'],
  ['2026-10-07', 'Aluguel', 'Moradia', 'Aluguel', 'Despesa', -2350, ''],
  ['', '', '', '', '', '', ''],
  ['10/10/2026', 'Freela', 'Freelance', '', 'Entrada', '800', ''],
];
mockApi([
  { title: 'Capa', gid: 0, rows: [['Minhas finanças'], ['']] },
  { title: 'Lançamentos', gid: 12345, rows: legacyRows },
]);

const legacy = await readSheet(SHEET_ID);
assert.equal(legacy.tab, 'Lançamentos', 'escolhe a aba de lançamentos');
assert.equal(legacy.headerRow, 3, 'detecta cabeçalho na linha 3');
assert.equal(legacy.txs.length, 4);
assert.equal(legacy.txs[0].date, '2026-10-05', 'serial 46300 vira data ISO');
assert.equal(legacy.txs[1].date, '2026-10-05');
assert.equal(legacy.txs[1].amount, 1234.56);
assert.equal(legacy.txs[2].amount, 2350);
assert.equal(legacy.txs[3].type, 'receita');
assert.equal(legacy.negativeExpenses, true, 'detecta convenção de despesas negativas');
assert.equal(legacy.tipoLabels.despesa, 'Saída', 'mantém o rótulo usado na planilha');

/* =====================================================================
   3. Parsing isolado
   ===================================================================== */
assert.equal(parseTipo('provento'), 'receita');
assert.equal(parseTipo('Proventos'), 'receita');
assert.equal(parseTipo('gasto'), 'despesa');
assert.equal(parseTipo('Gastos'), 'despesa');
assert.equal(parseTipo('Saída'), 'despesa');
assert.equal(parseTipo('Crédito'), 'receita');
assert.equal(parseTipo(''), null);
assert.equal(parseSheetDate('2026-10-29'), '2026-10-29');
assert.equal(parseSheetDate('29/10/2026'), '2026-10-29');
assert.equal(parseAmount('R$ 1.234,56'), 1234.56);
assert.equal(parseAmount('-R$ 1.234,56'), -1234.56);

/* mapeamento por nomes alternativos */
const alt = detectMapping(['dia', 'histórico', 'grupo', 'sub-categoria', 'natureza', 'montante', 'obs']);
assert.deepEqual(alt, { data: 0, descricao: 1, categoria: 2, subcategoria: 3, tipo: 4, valor: 5, observacao: 6 });

console.log('OK — gasto/provento, datas, valores, CRUD e mapeamento validados');
