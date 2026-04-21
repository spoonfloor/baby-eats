function setWelcomeStatus(message = '', { isError = false } = {}) {
  const statusEl = document.getElementById('welcomeStatus');
  if (!(statusEl instanceof HTMLElement)) return;
  const text = String(message || '').trim();
  statusEl.hidden = !text;
  statusEl.textContent = text;
  statusEl.style.color = isError ? '#b91c1c' : '';
}

function setWelcomeLoadingState(button, isLoading) {
  if (!(button instanceof HTMLButtonElement)) return;
  button.disabled = !!isLoading;
  button.textContent = isLoading ? 'Opening…' : 'Load Recipes';
}

async function handleElectronWelcomeLoad(button) {
  const lastPath = localStorage.getItem('favoriteEatsDbPath');
  const dbPath = await window.electronAPI.pickDB(lastPath);
  if (!dbPath) {
    setWelcomeStatus('');
    setWelcomeLoadingState(button, false);
    return;
  }

  localStorage.setItem('favoriteEatsDbPath', dbPath);
  await window.electronAPI.loadDB(dbPath);
  window.location.href = 'recipes.html';
}

function handleBrowserWelcomeLoad() {
  setWelcomeStatus(
    'This welcome screen is for the desktop app. Open recipes directly in the web build.',
    { isError: true },
  );
}

function initWelcomePage() {
  const loadDbBtn = document.getElementById('loadDbBtn');
  if (!(loadDbBtn instanceof HTMLButtonElement)) return;

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      loadDbBtn.click();
    }
  });

  loadDbBtn.addEventListener('click', async () => {
    if (loadDbBtn.disabled) return;
    setWelcomeStatus('');
    setWelcomeLoadingState(loadDbBtn, true);

    try {
      if (window.electronAPI && typeof window.electronAPI.pickDB === 'function') {
        await handleElectronWelcomeLoad(loadDbBtn);
        return;
      }
      handleBrowserWelcomeLoad();
    } catch (err) {
      console.error('Failed to load database:', err);
      setWelcomeStatus('Failed to load database.', { isError: true });
    } finally {
      setWelcomeLoadingState(loadDbBtn, false);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWelcomePage, { once: true });
} else {
  initWelcomePage();
}
