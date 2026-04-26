function ensureWelcomeToastHost() {
  let host = document.getElementById('typeaheadToastHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'typeaheadToastHost';
    document.body.appendChild(host);
  }
  if (!host.classList.contains('ui-toast-host')) host.classList.add('ui-toast-host');
  if (!host.classList.contains('typeahead-toast-host'))
    host.classList.add('typeahead-toast-host');
  return host;
}

function welcomeToast({
  message = '',
  timeoutMs = 5000,
  singleSlot = true,
} = {}) {
  try {
    const host = ensureWelcomeToastHost();
    if (singleSlot) {
      try {
        while (host.firstChild) host.removeChild(host.firstChild);
      } catch (_) {}
    }

    const el = document.createElement('div');
    el.className = 'ui-toast typeahead-toast';

    const msg = document.createElement('div');
    msg.className = 'ui-toast__msg typeahead-toast__msg';
    msg.textContent = message || '';
    el.appendChild(msg);

    host.appendChild(el);

    const removeToast = () => {
      try {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      } catch (_) {}
    };
    const lifetimeMs = Math.max(1000, Number(timeoutMs) || 5000);
    let t = window.setTimeout(removeToast, lifetimeMs);

    el.addEventListener('mouseenter', () => {
      try {
        window.clearTimeout(t);
      } catch (_) {}
    });
    el.addEventListener('mouseleave', () => {
      try {
        window.clearTimeout(t);
      } catch (_) {}
      t = window.setTimeout(removeToast, lifetimeMs);
    });

    return el;
  } catch (_) {
    return null;
  }
}

async function handleElectronWelcomeLoad() {
  window.location.href = 'recipes.html';
}

function initWelcomePage() {
  try {
    document.documentElement.dataset.platform = 'editor';
  } catch (_) {}

  const loadDbBtn = document.getElementById('loadDbBtn');
  if (!(loadDbBtn instanceof HTMLButtonElement)) return;

  let electronBusy = false;

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      loadDbBtn.click();
    }
  });

  loadDbBtn.addEventListener('click', async () => {
    if (
      !window.electronAPI ||
      typeof window.electronAPI.supabaseListRecipes !== 'function'
    ) {
      welcomeToast({
        message:
          'This app must run in the desktop app. From the project folder, run: npm start',
        timeoutMs: 10000,
      });
      return;
    }
    try {
      if (electronBusy) return;
      electronBusy = true;
      await handleElectronWelcomeLoad();
    } catch (err) {
      console.error('Failed to load database:', err);
      welcomeToast({
        message: 'Failed to load database.',
        timeoutMs: 8000,
      });
    } finally {
      electronBusy = false;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWelcomePage, { once: true });
} else {
  initWelcomePage();
}
