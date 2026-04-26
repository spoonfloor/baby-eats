(function initFavoriteEatsSplashGate(global) {
  if (!global || !global.document) return;

  const DEFAULT_SUPABASE_URL = 'https://ieancejhyihxpazturiz.supabase.co';
  const VERIFY_PATH = '/functions/v1/verify-splash-password';

  function getSupabaseUrl() {
    const configured = String(global.__SUPABASE_URL__ || '').trim();
    return configured || DEFAULT_SUPABASE_URL;
  }

  function setError(el, message) {
    if (!(el instanceof HTMLElement)) return;
    const text = String(message || '').trim();
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = text;
  }

  async function verifyPassword(password) {
    const url = `${getSupabaseUrl()}${VERIFY_PATH}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload || payload.ok !== true) {
      throw new Error('Invalid password.');
    }
    return true;
  }

  function setButtonBusy(button, isBusy) {
    if (!(button instanceof HTMLButtonElement)) return;
    button.disabled = !!isBusy;
    button.textContent = isBusy ? 'Checking...' : 'Continue';
  }

  async function onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;

    const input = form.querySelector('#splashPasswordInput');
    const button = form.querySelector('#splashContinueBtn');
    const errorEl = global.document.getElementById('splashGateError');
    const password = input instanceof HTMLInputElement ? input.value : '';

    setError(errorEl, '');
    setButtonBusy(button, true);

    try {
      await verifyPassword(password);
      if (global.favoriteEatsGate && typeof global.favoriteEatsGate.grantAccess === 'function') {
        global.favoriteEatsGate.grantAccess();
      }
      global.location.href = 'recipes.html';
    } catch (_) {
      setError(errorEl, 'Incorrect password.');
    } finally {
      setButtonBusy(button, false);
    }
  }

  function init() {
    if (global.favoriteEatsGate && typeof global.favoriteEatsGate.hasAccess === 'function') {
      if (global.favoriteEatsGate.hasAccess()) {
        global.location.replace('recipes.html');
        return;
      }
    }
    const form = global.document.getElementById('splashGateForm');
    if (form instanceof HTMLFormElement) {
      form.addEventListener('submit', onSubmit);
    }
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
