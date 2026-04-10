// Shared SQL.js init (offline / local version)
let SQL;

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

function uiAlert(title, message) {
  try {
    if (window.ui && typeof window.ui.alert === 'function') {
      return window.ui.alert({
        title: String(title || ''),
        message: String(message || ''),
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

function attachSecretGalleryShortcut(addBtn) {
  if (!addBtn) return;
  const handler = (e) => {
    if (!e) return;
    const secret = e.ctrlKey || e.metaKey;
    if (!secret) return;
    e.preventDefault();
    e.stopPropagation();
    window.location.href = 'dialog-gallery.html';
  };
  addBtn.addEventListener('pointerdown', handler, { capture: true });
  addBtn.addEventListener('click', handler, { capture: true });
}

const FORCE_WEB_MODE_STORAGE_KEY = 'favoriteEatsForceWebMode';

function isForceWebModeEnabled() {
  try {
    return localStorage.getItem(FORCE_WEB_MODE_STORAGE_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function applyForceWebModePresentation(enabled = isForceWebModeEnabled()) {
  const body = document.body;
  if (!(body instanceof HTMLElement)) return !!enabled;

  const forceWebMode = !!enabled;
  body.dataset.forceWebMode = forceWebMode ? 'on' : 'off';
  body.dataset.pageSet = forceWebMode ? 'web' : 'editor';
  body.classList.toggle('force-web-mode', forceWebMode);
  return forceWebMode;
}

function setForceWebModeEnabled(enabled) {
  const next = !!enabled;
  try {
    localStorage.setItem(FORCE_WEB_MODE_STORAGE_KEY, next ? '1' : '0');
  } catch (_) {}
  return applyForceWebModePresentation(next);
}

function getTopLevelPageOrder() {
  return isForceWebModeEnabled()
    ? ['recipes', 'shopping', 'shopping-list', 'stores']
    : ['recipes', 'shopping', 'stores', 'tags', 'sizes', 'units'];
}

function getTopLevelPageHref(pageId) {
  const key = String(pageId || '').trim().toLowerCase();
  if (!key) return 'index.html';
  if (key === 'shopping-list') return 'shoppingList.html';
  return `${key}.html`;
}

applyForceWebModePresentation();
window.forceWebMode = Object.freeze({
  isEnabled: isForceWebModeEnabled,
  setEnabled: setForceWebModeEnabled,
  apply: applyForceWebModePresentation,
});

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
    el?.closest?.('#appBarSearchInput') || active?.closest?.('#appBarSearchInput')
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

function wireTypeToAppBarSearch(searchInput) {
  if (!(searchInput instanceof HTMLInputElement)) return;

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

    searchInput.focus();
    searchInput.value = nextValue;

    try {
      const caret = start + e.key.length;
      searchInput.setSelectionRange(caret, caret);
    } catch (_) {}

    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  };

  document.addEventListener('keydown', onKeyDown, true);
}

function wireAppBarSearch(searchInput, options = {}) {
  if (!(searchInput instanceof HTMLInputElement)) return null;

  const {
    clearBtn = document.getElementById('appBarSearchClear'),
    onQueryChange = null,
    normalizeQuery = (value) => String(value || '').trim(),
    enableTypeToSearch = true,
  } = options;

  if (enableTypeToSearch) wireTypeToAppBarSearch(searchInput);

  const syncClearBtn = () => {
    if (!(clearBtn instanceof HTMLElement)) return;
    clearBtn.style.display = searchInput.value ? 'inline' : 'none';
  };

  const emitQueryChange = () => {
    syncClearBtn();
    if (typeof onQueryChange === 'function') {
      onQueryChange(normalizeQuery(searchInput.value), searchInput.value);
    }
  };

  syncClearBtn();
  searchInput.addEventListener('input', emitQueryChange);

  if (clearBtn instanceof HTMLElement) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      emitQueryChange();
      searchInput.focus();
    });
  }

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      searchInput.blur();
    }
  });

  return {
    clearBtn,
    syncClearBtn,
    emitQueryChange,
  };
}

function renderTopLevelEmptyState(listEl, message) {
  if (!(listEl instanceof HTMLElement)) return;
  listEl.innerHTML = '';
  const li = document.createElement('li');
  li.className = 'list-section-label top-level-empty-state';
  const parts = Array.isArray(message)
    ? message.map((s) => String(s || '').trim()).filter(Boolean)
    : [String(message || '').trim()].filter(Boolean);
  if (parts.length <= 1) {
    li.textContent = parts[0] || '';
  } else {
    parts.forEach((text) => {
      const p = document.createElement('p');
      p.textContent = text;
      li.appendChild(p);
    });
  }
  listEl.appendChild(li);
}

function normalizeRecipeTagList(rawTags) {
  const source = Array.isArray(rawTags)
    ? rawTags
    : String(rawTags || '').split('\n');
  const seen = new Set();
  const out = [];
  source
    .map((v) => String(v || '').trim().replace(/\s+/g, ' '))
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
    /^(\d+(?:\.\d+)?)\s*(oz|ounce|ounces|g|gram|grams|kg|kilogram|kilograms|lb|lbs|pound|pounds|ml|milliliter|milliliters|l|liter|liters)$/
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
    value && typeof value === 'object' ? value.name : value
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
  return (Array.isArray(values) ? values.slice() : []).sort(compareSizeDisplayValues);
}

function sortSizeRows(rows) {
  return (Array.isArray(rows) ? rows.slice() : []).sort(compareSizeDisplayValues);
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
  tsp: Object.freeze({ family: 'volume', baseUnit: 'ml', factor: 4.92892159375 }),
  tbsp: Object.freeze({ family: 'volume', baseUnit: 'ml', factor: 14.78676478125 }),
  cup: Object.freeze({ family: 'volume', baseUnit: 'ml', factor: 236.5882365 }),
  'fl oz': Object.freeze({ family: 'volume', baseUnit: 'ml', factor: 29.5735295625 }),
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
  'fluidounce': 'fl oz',
  'fluidounces': 'fl oz',
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
  return Number.isFinite(rounded) && rounded > 0 ? rounded : Number(numeric.toFixed(2));
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
      displayUnit
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
      const tablespoons = numeric / SHOPPING_LIST_MEASURED_UNIT_META.tbsp.factor;
      if (tablespoons >= 1 - 1e-9) displayUnit = 'tbsp';
    }
    const unitMeta = SHOPPING_LIST_MEASURED_UNIT_META[displayUnit];
    const displayQuantity = roundShoppingListDisplayQuantity(
      numeric / unitMeta.factor,
      displayUnit
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

function getShoppingListIngredientLabel(name, variantName = '') {
  const displayFields = getShoppingListDisplayFields(name, variantName);
  const fallbackVariant =
    String(variantName || '').trim() &&
    String(variantName || '').trim().toLowerCase() !== 'default' &&
    !isShoppingListSizeVariant(variantName)
      ? variantName
      : '';
  const fallback = [String(fallbackVariant || '').trim(), String(name || '').trim()]
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
  const fallbackName = [String(source.variant || '').trim(), String(source.name || '').trim()]
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
  ])
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
  ])
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
        })?.nameText || ''
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
  return normalizedUnit ? SHOPPING_LIST_SINGULAR_UNIT_TOKENS.has(normalizedUnit) : false;
}

function formatShoppingListAmountLeadText({ quantity = '', size = '', unit = '' } = {}) {
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
        })?.leadText || ''
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
  if (
    bucket.kind === 'selected' ||
    bucket.kind === 'unspecified' ||
    bucket.kind === 'count'
  ) {
    return 0;
  }
  return 1;
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
    return formatShoppingListAmountLeadText({
      quantity: bucket.quantity,
      size: quantitySizePrefix,
    });
  }
  if (bucket.kind === 'measured') {
    const display = getShoppingListMeasuredDisplayFromBase(
      bucket.family,
      bucket.baseQuantity
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

function formatShoppingListDisplayDetailText({ variantName = '', buckets = [] } = {}) {
  const displayFields = getShoppingListDisplayFields('', variantName);
  const list = Array.isArray(buckets) ? buckets.filter(Boolean) : [];
  if (!list.length) return '';
  return list
    .slice()
    .sort((a, b) => getShoppingListBucketSortPriority(a) - getShoppingListBucketSortPriority(b))
    .map((bucket) =>
      getShoppingListBucketLeadText(bucket, {
        quantitySizePrefix: displayFields.quantitySizePrefix,
      })
    )
    .filter(Boolean)
    .join(' + ');
}

function formatShoppingListDisplayRow({ label = '', name = '', variantName = '', buckets = [] } = {}) {
  const displayFields = getShoppingListDisplayFields(name, variantName);
  const resolvedLabel =
    String(label || '').trim() || displayFields.displayName || getShoppingListIngredientLabel(name, variantName);
  if (!resolvedLabel) return '';
  const detailText = formatShoppingListDisplayDetailText({ variantName, buckets });
  if (!detailText) return resolvedLabel;
  return `${resolvedLabel} (${detailText})`;
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

function tableHasColumnInMain(db, tableName, colName) {
  if (!db || !tableName || !colName) return false;
  try {
    const q = db.exec(`PRAGMA table_info(${tableName});`);
    const cols =
      Array.isArray(q) && q.length > 0 && Array.isArray(q[0].values)
        ? q[0].values
            .map((r) => String((Array.isArray(r) ? r[1] : '') || '').toLowerCase())
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
    const listQ = db.exec(`PRAGMA index_list('ingredient_variant_store_location');`);
    const rows = Array.isArray(listQ) && listQ.length > 0 && Array.isArray(listQ[0].values)
      ? listQ[0].values
      : [];
    rows.forEach((row) => {
      const indexName = String((Array.isArray(row) ? row[1] : '') || '').trim();
      const isUnique = Number(Array.isArray(row) ? row[2] : 0) === 1;
      if (!indexName || !isUnique) return;
      try {
        const infoQ = db.exec(`PRAGMA index_info(${JSON.stringify(indexName)});`);
        const infoRows =
          Array.isArray(infoQ) && infoQ.length > 0 && Array.isArray(infoQ[0].values)
            ? infoQ[0].values
            : [];
        const cols = infoRows
          .map((infoRow) => String((Array.isArray(infoRow) ? infoRow[2] : '') || '').trim())
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
        sort_order INTEGER
      );
    `);
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
      db.run('ALTER TABLE sizes ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;');
    }
  } catch (_) {}
  try {
    if (!tableHasColumnInMain(db, 'sizes', 'is_removed')) {
      db.run('ALTER TABLE sizes ADD COLUMN is_removed INTEGER NOT NULL DEFAULT 0;');
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
      db.run('ALTER TABLE units ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;');
    }
  } catch (_) {}
  try {
    if (!tableHasColumnInMain(db, 'units', 'is_removed')) {
      db.run('ALTER TABLE units ADD COLUMN is_removed INTEGER NOT NULL DEFAULT 0;');
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
  const binaryArray = db.export();
  if (isElectron) {
    const ok = await window.electronAPI.saveDB(binaryArray);
    if (ok === false) throw new Error('Failed to save database.');
  } else {
    localStorage.setItem('favoriteEatsDb', JSON.stringify(Array.from(binaryArray)));
  }
}

async function ensureIngredientLemmaMaintenanceInMain(db, isElectron) {
  if (!db || !window.bridge) return 0;
  const canBackfillIngredientHomeLocations = () => {
    try {
      const info = db.exec('PRAGMA table_info(ingredients);');
      const rows =
        Array.isArray(info) && info.length > 0 && Array.isArray(info[0].values)
          ? info[0].values
          : [];
      const cols = new Set(
        rows
          .map((r) =>
            Array.isArray(r) ? String(r[1] || '').trim().toLowerCase() : '',
          )
          .filter(Boolean),
      );
      return cols.has('name') && cols.has('location_at_home');
    } catch (_) {
      return false;
    }
  };
  const backfillIngredientHomeLocationsByName = () => {
    if (!canBackfillIngredientHomeLocations()) return 0;
    try {
      db.run(`
        UPDATE ingredients
        SET location_at_home = (
          SELECT lower(trim(i2.location_at_home))
          FROM ingredients i2
          WHERE lower(trim(i2.name)) = lower(trim(ingredients.name))
            AND trim(COALESCE(i2.location_at_home, '')) != ''
          ORDER BY i2.ID ASC
          LIMIT 1
        )
        WHERE trim(COALESCE(location_at_home, '')) = ''
          AND EXISTS (
            SELECT 1
            FROM ingredients i4
            WHERE lower(trim(i4.name)) = lower(trim(ingredients.name))
              AND trim(COALESCE(i4.location_at_home, '')) != ''
          )
          AND (
            SELECT COUNT(DISTINCT lower(trim(i3.location_at_home)))
            FROM ingredients i3
            WHERE lower(trim(i3.name)) = lower(trim(ingredients.name))
              AND trim(COALESCE(i3.location_at_home, '')) != ''
          ) = 1;
      `);
      const updated = Number(db.getRowsModified?.() || 0);
      if (!Number.isFinite(updated) || updated <= 0) return 0;

      // Normalize any residual whitespace/casing noise for known values.
      db.run(`
        UPDATE ingredients
        SET location_at_home = lower(trim(location_at_home))
        WHERE location_at_home IS NOT NULL
          AND location_at_home != lower(trim(location_at_home));
      `);
      const normalized = Number(db.getRowsModified?.() || 0);
      return updated + (Number.isFinite(normalized) ? normalized : 0);
    } catch (err) {
      console.warn('⚠️ Failed to backfill ingredient home locations:', err);
      return 0;
    }
  };

  let lemmaChangedCount = 0;
  try {
    if (typeof window.bridge.regenerateAllIngredientLemmas === 'function') {
      lemmaChangedCount = Number(window.bridge.regenerateAllIngredientLemmas(db)) || 0;
    }
  } catch (err) {
    console.warn('⚠️ Failed to regenerate ingredient lemmas:', err);
    lemmaChangedCount = 0;
  }
  const backfilledHomeLocationCount = backfillIngredientHomeLocationsByName();
  const changedCount =
    (Number.isFinite(lemmaChangedCount) ? lemmaChangedCount : 0) +
    (Number.isFinite(backfilledHomeLocationCount)
      ? backfilledHomeLocationCount
      : 0);
  if (changedCount <= 0) return 0;
  try {
    await persistLoadedDbInMain(db, isElectron);
    if (lemmaChangedCount > 0) {
      console.info(`ℹ️ Regenerated ${lemmaChangedCount} ingredient lemma value(s).`);
    }
    if (backfilledHomeLocationCount > 0) {
      console.info(
        `ℹ️ Backfilled/normalized ${backfilledHomeLocationCount} ingredient home location value(s).`,
      );
    }
  } catch (err) {
    console.warn('⚠️ Failed to persist ingredient maintenance updates:', err);
  }
  return changedCount;
}

function deriveIngredientLemmaInMain(rawTitle) {
  if (typeof window.bridge?.deriveIngredientLemma === 'function') {
    return String(window.bridge.deriveIngredientLemma(rawTitle) || '').trim();
  }
  return String(rawTitle || '').trim();
}

const LAST_PAGE_SESSION_KEY = 'favoriteEats:last-page-id';
const SHOPPING_FILTER_CHIPS_SESSION_KEY = 'favoriteEats:shopping-filter-chips';
const SHOPPING_SCROLL_RESTORE_SESSION_KEY = 'favoriteEats:shopping-scroll-restore-y';
// --- Shopping plan helpers (tests extract this block) ---
const SHOPPING_PLAN_STORAGE_KEY = 'favoriteEats:shopping-plan:v1';
const SHOPPING_PLAN_KEY_SEP = '\x00';
let shoppingPlanCache = null;

function loadRecipeWebServingsMap() {
  const api = window.favoriteEatsRecipeWebServings || {};
  if (typeof api.loadMap === 'function') return api.loadMap();
  try {
    const raw = localStorage.getItem(window.favoriteEatsStorageKeys.recipeWebServings);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
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
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric * 2) / 2 : null;
}

function getShoppingPlanAggregateKey(name, variantName = '') {
  const normalizedName = String(name || '').trim().toLowerCase();
  const normalizedVariant = String(variantName || '')
    .trim()
    .toLowerCase();
  if (!normalizedName) return '';
  if (!normalizedVariant || normalizedVariant === 'default') {
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
  return normalizeShoppingPlanSelectedStoreIds(getShoppingPlan()?.selectedStoreIds);
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

function setShoppingPlanItemSelection({ key, name = '', variantName = '', quantity = 0 }) {
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

function setShoppingPlanRecipeSelection({ recipeId, title = '', quantity = 0 }) {
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
  if (
    !db ||
    typeof db.exec !== 'function' ||
    !window.bridge ||
    typeof window.bridge.loadRecipeFromDB !== 'function'
  ) {
    return null;
  }
  try {
    return window.bridge.loadRecipeFromDB(db, recipeId);
  } catch (_) {
    return null;
  }
}

function getRecipeServingsMultiplierForShoppingPlan(recipeId, recipe) {
  const recipeDefaultServings = Number(
    recipe?.servings?.default != null
      ? recipe.servings.default
      : recipe?.servingsDefault
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
  if (!Number.isFinite(normalizedOuterMultiplier) || normalizedOuterMultiplier <= 0) {
    return;
  }

  const nextAncestors =
    ancestorRecipeIds instanceof Set ? new Set(ancestorRecipeIds) : new Set();
  if (Number.isFinite(normalizedRecipeId) && normalizedRecipeId > 0) {
    nextAncestors.add(normalizedRecipeId);
  }

  const servingsMultiplier = getRecipeServingsMultiplierForShoppingPlan(
    normalizedRecipeId,
    recipe
  );

  recipe.sections.forEach((section) => {
    const ingredients = Array.isArray(section?.ingredients)
      ? section.ingredients
      : [];
    ingredients.forEach((line) => {
      if (!line || line.rowType === 'heading' || line.isAlt) return;

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
              normalizedOuterMultiplier * servingsMultiplier * normalizedLinkQuantity,
            linkDepth: normalizedLinkDepth + 1,
            ancestorRecipeIds: nextAncestors,
          },
          visit
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
      (line, { recipeCount: expandedRecipeCount = 0, servingsMultiplier = 1 } = {}) => {
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
                  line.unit || ''
                )
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
      }
    );
  });

  return Array.from(aggregate.values());
}

// --- Shopping list grouping helpers (tests extract this block) ---
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
  const normalizedVariantRankA = Number.isFinite(variantRankA) ? variantRankA : -1;
  const normalizedVariantRankB = Number.isFinite(variantRankB) ? variantRankB : -1;
  if (normalizedVariantRankA !== normalizedVariantRankB) {
    return normalizedVariantRankA - normalizedVariantRankB;
  }
  const aisleSortA = Number(a?.aisleSortOrder);
  const aisleSortB = Number(b?.aisleSortOrder);
  const normalizedAisleSortA = Number.isFinite(aisleSortA) ? aisleSortA : 999999;
  const normalizedAisleSortB = Number.isFinite(aisleSortB) ? aisleSortB : 999999;
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
  const normalizedName = String(name || '').trim().toLowerCase();
  const normalizedVariant = String(variantName || '')
    .trim()
    .toLowerCase();
  if (!normalizedName) return '';
  if (!normalizedVariant || normalizedVariant === 'default') return normalizedName;
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
        Number.isFinite(storeId) && storeId > 0 && Number.isFinite(aisleId) && aisleId > 0
          ? `${storeId}:${aisleId}`
          : `${storeId}:${aisleId}:${aisleLabel.toLowerCase()}`;
      if (seen.has(dedupeKey)) {
        const existingIndex = seen.get(dedupeKey);
        const existingCandidate = merged[existingIndex];
        if (
          compareShoppingListAssignmentCandidates(candidate, existingCandidate) < 0
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
  {
    variantAssignmentMap = null,
    variantOrderMap = null,
  } = {},
) {
  const hasGetter = (value) => !!value && typeof value.get === 'function';
  const nameKey = String(name || '').trim().toLowerCase();
  if (!nameKey || !hasGetter(variantAssignmentMap) || !hasGetter(variantOrderMap)) {
    return [];
  }
  const orderedVariants = Array.isArray(variantOrderMap.get(nameKey))
    ? variantOrderMap.get(nameKey)
    : [];
  if (!orderedVariants.length) return [];
  const rankedCandidates = [];
  orderedVariants.forEach((variantName, variantRank) => {
    const assignmentKey = getShoppingListVariantAssignmentKey(nameKey, variantName);
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
  const nameKey = String(row?.name || '').trim().toLowerCase();
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
    nameKey && hasGetter(baseAssignmentMap) ? baseAssignmentMap.get(nameKey) || [] : [];
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
  return mergeShoppingListAssignmentCandidates(baseCandidates, anyVariantCandidates);
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
    const incomingSort = Number.isFinite(Number(chosenAssignment.aisleSortOrder))
      ? Number(chosenAssignment.aisleSortOrder)
      : 999999;
    if (!storeGroup.aisles.has(aisleId)) {
      storeGroup.aisles.set(aisleId, {
        aisleId,
        aisleLabel:
          String(chosenAssignment.aisleLabel || '').trim() || `Aisle ${aisleId}`,
        aisleSortOrder: incomingSort,
        items: [],
      });
    } else {
      const bucket = storeGroup.aisles.get(aisleId);
      const curSort = bucket.aisleSortOrder;
      const curPlaceholder = !Number.isFinite(curSort) || curSort >= 999999;
      const incomingPlaceholder = !Number.isFinite(incomingSort) || incomingSort >= 999999;
      const preferIncoming =
        incomingSort < curSort || (curPlaceholder && !incomingPlaceholder);
      if (preferIncoming) {
        bucket.aisleSortOrder = incomingSort;
        bucket.aisleLabel =
          String(chosenAssignment.aisleLabel || '').trim() || `Aisle ${aisleId}`;
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

function getShoppingPlanSelectionRows(options = {}) {
  const db = options?.db || window.dbInstance;
  const visibleNameKeys =
    db && typeof db.exec === 'function'
      ? new Set(
          getVisibleIngredientNamePool(db).map((name) =>
            String(name || '').trim().toLowerCase(),
          ),
        )
      : null;
  const aggregate = new Map();
  const ensureRow = ({ name = '', variantName = '' } = {}) => {
    const resolvedName = String(name || '').trim();
    const resolvedVariantName = String(variantName || '').trim();
    if (!resolvedName) return null;
    const key = getShoppingPlanAggregateKey(resolvedName, resolvedVariantName);
    if (!key) return null;
    const nameKey = resolvedName.toLowerCase();
    if (visibleNameKeys instanceof Set && !visibleNameKeys.has(nameKey)) return null;
    if (!aggregate.has(key)) {
      aggregate.set(key, {
        key,
        name: resolvedName,
        variantName: resolvedVariantName,
        label: getShoppingListIngredientLabel(resolvedName, resolvedVariantName),
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
        (Number(existing.baseQuantity || 0) + Number(bucket.baseQuantity || 0)).toFixed(6)
      );
      return;
    }
    existing.quantity = Number(
      (Number(existing.quantity || 0) + Number(bucket.quantity || 0)).toFixed(4)
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
    { recipeId = null, recipeTitle = '', recipeCount = 0, servingsMultiplier = 1 } = {},
  ) => {
    if (!line || typeof line !== 'object') return;
    if (line.rowType === 'heading' || line.isAlt || line.isRecipe) return;
    const name = String(line.name || '').trim();
    if (!name) return;
    const variantName = String(line.variant || '').trim();
    const row = ensureRow({ name, variantName });
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
              line.unit || ''
            )
          )
        : Number(scaledPerRecipeQuantityRaw.toFixed(4));
    if (!Number.isFinite(scaledPerRecipeQuantity) || scaledPerRecipeQuantity <= 0) return;

    const nextQuantity = Number((scaledPerRecipeQuantity * recipeMultiplier).toFixed(4));
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) return;

    const normalizedUnit = normalizeShoppingListUnit(line.unit || '');
    const size = String(line.size || '').trim();
    const measured = convertShoppingListQuantityToMeasuredBase(
      nextQuantity,
      normalizedUnit
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

  if (
    db &&
    typeof db.exec === 'function' &&
    window.bridge &&
    typeof window.bridge.loadRecipeFromDB === 'function'
  ) {
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
        addRecipeIngredientBucket
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
      return {
        key: row.key,
        name: row.name,
        variantName: row.variantName,
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
            const sortDelta = Number(b.sortValue || 0) - Number(a.sortValue || 0);
            if (Math.abs(sortDelta) > 1e-9) return sortDelta;
            return String(a.title || '').localeCompare(String(b.title || ''), undefined, {
              sensitivity: 'base',
            });
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
      if (Array.isArray(storeQ) && storeQ.length && Array.isArray(storeQ[0].values)) {
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
          .map((row) => String(row?.name || '').trim().toLowerCase())
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
          if (Array.isArray(baseQ) && baseQ.length && Array.isArray(baseQ[0].values)) {
            baseQ[0].values.forEach(
              ([nameKey, storeIdRaw, aisleIdRaw, aisleName, aisleSortOrder]) => {
                const nameKeyNormalized = String(nameKey || '').trim().toLowerCase();
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
                  aisleLabel: String(aisleName || '').trim() || `Aisle ${aisleId}`,
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
              const nameKeyNormalized = String(nameKey || '').trim().toLowerCase();
              const variantKeyNormalized = String(variantKey || '').trim().toLowerCase();
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
                AND lower(trim(i.name)) IN (${namePh});
            `,
            [...effectiveStoreIds, ...uniqueNameKeys],
          );
          if (
            Array.isArray(variantAnyQ) &&
            variantAnyQ.length &&
            Array.isArray(variantAnyQ[0].values)
          ) {
            variantAnyQ[0].values.forEach(
              ([nameKey, storeIdRaw, aisleIdRaw, aisleName, aisleSortOrder]) => {
                const nameKeyNormalized = String(nameKey || '').trim().toLowerCase();
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
                  aisleLabel: String(aisleName || '').trim() || `Aisle ${aisleId}`,
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
                AND lower(trim(i.name)) IN (${namePh});
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
                const nameKeyNormalized = String(nameKey || '').trim().toLowerCase();
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
                  aisleLabel: String(aisleName || '').trim() || `Aisle ${aisleId}`,
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
  return (
    body.dataset.page ||
    (body.classList.contains('recipes-page')
      ? 'recipes'
      : body.classList.contains('recipe-editor-page')
        ? 'recipe-editor'
        : body.classList.contains('shopping-page')
          ? 'shopping'
          : body.classList.contains('shopping-list-page')
            ? 'shopping-list'
          : body.classList.contains('shopping-editor-page')
            ? 'shopping-editor'
            : body.classList.contains('units-page')
              ? 'units'
              : body.classList.contains('unit-editor-page')
                ? 'unit-editor'
                : body.classList.contains('sizes-page')
                  ? 'sizes'
                  : body.classList.contains('size-editor-page')
                    ? 'size-editor'
                : body.classList.contains('tags-page')
                  ? 'tags'
                  : body.classList.contains('tag-editor-page')
                    ? 'tag-editor'
                : body.classList.contains('stores-page')
                  ? 'stores'
                  : body.classList.contains('store-editor-page')
                    ? 'store-editor'
                    : null)
  );
}

function getLastVisitedPageId() {
  try {
    return String(sessionStorage.getItem(LAST_PAGE_SESSION_KEY) || '')
      .trim()
      .toLowerCase();
  } catch (_) {
    return '';
  }
}

function markCurrentPageAsLastVisited() {
  try {
    const previous = getLastVisitedPageId();
    window.__favoriteEatsPreviousPageId = previous;
  } catch (_) {
    window.__favoriteEatsPreviousPageId = '';
  }
  try {
    const current = detectPageIdFromBody();
    if (!current) return;
    sessionStorage.setItem(LAST_PAGE_SESSION_KEY, String(current).toLowerCase());
  } catch (_) {}
}

// Track previous page id across full page navigations.
markCurrentPageAsLastVisited();

function enableTopLevelListKeyboardNav(listEl, options = {}) {
  if (!(listEl instanceof Element)) return null;
  const requireExistingSelectionForArrows = !!options.requireExistingSelectionForArrows;
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

  const getRows = () => Array.from(listEl.querySelectorAll('li'));

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
        if (e.target instanceof Node && listEl.contains(e.target)) return;
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

initSqlJs({
  locateFile: (file) => `js/${file}`, // load local sql-wasm.wasm
}).then((sql) => {
  SQL = sql;

  // --- page load routing ---

  const pageId = detectPageIdFromBody();

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

      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key))
        return;
      if (isTypingContext(e.target) && !isAppBarSearchContext(e.target)) return;
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
      if (isTypingContext(e.target) && !isAppBarSearchContext(e.target)) return;

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
    shopping: loadShoppingPage,
    'shopping-list': loadShoppingListPage,
    'shopping-editor': loadShoppingItemEditorPage,
    units: loadUnitsPage,
    'unit-editor': loadUnitEditorPage,
    sizes: loadSizesPage,
    'size-editor': loadSizeEditorPage,
    tags: loadTagsPage,
    'tag-editor': loadTagEditorPage,
    stores: loadStoresPage,
    'store-editor': loadStoreEditorPage,
  };

  if (pageId && pageLoaders[pageId]) {
    pageLoaders[pageId]();
  }
});

// Welcome page logic
const loadDbBtn = document.getElementById('loadDbBtn');
const dbLoader = document.getElementById('dbLoader');

// 🔑 Pressing Enter on the welcome screen behaves like clicking "Load Recipes"
if (document.body.classList.contains('welcome-page')) {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      loadDbBtn?.click();
    }
  });
}

if (loadDbBtn && dbLoader) {
  loadDbBtn.addEventListener('click', async () => {
    const isElectron = !!window.electronAPI;

    if (isElectron) {
      // --- Electron flow ---
      try {
        // 1. Remember last folder
        const lastPath = localStorage.getItem('favoriteEatsDbPath');

        // 2. Prompt for DB file
        let dbPath = await window.electronAPI.pickDB(lastPath);
        if (!dbPath) {
          uiToast('No database selected.');
          return;
        }

        // 3. Save for next session
        localStorage.setItem('favoriteEatsDbPath', dbPath);

        // 4. Touch load once (validates path & sets ACTIVE_DB_PATH in main)
        await window.electronAPI.loadDB(dbPath);

        // 5. Navigate to recipes list
        window.location.href = 'recipes.html';
      } catch (err) {
        console.error('❌ Error loading database:', err);
        uiToast('Failed to load database — check console for details.');
      }
    } else {
      // --- Browser fallback flow (no Electron) ---
      dbLoader.click();
    }
  });

  dbLoader.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const Uints = new Uint8Array(reader.result);
      localStorage.setItem('favoriteEatsDb', JSON.stringify(Array.from(Uints)));
      window.location.href = 'recipes.html';
    };
    reader.readAsArrayBuffer(file);
  });
}

// Recipes page logic
async function loadRecipesPage() {
  const isElectron = !!window.electronAPI;
  let db;
  if (isElectron) {
    try {
      // prefer stored path; fall back to ACTIVE_DB_PATH in main
      const pathHint = localStorage.getItem('favoriteEatsDbPath') || null;
      const bytes = await window.electronAPI.loadDB(pathHint);
      const Uints = new Uint8Array(bytes);
      db = new SQL.Database(Uints);
    } catch (err) {
      console.error('❌ Failed to load DB from disk:', err);
      uiToast('No database loaded. Please go back to the welcome page.');
      return;
    }
  } else {
    // Browser fallback (keeps old behavior)
    const stored = localStorage.getItem('favoriteEatsDb');
    if (!stored) {
      uiToast('No database loaded. Please go back to the welcome page.');
      return;
    }
    const Uints = new Uint8Array(JSON.parse(stored));
    db = new SQL.Database(Uints);
  }

  // Expose DB on window so other helpers can optionally reuse it if needed
  window.dbInstance = db;
  await ensureIngredientLemmaMaintenanceInMain(db, isElectron);
  ensureRecipeTagsSchemaInMain(db);

  initAppBar({
    mode: 'list',
    titleText: 'Recipes',
  });

  // App bar is injected async; wait before wiring menu/search/add.
  if (typeof waitForAppBarReady === 'function') {
    await waitForAppBarReady();
  }
  initBottomNav();

  const addBtnRecipes = document.getElementById('appBarAddBtn');
  const recipesActionBtn = addBtnRecipes;
  attachSecretGalleryShortcut(addBtnRecipes);

  const list = document.getElementById('recipeList');
  if (!list) return;
  ensureRecipeTagsSchemaInMain(db);
  list.innerHTML = '';

  window.dbInstance = db;

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
          anchorEl: searchInput,
          dockId: 'recipeFilterChipDock',
        })
      : null;

  const activeTagFilters = new Set();
  let searchQuery = '';
  let recipeRows = [];
  const listRowStepper = window.listRowStepper;
  const recipeQuantities = new Map();
  const isRecipeWebSelectMode = () => isForceWebModeEnabled();
  const syncRecipesActionButtonState = () => {
    if (!(recipesActionBtn instanceof HTMLButtonElement)) return;
    if (!isRecipeWebSelectMode()) {
      recipesActionBtn.disabled = false;
      recipesActionBtn.removeAttribute('aria-disabled');
      return;
    }
    const disabled = Object.keys(getShoppingPlanRecipeSelections()).length === 0;
    recipesActionBtn.disabled = disabled;
    recipesActionBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  };
  const getRecipeQtyKey = (recipeId) => String(recipeId || '').trim();
  const getRecipeQty = (recipeId) =>
    recipeQuantities.get(getRecipeQtyKey(recipeId)) || 0;
  const setRecipeQty = (recipeId, qty) => {
    const key = getRecipeQtyKey(recipeId);
    if (!key) return 0;
    const clamped = Math.max(0, Math.min(99, Number(qty || 0)));
    if (!Number.isFinite(clamped) || clamped <= 0) {
      recipeQuantities.delete(key);
      return 0;
    }
    recipeQuantities.set(key, clamped);
    return clamped;
  };
  const makeRecipeStepperDOM = () => {
    return listRowStepper.createStepperDOM({
      decreaseLabel: 'Decrease recipe quantity',
      increaseLabel: 'Increase recipe quantity',
    });
  };
  let recipeRowStepperController = null;
  const syncRecipeRowSelectionState = (rowEl, recipeId) => {
    listRowStepper.syncRowVisuals(rowEl, {
      enabled: isRecipeWebSelectMode(),
      qty: getRecipeQty(recipeId),
      isActive: !!recipeRowStepperController?.isActive(getRecipeQtyKey(recipeId)),
      selectedDatasetKey: 'recipeSelected',
    });
  };
  const incrementRecipeQty = (recipeId, delta) => {
    const nextQty = setRecipeQty(recipeId, getRecipeQty(recipeId) + delta);
    const recipeKey = getRecipeQtyKey(recipeId);
    const recipeRow = recipeRows.find((row) => Number(row?.id) === Number(recipeId));
    setShoppingPlanRecipeSelection({
      recipeId,
      title: recipeRow?.title || '',
      quantity: nextQty,
    });
    if (nextQty > 0) {
      recipeRowStepperController?.activate(recipeKey);
    } else if (recipeRowStepperController?.isActive(recipeKey)) {
      recipeRowStepperController.collapseActive();
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
      recipeQuantities.set(getRecipeQtyKey(recipeId), quantity);
    });
  };

  const loadRecipeRows = () => {
    const recipesQ = db.exec(
      'SELECT ID, title FROM recipes ORDER BY title COLLATE NOCASE;'
    );
    const rows = recipesQ.length ? recipesQ[0].values : [];
    const out = rows.map(([id, title]) => ({
      id: Number(id),
      title: String(title || ''),
      tags: [],
    }));
    const byRecipe = new Map();
    out.forEach((r) => byRecipe.set(r.id, r));

    try {
      const tagsQ = db.exec(`
        SELECT m.recipe_id, t.name
        FROM recipe_tag_map m
        JOIN tags t ON t.id = m.tag_id
        WHERE COALESCE(t.is_hidden, 0) = 0
        ORDER BY m.recipe_id, COALESCE(m.sort_order, 999999), m.id, t.name COLLATE NOCASE;
      `);
      if (tagsQ.length) {
        tagsQ[0].values.forEach(([recipeIdRaw, tagNameRaw]) => {
          const recipeId = Number(recipeIdRaw);
          const row = byRecipe.get(recipeId);
          if (!row) return;
          const nextTag = String(tagNameRaw || '').trim();
          if (!nextTag) return;
          if (row.tags.some((t) => t.toLowerCase() === nextTag.toLowerCase())) return;
          row.tags.push(nextTag);
        });
      }
    } catch (_) {}

    return out;
  };

  const renderTagFilterChips = (rows) => {
    const chipMountEl = recipeFilterChipRail?.trackEl;
    if (!chipMountEl) return;
    const names = [];
    const seen = new Set();
    (rows || []).forEach((r) => {
      (Array.isArray(r.tags) ? r.tags : []).forEach((name) => {
        const key = String(name || '').trim().toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        names.push(String(name || '').trim());
      });
    });
    names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    if (typeof window.renderFilterChipList !== 'function') {
      chipMountEl.innerHTML = '';
      return;
    }
    window.renderFilterChipList({
      mountEl: chipMountEl,
      chips: names.map((name) => ({
        id: String(name || '').toLowerCase(),
        label: String(name || ''),
        disabled: false,
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
      const searchMatches = !q || titleText.includes(q) || tagsInline.includes(q);
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
      renderTopLevelEmptyState(list, 'No recipes yet. Add a recipe.');
      listNav?.syncAfterRender?.();
      return;
    }
    items.forEach((row) => {
      const id = row.id;
      const title = row.title;
      const li = document.createElement('li');
      const titleSpan = document.createElement('span');
      titleSpan.className = 'recipe-list-title shopping-list-row-label';
      titleSpan.textContent = title || '';
      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined shopping-list-row-icon';
      icon.textContent = 'add_box';
      icon.setAttribute('aria-hidden', 'true');
      const { stepper, minusBtn, plusBtn } = makeRecipeStepperDOM();
      const badge = document.createElement('span');
      badge.className = 'shopping-list-row-badge';
      badge.style.display = 'none';
      li.appendChild(titleSpan);
      li.appendChild(icon);
      li.appendChild(stepper);
      li.appendChild(badge);
      syncRecipeRowSelectionState(li, id);

      icon.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isRecipeWebSelectMode()) return;
        incrementRecipeQty(id, 1);
      });

      badge.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isRecipeWebSelectMode()) return;
        recipeRowStepperController?.activate(getRecipeQtyKey(id));
        rerenderFilteredRecipes();
      });

      minusBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isRecipeWebSelectMode() && getRecipeQty(id) <= 0) {
          if (recipeRowStepperController?.isActive(getRecipeQtyKey(id))) {
            recipeRowStepperController.collapseActive();
            rerenderFilteredRecipes();
          }
          return;
        }
        incrementRecipeQty(id, -1);
      });

      plusBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        incrementRecipeQty(id, 1);
      });

      li.addEventListener('click', (event) => {
        // Treat Ctrl-click / Cmd-click as "delete"
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          void deleteRecipeWithConfirm(db, id, title);
          return;
        }

        collapseRecipeSelectionUi();
        sessionStorage.setItem('selectedRecipeId', id);
        window.location.href = 'recipeEditor.html';
      });

      // Right-click / two-finger click → delete dialog as well
      li.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        void deleteRecipeWithConfirm(db, id, title);
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
  });
  recipeRowStepperController.bindAutoDismiss({
    onDismissed: rerenderFilteredRecipes,
  });
  window.addEventListener('pageshow', collapseRecipeSelectionUi);

  recipeRows = loadRecipeRows();
  hydrateRecipeSelectionsFromPlan();
  syncRecipesActionButtonState();
  rerenderFilteredRecipes();

  // --- Recipes action button stub ---

  async function openCreateRecipeDialog(db) {
    if (!db || !window.ui) return;
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
      db.run(
        'INSERT INTO recipes (title, servings_min, servings_max) VALUES (?, ?, ?);',
        [title, 0.5, 99]
      );
      const idQ = db.exec('SELECT last_insert_rowid();');
      if (idQ.length && idQ[0].values.length) {
        newId = idQ[0].values[0][0];
      }
    } catch (err) {
      console.error('❌ Failed to create recipe:', err);
      window.ui.toast({ message: 'Failed to create recipe. See console.' });
      return;
    }

    // Persist DB so editor + list can see the new recipe
    try {
      const binaryArray = db.export();
      const isElectronEnv = !!window.electronAPI;
      if (isElectronEnv) {
        const ok = await window.electronAPI.saveDB(binaryArray);
        if (ok === false) {
          window.ui.toast({
            message: 'Failed to save database after creating recipe.',
          });
          return;
        }
      } else {
        localStorage.setItem(
          'favoriteEatsDb',
          JSON.stringify(Array.from(binaryArray)),
        );
      }
    } catch (err) {
      console.error('❌ Failed to persist DB after creating recipe:', err);
      window.ui.toast({
        message: 'Failed to save database after creating recipe.',
      });
      return;
    }

    if (newId != null) {
      sessionStorage.setItem('selectedRecipeId', newId);
      sessionStorage.setItem('selectedRecipeIsNew', '1');
      window.location.href = 'recipeEditor.html';
    }
  }

  // Delete a recipe and all dependent rows in child tables.
  function deleteRecipeDeep(db, recipeId) {
    // Remove instructions for this recipe
    db.run('DELETE FROM recipe_steps WHERE recipe_id = ?;', [recipeId]);

    // Remove any sections owned by this recipe
    db.run('DELETE FROM recipe_sections WHERE recipe_id = ?;', [recipeId]);

    // Remove ingredient mappings (substitutes are ON DELETE CASCADE from this)
    db.run('DELETE FROM recipe_ingredient_map WHERE recipe_id = ?;', [
      recipeId,
    ]);
    // Remove recipe tag mappings.
    try {
      db.run('DELETE FROM recipe_tag_map WHERE recipe_id = ?;', [recipeId]);
    } catch (_) {}

    // Finally remove the recipe itself
    db.run('DELETE FROM recipes WHERE ID = ?;', [recipeId]);
  }

  async function deleteRecipeWithConfirm(db, recipeId, title) {
    if (!db || recipeId == null || !window.ui) return;
    const ok = await window.ui.confirm({
      title: 'Delete Recipe',
      message: `Delete "${title}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;

    try {
      deleteRecipeDeep(db, recipeId);
    } catch (err) {
      console.error('❌ Failed to delete recipe:', err);
      window.ui.toast({ message: 'Failed to delete recipe. See console.' });
      return;
    }

    try {
      const binaryArray = db.export();
      const isElectronEnv = !!window.electronAPI;
      if (isElectronEnv) {
        const okSave = await window.electronAPI.saveDB(binaryArray);
        if (okSave === false) {
          window.ui.toast({
            message: 'Failed to save database after deleting recipe.',
          });
          return;
        }
      } else {
        localStorage.setItem(
          'favoriteEatsDb',
          JSON.stringify(Array.from(binaryArray)),
        );
      }
    } catch (err) {
      console.error('❌ Failed to persist DB after deleting recipe:', err);
      window.ui.toast({
        message: 'Failed to save database after deleting recipe.',
      });
      return;
    }

    recipeRows = recipeRows.filter((r) => Number(r.id) !== Number(recipeId));
    rerenderFilteredRecipes();
  }

  if (recipesActionBtn) {
    if (isRecipeWebSelectMode()) {
      recipesActionBtn.textContent = 'Reset';
      recipesActionBtn.addEventListener('click', () => {
        if (!Object.keys(getShoppingPlanRecipeSelections()).length) {
          uiToast('No recipe selections to clear.');
          return;
        }
        const previousPlan = cloneForUndo(getShoppingPlan(), () =>
          createEmptyShoppingPlan()
        );
        const previousRecipeQuantities = new Map(recipeQuantities);
        const restoreClearedRecipes = () => {
          persistShoppingPlan(previousPlan);
          recipeQuantities.clear();
          previousRecipeQuantities.forEach((qty, key) => {
            recipeQuantities.set(key, qty);
          });
          recipeRowStepperController?.collapseAll?.();
          syncRecipesActionButtonState();
          rerenderFilteredRecipes();
        };
        clearShoppingPlanSelections({ clearRecipes: true });
        recipeQuantities.clear();
        recipeRowStepperController?.collapseAll?.();
        syncRecipesActionButtonState();
        rerenderFilteredRecipes();
        uiToastUndo('Recipe selections cleared.', restoreClearedRecipes);
      });
    } else {
      recipesActionBtn.addEventListener('click', () => {
        void openCreateRecipeDialog(db);
      });
    }
  }

}

// --- Shopping / Units / Stores loaders (v0 stubs) ---
async function loadShoppingPage() {
  const list = document.getElementById('shoppingList');

  initAppBar({
    mode: 'list',
    titleText: 'Items',
  });

  // App bar is injected async; wait before wiring menu/search/add.
  if (typeof waitForAppBarReady === 'function') {
    await waitForAppBarReady();
  }
  initBottomNav();

  const searchInput = document.getElementById('appBarSearchInput');
  const clearBtn = document.getElementById('appBarSearchClear');
  wireAppBarSearch(searchInput, {
    clearBtn,
    onQueryChange: () => {
      applyShoppingFilters();
    },
  });
  const addBtn = document.getElementById('appBarAddBtn');
  const listRowStepper = window.listRowStepper;

  if (!list) return;

  // Keyboard selection + Enter activation for list rows.
  const listNav = enableTopLevelListKeyboardNav(list);
  const rememberShoppingScrollForReload = () => {
    try {
      const y = Number(window.scrollY || window.pageYOffset || 0);
      sessionStorage.setItem(SHOPPING_SCROLL_RESTORE_SESSION_KEY, String(y));
    } catch (_) {}
  };
  const restoreShoppingScrollAfterReload = () => {
    let targetY = null;
    try {
      const raw = sessionStorage.getItem(SHOPPING_SCROLL_RESTORE_SESSION_KEY);
      sessionStorage.removeItem(SHOPPING_SCROLL_RESTORE_SESSION_KEY);
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed >= 0) targetY = parsed;
    } catch (_) {}
    if (targetY === null) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          window.scrollTo({ top: targetY, behavior: 'auto' });
        } catch (_) {
          window.scrollTo(0, targetY);
        }
      });
    });
  };
  const consumeShoppingNavTarget = () => {
    try {
      const rawId = sessionStorage.getItem(window.favoriteEatsSessionKeys.shoppingNavTargetId);
      const rawName = sessionStorage.getItem(window.favoriteEatsSessionKeys.shoppingNavTargetName);
      sessionStorage.removeItem(window.favoriteEatsSessionKeys.shoppingNavTargetId);
      sessionStorage.removeItem(window.favoriteEatsSessionKeys.shoppingNavTargetName);
      const targetId = Number(rawId);
      const targetName = String(rawName || '').trim().toLowerCase();
      if (
        (!Number.isFinite(targetId) || targetId <= 0) &&
        !targetName
      ) {
        return null;
      }
      return {
        id: Number.isFinite(targetId) && targetId > 0 ? Math.trunc(targetId) : null,
        name: targetName || '',
      };
    } catch (_) {
      return null;
    }
  };
  const shoppingNavTargetCleanupTimers = new WeakMap();
  const pulseShoppingNavTargetRow = (row) => {
    if (!(row instanceof HTMLElement)) return;
    const existingTimer = shoppingNavTargetCleanupTimers.get(row);
    if (existingTimer) window.clearTimeout(existingTimer);
    const cleanup = () => {
      row.classList.remove('shopping-nav-target');
      shoppingNavTargetCleanupTimers.delete(row);
    };
    row.classList.remove('shopping-nav-target');
    void row.offsetWidth;
    row.classList.add('shopping-nav-target');
    row.addEventListener('animationend', cleanup, { once: true });
    const timeoutId = window.setTimeout(cleanup, 1400);
    shoppingNavTargetCleanupTimers.set(row, timeoutId);
  };
  const scrollToShoppingNavTarget = (target) => {
    if (!target) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          const row = Array.from(list.querySelectorAll('li')).find((li) => {
            const itemId = Number(li.dataset.shoppingItemId || '');
            if (
              Number.isFinite(itemId) &&
              itemId > 0 &&
              Number.isFinite(target.id) &&
              itemId === target.id
            ) {
              return true;
            }
            const key = String(
              li.dataset.shoppingStepperKey || li.dataset.variantParentKey || ''
            )
              .trim()
              .toLowerCase();
            if (!key) return false;
            if (target.name && key === target.name) return true;
            return false;
          });
          if (!(row instanceof HTMLElement)) return;
          row.scrollIntoView({ block: 'center', behavior: 'auto' });
          pulseShoppingNavTargetRow(row);
        } catch (_) {}
      });
    });
  };
  const pendingShoppingNavTarget = consumeShoppingNavTarget();

  attachSecretGalleryShortcut(addBtn);

  // --- Load DB (mirror recipe loaders) ---
  const isElectron = !!window.electronAPI;
  let db;
  attachSecretGalleryShortcut(addBtn);

  if (isElectron) {
    try {
      const pathHint = localStorage.getItem('favoriteEatsDbPath') || null;
      const bytes = await window.electronAPI.loadDB(pathHint);
      const Uints = new Uint8Array(bytes);
      db = new SQL.Database(Uints);
    } catch (err) {
      console.error('❌ Failed to load DB from disk:', err);
      uiToast('No database loaded. Please go back to the welcome page.');
      window.location.href = 'index.html';
      return;
    }
  } else {
    const stored = localStorage.getItem('favoriteEatsDb');
    if (!stored) {
      uiToast('No database loaded. Please go back to the welcome page.');
      window.location.href = 'index.html';
      return;
    }
    const Uints = new Uint8Array(JSON.parse(stored));
    db = new SQL.Database(Uints);
  }

  // Expose DB globally for any future helpers
  window.dbInstance = db;
  await ensureIngredientLemmaMaintenanceInMain(db, isElectron);

  // --- Load shopping items from ingredients table ---
  // Prefer is_deprecated when available; fall back to legacy hide_from_shopping_list.
  const tableExists = (name) => {
    try {
      const q = db.exec(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
        [name],
      );
      return !!(q.length && q[0].values && q[0].values.length);
    } catch (_) {
      return false;
    }
  };

  const tableHasColumn = (tableName, columnName) => {
    try {
      const q = db.exec(`PRAGMA table_info(${tableName});`);
      const rows =
        Array.isArray(q) && q.length > 0 && Array.isArray(q[0].values)
          ? q[0].values
          : [];
      const cols = rows
        .map((r) => (Array.isArray(r) ? String(r[1] || '').toLowerCase() : ''))
        .filter(Boolean);
      return cols.includes(String(columnName || '').toLowerCase());
    } catch (_) {
      return false;
    }
  };

  // When available, prefer the list table so Shopping can display multiple variants.
  const hasVariantTable = tableExists('ingredient_variants');
  const hasIsDeprecatedCol = tableHasColumn('ingredients', 'is_deprecated');
  const hasIsHiddenCol = tableHasColumn('ingredients', 'is_hidden');
  const hasIsFoodCol = tableHasColumn('ingredients', 'is_food');
  const hasLemmaCol = tableHasColumn('ingredients', 'lemma');
  const hasPluralByDefaultCol = tableHasColumn('ingredients', 'plural_by_default');
  const hasIsMassNounCol = tableHasColumn('ingredients', 'is_mass_noun');
  const hasPluralOverrideCol = tableHasColumn('ingredients', 'plural_override');
  const hasLegacyHideCol = tableHasColumn(
    'ingredients',
    'hide_from_shopping_list',
  );
  const deprecatedExpr = hasIsDeprecatedCol
    ? 'COALESCE(i.is_deprecated, 0)'
    : hasLegacyHideCol
      ? 'COALESCE(i.hide_from_shopping_list, 0)'
      : '0';
  const homeExpr = `COALESCE(i.location_at_home, '')`;
  const isFoodExpr = hasIsFoodCol ? 'COALESCE(i.is_food, 1)' : '1';
  const isHiddenExpr = hasIsHiddenCol ? 'COALESCE(i.is_hidden, 0)' : '0';
  const lemmaExpr = hasLemmaCol ? "COALESCE(i.lemma, '')" : "''";
  const pluralByDefaultExpr = hasPluralByDefaultCol
    ? 'COALESCE(i.plural_by_default, 0)'
    : '0';
  const isMassNounExpr = hasIsMassNounCol ? 'COALESCE(i.is_mass_noun, 0)' : '0';
  const pluralOverrideExpr = hasPluralOverrideCol
    ? "COALESCE(i.plural_override, '')"
    : "''";
  const baseSelectSql = hasVariantTable
    ? `
      SELECT i.ID,
             i.name,
             COALESCE(v.variant, i.variant) AS variant,
             ${deprecatedExpr} AS is_deprecated,
             ${isHiddenExpr} AS is_hidden,
             ${homeExpr} AS location_at_home,
             ${isFoodExpr} AS is_food,
             ${lemmaExpr} AS lemma,
             ${pluralByDefaultExpr} AS plural_by_default,
             ${isMassNounExpr} AS is_mass_noun,
             ${pluralOverrideExpr} AS plural_override
      FROM ingredients i
      LEFT JOIN ingredient_variants v ON v.ingredient_id = i.ID
    `
    : `
      SELECT i.ID,
             i.name,
             i.variant,
             ${deprecatedExpr} AS is_deprecated,
             ${isHiddenExpr} AS is_hidden,
             ${homeExpr} AS location_at_home,
             ${isFoodExpr} AS is_food,
             ${lemmaExpr} AS lemma,
             ${pluralByDefaultExpr} AS plural_by_default,
             ${isMassNounExpr} AS is_mass_noun,
             ${pluralOverrideExpr} AS plural_override
      FROM ingredients i
    `;

  const result = db.exec(`
    ${baseSelectSql}
    ORDER BY
      i.name COLLATE NOCASE
      ${
        hasVariantTable
          ? ', i.ID ASC, COALESCE(v.sort_order, 999999) ASC, COALESCE(v.id, 999999) ASC'
          : ''
      };
  `);

  // Normalize into the same shape the UI already expects, but
  // aggregate variants by ingredient name so each name appears once.
  let shoppingRows = [];
  if (result.length > 0) {
    const rawRows = result[0].values.map(
      ([
        id,
        name,
        variant,
        isDeprecated,
        isHidden,
        locationAtHome,
        isFood,
        lemma,
        pluralByDefault,
        isMassNoun,
        pluralOverride,
      ]) => ({
        id,
        name,
        variant: variant || '',
        isDeprecated: Number(isDeprecated || 0) === 1,
        isHidden: Number(isHidden || 0) === 1,
        locationAtHome: String(locationAtHome || ''),
        isFood: Number(isFood ?? 1) === 1,
        lemma: String(lemma || '').trim(),
        pluralByDefault: Number(pluralByDefault || 0) === 1,
        isMassNoun: Number(isMassNoun || 0) === 1,
        pluralOverride: String(pluralOverride || '').trim(),
      }),
    );

    const byName = new Map();

    rawRows.forEach((row) => {
      const key = (row.name || '').toLowerCase();

      if (!byName.has(key)) {
        byName.set(key, {
          id: row.id,
          name: row.name || '',
          variants: [],
          recentSortId: Number.isFinite(Number(row.id)) ? Number(row.id) : 0,
          recipeUseCount: 0,
          aisleUseCount: 0,
          _deprecatedFlags: [],
          _hiddenFlags: [],
          _homeLocations: [],
          _foodFlags: [],
          _lemmas: [],
          _pluralByDefaultFlags: [],
          _isMassNounFlags: [],
          _pluralOverrides: [],
        });
      }

      if (row.variant) {
        byName.get(key).variants.push(row.variant);
      }
      byName.get(key).recentSortId = Math.max(
        Number(byName.get(key).recentSortId) || 0,
        Number.isFinite(Number(row.id)) ? Number(row.id) : 0,
      );
      byName.get(key)._deprecatedFlags.push(!!row.isDeprecated);
      byName.get(key)._hiddenFlags.push(!!row.isHidden);
      byName.get(key)._homeLocations.push(String(row.locationAtHome || ''));
      byName.get(key)._foodFlags.push(row.isFood !== false);
      byName.get(key)._lemmas.push(String(row.lemma || '').trim());
      byName.get(key)._pluralByDefaultFlags.push(!!row.pluralByDefault);
      byName.get(key)._isMassNounFlags.push(!!row.isMassNoun);
      byName.get(key)._pluralOverrides.push(String(row.pluralOverride || '').trim());
    });

    // Dedupe variants, then flatten into an array.
    // - If we have `ingredient_variants`, preserve list order (sort_order) from DB.
    // - Otherwise, fall back to alphabetical sorting for stability.
    shoppingRows = Array.from(byName.values()).map((item) => {
      if (Array.isArray(item.variants) && item.variants.length > 0) {
        const cleaned = item.variants
          .map((v) => (v || '').trim())
          .filter((v) => v.length > 0);

        const seen = new Set();
        const uniqueStable = [];
        cleaned.forEach((v) => {
          const k = v.toLowerCase();
          if (seen.has(k)) return;
          seen.add(k);
          uniqueStable.push(v);
        });

        if (!hasVariantTable) {
          uniqueStable.sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' }),
          );
        }

        item.variants = uniqueStable;
      } else {
        item.variants = [];
      }

      item.isDeprecated =
        Array.isArray(item._deprecatedFlags) && item._deprecatedFlags.length > 0
          ? item._deprecatedFlags.every(Boolean)
          : false;
      item.isHidden =
        Array.isArray(item._hiddenFlags) && item._hiddenFlags.length > 0
          ? item._hiddenFlags.every(Boolean)
          : false;
      item.locationAtHome =
        Array.isArray(item._homeLocations) && item._homeLocations.length > 0
          ? String(item._homeLocations[0] || '')
          : '';
      item.isFood =
        Array.isArray(item._foodFlags) && item._foodFlags.length > 0
          ? item._foodFlags.some(Boolean)
          : true;
      item.lemma =
        Array.isArray(item._lemmas) && item._lemmas.length > 0
          ? String(item._lemmas.find((value) => String(value || '').trim()) || '').trim()
          : '';
      item.pluralByDefault =
        Array.isArray(item._pluralByDefaultFlags) && item._pluralByDefaultFlags.length > 0
          ? item._pluralByDefaultFlags.some(Boolean)
          : false;
      item.isMassNoun =
        Array.isArray(item._isMassNounFlags) && item._isMassNounFlags.length > 0
          ? item._isMassNounFlags.some(Boolean)
          : false;
      item.pluralOverride =
        Array.isArray(item._pluralOverrides) && item._pluralOverrides.length > 0
          ? String(
              item._pluralOverrides.find((value) => String(value || '').trim()) || '',
            ).trim()
          : '';
      delete item._deprecatedFlags;
      delete item._hiddenFlags;
      delete item._homeLocations;
      delete item._foodFlags;
      delete item._lemmas;
      delete item._pluralByDefaultFlags;
      delete item._isMassNounFlags;
      delete item._pluralOverrides;

      return item;
    });

    // Keep list stable + alphabetical by name
    shoppingRows.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, {
        sensitivity: 'base',
      }),
    );
  }

  const buildShoppingUsageCountMaps = () => {
    const recipeCounts = new Map();
    const aisleCounts = new Map();

    try {
      const recipeQ = db.exec(`
        SELECT name_key, COUNT(DISTINCT recipe_id) AS recipe_count
        FROM (
          SELECT lower(i.name) AS name_key, rim.recipe_id
          FROM recipe_ingredient_map rim
          JOIN ingredients i ON i.ID = rim.ingredient_id
          UNION ALL
          SELECT lower(i2.name) AS name_key, rim.recipe_id
          FROM recipe_ingredient_substitutes ris
          JOIN recipe_ingredient_map rim ON rim.ID = ris.recipe_ingredient_id
          JOIN ingredients i2 ON i2.ID = ris.ingredient_id
        ) refs
        GROUP BY name_key;
      `);
      if (Array.isArray(recipeQ) && recipeQ.length && Array.isArray(recipeQ[0].values)) {
        recipeQ[0].values.forEach(([nameKey, recipeCount]) => {
          const key = String(nameKey || '').trim().toLowerCase();
          if (!key) return;
          const count = Number(recipeCount);
          recipeCounts.set(key, Number.isFinite(count) ? count : 0);
        });
      }
    } catch (err) {
      console.warn('buildShoppingUsageCountMaps: recipe count query failed', err);
    }

    try {
      const hasBaseAisleTable = tableExists('ingredient_store_location');
      const hasVariantAisleTable = tableExists('ingredient_variant_store_location');
      const aisleSources = [];
      if (hasBaseAisleTable) {
        aisleSources.push(`
          SELECT lower(i.name) AS name_key, isl.store_location_id AS aisle_id
          FROM ingredient_store_location isl
          JOIN ingredients i ON i.ID = isl.ingredient_id
        `);
      }
      if (hasVariantAisleTable) {
        aisleSources.push(`
          SELECT lower(i.name) AS name_key, ivsl.store_location_id AS aisle_id
          FROM ingredient_variant_store_location ivsl
          JOIN ingredient_variants v ON v.id = ivsl.ingredient_variant_id
          JOIN ingredients i ON i.ID = v.ingredient_id
        `);
      }
      if (aisleSources.length) {
        const aisleQ = db.exec(`
          SELECT name_key, COUNT(DISTINCT aisle_id) AS aisle_count
          FROM (
            ${aisleSources.join('\nUNION ALL\n')}
          ) refs
          GROUP BY name_key;
        `);
        if (Array.isArray(aisleQ) && aisleQ.length && Array.isArray(aisleQ[0].values)) {
          aisleQ[0].values.forEach(([nameKey, aisleCount]) => {
            const key = String(nameKey || '').trim().toLowerCase();
            if (!key) return;
            const count = Number(aisleCount);
            aisleCounts.set(key, Number.isFinite(count) ? count : 0);
          });
        }
      }
    } catch (err) {
      console.warn('buildShoppingUsageCountMaps: aisle count query failed', err);
    }

    return { recipeCounts, aisleCounts };
  };

  const shoppingUsageCounts = buildShoppingUsageCountMaps();
  shoppingRows.forEach((item) => {
    const key = String(item?.name || '').trim().toLowerCase();
    item.recipeUseCount = Number(shoppingUsageCounts.recipeCounts.get(key) || 0);
    item.aisleUseCount = Number(shoppingUsageCounts.aisleCounts.get(key) || 0);
  });

  const shoppingLocationChipDefs = [
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
  const shoppingFilterChipDefsAll = [
    { id: 'for recipes', label: 'from recipes', kind: 'flag' },
    { id: 'selected', label: 'all selections', kind: 'flag' },
    { id: 'not food', label: 'not food', kind: 'flag' },
    { id: 'recent', label: 'recent', kind: 'sort' },
    { id: 'hidden', label: 'hidden', kind: 'flag' },
    { id: 'removed', label: 'removed', kind: 'flag' },
    ...shoppingLocationChipDefs.map((c) => ({ ...c, kind: 'location' })),
    { id: 'no recipe', label: 'no recipe', kind: 'usage' },
    { id: 'no aisle', label: 'no aisle', kind: 'usage' },
  ];
  const shoppingFilterChipDefsWeb = shoppingFilterChipDefsAll.slice(0, 3);
  const activeFilterChips = new Set();
  const selectedShoppingNames = new Set();
  const shoppingQuantities = new Map();
  const shoppingRecipeQuantities = new Map();
  const shoppingSelectionMeta = new Map();
  let shoppingChipCounts = new Map();
  let filterChipRail = null;
  const previousPageId = String(window.__favoriteEatsPreviousPageId || '').trim();
  const shouldRestoreChipState =
    previousPageId === 'shopping' || previousPageId === 'shopping-editor';
  const syncShoppingActionButtonState = () => {
    if (!(addBtn instanceof HTMLButtonElement)) return;
    if (!isShoppingWebSelectMode()) {
      addBtn.disabled = false;
      addBtn.removeAttribute('aria-disabled');
      return;
    }
    const disabled =
      Object.keys(getShoppingPlanItemSelections()).length === 0 &&
      Object.keys(getShoppingPlanRecipeSelections()).length === 0;
    addBtn.disabled = disabled;
    addBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  };

  const getShoppingSelectionKey = (rawName) =>
    String(rawName || '').trim().toLowerCase();
  const isShoppingWebSelectMode = () => isForceWebModeEnabled();
  // On macOS, Ctrl+primary click can emit a contextmenu event.
  // Treat that gesture like a normal click in shopping web mode.
  const isCtrlPrimaryContextMenuGesture = (event) =>
    !!(
      event &&
      event.type === 'contextmenu' &&
      event.ctrlKey &&
      Number(event.button) === 0 &&
      !event.metaKey &&
      !event.altKey &&
      !event.shiftKey
    );
  const getActiveShoppingFilterChipDefs = () =>
    isShoppingWebSelectMode() ? shoppingFilterChipDefsWeb : shoppingFilterChipDefsAll;
  const SHOPPING_QTY_EPSILON = 1e-9;
  const getDirectShoppingQty = (key) => shoppingQuantities.get(key) || 0;
  const getRecipeShoppingQty = (key) => shoppingRecipeQuantities.get(key) || 0;
  const getShoppingQty = (key) =>
    Math.max(0, getDirectShoppingQty(key) + getRecipeShoppingQty(key));
  const hasPositiveShoppingQty = (qty) =>
    Number.isFinite(Number(qty)) && Number(qty) > SHOPPING_QTY_EPSILON;
  const getNextShoppingStepQty = (currentQty, delta) => {
    if (
      window.listRowStepper &&
      typeof window.listRowStepper.getNextStepQty === 'function'
    ) {
      return window.listRowStepper.getNextStepQty(currentQty, delta, {
        min: 0,
        epsilon: SHOPPING_QTY_EPSILON,
      });
    }
    const numeric = Number(currentQty);
    if (!Number.isFinite(numeric)) return delta > 0 ? 1 : 0;
    return Math.max(0, numeric + Number(delta || 0));
  };
  const parseShoppingQtyInputValue = (rawValue) => {
    const raw = String(rawValue == null ? '' : rawValue).trim();
    if (!raw) return null;
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(0, Math.min(99, Math.round(numeric)));
  };
  const setShoppingQty = (key, qty, meta = null) => {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) return;
    const nextMeta =
      meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
    const itemName = String(nextMeta.itemName || nextMeta.name || '').trim();
    const variantName = String(nextMeta.variantName || '').trim();
    if (itemName || variantName || !shoppingSelectionMeta.has(normalizedKey)) {
      shoppingSelectionMeta.set(normalizedKey, { itemName, variantName });
    }
    const recipeQty = getRecipeShoppingQty(normalizedKey);
    const desiredQty = Math.max(0, Number(qty || 0));
    if (!Number.isFinite(desiredQty)) return;
    const directQty = Number((desiredQty - recipeQty).toFixed(4));
    if (Math.abs(directQty) < SHOPPING_QTY_EPSILON) {
      shoppingQuantities.delete(normalizedKey);
      selectedShoppingNames.delete(normalizedKey);
      shoppingSelectionMeta.delete(normalizedKey);
      setShoppingPlanItemSelection({ key: normalizedKey, quantity: 0 });
    } else {
      shoppingQuantities.set(normalizedKey, directQty);
      selectedShoppingNames.add(normalizedKey);
      const persistedMeta = shoppingSelectionMeta.get(normalizedKey) || {};
      setShoppingPlanItemSelection({
        key: normalizedKey,
        name: persistedMeta.itemName || itemName || normalizedKey,
        variantName: persistedMeta.variantName || variantName,
        quantity: directQty,
      });
    }
    syncShoppingActionButtonState();
  };
  const hydrateShoppingSelectionsFromPlan = () => {
    const storedSelections = getShoppingPlanItemSelections();
    Object.keys(storedSelections).forEach((rawKey) => {
      const key = String(rawKey || '').trim();
      if (!key) return;
      const entry = storedSelections[rawKey];
      const quantity = Number(entry?.quantity);
      if (!Number.isFinite(quantity) || Math.abs(quantity) < SHOPPING_QTY_EPSILON) return;
      shoppingQuantities.set(key, quantity);
      selectedShoppingNames.add(key);
      shoppingSelectionMeta.set(key, {
        itemName: String(entry?.name || '').trim(),
        variantName: String(entry?.variantName || '').trim(),
      });
    });
  };
  hydrateShoppingSelectionsFromPlan();

  const VARIANT_KEY_SEP = '\x00';
  const getVariantQtyKey = (itemName, variantName) => {
    const base = getShoppingSelectionKey(itemName);
    const v = String(variantName || '').trim().toLowerCase();
    return v ? `${base}${VARIANT_KEY_SEP}${v}` : base;
  };
  const getShoppingItemVariantAwareKey = (itemName, variantName = '') => {
    const itemKey = getShoppingSelectionKey(itemName);
    if (!itemKey) return '';
    const match = shoppingRows.find(
      (item) => getShoppingSelectionKey(item?.name) === itemKey,
    );
    const hasVariants =
      !!match &&
      Array.isArray(match.variants) &&
      match.variants.length > 0;
    if (!hasVariants) return itemKey;
    return getVariantQtyKey(itemName, variantName || 'default');
  };
  const hydrateRecipeDerivedShoppingSelections = () => {
    shoppingRecipeQuantities.clear();
    getRecipeDerivedShoppingPlanRows({ db }).forEach((entry) => {
      const label = String(entry?.label || '').trim();
      const quantity = Number(entry?.quantity || 0);
      if (!label || !Number.isFinite(quantity) || quantity <= 0) return;
      const baseName = String(entry?.name || '').trim();
      const variantName = String(entry?.variantName || '').trim();
      const key = getShoppingItemVariantAwareKey(baseName, variantName);
      if (!key) return;
      shoppingRecipeQuantities.set(
        key,
        (shoppingRecipeQuantities.get(key) || 0) + quantity,
      );
    });
  };
  hydrateRecipeDerivedShoppingSelections();
  syncShoppingActionButtonState();
  const getItemTotalQty = (itemName, variants) => {
    const base = getShoppingSelectionKey(itemName);
    let total = getShoppingQty(`${base}${VARIANT_KEY_SEP}default`);
    (variants || []).forEach((v) => {
      total += getShoppingQty(`${base}${VARIANT_KEY_SEP}${String(v || '').trim().toLowerCase()}`);
    });
    return total;
  };
  const getVariantQtyMap = (itemName, variants) => {
    const base = getShoppingSelectionKey(itemName);
    const m = new Map();
    m.set('default', getShoppingQty(`${base}${VARIANT_KEY_SEP}default`));
    (variants || []).forEach((v) => {
      const vKey = String(v || '').trim().toLowerCase();
      m.set(v, getShoppingQty(`${base}${VARIANT_KEY_SEP}${vKey}`));
    });
    return m;
  };
  const hasAnyVariantSelection = (itemName, variants) =>
    hasPositiveShoppingQty(getItemTotalQty(itemName, variants));
  function getItemRecipeQty(itemName, variants) {
    const base = getShoppingSelectionKey(itemName);
    let total = getRecipeShoppingQty(`${base}${VARIANT_KEY_SEP}default`);
    (variants || []).forEach((v) => {
      total += getRecipeShoppingQty(`${base}${VARIANT_KEY_SEP}${String(v || '').trim().toLowerCase()}`);
    });
    return total;
  }
  function getShoppingRowTotalQty(item) {
    const itemName = String(item?.name || '').trim();
    if (!itemName) return 0;
    const variants = Array.isArray(item?.variants) ? item.variants : [];
    return variants.length > 0
      ? getItemTotalQty(itemName, variants)
      : getShoppingQty(getShoppingSelectionKey(itemName));
  }
  function getShoppingRowRecipeQty(item) {
    const itemName = String(item?.name || '').trim();
    if (!itemName) return 0;
    const variants = Array.isArray(item?.variants) ? item.variants : [];
    return variants.length > 0
      ? getItemRecipeQty(itemName, variants)
      : getRecipeShoppingQty(getShoppingSelectionKey(itemName));
  }

  const expandedVariantItems = new Set();
  const expandedVariantChildSteppers = new Set();
  const syncVariantParentByKey = new Map();
  let syncVariantChildVisuals = () => {};
  const collapseExpandedVariantRows = () => {
    let changed = false;
    if (expandedVariantChildSteppers.size) {
      changed = true;
      expandedVariantChildSteppers.clear();
      list.querySelectorAll('li.shopping-variant-child').forEach((row) => {
        const varKey = String(row.dataset.variantQtyKey || '');
        if (varKey) syncVariantChildVisuals(row, varKey);
      });
    }
    if (!expandedVariantItems.size) return changed;
    changed = true;
    expandedVariantItems.clear();
    list.querySelectorAll('li.shopping-variant-parent').forEach((parentLi) => {
      parentLi.dataset.expanded = 'false';
    });
    list.querySelectorAll('li.shopping-variant-child').forEach((row) => {
      row.style.display = 'none';
    });
    syncVariantParentByKey.forEach((syncFn) => {
      try {
        syncFn();
      } catch (_) {}
    });
    return changed;
  };
  const shoppingRowStepperController = listRowStepper.createController({
    listEl: list,
    isEnabled: isShoppingWebSelectMode,
    collapseExpanded: collapseExpandedVariantRows,
  });
  const syncShoppingRowVisuals = (rowEl, itemName) => {
    listRowStepper.syncRowVisuals(rowEl, {
      enabled: isShoppingWebSelectMode(),
      qty: getShoppingQty(getShoppingSelectionKey(itemName)),
      isActive: shoppingRowStepperController.isActive(getShoppingSelectionKey(itemName)),
      selectedDatasetKey: 'shoppingSelected',
    });
  };
  const syncShoppingRowSelectionState = (rowEl, itemName) => {
    syncShoppingRowVisuals(rowEl, itemName);
  };
  const syncAllVisibleShoppingRowStates = () => {
    list.querySelectorAll('li[data-shopping-stepper-key]').forEach((row) => {
      const itemName = String(row.dataset.shoppingStepperKey || '');
      if (itemName) syncShoppingRowSelectionState(row, itemName);
    });
  };
  shoppingRowStepperController.bindAutoDismiss({
    shouldIgnoreTarget: () =>
      !!list.querySelector('.shopping-stepper-qty-input'),
    onDismissed: syncAllVisibleShoppingRowStates,
  });
  const toggleShoppingRowSelectionState = (rowEl, itemName) => {
    const key = getShoppingSelectionKey(itemName);
    if (!key) return;
    const qty = getShoppingQty(key);
    setShoppingQty(key, qty > 0 ? 0 : 1, { itemName });
    refreshShoppingSelectionUi({ activeKey: key });
  };
  const incrementShoppingQty = (rowEl, itemName, delta) => {
    const key = getShoppingSelectionKey(itemName);
    if (!key) return;
    const qty = getShoppingQty(key);
    const nextQty = getNextShoppingStepQty(qty, delta);
    setShoppingQty(key, nextQty, { itemName });
    if (!hasPositiveShoppingQty(nextQty) && shoppingRowStepperController.isActive(key)) {
      shoppingRowStepperController.collapseActive();
    }
    refreshShoppingSelectionUi({ activeKey: hasPositiveShoppingQty(nextQty) ? key : '' });
  };
  const attachShoppingQtyManualEdit = ({
    qtyEl,
    getQty,
    commitQty,
    onAfterCommit,
  }) => {
    if (!(qtyEl instanceof HTMLElement)) return;
    let inputEl = null;
    let isEditing = false;

    const rerender = () => {
      if (typeof onAfterCommit === 'function') onAfterCommit();
    };
    const onBlur = () => finishEditing('commit');
    const onKeyDown = (event) => {
      if (!event) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        finishEditing('commit');
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        finishEditing('cancel');
        return;
      }
      event.stopPropagation();
    };
    const finishEditing = (mode) => {
      if (!isEditing) return;
      const currentInput = inputEl;
      inputEl = null;
      isEditing = false;
      if (currentInput) {
        currentInput.removeEventListener('blur', onBlur);
        currentInput.removeEventListener('keydown', onKeyDown);
      }
      if (mode === 'commit') {
        const nextQty = parseShoppingQtyInputValue(currentInput?.value);
        if (nextQty != null) {
          commitQty(nextQty);
          rerender();
          return;
        }
      }
      rerender();
    };
    const stopPropagation = (event) => {
      if (!event) return;
      event.preventDefault();
      event.stopPropagation();
    };

    qtyEl.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    qtyEl.addEventListener('dblclick', (event) => {
      if (!isShoppingWebSelectMode()) return;
      stopPropagation(event);
      if (isEditing) return;
      isEditing = true;
      const currentQty = Number(getQty());
      const initialValue = Number.isFinite(currentQty)
        ? String(Math.max(0, Math.min(99, Math.round(currentQty))))
        : '0';
      qtyEl.textContent = '';
      inputEl = document.createElement('input');
      inputEl.type = 'number';
      inputEl.className = 'shopping-stepper-qty-input';
      inputEl.min = '0';
      inputEl.max = '99';
      inputEl.step = '1';
      inputEl.inputMode = 'numeric';
      inputEl.value = initialValue;
      inputEl.addEventListener('click', (e) => e.stopPropagation());
      inputEl.addEventListener('mousedown', (e) => e.stopPropagation());
      inputEl.addEventListener('dblclick', (e) => e.stopPropagation());
      inputEl.addEventListener('blur', onBlur);
      inputEl.addEventListener('keydown', onKeyDown);
      qtyEl.appendChild(inputEl);
      try {
        inputEl.focus();
        inputEl.select();
      } catch (_) {}
    });
  };

  const persistShoppingChipState = () => {
    try {
      sessionStorage.setItem(
        SHOPPING_FILTER_CHIPS_SESSION_KEY,
        JSON.stringify(Array.from(activeFilterChips)),
      );
    } catch (_) {}
  };

  const clearShoppingChipState = () => {
    try {
      sessionStorage.removeItem(SHOPPING_FILTER_CHIPS_SESSION_KEY);
    } catch (_) {}
  };

  const restoreShoppingChipState = () => {
    if (!shouldRestoreChipState) {
      clearShoppingChipState();
      return;
    }
    try {
      const raw = sessionStorage.getItem(SHOPPING_FILTER_CHIPS_SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const knownIds = new Set(getActiveShoppingFilterChipDefs().map((c) => String(c.id)));
      parsed.forEach((chipId) => {
        const id = String(chipId || '').trim().toLowerCase();
        // Back-compat: old "hidden" chip represented deprecated/removed.
        if (id === 'hidden' && knownIds.has('removed')) {
          activeFilterChips.add('removed');
          return;
        }
        if (knownIds.has(id)) activeFilterChips.add(id);
      });
    } catch (_) {}
  };

  const normalizeLocationForChip = (raw) => normalizeShoppingHomeLocationId(raw);

  const recomputeShoppingChipCounts = () => {
    const counts = new Map();
    getActiveShoppingFilterChipDefs().forEach((c) => counts.set(c.id, 0));
    counts.set('recent', shoppingRows.length);
    shoppingRows.forEach((item) => {
      if (hasPositiveShoppingQty(getShoppingRowTotalQty(item))) {
        counts.set('selected', (counts.get('selected') || 0) + 1);
      }
      if (hasPositiveShoppingQty(getShoppingRowRecipeQty(item))) {
        counts.set('for recipes', (counts.get('for recipes') || 0) + 1);
      }
      if (item && item.isDeprecated) {
        counts.set('removed', (counts.get('removed') || 0) + 1);
      }
      if (item && item.isHidden) {
        counts.set('hidden', (counts.get('hidden') || 0) + 1);
      }
      if (item && item.isFood === false) {
        counts.set('not food', (counts.get('not food') || 0) + 1);
      }
      const locId = normalizeLocationForChip(item?.locationAtHome);
      counts.set(locId, (counts.get(locId) || 0) + 1);
      if (Number(item?.recipeUseCount || 0) <= 0) {
        counts.set('no recipe', (counts.get('no recipe') || 0) + 1);
      }
      if (Number(item?.aisleUseCount || 0) <= 0) {
        counts.set('no aisle', (counts.get('no aisle') || 0) + 1);
      }
    });
    shoppingChipCounts = counts;
  };

  const pruneInactiveShoppingChipState = () => {
    let changed = false;
    Array.from(activeFilterChips).forEach((chipId) => {
      const count = Number(shoppingChipCounts.get(chipId) || 0);
      if (count <= 0) {
        activeFilterChips.delete(chipId);
        changed = true;
      }
    });
    if (changed) persistShoppingChipState();
  };

  const rerenderShoppingFilterChips = () => {
    const chipMountEl = filterChipRail?.trackEl;
    if (!chipMountEl) return;
    if (typeof window.renderFilterChipList !== 'function') {
      chipMountEl.innerHTML = '';
      return;
    }
    const chips = getActiveShoppingFilterChipDefs().map((chipDef) => {
      const chipId = String(chipDef?.id || '').toLowerCase();
      const count = Number(shoppingChipCounts.get(chipId) || 0);
      return {
        id: chipId,
        label: chipDef?.label || chipId,
        disabled: count <= 0,
      };
    });
    window.renderFilterChipList({
      mountEl: chipMountEl,
      chips,
      activeChipIds: activeFilterChips,
      onToggle: (chipId) => {
        const key = String(chipId || '').toLowerCase();
        if (!key) return;
        const count = Number(shoppingChipCounts.get(key) || 0);
        if (count <= 0) return;
        const isSelectedFamilyChip = key === 'selected' || key === 'for recipes';
        if (activeFilterChips.has(key)) {
          activeFilterChips.delete(key);
        } else {
          if (isSelectedFamilyChip) {
            activeFilterChips.delete('selected');
            activeFilterChips.delete('for recipes');
          }
          activeFilterChips.add(key);
        }
        persistShoppingChipState();
        rerenderShoppingFilterChips();
        applyShoppingFilters();
      },
      chipClassName: 'app-filter-chip',
    });
  };
  const refreshShoppingFilterUi = () => {
    recomputeShoppingChipCounts();
    pruneInactiveShoppingChipState();
    rerenderShoppingFilterChips();
  };
  const refreshShoppingSelectionUi = ({ activeKey = '' } = {}) => {
    refreshShoppingFilterUi();
    applyShoppingFilters();
    if (activeKey && hasPositiveShoppingQty(getShoppingQty(activeKey))) {
      shoppingRowStepperController.activate(activeKey);
    }
    syncAllVisibleShoppingRowStates();
  };

  const mountShoppingFilterChips = () => {
    if (!searchInput) return;
    if (typeof window.mountTopFilterChipRail !== 'function') return;
    filterChipRail = window.mountTopFilterChipRail({
      anchorEl: searchInput,
      dockId: 'shoppingFilterChipDock',
    });

    refreshShoppingFilterUi();
    filterChipRail?.sync?.();
  };

  const getFilteredShoppingRows = () => {
    const query = (searchInput?.value || '').trim().toLowerCase();
    const selectedOnly = activeFilterChips.has('selected');
    const recipeOnly = activeFilterChips.has('for recipes');
    const recentFirst = activeFilterChips.has('recent');
    const removedOnly = activeFilterChips.has('removed');
    const hiddenOnly = activeFilterChips.has('hidden');
    const notFoodOnly = activeFilterChips.has('not food');
    const noRecipeOnly = activeFilterChips.has('no recipe');
    const noAisleOnly = activeFilterChips.has('no aisle');
    const activeLocationIds = shoppingLocationChipDefs
      .map((c) => c.id)
      .filter((id) => activeFilterChips.has(id));
    const filtered = shoppingRows.filter((item) => {
      const name = String(item.name || '').toLowerCase();
      const variants = Array.isArray(item.variants) ? item.variants : [];
      const matchesSearch =
        !query ||
        name.includes(query) ||
        variants.some((v) => String(v || '').toLowerCase().includes(query));
      const matchesRemoved = removedOnly
        ? item.isDeprecated === true
        : item.isDeprecated !== true;
      const matchesHidden = hiddenOnly
        ? item.isHidden === true
        : item.isHidden !== true;
      const matchesFood = notFoodOnly ? item.isFood === false : true;
      const locationId = normalizeLocationForChip(item?.locationAtHome);
      const matchesLocation =
        activeLocationIds.length === 0 || activeLocationIds.includes(locationId);
      const matchesNoRecipe = noRecipeOnly
        ? Number(item?.recipeUseCount || 0) <= 0
        : true;
      const matchesNoAisle = noAisleOnly
        ? Number(item?.aisleUseCount || 0) <= 0
        : true;
      const matchesSelected = selectedOnly
        ? hasPositiveShoppingQty(getShoppingRowTotalQty(item))
        : true;
      const matchesRecipeSelections = recipeOnly
        ? hasPositiveShoppingQty(getShoppingRowRecipeQty(item))
        : true;
      return (
        matchesSearch &&
        matchesRemoved &&
        matchesHidden &&
        matchesFood &&
        matchesLocation &&
        matchesNoRecipe &&
        matchesNoAisle &&
        matchesSelected &&
        matchesRecipeSelections
      );
    });
    filtered.sort((a, b) => {
      if (recentFirst) {
        const aRecent = Number.isFinite(Number(a?.recentSortId))
          ? Number(a.recentSortId)
          : 0;
        const bRecent = Number.isFinite(Number(b?.recentSortId))
          ? Number(b.recentSortId)
          : 0;
        if (aRecent !== bRecent) return bRecent - aRecent;
      }
      return (a?.name || '').localeCompare(b?.name || '', undefined, {
        sensitivity: 'base',
      });
    });
    return filtered;
  };

  const applyShoppingFilters = () => {
    renderShoppingList(getFilteredShoppingRows());
  };

  function countRecipesUsingShoppingName(name) {
    const n = (name || '').trim();
    if (!n) return 0;

    // Count distinct recipes referenced by any ingredient row with this name.
    // Includes both direct ingredient usage and substitute usage.
    try {
      const q = db.exec(
        `
        SELECT COUNT(DISTINCT rid) AS n
        FROM (
          SELECT rim.recipe_id AS rid
          FROM recipe_ingredient_map rim
          JOIN ingredients i ON i.ID = rim.ingredient_id
          WHERE lower(i.name) = lower(?)
          UNION
          SELECT rim.recipe_id AS rid
          FROM recipe_ingredient_substitutes ris
          JOIN recipe_ingredient_map rim ON rim.ID = ris.recipe_ingredient_id
          JOIN ingredients i2 ON i2.ID = ris.ingredient_id
          WHERE lower(i2.name) = lower(?)
        ) t;
        `,
        [n, n],
      );

      if (q.length && q[0].values.length) {
        const v = Number(q[0].values[0][0]);
        return Number.isFinite(v) ? v : 0;
      }
    } catch (err) {
      console.warn('countRecipesUsingShoppingName failed:', err);
    }
    return 0;
  }

  function getRecipesUsingShoppingName(name) {
    const n = (name || '').trim();
    if (!n) return [];
    try {
      const q = db.exec(
        `
        SELECT DISTINCT r.ID AS recipe_id, COALESCE(r.title, '') AS recipe_title
        FROM recipes r
        JOIN (
          SELECT rim.recipe_id AS rid
          FROM recipe_ingredient_map rim
          JOIN ingredients i ON i.ID = rim.ingredient_id
          WHERE lower(i.name) = lower(?)
          UNION
          SELECT rim.recipe_id AS rid
          FROM recipe_ingredient_substitutes ris
          JOIN recipe_ingredient_map rim ON rim.ID = ris.recipe_ingredient_id
          JOIN ingredients i2 ON i2.ID = ris.ingredient_id
          WHERE lower(i2.name) = lower(?)
        ) refs ON refs.rid = r.ID
        ORDER BY r.title COLLATE NOCASE;
        `,
        [n, n],
      );
      if (!q.length || !q[0].values.length) return [];
      return q[0].values
        .map(([recipeId, recipeTitle]) => ({
          id: Number(recipeId),
          title: String(recipeTitle || '').trim(),
        }))
        .filter((row) => Number.isFinite(row.id) && row.id > 0);
    } catch (err) {
      console.warn('getRecipesUsingShoppingName failed:', err);
      return [];
    }
  }

  async function removeShoppingName(name) {
    const n = (name || '').trim();
    if (!n) return false;

    const usedCount = countRecipesUsingShoppingName(n);

    if (getUnitSizeRemovalAction(usedCount) === 'remove') {
      const recipes = getRecipesUsingShoppingName(n);
      const usageLine =
        usedCount === 1
          ? 'This item is used in this recipe:'
          : 'This item is used in these recipes:';
      const details = document.createElement('div');
      details.className = 'shopping-remove-dialog-details';

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
      if (recipes.length) details.appendChild(linksWrap);

      const note = document.createElement('div');
      note.className = 'shopping-remove-dialog-note';
      note.textContent = `Removing it will hide it from the Shopping Items list but will not delete it. To delete '${n}' permenantly, first remove it from the recipes that use it.`;
      details.appendChild(note);

      let ok = false;
      if (window.ui && typeof window.ui.dialog === 'function') {
        const res = await window.ui.dialog({
          title: 'Remove item',
          message: `Remove '${n}'? ${usageLine}`,
          messageNode: details,
          confirmText: 'Remove',
          cancelText: 'Cancel',
          danger: true,
        });
        ok = !!res;
      } else {
        ok = await uiConfirm({
          title: 'Remove item',
          message: `Remove '${n}'? ${usageLine}\n\nRemoving it will hide it from the Shopping Items list but will not delete it. To delete '${n}' permenantly, first remove it from the recipes that use it.`,
          confirmText: 'Remove',
          cancelText: 'Cancel',
          danger: true,
        });
      }
      if (!ok) return false;

      try {
        try {
          db.run(
            'UPDATE ingredients SET is_deprecated = 1 WHERE lower(name) = lower(?);',
            [n],
          );
        } catch (_) {
          db.run(
            'UPDATE ingredients SET hide_from_shopping_list = 1 WHERE lower(name) = lower(?);',
            [n],
          );
        }
      } catch (err) {
        console.error('❌ Failed to deprecate shopping item:', err);
        uiToast('Failed to remove item. See console for details.');
        return false;
      }
    } else {
      const ok = await uiConfirm({
        title: 'Delete Shopping Item',
        message: `Delete '${n}' permanently?\n\nIt isn't used in any recipes. This will permanently delete it from the database.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        danger: true,
      });
      if (!ok) return false;

      try {
        // Gather ingredient IDs for this name (covers variants).
        const idsQ = db.exec(
          'SELECT ID FROM ingredients WHERE lower(name) = lower(?);',
          [n],
        );
        const ids = idsQ.length ? idsQ[0].values.map(([id]) => Number(id)) : [];

        // Remove dependent rows defensively (even though usedCount is 0).
        ids.forEach((id) => {
          if (!Number.isFinite(id)) return;
          try {
            db.run(
              'DELETE FROM ingredient_store_location WHERE ingredient_id = ?;',
              [id],
            );
          } catch (_) {}
          try {
            db.run(
              `DELETE FROM ingredient_variant_store_location
               WHERE ingredient_variant_id IN (
                 SELECT id FROM ingredient_variants WHERE ingredient_id = ?
               );`,
              [id],
            );
          } catch (_) {}
          try {
            db.run(
              'DELETE FROM recipe_ingredient_substitutes WHERE ingredient_id = ?;',
              [id],
            );
          } catch (_) {}
          try {
            db.run(
              'DELETE FROM recipe_ingredient_map WHERE ingredient_id = ?;',
              [id],
            );
          } catch (_) {}
        });

        db.run('DELETE FROM ingredients WHERE lower(name) = lower(?);', [n]);
      } catch (err) {
        console.error('❌ Failed to delete shopping item:', err);
        uiToast('Failed to delete item. See console for details.');
        return false;
      }
    }

    // Persist DB after remove/hide.
    try {
      const binaryArray = db.export();
      const isElectronEnv = !!window.electronAPI;
      if (isElectronEnv) {
        window.electronAPI.saveDB(binaryArray);
      } else {
        localStorage.setItem(
          'favoriteEatsDb',
          JSON.stringify(Array.from(binaryArray)),
        );
      }
    } catch (err) {
      console.error(
        '❌ Failed to persist DB after removing shopping item:',
        err,
      );
    }

    return true;
  }

  // --- Shopping item label helpers (tests extract this block) ---
  function getShoppingItemDisplayName(item) {
    const fallbackName = String(item?.name || '').trim();
    if (!fallbackName) return '';
    if (typeof window?.getIngredientNounDisplay !== 'function') return fallbackName;

    const displayName = window.getIngredientNounDisplay({
      name: fallbackName,
      lemma: String(item?.lemma || '').trim(),
      pluralByDefault: !!item?.pluralByDefault,
      isMassNoun: !!item?.isMassNoun,
      pluralOverride: String(item?.pluralOverride || '').trim(),
    });

    return String(displayName || '').trim() || fallbackName;
  }

  if (typeof window !== 'undefined') {
    window.__shoppingItemLabelHelpers = {
      getShoppingItemDisplayName,
    };
  }
  // --- End shopping item label helpers ---

  function renderShoppingList(rows) {
    list.innerHTML = '';
    const items = Array.isArray(rows) ? rows : [];
    syncVariantParentByKey.clear();
    if (!items.length) {
      renderTopLevelEmptyState(
        list,
        'No shopping items yet. Add a shopping item.'
      );
      listNav?.syncAfterRender?.();
      return;
    }

    const makeTextMeasurer = (el) => {
      try {
        const cs = window.getComputedStyle ? getComputedStyle(el) : null;
        const fontStyle = cs ? cs.fontStyle : 'normal';
        const fontVariant = cs ? cs.fontVariant : 'normal';
        const fontWeight = cs ? cs.fontWeight : '400';
        const fontSize = cs ? cs.fontSize : '16px';
        const fontFamily = cs ? cs.fontFamily : 'sans-serif';
        const font = `${fontStyle} ${fontVariant} ${fontWeight} ${fontSize} ${fontFamily}`;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.font = font;
        return (s) => {
          try {
            return ctx.measureText(String(s || '')).width || 0;
          } catch (_) {
            return 0;
          }
        };
      } catch (_) {
        return null;
      }
    };

    const truncateToFitPx = (s, maxPx, measure) => {
      const str = String(s || '');
      if (!measure) return str;
      if (maxPx <= 0) return '';
      if (measure(str) <= maxPx) return str;

      // Ensure we can at least show an ellipsis when needed.
      const ell = '…';
      if (measure(ell) > maxPx) return '';

      let lo = 0;
      let hi = str.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const candidate = str.slice(0, Math.max(0, mid - 1)) + ell;
        if (measure(candidate) <= maxPx) lo = mid;
        else hi = mid - 1;
      }
      return str.slice(0, Math.max(0, lo - 1)) + ell;
    };

    const buildLineToFit = (li, baseName, variants, variantQtyMap) => {
      const vs = Array.isArray(variants)
        ? variants.map((v) => String(v || '').trim()).filter(Boolean)
        : [];
      if (vs.length === 0) return baseName;

      const anySelected =
        isShoppingWebSelectMode() &&
        variantQtyMap &&
        Array.from(variantQtyMap.values()).some((q) => q > 0);

      // Build the ordered list of variant display strings.
      // If any variant is selected: counted variants first (with count prefix,
      // "any" always first among them when its count > 0), then zero-count
      // variants name-only at the end.
      // If nothing selected: just variant names in DB order, no "any".
      let parts = [];
      if (anySelected) {
        const defaultQty = (variantQtyMap && variantQtyMap.get('default')) || 0;
        if (defaultQty > 0) parts.push(`${defaultQty} any`);
        const counted = [];
        const uncounted = [];
        vs.forEach((v) => {
          const q = (variantQtyMap && variantQtyMap.get(v)) || 0;
          if (q > 0) counted.push(`${q} ${v}`);
          else uncounted.push(v);
        });
        parts = parts.concat(counted, uncounted);
      } else {
        parts = vs.slice();
      }

      const cs = window.getComputedStyle ? getComputedStyle(li) : null;
      const padL = cs ? parseFloat(cs.paddingLeft) : 0;
      const padR = cs ? parseFloat(cs.paddingRight) : 0;
      const checkboxReserve = isShoppingWebSelectMode() ? 96 : 0;
      const maxPx = Math.max(
        0,
        li.clientWidth - (padL || 0) - (padR || 0) - checkboxReserve,
      );
      const measure = makeTextMeasurer(li);
      if (!measure || maxPx <= 0) return `${baseName} (${parts[0]})`;

      const prefix = `${baseName} (`;
      const close = `)`;
      const prefixW = measure(prefix);
      const closeW = measure(close);

      const full = `${baseName} (${parts.join(', ')})`;
      if (measure(full) <= maxPx) return full;

      if (parts.length <= 3) {
        const room = Math.max(0, maxPx - prefixW - closeW);
        const inside = truncateToFitPx(parts.join(', '), room, measure);
        return `${prefix}${inside}${close}`;
      }

      for (let visibleCount = 3; visibleCount >= 1; visibleCount--) {
        const remaining = parts.length - visibleCount;
        const suffix = `, + ${remaining} more`;
        const suffixW = measure(suffix);
        const roomForNames = Math.max(0, maxPx - prefixW - suffixW - closeW);

        if (roomForNames <= 0) continue;

        const names = parts.slice(0, visibleCount).join(', ');
        if (measure(names) <= roomForNames) {
          return `${prefix}${names}${suffix}${close}`;
        }
      }

      const remaining = parts.length - 1;
      const suffix = `, + ${remaining} more`;
      const suffixW = measure(suffix);
      const roomForFirst = Math.max(0, maxPx - prefixW - suffixW - closeW);
      const first = truncateToFitPx(parts[0], roomForFirst, measure) || '…';
      return `${prefix}${first}${suffix}${close}`;
    };

    const makeStepperDOM = () => {
      return listRowStepper.createStepperDOM();
    };

    syncVariantChildVisuals = (childLi, varKey) => {
      const qty = getShoppingQty(varKey);
      const isExpanded = expandedVariantChildSteppers.has(varKey);
      const icon = childLi.querySelector('.shopping-list-row-icon');
      const stepper = childLi.querySelector('.shopping-list-row-stepper');
      const qtyEl = stepper?.querySelector('.shopping-stepper-qty');
      childLi.classList.toggle('shopping-row-checked', qty > 0);
      if (qty > 0 || isExpanded) {
        if (icon) icon.style.display = 'none';
        if (stepper) stepper.style.display = '';
        if (qtyEl) qtyEl.textContent = String(qty);
      } else {
        if (icon) icon.style.display = '';
        if (stepper) stepper.style.display = 'none';
      }
    };

    items.forEach((item) => {
      const li = document.createElement('li');
      const baseName = String(item?.name || '').trim();
      const displayName = getShoppingItemDisplayName(item);
      const hasVariants = Array.isArray(item.variants) && item.variants.length > 0;
      const webSelectMode = isShoppingWebSelectMode();
      if (Number.isFinite(Number(item?.id)) && Number(item.id) > 0) {
        li.dataset.shoppingItemId = String(Math.trunc(Number(item.id)));
      }

      // ── Expandable variant row (web select mode only) ──
      if (hasVariants && webSelectMode) {
        li.classList.add('shopping-variant-parent');
        const itemKey = getShoppingSelectionKey(baseName);
        li.dataset.variantParentKey = itemKey;
        const isExpanded = expandedVariantItems.has(itemKey);
        li.dataset.expanded = isExpanded ? 'true' : 'false';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'shopping-list-row-label';
        labelSpan.textContent = displayName;

        const badge = document.createElement('span');
        badge.className = 'shopping-list-row-badge';
        // Keep the badge slot mounted to avoid parent-row layout shifts when
        // quantities transition between zero/non-zero while expanded.
        badge.style.display = 'inline-block';
        badge.style.visibility = 'hidden';

        li.appendChild(labelSpan);
        li.appendChild(badge);

        const childRows = [];

        // Parent visuals: chevron always visible; badge with total only when
        // collapsed with count > 0; no badge while expanded.
        // Defined before child row creation so incrementVariant can reference it.
        const syncParentVisuals = () => {
          const totalQty = getItemTotalQty(baseName, item.variants);
          const expanded = li.dataset.expanded === 'true';
          li.classList.toggle('shopping-row-checked', totalQty > 0);

          if (expanded) {
            labelSpan.textContent = `${displayName} \u25B4`;
            if (totalQty > 0) {
              badge.textContent = `${totalQty}x`;
              badge.style.visibility = 'visible';
            } else {
              badge.textContent = '';
              badge.style.visibility = 'hidden';
            }
          } else {
            if (totalQty > 0) {
              badge.textContent = `${totalQty}x`;
              badge.style.visibility = 'visible';
            } else {
              badge.textContent = '';
              badge.style.visibility = 'hidden';
            }
            requestAnimationFrame(() => {
              try {
                const qtyMap = getVariantQtyMap(baseName, item.variants);
                const nextText = buildLineToFit(li, displayName, item.variants, qtyMap);
                labelSpan.textContent = `${nextText} \u25BE`;
              } catch (_) {}
            });
          }
        };
        syncVariantParentByKey.set(itemKey, syncParentVisuals);

        // Build variant child rows: show "any" first, then DB sort order.
        const allVariantNames = ['default', ...item.variants];
        const clearVariantChildStepperExpansion = () => {
          allVariantNames.forEach((variantName) => {
            expandedVariantChildSteppers.delete(getVariantQtyKey(baseName, variantName));
          });
          childRows.forEach((row) => {
            const varKey = String(row.dataset.variantQtyKey || '');
            if (varKey) syncVariantChildVisuals(row, varKey);
          });
        };
        const toggleExpansion = () => {
          if (shoppingRowStepperController.collapseActive()) {
            syncAllVisibleShoppingRowStates();
          }
          const wasExpanded = expandedVariantItems.has(itemKey);
          if (wasExpanded) {
            expandedVariantItems.delete(itemKey);
            li.dataset.expanded = 'false';
            clearVariantChildStepperExpansion();
            childRows.forEach((r) => (r.style.display = 'none'));
          } else {
            collapseExpandedVariantRows();
            expandedVariantItems.add(itemKey);
            li.dataset.expanded = 'true';
            childRows.forEach((r) => (r.style.display = ''));
          }
          syncParentVisuals();
        };

        allVariantNames.forEach((variantName) => {
          const childLi = document.createElement('li');
          childLi.classList.add('shopping-variant-child');
          childLi.style.display = isExpanded ? '' : 'none';

          const childLabel = document.createElement('span');
          childLabel.className = 'shopping-list-row-label';
          childLabel.textContent = variantName === 'default' ? 'any' : variantName;

          const childIcon = document.createElement('span');
          childIcon.className = 'material-symbols-outlined shopping-list-row-icon';
          childIcon.textContent = 'add_box';
          childIcon.setAttribute('aria-hidden', 'true');

          const { stepper: childStepper, minusBtn, plusBtn, qtySpan } = makeStepperDOM();

          childLi.appendChild(childLabel);
          childLi.appendChild(childIcon);
          childLi.appendChild(childStepper);

          const varKey = getVariantQtyKey(baseName, variantName);
          childLi.dataset.variantQtyKey = varKey;
          syncVariantChildVisuals(childLi, varKey);

          const incrementVariant = (delta) => {
            const qty = getShoppingQty(varKey);
            const nextQty = getNextShoppingStepQty(qty, delta);
            setShoppingQty(varKey, nextQty, {
              itemName: baseName,
              variantName,
            });
            if (!hasPositiveShoppingQty(nextQty)) {
              expandedVariantChildSteppers.delete(varKey);
            }
            refreshShoppingSelectionUi();
          };
          attachShoppingQtyManualEdit({
            qtyEl: qtySpan,
            getQty: () => getShoppingQty(varKey),
            commitQty: (nextQty) =>
              setShoppingQty(varKey, nextQty, {
                itemName: baseName,
                variantName,
              }),
            onAfterCommit: () => refreshShoppingSelectionUi(),
          });

          childIcon.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            expandedVariantChildSteppers.add(varKey);
            incrementVariant(1);
          });
          minusBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (isShoppingWebSelectMode() && getShoppingQty(varKey) <= 0) {
              expandedVariantChildSteppers.delete(varKey);
              syncVariantChildVisuals(childLi, varKey);
              syncParentVisuals();
              return;
            }
            incrementVariant(-1);
          });
          plusBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            expandedVariantChildSteppers.add(varKey);
            incrementVariant(1);
          });

          childLi.addEventListener('click', (event) => {
            if (!isShoppingWebSelectMode()) return;
            if (expandedVariantChildSteppers.has(varKey)) {
              expandedVariantChildSteppers.delete(varKey);
            } else {
              expandedVariantChildSteppers.add(varKey);
            }
            syncVariantChildVisuals(childLi, varKey);
            syncParentVisuals();
          });

          childLi.addEventListener('contextmenu', (event) => {
            event.preventDefault();
          });

          childRows.push(childLi);
        });

        li.addEventListener('click', (event) => {
          const wantsRemove = event.ctrlKey || event.metaKey;
          const webSelectMode = isShoppingWebSelectMode();
          if (wantsRemove && !webSelectMode) {
            event.preventDefault();
            event.stopPropagation();
            void (async () => {
              const ok = await removeShoppingName(item.name || '');
              if (!ok) return;
              rememberShoppingScrollForReload();
              window.location.reload();
            })();
            return;
          }
          if (webSelectMode) {
            toggleExpansion();
            return;
          }
          sessionStorage.setItem('selectedShoppingItemId', String(item.id));
          sessionStorage.setItem('selectedShoppingItemName', item.name || '');
          sessionStorage.removeItem('selectedShoppingItemIsNew');
          rememberShoppingScrollForReload();
          window.location.href = 'shoppingEditor.html';
        });

        badge.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!isShoppingWebSelectMode()) return;
          toggleExpansion();
        });

        li.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          if (isShoppingWebSelectMode()) {
            if (isCtrlPrimaryContextMenuGesture(event)) return;
            li.classList.toggle('shopping-row-flagged');
            return;
          }
          void (async () => {
            const ok = await removeShoppingName(item.name || '');
            if (!ok) return;
            rememberShoppingScrollForReload();
            window.location.reload();
          })();
        });

        list.appendChild(li);
        childRows.forEach((child) => list.appendChild(child));
        syncParentVisuals();
        li.title = `${displayName}\n\nAll variants: ${item.variants.join(', ')}`;

        return; // next item
      }

      // ── Simple row (no variants, or non-web-mode) ──
      const labelSpan = document.createElement('span');
      labelSpan.className = 'shopping-list-row-label';
      labelSpan.textContent = displayName;
      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined shopping-list-row-icon';
      icon.textContent = 'add_box';
      icon.setAttribute('aria-hidden', 'true');

      const { stepper, minusBtn, plusBtn, qtySpan } = makeStepperDOM();

      const badge = document.createElement('span');
      badge.className = 'shopping-list-row-badge';
      badge.style.display = 'none';
      li.dataset.shoppingStepperKey = baseName;
      li.appendChild(labelSpan);
      li.appendChild(icon);
      li.appendChild(stepper);
      li.appendChild(badge);
      syncShoppingRowSelectionState(li, baseName);
      attachShoppingQtyManualEdit({
        qtyEl: qtySpan,
        getQty: () => getShoppingQty(getShoppingSelectionKey(baseName)),
        commitQty: (nextQty) =>
          setShoppingQty(getShoppingSelectionKey(baseName), nextQty, {
            itemName: baseName,
          }),
        onAfterCommit: () =>
          refreshShoppingSelectionUi({
            activeKey: getShoppingSelectionKey(baseName),
          }),
      });

      icon.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isShoppingWebSelectMode()) return;
        incrementShoppingQty(li, baseName, 1);
      });

      badge.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isShoppingWebSelectMode()) return;
        shoppingRowStepperController.activate(getShoppingSelectionKey(baseName));
        syncAllVisibleShoppingRowStates();
      });

      minusBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isShoppingWebSelectMode() && getShoppingQty(getShoppingSelectionKey(baseName)) <= 0) {
          if (shoppingRowStepperController.isActive(getShoppingSelectionKey(baseName))) {
            shoppingRowStepperController.collapseActive();
            syncAllVisibleShoppingRowStates();
          }
          return;
        }
        incrementShoppingQty(li, baseName, -1);
      });

      plusBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        incrementShoppingQty(li, baseName, 1);
      });

      li.addEventListener('click', (event) => {
        const wantsRemove = event.ctrlKey || event.metaKey;
        const webSelectMode = isShoppingWebSelectMode();
        if (wantsRemove && !webSelectMode) {
          event.preventDefault();
          event.stopPropagation();
          void (async () => {
            const ok = await removeShoppingName(item.name || '');
            if (!ok) return;
            rememberShoppingScrollForReload();
            window.location.reload();
          })();
          return;
        }

        if (webSelectMode) {
          const hadExpandedVariants = collapseExpandedVariantRows();
          // If this click only served to collapse an expanded variant group,
          // do not also auto-expand a simple-row stepper at qty 0.
          if (hadExpandedVariants) return;
          shoppingRowStepperController.toggle(getShoppingSelectionKey(baseName));
          syncAllVisibleShoppingRowStates();
          return;
        }

        sessionStorage.setItem('selectedShoppingItemId', String(item.id));
        sessionStorage.setItem('selectedShoppingItemName', item.name || '');
        sessionStorage.removeItem('selectedShoppingItemIsNew');
        rememberShoppingScrollForReload();
        window.location.href = 'shoppingEditor.html';
      });

      li.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        if (isShoppingWebSelectMode()) {
          if (isCtrlPrimaryContextMenuGesture(event)) return;
          li.classList.toggle('shopping-row-flagged');
          return;
        }
        void (async () => {
          const ok = await removeShoppingName(item.name || '');
          if (!ok) return;
          rememberShoppingScrollForReload();
          window.location.reload();
        })();
      });

      list.appendChild(li);

      if (hasVariants) {
        try {
          requestAnimationFrame(() => {
            try {
              const qtyMap = isShoppingWebSelectMode()
                ? getVariantQtyMap(baseName, item.variants)
                : null;
              const nextText = buildLineToFit(li, displayName, item.variants, qtyMap);
              labelSpan.textContent = nextText;
              li.title = `${displayName}\n\nAll variants: ${item.variants.join(', ')}`;
            } catch (_) {}
          });
        } catch (_) {}
      }
    });

    // Keep selection valid after rerender (search/filter changes).
    listNav?.syncAfterRender?.();
  }

  restoreShoppingChipState();
  mountShoppingFilterChips();
  // Initial render
  applyShoppingFilters();
  restoreShoppingScrollAfterReload();
  scrollToShoppingNavTarget(pendingShoppingNavTarget);

  // Recipes-style Add: popup → Cancel does nothing → Create inserts + opens editor
  async function openCreateShoppingItemDialog() {
    if (!window.ui) {
      uiToast('UI not ready yet.');
      return;
    }

    const name = await window.ui.prompt({
      title: 'New Shopping Item',
      label: 'Name',
      value: '',
      placeholder: '',
      confirmText: 'Create',
      cancelText: 'Cancel',
      required: true,
      normalize: (v) => (v || '').trim(),
    });
    if (!name) return;

    let newId = null;
    try {
      // Reuse existing ingredient if one with this name already exists.
      const existQ = db.exec(
        `SELECT ID FROM ingredients WHERE lower(name) = lower('${name.replace(/'/g, "''")}') LIMIT 1;`
      );
      if (existQ.length && existQ[0].values.length) {
        newId = existQ[0].values[0][0];
      } else {
        let cols = [];
        try {
          const info = db.exec('PRAGMA table_info(ingredients);');
          const rows = info.length ? info[0].values : [];
          cols = rows.map((r) => String(r[1] || '').toLowerCase());
        } catch (_) {
          cols = [];
        }
        const has = (c) => cols.includes(String(c).toLowerCase());

        const insCols = ['name'];
        const insVals = [name];
        if (has('lemma')) {
          insCols.push('lemma');
          insVals.push(deriveIngredientLemmaInMain(name));
        }

        const ph = insCols.map(() => '?').join(', ');
        db.run(`INSERT INTO ingredients (${insCols.join(', ')}) VALUES (${ph});`, insVals);
        const idQ = db.exec('SELECT last_insert_rowid();');
        if (idQ.length && idQ[0].values.length) {
          newId = idQ[0].values[0][0];
        }
      }
    } catch (err) {
      console.error('❌ Failed to create shopping item:', err);
      uiToast('Failed to create shopping item. See console.');
      return;
    }

    try {
      const binaryArray = db.export();
      const isElectronEnv = !!window.electronAPI;
      if (isElectronEnv) {
        const ok = await window.electronAPI.saveDB(binaryArray);
        if (ok === false) {
          uiToast('Failed to save database after creating shopping item.');
          return;
        }
      } else {
        localStorage.setItem(
          'favoriteEatsDb',
          JSON.stringify(Array.from(binaryArray)),
        );
      }
    } catch (err) {
      console.error(
        '❌ Failed to persist DB after creating shopping item:',
        err,
      );
      uiToast('Failed to save database after creating shopping item.');
      return;
    }

    if (newId != null) {
      sessionStorage.setItem('selectedShoppingItemId', String(newId));
      sessionStorage.setItem('selectedShoppingItemName', name);
      sessionStorage.setItem('selectedShoppingItemIsNew', '1');
      window.location.href = 'shoppingEditor.html';
    }
  }

  if (addBtn) {
    if (isShoppingWebSelectMode()) {
      addBtn.textContent = 'Reset';
      addBtn.addEventListener('click', () => {
        const hasItemSelections =
          Object.keys(getShoppingPlanItemSelections()).length > 0;
        const hasRecipeSelections =
          Object.keys(getShoppingPlanRecipeSelections()).length > 0;
        if (!hasItemSelections && !hasRecipeSelections) {
          uiToast('No shopping selections to clear.');
          return;
        }
        const previousPlan = cloneForUndo(getShoppingPlan(), () =>
          createEmptyShoppingPlan()
        );
        const previousShoppingQuantities = new Map(shoppingQuantities);
        const previousShoppingRecipeQuantities = new Map(shoppingRecipeQuantities);
        const previousSelectedShoppingNames = new Set(selectedShoppingNames);
        const previousShoppingSelectionMeta = new Map(
          Array.from(shoppingSelectionMeta.entries(), ([key, value]) => [
            key,
            cloneForUndo(value, () => value),
          ])
        );
        const restoreClearedSelections = () => {
          persistShoppingPlan(previousPlan);
          shoppingQuantities.clear();
          previousShoppingQuantities.forEach((qty, key) => {
            shoppingQuantities.set(key, qty);
          });
          shoppingRecipeQuantities.clear();
          previousShoppingRecipeQuantities.forEach((qty, key) => {
            shoppingRecipeQuantities.set(key, qty);
          });
          selectedShoppingNames.clear();
          previousSelectedShoppingNames.forEach((name) => {
            selectedShoppingNames.add(name);
          });
          shoppingSelectionMeta.clear();
          previousShoppingSelectionMeta.forEach((meta, key) => {
            shoppingSelectionMeta.set(key, cloneForUndo(meta, () => meta));
          });
          collapseExpandedVariantRows();
          shoppingRowStepperController?.collapseAll?.();
          refreshShoppingSelectionUi();
          syncShoppingActionButtonState();
        };
        clearShoppingPlanSelections({ clearItems: true, clearRecipes: true });
        shoppingQuantities.clear();
        shoppingRecipeQuantities.clear();
        selectedShoppingNames.clear();
        shoppingSelectionMeta.clear();
        collapseExpandedVariantRows();
        shoppingRowStepperController?.collapseAll?.();
        refreshShoppingSelectionUi();
        syncShoppingActionButtonState();
        uiToastUndo('All shopping selections cleared.', restoreClearedSelections);
      });
    } else {
      addBtn.addEventListener('click', () => {
        void openCreateShoppingItemDialog();
      });
    }
  }
}

// --- Shopping list checklist helpers (tests extract this block) ---
const SHOPPING_LIST_DOC_STORAGE_KEY = 'favoriteEats:shopping-list-doc:v2';
const SHOPPING_LIST_DOC_VERSION = 3;

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
    rawRow && typeof rawRow === 'object' && !Array.isArray(rawRow) ? rawRow : {};
  const text = String(source.text || '').trim();
  if (!text) return null;
  const rawOrder = Number(source.order);
  const rawStoreId = Math.trunc(Number(source.storeId));
  const rawAisleId = Math.trunc(Number(source.aisleId));
  const rawAisleSortOrder = Number(source.aisleSortOrder);
  const hasExplicitAisleSortOrder =
    source.aisleSortOrder != null && String(source.aisleSortOrder).trim() !== '';
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
      ? (hasExplicitUserEdited ? !!source.userEdited || inferredUserEdited : inferredUserEdited)
      : false,
    order: Number.isFinite(rawOrder) ? rawOrder : fallbackOrder,
  };
}

function normalizeShoppingListDoc(rawDoc) {
  const source =
    rawDoc && typeof rawDoc === 'object' && !Array.isArray(rawDoc) ? rawDoc : {};
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
    localStorage.setItem(SHOPPING_LIST_DOC_STORAGE_KEY, JSON.stringify(normalized));
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
    storedRows.length > 0 && storedRows.every((row) => !String(row?.sourceKey || '').trim());
  if (!allRowsNeedSourceKeys) return normalizedStoredDoc;
  if (storedRows.length !== generatedRows.length) return normalizedStoredDoc;
  const canHydrateByOrder = storedRows.every((row, index) => {
    const generatedRow = generatedRows[index];
    if (!generatedRow || !String(generatedRow.sourceKey || '').trim()) return false;
    return (
      String(row.storeLabel || '').trim() === String(generatedRow.storeLabel || '').trim() &&
      String(row.bucketLabel || '').trim() === String(generatedRow.bucketLabel || '').trim()
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
        userEdited: generatedText ? String(row?.text || '').trim() !== generatedText : false,
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
        currentStoreId = Number.isFinite(rowStoreId) && rowStoreId > 0 ? rowStoreId : null;
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
      currentAisleId = Number.isFinite(rowAisleId) && rowAisleId > 0 ? rowAisleId : null;
      currentAisleSortOrder = Number.isFinite(rowAisleSortOrder) ? rowAisleSortOrder : null;
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
  const normalizedStoredDoc = hydrateLegacyShoppingListDocSources(storedDoc, normalizedGeneratedDoc);
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
      String(storedRow.sourceText || '').trim() !== String(generatedRow.sourceText || '').trim() ||
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
      text: hasUserOverride ? String(storedRow.text || '').trim() : String(generatedRow.text || '').trim(),
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
  const rowIndex = rows.findIndex((row) => String(row?.id || '') === String(conflict?.rowId || ''));
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
      storeId: Number.isFinite(nextStoreId) && nextStoreId > 0 ? nextStoreId : null,
      bucketLabel: nextBucketLabel,
      aisleId: Number.isFinite(nextAisleId) && nextAisleId > 0 ? nextAisleId : null,
      aisleSortOrder: Number.isFinite(nextAisleSortOrder) ? nextAisleSortOrder : null,
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
      storeId: Number.isFinite(nextStoreId) && nextStoreId > 0 ? nextStoreId : null,
      bucketLabel: nextBucketLabel,
      aisleId: Number.isFinite(nextAisleId) && nextAisleId > 0 ? nextAisleId : null,
      aisleSortOrder: Number.isFinite(nextAisleSortOrder) ? nextAisleSortOrder : null,
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
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  return normalized.replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function normalizeShoppingListBucketKey(bucketLabel) {
  return String(bucketLabel || '').trim().toLowerCase();
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
      hasExplicitSortOrder && Number.isFinite(rawSortOrder) ? rawSortOrder : 999999;
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
      (!Number.isFinite(bucket.aisleId) || bucket.aisleId == null || aisleId < bucket.aisleId)
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
      (Number.isFinite(a.sortOrder) && a.sortOrder < 999999) || Number.isFinite(a.aisleId);
    const hasExplicitOrderB =
      (Number.isFinite(b.sortOrder) && b.sortOrder < 999999) || Number.isFinite(b.aisleId);
    if (!hasExplicitOrderA && !hasExplicitOrderB) {
      return a.firstIndex - b.firstIndex;
    }
    const labelDelta = String(a.label || '').localeCompare(String(b.label || ''), undefined, {
      sensitivity: 'base',
    });
    if (labelDelta !== 0) {
      return labelDelta;
    }
    return a.firstIndex - b.firstIndex;
  });
}

function formatShoppingListPlainText(docRows) {
  const rows = normalizeShoppingListDoc({ rows: docRows })
    .rows.filter((row) => !row?.checked && String(row?.text || '').trim());
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
    const storeRows = rows.filter((row) => String(row?.storeLabel || '') === storeLabel);
    if (!storeRows.length) return;
    if (lines.length) lines.push('');
    const normalizedStoreLabel = String(storeLabel || '').trim();
    lines.push((normalizedStoreLabel || 'Unlisted').toUpperCase());

    const bucketDescriptors = getShoppingListBucketDescriptors(storeRows);
    const soleUnlistedPseudo =
      !normalizedStoreLabel &&
      bucketDescriptors.length === 1 &&
      normalizeShoppingListBucketKey(bucketDescriptors[0]?.label) === 'unlisted';

    bucketDescriptors.forEach((bucket) => {
      const bucketLabel = String(bucket?.label || '').trim();
      const normalizedBucketLabel = bucketLabel;
      if (
        normalizedBucketLabel &&
        !(soleUnlistedPseudo && normalizeShoppingListBucketKey(normalizedBucketLabel) === 'unlisted')
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
  const rows = normalizeShoppingListDoc({ rows: docRows })
    .rows.filter((row) => !row?.checked && String(row?.text || '').trim());
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
    const storeRows = rows.filter((row) => String(row?.storeLabel || '') === storeLabel);
    if (!storeRows.length) return;
    if (blocks.length) blocks.push('<br>');

    const normalizedStoreLabel = String(storeLabel || '').trim();
    blocks.push(`<p>${escapeHtml((normalizedStoreLabel || 'Unlisted').toUpperCase())}</p>`);

    const bucketDescriptors = getShoppingListBucketDescriptors(storeRows);
    const soleUnlistedPseudo =
      !normalizedStoreLabel &&
      bucketDescriptors.length === 1 &&
      normalizeShoppingListBucketKey(bucketDescriptors[0]?.label) === 'unlisted';

    bucketDescriptors.forEach((bucket) => {
      const bucketLabel = String(bucket?.label || '').trim();
      const normalizedBucketLabel = bucketLabel;
      const shouldShowBucketLabel =
        normalizedBucketLabel &&
        !(soleUnlistedPseudo && normalizeShoppingListBucketKey(normalizedBucketLabel) === 'unlisted');
      if (shouldShowBucketLabel) {
        blocks.push(`<p>${escapeHtml(toShoppingListAisleTitleCase(normalizedBucketLabel))}</p>`);
      }
      const bucketItems = storeRows.filter((row) => getShoppingListDocBucketKey(row) === bucket.key);
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

function buildShoppingListExportPayload(docRows, options = {}) {
  const rows = normalizeShoppingListDoc({ rows: docRows })
    .rows.filter((row) => !row?.checked && String(row?.text || '').trim());
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
    const storeRows = rows.filter((row) => String(row?.storeLabel || '') === storeLabel);
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
      normalizeShoppingListBucketKey(bucketDescriptors[0]?.label) === 'unlisted';

    bucketDescriptors.forEach((bucket) => {
      const bucketRows = storeRows.filter((row) => getShoppingListDocBucketKey(row) === bucket.key);
      if (!bucketRows.length) return;
      const normalizedBucketLabel = String(bucket?.label || '').trim();
      const shouldShowBucketLabel =
        normalizedBucketLabel &&
        !(soleUnlistedPseudo && normalizeShoppingListBucketKey(normalizedBucketLabel) === 'unlisted');
      storeEntry.aisles.push({
        label: shouldShowBucketLabel ? toShoppingListAisleTitleCase(normalizedBucketLabel) : '',
        items: bucketRows.map((row) => String(row?.text || '').trim()).filter(Boolean),
      });
    });

    if (storeEntry.aisles.length) {
      stores.push(storeEntry);
    }
  });

  return { title, stores };
}

function filterShoppingListChecklistRowsForCollapse(displayRows, collapsedKeys) {
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
      if (row.completedSectionKey && collapsed.has(String(row.completedSectionKey || ''))) {
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

const SHOPPING_LIST_HOME_LOCATION_DEFS = [
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
  const value = String(raw || '').trim().toLowerCase();
  if (!value || value === 'measures') return 'none';
  return SHOPPING_LIST_HOME_LOCATION_DEFS.some((entry) => entry.id === value)
    ? value
    : 'none';
}

function getShoppingListSourceBaseKey(sourceKey) {
  const normalized = String(sourceKey || '').trim().toLowerCase();
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
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return true;
  return String(row?.text || '').toLowerCase().includes(normalizedQuery);
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
  const normalizedQuery = String(options?.searchQuery || '').trim().toLowerCase();
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
    const storeRows = visibleRows.filter((row) => String(row.storeLabel || '') === storeLabel);
    if (!storeRows.length) return;

    const activeRows = storeRows.filter((row) => !row.checked);
    const completedRows = storeRows.filter((row) => row.checked);
    const bucketDescriptors = getShoppingListBucketDescriptors([
      ...(isSearchActive ? activeRows : [...activeRows, ...completedRows]),
    ]);

    const soleUnlistedPseudo =
      !storeLabel &&
      bucketDescriptors.length === 1 &&
      normalizeShoppingListBucketKey(bucketDescriptors[0]?.label) === 'unlisted';

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
        if (soleUnlistedPseudo && normalizeShoppingListBucketKey(label) === 'unlisted') {
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
        text: 'Completed',
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
  const sourceKey = String(row?.sourceKey || '').trim().toLowerCase();
  const lookup =
    homeLocationBySourceKey instanceof Map
      ? homeLocationBySourceKey
      : new Map(Object.entries(homeLocationBySourceKey || {}));
  if (sourceKey && lookup.has(sourceKey)) {
    return normalizeShoppingHomeLocationId(lookup.get(sourceKey));
  }
  const baseKey = getShoppingListSourceBaseKey(sourceKey);
  if (baseKey && lookup.has(baseKey)) {
    return normalizeShoppingHomeLocationId(lookup.get(baseKey));
  }
  return 'none';
}

function buildShoppingListChecklistHomeDisplayRows(rows, options = {}) {
  const normalizedQuery = String(options?.searchQuery || '').trim().toLowerCase();
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
        getShoppingListHomeLocationIdForRow(row, homeLocationBySourceKey) === locationDef.id,
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
      text: 'Completed',
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
  const mode = String(options?.mode || 'stores').trim().toLowerCase();
  if (mode === 'home') {
    return buildShoppingListChecklistHomeDisplayRows(rows, options);
  }
  return buildShoppingListChecklistStoreDisplayRows(rows, options);
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
  const list = document.getElementById('shoppingListOutput');
  const shoppingListWebMode = isForceWebModeEnabled();
  const shoppingListExportEnabled = false;

  initAppBar({
    mode: 'list',
    titleText: 'Shopping List',
    showSearch: true,
    showAdd: shoppingListWebMode,
  });

  if (typeof waitForAppBarReady === 'function') {
    await waitForAppBarReady();
  }
  initBottomNav();

  if (!list) return;

  const searchInput = document.getElementById('appBarSearchInput');
  const clearBtn = document.getElementById('appBarSearchClear');

  const isElectron = !!window.electronAPI;
  let db = window.dbInstance;
  if (!db || typeof db.exec !== 'function') {
    if (isElectron) {
      try {
        const pathHint = localStorage.getItem('favoriteEatsDbPath') || null;
        const bytes = await window.electronAPI.loadDB(pathHint);
        const Uints = new Uint8Array(bytes);
        db = new SQL.Database(Uints);
      } catch (err) {
        console.error('❌ Failed to load DB from disk:', err);
        uiToast('No database loaded. Please go back to the welcome page.');
        window.location.href = 'index.html';
        return;
      }
    } else {
      const stored = localStorage.getItem('favoriteEatsDb');
      if (!stored) {
        uiToast('No database loaded. Please go back to the welcome page.');
        window.location.href = 'index.html';
        return;
      }
      const Uints = new Uint8Array(JSON.parse(stored));
      db = new SQL.Database(Uints);
    }
    window.dbInstance = db;
    await ensureIngredientLemmaMaintenanceInMain(db, isElectron);
  }

  const listNav = enableTopLevelListKeyboardNav(list);
  const getGeneratedShoppingListDoc = () =>
    buildShoppingListDocFromPlanRows(getShoppingPlanSelectionRows({ db }));
  const initialShoppingListSync = mergeShoppingListDocWithGenerated(
    loadShoppingListDocFromStorage(),
    getGeneratedShoppingListDoc(),
  );
  const pageWrapper =
    list.closest('.page-wrapper') instanceof HTMLElement ? list.closest('.page-wrapper') : null;

  let controls = null;
  if (!shoppingListWebMode) {
    controls = document.getElementById('shoppingListControls');
    if (!(controls instanceof HTMLElement) && pageWrapper) {
      controls = document.createElement('div');
      controls.id = 'shoppingListControls';
      controls.className = 'shopping-list-controls';
      pageWrapper.insertBefore(controls, list);
    }
  }

  let shoppingListDoc = persistShoppingListDoc(initialShoppingListSync.doc);
  let pendingSourceConflicts = Array.isArray(initialShoppingListSync.conflicts)
    ? initialShoppingListSync.conflicts.slice()
    : [];
  let editingRowId = '';
  let exportBtn = null;
  let webCopyBtn = null;
  let webExportBtn = null;
  let resetBtn = null;
  let webResetBtn = null;
  let resolvingSourceConflicts = false;
  let exportingShoppingList = false;
  const pendingCheckTimers = new Map();
  const pendingCheckedRowIds = new Set();
  const collapsedShoppingListSections = new Set();
  const expandedShoppingListContributionRows = new Set();
  const CHECK_MOVE_DELAY_MS = 260;
  const shoppingListViewChipDefs = [
    { id: 'stores', label: 'Stores' },
    { id: 'home', label: 'Home' },
  ];
  let shoppingListViewMode = 'stores';
  let shoppingListFilterChipRail = null;
  let shoppingListHomeLocationCacheKey = '';
  let shoppingListHomeLocationBySourceKey = new Map();

  const toResetComparableRows = (doc) =>
    normalizeShoppingListDoc(doc).rows.map((row, index) => ({
      text: String(row?.text || '').trim(),
      checked: !!row?.checked,
      storeLabel: String(row?.storeLabel || '').trim(),
      bucketLabel: String(row?.bucketLabel || '').trim(),
      order: index,
    }));

  const isShoppingListResetNoOp = (nextDoc) => {
    const generatedDoc = nextDoc || getGeneratedShoppingListDoc();
    const currentComparable = toResetComparableRows(shoppingListDoc);
    const generatedComparable = toResetComparableRows(generatedDoc);
    return JSON.stringify(currentComparable) === JSON.stringify(generatedComparable);
  };

  const syncShoppingListResetButtonState = (nextDoc) => {
    const shouldDisable = isShoppingListResetNoOp(nextDoc);
    const syncBtn = (btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      btn.disabled = shouldDisable;
      btn.setAttribute('aria-disabled', shouldDisable ? 'true' : 'false');
    };
    syncBtn(resetBtn);
    syncBtn(webResetBtn);
  };

  const syncShoppingListCopyButtonState = () => {
    const shouldDisable = !formatShoppingListPlainText(shoppingListDoc?.rows).trim();
    if (!(webCopyBtn instanceof HTMLButtonElement)) return;
    webCopyBtn.disabled = shouldDisable;
    webCopyBtn.setAttribute('aria-disabled', shouldDisable ? 'true' : 'false');
  };

  const syncShoppingListExportButtonState = () => {
    if (!shoppingListExportEnabled) return;
    const hasItems = buildShoppingListExportPayload(shoppingListDoc?.rows).stores.length > 0;
    const isAvailable = !!window.electronAPI?.googleDocsExportShoppingList;
    const shouldDisable = !hasItems || !isAvailable || exportingShoppingList;
    const syncBtn = (btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      btn.disabled = shouldDisable;
      btn.setAttribute('aria-disabled', shouldDisable ? 'true' : 'false');
      btn.textContent = exportingShoppingList ? 'Exporting...' : 'Export';
    };
    syncBtn(exportBtn);
    syncBtn(webExportBtn);
  };

  const cancelPendingCheck = (rowId) => {
    const normalizedId = String(rowId || '');
    const timerId = pendingCheckTimers.get(normalizedId);
    if (timerId) window.clearTimeout(timerId);
    pendingCheckTimers.delete(normalizedId);
    pendingCheckedRowIds.delete(normalizedId);
  };
  const cancelAllPendingChecks = () => {
    Array.from(pendingCheckTimers.keys()).forEach((rowId) => {
      cancelPendingCheck(rowId);
    });
  };

  const updateRow = (rowId, mutator, { message = '', undoMessage = '' } = {}) => {
    const currentRows = Array.isArray(shoppingListDoc?.rows) ? shoppingListDoc.rows : [];
    const rowIndex = currentRows.findIndex((row) => String(row?.id || '') === String(rowId || ''));
    if (rowIndex === -1) return;
    const previousRow = cloneForUndo(currentRows[rowIndex], () => currentRows[rowIndex]);
    const nextRowDraft = cloneForUndo(currentRows[rowIndex], () => currentRows[rowIndex]);
    if (!nextRowDraft || typeof mutator !== 'function') return;
    mutator(nextRowDraft);
    const nextText = String(nextRowDraft.text || '').trim();
    if (!nextText) return;
    nextRowDraft.text = nextText;
    if (String(nextRowDraft.sourceKey || '').trim()) {
      const sourceText = String(nextRowDraft.sourceText || '').trim();
      nextRowDraft.userEdited = !!sourceText && nextText !== sourceText;
    }
    const nextRows = currentRows.slice();
    nextRows[rowIndex] = nextRowDraft;
    shoppingListDoc = persistShoppingListDoc({
      ...shoppingListDoc,
      rows: nextRows,
    });
    renderChecklist();
    if (message || undoMessage) {
      uiToastUndo(message || undoMessage, () => {
        const restoreRows = Array.isArray(shoppingListDoc?.rows) ? shoppingListDoc.rows.slice() : [];
        const restoreIndex = restoreRows.findIndex(
          (row) => String(row?.id || '') === String(rowId || ''),
        );
        if (restoreIndex === -1) return;
        restoreRows[restoreIndex] = previousRow;
        shoppingListDoc = persistShoppingListDoc({
          ...shoppingListDoc,
          rows: restoreRows,
        });
        editingRowId = '';
        renderChecklist();
      });
    }
  };

  const buildShoppingListConflictDialog = (conflicts) => {
    const list = Array.isArray(conflicts) ? conflicts.filter(Boolean) : [];
    const count = list.length;
    const singular = count === 1;
    const title = `Review changes (${count})`;
    const body = singular
      ? 'An item you edited has been updated.'
      : 'Some items you edited have been updated.';
    const previewLimit = 3;
    const previewLines = [];
    list.slice(0, previewLimit).forEach((conflict, index) => {
      const currentText = String(conflict?.currentText || '').trim() || '(empty)';
      const nextGeneratedText = String(conflict?.nextGeneratedText || '').trim();
      const nextGeneratedDisplayText = String(
        conflict?.nextGeneratedDisplayText || nextGeneratedText,
      ).trim();
      const updateText =
        nextGeneratedDisplayText ||
        (String(conflict?.kind || '').trim() === 'remove'
          ? '(removed from shopping plan)'
          : '(empty)');
      previewLines.push(`Edit:    ${currentText}`);
      previewLines.push(`Update:  ${updateText}`);
      if (index < Math.min(previewLimit, count) - 1) previewLines.push('');
    });
    if (count > previewLimit) {
      previewLines.push('');
      previewLines.push(`+ ${count - previewLimit} more updates`);
    }
    return {
      title,
      message: [body, '', ...previewLines].join('\n').trim(),
      confirmText: singular ? 'Use update' : 'Use updates',
      cancelText: 'Keep my edits',
    };
  };

  const resolvePendingSourceConflicts = async () => {
    if (resolvingSourceConflicts) return;
    if (!pendingSourceConflicts.length) return;
    resolvingSourceConflicts = true;
    try {
      const conflictsToResolve = pendingSourceConflicts.filter((conflict) => {
        if (!conflict || typeof conflict !== 'object') return false;
        return Array.isArray(shoppingListDoc?.rows)
          ? shoppingListDoc.rows.some(
              (row) => String(row?.id || '') === String(conflict?.rowId || ''),
            )
          : false;
      });
      pendingSourceConflicts = [];
      if (!conflictsToResolve.length) return;
      const dialog = buildShoppingListConflictDialog(conflictsToResolve);
      const useUpdate = await uiConfirm(dialog);
      conflictsToResolve.forEach((conflict) => {
        shoppingListDoc = persistShoppingListDoc(
          resolveShoppingListDocConflict(
            shoppingListDoc,
            conflict,
            useUpdate ? 'replace' : 'keep',
          ),
        );
      });
      editingRowId = '';
      renderChecklist();
    } finally {
      resolvingSourceConflicts = false;
    }
  };

  const rerenderShoppingListFilterChips = () => {
    const chipMountEl = shoppingListFilterChipRail?.trackEl;
    if (!(chipMountEl instanceof HTMLElement)) return;
    if (typeof window.renderFilterChipList !== 'function') return;
    window.renderFilterChipList({
      mountEl: chipMountEl,
      chips: shoppingListViewChipDefs,
      activeChipIds: new Set([shoppingListViewMode]),
      onToggle: (chipId) => {
        const nextMode = chipId === 'home' ? 'home' : 'stores';
        if (nextMode === shoppingListViewMode) return;
        shoppingListViewMode = nextMode;
        collapsedShoppingListSections.clear();
        rerenderShoppingListFilterChips();
        renderChecklist();
      },
      chipClassName: 'app-filter-chip',
    });
  };

  const mountShoppingListFilterChips = () => {
    if (!(searchInput instanceof HTMLInputElement)) return;
    if (typeof window.mountTopFilterChipRail !== 'function') return;
    shoppingListFilterChipRail = window.mountTopFilterChipRail({
      anchorEl: searchInput,
      dockId: 'shoppingListFilterChipDock',
    });
    rerenderShoppingListFilterChips();
    shoppingListFilterChipRail?.sync?.();
  };

  const getShoppingListHomeLocationMap = () => {
    const normalizedRows = normalizeShoppingListDoc(shoppingListDoc).rows;
    const sourceKeys = Array.from(
      new Set(
        normalizedRows
          .map((row) => String(row?.sourceKey || '').trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    const signature = sourceKeys.join('|');
    if (signature === shoppingListHomeLocationCacheKey) {
      return shoppingListHomeLocationBySourceKey;
    }

    const nextMap = new Map(sourceKeys.map((sourceKey) => [sourceKey, 'none']));
    const baseNameKeys = Array.from(
      new Set(sourceKeys.map((sourceKey) => getShoppingListSourceBaseKey(sourceKey)).filter(Boolean)),
    );

    if (baseNameKeys.length && db && typeof db.exec === 'function') {
      try {
        const placeholders = baseNameKeys.map(() => '?').join(',');
        const result = db.exec(
          `
            SELECT lower(trim(name)) AS name_key,
                   COALESCE(location_at_home, '') AS location_at_home
              FROM ingredients
             WHERE lower(trim(name)) IN (${placeholders})
             ORDER BY ID ASC;
          `,
          baseNameKeys,
        );
        const locationByNameKey = new Map();
        if (Array.isArray(result) && result.length && Array.isArray(result[0].values)) {
          result[0].values.forEach(([nameKey, rawLocation]) => {
            const normalizedNameKey = String(nameKey || '').trim().toLowerCase();
            if (!normalizedNameKey || locationByNameKey.has(normalizedNameKey)) return;
            locationByNameKey.set(
              normalizedNameKey,
              normalizeShoppingHomeLocationId(rawLocation),
            );
          });
        }
        sourceKeys.forEach((sourceKey) => {
          const baseKey = getShoppingListSourceBaseKey(sourceKey);
          if (!baseKey) return;
          nextMap.set(
            sourceKey,
            normalizeShoppingHomeLocationId(locationByNameKey.get(baseKey) || 'none'),
          );
        });
      } catch (_) {}
    }

    shoppingListHomeLocationCacheKey = signature;
    shoppingListHomeLocationBySourceKey = nextMap;
    return shoppingListHomeLocationBySourceKey;
  };

  if (searchInput instanceof HTMLInputElement) {
    wireAppBarSearch(searchInput, {
      clearBtn,
      onQueryChange: () => {
        renderChecklist();
      },
      normalizeQuery: (value) => String(value || '').trim(),
    });
  }

  const renderChecklist = () => {
    const searchQuery = String(searchInput?.value || '').trim();
    const isSearchActive = !!searchQuery;
    const displayRows = getShoppingListChecklistDisplayRows(shoppingListDoc?.rows || [], {
      mode: shoppingListViewMode,
      searchQuery,
      homeLocationBySourceKey: getShoppingListHomeLocationMap(),
    });
    const planRowsByKey = new Map(
      getShoppingPlanSelectionRows({ db })
        .filter((row) => String(row?.key || '').trim())
        .map((row) => [String(row.key || '').trim(), row]),
    );
    const shoppingNavKeys =
      window.favoriteEatsSessionKeys && typeof window.favoriteEatsSessionKeys === 'object'
        ? window.favoriteEatsSessionKeys
        : {
            shoppingNavTargetId: 'favoriteEats:shopping-nav-target-id',
            shoppingNavTargetName: 'favoriteEats:shopping-nav-target-name',
          };
    list.innerHTML = '';

    if (!displayRows.length) {
      if (isSearchActive) {
        renderTopLevelEmptyState(list, 'No matching items.');
      } else {
        renderTopLevelEmptyState(list, [
          'No shopping list yet.',
          'Select some shopping items or recipes.',
        ]);
      }
      listNav?.syncAfterRender?.();
      syncShoppingListResetButtonState();
      syncShoppingListCopyButtonState();
      return;
    }

    const visibleRows = isSearchActive
      ? displayRows
      : filterShoppingListChecklistRowsForCollapse(displayRows, collapsedShoppingListSections);

    visibleRows.forEach((row) => {
      const li = document.createElement('li');
      if (row?.rowType === 'section') {
        li.className = `list-section-label ${String(row?.className || '').trim()}`.trim();
        const sectionToggleKey = String(row?.sectionCollapseKey || '').trim();
        const isCollapsible = !isSearchActive && !!row.collapsible && !!sectionToggleKey;
        if (isCollapsible) {
          const toggleBtn = document.createElement('button');
          toggleBtn.type = 'button';
          const isCompleted = String(row?.className || '').includes(
            'shopping-list-section--completed',
          );
          toggleBtn.className = isCompleted
            ? 'shopping-list-section-toggle shopping-list-section-toggle--completed'
            : 'shopping-list-section-toggle';
          const isExpanded = !collapsedShoppingListSections.has(sectionToggleKey);
          toggleBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
          const toggleLabel = document.createElement('span');
          toggleLabel.className = 'shopping-list-section-toggle__label';
          toggleLabel.textContent = String(row.text || row.label || '').trim();
          toggleBtn.appendChild(toggleLabel);
          const toggleIcon = document.createElement('span');
          toggleIcon.className = 'material-symbols-outlined shopping-list-section-toggle__icon';
          toggleIcon.setAttribute('aria-hidden', 'true');
          toggleIcon.textContent = 'expand_more';
          toggleBtn.appendChild(toggleIcon);
          toggleBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (collapsedShoppingListSections.has(sectionToggleKey)) {
              collapsedShoppingListSections.delete(sectionToggleKey);
            } else {
              collapsedShoppingListSections.add(sectionToggleKey);
            }
            renderChecklist();
          });
          li.appendChild(toggleBtn);
        } else {
          li.textContent = String(row.text || row.label || '').trim();
        }
        list.appendChild(li);
        return;
      }

      li.className = String(row?.className || '').trim();
      li.dataset.shoppingListRowId = String(row?.id || '');
      const isPendingChecked = pendingCheckedRowIds.has(String(row?.id || ''));
      li.classList.toggle('shopping-list-doc-item--checked', !!row?.checked || isPendingChecked);
      const sourceKey = String(row?.sourceKey || '').trim();
      const planRow =
        sourceKey && !row?.userEdited ? planRowsByKey.get(sourceKey) || null : null;
      const contributionRows = Array.isArray(planRow?.contributionRows)
        ? planRow.contributionRows.filter(Boolean)
        : [];
      const hasRecipeContributions = contributionRows.some(
        (entry) => String(entry?.sourceType || '') === 'recipe',
      );
      const supportsExpansion = !!sourceKey && !!planRow && hasRecipeContributions;
      const isExpanded = supportsExpansion && expandedShoppingListContributionRows.has(sourceKey);

      const checkbox = document.createElement('button');
      checkbox.type = 'button';
      checkbox.className = 'shopping-list-doc-checkbox';
      checkbox.setAttribute(
        'aria-label',
        row?.checked || isPendingChecked ? 'Mark item incomplete' : 'Mark item complete',
      );
      checkbox.setAttribute('aria-pressed', row?.checked || isPendingChecked ? 'true' : 'false');
      const checkboxIcon = document.createElement('span');
      checkboxIcon.className = 'material-symbols-outlined';
      checkboxIcon.setAttribute('aria-hidden', 'true');
      checkboxIcon.textContent =
        row?.checked || isPendingChecked ? 'check_box' : 'check_box_outline_blank';
      checkbox.appendChild(checkboxIcon);
      checkbox.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        editingRowId = '';
        if (pendingCheckedRowIds.has(String(row?.id || ''))) {
          cancelPendingCheck(row.id);
          renderChecklist();
          return;
        }
        if (!row?.checked) {
          pendingCheckedRowIds.add(String(row.id || ''));
          renderChecklist();
          const timerId = window.setTimeout(() => {
            pendingCheckTimers.delete(String(row.id || ''));
            pendingCheckedRowIds.delete(String(row.id || ''));
            updateRow(
              row.id,
              (draft) => {
                draft.checked = true;
              },
              {
                message: 'Item completed.',
              },
            );
          }, CHECK_MOVE_DELAY_MS);
          pendingCheckTimers.set(String(row.id || ''), timerId);
          return;
        }
        updateRow(
          row.id,
          (draft) => {
            draft.checked = !draft.checked;
          },
          {
            message: row?.checked ? 'Item restored.' : 'Item completed.',
          },
        );
      });

      const textWrap = document.createElement('div');
      textWrap.className = 'shopping-list-doc-text-wrap';

      if (editingRowId === row.id) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'shopping-list-doc-input';
        input.value = String(row?.text || '');
        const finishEditing = (mode) => {
          if (editingRowId !== row.id) return;
          const nextValue = String(input.value || '').trim();
          editingRowId = '';
          if (mode === 'commit' && nextValue && nextValue !== String(row?.text || '').trim()) {
            updateRow(
              row.id,
              (draft) => {
                draft.text = nextValue;
              },
              {
                message: 'Row updated.',
              },
            );
            return;
          }
          renderChecklist();
        };
        input.addEventListener('click', (event) => event.stopPropagation());
        input.addEventListener('keydown', (event) => {
          event.stopPropagation();
          if (event.key === 'Enter') {
            event.preventDefault();
            finishEditing('commit');
            return;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            finishEditing('cancel');
          }
        });
        input.addEventListener('blur', () => finishEditing('commit'));
        textWrap.appendChild(input);
      } else {
        const headline = document.createElement('div');
        headline.className = 'shopping-list-doc-headline';

        if (planRow) {
          const ingredientLink = document.createElement('a');
          ingredientLink.href = 'shopping.html';
          ingredientLink.className = 'shopping-list-doc-link';
          ingredientLink.textContent =
            String(planRow?.label || '').trim() || String(row?.text || '').trim();
          ingredientLink.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            try {
              sessionStorage.removeItem(shoppingNavKeys.shoppingNavTargetId);
              sessionStorage.setItem(
                shoppingNavKeys.shoppingNavTargetName,
                String(planRow?.name || '').trim() || String(planRow?.label || '').trim(),
              );
            } catch (_) {}
            window.location.href = 'shopping.html';
          });
          headline.appendChild(ingredientLink);

          const detailText = String(planRow?.detailText || '').trim();
          if (detailText) {
            const amountBtn = document.createElement('button');
            amountBtn.type = 'button';
            amountBtn.className = 'shopping-list-doc-text shopping-list-doc-text--amount';
            amountBtn.textContent = `(${detailText})`;
            amountBtn.addEventListener('click', (event) => {
              event.preventDefault();
              event.stopPropagation();
              editingRowId = row.id;
              renderChecklist();
            });
            headline.appendChild(amountBtn);
          }
        } else {
          const textBtn = document.createElement('button');
          textBtn.type = 'button';
          textBtn.className = 'shopping-list-doc-text';
          textBtn.textContent = String(row?.text || '').trim();
          textBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            editingRowId = row.id;
            renderChecklist();
          });
          headline.appendChild(textBtn);
        }

        if (supportsExpansion) {
          const toggleBtn = document.createElement('button');
          toggleBtn.type = 'button';
          toggleBtn.className = 'shopping-list-doc-expand';
          toggleBtn.setAttribute('aria-label', isExpanded ? 'Collapse recipe details' : 'Expand recipe details');
          toggleBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
          toggleBtn.textContent = isExpanded ? '\u25B4' : '\u25BE';
          toggleBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (expandedShoppingListContributionRows.has(sourceKey)) {
              expandedShoppingListContributionRows.delete(sourceKey);
            } else {
              expandedShoppingListContributionRows.add(sourceKey);
            }
            renderChecklist();
          });
          headline.appendChild(toggleBtn);
        }

        textWrap.appendChild(headline);
      }

      li.appendChild(checkbox);
      li.appendChild(textWrap);
      list.appendChild(li);

      if (isExpanded) {
        const hasRecipeContributionRows = contributionRows.some(
          (entry) => String(entry?.sourceType || '') === 'recipe',
        );
        if (hasRecipeContributionRows) {
          const contextLi = document.createElement('li');
          contextLi.className = 'shopping-list-doc-contribution-context-item';
          const contextText = document.createElement('span');
          contextText.className = 'shopping-list-doc-contribution-context-pill';
          contextText.textContent = 'Recipes';
          contextLi.appendChild(contextText);
          list.appendChild(contextLi);
        }
        contributionRows.forEach((entry) => {
          const childLi = document.createElement('li');
          childLi.className = 'shopping-list-doc-contribution-item';
          const textWrapChild = document.createElement('div');
          textWrapChild.className = 'shopping-list-doc-contribution-text-wrap';

          if (String(entry?.sourceType || '') === 'recipe') {
            const recipeLink = document.createElement('a');
            recipeLink.href = 'recipeEditor.html';
            recipeLink.className = 'shopping-list-doc-contribution-link';
            recipeLink.textContent = String(entry?.title || '').trim() || 'Recipe';
            recipeLink.addEventListener('click', (event) => {
              event.preventDefault();
              event.stopPropagation();
              if (typeof window.openRecipe === 'function') {
                window.openRecipe(entry.recipeId);
                return;
              }
              sessionStorage.setItem('selectedRecipeId', String(entry.recipeId || ''));
              window.location.href = 'recipeEditor.html';
            });
            textWrapChild.appendChild(recipeLink);
          } else {
            const label = document.createElement('span');
            label.className = 'shopping-list-doc-contribution-label';
            label.textContent = String(entry?.title || '').trim() || 'Directly added';
            textWrapChild.appendChild(label);
          }

          const detail = document.createElement('span');
          detail.className = 'shopping-list-doc-contribution-detail';
          detail.textContent = `(${String(entry?.detailText || '').trim()})`;
          textWrapChild.appendChild(detail);

          childLi.appendChild(textWrapChild);
          list.appendChild(childLi);
        });
      }
    });

    listNav?.syncAfterRender?.();

    if (editingRowId) {
      requestAnimationFrame(() => {
        const input = list.querySelector('.shopping-list-doc-input');
        if (!(input instanceof HTMLInputElement)) return;
        try {
          input.focus();
          input.select();
        } catch (_) {}
      });
    }
    syncShoppingListResetButtonState();
    syncShoppingListCopyButtonState();
    shoppingListFilterChipRail?.sync?.();
  };

  const handleShoppingListReset = async () => {
    const previousDoc = cloneForUndo(shoppingListDoc, createEmptyShoppingListDoc);
    const nextDoc = getGeneratedShoppingListDoc();
    if (isShoppingListResetNoOp(nextDoc)) {
      syncShoppingListResetButtonState(nextDoc);
      return;
    }
    const confirmed = await uiConfirm({
      title: 'Reset shopping list?',
      message: 'Replace manual checklist edits with the latest generated shopping list.',
      confirmText: 'Reset',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;
    cancelAllPendingChecks();
    shoppingListDoc = persistShoppingListDoc(nextDoc);
    editingRowId = '';
    collapsedShoppingListSections.clear();
    renderChecklist();
    uiToastUndo('Shopping list reset.', () => {
      cancelAllPendingChecks();
      shoppingListDoc = persistShoppingListDoc(previousDoc);
      editingRowId = '';
      collapsedShoppingListSections.clear();
      renderChecklist();
    });
  };

  const handleShoppingListCopy = async () => {
    const plainText = formatShoppingListPlainText(shoppingListDoc?.rows);
    const htmlText = formatShoppingListHtml(shoppingListDoc?.rows);
    if (!plainText.trim()) {
      syncShoppingListCopyButtonState();
      uiToast('No unchecked shopping items to copy.');
      return;
    }
    const canWritePlainText = typeof navigator?.clipboard?.writeText === 'function';
    const canWriteRich =
      typeof navigator?.clipboard?.write === 'function' &&
      typeof ClipboardItem === 'function' &&
      typeof Blob === 'function';
    if (!canWritePlainText && !canWriteRich) {
      uiToast('Clipboard is unavailable on this device.');
      return;
    }
    try {
      if (canWriteRich) {
        const item = new ClipboardItem({
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
          'text/html': new Blob([htmlText], { type: 'text/html' }),
        });
        await navigator.clipboard.write([item]);
      } else if (canWritePlainText) {
        await navigator.clipboard.writeText(plainText);
      }
      uiToast('Shopping list copied.');
    } catch (err) {
      if (canWritePlainText) {
        try {
          await navigator.clipboard.writeText(plainText);
          uiToast('Shopping list copied.');
          return;
        } catch (fallbackErr) {
          console.error('❌ Failed to copy shopping list:', err);
          console.error('❌ Failed plain text clipboard fallback:', fallbackErr);
        }
      } else {
        console.error('❌ Failed to copy shopping list:', err);
      }
      uiToast('Could not copy shopping list.');
    }
  };

  const handleShoppingListExport = async () => {
    if (!shoppingListExportEnabled) return;
    const exportPayload = buildShoppingListExportPayload(shoppingListDoc?.rows);
    if (!exportPayload.stores.length) {
      syncShoppingListExportButtonState();
      uiToast('No unchecked shopping items to export.');
      return;
    }
    if (!window.electronAPI?.googleDocsExportShoppingList) {
      uiToast('Google Docs export is only available in the desktop app.');
      return;
    }
    const confirmed = await uiConfirm({
      title: 'Export shopping list?',
      message: 'Create a Google Doc checklist from your unchecked shopping items.',
      confirmText: 'Export',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;

    exportingShoppingList = true;
    syncShoppingListExportButtonState();
    try {
      const result = await window.electronAPI.googleDocsExportShoppingList(exportPayload);
      if (result?.ok) {
        uiToast('Shopping list exported to Google Docs.');
        return;
      }
      uiToast(String(result?.message || 'Could not export shopping list.'));
    } catch (err) {
      console.error('❌ Failed to export shopping list:', err);
      uiToast('Could not export shopping list.');
    } finally {
      exportingShoppingList = false;
      syncShoppingListExportButtonState();
    }
  };

  if (!shoppingListWebMode && controls) {
    controls.innerHTML = '';
    if (
      shoppingListExportEnabled &&
      isElectron &&
      window.electronAPI?.googleDocsExportShoppingList
    ) {
      exportBtn = document.createElement('button');
      exportBtn.type = 'button';
      exportBtn.className = 'button shopping-list-controls__action';
      exportBtn.textContent = 'Export';
      controls.appendChild(exportBtn);
      exportBtn.addEventListener('click', () => {
        void handleShoppingListExport();
      });
    }
    resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'button shopping-list-controls__action shopping-list-controls__reset';
    resetBtn.textContent = 'Reset List';
    controls.appendChild(resetBtn);
    resetBtn.addEventListener('click', () => {
      void handleShoppingListReset();
    });
  }

  if (shoppingListWebMode) {
    const addBtn = document.getElementById('appBarAddBtn');
    if (addBtn instanceof HTMLButtonElement) {
      const actions = addBtn.parentElement;
      if (actions instanceof HTMLElement) {
        if (
          shoppingListExportEnabled &&
          isElectron &&
          window.electronAPI?.googleDocsExportShoppingList
        ) {
          const existingWebExportBtn = document.getElementById('appBarExportBtn');
          if (existingWebExportBtn instanceof HTMLButtonElement) {
            webExportBtn = existingWebExportBtn;
          } else {
            webExportBtn = document.createElement('button');
            webExportBtn.type = 'button';
            webExportBtn.id = 'appBarExportBtn';
            webExportBtn.className = 'button';
            actions.insertBefore(webExportBtn, addBtn);
          }
          webExportBtn.textContent = 'Export';
          webExportBtn.addEventListener('click', () => {
            void handleShoppingListExport();
          });
        }
        const existingWebCopyBtn = document.getElementById('appBarCopyBtn');
        if (existingWebCopyBtn instanceof HTMLButtonElement) {
          webCopyBtn = existingWebCopyBtn;
        } else {
          webCopyBtn = document.createElement('button');
          webCopyBtn.type = 'button';
          webCopyBtn.id = 'appBarCopyBtn';
          webCopyBtn.className = 'button';
          actions.insertBefore(webCopyBtn, addBtn);
        }
        webCopyBtn.textContent = 'Copy';
        webCopyBtn.addEventListener('click', () => {
          void handleShoppingListCopy();
        });
      }
      webResetBtn = addBtn;
      webResetBtn.textContent = 'Reset';
      attachSecretGalleryShortcut(webResetBtn);
      webResetBtn.addEventListener('click', () => {
        void handleShoppingListReset();
      });
    }
  }

  mountShoppingListFilterChips();
  renderChecklist();
  syncShoppingListCopyButtonState();
  syncShoppingListExportButtonState();
  void resolvePendingSourceConflicts();
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
    const titleForSubtitleCompare = normalizeTitle(bodyTitleEl.textContent || '');
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
  const view = document.getElementById('pageContent');

  if (!view) return;

  const isNew = sessionStorage.getItem('selectedShoppingItemIsNew') === '1';
  const storedName = sessionStorage.getItem('selectedShoppingItemName') || '';

  let titleText = storedName.trim();
  if (!titleText && !isNew) {
    titleText = 'Shopping item';
  }

  // Page owns the title; app bar mirrors it (display-only).

  // App bar: render shell + mode toggles only.
  // Wiring (back/cancel/save + dirty confirm) is handled by wireChildEditorPage
  // after the fragment exists, so there is exactly one path.
  initAppBar({ mode: 'editor', titleText });

  // Body title + single calm card
  view.innerHTML = `
    <h1 id="childEditorTitle" class="recipe-title">${titleText || ''}</h1>
    <div class="shopping-item-editor-card" aria-label="Shopping item">
      <div class="shopping-item-field">
        <div class="shopping-item-label">Variants</div>
        <textarea
          id="shoppingItemVariantsTextarea"
          class="shopping-item-textarea"
          placeholder="e.g. kind or brand"
          wrap="off"
        ></textarea>
      </div>

      <div class="shopping-item-field">
        <div class="shopping-item-label">Also known as</div>
        <textarea
          id="shoppingItemSynonymsTextarea"
          class="shopping-item-textarea"
          placeholder="e.g. spring onion, scallion"
          wrap="off"
        ></textarea>
      </div>

      <div class="shopping-item-field">
        <div class="shopping-item-label">Sizes</div>
        <textarea
          id="shoppingItemSizesTextarea"
          class="shopping-item-textarea"
          placeholder="e.g. 12oz can"
          wrap="off"
        ></textarea>
      </div>

      <div class="shopping-item-field">
        <div class="shopping-item-label">Home location</div>
        <input
          id="shoppingItemHomeInput"
          class="shopping-item-input"
          type="text"
          placeholder="e.g. fridge, freezer, pantry"
        />
      </div>

      <div class="shopping-item-status">
        <div class="shopping-item-status-row">
          <label class="shopping-item-toggle">
            <input id="shoppingItemIsNotFoodToggle" type="checkbox" />
            <span>Not food</span>
          </label>
        </div>

        <div class="shopping-item-status-row">
          <label class="shopping-item-toggle">
            <input id="shoppingItemIsDeprecatedToggle" type="checkbox" />
            <span>Removed</span>
          </label>
        </div>

        <div id="shoppingItemIsHiddenRow" class="shopping-item-status-row">
          <label class="shopping-item-toggle">
            <input id="shoppingItemIsHiddenToggle" type="checkbox" />
            <span>Hidden</span>
          </label>
        </div>

        <div class="shopping-item-help">
          Removed items have been removed from Shopping and can be deleted once they
          aren't used by any recipe.
        </div>
      </div>
    </div>

    <div
      id="shoppingItemOverridesTitle"
      class="shopping-item-label"
      style="margin: 32px 0 6px 0; color: var(--font-color-near-black);"
    >
      Pluralization overrides (optional)
    </div>

    <div
      id="shoppingItemOverridesCard"
      class="shopping-item-editor-card"
      aria-label="Pluralization overrides"
    >
      <div
        id="shoppingItemLanguageDetails"
        class="shopping-item-status"
        style="align-items: stretch; width: 100%;"
      >
        <div
          id="shoppingItemPluralOverrideField"
          class="shopping-item-field"
          style="width: 100%;"
        >
          <div class="shopping-item-label">Plural form</div>
          <input
            id="shoppingItemPluralOverrideInput"
            class="shopping-item-input"
            type="text"
            placeholder="e.g. leaves, grapes, bagels"
          />
        </div>

        <div id="shoppingItemPluralByDefaultRow" class="shopping-item-status-row">
          <label class="shopping-item-toggle" style="display: flex; width: 100%;">
            <input id="shoppingItemPluralByDefaultToggle" type="checkbox" />
            <span>Plural by default</span>
          </label>
        </div>

        <div id="shoppingItemIsMassNounRow" class="shopping-item-status-row">
          <label class="shopping-item-toggle" style="display: flex; width: 100%;">
            <input id="shoppingItemIsMassNounToggle" type="checkbox" />
            <span>Is a mass or substance (e.g. rice, turmeric)</span>
          </label>
        </div>
      </div>
    </div>
  `;

  attachEditorTextareaAutoGrow(
    document.getElementById('shoppingItemVariantsTextarea'),
  );
  attachEditorTextareaAutoGrow(
    document.getElementById('shoppingItemSynonymsTextarea'),
  );
  attachEditorTextareaAutoGrow(
    document.getElementById('shoppingItemSizesTextarea'),
  );
  attachEditorNewlineListPaste(
    document.getElementById('shoppingItemVariantsTextarea'),
  );
  attachEditorNewlineListPaste(
    document.getElementById('shoppingItemSynonymsTextarea'),
  );
  attachEditorNewlineListPaste(
    document.getElementById('shoppingItemSizesTextarea'),
  );

  const loadDbForShoppingEditor = async () => {
    const isElectron = !!window.electronAPI;
    let db;

    if (isElectron) {
      try {
        const pathHint = localStorage.getItem('favoriteEatsDbPath') || null;
        const bytes = await window.electronAPI.loadDB(pathHint);
        const Uints = new Uint8Array(bytes);
        db = new SQL.Database(Uints);
      } catch (err) {
        console.error(
          '❌ Failed to load DB from disk for shopping editor:',
          err,
        );
        uiToast('No database loaded. Please go back to the welcome page.');
        throw err;
      }
    } else {
      const stored = localStorage.getItem('favoriteEatsDb');
      if (!stored)
        throw new Error('No DB in localStorage for shopping editor.');
      const Uints = new Uint8Array(JSON.parse(stored));
      db = new SQL.Database(Uints);
    }

    window.dbInstance = db;
    await ensureIngredientLemmaMaintenanceInMain(db, isElectron);
    return { db, isElectron };
  };

  const persistShoppingItem = async ({
    title: next,
    baselineTitle,
    extraValues,
  }) => {
    if (!next) return;

    const { db, isElectron } = await loadDbForShoppingEditor();

    try {
      const idStr = sessionStorage.getItem('selectedShoppingItemId');
      const id = Number(idStr);
      const variantsText = (extraValues && extraValues.variants) || '';
      const sizesText = (extraValues && extraValues.sizes) || '';
      const synonymsText = (extraValues && extraValues.synonyms) || '';
      const home = (extraValues && extraValues.home) || '';
      const isFoodRaw = (extraValues && extraValues.is_food) || '';
      const isDeprecatedRaw = (extraValues && extraValues.is_deprecated) || '';
      const isHiddenRaw = (extraValues && extraValues.is_hidden) || '';
      const pluralOverride = (extraValues && extraValues.plural_override) || '';
      const pluralByDefaultRaw =
        (extraValues && extraValues.plural_by_default) || '';
      const isMassNounRaw = (extraValues && extraValues.is_mass_noun) || '';

      const isFood = isFoodRaw === '1' ? 1 : 0;
      const isDeprecated = isDeprecatedRaw === '1' ? 1 : 0;
      const isHidden = isHiddenRaw === '1' ? 1 : 0;
      const pluralByDefault = pluralByDefaultRaw === '1' ? 1 : 0;
      const isMassNoun = isMassNounRaw === '1' ? 1 : 0;

      const parseList = (raw) => {
        const lines = String(raw || '')
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        const out = [];
        const seen = new Set();
        lines.forEach((s) => {
          const key = s.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          out.push(s);
        });
        return out;
      };

      const variants = parseList(variantsText);
      const sizes = parseList(sizesText);
      const synonyms = parseList(synonymsText);

      // Legacy single-value columns are only written when the list tables
      // are unavailable. When `ingredient_variants`/`ingredient_sizes` exist,
      // those tables are the source of truth.
      const variant0 = variants[0] || '';
      const size0 = sizes[0] || '';

      let cols = [];
      try {
        const info = db.exec('PRAGMA table_info(ingredients);');
        const rows = info.length ? info[0].values : [];
        cols = rows.map((r) => String(r[1] || '').toLowerCase());
      } catch (_) {
        cols = [];
      }
      const has = (c) => cols.includes(String(c).toLowerCase());

      const lemmaToWrite = has('lemma')
        ? deriveIngredientLemmaInMain(next)
        : '';

      const tableExists = (name) => {
        try {
          const q = db.exec(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
            [name],
          );
          return !!(q.length && q[0].values && q[0].values.length);
        } catch (_) {
          return false;
        }
      };
      const hasVariantTable = tableExists('ingredient_variants');
      const hasSizeTable = tableExists('ingredient_sizes');
      const hasSynonymsTable = tableExists('ingredient_synonyms');
      const hasStoreLocationTable = tableExists('ingredient_store_location');
      const hasVariantAisleTable = tableExists('ingredient_variant_store_location');
      const hasRecipeIngredientMapTable = tableExists('recipe_ingredient_map');
      const hasRecipeIngredientSubstitutesTable = tableExists(
        'recipe_ingredient_substitutes',
      );
      const useLegacySingleRowSave = (() => {
        try {
          return (
            String(
              localStorage.getItem('favoriteEatsShoppingLegacySingleRowSave') ||
                '',
            )
              .trim()
              .toLowerCase() === '1'
          );
        } catch (_) {
          return false;
        }
      })();

      let currentId = Number.isFinite(id) ? id : null;
      const baseName = String(baselineTitle || '').trim();
      const targetIds = [];
      const targetIdSeen = new Set();
      const pushTargetId = (rawId) => {
        const n = Number(rawId);
        if (!Number.isFinite(n)) return;
        if (targetIdSeen.has(n)) return;
        targetIdSeen.add(n);
        targetIds.push(n);
      };
      const getIngredientIdsByName = (nameText) => {
        const q = db.exec(
          'SELECT ID FROM ingredients WHERE lower(trim(name)) = lower(trim(?)) ORDER BY ID ASC;',
          [nameText],
        );
        return q.length
          ? q[0].values
              .map((r) => (Array.isArray(r) ? Number(r[0]) : NaN))
              .filter((v) => Number.isFinite(v))
          : [];
      };
      const deleteIngredientChildren = (ingredientId) => {
        if (!Number.isFinite(Number(ingredientId))) return;
        if (hasVariantAisleTable) {
          db.run(
            `DELETE FROM ingredient_variant_store_location
             WHERE ingredient_variant_id IN (
               SELECT id FROM ingredient_variants WHERE ingredient_id = ?
             );`,
            [ingredientId],
          );
        }
        if (hasVariantTable) {
          db.run('DELETE FROM ingredient_variants WHERE ingredient_id = ?;', [
            ingredientId,
          ]);
        }
        if (hasSizeTable) {
          db.run('DELETE FROM ingredient_sizes WHERE ingredient_id = ?;', [
            ingredientId,
          ]);
        }
        if (hasSynonymsTable) {
          db.run('DELETE FROM ingredient_synonyms WHERE ingredient_id = ?;', [
            ingredientId,
          ]);
        }
        if (hasStoreLocationTable) {
          db.run('DELETE FROM ingredient_store_location WHERE ingredient_id = ?;', [
            ingredientId,
          ]);
        }
      };
      const mergeIngredientInto = (sourceId, targetId) => {
        const fromId = Number(sourceId);
        const toId = Number(targetId);
        if (!Number.isFinite(fromId) || !Number.isFinite(toId) || fromId === toId) {
          return;
        }
        if (hasStoreLocationTable) {
          db.run(
            `DELETE FROM ingredient_store_location
             WHERE ingredient_id = ?
               AND EXISTS (
                 SELECT 1
                 FROM ingredient_store_location isl2
                 WHERE isl2.ingredient_id = ?
                   AND isl2.store_location_id = ingredient_store_location.store_location_id
               );`,
            [fromId, toId],
          );
          db.run(
            'UPDATE ingredient_store_location SET ingredient_id = ? WHERE ingredient_id = ?;',
            [toId, fromId],
          );
        }
        if (hasRecipeIngredientMapTable) {
          db.run(
            'UPDATE recipe_ingredient_map SET ingredient_id = ? WHERE ingredient_id = ?;',
            [toId, fromId],
          );
        }
        if (hasRecipeIngredientSubstitutesTable) {
          db.run(
            'UPDATE recipe_ingredient_substitutes SET ingredient_id = ? WHERE ingredient_id = ?;',
            [toId, fromId],
          );
        }
        deleteIngredientChildren(fromId);
        db.run('DELETE FROM ingredients WHERE ID = ?;', [fromId]);
      };

      if (useLegacySingleRowSave) {
        if (Number.isFinite(id)) pushTargetId(id);
      } else {
        // Shopping list entries are grouped by ingredient name, so edits should apply
        // to every row that currently belongs to the selected name.
        if (baseName) {
          try {
            const idsQ = db.exec(
              'SELECT ID FROM ingredients WHERE lower(trim(name)) = lower(trim(?));',
              [baseName],
            );
            const ids = idsQ.length
              ? idsQ[0].values.map((r) => (Array.isArray(r) ? r[0] : null))
              : [];
            ids.forEach((iid) => pushTargetId(iid));
          } catch (_) {}
        }
        if (Number.isFinite(id)) pushTargetId(id);
      }

      let txStarted = false;
      try {
        try {
          db.run('BEGIN IMMEDIATE;');
          txStarted = true;
        } catch (_) {
          db.run('BEGIN;');
          txStarted = true;
        }
      } catch (_) {
        txStarted = false;
      }

      try {
        // Collapse edits onto one canonical ingredient row. This lets
        // rename-to-existing-name behave like a merge instead of tripping
        // the DB's unique-name constraint.
        const existingNextIds = getIngredientIdsByName(next).filter(
          (iid) => !targetIdSeen.has(iid),
        );
        let primaryIngredientId =
          existingNextIds.length > 0
            ? existingNextIds[0]
            : targetIds.length > 0
              ? targetIds[0]
              : null;
        const mergedSourceIds =
          targetIds.length > 1
            ? targetIds.filter((iid) => iid !== primaryIngredientId)
            : [];

        mergedSourceIds.forEach((iid) => {
          mergeIngredientInto(iid, primaryIngredientId);
        });

        if (primaryIngredientId != null) {
          const sets = ['name = ?'];
          const valsNoId = [next];

          if (!hasVariantTable && has('variant')) {
            sets.push('variant = ?');
            valsNoId.push(variant0);
          }
          if (!hasSizeTable && has('size')) {
            sets.push('size = ?');
            valsNoId.push(size0);
          }
          if (has('location_at_home')) {
            sets.push('location_at_home = ?');
            valsNoId.push(home);
          }
          if (has('lemma')) {
            sets.push('lemma = ?');
            valsNoId.push(lemmaToWrite);
          }
          if (has('plural_override')) {
            sets.push('plural_override = ?');
            valsNoId.push(pluralOverride);
          }
          if (has('plural_by_default')) {
            sets.push('plural_by_default = ?');
            valsNoId.push(pluralByDefault);
          }
          if (has('is_mass_noun')) {
            sets.push('is_mass_noun = ?');
            valsNoId.push(isMassNoun);
          }
          if (has('is_food')) {
            sets.push('is_food = ?');
            valsNoId.push(isFood);
          }
          if (has('is_deprecated')) {
            sets.push('is_deprecated = ?');
            valsNoId.push(isDeprecated);
          } else if (has('hide_from_shopping_list')) {
            sets.push('hide_from_shopping_list = ?');
            valsNoId.push(isDeprecated);
          }
          if (has('is_hidden')) {
            sets.push('is_hidden = ?');
            valsNoId.push(isHidden);
          }

          db.run(`UPDATE ingredients SET ${sets.join(', ')} WHERE ID = ?;`, [
            ...valsNoId,
            primaryIngredientId,
          ]);

          currentId = Number(primaryIngredientId);
        } else {
          const insertCols = ['name'];
          const insertVals = [next];
          if (!hasVariantTable && has('variant')) {
            insertCols.push('variant');
            insertVals.push(variant0);
          }
          if (!hasSizeTable && has('size')) {
            insertCols.push('size');
            insertVals.push(size0);
          }
          if (has('location_at_home')) {
            insertCols.push('location_at_home');
            insertVals.push(home);
          }
          if (has('lemma')) {
            insertCols.push('lemma');
            insertVals.push(lemmaToWrite);
          }
          if (has('plural_override')) {
            insertCols.push('plural_override');
            insertVals.push(pluralOverride);
          }
          if (has('plural_by_default')) {
            insertCols.push('plural_by_default');
            insertVals.push(pluralByDefault);
          }
          if (has('is_mass_noun')) {
            insertCols.push('is_mass_noun');
            insertVals.push(isMassNoun);
          }
          if (has('is_food')) {
            insertCols.push('is_food');
            insertVals.push(isFood);
          }
          if (has('is_deprecated')) {
            insertCols.push('is_deprecated');
            insertVals.push(isDeprecated);
          } else if (has('hide_from_shopping_list')) {
            insertCols.push('hide_from_shopping_list');
            insertVals.push(isDeprecated);
          }
          if (has('is_hidden')) {
            insertCols.push('is_hidden');
            insertVals.push(isHidden);
          }

          const placeholders = insertCols.map(() => '?').join(', ');
          db.run(
            `INSERT INTO ingredients (${insertCols.join(
              ', ',
            )}) VALUES (${placeholders});`,
            insertVals,
          );
          const idQ = db.exec('SELECT last_insert_rowid();');
          if (idQ.length && idQ[0].values.length) {
            const newId = idQ[0].values[0][0];
            sessionStorage.setItem('selectedShoppingItemId', String(newId));
            currentId = Number(newId);
          }
        }

        // Persist variants/sizes lists to their own tables (newline-only, order preserved).
        const variantSizeTargetIds =
          currentId != null && Number.isFinite(Number(currentId))
              ? [Number(currentId)]
              : [];
        if (variantSizeTargetIds.length > 0) {
          if (hasVariantTable) {
            variantSizeTargetIds.forEach((iid) => {
              // If this ingredient currently has variant-only aisle links and the user
              // clears the variant list, migrate those aisle assignments to the base
              // ingredient row so the item does not silently disappear from aisles.
              let priorVariantAisleIds = [];
              if (hasVariantAisleTable && hasStoreLocationTable) {
                try {
                  const priorAislesQ = db.exec(
                    `SELECT DISTINCT ivsl.store_location_id
                     FROM ingredient_variant_store_location ivsl
                     JOIN ingredient_variants iv ON iv.id = ivsl.ingredient_variant_id
                     WHERE iv.ingredient_id = ?;`,
                    [iid],
                  );
                  priorVariantAisleIds =
                    priorAislesQ.length && priorAislesQ[0].values.length
                      ? priorAislesQ[0].values
                          .map((r) => Number(Array.isArray(r) ? r[0] : NaN))
                          .filter((n) => Number.isFinite(n))
                      : [];
                } catch (_) {
                  priorVariantAisleIds = [];
                }
              }

              db.run('DELETE FROM ingredient_variants WHERE ingredient_id = ?;', [
                iid,
              ]);
              variants.forEach((v, idx) => {
                db.run(
                  'INSERT INTO ingredient_variants (ingredient_id, variant, sort_order) VALUES (?, ?, ?);',
                  [iid, v, idx + 1],
                );
              });

              if (
                variants.length === 0 &&
                hasStoreLocationTable &&
                Array.isArray(priorVariantAisleIds) &&
                priorVariantAisleIds.length > 0
              ) {
                priorVariantAisleIds.forEach((aisleId) => {
                  db.run(
                    `INSERT OR IGNORE INTO ingredient_store_location (ingredient_id, store_location_id)
                     VALUES (?, ?);`,
                    [iid, aisleId],
                  );
                });
              }
            });
          }

          if (hasSizeTable) {
            variantSizeTargetIds.forEach((iid) => {
              db.run('DELETE FROM ingredient_sizes WHERE ingredient_id = ?;', [
                iid,
              ]);
              sizes.forEach((s, idx) => {
                db.run(
                  'INSERT INTO ingredient_sizes (ingredient_id, size, sort_order) VALUES (?, ?, ?);',
                  [iid, s, idx + 1],
                );
              });
            });
          }

          if (hasSynonymsTable) {
            const primarySynonymId = variantSizeTargetIds[0];
            if (primarySynonymId != null) {
              db.run(
                'DELETE FROM ingredient_synonyms WHERE ingredient_id = ?;',
                [primarySynonymId],
              );
              synonyms.forEach((s) => {
                try {
                  db.run(
                    'INSERT INTO ingredient_synonyms (ingredient_id, synonym) VALUES (?, ?);',
                    [primarySynonymId, s],
                  );
                } catch (_) {
                  // Swallow unique-constraint conflicts (synonym already claimed by another ingredient).
                }
              });
            }
          }
        }

        if (currentId != null && Number.isFinite(Number(currentId))) {
          sessionStorage.setItem('selectedShoppingItemId', String(currentId));
        }

        // Verify writes before COMMIT so any mismatch can rollback atomically.
        const verifyIds =
          currentId != null && Number.isFinite(Number(currentId))
              ? [Number(currentId)]
              : [];
        const normalizedNext = String(next || '')
          .trim()
          .toLowerCase();
        const listEqual = (a, b) => {
          if (!Array.isArray(a) || !Array.isArray(b)) return false;
          if (a.length !== b.length) return false;
          for (let i = 0; i < a.length; i += 1) {
            if (String(a[i] || '') !== String(b[i] || '')) return false;
          }
          return true;
        };

        verifyIds.forEach((iid) => {
          const rowQ = db.exec(
            `SELECT COALESCE(name, ''),
                    ${has('variant') ? "COALESCE(variant, '')" : "''"},
                    ${has('size') ? "COALESCE(size, '')" : "''"}
             FROM ingredients
             WHERE ID = ?;`,
            [iid],
          );
          if (!(rowQ.length && rowQ[0].values.length)) {
            throw new Error(`shopping-save-verify-missing-row:${iid}`);
          }
          const row = rowQ[0].values[0] || [];
          const dbNameNorm = String(row[0] || '')
            .trim()
            .toLowerCase();
          if (dbNameNorm !== normalizedNext) {
            throw new Error(`shopping-save-verify-name:${iid}`);
          }
          if (!hasVariantTable && has('variant')) {
            if (String(row[1] || '') !== String(variant0 || '')) {
              throw new Error(`shopping-save-verify-variant:${iid}`);
            }
          }
          if (!hasSizeTable && has('size')) {
            if (String(row[2] || '') !== String(size0 || '')) {
              throw new Error(`shopping-save-verify-size:${iid}`);
            }
          }
          if (hasVariantTable) {
            const vq = db.exec(
              `SELECT COALESCE(variant, '')
               FROM ingredient_variants
               WHERE ingredient_id = ?
               ORDER BY sort_order ASC, id ASC;`,
              [iid],
            );
            const dbVariants = vq.length
              ? vq[0].values.map((r) => String((r && r[0]) || ''))
              : [];
            if (!listEqual(dbVariants, variants)) {
              throw new Error(`shopping-save-verify-variants-list:${iid}`);
            }
          }
          if (hasSizeTable) {
            const sq = db.exec(
              `SELECT COALESCE(size, '')
               FROM ingredient_sizes
               WHERE ingredient_id = ?
               ORDER BY sort_order ASC, id ASC;`,
              [iid],
            );
            const dbSizes = sq.length
              ? sq[0].values.map((r) => String((r && r[0]) || ''))
              : [];
            if (!listEqual(dbSizes, sizes)) {
              throw new Error(`shopping-save-verify-sizes-list:${iid}`);
            }
          }

          if (hasSynonymsTable) {
            const primarySynonymId = variantSizeTargetIds[0];
            if (iid === primarySynonymId) {
              const synQ = db.exec(
                `SELECT COALESCE(synonym, '')
                 FROM ingredient_synonyms
                 WHERE ingredient_id = ?
                 ORDER BY id ASC;`,
                [iid],
              );
              const dbSynonyms = synQ.length
                ? synQ[0].values.map((r) => String((r && r[0]) || ''))
                : [];
              if (!listEqual(dbSynonyms, synonyms)) {
                throw new Error(`shopping-save-verify-synonyms-list:${iid}`);
              }
            }
          }
        });

        if (txStarted) {
          db.run('COMMIT;');
          txStarted = false;
        }
      } catch (writeErr) {
        if (txStarted) {
          try {
            db.run('ROLLBACK;');
          } catch (_) {}
          txStarted = false;
        }
        throw writeErr;
      }
    } catch (err) {
      console.error('❌ Failed to upsert shopping item ingredient:', err);
      uiToast('Failed to save shopping item. See console for details.');
      throw err;
    }

    try {
      const binaryArray = db.export();
      if (isElectron) {
        const ok = await window.electronAPI.saveDB(binaryArray);
        if (ok === false) throw new Error('electronAPI.saveDB returned false');
      } else {
        localStorage.setItem(
          'favoriteEatsDb',
          JSON.stringify(Array.from(binaryArray)),
        );
      }
    } catch (err) {
      console.error('❌ Failed to persist DB after shopping edit:', err);
      uiToast('Failed to save database. See console for details.');
      throw err;
    }

    sessionStorage.setItem('selectedShoppingItemName', next);
    sessionStorage.removeItem('selectedShoppingItemIsNew');
  };

  // Wire shared editor behavior once the injected shell exists.
  if (typeof waitForAppBarReady === 'function') {
    waitForAppBarReady().then(async () => {
      let baselineVariants = '';
      let baselineSizes = '';
      let baselineSynonyms = '';
      let baselineHome = '';
      let baselineIsFood = '1';
      let baselineIsDeprecated = '0';
      let baselineIsHidden = '0';
      let baselinePluralOverride = '';
      let baselinePluralByDefault = '0';
      let baselineIsMassNoun = '0';

      try {
        // Load DB once up-front so shared utilities (e.g., typeahead pools) can use window.dbInstance.
        // (loadDbForShoppingEditor also sets window.dbInstance)
        await loadDbForShoppingEditor();

        const idStr = sessionStorage.getItem('selectedShoppingItemId');
        const id = Number(idStr);
        if (Number.isFinite(id)) {
          const db = window.dbInstance;
          if (!db) throw new Error('DB not available for shopping editor init');

          let cols = [];
          try {
            const info = db.exec('PRAGMA table_info(ingredients);');
            const rows = info.length ? info[0].values : [];
            cols = rows.map((r) => String(r[1] || '').toLowerCase());
          } catch (_) {
            cols = [];
          }
          const has = (c) => cols.includes(String(c).toLowerCase());

          const setVisible = (elOrId, ok) => {
            const el =
              typeof elOrId === 'string'
                ? document.getElementById(elOrId)
                : elOrId;
            if (!el) return;
            el.style.display = ok ? '' : 'none';
          };

          // Show grammar controls only when schema supports them (older DBs hide them).
          const showPluralOverride = has('plural_override');
          const showPluralByDefault = has('plural_by_default');
          const showIsMassNoun = has('is_mass_noun');
          const showAnyOverrides =
            showPluralOverride || showPluralByDefault || showIsMassNoun;
          setVisible('shoppingItemOverridesCard', showAnyOverrides);
          setVisible('shoppingItemOverridesTitle', showAnyOverrides);
          setVisible('shoppingItemLanguageDetails', showAnyOverrides);
          setVisible('shoppingItemPluralOverrideField', showPluralOverride);
          setVisible('shoppingItemPluralByDefaultRow', showPluralByDefault);
          setVisible('shoppingItemIsMassNounRow', showIsMassNoun);
          setVisible('shoppingItemIsHiddenRow', has('is_hidden'));

          const selectCols = [
            "COALESCE(variant, '')",
            "COALESCE(size, '')",
            "COALESCE(location_at_home, '')",
            has('plural_override') ? "COALESCE(plural_override, '')" : "''",
            has('plural_by_default') ? 'COALESCE(plural_by_default, 0)' : '0',
            has('is_mass_noun') ? 'COALESCE(is_mass_noun, 0)' : '0',
            has('is_food') ? 'COALESCE(is_food, 1)' : '1',
            has('is_deprecated')
              ? 'COALESCE(is_deprecated, 0)'
              : has('hide_from_shopping_list')
                ? 'COALESCE(hide_from_shopping_list, 0)'
                : '0',
            has('is_hidden') ? 'COALESCE(is_hidden, 0)' : '0',
          ];

          const q = db.exec(
            `SELECT ${selectCols.join(', ')} FROM ingredients WHERE ID = ?;`,
            [id],
          );
          if (q.length && q[0].values.length) {
            const row = q[0].values[0];
            // Legacy single-value columns
            baselineVariants = String(row[0] || '');
            baselineSizes = String(row[1] || '');
            baselineHome = String(row[2] || '');
            baselinePluralOverride = String(row[3] || '');
            baselinePluralByDefault = String(row[4] != null ? row[4] : '0');
            baselineIsMassNoun = String(row[5] != null ? row[5] : '0');
            baselineIsFood = String(row[6] != null ? row[6] : '1');
            baselineIsDeprecated = String(row[7] != null ? row[7] : '0');
            baselineIsHidden = String(row[8] != null ? row[8] : '0');
          }

          const targetIngredientIds = [];
          const seenTargetIds = new Set();
          const pushTargetId = (rawId) => {
            const n = Number(rawId);
            if (!Number.isFinite(n)) return;
            if (seenTargetIds.has(n)) return;
            seenTargetIds.add(n);
            targetIngredientIds.push(n);
          };
          const targetName = String(storedName || '').trim();
          if (targetName) {
            try {
              const idsQ = db.exec(
                'SELECT ID FROM ingredients WHERE lower(name) = lower(?) ORDER BY ID ASC;',
                [targetName],
              );
              const ids = idsQ.length
                ? idsQ[0].values.map((r) => (Array.isArray(r) ? r[0] : null))
                : [];
              ids.forEach((iid) => pushTargetId(iid));
            } catch (_) {}
          }
          if (targetIngredientIds.length === 0) pushTargetId(id);

          const dedupeStable = (arr) => {
            const out = [];
            const seen = new Set();
            (arr || []).forEach((raw) => {
              const v = String(raw || '').trim();
              if (!v) return;
              const key = v.toLowerCase();
              if (seen.has(key)) return;
              seen.add(key);
              out.push(v);
            });
            return out;
          };

          // Aggregate legacy single-value columns across all grouped rows so editor
          // matches shopping list behavior even when selected ID is not the one
          // currently carrying the first variant/size values.
          if (has('variant')) {
            try {
              const legacyVariants = [];
              targetIngredientIds.forEach((iid) => {
                const qv = db.exec(
                  "SELECT COALESCE(variant, '') FROM ingredients WHERE ID = ?;",
                  [iid],
                );
                if (qv.length && qv[0].values.length) {
                  legacyVariants.push(String(qv[0].values[0][0] || ''));
                }
              });
              const cleaned = dedupeStable(legacyVariants);
              if (cleaned.length > 0) baselineVariants = cleaned.join('\n');
            } catch (_) {}
          }
          if (has('size')) {
            try {
              const legacySizes = [];
              targetIngredientIds.forEach((iid) => {
                const qs = db.exec(
                  "SELECT COALESCE(size, '') FROM ingredients WHERE ID = ?;",
                  [iid],
                );
                if (qs.length && qs[0].values.length) {
                  legacySizes.push(String(qs[0].values[0][0] || ''));
                }
              });
              const cleaned = dedupeStable(legacySizes);
              if (cleaned.length > 0) baselineSizes = cleaned.join('\n');
            } catch (_) {}
          }

          // Note: overrides are always visible (no disclosure); nothing to auto-open.

          // If list tables exist, prefer them as the baseline source-of-truth,
          // aggregated across all grouped IDs for this shopping-item name.
          try {
            const rows = [];
            targetIngredientIds.forEach((iid) => {
              const vq = db.exec(
                `SELECT variant
                 FROM ingredient_variants
                 WHERE ingredient_id = ?
                 ORDER BY sort_order ASC, id ASC;`,
                [iid],
              );
              if (vq.length && vq[0].values.length) {
                vq[0].values.forEach((r) => rows.push(String((r && r[0]) || '')));
              }
            });
            const cleaned = dedupeStable(rows);
            if (cleaned.length > 0) {
              baselineVariants = cleaned.join('\n');
            }
          } catch (_) {}

          try {
            const rows = [];
            targetIngredientIds.forEach((iid) => {
              const sq = db.exec(
                `SELECT size
                 FROM ingredient_sizes
                 WHERE ingredient_id = ?
                 ORDER BY sort_order ASC, id ASC;`,
                [iid],
              );
              if (sq.length && sq[0].values.length) {
                sq[0].values.forEach((r) => rows.push(String((r && r[0]) || '')));
              }
            });
            const cleaned = dedupeStable(rows);
            if (cleaned.length > 0) {
              baselineSizes = cleaned.join('\n');
            }
          } catch (_) {}

          try {
            const rows = [];
            targetIngredientIds.forEach((iid) => {
              const synQ = db.exec(
                `SELECT synonym
                 FROM ingredient_synonyms
                 WHERE ingredient_id = ?
                 ORDER BY id ASC;`,
                [iid],
              );
              if (synQ.length && synQ[0].values.length) {
                synQ[0].values.forEach((r) => rows.push(String((r && r[0]) || '')));
              }
            });
            const cleaned = dedupeStable(rows);
            if (cleaned.length > 0) {
              baselineSynonyms = cleaned.join('\n');
            }
          } catch (_) {}
        }
      } catch (_) {}

      // Home typeahead (suggest existing "location_at_home" values).
      try {
        const homeInput = document.getElementById('shoppingItemHomeInput');
        const ta = window.favoriteEatsTypeahead;
        const canonicalHomes = [
          'fridge',
          'freezer',
          'above fridge',
          'pantry',
          'cereal cabinet',
          'spices',
          'fruit stand',
          'coffee bar',
        ];
        if (homeInput && ta && typeof ta.attach === 'function') {
          ta.attach({
            inputEl: homeInput,
            openOnFocus: true,
            maxVisible: 10,
            getPool: async () => {
              const db = window.dbInstance;
              if (!db) return canonicalHomes;
              const q = db.exec(
                `SELECT DISTINCT location_at_home
                 FROM ingredients
                 WHERE location_at_home IS NOT NULL
                   AND trim(location_at_home) != ''
                 ORDER BY location_at_home COLLATE NOCASE;`,
              );
              const vals =
                Array.isArray(q) &&
                q.length > 0 &&
                q[0] &&
                Array.isArray(q[0].values)
                  ? q[0].values
                      .map((row) => (Array.isArray(row) ? row[0] : null))
                      .map((v) => String(v || '').trim())
                      .filter((v) => v.length > 0)
                  : [];
              const out = [];
              const seen = new Set();
              [...canonicalHomes, ...vals].forEach((v) => {
                const normalized = String(v || '').trim();
                if (!normalized) return;
                const key = normalized.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                out.push(normalized);
              });
              return out;
            },
            // Simple per-field rules:
            // - empty query: full alphabetical list
            // - non-empty query: alphabetical subset containing the query (no prefix-boosting)
            getItems: (pool, query) => {
              const q = String(query || '')
                .trim()
                .toLowerCase();
              const items = (pool || [])
                .map((v) => String(v || '').trim())
                .filter((v) => v.length > 0);
              items.sort((a, b) =>
                a.localeCompare(b, undefined, { sensitivity: 'base' }),
              );
              if (!q) return items;
              return items.filter((v) => v.toLowerCase().includes(q));
            },
          });
        }
      } catch (_) {}

      wireChildEditorPage({
        backBtn: document.getElementById('appBarBackBtn'),
        cancelBtn: document.getElementById('appBarCancelBtn'),
        saveBtn: document.getElementById('appBarSaveBtn'),
        appBarTitleEl: document.getElementById('appBarTitle'),
        bodyTitleEl: document.getElementById('childEditorTitle'),
        initialTitle: titleText,
        backHref: 'shopping.html',
        extraFields: [
          {
            key: 'variants',
            el: document.getElementById('shoppingItemVariantsTextarea'),
            initialValue: baselineVariants,
          },
          {
            key: 'synonyms',
            el: document.getElementById('shoppingItemSynonymsTextarea'),
            initialValue: baselineSynonyms,
          },
          {
            key: 'sizes',
            el: document.getElementById('shoppingItemSizesTextarea'),
            initialValue: baselineSizes,
          },
          {
            key: 'home',
            el: document.getElementById('shoppingItemHomeInput'),
            initialValue: baselineHome,
          },
          {
            key: 'plural_override',
            el: document.getElementById('shoppingItemPluralOverrideInput'),
            initialValue: baselinePluralOverride,
          },
          {
            key: 'plural_by_default',
            el: document.getElementById('shoppingItemPluralByDefaultToggle'),
            initialValue: baselinePluralByDefault === '1' ? '1' : '0',
            getValue: () =>
              document.getElementById('shoppingItemPluralByDefaultToggle')
                ?.checked
                ? '1'
                : '0',
            setValue: (v) => {
              const el = document.getElementById(
                'shoppingItemPluralByDefaultToggle',
              );
              if (el) el.checked = String(v) === '1';
            },
          },
          {
            key: 'is_mass_noun',
            el: document.getElementById('shoppingItemIsMassNounToggle'),
            initialValue: baselineIsMassNoun === '1' ? '1' : '0',
            getValue: () =>
              document.getElementById('shoppingItemIsMassNounToggle')?.checked
                ? '1'
                : '0',
            setValue: (v) => {
              const el = document.getElementById(
                'shoppingItemIsMassNounToggle',
              );
              if (el) el.checked = String(v) === '1';
            },
          },
          {
            key: 'is_food',
            el: document.getElementById('shoppingItemIsNotFoodToggle'),
            initialValue: baselineIsFood === '1' ? '1' : '0',
            getValue: () =>
              document.getElementById('shoppingItemIsNotFoodToggle')?.checked
                ? '0'
                : '1',
            setValue: (v) => {
              const el = document.getElementById('shoppingItemIsNotFoodToggle');
              if (el) el.checked = String(v) !== '1';
            },
          },
          {
            key: 'is_deprecated',
            el: document.getElementById('shoppingItemIsDeprecatedToggle'),
            initialValue: baselineIsDeprecated === '1' ? '1' : '0',
            getValue: () =>
              document.getElementById('shoppingItemIsDeprecatedToggle')?.checked
                ? '1'
                : '0',
            setValue: (v) => {
              const el = document.getElementById(
                'shoppingItemIsDeprecatedToggle',
              );
              if (el) el.checked = String(v) === '1';
            },
          },
          {
            key: 'is_hidden',
            el: document.getElementById('shoppingItemIsHiddenToggle'),
            initialValue: baselineIsHidden === '1' ? '1' : '0',
            getValue: () =>
              document.getElementById('shoppingItemIsHiddenToggle')?.checked
                ? '1'
                : '0',
            setValue: (v) => {
              const el = document.getElementById('shoppingItemIsHiddenToggle');
              if (el) el.checked = String(v) === '1';
            },
          },
        ],
        onSave: persistShoppingItem,
      });
    });
  }
}

function loadUnitEditorPage() {
  const view = document.getElementById('pageContent');

  if (!view) return;

  const isNew = sessionStorage.getItem('selectedUnitIsNew') === '1';
  const storedName = sessionStorage.getItem('selectedUnitNameSingular') || '';
  const storedPlural = sessionStorage.getItem('selectedUnitNamePlural') || '';
  const code = sessionStorage.getItem('selectedUnitCode') || '';
  const initialHidden = sessionStorage.getItem('selectedUnitIsHidden') === '1';
  const initialRemoved = sessionStorage.getItem('selectedUnitIsRemoved') === '1';
  const titleDisplay = storedName || (isNew ? 'New unit' : 'Unit');
  const initialTitle = storedName
    ? (storedName || '').trim().toLowerCase()
    : isNew
      ? 'new unit'
      : 'unit';

  initAppBar({ mode: 'editor', titleText: titleDisplay });

  const abbreviationDisplay = code || 'Abbreviation';
  view.innerHTML = `
    <h1 id="childEditorTitle" class="recipe-title">${titleDisplay || ''}</h1>
    <div id="unitAbbreviation" class="unit-abbreviation-line">${abbreviationDisplay}</div>
    <div
      id="unitDetailsCard"
      class="shopping-item-editor-card"
      aria-label="Unit details"
      style="margin-top: 20px;"
    >
      <div class="shopping-item-field" style="width: 100%;">
        <div class="shopping-item-label">Plural form</div>
        <input
          id="unitPluralInput"
          class="shopping-item-input"
          type="text"
          placeholder="e.g. bunches, cloves, pinches"
        />
      </div>
      <div class="shopping-item-status">
        <div class="shopping-item-status-row">
          <label class="shopping-item-toggle">
            <input id="unitIsHiddenToggle" type="checkbox" ${initialHidden ? 'checked' : ''} />
            <span>Hidden</span>
          </label>
        </div>
        <div class="shopping-item-status-row">
          <label class="shopping-item-toggle">
            <input id="unitIsRemovedToggle" type="checkbox" ${initialRemoved ? 'checked' : ''} />
            <span>Removed</span>
          </label>
        </div>
      </div>
    </div>
  `;
  const unitPluralInput = document.getElementById('unitPluralInput');
  if (unitPluralInput) unitPluralInput.value = storedPlural;

  if (typeof waitForAppBarReady === 'function') {
    waitForAppBarReady().then(() => {
      wireChildEditorPage({
        backBtn: document.getElementById('appBarBackBtn'),
        cancelBtn: document.getElementById('appBarCancelBtn'),
        saveBtn: document.getElementById('appBarSaveBtn'),
        appBarTitleEl: document.getElementById('appBarTitle'),
        bodyTitleEl: document.getElementById('childEditorTitle'),
        initialTitle,
        backHref: 'units.html',
        normalizeTitle: (s) => (s || '').trim().toLowerCase(),
        subtitleEl: document.getElementById('unitAbbreviation'),
        initialSubtitle: code,
        normalizeSubtitle: (s) => (s || '').trim().toLowerCase(),
        hideSubtitleWhenMatchesTitle: true,
        extraFields: [
          {
            key: 'name_plural',
            el: document.getElementById('unitPluralInput'),
            initialValue: storedPlural,
          },
          {
            key: 'is_hidden',
            el: document.getElementById('unitIsHiddenToggle'),
            initialValue: initialHidden ? '1' : '0',
            getValue: () =>
              document.getElementById('unitIsHiddenToggle')?.checked
                ? '1'
                : '0',
            setValue: (v) => {
              const el = document.getElementById('unitIsHiddenToggle');
              if (el) el.checked = String(v) === '1';
            },
          },
          {
            key: 'is_removed',
            el: document.getElementById('unitIsRemovedToggle'),
            initialValue: initialRemoved ? '1' : '0',
            getValue: () =>
              document.getElementById('unitIsRemovedToggle')?.checked
                ? '1'
                : '0',
            setValue: (v) => {
              const el = document.getElementById('unitIsRemovedToggle');
              if (el) el.checked = String(v) === '1';
            },
          },
        ],
        onSave: async ({ title: next, subtitle: nextCode }) => {
          const oldCode = (sessionStorage.getItem('selectedUnitCode') || '')
            .trim()
            .toLowerCase();
          if (!oldCode && !isNew) return;

          const isElectron = !!window.electronAPI;
          let db;

          if (isElectron) {
            const pathHint = localStorage.getItem('favoriteEatsDbPath') || null;
            const bytes = await window.electronAPI.loadDB(pathHint);
            const Uints = new Uint8Array(bytes);
            db = new SQL.Database(Uints);
          } else {
            const stored = localStorage.getItem('favoriteEatsDb');
            if (!stored)
              throw new Error('No DB in localStorage for unit editor.');
            const Uints = new Uint8Array(JSON.parse(stored));
            db = new SQL.Database(Uints);
          }

          window.dbInstance = db;
          await ensureIngredientLemmaMaintenanceInMain(db, isElectron);
          ensureUnitsSchemaInMain(db);

          const newCode = (nextCode ?? '').trim().toLowerCase();
          const pluralForm = (document.getElementById('unitPluralInput')?.value || '').trim();
          const isHidden = document.getElementById('unitIsHiddenToggle')?.checked ? 1 : 0;
          const isRemoved = document.getElementById('unitIsRemovedToggle')?.checked ? 1 : 0;

          if (oldCode && newCode !== oldCode) {
            const safe = (x) => String(x || '').replace(/'/g, "''");
            const exists = db.exec(
              `SELECT 1 FROM units WHERE lower(trim(code)) = '${safe(newCode)}' AND lower(trim(code)) != lower(trim('${safe(oldCode)}')) LIMIT 1;`,
            );
            if (exists.length > 0 && exists[0].values.length > 0) {
              uiToast('That abbreviation is already used by another unit.');
              throw new Error('Duplicate unit code');
            }
            try {
              db.run(
                'UPDATE recipe_ingredient_map SET unit = ? WHERE unit = ?;',
                [newCode, oldCode],
              );
            } catch (_) {}
            try {
              db.run(
                'UPDATE recipe_ingredient_substitutes SET unit = ? WHERE unit = ?;',
                [newCode, oldCode],
              );
            } catch (_) {}
            db.run(
              'UPDATE units SET code = ?, name_singular = ?, name_plural = ?, is_hidden = ?, is_removed = ? WHERE code = ?;',
              [newCode, next || '', pluralForm, isHidden, isRemoved, oldCode],
            );
            sessionStorage.setItem('selectedUnitCode', newCode);
          } else {
            db.run(
              'UPDATE units SET name_singular = ?, name_plural = ?, is_hidden = ?, is_removed = ? WHERE code = ?;',
              [next || '', pluralForm, isHidden, isRemoved, oldCode || newCode],
            );
            if (newCode && newCode !== oldCode)
              sessionStorage.setItem('selectedUnitCode', newCode);
          }

          const binaryArray = db.export();
          if (isElectron) {
            const ok = await window.electronAPI.saveDB(binaryArray);
            if (ok === false)
              throw new Error('Failed to save DB for unit editor.');
          } else {
            localStorage.setItem(
              'favoriteEatsDb',
              JSON.stringify(Array.from(binaryArray)),
            );
          }

          sessionStorage.setItem('selectedUnitNameSingular', next || '');
          sessionStorage.setItem('selectedUnitNamePlural', pluralForm);
          sessionStorage.setItem('selectedUnitIsHidden', String(isHidden));
          sessionStorage.setItem('selectedUnitIsRemoved', String(isRemoved));
          sessionStorage.removeItem('selectedUnitIsNew');
        },
      });
    });
  }
}

async function loadUnitsPage() {
  initAppBar({
    mode: 'list',
    titleText: 'Units',
    showAdd: true,
  });

  const list = document.getElementById('unitsList');

  // App bar is injected async; wait before wiring menu/search.
  if (typeof waitForAppBarReady === 'function') {
    await waitForAppBarReady();
  }
  initBottomNav();

  const searchInput = document.getElementById('appBarSearchInput');
  const clearBtn = document.getElementById('appBarSearchClear');
  wireAppBarSearch(searchInput, {
    clearBtn,
    onQueryChange: () => {
      applyUnitFilters();
    },
  });
  const addBtn = document.getElementById('appBarAddBtn');

  if (!list) return;

  // Keyboard selection + Enter activation for list rows.
  const listNav = enableTopLevelListKeyboardNav(list);

  attachSecretGalleryShortcut(addBtn);

  // --- Load DB (mirror recipe/shopping loaders) ---
  const isElectron = !!window.electronAPI;
  let db;

  if (isElectron) {
    try {
      const pathHint = localStorage.getItem('favoriteEatsDbPath') || null;
      const bytes = await window.electronAPI.loadDB(pathHint);
      const Uints = new Uint8Array(bytes);
      db = new SQL.Database(Uints);
    } catch (err) {
      console.error('❌ Failed to load DB from disk:', err);
      uiToast('No database loaded. Please go back to the welcome page.');
      window.location.href = 'index.html';
      return;
    }
  } else {
    const stored = localStorage.getItem('favoriteEatsDb');
    if (!stored) {
      uiToast('No database loaded. Please go back to the welcome page.');
      window.location.href = 'index.html';
      return;
    }
    const Uints = new Uint8Array(JSON.parse(stored));
    db = new SQL.Database(Uints);
  }

  // Expose DB globally for any future helpers
  window.dbInstance = db;
  await ensureIngredientLemmaMaintenanceInMain(db, isElectron);
  ensureUnitsSchemaInMain(db);

  const queryUnits = () => {
    const result = db.exec(`
      SELECT
        code,
        name_singular,
        name_plural,
        category,
        sort_order,
        COALESCE(is_hidden, 0) AS is_hidden,
        COALESCE(is_removed, 0) AS is_removed
      FROM units
      ORDER BY sort_order ASC, code COLLATE NOCASE;
    `);
    if (!result.length) return [];
    return result[0].values.map(
      ([code, nameSingular, namePlural, category, sortOrder, isHidden, isRemoved]) => ({
        code,
        nameSingular,
        namePlural,
        category,
        sortOrder,
        isHidden: Number(isHidden || 0) === 1,
        isRemoved: Number(isRemoved || 0) === 1,
      }),
    );
  };

  let unitRows = queryUnits();

  const persistDb = () => {
    try {
      const binaryArray = db.export();
      const isElectronEnv = !!window.electronAPI;
      if (isElectronEnv) {
        window.electronAPI.saveDB(binaryArray);
      } else {
        localStorage.setItem(
          'favoriteEatsDb',
          JSON.stringify(Array.from(binaryArray)),
        );
      }
    } catch (err) {
      console.error('❌ Failed to persist DB:', err);
    }
  };

  const unitFilterChipDefs = [
    { id: 'hidden', label: 'hidden' },
    { id: 'removed', label: 'removed' },
  ];
  const activeUnitFilterChips = new Set();
  let unitChipCounts = new Map();
  let unitFilterChipRail = null;

  const recomputeUnitChipCounts = () => {
    const counts = new Map();
    unitFilterChipDefs.forEach((chip) => counts.set(chip.id, 0));
    unitRows.forEach((row) => {
      const state = getUnitSizeRowState(row);
      if (state.isHidden) counts.set('hidden', (counts.get('hidden') || 0) + 1);
      if (state.isRemoved) counts.set('removed', (counts.get('removed') || 0) + 1);
    });
    unitChipCounts = counts;
  };

  const rerenderUnitFilterChips = () => {
    const chipMountEl = unitFilterChipRail?.trackEl;
    if (!chipMountEl) return;
    if (typeof window.renderFilterChipList !== 'function') {
      chipMountEl.innerHTML = '';
      return;
    }
    window.renderFilterChipList({
      mountEl: chipMountEl,
      chips: unitFilterChipDefs.map((chipDef) => {
        const count = Number(unitChipCounts.get(chipDef.id) || 0);
        return {
          id: chipDef.id,
          label: chipDef.label,
          disabled: count <= 0,
        };
      }),
      activeChipIds: activeUnitFilterChips,
      onToggle: (chipId) => {
        const key = String(chipId || '').toLowerCase();
        const count = Number(unitChipCounts.get(key) || 0);
        if (!key || count <= 0) return;
        if (activeUnitFilterChips.has(key)) activeUnitFilterChips.delete(key);
        else activeUnitFilterChips.add(key);
        rerenderUnitFilterChips();
        applyUnitFilters();
      },
      chipClassName: 'app-filter-chip',
    });
  };

  const mountUnitFilterChips = () => {
    if (!searchInput) return;
    if (typeof window.mountTopFilterChipRail !== 'function') return;
    unitFilterChipRail = window.mountTopFilterChipRail({
      anchorEl: searchInput,
      dockId: 'unitFilterChipDock',
    });
    recomputeUnitChipCounts();
    rerenderUnitFilterChips();
    unitFilterChipRail?.sync?.();
  };

  const getFilteredUnits = () => {
    const query = (searchInput?.value || '').trim().toLowerCase();
    return unitRows.filter((u) => {
      if (!shouldShowUnitSizeRow(u, activeUnitFilterChips)) return false;
      const haystack = [u.code || '', u.nameSingular || '', u.namePlural || '', u.category || '']
        .join(' ')
        .toLowerCase();
      return !query || haystack.includes(query);
    });
  };

  function renderUnitsList({ units }) {
    list.innerHTML = '';

    const rows = Array.isArray(units) ? units : [];
    if (!rows.length) {
      renderTopLevelEmptyState(list, 'No units yet. Add a unit.');
      listNav?.syncAfterRender?.();
      return;
    }

    rows.forEach((unit) => {
      const li = document.createElement('li');
      const state = getUnitSizeRowState(unit);
      if (state.isRemoved) li.classList.add('list-item--removed');

      const code = (unit.code || '').trim();
      const nameSingular = (unit.nameSingular || '').trim();
      let line = nameSingular || code;
      if (nameSingular && code && nameSingular.toLowerCase() !== code.toLowerCase()) {
        line = `${nameSingular} (${code})`;
      }

      li.textContent = line;

      const countRecipesUsingUnit = (code) => {
        const c = (code || '').trim();
        if (!c) return 0;
        try {
          const q = db.exec(
            `
            SELECT COUNT(DISTINCT rid) AS n
            FROM (
              SELECT recipe_id AS rid
              FROM recipe_ingredient_map
              WHERE lower(unit) = lower(?)
              UNION
              SELECT rim.recipe_id AS rid
              FROM recipe_ingredient_substitutes ris
              JOIN recipe_ingredient_map rim ON rim.ID = ris.recipe_ingredient_id
              WHERE lower(ris.unit) = lower(?)
            ) t;
            `,
            [c, c],
          );
          if (q.length && q[0].values.length) {
            const v = Number(q[0].values[0][0]);
            return Number.isFinite(v) ? v : 0;
          }
        } catch (err) {
          console.warn('countRecipesUsingUnit failed:', err);
        }
        return 0;
      };

      const removeUnit = async (code) => {
        const c = (code || '').trim();
        if (!c) return false;

        const usedCount = countRecipesUsingUnit(c);

        if (getUnitSizeRemovalAction(usedCount) === 'remove') {
          const ok = await uiConfirm({
            title: 'Remove Unit',
            message: `Remove '${c}'?\n\nUsed in ${usedCount} recipe${
              usedCount === 1 ? '' : 's'
            }.\n\nRemoving marks it as removed and blocks it from new selections. It remains in existing recipes until replaced.`,
            confirmText: 'Remove',
            cancelText: 'Cancel',
            danger: true,
          });
          if (!ok) return false;

          try {
            db.run('UPDATE units SET is_removed = 1 WHERE code = ?;', [c]);
          } catch (err) {
            console.error('❌ Failed to remove unit:', err);
            uiToast('Failed to remove unit. See console for details.');
            return false;
          }
        } else {
          const ok = await uiConfirm({
            title: 'Delete Unit',
            message: `Remove '${c}' permanently?\n\nIt isn't used in any recipes. This will permanently delete it from the database.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
          });
          if (!ok) return false;

          try {
            db.run('DELETE FROM units WHERE code = ?;', [c]);
          } catch (err) {
            console.error('❌ Failed to delete unit:', err);
            uiToast('Failed to delete unit. See console for details.');
            return false;
          }
        }

        // Persist DB after remove/hide.
        persistDb();

        return true;
      };

      li.addEventListener('click', (event) => {
        const wantsRemove = event.ctrlKey || event.metaKey;
        if (wantsRemove) {
          event.preventDefault();
          event.stopPropagation();
          void (async () => {
            const ok = await removeUnit(unit.code || '');
            if (!ok) return;
            unitRows = queryUnits();
            recomputeUnitChipCounts();
            rerenderUnitFilterChips();
            applyUnitFilters();
          })();
          return;
        }

        // Stash selected unit in session for future editor wiring
        sessionStorage.setItem('selectedUnitCode', unit.code || '');
        sessionStorage.setItem(
          'selectedUnitNameSingular',
          unit.nameSingular || '',
        );
        sessionStorage.setItem('selectedUnitNamePlural', unit.namePlural || '');
        sessionStorage.setItem('selectedUnitCategory', unit.category || '');
        sessionStorage.setItem('selectedUnitIsHidden', state.isHidden ? '1' : '0');
        sessionStorage.setItem('selectedUnitIsRemoved', state.isRemoved ? '1' : '0');
        sessionStorage.removeItem('selectedUnitIsNew');

        window.location.href = 'unitEditor.html';
      });

      li.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        void (async () => {
          const ok = await removeUnit(unit.code || '');
          if (!ok) return;
          unitRows = queryUnits();
          recomputeUnitChipCounts();
          rerenderUnitFilterChips();
          applyUnitFilters();
        })();
      });

      list.appendChild(li);
    });

    // Keep selection valid after rerender (search/filter changes).
    listNav?.syncAfterRender?.();
  }

  const applyUnitFilters = () => {
    renderUnitsList({ units: getFilteredUnits() });
  };

  mountUnitFilterChips();
  // Initial render
  applyUnitFilters();

  async function openCreateUnitDialog() {
    if (!window.ui) {
      uiToast('UI not ready yet.');
      return;
    }

    const vals = await window.ui.form({
      title: 'New Unit',
      fields: [
        {
          key: 'nameSingular',
          label: 'Name (singular)',
          value: '',
          required: true,
          normalize: (v) => (v || '').trim(),
        },
        {
          key: 'code',
          label: 'Abbreviation (optional)',
          value: '',
          required: false,
          normalize: (v) => (v || '').trim(),
        },
      ],
      confirmText: 'Create',
      cancelText: 'Cancel',
      validate: (v) => {
        if (!v.nameSingular || !v.nameSingular.trim()) {
          return 'Name (singular) is required.';
        }
        return '';
      },
    });
    if (!vals) return;

    const nameSingular = (vals.nameSingular || '').trim();
    const code = ((vals.code || '').trim() || nameSingular).trim();
    if (!nameSingular || !code) return;

    try {
      // Best-effort sort order: append at end
      let nextSort = null;
      try {
        const q = db.exec(
          'SELECT COALESCE(MAX(sort_order), 0) + 1 FROM units;',
        );
        if (q.length && q[0].values.length) {
          nextSort = q[0].values[0][0];
        }
      } catch (_) {
        nextSort = null;
      }

      db.run(
        'INSERT INTO units (code, name_singular, name_plural, category, sort_order, is_hidden, is_removed) VALUES (?, ?, ?, ?, ?, 0, 0);',
        [code, nameSingular, '', '', nextSort],
      );
    } catch (err) {
      console.error('❌ Failed to create unit:', err);
      uiToast('Failed to create unit. (Code must be unique.)');
      return;
    }

    try {
      const binaryArray = db.export();
      const isElectronEnv = !!window.electronAPI;
      if (isElectronEnv) {
        const ok = await window.electronAPI.saveDB(binaryArray);
        if (ok === false) {
          uiToast('Failed to save database after creating unit.');
          return;
        }
      } else {
        localStorage.setItem(
          'favoriteEatsDb',
          JSON.stringify(Array.from(binaryArray)),
        );
      }
    } catch (err) {
      console.error('❌ Failed to persist DB after creating unit:', err);
      uiToast('Failed to save database after creating unit.');
      return;
    }

    sessionStorage.setItem('selectedUnitCode', code);
    sessionStorage.setItem('selectedUnitNameSingular', nameSingular);
    sessionStorage.setItem('selectedUnitNamePlural', '');
    sessionStorage.setItem('selectedUnitCategory', '');
    sessionStorage.setItem('selectedUnitIsHidden', '0');
    sessionStorage.setItem('selectedUnitIsRemoved', '0');
    sessionStorage.setItem('selectedUnitIsNew', '1');
    window.location.href = 'unitEditor.html';
  }

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      void openCreateUnitDialog();
    });
  }

}

async function loadTagsPage() {
  initAppBar({
    mode: 'list',
    titleText: 'Tags',
    showAdd: true,
  });

  const list = document.getElementById('tagsList');
  if (!list) return;

  if (typeof waitForAppBarReady === 'function') {
    await waitForAppBarReady();
  }
  initBottomNav();

  const searchInput = document.getElementById('appBarSearchInput');
  const clearBtn = document.getElementById('appBarSearchClear');
  wireAppBarSearch(searchInput, {
    clearBtn,
    onQueryChange: () => {
      renderTags(applyTagSearchFilter(tagRows));
    },
  });
  const addBtn = document.getElementById('appBarAddBtn');

  const listNav = enableTopLevelListKeyboardNav(list);
  attachSecretGalleryShortcut(addBtn);

  const isElectron = !!window.electronAPI;
  let db;
  if (isElectron) {
    try {
      const pathHint = localStorage.getItem('favoriteEatsDbPath') || null;
      const bytes = await window.electronAPI.loadDB(pathHint);
      const Uints = new Uint8Array(bytes);
      db = new SQL.Database(Uints);
    } catch (err) {
      console.error('❌ Failed to load DB from disk:', err);
      uiToast('No database loaded. Please go back to the welcome page.');
      window.location.href = 'index.html';
      return;
    }
  } else {
    const stored = localStorage.getItem('favoriteEatsDb');
    if (!stored) {
      uiToast('No database loaded. Please go back to the welcome page.');
      window.location.href = 'index.html';
      return;
    }
    const Uints = new Uint8Array(JSON.parse(stored));
    db = new SQL.Database(Uints);
  }

  window.dbInstance = db;
  await ensureIngredientLemmaMaintenanceInMain(db, isElectron);
  ensureRecipeTagsSchemaInMain(db);

  const persistDb = async () => {
    const binaryArray = db.export();
    if (isElectron) {
      const ok = await window.electronAPI.saveDB(binaryArray);
      if (ok === false) throw new Error('Failed to save DB.');
    } else {
      localStorage.setItem(
        'favoriteEatsDb',
        JSON.stringify(Array.from(binaryArray))
      );
    }
  };

  const queryTags = () => {
    const q = db.exec(`
      SELECT id, name, COALESCE(sort_order, 999999) AS sort_order
      FROM tags
      WHERE COALESCE(is_hidden, 0) = 0
      ORDER BY sort_order, name COLLATE NOCASE;
    `);
    if (!q.length) return [];
    return q[0].values.map(([id, name, sortOrder]) => ({
      id: Number(id),
      name: String(name || ''),
      sortOrder: Number(sortOrder),
    }));
  };

  let tagRows = queryTags();

  const deleteTag = async (tag) => {
    if (!tag || !Number.isFinite(Number(tag.id))) return false;
    const ok = await uiConfirm({
      title: 'Delete Tag',
      message: `Delete "${tag.name}"?\n\nThis removes it from all recipes.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return false;
    try {
      db.run('DELETE FROM tags WHERE id = ?;', [tag.id]);
      await persistDb();
      return true;
    } catch (err) {
      console.error('❌ Failed to delete tag:', err);
      uiToast('Failed to delete tag. See console.');
      return false;
    }
  };

  function renderTags(rows) {
    list.innerHTML = '';
    const items = Array.isArray(rows) ? rows : [];
    if (!items.length) {
      renderTopLevelEmptyState(list, 'No tags yet. Add a tag.');
      listNav?.syncAfterRender?.();
      return;
    }
    items.forEach((tag) => {
      const li = document.createElement('li');
      li.textContent = tag.name || '';
      li.addEventListener('click', (event) => {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          void (async () => {
            const ok = await deleteTag(tag);
            if (!ok) return;
            tagRows = queryTags();
            renderTags(applyTagSearchFilter(tagRows));
          })();
          return;
        }
        sessionStorage.setItem('selectedTagId', String(tag.id));
        sessionStorage.setItem('selectedTagName', tag.name || '');
        sessionStorage.removeItem('selectedTagIsNew');
        window.location.href = 'tagEditor.html';
      });
      li.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        void (async () => {
          const ok = await deleteTag(tag);
          if (!ok) return;
          tagRows = queryTags();
          renderTags(applyTagSearchFilter(tagRows));
        })();
      });
      list.appendChild(li);
    });
    listNav?.syncAfterRender?.();
  }

  const applyTagSearchFilter = (rows) => {
    const q = (searchInput?.value || '').trim().toLowerCase();
    if (!q) return rows;
    return (rows || []).filter((row) =>
      String(row.name || '').toLowerCase().includes(q)
    );
  };

  const openCreateTagDialog = async () => {
    if (!window.ui) return;
    const vals = await window.ui.form({
      title: 'New Tag',
      fields: [
        {
          key: 'name',
          label: 'Name',
          value: '',
          required: true,
          normalize: (v) => String(v || '').trim(),
        },
      ],
      confirmText: 'Create',
      cancelText: 'Cancel',
      validate: (v) => {
        const clipped = String(v.name || '').trim().slice(0, 48).trim();
        if (!clipped) return 'Name is required.';
        return '';
      },
    });
    if (!vals) return;
    const name = String(vals.name || '').trim().slice(0, 48).trim();
    if (!name) return;
    try {
      const maxQ = db.exec('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tags;');
      const nextSort =
        maxQ.length && maxQ[0].values.length
          ? Number(maxQ[0].values[0][0]) || 1
          : 1;
      db.run('INSERT INTO tags (name, sort_order) VALUES (?, ?);', [name, nextSort]);
      const idQ = db.exec('SELECT last_insert_rowid();');
      const newId =
        idQ.length && idQ[0].values.length ? Number(idQ[0].values[0][0]) : null;
      await persistDb();
      if (Number.isFinite(newId) && newId > 0) {
        sessionStorage.setItem('selectedTagId', String(newId));
        sessionStorage.setItem('selectedTagName', name);
        sessionStorage.setItem('selectedTagIsNew', '1');
        window.location.href = 'tagEditor.html';
        return;
      }
      tagRows = queryTags();
      renderTags(applyTagSearchFilter(tagRows));
    } catch (err) {
      console.error('❌ Failed to create tag:', err);
      uiToast('Failed to create tag. Name must be unique.');
    }
  };

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      void openCreateTagDialog();
    });
  }

  renderTags(tagRows);
}

function loadTagEditorPage() {
  const view = document.getElementById('pageContent');
  if (!view) return;

  const isNew = sessionStorage.getItem('selectedTagIsNew') === '1';
  const idStr = sessionStorage.getItem('selectedTagId');
  const tagId = Number(idStr);
  const storedName = sessionStorage.getItem('selectedTagName') || '';
  const titleDisplay = storedName || (isNew ? 'New tag' : 'Tag');
  const initialTitle = storedName || (isNew ? 'new tag' : 'tag');

  initAppBar({ mode: 'editor', titleText: titleDisplay });
  view.innerHTML = `
    <h1 id="childEditorTitle" class="recipe-title">${titleDisplay || ''}</h1>
    <div id="tagRecipesCard" class="you-will-need-card" aria-label="Recipes with this tag">
      <h2 class="section-header">RECIPES</h2>
      <div id="tagRecipesList"></div>
    </div>
  `;
  const recipesListEl = document.getElementById('tagRecipesList');
  const renderRecipesForTag = (rows) => {
    if (!recipesListEl) return;
    recipesListEl.innerHTML = '';
    const items = Array.isArray(rows) ? rows : [];
    if (!items.length) {
      const line = document.createElement('div');
      line.className = 'ingredient-line';
      const span = document.createElement('span');
      span.className = 'placeholder-prompt';
      span.textContent = 'No recipes use this tag.';
      line.appendChild(span);
      recipesListEl.appendChild(line);
      return;
    }
    items.forEach((row) => {
      const recipeId = Number(row?.id);
      const title = String(row?.title || '').trim();
      if (!Number.isFinite(recipeId) || recipeId <= 0 || !title) return;
      const line = document.createElement('div');
      line.className = 'ingredient-line';
      const link = document.createElement('a');
      link.href = '#';
      link.textContent = title;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        if (typeof window.openRecipe === 'function') {
          window.openRecipe(recipeId);
          return;
        }
        sessionStorage.setItem('selectedRecipeId', String(recipeId));
        window.location.href = 'recipeEditor.html';
      });
      line.appendChild(link);
      recipesListEl.appendChild(line);
    });
    if (!recipesListEl.children.length) renderRecipesForTag([]);
  };
  const loadRecipesForTagCard = async () => {
    if (!(Number.isFinite(tagId) && tagId > 0)) {
      renderRecipesForTag([]);
      return;
    }
    const isElectron = !!window.electronAPI;
    let db;
    try {
      if (isElectron) {
        const pathHint = localStorage.getItem('favoriteEatsDbPath') || null;
        const bytes = await window.electronAPI.loadDB(pathHint);
        const Uints = new Uint8Array(bytes);
        db = new SQL.Database(Uints);
      } else {
        const stored = localStorage.getItem('favoriteEatsDb');
        if (!stored) throw new Error('No DB in localStorage.');
        const Uints = new Uint8Array(JSON.parse(stored));
        db = new SQL.Database(Uints);
      }
      ensureRecipeTagsSchemaInMain(db);
      const q = db.exec(`
        SELECT DISTINCT r.ID, r.title
        FROM recipe_tag_map m
        JOIN recipes r ON r.ID = m.recipe_id
        WHERE m.tag_id = ${Math.trunc(tagId)}
        ORDER BY r.title COLLATE NOCASE;
      `);
      const rows = q.length
        ? q[0].values.map(([id, title]) => ({
            id: Number(id),
            title: String(title || ''),
          }))
        : [];
      renderRecipesForTag(rows);
    } catch (err) {
      console.warn('⚠️ Failed to load recipes for tag card:', err);
      renderRecipesForTag([]);
    }
  };
  void loadRecipesForTagCard();

  if (typeof waitForAppBarReady !== 'function') return;
  waitForAppBarReady().then(() => {
    wireChildEditorPage({
      backBtn: document.getElementById('appBarBackBtn'),
      cancelBtn: document.getElementById('appBarCancelBtn'),
      saveBtn: document.getElementById('appBarSaveBtn'),
      appBarTitleEl: document.getElementById('appBarTitle'),
      bodyTitleEl: document.getElementById('childEditorTitle'),
      initialTitle,
      backHref: 'tags.html',
      normalizeTitle: (s) => String(s || '').trim().slice(0, 48),
      onSave: async ({ title: next }) => {
        const name = String(next || '').trim().slice(0, 48).trim();
        if (!name) {
          uiToast('Tag name is required.');
          throw new Error('Tag name required');
        }

        const isElectron = !!window.electronAPI;
        let db;
        if (isElectron) {
          const pathHint = localStorage.getItem('favoriteEatsDbPath') || null;
          const bytes = await window.electronAPI.loadDB(pathHint);
          const Uints = new Uint8Array(bytes);
          db = new SQL.Database(Uints);
        } else {
          const stored = localStorage.getItem('favoriteEatsDb');
          if (!stored) throw new Error('No DB in localStorage.');
          const Uints = new Uint8Array(JSON.parse(stored));
          db = new SQL.Database(Uints);
        }
        ensureRecipeTagsSchemaInMain(db);
        window.dbInstance = db;
        await ensureIngredientLemmaMaintenanceInMain(db, isElectron);

        const dupStmt = db.prepare(
          `SELECT id FROM tags
           WHERE lower(trim(name)) = lower(trim(?))
             AND (? IS NULL OR id != ?)
           LIMIT 1;`
        );
        let hasDup = false;
        try {
          dupStmt.bind([name, Number.isFinite(tagId) ? tagId : null, Number.isFinite(tagId) ? tagId : null]);
          if (dupStmt.step()) hasDup = true;
        } finally {
          dupStmt.free();
        }
        if (hasDup) {
          uiToast('That tag already exists.');
          throw new Error('Duplicate tag');
        }

        if (Number.isFinite(tagId) && tagId > 0) {
          db.run('UPDATE tags SET name = ? WHERE id = ?;', [name, tagId]);
        } else {
          const maxQ = db.exec(
            'SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tags;'
          );
          const nextSort =
            maxQ.length && maxQ[0].values.length
              ? Number(maxQ[0].values[0][0]) || 1
              : 1;
          db.run('INSERT INTO tags (name, sort_order) VALUES (?, ?);', [
            name,
            nextSort,
          ]);
          const idQ = db.exec('SELECT last_insert_rowid();');
          if (idQ.length && idQ[0].values.length) {
            sessionStorage.setItem('selectedTagId', String(idQ[0].values[0][0]));
          }
        }

        const binaryArray = db.export();
        if (isElectron) {
          const ok = await window.electronAPI.saveDB(binaryArray);
          if (ok === false) throw new Error('Failed to save DB.');
        } else {
          localStorage.setItem(
            'favoriteEatsDb',
            JSON.stringify(Array.from(binaryArray))
          );
        }
        sessionStorage.setItem('selectedTagName', name);
        sessionStorage.removeItem('selectedTagIsNew');
      },
    });
  });
}

async function loadSizesPage() {
  initAppBar({
    mode: 'list',
    titleText: 'Sizes',
    showAdd: true,
  });

  const list = document.getElementById('sizesList');
  if (!list) return;

  if (typeof waitForAppBarReady === 'function') {
    await waitForAppBarReady();
  }
  initBottomNav();

  const searchInput = document.getElementById('appBarSearchInput');
  const clearBtn = document.getElementById('appBarSearchClear');
  wireAppBarSearch(searchInput, {
    clearBtn,
    onQueryChange: () => {
      applySizeFilters();
    },
  });
  const addBtn = document.getElementById('appBarAddBtn');

  const listNav = enableTopLevelListKeyboardNav(list);
  attachSecretGalleryShortcut(addBtn);

  const isElectron = !!window.electronAPI;
  let db;
  if (isElectron) {
    try {
      const pathHint = localStorage.getItem('favoriteEatsDbPath') || null;
      const bytes = await window.electronAPI.loadDB(pathHint);
      db = new SQL.Database(new Uint8Array(bytes));
    } catch (err) {
      console.error('❌ Failed to load DB from disk:', err);
      uiToast('No database loaded. Please go back to the welcome page.');
      window.location.href = 'index.html';
      return;
    }
  } else {
    const stored = localStorage.getItem('favoriteEatsDb');
    if (!stored) {
      uiToast('No database loaded. Please go back to the welcome page.');
      window.location.href = 'index.html';
      return;
    }
    db = new SQL.Database(new Uint8Array(JSON.parse(stored)));
  }

  window.dbInstance = db;
  await ensureIngredientLemmaMaintenanceInMain(db, isElectron);
  ensureSizesSchemaInMain(db);

  const persistDb = async () => {
    const binaryArray = db.export();
    if (isElectron) {
      const ok = await window.electronAPI.saveDB(binaryArray);
      if (ok === false) throw new Error('Failed to save DB.');
    } else {
      localStorage.setItem(
        'favoriteEatsDb',
        JSON.stringify(Array.from(binaryArray))
      );
    }
  };

  const querySizes = () => {
    const q = db.exec(`
      SELECT
        id,
        name,
        COALESCE(sort_order, 999999) AS sort_order,
        COALESCE(is_hidden, 0) AS is_hidden,
        COALESCE(is_removed, 0) AS is_removed
      FROM sizes
      ORDER BY sort_order, name COLLATE NOCASE;
    `);
    if (!q.length) return [];
    return sortSizeRows(
      q[0].values.map(([id, name, sortOrder, isHidden, isRemoved]) => ({
        id: Number(id),
        name: String(name || ''),
        sortOrder: Number(sortOrder),
        isHidden: Number(isHidden || 0) === 1,
        isRemoved: Number(isRemoved || 0) === 1,
      }))
    );
  };

  let sizeRows = querySizes();

  const sizeFilterChipDefs = [
    { id: 'hidden', label: 'hidden' },
    { id: 'removed', label: 'removed' },
  ];
  const activeSizeFilterChips = new Set();
  let sizeChipCounts = new Map();
  let sizeFilterChipRail = null;

  const recomputeSizeChipCounts = () => {
    const counts = new Map();
    sizeFilterChipDefs.forEach((chip) => counts.set(chip.id, 0));
    sizeRows.forEach((row) => {
      const state = getUnitSizeRowState(row);
      if (state.isHidden) counts.set('hidden', (counts.get('hidden') || 0) + 1);
      if (state.isRemoved) counts.set('removed', (counts.get('removed') || 0) + 1);
    });
    sizeChipCounts = counts;
  };

  const rerenderSizeFilterChips = () => {
    const chipMountEl = sizeFilterChipRail?.trackEl;
    if (!chipMountEl) return;
    if (typeof window.renderFilterChipList !== 'function') {
      chipMountEl.innerHTML = '';
      return;
    }
    window.renderFilterChipList({
      mountEl: chipMountEl,
      chips: sizeFilterChipDefs.map((chipDef) => {
        const count = Number(sizeChipCounts.get(chipDef.id) || 0);
        return {
          id: chipDef.id,
          label: chipDef.label,
          disabled: count <= 0,
        };
      }),
      activeChipIds: activeSizeFilterChips,
      onToggle: (chipId) => {
        const key = String(chipId || '').toLowerCase();
        const count = Number(sizeChipCounts.get(key) || 0);
        if (!key || count <= 0) return;
        if (activeSizeFilterChips.has(key)) activeSizeFilterChips.delete(key);
        else activeSizeFilterChips.add(key);
        rerenderSizeFilterChips();
        applySizeFilters();
      },
      chipClassName: 'app-filter-chip',
    });
  };

  const mountSizeFilterChips = () => {
    if (!searchInput) return;
    if (typeof window.mountTopFilterChipRail !== 'function') return;
    sizeFilterChipRail = window.mountTopFilterChipRail({
      anchorEl: searchInput,
      dockId: 'sizeFilterChipDock',
    });
    recomputeSizeChipCounts();
    rerenderSizeFilterChips();
    sizeFilterChipRail?.sync?.();
  };

  const tableHasColumn = (tableName, colName) => {
    try {
      const q = db.exec(`PRAGMA table_info(${tableName});`);
      const cols =
        Array.isArray(q) && q.length > 0 && Array.isArray(q[0].values)
          ? q[0].values
              .map((r) => String((Array.isArray(r) ? r[1] : '') || '').toLowerCase())
              .filter(Boolean)
          : [];
      return cols.includes(String(colName || '').toLowerCase());
    } catch (_) {
      return false;
    }
  };
  const hasRimSize = tableHasColumn('recipe_ingredient_map', 'size');
  const hasRisSize = tableHasColumn('recipe_ingredient_substitutes', 'size');
  const hasIngSize = tableHasColumn('ingredients', 'size');

  const countRecipesUsingSize = (sizeName) => {
    const n = String(sizeName || '').trim();
    if (!n) return 0;
    const usageSelects = [];
    if (hasRimSize) {
      usageSelects.push(`
          SELECT recipe_id AS rid
          FROM recipe_ingredient_map
          WHERE lower(trim(COALESCE(size, ''))) = lower(trim(?))
      `);
    }
    if (hasIngSize) {
      usageSelects.push(`
          SELECT rim.recipe_id AS rid
          FROM recipe_ingredient_map rim
          JOIN ingredients i ON i.ID = rim.ingredient_id
          WHERE lower(trim(COALESCE(i.size, ''))) = lower(trim(?))
      `);
    }
    if (hasRisSize) {
      usageSelects.push(`
          SELECT rim.recipe_id AS rid
          FROM recipe_ingredient_substitutes ris
          JOIN recipe_ingredient_map rim ON rim.ID = ris.recipe_ingredient_id
          WHERE lower(trim(COALESCE(ris.size, ''))) = lower(trim(?))
      `);
    }
    if (!usageSelects.length) return 0;
    const params = new Array(usageSelects.length).fill(n);
    try {
      const q = db.exec(
        `
        SELECT COUNT(DISTINCT rid) AS n
        FROM (
          ${usageSelects.join('\nUNION\n')}
        ) t;
        `,
        params,
      );
      if (q.length && q[0].values.length) {
        const v = Number(q[0].values[0][0]);
        return Number.isFinite(v) ? v : 0;
      }
    } catch (err) {
      console.warn('countRecipesUsingSize failed:', err);
    }
    return 0;
  };

  const getRecipesUsingSize = (sizeName) => {
    const n = String(sizeName || '').trim();
    if (!n) return [];
    const usageSelects = [];
    if (hasRimSize) {
      usageSelects.push(`
          SELECT recipe_id AS rid
          FROM recipe_ingredient_map
          WHERE lower(trim(COALESCE(size, ''))) = lower(trim(?))
      `);
    }
    if (hasIngSize) {
      usageSelects.push(`
          SELECT rim.recipe_id AS rid
          FROM recipe_ingredient_map rim
          JOIN ingredients i ON i.ID = rim.ingredient_id
          WHERE lower(trim(COALESCE(i.size, ''))) = lower(trim(?))
      `);
    }
    if (hasRisSize) {
      usageSelects.push(`
          SELECT rim.recipe_id AS rid
          FROM recipe_ingredient_substitutes ris
          JOIN recipe_ingredient_map rim ON rim.ID = ris.recipe_ingredient_id
          WHERE lower(trim(COALESCE(ris.size, ''))) = lower(trim(?))
      `);
    }
    if (!usageSelects.length) return [];
    const params = new Array(usageSelects.length).fill(n);
    try {
      const q = db.exec(
        `
        SELECT r.ID, r.title
        FROM recipes r
        JOIN (
          ${usageSelects.join('\nUNION\n')}
        ) refs ON refs.rid = r.ID
        ORDER BY r.title COLLATE NOCASE;
        `,
        params,
      );
      if (!q.length || !q[0].values.length) return [];
      return q[0].values
        .map(([recipeId, recipeTitle]) => ({
          id: Number(recipeId),
          title: String(recipeTitle || '').trim(),
        }))
        .filter((row) => Number.isFinite(row.id) && row.id > 0);
    } catch (err) {
      console.warn('getRecipesUsingSize failed:', err);
      return [];
    }
  };

  const removeSize = async (sizeRow) => {
    if (!sizeRow || !Number.isFinite(Number(sizeRow.id))) return false;
    const name = String(sizeRow.name || '').trim();
    const usedCount = countRecipesUsingSize(name);

    if (usedCount > 0) {
      const recipes = getRecipesUsingSize(name);
      const usageLine =
        usedCount === 1
          ? 'This size is used in this recipe:'
          : 'This size is used in these recipes:';
      const details = document.createElement('div');
      details.className = 'shopping-remove-dialog-details';

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
      if (recipes.length) details.appendChild(linksWrap);

      const note = document.createElement('div');
      note.className = 'shopping-remove-dialog-note';
      note.textContent = `Removing marks this size as removed and blocks it from new selections, but keeps existing recipe references intact.`;
      details.appendChild(note);

      let ok = false;
      if (window.ui && typeof window.ui.dialog === 'function') {
        const res = await window.ui.dialog({
          title: 'Remove Size',
          message: `Remove "${name}"? ${usageLine}`,
          messageNode: details,
          confirmText: 'Remove',
          cancelText: 'Cancel',
          danger: true,
        });
        ok = !!res;
      } else {
        ok = await uiConfirm({
          title: 'Remove Size',
          message: `Remove "${name}"? ${usageLine}\n\nRemoving marks it as removed and blocks it from new selections.`,
          confirmText: 'Remove',
          cancelText: 'Cancel',
          danger: true,
        });
      }
      if (!ok) return false;

      try {
        db.run('UPDATE sizes SET is_removed = 1 WHERE id = ?;', [sizeRow.id]);
      } catch (err) {
        console.error('❌ Failed to remove size:', err);
        uiToast('Failed to remove size. See console.');
        return false;
      }
    } else {
      const ok = await uiConfirm({
        title: 'Delete Size',
        message: `Remove "${name}" permanently?\n\nIt isn't used in any recipes. This will permanently delete it from the database.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        danger: true,
      });
      if (!ok) return false;
      try {
        db.run('DELETE FROM sizes WHERE id = ?;', [sizeRow.id]);
      } catch (err) {
        console.error('❌ Failed to delete size:', err);
        uiToast('Failed to delete size. See console.');
        return false;
      }
    }

    try {
      await persistDb();
      return true;
    } catch (err) {
      console.error('❌ Failed to save DB after size remove/delete:', err);
      uiToast('Failed to save changes. See console.');
      return false;
    }
  };

  function renderSizes(rows) {
    list.innerHTML = '';
    const items = Array.isArray(rows) ? rows : [];
    if (!items.length) {
      renderTopLevelEmptyState(list, 'No sizes yet. Add a size.');
      listNav?.syncAfterRender?.();
      return;
    }
    items.forEach((sizeRow) => {
      const li = document.createElement('li');
      if (getUnitSizeRowState(sizeRow).isRemoved) li.classList.add('list-item--removed');
      li.textContent = sizeRow.name || '';
      li.addEventListener('click', (event) => {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          void (async () => {
            const ok = await removeSize(sizeRow);
            if (!ok) return;
            sizeRows = querySizes();
            recomputeSizeChipCounts();
            rerenderSizeFilterChips();
            applySizeFilters();
          })();
          return;
        }
        sessionStorage.setItem('selectedSizeId', String(sizeRow.id));
        sessionStorage.setItem('selectedSizeName', sizeRow.name || '');
        sessionStorage.setItem('selectedSizeIsHidden', sizeRow.isHidden ? '1' : '0');
        sessionStorage.setItem('selectedSizeIsRemoved', sizeRow.isRemoved ? '1' : '0');
        sessionStorage.removeItem('selectedSizeIsNew');
        window.location.href = 'sizeEditor.html';
      });
      li.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        void (async () => {
          const ok = await removeSize(sizeRow);
          if (!ok) return;
          sizeRows = querySizes();
          recomputeSizeChipCounts();
          rerenderSizeFilterChips();
          applySizeFilters();
        })();
      });
      list.appendChild(li);
    });
    listNav?.syncAfterRender?.();
  }

  const applySizeSearchFilter = (rows) => {
    const q = (searchInput?.value || '').trim().toLowerCase();
    return (rows || []).filter((row) => {
      if (!shouldShowUnitSizeRow(row, activeSizeFilterChips)) return false;
      return !q || String(row.name || '').toLowerCase().includes(q);
    });
  };

  const openCreateSizeDialog = async () => {
    if (!window.ui) return;
    const vals = await window.ui.form({
      title: 'New Size',
      fields: [
        {
          key: 'name',
          label: 'Name',
          value: '',
          required: true,
          normalize: (v) => String(v || '').trim().replace(/\s+/g, ' '),
        },
      ],
      confirmText: 'Create',
      cancelText: 'Cancel',
      validate: (v) => {
        const clipped = String(v.name || '').trim().slice(0, 64).trim();
        if (!clipped) return 'Name is required.';
        return '';
      },
    });
    if (!vals) return;
    const name = String(vals.name || '').trim().replace(/\s+/g, ' ').slice(0, 64).trim();
    if (!name) return;
    try {
      const maxQ = db.exec('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM sizes;');
      const nextSort =
        maxQ.length && maxQ[0].values.length
          ? Number(maxQ[0].values[0][0]) || 1
          : 1;
      db.run('INSERT INTO sizes (name, sort_order, is_hidden, is_removed) VALUES (?, ?, 0, 0);', [
        name,
        nextSort,
      ]);
      const idQ = db.exec('SELECT last_insert_rowid();');
      const newId =
        idQ.length && idQ[0].values.length ? Number(idQ[0].values[0][0]) : null;
      await persistDb();
      if (Number.isFinite(newId) && newId > 0) {
        sessionStorage.setItem('selectedSizeId', String(newId));
        sessionStorage.setItem('selectedSizeName', name);
        sessionStorage.setItem('selectedSizeIsHidden', '0');
        sessionStorage.setItem('selectedSizeIsRemoved', '0');
        sessionStorage.setItem('selectedSizeIsNew', '1');
        window.location.href = 'sizeEditor.html';
        return;
      }
      sizeRows = querySizes();
      recomputeSizeChipCounts();
      rerenderSizeFilterChips();
      renderSizes(applySizeSearchFilter(sizeRows));
    } catch (err) {
      console.error('❌ Failed to create size:', err);
      uiToast('Failed to create size. Name must be unique.');
    }
  };

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      void openCreateSizeDialog();
    });
  }

  const applySizeFilters = () => {
    renderSizes(applySizeSearchFilter(sizeRows));
  };

  mountSizeFilterChips();
  applySizeFilters();
}

function loadSizeEditorPage() {
  const view = document.getElementById('pageContent');
  if (!view) return;

  const isNew = sessionStorage.getItem('selectedSizeIsNew') === '1';
  const idStr = sessionStorage.getItem('selectedSizeId');
  const sizeId = Number(idStr);
  const storedName = sessionStorage.getItem('selectedSizeName') || '';
  const initialHidden = sessionStorage.getItem('selectedSizeIsHidden') === '1';
  const initialRemoved = sessionStorage.getItem('selectedSizeIsRemoved') === '1';
  const titleDisplay = storedName || (isNew ? 'New size' : 'Size');
  const initialTitle = storedName || (isNew ? 'new size' : 'size');

  initAppBar({ mode: 'editor', titleText: titleDisplay });
  view.innerHTML = `
    <h1 id="childEditorTitle" class="recipe-title">${titleDisplay || ''}</h1>
    <div class="shopping-item-status" style="margin-top: 20px;">
      <div class="shopping-item-status-row">
        <label class="shopping-item-toggle">
          <input id="sizeIsHiddenToggle" type="checkbox" ${initialHidden ? 'checked' : ''} />
          <span>Hidden</span>
        </label>
      </div>
      <div class="shopping-item-status-row">
        <label class="shopping-item-toggle">
          <input id="sizeIsRemovedToggle" type="checkbox" ${initialRemoved ? 'checked' : ''} />
          <span>Removed</span>
        </label>
      </div>
    </div>
  `;

  if (typeof waitForAppBarReady !== 'function') return;
  waitForAppBarReady().then(() => {
    wireChildEditorPage({
      backBtn: document.getElementById('appBarBackBtn'),
      cancelBtn: document.getElementById('appBarCancelBtn'),
      saveBtn: document.getElementById('appBarSaveBtn'),
      appBarTitleEl: document.getElementById('appBarTitle'),
      bodyTitleEl: document.getElementById('childEditorTitle'),
      initialTitle,
      backHref: 'sizes.html',
      normalizeTitle: (s) =>
        String(s || '').trim().replace(/\s+/g, ' ').slice(0, 64),
      onSave: async ({ title: next }) => {
        const name = String(next || '').trim().replace(/\s+/g, ' ').slice(0, 64).trim();
        if (!name) {
          uiToast('Size name is required.');
          throw new Error('Size name required');
        }

        const isElectron = !!window.electronAPI;
        let db;
        if (isElectron) {
          const pathHint = localStorage.getItem('favoriteEatsDbPath') || null;
          const bytes = await window.electronAPI.loadDB(pathHint);
          db = new SQL.Database(new Uint8Array(bytes));
        } else {
          const stored = localStorage.getItem('favoriteEatsDb');
          if (!stored) throw new Error('No DB in localStorage.');
          db = new SQL.Database(new Uint8Array(JSON.parse(stored)));
        }
        ensureSizesSchemaInMain(db);
        window.dbInstance = db;
        await ensureIngredientLemmaMaintenanceInMain(db, isElectron);

        const tableHasColumn = (tableName, colName) => {
          try {
            const q = db.exec(`PRAGMA table_info(${tableName});`);
            const cols =
              Array.isArray(q) && q.length > 0 && Array.isArray(q[0].values)
                ? q[0].values
                    .map((r) => String((Array.isArray(r) ? r[1] : '') || '').toLowerCase())
                    .filter(Boolean)
                : [];
            return cols.includes(String(colName || '').toLowerCase());
          } catch (_) {
            return false;
          }
        };

        const dupStmt = db.prepare(
          `SELECT id FROM sizes
           WHERE lower(trim(name)) = lower(trim(?))
             AND (? IS NULL OR id != ?)
           LIMIT 1;`
        );
        let hasDup = false;
        try {
          dupStmt.bind([
            name,
            Number.isFinite(sizeId) ? sizeId : null,
            Number.isFinite(sizeId) ? sizeId : null,
          ]);
          if (dupStmt.step()) hasDup = true;
        } finally {
          dupStmt.free();
        }
        if (hasDup) {
          uiToast('That size already exists.');
          throw new Error('Duplicate size');
        }

        const oldName = String(storedName || '').trim();
        const isHidden = document.getElementById('sizeIsHiddenToggle')?.checked ? 1 : 0;
        const isRemoved = document.getElementById('sizeIsRemovedToggle')?.checked ? 1 : 0;
        if (Number.isFinite(sizeId) && sizeId > 0) {
          db.run('UPDATE sizes SET name = ?, is_hidden = ?, is_removed = ? WHERE id = ?;', [
            name,
            isHidden,
            isRemoved,
            sizeId,
          ]);
        } else {
          const maxQ = db.exec('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM sizes;');
          const nextSort =
            maxQ.length && maxQ[0].values.length
              ? Number(maxQ[0].values[0][0]) || 1
              : 1;
          db.run('INSERT INTO sizes (name, sort_order, is_hidden, is_removed) VALUES (?, ?, ?, ?);', [
            name,
            nextSort,
            isHidden,
            isRemoved,
          ]);
          const idQ = db.exec('SELECT last_insert_rowid();');
          if (idQ.length && idQ[0].values.length) {
            sessionStorage.setItem('selectedSizeId', String(idQ[0].values[0][0]));
          }
        }

        if (oldName && oldName.toLowerCase() !== name.toLowerCase()) {
          try {
            if (tableHasColumn('ingredients', 'size')) {
              db.run(
                `UPDATE ingredients
                 SET size = ?
                 WHERE lower(trim(size)) = lower(trim(?));`,
                [name, oldName]
              );
            }
          } catch (_) {}
          try {
            if (tableHasColumn('ingredient_sizes', 'size')) {
              db.run(
                `UPDATE ingredient_sizes
                 SET size = ?
                 WHERE lower(trim(size)) = lower(trim(?));`,
                [name, oldName]
              );
            }
          } catch (_) {}
          try {
            if (tableHasColumn('recipe_ingredient_substitutes', 'size')) {
              db.run(
                `UPDATE recipe_ingredient_substitutes
                 SET size = ?
                 WHERE lower(trim(size)) = lower(trim(?));`,
                [name, oldName]
              );
            }
          } catch (_) {}
        }

        const binaryArray = db.export();
        if (isElectron) {
          const ok = await window.electronAPI.saveDB(binaryArray);
          if (ok === false) throw new Error('Failed to save DB.');
        } else {
          localStorage.setItem(
            'favoriteEatsDb',
            JSON.stringify(Array.from(binaryArray))
          );
        }
        sessionStorage.setItem('selectedSizeName', name);
        sessionStorage.setItem('selectedSizeIsHidden', String(isHidden));
        sessionStorage.setItem('selectedSizeIsRemoved', String(isRemoved));
        sessionStorage.removeItem('selectedSizeIsNew');
      },
    });
  });
}

async function loadStoresPage() {
  initAppBar({
    mode: 'list',
    titleText: 'Stores',
  });

  const list = document.getElementById('storesList');

  // App bar is injected async; wait before wiring menu/search/add.
  if (typeof waitForAppBarReady === 'function') {
    await waitForAppBarReady();
  }
  initBottomNav();

  const searchInput = document.getElementById('appBarSearchInput');
  const clearBtn = document.getElementById('appBarSearchClear');
  wireAppBarSearch(searchInput, {
    clearBtn,
    onQueryChange: (query) => {
      const selectedStoreId = getSelectedVisibleStoreId();
      searchQuery = String(query || '').toLowerCase();
      rerenderFilteredStores({
        selectedStoreId,
        clearSelectionWhenMissing: true,
      });
    },
  });
  const addBtn = document.getElementById('appBarAddBtn');

  if (!list) return;

  // Keyboard behavior:
  // - Enter is no-op
  // - Cmd+↑/↓ reorders when a row has red selection (hijacks top-level tab shortcut)
  // - Escape clears the current selection
  const listNav = enableTopLevelListKeyboardNav(list, {
    requireExistingSelectionForArrows: true,
    disableArrowNavigation: true,
    disableEnterActivation: true,
    disableHoverSelection: true,
    toggleSelectionOnClick: true,
    clearSelectionOnOutsidePointerDown: true,
    clearSelectionOnOutsideFocus: true,
    clearSelectionOnWindowBlur: true,
    clearSelectionOnEscape: true,
  });

  // --- Load DB (mirror recipe loaders) ---
  const isElectron = !!window.electronAPI;
  let db;

  if (isElectron) {
    try {
      const pathHint = localStorage.getItem('favoriteEatsDbPath') || null;
      const bytes = await window.electronAPI.loadDB(pathHint);
      const Uints = new Uint8Array(bytes);
      db = new SQL.Database(Uints);
    } catch (err) {
      console.error('❌ Failed to load DB from disk:', err);
      uiToast('No database loaded. Please go back to the welcome page.');
      window.location.href = 'index.html';
      return;
    }
  } else {
    const stored = localStorage.getItem('favoriteEatsDb');
    if (!stored) {
      uiToast('No database loaded. Please go back to the welcome page.');
      window.location.href = 'index.html';
      return;
    }
    const Uints = new Uint8Array(JSON.parse(stored));
    db = new SQL.Database(Uints);
  }

  // Expose DB globally for any future helpers
  window.dbInstance = db;
  await ensureIngredientLemmaMaintenanceInMain(db, isElectron);

  // --- Load stores from stores table ---
  const result = db.exec(`
    SELECT ID, chain_name, location_name
    FROM stores
    ORDER BY chain_name COLLATE NOCASE, location_name COLLATE NOCASE;
  `);

  let storeRows = [];
  if (result.length > 0) {
    storeRows = result[0].values.map(([id, chain, location]) => ({
      id: Number(id),
      chain: String(chain || ''),
      location: String(location || ''),
    }));
  }
  const defaultStoreRows = storeRows.slice();
  const orderStoreRowsFromPlan = (rows) => {
    const normalizedRows = Array.isArray(rows) ? rows.slice() : [];
    const persistedOrder = getShoppingPlanStoreOrder();
    if (!persistedOrder.length) return normalizedRows;
    const rowsById = new Map();
    normalizedRows.forEach((row) => {
      const rowId = Number(row?.id);
      if (!Number.isFinite(rowId) || rowId <= 0) return;
      rowsById.set(rowId, row);
    });
    const orderedRows = [];
    persistedOrder.forEach((storeId) => {
      const row = rowsById.get(storeId);
      if (!row) return;
      orderedRows.push(row);
      rowsById.delete(storeId);
    });
    normalizedRows.forEach((row) => {
      const rowId = Number(row?.id);
      if (!rowsById.has(rowId)) return;
      orderedRows.push(row);
      rowsById.delete(rowId);
    });
    return orderedRows;
  };
  const shouldUseStorePlanOrder = !isElectron;
  if (shouldUseStorePlanOrder) {
    storeRows = orderStoreRowsFromPlan(storeRows);
  }
  const getExistingStoreIds = () =>
    new Set(
      storeRows
        .map((row) => Math.trunc(Number(row?.id)))
        .filter((storeId) => Number.isFinite(storeId) && storeId > 0),
    );
  const checkedStoreIds = new Set(
    getShoppingPlanSelectedStoreIds().filter((storeId) =>
      getExistingStoreIds().has(storeId),
    ),
  );
  const getStoreOrderIds = (rows) =>
    (Array.isArray(rows) ? rows : [])
      .map((row) => Math.trunc(Number(row?.id)))
      .filter((storeId) => Number.isFinite(storeId) && storeId > 0);
  const isAtDefaultStoreOrder = () => {
    const currentIds = getStoreOrderIds(storeRows);
    const defaultIds = getStoreOrderIds(defaultStoreRows);
    if (currentIds.length !== defaultIds.length) return false;
    for (let idx = 0; idx < currentIds.length; idx += 1) {
      if (currentIds[idx] !== defaultIds[idx]) return false;
    }
    return true;
  };
  const canResetStoreSelections = () =>
    checkedStoreIds.size > 0 || !isAtDefaultStoreOrder();
  let searchQuery = '';
  const isStoreWebSelectMode = () => isForceWebModeEnabled();
  const syncStoresResetButtonState = () => {
    if (!(addBtn instanceof HTMLButtonElement)) return;
    if (!isStoreWebSelectMode()) {
      addBtn.disabled = false;
      addBtn.setAttribute('aria-disabled', 'false');
      return;
    }
    const canReset = canResetStoreSelections();
    addBtn.disabled = !canReset;
    addBtn.setAttribute('aria-disabled', canReset ? 'false' : 'true');
  };
  const persistCurrentStoreOrder = () =>
    shouldUseStorePlanOrder
      ? setShoppingPlanStoreOrder(
          storeRows
            .map((row) => Math.trunc(Number(row?.id)))
            .filter((storeId) => Number.isFinite(storeId) && storeId > 0),
        )
      : undefined;
  const persistCheckedStoreSelections = () =>
    setShoppingPlanSelectedStoreIds(
      Array.from(checkedStoreIds).filter((storeId) =>
        getExistingStoreIds().has(storeId),
      ),
    );
  const persistStoresDb = async (reasonLabel) => {
    try {
      const binaryArray = db.export();
      if (isElectron) {
        const ok = await window.electronAPI.saveDB(binaryArray);
        if (ok === false) throw new Error('Failed to save DB.');
      } else {
        localStorage.setItem(
          'favoriteEatsDb',
          JSON.stringify(Array.from(binaryArray)),
        );
      }
      return true;
    } catch (err) {
      console.error(`❌ Failed to persist DB after ${reasonLabel}:`, err);
      return false;
    }
  };
  persistCurrentStoreOrder();
  persistCheckedStoreSelections();

  const getFilteredStoreRows = () => {
    const q = searchQuery;
    if (!q) return storeRows;
    return storeRows.filter((store) => {
      const chain = String(store?.chain || '').toLowerCase();
      const location = String(store?.location || '').toLowerCase();
      return chain.includes(q) || location.includes(q);
    });
  };

  const syncStoreRowVisualState = (rowEl, storeId) => {
    if (!(rowEl instanceof HTMLElement)) return;
    const isChecked = checkedStoreIds.has(Number(storeId));
    rowEl.classList.toggle('shopping-row-checked', isStoreWebSelectMode() && isChecked);
    const icon = rowEl.querySelector('.shopping-list-row-icon');
    if (icon) {
      icon.textContent = isChecked ? 'check_box' : 'check_box_outline_blank';
    }
  };

  const swapStoreRowsById = (sourceId, targetId) => {
    const sourceIdx = storeRows.findIndex((row) => Number(row?.id) === Number(sourceId));
    const targetIdx = storeRows.findIndex((row) => Number(row?.id) === Number(targetId));
    if (sourceIdx < 0 || targetIdx < 0 || sourceIdx === targetIdx) return false;
    const nextRows = storeRows.slice();
    [nextRows[sourceIdx], nextRows[targetIdx]] = [nextRows[targetIdx], nextRows[sourceIdx]];
    storeRows = nextRows;
    persistCurrentStoreOrder();
    return true;
  };

  function renderStoresList(rows, options = {}) {
    list.innerHTML = '';
    const items = Array.isArray(rows) ? rows : [];
    if (!items.length) {
      renderTopLevelEmptyState(list, 'No stores yet. Add a store.');
      listNav?.syncAfterRender?.();
      return;
    }

    items.forEach((store) => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'shopping-list-row-label';

      // Display exactly as stored (no forced capitalization)
      const chain = store.chain || '';
      const location = store.location || '';
      const storeLabel = location ? `${chain} (${location})` : chain || '';
      label.textContent = storeLabel;
      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined shopping-list-row-icon';
      icon.setAttribute('aria-hidden', 'true');
      li.appendChild(label);
      li.appendChild(icon);
      syncStoreRowVisualState(li, store.id);

      const deleteStoreDeep = async (storeId, label) => {
        const ok = await uiConfirm({
          title: 'Delete store',
          message: `Delete '${label}'?`,
          confirmText: 'Delete',
          cancelText: 'Cancel',
          danger: true,
        });
        if (!ok) return false;

        try {
          // Delete dependent store_locations and join rows first.
          const locQ = db.exec(
            'SELECT ID FROM store_locations WHERE store_id = ?;',
            [storeId],
          );
          const locIds = locQ.length
            ? locQ[0].values.map(([id]) => Number(id)).filter(Number.isFinite)
            : [];

          locIds.forEach((lid) => {
            try {
              db.run(
                'DELETE FROM ingredient_store_location WHERE store_location_id = ?;',
                [lid],
              );
            } catch (_) {}
            try {
              db.run(
                'DELETE FROM ingredient_variant_store_location WHERE store_location_id = ?;',
                [lid],
              );
            } catch (_) {}
          });

          db.run('DELETE FROM store_locations WHERE store_id = ?;', [storeId]);
          db.run('DELETE FROM stores WHERE ID = ?;', [storeId]);
        } catch (err) {
          console.error('❌ Failed to delete store:', err);
          uiToast('Failed to delete store. See console for details.');
          return false;
        }

        const persisted = await persistStoresDb('deleting store');
        if (!persisted) {
          uiToast('Failed to save database after deleting store.');
          return false;
        }

        storeRows = storeRows.filter((row) => Number(row?.id) !== Number(storeId));
        checkedStoreIds.delete(Number(storeId));
        persistCurrentStoreOrder();
        persistCheckedStoreSelections();

        return true;
      };

      icon.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isStoreWebSelectMode()) return;
        const storeId = Number(store.id);
        if (checkedStoreIds.has(storeId)) checkedStoreIds.delete(storeId);
        else checkedStoreIds.add(storeId);
        persistCheckedStoreSelections();
        syncStoreRowVisualState(li, storeId);
      });

      li.addEventListener('click', (event) => {
        const wantsDelete = event.ctrlKey || event.metaKey;
        const webSelectMode = isStoreWebSelectMode();
        if (wantsDelete && !webSelectMode) {
          event.preventDefault();
          event.stopPropagation();
          const label = storeLabel || 'Store';
          void (async () => {
            const ok = await deleteStoreDeep(Number(store.id), label);
            if (ok) window.location.reload();
          })();
          return;
        }

        if (webSelectMode) {
          return;
        }

        // Open editor
        sessionStorage.setItem('selectedStoreId', String(store.id));
        sessionStorage.setItem('selectedStoreChain', store.chain || '');
        sessionStorage.setItem('selectedStoreLocation', store.location || '');
        sessionStorage.removeItem('selectedStoreIsNew');
        window.location.href = 'storeEditor.html';
      });

      li.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        if (isStoreWebSelectMode()) {
          return;
        }
        const label = storeLabel || 'Store';
        void (async () => {
          const ok = await deleteStoreDeep(Number(store.id), label);
          if (ok) window.location.reload();
        })();
      });

      list.appendChild(li);
    });

    // Keep selection valid after rerender (search/filter changes).
    const selectedStoreId = Number(options?.selectedStoreId);
    if (
      Number.isFinite(selectedStoreId) &&
      selectedStoreId > 0 &&
      typeof listNav?.setSelectedIdx === 'function'
    ) {
      const nextSelectedIdx = items.findIndex(
        (store) => Number(store?.id) === selectedStoreId,
      );
      if (nextSelectedIdx >= 0) {
        listNav.setSelectedIdx(nextSelectedIdx);
        return;
      }
      if (options?.clearSelectionWhenMissing) {
        listNav.setSelectedIdx(-1, { source: null });
        return;
      }
    }
    listNav?.syncAfterRender?.();
  }

  const getSelectedVisibleStoreId = () => {
    const selectedIdx = Number(listNav?.getSelectedIdx?.() ?? -1);
    const visibleRows = getFilteredStoreRows();
    if (!Number.isFinite(selectedIdx) || selectedIdx < 0 || selectedIdx >= visibleRows.length) {
      return null;
    }
    const storeId = Number(visibleRows[selectedIdx]?.id);
    return Number.isFinite(storeId) && storeId > 0 ? storeId : null;
  };

  const rerenderFilteredStores = (options = {}) => {
    const nextOptions = { ...options };
    const requestedStoreId = Number(nextOptions?.selectedStoreId);
    const shouldPreserveById =
      !!nextOptions?.preserveSelectionById &&
      (!Number.isFinite(requestedStoreId) || requestedStoreId <= 0);
    if (shouldPreserveById) {
      const selectedStoreId = getSelectedVisibleStoreId();
      if (selectedStoreId) nextOptions.selectedStoreId = selectedStoreId;
    }
    renderStoresList(getFilteredStoreRows(), nextOptions);
    syncStoresResetButtonState();
  };

  let isOpeningStoreDialog = false;
  const normalizeStoreField = (value) =>
    String(value || '')
      .trim()
      .replace(/\s+/g, ' ');
  const openCreateStoreDialog = async () => {
    if (isOpeningStoreDialog) return;
    if (!window.ui) {
      uiToast('UI not ready yet.');
      return;
    }
    isOpeningStoreDialog = true;
    if (addBtn instanceof HTMLButtonElement) {
      addBtn.disabled = true;
      addBtn.setAttribute('aria-disabled', 'true');
    }
    try {
      const vals = await window.ui.form({
        title: 'New store',
        fields: [
          {
            key: 'chain',
            label: 'Name',
            value: '',
            required: true,
            normalize: normalizeStoreField,
          },
          {
            key: 'location',
            label: 'Location (optional)',
            value: '',
            required: false,
            normalize: normalizeStoreField,
          },
        ],
        confirmText: 'Create',
        cancelText: 'Cancel',
        validate: (value) => {
          if (!normalizeStoreField(value?.chain)) return 'Chain is required.';
          return '';
        },
      });
      if (!vals) return;

      const chain = normalizeStoreField(vals.chain);
      const location = normalizeStoreField(vals.location);
      if (!chain) return;

      let newStoreId = null;
      try {
        db.run('INSERT INTO stores (chain_name, location_name) VALUES (?, ?);', [
          chain,
          location,
        ]);
        const idQ = db.exec('SELECT last_insert_rowid();');
        newStoreId =
          idQ.length && idQ[0].values.length ? Number(idQ[0].values[0][0]) : null;
        if (!Number.isFinite(newStoreId) || newStoreId <= 0) {
          uiToast('Failed to create store. See console for details.');
          return;
        }
        const persisted = await persistStoresDb('creating store');
        if (!persisted) {
          try {
            db.run('DELETE FROM stores WHERE ID = ?;', [newStoreId]);
          } catch (_) {}
          uiToast('Failed to save database after creating store.');
          return;
        }
      } catch (err) {
        console.error('❌ Failed to create store:', err);
        uiToast('Failed to create store. See console for details.');
        return;
      }

      sessionStorage.setItem('selectedStoreId', String(newStoreId));
      sessionStorage.removeItem('selectedStoreIsNew');
      sessionStorage.setItem('selectedStoreChain', chain);
      sessionStorage.setItem('selectedStoreLocation', location);
      window.location.href = 'storeEditor.html';
    } finally {
      isOpeningStoreDialog = false;
      syncStoresResetButtonState();
    }
  };

  const moveSelectedStoreRow = (delta) => {
    if (!shouldUseStorePlanOrder) return false;
    const items = getFilteredStoreRows();
    const selectedIdx = Number(listNav?.getSelectedIdx?.() ?? -1);
    if (!Number.isFinite(selectedIdx) || selectedIdx < 0 || selectedIdx >= items.length) {
      return false;
    }
    const targetIdx = selectedIdx + Number(delta || 0);
    if (targetIdx < 0 || targetIdx >= items.length) return false;
    const selectedStore = items[selectedIdx];
    const targetStore = items[targetIdx];
    if (!selectedStore || !targetStore) return false;
    return swapStoreRowsById(selectedStore.id, targetStore.id);
  };

  // Initial render
  rerenderFilteredStores();

  consumeCmdVerticalArrowBeforeTopLevelNav = (e) => {
    if (!(e instanceof KeyboardEvent)) return false;
    if (!e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return false;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return false;
    if (e.isComposing) return false;
    if (isTypingContext(e.target) && !isAppBarSearchContext(e.target)) return false;
    if (isModalOpen()) return false;
    if (document.activeElement?.closest?.('.bottom-nav')) return false;

    const selectedIdx = Number(listNav?.getSelectedIdx?.() ?? -1);
    if (!Number.isFinite(selectedIdx) || selectedIdx < 0) return false;

    const visibleRows = getFilteredStoreRows();
    const selectedStore = visibleRows[selectedIdx];
    if (!selectedStore) return false;

    e.preventDefault();
    e.stopPropagation();
    const moved = moveSelectedStoreRow(e.key === 'ArrowDown' ? 1 : -1);
    if (moved) rerenderFilteredStores({ selectedStoreId: selectedStore.id });
    return true;
  };

  if (addBtn) {
    if (isStoreWebSelectMode()) {
      addBtn.textContent = 'Reset';
      addBtn.addEventListener('click', () => {
        if (!canResetStoreSelections()) return;
        storeRows = defaultStoreRows.slice();
        checkedStoreIds.clear();
        setShoppingPlanStoreOrder([]);
        setShoppingPlanSelectedStoreIds([]);
        listNav?.setSelectedIdx?.(-1, { source: null });
        rerenderFilteredStores({ clearSelectionWhenMissing: true });
      });
    } else {
      addBtn.textContent = 'Add';
      addBtn.addEventListener('click', () => {
        void openCreateStoreDialog();
      });
    }
    syncStoresResetButtonState();
  }
}

function loadStoreEditorPage() {
  const view = document.getElementById('pageContent');

  if (!view) {
    console.warn('No #pageContent found; skipping store-editor wiring.');
    return;
  }

  void (async () => {
    const isNew = sessionStorage.getItem('selectedStoreIsNew') === '1';
    const idStr = sessionStorage.getItem('selectedStoreId');
    const storeId = Number(idStr);
    const hasPersistedStore = Number.isFinite(storeId) && storeId > 0;

    let chain = sessionStorage.getItem('selectedStoreChain') || '';
    let locationName = sessionStorage.getItem('selectedStoreLocation') || '';
    /** @type {{ id: number, name: string }[]} */
    let aisleRows = [];
    /** @type {Map<number, string[]>} */
    let aisleItemsByAisle = new Map();
    /** @type {Map<number, Array<any>>} */
    let aisleItemSpecsByAisle = new Map();
    /** @type {Set<number>} */
    let deletedAisleIds = new Set();
    let nextTempAisleId = -1;
    let draftSnapshot = null;
    let refreshDirty = () => {};
    let ingredientCatalog = { byName: new Map(), hasVariantAisleTable: false };
    let activeVariantPicker = null;

    const normItemKey = (s) => String(s || '').trim().toLowerCase();

    const parseUniqueItemLines = (raw) => {
      const seen = new Set();
      const out = [];
      for (const line of String(raw || '').split('\n')) {
        const t = line.trim();
        if (!t) continue;
        const k = normItemKey(t);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(t);
      }
      return out;
    };

    const normVariantKey = (s) => String(s || '').trim().toLowerCase();
    const splitLineIntoBaseAndParen = (line) => {
      const t = String(line || '').trim();
      if (!t) return null;
      const m = t.match(/^(.*?)\s*\((.*)\)\s*$/);
      if (!m) return { baseName: t, inside: '', hasParen: false };
      return {
        baseName: String(m[1] || '').trim(),
        inside: String(m[2] || ''),
        hasParen: true,
      };
    };
    const splitLineIntoBaseAndParenLoose = (line) => {
      const strict = splitLineIntoBaseAndParen(line);
      if (strict && strict.hasParen) return strict;
      const t = String(line || '').trim();
      if (!t) return null;
      const openIdx = t.indexOf('(');
      if (openIdx < 0) return strict;
      const baseName = String(t.slice(0, openIdx) || '').trim();
      if (!baseName) return strict;
      let inside = String(t.slice(openIdx + 1) || '').trim();
      if (inside.endsWith(')')) inside = inside.slice(0, -1).trim();
      return { baseName, inside, hasParen: true };
    };
    const isSupportedVariantName = (s) => {
      const t = String(s || '').trim();
      if (!t) return false;
      if (/[()]/.test(t)) return false;
      return /[a-z0-9]/i.test(t);
    };
    const parseVariantNames = (insideRaw) => {
      const inside = String(insideRaw || '').trim();
      if (!inside) return [];
      const out = [];
      const seen = new Set();
      const tokens = inside.split(',').map((s) => String(s || '').trim());
      for (const tok of tokens) {
        if (!isSupportedVariantName(tok)) continue;
        const k = normVariantKey(tok);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(tok);
      }
      return out;
    };
    const collapseVariantSummary = (baseName, selectedNames) => {
      const base = String(baseName || '').trim();
      const names = Array.isArray(selectedNames)
        ? selectedNames.map((v) => String(v || '').trim()).filter(Boolean)
        : [];
      if (!names.length) return base;
      const maxInsideChars = 45;
      const ellipsize = (s, max) => {
        const t = String(s || '');
        if (t.length <= max) return t;
        if (max <= 1) return '…';
        return `${t.slice(0, max - 1)}…`;
      };
      const fullInside = names.join(', ');
      if (fullInside.length <= maxInsideChars) return `${base} (${fullInside})`;

      const parts = [];
      for (let i = 0; i < names.length; i++) {
        const remaining = names.length - (i + 1);
        const suffix =
          remaining > 0
            ? `, + ${remaining} other${remaining === 1 ? '' : 's'}`
            : '';
        const candidateParts = [...parts, names[i]];
        const candidateInside = `${candidateParts.join(', ')}${suffix}`;
        if (candidateInside.length <= maxInsideChars) {
          parts.push(names[i]);
          continue;
        }
        if (!parts.length) {
          // Ensure at least one variant token is visible before the suffix.
          const roomForFirst = Math.max(1, maxInsideChars - suffix.length);
          parts.push(ellipsize(names[i], roomForFirst));
        }
        break;
      }
      const remaining = Math.max(0, names.length - parts.length);
      const suffix =
        remaining > 0
          ? `, + ${remaining} other${remaining === 1 ? '' : 's'}`
          : '';
      const inside = `${parts.join(', ')}${suffix}`;
      return `${base} (${inside})`;
    };
    const cloneSpecs = (specs) =>
      (Array.isArray(specs) ? specs : []).map((s) => ({
        baseName: s.baseName || '',
        baseKey: s.baseKey || '',
        ingredientId: Number.isFinite(Number(s.ingredientId))
          ? Number(s.ingredientId)
          : null,
        selectedVariants: Array.isArray(s.selectedVariants)
          ? [...s.selectedVariants]
          : [],
        knownVariants: Array.isArray(s.knownVariants)
          ? s.knownVariants.map((v) => ({
              id: Number.isFinite(Number(v?.id)) ? Number(v.id) : null,
              name: String(v?.name || ''),
            }))
          : [],
      }));
    const specsToDisplayLines = (specs, opts = {}) => {
      const pickerKey = String(opts.pickerBaseKey || '').trim().toLowerCase();
      const expandAll = opts.expandAll === true;
      return (Array.isArray(specs) ? specs : []).map((spec) => {
        if (pickerKey && spec.baseKey === pickerKey) return spec.baseName || '';
        if (expandAll) {
          const base = String(spec.baseName || '').trim();
          const variants = Array.isArray(spec.selectedVariants)
            ? spec.selectedVariants.map((v) => String(v || '').trim()).filter(Boolean)
            : [];
          return variants.length ? `${base} (${variants.join(', ')})` : base;
        }
        return collapseVariantSummary(spec.baseName || '', spec.selectedVariants);
      });
    };
    const syncDisplayLinesFromSpecs = (aid, opts = {}) => {
      const specs = Array.isArray(aisleItemSpecsByAisle.get(aid))
        ? aisleItemSpecsByAisle.get(aid)
        : [];
      aisleItemsByAisle.set(aid, specsToDisplayLines(specs, opts));
    };
    const setAisleTextareaRawDraft = (textarea, value) => {
      if (!(textarea instanceof HTMLTextAreaElement)) return;
      textarea.__feStoreRawDraftValue = String(value == null ? '' : value);
    };
    const getAisleTextareaRawDraft = (textarea) => {
      if (!(textarea instanceof HTMLTextAreaElement)) return '';
      if (typeof textarea.__feStoreRawDraftValue === 'string') {
        return textarea.__feStoreRawDraftValue;
      }
      return String(textarea.value || '');
    };
    const parseSpecsFromRaw = (raw, prevSpecs, catalog) => {
      const prevByKey = new Map();
      (Array.isArray(prevSpecs) ? prevSpecs : []).forEach((s) => {
        if (s?.baseKey) prevByKey.set(s.baseKey, s);
      });
      const out = [];
      const seenBase = new Set();
      for (const line of String(raw || '').split('\n')) {
        const parsed = splitLineIntoBaseAndParenLoose(line);
        if (!parsed) continue;
        const baseName = String(parsed.baseName || '').trim();
        if (!baseName) continue;
        const baseKey = normItemKey(baseName);
        if (!baseKey || seenBase.has(baseKey)) continue;
        seenBase.add(baseKey);
        const known = catalog?.byName?.get?.(baseKey) || null;
        const prev = prevByKey.get(baseKey) || null;
        let selected = [];
        const inside = String(parsed.inside || '');
        const looksCollapsed = /\+\s*\d+\s+others?/i.test(inside);
        if (parsed.hasParen) {
          if (looksCollapsed && prev && Array.isArray(prev.selectedVariants)) {
            selected = [...prev.selectedVariants];
          } else {
            selected = parseVariantNames(inside);
          }
        }
        if (known && Array.isArray(known.variants)) {
          // Keep DB order first, then append any valid ad-hoc variants the user typed.
          const dbOrdered = known.variants.map((v) => String(v?.name || '').trim());
          const dbKeys = new Set(dbOrdered.map((v) => normVariantKey(v)));
          const selectedBeforeNormalize = [...selected];
          const extras = selected.filter((v) => !dbKeys.has(normVariantKey(v)));
          selected = [];
          const wanted = new Set(
            selectedBeforeNormalize.map((v) => normVariantKey(v)),
          );
          dbOrdered.forEach((name) => {
            if (wanted.has(normVariantKey(name))) selected.push(name);
          });
          extras.forEach((name) => {
            if (!selected.some((v) => normVariantKey(v) === normVariantKey(name))) {
              selected.push(name);
            }
          });
        } else {
          selected = selected.filter(isSupportedVariantName);
        }
        out.push({
          baseName,
          baseKey,
          ingredientId:
            known && Number.isFinite(Number(known.ingredientId))
              ? Number(known.ingredientId)
              : null,
          selectedVariants: selected,
          knownVariants:
            known && Array.isArray(known.variants)
              ? known.variants.map((v) => ({ id: Number(v.id), name: v.name }))
              : [],
        });
      }
      return out;
    };
    const normalizeSpecsWithCatalog = (specs, catalog) => {
      const out = [];
      const seenBase = new Set();
      for (const spec of Array.isArray(specs) ? specs : []) {
        const baseName = String(spec?.baseName || '').trim();
        if (!baseName) continue;
        const baseKey = normItemKey(baseName);
        if (!baseKey || seenBase.has(baseKey)) continue;
        seenBase.add(baseKey);
        const known = catalog?.byName?.get?.(baseKey) || null;
        let selected = Array.isArray(spec?.selectedVariants)
          ? spec.selectedVariants.map((v) => String(v || '').trim()).filter(isSupportedVariantName)
          : [];
        if (known && Array.isArray(known.variants)) {
          const dbOrdered = known.variants.map((v) => String(v?.name || '').trim());
          const dbKeys = new Set(dbOrdered.map((v) => normVariantKey(v)));
          const selectedBeforeNormalize = [...selected];
          const extras = selected.filter((v) => !dbKeys.has(normVariantKey(v)));
          selected = [];
          const wanted = new Set(
            selectedBeforeNormalize.map((v) => normVariantKey(v)),
          );
          dbOrdered.forEach((name) => {
            if (wanted.has(normVariantKey(name))) selected.push(name);
          });
          extras.forEach((name) => {
            if (!selected.some((v) => normVariantKey(v) === normVariantKey(name))) {
              selected.push(name);
            }
          });
        }
        out.push({
          baseName,
          baseKey,
          ingredientId:
            known && Number.isFinite(Number(known.ingredientId))
              ? Number(known.ingredientId)
              : Number.isFinite(Number(spec?.ingredientId))
                ? Number(spec.ingredientId)
                : null,
          selectedVariants: selected,
          knownVariants:
            known && Array.isArray(known.variants)
              ? known.variants.map((v) => ({ id: Number(v.id), name: v.name }))
              : Array.isArray(spec?.knownVariants)
                ? spec.knownVariants.map((v) => ({
                    id: Number.isFinite(Number(v?.id)) ? Number(v.id) : null,
                    name: String(v?.name || ''),
                  }))
                : [],
        });
      }
      return out;
    };

    const cloneDraftSnapshot = () => ({
      aisleRows: aisleRows.map((r) => ({ id: r.id, name: r.name })),
      items: Object.fromEntries(
        [...aisleItemsByAisle.entries()].map(([k, v]) => [String(k), [...v]]),
      ),
      specs: Object.fromEntries(
        [...aisleItemSpecsByAisle.entries()].map(([k, v]) => [String(k), cloneSpecs(v)]),
      ),
      deletedIds: [...deletedAisleIds],
    });
    const restoreDraftFromSnapshot = (snap) => {
      if (!snap) return;
      aisleRows = snap.aisleRows.map((r) => ({ id: r.id, name: r.name }));
      aisleItemsByAisle = new Map();
      for (const [ks, v] of Object.entries(snap.items || {})) {
        const n = Number(ks);
        aisleItemsByAisle.set(Number.isFinite(n) ? n : ks, [...v]);
      }
      aisleItemSpecsByAisle = new Map();
      for (const [ks, v] of Object.entries(snap.specs || {})) {
        const n = Number(ks);
        aisleItemSpecsByAisle.set(Number.isFinite(n) ? n : ks, cloneSpecs(v));
      }
      deletedAisleIds = new Set(snap.deletedIds || []);
    };
    const itemsListEqual = (a, b) => {
      const pa = parseUniqueItemLines((a || []).join('\n'));
      const pb = parseUniqueItemLines((b || []).join('\n'));
      if (pa.length !== pb.length) return false;
      for (let i = 0; i < pa.length; i++) {
        if (normItemKey(pa[i]) !== normItemKey(pb[i])) return false;
      }
      return true;
    };
    const specsEqual = (a, b) => {
      const aa = Array.isArray(a) ? a : [];
      const bb = Array.isArray(b) ? b : [];
      if (aa.length !== bb.length) return false;
      for (let i = 0; i < aa.length; i++) {
        const sa = aa[i] || {};
        const sb = bb[i] || {};
        if (normItemKey(sa.baseName) !== normItemKey(sb.baseName)) return false;
        if ((sa.selectedVariants || []).length !== (sb.selectedVariants || []).length)
          return false;
        for (let j = 0; j < (sa.selectedVariants || []).length; j++) {
          if (
            normVariantKey(sa.selectedVariants[j]) !==
            normVariantKey((sb.selectedVariants || [])[j])
          )
            return false;
        }
      }
      return true;
    };
    const aislesDraftDirty = () => {
      if (!draftSnapshot) return false;
      const sd = draftSnapshot.deletedIds || [];
      if (deletedAisleIds.size !== sd.length) return true;
      for (const id of deletedAisleIds) if (!sd.includes(id)) return true;
      for (const id of sd) if (!deletedAisleIds.has(id)) return true;
      if (aisleRows.length !== draftSnapshot.aisleRows.length) return true;
      for (let i = 0; i < aisleRows.length; i++) {
        if (aisleRows[i]?.id !== draftSnapshot.aisleRows[i]?.id) return true;
      }
      const snapRows = new Map(draftSnapshot.aisleRows.map((r) => [r.id, r]));
      for (const r of aisleRows) {
        const s = snapRows.get(r.id);
        if (!s) return true;
        if ((r.name || '') !== (s.name || '')) return true;
        const cur = aisleItemsByAisle.get(r.id) || [];
        const snapItems = draftSnapshot.items[String(r.id)] || [];
        if (!itemsListEqual(cur, snapItems)) return true;
        const curSpecs = aisleItemSpecsByAisle.get(r.id) || [];
        const snapSpecs = draftSnapshot.specs?.[String(r.id)] || [];
        if (!specsEqual(curSpecs, snapSpecs)) return true;
      }
      for (const id of snapRows.keys()) {
        if (!aisleRows.some((row) => row.id === id)) return true;
      }
      return false;
    };

    const openStoreEditorDb = async () => {
      const isElectron = !!window.electronAPI;
      let db;
      if (isElectron) {
        const pathHint = localStorage.getItem('favoriteEatsDbPath') || null;
        const bytes = await window.electronAPI.loadDB(pathHint);
        db = new SQL.Database(new Uint8Array(bytes));
      } else {
        const stored = localStorage.getItem('favoriteEatsDb');
        if (!stored)
          throw new Error('No DB in localStorage for store editor.');
        db = new SQL.Database(new Uint8Array(JSON.parse(stored)));
      }
      window.dbInstance = db;
      await ensureIngredientLemmaMaintenanceInMain(db, isElectron);
      return db;
    };

    const persistStoreEditorDb = async (db) => {
      const binaryArray = db.export();
      if (window.electronAPI) {
        const ok = await window.electronAPI.saveDB(binaryArray);
        if (ok === false) throw new Error('Failed to save DB for store editor.');
      } else {
        localStorage.setItem(
          'favoriteEatsDb',
          JSON.stringify(Array.from(binaryArray)),
        );
      }
    };

    const tableExistsLocal = (db, name) => {
      try {
        const q = db.exec(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
          [name],
        );
        return !!(q.length && q[0].values && q[0].values.length);
      } catch (_) {
        return false;
      }
    };

    const loadIngredientCatalog = (db) => {
      const byName = new Map();
      const byId = new Map();
      const hasVariantTable = tableExistsLocal(db, 'ingredient_variants');
      const hasVariantAisleTable = tableExistsLocal(
        db,
        'ingredient_variant_store_location',
      );
      try {
        const q = db.exec(
          `SELECT ID, name
             FROM ingredients
            WHERE name IS NOT NULL
              AND trim(name) != ''
              AND COALESCE(is_deprecated, 0) = 0
              AND COALESCE(hide_from_shopping_list, 0) = 0
            ORDER BY name COLLATE NOCASE, ID ASC;`,
        );
        const rows = q.length ? q[0].values : [];
        rows.forEach(([id, name]) => {
          const clean = String(name || '').trim();
          const key = normItemKey(clean);
          if (!key || byName.has(key)) return;
          const rec = {
            ingredientId: Number(id),
            name: clean,
            variants: [],
          };
          byName.set(key, rec);
          byId.set(Number(id), rec);
        });
      } catch (_) {}
      if (hasVariantTable) {
        try {
          const vq = db.exec(
            `SELECT ingredient_id, id, variant
               FROM ingredient_variants
              WHERE variant IS NOT NULL
                AND trim(variant) != ''
              ORDER BY ingredient_id ASC, COALESCE(sort_order, 999999) ASC, id ASC;`,
          );
          const rows = vq.length ? vq[0].values : [];
          rows.forEach(([ingredientId, variantId, variant]) => {
            const vv = String(variant || '').trim();
            if (!isSupportedVariantName(vv)) return;
            const item = byId.get(Number(ingredientId));
            if (!item) return;
            if (
              item.variants.some((v) => normVariantKey(v.name) === normVariantKey(vv))
            )
              return;
            item.variants.push({ id: Number(variantId), name: vv });
          });
        } catch (_) {}
      }
      return { byName, hasVariantAisleTable };
    };

    if (hasPersistedStore) {
      try {
        const db = await openStoreEditorDb();
        const sr = db.exec(
          'SELECT chain_name, location_name FROM stores WHERE ID = ?;',
          [storeId],
        );
        if (sr.length && sr[0].values.length) {
          const row = sr[0].values[0];
          if (row[0] != null) chain = String(row[0]);
          if (row[1] != null) locationName = String(row[1]);
        }
        const ar = db.exec(
          'SELECT ID, name FROM store_locations WHERE store_id = ? ORDER BY COALESCE(sort_order, 999999), ID;',
          [storeId],
        );
        if (ar.length && ar[0].values.length) {
          aisleRows = ar[0].values.map(([id, name]) => ({
            id: Number(id),
            name: String(name || ''),
          }));
        }
        ingredientCatalog = loadIngredientCatalog(db);
        aisleRows.forEach((r) => {
          aisleItemsByAisle.set(r.id, []);
          aisleItemSpecsByAisle.set(r.id, []);
        });
        if (aisleRows.length) {
          const ids = aisleRows.map((r) => r.id);
          const ph = ids.map(() => '?').join(',');
          const baseStmt = db.prepare(`
            SELECT isl.store_location_id, i.ID, i.name
            FROM ingredient_store_location isl
            JOIN ingredients i ON i.ID = isl.ingredient_id
            WHERE isl.store_location_id IN (${ph})
              AND COALESCE(i.is_deprecated, 0) = 0
              AND COALESCE(i.hide_from_shopping_list, 0) = 0
            ORDER BY isl.ID ASC
          `);
          baseStmt.bind(ids);
          while (baseStmt.step()) {
            const row = baseStmt.get();
            const aid = Number(row[0]);
            const ingredientId = Number(row[1]);
            const name = String(row[2] || '').trim();
            const specs = aisleItemSpecsByAisle.get(aid);
            if (!Array.isArray(specs) || !name) continue;
            const key = normItemKey(name);
            if (specs.some((s) => s.baseKey === key)) continue;
            const known = ingredientCatalog.byName.get(key) || null;
            specs.push({
              baseName: name,
              baseKey: key,
              ingredientId: Number.isFinite(ingredientId) ? ingredientId : null,
              selectedVariants: [],
              knownVariants:
                known && Array.isArray(known.variants)
                  ? known.variants.map((v) => ({ id: Number(v.id), name: v.name }))
                  : [],
            });
          }
          baseStmt.free();
          if (ingredientCatalog.hasVariantAisleTable) {
            const variantStmt = db.prepare(`
              SELECT ivsl.store_location_id, i.ID, i.name, v.id, v.variant
              FROM ingredient_variant_store_location ivsl
              JOIN ingredient_variants v ON v.id = ivsl.ingredient_variant_id
              JOIN ingredients i ON i.ID = v.ingredient_id
              WHERE ivsl.store_location_id IN (${ph})
                AND COALESCE(i.is_deprecated, 0) = 0
                AND COALESCE(i.hide_from_shopping_list, 0) = 0
              ORDER BY ivsl.id ASC, COALESCE(v.sort_order, 999999) ASC, v.id ASC
            `);
            variantStmt.bind(ids);
            while (variantStmt.step()) {
              const row = variantStmt.get();
              const aid = Number(row[0]);
              const ingredientId = Number(row[1]);
              const name = String(row[2] || '').trim();
              const variantName = String(row[4] || '').trim();
              if (!name || !isSupportedVariantName(variantName)) continue;
              const specs = aisleItemSpecsByAisle.get(aid);
              if (!Array.isArray(specs)) continue;
              const key = normItemKey(name);
              let spec = specs.find((s) => s.baseKey === key);
              if (!spec) {
                const known = ingredientCatalog.byName.get(key) || null;
                spec = {
                  baseName: name,
                  baseKey: key,
                  ingredientId: Number.isFinite(ingredientId) ? ingredientId : null,
                  selectedVariants: [],
                  knownVariants:
                    known && Array.isArray(known.variants)
                      ? known.variants.map((v) => ({ id: Number(v.id), name: v.name }))
                      : [],
                };
                specs.push(spec);
              }
              if (
                !spec.selectedVariants.some(
                  (v) => normVariantKey(v) === normVariantKey(variantName),
                )
              ) {
                spec.selectedVariants.push(variantName);
              }
            }
            variantStmt.free();
          }
          aisleRows.forEach((r) => syncDisplayLinesFromSpecs(r.id));
        }
      } catch (err) {
        console.warn('Store editor: failed to load store/aisles', err);
      }
    }

    if (hasPersistedStore) draftSnapshot = cloneDraftSnapshot();

    const titleText = chain ? chain : isNew ? 'New store' : 'Store';
    const locTrim = (locationName || '').trim();
    const storeLocationBlock = locTrim
      ? `<div id="storeLocationSubtitle" class="unit-abbreviation-line"></div>`
      : `<div id="storeLocationSubtitle" class="unit-abbreviation-line" style="display:none" aria-hidden="true"></div>`;

    initAppBar({ mode: 'editor', titleText, showSearch: hasPersistedStore });

    const aislesBlock = hasPersistedStore
      ? `
    <h2
      id="storeAislesSectionLabel"
      class="section-header store-aisles-section-label"
    >
      Aisles
    </h2>
    <div id="storeAislesList" class="store-aisles-list" aria-label="Store aisles"></div>
    <div id="storeAddAisleCtaEmpty" class="store-add-aisle-cta" role="button" tabindex="0">
      <span class="placeholder-prompt">Add an aisle</span>
    </div>`
      : '';

    view.innerHTML = `
    <h1 id="childEditorTitle" class="recipe-title">${titleText || ''}</h1>
    ${storeLocationBlock}
    ${aislesBlock}
  `;

    const STORE_AISLE_SLOT_CLASS = 'store-aisle-slot';
    const STORE_AISLE_HINT_ACTIVE_CLASS = 'store-aisle-slot--hint-active';
    const STORE_MASTER_LINK_MODE_CLASS = 'store-master-link-mode';

    let hoverModifierActive = false;
    const desktopHoverEnabled = (() => {
      try {
        return Boolean(
          window.matchMedia &&
            window.matchMedia('(hover: hover) and (pointer: fine)').matches,
        );
      } catch (_) {
        return false;
      }
    })();

    const syncStoreMasterLinkModeClass = () => {
      try {
        document.body.classList.toggle(
          STORE_MASTER_LINK_MODE_CLASS,
          hoverModifierActive,
        );
      } catch (_) {}
    };

    const syncActiveAisleHintClass = (targetSlot = null) => {
      try {
        const list = document.getElementById('storeAislesList');
        if (!list) return;
        list
          .querySelectorAll(`.${STORE_AISLE_HINT_ACTIVE_CLASS}`)
          .forEach((el) => el.classList.remove(STORE_AISLE_HINT_ACTIVE_CLASS));
        if (
          targetSlot &&
          targetSlot.classList &&
          targetSlot.classList.contains(STORE_AISLE_SLOT_CLASS)
        ) {
          targetSlot.classList.add(STORE_AISLE_HINT_ACTIVE_CLASS);
        }
      } catch (_) {}
    };

    const getTextareaLineBoundsAtCaret = (textarea, caretPos) => {
      const value = String(textarea && textarea.value ? textarea.value : '');
      const pos =
        caretPos != null && Number.isFinite(caretPos)
          ? Number(caretPos)
          : Number(textarea && textarea.selectionStart != null ? textarea.selectionStart : 0);
      const prevNl = value.lastIndexOf('\n', Math.max(0, pos - 1));
      const lineStart = prevNl === -1 ? 0 : prevNl + 1;
      const nextNl = value.indexOf('\n', pos);
      const lineEnd = nextNl === -1 ? value.length : nextNl;
      return { lineStart, lineEnd };
    };

    const getTextareaLineTextAtCaret = (textarea) => {
      if (!(textarea instanceof HTMLTextAreaElement)) return '';
      const caretPos = Number(textarea.selectionStart ?? 0);
      const { lineStart, lineEnd } = getTextareaLineBoundsAtCaret(textarea, caretPos);
      return String(textarea.value || '').slice(lineStart, lineEnd);
    };

    const getShoppingMatchByName = (rawName) => {
      const name = String(rawName || '').trim();
      const db = window.dbInstance;
      if (!name || !db) return null;

      try {
        const directQ = db.exec(
          `SELECT ID, name
           FROM ingredients
           WHERE lower(trim(name)) = lower(trim(?))
           ORDER BY ID
           LIMIT 1;`,
          [name],
        );
        if (directQ.length && directQ[0].values.length) {
          const [id, matchedName] = directQ[0].values[0];
          const normalizedId = Number(id);
          if (Number.isFinite(normalizedId) && normalizedId > 0) {
            return {
              id: normalizedId,
              name: matchedName == null ? name : String(matchedName),
            };
          }
        }
      } catch (_) {}

      try {
        const synonymQ = db.exec(
          `SELECT i.ID, i.name
           FROM ingredient_synonyms s
           JOIN ingredients i ON i.ID = s.ingredient_id
           WHERE lower(trim(s.synonym)) = lower(trim(?))
           ORDER BY i.ID
           LIMIT 1;`,
          [name],
        );
        if (synonymQ.length && synonymQ[0].values.length) {
          const [id, matchedName] = synonymQ[0].values[0];
          const normalizedId = Number(id);
          if (Number.isFinite(normalizedId) && normalizedId > 0) {
            return {
              id: normalizedId,
              name: matchedName == null ? name : String(matchedName),
            };
          }
        }
      } catch (_) {}

      return null;
    };

    const extractMasterNameFromAisleLine = (rawLine) => {
      const line = String(rawLine || '').trim();
      if (!line) return '';
      try {
        const parsed = parseSpecsFromRaw(line, [], ingredientCatalog);
        if (Array.isArray(parsed) && parsed[0] && parsed[0].baseName) {
          return String(parsed[0].baseName).trim();
        }
      } catch (_) {}
      return line;
    };

    const navigateToShoppingMatch = (match) => {
      const normalizedId = Number(match && match.id);
      const normalizedName = String(match && match.name ? match.name : '').trim();
      if (!Number.isFinite(normalizedId) || normalizedId <= 0 || !normalizedName) return;
      sessionStorage.setItem('selectedShoppingItemId', String(normalizedId));
      sessionStorage.setItem('selectedShoppingItemName', normalizedName);
      sessionStorage.removeItem('selectedShoppingItemIsNew');
      window.location.href = 'shoppingEditor.html';
    };

    const syncEmptyStateAisleCta = () => {
      const cta = document.getElementById('storeAddAisleCtaEmpty');
      if (!cta) return;
      cta.hidden = aisleRows.length > 0;
    };

    let storeEditorSearchQuery = '';
    const normalizeStoreEditorSearchQuery = (value) =>
      String(value || '').trim().toLowerCase();
    const lineMatchesStoreEditorSearch = (line, query) => {
      const q = normalizeStoreEditorSearchQuery(query);
      if (!q) return true;
      return String(line || '').toLowerCase().includes(q);
    };
    const getStoreEditorFilteredLines = (aid, query) => {
      const q = normalizeStoreEditorSearchQuery(query);
      const lines = Array.isArray(aisleItemsByAisle.get(aid))
        ? aisleItemsByAisle.get(aid)
        : [];
      if (!q) return [...lines];
      return lines.filter((line) => lineMatchesStoreEditorSearch(line, q));
    };
    const aisleMatchesStoreEditorSearch = (aisleName, aid, query) => {
      const q = normalizeStoreEditorSearchQuery(query);
      if (!q) return true;
      if (String(aisleName || '').toLowerCase().includes(q)) return true;
      return getStoreEditorFilteredLines(aid, q).length > 0;
    };
    const applyStoreEditorSearch = (query = storeEditorSearchQuery) => {
      storeEditorSearchQuery = normalizeStoreEditorSearchQuery(query);
      const isSearchActive = !!storeEditorSearchQuery;
      if (isSearchActive) closeActiveVariantPicker({ commit: true });
      document.body.classList.toggle('store-editor-search-active', isSearchActive);

      const list = document.getElementById('storeAislesList');
      if (!list) return;
      const slotEls = Array.from(list.querySelectorAll(`.${STORE_AISLE_SLOT_CLASS}`));
      slotEls.forEach((slotEl) => {
        const cardEl = slotEl.querySelector('.store-aisle-card');
        const aid = Number(cardEl?.dataset?.aisleId);
        const aisle = aisleRows.find((row) => row.id === aid);
        const showSlot = aisle
          ? aisleMatchesStoreEditorSearch(aisle.name, aisle.id, storeEditorSearchQuery)
          : !isSearchActive;
        slotEl.hidden = !showSlot;
        slotEl.setAttribute('aria-hidden', showSlot ? 'false' : 'true');

        if (!(cardEl instanceof HTMLElement)) return;
        cardEl.classList.toggle('store-aisle-card--search-active', isSearchActive);

        const itemsFieldEl = cardEl.querySelector('.store-aisle-items-field');
        if (itemsFieldEl instanceof HTMLElement) {
          itemsFieldEl.classList.toggle(
            'store-aisle-items-field--search-active',
            isSearchActive,
          );
        }

        const resultsEl = cardEl.querySelector('.store-aisle-search-results');
        if (!(resultsEl instanceof HTMLElement)) return;

        const matchingLines =
          aisle && isSearchActive
            ? getStoreEditorFilteredLines(aisle.id, storeEditorSearchQuery)
            : [];
        resultsEl.innerHTML = '';
        matchingLines.forEach((line) => {
          const lineEl = document.createElement('div');
          lineEl.className = 'store-aisle-search-line';
          lineEl.textContent = String(line || '');
          resultsEl.appendChild(lineEl);
        });
        resultsEl.hidden = !(isSearchActive && matchingLines.length > 0);
        resultsEl.setAttribute(
          'aria-hidden',
          resultsEl.hidden ? 'true' : 'false',
        );
      });
    };


    let lastPointerClientX = -1;
    let lastPointerClientY = -1;

    const getHoveredSlot = () => {
      try {
        if (lastPointerClientX < 0) return null;
        const el = document.elementFromPoint(lastPointerClientX, lastPointerClientY);
        if (!el) return null;
        return el.closest ? el.closest(`.${STORE_AISLE_SLOT_CLASS}`) : null;
      } catch (_) {
        return null;
      }
    };

    const syncAddAisleHoverModifier = (e) => {
      const next = !!(e && e.altKey);
      if (next === hoverModifierActive) return;
      hoverModifierActive = next;
      syncStoreMasterLinkModeClass();
      if (hoverModifierActive) {
        const slot = getHoveredSlot();
        if (slot) syncActiveAisleHintClass(slot);
      } else {
        syncActiveAisleHintClass(null);
      }
    };

    const clearAddAisleHoverModifier = () => {
      if (!hoverModifierActive) return;
      hoverModifierActive = false;
      syncStoreMasterLinkModeClass();
      syncActiveAisleHintClass(null);
    };

    try {
      if (typeof window._storeAddAisleHoverModifierTeardown === 'function') {
        window._storeAddAisleHoverModifierTeardown();
      }
    } catch (_) {}
    const onPointerMove = (e) => {
      lastPointerClientX = e.clientX;
      lastPointerClientY = e.clientY;
    };
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('keydown', syncAddAisleHoverModifier, true);
    document.addEventListener('keyup', syncAddAisleHoverModifier, true);
    window.addEventListener('blur', clearAddAisleHoverModifier);
    window._storeAddAisleHoverModifierTeardown = () => {
      try {
        document.removeEventListener('pointermove', onPointerMove, true);
      } catch (_) {}
      try {
        document.removeEventListener('keydown', syncAddAisleHoverModifier, true);
      } catch (_) {}
      try {
        document.removeEventListener('keyup', syncAddAisleHoverModifier, true);
      } catch (_) {}
      try {
        window.removeEventListener('blur', clearAddAisleHoverModifier);
      } catch (_) {}
      hoverModifierActive = false;
      syncStoreMasterLinkModeClass();
      syncActiveAisleHintClass(null);
    };

    const closeActiveVariantPicker = ({ commit = true } = {}) => {
      if (!activeVariantPicker) return;
      const {
        aid,
        baseKey,
        textarea,
        panel,
        outsideClickHandler,
        onEsc,
        onPanelKeyDown,
        onDocumentKeyDown,
        focusBaselineValue,
      } = activeVariantPicker;
      try {
        document.removeEventListener('mousedown', outsideClickHandler, true);
      } catch (_) {}
      try {
        textarea?.removeEventListener('keydown', onEsc, true);
      } catch (_) {}
      try {
        panel?.removeEventListener('keydown', onPanelKeyDown, true);
      } catch (_) {}
      try {
        document.removeEventListener('keydown', onDocumentKeyDown, true);
      } catch (_) {}
      try {
        panel?.remove();
      } catch (_) {}
      try {
        textarea?.classList?.remove('store-variant-picker-hidden-input');
      } catch (_) {}
      activeVariantPicker = null;
      const specs = cloneSpecs(aisleItemSpecsByAisle.get(aid) || []);
      if (!commit && typeof focusBaselineValue === 'string') {
        const restored = parseSpecsFromRaw(
          focusBaselineValue,
          specs,
          ingredientCatalog,
        );
        aisleItemSpecsByAisle.set(aid, restored);
      }
      syncDisplayLinesFromSpecs(aid);
      if (textarea && typeof textarea.value === 'string') {
        textarea.value = (aisleItemsByAisle.get(aid) || []).join('\n');
        setAisleTextareaRawDraft(textarea, textarea.value);
        try {
          textarea.__feAutoGrowResize?.();
        } catch (_) {}
      }
      if (baseKey) refreshDirty();
    };

    const maybeOpenVariantPickerFromCaret = (textarea, aid) => {
      if (!(textarea instanceof HTMLTextAreaElement)) return;
      const originalTextareaValue = String(textarea.value || '');
      const v = String(textarea.value || '');
      const selStart = Number(textarea.selectionStart ?? 0);
      const selEnd = Number(textarea.selectionEnd ?? selStart);
      const pos = Math.max(selStart, selEnd);
      const prevNl = v.lastIndexOf('\n', Math.max(0, pos - 1));
      const lineStart = prevNl === -1 ? 0 : prevNl + 1;
      const nextNl = v.indexOf('\n', pos);
      const lineEnd = nextNl === -1 ? v.length : nextNl;
      const lineText = String(v.slice(lineStart, lineEnd) || '');
      const col = Math.max(0, pos - lineStart);
      const selColStart = Math.max(0, Math.min(selStart, selEnd) - lineStart);
      const selColEnd = Math.max(0, Math.max(selStart, selEnd) - lineStart);
      const hasSelection = selColEnd > selColStart;
      const openIdx = lineText.indexOf('(');
      const closeIdx = lineText.lastIndexOf(')');
      if (openIdx < 0) return;
      const hasClosingParen = closeIdx > openIdx;
      if (hasClosingParen) {
        const inParenByCaret = col >= openIdx && col <= closeIdx + 1;
        const inParenBySelection =
          hasSelection && selColEnd >= openIdx && selColStart <= closeIdx + 1;
        if (!inParenByCaret && !inParenBySelection) return;
      } else if (col < openIdx) {
        const inParenBySelection = hasSelection && selColEnd >= openIdx;
        if (inParenBySelection) {
          // Selection reaches into the open-paren segment (e.g. triple-click line select).
        } else {
        // Support in-progress variant text (e.g. "apple (Fuji") before closing ")".
        return;
        }
      }
      const specs = parseSpecsFromRaw(
        textarea.value,
        aisleItemSpecsByAisle.get(aid) || [],
        ingredientCatalog,
      );
      aisleItemSpecsByAisle.set(aid, specs);
      const parsed = splitLineIntoBaseAndParenLoose(lineText);
      const baseKey = normItemKey(parsed?.baseName || '');
      if (!baseKey) return;
      const spec = specs.find((s) => s.baseKey === baseKey);
      if (!spec || !Number.isFinite(Number(spec.ingredientId))) return;
      closeActiveVariantPicker({ commit: true });
      const card = textarea.closest('.store-aisle-card');
      const itemsField = textarea.closest('.store-aisle-items-field');
      if (!card || !itemsField) return;
      const selected = new Set(
        (spec.selectedVariants || []).map((x) => normVariantKey(x)),
      );
      const knownVariants = Array.isArray(spec.knownVariants)
        ? spec.knownVariants.filter((x) => String(x?.name || '').trim())
        : [];
      // Build picker options optimistically: saved DB variants first, then any
      // valid ad-hoc variants the user already typed in this line.
      const pickerVariants = [];
      const seenPickerVariantKeys = new Set();
      knownVariants.forEach((variant) => {
        const vn = String(variant?.name || '').trim();
        const key = normVariantKey(vn);
        if (!key || seenPickerVariantKeys.has(key)) return;
        seenPickerVariantKeys.add(key);
        pickerVariants.push({
          id: Number.isFinite(Number(variant?.id)) ? Number(variant.id) : null,
          name: vn,
        });
      });
      (spec.selectedVariants || []).forEach((variantName) => {
        const vn = String(variantName || '').trim();
        const key = normVariantKey(vn);
        if (!key || seenPickerVariantKeys.has(key)) return;
        if (!isSupportedVariantName(vn)) return;
        seenPickerVariantKeys.add(key);
        pickerVariants.push({ id: null, name: vn });
      });
      const panel = document.createElement('div');
      panel.className = 'store-variant-picker store-variant-picker--inline';
      const inlineLine = document.createElement('div');
      inlineLine.className = 'store-variant-picker-inline-line';
      const baseLabel = document.createElement('span');
      baseLabel.className =
        'store-variant-picker-inline-name store-variant-picker-inline-name-pill';
      baseLabel.textContent = spec.baseName || '';
      inlineLine.appendChild(baseLabel);
      const pillsWrap = document.createElement('div');
      pillsWrap.className = 'store-variant-picker-pills store-variant-picker-pills--inline';
      const pillButtons = [];
      let addAllBtn = null;
      const syncAllPillStates = () => {
        pillButtons.forEach(({ btn, key }) => {
          const on = selected.has(key);
          btn.classList.toggle('is-on', on);
          btn.classList.toggle('is-off', !on);
          btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        if (addAllBtn) {
          const allSelected =
            pickerVariants.length > 0 &&
            pickerVariants.every((v) =>
              selected.has(normVariantKey(String(v?.name || '').trim())),
            );
          addAllBtn.disabled = allSelected;
          addAllBtn.classList.toggle('is-unavailable', allSelected);
          addAllBtn.setAttribute('aria-disabled', allSelected ? 'true' : 'false');
        }
      };
      if (knownVariants.length >= 5) {
        addAllBtn = document.createElement('button');
        addAllBtn.type = 'button';
        addAllBtn.className =
          'ui-unknown-items-suggestion-pill store-variant-picker-pill store-variant-picker-pill--add-all';
        addAllBtn.textContent = 'Add all';
        addAllBtn.addEventListener('click', () => {
          pickerVariants.forEach((variant) => {
            const vn = String(variant?.name || '').trim();
            const key = normVariantKey(vn);
            if (key) selected.add(key);
          });
          const nextList = pickerVariants
            .map((v2) => String(v2?.name || '').trim())
            .filter((name) => selected.has(normVariantKey(name)));
          spec.selectedVariants = nextList;
          syncAllPillStates();
          syncDisplayLinesFromSpecs(aid, { pickerBaseKey: spec.baseKey });
          textarea.value = (aisleItemsByAisle.get(aid) || []).join('\n');
          try {
            textarea.__feAutoGrowResize?.();
          } catch (_) {}
          refreshDirty();
        });
        pillsWrap.appendChild(addAllBtn);
      }
      pickerVariants.forEach((variant) => {
        const vn = String(variant?.name || '').trim();
        const key = normVariantKey(vn);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ui-unknown-items-suggestion-pill store-variant-picker-pill';
        btn.textContent = vn;
        pillButtons.push({ btn, key });
        btn.addEventListener('click', () => {
          if (selected.has(key)) selected.delete(key);
          else selected.add(key);
          const nextList = pickerVariants
            .map((v2) => String(v2?.name || '').trim())
            .filter((name) => selected.has(normVariantKey(name)));
          spec.selectedVariants = nextList;
          syncAllPillStates();
          syncDisplayLinesFromSpecs(aid, { pickerBaseKey: spec.baseKey });
          textarea.value = (aisleItemsByAisle.get(aid) || []).join('\n');
          try {
            textarea.__feAutoGrowResize?.();
          } catch (_) {}
          refreshDirty();
        });
        pillsWrap.appendChild(btn);
      });
      syncAllPillStates();
      inlineLine.appendChild(pillsWrap);
      panel.appendChild(inlineLine);
      itemsField.appendChild(panel);
      textarea.classList.add('store-variant-picker-hidden-input');
      syncDisplayLinesFromSpecs(aid, { pickerBaseKey: spec.baseKey });
      textarea.value = (aisleItemsByAisle.get(aid) || []).join('\n');
      try {
        textarea.__feAutoGrowResize?.();
      } catch (_) {}

      const outsideClickHandler = (evt) => {
        const t = evt?.target;
        if (!(t instanceof HTMLElement)) return;
        if (panel.contains(t)) return;
        if (t === textarea) return;
        closeActiveVariantPicker({ commit: true });
      };
      const onEsc = (evt) => {
        const key = String(evt?.key || '');
        if (key === 'Enter') {
          evt.preventDefault();
          evt.stopPropagation();
          const caretPos = Number(textarea?.selectionStart ?? 0);
          closeActiveVariantPicker({ commit: true });
          try {
            const nextPos = Math.max(
              0,
              Math.min(caretPos, Number(textarea?.value?.length ?? 0)),
            );
            textarea.focus();
            textarea.setSelectionRange(nextPos, nextPos);
          } catch (_) {}
          return;
        }
        if (key !== 'Escape') return;
        evt.preventDefault();
        evt.stopPropagation();
        closeActiveVariantPicker({ commit: false });
        try {
          textarea.blur();
        } catch (_) {}
      };
      const onPanelKeyDown = (evt) => {
        const key = String(evt?.key || '');
        if (key === 'Enter') {
          evt.preventDefault();
          evt.stopPropagation();
          const caretPos = Number(textarea?.selectionStart ?? 0);
          closeActiveVariantPicker({ commit: true });
          try {
            const nextPos = Math.max(
              0,
              Math.min(caretPos, Number(textarea?.value?.length ?? 0)),
            );
            textarea.focus();
            textarea.setSelectionRange(nextPos, nextPos);
          } catch (_) {}
          return;
        }
        if (key === 'Escape') {
          evt.preventDefault();
          evt.stopPropagation();
          closeActiveVariantPicker({ commit: false });
          try {
            textarea.blur();
          } catch (_) {}
        }
      };
      const onDocumentKeyDown = (evt) => {
        const key = String(evt?.key || '');
        if (key === 'Enter') {
          evt.preventDefault();
          evt.stopPropagation();
          const caretPos = Number(textarea?.selectionStart ?? 0);
          closeActiveVariantPicker({ commit: true });
          try {
            const nextPos = Math.max(
              0,
              Math.min(caretPos, Number(textarea?.value?.length ?? 0)),
            );
            textarea.focus();
            textarea.setSelectionRange(nextPos, nextPos);
          } catch (_) {}
          return;
        }
        if (key !== 'Escape') return;
        evt.preventDefault();
        evt.stopPropagation();
        closeActiveVariantPicker({ commit: false });
        try {
          textarea.blur();
        } catch (_) {}
      };
      document.addEventListener('mousedown', outsideClickHandler, true);
      textarea.addEventListener('keydown', onEsc, true);
      panel.addEventListener('keydown', onPanelKeyDown, true);
      document.addEventListener('keydown', onDocumentKeyDown, true);
      activeVariantPicker = {
        aid,
        baseKey: spec.baseKey,
        textarea,
        panel,
        outsideClickHandler,
        onEsc,
        onPanelKeyDown,
        onDocumentKeyDown,
        focusBaselineValue: originalTextareaValue,
      };
    };

    const renderAisleCards = () => {
      const list = document.getElementById('storeAislesList');
      if (!list) return;

      closeActiveVariantPicker({ commit: true });
      list.innerHTML = '';
      aisleRows.forEach((a) => {
        const aisleIndex = aisleRows.findIndex((r) => r.id === a.id);

        const slot = document.createElement('div');
        slot.className = STORE_AISLE_SLOT_CLASS;

        const card = document.createElement('div');
        card.className = 'shopping-item-editor-card store-aisle-card';
        card.dataset.aisleId = String(a.id);
        card.tabIndex = 0;
        if (desktopHoverEnabled) {
          slot.addEventListener('mouseenter', (e) => {
            hoverModifierActive = !!e.altKey;
            syncStoreMasterLinkModeClass();
            if (hoverModifierActive) {
              syncActiveAisleHintClass(slot);
            }
          });
          slot.addEventListener('mouseleave', () => {
            syncActiveAisleHintClass(null);
          });
        }

        const aisleTargetIsNameOrList = (target) =>
          target.closest('.store-aisle-name') ||
          target.closest('textarea') ||
          target.closest('.store-variant-picker') ||
          target.closest('.store-aisle-move-controls');

        const moveAisleByDelta = (delta, options = null) => {
          const from = aisleRows.findIndex((r) => r.id === a.id);
          if (from < 0) return;
          const to = from + delta;
          if (to < 0 || to >= aisleRows.length) return;
          const [row] = aisleRows.splice(from, 1);
          aisleRows.splice(to, 0, row);
          renderAisleCards();
          if (options?.focus === 'textarea') {
            const movedCard = document.querySelector(
              `.store-aisle-card[data-aisle-id="${String(a.id)}"]`,
            );
            const movedTextarea = movedCard?.querySelector(
              '.shopping-item-textarea',
            );
            if (movedTextarea) {
              try {
                movedTextarea.focus({ preventScroll: true });
              } catch (_) {
                movedTextarea.focus();
              }
              const start = Number.isFinite(options.selectionStart)
                ? Number(options.selectionStart)
                : null;
              const end = Number.isFinite(options.selectionEnd)
                ? Number(options.selectionEnd)
                : start;
              if (start != null) {
                try {
                  movedTextarea.setSelectionRange(start, end ?? start);
                } catch (_) {}
              }
            }
          }
          refreshDirty();
        };

        const attemptDeleteAisle = async () => {
          const ok = await uiConfirm({
            title: 'Delete aisle?',
            message: `Permanently delete “${(a.name || 'Aisle').replace(/"/g, '')}” and its item list?`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
          });
          if (!ok) return;
          const idx = aisleRows.findIndex((r) => r.id === a.id);
          if (idx < 0) return;
          const snapshot = { id: a.id, name: a.name };
          const itemsSnap = [...(aisleItemsByAisle.get(a.id) || [])];
          const specsSnap = cloneSpecs(aisleItemSpecsByAisle.get(a.id) || []);
          const wasPersisted = a.id > 0;

          if (wasPersisted) deletedAisleIds.add(a.id);
          aisleRows = aisleRows.filter((r) => r.id !== a.id);
          aisleItemsByAisle.delete(a.id);
          aisleItemSpecsByAisle.delete(a.id);
          renderAisleCards();
          refreshDirty();

          const restore = () => {
            try {
              if (wasPersisted) deletedAisleIds.delete(snapshot.id);
              const insertAt = Math.min(
                Math.max(0, idx),
                aisleRows.length,
              );
              aisleRows.splice(insertAt, 0, {
                id: snapshot.id,
                name: snapshot.name,
              });
              aisleItemsByAisle.set(snapshot.id, [...itemsSnap]);
              aisleItemSpecsByAisle.set(snapshot.id, cloneSpecs(specsSnap));
            } catch (_) {}
            renderAisleCards();
            refreshDirty();
          };

          try {
            const um = window.undoManager;
            if (um && typeof um.push === 'function') {
              um.push({
                message: 'Aisle removed',
                undo: restore,
                timeoutMs: 8000,
              });
            } else if (typeof window.showUndoToast === 'function') {
              window.showUndoToast({
                message: 'Aisle removed',
                onUndo: restore,
              });
            }
          } catch (_) {}
        };

        card.addEventListener('click', (e) => {
          const wantsDelete = e.ctrlKey || e.metaKey;
          if (!wantsDelete) return;
          if (aisleTargetIsNameOrList(e.target)) return;
          e.preventDefault();
          e.stopPropagation();
          void attemptDeleteAisle();
        });

        card.addEventListener('contextmenu', (e) => {
          if (aisleTargetIsNameOrList(e.target)) return;
          e.preventDefault();
          e.stopPropagation();
          void attemptDeleteAisle();
        });

        const moveControls = document.createElement('div');
        moveControls.className = 'store-aisle-move-controls';
        moveControls.setAttribute('aria-label', 'Reorder aisle');

        const moveUpBtn = document.createElement('button');
        moveUpBtn.className = 'store-aisle-move-btn';
        moveUpBtn.type = 'button';
        const moveUpIcon = document.createElement('span');
        moveUpIcon.className = 'material-symbols-outlined store-aisle-move-icon';
        moveUpIcon.setAttribute('aria-hidden', 'true');
        moveUpIcon.textContent = 'arrow_upward_alt';
        moveUpBtn.appendChild(moveUpIcon);
        moveUpBtn.setAttribute('aria-label', 'Move aisle up');
        if (aisleIndex <= 0) {
          moveUpBtn.disabled = true;
          moveUpBtn.setAttribute('aria-disabled', 'true');
        }
        moveUpBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          moveAisleByDelta(-1);
        });

        const moveDownBtn = document.createElement('button');
        moveDownBtn.className = 'store-aisle-move-btn';
        moveDownBtn.type = 'button';
        const moveDownIcon = document.createElement('span');
        moveDownIcon.className = 'material-symbols-outlined store-aisle-move-icon';
        moveDownIcon.setAttribute('aria-hidden', 'true');
        moveDownIcon.textContent = 'arrow_downward_alt';
        moveDownBtn.appendChild(moveDownIcon);
        moveDownBtn.setAttribute('aria-label', 'Move aisle down');
        if (aisleIndex >= aisleRows.length - 1) {
          moveDownBtn.disabled = true;
          moveDownBtn.setAttribute('aria-disabled', 'true');
        }
        moveDownBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          moveAisleByDelta(1);
        });

        moveControls.appendChild(moveUpBtn);
        moveControls.appendChild(moveDownBtn);
        card.appendChild(moveControls);

        const nameEl = document.createElement('div');
        nameEl.className = 'shopping-item-label store-aisle-name';
        nameEl.textContent = a.name || 'Aisle';

        nameEl.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (nameEl.isContentEditable) return;
          const starting = (a.name || '').trim() || 'Aisle';

          nameEl.contentEditable = 'true';
          nameEl.classList.add('editing-title');
          nameEl.textContent = starting;
          nameEl.focus();

          const cleanup = () => {
            nameEl.contentEditable = 'false';
            nameEl.classList.remove('editing-title');
            nameEl.removeEventListener('blur', onBlur);
            nameEl.removeEventListener('keydown', onKeyDown);
          };

          const commitLocal = () => {
            let next = (nameEl.textContent || '').trim();
            if (!next) next = starting;
            a.name = next;
            nameEl.textContent = next || 'Aisle';
            cleanup();
            refreshDirty();
          };

          const onBlur = () => {
            commitLocal();
          };

          const onKeyDown = (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              nameEl.removeEventListener('blur', onBlur);
              commitLocal();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              nameEl.textContent = a.name || 'Aisle';
              cleanup();
            }
          };

          nameEl.addEventListener('blur', onBlur);
          nameEl.addEventListener('keydown', onKeyDown);
        });

        card.appendChild(nameEl);

        let specs = cloneSpecs(aisleItemSpecsByAisle.get(a.id) || []);
        if (!specs.length) {
          const items = aisleItemsByAisle.get(a.id) || [];
          specs = parseSpecsFromRaw(items.join('\n'), [], ingredientCatalog);
          aisleItemSpecsByAisle.set(a.id, specs);
          syncDisplayLinesFromSpecs(a.id);
        }
        const itemsField = document.createElement('div');
        itemsField.className = 'shopping-item-field store-aisle-items-field';

        const ta = document.createElement('textarea');
        ta.className = 'shopping-item-textarea';
        ta.value = (aisleItemsByAisle.get(a.id) || []).join('\n');
        setAisleTextareaRawDraft(ta, ta.value);
        ta.placeholder = 'Add an item.';
        ta.setAttribute('aria-label', 'Aisle items');
        ta.wrap = 'soft';
        attachEditorTextareaAutoGrow(ta, { maxLines: 10 });
        attachEditorNewlineListPaste(ta);

        // Ingredient-name suggestions for the aisle items "paste box".
        // Uses shared typeahead infrastructure, but adapts it to textarea "current line".
        try {
          const taTypeahead = window.favoriteEatsTypeahead;
          if (
            taTypeahead &&
            typeof taTypeahead.attach === 'function' &&
            typeof taTypeahead.getNamePool === 'function'
          ) {
            const getCaretLineBounds = (textarea, caretPos) => {
              const v = String(textarea.value || '');
              const pos =
                caretPos != null && Number.isFinite(caretPos)
                  ? Number(caretPos)
                  : textarea.selectionStart ?? 0;
              const prevNl = v.lastIndexOf('\n', pos - 1);
              const lineStart = prevNl === -1 ? 0 : prevNl + 1;
              const nextNl = v.indexOf('\n', pos);
              const lineEnd = nextNl === -1 ? v.length : nextNl;
              return { lineStart, lineEnd };
            };

            const getCurrentLineText = (textarea) => {
              const caretPos = textarea.selectionStart ?? 0;
              const { lineStart, lineEnd } = getCaretLineBounds(
                textarea,
                caretPos,
              );
              return vSlice(textarea.value, lineStart, lineEnd);
            };

            // Small local helper (keeps code below readable).
            const vSlice = (s, a, b) => String(s || '').slice(a, b);
            const getVariantPoolForBaseName = (baseName) => {
              const key = normItemKey(baseName);
              if (!key) return [];
              const known = ingredientCatalog?.byName?.get?.(key) || null;
              if (!known || !Array.isArray(known.variants)) return [];
              const out = [];
              const seen = new Set();
              known.variants.forEach((v) => {
                const clean = String(v?.name || '').trim();
                if (!clean) return;
                const k = normVariantKey(clean);
                if (!k || seen.has(k)) return;
                seen.add(k);
                out.push(clean);
              });
              return out;
            };
            const getLineTypeaheadContext = (textarea) => {
              const caretPos = textarea.selectionStart ?? 0;
              const { lineStart, lineEnd } = getCaretLineBounds(
                textarea,
                caretPos,
              );
              const lineText = vSlice(textarea.value, lineStart, lineEnd);
              const caretInLine = Math.max(
                0,
                Math.min(lineText.length, caretPos - lineStart),
              );
              const beforeCaret = vSlice(lineText, 0, caretInLine);
              const openParenIdx = beforeCaret.lastIndexOf('(');
              const closeParenIdx = beforeCaret.lastIndexOf(')');
              const inVariantContext =
                openParenIdx >= 0 && closeParenIdx < openParenIdx;
              if (!inVariantContext) {
                return {
                  mode: 'name',
                  query: String(lineText || '').trim(),
                  lineStart,
                  lineEnd,
                };
              }

              const baseName = String(vSlice(lineText, 0, openParenIdx) || '').trim();
              if (!baseName) {
                return {
                  mode: 'name',
                  query: String(lineText || '').trim(),
                  lineStart,
                  lineEnd,
                };
              }

              const tokenAnchor = beforeCaret.lastIndexOf(',');
              const tokenStartInLine = tokenAnchor >= openParenIdx ? tokenAnchor + 1 : openParenIdx + 1;

              const afterCaret = vSlice(lineText, caretInLine, lineText.length);
              const tokenEndRel = afterCaret.search(/[,\)]/);
              const tokenEndInLine =
                tokenEndRel === -1 ? lineText.length : caretInLine + tokenEndRel;

              let tokenTextStartInLine = tokenStartInLine;
              while (
                tokenTextStartInLine < tokenEndInLine &&
                /\s/.test(lineText[tokenTextStartInLine] || '')
              ) {
                tokenTextStartInLine += 1;
              }

              return {
                mode: 'variant',
                baseName,
                query: String(
                  vSlice(lineText, tokenTextStartInLine, caretInLine),
                ).trim(),
                lineStart,
                lineEnd,
                tokenTextStartAbs: lineStart + tokenTextStartInLine,
                tokenEndAbs: lineStart + tokenEndInLine,
              };
            };

            taTypeahead.attach({
              inputEl: ta,
              getPool: async (textarea) => {
                const ctx = getLineTypeaheadContext(textarea);
                if (ctx.mode === 'variant') {
                  return getVariantPoolForBaseName(ctx.baseName);
                }
                return await taTypeahead.getNamePool();
              },
              // Query is context-aware:
              // - name mode: current line text
              // - variant mode: current token inside parentheses
              getQuery: (textarea) => String(getLineTypeaheadContext(textarea).query || ''),
              // Replace either:
              // - full line (name mode), or
              // - active variant token only (variant mode)
              setValue: (picked, textarea) => {
                const canonical = String(picked || '').trim();
                const ctx = getLineTypeaheadContext(textarea);
                if (ctx.mode === 'variant') {
                  const start = Number(ctx.tokenTextStartAbs);
                  const end = Number(ctx.tokenEndAbs);
                  const before = vSlice(textarea.value, 0, start);
                  const after = vSlice(textarea.value, end, textarea.value.length);
                  textarea.value = before + canonical + after;
                  return { caretPos: start + canonical.length };
                }
                const before = vSlice(textarea.value, 0, ctx.lineStart);
                const after = vSlice(textarea.value, ctx.lineEnd, textarea.value.length);
                textarea.value = before + canonical + after;
                return { caretPos: ctx.lineStart + canonical.length };
              },
              allowSuggestionsWhenQueryEmpty: (textarea) => {
                const ctx = getLineTypeaheadContext(textarea);
                return (
                  ctx.mode === 'variant' &&
                  !ctx.query &&
                  getVariantPoolForBaseName(ctx.baseName).length > 0
                );
              },
              closeOnEmptyQuery: true,
              openOnlyWhenQueryNonEmpty: true,
              // Avoid suggestion flicker when pasting a whole list.
              ignoreInputTypes: ['insertFromPaste', 'insertFromDrop'],
              // Keep native down-arrow caret movement in aisle list textarea.
              openOnArrowDownWhenClosed: false,
            });

            // Caret changes without typing can leave stale suggestions; close on click to force refresh on typing.
            ta.addEventListener('click', () => {
              try {
                if (typeof taTypeahead.close === 'function') taTypeahead.close();
              } catch (_) {}
            });
          }
        } catch (_) {}

        let escBaseline = parseUniqueItemLines(ta.value);
        let escBaselineText = ta.value;

        ta.addEventListener('focus', () => {
          closeActiveVariantPicker({ commit: true });
          const nextSpecs = parseSpecsFromRaw(
            ta.value,
            aisleItemSpecsByAisle.get(a.id) || [],
            ingredientCatalog,
          );
          aisleItemSpecsByAisle.set(a.id, nextSpecs);
          syncDisplayLinesFromSpecs(a.id, { expandAll: true });
          ta.value = (aisleItemsByAisle.get(a.id) || []).join('\n');
          setAisleTextareaRawDraft(ta, ta.value);
          escBaseline = parseUniqueItemLines(ta.value);
          escBaselineText = ta.value;
        });

        ta.addEventListener('input', () => {
          setAisleTextareaRawDraft(ta, ta.value);
          const nextSpecs = parseSpecsFromRaw(
            ta.value,
            aisleItemSpecsByAisle.get(a.id) || [],
            ingredientCatalog,
          );
          aisleItemSpecsByAisle.set(a.id, nextSpecs);
          aisleItemsByAisle.set(a.id, parseUniqueItemLines(ta.value));
          refreshDirty();
        });

        ta.addEventListener('click', (e) => {
          if (
            e &&
            e.altKey &&
            card.classList.contains(STORE_AISLE_HINT_ACTIVE_CLASS)
          ) {
            const lineText = getTextareaLineTextAtCaret(ta);
            const baseName = extractMasterNameFromAisleLine(lineText);
            const match = getShoppingMatchByName(baseName);
            if (match) {
              e.preventDefault();
              e.stopPropagation();
              navigateToShoppingMatch(match);
              return;
            }
          }
          if (Number(e?.detail || 0) < 3) return;
          if (activeVariantPicker && activeVariantPicker.textarea === ta) return;
          // Let native selection/caret settle first, then inspect caret context.
          window.setTimeout(() => {
            maybeOpenVariantPickerFromCaret(ta, a.id);
          }, 0);
        });

        ta.addEventListener('keydown', (e) => {
          const wantsAisleReorder =
            e.metaKey &&
            !e.ctrlKey &&
            !e.altKey &&
            !e.shiftKey &&
            (e.key === 'ArrowUp' || e.key === 'ArrowDown');
          if (wantsAisleReorder) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') {
              e.stopImmediatePropagation();
            }
            moveAisleByDelta(e.key === 'ArrowUp' ? -1 : 1, {
              focus: 'textarea',
              selectionStart: ta.selectionStart,
              selectionEnd: ta.selectionEnd,
            });
            return;
          }
          if (
            e.key === 'Enter' &&
            activeVariantPicker &&
            activeVariantPicker.textarea === ta
          ) {
            // Picker-level Enter handler (capture phase) owns commit + focus restore.
            return;
          }
          if (e.key === 'Enter' && e.shiftKey) {
            // Chat-style newline override: Shift+Enter inserts a hard line break.
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            closeActiveVariantPicker({ commit: true });
            try {
              ta.blur();
            } catch (_) {}
            return;
          }
          if (
            e.key === 'Escape' &&
            activeVariantPicker &&
            activeVariantPicker.textarea === ta
          ) {
            // Picker-level Esc handler (capture phase) owns close + blur.
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            closeActiveVariantPicker({ commit: false });
            ta.value = escBaselineText || escBaseline.join('\n');
            const nextSpecs = parseSpecsFromRaw(
              ta.value,
              aisleItemSpecsByAisle.get(a.id) || [],
              ingredientCatalog,
            );
            aisleItemSpecsByAisle.set(a.id, nextSpecs);
            syncDisplayLinesFromSpecs(a.id);
            ta.value = (aisleItemsByAisle.get(a.id) || []).join('\n');
            try {
              ta.__feAutoGrowResize();
            } catch (_) {}
            refreshDirty();
            return;
          }
        });

        ta.addEventListener('blur', () => {
          window.setTimeout(() => {
            if (activeVariantPicker && activeVariantPicker.textarea === ta) return;
            const nextSpecs = parseSpecsFromRaw(
              ta.value,
              aisleItemSpecsByAisle.get(a.id) || [],
              ingredientCatalog,
            );
            aisleItemSpecsByAisle.set(a.id, nextSpecs);
            syncDisplayLinesFromSpecs(a.id);
            ta.value = (aisleItemsByAisle.get(a.id) || []).join('\n');
            setAisleTextareaRawDraft(ta, ta.value);
            try {
              ta.__feAutoGrowResize?.();
            } catch (_) {}
            refreshDirty();
          }, 0);
        });

        const filteredResults = document.createElement('div');
        filteredResults.className = 'store-aisle-search-results';
        filteredResults.hidden = true;
        filteredResults.setAttribute('aria-hidden', 'true');
        filteredResults.setAttribute('aria-label', 'Matching aisle items');
        itemsField.appendChild(filteredResults);

        itemsField.appendChild(ta);
        card.appendChild(itemsField);

        slot.appendChild(card);

        const slotCta = document.createElement('div');
        slotCta.className = 'store-add-aisle-cta store-add-aisle-cta--per-slot';
        slotCta.setAttribute('role', 'button');
        slotCta.tabIndex = 0;
        const slotCtaLabel = document.createElement('span');
        slotCtaLabel.className = 'placeholder-prompt';
        slotCtaLabel.textContent = 'Add an aisle';
        slotCta.appendChild(slotCtaLabel);
        slot.appendChild(slotCta);

        list.appendChild(slot);
      });
      syncEmptyStateAisleCta();
      applyStoreEditorSearch(storeEditorSearchQuery);
    };

    const runAddAisle = async (insertAfterIndex) => {
      if (!window.ui) {
        uiToast('UI not ready yet.');
        return;
      }
      const name = await window.ui.prompt({
        title: 'New Aisle',
        label: 'Name',
        value: '',
        confirmText: 'Create',
        cancelText: 'Cancel',
        required: true,
        normalize: (v) => (v || '').trim(),
      });
      if (!name) return;

      const tid = nextTempAisleId--;
      const newRow = { id: tid, name };
      if (insertAfterIndex != null && insertAfterIndex >= 0 && insertAfterIndex < aisleRows.length) {
        aisleRows.splice(insertAfterIndex + 1, 0, newRow);
      } else {
        aisleRows.push(newRow);
      }
      aisleItemsByAisle.set(tid, []);
      aisleItemSpecsByAisle.set(tid, []);
      renderAisleCards();
      refreshDirty();
    };

    const wireAddAisle = () => {
      if (!hasPersistedStore) return;
      const list = document.getElementById('storeAislesList');
      const emptyCta = document.getElementById('storeAddAisleCtaEmpty');

      if (list) {
        const slotIndex = (cta) => {
          const slot = cta.closest('.store-aisle-slot');
          if (!slot) return undefined;
          const slots = Array.from(list.querySelectorAll('.store-aisle-slot'));
          return slots.indexOf(slot);
        };
        list.addEventListener('click', (e) => {
          const cta = e.target.closest('.store-add-aisle-cta--per-slot');
          if (!cta) return;
          e.preventDefault();
          e.stopPropagation();
          void runAddAisle(slotIndex(cta));
        });
        list.addEventListener('keydown', (e) => {
          const cta = e.target.closest('.store-add-aisle-cta--per-slot');
          if (!cta) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            void runAddAisle(slotIndex(cta));
          }
        });
      }

      if (emptyCta) {
        emptyCta.addEventListener('click', () => void runAddAisle());
        emptyCta.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            void runAddAisle();
          }
        });
      }
    };

    const flushStoreAislesDraft = async (db, sid) => {
      dropLegacyVariantAisleUniqueIndexesInMain(db);
      const { getVisibleCanonicalId, anyIngredientNamed } =
        createIngredientLookupHelpers(db);
      const {
        hasVariantTable: hasVariantLookupTable,
        getIngredientNameById,
        anyVariantForIngredient,
      } = createVariantLookupHelpers(db);
      ingredientCatalog = loadIngredientCatalog(db);
      const hasVariantTable = tableExistsLocal(db, 'ingredient_variants');
      const hasVariantAisleTable = tableExistsLocal(
        db,
        'ingredient_variant_store_location',
      );

      const normalizeAllAisleSpecs = () => {
        for (const r of aisleRows) {
          const currentSpecs = cloneSpecs(aisleItemSpecsByAisle.get(r.id) || []);
          const specs = currentSpecs.length
            ? normalizeSpecsWithCatalog(currentSpecs, ingredientCatalog)
            : parseSpecsFromRaw(
                (aisleItemsByAisle.get(r.id) || []).join('\n'),
                [],
                ingredientCatalog,
              );
          aisleItemSpecsByAisle.set(r.id, specs);
          syncDisplayLinesFromSpecs(r.id);
        }
      };
      normalizeAllAisleSpecs();

      const blockedKeys = new Set();
      const unknownUnique = [];
      const uk = new Set();
      for (const r of aisleRows) {
        const specs = cloneSpecs(aisleItemSpecsByAisle.get(r.id) || []);
        for (const spec of specs) {
          const base = String(spec.baseName || '').trim();
          if (!base) continue;
          const vid = getVisibleCanonicalId(base);
          if (vid) continue;
          if (anyIngredientNamed(base)) blockedKeys.add(normItemKey(base));
          else {
            const k = normItemKey(base);
            if (!uk.has(k)) {
              uk.add(k);
              unknownUnique.push(base);
            }
          }
        }
      }

      if (blockedKeys.size) {
        const sample = [];
        outer: for (const r of aisleRows) {
          for (const spec of aisleItemSpecsByAisle.get(r.id) || []) {
            if (blockedKeys.has(normItemKey(spec.baseName))) {
              sample.push(spec.baseName);
              if (sample.length >= 5) break outer;
            }
          }
        }
        uiToast(
          `Skipped (hidden or deprecated): ${sample.join(', ')}${blockedKeys.size > 5 ? '…' : ''}`,
        );
      }

      if (unknownUnique.length) {
        if (!window.ui?.unknownItems) {
          uiToast('UI not ready.');
          throw { silent: true };
        }
        const resolved = await resolveUnknownIngredientNames({
          db,
          names: unknownUnique,
          title: `New ingredients (${unknownUnique.length})`,
          message:
            unknownUnique.length === 1
              ? 'This ingredient is not in your database. Edit, match it to an existing ingredient, or save it as a new one.'
              : 'These ingredients are not in your database. Edit, match them to existing ingredients, or save them as new ones.',
        });
        if (!resolved) {
          uiToast('Save cancelled.');
          throw { silent: true };
        }

        const replacementMap = resolved.map;
        for (const r of aisleRows) {
          const specs = cloneSpecs(aisleItemSpecsByAisle.get(r.id) || []);
          specs.forEach((spec) => {
            const key = normItemKey(spec.baseName);
            const repl = replacementMap.get(key);
            if (!repl) return;
            spec.baseName = repl;
            spec.baseKey = normItemKey(repl);
          });
          aisleItemSpecsByAisle.set(r.id, specs);
          syncDisplayLinesFromSpecs(r.id);
        }

        const createQueue = [];
        const createSeen = new Set();
        for (const n of resolved.finalNames) {
          const t = String(n || '').trim();
          const k = normItemKey(t);
          if (!t || createSeen.has(k)) continue;
          createSeen.add(k);
          if (anyIngredientNamed(t)) continue;
          createQueue.push(t);
        }

        let ingredientsHasLemma = false;
        try {
          const info = db.exec('PRAGMA table_info(ingredients);');
          const rows = info.length ? info[0].values : [];
          ingredientsHasLemma = rows.some(
            (row) => String((row && row[1]) || '').toLowerCase() === 'lemma',
          );
        } catch (_) {}

        for (const n of createQueue) {
          try {
            // Skip if ingredient already exists by name.
            const existQ = db.exec(
              `SELECT 1 FROM ingredients WHERE lower(name) = lower('${n.replace(/'/g, "''")}') LIMIT 1;`
            );
            if (existQ.length && existQ[0].values.length) continue;

            const cols = ['name'];
            const vals = [n];
            if (ingredientsHasLemma) {
              cols.push('lemma');
              vals.push(deriveIngredientLemmaInMain(n));
            }

            const placeholders = cols.map(() => '?').join(', ');
            db.run(
              `INSERT INTO ingredients (${cols.join(', ')}) VALUES (${placeholders});`,
              vals,
            );
          } catch (e) {
            console.warn('Store editor: insert ingredient', e);
          }
        }
        // New ingredient names should become available in the aisle items suggestions immediately.
        try {
          window.favoriteEatsTypeahead?.invalidate?.();
        } catch (_) {}
        ingredientCatalog = loadIngredientCatalog(db);
        normalizeAllAisleSpecs();
      }

      if (hasVariantLookupTable) {
        const unknownVariantUnique = [];
        const seenUnknownVariants = new Set();
        for (const r of aisleRows) {
          const specs = cloneSpecs(aisleItemSpecsByAisle.get(r.id) || []);
          for (const spec of specs) {
            const base = String(spec.baseName || '').trim();
            if (!base) continue;
            const ingredientId = Number(getVisibleCanonicalId(base));
            if (!Number.isFinite(ingredientId) || ingredientId <= 0) continue;
            const selected = (spec.selectedVariants || []).filter(isSupportedVariantName);
            for (const variantName of selected) {
              if (anyVariantForIngredient(ingredientId, variantName)) continue;
              const key = `${ingredientId}::${normVariantKey(variantName)}`;
              if (!key || seenUnknownVariants.has(key)) continue;
              seenUnknownVariants.add(key);
              unknownVariantUnique.push({
                ingredientId,
                ingredientName: getIngredientNameById(ingredientId) || base,
                variant: variantName,
              });
            }
          }
        }

        if (unknownVariantUnique.length) {
          const resolvedVariants = await resolveUnknownIngredientVariants({
            db,
            entries: unknownVariantUnique,
          });
          if (!resolvedVariants) {
            uiToast('Save cancelled.');
            throw { silent: true };
          }
          const replacementMap = resolvedVariants.map;
          for (const r of aisleRows) {
            const specs = cloneSpecs(aisleItemSpecsByAisle.get(r.id) || []);
            specs.forEach((spec) => {
              const base = String(spec.baseName || '').trim();
              const ingredientId = Number(getVisibleCanonicalId(base));
              if (!Number.isFinite(ingredientId) || ingredientId <= 0) return;
              const nextSelected = [];
              const seenSelected = new Set();
              (spec.selectedVariants || []).forEach((variantName) => {
                const original = String(variantName || '').trim();
                if (!isSupportedVariantName(original)) return;
                const key = `${ingredientId}::${normVariantKey(original)}`;
                const replacement = String(replacementMap.get(key) || original).trim();
                if (!isSupportedVariantName(replacement)) return;
                const replacementKey = normVariantKey(replacement);
                if (!replacementKey || seenSelected.has(replacementKey)) return;
                seenSelected.add(replacementKey);
                nextSelected.push(replacement);
              });
              spec.selectedVariants = nextSelected;
            });
            aisleItemSpecsByAisle.set(r.id, specs);
            syncDisplayLinesFromSpecs(r.id);
          }
        }
      }

      for (const aid of [...deletedAisleIds]) {
        if (hasVariantAisleTable) {
          db.run(
            'DELETE FROM ingredient_variant_store_location WHERE store_location_id = ?;',
            [aid],
          );
        }
        db.run(
          'DELETE FROM ingredient_store_location WHERE store_location_id = ?;',
          [aid],
        );
        db.run('DELETE FROM store_locations WHERE ID = ? AND store_id = ?;', [
          aid,
          sid,
        ]);
      }
      deletedAisleIds.clear();

      const toRemap = aisleRows.filter((r) => r.id < 0);
      for (const r of toRemap) {
        const maxQ = db.exec(
          'SELECT COALESCE(MAX(sort_order), 0) FROM store_locations WHERE store_id = ?;',
          [sid],
        );
        let nextSort = 1;
        if (maxQ.length && maxQ[0].values.length) {
          nextSort = Number(maxQ[0].values[0][0]) + 1;
        }
        db.run(
          'INSERT INTO store_locations (store_id, name, sort_order) VALUES (?, ?, ?);',
          [sid, r.name || 'Aisle', nextSort],
        );
        const idQ = db.exec('SELECT last_insert_rowid();');
        const newId = Number(idQ[0].values[0][0]);
        const oldId = r.id;
        const items = aisleItemsByAisle.get(oldId) || [];
        const specs = cloneSpecs(aisleItemSpecsByAisle.get(oldId) || []);
        aisleItemsByAisle.delete(oldId);
        aisleItemsByAisle.set(newId, [...items]);
        aisleItemSpecsByAisle.delete(oldId);
        aisleItemSpecsByAisle.set(newId, specs);
        r.id = newId;
      }

      aisleRows.forEach((r, index) => {
        const sortOrder = index + 1;
        db.run(
          'UPDATE store_locations SET name = ?, sort_order = ? WHERE ID = ? AND store_id = ?;',
          [r.name || 'Aisle', sortOrder, r.id, sid],
        );
      });

      const compareAisleItemSpecsForSave = (a, b) => {
        const baseA = String(a?.baseName || '').trim();
        const baseB = String(b?.baseName || '').trim();
        const byBase = baseA.localeCompare(baseB, undefined, {
          sensitivity: 'base',
        });
        if (byBase !== 0) return byBase;

        const variantsA = (Array.isArray(a?.selectedVariants) ? a.selectedVariants : [])
          .map((v) => String(v || '').trim())
          .filter(Boolean);
        const variantsB = (Array.isArray(b?.selectedVariants) ? b.selectedVariants : [])
          .map((v) => String(v || '').trim())
          .filter(Boolean);
        const byVariants = variantsA
          .join(', ')
          .localeCompare(variantsB.join(', '), undefined, {
            sensitivity: 'base',
          });
        if (byVariants !== 0) return byVariants;

        return Number(a?.ingredientId || 0) - Number(b?.ingredientId || 0);
      };

      for (const r of aisleRows) {
        const specs = cloneSpecs(aisleItemSpecsByAisle.get(r.id) || [])
          .filter((spec) => !blockedKeys.has(normItemKey(spec.baseName)))
          .sort(compareAisleItemSpecsForSave);
        const resolvedGenericIds = [];
        const seenGenericId = new Set();
        const ensureVariantId = (ingredientId, variantName) => {
          const iid = Number(ingredientId);
          const vv = String(variantName || '').trim();
          if (!Number.isFinite(iid) || !isSupportedVariantName(vv)) return null;
          const q = db.exec(
            `SELECT id
               FROM ingredient_variants
              WHERE ingredient_id = ?
                AND lower(trim(variant)) = lower(trim(?))
              ORDER BY COALESCE(sort_order, 999999), id
              LIMIT 1;`,
            [iid, vv],
          );
          if (q.length && q[0].values.length) return Number(q[0].values[0][0]);
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
          const idQ = db.exec('SELECT last_insert_rowid();');
          if (idQ.length && idQ[0].values.length) return Number(idQ[0].values[0][0]);
          return null;
        };
        db.run(
          'DELETE FROM ingredient_store_location WHERE store_location_id = ?;',
          [r.id],
        );
        if (hasVariantAisleTable) {
          db.run(
            'DELETE FROM ingredient_variant_store_location WHERE store_location_id = ?;',
            [r.id],
          );
        }
        for (const spec of specs) {
          const iid = getVisibleCanonicalId(spec.baseName);
          if (!Number.isFinite(iid)) continue;
          const selected = (spec.selectedVariants || []).filter(isSupportedVariantName);
          if (!seenGenericId.has(iid)) {
            seenGenericId.add(iid);
            resolvedGenericIds.push(iid);
          }
          if (!selected.length || !hasVariantTable || !hasVariantAisleTable) continue;
          const seenVariantKey = new Set();
          for (const vn of selected) {
            const vk = normVariantKey(vn);
            if (!vk || seenVariantKey.has(vk)) continue;
            seenVariantKey.add(vk);
            const variantId = ensureVariantId(iid, vn);
            if (!Number.isFinite(variantId)) continue;
            db.run(
              `INSERT OR IGNORE INTO ingredient_variant_store_location (ingredient_variant_id, store_location_id)
               VALUES (?, ?);`,
              [variantId, r.id],
            );
          }
        }
        for (const iid of resolvedGenericIds) {
          db.run(
            'INSERT INTO ingredient_store_location (ingredient_id, store_location_id) VALUES (?, ?);',
            [iid, r.id],
          );
        }
        aisleItemSpecsByAisle.set(r.id, specs);
        syncDisplayLinesFromSpecs(r.id);
      }
    };

    if (typeof waitForAppBarReady !== 'function') {
      renderAisleCards();
      wireAddAisle();
      return;
    }

    await waitForAppBarReady();
    if (hasPersistedStore) {
      const storeEditorSearchInput = document.getElementById('appBarSearchInput');
      const storeEditorSearchClearBtn = document.getElementById('appBarSearchClear');
      wireAppBarSearch(storeEditorSearchInput, {
        clearBtn: storeEditorSearchClearBtn,
        onQueryChange: (query) => {
          applyStoreEditorSearch(query);
        },
        normalizeQuery: normalizeStoreEditorSearchQuery,
      });
    }
    const pageCtl = wireChildEditorPage({
      backBtn: document.getElementById('appBarBackBtn'),
      cancelBtn: document.getElementById('appBarCancelBtn'),
      saveBtn: document.getElementById('appBarSaveBtn'),
      appBarTitleEl: document.getElementById('appBarTitle'),
      bodyTitleEl: document.getElementById('childEditorTitle'),
      initialTitle: titleText,
      backHref: 'stores.html',
      subtitleEl: document.getElementById('storeLocationSubtitle'),
      initialSubtitle: locTrim,
      normalizeSubtitle: (s) => (s || '').trim(),
      subtitlePlaceholder: 'Add a description.',
      subtitleEmptyMeansHidden: true,
      extraDirtyState: hasPersistedStore
        ? {
            isDirty: () => aislesDraftDirty(),
            onCancel: () => {
              restoreDraftFromSnapshot(draftSnapshot);
              renderAisleCards();
            },
            onAfterSaveSuccess: () => {
              draftSnapshot = cloneDraftSnapshot();
            },
          }
        : null,
      onSave: async ({ title: next, subtitle: nextLoc }) => {
        const sid = sessionStorage.getItem('selectedStoreId');
        const isNewStore =
          sessionStorage.getItem('selectedStoreIsNew') === '1';

        const db = await openStoreEditorDb();
        const id = Number(sid);
        const loc = (nextLoc ?? '').trim();
        let insertedNewStore = false;

        if (Number.isFinite(id)) {
          if (hasPersistedStore) {
            for (const card of document.querySelectorAll('.store-aisle-card')) {
              const aid = Number(card.dataset.aisleId);
              const row = aisleRows.find((r) => r.id === aid);
              if (!row) continue;
              const ne = card.querySelector('.store-aisle-name');
              if (ne) {
                const t = (ne.textContent || '').trim();
                if (t) row.name = t;
              }
              const ta = card.querySelector('textarea');
              if (ta) {
                const currentSpecs = cloneSpecs(aisleItemSpecsByAisle.get(aid) || []);
                const nextSpecs = currentSpecs.length
                  ? normalizeSpecsWithCatalog(currentSpecs, ingredientCatalog)
                  : parseSpecsFromRaw(
                      getAisleTextareaRawDraft(ta),
                      [],
                      ingredientCatalog,
                    );
                aisleItemSpecsByAisle.set(aid, nextSpecs);
                syncDisplayLinesFromSpecs(aid);
              }
            }
            await flushStoreAislesDraft(db, id);
          }
          db.run(
            'UPDATE stores SET chain_name = ?, location_name = ? WHERE ID = ?;',
            [next || '', loc, id],
          );
        } else if (isNewStore || !sid) {
          db.run(
            'INSERT INTO stores (chain_name, location_name) VALUES (?, ?);',
            [next || '', loc],
          );
          const idQ = db.exec('SELECT last_insert_rowid();');
          if (idQ.length && idQ[0].values.length) {
            sessionStorage.setItem(
              'selectedStoreId',
              String(idQ[0].values[0][0]),
            );
          }
          insertedNewStore = true;
        }

        await persistStoreEditorDb(db);
        sessionStorage.setItem('selectedStoreChain', next || '');
        sessionStorage.setItem('selectedStoreLocation', loc);
        sessionStorage.removeItem('selectedStoreIsNew');
        if (insertedNewStore) {
          window.location.reload();
        } else if (hasPersistedStore) {
          renderAisleCards();
        }
      },
    });
    refreshDirty =
      (pageCtl && pageCtl.refreshDirty) ||
      (() => {
        /* noop */
      });
    renderAisleCards();
    wireAddAisle();
  })();
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

// --- Bottom navigation wiring (list pages only) ---
function initBottomNav() {
  const nav = document.querySelector('.bottom-nav');
  if (!nav) return;
  const visibleTopLevelTabs = new Set(getTopLevelPageOrder());
  const topLevelTabLabels = {
    recipes: 'Recipes',
    shopping: 'Items',
    'shopping-list': 'List',
  };

  // Hidden-by-default sheet model: rely on CSS class.
  nav.classList.add('bottom-nav--hidden');

  const pillRow = nav.querySelector('.bottom-nav-pill-row');
  if (
    pillRow instanceof HTMLElement &&
    !pillRow.querySelector('.bottom-nav-pill[data-tab="shopping-list"]')
  ) {
    const shoppingListPill = document.createElement('button');
    shoppingListPill.type = 'button';
    shoppingListPill.className = 'bottom-nav-pill';
    shoppingListPill.dataset.tab = 'shopping-list';
    shoppingListPill.textContent = 'Shopping List';
    const shoppingPill = pillRow.querySelector('.bottom-nav-pill[data-tab="shopping"]');
    if (shoppingPill?.nextSibling) {
      pillRow.insertBefore(shoppingListPill, shoppingPill.nextSibling);
    } else {
      pillRow.appendChild(shoppingListPill);
    }
  }

  if (pillRow instanceof HTMLElement) {
    Array.from(pillRow.querySelectorAll('.bottom-nav-pill')).forEach((pill) => {
      const tab = String(pill.dataset.tab || '').trim();
      if (!visibleTopLevelTabs.has(tab)) {
        pill.remove();
        return;
      }
      const nextLabel = topLevelTabLabels[tab];
      if (nextLabel) pill.textContent = nextLabel;
    });
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

  // Shared toggle handler for menu icon + app-bar title.

  const menuButton = document.getElementById('appBarMenuBtn');
  const titleToggle = document.getElementById('appBarTitle');
  let menuClickCount = 0;
  let menuClickResetTimer = null;
  const MENU_TRIPLE_CLICK_WINDOW_MS = 500;

  const toggleForceWebModeFromMenu = () => {
    const next = !isForceWebModeEnabled();
    setForceWebModeEnabled(next);
    const nextPages = getTopLevelPageOrder();
    const currentPage = String(activeTab || detectPageIdFromBody() || '').trim().toLowerCase();
    const targetPage = nextPages.includes(currentPage) ? currentPage : 'recipes';
    window.location.href = getTopLevelPageHref(targetPage);
  };

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
      menuClickCount += 1;
      if (menuClickResetTimer) {
        window.clearTimeout(menuClickResetTimer);
      }
      menuClickResetTimer = window.setTimeout(() => {
        menuClickCount = 0;
        menuClickResetTimer = null;
      }, MENU_TRIPLE_CLICK_WINDOW_MS);

      if (menuClickCount >= 3) {
        menuClickCount = 0;
        if (menuClickResetTimer) {
          window.clearTimeout(menuClickResetTimer);
          menuClickResetTimer = null;
        }
        toggleForceWebModeFromMenu();
        return;
      }

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

  pills.forEach((pill) => {
    const tab = pill.dataset.tab;
    if (!tab) return;

    if (tab === activeTab) {
      pill.classList.add('bottom-nav-pill--active');
      pill.disabled = true;
    }

    pill.addEventListener('click', () => {
      if (tab === activeTab) return;
      window.location.href = getTopLevelPageHref(tab);
    });
  });
}

function getIngredientTableColumnSet(db) {
  try {
    const q = db.exec('PRAGMA table_info(ingredients);');
    const rows = Array.isArray(q) && q.length > 0 ? q[0].values : [];
    return new Set(rows.map((r) => String((Array.isArray(r) ? r[1] : '') || '').toLowerCase()));
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
      `
    );
    if (!Array.isArray(q) || !q.length || !Array.isArray(q[0].values)) return [];
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
      `
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
        `
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
      `SELECT 1 FROM ingredients WHERE lower(trim(name)) = lower(trim(?)) LIMIT 1;`
    );
    stmt.bind([name]);
    const ok = stmt.step();
    stmt.free();
    if (ok) return true;

    // Fall back to synonym lookup.
    try {
      const synStmt = db.prepare(
        `SELECT 1 FROM ingredient_synonyms WHERE lower(trim(synonym)) = lower(trim(?)) LIMIT 1;`
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
    .map((v) => String(v || '').trim().replace(/\s+/g, ' '))
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
    if (!Array.isArray(q) || !q.length || !Array.isArray(q[0].values)) return [];
    return q[0].values
      .map((row) => (Array.isArray(row) ? row[0] : null))
      .map((v) => String(v || '').trim())
      .filter((v) => v.length > 0);
  } catch (_) {
    return [];
  }
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
    .map((v) => String(v || '').trim().replace(/\s+/g, ' '))
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
         LIMIT 1;`
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
    .map((v) => String(v || '').trim().replace(/\s+/g, ' '))
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
    if (!Array.isArray(q) || !q.length || !Array.isArray(q[0].values)) return [];
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
         LIMIT 1;`
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
         LIMIT 1;`
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
        `SELECT 1 FROM sqlite_master WHERE type='table' AND name='ingredient_variants' LIMIT 1;`
      );
      return !!(Array.isArray(q) && q.length && q[0].values && q[0].values.length);
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
         LIMIT 1;`
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
           AND ${visibilitySql.replaceAll('COALESCE(', 'COALESCE(i.')}
         ORDER BY COALESCE(iv.sort_order, 999999) ASC, iv.id ASC;`,
        [iid]
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
    if (hasVariantTable) {
      try {
        const stmt = db.prepare(
          `SELECT 1
           FROM ingredient_variants iv
           JOIN ingredients i ON i.ID = iv.ingredient_id
           WHERE iv.ingredient_id = ?
             AND lower(trim(iv.variant)) = lower(trim(?))
             AND ${visibilitySql.replaceAll('COALESCE(', 'COALESCE(i.')}
           LIMIT 1;`
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
         LIMIT 1;`
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
    if (!Number.isFinite(iid) || iid <= 0 || !vv || !hasVariantTable) return false;
    try {
      if (anyVariantForIngredient(iid, vv)) return false;
      const maxQ = db.exec(
        `SELECT COALESCE(MAX(sort_order), 0) FROM ingredient_variants WHERE ingredient_id = ?;`,
        [iid]
      );
      const nextSort =
        maxQ.length && maxQ[0].values.length
          ? Number(maxQ[0].values[0][0]) + 1
          : 1;
      db.run(
        `INSERT INTO ingredient_variants (ingredient_id, variant, sort_order)
         VALUES (?, ?, ?);`,
        [iid, vv, nextSort]
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
    const key = String(row?.original || '').trim().toLowerCase();
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
    const key = String(row?.original || '').trim().toLowerCase();
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
    const key = String(row?.original || '').trim().toLowerCase();
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
    const key = String(row?.original || '').trim().toLowerCase();
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

// --- Recipe editor loader ---
async function loadRecipeEditorPage() {
  const isElectron = !!window.electronAPI;
  let db;
  if (isElectron) {
    try {
      const pathHint = localStorage.getItem('favoriteEatsDbPath') || null;
      const bytes = await window.electronAPI.loadDB(pathHint);
      const Uints = new Uint8Array(bytes);
      db = new SQL.Database(Uints);
    } catch (err) {
      console.error('❌ Failed to load DB from disk:', err);
      uiToast('No database loaded. Please go back to the welcome page.');
      window.location.href = 'index.html';
      return;
    }
  } else {
    const stored = localStorage.getItem('favoriteEatsDb');
    if (!stored) {
      uiToast('No database loaded. Please go back to the welcome page.');
      window.location.href = 'index.html';
      return;
    }
    const Uints = new Uint8Array(JSON.parse(stored));
    db = new SQL.Database(Uints);
  }

  const recipeId = sessionStorage.getItem('selectedRecipeId');
  const isNewRecipe = sessionStorage.getItem('selectedRecipeIsNew') === '1';

  if (!recipeId) {
    uiToast('No recipe selected.');
    window.location.href = 'recipes.html';
    return;
  }

  window.dbInstance = db;
  await ensureIngredientLemmaMaintenanceInMain(db, isElectron);
  window.recipeId = recipeId;
  const isRecipeWebMode = isForceWebModeEnabled();
  ensureRecipeTagsSchemaInMain(db);
  ensureSizesSchemaInMain(db);
  ensureUnitsSchemaInMain(db);

  // Notes are recipe-level (stored on recipe_ingredient_map), not shopping-item-level.
  // Ensure the DB has the right column and backfill once for legacy DBs.
  try {
    if (
      window.bridge &&
      typeof bridge.ensureRecipeIngredientMapParentheticalNoteSchema ===
        'function'
    ) {
      bridge.ensureRecipeIngredientMapParentheticalNoteSchema(db);
    }
  } catch (_) {}

  // Fetch via bridge (single source of truth)
  const recipe = bridge.loadRecipeFromDB(db, recipeId);

  if (!recipe) {
    uiToast('Recipe not found.');
    window.location.href = 'recipes.html';
    return;
  }
  // Compatibility shim for existing UI

  if (
    !recipe.servingsDefault &&
    recipe.servings &&
    recipe.servings.default != null
  ) {
    recipe.servingsDefault = recipe.servings.default;
  }

  // Decide when to seed placeholder rows:
  // - brand-new recipes (fresh from "Add")
  // - OR recipes that currently have no steps and no ingredients at all
  const hasAnySteps =
    Array.isArray(recipe.sections) &&
    recipe.sections.some(
      (section) => Array.isArray(section.steps) && section.steps.length > 0,
    );

  const hasAnyIngredients =
    Array.isArray(recipe.sections) &&
    recipe.sections.some(
      (section) =>
        Array.isArray(section.ingredients) && section.ingredients.length > 0,
    );

  // 🔍 Decide seeding separately for steps vs ingredients.
  // - Steps placeholder only for truly empty / brand-new recipes.
  // - Ingredient placeholder any time there are zero ingredients, even if steps exist
  //   (e.g., user edited title + saved but never added ingredients).
  const shouldSeedStepPlaceholder =
    !isRecipeWebMode && (isNewRecipe || (!hasAnySteps && !hasAnyIngredients));

  const shouldSeedIngredientPlaceholder = !isRecipeWebMode && !hasAnyIngredients;

  if (shouldSeedStepPlaceholder || shouldSeedIngredientPlaceholder) {
    if (isNewRecipe) {
      // One-shot flag: once we've initialized a brand-new recipe,
      // we don't treat it as "new" again on future opens.
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

    // Ensure at least one placeholder step (new/empty recipes only)
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
          instructions: 'Add a step.',
          type: 'step',
        },
      ];
    }

    // Allow empty ingredient arrays; UI provides an add CTA instead of data placeholders.
  }

  if (
    isRecipeWebMode &&
    typeof window.recipeWebModePrimeRecipe === 'function'
  ) {
    window.recipeWebModePrimeRecipe(recipe);
  }

  // --- On load/return: keep ingredient order as loaded ---
  try {
    if (typeof window.recipeEditorSortIngredientsOnLoad === 'function') {
      window.recipeEditorSortIngredientsOnLoad(recipe);
    }
  } catch (err) {
    console.warn('⚠️ Ingredient load-order normalization failed:', err);
  }

  const titleEl = document.getElementById('recipeTitle');
  if (titleEl) titleEl.textContent = recipe.title;

  // Shared app bar for recipe editor
  initAppBar({
    mode: 'editor',
    titleText: recipe.title || '',
    showCancel: isRecipeWebMode,
    showSave: !isRecipeWebMode,
    cancelText: isRecipeWebMode ? 'Reset servings' : 'Cancel',
    onBack: () => {
      const goRecipes = () => {
        window.location.href = 'recipes.html';
      };
      if (!isRecipeWebMode && typeof window.recipeEditorAttemptExit === 'function') {
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
      // Recipe editor SoT: the live model (`window.recipeData.title`).
      // The app-bar title is a view; it may lag if the user edited the in-page title.
      const modelTitle = (window.recipeData?.title || '').trim();
      const el = document.getElementById('appBarTitle');
      const next = (modelTitle || el?.textContent || '').trim();
      if (!next) return;

      // Keep in-memory model + visible title in sync
      recipe.title = next;
      if (window.recipeData) window.recipeData.title = next;
      if (el) el.textContent = next;
      const titleEl = document.getElementById('recipeTitle');
      if (titleEl) titleEl.textContent = next;

      // Real save path (DB + persist-to-disk/localStorage), reusing existing helpers
      try {
        try {
          const db = window.dbInstance;
          const recipeModel = window.recipeData;
          if (db && recipeModel && Array.isArray(recipeModel.sections)) {
            ensureSizesSchemaInMain(db);
            const { getVisibleCanonicalId, anyIngredientNamed } =
              createIngredientLookupHelpers(db);
            const { anySelectableUnitCoded } = createUnitLookupHelpers(db);
            const { anyVisibleTagNamed } = createTagLookupHelpers(db);
            const { anySelectableSizeNamed } = createSizeLookupHelpers(db);
            const {
              hasVariantTable: hasIngredientVariantTable,
              getIngredientNameById,
              anyVariantForIngredient,
              ensureVariantForIngredient,
            } = createVariantLookupHelpers(db);
            const unknownUnique = [];
            const seenUnknown = new Set();
            recipeModel.sections.forEach((sec) => {
              const rows = Array.isArray(sec?.ingredients) ? sec.ingredients : [];
              rows.forEach((row) => {
                if (!row || row.isPlaceholder || row.rowType === 'heading') return;
                const linkedRecipeId = Number(row.linkedRecipeId);
                const currentRecipeId = Number(recipeModel.id);
                const isLinkedSubrecipe =
                  !!row.isRecipe &&
                  Number.isFinite(linkedRecipeId) &&
                  linkedRecipeId > 0 &&
                  (!Number.isFinite(currentRecipeId) || linkedRecipeId !== currentRecipeId);
                if (isLinkedSubrecipe) return;
                const rawName = String(row.name || '').trim();
                if (!rawName) return;
                if (getVisibleCanonicalId(rawName)) return;
                if (anyIngredientNamed(rawName)) return;
                const key = rawName.toLowerCase();
                if (seenUnknown.has(key)) return;
                seenUnknown.add(key);
                unknownUnique.push(rawName);
              });
            });

            if (unknownUnique.length) {
              const resolved = await resolveUnknownIngredientNames({
                db,
                names: unknownUnique,
                title: `New ingredients (${unknownUnique.length})`,
                message:
                  unknownUnique.length === 1
                    ? 'This ingredient is not in your database. Edit, match it to an existing ingredient, or save it as a new one.'
                    : 'These ingredients are not in your database. Edit, match them to existing ingredients, or save them as new ones.',
              });
              if (!resolved) {
                uiToast('Save cancelled.');
                return;
              }
              const replacementMap = resolved.map;
              recipeModel.sections.forEach((sec) => {
                const rows = Array.isArray(sec?.ingredients) ? sec.ingredients : [];
                rows.forEach((row) => {
                  if (!row || row.isPlaceholder || row.rowType === 'heading') return;
                  const key = String(row.name || '').trim().toLowerCase();
                  if (!key) return;
                  const nextName = replacementMap.get(key);
                  if (nextName) row.name = nextName;
                });
              });
              if (typeof window.recipeEditorRerenderIngredientsFromModel === 'function') {
                window.recipeEditorRerenderIngredientsFromModel();
              }
            }

            if (hasIngredientVariantTable) {
              const unknownVariantUnique = [];
              const seenUnknownVariants = new Set();
              recipeModel.sections.forEach((sec) => {
                const rows = Array.isArray(sec?.ingredients) ? sec.ingredients : [];
                rows.forEach((row) => {
                  if (!row || row.isPlaceholder || row.rowType === 'heading') return;
                  const linkedRecipeId = Number(row.linkedRecipeId);
                  const currentRecipeId = Number(recipeModel.id);
                  const isLinkedSubrecipe =
                    !!row.isRecipe &&
                    Number.isFinite(linkedRecipeId) &&
                    linkedRecipeId > 0 &&
                    (!Number.isFinite(currentRecipeId) || linkedRecipeId !== currentRecipeId);
                  if (isLinkedSubrecipe) return;
                  const rawName = String(row.name || '').trim();
                  const rawVariant = String(row.variant || '').trim();
                  if (!rawName || !rawVariant) return;
                  const ingredientId = Number(getVisibleCanonicalId(rawName));
                  if (!Number.isFinite(ingredientId) || ingredientId <= 0) return;
                  if (anyVariantForIngredient(ingredientId, rawVariant)) return;
                  const key = `${ingredientId}::${rawVariant.toLowerCase()}`;
                  if (seenUnknownVariants.has(key)) return;
                  seenUnknownVariants.add(key);
                  unknownVariantUnique.push({
                    ingredientId,
                    ingredientName:
                      getIngredientNameById(ingredientId) || rawName,
                    variant: rawVariant,
                  });
                });
              });
              if (unknownVariantUnique.length) {
                const resolvedVariants = await resolveUnknownIngredientVariants({
                  db,
                  entries: unknownVariantUnique,
                });
                if (!resolvedVariants) {
                  uiToast('Save cancelled.');
                  return;
                }
                const variantReplacementMap = resolvedVariants.map;
                recipeModel.sections.forEach((sec) => {
                  const rows = Array.isArray(sec?.ingredients) ? sec.ingredients : [];
                  rows.forEach((row) => {
                    if (!row || row.isPlaceholder || row.rowType === 'heading') return;
                    const rawName = String(row.name || '').trim();
                    const rawVariant = String(row.variant || '').trim();
                    if (!rawName || !rawVariant) return;
                    const ingredientId = Number(getVisibleCanonicalId(rawName));
                    if (!Number.isFinite(ingredientId) || ingredientId <= 0) return;
                    const key = `${ingredientId}::${rawVariant.toLowerCase()}`;
                    const nextVariant = String(
                      variantReplacementMap.get(key) || ''
                    ).trim();
                    if (nextVariant) row.variant = nextVariant;
                  });
                });
                if (
                  typeof window.recipeEditorRerenderIngredientsFromModel === 'function'
                ) {
                  window.recipeEditorRerenderIngredientsFromModel();
                }
              }

              const ensuredVariantKeys = new Set();
              recipeModel.sections.forEach((sec) => {
                const rows = Array.isArray(sec?.ingredients) ? sec.ingredients : [];
                rows.forEach((row) => {
                  if (!row || row.isPlaceholder || row.rowType === 'heading') return;
                  const rawName = String(row.name || '').trim();
                  const rawVariant = String(row.variant || '').trim();
                  if (!rawName || !rawVariant) return;
                  const ingredientId = Number(getVisibleCanonicalId(rawName));
                  if (!Number.isFinite(ingredientId) || ingredientId <= 0) return;
                  const key = `${ingredientId}::${rawVariant.toLowerCase()}`;
                  if (ensuredVariantKeys.has(key)) return;
                  ensuredVariantKeys.add(key);
                  if (!anyVariantForIngredient(ingredientId, rawVariant)) {
                    ensureVariantForIngredient(ingredientId, rawVariant);
                  }
                });
              });
            }

            const unknownUnitUnique = [];
            const seenUnknownUnits = new Set();
            recipeModel.sections.forEach((sec) => {
              const rows = Array.isArray(sec?.ingredients) ? sec.ingredients : [];
              rows.forEach((row) => {
                if (!row || row.isPlaceholder || row.rowType === 'heading') return;
                const rawUnit = String(row.unit || '').trim();
                if (!rawUnit) return;
                const key = rawUnit.toLowerCase();
                if (seenUnknownUnits.has(key)) return;
                seenUnknownUnits.add(key);
                if (anySelectableUnitCoded(rawUnit)) return;
                unknownUnitUnique.push(rawUnit);
              });
            });
            if (unknownUnitUnique.length) {
              const resolvedUnits = await resolveUnknownUnitCodes({
                db,
                units: unknownUnitUnique,
                title: `New units (${unknownUnitUnique.length})`,
                message:
                  unknownUnitUnique.length === 1
                    ? 'This unit is not in your database. Edit, match it to an existing unit, or save it as a new one.'
                    : 'These units are not in your database. Edit, match them to existing units, or save them as new ones.',
              });
              if (!resolvedUnits) {
                uiToast('Save cancelled.');
                return;
              }
              const replacementMap = resolvedUnits.map;
              recipeModel.sections.forEach((sec) => {
                const rows = Array.isArray(sec?.ingredients) ? sec.ingredients : [];
                rows.forEach((row) => {
                  if (!row || row.isPlaceholder || row.rowType === 'heading') return;
                  const key = String(row.unit || '').trim().toLowerCase();
                  if (!key) return;
                  const nextUnit = replacementMap.get(key);
                  if (nextUnit) row.unit = nextUnit;
                });
              });
              if (typeof window.recipeEditorRerenderIngredientsFromModel === 'function') {
                window.recipeEditorRerenderIngredientsFromModel();
              }
            }

            const unknownSizeUnique = [];
            const seenUnknownSizes = new Set();
            recipeModel.sections.forEach((sec) => {
              const rows = Array.isArray(sec?.ingredients) ? sec.ingredients : [];
              rows.forEach((row) => {
                if (!row || row.isPlaceholder || row.rowType === 'heading') return;
                const rawSize = String(row.size || '').trim();
                if (!rawSize) return;
                const key = rawSize.toLowerCase();
                if (seenUnknownSizes.has(key)) return;
                seenUnknownSizes.add(key);
                if (anySelectableSizeNamed(rawSize)) return;
                unknownSizeUnique.push(rawSize);
              });
            });
            if (unknownSizeUnique.length) {
              const resolvedSizes = await resolveUnknownSizeNames({
                db,
                sizes: unknownSizeUnique,
                title: `New sizes (${unknownSizeUnique.length})`,
                message:
                  unknownSizeUnique.length === 1
                    ? 'This size is not in your database. Edit, match it to an existing size, or save it as a new one.'
                    : 'These sizes are not in your database. Edit, match them to existing sizes, or save them as new ones.',
              });
              if (!resolvedSizes) {
                uiToast('Save cancelled.');
                return;
              }
              const replacementMap = resolvedSizes.map;
              recipeModel.sections.forEach((sec) => {
                const rows = Array.isArray(sec?.ingredients) ? sec.ingredients : [];
                rows.forEach((row) => {
                  if (!row || row.isPlaceholder || row.rowType === 'heading') return;
                  const key = String(row.size || '').trim().toLowerCase();
                  if (key) {
                    const nextSize = replacementMap.get(key);
                    if (nextSize) row.size = nextSize;
                  }
                  if (!Array.isArray(row.substitutes)) return;
                  row.substitutes.forEach((sub) => {
                    if (!sub) return;
                    const subKey = String(sub.size || '').trim().toLowerCase();
                    if (!subKey) return;
                    const nextSubSize = replacementMap.get(subKey);
                    if (nextSubSize) sub.size = nextSubSize;
                  });
                });
              });
              if (typeof window.recipeEditorRerenderIngredientsFromModel === 'function') {
                window.recipeEditorRerenderIngredientsFromModel();
              }
            }

            const normalizedDraftTags = normalizeRecipeTagDraftList(recipeModel.tags);
            const unknownTagUnique = [];
            const seenUnknownTags = new Set();
            normalizedDraftTags.forEach((tag) => {
              const key = String(tag || '').trim().toLowerCase();
              if (!key || seenUnknownTags.has(key)) return;
              seenUnknownTags.add(key);
              if (anyVisibleTagNamed(tag)) return;
              unknownTagUnique.push(tag);
            });
            if (unknownTagUnique.length) {
              const resolvedTags = await resolveUnknownTagNames({
                db,
                tags: unknownTagUnique,
                title: `New tags (${unknownTagUnique.length})`,
                message:
                  unknownTagUnique.length === 1
                    ? 'This tag is not in your database. Edit, match it to an existing tag, or save it as a new one.'
                    : 'These tags are not in your database. Edit, match them to existing tags, or save them as new ones.',
              });
              if (!resolvedTags) {
                uiToast('Save cancelled.');
                return;
              }
              const replacementMap = resolvedTags.map;
              recipeModel.tags = normalizeRecipeTagDraftList(
                normalizedDraftTags.map((tag) => {
                  const key = String(tag || '').trim().toLowerCase();
                  return replacementMap.get(key) || tag;
                })
              );
            } else {
              recipeModel.tags = normalizedDraftTags;
            }

          }
        } catch (unknownErr) {
          console.warn('Unknown-item resolution skipped:', unknownErr);
        }

        if (typeof saveRecipeToDB === 'function') {
          await saveRecipeToDB();
        }

        // Persist SQL.js memory to disk (Electron) or localStorage (browser fallback)
        if (!window.dbInstance) throw new Error('No active database found');
        const binaryArray = window.dbInstance.export();
        const isElectron = !!window.electronAPI;

        if (isElectron) {
          const ok = await window.electronAPI.saveDB(binaryArray, {
            overwriteOnly: false,
          });
          if (ok) uiToast('Database saved successfully.');
          else uiToast('Save failed — check console for details.');
        } else {
          localStorage.setItem(
            'favoriteEatsDb',
            JSON.stringify(Array.from(binaryArray)),
          );
        }

        // Refresh Cancel baseline after a successful save
        if (window.bridge && typeof bridge.loadRecipeFromDB === 'function') {
          const refreshed = bridge.loadRecipeFromDB(
            window.dbInstance,
            window.recipeId,
          );
          window.originalRecipeSnapshot = JSON.parse(JSON.stringify(refreshed));
          window.recipeData = JSON.parse(JSON.stringify(refreshed));
        }

        // Reset editor UI state after save
        if (typeof window.recipeEditorResetDirty === 'function') {
          window.recipeEditorResetDirty();
        } else {
          const appCancel = document.getElementById('appBarCancelBtn');
          if (appCancel) appCancel.disabled = true;
          if (typeof disableSave === 'function') disableSave();
        }
        if (typeof clearSelectedStep === 'function') clearSelectedStep();
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
      cancelBtn.textContent = 'Cancel';
      cancelBtn.disabled = false;
      return;
    }
    cancelBtn.textContent = 'Reset servings';
    cancelBtn.disabled =
      typeof window.recipeWebModeCanResetServings === 'function'
        ? !window.recipeWebModeCanResetServings(window.recipeData || recipe)
        : true;
  };
  window.recipeWebModeSyncAppBar();

  renderRecipe(recipe);

  // ✅ One-time reset after first render
  if (!isRecipeWebMode && typeof revertChanges === 'function') {
    revertChanges();
  }

  // --- Always scroll editor to top on load ---
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

document.addEventListener('DOMContentLoaded', () => {
  // (intentionally empty) legacy DOMContentLoaded wiring removed
});
