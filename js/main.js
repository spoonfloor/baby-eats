// Set by loadStoresPage: if Cmd+↑/↓ should reorder a selected row instead of changing tabs.
/** @type {null | ((e: KeyboardEvent) => boolean)} */
let consumeCmdVerticalArrowBeforeTopLevelNav = null;

// --- Unified user messaging helpers (dialogs/toasts) ---
function uiToast(message, opts = {}) {
  try {
    if (window.ui && typeof window.ui.toast === 'function') {
      return window.ui.toast({ message: String(message || ''), ...opts });
    }
  } catch (_) {}
  try {
    // Fallback for early boot / missing ui
    alert(String(message || ''));
  } catch (_) {}
  return null;
}

function uiAlert(title, message, options = {}) {
  const messageNode =
    options && options.messageNode instanceof Node
      ? options.messageNode
      : null;
  try {
    if (window.ui && typeof window.ui.alert === 'function') {
      return window.ui.alert({
        title: String(title || ''),
        message: String(message || ''),
        messageNode,
      });
    }
  } catch (_) {}
  try {
    alert(String(message || ''));
  } catch (_) {}
  return Promise.resolve(true);
}

async function uiConfirm({
  title = 'Confirm',
  message = '',
  confirmText = 'OK',
  cancelText = 'Cancel',
  danger = false,
} = {}) {
  try {
    if (window.ui && typeof window.ui.confirm === 'function') {
      return await window.ui.confirm({
        title,
        message,
        confirmText,
        cancelText,
        danger,
      });
    }
  } catch (_) {}
  try {
    return window.confirm(String(message || 'Are you sure?'));
  } catch (_) {}
  return false;
}

function cloneForUndo(value, fallbackFactory = () => null) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return typeof fallbackFactory === 'function' ? fallbackFactory() : null;
  }
}

function uiToastUndo(message, onUndo, { timeoutMs = 8000 } = {}) {
  if (typeof onUndo !== 'function') return uiToast(message);
  try {
    const um = window.undoManager;
    if (um && typeof um.push === 'function') {
      return um.push({
        message: String(message || ''),
        undo: onUndo,
        timeoutMs,
      });
    }
  } catch (_) {}
  return uiToast(message, {
    actionText: 'Undo',
    onAction: onUndo,
    timeoutMs,
  });
}

const FAVORITE_EATS_BUILD_DEFAULTS = Object.freeze({
  target: 'web',
});

function readFavoriteEatsBuildConfig() {
  try {
    const raw = window.__FAVORITE_EATS_BUILD__;
    if (!raw || typeof raw !== 'object') {
      return { ...FAVORITE_EATS_BUILD_DEFAULTS };
    }
    const target = String(raw.target || FAVORITE_EATS_BUILD_DEFAULTS.target).trim().toLowerCase();
    return {
      ...FAVORITE_EATS_BUILD_DEFAULTS,
      ...raw,
      target: target === 'web' ? 'web' : 'web',
    };
  } catch (_) {
    return { ...FAVORITE_EATS_BUILD_DEFAULTS };
  }
}

const FAVORITE_EATS_BUILD = Object.freeze(readFavoriteEatsBuildConfig());
const FAVORITE_EATS_FORCE_WEB_MODE_EVENT = 'favoriteEatsForceWebModeChanged';

function isForceWebModeEnabled() {
  // Single-mode app: force-web/planner split removed.
  return false;
}

/** Wide recipe-list servings header from this width; keep in sync with `css/styles.css`. */
const RECIPE_LIST_SERVINGS_HEADER_WIDE_MIN_PX = 620;

/** @type {MediaQueryList | null} */
let recipeListServingsHeaderCompactMq = null;

function recipeListServingsHeaderCompactMqList() {
  if (recipeListServingsHeaderCompactMq) return recipeListServingsHeaderCompactMq;
  if (typeof window.matchMedia !== 'function') return null;
  recipeListServingsHeaderCompactMq = window.matchMedia(
    `(max-width: ${RECIPE_LIST_SERVINGS_HEADER_WIDE_MIN_PX - 1}px)`,
  );
  return recipeListServingsHeaderCompactMq;
}

function syncRecipeListServingsHeaderLabelText(headerLabel) {
  if (!headerLabel) return;
  const mq = recipeListServingsHeaderCompactMqList();
  const compact = mq ? mq.matches : false;
  headerLabel.textContent = compact ? 'svgs' : 'servings';
}

let recipeListServingsHeaderLabelMqBound = false;

function ensureRecipeListServingsHeaderLabelMediaListener() {
  const mq = recipeListServingsHeaderCompactMqList();
  if (!mq || recipeListServingsHeaderLabelMqBound) return;
  recipeListServingsHeaderLabelMqBound = true;
  const onChange = () => {
    const label = document.querySelector(
      'body.recipes-page #recipeList .recipe-list-servings-header-label',
    );
    syncRecipeListServingsHeaderLabelText(label);
  };
  try {
    mq.addEventListener('change', onChange);
  } catch (_) {
    mq.addListener(onChange);
  }
}

function applyForceWebModePresentation(enabled = isForceWebModeEnabled()) {
  const body = document.body;
  if (!(body instanceof HTMLElement)) return !!enabled;

  const forceWebMode = !!enabled;
  body.dataset.forceWebMode = forceWebMode ? 'on' : 'off';
  body.dataset.pageSet = forceWebMode ? 'web' : 'editor';
  body.classList.toggle('force-web-mode', forceWebMode);
  applyDocumentThemePlatform(forceWebMode);
  return forceWebMode;
}

function getTopLevelPageOrder() {
  // Recipes-only shell: no other top-level tabs.
  return ['recipes'];
}

function getTopLevelPageHref(pageId) {
  const key = String(pageId || '')
    .trim()
    .toLowerCase();
  if (!key) return 'recipes.html';
  if (key === 'recipes' || key === 'recipe-editor') {
    return key === 'recipe-editor' ? 'recipeEditor.html' : 'recipes.html';
  }
  return 'recipes.html';
}

/** Force web off → editor (red); force web on → planner (purple). */
function applyDocumentThemePlatform(planner = isForceWebModeEnabled()) {
  const root = document.documentElement;
  if (!(root instanceof HTMLElement)) return;
  root.dataset.platform = planner ? 'planner' : 'editor';
}

applyForceWebModePresentation();
window.forceWebMode = Object.freeze({
  isEnabled: isForceWebModeEnabled,
  setEnabled: () => applyForceWebModePresentation(false),
  apply: applyForceWebModePresentation,
});

function getFavoriteEatsDataApi() {
  const api = window.favoriteEatsDataApi;
  if (!api || typeof api !== 'object') {
    throw new Error('Supabase web data API is not available.');
  }
  return api;
}

const PRESENCE_CLIENT_ID_STORAGE_KEY = 'favoriteEatsPresenceClientId';
const PRESENCE_NICKNAME_STORAGE_KEY = 'favoriteEatsPresenceNickname';
const PRESENCE_TOAST_COOLDOWN_MS = 2 * 60 * 1000;

const PRESENCE_ADJECTIVES = Object.freeze([
  'Funky',
  'Kinetic',
  'Cosmic',
  'Sunny',
  'Bouncy',
  'Mellow',
  'Zippy',
  'Sparkly',
  'Cheery',
  'Wiggly',
  'Dizzy',
  'Nifty',
  'Snappy',
  'Peppy',
  'Chill',
  'Jazzy',
  'Silly',
  'Speedy',
  'Dreamy',
  'Lucky',
]);

const PRESENCE_FOODS = Object.freeze([
  'Lasagna',
  'Cheesecake',
  'Dumpling',
  'Pretzel',
  'Pancake',
  'Taco',
  'Gnocchi',
  'Risotto',
  'Brownie',
  'Cupcake',
  'Muffin',
  'Noodle',
  'Bagel',
  'Burrito',
  'Sushi',
  'Waffle',
  'Ravioli',
  'Quesadilla',
  'Meatball',
  'Croissant',
  'Pierogi',
  'Falafel',
  'Tempura',
  'Sorbet',
  'Casserole',
]);

function randomFrom(source) {
  if (!Array.isArray(source) || source.length === 0) return '';
  const idx = Math.floor(Math.random() * source.length);
  return String(source[idx] || '').trim();
}

function ensurePresenceClientId() {
  try {
    const existing = String(localStorage.getItem(PRESENCE_CLIENT_ID_STORAGE_KEY) || '').trim();
    if (existing) return existing;
    const generated = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(PRESENCE_CLIENT_ID_STORAGE_KEY, generated);
    return generated;
  } catch (_) {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function ensurePresenceNickname() {
  try {
    const existing = String(localStorage.getItem(PRESENCE_NICKNAME_STORAGE_KEY) || '').trim();
    if (existing) return existing;
    const adjective = randomFrom(PRESENCE_ADJECTIVES) || 'Friendly';
    const food = randomFrom(PRESENCE_FOODS) || 'Snack';
    const generated = `${adjective} ${food}`.trim();
    localStorage.setItem(PRESENCE_NICKNAME_STORAGE_KEY, generated);
    return generated;
  } catch (_) {
    const adjective = randomFrom(PRESENCE_ADJECTIVES) || 'Friendly';
    const food = randomFrom(PRESENCE_FOODS) || 'Snack';
    return `${adjective} ${food}`.trim();
  }
}

function setPresenceIndicatorText(text) {
  const label = document.getElementById('appBarPresenceIndicator');
  if (!(label instanceof HTMLElement)) return;
  const next = String(text || '').trim();
  label.textContent = next;
  label.hidden = !next;
}

function ensurePresenceIndicatorMount() {
  const title = document.getElementById('appBarTitle');
  if (!(title instanceof HTMLElement)) return;
  const existing = document.getElementById('appBarPresenceIndicator');
  if (existing instanceof HTMLElement) return existing;
  const indicator = document.createElement('span');
  indicator.id = 'appBarPresenceIndicator';
  indicator.className = 'app-bar-presence-indicator nav-text';
  indicator.hidden = true;
  indicator.setAttribute('aria-live', 'polite');
  title.insertAdjacentElement('afterend', indicator);
  return indicator;
}

async function bootSharedPresence({ pageId } = {}) {
  if (!['recipes', 'recipe-editor'].includes(String(pageId || ''))) return;
  let dataApi;
  try {
    dataApi = getFavoriteEatsDataApi();
  } catch (_) {
    return;
  }
  if (typeof dataApi.subscribeSharedPresence !== 'function') return;
  const localClientId = ensurePresenceClientId();
  const localNickname = ensurePresenceNickname();
  let lastToastAt = 0;
  let lastSignature = '';
  const mountProbe = window.setInterval(() => {
    const mounted = ensurePresenceIndicatorMount();
    if (mounted) {
      try {
        clearInterval(mountProbe);
      } catch (_) {}
    }
  }, 1000);

  const cleanup = dataApi.subscribeSharedPresence({
    clientId: localClientId,
    nickname: localNickname,
    onPresence: (presenceState) => {
      const state = presenceState && typeof presenceState === 'object' ? presenceState : {};
      const others = [];
      Object.entries(state).forEach(([key, metas]) => {
        if (String(key || '').trim() === localClientId) return;
        const list = Array.isArray(metas) ? metas : [];
        list.forEach((meta) => {
          const name = String(meta?.nickname || '').trim();
          if (name) others.push(name);
        });
      });
      const uniqueOthers = Array.from(new Set(others)).sort((a, b) => a.localeCompare(b));
      const signature = uniqueOthers.join('|');
      const indicator = ensurePresenceIndicatorMount();
      if (indicator) {
        if (uniqueOthers.length === 0) {
          setPresenceIndicatorText('');
        } else if (uniqueOthers.length === 1) {
          setPresenceIndicatorText(`${uniqueOthers[0]} active now`);
        } else {
          setPresenceIndicatorText(`${uniqueOthers.length} active now`);
        }
      }
      const now = Date.now();
      const changed = signature !== lastSignature;
      if (
        uniqueOthers.length > 0 &&
        changed &&
        now - lastToastAt > PRESENCE_TOAST_COOLDOWN_MS
      ) {
        const headline =
          uniqueOthers.length === 1
            ? `${uniqueOthers[0]} is active right now`
            : `${uniqueOthers.length} others are active right now`;
        uiToast(headline, { timeoutMs: 5000 });
        lastToastAt = now;
      }
      lastSignature = signature;
    },
  });

  const onPageHide = () => {
    try {
      clearInterval(mountProbe);
    } catch (_) {}
    try {
      cleanup?.();
    } catch (_) {}
  };
  window.addEventListener('pagehide', onPageHide, { once: true });
}

function isTypingContext(target) {
  const el = target instanceof Element ? target : null;
  const active =
    document.activeElement instanceof Element ? document.activeElement : null;

  const selector =
    'input, textarea, select, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]';

  return !!(el?.closest(selector) || active?.closest(selector));
}

function isAppBarSearchContext(target) {
  const el = target instanceof Element ? target : null;
  const active =
    document.activeElement instanceof Element ? document.activeElement : null;
  return !!(
    el?.closest?.('#appBarSearchInput') ||
    active?.closest?.('#appBarSearchInput')
  );
}

function isModalOpen() {
  try {
    if (window.ui && typeof window.ui.isDialogOpen === 'function') {
      return !!window.ui.isDialogOpen();
    }
  } catch (_) {}
  // Legacy fallback (older static modals)
  return !!document.querySelector('.modal:not(.hidden)');
}

const typeToAppBarSearchControllers = new WeakMap();
const appBarSearchControllers = new WeakMap();

function wireTypeToAppBarSearch(searchInput) {
  if (!(searchInput instanceof HTMLInputElement)) return;
  const priorController = typeToAppBarSearchControllers.get(searchInput);
  try {
    priorController?.abort();
  } catch (_) {}
  const controller = new AbortController();
  typeToAppBarSearchControllers.set(searchInput, controller);

  const onKeyDown = (e) => {
    if (!(e instanceof KeyboardEvent)) return;
    if (e.defaultPrevented) return;
    if (e.isComposing) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== ' ' && e.shiftKey) return;
    if (e.key.length !== 1) return;
    if (isModalOpen()) return;
    if (document.activeElement?.closest?.('.bottom-nav')) return;
    if (isAppBarSearchContext(e.target)) return;
    if (isTypingContext(e.target)) return;

    e.preventDefault();

    const start =
      typeof searchInput.selectionStart === 'number'
        ? searchInput.selectionStart
        : searchInput.value.length;
    const end =
      typeof searchInput.selectionEnd === 'number'
        ? searchInput.selectionEnd
        : searchInput.value.length;
    const nextValue =
      searchInput.value.slice(0, start) +
      e.key +
      searchInput.value.slice(Math.max(start, end));

    if (typeof setCompactWebAppBarSearchExpanded === 'function') {
      setCompactWebAppBarSearchExpanded(true);
    }
    searchInput.focus();
    searchInput.value = nextValue;

    try {
      const caret = start + e.key.length;
      searchInput.setSelectionRange(caret, caret);
    } catch (_) {}

    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  };

  document.addEventListener('keydown', onKeyDown, {
    capture: true,
    signal: controller.signal,
  });
}

function wireAppBarSearch(searchInput, options = {}) {
  if (!(searchInput instanceof HTMLInputElement)) return null;
  const priorController = appBarSearchControllers.get(searchInput);
  try {
    priorController?.abort();
  } catch (_) {}
  const controller = new AbortController();
  appBarSearchControllers.set(searchInput, controller);

  const {
    clearBtn = document.getElementById('appBarSearchClear'),
    toggleBtn = document.getElementById('appBarSearchToggleBtn'),
    onQueryChange = null,
    normalizeQuery = (value) => String(value || '').trim(),
    enableTypeToSearch = true,
  } = options;

  if (enableTypeToSearch) wireTypeToAppBarSearch(searchInput);

  const isCompactExpanded = () =>
    typeof isCompactWebAppBarSearchExpanded === 'function' &&
    isCompactWebAppBarSearchExpanded();

  const expandCompactSearch = () => {
    if (typeof setCompactWebAppBarSearchExpanded === 'function') {
      return !!setCompactWebAppBarSearchExpanded(true, { focusInput: true });
    }
    searchInput.focus();
    return false;
  };

  const collapseCompactSearch = ({ restoreFocus = false } = {}) => {
    if (typeof setCompactWebAppBarSearchExpanded === 'function') {
      return !!setCompactWebAppBarSearchExpanded(false, { restoreFocus });
    }
    if (restoreFocus && toggleBtn instanceof HTMLButtonElement) {
      toggleBtn.focus();
    }
    return false;
  };

  const syncClearBtn = () => {
    if (!(clearBtn instanceof HTMLElement)) return;
    const compactExpanded = isCompactExpanded();
    clearBtn.style.display =
      searchInput.value || compactExpanded ? 'inline' : 'none';
    clearBtn.setAttribute(
      'aria-label',
      searchInput.value ? 'Clear search' : 'Close search',
    );
  };

  const emitQueryChange = () => {
    syncClearBtn();
    if (typeof onQueryChange === 'function') {
      onQueryChange(normalizeQuery(searchInput.value), searchInput.value);
    }
  };

  syncClearBtn();
  searchInput.addEventListener('input', emitQueryChange, {
    signal: controller.signal,
  });

  if (toggleBtn instanceof HTMLButtonElement) {
    toggleBtn.addEventListener(
      'click',
      () => {
        expandCompactSearch();
        syncClearBtn();
      },
      { signal: controller.signal },
    );
  }

  if (clearBtn instanceof HTMLElement) {
    clearBtn.addEventListener(
      'click',
      () => {
        if (searchInput.value) {
          searchInput.value = '';
          emitQueryChange();
          searchInput.focus();
          return;
        }
        collapseCompactSearch({ restoreFocus: true });
        syncClearBtn();
      },
      { signal: controller.signal },
    );
  }

  searchInput.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (isCompactExpanded()) {
          collapseCompactSearch({ restoreFocus: true });
          syncClearBtn();
        } else {
          searchInput.blur();
        }
      }
    },
    { signal: controller.signal },
  );

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!isCompactExpanded()) return;
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      if (target.closest('.app-bar-wrapper')) return;
      collapseCompactSearch();
      syncClearBtn();
    },
    {
      capture: true,
      signal: controller.signal,
    },
  );

  window.addEventListener(
    'resize',
    () => {
      if (
        typeof isCompactWebAppBarModeActive === 'function' &&
        !isCompactWebAppBarModeActive()
      ) {
        collapseCompactSearch();
      }
      syncClearBtn();
    },
    { signal: controller.signal },
  );

  return {
    clearBtn,
    toggleBtn,
    syncClearBtn,
    emitQueryChange,
    expandCompactSearch,
    collapseCompactSearch,
  };
}

const TOP_LEVEL_EMPTY_STATE_MESSAGES = Object.freeze({
  recipes: Object.freeze({
    diagnosis: 'utter emptiness.',
    cta: 'total bliss.',
  }),
  shoppingItems: Object.freeze({
    diagnosis: 'utter emptiness.',
    cta: 'total bliss.',
  }),
  shoppingList: Object.freeze({
    diagnosis: 'utter emptiness.',
    cta: 'total bliss.',
  }),
  searchNoMatch: Object.freeze({
    diagnosis: 'utter emptiness.',
    cta: 'total bliss.',
  }),
  units: Object.freeze({
    diagnosis: 'utter emptiness.',
    cta: 'total bliss.',
  }),
  tags: Object.freeze({
    diagnosis: 'utter emptiness.',
    cta: 'total bliss.',
  }),
  sizes: Object.freeze({
    diagnosis: 'utter emptiness.',
    cta: 'total bliss.',
  }),
  stores: Object.freeze({
    diagnosis: 'utter emptiness.',
    cta: 'total bliss.',
  }),
});

function setTopLevelEmptyStateLayoutMode(listEl, isEmpty) {
  if (!(listEl instanceof HTMLElement)) return;
  listEl.classList.toggle('is-top-level-empty', !!isEmpty);
}

function resolveTopLevelEmptyStateMessage(messageOrKey) {
  if (
    messageOrKey &&
    typeof messageOrKey === 'object' &&
    !Array.isArray(messageOrKey)
  ) {
    return {
      diagnosis: String(messageOrKey.diagnosis || '').trim(),
      cta: String(messageOrKey.cta || '').trim(),
    };
  }
  const messageKey = String(messageOrKey || '').trim();
  if (messageKey && TOP_LEVEL_EMPTY_STATE_MESSAGES[messageKey]) {
    return TOP_LEVEL_EMPTY_STATE_MESSAGES[messageKey];
  }
  const parts = Array.isArray(messageOrKey)
    ? messageOrKey.map((s) => String(s || '').trim()).filter(Boolean)
    : [String(messageOrKey || '').trim()].filter(Boolean);
  return {
    diagnosis: parts[0] || '',
    cta: parts[1] || '',
  };
}

function renderTopLevelEmptyState(listEl, messageOrKey) {
  if (!(listEl instanceof HTMLElement)) return;
  setTopLevelEmptyStateLayoutMode(listEl, true);
  listEl.innerHTML = '';
  const { diagnosis, cta } = resolveTopLevelEmptyStateMessage(messageOrKey);
  const li = document.createElement('li');
  li.className = 'list-section-label top-level-empty-state';
  const diagnosisEl = document.createElement('p');
  diagnosisEl.className = 'top-level-empty-diagnosis';
  diagnosisEl.textContent = diagnosis;
  li.appendChild(diagnosisEl);
  const ctaEl = document.createElement('p');
  ctaEl.className = 'top-level-empty-cta';
  ctaEl.textContent = cta;
  li.appendChild(ctaEl);
  listEl.appendChild(li);
}

function normalizeRecipeTagList(rawTags) {
  const source = Array.isArray(rawTags)
    ? rawTags
    : String(rawTags || '').split('\n');
  const seen = new Set();
  const out = [];
  source
    .map((v) =>
      String(v || '')
        .trim()
        .replace(/\s+/g, ' '),
    )
    .filter(Boolean)
    .forEach((tag) => {
      const clipped = tag.length > 48 ? tag.slice(0, 48).trim() : tag;
      if (!clipped) return;
      const key = clipped.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(clipped);
    });
  return out;
}

// --- Unit/size row state helpers (tests extract this block) ---
function normalizeUnitSizeFlag(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n === 1 : value === true;
}

function getUnitSizeRowState(row) {
  return {
    isHidden: normalizeUnitSizeFlag(row?.isHidden ?? row?.is_hidden),
    isRemoved: normalizeUnitSizeFlag(row?.isRemoved ?? row?.is_removed),
  };
}

function isUnitSizeRowSelectable(row) {
  const state = getUnitSizeRowState(row);
  return state.isRemoved !== true;
}

function getUnitSizeRemovalAction(usedRecipeCount) {
  const n = Number(usedRecipeCount);
  if (Number.isFinite(n) && n > 0) return 'remove';
  return 'delete';
}

function shouldShowUnitSizeRow(row, activeFilterChips) {
  const state = getUnitSizeRowState(row);
  const chipSet =
    activeFilterChips && typeof activeFilterChips.has === 'function'
      ? activeFilterChips
      : new Set();
  const showHidden = chipSet.has('hidden');
  const showRemoved = chipSet.has('removed');
  if (!showHidden && !showRemoved) return !state.isHidden && !state.isRemoved;
  if (showHidden && showRemoved) return state.isHidden || state.isRemoved;
  if (showHidden) return state.isHidden === true;
  return state.isRemoved === true;
}

if (typeof window !== 'undefined') {
  window.__unitSizeRowStateHelpers = {
    normalizeUnitSizeFlag,
    getUnitSizeRowState,
    isUnitSizeRowSelectable,
    getUnitSizeRemovalAction,
    shouldShowUnitSizeRow,
  };
}
// --- End unit/size row state helpers ---

// --- Size sort helpers (tests extract this block) ---
function normalizeSizeSortLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function getNamedSizeRank(value) {
  const label = normalizeSizeSortLabel(value).replace(/\s*-\s*/g, '-');
  if (!label) return null;

  const rankMap = new Map([
    ['extra-small', 10],
    ['x-small', 10],
    ['xsmall', 10],
    ['xs', 10],
    ['small', 20],
    ['sm', 20],
    ['medium', 30],
    ['med', 30],
    ['regular', 30],
    ['large', 40],
    ['lg', 40],
    ['extra-large', 50],
    ['x-large', 50],
    ['xlarge', 50],
    ['xl', 50],
    ['jumbo', 60],
    ['family-size', 70],
    ['family size', 70],
  ]);
  return rankMap.has(label) ? rankMap.get(label) : null;
}

function getNumericSizeSortMeta(value) {
  const label = normalizeSizeSortLabel(value);
  if (!label) return null;

  const match = label.match(
    /^(\d+(?:\.\d+)?)\s*(oz|ounce|ounces|g|gram|grams|kg|kilogram|kilograms|lb|lbs|pound|pounds|ml|milliliter|milliliters|l|liter|liters)$/,
  );
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(amount)) return null;

  const weightUnits = {
    oz: 28.3495,
    ounce: 28.3495,
    ounces: 28.3495,
    g: 1,
    gram: 1,
    grams: 1,
    kg: 1000,
    kilogram: 1000,
    kilograms: 1000,
    lb: 453.592,
    lbs: 453.592,
    pound: 453.592,
    pounds: 453.592,
  };
  if (Object.prototype.hasOwnProperty.call(weightUnits, unit)) {
    return { group: 1, rank: amount * weightUnits[unit], label };
  }

  const volumeUnits = {
    ml: 1,
    milliliter: 1,
    milliliters: 1,
    l: 1000,
    liter: 1000,
    liters: 1000,
  };
  if (Object.prototype.hasOwnProperty.call(volumeUnits, unit)) {
    return { group: 2, rank: amount * volumeUnits[unit], label };
  }

  return null;
}

function getSizeSortMeta(value) {
  const label = normalizeSizeSortLabel(
    value && typeof value === 'object' ? value.name : value,
  );
  const namedRank = getNamedSizeRank(label);
  if (namedRank != null) return { group: 0, rank: namedRank, label };

  const numericMeta = getNumericSizeSortMeta(label);
  if (numericMeta) return numericMeta;

  return { group: 3, rank: Number.POSITIVE_INFINITY, label };
}

function getSizeSortOrderValue(value) {
  if (!value || typeof value !== 'object') return null;
  const n = Number(value.sortOrder ?? value.sort_order);
  return Number.isFinite(n) ? n : null;
}

function compareSizeDisplayValues(a, b) {
  const metaA = getSizeSortMeta(a);
  const metaB = getSizeSortMeta(b);
  if (metaA.group !== metaB.group) return metaA.group - metaB.group;
  if (metaA.rank !== metaB.rank) return metaA.rank - metaB.rank;

  // For unclassified text sizes, preserve curated DB order when present.
  if (metaA.group === 3) {
    const sortA = getSizeSortOrderValue(a);
    const sortB = getSizeSortOrderValue(b);
    if (sortA != null && sortB != null && sortA !== sortB) return sortA - sortB;
  }

  const labelCompare = metaA.label.localeCompare(metaB.label, undefined, {
    sensitivity: 'base',
  });
  if (labelCompare !== 0) return labelCompare;

  const sortA = getSizeSortOrderValue(a);
  const sortB = getSizeSortOrderValue(b);
  if (sortA != null && sortB != null && sortA !== sortB) return sortA - sortB;

  return 0;
}

function sortSizeNames(values) {
  return (Array.isArray(values) ? values.slice() : []).sort(
    compareSizeDisplayValues,
  );
}

function sortSizeRows(rows) {
  return (Array.isArray(rows) ? rows.slice() : []).sort(
    compareSizeDisplayValues,
  );
}

if (typeof window !== 'undefined') {
  window.__sizeSortHelpers = {
    normalizeSizeSortLabel,
    getNamedSizeRank,
    getNumericSizeSortMeta,
    getSizeSortMeta,
    compareSizeDisplayValues,
    sortSizeNames,
    sortSizeRows,
  };
}
// --- End size sort helpers ---

// --- Shopping list amount helpers (tests extract this block) ---
const SHOPPING_LIST_MEASURED_UNIT_META = Object.freeze({
  tsp: Object.freeze({
    family: 'volume',
    baseUnit: 'ml',
    factor: 4.92892159375,
  }),
  tbsp: Object.freeze({
    family: 'volume',
    baseUnit: 'ml',
    factor: 14.78676478125,
  }),
  cup: Object.freeze({ family: 'volume', baseUnit: 'ml', factor: 236.5882365 }),
  'fl oz': Object.freeze({
    family: 'volume',
    baseUnit: 'ml',
    factor: 29.5735295625,
  }),
  pt: Object.freeze({ family: 'volume', baseUnit: 'ml', factor: 473.176473 }),
  qt: Object.freeze({ family: 'volume', baseUnit: 'ml', factor: 946.352946 }),
  gal: Object.freeze({ family: 'volume', baseUnit: 'ml', factor: 3785.411784 }),
  ml: Object.freeze({ family: 'volume', baseUnit: 'ml', factor: 1 }),
  l: Object.freeze({ family: 'volume', baseUnit: 'ml', factor: 1000 }),
  g: Object.freeze({ family: 'mass', baseUnit: 'g', factor: 1 }),
  kg: Object.freeze({ family: 'mass', baseUnit: 'g', factor: 1000 }),
  oz: Object.freeze({ family: 'mass', baseUnit: 'g', factor: 28.349523125 }),
  lb: Object.freeze({ family: 'mass', baseUnit: 'g', factor: 453.59237 }),
});

const SHOPPING_LIST_UNIT_ALIASES = Object.freeze({
  t: 'tsp',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tb: 'tbsp',
  tbl: 'tbsp',
  tbspn: 'tbsp',
  tbs: 'tbsp',
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  c: 'cup',
  cup: 'cup',
  cups: 'cup',
  floz: 'fl oz',
  'fl oz': 'fl oz',
  'fluid ounce': 'fl oz',
  'fluid ounces': 'fl oz',
  fluidounce: 'fl oz',
  fluidounces: 'fl oz',
  pt: 'pt',
  pint: 'pt',
  pints: 'pt',
  qt: 'qt',
  quart: 'qt',
  quarts: 'qt',
  gal: 'gal',
  gallon: 'gal',
  gallons: 'gal',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  l: 'l',
  liter: 'l',
  liters: 'l',
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
});

function normalizeShoppingListUnit(unitText) {
  const raw = String(unitText || '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');
  if (!raw) return '';
  if (Object.prototype.hasOwnProperty.call(SHOPPING_LIST_UNIT_ALIASES, raw)) {
    return SHOPPING_LIST_UNIT_ALIASES[raw];
  }
  if (raw.endsWith('ies') && raw.length > 3) return `${raw.slice(0, -3)}y`;
  if (/(ches|shes|xes|zes|ses)$/.test(raw)) return raw.slice(0, -2);
  if (raw.endsWith('s') && !raw.endsWith('ss')) return raw.slice(0, -1);
  return raw;
}

function getShoppingListMeasuredUnitMeta(unitText) {
  const normalized = normalizeShoppingListUnit(unitText);
  if (!normalized) return null;
  return SHOPPING_LIST_MEASURED_UNIT_META[normalized] || null;
}

function convertShoppingListQuantityToMeasuredBase(quantity, unitText) {
  const numeric = Number(quantity);
  const meta = getShoppingListMeasuredUnitMeta(unitText);
  if (!meta || !Number.isFinite(numeric) || numeric <= 0) return null;
  return {
    unit: normalizeShoppingListUnit(unitText),
    family: meta.family,
    baseUnit: meta.baseUnit,
    baseQuantity: Number((numeric * meta.factor).toFixed(6)),
  };
}

function roundShoppingListDisplayQuantity(value, unitText = '') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  const normalizedUnit = normalizeShoppingListUnit(unitText);
  let denominators = null;
  let allowThirds = false;

  if (
    normalizedUnit === 'tsp' ||
    normalizedUnit === 'tbsp' ||
    normalizedUnit === 'cup'
  ) {
    denominators = [2, 4, 8];
    allowThirds = true;
  } else if (
    normalizedUnit === 'oz' ||
    normalizedUnit === 'lb' ||
    normalizedUnit === 'pt' ||
    normalizedUnit === 'qt' ||
    normalizedUnit === 'gal'
  ) {
    denominators = [2, 4];
  }

  if (!denominators) return Number(numeric.toFixed(2));

  const abs = Math.abs(numeric);
  const whole = Math.floor(abs);
  const fraction = abs - whole;
  let best = null;

  const registerCandidate = (candidateValue, denominatorWeight) => {
    const err = Math.abs(abs - candidateValue);
    if (
      best == null ||
      err < best.err - 1e-12 ||
      (Math.abs(err - best.err) <= 1e-12 && denominatorWeight < best.den)
    ) {
      best = {
        value: candidateValue,
        err,
        den: denominatorWeight,
      };
    }
  };

  denominators.forEach((den) => {
    const num = Math.round(fraction * den);
    registerCandidate(whole + num / den, den);
  });

  if (allowThirds) {
    const thirdNum = Math.round(fraction * 3);
    registerCandidate(whole + thirdNum / 3, 3);
  }

  if (!best) return Number(numeric.toFixed(2));
  const rounded = Number(best.value.toFixed(6));
  return Number.isFinite(rounded) && rounded > 0
    ? rounded
    : Number(numeric.toFixed(2));
}

function getShoppingListMeasuredDisplayFromBase(family, baseQuantity) {
  const numeric = Number(baseQuantity);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  if (family === 'mass') {
    const ounces = numeric / SHOPPING_LIST_MEASURED_UNIT_META.oz.factor;
    const displayUnit = ounces >= 16 - 1e-9 ? 'lb' : 'oz';
    const unitMeta = SHOPPING_LIST_MEASURED_UNIT_META[displayUnit];
    const displayQuantity = roundShoppingListDisplayQuantity(
      numeric / unitMeta.factor,
      displayUnit,
    );
    if (!Number.isFinite(displayQuantity) || displayQuantity <= 0) return null;
    return {
      family,
      quantity: displayQuantity,
      unit: displayUnit,
    };
  }

  if (family === 'volume') {
    const cups = numeric / SHOPPING_LIST_MEASURED_UNIT_META.cup.factor;
    let displayUnit = 'tsp';
    if (cups >= 16 - 1e-9) displayUnit = 'gal';
    else if (cups >= 4 - 1e-9) displayUnit = 'qt';
    else if (cups >= 1 - 1e-9) displayUnit = 'cup';
    else {
      const tablespoons =
        numeric / SHOPPING_LIST_MEASURED_UNIT_META.tbsp.factor;
      if (tablespoons >= 1 - 1e-9) displayUnit = 'tbsp';
    }
    const unitMeta = SHOPPING_LIST_MEASURED_UNIT_META[displayUnit];
    const displayQuantity = roundShoppingListDisplayQuantity(
      numeric / unitMeta.factor,
      displayUnit,
    );
    if (!Number.isFinite(displayQuantity) || displayQuantity <= 0) return null;
    return {
      family,
      quantity: displayQuantity,
      unit: displayUnit,
    };
  }

  return null;
}

const INGREDIENT_BASE_VARIANT_NAME = 'default';
const INGREDIENT_RESERVED_VARIANT_NAMES = Object.freeze(
  new Set([INGREDIENT_BASE_VARIANT_NAME, 'base', 'any']),
);

function isIngredientBaseVariantName(rawVariant) {
  const normalized = String(rawVariant || '')
    .trim()
    .toLowerCase();
  return !normalized || normalized === INGREDIENT_BASE_VARIANT_NAME;
}

function normalizeNamedIngredientVariant(rawVariant) {
  const trimmed = String(rawVariant || '').trim();
  return isIngredientBaseVariantName(trimmed) ? '' : trimmed;
}

function isReservedIngredientVariantName(rawVariant) {
  const normalized = String(rawVariant || '')
    .trim()
    .toLowerCase();
  return normalized ? INGREDIENT_RESERVED_VARIANT_NAMES.has(normalized) : false;
}

