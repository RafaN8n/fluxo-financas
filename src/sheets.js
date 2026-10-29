import { getAccessToken, invalidateToken } from './auth.js';
import { columnLetter } from './utils.js';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export class SheetError extends Error {
  constructor(message, code = 'error', status = 0) {
    super(message);
    this.name = 'SheetError';
    this.code = code;
    this.status = status;
  }
}

async function api(path, { method = 'GET', params, body } = {}) {
  const url = new URL(API + path);
  if (params) {
    const sp = params instanceof URLSearchParams ? params : new URLSearchParams(params);
    sp.forEach((value, key) => url.searchParams.append(key, value));
  }

  const doFetch = async () => {
    let token;
    try {
      token = await getAccessToken();
    } catch {
      throw new SheetError('Sua sessão expirou. Entre novamente com o Google.', 'auth', 401);
    }
    return fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let res;
  try {
    res = await doFetch();
  } catch (err) {
    if (err instanceof SheetError) throw err;
    throw new SheetError('Sem conexão com o Google. Verifique sua internet.', 'network');
  }

  if (res.status === 401) {
    invalidateToken();
    try {
      res = await doFetch();
    } catch {
      throw new SheetError('Sessão expirada. Entre novamente com o Google.', 'auth', 401);
    }
  }

  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.error?.message || '';
    } catch { /* ignore */ }

    if (res.status === 401) throw new SheetError('Sessão expirada. Entre novamente com o Google.', 'auth', 401);
    if (res.status === 403) {
      throw new SheetError(
        detail.includes('permission') || detail.includes('Permission')
          ? 'Sua conta não tem permissão nesta planilha. Compartilhe-a com o e-mail que você usou para entrar.'
          : 'Acesso negado pelo Google. Verifique se a API do Google Sheets está ativada no seu projeto.',
        'permission',
        403
      );
    }
    if (res.status === 404) {
      throw new SheetError('Planilha não encontrada. Confira o link e se ela ainda existe.', 'notfound', 404);
    }
    if (res.status === 429) {
      throw new SheetError('Muitas requisições em pouco tempo. Aguarde alguns segundos e tente de novo.', 'rate', 429);
    }
    throw new SheetError(detail || `Erro ${res.status} na API do Google Sheets.`, 'api', res.status);
  }

  if (res.status === 204) return {};
  return res.json();
}

function quoteTab(tab) {
  return `'${String(tab).replace(/'/g, "''")}'`;
}

export async function getMeta(sheetId) {
  return api(`/${encodeURIComponent(sheetId)}`, {
    params: { fields: 'properties(title,locale,timeZone),sheets.properties(title,sheetId,index)' },
  });
}

export async function batchGet(sheetId, ranges) {
  const sp = new URLSearchParams({ valueRenderOption: 'UNFORMATTED_VALUE', majorDimension: 'ROWS' });
  ranges.forEach((r) => sp.append('ranges', r));
  const data = await api(`/${encodeURIComponent(sheetId)}/values:batchGet`, { params: sp });
  return (data.valueRanges || []).map((v) => v.values || []);
}

export async function getValues(sheetId, range) {
  const data = await api(`/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}`, {
    params: { valueRenderOption: 'UNFORMATTED_VALUE', majorDimension: 'ROWS' },
  });
  return data.values || [];
}

export async function appendRow(sheetId, tab, values) {
  const range = `${quoteTab(tab)}!A1`;
  return api(`/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}:append`, {
    method: 'POST',
    params: { valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS' },
    body: { values: [values] },
  });
}

export async function updateRow(sheetId, tab, rowIndex, values, lastColumn) {
  const range = `${quoteTab(tab)}!A${rowIndex}:${columnLetter(lastColumn)}${rowIndex}`;
  return api(`/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}`, {
    method: 'PUT',
    params: { valueInputOption: 'USER_ENTERED' },
    body: { values: [values] },
  });
}

export async function deleteRow(sheetId, gid, rowIndex) {
  return api(`/${encodeURIComponent(sheetId)}:batchUpdate`, {
    method: 'POST',
    body: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId: gid, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex },
          },
        },
      ],
    },
  });
}

export async function createSpreadsheet(title, tab, headers) {
  const data = await api('', {
    method: 'POST',
    body: {
      properties: { title, locale: 'pt_BR', timeZone: 'America/Sao_Paulo' },
      sheets: [{ properties: { title: tab } }],
    },
  });
  const sheetId = data.spreadsheetId;
  await api(`/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(`${quoteTab(tab)}!A1`)}`, {
    method: 'PUT',
    params: { valueInputOption: 'RAW' },
    body: { values: [headers] },
  });
  return { sheetId, url: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${sheetId}/edit` };
}

export async function writeHeader(sheetId, tab, headers) {
  await api(`/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(`${quoteTab(tab)}!A1`)}`, {
    method: 'PUT',
    params: { valueInputOption: 'RAW' },
    body: { values: [headers] },
  });
}
