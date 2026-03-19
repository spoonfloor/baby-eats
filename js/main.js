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

function isTypingContext(target) {
  const el = target instanceof Element ? target : null;
  const active =
    document.activeElement instanceof Element ? document.activeElement : null;

  const selector =
    'input, textarea, select, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]';

  return !!(el?.closest(selector) || active?.closest(selector));
}

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

  const body = document.body;

  // Prefer data-page; fall back to legacy body classes for now.
  const pageId =
    body.dataset.page ||
    (body.classList.contains('recipes-page')
      ? 'recipes'
      : body.classList.contains('recipe-editor-page')
        ? 'recipe-editor'
        : body.classList.contains('shopping-page')
          ? 'shopping'
          : body.classList.contains('shopping-editor-page')
            ? 'shopping-editor'
            : body.classList.contains('units-page')
              ? 'units'
              : body.classList.contains('stores-page')
                ? 'stores'
                : body.classList.contains('store-editor-page')
                  ? 'store-editor'
                  : null);

  // --- Cmd+← / Cmd+→ / Cmd+↑ / Cmd+↓: move between top-level pages (Recipes <-> Shopping <-> Units <-> Stores) ---
  const TOP_LEVEL_PAGES = ['recipes', 'shopping', 'units', 'stores'];

  document.addEventListener(
    'keydown',
    (e) => {
      // Cmd only (avoid stealing Ctrl/Alt/Shift combos)
      if (!e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.isComposing) return;

      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key))
        return;
      if (isTypingContext(e.target)) return;

      const idx = TOP_LEVEL_PAGES.indexOf(pageId);
      if (idx === -1) return; // only act on top-level list pages

      // Treat Up like Left, and Down like Right.
      const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      const nextIdx =
        (idx + delta + TOP_LEVEL_PAGES.length) % TOP_LEVEL_PAGES.length;

      e.preventDefault();
      window.location.href = `${TOP_LEVEL_PAGES[nextIdx]}.html`;
    },
    { capture: true },
  );

  // --- Cmd+↑: go to parent/back page on editor pages ---
  const CHILD_EDITOR_PAGES = new Set([
    'recipe-editor',
    'shopping-editor',
    'unit-editor',
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
      if (isTypingContext(e.target)) return;

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
    'shopping-editor': loadShoppingItemEditorPage,
    units: loadUnitsPage,
    'unit-editor': loadUnitEditorPage,
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
  attachSecretGalleryShortcut(addBtnRecipes);

  // --- Load recipes ---
  const recipes = db.exec(
    'SELECT ID, title FROM recipes ORDER BY title COLLATE NOCASE;',
  );
  const list = document.getElementById('recipeList');
  list.innerHTML = '';

  window.dbInstance = db;

  // Keyboard selection + Enter activation for list rows.
  const listNav = enableTopLevelListKeyboardNav(list);

  // 🔹 Keep all recipes in memory for filtering
  let recipeRows = [];
  if (recipes.length > 0) {
    recipeRows = recipes[0].values;
    renderRecipeList(recipeRows);
  }

  // 🔹 Helper to render a given set of recipes
  function renderRecipeList(rows) {
    list.innerHTML = '';
    rows.forEach(([id, title]) => {
      const li = document.createElement('li');

      // Capitalize initial letter for top-level list display
      const fixedTitle =
        title && title.length > 0
          ? title.charAt(0).toUpperCase() + title.slice(1)
          : title;
      li.textContent = fixedTitle;

      li.addEventListener('click', (event) => {
        // Treat Ctrl-click / Cmd-click as "delete"
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          void deleteRecipeWithConfirm(db, id, title);
          return;
        }

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

  // --- Recipes action button stub ---

  const recipesActionBtn = document.getElementById('appBarAddBtn');

  function toTitleCase(str) {
    return str
      .toLowerCase()
      .replace(/\b\w+/g, (word) => word[0].toUpperCase() + word.slice(1));
  }

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
          normalize: (v) => toTitleCase((v || '').trim()),
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

    recipeRows = recipeRows.filter(([id]) => id !== recipeId);
    renderRecipeList(recipeRows);
  }

  if (recipesActionBtn) {
    recipesActionBtn.addEventListener('click', () => {
      void openCreateRecipeDialog(db);
    });
  }

  // --- Search bar logic with clear button ---

  const searchInput = document.getElementById('appBarSearchInput');
  const clearBtn = document.getElementById('appBarSearchClear');

  if (searchInput && clearBtn) {
    clearBtn.style.display = 'none';

    // Filter recipes as user types
    searchInput.addEventListener('input', () => {
      clearBtn.style.display = searchInput.value ? 'inline' : 'none';

      const query = searchInput.value.trim().toLowerCase();
      const filtered = recipeRows.filter(([id, title]) =>
        title.toLowerCase().includes(query),
      );
      renderRecipeList(filtered);
    });

    // Clear input on × click and restore full list
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      renderRecipeList(recipeRows);
      searchInput.focus();
    });

    // Prevent Enter from doing anything weird
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
    });
  }
}

