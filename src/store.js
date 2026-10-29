import { CONFIG } from './config.js';
import {
  appendRow, batchGet, createSpreadsheet, deleteRow, getMeta, getValues,
  SheetError, updateRow, writeHeader,
} from './sheets.js';
import {
  columnLetter, currentMonth, lastMonths, norm, parseAmount, parseSheetDate,
  parseTipo, todayISO,
} from './utils.js';

const FIELDS = {
  data: ['data', 'date', 'dia', 'data lancamento', 'data do lancamento', 'data da movimentacao'],
  descricao: ['descricao', 'description', 'historico', 'lancamento', 'nome', 'detalhe', 'movimentacao'],
  categoria: ['categoria', 'category', 'grupo', 'classificacao'],
  subcategoria: ['subcategoria', 'sub categoria', 'sub-categoria', 'subcategory', 'sub classificacao'],
  tipo: ['tipo', 'type', 'natureza', 'entrada/saida', 'entrada saida', 'operacao'],
  valor: ['valor', 'value', 'amount', 'montante', 'quantia', 'total'],
  observacao: ['observacao', 'obs', 'nota', 'notas', 'comentario', 'detalhes', 'observacoes'],
};

const INCOME_HINTS = ['salario', 'freelance', 'rendimento', 'investimento', 'dividendo', 'reembolso', 'bonus', 'bonificacao', 'comissao', 'presente', 'venda', 'receita', 'provento', 'aluguel recebido', 'cashback'];

const DEMO_TX = 'fluxo.demo.tx';

export function normalizeHeader(value) {
  return norm(value).replace(/[^a-z0-9/ ]/g, '').replace(/\s+/g, ' ').trim();
}

export function detectMapping(headerRow) {
  const mapping = {};
  (headerRow || []).forEach((cell, index) => {
    const header = normalizeHeader(cell);
    if (!header) return;
    for (const [field, aliases] of Object.entries(FIELDS)) {
      if (mapping[field] === undefined && aliases.includes(header)) {
        mapping[field] = index;
        break;
      }
    }
  });
  return mapping;
}

function quote(tab) {
  return `'${String(tab).replace(/'/g, "''")}'`;
}

function defaultMapping() {
  const map = {};
  CONFIG.columns.forEach((label, index) => {
    const found = detectMapping([label]);
    Object.assign(map, found);
  });
  return map;
}

function cell(row, mapping, field) {
  const idx = mapping[field];
  if (idx === undefined) return '';
  const v = row[idx];
  return v === null || v === undefined ? '' : v;
}

function guessTypeByCategory(category) {
  const c = norm(category);
  return INCOME_HINTS.some((hint) => c.includes(hint)) ? 'receita' : 'despesa';
}

