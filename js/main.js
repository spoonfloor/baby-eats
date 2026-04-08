// Shared SQL.js init (offline / local version)
let SQL;

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
const FORCE_WEB_MODE_MENU_ENABLED = true;

function isForceWebModeMenuEnabled() {
  return FORCE_WEB_MODE_MENU_ENABLED;
}

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
    ? ['recipes', 'shopping', 'shopping-list']
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

function renderTopLevelEmptyState(listEl, message) {
  if (!(listEl instanceof HTMLElement)) return;
  listEl.innerHTML = '';
  const li = document.createElement('li');
  li.className = 'list-section-label top-level-empty-state';
  li.textContent = String(message || '').trim();
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
const SHOPPING_PLAN_STORAGE_KEY = 'favoriteEats:shopping-plan:v1';
const SHOPPING_PLAN_KEY_SEP = '\x00';
let shoppingPlanCache = null;

function loadRecipeWebServingsMap() {
  try {
    const raw = localStorage.getItem(window.favoriteEatsStorageKeys.recipeWebServings);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function getRecipeWebServingsStoredValue(recipeId) {
  const normalizedId = Number(recipeId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) return null;
  const raw = loadRecipeWebServingsMap()[String(Math.trunc(normalizedId))];
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
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

function createEmptyShoppingPlan() {
  return {
    version: 1,
    itemSelections: {},
    recipeSelections: {},
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

function getRecipeDerivedShoppingPlanRows({ db = window.dbInstance } = {}) {
  if (!db || typeof db.exec !== 'function') return [];
  if (
    !window.bridge ||
    typeof window.bridge.loadRecipeFromDB !== 'function'
  ) {
    return [];
  }
  const aggregate = new Map();

  Object.values(getShoppingPlanRecipeSelections()).forEach((selection) => {
    const recipeId = Number(selection?.recipeId);
    const recipeCount = Number(selection?.quantity || 0);
    if (!Number.isFinite(recipeId) || recipeId <= 0) return;
    if (!Number.isFinite(recipeCount) || recipeCount <= 0) return;

    let recipe = null;
    try {
      recipe = window.bridge.loadRecipeFromDB(db, recipeId);
    } catch (_) {
      recipe = null;
    }
    if (!recipe || !Array.isArray(recipe.sections)) return;
    const recipeDefaultServings = Number(
      recipe?.servings?.default != null
        ? recipe.servings.default
        : recipe?.servingsDefault
    );
    const selectedServings = getRecipeWebServingsStoredValue(recipeId);
    const servingsMultiplier =
      Number.isFinite(recipeDefaultServings) &&
      recipeDefaultServings > 0 &&
      Number.isFinite(selectedServings) &&
      selectedServings > 0
        ? selectedServings / recipeDefaultServings
        : 1;

    recipe.sections.forEach((section) => {
      const ingredients = Array.isArray(section?.ingredients)
        ? section.ingredients
        : [];
      ingredients.forEach((line) => {
        if (!line || line.rowType === 'heading' || line.isAlt || line.isRecipe) {
          return;
        }
        const name = String(line.name || '').trim();
        if (!name) return;
        const variantName = String(line.variant || '').trim();
        const key = getShoppingPlanAggregateKey(name, variantName);
        if (!key) return;
        const ingredientCount = getRecipeIngredientShoppingCount(line);
        if (!Number.isFinite(ingredientCount) || ingredientCount <= 0) return;
        const nextQuantity = ingredientCount * recipeCount * servingsMultiplier;
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
      });
    });
  });

  return Array.from(aggregate.values());
}

function getShoppingPlanSelectionRows(options = {}) {
  const aggregate = new Map();
  const addRow = (entry) => {
    if (!entry || typeof entry !== 'object') return;
    const label = String(entry.label || '').trim();
    const quantity = Number(entry.quantity || 0);
    const key =
      String(entry.key || '').trim() ||
      getShoppingPlanAggregateKey(entry.name, entry.variantName);
    if (!key || !label || !Number.isFinite(quantity)) return;
    const existing = aggregate.get(key);
    if (existing) {
      existing.quantity += quantity;
      return;
    }
    aggregate.set(key, { key, label, quantity });
  };

  Object.values(getShoppingPlanItemSelections()).forEach((entry) => {
    const name = String(entry?.name || '').trim();
    const variantName = String(entry?.variantName || '').trim();
    addRow({
      key: getShoppingPlanAggregateKey(name, variantName),
      label: getShoppingPlanSelectionLabel({ name, variantName }),
      quantity: Number(entry?.quantity || 0),
    });
  });

  getRecipeDerivedShoppingPlanRows(options).forEach(addRow);

  return Array.from(aggregate.values())
    .filter((entry) => Number(entry.quantity || 0) > 1e-9)
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, {
        sensitivity: 'base',
      }),
    );
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

function enableTopLevelListKeyboardNav(listEl) {
  if (!(listEl instanceof Element)) return null;

  // Marks this list so CSS can avoid showing a second "hover highlight"
  // when keyboard selection moves off the hovered row.
  listEl.classList.add('top-level-kbd-nav');

  // Start with *no* selection. Hover or arrow keys will select.
  let selectedIdx = -1;
  let selectionSource = null; // 'hover' | 'keyboard' | null

  const isModalOpen = () => {
    try {
      if (window.ui && typeof window.ui.isDialogOpen === 'function') {
        return !!window.ui.isDialogOpen();
      }
    } catch (_) {}
    // Legacy fallback (older static modals)
    return !!document.querySelector('.modal:not(.hidden)');
  };
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

  const setSelectedIdx = (idx) => {
    selectedIdx = idx;
    applySelection();
  };

  // Hover should not be a competing highlight; it should *move selection*.
  listEl.addEventListener('mouseover', (e) => {
    const li = e.target?.closest?.('li');
    if (!li || !listEl.contains(li)) return;
    const rows = getRows();
    const idx = rows.indexOf(li);
    if (idx >= 0) {
      selectionSource = 'hover';
      setSelectedIdx(idx);
    }
  });

  // If the mouse is not over a hover target (li), clear hover-driven selection.
  const clearHoverSelectionIfNeeded = (e) => {
    if (selectionSource !== 'hover') return;
    const li = e?.target?.closest?.('li');
    if (li && listEl.contains(li)) return;
    selectionSource = null;
    setSelectedIdx(-1);
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
      // Treat click as a "committed" selection so it doesn't get cleared on mouseout.
      selectionSource = 'keyboard';
      selectedIdx = idx;
    }
  });

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

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        // If nothing selected yet, Down selects the first row.
        if (selectedIdx < 0) {
          selectionSource = 'keyboard';
          setSelectedIdx(0);
          return;
        }
        selectionSource = 'keyboard';
        setSelectedIdx(Math.min(selectedIdx + 1, rows.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        // If nothing selected yet, Up selects the last row.
        if (selectedIdx < 0) {
          selectionSource = 'keyboard';
          setSelectedIdx(rows.length - 1);
          return;
        }
        selectionSource = 'keyboard';
        setSelectedIdx(Math.max(selectedIdx - 1, 0));
        return;
      }

      if (e.key === 'Enter') {
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
    setRecipeQty(recipeId, getRecipeQty(recipeId) + delta);
    const recipeRow = recipeRows.find((row) => Number(row?.id) === Number(recipeId));
    setShoppingPlanRecipeSelection({
      recipeId,
      title: recipeRow?.title || '',
      quantity: getRecipeQty(recipeId),
    });
    recipeRowStepperController?.activate(getRecipeQtyKey(recipeId));
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
      db.run('INSERT INTO recipes (title) VALUES (?);', [title]);
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
      recipesActionBtn.textContent = 'Clear recipes';
      recipesActionBtn.addEventListener('click', () => {
        void (async () => {
          if (!Object.keys(getShoppingPlanRecipeSelections()).length) {
            uiToast('No recipe selections to clear.');
            return;
          }
          const ok = await uiConfirm({
            title: 'Clear recipes?',
            message:
              'Clear recipe selections only? Direct item counts will stay.',
            confirmText: 'Clear recipes',
            cancelText: 'Cancel',
            danger: true,
          });
          if (!ok) return;
          clearShoppingPlanSelections({ clearRecipes: true });
          recipeQuantities.clear();
          recipeRowStepperController?.collapseAll?.();
          syncRecipesActionButtonState();
          rerenderFilteredRecipes();
          uiToast('Recipe selections cleared.');
        })();
      });
    } else {
      recipesActionBtn.addEventListener('click', () => {
        void openCreateRecipeDialog(db);
      });
    }
  }

  // --- Search bar logic with clear button ---

  const clearBtn = document.getElementById('appBarSearchClear');

  if (searchInput && clearBtn) {
    clearBtn.style.display = 'none';

    // Filter recipes as user types
    searchInput.addEventListener('input', () => {
      clearBtn.style.display = searchInput.value ? 'inline' : 'none';
      searchQuery = searchInput.value.trim().toLowerCase();
      rerenderFilteredRecipes();
    });

    // Clear input on × click and restore full list
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      searchQuery = '';
      rerenderFilteredRecipes();
      searchInput.focus();
    });

    // Prevent Enter from doing anything weird
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        searchInput.blur();
      }
    });
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
  const scrollToShoppingNavTarget = (target) => {
    if (!target) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          const row = Array.from(list.querySelectorAll('li')).find((li) => {
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
  const baseSelectSql = hasVariantTable
    ? `
      SELECT i.ID,
             i.name,
             COALESCE(v.variant, i.variant) AS variant,
             ${deprecatedExpr} AS is_deprecated,
             ${isHiddenExpr} AS is_hidden,
             ${homeExpr} AS location_at_home,
             ${isFoodExpr} AS is_food
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
             ${isFoodExpr} AS is_food
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
      ([id, name, variant, isDeprecated, isHidden, locationAtHome, isFood]) => ({
        id,
        name,
        variant: variant || '',
        isDeprecated: Number(isDeprecated || 0) === 1,
        isHidden: Number(isHidden || 0) === 1,
        locationAtHome: String(locationAtHome || ''),
        isFood: Number(isFood ?? 1) === 1,
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
      delete item._deprecatedFlags;
      delete item._hiddenFlags;
      delete item._homeLocations;
      delete item._foodFlags;

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
    const numeric = Number(currentQty);
    if (!Number.isFinite(numeric)) return delta > 0 ? 1 : 0;
    if (delta > 0 && Math.abs(numeric - Math.round(numeric)) > SHOPPING_QTY_EPSILON) {
      return Math.ceil(numeric);
    }
    if (delta < 0 && Math.abs(numeric - Math.round(numeric)) > SHOPPING_QTY_EPSILON) {
      return Math.floor(numeric);
    }
    return Math.max(0, numeric + delta);
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
    setShoppingQty(key, getNextShoppingStepQty(qty, delta), { itemName });
    refreshShoppingSelectionUi({ activeKey: key });
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

  const normalizeLocationForChip = (raw) => {
    const v = String(raw || '').trim().toLowerCase();
    if (!v || v === 'measures') return 'none';
    const known = shoppingLocationChipDefs.some((c) => c.id === v);
    return known ? v : 'none';
  };

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
    const query = (searchInput?.value || '').trim();
    if (clearBtn) clearBtn.style.display = query ? 'inline' : 'none';
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
      const hasVariants = Array.isArray(item.variants) && item.variants.length > 0;
      const webSelectMode = isShoppingWebSelectMode();

      // ── Expandable variant row (web select mode only) ──
      if (hasVariants && webSelectMode) {
        li.classList.add('shopping-variant-parent');
        const itemKey = getShoppingSelectionKey(baseName);
        li.dataset.variantParentKey = itemKey;
        const isExpanded = expandedVariantItems.has(itemKey);
        li.dataset.expanded = isExpanded ? 'true' : 'false';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'shopping-list-row-label';
        labelSpan.textContent = baseName;

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
            labelSpan.textContent = `${baseName} \u25B4`;
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
                const nextText = buildLineToFit(li, baseName, item.variants, qtyMap);
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
            setShoppingQty(varKey, getNextShoppingStepQty(qty, delta), {
              itemName: baseName,
              variantName,
            });
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
            const wantsRemove = event.ctrlKey || event.metaKey;
            if (wantsRemove) return;
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
          if (wantsRemove) {
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
          if (isShoppingWebSelectMode()) {
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
        li.title = `${baseName}\n\nAll variants: ${item.variants.join(', ')}`;

        return; // next item
      }

      // ── Simple row (no variants, or non-web-mode) ──
      const labelSpan = document.createElement('span');
      labelSpan.className = 'shopping-list-row-label';
      labelSpan.textContent = baseName;
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
        if (wantsRemove) {
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

        if (isShoppingWebSelectMode()) {
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
              const nextText = buildLineToFit(li, baseName, item.variants, qtyMap);
              labelSpan.textContent = nextText;
              li.title = `${baseName}\n\nAll variants: ${item.variants.join(', ')}`;
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

  // Search + chips: filter by name/variant text and active chip states.
  if (searchInput && clearBtn) {
    searchInput.addEventListener('input', () => {
      applyShoppingFilters();
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      applyShoppingFilters();
      searchInput.focus();
    });

    // Prevent Enter from doing anything weird
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        searchInput.blur();
      }
    });
  }

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
      addBtn.textContent = 'Clear all';
      addBtn.addEventListener('click', () => {
        void (async () => {
          const hasItemSelections =
            Object.keys(getShoppingPlanItemSelections()).length > 0;
          const hasRecipeSelections =
            Object.keys(getShoppingPlanRecipeSelections()).length > 0;
          if (!hasItemSelections && !hasRecipeSelections) {
            uiToast('No shopping selections to clear.');
            return;
          }
          const ok = await uiConfirm({
            title: 'Clear all?',
            message:
              'Clear all shopping selections? This removes item and recipe counts.',
            confirmText: 'Clear all',
            cancelText: 'Cancel',
            danger: true,
          });
          if (!ok) return;
          clearShoppingPlanSelections({ clearItems: true, clearRecipes: true });
          shoppingQuantities.clear();
          shoppingRecipeQuantities.clear();
          selectedShoppingNames.clear();
          shoppingSelectionMeta.clear();
          collapseExpandedVariantRows();
          shoppingRowStepperController?.collapseAll?.();
          refreshShoppingSelectionUi();
          syncShoppingActionButtonState();
          uiToast('All shopping selections cleared.');
        })();
      });
    } else {
      addBtn.addEventListener('click', () => {
        void openCreateShoppingItemDialog();
      });
    }
  }
}

async function loadShoppingListPage() {
  const list = document.getElementById('shoppingListOutput');

  initAppBar({
    mode: 'list',
    titleText: 'Shopping List',
    showSearch: false,
    showAdd: false,
  });

  if (typeof waitForAppBarReady === 'function') {
    await waitForAppBarReady();
  }
  initBottomNav();

  if (!list) return;

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
  const rows = getShoppingPlanSelectionRows({ db });

  list.innerHTML = '';
  if (!rows.length) {
    renderTopLevelEmptyState(
      list,
      'No shopping list yet. Select some shopping items or recipes.',
    );
    listNav?.syncAfterRender?.();
    return;
  }

  rows.forEach((row) => {
    const li = document.createElement('li');
    li.textContent = `${row.label} ${formatShoppingPlanQuantity(row.quantity)}x`;
    list.appendChild(li);
  });

  listNav?.syncAfterRender?.();
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
    const query = (searchInput?.value || '').trim();
    if (clearBtn) clearBtn.style.display = query ? 'inline' : 'none';
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

  // Search: filter by code/name/category (case-insensitive)
  if (searchInput && clearBtn) {
    searchInput.addEventListener('input', () => {
      applyUnitFilters();
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      applyUnitFilters();
      searchInput.focus();
    });

    // Prevent Enter from doing anything weird
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        searchInput.blur();
      }
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

  if (searchInput && clearBtn) {
    clearBtn.style.display = 'none';
    searchInput.addEventListener('input', () => {
      clearBtn.style.display = searchInput.value ? 'inline' : 'none';
      renderTags(applyTagSearchFilter(tagRows));
    });
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      renderTags(tagRows);
      searchInput.focus();
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        searchInput.blur();
      }
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

  if (searchInput && clearBtn) {
    clearBtn.style.display = 'none';
    searchInput.addEventListener('input', () => {
      clearBtn.style.display = searchInput.value ? 'inline' : 'none';
      applySizeFilters();
    });
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      applySizeFilters();
      searchInput.focus();
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        searchInput.blur();
      }
    });
  }

  const applySizeFilters = () => {
    const query = (searchInput?.value || '').trim();
    if (clearBtn) clearBtn.style.display = query ? 'inline' : 'none';
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
  const addBtn = document.getElementById('appBarAddBtn');

  if (!list) return;

  // Keyboard selection + Enter activation for list rows.
  const listNav = enableTopLevelListKeyboardNav(list);

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
      id,
      chain,
      location,
    }));
  }

  function renderStoresList(rows) {
    list.innerHTML = '';
    const items = Array.isArray(rows) ? rows : [];
    if (!items.length) {
      renderTopLevelEmptyState(list, 'No stores yet. Add a store.');
      listNav?.syncAfterRender?.();
      return;
    }

    items.forEach((store) => {
      const li = document.createElement('li');

      // Display exactly as stored (no forced capitalization)
      const chain = store.chain || '';

      const location = store.location || '';

      li.textContent = location ? `${chain} (${location})` : chain || '';

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

        // Persist
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
          console.error('❌ Failed to persist DB after deleting store:', err);
        }

        return true;
      };

      li.addEventListener('click', (event) => {
        const wantsDelete = event.ctrlKey || event.metaKey;
        if (wantsDelete) {
          event.preventDefault();
          event.stopPropagation();
          const label = location ? `${chain} (${location})` : chain || 'Store';
          void (async () => {
            const ok = await deleteStoreDeep(Number(store.id), label);
            if (ok) window.location.reload();
          })();
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
        const label = location ? `${chain} (${location})` : chain || 'Store';
        void (async () => {
          const ok = await deleteStoreDeep(Number(store.id), label);
          if (ok) window.location.reload();
        })();
      });

      list.appendChild(li);
    });

    // Keep selection valid after rerender (search/filter changes).
    listNav?.syncAfterRender?.();
  }

  // Initial render
  renderStoresList(storeRows);

  // Search: filter by chain and location (case-insensitive)
  if (searchInput && clearBtn) {
    clearBtn.style.display = 'none';

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      clearBtn.style.display = query ? 'inline' : 'none';

      if (!query) {
        renderStoresList(storeRows);
        return;
      }

      const filtered = storeRows.filter((store) => {
        const chain = (store.chain || '').toLowerCase();
        const location = (store.location || '').toLowerCase();
        return chain.includes(query) || location.includes(query);
      });

      renderStoresList(filtered);
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      renderStoresList(storeRows);
      searchInput.focus();
    });

    // Prevent Enter from doing anything weird
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        searchInput.blur();
      }
    });
  }

  async function openCreateStoreDialog() {
    if (!window.ui) {
      uiToast('UI not ready yet.');
      return;
    }

    const chain = await window.ui.prompt({
      title: 'New Store',
      label: 'Name',
      value: '',
      confirmText: 'Create',
      cancelText: 'Cancel',
      required: true,
      normalize: (v) => (v || '').trim(),
    });
    if (!chain) return;

    let newId = null;
    try {
      // Store schema requires both chain_name and location_name.
      db.run('INSERT INTO stores (chain_name, location_name) VALUES (?, ?);', [
        chain,
        '',
      ]);
      const idQ = db.exec('SELECT last_insert_rowid();');
      if (idQ.length && idQ[0].values.length) {
        newId = idQ[0].values[0][0];
      }
    } catch (err) {
      console.error('❌ Failed to create store:', err);
      uiToast('Failed to create store. See console for details.');
      return;
    }

    try {
      const binaryArray = db.export();
      const isElectronEnv = !!window.electronAPI;
      if (isElectronEnv) {
        const ok = await window.electronAPI.saveDB(binaryArray);
        if (ok === false) {
          uiToast('Failed to save database after creating store.');
          return;
        }
      } else {
        localStorage.setItem(
          'favoriteEatsDb',
          JSON.stringify(Array.from(binaryArray)),
        );
      }
    } catch (err) {
      console.error('❌ Failed to persist DB after creating store:', err);
      uiToast('Failed to save database after creating store.');
      return;
    }

    if (newId != null) {
      sessionStorage.setItem('selectedStoreId', String(newId));
      sessionStorage.setItem('selectedStoreChain', chain);
      sessionStorage.setItem('selectedStoreLocation', '');
      sessionStorage.setItem('selectedStoreIsNew', '1');
      window.location.href = 'storeEditor.html';
    }
  }

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      void openCreateStoreDialog();
    });
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

    initAppBar({ mode: 'editor', titleText });

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
              closeOnEmptyQuery: true,
              openOnlyWhenQueryNonEmpty: true,
              // Avoid suggestion flicker when pasting a whole list.
              ignoreInputTypes: ['insertFromPaste', 'insertFromDrop'],
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
          escBaseline = parseUniqueItemLines(ta.value);
          escBaselineText = ta.value;
        });

        ta.addEventListener('input', () => {
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
            try {
              ta.__feAutoGrowResize?.();
            } catch (_) {}
            refreshDirty();
          }, 0);
        });

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
          const specs = parseSpecsFromRaw(
            (aisleItemsByAisle.get(r.id) || []).join('\n'),
            aisleItemSpecsByAisle.get(r.id) || [],
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
          if (!selected.length || !hasVariantTable || !hasVariantAisleTable) {
            if (seenGenericId.has(iid)) continue;
            seenGenericId.add(iid);
            resolvedGenericIds.push(iid);
            continue;
          }
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
                const nextSpecs = parseSpecsFromRaw(
                  ta.value,
                  aisleItemSpecsByAisle.get(aid) || [],
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

  let forceWebModeButton = null;

  const syncForceWebModeButton = () => {
    if (!(forceWebModeButton instanceof HTMLButtonElement)) return;
    const enabled = isForceWebModeEnabled();
    forceWebModeButton.textContent = 'Web mode';
    forceWebModeButton.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    forceWebModeButton.classList.toggle('bottom-nav-pill--active', enabled);
    forceWebModeButton.dataset.forceWebMode = enabled ? 'on' : 'off';
  };

  if (pillRow instanceof HTMLElement && isForceWebModeMenuEnabled()) {
    forceWebModeButton = document.createElement('button');
    forceWebModeButton.type = 'button';
    forceWebModeButton.hidden = true;
    forceWebModeButton.className =
      'bottom-nav-pill bottom-nav-pill--force-web-mode';
    syncForceWebModeButton();
    forceWebModeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const next = !isForceWebModeEnabled();
      setForceWebModeEnabled(next);
      const nextPages = getTopLevelPageOrder();
      const currentPage = String(activeTab || detectPageIdFromBody() || '').trim().toLowerCase();
      const targetPage = nextPages.includes(currentPage) ? currentPage : 'recipes';
      window.location.href = getTopLevelPageHref(targetPage);
    });
    pillRow.appendChild(forceWebModeButton);
  }

  const setForceWebModeToggleVisible = (visible) => {
    if (!(forceWebModeButton instanceof HTMLButtonElement)) return;
    forceWebModeButton.hidden = !visible;
    if (visible) syncForceWebModeButton();
  };

  const shouldRevealForceWebModeToggle = (revealForceWebMode = false) =>
    !!(isForceWebModeEnabled() || (revealForceWebMode && isForceWebModeMenuEnabled()));

  const closeNav = () => {
    nav.classList.add('bottom-nav--hidden');
    setForceWebModeToggleVisible(false);
  };

  const openNav = ({ revealForceWebMode = false } = {}) => {
    setForceWebModeToggleVisible(
      shouldRevealForceWebModeToggle(revealForceWebMode)
    );
    nav.classList.remove('bottom-nav--hidden');
  };

  const toggleNavVisibility = ({ revealForceWebMode = false } = {}) => {
    if (nav.classList.contains('bottom-nav--hidden')) {
      openNav({ revealForceWebMode });
      return;
    }
    if (revealForceWebMode && isForceWebModeMenuEnabled()) {
      setForceWebModeToggleVisible(true);
      return;
    }
    closeNav();
  };

  // Menu icon toggles bottom nav visibility on list pages.
  if (menuButton) {
    menuButton.addEventListener('click', (event) => {
      toggleNavVisibility({ revealForceWebMode: !!event?.altKey });
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
  if (hasDeprecated && hasHideLegacy) {
    return 'COALESCE(is_deprecated, 0) = 0 AND COALESCE(hide_from_shopping_list, 0) = 0';
  }
  if (hasDeprecated) return 'COALESCE(is_deprecated, 0) = 0';
  if (hasHideLegacy) return 'COALESCE(hide_from_shopping_list, 0) = 0';
  return '1 = 1';
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
