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
      const text = `${qty || ''}${unit || ''}${name}`.trim();

      span.textContent = text;

      // Subdued gray for placeholder prompt row
      if (ing.isPlaceholder || text === 'Add an ingredient.') {
        span.classList.add('placeholder-prompt');
      }

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

      const rawText = node.text ?? '';
      const isPlaceholder = !rawText || rawText.trim() === 'Add a step.';

      if (isPlaceholder) {
        text.textContent = '';
        text.dataset.placeholder = 'Add a step.';
        text.classList.add('placeholder-prompt');
      } else {
        text.textContent = rawText;
      }

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

      const rawText = step.instructions ?? '';
      const isPlaceholder = !rawText || rawText.trim() === 'Add a step.';

      if (isPlaceholder) {
        text.textContent = '';
        text.dataset.placeholder = 'Add a step.';
        text.classList.add('placeholder-prompt');
      } else {
        text.textContent = rawText;
      }

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

  const wireLabelToInput = (labelEl, inputEl) => {
    if (!labelEl || !inputEl) return;

    labelEl.addEventListener('mousedown', (e) => {
      // Keep focus inside the servings row so blur logic sees stayingInRow=true.
      e.preventDefault();
      inputEl.focus();
      if (typeof inputEl.select === 'function') {
        inputEl.select();
      }
    });
  };

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
    defaultSet.className = 'servings-set';

    const minSet = document.createElement('div');
    minSet.className = 'servings-set';

    const maxSet = document.createElement('div');
    maxSet.className = 'servings-set';

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

    // Labels behave like <label>: click → focus input

    minLabel.addEventListener('click', () => {
      minInput.focus();
      minInput.select();
    });

    maxLabel.addEventListener('click', () => {
      maxInput.focus();
      maxInput.select();
    });

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

    pill.addEventListener('click', () => {
      defaultInput.focus();
      defaultInput.select();
    });

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

    const onBlur = (e) => {
      const row = document.getElementById('servingsRow');
      const next = e && e.relatedTarget;
      const goingIntoServings = row && next && row.contains(next);

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
