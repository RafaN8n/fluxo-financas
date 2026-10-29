import { CONFIG } from './config.js';
import * as auth from './auth.js';
import { Store, SheetError } from './store.js';
import * as ui from './ui.js';
import { renderWelcome, howTo } from './views/welcome.js';
import { renderDashboard } from './views/dashboard.js';
import { renderTransactions } from './views/transactions.js';
import { renderCategories } from './views/categories.js';
import { renderSettings } from './views/settings.js';
import {
  currentMonth, downloadFile, escapeHtml, fmtBRL, initials, monthLabel,
  parseAmount, parseSheetId, shiftMonth, toCSV, todayISO,
} from './utils.js';

const store = new Store();

const state = {
  view: 'dashboard',
  month: currentMonth(),
  filters: { q: '', type: 'all', category: 'all' },
  scope: 'month',
  limit: 120,
  catScope: 'month',
  theme: localStorage.getItem(CONFIG.storageKeys.theme) || 'system',
  profile: auth.savedProfile(),
  clientId: auth.getClientId(),
  welcomeStep: 'auth',
  welcomeError: '',
  savedSheet: readSavedSheet(),
  busy: false,
};

const TITLES = {
  dashboard: ['Visão geral', 'Seu mês em um só lugar'],
  transactions: ['Lançamentos', 'Receitas e despesas registradas'],
  categories: ['Categorias', 'Para onde o dinheiro está indo'],
  settings: ['Ajustes', 'Conexão, conta e preferências'],
};

const MONTH_VIEWS = new Set(['dashboard', 'transactions', 'categories']);

let activeModal = null;
let searchTimer = null;

/* ---------------- helpers ---------------- */

function readSavedSheet() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKeys.sheet);
    const data = raw ? JSON.parse(raw) : null;
    return data && data.id ? data : null;
  } catch {
    return null;
  }
}

function friendly(err) {
  if (!err) return 'Algo deu errado.';
  if (err instanceof SheetError || err.name === 'SheetError') return err.message;
  return err.message || String(err);
}

function applyTheme() {
  const resolved = state.theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : state.theme;
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#070c13' : '#0b6f5e');
}

function go(view) {
  if (!TITLES[view]) return;
  state.view = view;
  const hash = `#/${view}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function iconButton(name, action, label, extra = '') {
  return `<button class="icon-btn ${extra}" data-action="${action}" aria-label="${label}" title="${label}">${ui.icon(name, 18)}</button>`;
}

function monthNav() {
  return `<div class="month-nav">
    ${iconButton('chevronLeft', 'month-prev', 'Mês anterior')}
    <span class="month-label">${escapeHtml(monthLabel(state.month))}</span>
    ${iconButton('chevronRight', 'month-next', 'Próximo mês')}
    <button type="button" class="today-btn" data-action="month-today">Hoje</button>
  </div>`;
}

/* ---------------- render ---------------- */

function render() {
  applyTheme();
  if (!store.ready) {
    renderWelcomeScreen();
    return;
  }
  if (!document.querySelector('.shell')) buildShell();
  renderTopbar();
  renderView();
  updateNav();
}

function renderWelcomeScreen() {
  const app = document.getElementById('app');
  app.innerHTML = renderWelcome({
    step: state.welcomeStep,
    profile: state.profile,
    savedSheet: state.savedSheet,
    clientId: state.clientId,
    error: state.welcomeError,
    busy: state.busy,
  });
}

function buildShell() {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="shell">
    <aside class="sidebar" id="sidebar"></aside>
    <div class="main-wrap">
      <header class="topbar" id="topbar"></header>
      <main class="main" id="main">
        <div id="demo-slot"></div>
        <div class="view" id="view"></div>
      </main>
      <button class="fab" data-action="new-tx" aria-label="Novo lançamento" title="Novo lançamento">${ui.icon('plus', 24)}</button>
    </div>
  </div>`;
  window.addEventListener('scroll', () => {
    document.getElementById('topbar')?.classList.toggle('scrolled', window.scrollY > 6);
  }, { passive: true });
}

