// --- Display modes ---
const SHOW_RECIPE_TEXT = true; // normal human-readable output
const SHOW_DEBUG_LOC_TAGS = false; // e.g., esse, 2_frid, spin, baby
const SHOW_DEBUG_MEASURE_TAGS = false; // e.g., marinar, 4½ cup

// --- Canonical measure order (normalized units) ---
const MEASURE_ORDER = [
  '⅛ tsp',
  '¼ tsp',
  '½ tsp',
  '1 tsp',
  '½ tbsp',
  '1 tbsp',
  '1½ tbsp',
  '⅛ cup',
  '¼ cup',
  '⅓ cup',
  '½ cup',
  '⅔ cup',
  '¾ cup',
  '1 cup',
  '2 cup',
  '4 cup',
  '8 cup',
];

// --- Canonical order for locations (base version used in debug and general logic) ---
const LOCATION_ORDER = [
  '', // null / top-level
  'fridge',
  'freezer',
  'above fridge',
  'pantry',
  'cereal cabinet',
  'spices',
  'measures',
  'fruit stand',
  'coffee bar',
];

// --- Custom order for “You will need” section only ---
const NEED_LOCATION_ORDER = [
  'fridge',
  'freezer',
  'above fridge',
  'pantry',
  'cereal cabinet',
  'spices',
  'fruit stand',
  'coffee bar',
  '', // no location/misc
  'measures',
];

// --- Canonical order for Ingredients section (for normal reading) ---
const INGREDIENTS_LOCATION_ORDER = [
  '', // null / top-level
  'fridge',
  'above fridge',
  'pantry',
  'coffee bar',
  'cereal cabinet',
  'spices',
  'fruit stand',
  'freezer',
  'measures',
];

// --- You Will Need helpers ---
function formatNeedLine(ing) {
  let qtyText = '';
  if (typeof ing.quantity === 'number' && !isNaN(ing.quantity)) {
    qtyText = decimalToFractionDisplay(ing.quantity);
  } else if (typeof ing.quantity === 'string' && ing.quantity.trim()) {
    qtyText = ing.quantity;
  }

  const unitText = ing.unit || '';
  const qtyUnit = [qtyText, unitText].filter(Boolean).join(' ');

  let text = `${ing.variant ? ing.variant + ' ' : ''}${ing.name}`;
  if (qtyUnit) text += ` (${qtyUnit})`;

  if (ing.isOptional) {
    if (qtyUnit) text = text.replace(/\)$/, ', optional)');
    else text += ' (optional)';
  }

  return text.trim();
}

function sortIngredients(list, locationOrder = INGREDIENTS_LOCATION_ORDER) {
  return [...list].sort((a, b) => {
    const aLoc = a.locationAtHome || '';
    const bLoc = b.locationAtHome || '';
    const locIndexA = locationOrder.indexOf(aLoc);
    const locIndexB = locationOrder.indexOf(bLoc);
    if (locIndexA !== locIndexB) return locIndexA - locIndexB;

    if (a.isOptional !== b.isOptional) return a.isOptional ? 1 : -1;

    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    if (nameA !== nameB) return nameA.localeCompare(nameB);

    const varA = a.variant ? a.variant.toLowerCase() : '';
    const varB = b.variant ? b.variant.toLowerCase() : '';
    return varA.localeCompare(varB);
  });
}

function mergeByIngredient(list) {
  const merged = [];
  const map = new Map();

  list.forEach((ing) => {
    const key = `${ing.variant || ''}|${ing.name}|${ing.size || ''}|${
      ing.locationAtHome || ''
    }`;
    if (!map.has(key)) {
      map.set(key, { ...ing });
    } else {
      const existing = map.get(key);
      if (
        typeof existing.quantity === 'number' &&
        typeof ing.quantity === 'number' &&
        existing.unit === ing.unit
      ) {
        existing.quantity += ing.quantity;
      }
      existing.isOptional = existing.isOptional || ing.isOptional;
    }
  });

  map.forEach((v) => merged.push(v));
  return merged;
}

// --- Shared page content resolver (non-breaking during migration) ---

const getPageContentContainer = () => document.getElementById('pageContent');

// --- Subhead insertion mode (hold Control) ---
function ensureIngredientSubheadInsertModeWiring() {
  if (window._ingredientSubheadInsertModeWired) return;
  window._ingredientSubheadInsertModeWired = true;

  const setMode = (flag) => {
    try {
      document.body.classList.toggle('subhead-insert-mode', !!flag);
    } catch (_) {}
  };

  // Default off.
  setMode(false);

  document.addEventListener('keydown', (e) => {
    if (!e) return;
    // Only Control toggles insert mode (matches requested UX).
    if (e.key === 'Control' || e.ctrlKey) {
      setMode(true);
    }
  });

  document.addEventListener('keyup', (e) => {
    if (!e) return;
    // On keyup, drop the mode when Control is no longer held.
    if (e.key === 'Control' || !e.ctrlKey) {
      setMode(false);
    }
  });

  // If the window loses focus, ensure mode is off (avoid “stuck” state).
  window.addEventListener('blur', () => setMode(false));
}

// --- Ingredient ordering helpers (main Ingredients list) ---
const INGREDIENT_SORT_LOCATION_ORDER = NEED_LOCATION_ORDER.slice();

function ingredientLocationRank(loc) {
  const v = (loc || '').toLowerCase().trim();
  // Blank/unknown should be last in the location tier.
  if (!v) return INGREDIENT_SORT_LOCATION_ORDER.length + 1;
  const idx = INGREDIENT_SORT_LOCATION_ORDER.indexOf(v);
  return idx === -1 ? INGREDIENT_SORT_LOCATION_ORDER.length + 1 : idx;
}

function sortIngredientsForMainList(list) {
  return [...list].sort((a, b) => {
    const aOpt = !!a.isOptional;
    const bOpt = !!b.isOptional;
    if (aOpt !== bOpt) return aOpt ? 1 : -1;

    const la = ingredientLocationRank(a.locationAtHome);
    const lb = ingredientLocationRank(b.locationAtHome);
    if (la !== lb) return la - lb;

    const na = (a.name || '').toLowerCase();
    const nb = (b.name || '').toLowerCase();
    if (na !== nb) return na.localeCompare(nb);

    const va = (a.variant || '').toLowerCase();
    const vb = (b.variant || '').toLowerCase();
    return va.localeCompare(vb);
  });
}

function stablePartitionOptionals(list) {
  const required = [];
  const optional = [];
  list.forEach((ing) => {
    if (!ing) return;
    // Ignore subsection headings; they are handled by partitionOptionalsWithinSubsections.
    if (ing && ing.rowType === 'heading') return;
    if (ing.isOptional) optional.push(ing);
    else required.push(ing);
  });
  return required.concat(optional);
}

function partitionOptionalsWithinSubsections(list) {
  const out = [];

  let segment = [];
  const flushSegment = () => {
    if (!segment.length) return;
    const req = [];
    const opt = [];
    segment.forEach((row) => {
      if (!row) return;
      if (row.isOptional) opt.push(row);
      else req.push(row);
    });
    out.push(...req, ...opt);
    segment = [];
  };

  (list || []).forEach((row) => {
    if (!row) return;
    if (row.rowType === 'heading') {
      flushSegment();
      out.push(row);
      return;
    }
    // Treat everything else as an ingredient row.
    segment.push(row);
  });

  flushSegment();

  return out;
}

function stripIngredientPlaceholders(section) {
  if (!section || !Array.isArray(section.ingredients)) return;
  const isPlaceholderish = (r) => {
    if (!r || r.rowType === 'heading') return false;
    if (r.isPlaceholder) return true;
    const isBlank = (val) => val == null || String(val).trim() === '';
    const nameIsPrompt =
      typeof r.name === 'string' &&
      r.name.trim().toLowerCase() === 'add an ingredient.';
    return (
      isBlank(r.quantity) &&
      isBlank(r.unit) &&
      isBlank(r.variant) &&
      isBlank(r.size) &&
      isBlank(r.prepNotes) &&
      isBlank(r.parentheticalNote) &&
      (isBlank(r.name) || nameIsPrompt)
    );
  };
  section.ingredients = section.ingredients.filter((r) => !isPlaceholderish(r));
}

