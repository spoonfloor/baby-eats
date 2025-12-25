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

// --- Global Undo (single-slot, toast-based) ---
function showUndoToastGlobal({ message, onUndo, timeoutMs = 6000 } = {}) {
  try {
    let host = document.getElementById('typeaheadToastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'typeaheadToastHost';
      // Keep legacy class for existing CSS; also add the new shared class.
      host.className = 'typeahead-toast-host ui-toast-host';
      document.body.appendChild(host);
    }

    // Clear any existing toasts (single-slot behavior)
    try {
      while (host.firstChild) host.removeChild(host.firstChild);
    } catch (_) {}

    const toast = document.createElement('div');
    toast.className = 'typeahead-toast ui-toast';

    const msg = document.createElement('div');
    msg.className = 'typeahead-toast__msg ui-toast__msg';
    msg.textContent = message || '';
    toast.appendChild(msg);

    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'typeahead-toast__undo ui-toast__action';
    undoBtn.textContent = 'Undo';
    undoBtn.addEventListener('click', () => {
      try {
        if (typeof onUndo === 'function') onUndo();
      } finally {
        try {
          if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
        } catch (_) {}
      }
    });
    toast.appendChild(undoBtn);

    host.appendChild(toast);

    const t = window.setTimeout(() => {
      try {
        if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
      } catch (_) {}
    }, Math.max(1000, Number(timeoutMs) || 6000));

    toast.addEventListener('mouseenter', () => {
      try {
        window.clearTimeout(t);
      } catch (_) {}
    });

    return toast;
  } catch (_) {
    return null;
  }
}

function createUndoManager() {
  let current = null; // { undo: fn, toastEl }

  const clear = () => {
    current = null;
    try {
      const host = document.getElementById('typeaheadToastHost');
      if (host) host.innerHTML = '';
    } catch (_) {}
  };

  const push = ({ message, undo, timeoutMs } = {}) => {
    if (typeof undo !== 'function') return false;
    current = { undo, toastEl: null };
    const toastEl = showUndoToastGlobal({
      message,
      timeoutMs,
      onUndo: () => {
        try {
          undo();
        } finally {
          current = null;
        }
      },
    });
    current.toastEl = toastEl;
    return true;
  };

  return { push, clear };
}

if (typeof window !== 'undefined') {
  // Shared global undo helpers (page-local).
  if (!window.showUndoToast) window.showUndoToast = showUndoToastGlobal;
  if (!window.undoManager) window.undoManager = createUndoManager();
}

