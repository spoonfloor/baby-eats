// Shared SQL.js init (offline / local version)
let SQL;
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
          alert('No database selected.');
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
        alert('Failed to load database — check console for details.');
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
      alert('No database loaded. Please go back to the welcome page.');
      return;
    }
  } else {
    // Browser fallback (keeps old behavior)
    const stored = localStorage.getItem('favoriteEatsDb');
    if (!stored) {
      alert('No database loaded. Please go back to the welcome page.');
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

  // --- Load recipes ---
  const recipes = db.exec(
    'SELECT ID, title FROM recipes ORDER BY title COLLATE NOCASE;'
  );
  const list = document.getElementById('recipeList');
  list.innerHTML = '';

  window.dbInstance = db;

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
        // Ctrl-click → delete dialog; plain click → open editor
        if (event.ctrlKey) {
          event.preventDefault();
          event.stopPropagation();
          openDeleteModal(id, title);
          return;
        }

        sessionStorage.setItem('selectedRecipeId', id);
        window.location.href = 'recipeEditor.html';
      });

      // Primary click: open editor, unless modifier indicates delete
      li.addEventListener('click', (event) => {
        // Treat Ctrl-click (Windows/Linux) or Cmd-click (macOS) as "delete"
        const wantsDelete = event.ctrlKey || event.metaKey;

        if (wantsDelete) {
          event.preventDefault();
          event.stopPropagation();
          openDeleteModal(id, title);
          return;
        }

        sessionStorage.setItem('selectedRecipeId', id);
        window.location.href = 'recipeEditor.html';
      });

      // Right-click / two-finger click → delete dialog as well
      li.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        openDeleteModal(id, title);
      });

      list.appendChild(li);
    });
  }

  // --- Recipes action button stub ---

  const recipesActionBtn = document.getElementById('appBarAddBtn');

  function toTitleCase(str) {
    return str
      .toLowerCase()
      .replace(/\b\w+/g, (word) => word[0].toUpperCase() + word.slice(1));
  }

  const modal = document.getElementById('addRecipeModal');
  const cancelBtn = document.getElementById('addRecipeCancel');
  const createBtn = document.getElementById('addRecipeCreate');
  const titleInput = document.getElementById('newRecipeTitle');

  const deleteModal = document.getElementById('deleteRecipeModal');
  const deleteTitleSpan = document.getElementById('deleteRecipeTitle');
  const deleteCancelBtn = document.getElementById('deleteRecipeCancel');
  const deleteConfirmBtn = document.getElementById('deleteRecipeConfirm');
  let pendingDeleteId = null;

  // Start with Create disabled; enable only when there is non-blank text.
  if (createBtn) {
    createBtn.disabled = true;
  }

  function updateCreateButtonState() {
    if (!createBtn || !titleInput) return;
    const hasText = !!titleInput.value.trim();
    createBtn.disabled = !hasText;
  }

  function openModal() {
    if (!modal) return;
    modal.classList.remove('hidden');
    if (titleInput) {
      titleInput.value = '';
      titleInput.focus();

      // Reset disabled state on open
      updateCreateButtonState();
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add('hidden');
  }

  function openDeleteModal(id, title) {
    if (!deleteModal || !deleteTitleSpan) return;
    pendingDeleteId = id;
    deleteTitleSpan.textContent = title;
    deleteModal.classList.remove('hidden');
  }

  function closeDeleteModal() {
    if (!deleteModal) return;
    pendingDeleteId = null;
    deleteModal.classList.add('hidden');
  }

  if (deleteCancelBtn) {
    deleteCancelBtn.addEventListener('click', () => {
      closeDeleteModal();
    });
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

  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener('click', async () => {
      if (pendingDeleteId == null) {
        closeDeleteModal();
        return;
      }

      try {
        deleteRecipeDeep(db, pendingDeleteId);
      } catch (err) {
        console.error('❌ Failed to delete recipe:', err);
        alert('Failed to delete recipe. See console for details.');
        closeDeleteModal();
        return;
      }

      // --- Persist updated DB so delete is durable ---
      try {
        const binaryArray = db.export();
        const isElectronEnv = !!window.electronAPI;

        if (isElectronEnv) {
          const ok = await window.electronAPI.saveDB(binaryArray);
          if (ok === false) {
            alert('Failed to save database after deleting recipe.');
            return;
          }
        } else {
          // Browser fallback — keep DB in localStorage
          localStorage.setItem(
            'favoriteEatsDb',
            JSON.stringify(Array.from(binaryArray))
          );
        }
      } catch (err) {
        console.error('❌ Failed to persist DB after deleting recipe:', err);
        alert(
          'Failed to save database after deleting recipe. See console for details.'
        );
        return;
      }

      // Update in-memory list and UI
      recipeRows = recipeRows.filter(([id]) => id !== pendingDeleteId);
      renderRecipeList(recipeRows);

      closeDeleteModal();
    });
  }

  // Keep Create button in sync as user types.
  if (titleInput) {
    titleInput.addEventListener('input', updateCreateButtonState);
  }

  if (recipesActionBtn) {
    recipesActionBtn.addEventListener('click', openModal);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModal);
  }
  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      if (!titleInput) {
        closeModal();
        return;
      }

      const rawTitle = titleInput.value || '';
      const trimmed = rawTitle.trim();

      // Require non-empty
      if (!trimmed) {
        titleInput.focus();
        return;
      }

      const title = toTitleCase(trimmed);

      let newId = null;
      try {
        // Insert new recipe row (servings fields left NULL / default)
        db.run('INSERT INTO recipes (title) VALUES (?);', [title]);

        const idQ = db.exec('SELECT last_insert_rowid();');
        if (idQ.length && idQ[0].values.length) {
          newId = idQ[0].values[0][0];
        }
      } catch (err) {
        console.error('❌ Failed to create recipe:', err);
        alert('Failed to create recipe. See console for details.');
        return;
      }

      // --- Persist updated DB so editor + list can see the new recipe ---
      try {
        const binaryArray = db.export();
        const isElectronEnv = !!window.electronAPI;

        if (isElectronEnv) {
          const ok = await window.electronAPI.saveDB(binaryArray);
          if (ok === false) {
            alert('Failed to save database after creating recipe.');
            return;
          }
        } else {
          // Browser fallback — keep DB in localStorage
          localStorage.setItem(
            'favoriteEatsDb',
            JSON.stringify(Array.from(binaryArray))
          );
        }
      } catch (err) {
        console.error('❌ Failed to persist DB after creating recipe:', err);
        alert(
          'Failed to save database after creating recipe. See console for details.'
        );
        return;
      }

      closeModal();

      if (newId != null) {
        sessionStorage.setItem('selectedRecipeId', newId);

        // Mark this as a brand-new recipe so the editor can seed placeholders.
        sessionStorage.setItem('selectedRecipeIsNew', '1');

        window.location.href = 'recipeEditor.html';
      }
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
        title.toLowerCase().includes(query)
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
      alert('No database loaded. Please go back to the welcome page.');
      window.location.href = 'index.html';
      return;
    }
  } else {
    const stored = localStorage.getItem('favoriteEatsDb');
    if (!stored) {
      alert('No database loaded. Please go back to the welcome page.');
      window.location.href = 'index.html';
      return;
    }
    const Uints = new Uint8Array(JSON.parse(stored));
    db = new SQL.Database(Uints);
  }

  // Expose DB globally for any future helpers
  window.dbInstance = db;

  // --- Load shopping items from ingredients table ---
  const result = db.exec(`
    SELECT ID, name, variant
    FROM ingredients
    WHERE hide_from_shopping_list = 0
    ORDER BY name COLLATE NOCASE;
  `);

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

    // Dedupe + sort variants, then flatten into an array
    shoppingRows = Array.from(byName.values()).map((item) => {
      if (Array.isArray(item.variants) && item.variants.length > 0) {
        const unique = Array.from(
          new Set(
            item.variants
              .map((v) => (v || '').trim())
              .filter((v) => v.length > 0)
          )
        );

        unique.sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: 'base' })
        );

        item.variants = unique;
      } else {
        item.variants = [];
      }

      return item;
    });

    // Keep list stable + alphabetical by name
    shoppingRows.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, {
        sensitivity: 'base',
      })
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
        [n, n]
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

  function removeShoppingName(name) {
    const n = (name || '').trim();
    if (!n) return false;

    const usedCount = countRecipesUsingShoppingName(n);

    if (usedCount > 0) {
      const ok = window.confirm(
        `Remove '${n}'?\n\nUsed in ${usedCount} recipe${
          usedCount === 1 ? '' : 's'
        }.\n\nRemoving will hide it from Shopping and search (it will remain in recipes until replaced).`
      );
      if (!ok) return false;

      try {
        db.run(
          'UPDATE ingredients SET hide_from_shopping_list = 1 WHERE lower(name) = lower(?);',
          [n]
        );
      } catch (err) {
        console.error('❌ Failed to hide shopping item:', err);
        alert('Failed to remove item. See console for details.');
        return false;
      }
    } else {
      const ok = window.confirm(
        `Remove '${n}' permanently?\n\nIt is used in 0 recipes. This will delete it from the database.`
      );
      if (!ok) return false;

      try {
        // Gather ingredient IDs for this name (covers variants).
        const idsQ = db.exec(
          'SELECT ID FROM ingredients WHERE lower(name) = lower(?);',
          [n]
        );
        const ids = idsQ.length ? idsQ[0].values.map(([id]) => Number(id)) : [];

        // Remove dependent rows defensively (even though usedCount is 0).
        ids.forEach((id) => {
          if (!Number.isFinite(id)) return;
          try {
            db.run(
              'DELETE FROM ingredient_store_location WHERE ingredient_id = ?;',
              [id]
            );
          } catch (_) {}
          try {
            db.run(
              'DELETE FROM recipe_ingredient_substitutes WHERE ingredient_id = ?;',
              [id]
            );
          } catch (_) {}
          try {
            db.run(
              'DELETE FROM recipe_ingredient_map WHERE ingredient_id = ?;',
              [id]
            );
          } catch (_) {}
        });

        db.run('DELETE FROM ingredients WHERE lower(name) = lower(?);', [n]);
      } catch (err) {
        console.error('❌ Failed to delete shopping item:', err);
        alert('Failed to delete item. See console for details.');
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
          JSON.stringify(Array.from(binaryArray))
        );
      }
    } catch (err) {
      console.error(
        '❌ Failed to persist DB after removing shopping item:',
        err
      );
    }

    return true;
  }

  function renderShoppingList(rows) {
    list.innerHTML = '';

    rows.forEach((item) => {
      const li = document.createElement('li');

      // Capitalize initial letter for top-level shopping list display
      let line =
        item.name && item.name.length > 0
          ? item.name.charAt(0).toUpperCase() + item.name.slice(1)
          : item.name;

      if (Array.isArray(item.variants) && item.variants.length > 0) {
        const MAX_VISIBLE = 3;

        // item.variants is already deduped + alpha-sorted above
        const variants = item.variants;
        const visible = variants.slice(0, MAX_VISIBLE);
        const remainingCount =
          variants.length > MAX_VISIBLE ? variants.length - MAX_VISIBLE : 0;

        let variantLabel = visible.join(', ');

        if (remainingCount > 0) {
          variantLabel += `, +${remainingCount} other${
            remainingCount === 1 ? '' : 's'
          }`;
        }

        // e.g. "Basil (dried, fresh, lemon, +2 others)"
        line += ` (${variantLabel})`;
      }

      li.textContent = line;

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
        const ok = removeShoppingName(item.name || '');
        if (ok) {
          window.location.reload();
        }
      });

      list.appendChild(li);
    });
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
          (v || '').toLowerCase().includes(query)
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
  const addModal = document.getElementById('addShoppingModal');
  const addCancel = document.getElementById('addShoppingCancel');
  const addCreate = document.getElementById('addShoppingCreate');
  const addInput = document.getElementById('newShoppingName');

  const openAddShoppingModal = () => {
    if (!addModal) return;
    addModal.classList.remove('hidden');
    if (addInput) {
      addInput.value = '';
      addInput.focus();
    }
    if (addCreate) addCreate.disabled = true;
  };

  const closeAddShoppingModal = () => {
    if (!addModal) return;
    addModal.classList.add('hidden');
  };

  const updateAddShoppingCreateState = () => {
    if (!addCreate || !addInput) return;
    addCreate.disabled = !addInput.value.trim();
  };

  if (addInput)
    addInput.addEventListener('input', updateAddShoppingCreateState);
  if (addCancel) addCancel.addEventListener('click', closeAddShoppingModal);
  if (addBtn) addBtn.addEventListener('click', openAddShoppingModal);

  if (addCreate) {
    addCreate.addEventListener('click', async () => {
      const name = (addInput?.value || '').trim();
      if (!name) return;

      let newId = null;
      try {
        db.run('INSERT INTO ingredients (name) VALUES (?);', [name]);
        const idQ = db.exec('SELECT last_insert_rowid();');
        if (idQ.length && idQ[0].values.length) {
          newId = idQ[0].values[0][0];
        }
      } catch (err) {
        console.error('❌ Failed to create shopping item:', err);
        alert('Failed to create shopping item. See console for details.');
        return;
      }

      // Persist updated DB so editor + list can see the new item.
      try {
        const binaryArray = db.export();
        const isElectronEnv = !!window.electronAPI;
        if (isElectronEnv) {
          const ok = await window.electronAPI.saveDB(binaryArray);
          if (ok === false) {
            alert('Failed to save database after creating shopping item.');
            return;
          }
        } else {
          localStorage.setItem(
            'favoriteEatsDb',
            JSON.stringify(Array.from(binaryArray))
          );
        }
      } catch (err) {
        console.error(
          '❌ Failed to persist DB after creating shopping item:',
          err
        );
        alert('Failed to save database after creating shopping item.');
        return;
      }

      closeAddShoppingModal();

      if (newId != null) {
        sessionStorage.setItem('selectedShoppingItemId', String(newId));
        sessionStorage.setItem('selectedShoppingItemName', name);
        sessionStorage.setItem('selectedShoppingItemIsNew', '1');
        window.location.href = 'shoppingEditor.html';
      }
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
}) {
  if (!appBarTitleEl || !bodyTitleEl) return;

  const normalize = (value) => (value || '').trim();
  let baselineTitle = normalize(initialTitle);

  bodyTitleEl.textContent = baselineTitle || '';
  appBarTitleEl.textContent = baselineTitle || '';

  let isDirty = false;

  const updateButtons = () => {
    if (cancelBtn) cancelBtn.disabled = !isDirty;
    if (saveBtn) saveBtn.disabled = !isDirty;
  };

  updateButtons(); // page starts clean

  const markDirty = () => {
    if (!isDirty) {
      isDirty = true;
      updateButtons();
    }
  };

  // Title is editable in the page body only (app-bar title is display-only).
  bodyTitleEl.addEventListener('click', () => {
    if (bodyTitleEl.isContentEditable) return;

    const starting = bodyTitleEl.textContent || '';

    bodyTitleEl.contentEditable = 'true';
    bodyTitleEl.classList.add('editing-title');
    bodyTitleEl.focus();

    const onInput = () => {
      // First keystroke in the title should mark the page dirty.
      markDirty();
    };

    const cleanup = () => {
      bodyTitleEl.contentEditable = 'false';
      bodyTitleEl.classList.remove('editing-title');
      bodyTitleEl.removeEventListener('blur', onBlur);
      bodyTitleEl.removeEventListener('keydown', onKeyDown);
      bodyTitleEl.removeEventListener('input', onInput);
    };

    const commit = () => {
      const next = normalize(bodyTitleEl.textContent);
      const changed = next !== starting;
      bodyTitleEl.textContent = next;
      appBarTitleEl.textContent = next;
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

  const doBack = () => {
    if (!isDirty || window.confirm('Discard unsaved changes?')) {
      window.location.href = backHref;
    }
  };

  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      doBack();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!isDirty) return;
      bodyTitleEl.textContent = baselineTitle;
      appBarTitleEl.textContent = baselineTitle;
      isDirty = false;
      updateButtons();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      const nextTitle = normalize(bodyTitleEl.textContent);
      bodyTitleEl.textContent = nextTitle;
      appBarTitleEl.textContent = nextTitle;

      try {
        if (typeof onSave === 'function') {
          await onSave({ title: nextTitle, baselineTitle });
        }
      } catch (err) {
        console.error('❌ Failed to save child editor:', err);
        alert('Failed to save changes. See console for details.');
        return;
      }

      isDirty = false;
      updateButtons();
      // After a successful save, the saved title becomes the new cancel baseline.
      baselineTitle = nextTitle;
      // NOTE: no navigation here; Save just persists and stays on page
    });
  }
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

  // Body title (single place where editing happens)
  view.innerHTML = `
    <h1 id="childEditorTitle" class="recipe-title">${titleText || ''}</h1>
  `;

  const persistShoppingItemTitle = async ({ title: next }) => {
    if (!next) return;

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
          err
        );
        alert('No database loaded. Please go back to the welcome page.');
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

    try {
      const idStr = sessionStorage.getItem('selectedShoppingItemId');
      const id = Number(idStr);

      // If the row already exists (created from the list-page Create flow),
      // always UPDATE, even if it is flagged as "new".
      if (Number.isFinite(id)) {
        db.run('UPDATE ingredients SET name = ? WHERE ID = ?;', [next, id]);
      } else {
        db.run('INSERT INTO ingredients (name) VALUES (?);', [next]);
        const idQ = db.exec('SELECT last_insert_rowid();');
        if (idQ.length && idQ[0].values.length) {
          const newId = idQ[0].values[0][0];
          sessionStorage.setItem('selectedShoppingItemId', String(newId));
        }
      }
    } catch (err) {
      console.error('❌ Failed to upsert shopping item ingredient:', err);
      alert('Failed to save shopping item. See console for details.');
      throw err;
    }

    try {
      const binaryArray = db.export();
      const isElectronEnv = !!window.electronAPI;
      if (isElectronEnv) {
        const ok = await window.electronAPI.saveDB(binaryArray);
        if (ok === false) throw new Error('electronAPI.saveDB returned false');
      } else {
        localStorage.setItem(
          'favoriteEatsDb',
          JSON.stringify(Array.from(binaryArray))
        );
      }
    } catch (err) {
      console.error('❌ Failed to persist DB after shopping edit:', err);
      alert('Failed to save database. See console for details.');
      throw err;
    }

    sessionStorage.setItem('selectedShoppingItemName', next);
    sessionStorage.removeItem('selectedShoppingItemIsNew');
  };

  // Wire shared editor behavior once the injected shell exists.
  if (typeof waitForAppBarReady === 'function') {
    waitForAppBarReady().then(() => {
      wireChildEditorPage({
        backBtn: document.getElementById('appBarBackBtn'),
        cancelBtn: document.getElementById('appBarCancelBtn'),
        saveBtn: document.getElementById('appBarSaveBtn'),
        appBarTitleEl: document.getElementById('appBarTitle'),
        bodyTitleEl: document.getElementById('childEditorTitle'),
        initialTitle: titleText,
        backHref: 'shopping.html',
        onSave: persistShoppingItemTitle,
      });
    });
  }
}

