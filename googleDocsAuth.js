const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

const GOOGLE_DOCS_SCOPES = ['https://www.googleapis.com/auth/documents'];
const GOOGLE_DESKTOP_CONFIG_FILENAMES = [
  'google-docs-config.json',
  'google-docs-config.local.json',
];
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const AUTH_TIMEOUT_MS = 180000;
const ACCESS_TOKEN_SKEW_MS = 60000;

class GoogleDocsAuthError extends Error {
  constructor(message, { code = 'google_docs_auth_error', userMessage = '' } = {}) {
    super(message);
    this.name = 'GoogleDocsAuthError';
    this.code = code;
    this.userMessage = userMessage || message;
  }
}

function toBase64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createPkcePair() {
  const verifier = toBase64Url(crypto.randomBytes(32));
  const challenge = toBase64Url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function readJsonIfExists(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function getGoogleDocsClientConfig({ appPath = '', userDataPath = '' } = {}) {
  const envClientId =
    String(process.env.FAVORITE_EATS_GOOGLE_CLIENT_ID || '').trim() ||
    String(process.env.GOOGLE_DOCS_CLIENT_ID || '').trim();
  if (envClientId) {
    return {
      clientId: envClientId,
      scopes: GOOGLE_DOCS_SCOPES.slice(),
      source: 'environment',
    };
  }

  const candidateDirs = [appPath, userDataPath].filter(Boolean);
  for (const dirPath of candidateDirs) {
    for (const filename of GOOGLE_DESKTOP_CONFIG_FILENAMES) {
      const config = readJsonIfExists(path.join(dirPath, filename));
      const clientId = String(config?.clientId || '').trim();
      if (!clientId) continue;
      return {
        clientId,
        scopes:
          Array.isArray(config?.scopes) && config.scopes.length
            ? config.scopes.map((value) => String(value || '').trim()).filter(Boolean)
            : GOOGLE_DOCS_SCOPES.slice(),
        source: filename,
      };
    }
  }

  throw new GoogleDocsAuthError('Missing Google Docs OAuth client configuration.', {
    code: 'google_docs_not_configured',
    userMessage:
      'Google Docs export is not configured. Add a desktop OAuth client ID in `google-docs-config.json` or set `FAVORITE_EATS_GOOGLE_CLIENT_ID`.',
  });
}

function normalizePersistedAuth(auth) {
  if (!auth || typeof auth !== 'object') return null;
  const accessToken = String(auth.accessToken || '').trim();
  const refreshToken = String(auth.refreshToken || '').trim();
  const tokenType = String(auth.tokenType || 'Bearer').trim() || 'Bearer';
  const scope = String(auth.scope || '').trim();
  const expiresAt = Number(auth.expiresAt);
  if (!accessToken && !refreshToken) return null;
  return {
    accessToken,
    refreshToken,
    tokenType,
    scope,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0,
  };
}

function isAccessTokenFresh(auth) {
  if (!auth || !String(auth.accessToken || '').trim()) return false;
  const expiresAt = Number(auth.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt - ACCESS_TOKEN_SKEW_MS > Date.now();
}

async function postGoogleTokenForm(params) {
  if (typeof fetch !== 'function') {
    throw new GoogleDocsAuthError('Global fetch is unavailable in Electron main.', {
      code: 'google_docs_network_unavailable',
      userMessage: 'Google Docs export is unavailable because network support is missing.',
    });
  }
  const body = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null) return;
    body.set(key, String(value));
  });
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const description = String(data?.error_description || data?.error || '').trim();
    throw new GoogleDocsAuthError(
      `Google token endpoint rejected the request (${response.status}). ${description}`.trim(),
      {
        code: 'google_docs_token_exchange_failed',
        userMessage: description || 'Google sign-in failed. Please try again.',
      },
    );
  }
  return data;
}

function makeStoredAuth(tokenResponse, previousAuth = null) {
  const previous = normalizePersistedAuth(previousAuth);
  const accessToken = String(tokenResponse?.access_token || '').trim();
  const refreshToken =
    String(tokenResponse?.refresh_token || '').trim() || String(previous?.refreshToken || '').trim();
  const expiresInSeconds = Number(tokenResponse?.expires_in);
  const expiresAt = Number.isFinite(expiresInSeconds)
    ? Date.now() + expiresInSeconds * 1000
    : Number(previous?.expiresAt) || 0;
  return {
    accessToken,
    refreshToken,
    tokenType: String(tokenResponse?.token_type || previous?.tokenType || 'Bearer').trim() || 'Bearer',
    scope: String(tokenResponse?.scope || previous?.scope || '').trim(),
    expiresAt,
  };
}