function getIngredientBaseVariantWhereSql(columnSql = 'variant') {
  const escapedBaseVariant = INGREDIENT_BASE_VARIANT_NAME.replace(/'/g, "''");
  return `lower(trim(COALESCE(${columnSql}, ''))) IN ('', '${escapedBaseVariant}')`;
}

function getShoppingListIngredientLabel(name, variantName = '') {
  const displayFields = getShoppingListDisplayFields(name, variantName);
  const fallbackVariant =
    String(variantName || '').trim() &&
    String(variantName || '')
      .trim()
      .toLowerCase() !== 'default' &&
    !isShoppingListSizeVariant(variantName)
      ? variantName
      : '';
  const fallback = [
    String(fallbackVariant || '').trim(),
    String(name || '').trim(),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  return displayFields.displayName || fallback;
}

function formatShoppingListIngredientText(line) {
  const source = line && typeof line === 'object' ? line : {};
  if (typeof window === 'undefined') {
    return String(source?.name || '').trim();
  }
  if (typeof window.formatIngredientText === 'function') {
    try {
      return String(window.formatIngredientText(source) || '').trim();
    } catch (_) {}
  }
  const fallbackName = [
    String(source.variant || '').trim(),
    String(source.name || '').trim(),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  const pieces = [
    String(source.quantity ?? '').trim(),
    String(source.size || '').trim(),
    String(source.unit || '').trim(),
    fallbackName,
  ].filter(Boolean);
  return pieces.join(' ').trim();
}

const SHOPPING_LIST_SIZE_VARIANT_TOKENS = Object.freeze(
  new Set([
    'small',
    'medium',
    'large',
    'extra-small',
    'extra small',
    'x-small',
    'x small',
    'extra-large',
    'extra large',
    'x-large',
    'x large',
    'xlarge',
    'jumbo',
    'mini',
  ]),
);

const SHOPPING_LIST_SINGULAR_UNIT_TOKENS = Object.freeze(
  new Set([
    'tsp',
    'tbsp',
    'cup',
    'fl oz',
    'oz',
    'lb',
    'pt',
    'qt',
    'gal',
    'ml',
    'l',
    'g',
    'kg',
    'can',
    'bag',
    'box',
    'carton',
    'package',
    'packet',
    'bottle',
    'jar',
    'container',
    'stick',
    'loaf',
  ]),
);

function formatShoppingListDisplayQuantity(quantity) {
  const numeric = Number(quantity);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  if (
    typeof window !== 'undefined' &&
    typeof window.decimalToFractionDisplay === 'function'
  ) {
    try {
      const formatted = window.decimalToFractionDisplay(numeric);
      if (formatted) return String(formatted).trim();
    } catch (_) {}
  }
  return formatShoppingPlanQuantity(numeric);
}

function isShoppingListSizeVariant(variantText) {
  const normalized = String(variantText || '')
    .trim()
    .toLowerCase();
  return normalized ? SHOPPING_LIST_SIZE_VARIANT_TOKENS.has(normalized) : false;
}

function getShoppingListDisplayFields(name, variantName = '') {
  const resolvedName = String(name || '').trim();
  const resolvedVariant = String(variantName || '').trim();
  const normalizedVariant = resolvedVariant.toLowerCase();
  const nameVariant =
    resolvedVariant &&
    normalizedVariant !== 'default' &&
    !isShoppingListSizeVariant(resolvedVariant)
      ? resolvedVariant
      : '';
  const quantitySizePrefix =
    resolvedVariant &&
    normalizedVariant !== 'default' &&
    isShoppingListSizeVariant(resolvedVariant)
      ? resolvedVariant
      : '';

  let displayName = '';
  if (
    typeof window !== 'undefined' &&
    typeof window.getIngredientDisplayCoreParts === 'function'
  ) {
    try {
      displayName = String(
        window.getIngredientDisplayCoreParts({
          name: resolvedName,
          variant: nameVariant,
        })?.nameText || '',
      ).trim();
    } catch (_) {}
  }
  if (!displayName) {
    displayName = [nameVariant, resolvedName].filter(Boolean).join(' ').trim();
  }

  return {
    displayName,
    quantitySizePrefix,
  };
}

function mergeShoppingListSizeText(prefix, sizeText = '') {
  return [String(prefix || '').trim(), String(sizeText || '').trim()]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function shouldUseShoppingListSingularUnit(unitText) {
  const normalizedUnit = normalizeShoppingListUnit(unitText);
  return normalizedUnit
    ? SHOPPING_LIST_SINGULAR_UNIT_TOKENS.has(normalizedUnit)
    : false;
}

function formatShoppingListAmountLeadText({
  quantity = '',
  size = '',
  unit = '',
} = {}) {
  const normalizedUnit = normalizeShoppingListUnit(unit);
  if (shouldUseShoppingListSingularUnit(normalizedUnit)) {
    const quantityText = formatShoppingListDisplayQuantity(quantity);
    return [quantityText, String(size || '').trim(), normalizedUnit]
      .filter(Boolean)
      .join(' ')
      .trim();
  }
  if (
    typeof window !== 'undefined' &&
    typeof window.getIngredientDisplayCoreParts === 'function'
  ) {
    try {
      return String(
        window.getIngredientDisplayCoreParts({
          quantity,
          size,
          unit,
          name: '',
          variant: '',
        })?.leadText || '',
      ).trim();
    } catch (_) {}
  }
  const quantityText = formatShoppingListDisplayQuantity(quantity);
  return [quantityText, String(size || '').trim(), String(unit || '').trim()]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function getShoppingListBucketSortPriority(bucket) {
  if (!bucket || typeof bucket !== 'object') return 99;
  if (bucket.kind === 'unspecified') return 0;
  if (bucket.kind === 'selected' || bucket.kind === 'count') return 1;
  return 2;
}

function formatShoppingListUnspecifiedLeadText({ size = '' } = {}) {
  return ['some', String(size || '').trim()].filter(Boolean).join(' ').trim();
}

function getShoppingListBucketLeadText(bucket, options = {}) {
  if (!bucket || typeof bucket !== 'object') return '';
  const quantitySizePrefix = String(options.quantitySizePrefix || '').trim();
  if (bucket.kind === 'selected') {
    return formatShoppingListAmountLeadText({
      quantity: bucket.quantity,
      size: quantitySizePrefix,
    });
  }
  if (bucket.kind === 'unspecified') {
    return formatShoppingListUnspecifiedLeadText({
      size: quantitySizePrefix,
    });
  }
  if (bucket.kind === 'measured') {
    const display = getShoppingListMeasuredDisplayFromBase(
      bucket.family,
      bucket.baseQuantity,
    );
    if (!display) return '';
    return formatShoppingListAmountLeadText({
      quantity: display.quantity,
      size: quantitySizePrefix,
      unit: display.unit,
    });
  }
  return formatShoppingListAmountLeadText({
    quantity: bucket.quantity,
    size: mergeShoppingListSizeText(quantitySizePrefix, bucket.size || ''),
    unit: bucket.unit || '',
  });
}

function formatShoppingListDisplayDetailText({
  variantName = '',
  buckets = [],
} = {}) {
  const displayFields = getShoppingListDisplayFields('', variantName);
  const list = Array.isArray(buckets) ? buckets.filter(Boolean) : [];
  if (!list.length) return '';
  return list
    .slice()
    .sort(
      (a, b) =>
        getShoppingListBucketSortPriority(a) -
        getShoppingListBucketSortPriority(b),
    )
    .map((bucket) =>
      getShoppingListBucketLeadText(bucket, {
        quantitySizePrefix: displayFields.quantitySizePrefix,
      }),
    )
    .filter(Boolean)
    .join(' + ');
}

function formatShoppingListDisplayRow({
  label = '',
  name = '',
  variantName = '',
  buckets = [],
} = {}) {
  const displayFields = getShoppingListDisplayFields(name, variantName);
  const resolvedLabel =
    String(label || '').trim() ||
    displayFields.displayName ||
    getShoppingListIngredientLabel(name, variantName);
  if (!resolvedLabel) return '';
  const detailText = formatShoppingListDisplayDetailText({
    variantName,
    buckets,
  });
  if (!detailText) return resolvedLabel;
  return `${resolvedLabel} (${detailText})`;
}

function getShoppingListPlanRowResolvedLabel(planRow) {
  if (!planRow || typeof planRow !== 'object') return '';
  const name = String(planRow.name || '').trim();
  const variantName = String(planRow.variantName || '').trim();
  const displayFields = getShoppingListDisplayFields(name, variantName);
  return (
    String(planRow.label || '').trim() ||
    displayFields.displayName ||
    getShoppingListIngredientLabel(name, variantName) ||
    ''
  );
}

function splitShoppingListRowTextToLabelAndDetail(text) {
  const src = String(text || '').trim();
  if (!src) return { label: '', detail: '' };
  const m = src.match(/^(.+?)\s+\(([^)]*)\)\s*$/);
  if (!m) {
    return { label: src, detail: '' };
  }
  return {
    label: String(m[1] || '').trim(),
    detail: String(m[2] || '').trim(),
  };
}

function joinShoppingListLabelAndDetail(label, detail) {
  const l = String(label || '').trim();
  const d = String(detail || '').trim();
  if (!l) return d;
  if (!d) return l;
  return `${l} (${d})`;
}

function shoppingListRowAmountDetailDivergedFromSource(row) {
  const sourceKey = String(row?.sourceKey || '').trim();
  const sourceText = String(row?.sourceText || '').trim();
  if (!sourceKey || !sourceText) return false;
  const currentText = String(row?.text || '').trim();
  const cur = splitShoppingListRowTextToLabelAndDetail(currentText);
  const src = splitShoppingListRowTextToLabelAndDetail(sourceText);
  if (cur.detail || src.detail) {
    return cur.detail !== src.detail;
  }
  return currentText !== sourceText;
}

if (typeof window !== 'undefined') {
  window.__shoppingListAmountHelpers = {
    normalizeShoppingListUnit,
    getShoppingListMeasuredUnitMeta,
    convertShoppingListQuantityToMeasuredBase,
    roundShoppingListDisplayQuantity,
    getShoppingListMeasuredDisplayFromBase,
    getShoppingListIngredientLabel,
    getShoppingListBucketLeadText,
    formatShoppingListDisplayDetailText,
    formatShoppingListDisplayRow,
  };
}
// --- End shopping list amount helpers ---

// --- Shopping browse labeling helpers (tests extract this block) ---
function normalizeShoppingBrowseLocationId(raw) {
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  return !value || value === 'measures' ? 'none' : value;
}

function getShoppingBrowseVariantHomeRows(item) {
  const rows = Array.isArray(item?.variantHomeLocations)
    ? item.variantHomeLocations
    : [];
  const out = [];
  const byKey = new Map();
  rows.forEach((entry) => {
    const variant = String(entry?.variant || '').trim();
    if (!variant) return;
    const rowKey = variant.toLowerCase();
    const normalizedHome = normalizeShoppingBrowseLocationId(
      entry?.homeLocation,
    );
    const existing = byKey.get(rowKey);
    if (existing) {
      if (existing.homeLocation === 'none' && normalizedHome !== 'none') {
        existing.homeLocation = normalizedHome;
      }
      return;
    }
    const nextRow = { variant, homeLocation: normalizedHome };
    byKey.set(rowKey, nextRow);
    out.push(nextRow);
  });
  const baseHomeFallback = normalizeShoppingBrowseLocationId(
    item?.locationAtHome,
  );
  if (baseHomeFallback !== 'none') {
    out.forEach((row) => {
      if (row.homeLocation === 'none') {
        row.homeLocation = baseHomeFallback;
      }
    });
  }
  return out;
}

function getShoppingBrowseLocationIds(item) {
  const ids = [];
  const seen = new Set();
  const pushId = (rawId) => {
    const normalizedId = normalizeShoppingBrowseLocationId(rawId);
    if (seen.has(normalizedId)) return;
    seen.add(normalizedId);
    ids.push(normalizedId);
  };
  pushId(item?.locationAtHome);
  getShoppingBrowseVariantHomeRows(item).forEach((entry) =>
    pushId(entry.homeLocation),
  );
  return ids;
}

function getShoppingBrowseMatchInfo(item, options = {}) {
  const normalizedQuery = String(options?.searchQuery || '')
    .trim()
    .toLowerCase();
  const normalizedLocationIds = Array.from(
    new Set(
      (Array.isArray(options?.locationIds) ? options.locationIds : [])
        .map((value) => normalizeShoppingBrowseLocationId(value))
        .filter(Boolean),
    ),
  );
  const hasQuery = !!normalizedQuery;
  const hasLocationFilters = normalizedLocationIds.length > 0;
  if (!hasQuery && !hasLocationFilters) {
    return {
      baseMatched: false,
      matchedVariantNames: [],
      variantNameToShow: '',
    };
  }

  const baseName = String(item?.name || '')
    .trim()
    .toLowerCase();
  const baseLocationId = normalizeShoppingBrowseLocationId(
    item?.locationAtHome,
  );
  const baseMatched =
    (!hasQuery || baseName.includes(normalizedQuery)) &&
    (!hasLocationFilters || normalizedLocationIds.includes(baseLocationId));

  const matchedVariantNames = getShoppingBrowseVariantHomeRows(item)
    .filter((entry) => {
      const variantName = String(entry?.variant || '')
        .trim()
        .toLowerCase();
      if (!variantName) return false;
      const searchMatches = !hasQuery || variantName.includes(normalizedQuery);
      const locationMatches =
        !hasLocationFilters ||
        normalizedLocationIds.includes(
          normalizeShoppingBrowseLocationId(entry?.homeLocation),
        );
      return searchMatches && locationMatches;
    })
    .map((entry) => String(entry.variant || '').trim())
    .filter(Boolean);

  return {
    baseMatched,
    matchedVariantNames,
    variantNameToShow:
      !baseMatched && matchedVariantNames.length === 1
        ? matchedVariantNames[0]
        : '',
  };
}

function formatShoppingBrowseItemLabel(baseLabel, item, options = {}) {
  const resolvedBaseLabel =
    String(baseLabel || '').trim() || String(item?.name || '').trim();
  if (!resolvedBaseLabel) return '';
  const matchInfo = getShoppingBrowseMatchInfo(item, options);
  return matchInfo.variantNameToShow
    ? `${resolvedBaseLabel} (${matchInfo.variantNameToShow})`
    : resolvedBaseLabel;
}

if (typeof window !== 'undefined') {
  window.__shoppingBrowseLabelHelpers = {
    normalizeShoppingBrowseLocationId,
    getShoppingBrowseVariantHomeRows,
    getShoppingBrowseLocationIds,
    getShoppingBrowseMatchInfo,
    formatShoppingBrowseItemLabel,
  };
}
// --- End shopping browse labeling helpers ---

function tableExistsInMain(db, tableName) {
  if (!db || !tableName) return false;
  try {
    const esc = String(tableName).replace(/'/g, "''");
    const q = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${esc}';`,
    );
    return !!(q && q.length && q[0].values && q[0].values.length);
  } catch (_) {
    return false;
  }
}

function tableHasColumnInMain(db, tableName, colName) {
  if (!db || !tableName || !colName) return false;
  try {
    const q = db.exec(`PRAGMA table_info(${tableName});`);
    const cols =
      Array.isArray(q) && q.length > 0 && Array.isArray(q[0].values)
        ? q[0].values
            .map((r) =>
              String((Array.isArray(r) ? r[1] : '') || '').toLowerCase(),
            )
            .filter(Boolean)
        : [];
    return cols.includes(String(colName || '').toLowerCase());
  } catch (_) {
    return false;
  }
}

function dropLegacyVariantAisleUniqueIndexesInMain(db) {
  if (!db) return false;
  let changed = false;
  try {
    const listQ = db.exec(
      `PRAGMA index_list('ingredient_variant_store_location');`,
    );
    const rows =
      Array.isArray(listQ) && listQ.length > 0 && Array.isArray(listQ[0].values)
        ? listQ[0].values
        : [];
    rows.forEach((row) => {
      const indexName = String((Array.isArray(row) ? row[1] : '') || '').trim();
      const isUnique = Number(Array.isArray(row) ? row[2] : 0) === 1;
      if (!indexName || !isUnique) return;
      try {
        const infoQ = db.exec(
          `PRAGMA index_info(${JSON.stringify(indexName)});`,
        );
        const infoRows =
          Array.isArray(infoQ) &&
          infoQ.length > 0 &&
          Array.isArray(infoQ[0].values)
            ? infoQ[0].values
            : [];
        const cols = infoRows
          .map((infoRow) =>
            String((Array.isArray(infoRow) ? infoRow[2] : '') || '').trim(),
          )
          .filter(Boolean);
        if (cols.length === 1 && cols[0] === 'ingredient_variant_id') {
          db.run(`DROP INDEX IF EXISTS "${indexName.replace(/"/g, '""')}";`);
          changed = true;
        }
      } catch (_) {}
    });
  } catch (_) {}
  return changed;
}

function ensureRecipeTagsSchemaInMain(db) {
  if (!db) return false;
  try {
    db.run('PRAGMA foreign_keys = ON;');
  } catch (_) {}
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL COLLATE NOCASE,
        is_hidden INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER,
        intended_use TEXT NOT NULL DEFAULT 'recipes'
      );
    `);
  } catch (_) {}
  try {
    if (!tableHasColumnInMain(db, 'tags', 'intended_use')) {
      db.run(
        "ALTER TABLE tags ADD COLUMN intended_use TEXT NOT NULL DEFAULT 'recipes';",
      );
    }
  } catch (_) {}
  try {
    db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_nocase
      ON tags(name COLLATE NOCASE);
    `);
  } catch (_) {}
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS recipe_tag_map (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL REFERENCES recipes(ID) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        sort_order INTEGER,
        UNIQUE(recipe_id, tag_id)
      );
    `);
  } catch (_) {}
  try {
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_recipe_tag_map_recipe
      ON recipe_tag_map(recipe_id, sort_order, id);
    `);
  } catch (_) {}
  try {
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_recipe_tag_map_tag
      ON recipe_tag_map(tag_id, recipe_id);
    `);
  } catch (_) {}
  return true;
}

function ensureIngredientVariantTagsSchemaInMain(db) {
  if (!db) return false;
  ensureRecipeTagsSchemaInMain(db);
  try {
    db.run('PRAGMA foreign_keys = ON;');
  } catch (_) {}
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS ingredient_variant_tag_map (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ingredient_variant_id INTEGER NOT NULL REFERENCES ingredient_variants(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        sort_order INTEGER,
        UNIQUE(ingredient_variant_id, tag_id)
      );
    `);
  } catch (_) {}
  try {
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_ingredient_variant_tag_map_variant
      ON ingredient_variant_tag_map(ingredient_variant_id, sort_order, id);
    `);
  } catch (_) {}
  try {
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_ingredient_variant_tag_map_tag
      ON ingredient_variant_tag_map(tag_id, ingredient_variant_id);
    `);
  } catch (_) {}
  ensureIngredientVariantIsDeprecatedColumnInMain(db);
  return true;
}

function ensureIngredientVariantIsDeprecatedColumnInMain(db) {
  if (!db) return false;
  try {
    if (!tableHasColumnInMain(db, 'ingredient_variants', 'ingredient_id')) {
      return false;
    }
    if (tableHasColumnInMain(db, 'ingredient_variants', 'is_deprecated')) {
      return false;
    }
    db.run(
      'ALTER TABLE ingredient_variants ADD COLUMN is_deprecated INTEGER NOT NULL DEFAULT 0;',
    );
    return true;
  } catch (_) {
    return false;
  }
}