function loadUnitEditorPage() {
  const view = document.getElementById('pageContent');

  if (!view) return;

  const isNew = sessionStorage.getItem('selectedUnitIsNew') === '1';
  const storedName = sessionStorage.getItem('selectedUnitNameSingular') || '';
  const titleText = storedName ? storedName : isNew ? 'New unit' : 'Unit';

  // Shell only; shared editor wiring happens after injection.
  initAppBar({ mode: 'editor', titleText });

  view.innerHTML = `
    <h1 id="childEditorTitle" class="recipe-title">${titleText || ''}</h1>
  `;

  if (typeof waitForAppBarReady === 'function') {
    waitForAppBarReady().then(() => {
      wireChildEditorPage({
        backBtn: document.getElementById('appBarBackBtn'),
        cancelBtn: document.getElementById('appBarCancelBtn'),
        saveBtn: document.getElementById('appBarSaveBtn'),
        appBarTitleEl: document.getElementById('appBarTitle'),
        bodyTitleEl: document.getElementById('childEditorTitle'),
        initialTitle: titleText,
        backHref: 'units.html',
        onSave: async ({ title: next }) => {
          const code = sessionStorage.getItem('selectedUnitCode') || '';
          if (!code) return;

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

          // Persist: update the singular name for this unit code.
          db.run('UPDATE units SET name_singular = ? WHERE code = ?;', [
            next || '',
            code,
          ]);

          // Persist DB to disk/localStorage.
          const binaryArray = db.export();
          if (isElectron) {
            const ok = await window.electronAPI.saveDB(binaryArray);
            if (ok === false)
              throw new Error('Failed to save DB for unit editor.');
          } else {
            localStorage.setItem(
              'favoriteEatsDb',
              JSON.stringify(Array.from(binaryArray))
            );
          }

          // Update session so reload reflects the new title immediately.
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
  const addModal = document.getElementById('addUnitModal');
  const addCancel = document.getElementById('addUnitCancel');
  const addCreate = document.getElementById('addUnitCreate');
  const addCode = document.getElementById('newUnitCode');
  const addName = document.getElementById('newUnitNameSingular');

  if (!list) return;

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
      alert('No database loaded. Please go back to the welcome page.');
      window.location.href = 'index.html';
      return;
    }
  } else {
    const stored = localStorage.getItem('favoriteEatsDb');
    if (!stored) {
      alert('No database loaded. Please go back to the welcome page.');
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
      })
    );
  }

  function renderUnitsList(rows) {
    list.innerHTML = '';
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
            [c, c]
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

      const removeUnit = (code) => {
        const c = (code || '').trim();
        if (!c) return false;

        const usedCount = countRecipesUsingUnit(c);

        if (usedCount > 0) {
          const ok = window.confirm(
            `Remove '${c}'?\n\nUsed in ${usedCount} recipe${
              usedCount === 1 ? '' : 's'
            }.\n\nRemoving will hide it from Units and search (it will remain in recipes until replaced).`
          );
          if (!ok) return false;

          try {
            db.run('UPDATE units SET is_hidden = 1 WHERE code = ?;', [c]);
          } catch (err) {
            console.error('❌ Failed to hide unit:', err);
            alert('Failed to remove unit. See console for details.');
            return false;
          }
        } else {
          const ok = window.confirm(
            `Remove '${c}' permanently?\n\nIt is used in 0 recipes. This will delete it from the database.`
          );
          if (!ok) return false;

          try {
            db.run('DELETE FROM units WHERE code = ?;', [c]);
          } catch (err) {
            console.error('❌ Failed to delete unit:', err);
            alert('Failed to delete unit. See console for details.');
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
              JSON.stringify(Array.from(binaryArray))
            );
          }
        } catch (err) {
          console.error('❌ Failed to persist DB after removing unit:', err);
        }

        return true;
      };

      li.addEventListener('click', (event) => {
        const wantsRemove = event.ctrlKey || event.metaKey;
        if (wantsRemove) {
          event.preventDefault();
          event.stopPropagation();
          const ok = removeUnit(unit.code || '');
          if (ok) window.location.reload();
          return;
        }

        // Stash selected unit in session for future editor wiring
        sessionStorage.setItem('selectedUnitCode', unit.code || '');
        sessionStorage.setItem(
          'selectedUnitNameSingular',
          unit.nameSingular || ''
        );
        sessionStorage.setItem('selectedUnitNamePlural', unit.namePlural || '');
        sessionStorage.setItem('selectedUnitCategory', unit.category || '');
        sessionStorage.removeItem('selectedUnitIsNew');

        window.location.href = 'unitEditor.html';
      });

      li.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        const ok = removeUnit(unit.code || '');
        if (ok) window.location.reload();
      });

      list.appendChild(li);
    });
  }

  // Initial render
  renderUnitsList(unitRows);

  // Recipes-style Add: popup → Cancel does nothing → Create inserts + opens editor
  const openAddUnitModal = () => {
    if (!addModal) return;
    addModal.classList.remove('hidden');
    if (addCode) {
      addCode.value = '';
      addCode.focus();
    }
    if (addName) addName.value = '';
    if (addCreate) addCreate.disabled = true;
  };

  const closeAddUnitModal = () => {
    if (!addModal) return;
    addModal.classList.add('hidden');
  };

  const updateAddUnitCreateState = () => {
    if (!addCreate || !addCode || !addName) return;
    addCreate.disabled = !addCode.value.trim() || !addName.value.trim();
  };

  if (addCode) addCode.addEventListener('input', updateAddUnitCreateState);
  if (addName) addName.addEventListener('input', updateAddUnitCreateState);
  if (addCancel) addCancel.addEventListener('click', closeAddUnitModal);
  if (addBtn) addBtn.addEventListener('click', openAddUnitModal);

  if (addCreate) {
    addCreate.addEventListener('click', async () => {
      const code = (addCode?.value || '').trim();
      const nameSingular = (addName?.value || '').trim();
      if (!code || !nameSingular) return;

      try {
        // Best-effort sort order: append at end
        let nextSort = null;
        try {
          const q = db.exec(
            'SELECT COALESCE(MAX(sort_order), 0) + 1 FROM units;'
          );
          if (q.length && q[0].values.length) {
            nextSort = q[0].values[0][0];
          }
        } catch (_) {
          nextSort = null;
        }

        db.run(
          'INSERT INTO units (code, name_singular, name_plural, category, sort_order) VALUES (?, ?, ?, ?, ?);',
          [code, nameSingular, '', '', nextSort]
        );
      } catch (err) {
        console.error('❌ Failed to create unit:', err);
        alert('Failed to create unit. (Code must be unique.)');
        return;
      }

      // Persist updated DB so editor + list can see the new unit.
      try {
        const binaryArray = db.export();
        const isElectronEnv = !!window.electronAPI;
        if (isElectronEnv) {
          const ok = await window.electronAPI.saveDB(binaryArray);
          if (ok === false) {
            alert('Failed to save database after creating unit.');
            return;
          }
        } else {
          localStorage.setItem(
            'favoriteEatsDb',
            JSON.stringify(Array.from(binaryArray))
          );
        }
      } catch (err) {
        console.error('❌ Failed to persist DB after creating unit:', err);
        alert('Failed to save database after creating unit.');
        return;
      }

      closeAddUnitModal();

      sessionStorage.setItem('selectedUnitCode', code);
      sessionStorage.setItem('selectedUnitNameSingular', nameSingular);
      sessionStorage.setItem('selectedUnitNamePlural', '');
      sessionStorage.setItem('selectedUnitCategory', '');
      sessionStorage.setItem('selectedUnitIsNew', '1');
      window.location.href = 'unitEditor.html';
    });
  }

  // Search: filter by code/name/category (case-insensitive)
  if (searchInput && clearBtn) {
    clearBtn.style.display = 'none';

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      clearBtn.style.display = query ? 'inline' : 'none';

      if (!query) {
        renderUnitsList(unitRows);
        return;
      }

      const filtered = unitRows.filter((u) => {
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

      renderUnitsList(filtered);
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      renderUnitsList(unitRows);
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
      alert('No database loaded. Please go back to the welcome page.');
      window.location.href = 'index.html';
      return;
    }
  } else {
    const stored = localStorage.getItem('favoriteEatsDb');
    if (!stored) {
      alert('No database loaded. Please go back to the welcome page.');
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

      const deleteStoreDeep = (storeId, label) => {
        const ok = window.confirm(`Delete '${label}'?`);
        if (!ok) return false;

        try {
          // Delete dependent store_locations and join rows first.
          const locQ = db.exec(
            'SELECT ID FROM store_locations WHERE store_id = ?;',
            [storeId]
          );
          const locIds = locQ.length
            ? locQ[0].values.map(([id]) => Number(id)).filter(Number.isFinite)
            : [];

          locIds.forEach((lid) => {
            try {
              db.run(
                'DELETE FROM ingredient_store_location WHERE store_location_id = ?;',
                [lid]
              );
            } catch (_) {}
          });

          db.run('DELETE FROM store_locations WHERE store_id = ?;', [storeId]);
          db.run('DELETE FROM stores WHERE ID = ?;', [storeId]);
        } catch (err) {
          console.error('❌ Failed to delete store:', err);
          alert('Failed to delete store. See console for details.');
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
              JSON.stringify(Array.from(binaryArray))
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
          const ok = deleteStoreDeep(Number(store.id), label);
          if (ok) window.location.reload();
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
        const ok = deleteStoreDeep(Number(store.id), label);
        if (ok) window.location.reload();
      });

      list.appendChild(li);
    });
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

  // Add button → new store editor (stub today, but should not be a no-op)
  const addModal = document.getElementById('addStoreModal');
  const addCancel = document.getElementById('addStoreCancel');
  const addCreate = document.getElementById('addStoreCreate');
  const addInput = document.getElementById('newStoreChain');

  const openAddStoreModal = () => {
    if (!addModal) return;
    addModal.classList.remove('hidden');
    if (addInput) {
      addInput.value = '';
      addInput.focus();
    }
    if (addCreate) addCreate.disabled = true;
  };

  const closeAddStoreModal = () => {
    if (!addModal) return;
    addModal.classList.add('hidden');
  };

  const updateAddStoreCreateState = () => {
    if (!addCreate || !addInput) return;
    addCreate.disabled = !addInput.value.trim();
  };

  if (addInput) addInput.addEventListener('input', updateAddStoreCreateState);
  if (addCancel) addCancel.addEventListener('click', closeAddStoreModal);

  if (addBtn) addBtn.addEventListener('click', openAddStoreModal);

  if (addCreate) {
    addCreate.addEventListener('click', async () => {
      if (!addInput) return closeAddStoreModal();
      const chain = addInput.value.trim();
      if (!chain) return;

      let newId = null;
      try {
        // Store schema requires both chain_name and location_name.
        db.run(
          'INSERT INTO stores (chain_name, location_name) VALUES (?, ?);',
          [chain, '']
        );
        const idQ = db.exec('SELECT last_insert_rowid();');
        if (idQ.length && idQ[0].values.length) {
          newId = idQ[0].values[0][0];
        }
      } catch (err) {
        console.error('❌ Failed to create store:', err);
        alert('Failed to create store. See console for details.');
        return;
      }

      // Persist updated DB so editor + list can see the new store.
      try {
        const binaryArray = db.export();
        const isElectronEnv = !!window.electronAPI;
        if (isElectronEnv) {
          const ok = await window.electronAPI.saveDB(binaryArray);
          if (ok === false) {
            alert('Failed to save database after creating store.');
            return;
          }
        } else {
          localStorage.setItem(
            'favoriteEatsDb',
            JSON.stringify(Array.from(binaryArray))
          );
        }
      } catch (err) {
        console.error('❌ Failed to persist DB after creating store:', err);
        alert('Failed to save database after creating store.');
        return;
      }

      closeAddStoreModal();

      if (newId != null) {
        sessionStorage.setItem('selectedStoreId', String(newId));
        sessionStorage.setItem('selectedStoreChain', chain);
        sessionStorage.setItem('selectedStoreLocation', '');
        sessionStorage.setItem('selectedStoreIsNew', '1');
        window.location.href = 'storeEditor.html';
      }
    });
  }
}