function renderSidebar() {
  const monthCount = store.txs.filter((t) => t.date.startsWith(state.month)).length;
  const navItems = [
    ['dashboard', 'dashboard', 'Visão geral', ''],
    ['transactions', 'list', 'Lançamentos', monthCount ? `<span class="badge-count">${monthCount}</span>` : ''],
    ['categories', 'tag', 'Categorias', ''],
  ];
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.innerHTML = `
    <a class="brand" href="#/dashboard" data-action="nav" data-view="dashboard">
      <span class="brand-mark">F</span>
      <span class="brand-name">Fluxo</span>
    </a>
    <nav class="nav" aria-label="Navegação principal">
      <span class="nav-label">Painel</span>
      ${navItems.map(([view, ico, label, badge]) => `<button class="nav-item" data-action="nav" data-view="${view}">${ui.icon(ico, 18)}<span>${label}</span>${badge}</button>`).join('')}
      <span class="nav-label">Sistema</span>
      <button class="nav-item" data-action="nav" data-view="settings">${ui.icon('settings', 18)}<span>Ajustes</span></button>
    </nav>
    <div class="sidebar-foot">
      ${
        store.isDemo
          ? `<div class="sheet-mini">${ui.icon('sparkles', 16)}<div class="sheet-mini-text"><strong>Demonstração</strong><span>dados locais</span></div></div>`
          : `<a class="sheet-mini" href="${escapeHtml(store.sheetUrl || '#')}" target="_blank" rel="noopener" title="Abrir planilha no Google Sheets">
              ${ui.icon('sheet', 16)}
              <div class="sheet-mini-text"><strong>${escapeHtml(store.sheetTitle || 'Planilha')}</strong><span>aba ${escapeHtml(store.tab || '—')}</span></div>
            </a>`
      }
      ${
        store.isDemo
          ? ''
          : `<button class="user-chip" data-action="nav" data-view="settings">
              <span class="avatar">${state.profile?.picture ? `<img src="${escapeHtml(state.profile.picture)}" alt="" referrerpolicy="no-referrer">` : escapeHtml(initials(state.profile?.name || 'Fluxo'))}</span>
              <span class="u-text">
                <span class="u-name">${escapeHtml(state.profile?.name || 'Conta Google')}</span>
                <span class="u-mail">${escapeHtml(state.profile?.email || 'conectada')}</span>
              </span>
              ${ui.icon('chevronRight', 15)}
            </button>`
      }
    </div>`;
}

function renderTopbar() {
  renderSidebar();
  const [title, subtitle] = TITLES[state.view] || TITLES.dashboard;
  const topbar = document.getElementById('topbar');
  if (!topbar) return;
  topbar.innerHTML = `
    <div class="topbar-titles">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(subtitle)}${state.view !== 'settings' ? ` · ${escapeHtml(monthLabel(state.month))}` : ''}</p>
    </div>
    <div class="topbar-actions">
      ${MONTH_VIEWS.has(state.view) ? monthNav() : ''}
      ${iconButton(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 'theme-toggle', 'Alternar tema', 'theme-btn')}
      ${iconButton('refresh', 'refresh', 'Sincronizar planilha')}
    </div>`;
}

function renderView() {
  const view = document.getElementById('view');
  if (!view) return;
  document.body.dataset.view = state.view;
  const active = document.activeElement;
  const focusId = active && active.id ? active.id : null;
  const caret = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;

  const slot = document.getElementById('demo-slot');
  if (slot) {
    slot.innerHTML = store.isDemo
      ? `<div class="view" style="padding-bottom:0"><div class="demo-banner">
          ${ui.icon('sparkles', 16)}
          <span><strong>Modo demonstração.</strong> Dados fictícios neste navegador — nada é gravado no Drive.</span>
          <button class="btn btn-ghost btn-sm" data-action="exit-demo">Conectar planilha</button>
        </div></div>`
      : '';
  }

  let html = '';
  if (state.view === 'dashboard') html = renderDashboard(store, state);
  else if (state.view === 'transactions') html = renderTransactions(store, state);
  else if (state.view === 'categories') html = renderCategories(store, state);
  else html = renderSettings(store, state);
  view.innerHTML = html;

  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) {
      el.focus({ preventScroll: true });
      if (caret !== null) {
        try { el.setSelectionRange(caret, caret); } catch { /* ignore */ }
      }
    }
  }
}

