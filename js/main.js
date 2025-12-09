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
      li.textContent = title;

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

  // Normalize into the same shape the UI already expects
  let shoppingRows = [];
  if (result.length > 0) {
    shoppingRows = result[0].values.map(([id, name, variant]) => ({
      id,
      name,
      variants: variant ? [variant] : [],
    }));
  }

  function renderShoppingList(rows) {
    list.innerHTML = '';

    rows.forEach((item) => {
      const li = document.createElement('li');

      let line = item.name;
      if (Array.isArray(item.variants) && item.variants.length > 0) {
        line += ` (${item.variants.join(', ')})`;
      }

      li.textContent = line;

      li.addEventListener('click', () => {
        sessionStorage.setItem('selectedShoppingItemId', String(item.id));
        sessionStorage.setItem('selectedShoppingItemName', item.name || '');
        sessionStorage.removeItem('selectedShoppingItemIsNew');
        window.location.href = 'shoppingItem.html';
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

      window.location.href = 'shoppingItem.html';
    });
  }
}

function loadShoppingItemEditorPage() {
  const backBtn = document.getElementById('shoppingBackButton');
  const cancelBtn = document.getElementById('shoppingCancelBtn');
  const saveBtn = document.getElementById('shoppingSaveBtn');

  const view = document.getElementById('pageContent');

  if (!view) return;

  const isNew = sessionStorage.getItem('selectedShoppingItemIsNew') === '1';
  const storedName = sessionStorage.getItem('selectedShoppingItemName') || '';

  let titleText = storedName.trim();
  if (!titleText && !isNew) {
    titleText = 'Shopping item';
  }

  const titleEl = document.createElement('h1');
  titleEl.className = 'recipe-title';
  titleEl.textContent = titleText;
  view.appendChild(titleEl);

  const goBack = () => {
    window.location.href = 'shopping.html';
  };

  if (backBtn) backBtn.addEventListener('click', goBack);
  if (cancelBtn) cancelBtn.addEventListener('click', goBack);
  if (saveBtn) saveBtn.addEventListener('click', goBack);
}

function loadUnitsPage() {
  const list = document.getElementById('unitsList');
  if (!list) return;

  list.innerHTML = '';

  const li = document.createElement('li');
  li.textContent = 'Units manager UI coming soon.';
  li.className = 'nav-text';
  list.appendChild(li);
}

function loadStoresPage() {
  const list = document.getElementById('storesList');
  if (!list) return;

  list.innerHTML = '';

  const li = document.createElement('li');
  li.textContent = 'Stores manager UI coming soon.';
  li.className = 'nav-text';
  list.appendChild(li);
}

function loadStoreEditorPage() {
  // Placeholder: real editor wiring will be implemented later.
  console.info('loadStoreEditorPage() not implemented yet.');
}

// --- Bottom navigation wiring (list pages only) ---
function initBottomNav() {
  const nav = document.querySelector('.bottom-nav');
  if (!nav) return;

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
});