// --- Shopping / Units / Stores loaders (v0 stubs) ---
async function loadShoppingPage() {
  const list = document.getElementById('shoppingList');

  initAppBar({
    mode: 'list',
    titleText: 'Shopping',
  });

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

  // When available, prefer the list table so Shopping can display multiple variants.
  const hasVariantTable = tableExists('ingredient_variants');
  const baseSelectSql = hasVariantTable
    ? `
      SELECT i.ID, i.name, COALESCE(v.variant, i.variant) AS variant
      FROM ingredients i
      LEFT JOIN ingredient_variants v ON v.ingredient_id = i.ID
    `
    : `
      SELECT ID, name, variant
      FROM ingredients
    `;

  let result = [];
  try {
    result = db.exec(`
      ${baseSelectSql}
      WHERE COALESCE(is_deprecated, 0) = 0
      ORDER BY
        ${hasVariantTable ? 'i.name' : 'name'} COLLATE NOCASE
        ${
          hasVariantTable
            ? ', i.ID ASC, COALESCE(v.sort_order, 999999) ASC, COALESCE(v.id, 999999) ASC'
            : ''
        };
    `);
  } catch (_) {
    result = db.exec(`
      ${baseSelectSql}
      WHERE hide_from_shopping_list = 0
      ORDER BY
        ${hasVariantTable ? 'i.name' : 'name'} COLLATE NOCASE
        ${
          hasVariantTable
            ? ', i.ID ASC, COALESCE(v.sort_order, 999999) ASC, COALESCE(v.id, 999999) ASC'
            : ''
        };
    `);
  }

  // Normalize into the same shape the UI already expects, but
  // aggregate variants by ingredient name so each name appears once.
  let shoppingRows = [];
  if (result.length > 0) {
    const rawRows = result[0].values.map(([id, name, variant]) => ({
      id,
      name,
      variant: variant || '',
    }));

    const byName = new Map();

    rawRows.forEach((row) => {
      const key = (row.name || '').toLowerCase();

      if (!byName.has(key)) {
        byName.set(key, {
          id: row.id,
          name: row.name || '',
          variants: [],
        });
      }

      if (row.variant) {
        byName.get(key).variants.push(row.variant);
      }
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

      return item;
    });

    // Keep list stable + alphabetical by name
    shoppingRows.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, {
        sensitivity: 'base',
      }),
    );
  }

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

  async function removeShoppingName(name) {
    const n = (name || '').trim();
    if (!n) return false;

    const usedCount = countRecipesUsingShoppingName(n);

    if (usedCount > 0) {
      const ok = await uiConfirm({
        title: 'Remove Shopping Item',
        message: `Remove '${n}'?\n\nUsed in ${usedCount} recipe${
          usedCount === 1 ? '' : 's'
        }.\n\nRemoving will hide it from Shopping and search (it will remain in recipes until replaced).`,
        confirmText: 'Remove',
        cancelText: 'Cancel',
        danger: true,
      });
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
        message: `Remove '${n}' permanently?\n\nIt is used in 0 recipes. This will delete it from the database.`,
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

    const buildLineToFit = (li, baseName, variants) => {
      const vs = Array.isArray(variants)
        ? variants.map((v) => String(v || '').trim()).filter(Boolean)
        : [];
      if (vs.length === 0) return baseName;

      const cs = window.getComputedStyle ? getComputedStyle(li) : null;
      const padL = cs ? parseFloat(cs.paddingLeft) : 0;
      const padR = cs ? parseFloat(cs.paddingRight) : 0;
      const maxPx = Math.max(0, li.clientWidth - (padL || 0) - (padR || 0));
      const measure = makeTextMeasurer(li);
      if (!measure || maxPx <= 0) return `${baseName} (${vs[0]})`;

      const prefix = `${baseName} (`;
      const close = `)`;
      const prefixW = measure(prefix);
      const closeW = measure(close);

      // If everything fits, render full (rare).
      const full = `${baseName} (${vs.join(', ')})`;
      if (measure(full) <= maxPx) return full;

      // If we have <=3 variants, just ellipsize the inside list.
      if (vs.length <= 3) {
        const room = Math.max(0, maxPx - prefixW - closeW);
        const inside = truncateToFitPx(vs.join(', '), room, measure);
        return `${prefix}${inside}${close}`;
      }

      // We have >3 variants: ALWAYS keep ", + N others" visible.
      // Try showing up to 3 visible variants in list order, shrinking as needed.
      for (let visibleCount = 3; visibleCount >= 1; visibleCount--) {
        const remaining = vs.length - visibleCount;
        const suffix = `, + ${remaining} other${remaining === 1 ? '' : 's'}`;
        const suffixW = measure(suffix);
        const roomForNames = Math.max(0, maxPx - prefixW - suffixW - closeW);

        if (roomForNames <= 0) continue;

        const names = vs.slice(0, visibleCount).join(', ');
        if (measure(names) <= roomForNames) {
          return `${prefix}${names}${suffix}${close}`;
        }
      }

      // Fallback: truncate the first variant to fit, but still reserve suffix.
      const remaining = vs.length - 1;
      const suffix = `, + ${remaining} other${remaining === 1 ? '' : 's'}`;
      const suffixW = measure(suffix);
      const roomForFirst = Math.max(0, maxPx - prefixW - suffixW - closeW);
      const first = truncateToFitPx(vs[0], roomForFirst, measure) || '…';
      return `${prefix}${first}${suffix}${close}`;
    };

    rows.forEach((item) => {
      const li = document.createElement('li');

      // Capitalize initial letter for top-level shopping list display
      const baseName =
        item.name && item.name.length > 0
          ? item.name.charAt(0).toUpperCase() + item.name.slice(1)
          : item.name;
      li.textContent = baseName || '';

      li.addEventListener('click', (event) => {
        const wantsRemove = event.ctrlKey || event.metaKey;
        if (wantsRemove) {
          event.preventDefault();
          event.stopPropagation();
          const ok = removeShoppingName(item.name || '');
          if (ok) {
            // Update in-memory rows (hide/remove) and rerender by reloading from DB is simplest.
            window.location.reload();
          }
          return;
        }

        sessionStorage.setItem('selectedShoppingItemId', String(item.id));
        sessionStorage.setItem('selectedShoppingItemName', item.name || '');
        sessionStorage.removeItem('selectedShoppingItemIsNew');
        window.location.href = 'shoppingEditor.html';
      });

      li.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        void (async () => {
          const ok = await removeShoppingName(item.name || '');
          if (ok) window.location.reload();
        })();
        void (async () => {
          const ok = await removeShoppingName(item.name || '');
          if (ok) window.location.reload();
        })();
      });

      list.appendChild(li);

      // After the row is in the DOM, measure actual available width and fit the text so
      // the "+ N others)" suffix stays visible even when the first variants are long.
      if (Array.isArray(item.variants) && item.variants.length > 0) {
        try {
          requestAnimationFrame(() => {
            try {
              const nextText = buildLineToFit(
                li,
                baseName || '',
                item.variants,
              );
              li.textContent = nextText;
              li.title = `${baseName || ''}\n\nAll variants: ${item.variants.join(
                ', ',
              )}`;
            } catch (_) {}
          });
        } catch (_) {}
      }
    });

    // Keep selection valid after rerender (search/filter changes).
    listNav?.syncAfterRender?.();
  }

  // Initial render
  renderShoppingList(shoppingRows);

  // Search: filter by name and variant text (case-insensitive)
  if (searchInput && clearBtn) {
    clearBtn.style.display = 'none';

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      clearBtn.style.display = query ? 'inline' : 'none';

      if (!query) {
        renderShoppingList(shoppingRows);
        return;
      }

      const filtered = shoppingRows.filter((item) => {
        const nameMatch = item.name.toLowerCase().includes(query);
        const variants = Array.isArray(item.variants) ? item.variants : [];
        const variantMatch = variants.some((v) =>
          (v || '').toLowerCase().includes(query),
        );
        return nameMatch || variantMatch;
      });

      renderShoppingList(filtered);
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      renderShoppingList(shoppingRows);
      searchInput.focus();
    });

    // Prevent Enter from doing anything weird
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
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
      // Best-effort: when schema supports lemma, auto-fill a singular form from the title.
      let cols = [];
      try {
        const info = db.exec('PRAGMA table_info(ingredients);');
        const rows = info.length ? info[0].values : [];
        cols = rows.map((r) => String(r[1] || '').toLowerCase());
      } catch (_) {
        cols = [];
      }
      const has = (c) => cols.includes(String(c).toLowerCase());

      const deriveLemmaFromTitle = (rawTitle) => {
        const t = String(rawTitle || '')
          .trim()
          .toLowerCase();
        if (!t) return '';
        // Small heuristic singularizer (good enough for simple plurals).
        if (/ies$/i.test(t) && t.length > 3) return t.slice(0, -3) + 'y';
        if (/(ch|sh|s|x|z)es$/i.test(t) && t.length > 2) return t.slice(0, -2);
        if (/ses$/i.test(t) && t.length > 3) return t.slice(0, -2);
        if (/s$/i.test(t) && !/ss$/i.test(t) && t.length > 1)
          return t.slice(0, -1);
        return t;
      };

      if (has('lemma')) {
        db.run('INSERT INTO ingredients (name, lemma) VALUES (?, ?);', [
          name,
          deriveLemmaFromTitle(name),
        ]);
      } else {
        db.run('INSERT INTO ingredients (name) VALUES (?);', [name]);
      }
      const idQ = db.exec('SELECT last_insert_rowid();');
      if (idQ.length && idQ[0].values.length) {
        newId = idQ[0].values[0][0];
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
    addBtn.addEventListener('click', () => {
      void openCreateShoppingItemDialog();
    });
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
    const subDisplay = (lastCommittedSubtitle || '').trim()
      ? lastCommittedSubtitle
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
      const starting = subtitleEl.textContent || '';
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

  const doBack = async () => {
    if (
      !pageDirty() ||
      (await uiConfirm({
        title: 'Discard Changes?',
        message: 'Discard unsaved changes?',
        confirmText: 'Discard',
        cancelText: 'Cancel',
        danger: true,
      }))
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
      if (!pageDirty()) return;

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
            raw =
              t.trim().toLowerCase() === ph
                ? ''
                : normalizeSubtitleFn(t);
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
        if (err && err.silent) return;
        console.error('❌ Failed to save child editor:', err);
        uiToast('Failed to save changes. See console for details.');
        return;
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

      <div id="shoppingItemLemmaField" class="shopping-item-field">
        <div class="shopping-item-label">Singular form</div>
        <input
          id="shoppingItemLemmaInput"
          class="shopping-item-input"
          type="text"
          placeholder="e.g., bagel"
        />
      </div>

      <div class="shopping-item-status">
        <div class="shopping-item-status-row">
          <label class="shopping-item-toggle">
            <input
              id="shoppingItemIsFoodYes"
              type="radio"
              name="shoppingItemIsFood"
            />
            <span>Food</span>
          </label>
          <label class="shopping-item-toggle">
            <input
              id="shoppingItemIsFoodNo"
              type="radio"
              name="shoppingItemIsFood"
            />
            <span>Not food</span>
          </label>
        </div>

        <div class="shopping-item-status-row">
          <label class="shopping-item-toggle">
            <input id="shoppingItemIsDeprecatedToggle" type="checkbox" />
            <span>Hidden</span>
          </label>
        </div>

        <div class="shopping-item-help">
          Hidden items have been removed from Shopping and can be deleted once they
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
      const home = (extraValues && extraValues.home) || '';
      const isFoodRaw = (extraValues && extraValues.is_food) || '';
      const isDeprecatedRaw = (extraValues && extraValues.is_deprecated) || '';
      const lemma = (extraValues && extraValues.lemma) || '';
      const pluralOverride = (extraValues && extraValues.plural_override) || '';
      const pluralByDefaultRaw =
        (extraValues && extraValues.plural_by_default) || '';
      const isMassNounRaw = (extraValues && extraValues.is_mass_noun) || '';

      const isFood = isFoodRaw === '1' ? 1 : 0;
      const isDeprecated = isDeprecatedRaw === '1' ? 1 : 0;
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

      // Keep legacy single-value columns best-effort for now:
      // - variant/size columns become "representative" first entries
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

      const deriveLemmaFromTitle = (rawTitle) => {
        const t = String(rawTitle || '')
          .trim()
          .toLowerCase();
        if (!t) return '';
        // Small heuristic singularizer (good enough for simple plurals).
        if (/ies$/i.test(t) && t.length > 3) return t.slice(0, -3) + 'y';
        if (/(ch|sh|s|x|z)es$/i.test(t) && t.length > 2) return t.slice(0, -2);
        if (/ses$/i.test(t) && t.length > 3) return t.slice(0, -2);
        if (/s$/i.test(t) && !/ss$/i.test(t) && t.length > 1)
          return t.slice(0, -1);
        return t;
      };
      const norm = (s) =>
        String(s || '')
          .trim()
          .toLowerCase();

      // Cascade rule:
      // - If lemma is empty, fill it from the (new) title.
      // - If lemma still matches the auto-derived lemma from the old title, update it to match the new title.
      // - Otherwise preserve the user-provided lemma.
      let lemmaToWrite = lemma;
      if (has('lemma')) {
        const oldDerived =
          typeof baselineTitle === 'string'
            ? deriveLemmaFromTitle(baselineTitle)
            : '';
        const newDerived = deriveLemmaFromTitle(next);
        const lemmaNorm = norm(lemmaToWrite);
        if (!lemmaNorm) {
          lemmaToWrite = newDerived;
        } else if (oldDerived && lemmaNorm === norm(oldDerived)) {
          lemmaToWrite = newDerived;
        }
      }

      // Keep UI + wireChildEditorPage baselines consistent with any auto-filled lemma.
      // Without this, deleting "Singular form" then saving can keep the field visually empty
      // (even if we persisted a derived lemma to the DB).
      try {
        if (has('lemma') && extraValues && typeof extraValues === 'object') {
          extraValues.lemma = lemmaToWrite;
        }
      } catch (_) {}
      try {
        if (has('lemma')) {
          const el = document.getElementById('shoppingItemLemmaInput');
          if (el && 'value' in el) {
            const cur = String(el.value || '').trim();
            if (!cur && lemmaToWrite) el.value = lemmaToWrite;
          }
        }
      } catch (_) {}

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

      let currentId = Number.isFinite(id) ? id : null;

      // If the row already exists (created from the list-page Create flow),
      // always UPDATE, even if it is flagged as "new".
      if (Number.isFinite(id)) {
        const sets = ['name = ?'];
        const vals = [next];

        if (has('variant')) {
          sets.push('variant = ?');
          vals.push(variant0);
        }
        if (has('size')) {
          sets.push('size = ?');
          vals.push(size0);
        }
        if (has('location_at_home')) {
          sets.push('location_at_home = ?');
          vals.push(home);
        }
        if (has('lemma')) {
          sets.push('lemma = ?');
          vals.push(lemmaToWrite);
        }
        if (has('plural_override')) {
          sets.push('plural_override = ?');
          vals.push(pluralOverride);
        }
        if (has('plural_by_default')) {
          sets.push('plural_by_default = ?');
          vals.push(pluralByDefault);
        }
        if (has('is_mass_noun')) {
          sets.push('is_mass_noun = ?');
          vals.push(isMassNoun);
        }
        if (has('is_food')) {
          sets.push('is_food = ?');
          vals.push(isFood);
        }
        if (has('is_deprecated')) {
          sets.push('is_deprecated = ?');
          vals.push(isDeprecated);
        } else if (has('hide_from_shopping_list')) {
          sets.push('hide_from_shopping_list = ?');
          vals.push(isDeprecated);
        }

        vals.push(id);
        db.run(`UPDATE ingredients SET ${sets.join(', ')} WHERE ID = ?;`, vals);
      } else {
        const insertCols = ['name'];
        const insertVals = [next];
        if (has('variant')) {
          insertCols.push('variant');
          insertVals.push(variant0);
        }
        if (has('size')) {
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
      if (currentId != null && Number.isFinite(Number(currentId))) {
        const iid = Number(currentId);

        // Transaction is best-effort; SQL.js supports BEGIN/COMMIT.
        try {
          db.run('BEGIN;');
        } catch (_) {}

        try {
          if (hasVariantTable) {
            db.run('DELETE FROM ingredient_variants WHERE ingredient_id = ?;', [
              iid,
            ]);
            variants.forEach((v, idx) => {
              db.run(
                'INSERT INTO ingredient_variants (ingredient_id, variant, sort_order) VALUES (?, ?, ?);',
                [iid, v, idx + 1],
              );
            });
          }

          if (hasSizeTable) {
            db.run('DELETE FROM ingredient_sizes WHERE ingredient_id = ?;', [
              iid,
            ]);
            sizes.forEach((s, idx) => {
              db.run(
                'INSERT INTO ingredient_sizes (ingredient_id, size, sort_order) VALUES (?, ?, ?);',
                [iid, s, idx + 1],
              );
            });
          }

          try {
            db.run('COMMIT;');
          } catch (_) {}
        } catch (err) {
          try {
            db.run('ROLLBACK;');
          } catch (_) {}
          throw err;
        }
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
      let baselineHome = '';
      let baselineIsFood = '1';
      let baselineIsDeprecated = '0';
      let baselineLemma = '';
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
          const showLemma = has('lemma');
          const showPluralOverride = has('plural_override');
          const showPluralByDefault = has('plural_by_default');
          const showIsMassNoun = has('is_mass_noun');
          const showAnyOverrides =
            showPluralOverride || showPluralByDefault || showIsMassNoun;
          setVisible('shoppingItemOverridesCard', showAnyOverrides);
          setVisible('shoppingItemOverridesTitle', showAnyOverrides);
          setVisible('shoppingItemLanguageDetails', showAnyOverrides);
          setVisible('shoppingItemLemmaField', showLemma);
          setVisible('shoppingItemPluralOverrideField', showPluralOverride);
          setVisible('shoppingItemPluralByDefaultRow', showPluralByDefault);
          setVisible('shoppingItemIsMassNounRow', showIsMassNoun);

          const selectCols = [
            "COALESCE(variant, '')",
            "COALESCE(size, '')",
            "COALESCE(location_at_home, '')",
            has('lemma') ? "COALESCE(lemma, '')" : "''",
            has('plural_override') ? "COALESCE(plural_override, '')" : "''",
            has('plural_by_default') ? 'COALESCE(plural_by_default, 0)' : '0',
            has('is_mass_noun') ? 'COALESCE(is_mass_noun, 0)' : '0',
            has('is_food') ? 'COALESCE(is_food, 1)' : '1',
            has('is_deprecated')
              ? 'COALESCE(is_deprecated, 0)'
              : has('hide_from_shopping_list')
                ? 'COALESCE(hide_from_shopping_list, 0)'
                : '0',
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
            baselineLemma = String(row[3] || '');
            baselinePluralOverride = String(row[4] || '');
            baselinePluralByDefault = String(row[5] != null ? row[5] : '0');
            baselineIsMassNoun = String(row[6] != null ? row[6] : '0');
            baselineIsFood = String(row[7] != null ? row[7] : '1');
            baselineIsDeprecated = String(row[8] != null ? row[8] : '0');
          }

          // Note: overrides are always visible (no disclosure); nothing to auto-open.

          // If list tables exist, prefer them as the baseline source-of-truth.
          try {
            const vq = db.exec(
              `SELECT variant FROM ingredient_variants WHERE ingredient_id = ? ORDER BY sort_order ASC, id ASC;`,
              [id],
            );
            if (vq.length && vq[0].values.length) {
              baselineVariants = vq[0].values
                .map((r) => String(r[0] || '').trim())
                .filter((s) => s.length > 0)
                .join('\n');
            }
          } catch (_) {}

          try {
            const sq = db.exec(
              `SELECT size FROM ingredient_sizes WHERE ingredient_id = ? ORDER BY sort_order ASC, id ASC;`,
              [id],
            );
            if (sq.length && sq[0].values.length) {
              baselineSizes = sq[0].values
                .map((r) => String(r[0] || '').trim())
                .filter((s) => s.length > 0)
                .join('\n');
            }
          } catch (_) {}
        }
      } catch (_) {}

      // Home typeahead (suggest existing "location_at_home" values).
      try {
        const homeInput = document.getElementById('shoppingItemHomeInput');
        const ta = window.favoriteEatsTypeahead;
        if (homeInput && ta && typeof ta.attach === 'function') {
          ta.attach({
            inputEl: homeInput,
            openOnFocus: true,
            maxVisible: 10,
            getPool: async () => {
              const db = window.dbInstance;
              if (!db) return [];
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
              return vals;
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
            key: 'lemma',
            el: document.getElementById('shoppingItemLemmaInput'),
            initialValue: baselineLemma,
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
            el: document.getElementById('shoppingItemIsFoodYes'),
            els: [
              document.getElementById('shoppingItemIsFoodYes'),
              document.getElementById('shoppingItemIsFoodNo'),
            ],
            initialValue: baselineIsFood === '1' ? '1' : '0',
            getValue: () =>
              document.getElementById('shoppingItemIsFoodYes')?.checked
                ? '1'
                : '0',
            setValue: (v) => {
              const yes = document.getElementById('shoppingItemIsFoodYes');
              const no = document.getElementById('shoppingItemIsFoodNo');
              const isYes = String(v) === '1';
              if (yes) yes.checked = isYes;
              if (no) no.checked = !isYes;
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
        ],
        onSave: persistShoppingItem,
      });
    });
  }
}

function toSentenceCase(s) {
  const t = (s || '').trim();
  if (!t) return '';
  return t[0].toUpperCase() + t.slice(1).toLowerCase();
}

function loadUnitEditorPage() {
  const view = document.getElementById('pageContent');

  if (!view) return;

  const isNew = sessionStorage.getItem('selectedUnitIsNew') === '1';
  const storedName = sessionStorage.getItem('selectedUnitNameSingular') || '';
  const code = sessionStorage.getItem('selectedUnitCode') || '';
  const titleDisplay = storedName
    ? toSentenceCase(storedName)
    : isNew
      ? 'New unit'
      : 'Unit';
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
  `;

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
        displayTitle: toSentenceCase,
        subtitleEl: document.getElementById('unitAbbreviation'),
        initialSubtitle: code,
        normalizeSubtitle: (s) => (s || '').trim().toLowerCase(),
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

          const newCode = (nextCode ?? '').trim().toLowerCase();

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
              'UPDATE units SET code = ?, name_singular = ? WHERE code = ?;',
              [newCode, next || '', oldCode],
            );
            sessionStorage.setItem('selectedUnitCode', newCode);
          } else {
            db.run('UPDATE units SET name_singular = ? WHERE code = ?;', [
              next || '',
              oldCode || newCode,
            ]);
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

  // --- Load units from units table ---
  // Prefer hiding limbo units when schema supports it.
  let result = [];
  try {
    result = db.exec(`
      SELECT code, name_singular, name_plural, category, sort_order
      FROM units
      WHERE COALESCE(is_hidden, 0) = 0
      ORDER BY sort_order ASC, code COLLATE NOCASE;
    `);
  } catch (_) {
    // Older DB without is_hidden column.
    result = db.exec(`
      SELECT code, name_singular, name_plural, category, sort_order
      FROM units
      ORDER BY sort_order ASC, code COLLATE NOCASE;
    `);
  }

  let unitRows = [];
  if (result.length > 0) {
    unitRows = result[0].values.map(
      ([code, nameSingular, namePlural, category, sortOrder]) => ({
        code,
        nameSingular,
        namePlural,
        category,
        sortOrder,
      }),
    );
  }

  // --- Load unit suggestions (soft-add pool) ---
  let suggestionRows = [];
  try {
    const qs = db.exec(`
      SELECT code, use_count, last_used_at
      FROM unit_suggestions
      WHERE COALESCE(is_hidden, 0) = 0
      ORDER BY COALESCE(last_used_at, 0) DESC,
               COALESCE(use_count, 0) DESC,
               code COLLATE NOCASE;
    `);
    if (qs.length > 0) {
      suggestionRows = qs[0].values.map(([code, useCount, lastUsedAt]) => ({
        code,
        useCount: useCount == null ? 0 : Number(useCount),
        lastUsedAt: lastUsedAt == null ? null : Number(lastUsedAt),
      }));
    }
  } catch (_) {
    suggestionRows = [];
  }

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

  function renderUnitsList({ units, suggestions }) {
    list.innerHTML = '';

    const rows = Array.isArray(units) ? units : [];
    const sugg = Array.isArray(suggestions) ? suggestions : [];

    rows.forEach((unit) => {
      const li = document.createElement('li');

      // Display exactly as stored (no forced capitalization)
      let line = unit.code || '';

      // If we have a human-friendly singular name different from the code, append it
      if (
        unit.nameSingular &&
        unit.nameSingular.toLowerCase() !== (unit.code || '').toLowerCase()
      ) {
        line += ` (${unit.nameSingular})`;
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

        if (usedCount > 0) {
          const ok = await uiConfirm({
            title: 'Remove Unit',
            message: `Remove '${c}'?\n\nUsed in ${usedCount} recipe${
              usedCount === 1 ? '' : 's'
            }.\n\nRemoving will hide it from Units and search (it will remain in recipes until replaced).`,
            confirmText: 'Remove',
            cancelText: 'Cancel',
            danger: true,
          });
          if (!ok) return false;

          try {
            db.run('UPDATE units SET is_hidden = 1 WHERE code = ?;', [c]);
          } catch (err) {
            console.error('❌ Failed to hide unit:', err);
            uiToast('Failed to remove unit. See console for details.');
            return false;
          }
        } else {
          const ok = await uiConfirm({
            title: 'Delete Unit',
            message: `Remove '${c}' permanently?\n\nIt is used in 0 recipes. This will delete it from the database.`,
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
            if (ok) window.location.reload();
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
        sessionStorage.removeItem('selectedUnitIsNew');

        window.location.href = 'unitEditor.html';
      });

      li.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        void (async () => {
          const ok = await removeUnit(unit.code || '');
          if (ok) window.location.reload();
        })();
      });

      list.appendChild(li);
    });

    if (sugg.length > 0) {
      const header = document.createElement('li');
      header.textContent = 'Suggestions';
      header.className = 'list-section-label';
      header.tabIndex = -1;
      list.appendChild(header);

      const guessCategory = (code) => {
        const c = (code || '').trim().toLowerCase();
        if (!c) return 'misc';
        const volume = new Set([
          'tsp',
          'tbsp',
          'cup',
          'pt',
          'qt',
          'gal',
          'floz',
          'ml',
          'l',
        ]);
        const mass = new Set(['g', 'kg', 'oz', 'lb']);
        const count = new Set([
          'each',
          'pkg',
          'can',
          'jar',
          'bunch',
          'clove',
          'slice',
          'bag',
          'box',
          'bottle',
          'packet',
        ]);
        if (volume.has(c)) return 'volume';
        if (mass.has(c)) return 'mass';
        if (count.has(c)) return 'count';
        return 'misc';
      };

      const guessPlural = (singular) => {
        try {
          if (typeof window.pluralizeEnglishNoun === 'function') {
            return window.pluralizeEnglishNoun(singular, '');
          }
        } catch (_) {}
        return (singular || '') + 's';
      };

      const removeSuggestion = async (code) => {
        const c = (code || '').trim();
        if (!c) return false;
        const usedCount = countRecipesUsingUnit(c);

        if (usedCount > 0) {
          const ok = await uiConfirm({
            title: 'Remove Unit Suggestion',
            message: `Remove '${c}'?\n\nUsed in ${usedCount} recipe${
              usedCount === 1 ? '' : 's'
            }.\n\nRemoving will hide it from suggestions (it will remain in recipes until replaced).`,
            confirmText: 'Remove',
            cancelText: 'Cancel',
            danger: true,
          });
          if (!ok) return false;
          try {
            db.run(
              'UPDATE unit_suggestions SET is_hidden = 1 WHERE code = ?;',
              [c.toLowerCase()],
            );
          } catch (err) {
            console.error('❌ Failed to hide unit suggestion:', err);
            uiToast('Failed to remove suggestion. See console for details.');
            return false;
          }
        } else {
          const ok = await uiConfirm({
            title: 'Delete Unit Suggestion',
            message: `Remove '${c}' permanently?\n\nIt is used in 0 recipes. This will delete it from suggestions.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
          });
          if (!ok) return false;
          try {
            db.run('DELETE FROM unit_suggestions WHERE code = ?;', [
              c.toLowerCase(),
            ]);
          } catch (err) {
            console.error('❌ Failed to delete unit suggestion:', err);
            uiToast('Failed to delete suggestion. See console for details.');
            return false;
          }
        }

        persistDb();
        return true;
      };

      const promoteSuggestion = async (code) => {
        const c = (code || '').trim();
        if (!c) return false;

        const ok = await uiConfirm({
          title: 'Add Unit',
          message: `Add '${c}' to Units?`,
          confirmText: 'Add',
          cancelText: 'Cancel',
          danger: false,
        });
        if (!ok) return false;

        // Insert into units (best-effort defaults) and then open the unit editor.
        try {
          const codeLower = c.toLowerCase();

          // If already an official unit, drop the suggestion and open the editor.
          try {
            const ex = db.exec(
              'SELECT code, name_singular, name_plural, category FROM units WHERE lower(code) = lower(?) LIMIT 1;',
              [codeLower],
            );
            if (ex.length && ex[0].values.length) {
              try {
                db.run('DELETE FROM unit_suggestions WHERE code = ?;', [
                  codeLower,
                ]);
              } catch (_) {}
              persistDb();

              sessionStorage.setItem('selectedUnitCode', codeLower);
              sessionStorage.setItem(
                'selectedUnitNameSingular',
                ex[0].values[0][1] || '',
              );
              sessionStorage.setItem(
                'selectedUnitNamePlural',
                ex[0].values[0][2] || '',
              );
              sessionStorage.setItem(
                'selectedUnitCategory',
                ex[0].values[0][3] || '',
              );
              sessionStorage.removeItem('selectedUnitIsNew');
              window.location.href = 'unitEditor.html';
              return true;
            }
          } catch (_) {}

          const nameSingular = c;
          const namePlural = guessPlural(nameSingular);
          const category = guessCategory(codeLower);

          // Compute next sort_order
          let nextSort = 999999;
          try {
            const q = db.exec(
              'SELECT COALESCE(MAX(sort_order), 0) + 1 FROM units;',
            );
            if (q.length && q[0].values.length) {
              const v = Number(q[0].values[0][0]);
              if (Number.isFinite(v)) nextSort = v;
            }
          } catch (_) {}

          db.run(
            'INSERT INTO units (code, name_singular, name_plural, category, sort_order) VALUES (?, ?, ?, ?, ?);',
            [codeLower, nameSingular, namePlural, category, nextSort],
          );

          // Remove from suggestions list once promoted.
          try {
            db.run('DELETE FROM unit_suggestions WHERE code = ?;', [codeLower]);
          } catch (_) {}
        } catch (err) {
          console.error('❌ Failed to promote unit suggestion:', err);
          uiToast('Failed to add unit. See console for details.');
          return false;
        }

        persistDb();

        sessionStorage.setItem('selectedUnitCode', codeLower);
        sessionStorage.setItem('selectedUnitNameSingular', c);
        sessionStorage.setItem('selectedUnitNamePlural', '');
        sessionStorage.setItem('selectedUnitCategory', '');
        sessionStorage.removeItem('selectedUnitIsNew');
        window.location.href = 'unitEditor.html';
        return true;
      };

      sugg.forEach((s) => {
        const li = document.createElement('li');
        li.className = 'unit-suggestion-row';
        li.textContent = s.code || '';

        li.addEventListener('click', (event) => {
          const wantsRemove = event.ctrlKey || event.metaKey;
          if (wantsRemove) {
            event.preventDefault();
            event.stopPropagation();
            void (async () => {
              const ok = await removeSuggestion(s.code || '');
              if (ok) window.location.reload();
            })();
            return;
          }
          void promoteSuggestion(s.code || '');
        });

        li.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          void (async () => {
            const ok = await removeSuggestion(s.code || '');
            if (ok) window.location.reload();
          })();
        });

        list.appendChild(li);
      });
    }

    // Keep selection valid after rerender (search/filter changes).
    listNav?.syncAfterRender?.();
  }

  // Initial render
  renderUnitsList({ units: unitRows, suggestions: suggestionRows });

  async function openCreateUnitDialog() {
    if (!window.ui) {
      uiToast('UI not ready yet.');
      return;
    }

    const vals = await window.ui.form({
      title: 'New Unit',
      fields: [
        {
          key: 'code',
          label: 'Code',
          value: '',
          required: true,
          normalize: (v) => (v || '').trim(),
        },
        {
          key: 'nameSingular',
          label: 'Name (singular)',
          value: '',
          required: true,
          normalize: (v) => (v || '').trim(),
        },
      ],
      confirmText: 'Create',
      cancelText: 'Cancel',
      validate: (v) => {
        if (
          !v.code ||
          !v.code.trim() ||
          !v.nameSingular ||
          !v.nameSingular.trim()
        ) {
          return 'Code and Name (singular) are required.';
        }
        return '';
      },
    });
    if (!vals) return;

    const code = (vals.code || '').trim();
    const nameSingular = (vals.nameSingular || '').trim();
    if (!code || !nameSingular) return;

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
        'INSERT INTO units (code, name_singular, name_plural, category, sort_order) VALUES (?, ?, ?, ?, ?);',
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
    clearBtn.style.display = 'none';

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      clearBtn.style.display = query ? 'inline' : 'none';

      if (!query) {
        renderUnitsList({ units: unitRows, suggestions: suggestionRows });
        return;
      }

      const filteredUnits = unitRows.filter((u) => {
        const haystack = [
          u.code || '',
          u.nameSingular || '',
          u.namePlural || '',
          u.category || '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });

      const filteredSuggestions = suggestionRows.filter((s) =>
        String(s.code || '')
          .toLowerCase()
          .includes(query),
      );

      renderUnitsList({
        units: filteredUnits,
        suggestions: filteredSuggestions,
      });
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      renderUnitsList({ units: unitRows, suggestions: suggestionRows });
      searchInput.focus();
    });

    // Prevent Enter from doing anything weird
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
    });
  }
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

    rows.forEach((store) => {
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
    /** @type {Set<number>} */
    let deletedAisleIds = new Set();
    let nextTempAisleId = -1;
    let draftSnapshot = null;
    let refreshDirty = () => {};

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

    const cloneDraftSnapshot = () => ({
      aisleRows: aisleRows.map((r) => ({ id: r.id, name: r.name })),
      items: Object.fromEntries(
        [...aisleItemsByAisle.entries()].map(([k, v]) => [String(k), [...v]]),
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
    const aislesDraftDirty = () => {
      if (!draftSnapshot) return false;
      const sd = draftSnapshot.deletedIds || [];
      if (deletedAisleIds.size !== sd.length) return true;
      for (const id of deletedAisleIds) if (!sd.includes(id)) return true;
      for (const id of sd) if (!deletedAisleIds.has(id)) return true;
      if (aisleRows.length !== draftSnapshot.aisleRows.length) return true;
      const snapRows = new Map(draftSnapshot.aisleRows.map((r) => [r.id, r]));
      for (const r of aisleRows) {
        const s = snapRows.get(r.id);
        if (!s) return true;
        if ((r.name || '') !== (s.name || '')) return true;
        const cur = aisleItemsByAisle.get(r.id) || [];
        const snapItems = draftSnapshot.items[String(r.id)] || [];
        if (!itemsListEqual(cur, snapItems)) return true;
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
        aisleRows.forEach((r) => aisleItemsByAisle.set(r.id, []));
        if (aisleRows.length) {
          const ids = aisleRows.map((r) => r.id);
          const ph = ids.map(() => '?').join(',');
          const stmt = db.prepare(`
            SELECT isl.store_location_id, i.name
            FROM ingredient_store_location isl
            JOIN ingredients i ON i.ID = isl.ingredient_id
            WHERE isl.store_location_id IN (${ph})
              AND COALESCE(i.is_deprecated, 0) = 0
              AND COALESCE(i.hide_from_shopping_list, 0) = 0
            ORDER BY isl.ID ASC
          `);
          stmt.bind(ids);
          while (stmt.step()) {
            const row = stmt.get();
            const aid = Number(row[0]);
            const name = String(row[1] || '');
            const list = aisleItemsByAisle.get(aid);
            if (!list) continue;
            const k = normItemKey(name);
            if (list.some((n) => normItemKey(n) === k)) continue;
            list.push(name);
          }
          stmt.free();
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
    <div
      id="storeAislesSectionLabel"
      class="shopping-item-label store-aisles-section-label"
    >
      Aisles
    </div>
    <div id="storeAislesList" class="store-aisles-list" aria-label="Store aisles"></div>
    <div id="storeAddAisleCta" class="store-add-aisle-cta" role="button" tabindex="0">
      <span class="placeholder-prompt">Add an aisle</span>
    </div>`
      : '';

    view.innerHTML = `
    <h1 id="childEditorTitle" class="recipe-title">${titleText || ''}</h1>
    ${storeLocationBlock}
    ${aislesBlock}
  `;

    const parkAddAisleCta = () => {
      const list = document.getElementById('storeAislesList');
      const cta = document.getElementById('storeAddAisleCta');
      if (list && cta && list.contains(cta)) list.after(cta);
    };

    const syncAddAisleCtaAfterRender = () => {
      const list = document.getElementById('storeAislesList');
      const cta = document.getElementById('storeAddAisleCta');
      if (!list || !cta) return;
      if (aisleRows.length === 0) {
        list.after(cta);
        cta.hidden = false;
        return;
      }
      list.after(cta);
      cta.hidden = true;
    };

    const showAddAisleCtaBelowCard = (card) => {
      const cta = document.getElementById('storeAddAisleCta');
      if (!cta || !card) return;
      card.after(cta);
      cta.hidden = false;
    };

    const renderAisleCards = () => {
      const list = document.getElementById('storeAislesList');
      if (!list) return;

      parkAddAisleCta();
      list.innerHTML = '';
      aisleRows.forEach((a) => {
        const card = document.createElement('div');
        card.className = 'shopping-item-editor-card store-aisle-card';
        card.dataset.aisleId = String(a.id);

        const aisleTargetIsNameOrList = (target) =>
          target.closest('.store-aisle-name') || target.closest('textarea');

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
          const wasPersisted = a.id > 0;

          if (wasPersisted) deletedAisleIds.add(a.id);
          aisleRows = aisleRows.filter((r) => r.id !== a.id);
          aisleItemsByAisle.delete(a.id);
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

        const items = aisleItemsByAisle.get(a.id) || [];
        const itemsField = document.createElement('div');
        itemsField.className = 'shopping-item-field store-aisle-items-field';

        const ta = document.createElement('textarea');
        ta.className = 'shopping-item-textarea';
        ta.value = items.join('\n');
        ta.placeholder = 'Add an item.';
        ta.setAttribute('aria-label', 'Aisle items');
        ta.wrap = 'off';
        attachEditorTextareaAutoGrow(ta, { maxLines: 10 });

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

            taTypeahead.attach({
              inputEl: ta,
              getPool: async () => await taTypeahead.getNamePool(),
              // Query is the current line, trimmed (so suggestions open only after 1+ non-space char).
              getQuery: (textarea) =>
                String(getCurrentLineText(textarea) || '').trim(),
              // Replace the entire current line with the canonical ingredient name.
              setValue: (picked, textarea) => {
                const canonical = String(picked || '').trim();
                const caretPos = textarea.selectionStart ?? 0;
                const { lineStart, lineEnd } = getCaretLineBounds(
                  textarea,
                  caretPos,
                );
                const before = vSlice(textarea.value, 0, lineStart);
                const after = vSlice(textarea.value, lineEnd, textarea.value.length);
                textarea.value = before + canonical + after;
                return { caretPos: lineStart + canonical.length };
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

        let escBaseline = [...items];

        ta.addEventListener('focus', () => {
          escBaseline = parseUniqueItemLines(ta.value);
        });

        ta.addEventListener('input', () => {
          aisleItemsByAisle.set(a.id, parseUniqueItemLines(ta.value));
          refreshDirty();
        });

        ta.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            ta.value = escBaseline.join('\n');
            aisleItemsByAisle.set(a.id, [...escBaseline]);
            try {
              ta.__feAutoGrowResize();
            } catch (_) {}
            refreshDirty();
          }
        });

        itemsField.appendChild(ta);
        card.appendChild(itemsField);

        list.appendChild(card);
      });
      syncAddAisleCtaAfterRender();
    };

    const wireAddAisleCtaFocus = () => {
      let tid = null;
      const onFocusOut = () => {
        if (aisleRows.length < 1) return;
        window.clearTimeout(tid);
        tid = window.setTimeout(() => {
          tid = null;
          const ae = document.activeElement;
          const cta = document.getElementById('storeAddAisleCta');
          const list = document.getElementById('storeAislesList');
          if (!cta || !list) return;
          if (ae && (cta.contains(ae) || ae.closest?.('.store-aisle-card')))
            return;
          cta.hidden = true;
          list.after(cta);
        }, 0);
      };
      view.addEventListener('focusin', (e) => {
        if (aisleRows.length < 1) return;
        const card = e.target?.closest?.('.store-aisle-card');
        if (card) showAddAisleCtaBelowCard(card);
      });
      view.addEventListener('focusout', onFocusOut);
    };

    const wireAddAisle = () => {
      const cta = document.getElementById('storeAddAisleCta');
      if (!cta || !hasPersistedStore) return;

      const run = async () => {
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
        aisleRows.push({ id: tid, name });
        aisleItemsByAisle.set(tid, []);
        renderAisleCards();
        refreshDirty();
      };

      cta.addEventListener('click', () => void run());
      cta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void run();
        }
      });
    };

    const flushStoreAislesDraft = async (db, sid) => {
      const getVisibleCanonicalId = (name) => {
        const stmt = db.prepare(`
          SELECT ID FROM ingredients
          WHERE lower(trim(name)) = lower(trim(?))
            AND COALESCE(is_deprecated, 0) = 0
            AND COALESCE(hide_from_shopping_list, 0) = 0
          ORDER BY
            CASE WHEN TRIM(COALESCE(variant, '')) = '' THEN 0 ELSE 1 END,
            CASE WHEN TRIM(COALESCE(size, '')) = '' THEN 0 ELSE 1 END,
            ID ASC
          LIMIT 1
        `);
        stmt.bind([name]);
        let vid = null;
        if (stmt.step()) vid = Number(stmt.get()[0]);
        stmt.free();
        return Number.isFinite(vid) ? vid : null;
      };
      const anyIngredientNamed = (name) => {
        const stmt = db.prepare(
          `SELECT 1 FROM ingredients WHERE lower(trim(name)) = lower(trim(?)) LIMIT 1`,
        );
        stmt.bind([name]);
        const ok = stmt.step();
        stmt.free();
        return ok;
      };

      const blockedKeys = new Set();
      const unknownUnique = [];
      const uk = new Set();
      for (const r of aisleRows) {
        const lines = [...(aisleItemsByAisle.get(r.id) || [])];
        for (const name of lines) {
          const vid = getVisibleCanonicalId(name);
          if (vid) continue;
          if (anyIngredientNamed(name)) blockedKeys.add(normItemKey(name));
          else {
            const k = normItemKey(name);
            if (!uk.has(k)) {
              uk.add(k);
              unknownUnique.push(name);
            }
          }
        }
      }

      if (blockedKeys.size) {
        const sample = [];
        outer: for (const r of aisleRows) {
          for (const n of aisleItemsByAisle.get(r.id) || []) {
            if (blockedKeys.has(normItemKey(n))) {
              sample.push(n);
              if (sample.length >= 5) break outer;
            }
          }
        }
        uiToast(
          `Skipped (hidden or deprecated): ${sample.join(', ')}${blockedKeys.size > 5 ? '…' : ''}`,
        );
      }

      if (unknownUnique.length) {
        if (!window.ui?.dialogThreeChoice) {
          uiToast('UI not ready.');
          throw { silent: true };
        }
        const bullets = unknownUnique.map((n) => `• ${n}`).join('\n');
        const choice = await window.ui.dialogThreeChoice({
          title: 'Unknown items',
          message: `These names are not in your ingredient list:\n\n${bullets}\n\nCreate new ingredients, fix typos, or cancel save.`,
          discardText: 'Cancel',
          fixText: 'Fix input',
          createText: 'Create',
        });
        if (choice === 'discard') {
          uiToast('Save cancelled.');
          throw { silent: true };
        }
        if (choice === 'fix') {
          uiToast('Fix item names, then save again.');
          throw { silent: true };
        }
        for (const n of unknownUnique) {
          try {
            db.run('INSERT INTO ingredients (name) VALUES (?);', [n]);
          } catch (e) {
            console.warn('Store editor: insert ingredient', e);
          }
        }
        // New ingredient names should become available in the aisle items suggestions immediately.
        try {
          window.favoriteEatsTypeahead?.invalidate?.();
        } catch (_) {}
      }

      for (const aid of [...deletedAisleIds]) {
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
        aisleItemsByAisle.delete(oldId);
        aisleItemsByAisle.set(newId, [...items]);
        r.id = newId;
      }

      for (const r of aisleRows) {
        db.run(
          'UPDATE store_locations SET name = ? WHERE ID = ? AND store_id = ?;',
          [r.name || 'Aisle', r.id, sid],
        );
      }

      for (const r of aisleRows) {
        const lines = [...(aisleItemsByAisle.get(r.id) || [])].filter(
          (ln) => !blockedKeys.has(normItemKey(ln)),
        );
        const resolvedIds = [];
        const seenId = new Set();
        for (const name of lines) {
          const iid = getVisibleCanonicalId(name);
          if (!Number.isFinite(iid)) continue;
          if (seenId.has(iid)) continue;
          seenId.add(iid);
          resolvedIds.push(iid);
        }
        db.run(
          'DELETE FROM ingredient_store_location WHERE store_location_id = ?;',
          [r.id],
        );
        for (const iid of resolvedIds) {
          db.run(
            'INSERT INTO ingredient_store_location (ingredient_id, store_location_id) VALUES (?, ?);',
            [iid, r.id],
          );
        }
        const displayOrder = [];
        const sk = new Set();
        for (const name of lines) {
          const k = normItemKey(name);
          if (sk.has(k)) continue;
          sk.add(k);
          displayOrder.push(name);
        }
        aisleItemsByAisle.set(r.id, displayOrder);
      }
    };

    if (typeof waitForAppBarReady !== 'function') {
      renderAisleCards();
      wireAddAisleCtaFocus();
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
                aisleItemsByAisle.set(aid, parseUniqueItemLines(ta.value));
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
    wireAddAisleCtaFocus();
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

  // Hidden-by-default sheet model: rely on CSS class.
  nav.classList.add('bottom-nav--hidden');

  const pills = Array.from(nav.querySelectorAll('.bottom-nav-pill'));
  if (!pills.length) return;

  const body = document.body;
  let activeTab = null;

  if (body.classList.contains('recipes-page')) {
    activeTab = 'recipes';
  } else if (body.classList.contains('shopping-page')) {
    activeTab = 'shopping';
  } else if (body.classList.contains('units-page')) {
    activeTab = 'units';
  } else if (body.classList.contains('stores-page')) {
    activeTab = 'stores';
  }

  // Shared toggle handler for menu icon + app-bar title.

  const menuButton = document.getElementById('appBarMenuBtn');
  const titleToggle = document.getElementById('appBarTitle');

  const toggleNavVisibility = () => {
    nav.classList.toggle('bottom-nav--hidden');
  };

  // Menu icon toggles bottom nav visibility on list pages.
  if (menuButton) {
    menuButton.addEventListener('click', toggleNavVisibility);
  }

  // App-bar title also acts as a nav toggle.
  if (titleToggle) {
    titleToggle.addEventListener('click', toggleNavVisibility);
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

    nav.classList.add('bottom-nav--hidden');
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

      if (tab === 'recipes') {
        window.location.href = 'recipes.html';
      } else if (tab === 'shopping') {
        window.location.href = 'shopping.html';
      } else if (tab === 'units') {
        window.location.href = 'units.html';
      } else if (tab === 'stores') {
        window.location.href = 'stores.html';
      }
    });
  });
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
  window.recipeId = recipeId;

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
    isNewRecipe || (!hasAnySteps && !hasAnyIngredients);

  const shouldSeedIngredientPlaceholder = !hasAnyIngredients;

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

  // --- On load/return: apply full ingredient sort (per section) for display only ---
  // We intentionally do NOT persist or migrate the DB just by opening a recipe.
  try {
    if (typeof window.recipeEditorSortIngredientsOnLoad === 'function') {
      window.recipeEditorSortIngredientsOnLoad(recipe);
    }
  } catch (err) {
    console.warn('⚠️ Ingredient sort-on-load failed:', err);
  }

  const titleEl = document.getElementById('recipeTitle');
  if (titleEl) titleEl.textContent = recipe.title;

  // Shared app bar for recipe editor
  initAppBar({
    mode: 'editor',
    titleText: recipe.title || '',
    onBack: () => {
      void (async () => {
        const dirty =
          typeof window.recipeEditorGetIsDirty === 'function'
            ? window.recipeEditorGetIsDirty()
            : false;
        if (
          !dirty ||
          (await uiConfirm({
            title: 'Discard Changes?',
            message: 'Discard unsaved changes?',
            confirmText: 'Discard',
            cancelText: 'Cancel',
            danger: true,
          }))
        ) {
          window.location.href = 'recipes.html';
        }
      })();
    },
    onCancel: () => {
      if (typeof revertChanges === 'function') {
        revertChanges();
      }
    },
    onSave: async () => {
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
    },
  });

  renderRecipe(recipe);

  // ✅ One-time reset after first render
  if (typeof revertChanges === 'function') {
    revertChanges();
  }

  // --- Always scroll editor to top on load ---
  try {
    window.scrollTo({ top: 0, behavior: 'auto' });
  } catch (_) {
    window.scrollTo(0, 0);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // (intentionally empty) legacy DOMContentLoaded wiring removed
});