/** Lê a planilha inteira e devolve o modelo normalizado. */
export async function readSheet(sheetId, preferredTab) {
  const meta = await getMeta(sheetId);
  const tabs = (meta.sheets || []).map((s) => s.properties).filter(Boolean);
  if (!tabs.length) throw new SheetError('A planilha não tem nenhuma aba.', 'schema');

  const scans = await batchGet(sheetId, tabs.map((t) => `${quote(t.title)}!A1:Z20`));

  const candidates = [];
  tabs.forEach((tab, i) => {
    (scans[i] || []).forEach((row, r) => {
      const mapping = detectMapping(row);
      const score = Object.keys(mapping).length;
      const core = mapping.valor !== undefined && mapping.data !== undefined;
      if (core && score >= 3) {
        candidates.push({ tab, headerRow: r + 1, mapping, score });
      }
    });
  });

  let best = null;
  if (preferredTab) best = candidates.find((c) => c.tab.title === preferredTab) || null;
  if (!best && candidates.length) {
    const maxScore = Math.max(...candidates.map((c) => c.score));
    const top = candidates.filter((c) => c.score === maxScore);
    best = top.find((c) => /lanc|moviment|transa|gasto|finan|extrato|caixa/i.test(c.tab.title)) || top[0];
  }

  if (!best) {
    const first = tabs[0];
    const rows = scans[0] || [];
    const isEmpty = rows.every((row) => !row || row.every((c) => String(c ?? '').trim() === ''));
    if (isEmpty) {
      await writeHeader(sheetId, first.title, CONFIG.columns);
      best = { tab: first, headerRow: 1, mapping: defaultMapping(), score: CONFIG.columns.length };
    } else {
      throw new SheetError(
        'Não encontrei as colunas "Data" e "Valor" nesta planilha. Confira se a primeira linha da aba tem os cabeçalhos: Data, Descrição, Categoria, Subcategoria, Tipo, Valor, Observação.',
        'schema'
      );
    }
  }

  const lastColumn = Math.max(...Object.values(best.mapping), 0) + 1;
  const rows = await getValues(sheetId, `${quote(best.tab.title)}!A${best.headerRow + 1}:${columnLetter(lastColumn)}`);

  const txs = [];
  let negative = 0;
  let positive = 0;
  const labelCount = { receita: new Map(), despesa: new Map() };

  rows.forEach((row, i) => {
    if (!row || row.every((c) => String(c ?? '').trim() === '')) return;

    const rawDate = cell(row, best.mapping, 'data');
    const rawValue = cell(row, best.mapping, 'valor');
    const rawType = cell(row, best.mapping, 'tipo');
    const rawCategory = String(cell(row, best.mapping, 'categoria') || '').trim();
    const description = String(cell(row, best.mapping, 'descricao') || '').trim();

    const signed = parseAmount(rawValue);
    const date = parseSheetDate(rawDate);
    if (!date && !signed && !description && !rawCategory) return;

    let type = parseTipo(rawType);
    if (!type) type = signed < 0 ? 'despesa' : guessTypeByCategory(rawCategory || description);

    if (type === 'despesa' && signed < 0) negative += 1;
    if (type === 'despesa' && signed > 0) positive += 1;

    const rawTypeLabel = String(rawType || '').trim();
    if (rawTypeLabel) {
      const bucket = labelCount[type];
      bucket.set(rawTypeLabel, (bucket.get(rawTypeLabel) || 0) + 1);
    }

    txs.push({
      row: best.headerRow + 1 + i,
      date: date || todayISO(),
      description: description || rawCategory || 'Sem descrição',
      category: rawCategory || 'Outros',
      subcategory: String(cell(row, best.mapping, 'subcategoria') || '').trim(),
      type,
      amount: Math.abs(signed),
      note: String(cell(row, best.mapping, 'observacao') || '').trim(),
      hasDate: Boolean(date),
    });
  });

  const pickLabel = (map, fallback) => {
    let bestLabel = fallback;
    let max = 0;
    map.forEach((count, label) => {
      if (count > max) { max = count; bestLabel = label; }
    });
    return bestLabel;
  };

  return {
    tab: best.tab.title,
    gid: best.tab.sheetId,
    headerRow: best.headerRow,
    mapping: best.mapping,
    lastColumn,
    txs,
    negativeExpenses: negative >= 2 && negative > positive * 1.5,
    tipoLabels: {
      receita: pickLabel(labelCount.receita, 'Receita'),
      despesa: pickLabel(labelCount.despesa, 'Despesa'),
    },
    meta: { title: meta.properties?.title || 'Planilha', locale: meta.properties?.locale || 'pt_BR' },
  };
}

function normalizeInput(input) {
  const amount = Math.abs(Number(input.amount) || 0);
  const type = input.type === 'receita' ? 'receita' : 'despesa';
  const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : todayISO();
  return {
    date,
    description: String(input.description || '').trim() || 'Sem descrição',
    category: String(input.category || '').trim() || 'Outros',
    subcategory: String(input.subcategory || '').trim(),
    type,
    amount,
    note: String(input.note || '').trim(),
  };
}

