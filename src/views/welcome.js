import { icon, googleIcon } from '../ui.js';
import { escapeHtml } from '../utils.js';

function brand() {
  return `<a class="brand" href="#/" aria-label="Fluxo — início">
    <span class="brand-mark">F</span>
    <span class="brand-name">Fluxo</span>
    <span class="brand-tag">finanças</span>
  </a>`;
}

function themeButton() {
  return `<button class="icon-btn" data-action="theme-toggle" aria-label="Alternar tema" title="Alternar tema">${icon('sun', 18)}</button>`;
}

function hero() {
  return `<section class="hero">
    <span class="hero-eyebrow">${icon('sheet', 14)} Google Sheets + Drive</span>
    <h1>Controle financeiro que mora <em>na sua planilha</em>.</h1>
    <p class="lead">Um painel completo para acompanhar receitas, despesas e categorias — sem mudar de ferramenta. Seus dados continuam no seu Google Drive, na planilha que já é sua.</p>
    <ul class="feature-list">
      <li>
        <span class="feature-ico">${icon('wallet', 17)}</span>
        <div><strong>Lançamentos em segundos</strong><span>Data, descrição, categoria, subcategoria, tipo, valor e observação — as mesmas colunas da sua planilha.</span></div>
      </li>
      <li>
        <span class="feature-ico">${icon('chart', 17)}</span>
        <div><strong>Visão clara do mês</strong><span>Saldo, evolução mensal e para onde o dinheiro está indo, com gráficos automáticos.</span></div>
      </li>
      <li>
        <span class="feature-ico">${icon('lock', 17)}</span>
        <div><strong>Sem servidor, sem cópia dos dados</strong><span>O app roda no seu navegador e conversa direto com a API do Google. Nada fica hospedado em outro lugar.</span></div>
      </li>
    </ul>
  </section>`;
}

export function howTo(clientId) {
  const origin = window.location.origin;
  return `<details class="howto">
    <summary>${icon('help', 14)} Como obter o Client ID (primeira vez)</summary>
    <ol>
      <li>Acesse <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">console.cloud.google.com</a> e crie um projeto (qualquer nome).</li>
      <li>Em <strong>APIs e serviços → Biblioteca</strong>, ative a <strong>Google Sheets API</strong>.</li>
      <li>Em <strong>Tela de consentimento OAuth</strong>, escolha <strong>Externo</strong>, preencha os dados e adicione seu e-mail em <strong>Usuários de teste</strong>.</li>
      <li>Em <strong>Credenciais → Criar credenciais → ID do cliente OAuth</strong>, escolha <strong>Aplicativo da Web</strong> e adicione esta origem em <strong>Origens JavaScript autorizadas</strong>:</li>
    </ol>
    <div class="origin-chip"><code>${escapeHtml(origin)}</code><button type="button" class="icon-btn sm" data-action="copy-origin" data-value="${escapeHtml(origin)}" aria-label="Copiar origem">${icon('copy', 14)}</button></div>
    <ol start="5" style="margin-top:10px">
      <li>Copie o Client ID gerado e cole no campo acima. Ele fica salvo só neste navegador.</li>
    </ol>
    ${clientId ? `<p style="margin-top:10px;font-size:12px;color:var(--muted)">Client ID atual: <code style="word-break:break-all">${escapeHtml(clientId)}</code></p>` : ''}
  </details>`;
}

