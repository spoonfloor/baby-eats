// Utility functions

function waitForAppBarReady({ timeoutMs = 2000 } = {}) {
  const mount = document.getElementById('appBarMount');
  const start =
    typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();

  return new Promise((resolve) => {
    const tick = () => {
      // Once the title exists, the fragment is present and safe to wire.
      const titleEl = document.getElementById('appBarTitle');
      if (titleEl) return resolve(true);

      // If we have a mount with an injected flag, trust it.
      if (mount?.dataset?.injected === '1') return resolve(true);

      const now =
        typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now();

      if (now - start > timeoutMs) return resolve(false);

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

function ensureAppBarInjected() {
  const already = document.getElementById('appBarTitle');

  if (already) return Promise.resolve(false);

  const mount = document.getElementById('appBarMount');
  if (!mount) return Promise.resolve(false);

  // Fast path: session cache (avoids flash on navigation after first load).
  try {
    const cached =
      typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem('favoriteEats_appBarShell')
        : null;
    if (cached && cached.length > 0) {
      mount.innerHTML = cached;
      if (mount.dataset) {
        mount.dataset.injected = '1';
        mount.dataset.injecting = '0';
      }
      return waitForAppBarReady();
    }
  } catch (_) {
    // ignore cache failures
  }

  // Prevent double-injection if initAppBar is called multiple times quickly.
  if (mount.dataset && mount.dataset.injecting === '1') {
    // Injection already in progress — wait for the fragment to be present.

    return waitForAppBarReady();
  }

  if (mount.dataset) mount.dataset.injecting = '1';

  return fetch('fragments/appBar.shell.html')
    .then((r) => {
      if (!r.ok)
        throw new Error(`Failed to load app bar fragment (${r.status})`);
      return r.text();
    })
    .then((html) => {
      mount.innerHTML = html;
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('favoriteEats_appBarShell', html);
        }
      } catch (_) {
        // ignore
      }
      if (mount.dataset) {
        mount.dataset.injected = '1';
        mount.dataset.injecting = '0';
      }

      return waitForAppBarReady();
    })
    .catch((err) => {
      console.error('❌ App bar inject failed:', err);
      if (mount.dataset) mount.dataset.injecting = '0';
      return false;
    });
}

function initAppBar(options = {}) {
  const {
    mode = 'list',
    titleText = '',

    showSearch = true,
    showAdd = true,
    onMenu = null,
    onAdd = null,

    onBack = null,
    onCancel = null,
    onSave = null,

    _skipEnsure = false,
  } = options;

  // If a page uses the mount-based fragment, inject it before wiring.
  // IMPORTANT: do not continue wiring until the fragment exists.

  if (!_skipEnsure) {
    const mount = document.getElementById('appBarMount');

    const already = document.getElementById('appBarTitle');
    const shouldEnsure = !!mount && !already;

    if (shouldEnsure) {
      // Block wiring until the fragment is actually present.

      ensureAppBarInjected().then((ok) => {
        if (!ok) {
          console.warn('⚠️ initAppBar: app bar injection did not complete.');
          return;
        }
        initAppBar({ ...options, _skipEnsure: true });
      });

      return;
    }
  }

  // NOTE: The visible app bar can live either inside `.app-bar` (legacy v1)
  // or inside `.app-bar-wrapper` (list-page SoT visuals). Use global IDs.

  const menuBtn = document.getElementById('appBarMenuBtn');

  const backBtn = document.getElementById('appBarBackBtn');

  const addBtn = document.getElementById('appBarAddBtn');

  const cancelBtn = document.getElementById('appBarCancelBtn');
  const saveBtn = document.getElementById('appBarSaveBtn');
  const titleEl = document.getElementById('appBarTitle');

  const searchLayer = document.getElementById('appBarSearchLayer');

  // If we got here but the fragment still isn't present, bail quietly.
  // (This avoids wiring nulls and makes failures obvious in the console.)

  if (!titleEl && document.getElementById('appBarMount')) {
    const mount = document.getElementById('appBarMount');
    if (mount?.dataset?.injecting === '1') {
      // In-flight injection: schedule a single re-entry to wire once present.

      waitForAppBarReady().then((ok) => {
        if (ok) initAppBar({ ...options, _skipEnsure: true });
      });
      return;
    }

    console.warn('⚠️ initAppBar: app bar not present (missing #appBarTitle).');
    return;
  }

  if (titleEl && titleText) {
    titleEl.textContent = titleText;
  }

  // menu (list)
  if (menuBtn && onMenu) {
    menuBtn.onclick = onMenu;
  }

  // back always exists
  if (backBtn && onBack) {
    backBtn.onclick = onBack;
  }

  // add (list)
  if (addBtn && onAdd) {
    addBtn.onclick = onAdd;
  }

  // Mode visibility + wiring (single shell, explicit differences)
  if (mode === 'list') {
    if (menuBtn) menuBtn.style.display = '';
    if (backBtn) backBtn.style.display = 'none';
    if (searchLayer) searchLayer.style.display = showSearch ? '' : 'none';

    if (addBtn) addBtn.style.display = showAdd ? '' : 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'none';
  } else {
    if (menuBtn) menuBtn.style.display = 'none';
    if (backBtn) backBtn.style.display = '';
    if (searchLayer) searchLayer.style.display = 'none';

    if (addBtn) addBtn.style.display = 'none';
    if (cancelBtn) {
      cancelBtn.style.display = '';
      if (onCancel) cancelBtn.onclick = onCancel;
    }
    if (saveBtn) {
      saveBtn.style.display = '';
      if (onSave) saveBtn.onclick = onSave;
    }
  }

  // Search layout is handled by CSS (flex middle column) to avoid collisions.
}

/**
 * Round a number to the nearest fraction denominator
 * @param {number} value
 * @param {number} denominator
 * @returns {number}
 */
function roundToFraction(value, denominator = 8) {
  return Math.round(value * denominator) / denominator;
}

/**
 * Convert a decimal to a fractional display string using Unicode glyphs
 * (e.g., 1.5 -> "1½", 0.25 -> "¼")
 * @param {number} value
 * @param {number} denominator
 * @returns {string}
 */
function decimalToFractionDisplay(value, denominator = 8) {
  const rounded = roundToFraction(value, denominator);
  const whole = Math.floor(rounded);
  const fraction = rounded - whole;
  const fractionMap = {
    1: '⅛',
    2: '¼',
    3: '⅜',
    4: '½',
    5: '⅝',
    6: '¾',
    7: '⅞',
  };
  const fracGlyph = fractionMap[Math.round(fraction * denominator)] || '';
  if (whole === 0 && fracGlyph) return fracGlyph;
  return fracGlyph ? `${whole}${fracGlyph}` : `${whole}`;
}

/**
 * Make a span element editable on click
 * Dynamically replaces it with an input, inheriting the font
 * @param {HTMLElement} span
 * @param {'qty'|'text'} type
 */

/**
 * Generic inline row editing helper (servings, ingredients, etc.).
 *
 * @param {{
 *   rowElement: HTMLElement;
 *   isEmpty: () => boolean;
 *   commit: () => void;
 *   cancel: () => void;
 *   getIsEditing: () => boolean;
 *   setIsEditing: (bool: boolean) => void;
 * }} options
 *
 * @returns {{
 *   enterEdit: () => void;
 *   exitEdit: (shouldCommit: boolean) => void;
 *   destroy: () => void;
 * } | null}
 */
function setupInlineRowEditing(options) {
  if (!options || typeof options !== 'object') return null;

  const {
    rowElement,
    isEmpty,
    commit,
    cancel,
    getIsEditing,
    setIsEditing,
    onEnterCommit,
  } = options;

  if (
    !rowElement ||
    typeof isEmpty !== 'function' ||
    typeof commit !== 'function' ||
    typeof cancel !== 'function' ||
    typeof getIsEditing !== 'function' ||
    typeof setIsEditing !== 'function'
  ) {
    return null;
  }

  // Single-active-row guard across the app.
  if (!window._inlineRowEditState) {
    window._inlineRowEditState = { activeRow: null };
  }
  const globalState = window._inlineRowEditState;

  const enterEdit = () => {
    if (getIsEditing()) return;
    if (globalState.activeRow && globalState.activeRow !== rowElement) {
      // v1: block second editor instead of auto-committing.
      return;
    }
    globalState.activeRow = rowElement;
    setIsEditing(true);
  };

  const exitEdit = (shouldCommit) => {
    if (!getIsEditing()) return;

    if (shouldCommit && !isEmpty()) {
      commit();
    } else {
      cancel();
    }

    setIsEditing(false);
    if (globalState.activeRow === rowElement) {
      globalState.activeRow = null;
    }
  };

  const handleClick = () => {
    if (!getIsEditing()) {
      enterEdit();
    }
  };

  const handleKeyDown = (e) => {
    if (!getIsEditing()) return;

    if (e.key === 'Enter') {
      e.preventDefault();

      const empty = isEmpty();
      if (!empty) {
        commit();
        if (typeof onEnterCommit === 'function') {
          onEnterCommit();
        }
      } else {
        cancel();
      }

      setIsEditing(false);
      if (globalState.activeRow === rowElement) {
        globalState.activeRow = null;
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      exitEdit(false);
    }
  };

  const handleFocusOut = (e) => {
    if (!getIsEditing()) return;

    const next = e.relatedTarget;
    if (rowElement.contains(next)) return;

    exitEdit(!isEmpty());
  };

  rowElement.addEventListener('click', handleClick);
  rowElement.addEventListener('keydown', handleKeyDown);
  rowElement.addEventListener('focusout', handleFocusOut);

  return {
    enterEdit,
    exitEdit,
    destroy() {
      rowElement.removeEventListener('click', handleClick);
      rowElement.removeEventListener('keydown', handleKeyDown);
      rowElement.removeEventListener('focusout', handleFocusOut);
      if (globalState.activeRow === rowElement) {
        globalState.activeRow = null;
      }
    },
  };
}

/**
 * Wire a label-like element so clicking it focuses/selects a target input.
 * Shared by servings + ingredient inline editors.
 * @param {HTMLElement} labelEl
 * @param {HTMLInputElement|HTMLTextAreaElement} inputEl
 */
function wireLabelToInput(labelEl, inputEl) {
  if (!labelEl || !inputEl) return;

  labelEl.addEventListener('mousedown', (e) => {
    // Keep focus inside the row so blur logic sees focus staying in the row.
    e.preventDefault();
    inputEl.focus();
    if (typeof inputEl.select === 'function') {
      inputEl.select();
    }
  });
}
