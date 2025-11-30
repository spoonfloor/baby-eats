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
    const key = `${ing.variant || ''}|${ing.name}|${ing.locationAtHome || ''}`;
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
  const container = document.getElementById('recipeView');

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
    const ingredientsHeader = document.createElement('h2');
    ingredientsHeader.className = 'section-header';
    ingredientsHeader.textContent = 'Ingredients';
    ingredientsSection.appendChild(ingredientsHeader);

    const allIngredientsForList = recipe.sections.flatMap(
      (s) => s.ingredients || []
    );
    allIngredientsForList.forEach((ing) => {
      const line = document.createElement('div');
      line.className = 'ingredient-line';
      const span = document.createElement('span');

      const qty =
        ing.quantity && !isNaN(parseFloat(ing.quantity))
          ? decimalToFractionDisplay(parseFloat(ing.quantity)) + ' '
          : ing.quantity
          ? ing.quantity + ' '
          : '';

      const unit = ing.unit ? ing.unit + ' ' : '';
      const name = ing.name || '';

      span.textContent = `${qty || ''}${unit || ''}${name}`;
      line.appendChild(span);
      ingredientsSection.appendChild(line);
    });
  }

  // --- You will need section ---
  const allIngredientsRaw = Array.isArray(recipe.sections)
    ? recipe.sections.flatMap((s) => s.ingredients || [])
    : [];

  // Strip out model-only placeholders so "You will need" reflects real ingredients only.
  const allIngredients = allIngredientsRaw.filter((ing) => !ing.isPlaceholder);

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
        span.textContent = m;
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

    const nodes =
      window.StepNodeModel &&
      typeof StepNodeModel.normalizeStepNodeOrder === 'function'
        ? StepNodeModel.normalizeStepNodeOrder(stepNodes)
        : stepNodes.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    let displayIndex = 0;

    nodes.forEach((node) => {
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
      text.textContent = node.text ?? '';

      ensureStepTextNotEmpty(text);

      line.appendChild(num);
      line.appendChild(text);
      stepsSection.appendChild(line);

      attachStepInlineEditor(text);
    });

    // Reordering handled by stepsEdit.js
    setupStepReordering(stepsSection, recipeId);
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
      // Reordering handled by stepsEdit.js
      setupStepReordering(stepsSection, recipe.id);
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
      text.textContent = step.instructions ?? '';

      ensureStepTextNotEmpty(text);

      line.appendChild(num);
      line.appendChild(text);

      stepsSection.appendChild(line);
      attachStepInlineEditor(text);
    });

    setupStepReordering(stepsSection, recipe.id);
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
  const v = recipe.servingsDefault;
  return v !== null && v !== undefined && v !== '';
}

function updateServingsVisibility(recipe) {
  const row = document.getElementById('servingsRow');
  if (!row) return;

  const hasData = servingsHasData(recipe);
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

  const recipeModel = recipe || window.recipeData;
  if (!recipeModel) return;

  if (typeof window.isServingsEditing === 'undefined') {
    window.isServingsEditing = false;
  }

  const hasData = servingsHasData(recipe);

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
      field.textContent = 'Servings:';
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

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'servings-input';
    input.value =
      recipeModel.servingsDefault != null
        ? String(recipeModel.servingsDefault)
        : '';

    field.innerHTML = '';
    field.appendChild(pill);
    field.appendChild(input);

    pill.addEventListener('click', () => {
      input.focus();
      input.select();
    });

    const skipAutoFocus =
      typeof window !== 'undefined' && window._servingsEditSkipFocusOnce;

    if (skipAutoFocus) {
      window._servingsEditSkipFocusOnce = false;
    } else {
      setTimeout(() => {
        input.focus();
        input.select();
      }, 0);
    }

    // Live-commit semantics: update in-memory model while typing
    input.addEventListener('input', () => {
      const raw = (input.value || '').trim();

      if (raw === '') {
        // Empty while typing → treat as "no servings yet" but don't hide row until blur
        recipeModel.servingsDefault = null;
      } else if (_servingsIsValidNumber(raw)) {
        recipeModel.servingsDefault = Math.round(Number(raw));
        window._servingsLastValid = recipeModel.servingsDefault;
      }

      if (typeof markDirty === 'function') {
        markDirty();
      }
    });

    input.addEventListener('blur', () => {
      const raw = (input.value || '').trim();

      // Escape path sets skip flag — skip committing, revert via render.
      if (window._servingsSkipCommitOnce) {
        window._servingsSkipCommitOnce = false;
        recipeModel.servingsDefault = window._servingsLastValid;
        window.isServingsEditing = false;
        renderServingsRow(recipeModel, container);
        return;
      }

      // Empty → null + hide row
      if (raw === '') {
        recipeModel.servingsDefault = null;
      }
      // Valid number → commit normalized
      else if (_servingsIsValidNumber(raw)) {
        recipeModel.servingsDefault = Math.round(Number(raw));
        window._servingsLastValid = recipeModel.servingsDefault;
      }
      // Invalid → revert to last valid
      else {
        recipeModel.servingsDefault = window._servingsLastValid;
      }

      window.isServingsEditing = false;
      renderServingsRow(recipeModel, container);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Treat Enter exactly like blur
        input.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        // Escape = revert + exit, so tell blur to skip commit
        window._servingsSkipCommitOnce = true;
        input.blur();
      }
    });
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

// --- Helpers ---
function capitalizeWords(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
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