function updateNav() {
  document.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.view === state.view);
  });
}

/* ---------------- data actions ---------------- */

async function handleSignIn() {
  if (!auth.isConfigured()) {
    ui.toast('Informe o Client ID do Google primeiro.', 'error');
    return;
  }
  ui.busy(true);
  state.welcomeError = '';
  try {
    await auth.signIn();
    const profile = await auth.fetchProfile().catch(() => null);
    if (profile) {
      state.profile = profile;
      auth.saveProfile(profile);
    }
    state.welcomeStep = 'sheet';
    render();
  } catch (err) {
    state.welcomeError = friendly(err);
    render();
  } finally {
    ui.busy(false);
  }
}

async function connectSheet(id, { fromResume = false } = {}) {
  ui.busy(true);
  state.welcomeError = '';
  try {
    if (!auth.hasToken()) await auth.signIn();
    const profile = await auth.fetchProfile().catch(() => null);
    if (profile) {
      state.profile = profile;
      auth.saveProfile(profile);
    }
    await store.connect(id);
    state.savedSheet = { id, url: store.sheetUrl };
    state.demo = false;
    state.welcomeStep = 'sheet';
    go('dashboard');
    ui.toast(`Conectado a “${store.sheetTitle}”`);
  } catch (err) {
    const msg = friendly(err);
    if (err?.code === 'auth') {
      state.welcomeStep = 'auth';
      state.profile = null;
      auth.saveProfile(null);
    }
    state.welcomeError = msg;
    if (store.ready) {
      ui.toast(msg, 'error');
      render();
    } else {
      render();
    }
  } finally {
    ui.busy(false);
  }
}

async function handleRefresh({ silent = false } = {}) {
  if (store.isDemo) {
    if (!silent) ui.toast('Demonstração local — dados já atualizados.', 'info');
    return;
  }
  ui.busy(true);
  try {
    await store.sync();
    if (!silent) ui.toast('Planilha sincronizada.');
  } catch (err) {
    ui.toast(friendly(err), 'error');
    if (err?.code === 'auth') {
      store.disconnect();
      state.welcomeStep = 'auth';
      state.welcomeError = 'Sua sessão expirou. Entre novamente com o Google.';
      render();
    }
  } finally {
    ui.busy(false);
  }
}