function seedDemo() {
  const rand = (seed) => {
    let t = seed + 0x6d2b79f5;
    return () => {
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const months = lastMonths(6, currentMonth());
  const txs = [];
  let n = 0;
  const add = (month, day, description, category, subcategory, type, amount, note = '') => {
    const max = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const d = Math.min(day, max);
    txs.push({
      row: ++n + 1,
      date: `${month}-${String(d).padStart(2, '0')}`,
      description, category, subcategory, type,
      amount: Math.round(amount * 100) / 100,
      note,
    });
  };

  months.forEach((month, index) => {
    const r = rand(index * 977 + 13);
    add(month, 5, 'Salário', 'Salário', 'CLT', 'receita', 8200 + index * 45);
    if (index % 2 === 0) add(month, 18, 'Projeto freelance', 'Freelance', 'Design', 'receita', 1400 + Math.round(r() * 1200));
    add(month, 10, 'Aluguel', 'Moradia', 'Aluguel', 'despesa', 2350);
    add(month, 10, 'Condomínio', 'Moradia', 'Condomínio', 'despesa', 480);
    add(month, 8, 'Internet fibra', 'Contas', 'Internet', 'despesa', 129.9);
    add(month, 12, 'Conta de luz', 'Contas', 'Energia', 'despesa', 165 + Math.round(r() * 110));
    add(month, 15, 'Streaming', 'Assinaturas', 'Streaming', 'despesa', 55.8);
    add(month, 20, 'Academia', 'Saúde', 'Academia', 'despesa', 119.9);
    add(month, 3, 'Supermercado', 'Alimentação', 'Mercado', 'despesa', 280 + Math.round(r() * 160));
    add(month, 12, 'Supermercado', 'Alimentação', 'Mercado', 'despesa', 240 + Math.round(r() * 180));
    add(month, 22, 'Supermercado', 'Alimentação', 'Mercado', 'despesa', 260 + Math.round(r() * 150));
    add(month, 7, 'Restaurante', 'Alimentação', 'Restaurante', 'despesa', 70 + Math.round(r() * 90));
    add(month, 19, 'Delivery', 'Alimentação', 'Delivery', 'despesa', 45 + Math.round(r() * 70));
    add(month, 6, 'Combustível', 'Transporte', 'Combustível', 'despesa', 180 + Math.round(r() * 90));
    add(month, 16, 'Aplicativo de transporte', 'Transporte', 'App', 'despesa', 40 + Math.round(r() * 60));
    if (index % 3 === 0) add(month, 24, 'Farmácia', 'Saúde', 'Farmácia', 'despesa', 65 + Math.round(r() * 80));
    if (index % 2 === 1) add(month, 25, 'Cinema e lazer', 'Lazer', 'Cinema', 'despesa', 90 + Math.round(r() * 120));
    if (index === 2 || index === 5) add(month, 27, 'Compra online', 'Compras', 'Vestuário', 'despesa', 190 + Math.round(r() * 260), 'Parcelado em 2x');
    add(month, 28, 'Rendimento CDB', 'Investimentos', 'Renda fixa', 'receita', 48 + Math.round(r() * 60));
  });

  return txs;
}

export class Store {
  constructor() {
    this.mode = null;
    this.sheetId = null;
    this.sheetUrl = null;
    this.sheetTitle = '';
    this.tab = null;
    this.gid = null;
    this.headerRow = 1;
    this.mapping = {};
    this.lastColumn = CONFIG.columns.length;
    this.txs = [];
    this.negativeExpenses = false;
    this.tipoLabels = { receita: 'Receita', despesa: 'Despesa' };
    this.syncing = false;
    this.lastSync = null;
    this.listeners = new Set();
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type = 'change') {
    for (const fn of this.listeners) {
      try { fn(type, this); } catch (err) { console.error(err); }
    }
  }

  get isDemo() {
    return this.mode === 'demo';
  }

  get ready() {
    return Boolean(this.mode);
  }

  async connect(sheetId) {
    this.mode = 'cloud';
    this.sheetId = sheetId;
    this.sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
    localStorage.setItem(CONFIG.storageKeys.sheet, JSON.stringify({ id: sheetId, url: this.sheetUrl }));
    await this.sync();
  }

  async create(title) {
    const { sheetId, url } = await createSpreadsheet(title, 'Lançamentos', CONFIG.columns);
    this.mode = 'cloud';
    this.sheetId = sheetId;
    this.sheetUrl = url;
    localStorage.setItem(CONFIG.storageKeys.sheet, JSON.stringify({ id: sheetId, url }));
    await this.sync();
    return { sheetId, url };
  }

  async sync({ silent = false } = {}) {
    if (this.mode !== 'cloud' || !this.sheetId) return;
    if (this.syncing) return;
    this.syncing = true;
    if (!silent) this.emit('sync-start');
    try {
      const data = await readSheet(this.sheetId, this.tab);
      this.tab = data.tab;
      this.gid = data.gid;
      this.headerRow = data.headerRow;
      this.mapping = data.mapping;
      this.lastColumn = data.lastColumn;
      this.txs = data.txs;
      this.negativeExpenses = data.negativeExpenses;
      this.tipoLabels = data.tipoLabels;
      this.applyTipoVocab();
      this.sheetTitle = data.meta.title;
      this.lastSync = new Date();
      this.emit('change');
    } finally {
      this.syncing = false;
      this.emit('sync-end');
    }
  }

  /** Vocabulário escolhido nas configurações: 'auto' | 'receita-despesa' | 'provento-gasto' */
  get tipoVocab() {
    const value = localStorage.getItem(CONFIG.storageKeys.tipoVocab) || 'auto';
    return CONFIG.tipoVocab[value] ? value : 'auto';
  }

  setTipoVocab(value) {
    if (!CONFIG.tipoVocab[value]) return;
    if (value === 'auto') localStorage.removeItem(CONFIG.storageKeys.tipoVocab);
    else localStorage.setItem(CONFIG.storageKeys.tipoVocab, value);
    this.applyTipoVocab();
    this.emit('change');
  }

  applyTipoVocab() {
    const forced = CONFIG.tipoVocab[this.tipoVocab];
    if (forced) this.tipoLabels = { ...forced };
  }

  loadDemo() {
    this.mode = 'demo';
    this.sheetTitle = 'Planilha de demonstração';
    this.tab = 'Lançamentos';
    this.lastColumn = CONFIG.columns.length;
    this.headerRow = 1;
    this.mapping = defaultMapping();
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(DEMO_TX) || 'null'); } catch { stored = null; }
    this.txs = Array.isArray(stored) && stored.length ? stored : seedDemo();
    this.persistDemo();
    this.lastSync = new Date();
    this.emit('change');
  }

  persistDemo() {
    if (!this.isDemo) return;
    try { localStorage.setItem(DEMO_TX, JSON.stringify(this.txs)); } catch { /* ignore */ }
  }

  resetDemo() {
    localStorage.removeItem(DEMO_TX);
    this.loadDemo();
  }

  disconnect() {
    this.mode = null;
    this.sheetId = null;
    this.sheetUrl = null;
    this.tab = null;
    this.txs = [];
    localStorage.removeItem(CONFIG.storageKeys.sheet);
    this.emit('change');
  }

  rowValues(tx, baseRow = []) {
    const values = new Array(this.lastColumn).fill('');
    for (let i = 0; i < baseRow.length && i < values.length; i++) values[i] = baseRow[i] ?? '';
    const set = (field, value) => {
      const idx = this.mapping[field];
      if (idx !== undefined && idx < values.length) values[idx] = value;
    };
    set('data', tx.date);
    set('descricao', tx.description);
    set('categoria', tx.category);
    set('subcategoria', tx.subcategory);
    set('tipo', this.tipoLabels[tx.type]);
    const signed = tx.type === 'despesa' && this.negativeExpenses ? -tx.amount : tx.amount;
    set('valor', Math.round(signed * 100) / 100);
    set('observacao', tx.note);
    return values;
  }

  async addTx(input) {
    const tx = normalizeInput(input);
    if (this.isDemo) {
      this.txs.push({ ...tx, row: this.txs.length + 2 });
      this.persistDemo();
      this.emit('change');
      return tx;
    }
    if (!this.sheetId) throw new SheetError('Nenhuma planilha conectada.', 'no-sheet');

    const optimistic = { ...tx, row: -1, temp: true };
    this.txs.push(optimistic);
    this.emit('change');
    try {
      await appendRow(this.sheetId, this.tab, this.rowValues(tx));
      await this.sync({ silent: true });
      return tx;
    } catch (err) {
      this.txs = this.txs.filter((t) => t !== optimistic);
      this.emit('change');
      throw err;
    }
  }

  async updateTx(row, input) {
    const tx = normalizeInput(input);
    if (this.isDemo) {
      const idx = this.txs.findIndex((t) => t.row === row);
      if (idx >= 0) this.txs[idx] = { ...this.txs[idx], ...tx };
      this.persistDemo();
      this.emit('change');
      return tx;
    }
    if (!this.sheetId) throw new SheetError('Nenhuma planilha conectada.', 'no-sheet');

    const raw = await getValues(this.sheetId, `${quote(this.tab)}!A${row}:${columnLetter(this.lastColumn)}${row}`);
    const current = raw[0] || [];
    const currentDate = parseSheetDate(cell(current, this.mapping, 'data'));
    const currentAmount = Math.abs(parseAmount(cell(current, this.mapping, 'valor')));
    const known = this.txs.find((t) => t.row === row);
    if (known && ((currentDate && currentDate !== known.date) || Math.abs(currentAmount - known.amount) > 0.005)) {
      await this.sync({ silent: true });
      throw new SheetError('A planilha mudou desde a última atualização. Confira os dados e tente novamente.', 'stale');
    }

    await updateRow(this.sheetId, this.tab, row, this.rowValues(tx, current), this.lastColumn);
    await this.sync({ silent: true });
    return tx;
  }

  async deleteTx(row) {
    if (this.isDemo) {
      this.txs = this.txs.filter((t) => t.row !== row);
      this.txs = this.txs.map((t, i) => ({ ...t, row: i + 2 }));
      this.persistDemo();
      this.emit('change');
      return;
    }
    if (!this.sheetId) throw new SheetError('Nenhuma planilha conectada.', 'no-sheet');
    const known = this.txs.find((t) => t.row === row);
    if (known) {
      const raw = await getValues(this.sheetId, `${quote(this.tab)}!A${row}:${columnLetter(this.lastColumn)}${row}`);
      const current = raw[0] || [];
      const currentDate = parseSheetDate(cell(current, this.mapping, 'data'));
      const currentAmount = Math.abs(parseAmount(cell(current, this.mapping, 'valor')));
      if ((currentDate && currentDate !== known.date) || Math.abs(currentAmount - known.amount) > 0.005) {
        await this.sync({ silent: true });
        throw new SheetError('A planilha mudou desde a última atualização. Confira os dados e tente novamente.', 'stale');
      }
    }
    await deleteRow(this.sheetId, this.gid, row);
    await this.sync({ silent: true });
  }

  categories(month) {
    const source = month ? this.txs.filter((t) => t.date.startsWith(month)) : this.txs;
    const map = new Map();
    source.forEach((t) => {
      const key = t.category || 'Outros';
      let item = map.get(key);
      if (!item) {
        item = { name: key, total: 0, count: 0, income: 0, expense: 0, subcategories: new Map(), types: { receita: 0, despesa: 0 } };
        map.set(key, item);
      }
      item.total += t.amount;
      item.count += 1;
      item.types[t.type] += 1;
      if (t.type === 'receita') item.income += t.amount;
      else item.expense += t.amount;
      if (t.subcategory) item.subcategories.set(t.subcategory, (item.subcategories.get(t.subcategory) || 0) + t.amount);
    });
    return [...map.values()].sort((a, b) => b.expense + b.income - (a.expense + a.income));
  }

  categoryNames(type) {
    const names = new Set();
    this.txs.forEach((t) => {
      if (!type || t.type === type) names.add(t.category);
    });
    (CONFIG.suggestions[type] || []).forEach((n) => names.add(n));
    return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  subcategoryNames(category, type) {
    const names = new Set();
    this.txs.forEach((t) => {
      if (t.subcategory && (!category || norm(t.category) === norm(category)) && (!type || t.type === type)) names.add(t.subcategory);
    });
    return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  exportRows() {
    return [
      CONFIG.columns,
      ...this.txs.map((t) => [
        t.date,
        t.description,
        t.category,
        t.subcategory,
        this.tipoLabels[t.type] || (t.type === 'receita' ? 'Receita' : 'Despesa'),
        t.type === 'despesa' && this.negativeExpenses ? -t.amount : t.amount,
        t.note,
      ]),
    ];
  }
}

export { SheetError };