function rerenderIngredientsSectionFromModel() {
  const container = getPageContentContainer();
  if (!container) return;
  const ingredientsSection = container.querySelector('#ingredientsSection');
  if (!ingredientsSection) return;

  const recipe = window.recipeData;
  if (!recipe) return;

  ingredientsSection.innerHTML = '';

  const ingredientsHeader = document.createElement('h2');
  ingredientsHeader.className = 'section-header';
  ingredientsHeader.textContent = 'Ingredients';
  ingredientsSection.appendChild(ingredientsHeader);

  // v1: Ingredients render from the first section (bridge loads a single synthetic section).
  const firstSection =
    Array.isArray(recipe.sections) && recipe.sections[0]
      ? recipe.sections[0]
      : null;
  if (firstSection) stripIngredientPlaceholders(firstSection);
  const rows = Array.isArray(firstSection?.ingredients)
    ? firstSection.ingredients
    : [];

  const isHeading = (row) => row && row.rowType === 'heading';
  const renderRows = rows;

  ensureIngredientSubheadInsertModeWiring();

  // Top insertion zone (suppressed if next row is a heading)
  {
    const next = renderRows.length > 0 ? renderRows[0] : null;
    const zone = document.createElement('div');
    zone.className = 'ingredient-insert-zone';
    if (next && isHeading(next))
      zone.classList.add('ingredient-insert-zone--disabled');
    let _didInsert = false;
    const handleInsert = (e) => {
      if (zone.classList.contains('ingredient-insert-zone--disabled')) return;
      if (!e || !e.ctrlKey) return;
      if (_didInsert) return;
      _didInsert = true;
      try {
        setTimeout(() => {
          _didInsert = false;
        }, 0);
      } catch (_) {}

      // If a heading editor is active, commit/delete it first; ctrl-click insertion
      // prevents normal focus changes so blur won't run.
      try {
        const active = window._activeIngredientHeadingEditor;
        if (active && typeof active.commit === 'function') {
          active.commit();
          // After commit triggers a rerender, perform the insert on next tick.
          setTimeout(() => {
            if (
              typeof window.recipeEditorInsertIngredientHeadingAt === 'function'
            ) {
              window.recipeEditorInsertIngredientHeadingAt(firstSection, 0);
            }
          }, 0);
          return;
        }
      } catch (_) {}

      // Ctrl-click on mac can be treated as a right-click (contextmenu) and may not
      // fire a normal `click` event. Handle on pointer/mousedown instead.
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (_) {}
      if (typeof window.recipeEditorInsertIngredientHeadingAt === 'function') {
        window.recipeEditorInsertIngredientHeadingAt(firstSection, 0);
      }
    };
    zone.addEventListener('pointerdown', handleInsert);
    zone.addEventListener('contextmenu', (e) => {
      // Prevent control-click context menu when user is in insert mode.
      if (e && e.ctrlKey) {
        e.preventDefault();
        handleInsert(e);
      }
    });
    ingredientsSection.appendChild(zone);
  }

  renderRows.forEach((row, idx) => {
    let el = null;
    if (row && row.rowType === 'heading') {
      if (typeof window.renderIngredientHeading === 'function') {
        el = window.renderIngredientHeading(row);
      } else {
        el = document.createElement('div');
        el.className = 'ingredient-subsection-heading-line';
        const span = document.createElement('span');
        span.className = 'ingredient-subsection-heading-text';
        span.textContent = row.text || '';
        el.appendChild(span);
      }
    } else {
      if (typeof renderIngredient === 'function') {
        if (row && row.rowType !== 'heading') {
          // Ensure every ingredient row has a stable clientId for in-session operations (delete/undo).
          if (!row.clientId) {
            row.clientId =
              row.rimId != null
                ? `i-${row.rimId}`
                : `tmp-ing-${Date.now()}-${Math.random()
                    .toString(16)
                    .slice(2)}`;
          }
        }
        el = renderIngredient(row);
      } else {
        el = document.createElement('div');
        el.className = 'ingredient-line';
        const span = document.createElement('span');
        span.textContent = `${row.quantity || ''} ${row.unit || ''} ${
          row.name || ''
        }`.trim();
        el.appendChild(span);
      }
    }
    if (el) ingredientsSection.appendChild(el);

    // Inter-row insertion zone (between idx and idx+1), suppressed adjacent to headings
    const next = idx + 1 < renderRows.length ? renderRows[idx + 1] : null;
    if (!next) return;
    const zone = document.createElement('div');
    zone.className = 'ingredient-insert-zone';
    if (isHeading(row) || isHeading(next)) {
      zone.classList.add('ingredient-insert-zone--disabled');
    }
    let _didInsert = false;
    const handleInsert = (e) => {
      if (zone.classList.contains('ingredient-insert-zone--disabled')) return;
      if (!e || !e.ctrlKey) return;
      if (_didInsert) return;
      _didInsert = true;
      try {
        setTimeout(() => {
          _didInsert = false;
        }, 0);
      } catch (_) {}

      try {
        const active = window._activeIngredientHeadingEditor;
        if (active && typeof active.commit === 'function') {
          active.commit();
          setTimeout(() => {
            if (
              typeof window.recipeEditorInsertIngredientHeadingAt === 'function'
            ) {
              window.recipeEditorInsertIngredientHeadingAt(
                firstSection,
                idx + 1
              );
            }
          }, 0);
          return;
        }
      } catch (_) {}

      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (_) {}
      if (typeof window.recipeEditorInsertIngredientHeadingAt === 'function') {
        window.recipeEditorInsertIngredientHeadingAt(firstSection, idx + 1);
      }
    };
    zone.addEventListener('pointerdown', handleInsert);
    zone.addEventListener('contextmenu', (e) => {
      if (e && e.ctrlKey) {
        e.preventDefault();
        handleInsert(e);
      }
    });
    ingredientsSection.appendChild(zone);
  });

  appendIngredientAddCta({
    container: ingredientsSection,
    sectionRef: firstSection,
  });

  // Focus a newly inserted heading, if any.
  try {
    const pending = window._pendingFocusIngredientHeadingClientId;
    if (pending) {
      window._pendingFocusIngredientHeadingClientId = null;
      const target = ingredientsSection.querySelector(
        `[data-heading-client-id="${pending}"]`
      );
      if (target && typeof target.click === 'function') {
        target.click();
      }
    }
  } catch (_) {}

  // Keep "You will need" in sync with ingredient edits.
  try {
    if (typeof window.recipeEditorRerenderYouWillNeedFromModel === 'function') {
      window.recipeEditorRerenderYouWillNeedFromModel();
    }
  } catch (_) {}
}

function rerenderYouWillNeedFromModel() {
  const container = getPageContentContainer();
  if (!container) return;
  const recipe = window.recipeData;
  if (!recipe) return;

  let needWrapper = container.querySelector('.you-will-need-card');
  const stepsSection = container.querySelector('#stepsSection');
  if (!needWrapper) {
    needWrapper = document.createElement('div');
    needWrapper.className = 'you-will-need-card';
    if (stepsSection && stepsSection.parentNode === container) {
      container.insertBefore(needWrapper, stepsSection);
    } else {
      container.appendChild(needWrapper);
    }
  }

  needWrapper.innerHTML = '';
  const needHeader = document.createElement('h2');
  needHeader.className = 'section-header';
  needHeader.textContent = 'You will need';
  needWrapper.appendChild(needHeader);

  const allIngredientsRaw = Array.isArray(recipe.sections)
    ? recipe.sections.flatMap((s) => s.ingredients || [])
    : [];

  const allIngredients = allIngredientsRaw.filter(
    (row) => row && row.rowType !== 'heading'
  );

  if (allIngredients.length === 0) {
    const line = document.createElement('div');
    line.className = 'ingredient-line';
    const span = document.createElement('span');
    span.className = 'placeholder-prompt';
    span.textContent = 'No ingredients yet. Add some above.';
    line.appendChild(span);
    needWrapper.appendChild(line);
    return;
  }

  const grouped = {};
  allIngredients.forEach((ing) => {
    const loc = ing.locationAtHome || '';
    if (!grouped[loc]) grouped[loc] = [];
    grouped[loc].push(ing);
  });

  Object.keys(grouped).forEach((loc) => {
    grouped[loc] = mergeByIngredient(grouped[loc]);
  });

  NEED_LOCATION_ORDER.forEach((loc) => {
    const items = grouped[loc];
    if (!items || !items.length) return;

    const subHeader = document.createElement('div');
    subHeader.className = 'subsection-header';
    subHeader.textContent = loc ? capitalizeWords(loc) : 'Misc';
    needWrapper.appendChild(subHeader);

    sortIngredients(items, NEED_LOCATION_ORDER).forEach((ing) => {
      const line = document.createElement('div');
      line.className = 'ingredient-line';
      const span = document.createElement('span');
      span.textContent = formatNeedLine(ing);
      line.appendChild(span);
      needWrapper.appendChild(line);
    });
  });

  const measures = computeMeasures(allIngredients);
  if (measures.length > 0) {
    const measureHeader = document.createElement('div');
    measureHeader.className = 'subsection-header';
    measureHeader.textContent = 'Measures';
    needWrapper.appendChild(measureHeader);

    measures.forEach((m) => {
      const line = document.createElement('div');
      line.className = 'ingredient-line';
      const span = document.createElement('span');
      span.textContent = formatMeasureLabel(m);
      line.appendChild(span);
      needWrapper.appendChild(line);
    });
  }
}

