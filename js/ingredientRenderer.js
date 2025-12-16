// Ingredient editor

function attachIngredientInputAutosize(input) {
  if (!input) return;

  // Measure "1ch" in pixels for this font, once per page.
  let pxPerCh = window.__ingredientPxPerCh;
  if (!pxPerCh || !Number.isFinite(pxPerCh) || pxPerCh <= 0) {
    const probe = document.createElement('span');
    probe.textContent = '0';
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.whiteSpace = 'pre';

    const cs = window.getComputedStyle(input);
    probe.style.fontFamily = cs.fontFamily;
    probe.style.fontSize = cs.fontSize;

    document.body.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    document.body.removeChild(probe);

    pxPerCh = rect.width || 8; // sensible fallback
    window.__ingredientPxPerCh = pxPerCh;
  }

  const getMinMaxCh = () => {
    const styles = window.getComputedStyle(input);
    const minPx = parseFloat(styles.minWidth) || 0;
    const maxPx = parseFloat(styles.maxWidth) || 0;

    const minCh = minPx > 0 ? minPx / pxPerCh : 0;
    const maxCh = maxPx > 0 ? maxPx / pxPerCh : Infinity;

    return { minCh, maxCh };
  };

  const updateWidth = () => {
    const text = input.value || input.placeholder || '';

    let ch = (text && text.length) || 1;

    const { minCh, maxCh } = getMinMaxCh();

    if (minCh && ch < minCh) ch = minCh;
    if (Number.isFinite(maxCh) && ch > maxCh) ch = maxCh;

    // Let CSS own min/max (via vars); JS only picks a target width in ch units.
    input.style.width = `${ch}ch`;
  };

  // Size once now, and again on each change

  input.addEventListener('input', updateWidth);
  updateWidth();
}

// --- Unit display helper (DB-aware when available) ---
function getUnitDisplay(unitText, numericVal) {
  let unit = unitText || '';
  const codeLower = unit.toLowerCase();

  // Optional: use DB-backed metadata if present (populated elsewhere).
  let meta = null;
  if (window.unitsDisplayMap && window.unitsDisplayMap[codeLower]) {
    meta = window.unitsDisplayMap[codeLower];
  } else if (window.unitsMeta && window.unitsMeta[codeLower]) {
    meta = window.unitsMeta[codeLower];
  }

  if (meta) {
    // Prefer explicit short label, then singular name, then original code.
    unit =
      meta.abbrev ||
      meta.abbreviation ||
      meta.name_singular ||
      meta.name ||
      unit;
  }

  // U.S. cookbook style: abbreviations never pluralize based on quantity.
  if (unit && numericVal && numericVal !== 1) {
    const abbrevUnits = [
      'tsp',
      'tbsp',
      'cup',
      'oz',
      'lb',
      'pt',
      'qt',
      'gal',
      'ml',
      'l',
      'g',
      'kg',
    ];

    if (!abbrevUnits.includes(codeLower) && !unit.endsWith('s')) {
      unit = unit + 's';
    }
  }

  return unit;
}

if (typeof window !== 'undefined' && !window.getUnitDisplay) {
  window.getUnitDisplay = getUnitDisplay;
}

