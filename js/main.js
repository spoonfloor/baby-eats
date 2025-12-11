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

  // --- Bottom navigation wiring ---
  initBottomNav();
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
  const recipesActionBtn = document.getElementById('recipesActionBtn');

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
  const searchInput = document.getElementById('recipeSearch');
  const clearBtn = document.querySelector('.clear-search');

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
  const searchInput = document.getElementById('shoppingSearch');
  const clearBtn = document.querySelector('.clear-search');
  const addBtn = document.getElementById('shoppingActionBtn');

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

      li.addEventListener('click', () => {
        sessionStorage.setItem('selectedShoppingItemId', String(item.id));
        sessionStorage.setItem('selectedShoppingItemName', item.name || '');
        sessionStorage.removeItem('selectedShoppingItemIsNew');
        window.location.href = 'shoppingEditor.html';
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

  // Add button → new shopping item editor
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      sessionStorage.removeItem('selectedShoppingItemId');

      sessionStorage.removeItem('selectedShoppingItemName');
      sessionStorage.setItem('selectedShoppingItemIsNew', '1');

      window.location.href = 'shoppingEditor.html';
    });
  }
}

// --- Shared helper for child editor pages (shopping, units, stores, …) ---
function wireChildEditorPage({
  backBtn,
  cancelBtn,
  saveBtn,
  titleEl,
  initialTitle,
  backHref,
  onSave,
}) {
  if (!titleEl) return;

  const normalize = (value) => (value || '').trim();
  const originalTitle = normalize(initialTitle);

  if (originalTitle) {
    titleEl.textContent = originalTitle;
  }

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

  // Inline title editing: click → edit, Enter/blur → commit, Esc → cancel
  titleEl.addEventListener('click', () => {
    if (titleEl.isContentEditable) return;

    const starting = titleEl.textContent || '';

    titleEl.contentEditable = 'true';
    titleEl.classList.add('editing-title');
    titleEl.focus();

    const onInput = () => {
      // First keystroke in the title should mark the page dirty.
      markDirty();
    };

    const cleanup = () => {
      titleEl.contentEditable = 'false';
      titleEl.classList.remove('editing-title');
      titleEl.removeEventListener('blur', onBlur);
      titleEl.removeEventListener('keydown', onKeyDown);
      titleEl.removeEventListener('input', onInput);
    };

    const commit = () => {
      const next = normalize(titleEl.textContent);
      const changed = next !== starting;
      titleEl.textContent = next;
      if (changed) markDirty();
    };

    const cancelEdit = () => {
      titleEl.textContent = starting;
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

    titleEl.addEventListener('input', onInput);
    titleEl.addEventListener('blur', onBlur);
    titleEl.addEventListener('keydown', onKeyDown);
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
      titleEl.textContent = originalTitle;
      isDirty = false;
      updateButtons();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      const nextTitle = normalize(titleEl.textContent);
      titleEl.textContent = nextTitle;

      try {
        if (typeof onSave === 'function') {
          await onSave({ title: nextTitle, originalTitle });
        }
      } catch (err) {
        console.error('❌ Failed to save child editor:', err);
        alert('Failed to save changes. See console for details.');
        return;
      }

      isDirty = false;
      updateButtons();
      // NOTE: no navigation here; Save just persists and stays on page
    });
  }
}