window.recipeEditorRerenderYouWillNeedFromModel = rerenderYouWillNeedFromModel;

// Render a single UI-only CTA for adding an ingredient (no data placeholders).
function appendIngredientAddCta({ container, sectionRef }) {
  if (!container || !sectionRef) return;
  // Avoid duplicate CTAs if rerendering without clearing.
  const existing = container.querySelector('.ingredient-add-cta');
  if (existing) existing.remove();

  // If an edit row is active, defer showing the CTA until the edit flow finishes.
  const hasActiveEdit = !!container.querySelector(
    '.ingredient-edit-row.editing'
  );
  if (hasActiveEdit) return;

  // In non-empty state, do not render a CTA.
  const hasAnyIngredients = Array.isArray(sectionRef.ingredients)
    ? sectionRef.ingredients.some((r) => r && r.rowType !== 'heading')
    : false;
  if (hasAnyIngredients) return;

  const cta = document.createElement('div');
  // Share layout class with ingredient rows so spacing/line-height rules are identical.
  cta.className = 'ingredient-line ingredient-add-cta';
  const text = document.createElement('span');
  text.className = 'placeholder-prompt';
  text.textContent = 'Add an ingredient.';
  cta.appendChild(text);

  cta.addEventListener('click', () => {
    if (typeof openIngredientEditRow === 'function') {
      openIngredientEditRow({
        parent: container,
        replaceEl: cta,
        mode: 'insert',
        seedLine: null,
      });
    }
  });

  container.appendChild(cta);
}

function deleteIngredientRowFromSection(sectionRef, rowRef) {
  if (!sectionRef || !Array.isArray(sectionRef.ingredients) || !rowRef)
    return null;
  const idx = sectionRef.ingredients.indexOf(rowRef);
  if (idx < 0) return null;
  const removed = sectionRef.ingredients.splice(idx, 1)[0] || null;
  return { idx, removed };
}

window.recipeEditorDeleteIngredientRow = async ({
  sectionRef,
  rowRef,
  focusId,
  focusBy = 'clientId',
} = {}) => {
  if (!sectionRef || !rowRef) return false;

  // Capture a deep-ish snapshot for undo.
  const snapshot = JSON.parse(JSON.stringify(rowRef));

  // Confirm before deleting (consistent with parent pages).
  try {
    const labelParts = [];
    if (snapshot.quantity != null && String(snapshot.quantity).trim()) {
      labelParts.push(String(snapshot.quantity).trim());
    }
    if (snapshot.unit != null && String(snapshot.unit).trim()) {
      labelParts.push(String(snapshot.unit).trim());
    }
    const nameBits = [];
    if (snapshot.variant) nameBits.push(String(snapshot.variant).trim());
    if (snapshot.name) nameBits.push(String(snapshot.name).trim());
    if (snapshot.size) nameBits.push(String(snapshot.size).trim());
    const nameStr = nameBits.filter(Boolean).join(' ');
    if (nameStr) labelParts.push(nameStr);

    const display =
      labelParts.filter(Boolean).join(' ').trim() || 'this ingredient';
    const ok =
      window.ui && typeof window.ui.confirm === 'function'
        ? await window.ui.confirm({
            title: 'Remove Ingredient',
            message: `Remove "${display}" from this recipe?\n\nThis won’t delete it from your shopping items.`,
            confirmText: 'Remove',
            cancelText: 'Cancel',
            danger: true,
          })
        : window.confirm(
            `Remove "${display}" from this recipe?\n\nThis won’t delete it from your shopping items.`
          );
    if (!ok) return false;
  } catch (_) {
    // If confirm fails for some reason, proceed (fail-open).
  }

  const del = deleteIngredientRowFromSection(sectionRef, rowRef);
  if (!del || !del.removed) return false;

  // Mark editor dirty (explicit destructive action).
  try {
    if (typeof markDirty === 'function') markDirty();
  } catch (_) {}

  rerenderIngredientsSectionFromModel();

  const restore = () => {
    try {
      if (!Array.isArray(sectionRef.ingredients)) sectionRef.ingredients = [];
      const insertAt = Math.min(
        Math.max(0, del.idx),
        sectionRef.ingredients.length
      );
      sectionRef.ingredients.splice(insertAt, 0, snapshot);
      stripIngredientPlaceholders(sectionRef);
    } catch (_) {}

    rerenderIngredientsSectionFromModel();

    // Best-effort: scroll restored row into view
    try {
      const container = getPageContentContainer();
      const ingredientsSection = container?.querySelector(
        '#ingredientsSection'
      );
      if (!ingredientsSection) return;
      const selector =
        focusBy === 'rimId'
          ? `.ingredient-line[data-rim-id="${String(
              focusId || snapshot.rimId || ''
            )}"]`
          : `.ingredient-line[data-client-id="${String(
              focusId || snapshot.clientId || ''
            )}"]`;
      const el = ingredientsSection.querySelector(selector);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    } catch (_) {}
  };

  // Offer undo (single-slot toast)
  try {
    const um = window.undoManager;
    if (um && typeof um.push === 'function') {
      um.push({
        message: 'Ingredient removed from recipe',
        undo: restore,
        timeoutMs: 8000,
      });
    } else if (typeof window.showUndoToast === 'function') {
      window.showUndoToast({
        message: 'Ingredient removed from recipe',
        onUndo: restore,
      });
    }
  } catch (_) {}

  return true;
};

// Exposed hooks used by ingredient editor + main.js loader.
window.recipeEditorAfterIngredientEditCommit = (sectionRef) => {
  if (!sectionRef || !Array.isArray(sectionRef.ingredients)) return;

  // Remove any legacy placeholder-ish rows that may have slipped in.
  stripIngredientPlaceholders(sectionRef);

  // Always enforce "optional goes to bottom" within the current subsection.
  sectionRef.ingredients = partitionOptionalsWithinSubsections(
    sectionRef.ingredients
  );

  // Keep "You will need" in sync even if we skip a disruptive rerender.
  try {
    if (typeof window.recipeEditorRerenderYouWillNeedFromModel === 'function') {
      window.recipeEditorRerenderYouWillNeedFromModel();
    }
  } catch (_) {}

  // If another ingredient row is already active (e.g. Enter-to-next flow),
  // avoid a disruptive rerender mid-session.
  const hasActiveIngredientEditor = !!document.querySelector(
    '.ingredient-edit-row.editing'
  );
  if (hasActiveIngredientEditor) return;

  rerenderIngredientsSectionFromModel();
};

window.recipeEditorSortIngredientsOnLoad = (recipe) => {
  if (!recipe || !Array.isArray(recipe.sections)) return false;
  let changed = false;

  recipe.sections.forEach((sec) => {
    if (!sec || !Array.isArray(sec.ingredients) || sec.ingredients.length === 0)
      return;

    stripIngredientPlaceholders(sec);

    const before = sec.ingredients
      .map((row) => {
        if (!row) return '';
        if (row.rowType === 'heading')
          return `h:${row.headingId ?? row.headingClientId ?? ''}`;
        return `i:${row.rimId ?? ''}`;
      })
      .join('|');

    const hasHeadings = sec.ingredients.some(
      (r) => r && r.rowType === 'heading'
    );
    const hasSortOrder = sec.ingredients.some(
      (r) => r && Number.isFinite(r.sortOrder)
    );

    if (hasHeadings || hasSortOrder) {
      // Respect persisted ordering; only enforce optional placement within subsections.
      sec.ingredients = [...sec.ingredients].sort((a, b) => {
        const sa = a && Number.isFinite(a.sortOrder) ? a.sortOrder : 999999;
        const sb = b && Number.isFinite(b.sortOrder) ? b.sortOrder : 999999;
        if (sa !== sb) return sa - sb;
        return 0;
      });
      sec.ingredients = partitionOptionalsWithinSubsections(sec.ingredients);
    } else {
      // Legacy behavior for DBs without sort_order/headings.
      sec.ingredients = sortIngredientsForMainList(sec.ingredients);
    }

    const after = sec.ingredients
      .map((row) => {
        if (!row) return '';
        if (row.rowType === 'heading')
          return `h:${row.headingId ?? row.headingClientId ?? ''}`;
        return `i:${row.rimId ?? ''}`;
      })
      .join('|');

    if (before !== after) changed = true;
  });

  return changed;
};