// --- Unified dialogs + toasts (window.ui) ---
(function initUnifiedUI() {
  if (typeof window === 'undefined') return;
  if (window.ui) return;

  const ensureDialogHost = () => {
    let host = document.getElementById('uiDialogHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'uiDialogHost';
      host.className = 'ui-dialog-host';
      document.body.appendChild(host);
    }
    return host;
  };

  const ensureToastHost = () => {
    // Reuse existing host if present (legacy id)
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
  };

  const getFocusable = (root) => {
    if (!(root instanceof Element)) return [];
    const sel =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const nodes = Array.from(root.querySelectorAll(sel));
    return nodes.filter((el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.hasAttribute('disabled')) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return true;
    });
  };

  const trapTabKey = (e, panel) => {
    if (!e || e.key !== 'Tab') return;
    const items = getFocusable(panel);
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !panel.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const dialog = ({
    title = '',
    message = '',
    fields = null, // [{ key, label, type, value, placeholder, required, autocapitalize }]
    confirmText = 'OK',
    cancelText = 'Cancel',
    showCancel = true,
    danger = false,
    validate = null, // (values) => string|''|null
    onConfirm = null, // (values) => void|Promise
    closeOnBackdrop = true,
  } = {}) => {
    return new Promise((resolve) => {
      const host = ensureDialogHost();
      const prevFocus =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      const backdrop = document.createElement('div');
      backdrop.className = 'ui-dialog-backdrop';

      const panel = document.createElement('div');
      panel.className = 'ui-dialog-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');

      const titleEl = document.createElement('h2');
      titleEl.className = 'ui-dialog-title';
      titleEl.textContent = title || '';
      panel.appendChild(titleEl);

      let bodyEl = null;
      if (message) {
        bodyEl = document.createElement('div');
        bodyEl.className = 'ui-dialog-body';
        // Normalize: keep newlines, but remove indentation that often comes from
        // template-literal formatting (prevents "giant indent" rendering).
        const raw = String(message);
        const normalized = raw
          .replace(/\r\n/g, '\n')
          .replace(/\n[ \t]+/g, '\n')
          .trim();
        bodyEl.textContent = normalized;
        panel.appendChild(bodyEl);
      }

      const errorEl = document.createElement('div');
      errorEl.className = 'ui-dialog-error';
      errorEl.style.display = 'none';
      panel.appendChild(errorEl);

      const values = {};
      let firstInput = null;

      if (Array.isArray(fields) && fields.length) {
        const fieldsWrap = document.createElement('div');
        fieldsWrap.className = 'ui-dialog-fields';

        fields.forEach((f) => {
          const key = String(f?.key || '');
          if (!key) return;
          values[key] = f?.value != null ? String(f.value) : '';

          const field = document.createElement('label');
          field.className = 'ui-dialog-field';

          const lab = document.createElement('div');
          lab.className = 'ui-dialog-label';
          lab.textContent = String(f?.label || key);
          field.appendChild(lab);

          const input = document.createElement('input');
          input.className = 'ui-dialog-input';
          input.type = String(f?.type || 'text');
          input.value = values[key];
          if (f?.placeholder) input.placeholder = String(f.placeholder);
          if (f?.autocapitalize) input.setAttribute('autocapitalize', f.autocapitalize);
          if (f?.required) input.dataset.required = '1';

          input.addEventListener('input', () => {
            values[key] = input.value || '';
            syncValidity();
          });

          field.appendChild(input);
          fieldsWrap.appendChild(field);

          if (!firstInput) firstInput = input;
        });

        panel.appendChild(fieldsWrap);
      }

      const actions = document.createElement('div');
      actions.className = 'ui-dialog-actions';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'button button--secondary';
      cancelBtn.textContent = cancelText || 'Cancel';

      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = `button ${danger ? 'button--danger' : ''}`.trim();
      confirmBtn.textContent = confirmText || 'OK';

      if (showCancel) actions.appendChild(cancelBtn);
      actions.appendChild(confirmBtn);
      panel.appendChild(actions);

      backdrop.appendChild(panel);
      host.appendChild(backdrop);
      host.dataset.open = '1';

      const cleanup = () => {
        try {
          delete host.dataset.open;
        } catch (_) {}
        try {
          if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        } catch (_) {}
        try {
          prevFocus?.focus?.();
        } catch (_) {}
      };

      const setError = (msg) => {
        const m = (msg || '').trim();
        if (!m) {
          errorEl.textContent = '';
          errorEl.style.display = 'none';
        } else {
          errorEl.textContent = m;
          errorEl.style.display = '';
        }
      };

      const syncValidity = () => {
        let err = '';
        try {
          // Required fields
          if (Array.isArray(fields)) {
            for (const f of fields) {
              const key = String(f?.key || '');
              if (!key) continue;
              if (f?.required && !(values[key] || '').trim()) {
                err = 'Please fill in the required fields.';
                break;
              }
            }
          }
          if (!err && typeof validate === 'function') {
            err = String(validate(values) || '').trim();
          }
        } catch (_) {}

        setError(err);
        confirmBtn.disabled = !!err;
      };

      const doCancel = () => {
        cleanup();
        resolve(null);
      };

      const doConfirm = async () => {
        syncValidity();
        if (confirmBtn.disabled) return;
        try {
          if (typeof onConfirm === 'function') {
            await onConfirm(values);
          }
        } catch (err) {
          setError(err?.message || 'Something went wrong.');
          confirmBtn.disabled = false;
          return;
        }
        cleanup();
        resolve(values);
      };

      cancelBtn.addEventListener('click', doCancel);
      confirmBtn.addEventListener('click', () => {
        void doConfirm();
      });

      backdrop.addEventListener('mousedown', (e) => {
        if (!closeOnBackdrop) return;
        if (e.target === backdrop) doCancel();
      });

      panel.addEventListener(
        'keydown',
        (e) => {
          if (!e) return;
          if (e.key === 'Escape') {
            e.preventDefault();
            doCancel();
            return;
          }
          trapTabKey(e, panel);
          if (e.key === 'Enter') {
            // Enter on inputs should submit; on buttons is handled by click anyway.
            const t = e.target;
            if (t && t instanceof HTMLInputElement) {
              e.preventDefault();
              void doConfirm();
            }
          }
        },
        { capture: true }
      );

      // Initial validation + focus
      syncValidity();
      window.setTimeout(() => {
        try {
          (firstInput || confirmBtn).focus();
          if (firstInput && firstInput.select) firstInput.select();
        } catch (_) {}
      }, 0);
    });
  };

  const alertDialog = ({ title = 'Alert', message = '', okText = 'OK' } = {}) =>
    dialog({
      title,
      message,
      confirmText: okText,
      showCancel: false,
      closeOnBackdrop: true,
    }).then(() => true);

  const confirmDialog = ({
    title = 'Confirm',
    message = '',
    confirmText = 'OK',
    cancelText = 'Cancel',
    danger = false,
  } = {}) =>
    dialog({
      title,
      message,
      confirmText,
      cancelText,
      showCancel: true,
      danger,
      closeOnBackdrop: true,
    }).then((res) => !!res);

  const promptDialog = ({
    title = '',
    message = '',
    label = 'Value',
    value = '',
    placeholder = '',
    confirmText = 'OK',
    cancelText = 'Cancel',
    required = false,
    normalize = null, // (v) => v
    validate = null, // (v) => string|''|null
  } = {}) =>
    dialog({
      title,
      message,
      fields: [
        {
          key: 'value',
          label,
          type: 'text',
          value,
          placeholder,
          required,
          autocapitalize: 'sentences',
        },
      ],
      confirmText,
      cancelText,
      showCancel: true,
      validate: (vals) => {
        const raw = vals?.value != null ? String(vals.value) : '';
        const v =
          typeof normalize === 'function' ? String(normalize(raw) || '') : raw;
        if (required && !v.trim()) return 'Please enter a value.';
        if (typeof validate === 'function') return String(validate(v) || '').trim();
        return '';
      },
    }).then((vals) => {
      if (!vals) return null;
      const raw = vals.value != null ? String(vals.value) : '';
      const v = typeof normalize === 'function' ? String(normalize(raw) || '') : raw;
      return v;
    });

  const formDialog = ({
    title = '',
    message = '',
    fields = [], // [{ key, label, value, placeholder, required, normalize }]
    confirmText = 'OK',
    cancelText = 'Cancel',
    validate = null, // (values) => string|''|null
    danger = false,
  } = {}) =>
    dialog({
      title,
      message,
      fields: fields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type || 'text',
        value: f.value || '',
        placeholder: f.placeholder || '',
        required: !!f.required,
        autocapitalize: f.autocapitalize || 'sentences',
      })),
      confirmText,
      cancelText,
      showCancel: true,
      danger,
      validate: (vals) => {
        const out = {};
        fields.forEach((f) => {
          const k = String(f?.key || '');
          if (!k) return;
          const raw = vals?.[k] != null ? String(vals[k]) : '';
          out[k] =
            typeof f.normalize === 'function' ? String(f.normalize(raw) || '') : raw;
        });
        if (typeof validate === 'function') return String(validate(out) || '').trim();
        return '';
      },
      onConfirm: (vals) => {
        // Normalize before returning
        const out = {};
        fields.forEach((f) => {
          const k = String(f?.key || '');
          if (!k) return;
          const raw = vals?.[k] != null ? String(vals[k]) : '';
          out[k] =
            typeof f.normalize === 'function' ? String(f.normalize(raw) || '') : raw;
        });
        // Mutate resolved values to normalized output
        Object.keys(vals || {}).forEach((k) => delete vals[k]);
        Object.assign(vals, out);
      },
    });

  const toast = ({
    message = '',
    actionText = '',
    onAction = null,
    timeoutMs = 5000,
    singleSlot = true,
  } = {}) => {
    try {
      const host = ensureToastHost();
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

      if (actionText) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ui-toast__action typeahead-toast__undo';
        btn.textContent = actionText;
        btn.addEventListener('click', () => {
          try {
            if (typeof onAction === 'function') onAction();
          } finally {
            try {
              if (el && el.parentNode) el.parentNode.removeChild(el);
            } catch (_) {}
          }
        });
        el.appendChild(btn);
      }

      host.appendChild(el);

      const t = window.setTimeout(() => {
        try {
          if (el && el.parentNode) el.parentNode.removeChild(el);
        } catch (_) {}
      }, Math.max(1000, Number(timeoutMs) || 5000));

      el.addEventListener('mouseenter', () => {
        try {
          window.clearTimeout(t);
        } catch (_) {}
      });

      return el;
    } catch (_) {
      return null;
    }
  };

  window.ui = Object.freeze({
    dialog,
    alert: alertDialog,
    confirm: confirmDialog,
    prompt: promptDialog,
    form: formDialog,
    toast,
    isDialogOpen: () => !!document.querySelector('#uiDialogHost[data-open="1"]'),
  });
})();