function loadStoreEditorPage() {
  const view = document.getElementById('pageContent');

  if (!view) {
    console.warn('No #pageContent found; skipping store-editor wiring.');
    return;
  }

  const isNew = sessionStorage.getItem('selectedStoreIsNew') === '1';
  const storedChain = sessionStorage.getItem('selectedStoreChain') || '';
  const titleText = storedChain ? storedChain : isNew ? 'New store' : 'Store';

  // Shell only; shared editor wiring happens after injection.
  initAppBar({ mode: 'editor', titleText });

  view.innerHTML = `
    <h1 id="childEditorTitle" class="recipe-title">${titleText || ''}</h1>
  `;

  if (typeof waitForAppBarReady === 'function') {
    waitForAppBarReady().then(() => {
      wireChildEditorPage({
        backBtn: document.getElementById('appBarBackBtn'),
        cancelBtn: document.getElementById('appBarCancelBtn'),
        saveBtn: document.getElementById('appBarSaveBtn'),
        appBarTitleEl: document.getElementById('appBarTitle'),
        bodyTitleEl: document.getElementById('childEditorTitle'),
        initialTitle: titleText,
        backHref: 'stores.html',
        onSave: async ({ title: next }) => {
          const idStr = sessionStorage.getItem('selectedStoreId');
          const isNewStore =
            sessionStorage.getItem('selectedStoreIsNew') === '1';

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
              throw new Error('No DB in localStorage for store editor.');
            const Uints = new Uint8Array(JSON.parse(stored));
            db = new SQL.Database(Uints);
          }

          window.dbInstance = db;

          const id = Number(idStr);

          // If the row already exists (created from the list-page Create flow),
          // always UPDATE, even if it is flagged as "new".
          if (Number.isFinite(id)) {
            db.run('UPDATE stores SET chain_name = ? WHERE ID = ?;', [
              next || '',
              id,
            ]);
          } else if (isNewStore || !idStr) {
            // Stores schema requires both chain_name and location_name.
            db.run(
              'INSERT INTO stores (chain_name, location_name) VALUES (?, ?);',
              [next || '', '']
            );

            const idQ = db.exec('SELECT last_insert_rowid();');
            if (idQ.length && idQ[0].values.length) {
              const newId = idQ[0].values[0][0];
              sessionStorage.setItem('selectedStoreId', String(newId));
            }
          }

          // Persist DB to disk/localStorage.
          const binaryArray = db.export();
          if (isElectron) {
            const ok = await window.electronAPI.saveDB(binaryArray);
            if (ok === false)
              throw new Error('Failed to save DB for store editor.');
          } else {
            localStorage.setItem(
              'favoriteEatsDb',
              JSON.stringify(Array.from(binaryArray))
            );
          }

          // Update session so reload reflects the new title immediately.
          sessionStorage.setItem('selectedStoreChain', next || '');
          sessionStorage.removeItem('selectedStoreIsNew');
        },
      });
    });
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
      'input, textarea, select, [contenteditable="true"]'
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
      alert('No database loaded. Please go back to the welcome page.');
      window.location.href = 'index.html';
      return;
    }
  } else {
    const stored = localStorage.getItem('favoriteEatsDb');
    if (!stored) {
      alert('No database loaded. Please go back to the welcome page.');
      window.location.href = 'index.html';
      return;
    }
    const Uints = new Uint8Array(JSON.parse(stored));
    db = new SQL.Database(Uints);
  }

  const recipeId = sessionStorage.getItem('selectedRecipeId');
  const isNewRecipe = sessionStorage.getItem('selectedRecipeIsNew') === '1';

  if (!recipeId) {
    alert('No recipe selected.');
    window.location.href = 'recipes.html';
    return;
  }

  window.dbInstance = db;
  window.recipeId = recipeId;

  // Fetch via bridge (single source of truth)
  const recipe = bridge.loadRecipeFromDB(db, recipeId);

  if (!recipe) {
    alert('Recipe not found.');
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
      (section) => Array.isArray(section.steps) && section.steps.length > 0
    );

  const hasAnyIngredients =
    Array.isArray(recipe.sections) &&
    recipe.sections.some(
      (section) =>
        Array.isArray(section.ingredients) && section.ingredients.length > 0
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

    // Ensure at least one placeholder ingredient whenever there are none
    if (
      shouldSeedIngredientPlaceholder &&
      (!Array.isArray(firstSection.ingredients) ||
        firstSection.ingredients.length === 0)
    ) {
      firstSection.ingredients = [
        {
          quantity: '',
          unit: '',
          name: 'Add an ingredient.',
          variant: '',
          prepNotes: '',
          parentheticalNote: '',
          isOptional: false,
          substitutes: [],
          locationAtHome: '',
          subRecipeId: null,
          isPlaceholder: true,
        },
      ];
    }
  }

  const titleEl = document.getElementById('recipeTitle');
  if (titleEl) titleEl.textContent = recipe.title;

  // Shared app bar for recipe editor
  initAppBar({
    mode: 'editor',
    titleText: recipe.title || '',
    onBack: () => {
      const dirty =
        typeof window.recipeEditorGetIsDirty === 'function'
          ? window.recipeEditorGetIsDirty()
          : false;
      if (!dirty || window.confirm('Discard unsaved changes?')) {
        window.location.href = 'recipes.html';
      }
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
          if (ok) alert('Database saved successfully.');
          else alert('Save failed — check console for details.');
        } else {
          localStorage.setItem(
            'favoriteEatsDb',
            JSON.stringify(Array.from(binaryArray))
          );
        }

        // Refresh Cancel baseline after a successful save
        if (window.bridge && typeof bridge.loadRecipeFromDB === 'function') {
          const refreshed = bridge.loadRecipeFromDB(
            window.dbInstance,
            window.recipeId
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
        alert('Save failed — check console for details.');
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
