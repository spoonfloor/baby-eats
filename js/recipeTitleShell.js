/* global favoriteEatsDataApi */
// Recipe shell: editable title + tag picker, session/save/revert (legacy full editor removed).
(function initRecipeTitleShell(global) {
  if (!global || typeof global.document === 'undefined') return;

  let isDirty = false;
  let recipeEditorExitPromptInFlight = false;

  global._recipeEditorCancelBtn = null;
  global._recipeEditorSaveBtn = null;

  function enableSave() {
    const btn =
      global._recipeEditorSaveBtn || global.document.getElementById('appBarSaveBtn');
    if (btn) btn.disabled = false;
  }

  function wireRecipeEditorAppBarButtons() {
    global._recipeEditorCancelBtn = global.document.getElementById('appBarCancelBtn');
    global._recipeEditorSaveBtn = global.document.getElementById('appBarSaveBtn');

    if (global._recipeEditorCancelBtn) {
      global._recipeEditorCancelBtn.disabled = true;
    }
    if (global._recipeEditorSaveBtn) global._recipeEditorSaveBtn.disabled = true;
  }

  function normalizeRecipeTitle(raw) {
    if (raw == null) return 'Untitled';
    const trimmed = String(raw).trim();
    if (!trimmed) return 'Untitled';
    return trimmed;
  }

  function markDirty() {
    if (!isDirty) {
      isDirty = true;
      const c =
        global._recipeEditorCancelBtn ||
        global.document.getElementById('appBarCancelBtn');
      if (c) c.disabled = false;
      enableSave();
    }
  }

  function isRecipeWebModeActive() {
    return false;
  }

  function normalizeRecipeTagsArray(rawTags) {
    const source = Array.isArray(rawTags)
      ? rawTags
      : String(rawTags || '')
          .split(/[\n,]/)
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

  // --- Recipe tags keyboard helpers (tests extract this block) ---
  function shouldCommitRecipeTagsEdit(event) {
    return !!(event && event.key === 'Enter' && !event.shiftKey);
  }

  global.__recipeTagsKeyboardHelpers = {
    shouldCommitRecipeTagsEdit,
  };
  // --- End recipe tags keyboard helpers ---

  function getVisibleRecipeTagNamePool() {
    if (Array.isArray(global.recipeEditorTagOptions)) {
      const seen = new Set();
      return global.recipeEditorTagOptions
        .map((name) => String(name || '').trim().replace(/\s+/g, ' '))
        .filter((name) => {
          if (!name) return false;
          const key = name.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    }
    const db = global.dbInstance;
    if (!db) return [];
    try {
      const q = db.exec(`
      SELECT name
      FROM tags
      WHERE name IS NOT NULL
        AND trim(name) != ''
        AND COALESCE(is_hidden, 0) = 0
        AND COALESCE(NULLIF(lower(trim(intended_use)), ''), 'recipes') = 'recipes'
      ORDER BY COALESCE(sort_order, 999999), name COLLATE NOCASE;
    `);
      if (!Array.isArray(q) || !q.length || !Array.isArray(q[0].values)) return [];
      const seen = new Set();
      const out = [];
      q[0].values.forEach((row) => {
        const name = String((Array.isArray(row) ? row[0] : null) || '')
          .trim()
          .replace(/\s+/g, ' ');
        if (!name) return;
        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(name);
      });
      return out;
    } catch (_) {
      try {
        const q2 = db.exec(`
        SELECT name
        FROM tags
        WHERE name IS NOT NULL
          AND trim(name) != ''
          AND COALESCE(is_hidden, 0) = 0
        ORDER BY name COLLATE NOCASE;
      `);
        if (!Array.isArray(q2) || !q2.length || !Array.isArray(q2[0].values)) return [];
        const seen = new Set();
        const out2 = [];
        q2[0].values.forEach((row) => {
          const name = String((Array.isArray(row) ? row[0] : null) || '')
            .trim()
            .replace(/\s+/g, ' ');
          if (!name) return;
          const key = name.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          out2.push(name);
        });
        return out2;
      } catch (_) {
        return [];
      }
    }
  }

  /** When legacy data has multiple tags, keep only the first. */
  function normalizeToSingleRecipeTagList(rawTags) {
    const arr = normalizeRecipeTagsArray(rawTags);
    if (arr.length <= 1) return arr;
    return [arr[0]];
  }

  function canonicalRecipeTagNameInPool(name, pool) {
    if (!name || !Array.isArray(pool)) return '';
    const low = String(name).trim().toLowerCase();
    for (let i = 0; i < pool.length; i += 1) {
      const p = pool[i];
      if (String(p || '').trim().toLowerCase() === low) return String(p).trim();
    }
    return String(name).trim();
  }

  function renderRecipeTagsSection(recipe, container) {
    if (isRecipeWebModeActive()) return;
    const section =
      (container && container.querySelector('#tagsSection')) ||
      global.document.getElementById('tagsSection');
    if (!section) return;
    const recipeModel = global.recipeData || recipe;
    if (!recipeModel) return;

    try {
      delete global._recipeTagsEditorState;
    } catch (_) {}
    try {
      global.document.body.classList.remove('recipe-tags-editing');
    } catch (_) {}

    const before = normalizeRecipeTagsArray(recipeModel.tags || []);
    const afterSingle = normalizeToSingleRecipeTagList(before);
    recipeModel.tags = afterSingle;
    if (
      before.length > 1 &&
      !global.recipeEditorCatalogOnlyMode
    ) {
      markDirty();
    }

    const pool = getVisibleRecipeTagNamePool();
    if (afterSingle.length) {
      const canon = canonicalRecipeTagNameInPool(afterSingle[0], pool);
      if (
        canon &&
        canon !== afterSingle[0] &&
        pool.some(
          (p) =>
            String(p || '').toLowerCase() === String(afterSingle[0] || '').toLowerCase(),
        )
      ) {
        recipeModel.tags = [canon];
      }
    }

    const currentTag = recipeModel.tags[0] || '';
    const tagIsInPool =
      !currentTag ||
      pool.some((p) => String(p).toLowerCase() === String(currentTag).toLowerCase());

    section.className = 'recipe-tags-section';
    section.innerHTML = '';

    const header = global.document.createElement('h2');
    header.className = 'section-header';
    header.textContent = 'Tags';
    section.appendChild(header);

    const content = global.document.createElement('div');
    content.className = 'recipe-tags-content';
    section.appendChild(content);

    const selectEl = global.document.createElement('select');
    selectEl.id = 'recipeTagSelect';
    selectEl.className = 'recipe-tags-select';
    selectEl.setAttribute('aria-label', 'Recipe tag');

    const addOpt = (value, text) => {
      const o = global.document.createElement('option');
      o.value = value;
      o.textContent = text;
      selectEl.appendChild(o);
    };

    addOpt('', 'none');
    if (currentTag && !tagIsInPool) {
      addOpt(currentTag, currentTag);
    }
    pool.forEach((name) => {
      addOpt(name, name);
    });

    if (currentTag && tagIsInPool) {
      const canonical = canonicalRecipeTagNameInPool(currentTag, pool);
      selectEl.value = canonical || currentTag;
    } else {
      selectEl.value = currentTag && !tagIsInPool ? currentTag : '';
    }

    const commitTagSelectionFromPicker = () => {
      const v = String(selectEl.value || '');
      const prevKey = JSON.stringify(
        (normalizeToSingleRecipeTagList(recipeModel.tags || [])[0] || '').toLowerCase(),
      );
      const next = v ? [v] : [];
      const nextKey = JSON.stringify((next[0] || '').toLowerCase());
      recipeModel.tags = next;
      if (prevKey !== nextKey) {
        markDirty();
      }
    };

    selectEl.addEventListener('change', commitTagSelectionFromPicker);
    selectEl.addEventListener('input', commitTagSelectionFromPicker);
    selectEl.addEventListener('blur', commitTagSelectionFromPicker);

    content.appendChild(selectEl);
  }

  function attachTitleEditor(titleEl) {
    if (!titleEl) return;

    titleEl.addEventListener('click', () => {
      if (titleEl.isContentEditable) return;

      const original = titleEl.textContent || '';
      let hasPendingEdit = false;
      const hadDirty = isDirty === true;

      titleEl.contentEditable = 'true';
      titleEl.classList.add('editing-title');
      titleEl.focus();

      const cleanup = () => {
        titleEl.contentEditable = 'false';
        titleEl.classList.remove('editing-title');
        titleEl.removeEventListener('blur', onBlur);
        titleEl.removeEventListener('input', onInput);
        titleEl.removeEventListener('keydown', onKeyDown);
      };

      const commit = () => {
        const raw = titleEl.textContent || '';
        const nextTitle = normalizeRecipeTitle(raw);

        if (global.recipeData && global.recipeData.title !== nextTitle) {
          global.recipeData.title = nextTitle;
          markDirty();
        }
        titleEl.textContent = nextTitle;

        const appTitle = global.document.getElementById('appBarTitle');
        if (appTitle) appTitle.textContent = nextTitle;
      };

      const onInput = () => {
        if (!hasPendingEdit) {
          hasPendingEdit = true;
          markDirty();
        }
      };

      const cancelLocal = () => {
        titleEl.textContent = original;
        const appTitle = global.document.getElementById('appBarTitle');
        if (appTitle) appTitle.textContent = original;
        if (!hadDirty && typeof revertChanges === 'function') {
          revertChanges();
        }
      };

      const onBlur = () => {
        commit();
        cleanup();
      };

      const onKeyDown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          titleEl.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelLocal();
          cleanup();
        }
      };

      titleEl.addEventListener('blur', onBlur);
      titleEl.addEventListener('input', onInput);
      titleEl.addEventListener('keydown', onKeyDown);
    });
  }

  function renderRecipe(recipe) {
    if (!recipe) return;

    global.recipeData = JSON.parse(JSON.stringify(recipe));
    try {
      if (!global.originalRecipeSnapshot || global.originalRecipeSnapshot.id !== recipe.id) {
        global.originalRecipeSnapshot = JSON.parse(JSON.stringify(recipe));
      }
    } catch (_) {
      /* ignore */
    }

    const appBarTitleEl = global.document.getElementById('appBarTitle');
    if (appBarTitleEl) {
      appBarTitleEl.textContent = recipe.title || '';
    }

    const container = global.document.getElementById('pageContent');
    if (!container) return;

    container.innerHTML =
      '<h1 id="recipeTitle" class="recipe-title"></h1><div id="tagsSection"></div>';
    const titleEl = container.querySelector('#recipeTitle');
    if (titleEl) {
      titleEl.textContent = recipe.title || '';
      attachTitleEditor(titleEl);
    }

    renderRecipeTagsSection(recipe, container);

    if (typeof global.recipeEditorResetDirty === 'function') {
      global.recipeEditorResetDirty();
    }
  }

  function revertChanges() {
    const source = global.originalRecipeSnapshot || global.recipeData;
    if (!source) return;
    const restoreSource = JSON.parse(JSON.stringify(source));
    renderRecipe(restoreSource);
  }

  global.recipeEditorGetIsDirty = function recipeEditorGetIsDirty() {
    return !!isDirty;
  };

  global.recipeEditorResetDirty = function recipeEditorResetDirty() {
    isDirty = false;
    const c =
      global._recipeEditorCancelBtn || global.document.getElementById('appBarCancelBtn');
    const s =
      global._recipeEditorSaveBtn || global.document.getElementById('appBarSaveBtn');
    if (c) c.disabled = true;
    if (s) s.disabled = true;
  };

  global.renderRecipe = renderRecipe;
  global.revertChanges = revertChanges;

  async function recipeEditorAttemptExit({
    reason = 'exit',
    onClean = null,
    onDiscard = null,
    onSaveSuccess = null,
  } = {}) {
    const run = async (fn) => {
      if (typeof fn === 'function') {
        await fn();
      }
    };

    if (
      global.ui &&
      typeof global.ui.isDialogOpen === 'function' &&
      global.ui.isDialogOpen()
    ) {
      return false;
    }

    const dirty = global.recipeEditorGetIsDirty();
    if (!dirty) {
      await run(onClean);
      return true;
    }

    if (recipeEditorExitPromptInFlight) return false;
    recipeEditorExitPromptInFlight = true;

    try {
      if (global.ui && typeof global.ui.dialogThreeChoice === 'function') {
        const message =
          reason === 'manage' ? 'Save changes before leaving?' : 'Save changes before exiting?';
        const choice = await global.ui.dialogThreeChoice({
          title: 'Unsaved changes',
          message,
          fixText: 'Cancel',
          discardText: 'Discard',
          createText: 'Save',
          discardDanger: true,
          dismissChoice: 'fix',
        });
        if (choice === 'fix') return false;

        if (choice === 'create') {
          try {
            if (typeof global.recipeEditorSave === 'function') {
              await global.recipeEditorSave();
            }
          } catch (_) {
            return false;
          }
          if (global.recipeEditorGetIsDirty()) return false;
          await run(onSaveSuccess);
          return true;
        }

        if (choice === 'discard') {
          global.recipeEditorResetDirty();
          await run(onDiscard);
          return true;
        }
        return false;
      }

      const ok =
        typeof global.uiConfirm === 'function'
          ? await global.uiConfirm({
              title: 'Discard Changes?',
              message: 'Discard unsaved changes?',
              confirmText: 'Discard',
              cancelText: 'Cancel',
              danger: true,
            })
          : global.confirm('Discard unsaved changes?');
      if (!ok) return false;
      global.recipeEditorResetDirty();
      await run(onDiscard);
      return true;
    } finally {
      recipeEditorExitPromptInFlight = false;
    }
  }

  global.recipeEditorAttemptExit = recipeEditorAttemptExit;

  async function saveRecipeToDB() {
    const recipe = global.recipeData;

    if (!recipe) {
      throw new Error('saveRecipeToDB: missing recipeData');
    }

    const rid = Number(global.recipeId || recipe.id);
    if (!Number.isFinite(rid)) {
      throw new Error('saveRecipeToDB: invalid recipe id');
    }

    const normalizeRecipeTagsForModel = (raw) => {
      const source = Array.isArray(raw) ? raw : String(raw || '').split('\n');
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
    };

    if (
      !global.favoriteEatsDataApi ||
      typeof global.favoriteEatsDataApi.saveRecipeMeta !== 'function'
    ) {
      throw new Error('saveRecipeToDB: no data backend available');
    }
    const title = String(recipe.title || '').trim();
    recipe.tags = normalizeRecipeTagsForModel(recipe.tags);
    const refreshed = await global.favoriteEatsDataApi.saveRecipeMeta({
      id: rid,
      title,
      servings: {
        default:
          recipe.servingsDefault ??
          (recipe.servings && recipe.servings.default != null ? recipe.servings.default : null),
        min:
          recipe.servings && recipe.servings.min != null ? recipe.servings.min : null,
        max:
          recipe.servings && recipe.servings.max != null ? recipe.servings.max : null,
      },
      tags: recipe.tags,
    });

    try {
      global.dispatchEvent(new CustomEvent('favoriteEats:db-updated'));
    } catch (_) {
      /* ignore */
    }

    return refreshed || null;
  }

  global.saveRecipeToDB = saveRecipeToDB;

  if (typeof global.waitForAppBarReady === 'function') {
    global.waitForAppBarReady().then(() => wireRecipeEditorAppBarButtons());
  } else {
    wireRecipeEditorAppBarButtons();
  }

  global.document.addEventListener(
    'keydown',
    (e) => {
      if (!e || e.key !== 'Escape') return;
      if (e.defaultPrevented) return;
      if (!global.recipeEditorGetIsDirty()) return;
      e.preventDefault();
      void recipeEditorAttemptExit({
        reason: 'esc',
        onDiscard: () => {
          if (typeof revertChanges === 'function') revertChanges();
        },
      });
    },
    true,
  );

  global.addEventListener('beforeunload', (e) => {
    if (!global.recipeEditorGetIsDirty()) return;
    e.preventDefault();
    e.returnValue = '';
    return '';
  });
})(typeof window !== 'undefined' ? window : globalThis);