// --- Ingredient grammar helpers (pluralization) ---
function pluralizeEnglishNoun(singular, pluralOverride) {
  const base = (singular || '').trim();
  const override = (pluralOverride || '').trim();
  if (!base) return '';
  if (override) return override;

  const lower = base.toLowerCase();
  // Small irregular set (everything else can use plural_override if needed)
  const irregular = {
    leaf: 'leaves',
    loaf: 'loaves',
    knife: 'knives',
    life: 'lives',
    wife: 'wives',
    wolf: 'wolves',
    tomato: 'tomatoes',
    potato: 'potatoes',
  };
  if (irregular[lower]) {
    // Preserve capitalization of first letter (simple)
    const pl = irregular[lower];
    return base[0] === base[0].toUpperCase()
      ? pl.charAt(0).toUpperCase() + pl.slice(1)
      : pl;
  }

  // -ch/-sh/-s/-x/-z => +es
  if (/(ch|sh|s|x|z)$/i.test(base)) return base + 'es';

  // consonant + y => ies
  if (/[bcdfghjklmnpqrstvwxyz]y$/i.test(base)) {
    return base.slice(0, -1) + 'ies';
  }

  return base + 's';
}

function isNumericQuantity(q) {
  if (q == null) return false;
  if (q === '') return false;
  const n = typeof q === 'number' ? q : parseFloat(String(q));
  return Number.isFinite(n);
}

