import { CONFIG } from './config.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

let tokenClient = null;
let token = null;
let expiresAt = 0;
let pending = null;
let gisPromise = null;

export function getClientId() {
  return (localStorage.getItem(CONFIG.storageKeys.clientId) || CONFIG.defaultClientId || '').trim();
}

export function setClientId(id) {
  const value = String(id || '').trim();
  if (value) localStorage.setItem(CONFIG.storageKeys.clientId, value);
  else localStorage.removeItem(CONFIG.storageKeys.clientId);
  reset();
}

export function isConfigured() {
  return Boolean(getClientId());
}

export function hasToken() {
  return Boolean(token) && Date.now() < expiresAt;
}

export function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisPromise = null;
      reject(new Error('Não foi possível carregar o login do Google. Verifique sua conexão.'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

function reset() {
  tokenClient = null;
  token = null;
  expiresAt = 0;
  pending = null;
}

function ensureClient() {
  const clientId = getClientId();
  if (!clientId) throw new Error('Informe o Client ID do Google para continuar.');
  if (tokenClient) return tokenClient;

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: CONFIG.scopes,
    include_granted_scopes: true,
    callback: (resp) => {
      if (resp.error) {
        pending?.reject(new Error(friendlyError(resp.error)));
        pending = null;
        return;
      }
      token = resp.access_token;
      expiresAt = Date.now() + Math.max(30, (Number(resp.expires_in) || 3600) - 90) * 1000;
      pending?.resolve(token);
      pending = null;
    },
    error_callback: (err) => {
      pending?.reject(new Error(friendlyError(err?.type || err?.message || 'unknown')));
      pending = null;
    },
  });
  return tokenClient;
}

function friendlyError(code) {
  const c = String(code || '');
  if (c.includes('popup_closed')) return 'Login cancelado. Tente novamente.';
  if (c.includes('access_denied')) return 'Acesso não autorizado.';
  if (c.includes('popup_failed')) return 'O navegador bloqueou a janela de login. Permita pop-ups e tente de novo.';
  if (c.includes('idpiframe')) return 'Falha no login. Verifique se o domínio está autorizado no Google Cloud.';
  return 'Não foi possível entrar com o Google (' + c + ').';
}

/**
 * Pede um token de acesso. interactive=true mostra a tela do Google.
 */
export async function requestToken({ interactive = false } = {}) {
  if (hasToken() && !interactive) return token;
  await loadGis();
  const client = ensureClient();

  if (pending) {
    // Já existe um pedido em andamento — reaproveita
    return new Promise((resolve, reject) => {
      const prevResolve = pending.resolve;
      const prevReject = pending.reject;
      pending.resolve = (t) => { prevResolve(t); resolve(t); };
      pending.reject = (e) => { prevReject(e); reject(e); };
    });
  }

  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    try {
      client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
    } catch (err) {
      pending = null;
      reject(err);
    }
  });
}

export async function signIn() {
  const t = await requestToken({ interactive: true });
  return t;
}

export function signOut() {
  if (token && window.google?.accounts?.oauth2) {
    try { window.google.accounts.oauth2.revoke(token, () => {}); } catch { /* ignore */ }
  }
  reset();
}

export async function getAccessToken() {
  if (hasToken()) return token;
  return requestToken({ interactive: false });
}

export function invalidateToken() {
  token = null;
  expiresAt = 0;
}

/** Perfil básico via endpoint userinfo (escopos openid/email/profile). */
export async function fetchProfile() {
  const t = await getAccessToken();
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { name: data.name || data.email || 'Conta Google', email: data.email || '', picture: data.picture || '' };
}

export function savedProfile() {
  try { return JSON.parse(localStorage.getItem(CONFIG.storageKeys.user) || 'null'); } catch { return null; }
}

export function saveProfile(profile) {
  if (profile) localStorage.setItem(CONFIG.storageKeys.user, JSON.stringify(profile));
  else localStorage.removeItem(CONFIG.storageKeys.user);
}
