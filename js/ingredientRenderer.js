// Ingredient editor

function attachIngredientInputAutosize(input) {
  if (!input) return;

  // Measure actual text width using a probe element
  const measureText = (text) => {
    const probe = document.createElement('span');
    probe.textContent = text || 'M'; // Use 'M' as baseline for empty
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.whiteSpace = 'pre';
    const cs = window.getComputedStyle(input);
    probe.style.fontFamily = cs.fontFamily;
    probe.style.fontSize = cs.fontSize;
    probe.style.fontWeight = cs.fontWeight;
    probe.style.letterSpacing = cs.letterSpacing;

    document.body.appendChild(probe);
    const width = probe.getBoundingClientRect().width;
    document.body.removeChild(probe);
    return width;
  };

  const updateWidth = () => {
    const text = (input.value || '').trimEnd();
    const styles = window.getComputedStyle(input);
    const maxPx = parseFloat(styles.maxWidth) || 0;

    // Empty: use CSS `--ingredient-field-empty-width` (clear inline width)
    if (!text) {
      input.style.width = '';
      return;
    }

    // Filled: shrink-wrap to content (plus padding+border), clamp only to max width.
    let targetWidth = measureText(text);

    const padding =
      parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    const border =
      parseFloat(styles.borderLeftWidth) + parseFloat(styles.borderRightWidth);
    targetWidth += padding + border;

    if (maxPx && targetWidth > maxPx) targetWidth = maxPx;

    input.style.width = `${targetWidth}px`;
  };

  // Scroll to beginning on focus and blur
  const scrollToStart = () => {
    input.scrollLeft = 0;
  };
  input.addEventListener('focus', scrollToStart);
  input.addEventListener('blur', scrollToStart);

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

function normalizeIngredientHeadingText(raw) {
  if (raw == null) return '';
  const t = String(raw).replace(/\s+/g, ' ').trim();
  return t;
}

function findIngredientSectionForHeadingClientId(clientId) {
  const model = window.recipeData;
  const secs = Array.isArray(model?.sections) ? model.sections : [];
  for (const sec of secs) {
    const arr = Array.isArray(sec?.ingredients) ? sec.ingredients : [];
    const idx = arr.findIndex(
      (r) => r && r.rowType === 'heading' && r.headingClientId === clientId
    );
    if (idx !== -1) return { sec, idx };
  }
  return null;
}

function renderIngredientHeading(row) {
  const div = document.createElement('div');
  div.className = 'ingredient-subsection-heading-line';
  if (row && row.headingClientId) {
    div.dataset.headingClientId = String(row.headingClientId);
  }

  const text = document.createElement('span');
  text.className = 'ingredient-subsection-heading-text';
  if (row && row.headingClientId) {
    text.dataset.headingClientId = String(row.headingClientId);
  }

  const originalText = row && row.text != null ? String(row.text) : '';
  const normalized = normalizeIngredientHeadingText(originalText);
  text.textContent = normalized;
  text.dataset.placeholder = 'Section title';

  // Show "Section title" hint for empty headings (like instructions).
  if (!normalized) {
    text.textContent = '';
    text.classList.add('placeholder-prompt', 'placeholder-prompt--editblue');
  } else {
    text.classList.remove('placeholder-prompt', 'placeholder-prompt--editblue');
  }

  div.appendChild(text);

  div.addEventListener('click', () => {
    // If already editing, do not re-enter edit mode; this breaks native
    // double-click/triple-click selection and click-drag selection.
    if (text.isContentEditable || div.classList.contains('editing')) return;

    const clientId =
      row && row.headingClientId ? String(row.headingClientId) : '';
    if (!clientId) return;

    // Only one heading editor at a time.
    if (
      window._editingIngredientHeadingClientId &&
      window._editingIngredientHeadingClientId !== clientId
    ) {
      return;
    }

    const wasDirty = typeof isDirty !== 'undefined' && isDirty === true;
    const startValue = normalizeIngredientHeadingText(row.text || '');

    window._editingIngredientHeadingClientId = clientId;
    div.classList.add('editing');

    // Enter edit mode. Keep placeholder class until the user types.
    text.contentEditable = 'true';
    text.textContent = startValue;
    try {
      text.focus();
      // Place caret at end.
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(text);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {}

    let hasPendingEdit = false;
    let suppressCommitOnce = false;

    const cleanup = () => {
      text.contentEditable = 'false';
      div.classList.remove('editing');
      window._editingIngredientHeadingClientId = null;
      if (
        window._activeIngredientHeadingEditor &&
        window._activeIngredientHeadingEditor.clientId === clientId
      ) {
        window._activeIngredientHeadingEditor = null;
      }
      text.removeEventListener('keydown', onKeyDown);
      text.removeEventListener('blur', onBlur);
      text.removeEventListener('input', onInput);
    };

    const cancel = () => {
      suppressCommitOnce = true;

      // If this was a newly inserted empty heading, cancel should remove it.
      const isNewEmpty =
        (!row.headingId || row.headingId == null) && startValue === '';

      if (isNewEmpty) {
        const found = findIngredientSectionForHeadingClientId(clientId);
        if (found && found.sec && Array.isArray(found.sec.ingredients)) {
          found.sec.ingredients.splice(found.idx, 1);
        }
      } else {
        row.text = startValue;
      }

      cleanup();

      // If we dirtied only via this edit, revert dirty flag by reverting changes.
      if (!wasDirty && typeof revertChanges === 'function') {
        revertChanges();
      }

      if (
        typeof window.recipeEditorRerenderIngredientsFromModel === 'function'
      ) {
        window.recipeEditorRerenderIngredientsFromModel();
      }
    };

    const commit = () => {
      if (suppressCommitOnce) return;

      const next = normalizeIngredientHeadingText(text.textContent || '');
      if (!next) {
        const found = findIngredientSectionForHeadingClientId(clientId);
        if (found && found.sec && Array.isArray(found.sec.ingredients)) {
          found.sec.ingredients.splice(found.idx, 1);
        }
      } else {
        row.text = next;
      }

      cleanup();

      if (
        typeof window.recipeEditorRerenderIngredientsFromModel === 'function'
      ) {
        window.recipeEditorRerenderIngredientsFromModel();
      }
    };

    // Expose this editor so other actions (like ctrl-click inserting another heading)
    // can commit/delete the active heading before forcing a rerender.
    window._activeIngredientHeadingEditor = {
      clientId,
      commit,
      cancel,
    };

    const onInput = (e) => {
      if (e && e.isTrusted === false) return;
      if (hasPendingEdit) return;
      hasPendingEdit = true;
      if (typeof markDirty === 'function') {
        markDirty();
      }

      // Once the user types something non-empty, hide the placeholder hint.
      try {
        const raw = text.textContent || '';
        const v = normalizeIngredientHeadingText(raw);
        if (v) {
          text.classList.remove(
            'placeholder-prompt',
            'placeholder-prompt--editblue'
          );
        }
      } catch (_) {}
    };

    const onBlur = () => commit();

    const onKeyDown = (e) => {
      if (!e) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        text.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    };

    text.addEventListener('input', onInput);
    text.addEventListener('blur', onBlur);
    text.addEventListener('keydown', onKeyDown);
  });

  return div;
}

if (typeof window !== 'undefined' && !window.renderIngredientHeading) {
  window.renderIngredientHeading = renderIngredientHeading;
}

function renderIngredient(line) {
  // NOTE: edit-row scaffold added further down

  const div = document.createElement('div');
  div.className = 'ingredient-line';
  if (line && line.rimId != null) {
    div.dataset.rimId = String(line.rimId);
  }
  div.dataset.isOptional = line && line.isOptional ? '1' : '0';
  div.dataset.isPlaceholder = line && line.isPlaceholder ? '1' : '0';
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

  // Hidden focus target to support a "neutral" state within edit mode:
  // clicking tray background can move focus off inputs without exiting edit mode.
  const blurTarget = document.createElement('div');
  blurTarget.className = 'inline-edit-blur-target';
  blurTarget.tabIndex = -1;
  blurTarget.setAttribute('aria-hidden', 'true');
  row.appendChild(blurTarget);

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
  let sectionRef = null;
  if (!isInsert && seedLine && seedLine.rimId != null) {
    const rid = String(seedLine.rimId);
    const model = window.recipeData;
    const secs = Array.isArray(model?.sections) ? model.sections : [];
    for (const sec of secs) {
      const arr = Array.isArray(sec?.ingredients) ? sec.ingredients : [];
      const hit = arr.find((ing) => ing && String(ing.rimId) === rid);
      if (hit) {
        modelRef = hit;
        sectionRef = sec;
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

    const input = document.createElement('input');
    input.className = 'ingredient-edit-input';
    input.classList.add(`ingredient-edit-input--${labelText}`);
    input.dataset.field = labelText;

    // OPT is a boolean: render as a checkbox toggle (not a text field).
    // Wrap pill + checkbox in a <label> so clicking the pill toggles with trusted events.
    if (labelText === 'opt') {
      input.type = 'checkbox';
      const wrap = document.createElement('label');
      wrap.className = 'ingredient-edit-toggle';

      const pill = makePill(labelText);
      wrap.appendChild(pill);
      wrap.appendChild(input);
      cell.appendChild(wrap);
      return cell;
    }

    // Default: pill + text input
    input.type = 'text';
    const pill = makePill(labelText);
    cell.appendChild(pill);

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
  const labels = ['name', 'qty', 'unit', 'size', 'var', 'prep', 'notes', 'opt'];
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

  // Checkbox toggles (opt) often fire `change` (not consistently `input`), but they
  // should still enable Cancel/Save immediately.
  row.addEventListener('change', (e) => {
    if (e && e.isTrusted === false) return;
    const t = e && e.target;
    if (t && t.classList && t.classList.contains('ingredient-edit-input')) {
      markDirtyOnce();
    }
  });

  // Prefill values when editing an existing row
  if (!isInsert && modelRef) {
    const set = (field, val) => {
      const inp = row.querySelector(
        `.ingredient-edit-input[data-field="${field}"]`
      );
      if (!inp) return;
      if (inp.type === 'checkbox') {
        const s = val == null ? '' : String(val);
        inp.checked =
          s === '1' || s.toLowerCase() === 'true' || s.toLowerCase() === 'x';
        return;
      }
      inp.value = val == null ? '' : String(val);
      // Trigger autosize by dispatching input event (autosize listens for this)
      try {
        // NOTE: do not bubble; bubbling would trigger dirty-on-first-keystroke logic.
        const evt = new Event('input', { bubbles: false });
        inp.dispatchEvent(evt);
      } catch (_) {}
    };

    set('qty', modelRef.quantity ?? '');
    set('unit', modelRef.unit ?? '');
    set('name', modelRef.name ?? '');
    set('size', modelRef.size ?? '');
    set('var', modelRef.variant ?? '');
    set('prep', modelRef.prepNotes ?? '');
    set('notes', modelRef.parentheticalNote ?? '');
    set('opt', modelRef.isOptional ? '1' : '');

    // Force autosize to run after all values are set (in case events didn't fire)
    requestAnimationFrame(() => {
      const inputs = row.querySelectorAll('.ingredient-edit-input');
      inputs.forEach((inp) => {
        try {
          inp.dispatchEvent(new Event('input', { bubbles: false }));
        } catch (_) {}
      });
    });
  }

  // DOM replacement can be triggered by multiple paths (Escape + focusout, etc.).
  // Make replacement idempotent and always replace via the row's current parent.
  let _didFinalizeSwap = false;
  const finalizeSwap = (nextEl) => {
    if (_didFinalizeSwap) return;
    _didFinalizeSwap = true;
    try {
      const p = row.parentNode;
      if (p && nextEl) {
        p.replaceChild(nextEl, row);
      }
    } catch (_) {
      // ignore double-swap / already-removed situations
    }
  };

  const restoreOriginal = () => finalizeSwap(replaceEl);

  const isEmpty = () => {
    const inputs = row.querySelectorAll('.ingredient-edit-input');
    for (const inp of inputs) {
      if (inp.type === 'checkbox') {
        if (inp.checked) return false;
        continue;
      }
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
      if (inp.type === 'checkbox') {
        fields[key] = inp.checked ? '1' : '';
      } else {
        fields[key] = (inp.value || '').trim();
      }
    });
    return fields;
  };

  const commit = () => {
    // If an overlay dropdown is open, close it before we mutate DOM.
    try {
      if (
        window.favoriteEatsTypeahead &&
        typeof window.favoriteEatsTypeahead.close === 'function'
      ) {
        window.favoriteEatsTypeahead.close();
      }
    } catch (_) {}

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
        size: fields.size || '',
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
        sectionRef = section;
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
            size: '',
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
      if (readOnlyLine) finalizeSwap(readOnlyLine);
    } else if (modelRef) {
      // Update the model reference (the thing Save will persist).
      modelRef.quantity = quantity;
      modelRef.unit = fields.unit || '';
      modelRef.name = fields.name || '';
      modelRef.size = fields.size || '';
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
        seedLine.size = modelRef.size;
        seedLine.variant = modelRef.variant;
        seedLine.prepNotes = modelRef.prepNotes;
        seedLine.parentheticalNote = modelRef.parentheticalNote;
        seedLine.isOptional = modelRef.isOptional;
        seedLine.isPlaceholder = false;
      }

      const readOnlyLine = renderIngredient(modelRef);
      if (readOnlyLine) finalizeSwap(readOnlyLine);
    }

    // After a successful commit, apply the "optional goes to bottom of section"
    // rule without being disruptive during active edit flows.
    try {
      if (
        sectionRef &&
        typeof window.recipeEditorAfterIngredientEditCommit === 'function'
      ) {
        window.recipeEditorAfterIngredientEditCommit(sectionRef);
      }
    } catch (_) {}

    // Do NOT mark dirty on commit; dirty should flip on the first keystroke only.
  };

  const cancel = () => {
    try {
      if (
        window.favoriteEatsTypeahead &&
        typeof window.favoriteEatsTypeahead.close === 'function'
      ) {
        window.favoriteEatsTypeahead.close();
      }
    } catch (_) {}

    restoreOriginal();
  };

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

  // Wire typeahead + tab-order navigation for this row (v1: name/unit/variant)
  try {
    if (
      typeof window.setupIngredientTypeaheadRow === 'function' &&
      row &&
      row.querySelector('.ingredient-edit-input')
    ) {
      window.setupIngredientTypeaheadRow(row);
    }
  } catch (err) {
    console.warn('⚠️ setupIngredientTypeaheadRow failed:', err);
  }

  // Focus name by default, with caret at the beginning
  const nameInput = row.querySelector(
    '.ingredient-edit-input[data-field="name"]'
  );
  if (nameInput) {
    nameInput.focus();
    nameInput.setSelectionRange(0, 0);
    // scrollToStart is handled by attachIngredientInputAutosize, but ensure it here too
    nameInput.scrollLeft = 0;
  }
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
  // name | size | qty | unit | var | prep | notes | opt
  const labels = ['name', 'qty', 'unit', 'size', 'var', 'prep', 'notes', 'opt'];

  labels.forEach((lab) => {
    row.appendChild(makeCell(lab));
  });

  return row;
}