function renderIngredient(line) {
  // NOTE: edit-row scaffold added further down

  const div = document.createElement('div');
  div.className = 'ingredient-line';
  div.dataset.quantity = line.quantity;
  div.dataset.unit = line.unit;
  div.dataset.name = line.name;

  const textSpan = document.createElement('span');
  textSpan.className = 'ingredient-text';

  // Placeholder row: "Add an ingredient."
  if (line.isPlaceholder) {
    textSpan.classList.add('placeholder-prompt');

    // click → open the multi-field editor (insert mode)
    div.addEventListener('click', () => {
      const parent = div.parentNode;
      if (!parent) return;

      openIngredientEditRow({
        parent,
        replaceEl: div,
        mode: 'insert',
        seedLine: null,
      });
    });
  }

  // Show quantity as fraction if numeric
  let qtyDisplay = line.quantity;
  if (!isNaN(parseFloat(line.quantity))) {
    qtyDisplay = decimalToFractionDisplay(parseFloat(line.quantity));
  }

  // --- Build base name (variant + name) ---
  let baseName;
  if (line.variant) {
    baseName = `${line.variant} ${line.name}`.trim();
  } else {
    baseName = line.name;
  }

  // --- Decide if quantity is numeric or free-text ---
  const isNumericQty = !isNaN(parseFloat(line.quantity));

  let mainText;
  if (isNumericQty && line.quantity !== '') {
    const numericVal = parseFloat(line.quantity);
    const unitText = getUnitDisplay(line.unit || '', numericVal);
    mainText = [qtyDisplay, unitText, baseName].filter(Boolean).join(' ');
  } else if (line.quantity) {
    // Free-text quantity like "to taste" or "as needed"
    mainText = [line.prepNotes, baseName, line.quantity]
      .filter(Boolean)
      .join(' ');
    // Clear prepNotes so we don’t repeat it later
    line.prepNotes = '';
  } else {
    mainText = [line.unit, baseName].filter(Boolean).join(' ');
  }

  // --- Append prep notes (if still left) ---
  if (line.prepNotes) {
    mainText += `, ${line.prepNotes}`;
  }

  // --- Handle substitutes (join with " or ") ---
  let groupText = mainText;
  if (line.substitutes && line.substitutes.length > 0) {
    const subsText = line.substitutes.map((sub) => {
      const subBase = sub.variant
        ? `${sub.variant} ${sub.name}`.trim()
        : sub.name;
      return [sub.quantity, sub.unit, subBase].filter(Boolean).join(' ');
    });
    groupText += ' or ' + subsText.join(' or ');
  }

  // --- Build parenthetical collector (AFTER group) ---
  let parenBits = [];
  if (line.parentheticalNote) parenBits.push(line.parentheticalNote);
  if (line.isOptional) parenBits.push('optional');
  if (parenBits.length > 0) {
    groupText += ` (${parenBits.join(', ')})`;
  }

  // ✅ Add precise logs to see which path runs and what DOM gets built
  if (line.subRecipeId) {
    // clickable link only for "variant + name"
    const link = document.createElement('a');
    link.href = '#';
    link.classList.add('sub-recipe-link');
    link.textContent = baseName;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.openRecipe) {
        window.openRecipe(line.subRecipeId);
      } else {
        console.warn('openRecipe not available');
      }
    });

    // Build DOM explicitly, never reusing groupText
    if (line.quantity && !isNaN(parseFloat(line.quantity))) {
      textSpan.appendChild(
        document.createTextNode(
          decimalToFractionDisplay(parseFloat(line.quantity)) + ' '
        )
      );
    } else if (line.quantity) {
      textSpan.appendChild(document.createTextNode(line.quantity + ' '));
    }

    if (line.unit) {
      textSpan.appendChild(document.createTextNode(line.unit + ' '));
    }

    // clickable part = baseName only
    textSpan.appendChild(link);

    if (line.prepNotes) {
      textSpan.appendChild(document.createTextNode(', ' + line.prepNotes));
    }

    if (line.substitutes && line.substitutes.length > 0) {
      const subsText = line.substitutes.map((sub) => {
        const subBase = sub.variant
          ? `${sub.variant} ${sub.name}`.trim()
          : sub.name;
        return [sub.quantity, sub.unit, subBase].filter(Boolean).join(' ');
      });
      textSpan.appendChild(
        document.createTextNode(' or ' + subsText.join(' or '))
      );
    }

    if (line.parentheticalNote || line.isOptional) {
      const bits = [];
      if (line.parentheticalNote) bits.push(line.parentheticalNote);
      if (line.isOptional) bits.push('optional');
      textSpan.appendChild(document.createTextNode(` (${bits.join(', ')})`));
    }
  } else {
    // fallback for normal ingredients
    textSpan.textContent = groupText;

    // 🔍 Also log fallback DOM
  }

  // Save raw quantity separately for editing
  textSpan.dataset.rawQuantity = line.quantity || '';

  div.appendChild(textSpan);

  // Existing ingredient rows: click → open multi-field editor (update mode)
  if (!line.isPlaceholder) {
    div.addEventListener('click', (e) => {
      // Let clicks on sub-recipe links behave normally.
      if (e && e.target && e.target.closest && e.target.closest('a')) return;

      const parent = div.parentNode;
      if (!parent) return;

      openIngredientEditRow({
        parent,
        replaceEl: div,
        mode: 'update',
        seedLine: line,
      });
    });
  }

  return div;
}