function ensureSizesSchemaInMain(db) {
  if (!db) return false;
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS sizes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL COLLATE NOCASE,
        is_hidden INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER,
        is_removed INTEGER NOT NULL DEFAULT 0
      );
    `);
  } catch (_) {}
  try {
    if (!tableHasColumnInMain(db, 'sizes', 'is_hidden')) {
      db.run(
        'ALTER TABLE sizes ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;',
      );
    }
  } catch (_) {}
  try {
    if (!tableHasColumnInMain(db, 'sizes', 'is_removed')) {
      db.run(
        'ALTER TABLE sizes ADD COLUMN is_removed INTEGER NOT NULL DEFAULT 0;',
      );
    }
  } catch (_) {}
  try {
    db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sizes_name_nocase
      ON sizes(name COLLATE NOCASE);
    `);
  } catch (_) {}
  try {
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_sizes_sort
      ON sizes(sort_order, name COLLATE NOCASE);
    `);
  } catch (_) {}
  return true;
}

function ensureUnitsSchemaInMain(db) {
  if (!db) return false;
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS units (
        code TEXT PRIMARY KEY,
        name_singular TEXT NOT NULL,
        name_plural TEXT NOT NULL,
        category TEXT NOT NULL,
        sort_order INTEGER,
        is_hidden INTEGER NOT NULL DEFAULT 0,
        is_removed INTEGER NOT NULL DEFAULT 0
      );
    `);
  } catch (_) {}
  try {
    if (!tableHasColumnInMain(db, 'units', 'is_hidden')) {
      db.run(
        'ALTER TABLE units ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;',
      );
    }
  } catch (_) {}
  try {
    if (!tableHasColumnInMain(db, 'units', 'is_removed')) {
      db.run(
        'ALTER TABLE units ADD COLUMN is_removed INTEGER NOT NULL DEFAULT 0;',
      );
    }
  } catch (_) {}
  try {
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_units_sort
      ON units(sort_order, code COLLATE NOCASE);
    `);
  } catch (_) {}
  return true;
}

async function persistLoadedDbInMain(db, isElectron) {
  if (!db) return;
  await persistBinaryArrayInMain(db.export(), { isElectron });
}

async function persistBinaryArrayInMain(
  binaryArray,
  {
    isElectron = !!window.electronAPI,
    overwriteOnly = false,
    failureMessage = 'Failed to save database.',
  } = {},
) {
  if (isElectron) {
    if (!window.electronAPI || typeof window.electronAPI.saveDB !== 'function') {
      return;
    }
    const ok = await window.electronAPI.saveDB(binaryArray, { overwriteOnly });
    if (ok === false) throw new Error(failureMessage);
  } else {
    throw new Error('Saving requires the Electron app.');
  }
}

async function persistDbForCurrentRuntime(db, options = {}) {
  if (!db) return;
  const binaryArray = db.export();
  await persistBinaryArrayInMain(binaryArray, options);
}

function ensureIngredientBaseVariantsInMain(db) {
  if (
    !db ||
    !tableHasColumnInMain(db, 'ingredient_variants', 'ingredient_id') ||
    !tableHasColumnInMain(db, 'ingredient_variants', 'variant')
  ) {
    return 0;
  }
  const hasHomeLocation = tableHasColumnInMain(
    db,
    'ingredient_variants',
    'home_location',
  );
  const hasSortOrder = tableHasColumnInMain(
    db,
    'ingredient_variants',
    'sort_order',
  );
  const hasLegacyHomeLocation = tableHasColumnInMain(
    db,
    'ingredients',
    'location_at_home',
  );
  let changedCount = 0;
  let txStarted = false;

  try {
    const ingredientQ = db.exec(
      `SELECT ID, ${
        hasLegacyHomeLocation ? "COALESCE(location_at_home, 'none')" : "'none'"
      } AS legacy_home
       FROM ingredients
       ORDER BY ID ASC;`,
    );
    const ingredientRows =
      Array.isArray(ingredientQ) &&
      ingredientQ.length &&
      Array.isArray(ingredientQ[0].values)
        ? ingredientQ[0].values
        : [];
    if (!ingredientRows.length) return 0;

    try {
      db.run('BEGIN IMMEDIATE;');
      txStarted = true;
    } catch (_) {
      db.run('BEGIN;');
      txStarted = true;
    }

    ingredientRows.forEach(([ingredientIdRaw, legacyHomeRaw]) => {
      const ingredientId = Number(ingredientIdRaw);
      if (!Number.isFinite(ingredientId) || ingredientId <= 0) return;
      const clearLegacyHomeIfNeeded = () => {
        if (!hasLegacyHomeLocation || legacyHome === 'none') return false;
        db.run(
          `UPDATE ingredients
              SET location_at_home = 'none'
            WHERE ID = ?
              AND COALESCE(location_at_home, 'none') != 'none';`,
          [ingredientId],
        );
        return true;
      };

      const baseQ = db.exec(
        `SELECT id,
                COALESCE(variant, '') AS variant_name,
                ${hasHomeLocation ? "COALESCE(home_location, 'none')" : "'none'"} AS home_location,
                ${hasSortOrder ? 'COALESCE(sort_order, 999999)' : '0'} AS sort_order
           FROM ingredient_variants
          WHERE ingredient_id = ?
            AND ${getIngredientBaseVariantWhereSql('variant')}
          ORDER BY
            CASE
              WHEN lower(trim(COALESCE(variant, ''))) = '${INGREDIENT_BASE_VARIANT_NAME}'
                THEN 0
              ELSE 1
            END,
            ${hasSortOrder ? 'COALESCE(sort_order, 999999), ' : ''}id ASC
          LIMIT 1;`,
        [ingredientId],
      );
      const baseRow =
        Array.isArray(baseQ) &&
        baseQ.length &&
        Array.isArray(baseQ[0].values) &&
        baseQ[0].values.length
          ? baseQ[0].values[0]
          : null;
      const legacyHome = normalizeShoppingHomeLocationId(legacyHomeRaw);

      if (!baseRow) {
        const insertCols = ['ingredient_id', 'variant'];
        const insertVals = [ingredientId, INGREDIENT_BASE_VARIANT_NAME];
        if (hasSortOrder) {
          insertCols.push('sort_order');
          insertVals.push(0);
        }
        if (hasHomeLocation) {
          insertCols.push('home_location');
          insertVals.push(legacyHome);
        }
        const placeholders = insertCols.map(() => '?').join(', ');
        db.run(
          `INSERT INTO ingredient_variants (${insertCols.join(', ')}) VALUES (${placeholders});`,
          insertVals,
        );
        changedCount += clearLegacyHomeIfNeeded() ? 2 : 1;
        return;
      }

      const [baseIdRaw, baseVariantRaw, baseHomeRaw, baseSortOrderRaw] =
        baseRow;
      const baseId = Number(baseIdRaw);
      if (!Number.isFinite(baseId) || baseId <= 0) return;
      const currentHome = normalizeShoppingHomeLocationId(baseHomeRaw);
      const nextHome = currentHome !== 'none' ? currentHome : legacyHome;
      const sets = [];
      const vals = [];

      if (
        String(baseVariantRaw || '')
          .trim()
          .toLowerCase() !== INGREDIENT_BASE_VARIANT_NAME
      ) {
        sets.push('variant = ?');
        vals.push(INGREDIENT_BASE_VARIANT_NAME);
      }
      if (hasSortOrder && Number(baseSortOrderRaw) !== 0) {
        sets.push('sort_order = 0');
      }
      if (hasHomeLocation && nextHome !== currentHome) {
        sets.push('home_location = ?');
        vals.push(nextHome);
      }
      const legacyCleared = clearLegacyHomeIfNeeded();
      if (!sets.length && !legacyCleared) return;

      if (sets.length) {
        db.run(
          `UPDATE ingredient_variants SET ${sets.join(', ')} WHERE id = ?;`,
          [...vals, baseId],
        );
      }
      changedCount += legacyCleared ? 2 : 1;
    });

    if (txStarted) {
      db.run('COMMIT;');
      txStarted = false;
    }
    return changedCount;
  } catch (err) {
    if (txStarted) {
      try {
        db.run('ROLLBACK;');
      } catch (_) {}
    }
    throw err;
  }
}

async function ensureIngredientLemmaMaintenanceInMain(db, isElectron) {
  if (!db) return 0;
  let baseVariantChangedCount = 0;
  try {
    baseVariantChangedCount =
      Number(ensureIngredientBaseVariantsInMain(db)) || 0;
  } catch (err) {
    console.warn('⚠️ Failed to repair ingredient base variants:', err);
    baseVariantChangedCount = 0;
  }
  const changedCount = Number.isFinite(baseVariantChangedCount)
    ? baseVariantChangedCount
    : 0;
  if (changedCount <= 0) return 0;
  try {
    await persistLoadedDbInMain(db, isElectron);
    if (baseVariantChangedCount > 0) {
      console.info(
        `ℹ️ Repaired ${baseVariantChangedCount} ingredient base variant row(s).`,
      );
    }
  } catch (err) {
    console.warn('⚠️ Failed to persist ingredient maintenance updates:', err);
  }
  return changedCount;
}

function deriveIngredientLemmaInMain(rawTitle) {
  return String(rawTitle || '').trim();
}

const LAST_PAGE_SESSION_KEY = 'favoriteEats:last-page-id';
const SHOPPING_FILTER_CHIPS_SESSION_KEY_LEGACY =
  'favoriteEats:shopping-filter-chips';
const SHOPPING_FILTER_CHIPS_SESSION_KEY_PREFIX =
  'favoriteEats:shopping-filter-chips';
/** Prefix for Items-page tag filter chip ids (avoids collisions with home location ids). */
const SHOPPING_TAG_FILTER_PREFIX = 'tag:';
const SHOPPING_SCROLL_RESTORE_SESSION_KEY =
  'favoriteEats:shopping-scroll-restore-y';
/** One-shot: scroll this aisle card into view after store editor loads. */
const STORE_EDITOR_FOCUS_AISLE_SESSION_KEY =
  'favoriteEats:store-editor-focus-aisle-id';
// --- Shopping plan helpers (tests extract this block) ---
const SHOPPING_PLAN_STORAGE_KEY = 'favoriteEats:shopping-plan:v1';
const SHOPPING_PLAN_KEY_SEP = '\x00';
let shoppingPlanCache = null;

function loadRecipeWebServingsMap() {
  const api = window.favoriteEatsRecipeWebServings || {};
  if (typeof api.loadMap === 'function') return api.loadMap();
  try {
    const raw = localStorage.getItem(
      window.favoriteEatsStorageKeys.recipeWebServings,
    );
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (_) {
    return {};
  }
}

function getRecipeWebServingsStoredValue(recipeOrId, recipe = null) {
  const api = window.favoriteEatsRecipeWebServings || {};
  if (typeof api.getStoredValue === 'function') {
    const recipeModel =
      recipe && typeof recipe === 'object'
        ? recipe
        : recipeOrId && typeof recipeOrId === 'object'
          ? recipeOrId
          : null;
    const fallbackRecipeId =
      recipeModel == null ? Number(recipeOrId) : Number(recipeModel?.id);
    return api.getStoredValue(recipeModel, {
      fallbackRecipeId,
      scrubInvalid: true,
    });
  }
  const normalizedId = Number(recipeOrId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) return null;
  const raw = loadRecipeWebServingsMap()[String(Math.trunc(normalizedId))];
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric > 0
    ? Math.round(numeric * 2) / 2
    : null;
}

function getShoppingPlanAggregateKey(name, variantName = '') {
  const normalizedName = String(name || '')
    .trim()
    .toLowerCase();
  const normalizedVariant = String(variantName || '')
    .trim()
    .toLowerCase();
  if (!normalizedName) return '';
  if (
    !normalizedVariant ||
    normalizedVariant === INGREDIENT_BASE_VARIANT_NAME
  ) {
    return normalizedName;
  }
  return `${normalizedName}${SHOPPING_PLAN_KEY_SEP}${normalizedVariant}`;
}

function formatShoppingPlanQuantity(quantity) {
  const numeric = Number(quantity);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  return String(Number(numeric.toFixed(2)));
}

function normalizeShoppingPlanStoreIdList(rawStoreIds) {
  const out = [];
  const seen = new Set();
  (Array.isArray(rawStoreIds) ? rawStoreIds : []).forEach((rawId) => {
    const storeId = Math.trunc(Number(rawId));
    if (!Number.isFinite(storeId) || storeId <= 0 || seen.has(storeId)) return;
    seen.add(storeId);
    out.push(storeId);
  });
  return out;
}

function normalizeShoppingPlanStoreOrder(rawStoreOrder) {
  return normalizeShoppingPlanStoreIdList(rawStoreOrder);
}

function normalizeShoppingPlanSelectedStoreIds(rawSelectedStoreIds) {
  return normalizeShoppingPlanStoreIdList(rawSelectedStoreIds);
}

function createEmptyShoppingPlan() {
  return {
    version: 1,
    itemSelections: {},
    recipeSelections: {},
    storeOrder: [],
    selectedStoreIds: [],
  };
}

function normalizeShoppingPlan(rawPlan) {
  const source =
    rawPlan && typeof rawPlan === 'object' && !Array.isArray(rawPlan)
      ? rawPlan
      : {};
  const rawSelections =
    source.itemSelections &&
    typeof source.itemSelections === 'object' &&
    !Array.isArray(source.itemSelections)
      ? source.itemSelections
      : {};
  const rawRecipeSelections =
    source.recipeSelections &&
    typeof source.recipeSelections === 'object' &&
    !Array.isArray(source.recipeSelections)
      ? source.recipeSelections
      : {};
  const storeOrder = normalizeShoppingPlanStoreOrder(source.storeOrder);
  const selectedStoreIds = normalizeShoppingPlanSelectedStoreIds(
    source.selectedStoreIds,
  );
  const itemSelections = {};
  const recipeSelections = {};

  Object.keys(rawSelections).forEach((rawKey) => {
    const key = String(rawKey || '').trim();
    if (!key) return;
    const rawEntry = rawSelections[rawKey];
    const entry =
      rawEntry && typeof rawEntry === 'object' && !Array.isArray(rawEntry)
        ? rawEntry
        : {};
    const quantityRaw = Number(entry.quantity);
    if (!Number.isFinite(quantityRaw)) return;
    const quantity = Number(quantityRaw.toFixed(4));
    if (Math.abs(quantity) < 1e-9) return;
    itemSelections[key] = {
      key,
      name: String(entry.name || entry.itemName || '').trim(),
      variantName: String(entry.variantName || '').trim(),
      quantity,
    };
  });

  Object.keys(rawRecipeSelections).forEach((rawKey) => {
    const key = String(rawKey || '').trim();
    if (!key) return;
    const rawEntry = rawRecipeSelections[rawKey];
    const entry =
      rawEntry && typeof rawEntry === 'object' && !Array.isArray(rawEntry)
        ? rawEntry
        : {};
    const recipeId = Number(entry.recipeId != null ? entry.recipeId : key);
    const quantity = Math.max(0, Math.min(99, Number(entry.quantity || 0)));
    if (!Number.isFinite(recipeId) || recipeId <= 0) return;
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    const normalizedKey = String(Math.trunc(recipeId));
    recipeSelections[normalizedKey] = {
      key: normalizedKey,
      recipeId: Math.trunc(recipeId),
      title: String(entry.title || entry.recipeTitle || '').trim(),
      quantity,
    };
  });

  return {
    version: 1,
    itemSelections,
    recipeSelections,
    storeOrder,
    selectedStoreIds,
  };
}

function loadShoppingPlanFromStorage() {
  if (shoppingPlanCache) return shoppingPlanCache;
  try {
    const raw = localStorage.getItem(SHOPPING_PLAN_STORAGE_KEY);
    if (!raw) {
      shoppingPlanCache = createEmptyShoppingPlan();
      return shoppingPlanCache;
    }
    shoppingPlanCache = normalizeShoppingPlan(JSON.parse(raw));
    return shoppingPlanCache;
  } catch (_) {
    shoppingPlanCache = createEmptyShoppingPlan();
    return shoppingPlanCache;
  }
}

function persistShoppingPlan(plan) {
  const normalized = normalizeShoppingPlan(plan);
  shoppingPlanCache = normalized;
  try {
    localStorage.setItem(SHOPPING_PLAN_STORAGE_KEY, JSON.stringify(normalized));
  } catch (_) {}
  return normalized;
}

function getShoppingPlan() {
  return loadShoppingPlanFromStorage();
}

function updateShoppingPlan(mutator) {
  const current = getShoppingPlan();
  let draft;
  try {
    draft = JSON.parse(JSON.stringify(current));
  } catch (_) {
    draft = createEmptyShoppingPlan();
  }
  if (typeof mutator === 'function') mutator(draft);
  return persistShoppingPlan(draft);
}

function getShoppingPlanStoreOrder() {
  return normalizeShoppingPlanStoreOrder(getShoppingPlan()?.storeOrder);
}

function setShoppingPlanStoreOrder(storeIds) {
  const normalizedStoreOrder = normalizeShoppingPlanStoreOrder(storeIds);
  return updateShoppingPlan((plan) => {
    plan.storeOrder = normalizedStoreOrder;
  });
}

function getShoppingPlanSelectedStoreIds() {
  return normalizeShoppingPlanSelectedStoreIds(
    getShoppingPlan()?.selectedStoreIds,
  );
}

function setShoppingPlanSelectedStoreIds(storeIds) {
  const normalizedSelectedStoreIds =
    normalizeShoppingPlanSelectedStoreIds(storeIds);
  return updateShoppingPlan((plan) => {
    plan.selectedStoreIds = normalizedSelectedStoreIds;
  });
}

if (typeof window !== 'undefined') {
  window.__shoppingPlanHelpers = {
    normalizeShoppingPlanStoreIdList,
    normalizeShoppingPlanStoreOrder,
    normalizeShoppingPlanSelectedStoreIds,
    createEmptyShoppingPlan,
    normalizeShoppingPlan,
    loadShoppingPlanFromStorage,
    persistShoppingPlan,
    getShoppingPlan,
    updateShoppingPlan,
    getShoppingPlanStoreOrder,
    setShoppingPlanStoreOrder,
    getShoppingPlanSelectedStoreIds,
    setShoppingPlanSelectedStoreIds,
  };
}
// --- End shopping plan helpers ---

function setShoppingPlanItemSelection({
  key,
  name = '',
  variantName = '',
  quantity = 0,
}) {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) return getShoppingPlan();
  return updateShoppingPlan((plan) => {
    if (!plan.itemSelections || typeof plan.itemSelections !== 'object') {
      plan.itemSelections = {};
    }
    const nextQtyRaw = Number(quantity);
    if (!Number.isFinite(nextQtyRaw)) {
      delete plan.itemSelections[normalizedKey];
      return;
    }
    const nextQty = Number(nextQtyRaw.toFixed(4));
    if (Math.abs(nextQty) < 1e-9) {
      delete plan.itemSelections[normalizedKey];
      return;
    }
    plan.itemSelections[normalizedKey] = {
      key: normalizedKey,
      name: String(name || '').trim(),
      variantName: String(variantName || '').trim(),
      quantity: nextQty,
    };
  });
}

function getShoppingPlanItemSelections() {
  const plan = getShoppingPlan();
  return plan?.itemSelections && typeof plan.itemSelections === 'object'
    ? plan.itemSelections
    : {};
}

function setShoppingPlanRecipeSelection({
  recipeId,
  title = '',
  quantity = 0,
}) {
  const normalizedRecipeId = Number(recipeId);
  if (!Number.isFinite(normalizedRecipeId) || normalizedRecipeId <= 0) {
    return getShoppingPlan();
  }
  const normalizedKey = String(Math.trunc(normalizedRecipeId));
  return updateShoppingPlan((plan) => {
    if (!plan.recipeSelections || typeof plan.recipeSelections !== 'object') {
      plan.recipeSelections = {};
    }
    const nextQty = Math.max(0, Math.min(99, Number(quantity || 0)));
    if (!Number.isFinite(nextQty) || nextQty <= 0) {
      delete plan.recipeSelections[normalizedKey];
      return;
    }
    plan.recipeSelections[normalizedKey] = {
      key: normalizedKey,
      recipeId: Math.trunc(normalizedRecipeId),
      title: String(title || '').trim(),
      quantity: nextQty,
    };
  });
}

function getShoppingPlanRecipeSelections() {
  const plan = getShoppingPlan();
  return plan?.recipeSelections && typeof plan.recipeSelections === 'object'
    ? plan.recipeSelections
    : {};
}

function clearShoppingPlanSelections({
  clearItems = false,
  clearRecipes = false,
} = {}) {
  return updateShoppingPlan((plan) => {
    if (clearItems) plan.itemSelections = {};
    if (clearRecipes) plan.recipeSelections = {};
  });
}

function getShoppingPlanSelectionLabel(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const name = String(entry.name || '').trim();
  const variantName = String(entry.variantName || '').trim();
  if (!name) return '';
  if (!variantName || variantName.toLowerCase() === 'default') return name;
  return `${name} (${variantName})`;
}

function getRecipeIngredientShoppingCount(line) {
  if (!line || typeof line !== 'object') return null;
  const qtyMax = Number(line.quantityMax);
  if (Number.isFinite(qtyMax) && qtyMax > 0) return qtyMax;
  const qtyMin = Number(line.quantityMin);
  if (Number.isFinite(qtyMin) && qtyMin > 0) return qtyMin;
  if (typeof parseNumericQuantityValue === 'function') {
    const parsed = parseNumericQuantityValue(line.quantity);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

const SHOPPING_PLAN_LINKED_RECIPE_MAX_DEPTH = 2;

function loadShoppingPlanRecipeFromDB(db, recipeId) {
  void db;
  void recipeId;
  return null;
}

function getRecipeServingsMultiplierForShoppingPlan(recipeId, recipe) {
  const recipeDefaultServings = Number(
    recipe?.servings?.default != null
      ? recipe.servings.default
      : recipe?.servingsDefault,
  );
  const selectedServings = getRecipeWebServingsStoredValue(recipeId, recipe);
  if (
    Number.isFinite(recipeDefaultServings) &&
    recipeDefaultServings > 0 &&
    Number.isFinite(selectedServings) &&
    selectedServings > 0
  ) {
    return selectedServings / recipeDefaultServings;
  }
  return 1;
}

function walkExpandedShoppingPlanIngredientLines(
  db,
  recipe,
  {
    recipeId = null,
    recipeTitle = '',
    outerRecipeMultiplier = 1,
    linkDepth = 0,
    ancestorRecipeIds = null,
  } = {},
  visit,
) {
  if (
    !db ||
    typeof db.exec !== 'function' ||
    !recipe ||
    !Array.isArray(recipe.sections) ||
    typeof visit !== 'function'
  ) {
    return;
  }

  const normalizedRecipeId = Math.trunc(Number(recipeId));
  const normalizedRecipeTitle = String(recipeTitle || '').trim();
  const normalizedOuterMultiplier = Number(outerRecipeMultiplier);
  const normalizedLinkDepth = Math.max(0, Math.trunc(Number(linkDepth) || 0));
  if (
    !Number.isFinite(normalizedOuterMultiplier) ||
    normalizedOuterMultiplier <= 0
  ) {
    return;
  }

  const nextAncestors =
    ancestorRecipeIds instanceof Set ? new Set(ancestorRecipeIds) : new Set();
  if (Number.isFinite(normalizedRecipeId) && normalizedRecipeId > 0) {
    nextAncestors.add(normalizedRecipeId);
  }

  const servingsMultiplier = getRecipeServingsMultiplierForShoppingPlan(
    normalizedRecipeId,
    recipe,
  );

  recipe.sections.forEach((section) => {
    const ingredients = Array.isArray(section?.ingredients)
      ? section.ingredients
      : [];
    ingredients.forEach((line) => {
      if (!line || line.rowType === 'heading') return;

      const linkedRecipeId = Math.trunc(Number(line.linkedRecipeId));
      if (line.isRecipe) {
        if (
          !Number.isFinite(linkedRecipeId) ||
          linkedRecipeId <= 0 ||
          normalizedLinkDepth >= SHOPPING_PLAN_LINKED_RECIPE_MAX_DEPTH ||
          nextAncestors.has(linkedRecipeId)
        ) {
          return;
        }

        const linkedRecipe = loadShoppingPlanRecipeFromDB(db, linkedRecipeId);
        if (!linkedRecipe || !Array.isArray(linkedRecipe.sections)) return;

        const linkQuantity = getRecipeIngredientShoppingCount(line);
        const normalizedLinkQuantity =
          Number.isFinite(linkQuantity) && linkQuantity > 0 ? linkQuantity : 1;

        walkExpandedShoppingPlanIngredientLines(
          db,
          linkedRecipe,
          {
            recipeId: linkedRecipeId,
            recipeTitle: String(linkedRecipe?.title || '').trim(),
            outerRecipeMultiplier:
              normalizedOuterMultiplier *
              servingsMultiplier *
              normalizedLinkQuantity,
            linkDepth: normalizedLinkDepth + 1,
            ancestorRecipeIds: nextAncestors,
          },
          visit,
        );
        return;
      }

      visit(line, {
        recipeId:
          Number.isFinite(normalizedRecipeId) && normalizedRecipeId > 0
            ? normalizedRecipeId
            : null,
        recipeTitle: normalizedRecipeTitle,
        recipeCount: normalizedOuterMultiplier,
        servingsMultiplier,
      });
    });
  });
}

function getRecipeDerivedShoppingPlanRows({ db = window.dbInstance } = {}) {
  if (!db || typeof db.exec !== 'function') return [];
  const aggregate = new Map();

  Object.values(getShoppingPlanRecipeSelections()).forEach((selection) => {
    const recipeId = Number(selection?.recipeId);
    const recipeCount = Number(selection?.quantity || 0);
    if (!Number.isFinite(recipeId) || recipeId <= 0) return;
    if (!Number.isFinite(recipeCount) || recipeCount <= 0) return;

    const recipe = loadShoppingPlanRecipeFromDB(db, recipeId);
    if (!recipe || !Array.isArray(recipe.sections)) return;

    walkExpandedShoppingPlanIngredientLines(
      db,
      recipe,
      {
        recipeId,
        recipeTitle: String(recipe?.title || '').trim(),
        outerRecipeMultiplier: recipeCount,
        linkDepth: 0,
      },
      (
        line,
        { recipeCount: expandedRecipeCount = 0, servingsMultiplier = 1 } = {},
      ) => {
        const name = String(line.name || '').trim();
        if (!name) return;
        const variantName = String(line.variant || '').trim();
        const key = getShoppingPlanAggregateKey(name, variantName);
        if (!key) return;
        const ingredientCount = getRecipeIngredientShoppingCount(line);
        if (!Number.isFinite(ingredientCount) || ingredientCount <= 0) return;
        const scaledPerRecipeQuantityRaw = ingredientCount * servingsMultiplier;
        const scaledPerRecipeQuantity =
          Math.abs(servingsMultiplier - 1) > 1e-9 &&
          typeof window.normalizeActionableQuantity === 'function'
            ? Number(
                window.normalizeActionableQuantity(
                  scaledPerRecipeQuantityRaw,
                  line.unit || '',
                ),
              )
            : Number(scaledPerRecipeQuantityRaw.toFixed(4));
        if (
          !Number.isFinite(scaledPerRecipeQuantity) ||
          scaledPerRecipeQuantity <= 0
        ) {
          return;
        }
        const nextQuantity = scaledPerRecipeQuantity * expandedRecipeCount;
        const existing = aggregate.get(key);
        if (existing) {
          existing.quantity += nextQuantity;
          return;
        }
        aggregate.set(key, {
          key,
          name,
          variantName,
          label: getShoppingPlanSelectionLabel({ name, variantName }),
          quantity: nextQuantity,
        });
      },
    );
  });

  return Array.from(aggregate.values());
}

// --- Shopping list grouping helpers (tests extract this block) ---
const SHOPPING_LIST_GROUPING_BASE_VARIANT_NAME = 'default';
function orderShoppingListSelectedStoreIds(storeOrder, selectedStoreIds) {
  const normalizedStoreOrder = Array.isArray(storeOrder) ? storeOrder : [];
  const normalizedSelectedStoreIds = Array.isArray(selectedStoreIds)
    ? selectedStoreIds
    : [];
  const selectedSet = new Set();
  normalizedSelectedStoreIds.forEach((rawId) => {
    const storeId = Math.trunc(Number(rawId));
    if (!Number.isFinite(storeId) || storeId <= 0) return;
    selectedSet.add(storeId);
  });
  if (!selectedSet.size) return [];
  const ordered = [];
  normalizedStoreOrder.forEach((rawId) => {
    const storeId = Math.trunc(Number(rawId));
    if (!selectedSet.has(storeId)) return;
    ordered.push(storeId);
    selectedSet.delete(storeId);
  });
  normalizedSelectedStoreIds.forEach((rawId) => {
    const storeId = Math.trunc(Number(rawId));
    if (!selectedSet.has(storeId)) return;
    ordered.push(storeId);
    selectedSet.delete(storeId);
  });
  return ordered;
}

function compareShoppingListAssignmentCandidates(a, b) {
  const variantRankA = Number(a?.variantRank);
  const variantRankB = Number(b?.variantRank);
  const normalizedVariantRankA = Number.isFinite(variantRankA)
    ? variantRankA
    : -1;
  const normalizedVariantRankB = Number.isFinite(variantRankB)
    ? variantRankB
    : -1;
  if (normalizedVariantRankA !== normalizedVariantRankB) {
    return normalizedVariantRankA - normalizedVariantRankB;
  }
  const aisleSortA = Number(a?.aisleSortOrder);
  const aisleSortB = Number(b?.aisleSortOrder);
  const normalizedAisleSortA = Number.isFinite(aisleSortA)
    ? aisleSortA
    : 999999;
  const normalizedAisleSortB = Number.isFinite(aisleSortB)
    ? aisleSortB
    : 999999;
  if (normalizedAisleSortA !== normalizedAisleSortB) {
    return normalizedAisleSortA - normalizedAisleSortB;
  }
  const aisleIdA = Math.trunc(Number(a?.aisleId));
  const aisleIdB = Math.trunc(Number(b?.aisleId));
  if (
    Number.isFinite(aisleIdA) &&
    Number.isFinite(aisleIdB) &&
    aisleIdA !== aisleIdB
  ) {
    return aisleIdA - aisleIdB;
  }
  return String(a?.aisleLabel || '').localeCompare(
    String(b?.aisleLabel || ''),
    undefined,
    {
      sensitivity: 'base',
    },
  );
}

function chooseShoppingListAssignment(candidates, orderedSelectedStoreIds) {
  const candidateList = Array.isArray(candidates) ? candidates : [];
  const orderedStoreIds = Array.isArray(orderedSelectedStoreIds)
    ? orderedSelectedStoreIds
    : [];
  if (!candidateList.length || !orderedStoreIds.length) return null;
  for (const rawStoreId of orderedStoreIds) {
    const storeId = Math.trunc(Number(rawStoreId));
    if (!Number.isFinite(storeId) || storeId <= 0) continue;
    const matches = candidateList
      .filter((candidate) => Math.trunc(Number(candidate?.storeId)) === storeId)
      .sort(compareShoppingListAssignmentCandidates);
    if (matches.length) return matches[0];
  }
  return null;
}

function getShoppingListVariantAssignmentKey(name, variantName = '') {
  if (typeof getShoppingPlanAggregateKey === 'function') {
    return getShoppingPlanAggregateKey(name, variantName);
  }
  const normalizedName = String(name || '')
    .trim()
    .toLowerCase();
  const normalizedVariant = String(variantName || '')
    .trim()
    .toLowerCase();
  if (!normalizedName) return '';
  if (
    !normalizedVariant ||
    normalizedVariant === SHOPPING_LIST_GROUPING_BASE_VARIANT_NAME
  )
    return normalizedName;
  return `${normalizedName}\x00${normalizedVariant}`;
}

function mergeShoppingListAssignmentCandidates(...candidateLists) {
  const merged = [];
  const seen = new Map();
  candidateLists.forEach((list) => {
    (Array.isArray(list) ? list : []).forEach((candidate) => {
      if (!candidate || typeof candidate !== 'object') return;
      const storeId = Math.trunc(Number(candidate.storeId));
      const aisleId = Math.trunc(Number(candidate.aisleId));
      const aisleLabel = String(candidate.aisleLabel || '').trim();
      const dedupeKey =
        Number.isFinite(storeId) &&
        storeId > 0 &&
        Number.isFinite(aisleId) &&
        aisleId > 0
          ? `${storeId}:${aisleId}`
          : `${storeId}:${aisleId}:${aisleLabel.toLowerCase()}`;
      if (seen.has(dedupeKey)) {
        const existingIndex = seen.get(dedupeKey);
        const existingCandidate = merged[existingIndex];
        if (
          compareShoppingListAssignmentCandidates(
            candidate,
            existingCandidate,
          ) < 0
        ) {
          merged[existingIndex] = candidate;
        }
        return;
      }
      seen.set(dedupeKey, merged.length);
      merged.push(candidate);
    });
  });
  return merged;
}

function buildOrderedVariantAssignmentCandidates(
  name,
  { variantAssignmentMap = null, variantOrderMap = null } = {},
) {
  const hasGetter = (value) => !!value && typeof value.get === 'function';
  const nameKey = String(name || '')
    .trim()
    .toLowerCase();
  if (
    !nameKey ||
    !hasGetter(variantAssignmentMap) ||
    !hasGetter(variantOrderMap)
  ) {
    return [];
  }
  const orderedVariants = Array.isArray(variantOrderMap.get(nameKey))
    ? variantOrderMap.get(nameKey)
    : [];
  if (!orderedVariants.length) return [];
  const rankedCandidates = [];
  orderedVariants.forEach((variantName, variantRank) => {
    const assignmentKey = getShoppingListVariantAssignmentKey(
      nameKey,
      variantName,
    );
    if (!assignmentKey) return;
    const variantCandidates = variantAssignmentMap.get(assignmentKey) || [];
    variantCandidates.forEach((candidate) => {
      rankedCandidates.push({
        ...candidate,
        variantRank,
      });
    });
  });
  return mergeShoppingListAssignmentCandidates(rankedCandidates);
}

function getShoppingListAssignmentCandidates(
  row,
  {
    baseAssignmentMap = null,
    variantAssignmentMap = null,
    variantAnyAssignmentMap = null,
    variantOrderMap = null,
  } = {},
) {
  const hasGetter = (value) => !!value && typeof value.get === 'function';
  const nameKey = String(row?.name || '')
    .trim()
    .toLowerCase();
  const variantName = String(row?.variantName || '').trim();
  const variantAssignmentKey = variantName
    ? getShoppingListVariantAssignmentKey(row.name, variantName)
    : '';
  const exactVariantCandidates =
    variantAssignmentKey && hasGetter(variantAssignmentMap)
      ? variantAssignmentMap.get(variantAssignmentKey) || []
      : [];
  if (exactVariantCandidates.length) return exactVariantCandidates;
  const baseCandidates =
    nameKey && hasGetter(baseAssignmentMap)
      ? baseAssignmentMap.get(nameKey) || []
      : [];
  if (!variantName && baseCandidates.length) return baseCandidates;
  const orderedVariantCandidates =
    !variantName && nameKey
      ? buildOrderedVariantAssignmentCandidates(nameKey, {
          variantAssignmentMap,
          variantOrderMap,
        })
      : [];
  if (orderedVariantCandidates.length) return orderedVariantCandidates;
  const anyVariantCandidates =
    nameKey && hasGetter(variantAnyAssignmentMap)
      ? variantAnyAssignmentMap.get(nameKey) || []
      : [];
  return mergeShoppingListAssignmentCandidates(
    baseCandidates,
    anyVariantCandidates,
  );
}

function buildGroupedShoppingListRows(items, options = {}) {
  const itemList = Array.isArray(items) ? items : [];
  const selectedStores = Array.isArray(options?.selectedStores)
    ? options.selectedStores
    : [];
  const unlistedLabel =
    String(options?.unlistedLabel || 'UNLISTED').trim() || 'UNLISTED';
  const storeIdsInOrder = selectedStores
    .map((store) => Math.trunc(Number(store?.id)))
    .filter((storeId) => Number.isFinite(storeId) && storeId > 0);
  const storeGroups = new Map(
    storeIdsInOrder.map((storeId) => [
      storeId,
      {
        aisles: new Map(),
      },
    ]),
  );
  const unlistedItems = [];

  itemList.forEach((item) => {
    if (!item || String(item.text || '').trim() === '') return;
    const chosenAssignment = chooseShoppingListAssignment(
      item.assignmentCandidates,
      storeIdsInOrder,
    );
    if (!chosenAssignment) {
      unlistedItems.push(item);
      return;
    }
    const storeId = Math.trunc(Number(chosenAssignment.storeId));
    const aisleId = Math.trunc(Number(chosenAssignment.aisleId));
    const storeGroup = storeGroups.get(storeId);
    if (!storeGroup || !Number.isFinite(aisleId) || aisleId <= 0) {
      unlistedItems.push(item);
      return;
    }
    const incomingSort = Number.isFinite(
      Number(chosenAssignment.aisleSortOrder),
    )
      ? Number(chosenAssignment.aisleSortOrder)
      : 999999;
    if (!storeGroup.aisles.has(aisleId)) {
      storeGroup.aisles.set(aisleId, {
        aisleId,
        aisleLabel:
          String(chosenAssignment.aisleLabel || '').trim() ||
          `Aisle ${aisleId}`,
        aisleSortOrder: incomingSort,
        items: [],
      });
    } else {
      const bucket = storeGroup.aisles.get(aisleId);
      const curSort = bucket.aisleSortOrder;
      const curPlaceholder = !Number.isFinite(curSort) || curSort >= 999999;
      const incomingPlaceholder =
        !Number.isFinite(incomingSort) || incomingSort >= 999999;
      const preferIncoming =
        incomingSort < curSort || (curPlaceholder && !incomingPlaceholder);
      if (preferIncoming) {
        bucket.aisleSortOrder = incomingSort;
        bucket.aisleLabel =
          String(chosenAssignment.aisleLabel || '').trim() ||
          `Aisle ${aisleId}`;
      }
    }
    storeGroup.aisles.get(aisleId).items.push(item);
  });

  const compareItems = (a, b) =>
    String(a?.label || '').localeCompare(String(b?.label || ''), undefined, {
      sensitivity: 'base',
    });

  const rows = [];
  selectedStores.forEach((store) => {
    const storeId = Math.trunc(Number(store?.id));
    const storeGroup = storeGroups.get(storeId);
    if (!storeGroup || !storeGroup.aisles.size) return;
    rows.push({
      key: `section:store:${storeId}`,
      rowType: 'section',
      sectionKind: 'store',
      storeId,
      text: String(store?.label || '').trim() || `Store ${storeId}`,
      className: 'shopping-list-section shopping-list-section--store',
    });
    const aisles = Array.from(storeGroup.aisles.values()).sort((a, b) =>
      compareShoppingListAssignmentCandidates(a, b),
    );
    aisles.forEach((aisle) => {
      rows.push({
        key: `section:aisle:${storeId}:${aisle.aisleId}`,
        rowType: 'section',
        sectionKind: 'aisle',
        storeId,
        aisleId: aisle.aisleId,
        aisleSortOrder: aisle.aisleSortOrder,
        text: aisle.aisleLabel,
        className: 'shopping-list-section shopping-list-section--aisle',
      });
      aisle.items.sort(compareItems).forEach((item) => {
        rows.push({
          ...item,
          rowType: 'item',
          className: 'shopping-list-group-item',
        });
      });
    });
  });

  if (unlistedItems.length) {
    rows.push({
      key: 'section:unlisted',
      rowType: 'section',
      sectionKind: 'unlisted',
      text: unlistedLabel,
      className: 'shopping-list-section shopping-list-section--unlisted',
    });
    unlistedItems.sort(compareItems).forEach((item) => {
      rows.push({
        ...item,
        rowType: 'item',
        className: 'shopping-list-group-item',
      });
    });
  }

  return rows;
}

if (typeof window !== 'undefined') {
  window.__shoppingListGroupingHelpers = {
    orderShoppingListSelectedStoreIds,
    compareShoppingListAssignmentCandidates,
    chooseShoppingListAssignment,
    getShoppingListVariantAssignmentKey,
    mergeShoppingListAssignmentCandidates,
    buildOrderedVariantAssignmentCandidates,
    getShoppingListAssignmentCandidates,
    buildGroupedShoppingListRows,
  };
}
// --- End shopping list grouping helpers ---

/**
 * True when `variantText` matches an ingredient_variants row for `ingredientName`
 * (direct name or synonym) and that row is soft-deprecated.
 */
function ingredientScopedVariantIsDeprecated(db, ingredientName, variantText) {
  const n = String(ingredientName || '').trim();
  const v = String(variantText || '').trim();
  if (!db || typeof db.exec !== 'function' || !n || !v) return false;
  if (v.toLowerCase() === 'default') return false;

  let hasVariantTable = false;
  try {
    const t = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='ingredient_variants';`,
    );
    hasVariantTable = !!(t?.length && t[0]?.values?.length);
  } catch (_) {
    return false;
  }
  if (!hasVariantTable) return false;

  const pragmaHasColumn = (table, col) => {
    try {
      const pc = db.exec(`PRAGMA table_info(${table});`);
      const vals = pc?.[0]?.values || [];
      const needle = String(col || '').toLowerCase();
      return vals.some(
        (row) =>
          Array.isArray(row) && String(row[1] || '').toLowerCase() === needle,
      );
    } catch (_) {
      return false;
    }
  };

  if (!pragmaHasColumn('ingredient_variants', 'is_deprecated')) return false;

  const ingHasDeprecated = pragmaHasColumn('ingredients', 'is_deprecated');
  const ingHasHide = pragmaHasColumn('ingredients', 'hide_from_shopping_list');
  const ingVisibilityClause = ingHasDeprecated
    ? `AND COALESCE(i.is_deprecated, 0) = 0`
    : ingHasHide
      ? `AND COALESCE(i.hide_from_shopping_list, 0) = 0`
      : ``;

  const canonicalIds = [];
  const seen = new Set();
  const pushIds = (result) => {
    const rows = result?.[0]?.values || [];
    rows.forEach((row) => {
      const id = Number(Array.isArray(row) ? row[0] : NaN);
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) return;
      seen.add(id);
      canonicalIds.push(id);
    });
  };

  try {
    pushIds(
      db.exec(
        `SELECT i.ID
           FROM ingredients i
          WHERE lower(trim(i.name)) = lower(trim(?))
            ${ingVisibilityClause}
          ORDER BY i.ID ASC;`,
        [n],
      ),
    );
    pushIds(
      db.exec(
        `SELECT i.ID
           FROM ingredient_synonyms s
           JOIN ingredients i ON i.ID = s.ingredient_id
          WHERE lower(trim(s.synonym)) = lower(trim(?))
            ${ingVisibilityClause}
          ORDER BY i.ID ASC;`,
        [n],
      ),
    );
  } catch (_) {
    return false;
  }

  if (!canonicalIds.length) return false;
  const ph = canonicalIds.map(() => '?').join(',');
  try {
    const r = db.exec(
      `SELECT 1
         FROM ingredient_variants
        WHERE ingredient_id IN (${ph})
          AND lower(trim(variant)) = lower(trim(?))
          AND COALESCE(is_deprecated, 0) = 1
        LIMIT 1;`,
      [...canonicalIds, v],
    );
    return !!(r?.length && r[0]?.values?.length);
  } catch (_) {
    return false;
  }
}

if (typeof window !== 'undefined') {
  window.ingredientScopedVariantIsDeprecated = ingredientScopedVariantIsDeprecated;
}