async function refreshGoogleDocsAccessToken({ clientId, persistedAuth }) {
  const currentAuth = normalizePersistedAuth(persistedAuth);
  const refreshToken = String(currentAuth?.refreshToken || '').trim();
  if (!refreshToken) {
    throw new GoogleDocsAuthError('No Google Docs refresh token is available.', {
      code: 'google_docs_no_refresh_token',
      userMessage: 'Google Docs sign-in is required before exporting.',
    });
  }
  const tokenResponse = await postGoogleTokenForm({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  return makeStoredAuth(tokenResponse, currentAuth);
}

async function requestAuthorizationCode({ clientId, scopes, openExternal, existingAuth = null }) {
  const state = toBase64Url(crypto.randomBytes(24));
  const { verifier, challenge } = createPkcePair();

  let codeResolve;
  let codeReject;
  const codePromise = new Promise((resolve, reject) => {
    codeResolve = resolve;
    codeReject = reject;
  });

  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const params = requestUrl.searchParams;
    const code = String(params.get('code') || '').trim();
    const incomingState = String(params.get('state') || '').trim();
    const error = String(params.get('error') || '').trim();

    const respond = (html) => {
      try {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(html);
      } catch (_) {}
      try {
        server.close();
      } catch (_) {}
    };

    if (error) {
      respond('<!doctype html><title>Baby Eats</title><p>Google sign-in was cancelled. You can return to Baby Eats.</p>');
      codeReject(
        new GoogleDocsAuthError(`Google authorization failed: ${error}`, {
          code: error === 'access_denied' ? 'google_docs_auth_cancelled' : 'google_docs_auth_error',
          userMessage:
            error === 'access_denied'
              ? 'Google sign-in was cancelled.'
              : 'Google sign-in failed. Please try again.',
        }),
      );
      return;
    }

    if (!code || incomingState !== state) {
      respond('<!doctype html><title>Baby Eats</title><p>The Google sign-in response was invalid. You can close this tab.</p>');
      codeReject(
        new GoogleDocsAuthError('Google authorization callback state mismatch.', {
          code: 'google_docs_auth_state_mismatch',
          userMessage: 'Google sign-in returned an invalid response. Please try again.',
        }),
      );
      return;
    }

    respond('<!doctype html><title>Baby Eats</title><p>Google sign-in is complete. You can return to Baby Eats.</p>');
    codeResolve(code);
  });

  const timeout = setTimeout(() => {
    try {
      server.close();
    } catch (_) {}
    codeReject(
      new GoogleDocsAuthError('Timed out waiting for Google sign-in.', {
        code: 'google_docs_auth_timeout',
        userMessage: 'Google sign-in timed out. Please try again.',
      }),
    );
  }, AUTH_TIMEOUT_MS);

  return new Promise((resolve, reject) => {
    server.on('error', (err) => {
      clearTimeout(timeout);
      reject(
        new GoogleDocsAuthError(`Failed to start local Google sign-in callback server: ${err.message}`, {
          code: 'google_docs_callback_server_failed',
          userMessage: 'Could not start the Google sign-in callback server.',
        }),
      );
    });

    server.listen(0, '127.0.0.1', async () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        clearTimeout(timeout);
        reject(
          new GoogleDocsAuthError('Could not determine Google callback port.', {
            code: 'google_docs_callback_port_failed',
            userMessage: 'Could not start Google sign-in.',
          }),
        );
        return;
      }

      const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;
      const authUrl = new URL(GOOGLE_AUTH_ENDPOINT);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', scopes.join(' '));
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('access_type', 'offline');
      if (!String(existingAuth?.refreshToken || '').trim()) {
        authUrl.searchParams.set('prompt', 'consent');
      }

      try {
        await openExternal(String(authUrl));
      } catch (err) {
        clearTimeout(timeout);
        try {
          server.close();
        } catch (_) {}
        reject(
          new GoogleDocsAuthError(`Failed to open Google sign-in in the browser: ${err.message}`, {
            code: 'google_docs_browser_open_failed',
            userMessage: 'Could not open Google sign-in in your browser.',
          }),
        );
        return;
      }

      try {
        const code = await codePromise;
        clearTimeout(timeout);
        const tokenResponse = await postGoogleTokenForm({
          client_id: clientId,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: verifier,
        });
        resolve(makeStoredAuth(tokenResponse, existingAuth));
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  });
}

async function ensureGoogleDocsAccessToken({
  appPath = '',
  userDataPath = '',
  persistedAuth = null,
  onAuthChanged = () => {},
  openExternal = async () => {},
} = {}) {
  const clientConfig = getGoogleDocsClientConfig({ appPath, userDataPath });
  const currentAuth = normalizePersistedAuth(persistedAuth);
  if (isAccessTokenFresh(currentAuth)) {
    return currentAuth.accessToken;
  }

  if (String(currentAuth?.refreshToken || '').trim()) {
    try {
      const refreshedAuth = await refreshGoogleDocsAccessToken({
        clientId: clientConfig.clientId,
        persistedAuth: currentAuth,
      });
      onAuthChanged(refreshedAuth);
      return refreshedAuth.accessToken;
    } catch (err) {
      if (!(err instanceof GoogleDocsAuthError)) throw err;
      if (String(err.code || '').trim() !== 'google_docs_token_exchange_failed') {
        throw err;
      }
      onAuthChanged(null);
    }
  }

  const authorizedAuth = await requestAuthorizationCode({
    clientId: clientConfig.clientId,
    scopes: clientConfig.scopes.length ? clientConfig.scopes : GOOGLE_DOCS_SCOPES,
    openExternal,
    existingAuth: currentAuth,
  });
  onAuthChanged(authorizedAuth);
  return authorizedAuth.accessToken;
}

module.exports = {
  GoogleDocsAuthError,
  GOOGLE_DOCS_SCOPES,
  ensureGoogleDocsAccessToken,
  getGoogleDocsClientConfig,
};