function openIngredientEditRow({ parent, replaceEl, mode, seedLine }) {
  if (!parent || !replaceEl) return;
  const isInsert = mode === 'insert';

  const row = document.createElement('div');
  row.className = 'ingredient-edit-row editing';
  row.dataset.isEditing = 'true';

  // Dirty should flip on first keystroke (not blur/commit).
  let hasPendingEdit = false;
  const markDirtyOnce = () => {
    if (hasPendingEdit) return;
    hasPendingEdit = true;
    if (typeof markDirty === 'function') {
      markDirty();
    }
  };

  // When editing an existing ingredient, make sure we update the real in-memory model
  // (`window.recipeData`) that Save reads from. The rendered `seedLine` might be a copy.
  let modelRef = seedLine || null;
  if (!isInsert && seedLine && seedLine.rimId != null) {
    const rid = String(seedLine.rimId);
    const model = window.recipeData;
    const secs = Array.isArray(model?.sections) ? model.sections : [];
    for (const sec of secs) {
      const arr = Array.isArray(sec?.ingredients) ? sec.ingredients : [];
      const hit = arr.find((ing) => ing && String(ing.rimId) === rid);
      if (hit) {
        modelRef = hit;
        break;
      }
    }
  }

  // Helper to make a pill-like label span
  const makePill = (text) => {
    const s = document.createElement('span');
    s.className = 'field-pill ingredient-pill';
    s.textContent = text;
    return s;
  };

  // Container for pill + input
  const makeCell = (labelText) => {
    const cell = document.createElement('div');
    cell.className = 'ingredient-edit-cell';
    cell.classList.add(`ingredient-edit-cell--${labelText}`);

    const pill = makePill(labelText);
    cell.appendChild(pill);

    const input = document.createElement('input');
    input.className = 'ingredient-edit-input';
    input.classList.add(`ingredient-edit-input--${labelText}`);
    input.type = 'text';
    input.dataset.field = labelText;

    if (typeof wireLabelToInput === 'function') {
      wireLabelToInput(pill, input);
    }
    if (typeof attachIngredientInputAutosize === 'function') {
      attachIngredientInputAutosize(input);
    }

    cell.appendChild(input);
    return cell;
  };

  // Location is edited elsewhere; suppress it here.
  // Field order: name first, everything else unchanged.
  const labels = ['name', 'qty', 'unit', 'var', 'prep', 'notes', 'opt'];
  labels.forEach((lab) => row.appendChild(makeCell(lab)));

  // Any keystroke in any ingredient field should immediately enable Cancel/Save.
  row.addEventListener('input', (e) => {
    // Ignore synthetic/programmatic input events (e.g. our own prefill/autosize nudges).
    if (e && e.isTrusted === false) return;
    const t = e && e.target;
    if (t && t.classList && t.classList.contains('ingredient-edit-input')) {
      markDirtyOnce();
    }
  });

  // Prefill values when editing an existing row
  if (!isInsert && modelRef) {
    const set = (field, val) => {
      const inp = row.querySelector(`.ingredient-edit-input[data-field="${field}"]`);
      if (!inp) return;
      inp.value = val == null ? '' : String(val);
      // Trigger autosize once.
      try {
        // NOTE: do not bubble; bubbling would trigger dirty-on-first-keystroke logic.
        inp.dispatchEvent(new Event('input'));
      } catch (_) {}
    };

    set('qty', modelRef.quantity ?? '');
    set('unit', modelRef.unit ?? '');
    set('name', modelRef.name ?? '');
    set('var', modelRef.variant ?? '');
    set('prep', modelRef.prepNotes ?? '');
    set('notes', modelRef.parentheticalNote ?? '');
    set('opt', modelRef.isOptional ? 'x' : '');
  }

  const restoreOriginal = () => {
    if (parent.contains(row)) parent.replaceChild(replaceEl, row);
  };

  const isEmpty = () => {
    const inputs = row.querySelectorAll('.ingredient-edit-input');
    for (const inp of inputs) {
      if (inp.value && inp.value.trim() !== '') return false;
    }
    return true;
  };

  const readFields = () => {
    const inputs = row.querySelectorAll('.ingredient-edit-input');
    const fields = {};
    inputs.forEach((inp) => {
      const key = inp.dataset.field || '';
      if (!key) return;
      fields[key] = (inp.value || '').trim();
    });
    return fields;
  };

  const commit = () => {
    const fields = readFields();
    const hasData = Object.values(fields).some((v) => v && v.trim() !== '');

    if (!hasData) {
      restoreOriginal();
      return;
    }

    const qtyRaw = fields.qty || '';
    let quantity = qtyRaw;
    const qtyNum = parseFloat(qtyRaw);
    if (qtyRaw && !Number.isNaN(qtyNum)) quantity = qtyNum;

    if (isInsert) {
      const ingredient = {
        quantity,
        unit: fields.unit || '',
        name: fields.name || '',
        variant: fields.var || '',
        prepNotes: fields.prep || '',
        parentheticalNote: fields.notes || '',
        isOptional: !!(fields.opt && fields.opt.trim()),
        substitutes: [],
        locationAtHome: '',
        subRecipeId: null,
        isPlaceholder: false,
      };

      // v1: assume single ingredients section in the model
      const model = window.recipeData;
      if (model && Array.isArray(model.sections) && model.sections[0]) {
        const section = model.sections[0];
        if (!Array.isArray(section.ingredients)) section.ingredients = [];

        let placeholderIdx = section.ingredients.findIndex(
          (ing) => ing && ing.isPlaceholder
        );
        if (placeholderIdx === -1) {
          placeholderIdx = section.ingredients.length;
          section.ingredients.push(ingredient);
        } else {
          section.ingredients[placeholderIdx] = ingredient;
        }

        const hasPlaceholderInModel = section.ingredients.some(
          (ing) => ing && ing.isPlaceholder
        );
        if (!hasPlaceholderInModel) {
          section.ingredients.push({
            quantity: '',
            unit: '',
            name: '',
            variant: '',
            prepNotes: '',
            parentheticalNote: '',
            isOptional: false,
            substitutes: [],
            locationAtHome: '',
            subRecipeId: null,
            isPlaceholder: true,
          });
        }
      }

      const readOnlyLine = renderIngredient(ingredient);
      if (readOnlyLine && parent.contains(row)) {
        parent.replaceChild(readOnlyLine, row);
      }
    } else if (modelRef) {
      // Update the model reference (the thing Save will persist).
      modelRef.quantity = quantity;
      modelRef.unit = fields.unit || '';
      modelRef.name = fields.name || '';
      modelRef.variant = fields.var || '';
      modelRef.prepNotes = fields.prep || '';
      modelRef.parentheticalNote = fields.notes || '';
      modelRef.isOptional = !!(fields.opt && fields.opt.trim());
      modelRef.isPlaceholder = false;

      // Keep the original rendered object in sync too (best-effort), so any other
      // logic that still holds that reference won't drift.
      if (seedLine && seedLine !== modelRef) {
        seedLine.quantity = modelRef.quantity;
        seedLine.unit = modelRef.unit;
        seedLine.name = modelRef.name;
        seedLine.variant = modelRef.variant;
        seedLine.prepNotes = modelRef.prepNotes;
        seedLine.parentheticalNote = modelRef.parentheticalNote;
        seedLine.isOptional = modelRef.isOptional;
        seedLine.isPlaceholder = false;
      }

      const readOnlyLine = renderIngredient(modelRef);
      if (readOnlyLine && parent.contains(row)) {
        parent.replaceChild(readOnlyLine, row);
      }
    }

    // Do NOT mark dirty on commit; dirty should flip on the first keystroke only.
  };

  const cancel = () => restoreOriginal();

  // Replace in DOM first, then enter edit mode with the shared controller.
  parent.replaceChild(row, replaceEl);

  if (typeof setupInlineRowEditing === 'function') {
    let _isEditing = false;
    const controller = setupInlineRowEditing({
      rowElement: row,
      isEmpty,
      commit,
      cancel,
      getIsEditing: () => _isEditing,
      setIsEditing: (flag) => {
        _isEditing = !!flag;
        row.classList.toggle('editing', _isEditing);
      },
      onEnterCommit: isInsert
        ? () => {
            // After inserting, create a new placeholder row and jump into it.
            const placeholderLine = renderIngredient({
              quantity: '',
              unit: '',
              name: '',
              variant: '',
              prepNotes: '',
              parentheticalNote: '',
              isOptional: false,
              substitutes: [],
              locationAtHome: '',
              subRecipeId: null,
              isPlaceholder: true,
            });

            if (!placeholderLine) return;

            const anchor = parent.contains(row) ? row : null;
            const after = anchor ? anchor.nextSibling : null;
            if (after) parent.insertBefore(placeholderLine, after);
            else parent.appendChild(placeholderLine);

            if (typeof placeholderLine.click === 'function') {
              placeholderLine.click();
            }
          }
        : undefined,
    });

    if (controller && typeof controller.enterEdit === 'function') {
      controller.enterEdit();
    } else {
      row.classList.add('editing');
    }
  } else {
    row.classList.add('editing');
  }

  // Focus qty by default
  const qtyInput = row.querySelector('.ingredient-edit-input[data-field="qty"]');
  if (qtyInput) qtyInput.focus();
}

