// Web bundle: recipe catalog via Supabase (`js/supabaseDataApi.js`); no local SQLite in the browser.

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
const FAVORITE_EATS_FORCE_WEB_MODE_EVENT = 'favorite-eats:force-web-mode';
const SINGLE_UI_STATE = Object.freeze({
  pageSet: 'web',
  platform: 'planner',
});

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

function applySingleUiPresentation() {
  const body = document.body;
  if (!(body instanceof HTMLElement)) return SINGLE_UI_STATE.pageSet;

  body.dataset.pageSet = SINGLE_UI_STATE.pageSet;
  body.classList.add('force-web-mode');
  applyDocumentThemePlatform();
  return SINGLE_UI_STATE.pageSet;
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

/** Single-UI build platform theme selector. */
function applyDocumentThemePlatform() {
  const root = document.documentElement;
  if (!(root instanceof HTMLElement)) return;
  root.dataset.platform = SINGLE_UI_STATE.platform;
}

applySingleUiPresentation();

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
        uiToast(headline, {
          timeoutMs: 8000,
          actionText: 'Dismiss',
          onAction: () => {},
        });
        lastToastAt = now;
      }
      lastSignature = signature;
    },
  });

  const onPageHide = () => {
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

function isRecipeRowStepperContext(target) {
  const el = target instanceof Element ? target : null;
  const active =
    document.activeElement instanceof Element ? document.activeElement : null;
  const selector =
    '.shopping-list-row-stepper, .shopping-stepper-qty-input, .shopping-stepper-qty-button';
  return !!(
    document.body?.classList?.contains('recipe-row-stepper-editing') ||
    el?.closest?.(selector) ||
    active?.closest?.(selector)
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
    if (isRecipeRowStepperContext(e.target)) return;

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

  const clearSearchQuery = () => {
    searchInput.value = '';
    emitQueryChange();
    searchInput.focus();
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
          clearSearchQuery();
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
        if (searchInput.value) {
          clearSearchQuery();
        } else if (isCompactExpanded()) {
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
  void db;
  void tableName;
  return false;
}

function tableHasColumnInMain(db, tableName, colName) {
  void db;
  void tableName;
  void colName;
  return false;
}

function ensureRecipeTagsSchemaInMain(db) {
  void db;
  return false;
}

function ensureIngredientVariantTagsSchemaInMain(db) {
  void db;
  return false;
}

function ensureIngredientVariantIsDeprecatedColumnInMain(db) {
  void db;
  return false;
}

function ensureSizesSchemaInMain(db) {
  void db;
  return false;
}

function ensureUnitsSchemaInMain(db) {
  void db;
  return false;
}

async function persistLoadedDbInMain(db, isElectron) {
  void db;
  void isElectron;
}

async function persistBinaryArrayInMain(
  binaryArray,
  {
    isElectron = !!window.electronAPI,
    overwriteOnly = false,
    failureMessage = 'Failed to save database.',
  } = {},
) {
  void binaryArray;
  void isElectron;
  void overwriteOnly;
  void failureMessage;
}

function ensureIngredientBaseVariantsInMain(db) {
  void db;
  return 0;
}

async function ensureIngredientLemmaMaintenanceInMain(db, isElectron) {
  void db;
  void isElectron;
  return 0;
}

const LAST_PAGE_SESSION_KEY = 'favoriteEats:last-page-id';
const SHOPPING_FILTER_CHIPS_SESSION_KEY_PREFIX =
  'favoriteEats:shopping-filter-chips';
/** Prefix for Items-page tag filter chip ids (avoids collisions with home location ids). */
const SHOPPING_TAG_FILTER_PREFIX = 'tag:';
const SHOPPING_SCROLL_RESTORE_SESSION_KEY =
  'favoriteEats:shopping-scroll-restore-y';
// --- Shopping plan helpers (tests extract this block) ---
const SHOPPING_PLAN_STORAGE_KEY = 'favoriteEats:shopping-plan:v1';
const SHOPPING_PLAN_KEY_SEP = '\x00';
let shoppingPlanCache = null;
/** When true, recipe plan / modal override writes skip Supabase (e.g. during remote hydrate). */
let menuPlanSupabasePushSuspended = false;

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
    recipeMenuOverrides: {},
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
  const rawRecipeMenuOverrides =
    source.recipeMenuOverrides &&
    typeof source.recipeMenuOverrides === 'object' &&
    !Array.isArray(source.recipeMenuOverrides)
      ? source.recipeMenuOverrides
      : {};
  const storeOrder = normalizeShoppingPlanStoreOrder(source.storeOrder);
  const selectedStoreIds = normalizeShoppingPlanSelectedStoreIds(
    source.selectedStoreIds,
  );
  const itemSelections = {};
  const recipeSelections = {};
  const recipeMenuOverrides = {};

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

  Object.keys(rawRecipeMenuOverrides).forEach((rawKey) => {
    const key = String(rawKey || '').trim();
    if (!key) return;
    const rawEntry = rawRecipeMenuOverrides[rawKey];
    const entry =
      rawEntry && typeof rawEntry === 'object' && !Array.isArray(rawEntry)
        ? rawEntry
        : {};
    const recipeId = Number(entry.recipeId != null ? entry.recipeId : key);
    const quantity = Math.max(0, Math.min(99, Number(entry.quantity || 0)));
    if (!Number.isFinite(recipeId) || recipeId <= 0) return;
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    const normalizedKey = String(Math.trunc(recipeId));
    recipeMenuOverrides[normalizedKey] = {
      key: normalizedKey,
      recipeId: Math.trunc(recipeId),
      quantity,
    };
  });

  return {
    version: 1,
    itemSelections,
    recipeSelections,
    recipeMenuOverrides,
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
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      parsed.recipeSelections = {};
      parsed.recipeMenuOverrides = {};
    }
    shoppingPlanCache = normalizeShoppingPlan(parsed);
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
    // Recipe plan + modal overrides are sourced from Supabase only; persist legacy chrome fields locally.
    const chromeOnly = normalizeShoppingPlan({
      ...normalized,
      recipeSelections: {},
      recipeMenuOverrides: {},
    });
    localStorage.setItem(SHOPPING_PLAN_STORAGE_KEY, JSON.stringify(chromeOnly));
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
  const nextQty = Math.max(0, Math.min(99, Number(quantity || 0)));
  const plan = updateShoppingPlan((plan) => {
    if (!plan.recipeSelections || typeof plan.recipeSelections !== 'object') {
      plan.recipeSelections = {};
    }
    if (
      !plan.recipeMenuOverrides ||
      typeof plan.recipeMenuOverrides !== 'object'
    ) {
      plan.recipeMenuOverrides = {};
    }
    if (!Number.isFinite(nextQty) || nextQty <= 0) {
      delete plan.recipeSelections[normalizedKey];
      // Keep recipeMenuOverrides; modal servings can stay overridden while plan qty is 0.
      return;
    }
    plan.recipeSelections[normalizedKey] = {
      key: normalizedKey,
      recipeId: Math.trunc(normalizedRecipeId),
      title: String(title || '').trim(),
      quantity: nextQty,
    };
  });
  if (
    !menuPlanSupabasePushSuspended &&
    window.favoriteEatsDataApi &&
    typeof window.favoriteEatsDataApi.upsertMenuPlanRecipe === 'function'
  ) {
    void window.favoriteEatsDataApi
      .upsertMenuPlanRecipe({
        recipeId: Math.trunc(normalizedRecipeId),
        quantity: Number.isFinite(nextQty) && nextQty > 0 ? nextQty : 0,
      })
      .catch((err) => console.error('❌ Menu plan sync failed:', err));
  }
  return plan;
}

function getShoppingPlanRecipeSelections() {
  const plan = getShoppingPlan();
  return plan?.recipeSelections && typeof plan.recipeSelections === 'object'
    ? plan.recipeSelections
    : {};
}

function getShoppingPlanRecipeMenuOverrides() {
  const plan = getShoppingPlan();
  return plan?.recipeMenuOverrides &&
    typeof plan.recipeMenuOverrides === 'object'
    ? plan.recipeMenuOverrides
    : {};
}

function getEffectiveMenuPlanRecipeSelections() {
  const selections = getShoppingPlanRecipeSelections();
  const overrides = getShoppingPlanRecipeMenuOverrides();
  const result = {};
  Object.keys(selections).forEach((key) => {
    const canonical = selections[key];
    if (!canonical) return;
    const overrideEntry = overrides[key];
    const overrideQty = Number(overrideEntry?.quantity);
    const effectiveQty =
      Number.isFinite(overrideQty) && overrideQty > 0
        ? overrideQty
        : Number(canonical.quantity || 0);
    result[key] = { ...canonical, quantity: effectiveQty };
  });
  return result;
}

function clearShoppingPlanSelections({
  clearItems = false,
  clearRecipes = false,
} = {}) {
  const out = updateShoppingPlan((plan) => {
    if (clearItems) plan.itemSelections = {};
    if (clearRecipes) {
      plan.recipeSelections = {};
      plan.recipeMenuOverrides = {};
    }
  });
  if (
    clearRecipes &&
    !menuPlanSupabasePushSuspended &&
    window.favoriteEatsDataApi &&
    typeof window.favoriteEatsDataApi.clearMenuPlanAndModalOverrides === 'function'
  ) {
    void window.favoriteEatsDataApi
      .clearMenuPlanAndModalOverrides()
      .catch((err) => console.error('❌ Clear menu plan failed:', err));
  }
  return out;
}

function applyRemoteMenuPlanStateToCache(remote, recipeRowsForTitles) {
  const rows = Array.isArray(recipeRowsForTitles) ? recipeRowsForTitles : [];
  const titleById = new Map(
    rows.map((r) => [Number(r.id), String(r.title || '').trim()]),
  );
  const current = getShoppingPlan();
  const recipeSelections = {};
  const recipeMenuOverrides = {};
  const remoteSel =
    remote?.recipeSelections && typeof remote.recipeSelections === 'object'
      ? remote.recipeSelections
      : {};
  Object.keys(remoteSel).forEach((k) => {
    const v = remoteSel[k];
    if (!v || typeof v !== 'object') return;
    const recipeId = Math.trunc(Number(v.recipeId != null ? v.recipeId : k));
    const quantity = Number(v.quantity);
    if (!(recipeId > 0) || !(quantity > 0) || !Number.isFinite(quantity)) return;
    const key = String(recipeId);
    recipeSelections[key] = {
      key,
      recipeId,
      title: titleById.get(recipeId) || String(v.title || ''),
      quantity,
    };
  });
  const remoteOv =
    remote?.recipeMenuOverrides && typeof remote.recipeMenuOverrides === 'object'
      ? remote.recipeMenuOverrides
      : {};
  Object.keys(remoteOv).forEach((k) => {
    const v = remoteOv[k];
    if (!v || typeof v !== 'object') return;
    const recipeId = Math.trunc(Number(v.recipeId != null ? v.recipeId : k));
    const quantity = Number(v.quantity);
    if (!(recipeId > 0) || !(quantity > 0) || !Number.isFinite(quantity)) return;
    const selKey = String(recipeId);
    // Allow override when plan row is absent (plan qty 0); modal still references recipe id.
    recipeMenuOverrides[selKey] = {
      key: selKey,
      recipeId,
      quantity,
    };
  });
  const merged = normalizeShoppingPlan({
    version: 1,
    itemSelections:
      current.itemSelections && typeof current.itemSelections === 'object'
        ? current.itemSelections
        : {},
    storeOrder: Array.isArray(current.storeOrder) ? current.storeOrder : [],
    selectedStoreIds: Array.isArray(current.selectedStoreIds)
      ? current.selectedStoreIds
      : [],
    recipeSelections,
    recipeMenuOverrides,
  });
  shoppingPlanCache = merged;
  try {
    const chromeOnly = normalizeShoppingPlan({
      ...merged,
      recipeSelections: {},
      recipeMenuOverrides: {},
    });
    localStorage.setItem(SHOPPING_PLAN_STORAGE_KEY, JSON.stringify(chromeOnly));
  } catch (_) {}
}

async function hydrateShoppingPlanFromSupabase(recipeRowsForTitles) {
  const api = window.favoriteEatsDataApi;
  if (!api || typeof api.fetchMenuPlanState !== 'function') return;
  menuPlanSupabasePushSuspended = true;
  try {
    const remote = await api.fetchMenuPlanState();
    applyRemoteMenuPlanStateToCache(remote, recipeRowsForTitles);
  } catch (err) {
    console.error('❌ Failed to load menu plan from Supabase:', err);
    uiToast('Failed to load menu plan.');
  } finally {
    menuPlanSupabasePushSuspended = false;
  }
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
  if (
    typeof window !== 'undefined' &&
    window.bridge &&
    typeof window.bridge.loadRecipeFromDB === 'function'
  ) {
    try {
      return window.bridge.loadRecipeFromDB(db, recipeId) || null;
    } catch (_) {
      return null;
    }
  }
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

  Object.values(getEffectiveMenuPlanRecipeSelections()).forEach((selection) => {
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
  void db;
  void ingredientName;
  void variantText;
  return false;
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
    Object.values(getEffectiveMenuPlanRecipeSelections()).forEach((selection) => {
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

  /** @type {{ id: number, label: string }[]} */
  const selectedStores = [];
  const baseAssignmentMap = new Map();
  const variantAssignmentMap = new Map();
  const variantAnyAssignmentMap = new Map();
  const variantOrderMap = new Map();

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

function shouldDeferMainJsBootForCurrentPage() {
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

function bootFavoriteEatsForCurrentPage() {
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

  // --- Cmd+↑: go to parent/back page on editor pages ---
  const CHILD_EDITOR_PAGES = new Set(['recipe-editor']);

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

if (!shouldDeferMainJsBootForCurrentPage()) {
  bootFavoriteEatsForCurrentPage();
}

// Welcome / static error shells skip boot above; loaded pages run loadRecipesPage or loadRecipeEditorPage.

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
  const recipesMenuBtn = document.getElementById('appBarMenuPlanBtn');
  if (recipesMenuBtn) recipesMenuBtn.hidden = false;

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
  let activeRecipeKey = '';
  let recipeRowInlineEditInput = null;
  let recipeRenderDeferred = false;
  let menuPlanDialogListStateRef = null;
  const recipeWebServingsUi = window.recipeWebModeServings || {};
  const recipeWebServingsChangedEventName =
    window.favoriteEatsRecipeWebServings?.changeEventName ||
    window.favoriteEatsEventNames?.recipeWebServingsChanged ||
    '';
  const isRecipeWebSelectMode = () => true;
  const toPositiveServingsOrNull = (rawValue) => {
    const numeric = Number(rawValue);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  };
  const getRecipeQtyKey = (recipeId) => String(recipeId || '').trim();
  const isRecipeSelected = (recipeId) =>
    recipeSelectionKeys.has(getRecipeQtyKey(recipeId));
  const setRecipeRowInlineEditInput = (input = null) => {
    recipeRowInlineEditInput = input instanceof HTMLInputElement ? input : null;
    document.body?.classList?.toggle(
      'recipe-row-stepper-editing',
      !!recipeRowInlineEditInput,
    );
  };
  const isRecipeRowInlineEditLive = () =>
    !!(
      recipeRowInlineEditInput instanceof HTMLInputElement &&
      document.contains(recipeRowInlineEditInput)
    );
  const getRecipeSelectionQty = (recipeId) => {
    const entry = getShoppingPlanRecipeSelections()[getRecipeQtyKey(recipeId)];
    const quantity = Math.max(0, Math.min(99, Number(entry?.quantity || 0)));
    return Number.isFinite(quantity) ? quantity : 0;
  };
  const setRecipeSelectionQty = (recipeRow, nextQty) => {
    if (!recipeRow) return;
    const recipeId = recipeRow.id;
    const quantity = Math.max(0, Math.min(99, Number(nextQty || 0)));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      recipeSelectionKeys.delete(getRecipeQtyKey(recipeId));
      setShoppingPlanRecipeSelection({
        recipeId,
        title: recipeRow?.title || '',
        quantity: 0,
      });
      return;
    }
    recipeSelectionKeys.add(getRecipeQtyKey(recipeId));
    setShoppingPlanRecipeSelection({
      recipeId,
      title: recipeRow?.title || '',
      quantity,
    });
  };
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
    const quantity = getRecipeSelectionQty(recipeRow?.id);
    return quantity > 0 ? quantity : null;
  };
  const formatRecipeRowServings = (rawValue) => {
    if (typeof recipeWebServingsUi.formatDisplay === 'function') {
      return recipeWebServingsUi.formatDisplay(rawValue);
    }
    return typeof window.formatShoppingQtyForDisplay === 'function'
      ? window.formatShoppingQtyForDisplay(rawValue)
      : String(rawValue == null ? '' : rawValue);
  };

  /** Modal servings editing uses quarter steps (matches persistMenuPlanDialogEntries). */
  const normalizeMenuPlanDialogQty = (rawQty) => {
    const parsed = Number(rawQty);
    if (!Number.isFinite(parsed)) return 0.25;
    const rounded = Math.round(parsed * 4) / 4;
    return Math.max(0.25, Math.min(99, rounded));
  };

  const normalizeMenuPlanDialogPlanQty = (rawQty) => {
    const parsed = Number(rawQty);
    if (!Number.isFinite(parsed)) return 0;
    const rounded = Math.round(parsed * 4) / 4;
    return Math.max(0, Math.min(99, rounded));
  };

  /** Snapshot of persisted modal overrides at dialog open / latest clean resync (recipe id -> qty). */
  function snapshotOpenModalOverrideQtyByKey() {
    const raw = getShoppingPlanRecipeMenuOverrides();
    const out = Object.create(null);
    Object.keys(raw || {}).forEach((k) => {
      const e = raw[k];
      const id = Math.trunc(Number(e?.recipeId != null ? e.recipeId : k));
      const q = normalizeMenuPlanDialogQty(e?.quantity);
      if (!(id > 0) || !(q > 0)) return;
      out[String(id)] = q;
    });
    return out;
  }

  function buildDesiredModalOverrideQtyMapFromDrafts(rowDrafts, eqSameQty) {
    const out = Object.create(null);
    rowDrafts.forEach((d) => {
      if (eqSameQty(d.quantity, d.planQty)) return;
      out[String(Math.trunc(d.recipeId))] = d.quantity;
    });
    return out;
  }

  function modalOverrideQtyMapsDiffer(desiredMap, openMap, eqSameQty) {
    const keys = new Set([
      ...Object.keys(desiredMap || {}),
      ...Object.keys(openMap || {}),
    ]);
    for (const key of keys) {
      const d = desiredMap[key];
      const o = openMap[key];
      const hasD = d !== undefined && Number.isFinite(Number(d));
      const hasO = o !== undefined && Number.isFinite(Number(o));
      if (hasD !== hasO) return true;
      if (!hasD) continue;
      if (!eqSameQty(Number(d), Number(o))) return true;
    }
    return false;
  }

  const getMenuPlanDialogEntries = () => {
    const overrides = getShoppingPlanRecipeMenuOverrides();
    const selections = getShoppingPlanRecipeSelections();
    const byRecipeId = new Map();

    const tryAdd = (recipeId, canonicalQuantity, titleHint) => {
      const rid = Number(recipeId);
      if (!Number.isFinite(rid) || rid <= 0) return;
      const overrideEntry = overrides[String(Math.trunc(rid))];
      const overrideRaw = Number(overrideEntry?.quantity);
      const hasOverride =
        Number.isFinite(overrideRaw) && overrideRaw > 0;
      const canonicalQty = Math.max(0, Number(canonicalQuantity || 0));
      if (!(canonicalQty > 0 || hasOverride)) return;

      const row = getRecipeRowById(rid);
      const title =
        String(titleHint || '').trim() ||
        String(row?.title || '').trim();
      if (!title) return;

      const quantity = hasOverride ? overrideRaw : canonicalQty;
      byRecipeId.set(rid, {
        recipeId: rid,
        title,
        quantity,
        baselineQuantity: canonicalQty,
      });
    };

    Object.values(selections).forEach((entry) => {
      tryAdd(entry?.recipeId, entry?.quantity, entry?.title);
    });

    Object.keys(overrides).forEach((key) => {
      const overrideEntry = overrides[key];
      const rid = Math.trunc(
        Number(overrideEntry?.recipeId != null ? overrideEntry.recipeId : key),
      );
      if (!(rid > 0) || byRecipeId.has(rid)) return;
      const overrideRaw = Number(overrideEntry?.quantity);
      if (!Number.isFinite(overrideRaw) || overrideRaw <= 0) return;
      const sel = selections[String(rid)];
      const canonicalQty = sel ? Math.max(0, Number(sel.quantity || 0)) : 0;
      tryAdd(rid, canonicalQty, sel?.title);
    });

    return [...byRecipeId.values()].sort((a, b) =>
      String(a.title || '').localeCompare(String(b.title || ''), undefined, {
        sensitivity: 'base',
      }),
    );
  };
  const buildMenuPlanDialogListNode = (
    selectionEntries,
    openModalOverrideQtyByKey,
  ) => {
    const draftEntries = Array.isArray(selectionEntries) ? selectionEntries : [];
    const openSnapshot = openModalOverrideQtyByKey || Object.create(null);
    const listEl = document.createElement('ul');
    listEl.className = 'menu-plan-dialog-list';
    let onChange = null;

    const normalizeQuantity = normalizeMenuPlanDialogQty;
    const formatQuantityDisplay = (value) => {
      if (typeof window.decimalToFractionDisplay === 'function') {
        const formatted = window.decimalToFractionDisplay(value, [2, 4]);
        if (formatted) return formatted;
      }
      if (typeof window.formatShoppingQtyForDisplay === 'function') {
        return window.formatShoppingQtyForDisplay(value);
      }
      return String(value);
    };
    const formatQuantityForInput = (value) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return '';
      if (Number.isInteger(numeric)) return String(numeric);
      return String(Number(numeric.toFixed(2)));
    };
    const quantitiesAreEqual = (a, b) =>
      Math.abs(Number(a) - Number(b)) < 1e-6;

    /** One source of truth: row matches Revert target (plan) iff this is false. */
    const draftDiffersFromPlan = (d) =>
      !quantitiesAreEqual(d.quantity, d.planQty);

    const rowDrafts = [];
    let remoteResyncPending = false;

    /** Save enabled iff local drafts differ from the last saved modal baseline. */
    const canMenuPlanSave = () =>
      rowDrafts.length > 0 &&
      modalOverrideQtyMapsDiffer(
        buildDesiredModalOverrideQtyMapFromDrafts(
          rowDrafts,
          quantitiesAreEqual,
        ),
        openSnapshot,
        quantitiesAreEqual,
      );

    /** Revert enabled iff some row's draft still differs from plan (stepper), independent of Save. */
    const canMenuPlanRevert = () => rowDrafts.some(draftDiffersFromPlan);

    const notifyChanged = () => {
      if (typeof onChange === 'function') {
        onChange({
          canMenuPlanSave: canMenuPlanSave(),
          canMenuPlanRevert: canMenuPlanRevert(),
        });
      }
    };

    const hasActiveQtyInput = () =>
      rowDrafts.some(
        (draft) =>
          draft.qtyValueInput instanceof HTMLElement &&
          draft.qtyValueInput.style.display !== 'none',
      );

    const replaceOpenSnapshot = (nextSnapshot) => {
      Object.keys(openSnapshot).forEach((key) => delete openSnapshot[key]);
      Object.assign(openSnapshot, nextSnapshot || {});
    };

    const tryApplyPendingRemoteResync = () => {
      if (
        !remoteResyncPending ||
        canMenuPlanSave() ||
        hasActiveQtyInput()
      ) {
        return;
      }
      remoteResyncPending = false;
      replaceOpenSnapshot(snapshotOpenModalOverrideQtyByKey());
      syncListBodyFromEntries(getMenuPlanDialogEntries());
      notifyChanged();
    };

    const syncDraftDisplay = (draft) => {
      const qtyBtn = draft.qtyValueBtn;
      const qtyInput = draft.qtyValueInput;
      if (qtyBtn) qtyBtn.textContent = formatQuantityDisplay(draft.quantity);
      if (qtyInput) qtyInput.value = formatQuantityForInput(draft.quantity);
      if (qtyInput) qtyInput.style.display = 'none';
      if (qtyBtn) qtyBtn.style.display = '';
      const itemEl = qtyBtn ? qtyBtn.closest('li') : null;
      if (itemEl) {
        itemEl.classList.toggle('is-edited', draftDiffersFromPlan(draft));
      }
    };

    function attachRow(entry) {
      const recipeId = Number(entry?.recipeId);
      const title = String(entry?.title || '').trim();
      if (!Number.isFinite(recipeId) || recipeId <= 0 || !title) return;
      const savedEffectiveQty = normalizeQuantity(entry?.quantity);
      const baselineRaw = Number(entry?.baselineQuantity);
      const planQty = Number.isFinite(baselineRaw)
        ? normalizeMenuPlanDialogPlanQty(baselineRaw)
        : savedEffectiveQty;
      const quantity = savedEffectiveQty;
      const draft = {
        recipeId,
        title,
        planQty,
        savedEffectiveQty,
        quantity,
        qtyValueBtn: null,
        qtyValueInput: null,
      };
      rowDrafts.push(draft);

      const itemEl = document.createElement('li');
      const titleEl = document.createElement('span');
      titleEl.className = 'menu-plan-dialog-row-title';
      titleEl.textContent = `${title} (`;
      itemEl.appendChild(titleEl);

      const qtyValueBtn = document.createElement('button');
      qtyValueBtn.type = 'button';
      qtyValueBtn.className = 'menu-plan-dialog-qty-value';
      qtyValueBtn.setAttribute('aria-label', `Edit servings for ${title}`);
      qtyValueBtn.textContent = formatQuantityDisplay(quantity);

      const qtyValueInput = document.createElement('input');
      qtyValueInput.type = 'text';
      qtyValueInput.inputMode = 'decimal';
      qtyValueInput.className = 'menu-plan-dialog-qty-input';
      qtyValueInput.style.display = 'none';
      qtyValueInput.dataset.dialogEnterCommitsInline = '1';
      qtyValueInput.setAttribute('aria-label', `Servings for ${title}`);

      /** Purple row = same as per-row revertability (draft differs from plan). */
      const updateEditedState = () => {
        itemEl.classList.toggle('is-edited', draftDiffersFromPlan(draft));
      };
      const showButtonOnly = () => {
        qtyValueInput.style.display = 'none';
        qtyValueBtn.style.display = '';
      };
      const showInputOnly = () => {
        qtyValueBtn.style.display = 'none';
        qtyValueInput.style.display = '';
      };
      const syncQtyDisplay = () => {
        qtyValueBtn.textContent = formatQuantityDisplay(draft.quantity);
        qtyValueInput.value = formatQuantityForInput(draft.quantity);
      };
      const commitInput = () => {
        draft.quantity = normalizeQuantity(qtyValueInput.value);
        syncQtyDisplay();
        updateEditedState();
        showButtonOnly();
        notifyChanged();
        tryApplyPendingRemoteResync();
      };
      const enterEditMode = () => {
        syncQtyDisplay();
        showInputOnly();
        window.setTimeout(() => {
          try {
            qtyValueInput.focus();
            qtyValueInput.select();
          } catch (_) {}
        }, 0);
      };

      qtyValueBtn.addEventListener('click', enterEditMode);
      qtyValueInput.addEventListener('blur', commitInput);
      qtyValueInput.addEventListener('keydown', (event) => {
        if (!event) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          commitInput();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          showButtonOnly();
          tryApplyPendingRemoteResync();
        }
      });

      itemEl.appendChild(qtyValueBtn);
      itemEl.appendChild(qtyValueInput);
      draft.qtyValueBtn = qtyValueBtn;
      draft.qtyValueInput = qtyValueInput;

      const unitEl = document.createElement('span');
      unitEl.className = 'menu-plan-dialog-row-unit';
      unitEl.textContent = ' serv.)';
      itemEl.appendChild(unitEl);
      listEl.appendChild(itemEl);
      updateEditedState();
    }

    function syncListBodyFromEntries(entries) {
      const nextEntries = Array.isArray(entries) ? entries : [];
      listEl.replaceChildren();
      rowDrafts.length = 0;
      if (!nextEntries.length) {
        const itemEl = document.createElement('li');
        itemEl.textContent = 'No recipes selected yet.';
        listEl.appendChild(itemEl);
        return;
      }
      nextEntries.forEach((entry) => attachRow(entry));
    }

    syncListBodyFromEntries(draftEntries);

    return {
      listEl,
      readEntries: () =>
        rowDrafts.map(({ recipeId, title, quantity }) => ({
          recipeId,
          title,
          quantity,
        })),
      canMenuPlanSave,
      canMenuPlanRevert,
      resyncFromRemotePlan: () => {
        if (canMenuPlanSave() || hasActiveQtyInput()) {
          remoteResyncPending = true;
          return;
        }
        replaceOpenSnapshot(snapshotOpenModalOverrideQtyByKey());
        syncListBodyFromEntries(getMenuPlanDialogEntries());
        notifyChanged();
      },
      setOnChange: (listener) => {
        onChange = typeof listener === 'function' ? listener : null;
        notifyChanged();
      },
      resetFrom: (nextEntries) => {
        const quantityByRecipeId = new Map(
          (Array.isArray(nextEntries) ? nextEntries : [])
            .map((entry) => {
              const recipeId = Number(entry?.recipeId);
              if (!Number.isFinite(recipeId) || recipeId <= 0) return null;
              return [recipeId, normalizeMenuPlanDialogPlanQty(entry?.quantity)];
            })
            .filter(Boolean),
        );
        rowDrafts.forEach((draft) => {
          draft.quantity = quantityByRecipeId.has(draft.recipeId)
            ? quantityByRecipeId.get(draft.recipeId)
            : draft.savedEffectiveQty;
          syncDraftDisplay(draft);
        });
        notifyChanged();
        tryApplyPendingRemoteResync();
      },
    };
  };
  const persistMenuPlanDialogEntries = (entries) => {
    const nextEntries = Array.isArray(entries) ? entries : [];
    updateShoppingPlan((plan) => {
      if (
        !plan.recipeMenuOverrides ||
        typeof plan.recipeMenuOverrides !== 'object'
      ) {
        plan.recipeMenuOverrides = {};
      }
      const canonical =
        plan.recipeSelections && typeof plan.recipeSelections === 'object'
          ? plan.recipeSelections
          : {};
      nextEntries.forEach((entry) => {
        const recipeId = Number(entry?.recipeId);
        const numericQty = Number(entry?.quantity);
        if (!Number.isFinite(recipeId) || recipeId <= 0) return;
        if (!Number.isFinite(numericQty) || numericQty <= 0) {
          const k0 = String(Math.trunc(recipeId));
          if (plan.recipeMenuOverrides && plan.recipeMenuOverrides[k0]) {
            delete plan.recipeMenuOverrides[k0];
          }
          return;
        }
        const key = String(Math.trunc(recipeId));
        const quartered = Math.round(numericQty * 4) / 4;
        const quantity = Math.max(0.25, Math.min(99, quartered));
        const canonicalQty = Number(canonical[key]?.quantity || 0);
        if (Math.abs(quantity - canonicalQty) < 1e-6) {
          delete plan.recipeMenuOverrides[key];
          return;
        }
        plan.recipeMenuOverrides[key] = {
          key,
          recipeId: Math.trunc(recipeId),
          quantity,
        };
      });
    });
    if (
      !menuPlanSupabasePushSuspended &&
      window.favoriteEatsDataApi &&
      typeof window.favoriteEatsDataApi.replaceMenuModalOverridesFromMap ===
        'function'
    ) {
      void window.favoriteEatsDataApi
        .replaceMenuModalOverridesFromMap(getShoppingPlanRecipeMenuOverrides())
        .catch((err) => console.error('❌ Menu overrides sync failed:', err));
    }
  };
  const openMenuPlanDialog = async () => {
    if (!window.ui || typeof window.ui.dialog !== 'function') return;
    const openModalOverrideQtyByKey = snapshotOpenModalOverrideQtyByKey();
    const autoGeneratedEntries = getMenuPlanDialogEntries();
    const listState = buildMenuPlanDialogListNode(
      autoGeneratedEntries,
      openModalOverrideQtyByKey,
    );
    menuPlanDialogListStateRef = listState;
    try {
      await window.ui.dialog({
        title: 'Menu plan',
        message: "Here's what's on the menu. Bon appétit!",
        messageNode: listState.listEl,
        tertiaryText: 'Revert',
        cancelText: 'Cancel',
        confirmText: 'Save',
        confirmDisabled: !listState.canMenuPlanSave(),
        tertiaryDisabled: !listState.canMenuPlanRevert(),
        showClose: true,
        beforeDismiss: async (surface) => {
          if (!listState.canMenuPlanSave()) return true;
          surface.detach();
          const discardChoice = await window.ui.dialog({
            title: 'Discard changes',
            message:
              'You have unsaved changes. Are you sure you want to discard them?',
            cancelText: 'Go back',
            confirmText: 'Discard',
            danger: true,
            showCancel: true,
            closeOnBackdrop: true,
          });
          if (discardChoice == null) {
            surface.attach();
            surface.focusPrimary();
            return false;
          }
          return true;
        },
        onReady: ({ setConfirmDisabled, setTertiaryDisabled }) => {
          listState.setOnChange(
            ({ canMenuPlanSave: canSave, canMenuPlanRevert: canRevert }) => {
              setConfirmDisabled(!canSave);
              setTertiaryDisabled(!canRevert);
            },
          );
        },
        onTertiary: () => {
          const baselineEntries = getMenuPlanDialogEntries().map((entry) => ({
            ...entry,
            quantity: Number.isFinite(Number(entry?.baselineQuantity))
              ? Number(entry.baselineQuantity)
              : Number(entry?.quantity || 0),
          }));
          listState.resetFrom(baselineEntries);
        },
        onConfirm: () => {
          persistMenuPlanDialogEntries(listState.readEntries());
        },
        closeOnBackdrop: true,
      });
    } finally {
      if (menuPlanDialogListStateRef === listState) {
        menuPlanDialogListStateRef = null;
      }
    }
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
    recipesActionBtn.disabled = false;
    recipesActionBtn.removeAttribute('aria-disabled');
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
  const collapseActiveRecipeRow = ({ cancelEdit = true } = {}) => {
    if (!activeRecipeKey) return false;
    const rowEl = Array.from(
      list.querySelectorAll('li[data-recipe-row-stepper-key]'),
    ).find((el) => el?.dataset?.recipeRowStepperKey === activeRecipeKey);
    const controls = rowEl?._recipeRowStepperControls;
    if (controls && typeof controls.collapse === 'function') {
      controls.collapse({ cancelEdit });
      return true;
    }
    activeRecipeKey = '';
    return true;
  };
  const syncRecipeRowSelectionState = (rowEl, recipeRow) => {
    if (!(rowEl instanceof HTMLElement) || !recipeRow) return;
    const recipeId = recipeRow.id;
    const enabled = isRecipeWebSelectMode();
    const selected = isRecipeSelected(recipeId);
    const recipeKey = getRecipeQtyKey(recipeId);
    const isActive = selected && recipeKey && recipeKey === activeRecipeKey;
    const icon = rowEl.querySelector('.shopping-list-row-icon');
    const stepper = rowEl.querySelector('.shopping-list-row-stepper');
    const badge = rowEl.querySelector('.shopping-list-row-badge');
    const disabledIndicator = rowEl.querySelector(
      '.recipe-list-servings-disabled',
    );
    const qtyEl = stepper?.querySelector('.shopping-stepper-qty');
    const minusBtn = stepper?.querySelector('.shopping-stepper-btn');
    const minusIcon = minusBtn?.querySelector('.material-symbols-outlined');
    const displayServings = selected ? getRecipeSelectionQty(recipeId) : null;
    const formattedServings =
      displayServings == null || displayServings <= 0
        ? ''
        : formatRecipeRowServings(displayServings);
    const shouldDeleteOnDecrease = selected && displayServings <= 1;

    rowEl.dataset.recipeServingsAvailable = 'true';
    rowEl.dataset.recipeSelected = enabled && selected ? 'true' : 'false';
    rowEl.classList.toggle(
      'shopping-row-checked',
      enabled && selected,
    );

    const servingsSlot = rowEl.querySelector('.recipe-list-servings-slot');
    if (servingsSlot) {
      servingsSlot.classList.toggle(
        'recipe-list-servings-slot--collapsed-hit',
        !!(enabled && !isActive),
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

    if (icon) icon.style.display = 'inline-block';
    if (stepper) stepper.style.display = 'none';
    if (badge) badge.style.display = 'none';
  };
  const collapseRecipeSelectionUi = () => {
    const changed = collapseActiveRecipeRow();
    if (changed) rerenderFilteredRecipes();
  };
  const hydrateRecipeSelectionsFromPlan = () => {
    recipeSelectionKeys.clear();
    Object.values(getShoppingPlanRecipeSelections()).forEach((entry) => {
      const recipeId = Number(entry?.recipeId);
      const quantity = Math.max(0, Math.min(99, Number(entry?.quantity || 0)));
      if (!Number.isFinite(recipeId) || recipeId <= 0) return;
      if (!Number.isFinite(quantity) || quantity <= 0) return;
      recipeSelectionKeys.add(getRecipeQtyKey(recipeId));
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

      const consumeRowStepperEvent = (event) => {
        event.preventDefault();
        event.stopPropagation();
      };
      let idleTimerId = null;
      let isExpanded = activeRecipeKey === recipeKey && isRecipeSelected(id);
      let currentInput = null;

      const clearIdleTimer = () => {
        if (idleTimerId != null) {
          window.clearTimeout(idleTimerId);
          idleTimerId = null;
        }
      };

      const scheduleAutoCollapse = () => {
        clearIdleTimer();
        if (!isExpanded || currentInput) return;
        idleTimerId = window.setTimeout(() => {
          if (activeRecipeKey !== recipeKey || currentInput) return;
          isExpanded = false;
          activeRecipeKey = '';
          syncUi();
        }, 3500);
      };

      const setRowQty = (nextQty) => {
        setRecipeSelectionQty(row, nextQty);
        if (!isRecipeSelected(id)) {
          isExpanded = false;
          if (activeRecipeKey === recipeKey) activeRecipeKey = '';
          clearIdleTimer();
        }
        syncRecipesActionButtonState();
      };

      const syncUi = () => {
        if (!isRecipeSelected(id) && activeRecipeKey === recipeKey) {
          activeRecipeKey = '';
          isExpanded = false;
        }
        isExpanded = !!(isExpanded && activeRecipeKey === recipeKey);
        syncRecipeRowSelectionState(li, row);
        const displayServings = getRecipeSelectionQty(id);
        minusBtn.disabled = !isRecipeSelected(id);
        plusBtn.disabled = displayServings >= 99;
      };

      const expandRow = ({ ensurePositive = false } = {}) => {
        if (activeRecipeKey && activeRecipeKey !== recipeKey) {
          collapseActiveRecipeRow();
        }
        activeRecipeKey = recipeKey;
        isExpanded = true;
        if (ensurePositive && !isRecipeSelected(id)) {
          setRowQty(1);
        }
        syncUi();
        scheduleAutoCollapse();
      };

      const finishDeferredRecipeRender = () => {
        if (!recipeRenderDeferred || isRecipeRowInlineEditLive()) return;
        recipeRenderDeferred = false;
        rerenderFilteredRecipes();
      };

      const startInlineServingsEdit = () => {
        if (!isRecipeWebSelectMode() || !isRecipeSelected(id)) return;
        if (currentInput) return;
        expandRow();
        clearIdleTimer();
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'shopping-stepper-qty shopping-stepper-qty-input';
        input.inputMode = 'decimal';
        input.setAttribute('aria-label', 'Servings value');
        const fallbackValue = getRecipeSelectionQty(id);
        input.value =
          fallbackValue == null || fallbackValue <= 0
            ? ''
            : Number.isInteger(fallbackValue)
              ? String(fallbackValue)
              : String(fallbackValue);
        currentInput = input;
        setRecipeRowInlineEditInput(input);
        stepper.replaceChild(input, qtyBtn);
        input.focus();
        input.select();

        let cancelled = false;
        let finished = false;
        const finishEdit = (shouldCommit) => {
          if (finished) return;
          finished = true;
          if (recipeRowInlineEditInput === input) setRecipeRowInlineEditInput();
          if (
            shouldCommit
          ) {
            const raw = String(input.value || '').trim();
            const parsed =
              raw && typeof recipeWebServingsUi.parseInputValue === 'function'
                ? recipeWebServingsUi.parseInputValue(raw)
                : raw
                  ? Number(raw)
                  : 0;
            const numeric = raw ? Number(parsed) : 0;
            const nextQty = Number.isFinite(numeric) ? numeric : fallbackValue;
            setRowQty(nextQty);
          }
          if (input.parentNode === stepper) {
            stepper.replaceChild(qtyBtn, input);
          }
          currentInput = null;
          syncUi();
          scheduleAutoCollapse();
          finishDeferredRecipeRender();
        };

        input.addEventListener('click', consumeRowStepperEvent);
        input.addEventListener('pointerdown', (event) =>
          event.stopPropagation(),
        );
        input.addEventListener('keydown', (event) => {
          event.stopPropagation();
          if (event.key === 'Enter') {
            event.preventDefault();
            finishEdit(true);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelled = true;
            finishEdit(false);
          }
        });
        input.addEventListener('blur', () => {
          if (cancelled) return;
          finishEdit(true);
        });
      };

      li._recipeRowStepperControls = {
        collapse({ cancelEdit = true } = {}) {
          clearIdleTimer();
          if (cancelEdit && currentInput) {
            const input = currentInput;
            currentInput = null;
            if (recipeRowInlineEditInput === input) setRecipeRowInlineEditInput();
            if (input.parentNode === stepper) {
              stepper.replaceChild(qtyBtn, input);
            }
          }
          isExpanded = false;
          if (activeRecipeKey === recipeKey) activeRecipeKey = '';
          syncUi();
        },
      };

      slot.addEventListener('click', (event) => {
        if (!isRecipeWebSelectMode()) return;
        if (disabledIndicator.contains(event.target)) return;

        const isStepperVisible = stepper.style.display === 'inline-flex';
        if (isStepperVisible && stepper.contains(event.target)) return;

        const selectedNow = isRecipeSelected(id);
        if (isStepperVisible && activeRecipeKey === recipeKey) {
          consumeRowStepperEvent(event);
          return;
        }

        consumeRowStepperEvent(event);

        if (!selectedNow) {
          expandRow({ ensurePositive: true });
        } else {
          expandRow();
        }
      });
      slot.addEventListener('pointerdown', (event) => {
        if (!isRecipeWebSelectMode()) return;
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
        expandRow();
        const displayServings = getRecipeSelectionQty(id);
        if (displayServings <= 1) {
          setRowQty(0);
          syncUi();
          return;
        }
        const nextQty =
          listRowStepper && typeof listRowStepper.getNextStepQty === 'function'
            ? listRowStepper.getNextStepQty(displayServings, -1, {
                min: 0,
                max: 99,
              })
            : displayServings - 1;
        setRowQty(nextQty);
        syncUi();
        scheduleAutoCollapse();
      });

      plusBtn.addEventListener('click', (event) => {
        consumeRowStepperEvent(event);
        if (!isRecipeWebSelectMode()) return;
        expandRow({ ensurePositive: true });
        const displayServings = getRecipeSelectionQty(id);
        const nextQty =
          listRowStepper && typeof listRowStepper.getNextStepQty === 'function'
            ? listRowStepper.getNextStepQty(displayServings, 1, {
                min: 0,
                max: 99,
              })
            : Math.min(99, Math.max(0, displayServings) + 1);
        setRowQty(nextQty);
        syncUi();
        scheduleAutoCollapse();
      });

      syncUi();

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
    if (isRecipeRowInlineEditLive()) {
      recipeRenderDeferred = true;
      return;
    }
    const filtered = getFilteredRecipeRows();
    renderTagFilterChips(recipeRows);
    renderRecipeList(filtered);
  };
  document.addEventListener(
    'mousedown',
    (event) => {
      if (isRecipeRowInlineEditLive()) return;
      const target = event.target;
      if (target instanceof Node && list.contains(target)) return;
      if (collapseActiveRecipeRow()) rerenderFilteredRecipes();
    },
    true,
  );
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
  await hydrateShoppingPlanFromSupabase(recipeRows);
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
  let unsubscribeMenuPlanRealtime = null;
  if (typeof dataApi.subscribeMenuPlanChanges === 'function') {
    unsubscribeMenuPlanRealtime = dataApi.subscribeMenuPlanChanges({
      onChange: () => {
        void (async () => {
          try {
            const remote = await dataApi.fetchMenuPlanState();
            applyRemoteMenuPlanStateToCache(remote, recipeRows);
            hydrateRecipeSelectionsFromPlan();
            rerenderFilteredRecipes();
            if (
              menuPlanDialogListStateRef &&
              typeof menuPlanDialogListStateRef.resyncFromRemotePlan ===
                'function'
            ) {
              menuPlanDialogListStateRef.resyncFromRemotePlan();
            }
          } catch (err) {
            console.error('❌ Menu plan refresh failed:', err);
          }
        })();
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
      if (typeof unsubscribeMenuPlanRealtime === 'function') {
        unsubscribeMenuPlanRealtime();
      }
      unsubscribeMenuPlanRealtime = null;
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
    void openCreateRecipeDialog();
  };
  const syncRecipesAppBarActionChrome = () => {
    if (!recipesActionBtn) return;
    ensureAppBarTextActionPair(recipesActionBtn, 'Add', 'add');
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
  if (recipesMenuBtn) {
    ensureAppBarTextActionPair(recipesMenuBtn, 'Menu', 'restaurant_menu');
    recipesMenuBtn.addEventListener('click', () => {
      void openMenuPlanDialog();
    });
  }
}

// --- Shared helper for child editor pages (e.g. recipe editor) ---
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
  }

  const bottomNavEditorToggle = document.getElementById('bottomNavEditorToggle');
  if (bottomNavEditorToggle && pillRow instanceof HTMLElement) {
    bottomNavEditorToggle.checked = false;
    bottomNavEditorToggle.addEventListener('change', () => {
      // Planner/force-web is disabled; control retained for a future real toggle.
      console.log('[Editing nav toggle]', {
        checked: bottomNavEditorToggle.checked,
        singleUiState: SINGLE_UI_STATE,
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
  void db;
  return new Set();
}

function createIngredientVisibilitySql(colsSet) {
  void colsSet;
  return '1 = 1';
}

function getVisibleIngredientNamePool(db) {
  void db;
  return [];
}

function createIngredientLookupHelpers(db) {
  void db;
  const getVisibleCanonicalId = () => null;
  const anyIngredientNamed = () => false;
  return { getVisibleCanonicalId, anyIngredientNamed };
}

// --- Recipe editor loader (title-only shell) ---
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
  const isRecipeWebMode = false;
  let recipe = null;
  try {
    recipe = await dataApi.getRecipeById(Number(recipeId));
  } catch (err) {
    console.error('❌ Failed to load recipe from Supabase:', err);
  }
  try {
    window.recipeEditorTagOptions = (await dataApi.listVisibleTags()) || [];
  } catch (err) {
    console.warn('⚠️ Failed to load tag catalog:', err);
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

  try {
    sessionStorage.removeItem('selectedRecipeIsNew');
  } catch (_) {}

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
  const recipeEditorMenuPlanBtn = document.getElementById('appBarMenuPlanBtn');
  if (recipeEditorMenuPlanBtn) {
    recipeEditorMenuPlanBtn.hidden = true;
    recipeEditorMenuPlanBtn.style.display = 'none';
  }

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