function openTxModal(tx = null) {
  const isEdit = Boolean(tx);
  const type = tx?.type || 'despesa';
  const categories = store.categoryNames();
  const subs = store.subcategoryNames(tx?.category || '', type);

  const content = `<form id="form-tx" data-row="${tx ? tx.row : ''}" novalidate>
    <div class="form-grid">
      <div class="field span-2">
        <span class="field-label">Tipo</span>
        <div class="type-toggle" role="group" aria-label="Tipo do lançamento">
          <button type="button" data-set-type="despesa" data-type="despesa" class="${type === 'despesa' ? 'active' : ''}">${ui.icon('arrowUp', 15)} Despesa</button>
          <button type="button" data-set-type="receita" data-type="receita" class="${type === 'receita' ? 'active' : ''}">${ui.icon('arrowDown', 15)} Receita</button>
        </div>
        <input type="hidden" name="type" value="${type}" />
      </div>
      <div class="field">
        <label for="tx-date">Data</label>
        <input type="date" id="tx-date" name="date" value="${tx?.date || todayISO()}" required />
        <span class="field-error" data-error="date"></span>
      </div>
      <div class="field">
        <label for="tx-amount">Valor (R$)</label>
        <input type="text" id="tx-amount" name="amount" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${tx ? tx.amount.toFixed(2).replace('.', ',') : ''}" required />
        <span class="field-error" data-error="amount"></span>
      </div>
      <div class="field span-2">
        <label for="tx-desc">Descrição</label>
        <input type="text" id="tx-desc" name="description" maxlength="140" autocomplete="off" placeholder="Ex.: Supermercado, Salário, Aluguel…" value="${escapeHtml(tx?.description || '')}" required />
        <span class="field-error" data-error="description"></span>
      </div>
      <div class="field">
        <label for="tx-cat">Categoria</label>
        <input type="text" id="tx-cat" name="category" list="cat-options" autocomplete="off" placeholder="Ex.: Alimentação" value="${escapeHtml(tx?.category || '')}" />
      </div>
      <div class="field">
        <label for="tx-sub">Subcategoria</label>
        <input type="text" id="tx-sub" name="subcategory" list="sub-options" autocomplete="off" placeholder="Ex.: Mercado" value="${escapeHtml(tx?.subcategory || '')}" />
      </div>
      <div class="field span-2">
        <label for="tx-note">Observação</label>
        <input type="text" id="tx-note" name="note" maxlength="200" autocomplete="off" placeholder="Opcional" value="${escapeHtml(tx?.note || '')}" />
      </div>
    </div>
    <datalist id="cat-options">${categories.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('')}</datalist>
    <datalist id="sub-options">${subs.map((s) => `<option value="${escapeHtml(s)}"></option>`).join('')}</datalist>
  </form>`;

  activeModal = ui.openModal({
    title: isEdit ? 'Editar lançamento' : 'Novo lançamento',
    subtitle: store.isDemo ? 'Salvo apenas neste navegador (demonstração)' : `Grava direto na aba “${store.tab}”`,
    content,
    size: 'md',
    footer: `<button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button>
      <button type="submit" form="form-tx" class="btn btn-primary">${isEdit ? 'Salvar alterações' : 'Adicionar lançamento'}</button>`,
    onMount: (el) => {
      const form = el.querySelector('#form-tx');
      const catInput = form.elements.category;
      const subInput = form.elements.subcategory;

      const fillSubs = () => {
        const list = el.querySelector('#sub-options');
        list.innerHTML = store.subcategoryNames(catInput.value, form.elements.type.value)
          .map((s) => `<option value="${escapeHtml(s)}"></option>`)
          .join('');
      };

      el.querySelectorAll('[data-set-type]').forEach((btn) => {
        btn.addEventListener('click', () => {
          el.querySelectorAll('[data-set-type]').forEach((b) => b.classList.toggle('active', b === btn));
          form.elements.type.value = btn.dataset.setType;
          const list = el.querySelector('#cat-options');
          list.innerHTML = store.categoryNames(btn.dataset.setType).map((c) => `<option value="${escapeHtml(c)}"></option>`).join('');
          fillSubs();
        });
      });

      catInput.addEventListener('change', fillSubs);
      catInput.addEventListener('input', () => {
        if (!subInput.value) fillSubs();
      });
    },
  });
}