function renderIngredientEditRowScaffold() {
  const row = document.createElement('div');
  row.className = 'ingredient-edit-row editing';

  // Helper to make a pill-like label span
  const makePill = (text) => {
    const s = document.createElement('span');
    s.className = 'field-pill ingredient-pill';
    s.textContent = text;
    return s;
  };

  // Container for pill + (later) input
  const makeCell = (labelText) => {
    const cell = document.createElement('div');
    cell.className = 'ingredient-edit-cell';
    cell.classList.add(`ingredient-edit-cell--${labelText}`);

    const pill = makePill(labelText);
    cell.appendChild(pill);

    const input = document.createElement('input');
    input.className = 'ingredient-edit-input';
    input.classList.add(`ingredient-edit-input--${labelText}`);
    input.type = 'text';

    // NEW: tag input with its logical field name
    input.dataset.field = labelText;

    if (typeof wireLabelToInput === 'function') {
      wireLabelToInput(pill, input);
    }

    // Auto-size based on content length
    if (typeof attachIngredientInputAutosize === 'function') {
      attachIngredientInputAutosize(input);
    }

    cell.appendChild(input);

    return cell;
  };

  // Scaffold helper (currently unused): keep in sync with openIngredientEditRow.
  // name | qty | unit | var | prep | notes | opt
  const labels = ['name', 'qty', 'unit', 'var', 'prep', 'notes', 'opt'];

  labels.forEach((lab) => {
    row.appendChild(makeCell(lab));
  });

  return row;
}
