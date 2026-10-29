import { icon } from '../ui.js';
import { CONFIG } from '../config.js';
import { columnLetter, escapeHtml, fmtBRL, initials, monthLabel } from '../utils.js';
import { totals } from '../stats.js';

function themeOption(value, label, current) {
  return `<button type="button" data-action="set-theme" data-value="${value}" class="${current === value ? 'active' : ''}">${label}</button>`;
}

export function renderSettings(store, state) {
  const profile = state.profile;
  const all = totals(store.txs);
  const lastSync = store.lastSync ? store.lastSync.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
  const fieldLabels = { data: 'Data', descricao: 'Descrição', categoria: 'Categoria', subcategoria: 'Subcategoria', tipo: 'Tipo', valor: 'Valor', observacao: 'Observação' };
  const mapped = Object.entries(store.mapping || {})
    .sort((a, b) => a[1] - b[1])
    .map(([field, index]) => `${columnLetter(index + 1)} → ${fieldLabels[field] || field}`)
    .join(' · ');

  return `<div class="settings-grid">
    <section class="card">
      <div class="card-head"><div><h2>Conexão com a planilha</h2><p>Origem dos dados deste painel</p></div></div>
      <div class="card-body">
        ${
          store.isDemo
            ? `<div class="connection-card">
                <div class="c-icon">${icon('sparkles', 20)}</div>
                <div class="c-text"><strong>Modo demonstração</strong><span>Dados fictícios salvos apenas neste navegador</span></div>
                <button class="btn btn-primary btn-sm" data-action="exit-demo">Conectar planilha</button>
              </div>`
            : `<div class="connection-card">
                <div class="c-icon">${icon('sheet', 20)}</div>
                <div class="c-text">
                  <strong>${escapeHtml(store.sheetTitle || 'Planilha conectada')}</strong>
                  <span><span class="status-dot"></span>Aba ${escapeHtml(store.tab || '—')} · atualizado às ${lastSync}</span>
                </div>
                <a class="btn btn-ghost btn-sm" href="${escapeHtml(store.sheetUrl || '#')}" target="_blank" rel="noopener">${icon('external', 15)} Abrir</a>
              </div>
              <dl class="kv" style="margin-top:18px">
                <dt>Planilha</dt><dd>${escapeHtml(store.sheetTitle || '—')}</dd>
                <dt>Aba usada</dt><dd>${escapeHtml(store.tab || '—')}</dd>
                <dt>Linha do cabeçalho</dt><dd>${store.headerRow}</dd>
                <dt>Colunas detectadas</dt><dd style="font-size:12px;color:var(--muted)">${escapeHtml(mapped)}</dd>
                <dt>Lançamentos</dt><dd>${store.txs.length} · saldo ${fmtBRL(all.balance)}</dd>
              </dl>`
        }
        <div class="setting-row">
          <div class="s-text"><h3>Sincronizar agora</h3><p>Relê a planilha e atualiza o painel.</p></div>
          <div class="s-action"><button class="btn btn-ghost btn-sm" data-action="refresh">${icon('refresh', 15)} Atualizar</button></div>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><div><h2>Conta Google</h2><p>Usada para acessar a planilha</p></div></div>
      <div class="card-body">
        ${
          store.isDemo
            ? `<div class="connection-card">
                <div class="c-icon">${icon('user', 19)}</div>
                <div class="c-text"><strong>Nenhuma conta conectada</strong><span>Você está explorando dados de demonstração</span></div>
                <button class="btn btn-primary btn-sm" data-action="exit-demo">Conectar</button>
              </div>`
            : `<div class="connection-card">
                <div class="avatar" style="width:40px;height:40px;font-size:13px">${
                  profile?.picture ? `<img src="${escapeHtml(profile.picture)}" alt="" referrerpolicy="no-referrer">` : escapeHtml(initials(profile?.name || '?'))
                }</div>
                <div class="c-text"><strong>${escapeHtml(profile?.name || 'Conta Google')}</strong><span>${escapeHtml(profile?.email || '')}</span></div>
                <button class="btn btn-ghost btn-sm" data-action="signout">${icon('logout', 15)} Sair</button>
              </div>`
        }
        <div class="setting-row">
          <div class="s-text"><h3>Client ID OAuth</h3><p style="word-break:break-all">${escapeHtml(state.clientId || 'não configurado')}</p></div>
          <div class="s-action"><button class="btn btn-ghost btn-sm" data-action="change-client">Alterar</button></div>
        </div>
        <div class="setting-row">
          <div class="s-text"><h3>Ajuda de configuração</h3><p>Passo a passo do Google Cloud e permissões.</p></div>
          <div class="s-action"><button class="btn btn-ghost btn-sm" data-action="help">${icon('help', 15)} Ver</button></div>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><div><h2>Planilha</h2><p>Como o app lê e grava os lançamentos</p></div></div>
      <div class="card-body">
        <div class="setting-row" style="padding-top:0">
          <div class="s-text">
            <h3>Vocabulário do campo “Tipo”</h3>
            <p>Rótulos gravados nas novas linhas. Hoje: <strong>${escapeHtml(store.tipoLabels.despesa)}</strong> / <strong>${escapeHtml(store.tipoLabels.receita)}</strong>.</p>
          </div>
          <div class="s-action">
            <div class="segmented" role="group" aria-label="Vocabulário do campo Tipo">
              ${[
                ['auto', 'Automático'],
                ['receita-despesa', 'Receita/Despesa'],
                ['provento-gasto', 'Provento/Gasto'],
              ]
                .map(([value, label]) => `<button type="button" data-action="set-tipo-vocab" data-value="${value}" class="${store.tipoVocab === value ? 'active' : ''}">${label}</button>`)
                .join('')}
            </div>
          </div>
        </div>
        ${
          store.negativeExpenses
            ? `<div class="setting-row">
                <div class="s-text"><h3>Despesas em negativo</h3><p>Detectamos que sua planilha grava despesas com sinal negativo. O app mantém essa convenção.</p></div>
                <div class="s-action"><span class="pill">Ativo</span></div>
              </div>`
            : ''
        }
      </div>
    </section>

    <section class="card">
      <div class="card-head"><div><h2>Aparência</h2><p>Tema do painel</p></div></div>
      <div class="card-body">
        <div class="setting-row" style="border-bottom:0;padding-top:0">
          <div class="s-text"><h3>Tema</h3><p>Claro, escuro ou seguindo o sistema.</p></div>
          <div class="s-action">
            <div class="segmented" role="group" aria-label="Tema">
              ${themeOption('light', 'Claro', state.theme)}
              ${themeOption('dark', 'Escuro', state.theme)}
              ${themeOption('system', 'Sistema', state.theme)}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><div><h2>Dados</h2><p>Exportar e manter uma cópia</p></div></div>
      <div class="card-body">
        <div class="setting-row" style="padding-top:0">
          <div class="s-text"><h3>Exportar CSV</h3><p>${store.txs.length} lançamentos no formato da sua planilha.</p></div>
          <div class="s-action"><button class="btn btn-ghost btn-sm" data-action="export-csv">${icon('download', 15)} Baixar</button></div>
        </div>
        ${
          store.isDemo
            ? `<div class="setting-row">
                <div class="s-text"><h3>Reiniciar demonstração</h3><p>Gera novamente os dados de exemplo.</p></div>
                <div class="s-action"><button class="btn btn-ghost btn-sm" data-action="reset-demo">${icon('refresh', 15)} Reiniciar</button></div>
              </div>`
            : `<div class="setting-row">
                <div class="s-text"><h3>Desconectar planilha</h3><p>O app para de acessar a planilha. Nenhum dado é apagado.</p></div>
                <div class="s-action"><button class="btn btn-outline-danger btn-sm" data-action="disconnect">Desconectar</button></div>
              </div>`
        }
      </div>
    </section>

    <section class="card">
      <div class="card-head"><div><h2>Sobre</h2></div></div>
      <div class="card-body">
        <dl class="kv">
          <dt>Versão</dt><dd>${CONFIG.version}</dd>
          <dt>Armazenamento</dt><dd>${store.isDemo ? 'Navegador (localStorage)' : 'Google Sheets (sua conta)'}</dd>
          <dt>Hospedagem</dt><dd>GitHub Pages</dd>
          <dt>Mês de referência</dt><dd>${escapeHtml(monthLabel(state.month))}</dd>
        </dl>
        <p style="margin-top:14px;font-size:12.5px;color:var(--muted);display:flex;gap:8px;align-items:flex-start">
          ${icon('lock', 15)} O Fluxo não tem servidor nem banco de dados próprio. Seu navegador conversa direto com a API do Google usando o token da sua sessão — nada é enviado para terceiros.
        </p>
      </div>
    </section>
  </div>`;
}
