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
      existing.isDeprecated = !!(existing.isDeprecated || ing.isDeprecated);
    }
  });

  map.forEach((v) => merged.push(v));
  return merged;
}

// --- Shared page content resolver (non-breaking during migration) ---

const getPageContentContainer = () => document.getElementById('pageContent');

// --- Subhead insertion mode (hold Option/Alt) ---
function ensureIngredientSubheadInsertModeWiring() {
  if (window._ingredientSubheadInsertModeWired) return;
  window._ingredientSubheadInsertModeWired = true;

  // Hard-off: subhead insert mode is disabled.
  try {
    document.body.classList.remove('subhead-insert-mode');
  } catch (_) {}
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

  wireIngredientCtaDelegation(ingredientsSection);

  const ingredientsHeader = document.createElement('h2');
  ingredientsHeader.className = 'section-header';
  ingredientsHeader.textContent = 'Ingredients';
  ingredientsSection.appendChild(ingredientsHeader);

  const firstSection =
    Array.isArray(recipe.sections) && recipe.sections[0]
      ? recipe.sections[0]
      : null;
  if (firstSection) stripIngredientPlaceholders(firstSection);
  const rows = Array.isArray(firstSection?.ingredients)
    ? firstSection.ingredients
    : [];

  const isHeading = (row) => row && row.rowType === 'heading';

  ensureIngredientSubheadInsertModeWiring();

  // Top insertion zone (kept for future subhead-insert-mode; currently disabled)
  {
    const next = rows.length > 0 ? rows[0] : null;
    const zone = document.createElement('div');
    zone.className = 'ingredient-insert-zone';
    if (next && isHeading(next))
      zone.classList.add('ingredient-insert-zone--disabled');
    ingredientsSection.appendChild(zone);
  }

  // Shared INGREDIENTS-title CTA:
  // - empty state: persistently visible below the title
  // - non-empty state: shown only when the title is hovered
  {
    const headerCta = createPerLineCta(0);
    headerCta.classList.remove('ingredient-add-cta--per-line');
    headerCta.classList.add('ingredient-header-cta');
    if (rows.length === 0) {
      headerCta.classList.add('ingredient-header-cta--persistent');
    }
    ingredientsSection.appendChild(headerCta);
  }

  rows.forEach((row, idx) => {
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
        if (!row.clientId) {
          row.clientId =
            row.rimId != null
              ? `i-${row.rimId}`
              : `tmp-ing-${Date.now()}-${Math.random()
                  .toString(16)
                  .slice(2)}`;
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

    // Wrap in slot (line + per-line CTA; CSS handles show/hide)
    const slot = document.createElement('div');
    slot.className = 'ingredient-slot';

    if (idx === 0) {
      slot.classList.add('ingredient-slot--spacing-first');
    } else {
      const prev = rows[idx - 1];
      if (isHeading(row)) {
        slot.classList.add('ingredient-slot--spacing-item-heading');
      } else if (isHeading(prev)) {
        slot.classList.add('ingredient-slot--spacing-heading-item');
      } else {
        slot.classList.add('ingredient-slot--spacing-item-item');
      }
    }

    if (el) slot.appendChild(el);
    slot.appendChild(createPerLineCta(idx + 1));
    ingredientsSection.appendChild(slot);

    // Inter-row insertion zone (kept for future subhead-insert-mode)
    const next = idx + 1 < rows.length ? rows[idx + 1] : null;
    if (!next) return;
    const zone = document.createElement('div');
    zone.className = 'ingredient-insert-zone';
    if (isHeading(row) || isHeading(next)) {
      zone.classList.add('ingredient-insert-zone--disabled');
    }
    ingredientsSection.appendChild(zone);
  });

  // Trailing insertion zone
  if (rows.length > 0) {
    const last = rows[rows.length - 1];
    const zone = document.createElement('div');
    zone.className = 'ingredient-insert-zone';
    if (last && isHeading(last))
      zone.classList.add('ingredient-insert-zone--disabled');
    ingredientsSection.appendChild(zone);
  }

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

  // Wire up the centralized hint controller.
  try {
    if (typeof window.initIngredientHintController === 'function') {
      window.initIngredientHintController(ingredientsSection);
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
    subHeader.textContent = loc || 'Misc';
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

// --- Per-line CTA infrastructure (replaces the old single-CTA approach) ---

function createPerLineCta(insertIndex) {
  const cta = document.createElement('div');
  cta.className = 'ingredient-line ingredient-add-cta ingredient-add-cta--per-line';
  cta.dataset.insertIndex = String(insertIndex);

  const text = document.createElement('span');
  text.className = 'placeholder-prompt ingredient-add-cta-copy';

  const ingredientBtn = document.createElement('button');
  ingredientBtn.type = 'button';
  ingredientBtn.className = 'ingredient-add-cta-action';
  ingredientBtn.textContent = 'Add an ingredient';
  ingredientBtn.dataset.ctaAction = 'add-ingredient';

  const headingBtn = document.createElement('button');
  headingBtn.type = 'button';
  headingBtn.className = 'ingredient-add-cta-action';
  headingBtn.textContent = 'title';
  headingBtn.dataset.ctaAction = 'add-heading';

  const pasteBtn = document.createElement('button');
  pasteBtn.type = 'button';
  pasteBtn.className = 'ingredient-add-cta-action';
  pasteBtn.textContent = 'paste content';
  pasteBtn.dataset.ctaAction = 'paste-content';

  text.appendChild(ingredientBtn);
  text.appendChild(document.createTextNode(', '));
  text.appendChild(headingBtn);
  text.appendChild(document.createTextNode(', or '));
  text.appendChild(pasteBtn);
  text.appendChild(document.createTextNode('.'));
  cta.appendChild(text);

  return cta;
}

function waitForIngredientCtaTick() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function getActiveIngredientEditor() {
  const active = window._activeIngredientEditor;
  if (!active || !active.rowElement || !active.rowElement.isConnected) {
    return null;
  }
  return active;
}

function getActiveHeadingEditor() {
  const active = window._activeIngredientHeadingEditor;
  if (!active || !active.clientId) return null;
  return active;
}

async function prepareActiveHeadingEditorForAction(action, cta, insertIndex) {
  const active = getActiveHeadingEditor();
  if (!active) {
    return { shouldProceed: true, insertIndex };
  }

  const activeSlot = active.slotElement;
  const clickedOwnSlotCta =
    !!activeSlot && !!cta && !!cta.closest && activeSlot === cta.closest('.ingredient-slot');
  const isBlankHeading =
    typeof active.isEmpty === 'function' ? active.isEmpty() : false;

  try {
    if (isBlankHeading && action === 'add-heading' && clickedOwnSlotCta) {
      return { shouldProceed: false, insertIndex };
    }

    if (isBlankHeading) {
      if (typeof active.cancel === 'function') {
        active.cancel();
      }
      await waitForIngredientCtaTick();
      return { shouldProceed: true, insertIndex };
    }

    if (typeof active.commit === 'function') {
      active.commit();
      await waitForIngredientCtaTick();
    }
  } catch (_) {
    return { shouldProceed: false, insertIndex };
  }

  return { shouldProceed: true, insertIndex };
}

async function prepareActiveIngredientEditorForAction(action, cta, insertIndex) {
  const active = getActiveIngredientEditor();
  if (!active) {
    return { shouldProceed: true, insertIndex };
  }

  if (action !== 'add-heading' && action !== 'paste-content') {
    return { shouldProceed: false, insertIndex };
  }

  const isBlankInsert =
    !!active.isInsert &&
    typeof active.isEmpty === 'function' &&
    active.isEmpty();
  const clickedOwnTrailingCta =
    !!active.isInsert && !!active.ctaAnchorEl && active.ctaAnchorEl === cta;

  try {
    if (isBlankInsert) {
      if (typeof active.cancel === 'function') {
        active.cancel();
      }
      await waitForIngredientCtaTick();
      return { shouldProceed: true, insertIndex };
    }

    if (typeof active.commit === 'function') {
      await active.commit();
      await waitForIngredientCtaTick();
    }

    return {
      shouldProceed: true,
      insertIndex: clickedOwnTrailingCta ? insertIndex + 1 : insertIndex,
    };
  } catch (_) {
    return { shouldProceed: false, insertIndex };
  }
}

async function handleCtaAction(ingredientsSection, cta, btn) {
  if (!ingredientsSection || !cta || !btn) return;

  const insertIndex = parseInt(cta.dataset.insertIndex, 10);
  const action = btn.dataset.ctaAction;
  if (!Number.isFinite(insertIndex)) return;

  const headingPrep = await prepareActiveHeadingEditorForAction(
    action,
    cta,
    insertIndex
  );
  if (!headingPrep.shouldProceed) return;

  const prep = await prepareActiveIngredientEditorForAction(
    action,
    cta,
    headingPrep.insertIndex
  );
  if (!prep.shouldProceed) return;
  const nextInsertIndex = prep.insertIndex;

  if (action === 'add-heading') {
    const sec = window.recipeData?.sections?.[0];
    if (sec && typeof window.recipeEditorInsertIngredientHeadingAt === 'function') {
      window.recipeEditorInsertIngredientHeadingAt(sec, nextInsertIndex);
    }
    return;
  }

  if (action === 'paste-content') {
    const sec = window.recipeData?.sections?.[0];
    if (!sec) return;
    const liveIdx = Array.isArray(sec.ingredients)
      ? Math.min(nextInsertIndex, sec.ingredients.length)
      : nextInsertIndex;

    const isPerLine = cta.classList.contains('ingredient-add-cta--per-line');
    if (isPerLine) {
      const anchor = document.createElement('div');
      const slot = cta.closest('.ingredient-slot');
      if (slot) {
        slot.after(anchor);
      } else {
        ingredientsSection.appendChild(anchor);
      }
      if (typeof window.openIngredientPasteRow === 'function') {
        window.openIngredientPasteRow({
          parent: ingredientsSection,
          replaceEl: anchor,
          insertAtIndex: liveIdx,
        });
      }
    } else {
      const liveCta = cta.isConnected
        ? cta
        : ingredientsSection.querySelector(
            '.ingredient-add-cta:not(.ingredient-add-cta--per-line)'
          );
      if (!liveCta) return;
      const anchor = document.createElement('div');
      const keepHeaderHintLive =
        liveCta.classList.contains('ingredient-header-cta') &&
        liveCta.classList.contains('ingredient-header-cta--persistent');
      if (keepHeaderHintLive) {
        liveCta.classList.remove('ingredient-header-cta--persistent');
        anchor._ingredientHeaderHintSourceEl = liveCta;
        anchor._ingredientHeaderHintRestorePersistent = true;
        liveCta.before(anchor);
      }
      if (typeof window.openIngredientPasteRow === 'function') {
        window.openIngredientPasteRow({
          parent: ingredientsSection,
          replaceEl: keepHeaderHintLive ? anchor : liveCta,
          insertAtIndex: liveIdx,
        });
      }
    }
    return;
  }

  if (action === 'add-ingredient') {
    const sec = window.recipeData?.sections?.[0];
    if (!sec) return;
    const liveIdx = Array.isArray(sec.ingredients)
      ? Math.min(nextInsertIndex, sec.ingredients.length)
      : nextInsertIndex;

    const isPerLine = cta.classList.contains('ingredient-add-cta--per-line');
    if (isPerLine) {
      const anchor = document.createElement('div');
      const slot = cta.closest('.ingredient-slot');
      if (slot) {
        slot.after(anchor);
      } else {
        ingredientsSection.appendChild(anchor);
      }
      if (typeof window.openIngredientEditRow === 'function') {
        window.openIngredientEditRow({
          parent: ingredientsSection,
          replaceEl: anchor,
          mode: 'insert',
          seedLine: null,
          insertAtIndex: liveIdx,
        });
      }
    } else {
      const liveCta = cta.isConnected
        ? cta
        : ingredientsSection.querySelector(
            '.ingredient-add-cta:not(.ingredient-add-cta--per-line)'
          );
      if (!liveCta) return;
      const anchor = document.createElement('div');
      const keepHeaderHintLive =
        liveCta.classList.contains('ingredient-header-cta') &&
        liveCta.classList.contains('ingredient-header-cta--persistent');
      if (keepHeaderHintLive) {
        liveCta.classList.remove('ingredient-header-cta--persistent');
        anchor._ingredientHeaderHintSourceEl = liveCta;
        anchor._ingredientHeaderHintRestorePersistent = true;
        liveCta.before(anchor);
      }
      if (typeof window.openIngredientEditRow === 'function') {
        window.openIngredientEditRow({
          parent: ingredientsSection,
          replaceEl: keepHeaderHintLive ? anchor : liveCta,
          mode: 'insert',
          seedLine: null,
          insertAtIndex: liveIdx,
        });
      }
    }
  }
}

function wireIngredientCtaDelegation(ingredientsSection) {
  if (!ingredientsSection || ingredientsSection._ctaDelegated) return;
  ingredientsSection._ctaDelegated = true;

  let consumedPointerDown = false;

  ingredientsSection.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.ingredient-add-cta-action');
    if (!btn || e.button !== 0) return;
    const cta = btn.closest('.ingredient-add-cta');
    if (!cta) return;

    consumedPointerDown = true;
    e.preventDefault();
    e.stopPropagation();
    handleCtaAction(ingredientsSection, cta, btn);
  });

  ingredientsSection.addEventListener('click', (e) => {
    const btn = e.target.closest('.ingredient-add-cta-action');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (consumedPointerDown) {
      consumedPointerDown = false;
      return;
    }
    const cta = btn.closest('.ingredient-add-cta');
    if (!cta) return;
    handleCtaAction(ingredientsSection, cta, btn);
  });
}

function deleteIngredientRowFromSection(sectionRef, rowRef) {
  if (!sectionRef || !Array.isArray(sectionRef.ingredients) || !rowRef)
    return null;
  const idx = sectionRef.ingredients.indexOf(rowRef);
  if (idx < 0) return null;
  const removed = sectionRef.ingredients.splice(idx, 1)[0] || null;
  return { idx, removed };
}

function deleteIngredientHeadingRowFromSection(sectionRef, rowRef) {
  if (!sectionRef || !Array.isArray(sectionRef.ingredients) || !rowRef)
    return null;
  if (!rowRef || rowRef.rowType !== 'heading') return null;
  const idx = sectionRef.ingredients.indexOf(rowRef);
  if (idx < 0) return null;
  const removed = sectionRef.ingredients.splice(idx, 1)[0] || null;
  return { idx, removed };
}

function isIngredientRenderableRow(row) {
  return !!(row && !row.isPlaceholder);
}

function isIngredientHeadingRow(row) {
  if (!row) return false;
  if (row.rowType === 'heading') return true;
  if (row.headingId != null) return true;
  if (row.headingClientId && row.text != null && row.name == null) return true;
  return false;
}

function ingredientRowsMatch(candidate, rowRef) {
  if (!candidate || !rowRef) return false;
  if (candidate === rowRef) return true;

  if (isIngredientHeadingRow(rowRef) || isIngredientHeadingRow(candidate)) {
    const candidateHeadingId =
      candidate.headingId != null ? String(candidate.headingId) : '';
    const rowHeadingId = rowRef.headingId != null ? String(rowRef.headingId) : '';
    if (candidateHeadingId && rowHeadingId && candidateHeadingId === rowHeadingId) {
      return true;
    }

    const candidateHeadingClientId = candidate.headingClientId
      ? String(candidate.headingClientId)
      : '';
    const rowHeadingClientId = rowRef.headingClientId
      ? String(rowRef.headingClientId)
      : '';
    if (
      candidateHeadingClientId &&
      rowHeadingClientId &&
      candidateHeadingClientId === rowHeadingClientId
    ) {
      return true;
    }

    return false;
  }

  const candidateRimId = candidate.rimId != null ? String(candidate.rimId) : '';
  const rowRimId = rowRef.rimId != null ? String(rowRef.rimId) : '';
  if (candidateRimId && rowRimId && candidateRimId === rowRimId) return true;

  const candidateClientId = candidate.clientId ? String(candidate.clientId) : '';
  const rowClientId = rowRef.clientId ? String(rowRef.clientId) : '';
  if (candidateClientId && rowClientId && candidateClientId === rowClientId) {
    return true;
  }

  return false;
}

function normalizeIngredientSortOrder(sectionRef) {
  if (!sectionRef || !Array.isArray(sectionRef.ingredients)) return;

  let nextSortOrder = 1;
  sectionRef.ingredients.forEach((row) => {
    if (!isIngredientRenderableRow(row)) return;
    row.sortOrder = nextSortOrder++;
  });
}

function findIngredientRowContext(rowRef) {
  if (!rowRef) return null;
  const recipe = window.recipeData;
  const sections = Array.isArray(recipe?.sections) ? recipe.sections : [];

  for (const sec of sections) {
    const arr = Array.isArray(sec?.ingredients) ? sec.ingredients : [];
    const idx = arr.findIndex((row) => ingredientRowsMatch(row, rowRef));
    if (idx !== -1) {
      return { sectionRef: sec, list: arr, index: idx, rowRef: arr[idx] };
    }
  }
  return null;
}

function findIngredientTargetIndexWithinList(list, fromIndex, delta) {
  if (!Array.isArray(list) || !Number.isFinite(fromIndex) || !delta) return -1;

  if (delta < 0) {
    for (let i = fromIndex - 1; i >= 0; i--) {
      const row = list[i];
      if (!isIngredientRenderableRow(row)) continue;
      return i;
    }
    return -1;
  }

  for (let i = fromIndex + 1; i < list.length; i++) {
    const row = list[i];
    if (!isIngredientRenderableRow(row)) continue;
    return i;
  }
  return -1;
}

window.recipeEditorGetIngredientMoveAvailability = ({ rowRef } = {}) => {
  const ctx = findIngredientRowContext(rowRef);
  if (!ctx) return { canMoveUp: false, canMoveDown: false };
  const { list, index } = ctx;
  const upIdx = findIngredientTargetIndexWithinList(list, index, -1);
  const downIdx = findIngredientTargetIndexWithinList(list, index, 1);
  return { canMoveUp: upIdx !== -1, canMoveDown: downIdx !== -1 };
};

window.recipeEditorMoveIngredientRowByDelta = ({
  rowRef,
  delta,
  reopenEditor = false,
  reopenHeadingEditor = false,
  initialFocusField,
  initialCaretIndex,
} = {}) => {
  const dir = Number(delta);
  if (!rowRef || !Number.isFinite(dir) || !dir) return false;

  const ctx = findIngredientRowContext(rowRef);
  if (!ctx) return false;

  const { sectionRef, list, index } = ctx;
  const targetIndex = findIngredientTargetIndexWithinList(list, index, dir);
  if (targetIndex === -1 || targetIndex === index) return false;

  const [moved] = list.splice(index, 1);
  const insertionIndex = targetIndex;
  list.splice(insertionIndex, 0, moved);
  normalizeIngredientSortOrder(sectionRef);

  try {
    if (typeof markDirty === 'function') markDirty();
  } catch (_) {}

  rerenderIngredientsSectionFromModel();

  // Restore interaction on the moved row after rerender.
  const setContentEditableCaretOffset = (el, offset) => {
    if (!(el instanceof HTMLElement)) return;
    try {
      const sel = window.getSelection();
      if (!sel) return;

      let firstTextNode = null;
      let lastTextNode = null;
      let remaining = Math.max(0, Number(offset) || 0);
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if (!firstTextNode) firstTextNode = node;
        lastTextNode = node;
        const len = node.textContent.length;
        if (remaining <= len) {
          const range = document.createRange();
          range.setStart(node, Math.max(0, remaining));
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          return;
        }
        remaining -= len;
        node = walker.nextNode();
      }

      if (!firstTextNode) {
        firstTextNode = document.createTextNode('');
        el.appendChild(firstTextNode);
        lastTextNode = firstTextNode;
      }
      const range = document.createRange();
      range.setStart(lastTextNode || firstTextNode, (lastTextNode || firstTextNode).textContent.length);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {}
  };

  try {
    const rid = moved && moved.rimId != null ? String(moved.rimId) : '';
    const cid = moved && moved.clientId ? String(moved.clientId) : '';
    const headingClientId =
      moved && moved.headingClientId ? String(moved.headingClientId) : '';
    const headingSelector = headingClientId
      ? `.ingredient-subsection-heading-line[data-heading-client-id="${headingClientId}"]`
      : '';
    const selector = rid
      ? `.ingredient-line[data-rim-id="${rid}"]`
      : cid
      ? `.ingredient-line[data-client-id="${cid}"]`
      : headingSelector;
    const moveDir = dir < 0 ? 'up' : 'down';
    setTimeout(() => {
      try {
        const sectionEl = document.getElementById('ingredientsSection');
        if (!sectionEl) return;
        if (!selector) return;
        const lineEl = sectionEl.querySelector(selector);
        if (!(lineEl instanceof HTMLElement)) return;
        if (reopenHeadingEditor) {
          if (typeof lineEl.click === 'function') lineEl.click();
          setTimeout(() => {
            try {
              const textEl = lineEl.querySelector(
                '.ingredient-subsection-heading-text'
              );
              if (!(textEl instanceof HTMLElement)) return;
              textEl.focus();
              const nextOffset = Number.isFinite(Number(initialCaretIndex))
                ? Math.max(0, Number(initialCaretIndex))
                : (textEl.textContent || '').length;
              setContentEditableCaretOffset(textEl, nextOffset);
            } catch (_) {}
          }, 0);
          return;
        }
        if (
          reopenEditor &&
          typeof window.openIngredientEditRow === 'function' &&
          lineEl.parentNode
        ) {
          window.openIngredientEditRow({
            parent: lineEl.parentNode,
            replaceEl: lineEl,
            mode: 'update',
            seedLine: moved,
            initialFocusField,
            initialCaretIndex,
          });
          return;
        }
        if (headingSelector && lineEl.matches(headingSelector)) {
          lineEl.focus();
          return;
        }
        const btn = lineEl.querySelector(
          `.ingredient-row-move-btn[data-move-dir="${moveDir}"]`
        );
        if (btn instanceof HTMLElement) btn.focus();
      } catch (_) {}
    }, 0);
  } catch (_) {}

  return true;
};

window.recipeEditorDeleteIngredientRow = async ({
  sectionRef,
  rowRef,
  focusId,
  focusBy = 'clientId',
} = {}) => {
  if (!sectionRef || !rowRef) return false;

  // Capture a deep-ish snapshot for undo.
  const snapshot = JSON.parse(JSON.stringify(rowRef));

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
  const display = labelParts.filter(Boolean).join(' ').trim() || 'this ingredient';

  // Confirm before deleting (consistent with parent pages).
  try {
    const ok =
      window.ui && typeof window.ui.confirm === 'function'
        ? await window.ui.confirm({
            title: 'Remove this ingredient?',
            message: `"${display}" will be removed from this recipe only.`,
            confirmText: 'Remove',
            cancelText: 'Cancel',
            danger: true,
          })
        : window.confirm(`"${display}" will be removed from this recipe only.`);
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
        message: `Removed "${display}"`,
        undo: restore,
        timeoutMs: 8000,
      });
    } else if (typeof window.showUndoToast === 'function') {
      window.showUndoToast({
        message: `Removed "${display}"`,
        onUndo: restore,
      });
    }
  } catch (_) {}

  return true;
};