function getShoppingPlanSelectionRows(options = {}) {
  const db = options?.db || window.dbInstance;
  const visibleNameKeys =
    db && typeof db.exec === 'function'
      ? new Set(
          getVisibleIngredientNamePool(db).map((name) =>
            String(name || '')
              .trim()
              .toLowerCase(),
          ),
        )
      : null;
  const aggregate = new Map();
  const ensureRow = ({
    name = '',
    variantName = '',
    allowInvisible = false,
  } = {}) => {
    const resolvedName = String(name || '').trim();
    const resolvedVariantName = String(variantName || '').trim();
    if (!resolvedName) return null;
    const key = getShoppingPlanAggregateKey(resolvedName, resolvedVariantName);
    if (!key) return null;
    const nameKey = resolvedName.toLowerCase();
    if (
      !allowInvisible &&
      visibleNameKeys instanceof Set &&
      !visibleNameKeys.has(nameKey)
    ) {
      return null;
    }
    if (!aggregate.has(key)) {
      aggregate.set(key, {
        key,
        name: resolvedName,
        variantName: resolvedVariantName,
        label: getShoppingListIngredientLabel(
          resolvedName,
          resolvedVariantName,
        ),
        buckets: new Map(),
        bucketOrder: [],
        contributionSources: new Map(),
        contributionSourceOrder: [],
      });
    }
    return aggregate.get(key);
  };
  const addBucketToTarget = (target, bucket) => {
    if (!target || !bucket || typeof bucket !== 'object') return;
    const bucketKey = String(bucket.key || '').trim();
    if (!bucketKey) return;
    if (!target.buckets.has(bucketKey)) {
      target.bucketOrder.push(bucketKey);
      target.buckets.set(bucketKey, { ...bucket });
      return;
    }
    const existing = target.buckets.get(bucketKey);
    if (!existing) return;
    if (bucket.kind === 'measured') {
      existing.baseQuantity = Number(
        (
          Number(existing.baseQuantity || 0) + Number(bucket.baseQuantity || 0)
        ).toFixed(6),
      );
      return;
    }
    existing.quantity = Number(
      (Number(existing.quantity || 0) + Number(bucket.quantity || 0)).toFixed(
        4,
      ),
    );
  };
  const ensureContributionSource = (row, source = {}) => {
    if (!row || typeof row !== 'object') return null;
    const sourceType = String(source.sourceType || '').trim() || 'recipe';
    const sourceKey =
      sourceType === 'manual'
        ? 'manual:selected'
        : `recipe:${Math.trunc(Number(source.recipeId || 0))}`;
    if (!sourceKey) return null;
    if (!row.contributionSources.has(sourceKey)) {
      row.contributionSourceOrder.push(sourceKey);
      row.contributionSources.set(sourceKey, {
        sourceType,
        sourceKey,
        recipeId:
          sourceType === 'recipe' && Number.isFinite(Number(source.recipeId))
            ? Math.trunc(Number(source.recipeId))
            : null,
        title: String(source.title || '').trim(),
        buckets: new Map(),
        bucketOrder: [],
      });
    }
    return row.contributionSources.get(sourceKey) || null;
  };
  const getContributionSortValue = (buckets) =>
    (Array.isArray(buckets) ? buckets : []).reduce((sum, bucket) => {
      if (bucket?.kind === 'measured') {
        return sum + Math.max(0, Number(bucket.baseQuantity || 0));
      }
      return sum + Math.max(0, Number(bucket?.quantity || 0));
    }, 0);
  const addSelectedItemBucket = (entry) => {
    const name = String(entry?.name || '').trim();
    const variantName = String(entry?.variantName || '').trim();
    const quantity = Number(entry?.quantity || 0);
    if (!name || !Number.isFinite(quantity) || quantity <= 1e-9) return;
    const row = ensureRow({ name, variantName });
    if (!row) return;
    const bucket = {
      key: 'selected',
      kind: 'selected',
      quantity,
    };
    addBucketToTarget(row, bucket);
    const source = ensureContributionSource(row, {
      sourceType: 'manual',
      title: 'Directly added',
    });
    addBucketToTarget(source, bucket);
  };
  const addRecipeIngredientBucket = (
    line,
    {
      recipeId = null,
      recipeTitle = '',
      recipeCount = 0,
      servingsMultiplier = 1,
    } = {},
  ) => {
    if (!line || typeof line !== 'object') return;
    if (line.rowType === 'heading' || line.isRecipe) return;
    const name = String(line.name || '').trim();
    if (!name) return;
    const variantName = String(line.variant || '').trim();
    // Recipe-sourced rows should stay visible even when the master ingredient is
    // hidden from the browse pool; otherwise OR/alt ingredients can disappear.
    const row = ensureRow({ name, variantName, allowInvisible: true });
    if (!row) return;
    const recipeMultiplier = Number(recipeCount);
    if (!Number.isFinite(recipeMultiplier) || recipeMultiplier <= 0) return;
    const source = ensureContributionSource(row, {
      sourceType: 'recipe',
      recipeId,
      title: recipeTitle,
    });

    const ingredientCount = getRecipeIngredientShoppingCount(line);
    if (!Number.isFinite(ingredientCount) || ingredientCount <= 0) {
      const bucket = {
        key: 'unspecified',
        kind: 'unspecified',
        quantity: recipeMultiplier,
      };
      addBucketToTarget(row, bucket);
      addBucketToTarget(source, bucket);
      return;
    }

    const scaledPerRecipeQuantityRaw = ingredientCount * servingsMultiplier;
    const scaledPerRecipeQuantity =
      Math.abs(servingsMultiplier - 1) > 1e-9 &&
      typeof window.normalizeActionableQuantity === 'function'
        ? Number(
            window.normalizeActionableQuantity(
              scaledPerRecipeQuantityRaw,
              line.unit || '',
            ),
          )
        : Number(scaledPerRecipeQuantityRaw.toFixed(4));
    if (
      !Number.isFinite(scaledPerRecipeQuantity) ||
      scaledPerRecipeQuantity <= 0
    )
      return;

    const nextQuantity = Number(
      (scaledPerRecipeQuantity * recipeMultiplier).toFixed(4),
    );
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) return;

    const normalizedUnit = normalizeShoppingListUnit(line.unit || '');
    const size = String(line.size || '').trim();
    const measured = convertShoppingListQuantityToMeasuredBase(
      nextQuantity,
      normalizedUnit,
    );
    if (measured) {
      const bucket = {
        key: `measured:${measured.family}`,
        kind: 'measured',
        family: measured.family,
        baseQuantity: measured.baseQuantity,
      };
      addBucketToTarget(row, bucket);
      addBucketToTarget(source, bucket);
      return;
    }

    if (normalizedUnit || size) {
      const bucket = {
        key: `exact:${normalizedUnit}|${size.toLowerCase()}`,
        kind: 'exact',
        quantity: nextQuantity,
        unit: normalizedUnit,
        size,
      };
      addBucketToTarget(row, bucket);
      addBucketToTarget(source, bucket);
      return;
    }

    const bucket = {
      key: 'count',
      kind: 'count',
      quantity: nextQuantity,
      unit: '',
      size: '',
    };
    addBucketToTarget(row, bucket);
    addBucketToTarget(source, bucket);
  };

  Object.values(getShoppingPlanItemSelections()).forEach(addSelectedItemBucket);

  if (db && typeof db.exec === 'function') {
    Object.values(getShoppingPlanRecipeSelections()).forEach((selection) => {
      const recipeId = Number(selection?.recipeId);
      const recipeCount = Number(selection?.quantity || 0);
      if (!Number.isFinite(recipeId) || recipeId <= 0) return;
      if (!Number.isFinite(recipeCount) || recipeCount <= 0) return;

      const recipe = loadShoppingPlanRecipeFromDB(db, recipeId);
      if (!recipe || !Array.isArray(recipe.sections)) return;

      walkExpandedShoppingPlanIngredientLines(
        db,
        recipe,
        {
          recipeId,
          recipeTitle: String(recipe?.title || '').trim(),
          outerRecipeMultiplier: recipeCount,
          linkDepth: 0,
        },
        addRecipeIngredientBucket,
      );
    });
  }

  const rows = Array.from(aggregate.values())
    .map((row) => {
      const buckets = row.bucketOrder
        .map((bucketKey) => row.buckets.get(bucketKey))
        .filter(Boolean)
        .filter((bucket) => {
          if (bucket.kind === 'measured') {
            return Number(bucket.baseQuantity || 0) > 1e-9;
          }
          return Number(bucket.quantity || 0) > 1e-9;
        });
      const variantIsDeprecated =
        !!row.variantName &&
        ingredientScopedVariantIsDeprecated(db, row.name, row.variantName);
      return {
        key: row.key,
        name: row.name,
        variantName: row.variantName,
        variantIsDeprecated,
        label: row.label,
        detailText: formatShoppingListDisplayDetailText({
          variantName: row.variantName,
          buckets,
        }),
        text: formatShoppingListDisplayRow({
          label: row.label,
          name: row.name,
          variantName: row.variantName,
          buckets,
        }),
        contributionRows: row.contributionSourceOrder
          .map((sourceKey) => row.contributionSources.get(sourceKey))
          .filter(Boolean)
          .map((source) => {
            const sourceBuckets = source.bucketOrder
              .map((bucketKey) => source.buckets.get(bucketKey))
              .filter(Boolean)
              .filter((bucket) => {
                if (bucket.kind === 'measured') {
                  return Number(bucket.baseQuantity || 0) > 1e-9;
                }
                return Number(bucket.quantity || 0) > 1e-9;
              });
            const detailText = formatShoppingListDisplayDetailText({
              variantName: row.variantName,
              buckets: sourceBuckets,
            });
            if (!detailText) return null;
            return {
              sourceType: source.sourceType,
              sourceKey: source.sourceKey,
              recipeId: source.recipeId,
              title:
                String(source.title || '').trim() ||
                (source.sourceType === 'manual' ? 'Directly added' : 'Recipe'),
              detailText,
              sortValue: getContributionSortValue(sourceBuckets),
            };
          })
          .filter(Boolean)
          .sort((a, b) => {
            if (a.sourceType !== b.sourceType) {
              return a.sourceType === 'recipe' ? -1 : 1;
            }
            const sortDelta =
              Number(b.sortValue || 0) - Number(a.sortValue || 0);
            if (Math.abs(sortDelta) > 1e-9) return sortDelta;
            return String(a.title || '').localeCompare(
              String(b.title || ''),
              undefined,
              {
                sensitivity: 'base',
              },
            );
          }),
      };
    })
    .filter((entry) => String(entry.text || '').trim());

  const tableExists = (name) => {
    if (!db || typeof db.exec !== 'function') return false;
    try {
      const q = db.exec(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
        [name],
      );
      return !!(Array.isArray(q) && q.length && q[0]?.values?.length);
    } catch (_) {
      return false;
    }
  };

  const orderedSelectedStoreIds = orderShoppingListSelectedStoreIds(
    getShoppingPlanStoreOrder(),
    getShoppingPlanSelectedStoreIds(),
  );

  /** @type {{ id: number, label: string }[]} */
  let selectedStores = [];
  const baseAssignmentMap = new Map();
  const variantAssignmentMap = new Map();
  const variantAnyAssignmentMap = new Map();
  const variantOrderMap = new Map();

  if (
    db &&
    typeof db.exec === 'function' &&
    rows.length > 0 &&
    orderedSelectedStoreIds.length > 0 &&
    tableExists('stores') &&
    tableExists('store_locations')
  ) {
    const storePh = orderedSelectedStoreIds.map(() => '?').join(',');
    try {
      const storeQ = db.exec(
        `
          SELECT ID, chain_name, location_name
          FROM stores
          WHERE ID IN (${storePh});
        `,
        orderedSelectedStoreIds,
      );
      const storeMeta = new Map();
      if (
        Array.isArray(storeQ) &&
        storeQ.length &&
        Array.isArray(storeQ[0].values)
      ) {
        storeQ[0].values.forEach(([id, chain, location]) => {
          const storeId = Math.trunc(Number(id));
          if (!Number.isFinite(storeId) || storeId <= 0) return;
          const chainName = String(chain || '').trim();
          const locationName = String(location || '').trim();
          const label = locationName
            ? `${chainName} (${locationName})`
            : chainName || `Store ${storeId}`;
          storeMeta.set(storeId, { id: storeId, label });
        });
      }
      selectedStores = orderedSelectedStoreIds
        .map((storeId) => storeMeta.get(storeId))
        .filter(Boolean);
    } catch (_) {
      selectedStores = [];
    }

    const effectiveStoreIds = selectedStores.map((store) => store.id);
    const uniqueNameKeys = [
      ...new Set(
        rows
          .map((row) =>
            String(row?.name || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    ];
    if (effectiveStoreIds.length && uniqueNameKeys.length) {
      const effectiveStorePh = effectiveStoreIds.map(() => '?').join(',');
      const namePh = uniqueNameKeys.map(() => '?').join(',');
      if (tableExists('ingredient_store_location')) {
        try {
          const baseQ = db.exec(
            `
              SELECT DISTINCT
                lower(trim(i.name)) AS name_key,
                sl.store_id,
                sl.ID AS aisle_id,
                COALESCE(sl.name, '') AS aisle_name,
                COALESCE(sl.sort_order, 999999) AS aisle_sort_order
              FROM ingredient_store_location isl
              JOIN ingredients i ON i.ID = isl.ingredient_id
              JOIN store_locations sl ON sl.ID = isl.store_location_id
              WHERE sl.store_id IN (${effectiveStorePh})
                AND lower(trim(i.name)) IN (${namePh});
            `,
            [...effectiveStoreIds, ...uniqueNameKeys],
          );
          if (
            Array.isArray(baseQ) &&
            baseQ.length &&
            Array.isArray(baseQ[0].values)
          ) {
            baseQ[0].values.forEach(
              ([
                nameKey,
                storeIdRaw,
                aisleIdRaw,
                aisleName,
                aisleSortOrder,
              ]) => {
                const nameKeyNormalized = String(nameKey || '')
                  .trim()
                  .toLowerCase();
                const storeId = Math.trunc(Number(storeIdRaw));
                const aisleId = Math.trunc(Number(aisleIdRaw));
                if (
                  !nameKeyNormalized ||
                  !Number.isFinite(storeId) ||
                  !Number.isFinite(aisleId)
                ) {
                  return;
                }
                if (!baseAssignmentMap.has(nameKeyNormalized)) {
                  baseAssignmentMap.set(nameKeyNormalized, []);
                }
                baseAssignmentMap.get(nameKeyNormalized).push({
                  storeId,
                  aisleId,
                  aisleLabel:
                    String(aisleName || '').trim() || `Aisle ${aisleId}`,
                  aisleSortOrder: Number.isFinite(Number(aisleSortOrder))
                    ? Number(aisleSortOrder)
                    : 999999,
                });
              },
            );
          }
        } catch (_) {}
      }

      if (
        tableExists('ingredient_variants') &&
        tableExists('ingredient_variant_store_location')
      ) {
        try {
          const variantOrderQ = db.exec(
            `
              SELECT
                lower(trim(i.name)) AS name_key,
                lower(trim(v.variant)) AS variant_key
              FROM ingredient_variants v
              JOIN ingredients i ON i.ID = v.ingredient_id
              WHERE lower(trim(i.name)) IN (${namePh})
                AND NOT (${getIngredientBaseVariantWhereSql('v.variant')})
              ORDER BY
                lower(trim(i.name)) ASC,
                COALESCE(v.sort_order, 999999) ASC,
                COALESCE(v.id, 999999) ASC;
            `,
            uniqueNameKeys,
          );
          if (
            Array.isArray(variantOrderQ) &&
            variantOrderQ.length &&
            Array.isArray(variantOrderQ[0].values)
          ) {
            variantOrderQ[0].values.forEach(([nameKey, variantKey]) => {
              const nameKeyNormalized = String(nameKey || '')
                .trim()
                .toLowerCase();
              const variantKeyNormalized = String(variantKey || '')
                .trim()
                .toLowerCase();
              if (!nameKeyNormalized || !variantKeyNormalized) return;
              if (!variantOrderMap.has(nameKeyNormalized)) {
                variantOrderMap.set(nameKeyNormalized, []);
              }
              variantOrderMap.get(nameKeyNormalized).push(variantKeyNormalized);
            });
          }
        } catch (_) {}

        try {
          const variantAnyQ = db.exec(
            `
              SELECT DISTINCT
                lower(trim(i.name)) AS name_key,
                sl.store_id,
                sl.ID AS aisle_id,
                COALESCE(sl.name, '') AS aisle_name,
                COALESCE(sl.sort_order, 999999) AS aisle_sort_order
              FROM ingredient_variant_store_location ivsl
              JOIN ingredient_variants v ON v.id = ivsl.ingredient_variant_id
              JOIN ingredients i ON i.ID = v.ingredient_id
              JOIN store_locations sl ON sl.ID = ivsl.store_location_id
              WHERE sl.store_id IN (${effectiveStorePh})
                AND lower(trim(i.name)) IN (${namePh})
                AND NOT (${getIngredientBaseVariantWhereSql('v.variant')});
            `,
            [...effectiveStoreIds, ...uniqueNameKeys],
          );
          if (
            Array.isArray(variantAnyQ) &&
            variantAnyQ.length &&
            Array.isArray(variantAnyQ[0].values)
          ) {
            variantAnyQ[0].values.forEach(
              ([
                nameKey,
                storeIdRaw,
                aisleIdRaw,
                aisleName,
                aisleSortOrder,
              ]) => {
                const nameKeyNormalized = String(nameKey || '')
                  .trim()
                  .toLowerCase();
                const storeId = Math.trunc(Number(storeIdRaw));
                const aisleId = Math.trunc(Number(aisleIdRaw));
                if (
                  !nameKeyNormalized ||
                  !Number.isFinite(storeId) ||
                  !Number.isFinite(aisleId)
                ) {
                  return;
                }
                if (!variantAnyAssignmentMap.has(nameKeyNormalized)) {
                  variantAnyAssignmentMap.set(nameKeyNormalized, []);
                }
                variantAnyAssignmentMap.get(nameKeyNormalized).push({
                  storeId,
                  aisleId,
                  aisleLabel:
                    String(aisleName || '').trim() || `Aisle ${aisleId}`,
                  aisleSortOrder: Number.isFinite(Number(aisleSortOrder))
                    ? Number(aisleSortOrder)
                    : 999999,
                });
              },
            );
          }
        } catch (_) {}
        try {
          const variantQ = db.exec(
            `
              SELECT DISTINCT
                lower(trim(i.name)) AS name_key,
                lower(trim(v.variant)) AS variant_key,
                sl.store_id,
                sl.ID AS aisle_id,
                COALESCE(sl.name, '') AS aisle_name,
                COALESCE(sl.sort_order, 999999) AS aisle_sort_order
              FROM ingredient_variant_store_location ivsl
              JOIN ingredient_variants v ON v.id = ivsl.ingredient_variant_id
              JOIN ingredients i ON i.ID = v.ingredient_id
              JOIN store_locations sl ON sl.ID = ivsl.store_location_id
              WHERE sl.store_id IN (${effectiveStorePh})
                AND lower(trim(i.name)) IN (${namePh})
                AND NOT (${getIngredientBaseVariantWhereSql('v.variant')});
            `,
            [...effectiveStoreIds, ...uniqueNameKeys],
          );
          if (
            Array.isArray(variantQ) &&
            variantQ.length &&
            Array.isArray(variantQ[0].values)
          ) {
            variantQ[0].values.forEach(
              ([
                nameKey,
                variantKey,
                storeIdRaw,
                aisleIdRaw,
                aisleName,
                aisleSortOrder,
              ]) => {
                const nameKeyNormalized = String(nameKey || '')
                  .trim()
                  .toLowerCase();
                const variantKeyNormalized = String(variantKey || '')
                  .trim()
                  .toLowerCase();
                const storeId = Math.trunc(Number(storeIdRaw));
                const aisleId = Math.trunc(Number(aisleIdRaw));
                if (
                  !nameKeyNormalized ||
                  !variantKeyNormalized ||
                  !Number.isFinite(storeId) ||
                  !Number.isFinite(aisleId)
                ) {
                  return;
                }
                const assignmentKey = getShoppingListVariantAssignmentKey(
                  nameKeyNormalized,
                  variantKeyNormalized,
                );
                if (!assignmentKey) return;
                if (!variantAssignmentMap.has(assignmentKey)) {
                  variantAssignmentMap.set(assignmentKey, []);
                }
                variantAssignmentMap.get(assignmentKey).push({
                  storeId,
                  aisleId,
                  aisleLabel:
                    String(aisleName || '').trim() || `Aisle ${aisleId}`,
                  aisleSortOrder: Number.isFinite(Number(aisleSortOrder))
                    ? Number(aisleSortOrder)
                    : 999999,
                });
              },
            );
          }
        } catch (_) {}
      }
    }
  }

  const groupedInputRows = rows.map((row) => {
    return {
      ...row,
      assignmentCandidates: getShoppingListAssignmentCandidates(row, {
        baseAssignmentMap,
        variantAssignmentMap,
        variantAnyAssignmentMap,
        variantOrderMap,
      }),
    };
  });

  return buildGroupedShoppingListRows(groupedInputRows, {
    selectedStores,
    unlistedLabel: 'UNLISTED',
  });
}

function detectPageIdFromBody() {
  const body = document.body;
  if (!body) return null;
  if (body.dataset && body.dataset.page) {
    return String(body.dataset.page).trim() || null;
  }
  if (body.classList.contains('recipes-page')) return 'recipes';
  if (body.classList.contains('recipe-editor-page')) return 'recipe-editor';
  if (body.classList.contains('welcome-page')) return 'welcome';
  return null;
}

function shouldDeferSqlBootForCurrentPage() {
  const pageId = detectPageIdFromBody();
  return pageId === 'welcome' || pageId === 'web-db-error';
}

function markCurrentPageAsLastVisited() {
  try {
    const current = detectPageIdFromBody();
    if (!current) return;
    sessionStorage.setItem(
      LAST_PAGE_SESSION_KEY,
      String(current).toLowerCase(),
    );
  } catch (_) {}
}

// Track previous page id across full page navigations.
markCurrentPageAsLastVisited();

function enableTopLevelListKeyboardNav(listEl, options = {}) {
  if (!(listEl instanceof Element)) return null;
  const requireExistingSelectionForArrows =
    !!options.requireExistingSelectionForArrows;
  const disableArrowNavigation = !!options.disableArrowNavigation;
  const disableEnterActivation = !!options.disableEnterActivation;
  const disableHoverSelection = !!options.disableHoverSelection;
  const toggleSelectionOnClick = !!options.toggleSelectionOnClick;
  const clearSelectionOnOutsidePointerDown =
    !!options.clearSelectionOnOutsidePointerDown;
  const clearSelectionOnOutsideFocus = !!options.clearSelectionOnOutsideFocus;
  const clearSelectionOnWindowBlur = !!options.clearSelectionOnWindowBlur;
  const clearSelectionOnEscape = !!options.clearSelectionOnEscape;

  // Marks this list so CSS can avoid showing a second "hover highlight"
  // when keyboard selection moves off the hovered row.
  listEl.classList.add('top-level-kbd-nav');

  // Start with *no* selection. Hover or enabled keyboard nav can select.
  let selectedIdx = -1;
  let selectionSource = null; // 'hover' | 'keyboard' | null

  const getRows = () =>
    Array.from(listEl.querySelectorAll('li')).filter(
      (li) => !li.classList.contains('recipe-list-servings-header'),
    );

  const applySelection = () => {
    const rows = getRows();
    if (rows.length === 0) return;

    if (selectedIdx == null) selectedIdx = -1;
    if (selectedIdx >= rows.length) selectedIdx = rows.length - 1;

    rows.forEach((li, i) =>
      li.classList.toggle('is-selected', i === selectedIdx),
    );
    if (selectedIdx >= 0) {
      rows[selectedIdx]?.scrollIntoView?.({ block: 'nearest' });
    }
  };

  const applySelectedIdx = (idx) => {
    selectedIdx = idx;
    applySelection();
  };

  const clearSelection = () => {
    selectionSource = null;
    applySelectedIdx(-1);
  };

  // Hover should not be a competing highlight; it should *move selection*.
  listEl.addEventListener('mouseover', (e) => {
    if (disableHoverSelection) return;
    const li = e.target?.closest?.('li');
    if (!li || !listEl.contains(li)) return;
    const rows = getRows();
    const idx = rows.indexOf(li);
    if (idx >= 0) {
      selectionSource = 'hover';
      applySelectedIdx(idx);
    }
  });

  // If the mouse is not over a hover target (li), clear hover-driven selection.
  const clearHoverSelectionIfNeeded = (e) => {
    if (disableHoverSelection) return;
    if (selectionSource !== 'hover') return;
    const li = e?.target?.closest?.('li');
    if (li && listEl.contains(li)) return;
    selectionSource = null;
    applySelectedIdx(-1);
  };

  // When moving over blank space inside the list, clear the highlight.
  listEl.addEventListener('mousemove', clearHoverSelectionIfNeeded);
  // When leaving the list entirely, clear the highlight.
  listEl.addEventListener('mouseleave', clearHoverSelectionIfNeeded);

  // Click should also update selection (keeps state coherent after mouse use).
  listEl.addEventListener('click', (e) => {
    const li = e.target?.closest?.('li');
    if (!li || !listEl.contains(li)) return;
    const rows = getRows();
    const idx = rows.indexOf(li);
    if (idx >= 0) {
      if (toggleSelectionOnClick && idx === selectedIdx) {
        clearSelection();
        return;
      }
      // Treat click as a "committed" selection so it doesn't get cleared on mouseout.
      selectionSource = 'keyboard';
      applySelectedIdx(idx);
    }
  });

  if (clearSelectionOnOutsidePointerDown) {
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (selectedIdx < 0) return;
        const targetRow = e.target?.closest?.('li');
        if (targetRow && listEl.contains(targetRow)) return;
        clearSelection();
      },
      { capture: true },
    );
  }

  if (clearSelectionOnOutsideFocus) {
    document.addEventListener(
      'focusin',
      (e) => {
        if (selectedIdx < 0) return;
        if (e.target instanceof Node && listEl.contains(e.target)) return;
        clearSelection();
      },
      { capture: true },
    );
  }

  if (clearSelectionOnWindowBlur) {
    window.addEventListener('blur', () => {
      if (selectedIdx < 0) return;
      clearSelection();
    });
  }

  document.addEventListener(
    'keydown',
    (e) => {
      // Only plain keys; don't steal Cmd/Ctrl/Alt/Shift combos
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.isComposing) return;
      if (isTypingContext(e.target)) return;
      if (isModalOpen()) return;
      if (document.activeElement?.closest?.('.bottom-nav')) return;

      const rows = getRows();
      if (rows.length === 0) return;

      if (e.key === 'Escape') {
        if (!clearSelectionOnEscape || selectedIdx < 0) return;
        e.preventDefault();
        clearSelection();
        return;
      }

      if (disableArrowNavigation) return;

      if (e.key === 'ArrowDown') {
        if (selectedIdx < 0 && requireExistingSelectionForArrows) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        // If nothing selected yet, Down selects the first row.
        if (selectedIdx < 0) {
          selectionSource = 'keyboard';
          applySelectedIdx(0);
          return;
        }
        selectionSource = 'keyboard';
        applySelectedIdx(Math.min(selectedIdx + 1, rows.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        if (selectedIdx < 0 && requireExistingSelectionForArrows) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        // If nothing selected yet, Up selects the last row.
        if (selectedIdx < 0) {
          selectionSource = 'keyboard';
          applySelectedIdx(rows.length - 1);
          return;
        }
        selectionSource = 'keyboard';
        applySelectedIdx(Math.max(selectedIdx - 1, 0));
        return;
      }

      if (e.key === 'Enter') {
        if (disableEnterActivation) {
          if (selectedIdx >= 0) e.preventDefault();
          return;
        }
        if (selectedIdx < 0) return;
        e.preventDefault();
        rows[selectedIdx]?.click?.();
      }
    },
    { capture: true },
  );

  // Initial paint
  applySelection();

  return {
    syncAfterRender() {
      applySelection();
    },
    getSelectedIdx() {
      return selectedIdx;
    },
    setSelectedIdx(idx, options = {}) {
      selectionSource =
        options?.source === 'hover'
          ? 'hover'
          : options?.source === null
            ? null
            : 'keyboard';
      applySelectedIdx(idx);
    },
    resetToTop() {
      selectedIdx = -1;
      applySelection();
    },
  };
}

function bootFavoriteEatsAfterSqlReady() {
  // --- page load routing ---

  const pageId = detectPageIdFromBody();
  void bootSharedPresence({ pageId });

  // --- Cmd/Ctrl+S: invoke visible editor Save action ---
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.isComposing) return;
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (String(e.key || '').toLowerCase() !== 's') return;

      const saveBtn = document.getElementById('appBarSaveBtn');
      if (!(saveBtn instanceof HTMLButtonElement)) return;
      if (saveBtn.disabled) return;

      const styles = window.getComputedStyle(saveBtn);
      if (styles.display === 'none' || styles.visibility === 'hidden') return;

      e.preventDefault();
      e.stopPropagation();
      saveBtn.click();
    },
    { capture: true },
  );

  // --- Cmd+← / Cmd+→ / Cmd+↑ / Cmd+↓: move between top-level pages ---
  const TOP_LEVEL_PAGES = getTopLevelPageOrder();

  document.addEventListener(
    'keydown',
    (e) => {
      // Cmd only (avoid stealing Ctrl/Alt/Shift combos)
      if (!e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.isComposing) return;

      if (
        !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
      )
        return;
      if (isTypingContext(e.target) && !isAppBarSearchContext(e.target))
        return;
      if (TOP_LEVEL_PAGES.length <= 1) return;
      const idx = TOP_LEVEL_PAGES.indexOf(pageId);
      if (idx === -1) return; // only act on top-level list pages

      // Stores: Cmd+↑/↓ reorders when a row has keyboard selection (red), not tab switching.
      if (
        (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
        typeof consumeCmdVerticalArrowBeforeTopLevelNav === 'function'
      ) {
        try {
          if (consumeCmdVerticalArrowBeforeTopLevelNav(e)) return;
        } catch (_) {}
      }

      // Treat Up like Left, and Down like Right.
      const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      const nextIdx =
        (idx + delta + TOP_LEVEL_PAGES.length) % TOP_LEVEL_PAGES.length;

      e.preventDefault();
      window.location.href = getTopLevelPageHref(TOP_LEVEL_PAGES[nextIdx]);
    },
    { capture: true },
  );

  // --- Cmd+↑: go to parent/back page on editor pages ---
  const CHILD_EDITOR_PAGES = new Set([
    'recipe-editor',
    'shopping-editor',
    'unit-editor',
    'size-editor',
    'tag-editor',
    'store-editor',
  ]);

  document.addEventListener(
    'keydown',
    (e) => {
      // Cmd only (avoid stealing Ctrl/Alt/Shift combos)
      if (!e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.isComposing) return;

      if (e.key !== 'ArrowUp') return;
      if (!CHILD_EDITOR_PAGES.has(pageId)) return;
      if (isTypingContext(e.target) && !isAppBarSearchContext(e.target))
        return;

      const backBtn = document.getElementById('appBarBackBtn');
      if (!backBtn) return;

      e.preventDefault();
      backBtn.click();
    },
    { capture: true },
  );

  const pageLoaders = {
    recipes: loadRecipesPage,
    'recipe-editor': loadRecipeEditorPage,
  };

  if (pageId && pageLoaders[pageId]) {
    pageLoaders[pageId]();
    return;
  }
  if (pageId && pageId !== 'welcome') {
    window.location.href = 'recipes.html';
  }
}

if (!shouldDeferSqlBootForCurrentPage()) {
  bootFavoriteEatsAfterSqlReady();
}

// Browser-only database loading and static web builds have been removed;
// use `npm start` (Electron) only.