async function submitTx(form) {
  const data = {
    date: form.elements.date.value,
    description: form.elements.description.value.trim(),
    category: form.elements.category.value.trim() || 'Outros',
    subcategory: form.elements.subcategory.value.trim(),
    type: form.elements.type.value === 'receita' ? 'receita' : 'despesa',
    amount: parseAmount(form.elements.amount.value),
    note: form.elements.note.value.trim(),
  };

  ui.clearErrors(form);
  let ok = true;
  if (!data.date) { ui.fieldError(form, 'date', 'Informe a data.'); ok = false; }
  if (!(data.amount > 0)) { ui.fieldError(form, 'amount', 'Informe um valor maior que zero.'); ok = false; }
  if (!data.description) { ui.fieldError(form, 'description', 'Informe uma descrição.'); ok = false; }
  if (!ok) return;

  const row = form.dataset.row ? Number(form.dataset.row) : null;
  const submit = form.closest('.modal')?.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  ui.busy(true);
  try {
    if (row) await store.updateTx(row, data);
    else await store.addTx(data);
    activeModal?.close();
    ui.toast(row ? 'Lançamento atualizado.' : 'Lançamento adicionado.');
    render();
  } catch (err) {
    ui.toast(friendly(err), 'error');
    if (err?.code === 'stale') render();
  } finally {
    ui.busy(false);
    if (submit) submit.disabled = false;
  }
}

function openCreateSheetModal() {
  activeModal = ui.openModal({
    title: 'Criar planilha',
    subtitle: 'Uma planilha nova no seu Google Drive, já com as colunas certas.',
    size: 'sm',
    content: `<form id="form-new-sheet">
      <div class="field">
        <label for="new-sheet-name">Nome da planilha</label>
        <input type="text" id="new-sheet-name" name="name" value="Finanças ${new Date().getFullYear()}" maxlength="80" required />
        <p class="hint">Será criada na raiz do seu Drive com a aba “Lançamentos”.</p>
      </div>
    </form>`,
    footer: `<button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button>
      <button type="submit" form="form-new-sheet" class="btn btn-primary">Criar planilha</button>`,
  });
}

async function createSheet(form) {
  const name = form.elements.name.value.trim();
  if (!name) { ui.toast('Informe um nome para a planilha.', 'error'); return; }
  activeModal?.close();
  ui.busy(true);
  try {
    if (!auth.hasToken()) await auth.signIn();
    const { sheetId, url } = await store.create(name);
    state.savedSheet = { id: sheetId, url };
    const profile = await auth.fetchProfile().catch(() => null);
    if (profile) { state.profile = profile; auth.saveProfile(profile); }
    go('dashboard');
    ui.toast('Planilha criada e conectada.');
  } catch (err) {
    ui.toast(friendly(err), 'error');
    state.welcomeError = friendly(err);
    render();
  } finally {
    ui.busy(false);
  }
}

function openHelpModal() {
  activeModal = ui.openModal({
    title: 'Como configurar o Fluxo',
    subtitle: 'Passo a passo do Google Cloud (só na primeira vez)',
    size: 'lg',
    content: `<div style="font-size:13.5px;line-height:1.6;color:var(--muted)">
      <p style="margin-bottom:12px">O app precisa de um <strong style="color:var(--ink)">Client ID OAuth</strong> seu para falar com a API do Google Sheets sem depender de servidor.</p>
      ${howTo(auth.getClientId())}
      <div style="margin-top:18px;padding:12px 14px;background:var(--surface-2);border:1px solid var(--line);border-radius:10px">
        <strong style="color:var(--ink);display:block;margin-bottom:4px">Permissões usadas</strong>
        <code style="font-size:11.5px;word-break:break-all">${escapeHtml(CONFIG.scopes)}</code>
        <p style="margin-top:6px;font-size:12px">A permissão de planilhas é necessária para ler e gravar lançamentos. O app não acessa outros arquivos do Drive.</p>
      </div>
    </div>`,
    footer: `<button type="button" class="btn btn-ghost" data-modal-close>Fechar</button>`,
  });
}

function openClientModal() {
  activeModal = ui.openModal({
    title: 'Client ID do Google',
    subtitle: 'Salvo apenas neste navegador',
    size: 'sm',
    content: `<form id="form-client-modal">
      <div class="field">
        <label for="client-modal">Client ID OAuth</label>
        <input type="text" id="client-modal" name="clientId" value="${escapeHtml(auth.getClientId())}" autocomplete="off" spellcheck="false" />
      </div>
    </form>`,
    footer: `<button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button>
      <button type="submit" form="form-client-modal" class="btn btn-primary">Salvar</button>`,
  });
}