function getIngredientNounDisplay(line) {
  // line can be a recipe ingredient row or a formatter ingredient row
  if (!line) return '';
  const name = (line.name || '').trim();
  const lemma = (line.lemma || '').trim();
  const base = lemma || name;
  if (!base) return '';

  const pluralByDefault = !!(
    line.pluralByDefault ??
    line.plural_by_default ??
    0
  );
  const isMassNoun = !!(line.isMassNoun ?? line.is_mass_noun ?? 0);
  const pluralOverride =
    line.pluralOverride ?? line.plural_override ?? '';

  if (isMassNoun) return base;

  const qtyIsNumeric = isNumericQuantity(line.quantity);
  if (qtyIsNumeric) {
    const n = typeof line.quantity === 'number'
      ? line.quantity
      : parseFloat(String(line.quantity));
    if (Number.isFinite(n) && n === 1) return base;
    return pluralizeEnglishNoun(base, pluralOverride);
  }

  // No numeric quantity (including empty or free-text)
  if (pluralByDefault) return pluralizeEnglishNoun(base, pluralOverride);
  return base;
}

function getIngredientDisplayName(line) {
  if (!line) return '';
  const noun = getIngredientNounDisplay(line);
  const variant = (line.variant || '').trim();
  return variant ? `${variant} ${noun}`.trim() : noun;
}

// Expose helpers for other modules (loaded as scripts, not ES modules)
if (typeof window !== 'undefined') {
  window.pluralizeEnglishNoun = pluralizeEnglishNoun;
  window.getIngredientNounDisplay = getIngredientNounDisplay;
  window.getIngredientDisplayName = getIngredientDisplayName;
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

  // Clicking inside the row but not on a focusable control (e.g. the tray background)
  // should NOT trigger blur-commit. We use a "neutral focus" target when available,
  // so the row can remain in edit mode with no active field selected.
  const handleMouseDownCapture = (e) => {
    if (!getIsEditing()) return;
    const t = e && e.target ? e.target : null;
    if (!t || !rowElement.contains(t)) return;

    // Clicking a pill label should behave like a label click (focus the wired input).
    // Let `wireLabelToInput` handle that.
    if (t.closest && t.closest('.field-pill')) return;

    // Clicking a label-wrapped control (e.g. the Ingredients "opt" toggle) should
    // behave normally. Preventing default on mousedown here can cancel the label's
    // default action (toggling the nested checkbox).
    if (t.closest) {
      const labelEl = t.closest('label');
      if (labelEl && labelEl.querySelector && labelEl.querySelector('input')) {
        return;
      }
      if (t.closest('.ingredient-edit-toggle')) return;
    }

    // If the click is already on a focusable control, let it behave normally.
    const tag = (t.tagName || '').toLowerCase();
    const isFocusable =
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      t.isContentEditable === true;

    if (isFocusable) return;

    // Tray background click:
    // - close any overlay dropdown
    // - move focus off inputs (neutral focus) without leaving edit mode
    e.preventDefault();

    try {
      if (
        window.favoriteEatsTypeahead &&
        typeof window.favoriteEatsTypeahead.close === 'function'
      ) {
        window.favoriteEatsTypeahead.close();
      }
    } catch (_) {}

    const blurTarget = rowElement.querySelector('.inline-edit-blur-target');
    if (blurTarget && typeof blurTarget.focus === 'function') {
      blurTarget.focus();
      return;
    }

    // Fallback: keep focus inside row (avoid exiting edit mode).
    const first = rowElement.querySelector(
      'input, textarea, select, [contenteditable="true"]'
    );
    if (first && typeof first.focus === 'function') {
      first.focus();
      if (typeof first.select === 'function') first.select();
    }
  };

  rowElement.addEventListener('click', handleClick);
  rowElement.addEventListener('keydown', handleKeyDown);
  rowElement.addEventListener('focusout', handleFocusOut);
  rowElement.addEventListener('mousedown', handleMouseDownCapture, true);

  return {
    enterEdit,
    exitEdit,
    destroy() {
      rowElement.removeEventListener('click', handleClick);
      rowElement.removeEventListener('keydown', handleKeyDown);
      rowElement.removeEventListener('focusout', handleFocusOut);
      rowElement.removeEventListener('mousedown', handleMouseDownCapture, true);
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
