// Configuração do app. O Client ID pode ser definido aqui ou pela própria interface.
export const CONFIG = {
  appName: 'Fluxo',
  version: '1.0.0',
  // Cole aqui o Client ID OAuth (Google Cloud → Credenciais → ID do cliente OAuth).
  // Também é possível informar pela tela inicial; o valor fica salvo no navegador.
  defaultClientId: '',
  scopes: 'openid email profile https://www.googleapis.com/auth/spreadsheets',
  // Colunas esperadas na planilha (ordem padrão para planilhas criadas pelo app)
  columns: ['Data', 'Descrição', 'Categoria', 'Subcategoria', 'Tipo', 'Valor', 'Observação'],
  storageKeys: {
    clientId: 'fluxo.clientId',
    sheet: 'fluxo.sheet',
    user: 'fluxo.user',
    theme: 'fluxo.theme',
    demo: 'fluxo.demo',
    tipoVocab: 'fluxo.tipoVocab',
  },
  // Vocabulário gravado na coluna "Tipo". "auto" reaproveita os rótulos que já
  // existem na planilha; as demais opções forçam um par fixo.
  tipoVocab: {
    auto: null,
    'receita-despesa': { receita: 'Receita', despesa: 'Despesa' },
    'provento-gasto': { receita: 'Provento', despesa: 'Gasto' },
  },
  // Categorias sugeridas (apenas autocomplete — nada é gravado na planilha)
  suggestions: {
    despesa: ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Compras', 'Assinaturas', 'Contas', 'Impostos', 'Outros'],
    receita: ['Salário', 'Freelance', 'Investimentos', 'Reembolso', 'Presente', 'Outros'],
  },
};