/* ---------------- events ---------------- */

function onAction(action, el) {
  switch (action) {
    case 'theme-toggle': {
      const resolved = document.documentElement.dataset.theme;
      state.theme = resolved === 'dark' ? 'light' : 'dark';
      localStorage.setItem(CONFIG.storageKeys.theme, state.theme);
      applyTheme();
      render();
      break;
    }
    case 'set-theme': {
      state.theme = el.dataset.value;
      localStorage.setItem(CONFIG.storageKeys.theme, state.theme);
      applyTheme();
      render();
      break;
    }
    case 'copy-origin': {
      navigator.clipboard?.writeText(el.dataset.value || window.location.origin)
        .then(() => ui.toast('Origem copiada.'))
        .catch(() => ui.toast('Não foi possível copiar. Copie manualmente.', 'error'));
      break;
    }
    case 'signin':
      handleSignIn();
      break;
    case 'signout': {
      auth.signOut();
      auth.saveProfile(null);
      state.profile = null;
      store.disconnect();
      state.welcomeStep = 'auth';
      state.welcomeError = '';
      state.savedSheet = readSavedSheet();
      render();
      break;
    }
    case 'resume-sheet': {
      const saved = state.savedSheet || readSavedSheet();
      if (!saved) { ui.toast('Nenhuma planilha salva.', 'error'); break; }
      connectSheet(saved.id, { fromResume: true });
      break;
    }
    case 'create-sheet':
      openCreateSheetModal();
      break;
    case 'demo': {
      store.loadDemo();
      state.demo = true;
      go('dashboard');
      ui.toast('Modo demonstração ativado.', 'info');
      break;
    }
    case 'exit-demo': {
      state.demo = false;
      state.welcomeStep = auth.hasToken() ? 'sheet' : 'auth';
      state.savedSheet = readSavedSheet();
      store.disconnect();
      render();
      break;
    }
    case 'reset-demo': {
      store.resetDemo();
      ui.toast('Dados de demonstração recriados.');
      render();
      break;
    }
    case 'nav':
      go(el.dataset.view);
      break;
    case 'month-prev':
      state.month = shiftMonth(state.month, -1);
      state.limit = 120;
      render();
      break;
    case 'month-next':
      state.month = shiftMonth(state.month, 1);
      state.limit = 120;
      render();
      break;
    case 'month-today':
      state.month = currentMonth();
      state.limit = 120;
      render();
      break;
    case 'new-tx':
      openTxModal();
      break;
    case 'edit-tx': {
      const row = Number(el.dataset.row);
      const tx = store.txs.find((t) => t.row === row);
      if (tx) openTxModal(tx);
      break;
    }
    case 'delete-tx': {
      const row = Number(el.dataset.row);
      const tx = store.txs.find((t) => t.row === row);
      if (!tx) break;
      ui.confirmDialog({
        title: 'Excluir lançamento?',
        message: `“${tx.description}” (${fmtBRL(tx.amount)}) será removido da planilha. Essa ação não pode ser desfeita.`,
        confirmLabel: 'Excluir',
        danger: true,
      }).then(async (ok) => {
        if (!ok) return;
        ui.busy(true);
        try {
          await store.deleteTx(row);
          ui.toast('Lançamento excluído.');
          render();
        } catch (err) {
          ui.toast(friendly(err), 'error');
        } finally {
          ui.busy(false);
        }
      });
      break;
    }
    case 'scope':
      state.scope = el.dataset.value;
      state.limit = 120;
      renderView();
      break;
    case 'cat-scope':
      state.catScope = el.dataset.value;
      renderView();
      break;
    case 'more':
      state.limit += 120;
      renderView();
      break;
    case 'clear-filters':
      state.filters = { q: '', type: 'all', category: 'all' };
      state.scope = 'month';
      state.limit = 120;
      renderView();
      break;
    case 'refresh':
      handleRefresh();
      break;
    case 'export-csv': {
      const rows = store.exportRows();
      downloadFile(`fluxo-${todayISO()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
      ui.toast('CSV exportado.');
      break;
    }
    case 'disconnect': {
      ui.confirmDialog({
        title: 'Desconectar planilha?',
        message: 'O app deixará de acessar a planilha neste navegador. Nenhum dado é apagado do Google Drive.',
        confirmLabel: 'Desconectar',
        danger: true,
      }).then((ok) => {
        if (!ok) return;
        store.disconnect();
        state.savedSheet = null;
        state.welcomeStep = auth.hasToken() ? 'sheet' : 'auth';
        render();
      });
      break;
    }
    case 'change-client':
      openClientModal();
      break;
    case 'help':
      openHelpModal();
      break;
    default:
      break;
  }
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  // Não dispara navegação de linha quando o clique foi em um botão de ação
  if (el.dataset.action === 'edit-tx' && e.target.closest('[data-action="delete-tx"]')) return;
  if (el.tagName === 'A' && el.getAttribute('href')?.startsWith('http')) return;
  e.preventDefault();
  onAction(el.dataset.action, el);
});

document.addEventListener('submit', (e) => {
  const form = e.target;
  if (form.id === 'form-client') {
    e.preventDefault();
    const value = form.elements.clientId.value.trim();
    if (!value) { ui.toast('Informe o Client ID.', 'error'); return; }
    auth.setClientId(value);
    state.clientId = auth.getClientId();
    state.welcomeError = '';
    ui.toast('Client ID salvo.');
    render();
    return;
  }
  if (form.id === 'form-client-modal') {
    e.preventDefault();
    const value = form.elements.clientId.value.trim();
    auth.setClientId(value);
    state.clientId = auth.getClientId();
    activeModal?.close();
    ui.toast('Client ID atualizado.');
    render();
    return;
  }
  if (form.id === 'form-sheet') {
    e.preventDefault();
    const id = parseSheetId(form.elements.sheet.value);
    if (!id) { ui.toast('Cole o link completo da planilha do Google Sheets.', 'error'); return; }
    connectSheet(id);
    return;
  }
  if (form.id === 'form-new-sheet') {
    e.preventDefault();
    createSheet(form);
    return;
  }
  if (form.id === 'form-tx') {
    e.preventDefault();
    submitTx(form);
  }
});

document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-filter]');
  if (!el) return;
  state.filters[el.dataset.filter] = el.value;
  state.limit = 120;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => renderView(), 170);
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('select[data-filter]');
  if (!el) return;
  state.filters[el.dataset.filter] = el.value;
  state.limit = 120;
  renderView();
});

document.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (!store.ready) return;
  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    openTxModal();
  }
  if (e.key === '/') {
    e.preventDefault();
    const search = document.getElementById('tx-search');
    if (search) search.focus();
    else go('transactions');
  }
});

window.addEventListener('hashchange', () => {
  const view = (location.hash || '').replace(/^#\/?/, '');
  if (TITLES[view] && view !== state.view) {
    state.view = view;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && store.ready && !store.isDemo) {
    const last = store.lastSync ? Date.now() - store.lastSync.getTime() : Infinity;
    if (last > 60000) handleRefresh({ silent: true });
  }
});

store.on((type) => {
  if (type === 'change') render();
  if (type === 'sync-start') ui.busy(true);
  if (type === 'sync-end') ui.busy(false);
});

/* ---------------- boot ---------------- */

(function boot() {
  applyTheme();
  const view = (location.hash || '').replace(/^#\/?/, '');
  if (TITLES[view]) state.view = view;

  if (state.profile) state.welcomeStep = 'sheet';

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'system') applyTheme();
  });

  // Link de demonstração: /?demo=1
  if (new URLSearchParams(location.search).get('demo') === '1') {
    state.demo = true;
    store.loadDemo();
  }

  render();
})();