function authStep({ clientId, error, busy }) {
  return `<div class="welcome-card">
    <h2>Entrar no Fluxo</h2>
    <p class="card-sub">Use a conta Google que tem acesso à sua planilha.</p>
    <div class="divider"></div>
    ${error ? `<div class="demo-banner" style="margin-bottom:14px">${icon('alert', 16)}<span>${escapeHtml(error)}</span></div>` : ''}
    <form id="form-client" class="grid" style="gap:10px">
      <div class="field">
        <label for="clientId">Client ID do Google (OAuth)</label>
        <input id="clientId" name="clientId" value="${escapeHtml(clientId || '')}" placeholder="000000000000-xxxxxxxx.apps.googleusercontent.com" autocomplete="off" spellcheck="false" />
        <p class="hint">${clientId ? 'Já configurado. Você pode trocar quando quiser.' : 'Configuração única, feita no Google Cloud. Veja o passo a passo abaixo.'}</p>
      </div>
      <button type="submit" class="btn btn-ghost btn-block">${clientId ? 'Salvar novo Client ID' : 'Salvar Client ID'}</button>
    </form>
    ${howTo(clientId)}
    <div class="divider"></div>
    <button class="btn btn-google btn-block btn-lg" data-action="signin" ${clientId ? '' : 'disabled'}>
      ${googleIcon(18)} Entrar com Google
    </button>
    <p class="hint" style="text-align:center;margin-top:10px;font-size:11.5px;color:var(--muted-2)">
      ${icon('lock', 12)} Acesso somente à API do Google Sheets. O app não vê seus arquivos.
    </p>
    <button class="demo-link" data-action="demo">Explorar com dados de demonstração</button>
  </div>`;
}

function sheetStep({ profile, savedSheet, error, busy }) {
  return `<div class="welcome-card">
    <h2>Escolha sua planilha</h2>
    <p class="card-sub">Conecte a planilha que já tem as colunas de lançamentos.</p>
    <div class="connection-card" style="margin:16px 0">
      <div class="c-icon">${icon('user', 19)}</div>
      <div class="c-text">
        <strong>${escapeHtml(profile?.name || 'Conta Google')}</strong>
        <span>${escapeHtml(profile?.email || '')}</span>
      </div>
      <button class="btn btn-ghost btn-sm" data-action="signout">Trocar</button>
    </div>
    ${error ? `<div class="demo-banner" style="margin-bottom:14px">${icon('alert', 16)}<span>${escapeHtml(error)}</span></div>` : ''}

    ${savedSheet ? `<button class="btn btn-primary btn-block btn-lg" data-action="resume-sheet">
      ${icon('refresh', 17)} Continuar na planilha conectada
    </button>
    <div class="divider"></div>` : ''}

    <form id="form-sheet" class="grid" style="gap:10px">
      <div class="field">
        <label for="sheetUrl">Link da planilha</label>
        <input id="sheetUrl" name="sheet" placeholder="https://docs.google.com/spreadsheets/d/..." autocomplete="off" spellcheck="false" />
        <p class="hint">Aba com cabeçalhos: Data, Descrição, Categoria, Subcategoria, Tipo, Valor, Observação.</p>
      </div>
      <button type="submit" class="btn btn-primary btn-block" ${busy ? 'disabled' : ''}>${icon('link', 16)} Conectar planilha</button>
    </form>

    <div class="divider"></div>
    <button class="btn btn-ghost btn-block" data-action="create-sheet">${icon('plus', 16)} Criar uma planilha nova</button>
    <p class="hint" style="text-align:center;margin-top:10px;font-size:11.5px;color:var(--muted-2)">
      A planilha nova é criada no seu Drive com as colunas certas, pronta para usar.
    </p>
    <button class="demo-link" data-action="demo">Explorar com dados de demonstração</button>
  </div>`;
}

export function renderWelcome(state) {
  const clientId = state.clientId;
  const step = state.welcomeStep;
  return `<div class="welcome">
    <header class="welcome-top">
      ${brand()}
      ${themeButton()}
    </header>
    <main class="welcome-main">
      ${hero()}
      ${step === 'sheet' ? sheetStep(state) : authStep(state)}
    </main>
    <footer class="welcome-foot">
      <strong>Fluxo</strong> · seus lançamentos ficam na sua planilha do Google Drive · v${escapeHtml('1.0.0')}
    </footer>
  </div>`;
}