// Allow ingredient-heading insertion UX to delegate model mutations to the editor.
window.recipeEditorInsertIngredientHeadingAt = (sectionRef, index) => {
  if (!sectionRef || !Array.isArray(sectionRef.ingredients)) return;
  const idx = Math.max(
    0,
    Math.min(Number(index) || 0, sectionRef.ingredients.length)
  );
  const clientId = `tmp-h-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const row = {
    rowType: 'heading',
    headingId: null,
    headingClientId: clientId,
    sortOrder: null,
    text: '',
  };
  sectionRef.ingredients.splice(idx, 0, row);
  window._pendingFocusIngredientHeadingClientId = clientId;
  try {
    rerenderIngredientsSectionFromModel();
  } catch (_) {}
};

// Expose rerender for other modules (ingredient heading inline editor).
window.recipeEditorRerenderIngredientsFromModel =
  rerenderIngredientsSectionFromModel;

// --- Main render function (bridge edition: safe, data-driven, backward compatible) ---

function renderRecipe(recipe) {
  // --- Canonical model: sections[*].steps is the source of truth.
  // recipe.steps is a derived, render-only view.
  if (Array.isArray(recipe.sections)) {
    let allSectionSteps = [];

    recipe.sections.forEach((section, index) => {
      if (!Array.isArray(section.steps) || section.steps.length === 0) return;

      const sectionSort =
        section.sort_order != null ? section.sort_order : index + 1;

      const tagged = section.steps.map((step) => ({
        ...step,
        _section_sort: sectionSort,
      }));

      allSectionSteps = allSectionSteps.concat(tagged);
    });

    if (allSectionSteps.length > 0) {
      const normalizedSteps = allSectionSteps.sort((a, b) => {
        if (a._section_sort !== b._section_sort) {
          return a._section_sort - b._section_sort;
        }
        return (a.step_number ?? 0) - (b.step_number ?? 0);
      });

      recipe.steps = normalizedSteps.map((s) => ({
        id: s.ID || s.id,
        instructions: s.instructions,
        step_number: s.step_number,
        type: s.type || 'step',
      }));

      // Phase 1 — Load adapter: DB/bridge → StepNode model.
      if (
        window.StepNodeModel &&
        typeof StepNodeModel.fromFlatStepsArray === 'function'
      ) {
        window.stepNodes = StepNodeModel.fromFlatStepsArray(recipe.steps);
      }
    } else {
      console.warn(
        '⚠️ Bridge: no section with steps found, rendering fallback view'
      );
    }
  }

  // Fallback: if we have flat steps but no StepNodes yet, build them now.
  if (
    (!Array.isArray(window.stepNodes) || window.stepNodes.length === 0) &&
    Array.isArray(recipe.steps) &&
    recipe.steps.length > 0 &&
    window.StepNodeModel &&
    typeof StepNodeModel.fromFlatStepsArray === 'function'
  ) {
    window.stepNodes = StepNodeModel.fromFlatStepsArray(recipe.steps);
  }

  // Keep a deep copy for the live editing model (after normalization)
  window.recipeData = JSON.parse(JSON.stringify(recipe));

  // Keep app-bar title in sync with the rendered recipe title (single visible source).
  const appBarTitleEl = document.getElementById('appBarTitle');
  if (appBarTitleEl) {
    appBarTitleEl.textContent = recipe.title || '';
  }

  // 🧠 Session baseline for Cancel:
  try {
    if (
      !window.originalRecipeSnapshot ||
      window.originalRecipeSnapshot.id !== recipe.id
    ) {
      window.originalRecipeSnapshot = JSON.parse(JSON.stringify(recipe));
    }
  } catch (err) {
    console.warn('⚠️ Failed to update originalRecipeSnapshot:', err);
  }

  // --- Clear & rebuild container
  const container = getPageContentContainer();

  container.innerHTML = `
    <h1 id="recipeTitle" class="recipe-title">${recipe.title || ''}</h1>
    <div id="servingsRow" class="servings-line"></div>
    <div id="ingredientsSection"></div>
    <div id="stepsSection">
      <h2 class="section-header">Instructions</h2>
    </div>
  `;

  const ingredientsSection = container.querySelector('#ingredientsSection');
  const stepsSection = container.querySelector('#stepsSection');

  // Unified servings row just under the title
  renderServingsRow(recipe, container);

  // Enable inline title editing
  const titleEl = container.querySelector('#recipeTitle');
  if (typeof attachTitleEditor === 'function') {
    attachTitleEditor(titleEl);
  }

  // Ingredients list
  if (recipe.sections && recipe.sections.length > 0) {
    ensureIngredientSubheadInsertModeWiring();
    const ingredientsHeader = document.createElement('h2');
    ingredientsHeader.className = 'section-header';
    ingredientsHeader.textContent = 'Ingredients';
    ingredientsSection.appendChild(ingredientsHeader);

    // v1: Ingredients render from the first section (bridge loads a single synthetic section).
    const firstSection = recipe.sections[0];
    if (firstSection) stripIngredientPlaceholders(firstSection);
    const rows = Array.isArray(firstSection?.ingredients)
      ? firstSection.ingredients
      : [];

    const isHeading = (row) => row && row.rowType === 'heading';
    const renderRows = rows;

    // Top insertion zone (suppressed if next row is a heading)
    {
      const next = renderRows.length > 0 ? renderRows[0] : null;
      const zone = document.createElement('div');
      zone.className = 'ingredient-insert-zone';
      if (next && isHeading(next))
        zone.classList.add('ingredient-insert-zone--disabled');
      let _didInsert = false;
      const handleInsert = (e) => {
        if (zone.classList.contains('ingredient-insert-zone--disabled')) return;
        if (!e || !e.ctrlKey) return;
        if (_didInsert) return;
        _didInsert = true;
        try {
          setTimeout(() => {
            _didInsert = false;
          }, 0);
        } catch (_) {}

        try {
          const active = window._activeIngredientHeadingEditor;
          if (active && typeof active.commit === 'function') {
            active.commit();
            setTimeout(() => {
              if (
                typeof window.recipeEditorInsertIngredientHeadingAt ===
                'function'
              ) {
                window.recipeEditorInsertIngredientHeadingAt(firstSection, 0);
              }
            }, 0);
            return;
          }
        } catch (_) {}

        try {
          e.preventDefault();
          e.stopPropagation();
        } catch (_) {}
        if (
          typeof window.recipeEditorInsertIngredientHeadingAt === 'function'
        ) {
          window.recipeEditorInsertIngredientHeadingAt(firstSection, 0);
        }
      };
      zone.addEventListener('pointerdown', handleInsert);
      zone.addEventListener('contextmenu', (e) => {
        if (e && e.ctrlKey) {
          e.preventDefault();
          handleInsert(e);
        }
      });
      ingredientsSection.appendChild(zone);
    }

    renderRows.forEach((row, idx) => {
      let line = null;

      if (row && row.rowType === 'heading') {
        if (typeof window.renderIngredientHeading === 'function') {
          line = window.renderIngredientHeading(row);
        } else {
          line = document.createElement('div');
          line.className = 'ingredient-subsection-heading-line';
          const span = document.createElement('span');
          span.className = 'ingredient-subsection-heading-text';
          span.textContent = row.text || '';
          line.appendChild(span);
        }
      } else {
        // Prefer shared ingredient renderer (handles placeholders, click-to-edit, etc.)
        if (typeof renderIngredient === 'function') {
          line = renderIngredient(row);
        } else {
          // Fallback: legacy manual rendering (no inline-edit wiring)
          line = document.createElement('div');
          line.className = 'ingredient-line';

          const span = document.createElement('span');

          const qty =
            row.quantity && !isNaN(parseFloat(row.quantity))
              ? decimalToFractionDisplay(parseFloat(row.quantity)) + ' '
              : row.quantity
              ? row.quantity + ' '
              : '';

          const unit = row.unit ? row.unit + ' ' : '';
          const name = row.name || '';
          const text = `${qty || ''}${unit || ''}${name}`.trim();

          span.textContent = text;

          line.appendChild(span);
        }
      }

      if (line) {
        ingredientsSection.appendChild(line);
      }

      // Inter-row insertion zone (between idx and idx+1), suppressed adjacent to headings
      const next = idx + 1 < renderRows.length ? renderRows[idx + 1] : null;
      if (!next) return;
      const zone = document.createElement('div');
      zone.className = 'ingredient-insert-zone';
      if (isHeading(row) || isHeading(next)) {
        zone.classList.add('ingredient-insert-zone--disabled');
      }
      let _didInsert = false;
      const handleInsert = (e) => {
        if (zone.classList.contains('ingredient-insert-zone--disabled')) return;
        if (!e || !e.ctrlKey) return;
        if (_didInsert) return;
        _didInsert = true;
        try {
          setTimeout(() => {
            _didInsert = false;
          }, 0);
        } catch (_) {}

        try {
          const active = window._activeIngredientHeadingEditor;
          if (active && typeof active.commit === 'function') {
            active.commit();
            setTimeout(() => {
              if (
                typeof window.recipeEditorInsertIngredientHeadingAt ===
                'function'
              ) {
                window.recipeEditorInsertIngredientHeadingAt(
                  firstSection,
                  idx + 1
                );
              }
            }, 0);
            return;
          }
        } catch (_) {}

        try {
          e.preventDefault();
          e.stopPropagation();
        } catch (_) {}
        if (
          typeof window.recipeEditorInsertIngredientHeadingAt === 'function'
        ) {
          window.recipeEditorInsertIngredientHeadingAt(firstSection, idx + 1);
        }
      };
      zone.addEventListener('pointerdown', handleInsert);
      zone.addEventListener('contextmenu', (e) => {
        if (e && e.ctrlKey) {
          e.preventDefault();
          handleInsert(e);
        }
      });
      ingredientsSection.appendChild(zone);
    });

    appendIngredientAddCta({
      container: ingredientsSection,
      sectionRef: firstSection,
    });

    // Focus a newly inserted heading, if any.
    try {
      const pending = window._pendingFocusIngredientHeadingClientId;
      if (pending) {
        window._pendingFocusIngredientHeadingClientId = null;
        const target = ingredientsSection.querySelector(
          `[data-heading-client-id="${pending}"]`
        );
        if (target && typeof target.click === 'function') {
          target.click();
        }
      }
    } catch (_) {}
  }

  // --- You will need section ---
  const allIngredientsRaw = Array.isArray(recipe.sections)
    ? recipe.sections.flatMap((s) => s.ingredients || [])
    : [];

  // Strip out headings; ingredients array should already be placeholder-free.
  const allIngredients = allIngredientsRaw.filter(
    (row) => row && row.rowType !== 'heading'
  );

  // Always show the card; content depends on whether we have any real ingredients.
  const needWrapper = document.createElement('div');
  needWrapper.className = 'you-will-need-card';
  container.insertBefore(needWrapper, stepsSection);

  const needHeader = document.createElement('h2');
  needHeader.className = 'section-header';
  needHeader.textContent = 'You will need';
  needWrapper.appendChild(needHeader);

  if (allIngredients.length === 0) {
    // Read-only placeholder for this section only.
    const line = document.createElement('div');
    line.className = 'ingredient-line';
    const span = document.createElement('span');

    span.className = 'placeholder-prompt';

    span.textContent = 'No ingredients yet. Add some above.';
    line.appendChild(span);
    needWrapper.appendChild(line);
  } else {
    const grouped = {};
    allIngredients.forEach((ing) => {
      const loc = ing.locationAtHome || '';
      if (!grouped[loc]) grouped[loc] = [];
      grouped[loc].push(ing);
    });

    Object.keys(grouped).forEach((loc) => {
      grouped[loc] = mergeByIngredient(grouped[loc]);
    });

    NEED_LOCATION_ORDER.forEach((loc) => {
      const items = grouped[loc];
      if (!items || !items.length) return;

      const subHeader = document.createElement('div');
      subHeader.className = 'subsection-header';
      subHeader.textContent = loc ? capitalizeWords(loc) : 'Misc';
      needWrapper.appendChild(subHeader);

      sortIngredients(items, NEED_LOCATION_ORDER).forEach((ing) => {
        const line = document.createElement('div');
        line.className = 'ingredient-line';
        const span = document.createElement('span');
        span.textContent = formatNeedLine(ing);
        line.appendChild(span);
        needWrapper.appendChild(line);
      });
    });

    const measures = computeMeasures(allIngredients);
    if (measures.length > 0) {
      const measureHeader = document.createElement('div');
      measureHeader.className = 'subsection-header';
      measureHeader.textContent = 'Measures';
      needWrapper.appendChild(measureHeader);

      measures.forEach((m) => {
        const line = document.createElement('div');
        line.className = 'ingredient-line';
        const span = document.createElement('span');
        span.textContent = formatMeasureLabel(m);
        line.appendChild(span);
        needWrapper.appendChild(line);
      });
    }
  }

  // --- StepNode-based instructions renderer (Phase 1) ---
  function renderStepsFromStepNodes(stepNodes, stepsSection, recipeId) {
    if (!Array.isArray(stepNodes) || stepNodes.length === 0 || !stepsSection) {
      return;
    }

    // Ensure Ctrl-held insert-mode wiring is active (shared with Ingredients).
    try {
      ensureIngredientSubheadInsertModeWiring();
    } catch (_) {}

    const nodes =
      window.StepNodeModel &&
      typeof StepNodeModel.normalizeStepNodeOrder === 'function'
        ? StepNodeModel.normalizeStepNodeOrder(stepNodes)
        : stepNodes.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const rerender = (nextNodes, focusId) => {
      // Keep the Instructions header, clear the rest.
      const header = stepsSection.querySelector('h2.section-header');
      stepsSection.innerHTML = '';
      if (header) stepsSection.appendChild(header);
      renderStepsFromStepNodes(nextNodes, stepsSection, recipeId);
      if (focusId != null) {
        try {
          const el = stepsSection.querySelector(
            `.step-text[data-step-id="${String(focusId)}"]`
          );
          if (el && typeof el.click === 'function') el.click();
        } catch (_) {}
      }
    };

    const insertHeadingAt = (idx) => {
      try {
        // If a step is actively being edited, blur it first so its onBlur commit runs.
        if (
          window._activeStepInput &&
          typeof window._activeStepInput.blur === 'function'
        ) {
          window._activeStepInput.blur();
        }
      } catch (_) {}

      const nodesNow = Array.isArray(window.stepNodes)
        ? window.stepNodes
        : nodes;
      const ordered =
        window.StepNodeModel &&
        typeof StepNodeModel.normalizeStepNodeOrder === 'function'
          ? StepNodeModel.normalizeStepNodeOrder(nodesNow)
          : nodesNow.slice();

      const safeIdx = Math.max(0, Math.min(Number(idx) || 0, ordered.length));
      const newId = `tmp-step-${Date.now()}-${Math.floor(
        Math.random() * 100000
      )}`;

      const makeNode =
        window.StepNodeModel &&
        typeof StepNodeModel.createStepNode === 'function'
          ? StepNodeModel.createStepNode
          : null;

      const StepType =
        window.StepNodeType && typeof window.StepNodeType === 'object'
          ? window.StepNodeType
          : { HEADING: 'heading', STEP: 'step' };

      const newNode = makeNode
        ? makeNode({
            id: newId,
            type: StepType.HEADING,
            text: '',
            order: safeIdx + 1,
          })
        : { id: newId, type: StepType.HEADING, text: '', order: safeIdx + 1 };

      const nextArr = ordered.slice();
      nextArr.splice(safeIdx, 0, newNode);
      // Renormalize order to 1..n (stable, deterministic).
      const normalized = nextArr.map((n, i) => ({ ...n, order: i + 1 }));

      window.stepNodes = normalized;
      rerender(normalized, newId);
    };

    let displayIndex = 0;

    const isHeading = (n) =>
      n &&
      (n.type === 'heading' ||
        n.type === (window.StepNodeType && window.StepNodeType.HEADING));

    // Top insertion zone (suppressed if next node is a heading)
    {
      const next = nodes.length > 0 ? nodes[0] : null;
      const zone = document.createElement('div');
      zone.className = 'step-insert-zone';
      if (next && isHeading(next))
        zone.classList.add('step-insert-zone--disabled');
      let _didInsert = false;
      const handleInsert = (e) => {
        if (zone.classList.contains('step-insert-zone--disabled')) return;
        if (!e || !e.ctrlKey) return;
        if (_didInsert) return;
        _didInsert = true;
        try {
          setTimeout(() => {
            _didInsert = false;
          }, 0);
        } catch (_) {}
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch (_) {}
        insertHeadingAt(0);
      };
      zone.addEventListener('pointerdown', handleInsert);
      zone.addEventListener('contextmenu', (e) => {
        if (e && e.ctrlKey) {
          e.preventDefault();
          handleInsert(e);
        }
      });
      stepsSection.appendChild(zone);
    }

    nodes.forEach((node, idx) => {
      const line = document.createElement('div');
      line.className = 'instruction-line numbered';

      // Attach identity + type for editor + renumbering.
      line.dataset.stepId = String(node.id);
      const type = node.type || 'step';
      line.dataset.stepType = type;

      const num = document.createElement('span');
      num.className = 'step-num';

      if (type === 'heading') {
        // Headings: visually unnumbered and start a new numbering group.
        num.textContent = '';
        displayIndex = 0; // next steps under this heading start at 1
      } else {
        displayIndex += 1;
        num.textContent = `${displayIndex}.`;
      }

      const text = document.createElement('span');
      text.className = 'step-text';
      text.dataset.stepId = String(node.id);

      const rawText = node.text ?? '';
      const isPlaceholder = !rawText || rawText.trim() === 'Add a step.';

      if (isPlaceholder) {
        text.textContent = '';
        // Headings use different language than steps.
        if (type === 'heading') {
          text.dataset.placeholder = 'Section title';
          text.classList.add(
            'placeholder-prompt',
            'placeholder-prompt--editblue'
          );
        } else {
          text.dataset.placeholder = 'Add a step.';
          text.classList.add('placeholder-prompt');
        }
      } else {
        text.textContent = rawText;
      }

      ensureStepTextNotEmpty(text);

      line.appendChild(num);
      line.appendChild(text);
      stepsSection.appendChild(line);

      attachStepInlineEditor(text);

      // Inter-row insertion zone (suppressed adjacent to headings)
      const next = idx + 1 < nodes.length ? nodes[idx + 1] : null;
      if (!next) return;
      const zone = document.createElement('div');
      zone.className = 'step-insert-zone';
      if (isHeading(node) || isHeading(next))
        zone.classList.add('step-insert-zone--disabled');
      let _didInsert = false;
      const handleInsert = (e) => {
        if (zone.classList.contains('step-insert-zone--disabled')) return;
        if (!e || !e.ctrlKey) return;
        if (_didInsert) return;
        _didInsert = true;
        try {
          setTimeout(() => {
            _didInsert = false;
          }, 0);
        } catch (_) {}
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch (_) {}
        insertHeadingAt(idx + 1);
      };
      zone.addEventListener('pointerdown', handleInsert);
      zone.addEventListener('contextmenu', (e) => {
        if (e && e.ctrlKey) {
          e.preventDefault();
          handleInsert(e);
        }
      });
      stepsSection.appendChild(zone);
    });
  }

  // --- Steps (instructions) ---

  const hasStepNodes =
    Array.isArray(window.stepNodes) && window.stepNodes.length > 0;

  const hasSectionedSteps =
    Array.isArray(recipe.sections) &&
    recipe.sections.some((s) => Array.isArray(s.steps) && s.steps.length > 0);

  if (hasStepNodes) {
    renderStepsFromStepNodes(window.stepNodes, stepsSection, recipe.id);
  } else if (hasSectionedSteps) {
    const sortedSections = [...recipe.sections].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );

    let totalSteps = 0;

    sortedSections.forEach((section) => {
      const rawSteps = Array.isArray(section.steps) ? section.steps : [];
      const stepsInSection = [...rawSteps].sort(
        (a, b) => (a.step_number ?? 0) - (b.step_number ?? 0)
      );
      if (!stepsInSection.length) return;

      const displayName =
        section.name && section.name !== '(unnamed)' ? section.name : null;

      if (displayName) {
        const header = document.createElement('h3');
        header.className = 'section-subheader';
        header.textContent = displayName;
        stepsSection.appendChild(header);
      }

      const sectionId = section.ID ?? section.id ?? null;

      stepsInSection.forEach((step, idx) => {
        const line = document.createElement('div');
        line.className = 'instruction-line numbered';
        if (sectionId != null) {
          line.dataset.sectionId = String(sectionId);
        }
        // Attach identity to the line itself for StepNode lookups.
        line.dataset.stepId = String(step.ID ?? step.id);
        // Default type is 'step' unless StepNode model says otherwise.
        line.dataset.stepType = 'step';

        const num = document.createElement('span');
        num.className = 'step-num';
        num.textContent = `${idx + 1}.`;

        const text = document.createElement('span');
        text.className = 'step-text';
        text.dataset.stepId = String(step.ID ?? step.id);
        if (sectionId != null) {
          text.dataset.sectionId = String(sectionId);
        }
        text.textContent = step.instructions ?? '';

        // If StepNode model is present, mirror node.type → DOM.
        try {
          const nodes = Array.isArray(window.stepNodes)
            ? window.stepNodes
            : null;
          const stepNodeTypeRef =
            window.StepNodeType && typeof window.StepNodeType === 'object'
              ? window.StepNodeType
              : null;

          if (nodes && stepNodeTypeRef) {
            const idStr = String(step.ID ?? step.id);
            const node = nodes.find((n) => String(n.id) === idStr);
            if (node && node.type === stepNodeTypeRef.HEADING) {
              line.dataset.stepType = 'heading';
              // Headings are unnumbered; keep the num span for layout but clear text.
              num.textContent = '';
            }
          }
        } catch (err) {
          console.warn(
            'StepNode type sync failed; falling back to step type.',
            err
          );
        }

        ensureStepTextNotEmpty(text);

        line.appendChild(num);
        line.appendChild(text);
        stepsSection.appendChild(line);

        attachStepInlineEditor(text);
        totalSteps++;
      });
    });

    if (totalSteps === 0) {
      const noSteps = document.createElement('div');
      noSteps.className = 'empty-state';
      noSteps.textContent = 'No instructions found.';
      stepsSection.appendChild(noSteps);
    } else {
    }
  } else if (recipe.steps && recipe.steps.length > 0) {
    // Fallback: flat list if there are no sectioned steps
    recipe.steps.forEach((step, i) => {
      const line = document.createElement('div');
      line.className = 'instruction-line numbered';

      const num = document.createElement('span');
      num.className = 'step-num';
      num.textContent = `${i + 1}.`;
      const text = document.createElement('span');
      text.className = 'step-text';
      text.dataset.stepId = String(step.id);

      const rawText = step.instructions ?? '';
      const isPlaceholder = !rawText || rawText.trim() === 'Add a step.';

      if (isPlaceholder) {
        text.textContent = '';
        // Headings use different language than steps.
        if (line.dataset.stepType === 'heading') {
          text.dataset.placeholder = 'Section title';
          text.classList.add(
            'placeholder-prompt',
            'placeholder-prompt--editblue'
          );
        } else {
          text.dataset.placeholder = 'Add a step.';
          text.classList.add('placeholder-prompt');
        }
      } else {
        text.textContent = rawText;
      }

      ensureStepTextNotEmpty(text);

      line.appendChild(num);
      line.appendChild(text);

      stepsSection.appendChild(line);
      attachStepInlineEditor(text);
    });
  } else {
    const noSteps = document.createElement('div');
    noSteps.className = 'empty-state';
    noSteps.textContent = 'No instructions found.';
    stepsSection.appendChild(noSteps);
  }
}

// --- Servings helpers (rest-mode text + basic edit-mode structure) ---

// One-shot flag: when true, entering servings edit mode should NOT steal focus
// from the title (used when the title editor triggers servings edit).
if (typeof window._servingsEditSkipFocusOnce === 'undefined') {
  window._servingsEditSkipFocusOnce = false;
}

// Remember last valid committed value so blur/enter can revert invalid edits
if (typeof window._servingsLastValid === 'undefined') {
  window._servingsLastValid = null;
}

// Track whether we should skip commit on this blur (used only for Escape flows)
if (typeof window._servingsSkipCommitOnce === 'undefined') {
  window._servingsSkipCommitOnce = false;
}

function _servingsIsValidNumber(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0;
}

function servingsHasData(recipe) {
  if (!recipe) return false;

  let v = recipe.servingsDefault;

  // Fallback to nested servings.default if top-level isn't populated
  if (v === null || v === undefined || v === '') {
    if (recipe.servings && recipe.servings.default != null) {
      v = recipe.servings.default;
      recipe.servingsDefault = v; // keep model in sync
    }
  }

  return v !== null && v !== undefined && v !== '';
}

function updateServingsVisibility(recipe) {
  const row = document.getElementById('servingsRow');
  if (!row) return;
  const model = recipe || window.recipeData || recipe;
  const hasData = servingsHasData(model);
  const isTitleEditing = !!window.isTitleEditing;
  const isServingsEditing = !!window.isServingsEditing;

  // Spec (visibility piece only):
  // - visible whenever servings data exists

  // - OR when the title is in edit mode
  // - OR while the servings row itself is actively editing
  const shouldShow = hasData || isTitleEditing || isServingsEditing;

  row.style.display = shouldShow ? '' : 'none';
}

function renderServingsRow(recipe, container) {
  const row =
    (container && container.querySelector('#servingsRow')) ||
    document.getElementById('servingsRow');
  if (!row) return;
  // Always prefer the canonical live model
  const recipeModel = window.recipeData || recipe;

  if (!recipeModel) return;

  if (typeof window.isServingsEditing === 'undefined') {
    window.isServingsEditing = false;
  }

  const hasData = servingsHasData(recipeModel);
  const isTitleEditing = !!window.isTitleEditing;

  // If there is no servings data yet, but the title is in edit mode,
  // go straight into servings edit instead of showing the old "Servings:" stub.
  if (!window.isServingsEditing && !hasData && isTitleEditing) {
    window.isServingsEditing = true;
  }

  // Shell + editing state
  row.classList.add('row-shell', 'servings-line');
  row.classList.toggle('editing', !!window.isServingsEditing);

  // Reset contents/handlers
  row.innerHTML = '';
  row.onclick = null;

  // Single horizontal row shell; pill is only used in edit mode
  const field = document.createElement('div');
  field.className = 'row-field';
  const pill = document.createElement('span');
  pill.className = 'field-pill';
  pill.textContent = 'Servings';

  if (!window.isServingsEditing) {
    // Rest mode: plain subtitle text, no pill
    if (hasData && recipeModel.servingsDefault != null) {
      field.textContent = `Serves ${recipeModel.servingsDefault}`;
    } else {
      field.textContent = 'Servings';
    }

    row.onclick = () => {
      window.isServingsEditing = true;
      window._servingsLastValid =
        recipeModel.servingsDefault != null
          ? recipeModel.servingsDefault
          : null;
      renderServingsRow(recipe, container);
    };
  } else {
    // Edit mode: pill + input inline

    const servingsObj = recipeModel.servings || {};
    const defaultVal =
      recipeModel.servingsDefault != null
        ? recipeModel.servingsDefault
        : servingsObj.default != null
        ? servingsObj.default
        : null;

    // Keep top-level + nested default in sync
    if (defaultVal != null) {
      recipeModel.servingsDefault = defaultVal;
    }

    const minVal =
      servingsObj.min != null && _servingsIsValidNumber(servingsObj.min)
        ? servingsObj.min
        : servingsObj.min != null
        ? servingsObj.min
        : null;

    const maxVal =
      servingsObj.max != null && _servingsIsValidNumber(servingsObj.max)
        ? servingsObj.max
        : servingsObj.max != null
        ? servingsObj.max
        : null;

    const editRow = document.createElement('div');
    editRow.className = 'servings-edit-row';

    const defaultSet = document.createElement('div');
    defaultSet.className = 'servings-set servings-set--default';

    const minSet = document.createElement('div');
    minSet.className = 'servings-set servings-set--min';

    const maxSet = document.createElement('div');
    maxSet.className = 'servings-set servings-set--max';

    // --- Default input ---
    const defaultInput = document.createElement('input');
    defaultInput.type = 'text';
    defaultInput.className = 'servings-input';
    defaultInput.value = defaultVal != null ? String(defaultVal) : '';

    // --- Min input ---
    const minLabel = document.createElement('span');
    minLabel.className = 'field-pill';
    minLabel.textContent = 'min';

    const minInput = document.createElement('input');
    minInput.type = 'text';
    minInput.className = 'servings-input';
    minInput.value = minVal != null ? String(minVal) : '';

    // --- Max input ---
    const maxLabel = document.createElement('span');
    maxLabel.className = 'field-pill';
    maxLabel.textContent = 'max';

    const maxInput = document.createElement('input');
    maxInput.type = 'text';
    maxInput.className = 'servings-input';
    maxInput.value = maxVal != null ? String(maxVal) : '';

    // Start with range (min/max) hidden if there is no default yet
    let rangeVisible = defaultVal != null && _servingsIsValidNumber(defaultVal);

    const showRangeInputs = () => {
      if (rangeVisible) return;
      rangeVisible = true;
      editRow.appendChild(minSet);
      editRow.appendChild(maxSet);
    };

    field.innerHTML = '';

    defaultSet.appendChild(pill);
    defaultSet.appendChild(defaultInput);

    minSet.appendChild(minLabel);
    minSet.appendChild(minInput);

    maxSet.appendChild(maxLabel);
    maxSet.appendChild(maxInput);

    // Default/min/max labels all act as focus targets for their fields.
    wireLabelToInput(pill, defaultInput);
    wireLabelToInput(minLabel, minInput);
    wireLabelToInput(maxLabel, maxInput);

    editRow.appendChild(defaultSet);

    if (rangeVisible) {
      editRow.appendChild(minSet);
      editRow.appendChild(maxSet);
    }

    field.appendChild(editRow);

    const ensureServingsObj = () => {
      if (!recipeModel.servings) {
        recipeModel.servings = {
          default: recipeModel.servingsDefault ?? null,
          min: null,
          max: null,
        };
      }
    };

    // Keep min/max in a sensible relationship to default.
    // default is source of truth; min/max are only ever *clamped*,
    // never auto-created from default.

    const normalizeServingsTriple = () => {
      ensureServingsObj();

      let d =
        recipeModel.servingsDefault != null
          ? recipeModel.servingsDefault
          : recipeModel.servings.default;

      if (d == null || !_servingsIsValidNumber(d)) {
        return;
      }

      const toNum = (v) =>
        v == null || v === '' || !_servingsIsValidNumber(v)
          ? null
          : Math.round(Number(v));

      const dNum = Math.round(Number(d));
      recipeModel.servingsDefault = dNum;
      recipeModel.servings.default = dNum;

      let mn = toNum(recipeModel.servings.min);
      let mx = toNum(recipeModel.servings.max);

      if (mn != null && mn > dNum) mn = dNum;
      if (mx != null && mx < dNum) mx = dNum;

      recipeModel.servings.min = mn;
      recipeModel.servings.max = mx;

      // Reflect normalized values into the inputs
      if (defaultInput) defaultInput.value = String(dNum);
      if (minInput) minInput.value = mn != null ? String(mn) : '';
      if (maxInput) maxInput.value = mx != null ? String(mx) : '';
    };

    const skipAutoFocus =
      typeof window !== 'undefined' && window._servingsEditSkipFocusOnce;

    if (skipAutoFocus) {
      window._servingsEditSkipFocusOnce = false;
    } else {
      setTimeout(() => {
        defaultInput.focus();
        defaultInput.select();
      }, 0);
    }

    // --- Default: live-commit semantics ---
    defaultInput.addEventListener('input', () => {
      const raw = (defaultInput.value || '').trim();
      ensureServingsObj();

      if (raw === '') {
        recipeModel.servingsDefault = null;
        recipeModel.servings.default = null;
      } else if (_servingsIsValidNumber(raw)) {
        const n = Math.round(Number(raw));
        recipeModel.servingsDefault = n;
        recipeModel.servings.default = n;
        window._servingsLastValid = n;

        // once default is valid, reveal min/max
        showRangeInputs();
      }

      if (typeof markDirty === 'function') {
        markDirty();
      }
    });

    defaultInput.addEventListener('blur', (e) => {
      const raw = (defaultInput.value || '').trim();
      ensureServingsObj();

      // determine where focus is going next (anywhere inside the servings row)
      const next = e && e.relatedTarget;
      const stayingInRow = row && next && row.contains(next);

      // Escape path sets skip flag — skip committing, revert via render.
      if (window._servingsSkipCommitOnce) {
        window._servingsSkipCommitOnce = false;
        recipeModel.servingsDefault = window._servingsLastValid;
        recipeModel.servings.default = window._servingsLastValid;

        normalizeServingsTriple();

        // If focus is moving to another control in this row (min/max),
        // stay in edit mode and don't re-render yet.
        if (stayingInRow) {
          return;
        }

        window.isServingsEditing = false;
        renderServingsRow(recipeModel, container);

        return;
      }

      if (raw === '') {
        recipeModel.servingsDefault = null;
        recipeModel.servings.default = null;
      } else if (_servingsIsValidNumber(raw)) {
        const n = Math.round(Number(raw));
        recipeModel.servingsDefault = n;
        recipeModel.servings.default = n;
        window._servingsLastValid = n;
      } else {
        recipeModel.servingsDefault = window._servingsLastValid;
        recipeModel.servings.default = window._servingsLastValid;
      }

      normalizeServingsTriple();

      // If moving to min/max/default → stay in edit mode
      if (stayingInRow) {
        return;
      }

      window.isServingsEditing = false;

      renderServingsRow(recipeModel, container);
    });

    defaultInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        defaultInput.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        window._servingsSkipCommitOnce = true;
        defaultInput.blur();
      }
    });

    // --- Min/max helpers ---
    const commitRangeField = (inputEl, key) => {
      const raw = (inputEl.value || '').trim();
      ensureServingsObj();

      if (raw === '') {
        recipeModel.servings[key] = null;
        return;
      }

      if (_servingsIsValidNumber(raw)) {
        recipeModel.servings[key] = Math.round(Number(raw));
      } else {
        const current = recipeModel.servings[key];
        inputEl.value = current != null ? String(current) : '';
      }

      normalizeServingsTriple();
    };

    const wireRangeInput = (inputEl, key) => {
      inputEl.addEventListener('input', () => {
        const raw = (inputEl.value || '').trim();
        ensureServingsObj();

        if (raw === '') {
          recipeModel.servings[key] = null;
        } else if (_servingsIsValidNumber(raw)) {
          recipeModel.servings[key] = Math.round(Number(raw));
        }

        if (typeof markDirty === 'function') {
          markDirty();
        }
      });

      inputEl.addEventListener('blur', (e) => {
        const next = e && e.relatedTarget;

        // Are we moving focus to another control inside this row?
        const stayingInRow = row && next && row.contains(next);

        commitRangeField(inputEl, key);

        // If focus is leaving the row entirely, exit edit mode
        if (!stayingInRow) {
          window.isServingsEditing = false;
          renderServingsRow(recipeModel, container);
        }
      });

      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          inputEl.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          const current =
            recipeModel.servings && recipeModel.servings[key] != null
              ? String(recipeModel.servings[key])
              : '';
          inputEl.value = current;
          inputEl.blur();
        }
      });
    };

    wireRangeInput(minInput, 'min');
    wireRangeInput(maxInput, 'max');
  }

  row.appendChild(field);

  updateServingsVisibility(recipe);
}

// --- Title normalization helper (Title Case + fallback to "Untitled") ---
function normalizeRecipeTitle(raw) {
  if (raw == null) return 'Untitled';
  const trimmed = String(raw).trim();
  if (!trimmed) return 'Untitled';

  // Reuse global helper if it exists (from main.js), for consistency
  if (typeof window.toTitleCase === 'function') {
    return window.toTitleCase(trimmed);
  }

  // Local fallback: simple Title Case
  return trimmed
    .toLowerCase()
    .replace(/\b\w+/g, (word) => word[0].toUpperCase() + word.slice(1));
}

// --- Inline editable title (global helper) ---
function attachTitleEditor(titleEl) {
  if (!titleEl) return;

  // Ensure flag has a defined default
  if (typeof window.isTitleEditing === 'undefined')
    window.isTitleEditing = false;

  titleEl.addEventListener('click', () => {
    if (titleEl.isContentEditable) return;

    const original = titleEl.textContent || '';
    let hasPendingEdit = false;
    const hadDirty = typeof isDirty !== 'undefined' && isDirty === true;

    titleEl.contentEditable = 'true';

    // Mark title as "in edit mode" so servings visibility can follow spec.
    window.isTitleEditing = true;
    if (typeof updateServingsVisibility === 'function') {
      updateServingsVisibility(window.recipeData);
    }

    // If there is no default servings value yet, entering title edit
    // should immediately surface the servings pill + field in edit mode,
    // instead of the bare "Servings:" label — but without stealing focus
    // away from the title (caret stays where the user clicked).

    if (
      typeof servingsHasData === 'function' &&
      !servingsHasData(window.recipeData)
    ) {
      window.isServingsEditing = true;

      // Tell servings row to enter edit mode without focusing the input.
      window._servingsEditSkipFocusOnce = true;

      if (typeof renderServingsRow === 'function') {
        renderServingsRow(window.recipeData);

        // Prime last-valid snapshot at start of edit mode
        if (window.recipeData) {
          window._servingsLastValid =
            window.recipeData.servingsDefault != null
              ? window.recipeData.servingsDefault
              : null;
        }
      }
    }

    // Match instruction edit state: special editing color, no outline
    titleEl.classList.add('editing-title');

    titleEl.focus();

    const cleanup = () => {
      titleEl.contentEditable = 'false';
      titleEl.classList.remove('editing-title');
      titleEl.removeEventListener('blur', onBlur);
      titleEl.removeEventListener('input', onInput);
      titleEl.removeEventListener('keydown', onKeyDown);

      window.isTitleEditing = false;

      if (typeof updateServingsVisibility === 'function') {
        updateServingsVisibility(window.recipeData);
      }
    };

    const commit = () => {
      const raw = titleEl.textContent || '';
      const nextTitle = normalizeRecipeTitle(raw);

      if (window.recipeData && window.recipeData.title !== nextTitle) {
        window.recipeData.title = nextTitle;
        if (typeof markDirty === 'function') markDirty();
      }
      titleEl.textContent = nextTitle;

      // Mirror into the app-bar title so Save reads the right value and UI stays coherent.
      const appTitle = document.getElementById('appBarTitle');
      if (appTitle) appTitle.textContent = nextTitle;
    };

    const onInput = () => {
      if (!hasPendingEdit) {
        hasPendingEdit = true;
        if (typeof markDirty === 'function') {
          markDirty();
        }
      }
    };

    const cancelLocal = () => {
      titleEl.textContent = original;
      const appTitle = document.getElementById('appBarTitle');
      if (appTitle) appTitle.textContent = original;
      if (!hadDirty && typeof revertChanges === 'function') {
        revertChanges();
      }
    };

    const onBlur = (e) => {
      const row = document.getElementById('servingsRow');
      const next = e && e.relatedTarget;

      let goingIntoServings = row && next && row.contains(next);

      // FIX: On first render, servings row steals focus momentarily.
      // If next is *null* or outside both title and row → treat as real blur.
      if (!next) goingIntoServings = false;
      if (next && row && !row.contains(next) && next !== titleEl) {
        goingIntoServings = false;
      }

      const shouldCollapseServings =
        !goingIntoServings &&
        typeof servingsHasData === 'function' &&
        window.recipeData &&
        !servingsHasData(window.recipeData);

      // Finish title edit first so isTitleEditing is false before we touch servings.
      commit();
      cleanup();

      // If title lost focus, we didn’t move into servings, and there’s still no data,
      // hide the servings editor (match console shim behavior).
      if (shouldCollapseServings) {
        window.isServingsEditing = false;
        if (typeof updateServingsVisibility === 'function') {
          updateServingsVisibility(window.recipeData);
        }
      }
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

// --- Helpers ---
function capitalizeWords(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- Measure formatting helper (DB-aware when available) ---
function formatMeasureLabel(measureKey) {
  if (!measureKey || typeof measureKey !== 'string') return measureKey;

  const parts = measureKey.split(' ');
  if (parts.length < 2) return measureKey;

  const amount = parts[0];
  const unitCode = parts.slice(1).join(' ');

  // Best-effort numeric value for pluralization (e.g., "2 cup")
  let numericVal = null;
  const numericMatch = amount.match(/^\d+(\.\d+)?/);
  if (numericMatch) {
    numericVal = parseFloat(numericMatch[0]);
  }

  let unitText = unitCode;

  if (typeof window.getUnitDisplay === 'function') {
    unitText = window.getUnitDisplay(unitCode, numericVal);
  }

  return [amount, unitText].filter(Boolean).join(' ');
}

// --- Compute Measures ---
function computeMeasures(ingredients) {
  const found = new Set();

  const measures = {
    '⅛ tsp': 0.125,
    '¼ tsp': 0.25,
    '½ tsp': 0.5,
    '1 tsp': 1,
    '½ tbsp': 0.5,
    '1 tbsp': 1,
    '1½ tbsp': 1.5,
    '⅛ cup': 0.125,
    '¼ cup': 0.25,
    '⅓ cup': 0.333,
    '½ cup': 0.5,
    '⅔ cup': 0.667,
    '¾ cup': 0.75,
    '1 cup': 1,
    '2 cup': 2,
    '4 cup': 4,
    '8 cup': 8,
  };

  function addDryCup(qtyNum) {
    const dryCups = [
      '⅛ cup',
      '¼ cup',
      '⅓ cup',
      '½ cup',
      '⅔ cup',
      '¾ cup',
      '1 cup',
    ];
    for (const m of dryCups) {
      if (Math.abs(qtyNum - measures[m]) < 0.01) {
        found.add(m);
        return;
      }
      if (qtyNum < measures[m]) {
        found.add(m);
        return;
      }
    }
  }

  function decompose(qty, unit, isLiquid) {
    const qtyNum = Number(qty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) return;

    if (unit.includes('tsp')) {
      let remaining = qtyNum;
      const unitMeasures = ['1 tsp', '½ tsp', '¼ tsp', '⅛ tsp'];
      for (const m of unitMeasures) {
        while (remaining + 1e-6 >= measures[m]) {
          found.add(m);
          remaining -= measures[m];
        }
      }
    } else if (unit.includes('tbsp')) {
      let remaining = qtyNum;
      if (Math.abs(remaining - 1.5) < 1e-6) {
        found.add('1½ tbsp');
        remaining = 0;
      }
      const unitMeasures = ['1 tbsp', '½ tbsp'];
      for (const m of unitMeasures) {
        while (remaining + 1e-6 >= measures[m]) {
          found.add(m);
          remaining -= measures[m];
        }
      }
    } else if (unit.includes('cup')) {
      function chooseLiquidMeasure(qtyCups) {
        if (qtyCups <= 1.25) return '1 cup';
        if (qtyCups <= 2.5) return '2 cup';
        if (qtyCups <= 5.5) return '4 cup';
        return '8 cup';
      }
      if (qtyNum <= 1.25) {
        addDryCup(qtyNum);
      } else {
        const mainVessel = chooseLiquidMeasure(qtyNum);
        found.add(mainVessel);
        const mainSize = measures[mainVessel];
        const remainder = qtyNum % mainSize;
        if (remainder > 0 && remainder < 1.25) {
          addDryCup(remainder);
        }
      }
    }
  }

  ingredients.forEach((ing) => {
    if (!ing.unit || !ing.quantity) return;
    const qty = ing.quantity;
    const unit = ing.unit.toLowerCase();
    decompose(qty, unit);
  });

  return MEASURE_ORDER.filter((m) => found.has(m));
}