// Recipes page logic
async function loadRecipesPage() {
  const dataApi = getFavoriteEatsDataApi();
  window.dbInstance = null;
  window.recipeEditorCatalogOnlyMode = true;

  initAppBar({
    mode: 'list',
    titleText: 'Recipes',
    showMenu: false,
  });

  // App bar is injected async; wait before wiring menu/search/add.
  if (typeof waitForAppBarReady === 'function') {
    await waitForAppBarReady();
  }

  const addBtnRecipes = document.getElementById('appBarAddBtn');
  const recipesActionBtn = addBtnRecipes;

  const list = document.getElementById('recipeList');
  if (!list) return;
  ensureRecipeListServingsHeaderLabelMediaListener();
  list.innerHTML = '';

  // Keyboard selection + Enter activation for list rows.
  const listNav = enableTopLevelListKeyboardNav(list);
  const searchInput = document.getElementById('appBarSearchInput');
  const clearBtn = document.getElementById('appBarSearchClear');
  wireAppBarSearch(searchInput, {
    clearBtn,
    onQueryChange: (query) => {
      searchQuery = String(query || '').toLowerCase();
      rerenderFilteredRecipes();
    },
  });
  const recipeFilterChipRail =
    typeof window.mountTopFilterChipRail === 'function' && searchInput
      ? window.mountTopFilterChipRail({
          anchorEl: document.querySelector('.app-bar-wrapper') || searchInput,
          dockId: 'recipeFilterChipDock',
        })
      : null;

  const activeTagFilters = new Set();
  let allVisibleTagNames = [];
  let searchQuery = '';
  let recipeRows = [];
  const listRowStepper = window.listRowStepper;
  const recipeSelectionKeys = new Set();
  let recipeRowEditingKey = '';
  const recipeWebServingsUi = window.recipeWebModeServings || {};
  const recipeWebServingsChangedEventName =
    window.favoriteEatsRecipeWebServings?.changeEventName ||
    window.favoriteEatsEventNames?.recipeWebServingsChanged ||
    '';
  const isRecipeWebSelectMode = () => isForceWebModeEnabled();
  const toPositiveServingsOrNull = (rawValue) => {
    const numeric = Number(rawValue);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  };
  const getRecipeQtyKey = (recipeId) => String(recipeId || '').trim();
  const isRecipeSelected = (recipeId) =>
    recipeSelectionKeys.has(getRecipeQtyKey(recipeId));
  const getRecipeRowById = (recipeId) =>
    recipeRows.find((row) => Number(row?.id) === Number(recipeId)) || null;
  const primeRecipeRowServings = (recipeRow) => {
    if (!recipeRow || typeof window.recipeWebModePrimeRecipe !== 'function')
      return;
    window.recipeWebModePrimeRecipe(recipeRow);
  };
  const getRecipeRowBounds = (recipeRow) => {
    if (typeof recipeWebServingsUi.getBounds === 'function') {
      return recipeWebServingsUi.getBounds(recipeRow);
    }
    return null;
  };
  const getRecipeRowDisplayServings = (recipeRow) => {
    if (typeof recipeWebServingsUi.getDisplayValue === 'function') {
      return recipeWebServingsUi.getDisplayValue(recipeRow);
    }
    const bounds = getRecipeRowBounds(recipeRow);
    if (!bounds) return null;
    return bounds.baseDefault;
  };
  const formatRecipeRowServings = (rawValue) => {
    if (typeof recipeWebServingsUi.formatDisplay === 'function') {
      return recipeWebServingsUi.formatDisplay(rawValue);
    }
    return typeof window.formatShoppingQtyForDisplay === 'function'
      ? window.formatShoppingQtyForDisplay(rawValue)
      : String(rawValue == null ? '' : rawValue);
  };
  const initializeRecipeRowServings = (recipeRow) => {
    const bounds = getRecipeRowBounds(recipeRow);
    if (!bounds || typeof recipeWebServingsUi.applyToModel !== 'function')
      return null;
    const initial =
      bounds.baseDefault != null && bounds.baseDefault > 0
        ? bounds.baseDefault
        : 1;
    return recipeWebServingsUi.applyToModel(recipeRow, initial);
  };
  const syncRecipesActionButtonState = () => {
    if (!(recipesActionBtn instanceof HTMLButtonElement)) return;
    if (!isRecipeWebSelectMode()) {
      recipesActionBtn.disabled = false;
      recipesActionBtn.removeAttribute('aria-disabled');
      return;
    }
    const disabled = recipeSelectionKeys.size === 0;
    recipesActionBtn.disabled = disabled;
    recipesActionBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  };
  const makeRecipeStepperDOM = () => {
    const { stepper, minusBtn, qtySpan, plusBtn } =
      listRowStepper.createStepperDOM({
        decreaseLabel: 'Decrease recipe quantity',
        increaseLabel: 'Increase recipe quantity',
      });
    const qtyBtn = document.createElement('button');
    qtyBtn.type = 'button';
    qtyBtn.className = 'shopping-stepper-qty shopping-stepper-qty-button';
    qtyBtn.setAttribute('aria-label', 'Edit servings');
    qtyBtn.textContent = qtySpan.textContent || '0';
    stepper.replaceChild(qtyBtn, qtySpan);
    return { stepper, minusBtn, qtyBtn, plusBtn };
  };
  let recipeRowStepperController = null;
  const syncRecipeRowSelectionState = (rowEl, recipeRow) => {
    if (!(rowEl instanceof HTMLElement) || !recipeRow) return;
    const recipeId = recipeRow.id;
    const enabled = isRecipeWebSelectMode();
    const bounds = getRecipeRowBounds(recipeRow);
    const hasServings = !!bounds;
    const selected = isRecipeSelected(recipeId);
    const isActive =
      selected &&
      !!recipeRowStepperController?.isActive(getRecipeQtyKey(recipeId));
    const icon = rowEl.querySelector('.shopping-list-row-icon');
    const stepper = rowEl.querySelector('.shopping-list-row-stepper');
    const badge = rowEl.querySelector('.shopping-list-row-badge');
    const disabledIndicator = rowEl.querySelector(
      '.recipe-list-servings-disabled',
    );
    const qtyEl = stepper?.querySelector('.shopping-stepper-qty');
    const minusBtn = stepper?.querySelector('.shopping-stepper-btn');
    const minusIcon = minusBtn?.querySelector('.material-symbols-outlined');
    const displayServings = getRecipeRowDisplayServings(recipeRow);
    const formattedServings =
      displayServings == null ? '' : formatRecipeRowServings(displayServings);
    const shouldDeleteOnDecrease = !!(
      hasServings &&
      selected &&
      bounds?.canAdjust &&
      displayServings != null &&
      Math.abs(displayServings - bounds.min) < 1e-9
    );

    rowEl.dataset.recipeServingsAvailable = hasServings ? 'true' : 'false';
    rowEl.dataset.recipeSelected =
      enabled && selected && hasServings ? 'true' : 'false';
    rowEl.classList.toggle(
      'shopping-row-checked',
      enabled && selected && hasServings,
    );

    const servingsSlot = rowEl.querySelector('.recipe-list-servings-slot');
    if (servingsSlot) {
      servingsSlot.classList.toggle(
        'recipe-list-servings-slot--collapsed-hit',
        !!(enabled && hasServings && !isActive),
      );
    }

    if (qtyEl) qtyEl.textContent = formattedServings;
    if (badge) {
      listRowStepper.setShoppingListBadgeQtyLabel(badge, formattedServings);
    }
    if (minusBtn) {
      minusBtn.setAttribute(
        'aria-label',
        shouldDeleteOnDecrease
          ? 'Remove recipe selection'
          : 'Decrease servings',
      );
    }
    if (minusIcon)
      minusIcon.textContent = shouldDeleteOnDecrease ? 'delete' : 'remove';

    if (!enabled) {
      if (icon) icon.style.display = 'none';
      if (stepper) stepper.style.display = 'none';
      if (badge) badge.style.display = 'none';
      if (disabledIndicator) disabledIndicator.style.display = 'none';
      return;
    }

    if (!hasServings) {
      if (icon) icon.style.display = 'none';
      if (stepper) stepper.style.display = 'none';
      if (badge) badge.style.display = 'none';
      if (disabledIndicator) disabledIndicator.style.display = 'inline-flex';
      return;
    }

    if (disabledIndicator) disabledIndicator.style.display = 'none';
    if (isActive) {
      if (icon) icon.style.display = 'none';
      if (stepper) stepper.style.display = 'inline-flex';
      if (badge) badge.style.display = 'none';
      return;
    }

    if (selected) {
      if (icon) icon.style.display = 'none';
      if (stepper) stepper.style.display = 'none';
      if (badge) badge.style.display = 'inline-flex';
      return;
    }

    if (icon) icon.style.display = '';
    if (stepper) stepper.style.display = 'none';
    if (badge) badge.style.display = 'none';
  };
  const setRecipeSelected = (
    recipeId,
    isSelected,
    { activate = false } = {},
  ) => {
    const recipeKey = getRecipeQtyKey(recipeId);
    const recipeRow = getRecipeRowById(recipeId);
    if (!recipeKey || !recipeRow) return;
    if (isSelected) recipeSelectionKeys.add(recipeKey);
    else recipeSelectionKeys.delete(recipeKey);
    setShoppingPlanRecipeSelection({
      recipeId,
      title: recipeRow?.title || '',
      quantity: isSelected ? 1 : 0,
    });
    if (isSelected && activate) {
      recipeRowStepperController?.activate(recipeKey);
    } else if (!isSelected && recipeRowStepperController?.isActive(recipeKey)) {
      recipeRowStepperController.collapseActive();
    }
    if (!isSelected && recipeRowEditingKey === recipeKey) {
      recipeRowEditingKey = '';
    }
    syncRecipesActionButtonState();
    rerenderFilteredRecipes();
  };
  const collapseRecipeSelectionUi = () => {
    const changed = !!recipeRowStepperController?.collapseAll?.();
    if (changed) rerenderFilteredRecipes();
  };
  const hydrateRecipeSelectionsFromPlan = () => {
    Object.values(getShoppingPlanRecipeSelections()).forEach((entry) => {
      const recipeId = Number(entry?.recipeId);
      const quantity = Math.max(0, Math.min(99, Number(entry?.quantity || 0)));
      if (!Number.isFinite(recipeId) || recipeId <= 0) return;
      if (!Number.isFinite(quantity) || quantity <= 0) return;
      recipeSelectionKeys.add(getRecipeQtyKey(recipeId));
      if (quantity !== 1) {
        setShoppingPlanRecipeSelection({
          recipeId,
          title: String(entry?.title || '').trim(),
          quantity: 1,
        });
      }
    });
  };

  const renderTagFilterChips = (rows) => {
    const chipMountEl = recipeFilterChipRail?.trackEl;
    if (!chipMountEl) return;
    const names = Array.isArray(allVisibleTagNames) ? [...allVisibleTagNames] : [];
    const countsByTagKey = new Map();
    (rows || []).forEach((r) => {
      (Array.isArray(r.tags) ? r.tags : []).forEach((name) => {
        const key = String(name || '')
          .trim()
          .toLowerCase();
        if (!key) return;
        countsByTagKey.set(key, Number(countsByTagKey.get(key) || 0) + 1);
      });
    });
    names.sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
    if (typeof window.renderFilterChipList !== 'function') {
      chipMountEl.innerHTML = '';
      return;
    }
    window.renderFilterChipList({
      mountEl: chipMountEl,
      chips: names.map((name) => ({
        id: String(name || '').toLowerCase(),
        label: String(name || ''),
        disabled: Number(countsByTagKey.get(String(name || '').toLowerCase()) || 0) <= 0,
      })),
      activeChipIds: activeTagFilters,
      onToggle: (chipId) => {
        const key = String(chipId || '').toLowerCase();
        if (!key) return;
        if (activeTagFilters.has(key)) activeTagFilters.delete(key);
        else activeTagFilters.add(key);
        rerenderFilteredRecipes();
      },
      chipClassName: 'app-filter-chip',
    });
  };

  const getFilteredRecipeRows = () => {
    const q = searchQuery;
    return recipeRows.filter((row) => {
      const titleText = row.title.toLowerCase();
      const tags = Array.isArray(row.tags) ? row.tags : [];
      const tagsInline = tags.join(' ').toLowerCase();
      const searchMatches =
        !q || titleText.includes(q) || tagsInline.includes(q);
      if (!searchMatches) return false;
      if (!activeTagFilters.size) return true;
      const rowKeys = new Set(tags.map((t) => t.toLowerCase()));
      for (const k of activeTagFilters) {
        if (rowKeys.has(k)) return true;
      }
      return false;
    });
  };

  // 🔹 Helper to render a given set of recipes
  function renderRecipeList(rows) {
    list.innerHTML = '';
    const items = Array.isArray(rows) ? rows : [];
    if (!items.length) {
      renderTopLevelEmptyState(list, 'recipes');
      listNav?.syncAfterRender?.();
      return;
    }
    setTopLevelEmptyStateLayoutMode(list, false);

    if (isForceWebModeEnabled()) {
      const headerLi = document.createElement('li');
      headerLi.className = 'recipe-list-servings-header';
      headerLi.setAttribute('aria-hidden', 'true');
      const headerSpacer = document.createElement('span');
      headerSpacer.className =
        'recipe-list-title shopping-list-row-label recipe-list-servings-header-spacer';
      headerSpacer.textContent = '';
      const headerSlot = document.createElement('span');
      headerSlot.className = 'recipe-list-servings-slot';
      const headerLabel = document.createElement('span');
      headerLabel.className = 'recipe-list-servings-header-label';
      syncRecipeListServingsHeaderLabelText(headerLabel);
      headerSlot.appendChild(headerLabel);
      headerLi.appendChild(headerSpacer);
      headerLi.appendChild(headerSlot);
      list.appendChild(headerLi);
    }

    items.forEach((row) => {
      const id = row.id;
      const title = row.title;
      primeRecipeRowServings(row);
      const li = document.createElement('li');
      const titleSpan = document.createElement('span');
      titleSpan.className = 'shopping-list-row-label';
      const titleHit = document.createElement('span');
      titleHit.className = 'recipe-list-title recipe-list-title-hit';
      titleHit.textContent = title || '';
      titleSpan.appendChild(titleHit);
      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined shopping-list-row-icon';
      icon.textContent = 'add_box';
      icon.setAttribute('aria-hidden', 'true');
      const { stepper, minusBtn, qtyBtn, plusBtn } = makeRecipeStepperDOM();
      const badge = document.createElement('span');
      badge.className = 'shopping-list-row-badge';
      badge.style.display = 'none';
      const disabledIndicator = document.createElement('span');
      disabledIndicator.className =
        'material-symbols-outlined recipe-list-servings-disabled';
      disabledIndicator.textContent = 'add_box';
      disabledIndicator.setAttribute('aria-hidden', 'true');
      const slot = document.createElement('span');
      slot.className = 'recipe-list-servings-slot';
      slot.appendChild(icon);
      slot.appendChild(stepper);
      slot.appendChild(badge);
      slot.appendChild(disabledIndicator);
      li.appendChild(titleSpan);
      li.appendChild(slot);
      const recipeKey = getRecipeQtyKey(id);
      li.dataset.recipeRowStepperKey = recipeKey;
      syncRecipeRowSelectionState(li, row);

      const consumeRowStepperEvent = (event) => {
        event.preventDefault();
        event.stopPropagation();
      };
      const startInlineServingsEdit = () => {
        if (!isRecipeWebSelectMode() || !isRecipeSelected(id)) return;
        if (recipeRowEditingKey === recipeKey) return;
        recipeRowEditingKey = recipeKey;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'shopping-stepper-qty shopping-stepper-qty-input';
        input.inputMode = 'decimal';
        input.setAttribute('aria-label', 'Servings value');
        const fallbackValue = getRecipeRowDisplayServings(row);
        input.value =
          fallbackValue == null
            ? ''
            : Number.isInteger(fallbackValue)
              ? String(fallbackValue)
              : String(fallbackValue);
        stepper.replaceChild(input, qtyBtn);
        input.focus();
        input.select();

        let cancelled = false;
        const finishEdit = (shouldCommit) => {
          if (recipeRowEditingKey === recipeKey) {
            recipeRowEditingKey = '';
          }
          if (
            shouldCommit &&
            typeof recipeWebServingsUi.commitInputValue === 'function'
          ) {
            recipeWebServingsUi.commitInputValue(row, input.value, {
              fallbackValue,
            });
          }
          rerenderFilteredRecipes();
        };

        input.addEventListener('click', consumeRowStepperEvent);
        input.addEventListener('pointerdown', (event) =>
          event.stopPropagation(),
        );
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            consumeRowStepperEvent(event);
            input.blur();
          } else if (event.key === 'Escape') {
            consumeRowStepperEvent(event);
            cancelled = true;
            finishEdit(false);
          }
        });
        input.addEventListener('blur', () => {
          if (cancelled) return;
          finishEdit(true);
        });
      };

      slot.addEventListener('click', (event) => {
        if (!isRecipeWebSelectMode()) return;
        if (!getRecipeRowBounds(row)) return;
        if (disabledIndicator.contains(event.target)) return;

        const isStepperVisible = stepper.style.display === 'inline-flex';
        if (isStepperVisible && stepper.contains(event.target)) return;

        const selectedNow = isRecipeSelected(id);
        const stepperActive = !!recipeRowStepperController?.isActive(recipeKey);
        if (isStepperVisible && stepperActive) {
          consumeRowStepperEvent(event);
          return;
        }

        consumeRowStepperEvent(event);

        if (!selectedNow) {
          initializeRecipeRowServings(row);
          setRecipeSelected(id, true, { activate: true });
        } else {
          recipeRowStepperController?.activate(recipeKey);
          rerenderFilteredRecipes();
        }
      });
      slot.addEventListener('pointerdown', (event) => {
        if (!isRecipeWebSelectMode()) return;
        if (!getRecipeRowBounds(row)) return;
        if (disabledIndicator.contains(event.target)) return;
        if (
          stepper.style.display === 'inline-flex' &&
          stepper.contains(event.target)
        )
          return;
        event.stopPropagation();
      });
      disabledIndicator.addEventListener('click', consumeRowStepperEvent);
      disabledIndicator.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      stepper.addEventListener('click', (event) => event.stopPropagation());
      stepper.addEventListener('pointerdown', (event) =>
        event.stopPropagation(),
      );
      qtyBtn.addEventListener('click', (event) => {
        consumeRowStepperEvent(event);
        startInlineServingsEdit();
      });

      minusBtn.addEventListener('click', (event) => {
        consumeRowStepperEvent(event);
        if (!isRecipeWebSelectMode()) return;
        if (!isRecipeSelected(id)) {
          if (recipeRowStepperController?.isActive(recipeKey)) {
            recipeRowStepperController.collapseActive();
            rerenderFilteredRecipes();
          }
          return;
        }
        const bounds = getRecipeRowBounds(row);
        const displayServings = getRecipeRowDisplayServings(row);
        if (!bounds || displayServings == null) return;
        if (bounds.canAdjust && Math.abs(displayServings - bounds.min) < 1e-9) {
          setRecipeSelected(id, false);
          return;
        }
        const nextValue =
          typeof recipeWebServingsUi.getNextValue === 'function'
            ? recipeWebServingsUi.getNextValue(row, -1)
            : null;
        if (
          nextValue == null ||
          typeof recipeWebServingsUi.applyToModel !== 'function'
        )
          return;
        recipeWebServingsUi.applyToModel(row, nextValue);
        rerenderFilteredRecipes();
      });

      plusBtn.addEventListener('click', (event) => {
        consumeRowStepperEvent(event);
        if (!isRecipeWebSelectMode() || !isRecipeSelected(id)) return;
        const nextValue =
          typeof recipeWebServingsUi.getNextValue === 'function'
            ? recipeWebServingsUi.getNextValue(row, 1)
            : null;
        if (
          nextValue == null ||
          typeof recipeWebServingsUi.applyToModel !== 'function'
        )
          return;
        recipeWebServingsUi.applyToModel(row, nextValue);
        rerenderFilteredRecipes();
      });

      const bounds = getRecipeRowBounds(row);
      const displayServings = getRecipeRowDisplayServings(row);
      const atOrAboveMax =
        bounds &&
        displayServings != null &&
        displayServings >= bounds.max - 1e-9;
      minusBtn.disabled =
        !bounds || displayServings == null || !bounds.canAdjust;
      plusBtn.disabled =
        !bounds || displayServings == null || !bounds.canAdjust || atOrAboveMax;

      // Row-level hit target: open recipe from padding, label, gaps — not the servings column.
      li.addEventListener('click', (event) => {
        if (slot.contains(event.target)) return;
        // Treat Ctrl-click / Cmd-click as "delete"
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          void deleteRecipeWithConfirm(id, title);
          return;
        }

        collapseRecipeSelectionUi();
        sessionStorage.setItem('selectedRecipeId', id);
        window.location.href = 'recipeEditor.html';
      });

      // Right-click / two-finger click → delete dialog as well
      li.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        void deleteRecipeWithConfirm(id, title);
      });

      list.appendChild(li);
    });

    // Keep selection valid after rerender (search/filter changes).
    listNav?.syncAfterRender?.();
  }

  const rerenderFilteredRecipes = () => {
    const filtered = getFilteredRecipeRows();
    renderTagFilterChips(recipeRows);
    renderRecipeList(filtered);
  };

  recipeRowStepperController = listRowStepper.createController({
    listEl: list,
    isEnabled: isRecipeWebSelectMode,
    collapseExpanded: () => {
      if (!recipeRowEditingKey) return false;
      recipeRowEditingKey = '';
      return true;
    },
    idleCollapseMs: 3500,
    onIdleCollapse: rerenderFilteredRecipes,
    idleResetActivity: (target, activeKey) => {
      if (!(target instanceof Element)) return false;
      const row = target.closest('li');
      if (!row || !list.contains(row)) return false;
      return String(row.dataset.recipeRowStepperKey || '') === activeKey;
    },
  });
  recipeRowStepperController.bindAutoDismiss({
    onDismissed: rerenderFilteredRecipes,
  });
  window.addEventListener('pageshow', collapseRecipeSelectionUi);
  if (recipeWebServingsChangedEventName) {
    window.addEventListener(recipeWebServingsChangedEventName, () => {
      rerenderFilteredRecipes();
    });
  }
  window.addEventListener('storage', (event) => {
    if (event.key !== window.favoriteEatsStorageKeys?.recipeWebServings) return;
    rerenderFilteredRecipes();
  });

  const applyRemoteRecipesAndTags = (remoteRows, remoteTagPool) => {
    allVisibleTagNames = Array.isArray(remoteTagPool)
      ? remoteTagPool
          .map((name) => String(name || '').trim())
          .filter(Boolean)
      : [];
    recipeRows = (Array.isArray(remoteRows) ? remoteRows : []).map((row) => {
      const normalizedDefault = toPositiveServingsOrNull(row?.servings_default);
      return {
        id: Number(row?.id),
        title: String(row?.title || ''),
        tags: Array.isArray(row?.tags) ? row.tags : [],
        servingsDefault: normalizedDefault,
        servings: {
          default: normalizedDefault,
          min: toPositiveServingsOrNull(row?.servings_min),
          max: toPositiveServingsOrNull(row?.servings_max),
        },
      };
    });
    const validSelectionKeys = new Set(
      recipeRows.map((row) => getRecipeQtyKey(row?.id)).filter(Boolean)
    );
    Array.from(recipeSelectionKeys).forEach((key) => {
      if (!validSelectionKeys.has(key)) {
        recipeSelectionKeys.delete(key);
      }
    });
  };

  let recipeRefreshInFlight = false;
  let recipeRefreshQueued = false;
  const refreshRecipesFromRemote = async ({ showErrorToast = true } = {}) => {
    if (recipeRefreshInFlight) {
      recipeRefreshQueued = true;
      return;
    }
    recipeRefreshInFlight = true;
    try {
      const remoteRows = await dataApi.listRecipes();
      const remoteTagPool = await dataApi.listVisibleTags();
      applyRemoteRecipesAndTags(remoteRows, remoteTagPool);
    } catch (err) {
      console.error('❌ Failed to load recipes from Supabase:', err);
      if (showErrorToast) uiToast('Failed to load recipes.');
      allVisibleTagNames = [];
      recipeRows = [];
    } finally {
      recipeRefreshInFlight = false;
      if (recipeRefreshQueued) {
        recipeRefreshQueued = false;
        queueMicrotask(() => {
          void refreshRecipesFromRemote({ showErrorToast: false });
        });
      }
      syncRecipesActionButtonState();
      rerenderFilteredRecipes();
    }
  };

  await refreshRecipesFromRemote();
  hydrateRecipeSelectionsFromPlan();
  syncRecipesActionButtonState();
  rerenderFilteredRecipes();

  let unsubscribeRecipeCatalogRealtime = null;
  if (typeof dataApi.subscribeRecipeCatalogChanges === 'function') {
    unsubscribeRecipeCatalogRealtime = dataApi.subscribeRecipeCatalogChanges({
      onChange: () => {
        void refreshRecipesFromRemote({ showErrorToast: false });
      },
    });
  }
  const recipeCatalogPollIntervalMs = 3000;
  const recipeCatalogPollHandle = window.setInterval(() => {
    void refreshRecipesFromRemote({ showErrorToast: false });
  }, recipeCatalogPollIntervalMs);
  window.addEventListener(
    'pagehide',
    () => {
      window.clearInterval(recipeCatalogPollHandle);
      if (typeof unsubscribeRecipeCatalogRealtime === 'function') {
        unsubscribeRecipeCatalogRealtime();
      }
      unsubscribeRecipeCatalogRealtime = null;
    },
    { once: true }
  );

  // --- Recipes action button stub ---

  async function openCreateRecipeDialog() {
    if (!window.ui) return;
    const vals = await window.ui.form({
      title: 'New Recipe',
      fields: [
        {
          key: 'title',
          label: 'Title',
          value: '',
          required: true,
          normalize: (v) => (v || '').trim(),
        },
      ],
      confirmText: 'Create',
      cancelText: 'Cancel',
      validate: (v) => {
        if (!v.title || !v.title.trim()) return 'Title is required.';
        return '';
      },
    });
    if (!vals) return;

    const title = vals.title;
    let newId = null;
    try {
      newId = await dataApi.createRecipe({
        title,
        servings_min: 0.5,
        servings_max: 99,
      });
    } catch (err) {
      console.error('❌ Failed to create recipe:', err);
      window.ui.toast({ message: 'Failed to create recipe. See console.' });
      return;
    }

    if (newId != null) {
      sessionStorage.setItem('selectedRecipeId', newId);
      sessionStorage.setItem('selectedRecipeIsNew', '1');
      window.location.href = 'recipeEditor.html';
    }
  }

  async function deleteRecipeWithConfirm(recipeId, title) {
    if (recipeId == null || !window.ui) return;
    const ok = await window.ui.confirm({
      title: 'Delete Recipe',
      message: `Delete "${title}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;

    try {
      await dataApi.deleteRecipe(recipeId);
    } catch (err) {
      console.error('❌ Failed to delete recipe:', err);
      window.ui.toast({ message: 'Failed to delete recipe. See console.' });
      return;
    }

    recipeRows = recipeRows.filter((r) => Number(r.id) !== Number(recipeId));
    rerenderFilteredRecipes();
  }

  const onRecipesActionClick = () => {
    if (isRecipeWebSelectMode()) {
      if (!recipeSelectionKeys.size) {
        uiToast('No recipe selections to clear.');
        return;
      }
      const previousPlan = cloneForUndo(getShoppingPlan(), () =>
        createEmptyShoppingPlan(),
      );
      const previousRecipeSelections = new Set(recipeSelectionKeys);
      const restoreClearedRecipes = () => {
        persistShoppingPlan(previousPlan);
        recipeSelectionKeys.clear();
        previousRecipeSelections.forEach((key) => {
          recipeSelectionKeys.add(key);
        });
        recipeRowEditingKey = '';
        recipeRowStepperController?.collapseAll?.();
        syncRecipesActionButtonState();
        rerenderFilteredRecipes();
      };
      clearShoppingPlanSelections({ clearRecipes: true });
      recipeSelectionKeys.clear();
      recipeRowEditingKey = '';
      recipeRowStepperController?.collapseAll?.();
      syncRecipesActionButtonState();
      rerenderFilteredRecipes();
      uiToastUndo('Recipe selections cleared.', restoreClearedRecipes);
    } else {
      void openCreateRecipeDialog();
    }
  };
  const syncRecipesAppBarActionChrome = () => {
    if (!recipesActionBtn) return;
    if (isRecipeWebSelectMode()) {
      ensureAppBarTextActionPair(recipesActionBtn, 'Reset', 'restart_alt');
    } else {
      ensureAppBarTextActionPair(recipesActionBtn, 'Add', 'add');
    }
    syncRecipesActionButtonState();
  };
  if (recipesActionBtn) {
    syncRecipesAppBarActionChrome();
    recipesActionBtn.addEventListener('click', onRecipesActionClick);
    window.addEventListener(
      FAVORITE_EATS_FORCE_WEB_MODE_EVENT,
      () => {
        if (!document.body.classList.contains('recipes-page')) return;
        syncRecipesAppBarActionChrome();
        rerenderFilteredRecipes();
      },
    );
  }
}

// Defunct list/editor pages — keep named loaders for stale `*.html` bookmarks; all redirect to recipes.
async function loadShoppingPage() {
  try {
    window.location.replace('recipes.html');
  } catch (_) {
    window.location.href = 'recipes.html';
  }
}

// --- Shopping list checklist helpers (tests extract this block) ---
const SHOPPING_LIST_DOC_STORAGE_KEY = 'favoriteEats:shopping-list-doc:v2';
const SHOPPING_LIST_VIEW_MODE_SESSION_KEY =
  'favoriteEats:shopping-list-view-mode';
const SHOPPING_LIST_DOC_VERSION = 3;

function readShoppingListViewModeFromSession() {
  try {
    const raw = String(
      sessionStorage.getItem(SHOPPING_LIST_VIEW_MODE_SESSION_KEY) || '',
    )
      .trim()
      .toLowerCase();
    if (raw === 'home' || raw === 'stores') return raw;
  } catch (_) {}
  return 'stores';
}

function persistShoppingListViewMode(mode) {
  const next = mode === 'home' ? 'home' : 'stores';
  try {
    sessionStorage.setItem(SHOPPING_LIST_VIEW_MODE_SESSION_KEY, next);
  } catch (_) {}
}

function createShoppingListChecklistRowId() {
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `shopping-list-row-${stamp}-${random}`;
}

function createEmptyShoppingListDoc() {
  return {
    version: SHOPPING_LIST_DOC_VERSION,
    rows: [],
  };
}

function normalizeShoppingListDocRow(rawRow, fallbackOrder = 0) {
  const source =
    rawRow && typeof rawRow === 'object' && !Array.isArray(rawRow)
      ? rawRow
      : {};
  const text = String(source.text || '').trim();
  if (!text) return null;
  const rawOrder = Number(source.order);
  const rawStoreId = Math.trunc(Number(source.storeId));
  const rawAisleId = Math.trunc(Number(source.aisleId));
  const rawAisleSortOrder = Number(source.aisleSortOrder);
  const hasExplicitAisleSortOrder =
    source.aisleSortOrder != null &&
    String(source.aisleSortOrder).trim() !== '';
  const sourceKey = String(source.sourceKey || '').trim();
  const sourceText = String(source.sourceText || '').trim();
  const sourceStoreLabel = String(source.sourceStoreLabel || '').trim();
  const sourceBucketLabel = String(source.sourceBucketLabel || '').trim();
  const hasExplicitUserEdited = typeof source.userEdited === 'boolean';
  const inferredUserEdited = !!(
    sourceKey &&
    sourceText &&
    text &&
    text !== sourceText
  );
  return {
    id: String(source.id || '').trim() || createShoppingListChecklistRowId(),
    text,
    checked: !!source.checked,
    storeLabel: String(source.storeLabel || '').trim(),
    storeId: Number.isFinite(rawStoreId) && rawStoreId > 0 ? rawStoreId : null,
    bucketLabel: String(source.bucketLabel || '').trim(),
    aisleId: Number.isFinite(rawAisleId) && rawAisleId > 0 ? rawAisleId : null,
    aisleSortOrder:
      hasExplicitAisleSortOrder && Number.isFinite(rawAisleSortOrder)
        ? rawAisleSortOrder
        : null,
    sourceKey,
    sourceText: sourceKey ? sourceText || text : '',
    sourceStoreLabel: sourceKey
      ? sourceStoreLabel || String(source.storeLabel || '').trim()
      : '',
    sourceBucketLabel: sourceKey
      ? sourceBucketLabel || String(source.bucketLabel || '').trim()
      : '',
    userEdited: sourceKey
      ? hasExplicitUserEdited
        ? !!source.userEdited || inferredUserEdited
        : inferredUserEdited
      : false,
    order: Number.isFinite(rawOrder) ? rawOrder : fallbackOrder,
  };
}

function normalizeShoppingListDoc(rawDoc) {
  const source =
    rawDoc && typeof rawDoc === 'object' && !Array.isArray(rawDoc)
      ? rawDoc
      : {};
  const rawRows = Array.isArray(source.rows) ? source.rows : [];
  const rows = rawRows
    .map((row, index) => normalizeShoppingListDocRow(row, index))
    .filter(Boolean)
    .sort((a, b) => {
      const orderDelta = Number(a.order || 0) - Number(b.order || 0);
      if (Math.abs(orderDelta) > 1e-9) return orderDelta;
      return String(a.id || '').localeCompare(String(b.id || ''));
    })
    .map((row, index) => ({
      ...row,
      order: index,
    }));
  return {
    version: SHOPPING_LIST_DOC_VERSION,
    rows,
  };
}

function loadShoppingListDocFromStorage() {
  try {
    const raw = localStorage.getItem(SHOPPING_LIST_DOC_STORAGE_KEY);
    if (!raw) return null;
    return normalizeShoppingListDoc(JSON.parse(raw));
  } catch (_) {
    return null;
  }
}

function persistShoppingListDoc(doc) {
  const normalized = normalizeShoppingListDoc(doc);
  try {
    localStorage.setItem(
      SHOPPING_LIST_DOC_STORAGE_KEY,
      JSON.stringify(normalized),
    );
  } catch (_) {}
  return normalized;
}

function doesShoppingListRowHaveUserOverride(row) {
  if (!row || typeof row !== 'object') return false;
  const sourceKey = String(row.sourceKey || '').trim();
  const text = String(row.text || '').trim();
  const sourceText = String(row.sourceText || '').trim();
  if (!sourceKey || !text || !sourceText) return false;
  return !!row.userEdited && text !== sourceText;
}

function hydrateLegacyShoppingListDocSources(storedDoc, generatedDoc) {
  const normalizedStoredDoc = normalizeShoppingListDoc(storedDoc);
  const normalizedGeneratedDoc = normalizeShoppingListDoc(generatedDoc);
  const storedRows = normalizedStoredDoc.rows;
  const generatedRows = normalizedGeneratedDoc.rows;
  const allRowsNeedSourceKeys =
    storedRows.length > 0 &&
    storedRows.every((row) => !String(row?.sourceKey || '').trim());
  if (!allRowsNeedSourceKeys) return normalizedStoredDoc;
  if (storedRows.length !== generatedRows.length) return normalizedStoredDoc;
  const canHydrateByOrder = storedRows.every((row, index) => {
    const generatedRow = generatedRows[index];
    if (!generatedRow || !String(generatedRow.sourceKey || '').trim())
      return false;
    return (
      String(row.storeLabel || '').trim() ===
        String(generatedRow.storeLabel || '').trim() &&
      String(row.bucketLabel || '').trim() ===
        String(generatedRow.bucketLabel || '').trim()
    );
  });
  if (!canHydrateByOrder) return normalizedStoredDoc;
  return normalizeShoppingListDoc({
    version: SHOPPING_LIST_DOC_VERSION,
    rows: storedRows.map((row, index) => {
      const generatedRow = generatedRows[index];
      const generatedText = String(generatedRow?.text || '').trim();
      return {
        ...row,
        sourceKey: String(generatedRow?.sourceKey || '').trim(),
        sourceText: generatedText,
        sourceStoreLabel: String(generatedRow?.sourceStoreLabel || '').trim(),
        sourceBucketLabel: String(generatedRow?.sourceBucketLabel || '').trim(),
        userEdited: generatedText
          ? String(row?.text || '').trim() !== generatedText
          : false,
      };
    }),
  });
}

function buildShoppingListDocFromPlanRows(rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const docRows = [];
  let currentStoreLabel = '';
  let currentStoreId = null;
  let currentBucketLabel = '';
  let currentAisleId = null;
  let currentAisleSortOrder = null;

  sourceRows.forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const rowType = String(row.rowType || '').trim();
    const text = String(row.text || row.label || '').trim();
    const className = String(row.className || '').trim();
    const rowStoreId = Math.trunc(Number(row.storeId));
    const rowAisleId = Math.trunc(Number(row.aisleId));
    const rowAisleSortOrder = Number(row.aisleSortOrder);

    if (rowType === 'section') {
      if (!text) return;
      if (className.includes('shopping-list-section--store')) {
        currentStoreLabel = text;
        currentStoreId =
          Number.isFinite(rowStoreId) && rowStoreId > 0 ? rowStoreId : null;
        currentBucketLabel = '';
        currentAisleId = null;
        currentAisleSortOrder = null;
        return;
      }
      if (className.includes('shopping-list-section--unlisted')) {
        currentStoreLabel = '';
        currentStoreId = null;
        currentBucketLabel = text;
        currentAisleId = null;
        currentAisleSortOrder = null;
        return;
      }
      currentBucketLabel = text;
      currentAisleId =
        Number.isFinite(rowAisleId) && rowAisleId > 0 ? rowAisleId : null;
      currentAisleSortOrder = Number.isFinite(rowAisleSortOrder)
        ? rowAisleSortOrder
        : null;
      return;
    }

    if (!text) return;
    docRows.push({
      id: createShoppingListChecklistRowId(),
      text,
      checked: false,
      storeLabel: currentStoreLabel,
      storeId: currentStoreId,
      bucketLabel: currentBucketLabel,
      aisleId: currentAisleId,
      aisleSortOrder: currentAisleSortOrder,
      sourceKey: String(row.key || '').trim(),
      sourceText: text,
      sourceStoreLabel: currentStoreLabel,
      sourceBucketLabel: currentBucketLabel,
      userEdited: false,
      order: docRows.length,
    });
  });

  return normalizeShoppingListDoc({
    version: SHOPPING_LIST_DOC_VERSION,
    rows: docRows,
  });
}

function mergeShoppingListDocWithGenerated(storedDoc, generatedDoc) {
  const normalizedGeneratedDoc = normalizeShoppingListDoc(generatedDoc);
  const normalizedStoredDoc = hydrateLegacyShoppingListDocSources(
    storedDoc,
    normalizedGeneratedDoc,
  );
  const generatedRows = normalizedGeneratedDoc.rows;
  const storedRows = normalizedStoredDoc.rows;
  const storedRowsBySourceKey = new Map();
  const manualRows = [];
  storedRows.forEach((row) => {
    const sourceKey = String(row?.sourceKey || '').trim();
    if (!sourceKey) {
      manualRows.push(row);
      return;
    }
    storedRowsBySourceKey.set(sourceKey, row);
  });

  const generatedSourceKeys = new Set();
  const mergedRows = [];
  const conflicts = [];

  generatedRows.forEach((generatedRow) => {
    const sourceKey = String(generatedRow?.sourceKey || '').trim();
    if (!sourceKey) {
      mergedRows.push(generatedRow);
      return;
    }
    generatedSourceKeys.add(sourceKey);
    const storedRow = storedRowsBySourceKey.get(sourceKey);
    if (!storedRow) {
      mergedRows.push(generatedRow);
      return;
    }

    const hasUserOverride = doesShoppingListRowHaveUserOverride(storedRow);
    const sourceChanged =
      String(storedRow.sourceText || '').trim() !==
        String(generatedRow.sourceText || '').trim() ||
      String(storedRow.sourceStoreLabel || '').trim() !==
        String(generatedRow.sourceStoreLabel || '').trim() ||
      String(storedRow.sourceBucketLabel || '').trim() !==
        String(generatedRow.sourceBucketLabel || '').trim();

    if (hasUserOverride && sourceChanged) {
      mergedRows.push(storedRow);
      conflicts.push({
        kind: 'update',
        rowId: String(storedRow.id || '').trim(),
        sourceKey,
        currentText: String(storedRow.text || '').trim(),
        previousGeneratedText: String(storedRow.sourceText || '').trim(),
        nextGeneratedText: String(generatedRow.sourceText || '').trim(),
        nextGeneratedDisplayText: String(generatedRow.text || '').trim(),
        nextStoreLabel: String(generatedRow.sourceStoreLabel || '').trim(),
        nextBucketLabel: String(generatedRow.sourceBucketLabel || '').trim(),
        nextStoreId: generatedRow.storeId,
        nextAisleId: generatedRow.aisleId,
        nextAisleSortOrder: generatedRow.aisleSortOrder,
      });
      return;
    }

    mergedRows.push({
      ...storedRow,
      text: hasUserOverride
        ? String(storedRow.text || '').trim()
        : String(generatedRow.text || '').trim(),
      checked: !!storedRow.checked,
      storeLabel: String(generatedRow.storeLabel || '').trim(),
      storeId: generatedRow.storeId,
      bucketLabel: String(generatedRow.bucketLabel || '').trim(),
      aisleId: generatedRow.aisleId,
      aisleSortOrder: generatedRow.aisleSortOrder,
      sourceKey,
      sourceText: String(generatedRow.sourceText || '').trim(),
      sourceStoreLabel: String(generatedRow.sourceStoreLabel || '').trim(),
      sourceBucketLabel: String(generatedRow.sourceBucketLabel || '').trim(),
      userEdited: hasUserOverride,
    });
  });

  storedRows.forEach((storedRow) => {
    const sourceKey = String(storedRow?.sourceKey || '').trim();
    if (!sourceKey || generatedSourceKeys.has(sourceKey)) return;
    if (!doesShoppingListRowHaveUserOverride(storedRow)) return;
    mergedRows.push(storedRow);
    conflicts.push({
      kind: 'remove',
      rowId: String(storedRow.id || '').trim(),
      sourceKey,
      currentText: String(storedRow.text || '').trim(),
      previousGeneratedText: String(storedRow.sourceText || '').trim(),
      nextGeneratedText: '',
      nextGeneratedDisplayText: '',
      nextStoreLabel: '',
      nextBucketLabel: '',
    });
  });

  manualRows
    .slice()
    .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))
    .forEach((row) => {
      mergedRows.push(row);
    });

  return {
    doc: normalizeShoppingListDoc({
      version: SHOPPING_LIST_DOC_VERSION,
      rows: mergedRows,
    }),
    conflicts,
  };
}

function resolveShoppingListDocConflict(doc, conflict, resolution = 'keep') {
  const normalizedDoc = normalizeShoppingListDoc(doc);
  const rows = normalizedDoc.rows.slice();
  const rowIndex = rows.findIndex(
    (row) => String(row?.id || '') === String(conflict?.rowId || ''),
  );
  if (rowIndex === -1) return normalizedDoc;
  const row = rows[rowIndex];
  const mode = resolution === 'replace' ? 'replace' : 'keep';

  if (String(conflict?.kind || '').trim() === 'remove') {
    if (mode === 'replace') {
      rows.splice(rowIndex, 1);
      return normalizeShoppingListDoc({
        version: SHOPPING_LIST_DOC_VERSION,
        rows,
      });
    }
    rows[rowIndex] = {
      ...row,
      sourceKey: '',
      sourceText: '',
      sourceStoreLabel: '',
      sourceBucketLabel: '',
      userEdited: false,
    };
    return normalizeShoppingListDoc({
      version: SHOPPING_LIST_DOC_VERSION,
      rows,
    });
  }

  const nextGeneratedText = String(conflict?.nextGeneratedText || '').trim();
  const nextStoreLabel = String(conflict?.nextStoreLabel || '').trim();
  const nextBucketLabel = String(conflict?.nextBucketLabel || '').trim();
  const nextStoreId = Math.trunc(Number(conflict?.nextStoreId));
  const nextAisleId = Math.trunc(Number(conflict?.nextAisleId));
  const nextAisleSortOrder = Number(conflict?.nextAisleSortOrder);
  if (!nextGeneratedText) return normalizedDoc;

  if (mode === 'replace') {
    rows[rowIndex] = {
      ...row,
      text: nextGeneratedText,
      storeLabel: nextStoreLabel,
      storeId:
        Number.isFinite(nextStoreId) && nextStoreId > 0 ? nextStoreId : null,
      bucketLabel: nextBucketLabel,
      aisleId:
        Number.isFinite(nextAisleId) && nextAisleId > 0 ? nextAisleId : null,
      aisleSortOrder: Number.isFinite(nextAisleSortOrder)
        ? nextAisleSortOrder
        : null,
      sourceKey: String(conflict?.sourceKey || row?.sourceKey || '').trim(),
      sourceText: nextGeneratedText,
      sourceStoreLabel: nextStoreLabel,
      sourceBucketLabel: nextBucketLabel,
      userEdited: false,
    };
  } else {
    rows[rowIndex] = {
      ...row,
      storeLabel: nextStoreLabel,
      storeId:
        Number.isFinite(nextStoreId) && nextStoreId > 0 ? nextStoreId : null,
      bucketLabel: nextBucketLabel,
      aisleId:
        Number.isFinite(nextAisleId) && nextAisleId > 0 ? nextAisleId : null,
      aisleSortOrder: Number.isFinite(nextAisleSortOrder)
        ? nextAisleSortOrder
        : null,
      sourceKey: String(conflict?.sourceKey || row?.sourceKey || '').trim(),
      sourceText: nextGeneratedText,
      sourceStoreLabel: nextStoreLabel,
      sourceBucketLabel: nextBucketLabel,
      userEdited: true,
    };
  }

  return normalizeShoppingListDoc({
    version: SHOPPING_LIST_DOC_VERSION,
    rows,
  });
}

function shoppingListStoreCollapseKey(storeLabel) {
  return `sl-store:\x00${String(storeLabel || '')}`;
}

function shoppingListAisleCollapseKey(storeLabel, bucketLabel) {
  return `sl-aisle:\x00${String(storeLabel || '')}\x00${String(bucketLabel || '')}`;
}

function shoppingListPseudoUnlistedCollapseKey() {
  return 'sl-pseudo-unlisted';
}

function shoppingListCompletedCollapseKey(storeLabel) {
  return `completed\x00${String(storeLabel || '')}`;
}

function toShoppingListAisleTitleCase(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) return '';
  return normalized.replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function normalizeShoppingListBucketKey(bucketLabel) {
  return String(bucketLabel || '')
    .trim()
    .toLowerCase();
}

function getShoppingListDocBucketKey(row) {
  const aisleId = Math.trunc(Number(row?.aisleId));
  if (Number.isFinite(aisleId) && aisleId > 0) {
    return `aisle:${aisleId}`;
  }
  return `label:${normalizeShoppingListBucketKey(row?.bucketLabel)}`;
}

function getShoppingListBucketDescriptors(rows) {
  const buckets = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row, index) => {
    const key = getShoppingListDocBucketKey(row);
    const label = String(row?.bucketLabel || '').trim();
    const aisleId = Math.trunc(Number(row?.aisleId));
    const rawSortOrder = Number(row?.aisleSortOrder);
    const hasExplicitSortOrder =
      row?.aisleSortOrder != null && String(row.aisleSortOrder).trim() !== '';
    const sortOrder =
      hasExplicitSortOrder && Number.isFinite(rawSortOrder)
        ? rawSortOrder
        : 999999;
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label,
        sortOrder,
        aisleId: Number.isFinite(aisleId) && aisleId > 0 ? aisleId : null,
        firstIndex: index,
      });
      return;
    }
    const bucket = buckets.get(key);
    if (!bucket.label && label) {
      bucket.label = label;
    }
    if (sortOrder < bucket.sortOrder) {
      bucket.sortOrder = sortOrder;
    }
    if (
      Number.isFinite(aisleId) &&
      aisleId > 0 &&
      (!Number.isFinite(bucket.aisleId) ||
        bucket.aisleId == null ||
        aisleId < bucket.aisleId)
    ) {
      bucket.aisleId = aisleId;
    }
  });
  return Array.from(buckets.values()).sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    const aisleIdA = Number.isFinite(a.aisleId) ? a.aisleId : 999999;
    const aisleIdB = Number.isFinite(b.aisleId) ? b.aisleId : 999999;
    if (aisleIdA !== aisleIdB) {
      return aisleIdA - aisleIdB;
    }
    const hasExplicitOrderA =
      (Number.isFinite(a.sortOrder) && a.sortOrder < 999999) ||
      Number.isFinite(a.aisleId);
    const hasExplicitOrderB =
      (Number.isFinite(b.sortOrder) && b.sortOrder < 999999) ||
      Number.isFinite(b.aisleId);
    if (!hasExplicitOrderA && !hasExplicitOrderB) {
      return a.firstIndex - b.firstIndex;
    }
    const labelDelta = String(a.label || '').localeCompare(
      String(b.label || ''),
      undefined,
      {
        sensitivity: 'base',
      },
    );
    if (labelDelta !== 0) {
      return labelDelta;
    }
    return a.firstIndex - b.firstIndex;
  });
}

function formatShoppingListPlainText(docRows) {
  const rows = normalizeShoppingListDoc({ rows: docRows }).rows.filter(
    (row) => !row?.checked && String(row?.text || '').trim(),
  );
  if (!rows.length) return '';

  const storeOrder = [];
  const seenStores = new Set();
  rows.forEach((row) => {
    const key = String(row?.storeLabel || '');
    if (seenStores.has(key)) return;
    seenStores.add(key);
    storeOrder.push(key);
  });

  const lines = [];
  storeOrder.forEach((storeLabel) => {
    const storeRows = rows.filter(
      (row) => String(row?.storeLabel || '') === storeLabel,
    );
    if (!storeRows.length) return;
    if (lines.length) lines.push('');
    const normalizedStoreLabel = String(storeLabel || '').trim();
    lines.push((normalizedStoreLabel || 'Unlisted').toUpperCase());

    const bucketDescriptors = getShoppingListBucketDescriptors(storeRows);
    const soleUnlistedPseudo =
      !normalizedStoreLabel &&
      bucketDescriptors.length === 1 &&
      normalizeShoppingListBucketKey(bucketDescriptors[0]?.label) ===
        'unlisted';

    bucketDescriptors.forEach((bucket) => {
      const bucketLabel = String(bucket?.label || '').trim();
      const normalizedBucketLabel = bucketLabel;
      if (
        normalizedBucketLabel &&
        !(
          soleUnlistedPseudo &&
          normalizeShoppingListBucketKey(normalizedBucketLabel) === 'unlisted'
        )
      ) {
        lines.push(toShoppingListAisleTitleCase(normalizedBucketLabel));
      }
      storeRows
        .filter((row) => getShoppingListDocBucketKey(row) === bucket.key)
        .forEach((row) => {
          lines.push(`- ${String(row?.text || '').trim()}`);
        });
    });
  });

  return lines.join('\n');
}

function formatShoppingListHtml(docRows) {
  const rows = normalizeShoppingListDoc({ rows: docRows }).rows.filter(
    (row) => !row?.checked && String(row?.text || '').trim(),
  );
  if (!rows.length) return '';

  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const storeOrder = [];
  const seenStores = new Set();
  rows.forEach((row) => {
    const key = String(row?.storeLabel || '');
    if (seenStores.has(key)) return;
    seenStores.add(key);
    storeOrder.push(key);
  });

  const blocks = [];
  storeOrder.forEach((storeLabel) => {
    const storeRows = rows.filter(
      (row) => String(row?.storeLabel || '') === storeLabel,
    );
    if (!storeRows.length) return;
    if (blocks.length) blocks.push('<br>');

    const normalizedStoreLabel = String(storeLabel || '').trim();
    blocks.push(
      `<p>${escapeHtml((normalizedStoreLabel || 'Unlisted').toUpperCase())}</p>`,
    );

    const bucketDescriptors = getShoppingListBucketDescriptors(storeRows);
    const soleUnlistedPseudo =
      !normalizedStoreLabel &&
      bucketDescriptors.length === 1 &&
      normalizeShoppingListBucketKey(bucketDescriptors[0]?.label) ===
        'unlisted';

    bucketDescriptors.forEach((bucket) => {
      const bucketLabel = String(bucket?.label || '').trim();
      const normalizedBucketLabel = bucketLabel;
      const shouldShowBucketLabel =
        normalizedBucketLabel &&
        !(
          soleUnlistedPseudo &&
          normalizeShoppingListBucketKey(normalizedBucketLabel) === 'unlisted'
        );
      if (shouldShowBucketLabel) {
        blocks.push(
          `<p>${escapeHtml(toShoppingListAisleTitleCase(normalizedBucketLabel))}</p>`,
        );
      }
      const bucketItems = storeRows.filter(
        (row) => getShoppingListDocBucketKey(row) === bucket.key,
      );
      if (!bucketItems.length) return;
      blocks.push('<ul>');
      bucketItems.forEach((row) => {
        blocks.push(`<li>${escapeHtml(String(row?.text || '').trim())}</li>`);
      });
      blocks.push('</ul>');
    });
  });

  return blocks.join('');
}

function formatShoppingListDisplaySectionHeaderLine(row) {
  if (row?.rowType !== 'section') return '';
  const boundary = String(row.collapseBoundary || '').trim();
  const text = String(row.text || row.label || '').trim();
  if (
    boundary === 'store' ||
    boundary === 'home' ||
    boundary === 'pseudo-unlisted-root'
  ) {
    return (text || 'Unlisted').toUpperCase();
  }
  if (boundary === 'aisle' || boundary === 'plain-aisle' || boundary === 'completed') {
    return toShoppingListAisleTitleCase(text || (boundary === 'completed' ? 'completed' : ''));
  }
  return toShoppingListAisleTitleCase(text) || (text || '').toUpperCase();
}

function formatShoppingListPlainTextFromViewState(visibleRows, {
  selectedRecipes = [],
  recipesExpanded = false,
} = {}) {
  const lines = [];
  if (recipesExpanded && Array.isArray(selectedRecipes) && selectedRecipes.length) {
    lines.push('RECIPES');
    selectedRecipes.forEach((recipe) => {
      const title = String(recipe?.title || '').trim();
      if (!title) return;
      const parts = String(recipe?.servingsText || '').trim();
      lines.push(
        parts ? `- ${title} (${parts})` : `- ${title}`,
      );
    });
  }
  if (!Array.isArray(visibleRows)) return lines.join('\n');
  visibleRows.forEach((row) => {
    if (row?.rowType === 'section') {
      const boundary = String(row.collapseBoundary || '').trim();
      if (
        boundary === 'store' ||
        boundary === 'home' ||
        boundary === 'pseudo-unlisted-root'
      ) {
        if (lines.length) {
          lines.push('');
        }
      }
      const header = formatShoppingListDisplaySectionHeaderLine(row);
      if (header) {
        lines.push(header);
      }
      return;
    }
    if (row?.rowType === 'item') {
      if (row.checked) return;
      const t = String(row.text || '').trim();
      if (!t) return;
      lines.push(`- ${t}`);
    }
  });
  return lines.join('\n');
}

function formatShoppingListHtmlFromViewState(visibleRows, {
  selectedRecipes = [],
  recipesExpanded = false,
} = {}) {
  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const blocks = [];
  let openList = false;
  const closeList = () => {
    if (!openList) return;
    blocks.push('</ul>');
    openList = false;
  };

  if (recipesExpanded && Array.isArray(selectedRecipes) && selectedRecipes.length) {
    blocks.push(`<p>${escapeHtml('RECIPES')}</p>`);
    blocks.push('<ul>');
    openList = true;
    selectedRecipes.forEach((recipe) => {
      const title = String(recipe?.title || '').trim();
      if (!title) return;
      const parts = String(recipe?.servingsText || '').trim();
      const liText = parts
        ? `${escapeHtml(title)} (${escapeHtml(parts)})`
        : escapeHtml(title);
      blocks.push(`<li>${liText}</li>`);
    });
    closeList();
  }

  if (!Array.isArray(visibleRows) || !visibleRows.length) {
    return blocks.join('');
  }

  visibleRows.forEach((row) => {
    if (row?.rowType === 'section') {
      closeList();
      const boundary = String(row.collapseBoundary || '').trim();
      if (
        boundary === 'store' ||
        boundary === 'home' ||
        boundary === 'pseudo-unlisted-root'
      ) {
        if (blocks.length) {
          blocks.push('<br>');
        }
      }
      const header = formatShoppingListDisplaySectionHeaderLine(row);
      if (header) {
        blocks.push(`<p>${escapeHtml(header)}</p>`);
      }
      return;
    }
    if (row?.rowType === 'item') {
      if (row.checked) return;
      const t = String(row.text || '').trim();
      if (!t) return;
      if (!openList) {
        blocks.push('<ul>');
        openList = true;
      }
      blocks.push(`<li>${escapeHtml(t)}</li>`);
    }
  });
  closeList();
  return blocks.join('');
}

function buildShoppingListExportPayload(docRows, options = {}) {
  const rows = normalizeShoppingListDoc({ rows: docRows }).rows.filter(
    (row) => !row?.checked && String(row?.text || '').trim(),
  );
  const title = String(options?.title || '').trim() || 'Shopping List';
  if (!rows.length) {
    return { title, stores: [] };
  }

  const storeOrder = [];
  const seenStores = new Set();
  rows.forEach((row) => {
    const key = String(row?.storeLabel || '');
    if (seenStores.has(key)) return;
    seenStores.add(key);
    storeOrder.push(key);
  });

  const stores = [];
  storeOrder.forEach((storeLabel) => {
    const storeRows = rows.filter(
      (row) => String(row?.storeLabel || '') === storeLabel,
    );
    if (!storeRows.length) return;

    const normalizedStoreLabel = String(storeLabel || '').trim();
    const storeEntry = {
      label: (normalizedStoreLabel || 'Unlisted').toUpperCase(),
      aisles: [],
    };

    const bucketDescriptors = getShoppingListBucketDescriptors(storeRows);
    const soleUnlistedPseudo =
      !normalizedStoreLabel &&
      bucketDescriptors.length === 1 &&
      normalizeShoppingListBucketKey(bucketDescriptors[0]?.label) ===
        'unlisted';

    bucketDescriptors.forEach((bucket) => {
      const bucketRows = storeRows.filter(
        (row) => getShoppingListDocBucketKey(row) === bucket.key,
      );
      if (!bucketRows.length) return;
      const normalizedBucketLabel = String(bucket?.label || '').trim();
      const shouldShowBucketLabel =
        normalizedBucketLabel &&
        !(
          soleUnlistedPseudo &&
          normalizeShoppingListBucketKey(normalizedBucketLabel) === 'unlisted'
        );
      storeEntry.aisles.push({
        label: shouldShowBucketLabel
          ? toShoppingListAisleTitleCase(normalizedBucketLabel)
          : '',
        items: bucketRows
          .map((row) => String(row?.text || '').trim())
          .filter(Boolean),
      });
    });

    if (storeEntry.aisles.length) {
      stores.push(storeEntry);
    }
  });

  return { title, stores };
}

function filterShoppingListChecklistRowsForCollapse(
  displayRows,
  collapsedKeys,
) {
  const collapsed = new Set(
    collapsedKeys == null
      ? []
      : typeof collapsedKeys[Symbol.iterator] === 'function'
        ? collapsedKeys
        : [],
  );
  const out = [];
  let topCollapsed = false;
  let aisleCollapsed = false;

  displayRows.forEach((row) => {
    if (row?.rowType === 'section') {
      const boundary = String(row.collapseBoundary || '').trim();
      if (
        boundary === 'store' ||
        boundary === 'pseudo-unlisted-root' ||
        boundary === 'home'
      ) {
        const key = String(row.sectionCollapseKey || '');
        topCollapsed = !!(key && collapsed.has(key));
        aisleCollapsed = false;
        out.push(row);
        return;
      }
      if (topCollapsed) {
        return;
      }
      if (boundary === 'completed') {
        aisleCollapsed = false;
        out.push(row);
        return;
      }
      if (boundary === 'aisle') {
        const key = String(row.sectionCollapseKey || '');
        const canCollapse = !!row.collapsible && !!key;
        aisleCollapsed = !!(canCollapse && collapsed.has(key));
        out.push(row);
        return;
      }
      if (boundary === 'plain-aisle') {
        aisleCollapsed = false;
        out.push(row);
        return;
      }
      out.push(row);
      return;
    }

    if (row?.rowType === 'item') {
      if (topCollapsed) {
        return;
      }
      if (
        row.completedSectionKey &&
        collapsed.has(String(row.completedSectionKey || ''))
      ) {
        return;
      }
      if (aisleCollapsed) {
        return;
      }
      out.push(row);
    }
  });

  return out;
}

const SHOPPING_LIST_HOME_LOCATION_DEFS =
  typeof window !== 'undefined' &&
  typeof window.getHomeLocationDefs === 'function'
    ? window.getHomeLocationDefs()
    : [
        { id: 'fridge', label: 'fridge' },
        { id: 'freezer', label: 'freezer' },
        { id: 'above fridge', label: 'above fridge' },
        { id: 'pantry', label: 'pantry' },
        { id: 'cereal cabinet', label: 'cereal cabinet' },
        { id: 'spices', label: 'spices' },
        { id: 'fruit stand', label: 'fruit stand' },
        { id: 'coffee bar', label: 'coffee bar' },
        { id: 'none', label: 'no location' },
      ];
const SHOPPING_LIST_SOURCE_KEY_VARIANT_SEP = '\x00';

function normalizeShoppingHomeLocationId(raw) {
  if (
    typeof window !== 'undefined' &&
    typeof window.normalizeHomeLocationId === 'function'
  ) {
    return window.normalizeHomeLocationId(raw);
  }
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  if (!value || value === 'measures') return 'none';
  return SHOPPING_LIST_HOME_LOCATION_DEFS.some((entry) => entry.id === value)
    ? value
    : 'none';
}

function normalizeIngredientVariantRows(rows, options = {}) {
  const fallbackBaseHome = normalizeShoppingHomeLocationId(
    options?.fallbackBaseHome || 'none',
  );
  const normalizeRowTags = (rawTags) =>
    normalizeRecipeTagList(
      Array.isArray(rawTags)
        ? rawTags
        : rawTags == null
          ? []
          : String(rawTags)
              .split(/[\n,]/)
              .map((value) => String(value || '').trim()),
    );
  const mergeTagLists = (left, right) =>
    normalizeRecipeTagList([
      ...(Array.isArray(left) ? left : []),
      ...(Array.isArray(right) ? right : []),
    ]);
  const namedRows = [];
  const namedRowsByKey = new Map();
  let baseRow = null;

  (Array.isArray(rows) ? rows : []).forEach((rawRow) => {
    const row = rawRow && typeof rawRow === 'object' ? rawRow : {};
    const isBase = !!row.isBase || isIngredientBaseVariantName(row.value);
    const normalizedHome = normalizeShoppingHomeLocationId(
      row.homeLocation != null
        ? row.homeLocation
        : row.home != null
          ? row.home
          : isBase
            ? fallbackBaseHome
            : 'none',
    );
    const normalizedTags = normalizeRowTags(
      row.tags != null ? row.tags : row.tagNames != null ? row.tagNames : [],
    );

    const depFlag = !!row.isDeprecated;
    const vId = Number(row.variantId);
    if (isBase) {
      if (!baseRow) {
        baseRow = {
          isBase: true,
          value: '',
          homeLocation: normalizedHome,
          tags: normalizedTags,
          variantId: Number.isFinite(vId) && vId > 0 ? vId : null,
          isDeprecated: false,
        };
      } else {
        if (Number.isFinite(vId) && vId > 0) baseRow.variantId = vId;
        if (depFlag) baseRow.isDeprecated = true;
        if (baseRow.homeLocation === 'none' && normalizedHome !== 'none') {
          baseRow.homeLocation = normalizedHome;
          baseRow.tags = mergeTagLists(baseRow.tags, normalizedTags);
        } else if (normalizedTags.length) {
          baseRow.tags = mergeTagLists(baseRow.tags, normalizedTags);
        }
      }
      return;
    }

    const normalizedValue = normalizeNamedIngredientVariant(row.value);
    if (!normalizedValue) return;
    const rowKey = normalizedValue.toLowerCase();
    const existing = namedRowsByKey.get(rowKey);
    if (existing) {
      if (depFlag) existing.isDeprecated = true;
      if (Number.isFinite(vId) && vId > 0) existing.variantId = vId;
      if (existing.homeLocation === 'none' && normalizedHome !== 'none') {
        existing.homeLocation = normalizedHome;
      }
      if (normalizedTags.length) {
        existing.tags = mergeTagLists(existing.tags, normalizedTags);
      }
      return;
    }

    const normalizedRow = {
      isBase: false,
      value: normalizedValue,
      homeLocation: normalizedHome,
      tags: normalizedTags,
      variantId: Number.isFinite(vId) && vId > 0 ? vId : null,
      isDeprecated: depFlag,
    };
    namedRowsByKey.set(rowKey, normalizedRow);
    namedRows.push(normalizedRow);
  });

  return [
    baseRow || {
      isBase: true,
      value: '',
      homeLocation: fallbackBaseHome,
      tags: [],
    },
    ...namedRows,
  ];
}

function serializeIngredientVariantRows(rows, options = {}) {
  try {
    return JSON.stringify(normalizeIngredientVariantRows(rows, options));
  } catch (_) {
    return JSON.stringify(
      normalizeIngredientVariantRows([], {
        fallbackBaseHome: options?.fallbackBaseHome || 'none',
      }),
    );
  }
}

function parseIngredientVariantRowsSerialized(rawValue, options = {}) {
  const fallbackBaseHome = normalizeShoppingHomeLocationId(
    options?.fallbackBaseHome || 'none',
  );
  const serialized = String(rawValue || '').trim();
  if (!serialized) {
    return normalizeIngredientVariantRows([], { fallbackBaseHome });
  }

  try {
    const parsed = JSON.parse(serialized);
    if (Array.isArray(parsed)) {
      return normalizeIngredientVariantRows(parsed, { fallbackBaseHome });
    }
  } catch (_) {}

  return normalizeIngredientVariantRows(
    serialized.split('\n').map((value) => ({
      isBase: false,
      value,
      homeLocation: 'none',
      tags: [],
    })),
    { fallbackBaseHome },
  );
}

function loadIngredientVariantRowsForIngredientInMain(
  db,
  ingredientId,
  options = {},
) {
  const iid = Number(ingredientId);
  if (!db || !Number.isFinite(iid) || iid <= 0) {
    return normalizeIngredientVariantRows([], {
      fallbackBaseHome: options?.fallbackBaseHome || 'none',
    });
  }
  ensureIngredientVariantTagsSchemaInMain(db);
  const hasHomeLocation = tableHasColumnInMain(
    db,
    'ingredient_variants',
    'home_location',
  );
  const hasVariantIsDeprecated = tableHasColumnInMain(
    db,
    'ingredient_variants',
    'is_deprecated',
  );
  const rows = [];
  const rowsByVariantId = new Map();
  try {
    const q = db.exec(
      `SELECT iv.id,
              COALESCE(iv.variant, '') AS variant_name,
              ${hasHomeLocation ? "COALESCE(iv.home_location, 'none')" : "'none'"} AS home_location,
              ${hasVariantIsDeprecated ? 'COALESCE(iv.is_deprecated, 0) AS is_deprecated' : '0 AS is_deprecated'},
              t.name AS tag_name
       FROM ingredient_variants iv
       LEFT JOIN ingredient_variant_tag_map ivtm
         ON ivtm.ingredient_variant_id = iv.id
       LEFT JOIN tags t
         ON t.id = ivtm.tag_id
        AND COALESCE(t.is_hidden, 0) = 0
       WHERE iv.ingredient_id = ?
       ORDER BY COALESCE(iv.sort_order, 999999) ASC,
                iv.id ASC,
                COALESCE(ivtm.sort_order, 999999) ASC,
                ivtm.id ASC,
                t.name COLLATE NOCASE;`,
      [iid],
    );
    if (Array.isArray(q) && q.length && Array.isArray(q[0].values)) {
      q[0].values.forEach((entry) => {
        const variantId = Number(Array.isArray(entry) ? entry[0] : NaN);
        const variantName = String(
          (Array.isArray(entry) ? entry[1] : '') || '',
        );
        const homeLocation = String(
          (Array.isArray(entry) ? entry[2] : 'none') || 'none',
        );
        const isDepRaw = Array.isArray(entry) ? entry[3] : 0;
        const tagName = String(
          (Array.isArray(entry) ? entry[4] : '') || '',
        ).trim();
        if (!Number.isFinite(variantId) || variantId <= 0) return;
        let row = rowsByVariantId.get(variantId);
        if (!row) {
          row = {
            isBase: isIngredientBaseVariantName(variantName),
            value: variantName,
            homeLocation,
            tags: [],
            variantId,
            isDeprecated: Number(isDepRaw || 0) === 1,
          };
          rowsByVariantId.set(variantId, row);
          rows.push(row);
        }
        if (tagName) row.tags.push(tagName);
      });
    }
  } catch (_) {
    return normalizeIngredientVariantRows([], {
      fallbackBaseHome: options?.fallbackBaseHome || 'none',
    });
  }
  return normalizeIngredientVariantRows(rows, {
    fallbackBaseHome: options?.fallbackBaseHome || 'none',
  });
}

function getShoppingListSourceBaseKey(sourceKey) {
  const normalized = String(sourceKey || '')
    .trim()
    .toLowerCase();
  if (!normalized) return '';
  const sepIndex = normalized.indexOf(SHOPPING_LIST_SOURCE_KEY_VARIANT_SEP);
  return sepIndex === -1 ? normalized : normalized.slice(0, sepIndex);
}

function shoppingListHomeCollapseKey(locationId) {
  return `home:${normalizeShoppingHomeLocationId(locationId)}`;
}

function shoppingListHomeCompletedCollapseKey() {
  return 'completed:home';
}

function shoppingListRowMatchesSearch(row, query) {
  const normalizedQuery = String(query || '')
    .trim()
    .toLowerCase();
  if (!normalizedQuery) return true;
  return String(row?.text || '')
    .toLowerCase()
    .includes(normalizedQuery);
}

function createShoppingListDisplayItemRow(row, extra = {}) {
  return {
    rowType: 'item',
    id: row.id,
    text: row.text,
    checked: !!row.checked,
    className: 'shopping-list-group-item shopping-list-doc-item',
    sourceKey: String(row.sourceKey || '').trim(),
    sourceText: String(row.sourceText || '').trim(),
    userEdited: !!row.userEdited,
    ...extra,
  };
}

function buildShoppingListChecklistStoreDisplayRows(rows, options = {}) {
  const normalizedQuery = String(options?.searchQuery || '')
    .trim()
    .toLowerCase();
  const isSearchActive = !!normalizedQuery;
  const visibleRows = isSearchActive
    ? rows.filter((row) => shoppingListRowMatchesSearch(row, normalizedQuery))
    : rows;
  const out = [];

  const storeOrder = [];
  const seenStores = new Set();
  visibleRows.forEach((row) => {
    const key = String(row.storeLabel || '');
    if (seenStores.has(key)) return;
    seenStores.add(key);
    storeOrder.push(key);
  });

  const pushItemRows = (items, extra = {}) => {
    items.forEach((row) => {
      out.push(createShoppingListDisplayItemRow(row, extra));
    });
  };

  storeOrder.forEach((storeLabel) => {
    const storeRows = visibleRows.filter(
      (row) => String(row.storeLabel || '') === storeLabel,
    );
    if (!storeRows.length) return;

    const activeRows = storeRows.filter((row) => !row.checked);
    const completedRows = storeRows.filter((row) => row.checked);
    const bucketDescriptors = getShoppingListBucketDescriptors([
      ...(isSearchActive ? activeRows : [...activeRows, ...completedRows]),
    ]);

    const soleUnlistedPseudo =
      !storeLabel &&
      bucketDescriptors.length === 1 &&
      normalizeShoppingListBucketKey(bucketDescriptors[0]?.label) ===
        'unlisted';

    if (storeLabel) {
      out.push({
        rowType: 'section',
        text: storeLabel,
        className: 'shopping-list-section--store',
        sectionCollapseKey: shoppingListStoreCollapseKey(storeLabel),
        collapseBoundary: 'store',
        collapsible: true,
      });
    } else {
      out.push({
        rowType: 'section',
        text: 'Unlisted',
        className:
          'shopping-list-section--unlisted shopping-list-section--pseudo-unlisted-root',
        sectionCollapseKey: shoppingListPseudoUnlistedCollapseKey(),
        collapseBoundary: 'pseudo-unlisted-root',
        collapsible: true,
      });
    }

    const pushBucket = (bucket, items) => {
      const list = Array.isArray(items) ? items : [];
      const label = String(bucket?.label || '').trim();
      if (!label) {
        if (!list.length) return;
        pushItemRows(list);
        return;
      }
      if (!storeLabel) {
        if (
          soleUnlistedPseudo &&
          normalizeShoppingListBucketKey(label) === 'unlisted'
        ) {
          if (!list.length) return;
          pushItemRows(list);
          return;
        }
        out.push({
          rowType: 'section',
          text: label,
          className:
            normalizeShoppingListBucketKey(label) === 'unlisted'
              ? 'shopping-list-section--unlisted'
              : 'shopping-list-section--aisle',
          collapseBoundary: 'plain-aisle',
          collapsible: false,
        });
      } else {
        out.push({
          rowType: 'section',
          text: label,
          className: 'shopping-list-section--aisle',
          sectionCollapseKey: shoppingListAisleCollapseKey(storeLabel, label),
          collapseBoundary: 'aisle',
          collapsible: list.length > 0,
        });
      }
      if (!list.length) return;
      pushItemRows(list);
    };

    bucketDescriptors.forEach((bucket) => {
      pushBucket(
        bucket,
        activeRows.filter(
          (row) => getShoppingListDocBucketKey(row) === bucket.key,
        ),
      );
    });

    if (completedRows.length) {
      const completedSectionKey = shoppingListCompletedCollapseKey(storeLabel);
      out.push({
        rowType: 'section',
        text: 'completed',
        className: 'shopping-list-section--completed',
        sectionKey: completedSectionKey,
        sectionCollapseKey: completedSectionKey,
        collapseBoundary: 'completed',
        collapsible: true,
      });
      completedRows.forEach((row) => {
        out.push(
          createShoppingListDisplayItemRow(row, {
            completedSectionKey,
          }),
        );
      });
    }
  });

  return out;
}

function getShoppingListHomeLocationIdForRow(row, homeLocationBySourceKey) {
  const sourceKey = String(row?.sourceKey || '')
    .trim()
    .toLowerCase();
  const lookup =
    homeLocationBySourceKey instanceof Map
      ? homeLocationBySourceKey
      : new Map(Object.entries(homeLocationBySourceKey || {}));
  const baseKey = getShoppingListSourceBaseKey(sourceKey);

  let resolved = 'none';
  if (sourceKey && lookup.has(sourceKey)) {
    resolved = normalizeShoppingHomeLocationId(lookup.get(sourceKey));
  }
  if (resolved === 'none' && baseKey && lookup.has(baseKey)) {
    resolved = normalizeShoppingHomeLocationId(lookup.get(baseKey));
  }
  return resolved;
}

function buildShoppingListChecklistHomeDisplayRows(rows, options = {}) {
  const normalizedQuery = String(options?.searchQuery || '')
    .trim()
    .toLowerCase();
  const visibleRows = normalizedQuery
    ? rows.filter((row) => shoppingListRowMatchesSearch(row, normalizedQuery))
    : rows;
  const out = [];
  const activeRows = visibleRows.filter((row) => !row.checked);
  const completedRows = visibleRows.filter((row) => row.checked);
  const homeLocationBySourceKey =
    options?.homeLocationBySourceKey instanceof Map
      ? options.homeLocationBySourceKey
      : new Map(Object.entries(options?.homeLocationBySourceKey || {}));

  SHOPPING_LIST_HOME_LOCATION_DEFS.forEach((locationDef) => {
    const locationRows = activeRows.filter(
      (row) =>
        getShoppingListHomeLocationIdForRow(row, homeLocationBySourceKey) ===
        locationDef.id,
    );
    if (!locationRows.length) return;
    out.push({
      rowType: 'section',
      text: locationDef.label,
      className: 'shopping-list-section--store',
      sectionCollapseKey: shoppingListHomeCollapseKey(locationDef.id),
      collapseBoundary: 'home',
      collapsible: true,
    });
    locationRows.forEach((row) => {
      out.push(
        createShoppingListDisplayItemRow(row, {
          homeLocationId: locationDef.id,
          homeLocationLabel: locationDef.label,
        }),
      );
    });
  });

  if (completedRows.length) {
    const completedSectionKey = shoppingListHomeCompletedCollapseKey();
    out.push({
      rowType: 'section',
      text: 'completed',
      className: 'shopping-list-section--completed',
      sectionKey: completedSectionKey,
      sectionCollapseKey: completedSectionKey,
      collapseBoundary: 'completed',
      collapsible: true,
    });
    completedRows.forEach((row) => {
      out.push(
        createShoppingListDisplayItemRow(row, {
          completedSectionKey,
          homeLocationId: getShoppingListHomeLocationIdForRow(
            row,
            homeLocationBySourceKey,
          ),
        }),
      );
    });
  }

  return out;
}

function getShoppingListChecklistDisplayRows(docRows, options = {}) {
  const rows = normalizeShoppingListDoc({ rows: docRows }).rows;
  const mode = String(options?.mode || 'stores')
    .trim()
    .toLowerCase();
  if (mode === 'home') {
    return buildShoppingListChecklistHomeDisplayRows(rows, options);
  }
  return buildShoppingListChecklistStoreDisplayRows(rows, options);
}

function createSectionToggleButton({
  label = '',
  expanded = true,
  onToggle,
  completed = false,
}) {
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = completed
    ? 'shopping-list-section-toggle shopping-list-section-toggle--completed'
    : 'shopping-list-section-toggle';
  toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  const toggleLabel = document.createElement('span');
  toggleLabel.className = 'shopping-list-section-toggle__label';
  toggleLabel.textContent = String(label || '').trim();
  toggleBtn.appendChild(toggleLabel);
  const toggleIcon = document.createElement('span');
  toggleIcon.className =
    'material-symbols-outlined shopping-list-section-toggle__icon';
  toggleIcon.setAttribute('aria-hidden', 'true');
  toggleIcon.textContent = 'expand_more';
  toggleBtn.appendChild(toggleIcon);
  if (typeof onToggle === 'function') {
    toggleBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onToggle(event);
    });
  }
  return toggleBtn;
}

function getShoppingListSelectedRecipeSummaryRows({
  db = window.dbInstance,
} = {}) {
  const selections = Object.values(getShoppingPlanRecipeSelections()).filter(
    (entry) => Number(entry?.recipeId) > 0,
  );
  if (!selections.length) return [];
  const formatServingsValue = (rawValue) => {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric) || numeric <= 0) return '';
    if (typeof window.formatShoppingQtyForDisplay === 'function') {
      return String(window.formatShoppingQtyForDisplay(numeric) || '').trim();
    }
    return Number.isInteger(numeric)
      ? String(numeric)
      : String(Number(numeric.toFixed(2)));
  };
  return selections
    .map((selection) => {
      const recipeId = Math.trunc(Number(selection?.recipeId));
      if (!Number.isFinite(recipeId) || recipeId <= 0) return null;
      const recipe =
        db && typeof db.exec === 'function'
          ? loadShoppingPlanRecipeFromDB(db, recipeId)
          : null;
      const title =
        String(selection?.title || '').trim() ||
        String(recipe?.title || '').trim() ||
        `Recipe ${recipeId}`;
      const recipeDefaultServings = Number(
        recipe?.servings?.default != null
          ? recipe.servings.default
          : recipe?.servingsDefault,
      );
      const selectedServings = getRecipeWebServingsStoredValue(
        recipeId,
        recipe,
      );
      const servingsValue =
        Number.isFinite(selectedServings) && selectedServings > 0
          ? selectedServings
          : Number.isFinite(recipeDefaultServings) && recipeDefaultServings > 0
            ? recipeDefaultServings
            : null;
      const formattedServings = formatServingsValue(servingsValue);
      return {
        recipeId,
        title,
        servingsText: formattedServings ? `${formattedServings} svg` : '',
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const titleDelta = String(a?.title || '').localeCompare(
        String(b?.title || ''),
        undefined,
        {
          sensitivity: 'base',
        },
      );
      if (titleDelta !== 0) return titleDelta;
      return Number(a?.recipeId || 0) - Number(b?.recipeId || 0);
    });
}

if (typeof window !== 'undefined') {
  window.__shoppingListChecklistHelpers = {
    createEmptyShoppingListDoc,
    normalizeShoppingListDoc,
    doesShoppingListRowHaveUserOverride,
    buildShoppingListDocFromPlanRows,
    mergeShoppingListDocWithGenerated,
    resolveShoppingListDocConflict,
    formatShoppingListPlainText,
    formatShoppingListHtml,
    buildShoppingListExportPayload,
    getShoppingListChecklistDisplayRows,
    getShoppingListHomeLocationIdForRow,
    filterShoppingListChecklistRowsForCollapse,
    normalizeShoppingHomeLocationId,
    getShoppingListSourceBaseKey,
    shoppingListCompletedCollapseKey,
    shoppingListStoreCollapseKey,
    shoppingListAisleCollapseKey,
    shoppingListHomeCollapseKey,
    shoppingListPseudoUnlistedCollapseKey,
  };
}
// --- End shopping list checklist helpers ---

async function loadShoppingListPage() {
  try {
    window.location.replace('recipes.html');
  } catch (_) {
    window.location.href = 'recipes.html';
  }
}

// --- Shared helper for child editor pages (shopping, units, stores, …) ---
function wireChildEditorPage({
  backBtn,
  cancelBtn,
  saveBtn,
  appBarTitleEl,
  bodyTitleEl,
  initialTitle,
  backHref,
  onSave,
  extraFields,
  normalizeTitle: normalizeTitleFn,
  displayTitle: displayTitleFn,
  subtitleEl,
  initialSubtitle,
  normalizeSubtitle: normalizeSubtitleFn,
  subtitlePlaceholder: subtitlePlaceholderText,
  subtitleEmptyMeansHidden = false,
  subtitleRevealBtn = null,
  hideSubtitleWhenMatchesTitle = false,
  extraDirtyState = null,
}) {
  if (!appBarTitleEl || !bodyTitleEl) return;

  const subtitlePlaceholder = subtitlePlaceholderText || 'Abbreviation';
  const normalize = (value) => (value || '').trim();
  const normalizeTitle = normalizeTitleFn || normalize;
  const displayTitle = displayTitleFn || ((v) => v ?? '');
  const maybeAutoGrow = (el) => {
    try {
      if (el && typeof el.__feAutoGrowResize === 'function') {
        el.__feAutoGrowResize();
      }
    } catch (_) {}
  };
  let baselineTitle = normalizeTitle(initialTitle);
  const extras = Array.isArray(extraFields) ? extraFields : [];
  let baselineExtras = {};
  extras.forEach((f) => {
    if (!f || !f.key) return;
    baselineExtras[String(f.key)] = normalize(f.initialValue);
  });

  const hasSubtitle = !!subtitleEl && normalizeSubtitleFn;
  let baselineSubtitle = hasSubtitle
    ? initialSubtitle
      ? normalizeSubtitleFn(initialSubtitle)
      : ''
    : '';

  /** Store editor: no saved location — subtitle row only while title/subtitle editing or after user enters a location. */
  const emptySubtitleFlow = () =>
    !!(
      subtitleEmptyMeansHidden &&
      hasSubtitle &&
      !(baselineSubtitle || '').trim()
    );

  let titleSessionActive = false;
  let subtitleSessionActive = false;
  /** True between pointerdown on subtitle and subtitle click (title blurs first). */
  let subtitlePointerKeepAlive = false;
  /** Shown after subtitle blur; survives sync until Save/Cancel (fixes draft wipe when baseline non-empty). */
  let lastCommittedSubtitle = hasSubtitle ? baselineSubtitle || '' : '';

  bodyTitleEl.textContent = displayTitle(baselineTitle) || '';
  appBarTitleEl.textContent = displayTitle(baselineTitle) || '';

  const setSubtitlePlaceholderClass = (showPlaceholder) => {
    try {
      if (showPlaceholder) subtitleEl.classList.add('placeholder-prompt');
      else subtitleEl.classList.remove('placeholder-prompt');
    } catch (_) {}
  };

  const syncSubtitleDomFromBaseline = () => {
    if (!hasSubtitle) return;
    const subtitleRaw = (lastCommittedSubtitle || '').trim()
      ? lastCommittedSubtitle
      : '';
    const titleForSubtitleCompare = normalizeTitle(
      bodyTitleEl.textContent || '',
    );
    const subtitleMatchesTitle =
      hideSubtitleWhenMatchesTitle &&
      !!subtitleRaw &&
      normalizeSubtitleFn(subtitleRaw) === titleForSubtitleCompare;
    const subDisplay = subtitleRaw
      ? subtitleMatchesTitle
        ? ''
        : subtitleRaw
      : subtitlePlaceholder;
    if (!subtitleEmptyMeansHidden) {
      subtitleEl.style.display = '';
      subtitleEl.textContent = subDisplay;
      setSubtitlePlaceholderClass(subDisplay === subtitlePlaceholder);
      if (subtitleRevealBtn) subtitleRevealBtn.style.display = 'none';
      try {
        subtitleEl.removeAttribute('aria-hidden');
      } catch (_) {}
      return;
    }
    if (!emptySubtitleFlow()) {
      subtitleEl.style.display = '';
      subtitleEl.textContent = subDisplay;
      setSubtitlePlaceholderClass(subDisplay === subtitlePlaceholder);
      if (subtitleRevealBtn) subtitleRevealBtn.style.display = 'none';
      try {
        subtitleEl.removeAttribute('aria-hidden');
      } catch (_) {}
      return;
    }
    const hasPending = (lastCommittedSubtitle || '').trim().length > 0;
    const showRow =
      titleSessionActive ||
      subtitleSessionActive ||
      hasPending ||
      subtitlePointerKeepAlive;
    if (!showRow) {
      subtitleEl.textContent = '';
      setSubtitlePlaceholderClass(false);
      subtitleEl.style.display = 'none';
      subtitleEl.setAttribute('aria-hidden', 'true');
      if (subtitleRevealBtn) subtitleRevealBtn.style.display = '';
      return;
    }
    subtitleEl.style.display = '';
    subtitleEl.removeAttribute('aria-hidden');
    if (subtitleRevealBtn) subtitleRevealBtn.style.display = 'none';
    if (subtitleSessionActive) return;
    const showingPlaceholder = !hasPending;
    subtitleEl.textContent = showingPlaceholder
      ? subtitlePlaceholder
      : lastCommittedSubtitle;
    setSubtitlePlaceholderClass(showingPlaceholder);
  };

  if (hasSubtitle) syncSubtitleDomFromBaseline();

  if (subtitleRevealBtn && subtitleEmptyMeansHidden && hasSubtitle) {
    subtitleRevealBtn.addEventListener('click', () => {
      subtitleRevealBtn.style.display = 'none';
      subtitleEl.style.display = '';
      subtitleEl.textContent = subtitlePlaceholder;
      setSubtitlePlaceholderClass(true);
      try {
        subtitleEl.click();
      } catch (_) {}
    });
  }

  if (hasSubtitle && subtitleEmptyMeansHidden) {
    subtitleEl.addEventListener(
      'pointerdown',
      () => {
        if (emptySubtitleFlow()) subtitlePointerKeepAlive = true;
      },
      true,
    );
  }

  let isDirty = false;

  const pageDirty = () =>
    isDirty ||
    (typeof extraDirtyState?.isDirty === 'function' &&
      extraDirtyState.isDirty());

  const updateButtons = () => {
    const d = pageDirty();
    if (cancelBtn) cancelBtn.disabled = !d;
    if (saveBtn) saveBtn.disabled = !d;
  };

  updateButtons(); // page starts clean

  const markDirty = () => {
    if (!isDirty) {
      isDirty = true;
      updateButtons();
    }
  };

  // Extra fields: set baseline values and wire dirty tracking
  extras.forEach((f) => {
    if (!f) return;
    const key = String(f.key || '');
    if (!key) return;

    const els = Array.isArray(f.els) ? f.els.filter(Boolean) : [];
    const primaryEl = f.el || els[0] || null;
    if (!primaryEl) return;

    try {
      const v = baselineExtras[key] ?? '';
      if (typeof f.setValue === 'function') {
        f.setValue(v);
      } else if ('value' in primaryEl) {
        primaryEl.value = v;
      } else if ('textContent' in primaryEl) {
        primaryEl.textContent = v;
      }
    } catch (_) {}
    // If this field supports auto-grow, ensure it sizes correctly even when value
    // is set programmatically (baseline load).
    try {
      maybeAutoGrow(primaryEl);
      els.forEach((el) => maybeAutoGrow(el));
    } catch (_) {}

    try {
      const targets = els.length > 0 ? els : [primaryEl];
      targets.forEach((el) => {
        try {
          el.addEventListener('input', markDirty);
          el.addEventListener('change', markDirty);
        } catch (_) {}
      });
    } catch (_) {}
  });

  // Title is editable in the page body only (app-bar title is display-only).
  bodyTitleEl.addEventListener('click', () => {
    if (bodyTitleEl.isContentEditable) return;

    const starting = bodyTitleEl.textContent || '';
    const startingStored = normalizeTitle(starting);

    titleSessionActive = true;
    if (emptySubtitleFlow()) syncSubtitleDomFromBaseline();

    bodyTitleEl.contentEditable = 'true';
    bodyTitleEl.classList.add('editing-title');
    bodyTitleEl.focus();

    const onInput = () => {
      markDirty();
    };

    const cleanup = () => {
      bodyTitleEl.contentEditable = 'false';
      bodyTitleEl.classList.remove('editing-title');
      bodyTitleEl.removeEventListener('blur', onBlur);
      bodyTitleEl.removeEventListener('keydown', onKeyDown);
      bodyTitleEl.removeEventListener('input', onInput);
      titleSessionActive = false;
      // While the store has no saved subtitle, don't immediately sync/hide on
      // title blur. Subtitle clicking causes the title to blur first, and we
      // need the subtitle click handler to still run reliably.
      if (!emptySubtitleFlow()) syncSubtitleDomFromBaseline();
      requestAnimationFrame(() => {
        // Do not clear `subtitlePointerKeepAlive` here.
        // Title blur happens before subtitle click; clearing early can hide
        // the subtitle before its click handler runs.
        syncSubtitleDomFromBaseline();
      });
    };

    const commit = () => {
      const next = normalizeTitle(bodyTitleEl.textContent);
      const changed = next !== startingStored;
      bodyTitleEl.textContent = displayTitle(next);
      appBarTitleEl.textContent = displayTitle(next);
      if (changed) markDirty();
    };

    const cancelEdit = () => {
      bodyTitleEl.textContent = starting;
      appBarTitleEl.textContent = starting;
    };

    const onBlur = () => {
      commit();
      cleanup();
    };

    const onKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
        cleanup();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
        cleanup();
      }
    };

    bodyTitleEl.addEventListener('input', onInput);
    bodyTitleEl.addEventListener('blur', onBlur);
    bodyTitleEl.addEventListener('keydown', onKeyDown);
  });

  if (hasSubtitle) {
    subtitleEl.addEventListener('click', () => {
      if (subtitleEl.isContentEditable) return;
      subtitlePointerKeepAlive = false;
      const starting = (lastCommittedSubtitle || '').trim()
        ? lastCommittedSubtitle
        : subtitleEl.textContent || '';
      const isPlaceholder =
        starting.trim().toLowerCase() ===
        subtitlePlaceholder.trim().toLowerCase();
      const restoreOnCancelEmptyFlow = emptySubtitleFlow()
        ? (lastCommittedSubtitle || '').trim() ||
          (isPlaceholder ? '' : starting)
        : null;
      subtitleSessionActive = true;
      // Keep the hint text visible until the first real character is typed.
      subtitleEl.textContent = isPlaceholder ? subtitlePlaceholder : starting;
      subtitleEl.contentEditable = 'true';
      subtitleEl.classList.remove('placeholder-prompt');
      subtitleEl.classList.add('editing-title');
      subtitleEl.focus();
      // Put caret at the start so typing replaces the hint immediately.
      try {
        const sel = window.getSelection && window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(subtitleEl);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch (_) {}

      const onInput = () => markDirty();
      const cleanup = () => {
        subtitleEl.contentEditable = 'false';
        subtitleEl.classList.remove('editing-title');
        subtitleEl.removeEventListener('blur', onBlur);
        subtitleEl.removeEventListener('keydown', onKeyDown);
        subtitleEl.removeEventListener('input', onInput);
        subtitleSessionActive = false;
        syncSubtitleDomFromBaseline();
      };
      const commit = () => {
        const raw = subtitleEl.textContent || '';
        let next = normalizeSubtitleFn(raw);
        const ph = subtitlePlaceholder.toLowerCase();
        if (isPlaceholder && next.toLowerCase() === ph) next = '';
        lastCommittedSubtitle = next;
        if (next !== (baselineSubtitle || '')) markDirty();
      };
      const cancelEdit = () => {
        if (emptySubtitleFlow() && restoreOnCancelEmptyFlow !== null) {
          subtitleEl.textContent = restoreOnCancelEmptyFlow;
        } else {
          subtitleEl.textContent = baselineSubtitle || subtitlePlaceholder;
        }
      };
      const onBlur = () => {
        commit();
        cleanup();
      };
      const onKeyDown = (e) => {
        // Placeholder behavior: keep visible on focus, but remove on first
        // typed character so the hint doesn't get partially overwritten.
        try {
          const phNorm = subtitlePlaceholder.trim().toLowerCase();
          const curNorm = (subtitleEl.textContent || '').trim().toLowerCase();
          const isPrintable =
            e.key &&
            String(e.key).length === 1 &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey;

          if (curNorm === phNorm && isPrintable) {
            subtitleEl.textContent = '';
            const sel = window.getSelection && window.getSelection();
            if (sel) {
              const range = document.createRange();
              range.selectNodeContents(subtitleEl);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        } catch (_) {}

        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
          cleanup();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelEdit();
          cleanup();
        }
      };
      subtitleEl.addEventListener('blur', onBlur);
      subtitleEl.addEventListener('input', onInput);
      subtitleEl.addEventListener('keydown', onKeyDown);
    });
  }

  const saveChildEditor = async () => {
    if (!pageDirty()) return true;

    const nextTitle = normalizeTitle(bodyTitleEl.textContent);
    bodyTitleEl.textContent = displayTitle(nextTitle) || '';
    appBarTitleEl.textContent = displayTitle(nextTitle) || '';

    let nextSubtitle = '';
    if (hasSubtitle) {
      let raw = lastCommittedSubtitle;
      try {
        if (subtitleEl?.isContentEditable) {
          const t = subtitleEl.textContent || '';
          const ph = subtitlePlaceholder.trim().toLowerCase();
          raw = t.trim().toLowerCase() === ph ? '' : normalizeSubtitleFn(t);
        } else {
          raw = normalizeSubtitleFn(lastCommittedSubtitle || '');
        }
      } catch (_) {
        raw = normalizeSubtitleFn(lastCommittedSubtitle || '');
      }
      nextSubtitle = normalizeSubtitleFn(raw || '');
    }

    const extraValues = {};
    extras.forEach((f) => {
      if (!f || !f.key) return;
      const key = String(f.key);
      let raw = '';
      try {
        if (typeof f.getValue === 'function') {
          raw = f.getValue();
        } else {
          const els = Array.isArray(f.els) ? f.els.filter(Boolean) : [];
          const primaryEl = f.el || els[0] || null;
          if (!primaryEl) return;
          if ('value' in primaryEl) raw = primaryEl.value;
          else if ('textContent' in primaryEl) raw = primaryEl.textContent;
        }
      } catch (_) {
        raw = '';
      }
      extraValues[key] = normalize(raw);
    });

    try {
      if (typeof onSave === 'function') {
        await onSave({
          title: nextTitle,
          subtitle: hasSubtitle ? nextSubtitle : undefined,
          baselineTitle,
          extraValues,
        });
      }
    } catch (err) {
      if (err && err.silent) return false;
      console.error('❌ Failed to save child editor:', err);
      uiToast('Failed to save changes. See console for details.');
      return false;
    }

    isDirty = false;
    try {
      extraDirtyState?.onAfterSaveSuccess?.();
    } catch (err2) {
      console.warn('extraDirtyState.onAfterSaveSuccess', err2);
    }
    updateButtons();
    baselineTitle = nextTitle;
    if (hasSubtitle) {
      baselineSubtitle = nextSubtitle;
      lastCommittedSubtitle = nextSubtitle;
    }
    baselineExtras = { ...baselineExtras, ...extraValues };
    if (hasSubtitle) syncSubtitleDomFromBaseline();
    return true;
  };

  const doBack = async () => {
    if (!pageDirty()) {
      window.location.href = backHref;
      return;
    }

    if (window.ui && typeof window.ui.dialogThreeChoice === 'function') {
      const choice = await window.ui.dialogThreeChoice({
        title: 'Unsaved changes',
        message: 'Save changes before exiting?',
        fixText: 'Cancel',
        discardText: 'Discard',
        createText: 'Save',
        discardDanger: true,
        dismissChoice: 'fix',
      });
      if (choice === 'fix') return;
      if (choice === 'create') {
        const ok = await saveChildEditor();
        if (!ok || pageDirty()) return;
      } else if (choice !== 'discard') {
        return;
      }
      window.location.href = backHref;
      return;
    }

    if (
      await uiConfirm({
        title: 'Discard Changes?',
        message: 'Discard unsaved changes?',
        confirmText: 'Discard',
        cancelText: 'Cancel',
        danger: true,
      })
    ) {
      window.location.href = backHref;
    }
  };

  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      void doBack();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!pageDirty()) return;
      bodyTitleEl.textContent = displayTitle(baselineTitle) || '';
      appBarTitleEl.textContent = displayTitle(baselineTitle) || '';
      if (hasSubtitle) {
        lastCommittedSubtitle = baselineSubtitle || '';
        syncSubtitleDomFromBaseline();
      }
      try {
        extraDirtyState?.onCancel?.();
      } catch (err) {
        console.warn('extraDirtyState.onCancel', err);
      }
      extras.forEach((f) => {
        if (!f) return;
        const key = String(f.key || '');
        if (!key) return;
        const v = baselineExtras[key] ?? '';
        try {
          if (typeof f.setValue === 'function') {
            f.setValue(v);
          } else {
            const els = Array.isArray(f.els) ? f.els.filter(Boolean) : [];
            const primaryEl = f.el || els[0] || null;
            if (!primaryEl) return;
            if ('value' in primaryEl) primaryEl.value = v;
            else if ('textContent' in primaryEl) primaryEl.textContent = v;
          }
        } catch (_) {}
        // Re-measure any auto-grow fields after restoring values.
        try {
          const els = Array.isArray(f.els) ? f.els.filter(Boolean) : [];
          const primaryEl = f.el || els[0] || null;
          maybeAutoGrow(primaryEl);
          els.forEach((el) => maybeAutoGrow(el));
        } catch (_) {}
      });
      isDirty = false;
      updateButtons();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await saveChildEditor();
    });
  }

  return { refreshDirty: updateButtons };
}

function loadShoppingItemEditorPage() {
  try {
    window.location.replace('recipes.html');
  } catch (_) {
    window.location.href = 'recipes.html';
  }
}

function loadUnitEditorPage() {
  try {
    window.location.replace('recipes.html');
  } catch (_) {
    window.location.href = 'recipes.html';
  }
}

async function loadUnitsPage() {
  try {
    window.location.replace('recipes.html');
  } catch (_) {
    window.location.href = 'recipes.html';
  }
}

async function loadTagsPage() {
  try {
    window.location.replace('recipes.html');
  } catch (_) {
    window.location.href = 'recipes.html';
  }
}

function navigateShoppingListToIngredient({ id, name }) {
  const keys = window.favoriteEatsSessionKeys || {};
  const ingId = Number(id);
  const n = String(name || '').trim();
  try {
    if (Number.isFinite(ingId) && ingId > 0) {
      sessionStorage.setItem(
        keys.shoppingNavTargetId,
        String(Math.trunc(ingId)),
      );
      sessionStorage.setItem(keys.shoppingNavTargetName, n);
    } else if (n) {
      sessionStorage.removeItem(keys.shoppingNavTargetId);
      sessionStorage.setItem(keys.shoppingNavTargetName, n);
    } else {
      sessionStorage.removeItem(keys.shoppingNavTargetId);
      sessionStorage.removeItem(keys.shoppingNavTargetName);
    }
  } catch (_) {}
  window.location.href = 'recipes.html';
}

function loadTagEditorPage() {
  try {
    window.location.replace('recipes.html');
  } catch (_) {
    window.location.href = 'recipes.html';
  }
}

async function loadSizesPage() {
  try {
    window.location.replace('recipes.html');
  } catch (_) {
    window.location.href = 'recipes.html';
  }
}

function loadSizeEditorPage() {
  try {
    window.location.replace('recipes.html');
  } catch (_) {
    window.location.href = 'recipes.html';
  }
}

/** Recipes that reference a specific ingredient + variant (rim + substitutes). */
function getRecipesForIngredientVariant(db, ingredientId, variantName) {
  const iid = Number(ingredientId);
  const v = String(variantName || '').trim();
  if (!db || !Number.isFinite(iid) || iid <= 0 || !v) return [];
  try {
    const q = db.exec(
      `
      SELECT DISTINCT r.ID AS recipe_id, COALESCE(r.title, '') AS recipe_title
      FROM recipes r
      JOIN (
        SELECT rim.recipe_id AS rid
        FROM recipe_ingredient_map rim
        WHERE rim.ingredient_id = ?
          AND lower(trim(COALESCE(rim.variant, ''))) = lower(trim(?))
        UNION
        SELECT rim.recipe_id AS rid
        FROM recipe_ingredient_substitutes ris
        JOIN recipe_ingredient_map rim ON rim.ID = ris.recipe_ingredient_id
        WHERE ris.ingredient_id = ?
          AND lower(trim(COALESCE(ris.variant, ''))) = lower(trim(?))
      ) refs ON refs.rid = r.ID
      ORDER BY r.title COLLATE NOCASE;
      `,
      [iid, v, iid, v],
    );
    if (!q.length || !q[0].values.length) return [];
    return q[0].values
      .map(([recipeId, recipeTitle]) => ({
        id: Number(recipeId),
        title: String(recipeTitle || '').trim(),
      }))
      .filter((row) => Number.isFinite(row.id) && row.id > 0);
  } catch (err) {
    console.warn('getRecipesForIngredientVariant failed:', err);
    return [];
  }
}

function countRecipeRefsForIngredientVariant(db, ingredientId, variantName) {
  return getRecipesForIngredientVariant(db, ingredientId, variantName).length;
}

/**
 * Store aisles that reference a named variant (variant–aisle links only).
 * @returns {{ storeId: number, chainName: string, locationName: string, aisleId: number, aisleName: string }[]}
 */
function getAislePlacementsForIngredientVariant(db, ingredientId, variantName) {
  const iid = Number(ingredientId);
  const v = String(variantName || '').trim();
  if (!db || !Number.isFinite(iid) || iid <= 0 || !v) return [];
  try {
    const q = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='ingredient_variant_store_location';`,
    );
    if (!q.length || !q[0].values || !q[0].values.length) return [];
    const rowsQ = db.exec(
      `
      SELECT DISTINCT
        s.ID AS store_id,
        COALESCE(s.chain_name, '') AS chain_name,
        COALESCE(s.location_name, '') AS location_name,
        sl.ID AS aisle_id,
        COALESCE(sl.name, '') AS aisle_name
      FROM ingredient_variant_store_location ivsl
      JOIN ingredient_variants iv ON iv.id = ivsl.ingredient_variant_id
      JOIN store_locations sl ON sl.ID = ivsl.store_location_id
      JOIN stores s ON s.ID = sl.store_id
      WHERE iv.ingredient_id = ?
        AND lower(trim(iv.variant)) = lower(trim(?))
      ORDER BY COALESCE(s.chain_name, '') COLLATE NOCASE,
               COALESCE(s.location_name, '') COLLATE NOCASE,
               COALESCE(sl.sort_order, 999999),
               sl.ID;
      `,
      [iid, v],
    );
    if (!rowsQ.length || !rowsQ[0].values.length) return [];
    return rowsQ[0].values
      .map((row) => {
        if (!Array.isArray(row) || row.length < 5) return null;
        const storeId = Number(row[0]);
        const aisleId = Number(row[3]);
        if (!Number.isFinite(storeId) || storeId <= 0) return null;
        if (!Number.isFinite(aisleId) || aisleId <= 0) return null;
        return {
          storeId,
          chainName: String(row[1] || '').trim(),
          locationName: String(row[2] || '').trim(),
          aisleId,
          aisleName: String(row[4] || '').trim(),
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.warn('getAislePlacementsForIngredientVariant failed:', err);
    return [];
  }
}

/**
 * Recipes + aisles link ledger for variant usage dialogs (remove / delete blocked).
 * @param {{ id: number, title: string }[]} recipes
 * @param {{ storeId: number, chainName: string, locationName: string, aisleId: number, aisleName: string }[]} aislePlacements
 * @returns {HTMLDivElement}
 */
function createVariantUsageLedgerNode(recipes, aislePlacements) {
  const details = document.createElement('div');
  details.className = 'shopping-remove-dialog-details';
  const refCount = Array.isArray(recipes) ? recipes.length : 0;
  const aisleCount = Array.isArray(aislePlacements) ? aislePlacements.length : 0;
  if (refCount > 0) {
    const recipesHeading = document.createElement('div');
    recipesHeading.className = 'shopping-remove-dialog-section-heading';
    recipesHeading.textContent = 'Recipes';
    details.appendChild(recipesHeading);
    const linksWrap = document.createElement('div');
    linksWrap.className = 'shopping-remove-dialog-links';
    recipes.forEach((recipe) => {
      const a = document.createElement('a');
      a.href = '#';
      a.className = 'shopping-remove-dialog-link';
      a.textContent = recipe.title || `Recipe ${recipe.id}`;
      a.addEventListener('click', (event) => {
        event.preventDefault();
        if (typeof window.openRecipe === 'function') {
          window.openRecipe(recipe.id);
        }
      });
      linksWrap.appendChild(a);
    });
    details.appendChild(linksWrap);
  }
  if (aisleCount > 0) {
    const aislesHeading = document.createElement('div');
    aislesHeading.className = 'shopping-remove-dialog-section-heading';
    aislesHeading.textContent = 'Aisles';
    details.appendChild(aislesHeading);
    const aisleLinksWrap = document.createElement('div');
    aisleLinksWrap.className = 'shopping-remove-dialog-links';
    aislePlacements.forEach((placement) => {
      const a = document.createElement('a');
      a.href = '#';
      a.className = 'shopping-remove-dialog-link';
      const aisleLabel =
        String(placement.aisleName || '').trim() ||
        `Aisle ${placement.aisleId}`;
      const storeBits = [
        String(placement.chainName || '').trim(),
        String(placement.locationName || '').trim(),
      ].filter(Boolean);
      const storeLabel = storeBits.length ? storeBits.join(', ') : 'Store';
      a.textContent = `${aisleLabel} (${storeLabel})`;
      a.addEventListener('click', (event) => {
        event.preventDefault();
        if (typeof window.openStoreAisle === 'function') {
          window.openStoreAisle(
            placement.storeId,
            placement.aisleId,
            placement.chainName,
            placement.locationName,
          );
        }
      });
      aisleLinksWrap.appendChild(a);
    });
    details.appendChild(aisleLinksWrap);
  }
  return details;
}

/** Plain-text fallback for variant usage ledger (native alert / no rich UI). */
function formatVariantUsageLedgerPlainText(recipes, aislePlacements) {
  const refCount = Array.isArray(recipes) ? recipes.length : 0;
  const aisleCount = Array.isArray(aislePlacements) ? aislePlacements.length : 0;
  const recipeLines =
    refCount > 0
      ? `\n\nRecipes\n${recipes.map((r) => `• ${r.title || `Recipe ${r.id}`}`).join('\n')}`
      : '';
  const aisleLines =
    aisleCount > 0
      ? `\n\nAisles\n${aislePlacements
          .map((p) => {
            const aisleLabel =
              String(p.aisleName || '').trim() || `Aisle ${p.aisleId}`;
            const storeBits = [
              String(p.chainName || '').trim(),
              String(p.locationName || '').trim(),
            ].filter(Boolean);
            const storeLabel = storeBits.length ? storeBits.join(', ') : 'Store';
            return `• ${aisleLabel} (${storeLabel})`;
          })
          .join('\n')}`
      : '';
  return `${recipeLines}${aisleLines}`;
}

async function loadStoresPage() {
  try {
    window.location.replace('recipes.html');
  } catch (_) {
    window.location.href = 'recipes.html';
  }
}

function loadStoreEditorPage() {
  try {
    window.location.replace('recipes.html');
  } catch (_) {
    window.location.href = 'recipes.html';
  }
}

// Shared helper for *all* editor pages (shopping, units, stores, future)

// Usage inside any load*EditorPage():
//   const editor = initEditorPage({ saveBtn, cancelBtn, root: view });
//   editor.markDirty();  // optional manual trigger
// ---------------------------------------------------------------------------
function initEditorPage({ saveBtn, cancelBtn, root }) {
  // Each editor gets its own dirty flag; starts clean.
  let isDirty = false;

  // Disable buttons until the user edits.
  if (cancelBtn) cancelBtn.disabled = true;
  if (saveBtn) saveBtn.disabled = true;

  const enableButtons = () => {
    if (cancelBtn) cancelBtn.disabled = false;
    if (saveBtn) saveBtn.disabled = false;
  };

  const markDirty = () => {
    if (isDirty) return;
    isDirty = true;
    enableButtons();
  };

  // Common-sense rule: anything the user can change marks the page dirty.
  const wireDirtyTracking = (node) => {
    if (!node) return;
    const editables = node.querySelectorAll(
      'input, textarea, select, [contenteditable="true"]',
    );
    editables.forEach((el) => {
      el.addEventListener('input', markDirty);
      el.addEventListener('change', markDirty);
    });
  };

  wireDirtyTracking(root);

  // Expose a tiny API for pages that need manual control later.
  return {
    markDirty,
    resetDirty() {
      isDirty = false;
      if (cancelBtn) cancelBtn.disabled = true;
      if (saveBtn) saveBtn.disabled = true;
    },
    get isDirty() {
      return isDirty;
    },
  };
}

const BOTTOM_NAV_TAB_LABELS = Object.freeze({
  recipes: 'Recipes',
  shopping: 'Items',
  'shopping-list': 'List',
  stores: 'Stores',
  tags: 'Tags',
  sizes: 'Sizes',
  units: 'Units',
});

function syncBottomNavPills(pillRow) {
  if (!(pillRow instanceof HTMLElement)) return;
  const order = getTopLevelPageOrder();
  const existing = new Map();
  Array.from(pillRow.querySelectorAll('.bottom-nav-pill')).forEach((p) => {
    const tab = String(p.dataset.tab || '').trim();
    if (tab) existing.set(tab, p);
  });
  const frag = document.createDocumentFragment();
  for (const tab of order) {
    let pill = existing.get(tab);
    if (!pill) {
      pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'bottom-nav-pill';
      pill.dataset.tab = tab;
    }
    const label = BOTTOM_NAV_TAB_LABELS[tab];
    if (label) pill.textContent = label;
    frag.appendChild(pill);
  }
  while (pillRow.firstChild) pillRow.removeChild(pillRow.firstChild);
  pillRow.appendChild(frag);
}

function applyBottomNavActiveState(pillRow, activeTab) {
  if (!(pillRow instanceof HTMLElement)) return;
  pillRow.querySelectorAll('.bottom-nav-pill').forEach((pill) => {
    const tab = pill.dataset.tab;
    const isActive = tab === activeTab;
    pill.classList.toggle('bottom-nav-pill--active', isActive);
    pill.disabled = !!isActive;
  });
}

function getListPageBottomNavActiveTab() {
  const body = document.body;
  if (!body) return null;
  if (body.classList.contains('recipes-page')) return 'recipes';
  if (body.classList.contains('shopping-page')) return 'shopping';
  if (body.classList.contains('shopping-list-page')) return 'shopping-list';
  if (body.classList.contains('units-page')) return 'units';
  if (body.classList.contains('sizes-page')) return 'sizes';
  if (body.classList.contains('stores-page')) return 'stores';
  if (body.classList.contains('tags-page')) return 'tags';
  return null;
}

function reconcileAfterForceWebModeToggle() {
  const pillRow = document.querySelector('.bottom-nav-pill-row');
  const activeTab = getListPageBottomNavActiveTab();
  if (pillRow instanceof HTMLElement) {
    syncBottomNavPills(pillRow);
    if (activeTab) applyBottomNavActiveState(pillRow, activeTab);
  }
  const nextPages = getTopLevelPageOrder();
  const currentPage = String(activeTab || detectPageIdFromBody() || '')
    .trim()
    .toLowerCase();
  if (!nextPages.includes(currentPage)) {
    const targetPage = nextPages.includes('recipes')
      ? 'recipes'
      : nextPages[0] || 'recipes';
    window.location.href = getTopLevelPageHref(targetPage);
  }
}

function syncBottomNavEditorToggleCheckedState() {
  const bottomNavEditorToggle = document.getElementById('bottomNavEditorToggle');
  if (bottomNavEditorToggle instanceof HTMLInputElement) {
    bottomNavEditorToggle.checked = !isForceWebModeEnabled();
  }
}

// --- Bottom navigation wiring (list pages only) ---
function initBottomNav() {
  const nav = document.querySelector('.bottom-nav');
  if (!nav) return;

  // Hidden-by-default sheet model: rely on CSS class.
  nav.classList.add('bottom-nav--hidden');

  const pillRow = nav.querySelector('.bottom-nav-pill-row');
  if (pillRow instanceof HTMLElement) {
    syncBottomNavPills(pillRow);
  }

  if (false && pillRow instanceof HTMLElement && !nav.querySelector('.bottom-nav-editor-section')) {
    const editorSection = document.createElement('div');
    editorSection.className = 'bottom-nav-editor-section';
    const editorLabel = document.createElement('label');
    editorLabel.className = 'bottom-nav-editor-toggle';
    const editorTitle = document.createElement('span');
    editorTitle.textContent = 'Editing';
    const switchTrack = document.createElement('span');
    switchTrack.className = 'bottom-nav-editor-switch-track';
    const editorToggle = document.createElement('input');
    editorToggle.type = 'checkbox';
    editorToggle.id = 'bottomNavEditorToggle';
    editorToggle.className = 'bottom-nav-editor-switch-input';
    editorToggle.setAttribute('aria-label', 'Editing');
    const switchKnob = document.createElement('span');
    switchKnob.className = 'bottom-nav-editor-switch-knob';
    switchTrack.appendChild(editorToggle);
    switchTrack.appendChild(switchKnob);
    editorLabel.appendChild(editorTitle);
    editorLabel.appendChild(switchTrack);
    const editorSeparator = document.createElement('div');
    editorSeparator.className = 'bottom-nav-editor-separator';
    editorSeparator.setAttribute('role', 'presentation');
    editorSection.appendChild(editorLabel);
    editorSection.appendChild(editorSeparator);
    nav.insertBefore(editorSection, pillRow);
  }

  const pills = Array.from(nav.querySelectorAll('.bottom-nav-pill'));
  if (!pills.length) return;

  const body = document.body;
  let activeTab = null;

  if (body.classList.contains('recipes-page')) {
    activeTab = 'recipes';
  } else if (body.classList.contains('shopping-page')) {
    activeTab = 'shopping';
  } else if (body.classList.contains('shopping-list-page')) {
    activeTab = 'shopping-list';
  } else if (body.classList.contains('units-page')) {
    activeTab = 'units';
  } else if (body.classList.contains('sizes-page')) {
    activeTab = 'sizes';
  } else if (body.classList.contains('stores-page')) {
    activeTab = 'stores';
  } else if (body.classList.contains('tags-page')) {
    activeTab = 'tags';
  }

  const bottomNavEditorToggle = document.getElementById('bottomNavEditorToggle');
  if (bottomNavEditorToggle && pillRow instanceof HTMLElement) {
    bottomNavEditorToggle.checked = !isForceWebModeEnabled();
    bottomNavEditorToggle.addEventListener('change', () => {
      // Planner/force-web is disabled; control retained for a future real toggle.
      console.log('[Editing nav toggle]', {
        checked: bottomNavEditorToggle.checked,
        forceWebModeEnabled: isForceWebModeEnabled(),
      });
    });
  }

  // Shared toggle handler for menu icon + app-bar title.

  const menuButton = document.getElementById('appBarMenuBtn');
  const titleToggle = document.getElementById('appBarTitle');

  const isNavOpen = () => !nav.classList.contains('bottom-nav--hidden');

  const closeNav = () => {
    nav.classList.add('bottom-nav--hidden');
  };

  const openNav = () => {
    nav.classList.remove('bottom-nav--hidden');
  };

  const toggleNavVisibility = () => {
    if (!isNavOpen()) {
      openNav();
      return;
    }
    closeNav();
  };

  // Menu icon toggles bottom nav visibility on list pages.
  if (menuButton) {
    menuButton.addEventListener('click', () => {
      toggleNavVisibility();
    });
  }

  // App-bar title also acts as a nav toggle.
  if (titleToggle) {
    titleToggle.addEventListener('click', () => {
      toggleNavVisibility();
    });
  }

  // Click-outside / blur-to-dismiss behavior.
  document.addEventListener('click', (event) => {
    if (nav.classList.contains('bottom-nav--hidden')) return;

    const target = event.target;

    // Ignore clicks inside nav or on the toggle controls.
    if (
      nav.contains(target) ||
      (menuButton && (menuButton === target || menuButton.contains(target))) ||
      (titleToggle && (titleToggle === target || titleToggle.contains(target)))
    ) {
      return;
    }

    closeNav();
  });

  if (pillRow instanceof HTMLElement) {
    applyBottomNavActiveState(pillRow, activeTab);
    pillRow.addEventListener('click', (event) => {
      const pill =
        event.target &&
        typeof event.target.closest === 'function' &&
        event.target.closest('.bottom-nav-pill');
      if (!pill || !pillRow.contains(pill)) return;
      const tab = pill.dataset.tab;
      if (!tab || tab === activeTab) return;
      window.location.href = getTopLevelPageHref(tab);
    });
  }
}

function getIngredientTableColumnSet(db) {
  try {
    const q = db.exec('PRAGMA table_info(ingredients);');
    const rows = Array.isArray(q) && q.length > 0 ? q[0].values : [];
    return new Set(
      rows.map((r) =>
        String((Array.isArray(r) ? r[1] : '') || '').toLowerCase(),
      ),
    );
  } catch (_) {
    return new Set();
  }
}

function createIngredientVisibilitySql(colsSet) {
  const hasDeprecated = colsSet.has('is_deprecated');
  const hasHideLegacy = colsSet.has('hide_from_shopping_list');
  const hasHidden = colsSet.has('is_hidden');
  const clauses = [];
  if (hasDeprecated) clauses.push('COALESCE(is_deprecated, 0) = 0');
  if (hasHideLegacy) clauses.push('COALESCE(hide_from_shopping_list, 0) = 0');
  if (hasHidden) clauses.push('COALESCE(is_hidden, 0) = 0');
  return clauses.length ? clauses.join(' AND ') : '1 = 1';
}

function getVisibleIngredientNamePool(db) {
  const colsSet = getIngredientTableColumnSet(db);
  const visibilitySql = createIngredientVisibilitySql(colsSet);
  try {
    const q = db.exec(
      `
      SELECT DISTINCT name
      FROM ingredients
      WHERE name IS NOT NULL
        AND trim(name) != ''
        AND ${visibilitySql}
      ORDER BY name COLLATE NOCASE;
      `,
    );
    if (!Array.isArray(q) || !q.length || !Array.isArray(q[0].values))
      return [];
    return q[0].values
      .map((row) => (Array.isArray(row) ? row[0] : null))
      .map((v) => String(v || '').trim())
      .filter((v) => v.length > 0);
  } catch (_) {
    return [];
  }
}

function createIngredientLookupHelpers(db) {
  const colsSet = getIngredientTableColumnSet(db);
  const visibilitySql = createIngredientVisibilitySql(colsSet);
  const getVisibleCanonicalId = (name) => {
    const stmt = db.prepare(
      `
      SELECT ID
      FROM ingredients
      WHERE lower(trim(name)) = lower(trim(?))
        AND ${visibilitySql}
      ORDER BY
        CASE WHEN TRIM(COALESCE(variant, '')) = '' THEN 0 ELSE 1 END,
        CASE WHEN TRIM(COALESCE(size, '')) = '' THEN 0 ELSE 1 END,
        ID ASC
      LIMIT 1;
      `,
    );
    stmt.bind([name]);
    let id = null;
    if (stmt.step()) id = Number(stmt.get()[0]);
    stmt.free();
    if (Number.isFinite(id)) return id;

    // Fall back to synonym lookup.
    try {
      const synStmt = db.prepare(
        `
        SELECT i.ID
        FROM ingredient_synonyms s
        JOIN ingredients i ON i.ID = s.ingredient_id
        WHERE lower(trim(s.synonym)) = lower(trim(?))
          AND ${visibilitySql}
        ORDER BY
          CASE WHEN TRIM(COALESCE(i.variant, '')) = '' THEN 0 ELSE 1 END,
          CASE WHEN TRIM(COALESCE(i.size, '')) = '' THEN 0 ELSE 1 END,
          i.ID ASC
        LIMIT 1;
        `,
      );
      synStmt.bind([name]);
      let synId = null;
      if (synStmt.step()) synId = Number(synStmt.get()[0]);
      synStmt.free();
      if (Number.isFinite(synId)) return synId;
    } catch (_) {}

    return null;
  };

  const anyIngredientNamed = (name) => {
    const stmt = db.prepare(
      `SELECT 1 FROM ingredients WHERE lower(trim(name)) = lower(trim(?)) LIMIT 1;`,
    );
    stmt.bind([name]);
    const ok = stmt.step();
    stmt.free();
    if (ok) return true;

    // Fall back to synonym lookup.
    try {
      const synStmt = db.prepare(
        `SELECT 1 FROM ingredient_synonyms WHERE lower(trim(synonym)) = lower(trim(?)) LIMIT 1;`,
      );
      synStmt.bind([name]);
      const synOk = synStmt.step();
      synStmt.free();
      if (synOk) return true;
    } catch (_) {}

    return false;
  };

  return { getVisibleCanonicalId, anyIngredientNamed };
}

function normalizeRecipeTagDraftList(rawTags) {
  const source = Array.isArray(rawTags)
    ? rawTags
    : String(rawTags || '')
        .split('\n')
        .map((v) => v.trim());
  const seen = new Set();
  const out = [];
  source
    .map((v) =>
      String(v || '')
        .trim()
        .replace(/\s+/g, ' '),
    )
    .filter(Boolean)
    .forEach((tag) => {
      const clipped = tag.length > 48 ? tag.slice(0, 48).trim() : tag;
      if (!clipped) return;
      const key = clipped.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(clipped);
    });
  return out;
}

function getVisibleTagNamePool(db) {
  try {
    const q = db.exec(`
      SELECT DISTINCT name
      FROM tags
      WHERE name IS NOT NULL
        AND trim(name) != ''
        AND COALESCE(is_hidden, 0) = 0
      ORDER BY name COLLATE NOCASE;
    `);
    if (!Array.isArray(q) || !q.length || !Array.isArray(q[0].values))
      return [];
    return q[0].values
      .map((row) => (Array.isArray(row) ? row[0] : null))
      .map((v) => String(v || '').trim())
      .filter((v) => v.length > 0);
  } catch (_) {
    return [];
  }
}

function getVisibleIngredientTagNamePool(db) {
  if (!db) return [];
  ensureRecipeTagsSchemaInMain(db);
  ensureIngredientVariantTagsSchemaInMain(db);
  try {
    const q = db.exec(`
      SELECT DISTINCT t.name
      FROM tags t
      WHERE t.name IS NOT NULL
        AND trim(t.name) != ''
        AND COALESCE(t.is_hidden, 0) = 0
        AND (
          COALESCE(NULLIF(lower(trim(t.intended_use)), ''), 'recipes') = 'ingredients'
          OR EXISTS(
            SELECT 1
            FROM ingredient_variant_tag_map ivtm
            WHERE ivtm.tag_id = t.id
          )
        )
      ORDER BY t.name COLLATE NOCASE;
    `);
    if (!Array.isArray(q) || !q.length || !Array.isArray(q[0].values))
      return [];
    return q[0].values
      .map((row) => (Array.isArray(row) ? row[0] : null))
      .map((v) => String(v || '').trim())
      .filter((v) => v.length > 0);
  } catch (_) {
    return [];
  }
}

function getVisibleVariantTagNamePool(db) {
  return getVisibleIngredientTagNamePool(db);
}

function normalizeRecipeSizeNameList(rawSizes) {
  const source = Array.isArray(rawSizes)
    ? rawSizes
    : String(rawSizes || '')
        .split('\n')
        .map((v) => v.trim());
  const seen = new Set();
  const out = [];
  source
    .map((v) =>
      String(v || '')
        .trim()
        .replace(/\s+/g, ' '),
    )
    .filter(Boolean)
    .forEach((size) => {
      const clipped = size.length > 64 ? size.slice(0, 64).trim() : size;
      if (!clipped) return;
      const key = clipped.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(clipped);
    });
  return out;
}

function getVisibleSizeNamePool(db) {
  if (!db) return [];
  ensureSizesSchemaInMain(db);
  const names = [];
  const seen = new Set();
  const pushMany = (arr) => {
    (Array.isArray(arr) ? arr : []).forEach((raw) => {
      const v = String(raw || '').trim();
      if (!v) return;
      const key = v.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      names.push(v);
    });
  };

  try {
    const q = db.exec(`
      SELECT DISTINCT name
      FROM sizes
      WHERE name IS NOT NULL
        AND trim(name) != ''
        AND COALESCE(is_removed, 0) = 0
      ORDER BY COALESCE(sort_order, 999999) ASC,
               name COLLATE NOCASE;
    `);
    if (Array.isArray(q) && q.length && Array.isArray(q[0].values)) {
      pushMany(q[0].values.map((row) => (Array.isArray(row) ? row[0] : null)));
    }
  } catch (_) {}

  return sortSizeNames(names);
}

function createSizeLookupHelpers(db) {
  const anySelectableSizeNamed = (name) => {
    try {
      const stmt = db.prepare(
        `SELECT 1
         FROM sizes
         WHERE lower(trim(name)) = lower(trim(?))
           AND COALESCE(is_removed, 0) = 0
         LIMIT 1;`,
      );
      stmt.bind([name]);
      const ok = stmt.step();
      stmt.free();
      return ok;
    } catch (_) {
      return false;
    }
  };
  return { anySelectableSizeNamed };
}

function normalizeRecipeUnitCodeList(rawUnits) {
  const source = Array.isArray(rawUnits)
    ? rawUnits
    : String(rawUnits || '')
        .split('\n')
        .map((v) => v.trim());
  const seen = new Set();
  const out = [];
  source
    .map((v) =>
      String(v || '')
        .trim()
        .replace(/\s+/g, ' '),
    )
    .filter(Boolean)
    .forEach((code) => {
      const key = code.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(code);
    });
  return out;
}

function getVisibleUnitCodePool(db) {
  ensureUnitsSchemaInMain(db);
  try {
    const q = db.exec(`
      SELECT DISTINCT code
      FROM units
      WHERE code IS NOT NULL
        AND trim(code) != ''
        AND COALESCE(is_removed, 0) = 0
      ORDER BY COALESCE(sort_order, 999999) ASC,
               code COLLATE NOCASE;
    `);
    if (!Array.isArray(q) || !q.length || !Array.isArray(q[0].values))
      return [];
    return q[0].values
      .map((row) => (Array.isArray(row) ? row[0] : null))
      .map((v) => String(v || '').trim())
      .filter((v) => v.length > 0);
  } catch (_) {
    return [];
  }
}

function createUnitLookupHelpers(db) {
  const anySelectableUnitCoded = (code) => {
    try {
      const stmt = db.prepare(
        `SELECT 1
         FROM units
         WHERE lower(trim(code)) = lower(trim(?))
           AND COALESCE(is_removed, 0) = 0
         LIMIT 1;`,
      );
      stmt.bind([code]);
      const ok = stmt.step();
      stmt.free();
      return ok;
    } catch (_) {
      return false;
    }
  };
  return { anySelectableUnitCoded };
}

function createTagLookupHelpers(db) {
  const anyVisibleTagNamed = (name) => {
    try {
      const stmt = db.prepare(
        `SELECT 1
         FROM tags
         WHERE lower(trim(name)) = lower(trim(?))
           AND COALESCE(is_hidden, 0) = 0
         LIMIT 1;`,
      );
      stmt.bind([name]);
      const ok = stmt.step();
      stmt.free();
      return ok;
    } catch (_) {
      return false;
    }
  };
  return { anyVisibleTagNamed };
}

function createVariantLookupHelpers(db) {
  const colsSet = getIngredientTableColumnSet(db);
  const visibilitySql = createIngredientVisibilitySql(colsSet);
  const hasVariantTable = (() => {
    try {
      const q = db.exec(
        `SELECT 1 FROM sqlite_master WHERE type='table' AND name='ingredient_variants' LIMIT 1;`,
      );
      return !!(
        Array.isArray(q) &&
        q.length &&
        q[0].values &&
        q[0].values.length
      );
    } catch (_) {
      return false;
    }
  })();

  const getIngredientNameById = (ingredientId) => {
    const iid = Number(ingredientId);
    if (!Number.isFinite(iid) || iid <= 0) return '';
    try {
      const stmt = db.prepare(
        `SELECT name
         FROM ingredients
         WHERE ID = ?
           AND ${visibilitySql}
         LIMIT 1;`,
      );
      stmt.bind([iid]);
      let out = '';
      if (stmt.step()) out = String(stmt.get()[0] || '').trim();
      stmt.free();
      return out;
    } catch (_) {
      return '';
    }
  };

  const getVisibleVariantPoolForIngredientId = (ingredientId) => {
    const iid = Number(ingredientId);
    if (!Number.isFinite(iid) || iid <= 0 || !hasVariantTable) return [];
    try {
      const q = db.exec(
        `SELECT iv.variant
         FROM ingredient_variants iv
         JOIN ingredients i ON i.ID = iv.ingredient_id
         WHERE iv.ingredient_id = ?
           AND iv.variant IS NOT NULL
           AND trim(iv.variant) != ''
           AND lower(trim(iv.variant)) != '${INGREDIENT_BASE_VARIANT_NAME}'
           AND ${visibilitySql.replaceAll('COALESCE(', 'COALESCE(i.')}
         ORDER BY COALESCE(iv.sort_order, 999999) ASC, iv.id ASC;`,
        [iid],
      );
      const rows = Array.isArray(q) && q.length ? q[0].values : [];
      const out = [];
      const seen = new Set();
      rows.forEach((row) => {
        const value = String((Array.isArray(row) ? row[0] : '') || '').trim();
        if (!value) return;
        const key = value.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(value);
      });
      return out;
    } catch (_) {
      return [];
    }
  };

  const anyVariantForIngredient = (ingredientId, variantName) => {
    const iid = Number(ingredientId);
    const vv = String(variantName || '').trim();
    if (!Number.isFinite(iid) || iid <= 0 || !vv) return false;
    if (isIngredientBaseVariantName(vv) || isReservedIngredientVariantName(vv))
      return true;
    if (hasVariantTable) {
      try {
        const stmt = db.prepare(
          `SELECT 1
           FROM ingredient_variants iv
           JOIN ingredients i ON i.ID = iv.ingredient_id
           WHERE iv.ingredient_id = ?
             AND lower(trim(iv.variant)) = lower(trim(?))
             AND ${visibilitySql.replaceAll('COALESCE(', 'COALESCE(i.')}
           LIMIT 1;`,
        );
        stmt.bind([iid, vv]);
        const ok = stmt.step();
        stmt.free();
        return ok;
      } catch (_) {}
    }
    try {
      const stmt = db.prepare(
        `SELECT 1
         FROM ingredients
         WHERE ID = ?
           AND lower(trim(COALESCE(variant, ''))) = lower(trim(?))
           AND ${visibilitySql}
         LIMIT 1;`,
      );
      stmt.bind([iid, vv]);
      const ok = stmt.step();
      stmt.free();
      return ok;
    } catch (_) {
      return false;
    }
  };

  const ensureVariantForIngredient = (ingredientId, variantName) => {
    const iid = Number(ingredientId);
    const vv = String(variantName || '').trim();
    if (
      !Number.isFinite(iid) ||
      iid <= 0 ||
      !vv ||
      !hasVariantTable ||
      isIngredientBaseVariantName(vv) ||
      isReservedIngredientVariantName(vv)
    ) {
      return false;
    }
    try {
      if (anyVariantForIngredient(iid, vv)) return false;
      const maxQ = db.exec(
        `SELECT COALESCE(MAX(sort_order), 0) FROM ingredient_variants WHERE ingredient_id = ?;`,
        [iid],
      );
      const nextSort =
        maxQ.length && maxQ[0].values.length
          ? Number(maxQ[0].values[0][0]) + 1
          : 1;
      db.run(
        `INSERT INTO ingredient_variants (ingredient_id, variant, sort_order)
         VALUES (?, ?, ?);`,
        [iid, vv, nextSort],
      );
      return true;
    } catch (_) {
      return false;
    }
  };

  return {
    hasVariantTable,
    getIngredientNameById,
    getVisibleVariantPoolForIngredientId,
    anyVariantForIngredient,
    ensureVariantForIngredient,
  };
}

async function resolveUnknownIngredientNames({
  db,
  names,
  title = '',
  message = '',
}) {
  if (!db) return null;
  const list = Array.isArray(names) ? names : [];
  if (!list.length) return { map: new Map(), finalNames: [] };
  const ui = window.ui;
  if (!ui || typeof ui.unknownItems !== 'function') {
    return null;
  }
  const suggestionPool = getVisibleIngredientNamePool(db);
  const result = await ui.unknownItems({
    title: title || `New ingredients (${list.length})`,
    message:
      message ||
      (list.length === 1
        ? 'This ingredient is not in your database. Edit, match it to an existing ingredient, or save it as a new one.'
        : 'These ingredients are not in your database. Edit, match them to existing ingredients, or save them as new ones.'),
    items: list,
    suggestionPool,
    applyAllText: 'Apply all',
    cancelText: 'Cancel',
    editText: 'Edit',
    saveText: 'Save',
  });
  if (!result || !Array.isArray(result.rows)) return null;

  const map = new Map();
  const finalNames = [];
  const seenFinal = new Set();
  result.rows.forEach((row) => {
    const key = String(row?.original || '')
      .trim()
      .toLowerCase();
    const replacement = String(row?.value || '').trim();
    if (!key || !replacement) return;
    map.set(key, replacement);
    const rk = replacement.toLowerCase();
    if (seenFinal.has(rk)) return;
    seenFinal.add(rk);
    finalNames.push(replacement);
  });
  return { map, finalNames };
}

async function resolveUnknownIngredientVariants({
  db,
  entries,
  title = '',
  message = '',
}) {
  if (!db) return null;
  const ui = window.ui;
  if (!ui || typeof ui.unknownItems !== 'function') return null;

  const rows = Array.isArray(entries) ? entries : [];
  if (!rows.length) return { map: new Map() };
  const variantLookup = createVariantLookupHelpers(db);
  if (!variantLookup.hasVariantTable) return { map: new Map() };

  const deduped = [];
  const seen = new Set();
  rows.forEach((row) => {
    const ingredientId = Number(row?.ingredientId);
    const ingredientName = String(row?.ingredientName || '').trim();
    const variant = String(row?.variant || '').trim();
    if (!Number.isFinite(ingredientId) || ingredientId <= 0 || !variant) return;
    const key = `${ingredientId}::${variant.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push({ ingredientId, ingredientName, variant });
  });
  if (!deduped.length) return { map: new Map() };

  const groups = new Map();
  deduped.forEach((entry) => {
    if (!groups.has(entry.ingredientId)) groups.set(entry.ingredientId, []);
    groups.get(entry.ingredientId).push(entry);
  });

  const replacementMap = new Map();
  for (const [ingredientId, groupEntries] of groups.entries()) {
    const ingredientName =
      String(groupEntries[0]?.ingredientName || '').trim() ||
      variantLookup.getIngredientNameById(ingredientId) ||
      'ingredient';
    const suggestionPool =
      variantLookup.getVisibleVariantPoolForIngredientId(ingredientId);
    const dialogTitle =
      title ||
      `${
        groupEntries.length === 1 ? 'New variant' : 'New variants'
      } for ${ingredientName} (${groupEntries.length})`;
    const dialogMessage =
      message ||
      (groupEntries.length === 1
        ? `This variant for ${ingredientName} is not in your database. Edit, match it to an existing variant, or save it as a new one.`
        : `These variants for ${ingredientName} are not in your database. Edit, match them to existing variants, or save them as new ones.`);
    const result = await ui.unknownItems({
      title: dialogTitle,
      message: dialogMessage,
      items: groupEntries.map((entry) => entry.variant),
      suggestionPool,
      applyAllText: 'Apply all',
      cancelText: 'Cancel',
      editText: 'Edit',
      saveText: 'Save',
    });
    if (!result || !Array.isArray(result.rows)) return null;
    result.rows.forEach((row) => {
      const original = String(row?.original || '').trim();
      const replacement = String(row?.value || '').trim();
      if (!original || !replacement) return;
      const key = `${ingredientId}::${original.toLowerCase()}`;
      replacementMap.set(key, replacement);
    });
  }

  return { map: replacementMap };
}

async function resolveUnknownTagNames({ db, tags, title = '', message = '' }) {
  if (!db) return null;
  const list = normalizeRecipeTagDraftList(tags);
  if (!list.length) return { map: new Map(), finalNames: [] };
  const ui = window.ui;
  if (!ui || typeof ui.unknownItems !== 'function') {
    return null;
  }
  const suggestionPool = getVisibleTagNamePool(db);
  const result = await ui.unknownItems({
    title: title || `New tags (${list.length})`,
    message:
      message ||
      (list.length === 1
        ? 'This tag is not in your database. Edit, match it to an existing tag, or save it as a new one.'
        : 'These tags are not in your database. Edit, match them to existing tags, or save them as new ones.'),
    items: list,
    suggestionPool,
    applyAllText: 'Apply all',
    cancelText: 'Cancel',
    editText: 'Edit',
    saveText: 'Save',
  });
  if (!result || !Array.isArray(result.rows)) return null;

  const map = new Map();
  const finalNames = [];
  const seenFinal = new Set();
  result.rows.forEach((row) => {
    const key = String(row?.original || '')
      .trim()
      .toLowerCase();
    const replacementRaw = String(row?.value || '').trim();
    const replacement = replacementRaw
      ? normalizeRecipeTagDraftList([replacementRaw])[0] || ''
      : '';
    if (!key || !replacement) return;
    map.set(key, replacement);
    const rk = replacement.toLowerCase();
    if (seenFinal.has(rk)) return;
    seenFinal.add(rk);
    finalNames.push(replacement);
  });
  return { map, finalNames };
}

async function resolveUnknownSizeNames({
  db,
  sizes,
  title = '',
  message = '',
}) {
  if (!db) return null;
  const list = normalizeRecipeSizeNameList(sizes);
  if (!list.length) return { map: new Map(), finalNames: [] };
  const ui = window.ui;
  if (!ui || typeof ui.unknownItems !== 'function') {
    return null;
  }
  const suggestionPool = getVisibleSizeNamePool(db);
  const result = await ui.unknownItems({
    title: title || `New sizes (${list.length})`,
    message:
      message ||
      (list.length === 1
        ? 'This size is not in your database. Edit, match it to an existing size, or save it as a new one.'
        : 'These sizes are not in your database. Edit, match them to existing sizes, or save them as new ones.'),
    items: list,
    suggestionPool,
    applyAllText: 'Apply all',
    cancelText: 'Cancel',
    editText: 'Edit',
    saveText: 'Save',
  });
  if (!result || !Array.isArray(result.rows)) return null;

  const map = new Map();
  const finalNames = [];
  const seenFinal = new Set();
  result.rows.forEach((row) => {
    const key = String(row?.original || '')
      .trim()
      .toLowerCase();
    const replacementRaw = String(row?.value || '').trim();
    const replacement = replacementRaw
      ? normalizeRecipeSizeNameList([replacementRaw])[0] || ''
      : '';
    if (!key || !replacement) return;
    map.set(key, replacement);
    const rk = replacement.toLowerCase();
    if (seenFinal.has(rk)) return;
    seenFinal.add(rk);
    finalNames.push(replacement);
  });
  return { map, finalNames };
}

async function resolveUnknownUnitCodes({
  db,
  units,
  title = '',
  message = '',
}) {
  if (!db) return null;
  const list = normalizeRecipeUnitCodeList(units);
  if (!list.length) return { map: new Map(), finalCodes: [] };
  const ui = window.ui;
  if (!ui || typeof ui.unknownItems !== 'function') {
    return null;
  }
  const suggestionPool = getVisibleUnitCodePool(db);
  const result = await ui.unknownItems({
    title: title || `New units (${list.length})`,
    message:
      message ||
      (list.length === 1
        ? 'This unit is not in your database. Edit, match it to an existing unit, or save it as a new one.'
        : 'These units are not in your database. Edit, match them to existing units, or save them as new ones.'),
    items: list,
    suggestionPool,
    applyAllText: 'Apply all',
    cancelText: 'Cancel',
    editText: 'Edit',
    saveText: 'Save',
  });
  if (!result || !Array.isArray(result.rows)) return null;

  const map = new Map();
  const finalCodes = [];
  const seenFinal = new Set();
  result.rows.forEach((row) => {
    const key = String(row?.original || '')
      .trim()
      .toLowerCase();
    const replacementRaw = String(row?.value || '').trim();
    const replacement = replacementRaw
      ? normalizeRecipeUnitCodeList([replacementRaw])[0] || ''
      : '';
    if (!key || !replacement) return;
    map.set(key, replacement);
    const rk = replacement.toLowerCase();
    if (seenFinal.has(rk)) return;
    seenFinal.add(rk);
    finalCodes.push(replacement);
  });
  return { map, finalCodes };
}

// --- Recipe editor loader (full editor when `recipe_steps` exists; else title + tags only) ---
async function loadRecipeEditorPage() {
  const dataApi = getFavoriteEatsDataApi();

  const recipeId = sessionStorage.getItem('selectedRecipeId');
  if (!recipeId) {
    uiToast('No recipe selected.');
    window.location.href = 'recipes.html';
    return;
  }

  window.dbInstance = null;
  window.recipeEditorCatalogOnlyMode = true;

  window.recipeId = recipeId;
  const isRecipeWebMode = isForceWebModeEnabled();
  let recipe = null;
  try {
    recipe = await dataApi.getRecipeById(Number(recipeId));
    window.recipeEditorTagOptions = (await dataApi.listVisibleTags()) || [];
  } catch (err) {
    console.error('❌ Failed to load recipe from Supabase:', err);
    window.recipeEditorTagOptions = [];
  }
  if (!recipe) {
    uiToast('Recipe not found.');
    window.location.href = 'recipes.html';
    return;
  }

  if (
    !recipe.servingsDefault &&
    recipe.servings &&
    recipe.servings.default != null
  ) {
    recipe.servingsDefault = recipe.servings.default;
  }

  const isNewRecipe = sessionStorage.getItem('selectedRecipeIsNew') === '1';
  if (window.recipeEditorCatalogOnlyMode) {
    try {
      sessionStorage.removeItem('selectedRecipeIsNew');
    } catch (_) {}
  } else {
    const hasAnySteps =
      (Array.isArray(recipe.sections) &&
        recipe.sections.some(
          (section) =>
            Array.isArray(section.steps) && section.steps.length > 0,
        )) ||
      (Array.isArray(recipe.steps) && recipe.steps.length > 0);
    const hasAnyIngredients =
      Array.isArray(recipe.sections) &&
      recipe.sections.some(
        (section) =>
          Array.isArray(section.ingredients) && section.ingredients.length > 0,
      );
    const shouldSeedStepPlaceholder =
      !isRecipeWebMode && (isNewRecipe || !hasAnySteps);
    const shouldSeedIngredientPlaceholder =
      !isRecipeWebMode && !hasAnyIngredients;
    if (shouldSeedStepPlaceholder || shouldSeedIngredientPlaceholder) {
      if (isNewRecipe) {
        sessionStorage.removeItem('selectedRecipeIsNew');
      }
      if (!Array.isArray(recipe.sections) || recipe.sections.length === 0) {
        recipe.sections = [
          {
            ID: null,
            id: null,
            name: '',
            steps: [],
            ingredients: [],
          },
        ];
      }
      const firstSection = recipe.sections[0];
      if (
        shouldSeedStepPlaceholder &&
        (!Array.isArray(firstSection.steps) || firstSection.steps.length === 0)
      ) {
        const tempId = `tmp-step-${Date.now()}`;
        firstSection.steps = [
          {
            ID: null,
            id: tempId,
            section_id: firstSection.ID ?? firstSection.id ?? null,
            step_number: 1,
            instructions: '',
            type: 'step',
          },
        ];
      }
    }
  }

  if (
    isRecipeWebMode &&
    typeof window.recipeWebModePrimeRecipe === 'function'
  ) {
    window.recipeWebModePrimeRecipe(recipe);
  }

  if (!window.recipeEditorCatalogOnlyMode) {
    try {
      if (typeof window.recipeEditorSortIngredientsOnLoad === 'function') {
        window.recipeEditorSortIngredientsOnLoad(recipe);
      }
    } catch (err) {
      console.warn('⚠️ Ingredient load-order normalization failed:', err);
    }
  }

  // Do not await waitForAppBarReady() before initAppBar: the bar is injected by
  // initAppBar/ensureAppBarInjected, so #appBarTitle does not exist yet and the
  // waiter would spin until its 2s timeout (felt as multi-second lag).

  initAppBar({
    mode: 'editor',
    titleText: recipe.title || '',
    showCancel: true,
    showSave: !isRecipeWebMode,
    cancelText: isRecipeWebMode ? 'Reset servings' : 'Cancel',
    onBack: () => {
      const goRecipes = () => {
        window.location.href = 'recipes.html';
      };
      if (
        !isRecipeWebMode &&
        typeof window.recipeEditorAttemptExit === 'function'
      ) {
        void window.recipeEditorAttemptExit({
          reason: 'back',
          onClean: goRecipes,
          onDiscard: goRecipes,
          onSaveSuccess: goRecipes,
        });
        return;
      }
      goRecipes();
    },
    onCancel: () => {
      if (isRecipeWebMode) {
        if (typeof window.recipeWebModeResetServings === 'function') {
          window.recipeWebModeResetServings(window.recipeData || recipe);
        }
        return;
      }
      if (typeof revertChanges === 'function') {
        revertChanges();
      }
    },
    onSave: (window.recipeEditorSave = async () => {
      const modelTitle = (window.recipeData?.title || '').trim();
      const el = document.getElementById('appBarTitle');
      const next = (modelTitle || el?.textContent || '').trim();
      if (!next) {
        uiToast('Title is required.');
        return;
      }
      if (window.recipeData) window.recipeData.title = next;
      if (el) el.textContent = next;
      const titleEl = document.getElementById('recipeTitle');
      if (titleEl) titleEl.textContent = next;

      try {
        if (typeof saveRecipeToDB !== 'function') {
          throw new Error('saveRecipeToDB is not available');
        }
        const refreshed = await saveRecipeToDB();
        uiToast('Saved.');

        if (refreshed) {
          window.originalRecipeSnapshot = JSON.parse(JSON.stringify(refreshed));
          window.recipeData = JSON.parse(JSON.stringify(refreshed));
          if (typeof renderRecipe === 'function') {
            renderRecipe(refreshed);
          }
        }
        if (typeof window.recipeEditorResetDirty === 'function') {
          window.recipeEditorResetDirty();
        }
      } catch (err) {
        console.error('❌ Save failed:', err);
        uiToast('Save failed — check console for details.');
        throw err;
      }
    }),
  });

  window.recipeWebModeSyncAppBar = () => {
    const cancelBtn = document.getElementById('appBarCancelBtn');
    if (!cancelBtn) return;
    if (!isRecipeWebMode) {
      setAppBarTextActionLabel(cancelBtn, 'Cancel');
      cancelBtn.classList.remove('app-bar-cancel--reset-servings');
      const dirty =
        typeof window.recipeEditorGetIsDirty === 'function'
          ? window.recipeEditorGetIsDirty()
          : false;
      cancelBtn.disabled = !dirty;
      return;
    }
    setAppBarTextActionLabel(cancelBtn, 'Reset servings');
    cancelBtn.classList.add('app-bar-cancel--reset-servings');
    cancelBtn.disabled =
      typeof window.recipeWebModeCanResetServings === 'function'
        ? !window.recipeWebModeCanResetServings(window.recipeData || recipe)
        : true;
  };
  window.recipeWebModeSyncAppBar();
  if (isRecipeWebMode) {
    const recipeWebServingsChangedEventName =
      window.favoriteEatsRecipeWebServings?.changeEventName ||
      window.favoriteEatsEventNames?.recipeWebServingsChanged ||
      '';
    if (!window._recipeWebModeStorageSyncBound) {
      window._recipeWebModeStorageSyncBound = true;
      const syncFromStorage = (event) => {
        const changedRecipeId = Number(event?.detail?.recipeId);
        if (
          Number.isFinite(changedRecipeId) &&
          changedRecipeId > 0 &&
          Number(window.recipeData?.id) !== changedRecipeId
        ) {
          return;
        }
        if (typeof window.recipeWebModeSyncFromStorage === 'function') {
          window.recipeWebModeSyncFromStorage();
        }
      };
      if (recipeWebServingsChangedEventName) {
        window.addEventListener(
          recipeWebServingsChangedEventName,
          syncFromStorage,
        );
      }
      window.addEventListener('storage', (event) => {
        if (event.key !== window.favoriteEatsStorageKeys?.recipeWebServings)
          return;
        syncFromStorage();
      });
    }
  }

  if (typeof renderRecipe === 'function') {
    renderRecipe(recipe);
  }

  if (!isRecipeWebMode && typeof revertChanges === 'function') {
    revertChanges();
  }

  let editorRefreshInFlight = false;
  let editorRefreshQueued = false;
  let editorRealtimeReady = true;
  const hasLocalDirtyRecipeChanges = () =>
    typeof window.recipeEditorGetIsDirty === 'function' &&
    window.recipeEditorGetIsDirty();
  const refreshEditorRecipeFromRemote = async () => {
    if (editorRefreshInFlight || !editorRealtimeReady) {
      editorRefreshQueued = true;
      return;
    }
    // Never clobber in-progress local edits with background realtime/poll refreshes.
    if (hasLocalDirtyRecipeChanges()) {
      editorRefreshQueued = false;
      return;
    }
    editorRefreshInFlight = true;
    try {
      const latest = await dataApi.getRecipeById(Number(recipeId));
      if (!latest) {
        uiToast('Recipe was deleted.');
        window.location.href = 'recipes.html';
        return;
      }
      if (hasLocalDirtyRecipeChanges()) {
        return;
      }
      const nextRecipe = JSON.parse(JSON.stringify(latest));
      recipe = nextRecipe;
      window.recipeData = JSON.parse(JSON.stringify(nextRecipe));
      window.originalRecipeSnapshot = JSON.parse(JSON.stringify(nextRecipe));
      if (typeof renderRecipe === 'function') {
        renderRecipe(nextRecipe);
      }
      if (typeof window.recipeEditorResetDirty === 'function') {
        window.recipeEditorResetDirty();
      }
    } catch (err) {
      console.error('⚠️ Failed to refresh recipe from realtime update:', err);
    } finally {
      editorRefreshInFlight = false;
      if (editorRefreshQueued && editorRealtimeReady) {
        editorRefreshQueued = false;
        queueMicrotask(() => {
          void refreshEditorRecipeFromRemote();
        });
      }
    }
  };

  let unsubscribeRecipeRealtime = null;
  if (typeof dataApi.subscribeRecipeById === 'function') {
    unsubscribeRecipeRealtime = dataApi.subscribeRecipeById(Number(recipeId), {
      onChange: () => {
        void refreshEditorRecipeFromRemote();
      },
    });
  }
  const recipeEditorPollIntervalMs = 3000;
  const recipeEditorPollHandle = window.setInterval(() => {
    void refreshEditorRecipeFromRemote();
  }, recipeEditorPollIntervalMs);
  window.addEventListener(
    'pagehide',
    () => {
      editorRealtimeReady = false;
      window.clearInterval(recipeEditorPollHandle);
      if (typeof unsubscribeRecipeRealtime === 'function') {
        unsubscribeRecipeRealtime();
      }
      unsubscribeRecipeRealtime = null;
    },
    { once: true }
  );

  try {
    window.scrollTo({ top: 0, behavior: 'auto' });
  } catch (_) {
    window.scrollTo(0, 0);
  }
}

window.openRecipe = function openRecipe(recipeId) {
  const rid = Number(recipeId);
  if (!Number.isFinite(rid) || rid <= 0) return;
  const proceed = () => {
    sessionStorage.setItem('selectedRecipeId', String(rid));
    window.location.href = 'recipeEditor.html';
  };
  if (typeof window.recipeEditorAttemptExit === 'function') {
    void window.recipeEditorAttemptExit({
      reason: 'open-recipe',
      onClean: proceed,
      onDiscard: proceed,
      onSaveSuccess: proceed,
    });
    return;
  }
  proceed();
};

/**
 * Open the store editor; optionally focus an aisle after load (see STORE_EDITOR_FOCUS_AISLE_SESSION_KEY).
 * @param {number} storeId
 * @param {number} [aisleId]
 * @param {string} [chainName]
 * @param {string} [locationName]
 */
window.openStoreAisle = function openStoreAisle(
  storeId,
  aisleId,
  chainName,
  locationName,
) {
  const sid = Number(storeId);
  if (!Number.isFinite(sid) || sid <= 0) return;
  const aid = Number(aisleId);
  const proceed = () => {
    sessionStorage.setItem('selectedStoreId', String(sid));
    sessionStorage.removeItem('selectedStoreIsNew');
    if (chainName != null)
      sessionStorage.setItem('selectedStoreChain', String(chainName));
    if (locationName != null)
      sessionStorage.setItem('selectedStoreLocation', String(locationName));
    if (Number.isFinite(aid) && aid > 0) {
      sessionStorage.setItem(
        STORE_EDITOR_FOCUS_AISLE_SESSION_KEY,
        String(aid),
      );
    } else {
      sessionStorage.removeItem(STORE_EDITOR_FOCUS_AISLE_SESSION_KEY);
    }
    window.location.href = 'recipes.html';
  };
  if (typeof window.recipeEditorAttemptExit === 'function') {
    void window.recipeEditorAttemptExit({
      reason: 'open-store-aisle',
      onClean: proceed,
      onDiscard: proceed,
      onSaveSuccess: proceed,
    });
    return;
  }
  proceed();
};

document.addEventListener('DOMContentLoaded', () => {
  // (intentionally empty) legacy DOMContentLoaded wiring removed
});