function loadShoppingItemEditorPage() {
  const backBtn =
    document.getElementById('appBarBackBtn') ||
    document.getElementById('shoppingBackButton');
  const cancelBtn =
    document.getElementById('appBarCancelBtn') ||
    document.getElementById('shoppingCancelBtn');
  const saveBtn =
    document.getElementById('appBarSaveBtn') ||
    document.getElementById('shoppingSaveBtn');

  const view = document.getElementById('pageContent');

  if (!view) return;

  const isNew = sessionStorage.getItem('selectedShoppingItemIsNew') === '1';
  const storedName = sessionStorage.getItem('selectedShoppingItemName') || '';

  let titleText = storedName.trim();
  if (!titleText && !isNew) {
    titleText = 'Shopping item';
  }

  // Shared app bar now owns the title
  if (titleText && titleText.length > 0) {
    titleText = titleText.charAt(0).toUpperCase() + titleText.slice(1);
  }

  initAppBar({
    mode: 'editor',
    titleText,
    onBack: () => {
      window.location.href = 'shopping.html';
    },
    onCancel: () => {
      // restore original
      const original = sessionStorage.getItem('selectedShoppingItemName') || '';
      const el = document.getElementById('appBarTitle');
      if (el) el.textContent = original;
    },
    onSave: async () => {
      const el = document.getElementById('appBarTitle');
      const next = (el?.textContent || '').trim();
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

      const idStr = sessionStorage.getItem('selectedShoppingItemId');
      const isNewItem =
        sessionStorage.getItem('selectedShoppingItemIsNew') === '1';

      try {
        if (isNewItem || !idStr) {
          db.run('INSERT INTO ingredients (name) VALUES (?);', [next]);
        } else {
          const id = Number(idStr);
          if (Number.isFinite(id)) {
            db.run('UPDATE ingredients SET name = ? WHERE ID = ?;', [next, id]);
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
          if (ok === false)
            throw new Error('electronAPI.saveDB returned false');
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
    },
  });

  wireChildEditorPage({
    backBtn,
    cancelBtn,
    saveBtn,
    titleEl,
    initialTitle: titleText,

    backHref: 'shopping.html',
    onSave: async ({ title }) => {
      const nameForDb = (title || '').trim();
      if (!nameForDb) {
        // Nothing to persist; treat as no-op.
        return;
      }

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
        if (!stored) {
          alert('No database loaded. Please go back to the welcome page.');
          throw new Error('No DB in localStorage for shopping editor.');
        }
        const Uints = new Uint8Array(JSON.parse(stored));
        db = new SQL.Database(Uints);
      }

      window.dbInstance = db;

      const idStr = sessionStorage.getItem('selectedShoppingItemId');
      const isNewItem =
        sessionStorage.getItem('selectedShoppingItemIsNew') === '1';

      try {
        if (isNewItem || !idStr) {
          // New shopping item → insert bare ingredient row
          db.run('INSERT INTO ingredients (name) VALUES (?);', [nameForDb]);
        } else {
          const id = Number(idStr);
          if (Number.isFinite(id)) {
            db.run('UPDATE ingredients SET name = ? WHERE ID = ?;', [
              nameForDb,
              id,
            ]);
          }
        }
      } catch (err) {
        console.error('❌ Failed to upsert shopping item ingredient:', err);
        alert('Failed to save shopping item. See console for details.');
        throw err;
      }

      // Persist DB so the shopping list sees the change
      try {
        const binaryArray = db.export();
        const isElectronEnv = !!window.electronAPI;

        if (isElectronEnv) {
          const ok = await window.electronAPI.saveDB(binaryArray);
          if (ok === false) {
            alert('Failed to save database after editing shopping item.');
            throw new Error('electronAPI.saveDB returned false');
          }
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

      // Keep session in sync for the next editor visit
      sessionStorage.setItem('selectedShoppingItemName', nameForDb);
      sessionStorage.removeItem('selectedShoppingItemIsNew');
    },
  });
}

function loadUnitEditorPage() {
  const backBtn = document.getElementById('unitBackButton');
  const cancelBtn = document.getElementById('unitCancelBtn');
  const saveBtn = document.getElementById('unitSaveBtn');
  const view = document.getElementById('pageContent');

  if (!view) return;

  const titleEl = document.createElement('h1');
  titleEl.className = 'recipe-title';
  view.appendChild(titleEl);

  wireChildEditorPage({
    backBtn,
    cancelBtn,
    saveBtn,
    titleEl,
    initialTitle: 'New unit',
    backHref: 'units.html',
  });
}

async function loadUnitsPage() {
  const list = document.getElementById('unitsList');
  const searchInput = document.getElementById('unitsSearch');
  const clearBtn = document.querySelector('.clear-search');

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
  const result = db.exec(`
    SELECT code, name_singular, name_plural, category, sort_order
    FROM units
    ORDER BY sort_order ASC, code COLLATE NOCASE;
  `);

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

      // Force initial cap on the primary label (code)
      let line = unit.code || '';
      if (line && line.length > 0) {
        line = line.charAt(0).toUpperCase() + line.slice(1);
      }

      // If we have a human-friendly singular name different from the code, append it
      if (
        unit.nameSingular &&
        unit.nameSingular.toLowerCase() !== (unit.code || '').toLowerCase()
      ) {
        const label =
          unit.nameSingular.charAt(0).toUpperCase() +
          unit.nameSingular.slice(1);
        line += ` (${label})`;
      }

      li.textContent = line;

      li.addEventListener('click', () => {
        // Stash selected unit in session for future editor wiring
        sessionStorage.setItem('selectedUnitCode', unit.code || '');
        sessionStorage.setItem(
          'selectedUnitNameSingular',
          unit.nameSingular || ''
        );
        sessionStorage.setItem('selectedUnitNamePlural', unit.namePlural || '');
        sessionStorage.setItem('selectedUnitCategory', unit.category || '');

        window.location.href = 'unitEditor.html';
      });

      list.appendChild(li);
    });
  }

  // Initial render
  renderUnitsList(unitRows);

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
  const list = document.getElementById('storesList');
  const searchInput = document.getElementById('storesSearch');
  const clearBtn = document.querySelector('.clear-search');

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

      const chain =
        store.chain && store.chain.length > 0
          ? store.chain.charAt(0).toUpperCase() + store.chain.slice(1)
          : store.chain;

      const location = store.location || '';

      li.textContent = location ? `${chain} (${location})` : chain || '';

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
}

function loadStoreEditorPage() {
  const backBtn = document.getElementById('storeBackButton');
  const cancelBtn = document.getElementById('storeCancelBtn');
  const saveBtn = document.getElementById('storeSaveBtn');

  const view = document.getElementById('pageContent');

  if (!view) {
    console.warn('No #pageContent found; skipping store-editor wiring.');
    return;
  }

  const titleEl = document.createElement('h1');
  titleEl.className = 'recipe-title';
  view.appendChild(titleEl);

  wireChildEditorPage({
    backBtn,
    cancelBtn,
    saveBtn,
    titleEl,
    initialTitle: 'New store',
    backHref: 'stores.html',
  });
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
  const menuButton = document.getElementById('menuButton');

  const titleToggle = document.querySelector(
    '.app-bar-elements-layer .title-recipes'
  );

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
  const backButton = document.getElementById('backButton');
  if (backButton) {
    backButton.addEventListener('click', () => {
      window.location.href = 'recipes.html';
    });
  }

  // Bridge shared app bar controls → existing editor actions (additive only).
  const body = document.body;

  if (body && body.classList.contains('recipe-editor-page')) {
    const appBackBtn = document.getElementById('appBarBackBtn');
    const appCancelBtn = document.getElementById('appBarCancelBtn');
    const appSaveBtn = document.getElementById('appBarSaveBtn');

    const cancelBtn = document.getElementById('cancelEditsBtn');
    const saveBtn = document.getElementById('editorActionBtn');

    if (appBackBtn && backButton) {
      appBackBtn.addEventListener('click', () => backButton.click());
    }
    if (appCancelBtn && cancelBtn) {
      appCancelBtn.addEventListener('click', () => cancelBtn.click());
    }
    if (appSaveBtn && saveBtn) {
      appSaveBtn.addEventListener('click', () => saveBtn.click());
    }
  }

  if (body && body.classList.contains('shopping-editor-page')) {
    const appBackBtn = document.getElementById('appBarBackBtn');
    const appCancelBtn = document.getElementById('appBarCancelBtn');
    const appSaveBtn = document.getElementById('appBarSaveBtn');

    const shoppingBack = document.getElementById('shoppingBackButton');
    const shoppingCancel = document.getElementById('shoppingCancelBtn');
    const shoppingSave = document.getElementById('shoppingSaveBtn');

    if (appBackBtn && shoppingBack) {
      appBackBtn.addEventListener('click', () => shoppingBack.click());
    }
    if (appCancelBtn && shoppingCancel) {
      appCancelBtn.addEventListener('click', () => shoppingCancel.click());
    }
    if (appSaveBtn && shoppingSave) {
      appSaveBtn.addEventListener('click', () => shoppingSave.click());
    }
  }
});