window.recipeEditorDeleteIngredientHeadingRow = async ({
  sectionRef,
  rowRef,
  headingClientId,
} = {}) => {
  if (!sectionRef || !rowRef) return false;

  const snapshot = JSON.parse(JSON.stringify(rowRef));
  const label =
    snapshot && snapshot.text && String(snapshot.text).trim()
      ? String(snapshot.text).trim()
      : 'Section title';

  try {
    const ok =
      window.ui && typeof window.ui.confirm === 'function'
        ? await window.ui.confirm({
            title: 'Remove Subhead',
            message: `Remove "${label}"?\n\nThis won’t delete any ingredients.`,
            confirmText: 'Remove',
            cancelText: 'Cancel',
            danger: true,
          })
        : window.confirm(
            `Remove "${label}"?\n\nThis won’t delete any ingredients.`
          );
    if (!ok) return false;
  } catch (_) {}

  const del = deleteIngredientHeadingRowFromSection(sectionRef, rowRef);
  if (!del || !del.removed) return false;

  try {
    if (typeof markDirty === 'function') markDirty();
  } catch (_) {}

  try {
    const cid = headingClientId || snapshot.headingClientId || null;
    if (cid && window._editingIngredientHeadingClientId === String(cid)) {
      window._editingIngredientHeadingClientId = null;
    }
    if (
      window._activeIngredientHeadingEditor &&
      cid &&
      window._activeIngredientHeadingEditor.clientId === String(cid)
    ) {
      window._activeIngredientHeadingEditor = null;
    }
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
    } catch (_) {}
    try {
      rerenderIngredientsSectionFromModel();
    } catch (_) {}
  };

  try {
    const um = window.undoManager;
    if (um && typeof um.push === 'function') {
      um.push({
        message: 'Subhead removed',
        undo: restore,
        timeoutMs: 8000,
      });
    } else if (typeof window.showUndoToast === 'function') {
      window.showUndoToast({
        message: 'Subhead removed',
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

  const stepsSection = container.querySelector('#stepsSection');

  // Unified servings row just under the title
  renderServingsRow(recipe, container);

  // Enable inline title editing
  const titleEl = container.querySelector('#recipeTitle');
  if (typeof attachTitleEditor === 'function') {
    attachTitleEditor(titleEl);
  }

  // Ingredients list + "You will need" — delegate to the shared rerender fn.
  if (recipe.sections && recipe.sections.length > 0) {
    rerenderIngredientsSectionFromModel();
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
          // Placeholder step row (empty-state). Used for hiding the number pre-focus.
          line.classList.add('instruction-line--placeholder');
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
        const rawText = step.instructions ?? '';
        const isPlaceholder =
          !rawText || String(rawText).trim() === 'Add a step.';

        if (isPlaceholder) {
          text.textContent = '';
          text.dataset.placeholder = 'Add a step.';
          text.classList.add('placeholder-prompt');
          line.classList.add('instruction-line--placeholder');
        } else {
          text.textContent = rawText;
        }

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
          line.classList.add('instruction-line--placeholder');
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

// --- Title normalization helper (preserve casing + fallback to "Untitled") ---
function normalizeRecipeTitle(raw) {
  if (raw == null) return 'Untitled';
  const trimmed = String(raw).trim();
  if (!trimmed) return 'Untitled';
  return trimmed;
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
