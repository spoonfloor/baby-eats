// Ingredient editor

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

    // NEW: click → swap to edit scaffold
    const onClick = () => {
      const parent = div.parentNode;
      if (!parent) return;

      // Mark this as an ingredient edit row (for upcoming inline editor wiring)
      const row = document.createElement('div');
      row.className = 'ingredient-edit-row editing';

      row.dataset.isEditing = 'true';

      let lastCommittedLine = null;

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

        cell.appendChild(input);
        return cell;
      };

      const labels = [
        'qty',
        'unit',
        'name',
        'var',
        'prep',
        'notes',
        'opt',
        'loc',
      ];
      labels.forEach((lab) => {
        const cell = makeCell(lab);
        row.appendChild(cell);
      });

      // Helper: swap edit row back to original placeholder row
      const restorePlaceholder = () => {
        if (!parent) return;
        if (parent.contains(row)) {
          parent.replaceChild(div, row);
        }
      };

      // --------------------------------------------
      // 🔧 Inline editing controller (real wiring)
      // --------------------------------------------
      if (typeof setupInlineRowEditing === 'function') {
        let _isEditing = true; // starts in editing mode

        setupInlineRowEditing({
          rowElement: row,

          // fields empty means: all inputs blank (spaces ignored)
          isEmpty() {
            const inputs = row.querySelectorAll('.ingredient-edit-input');
            for (const inp of inputs) {
              if (inp.value && inp.value.trim() !== '') return false;
            }
            return true;
          },

          // Commit: build ingredient object, update model, and swap to read-only line
          commit() {
            const inputs = row.querySelectorAll('.ingredient-edit-input');
            const fields = {};

            inputs.forEach((inp) => {
              const key = inp.dataset.field || '';
              if (!key) return;
              fields[key] = (inp.value || '').trim();
            });

            const hasData = Object.values(fields).some(
              (v) => v && v.trim() !== ''
            );

            // Empty → treat as cancel
            if (!hasData) {
              restorePlaceholder();
              return;
            }

            const qtyRaw = fields.qty || '';
            let quantity = qtyRaw;
            const qtyNum = parseFloat(qtyRaw);
            if (qtyRaw && !Number.isNaN(qtyNum)) {
              quantity = qtyNum;
            }

            const ingredient = {
              quantity,
              unit: fields.unit || '',
              name: fields.name || '',
              variant: fields.var || '',
              prepNotes: fields.prep || '',
              parentheticalNote: fields.notes || '',
              isOptional: !!(fields.opt && fields.opt.trim()),
              substitutes: [],
              locationAtHome: fields.loc || '',
              subRecipeId: null,
              isPlaceholder: false,
            };

            // v1: assume single ingredients section in the model
            const model = window.recipeData;
            if (model && Array.isArray(model.sections) && model.sections[0]) {
              const section = model.sections[0];
              if (!Array.isArray(section.ingredients)) {
                section.ingredients = [];
              }

              // Replace first placeholder in the section, or append if none
              let placeholderIdx = section.ingredients.findIndex(
                (ing) => ing && ing.isPlaceholder
              );

              if (placeholderIdx === -1) {
                placeholderIdx = section.ingredients.length;
                section.ingredients.push(ingredient);
              } else {
                section.ingredients[placeholderIdx] = ingredient;
              }

              // Ensure a trailing placeholder exists
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

            // Re-render just this line as read-only
            let readOnlyLine = null;
            if (typeof renderIngredient === 'function') {
              readOnlyLine = renderIngredient(ingredient);
            }

            if (readOnlyLine && parent && parent.contains(row)) {
              parent.replaceChild(readOnlyLine, row);

              lastCommittedLine = readOnlyLine;
            }

            if (typeof markDirty === 'function') {
              markDirty();
            }
          },

          // Cancel: restore original placeholder row
          cancel() {
            restorePlaceholder();
          },

          getIsEditing() {
            return _isEditing;
          },

          setIsEditing(flag) {
            _isEditing = !!flag;
          },

          onEnterCommit() {
            if (!parent) return;

            const anchor =
              lastCommittedLine && parent.contains(lastCommittedLine)
                ? lastCommittedLine
                : row;

            const placeholderLine =
              typeof renderIngredient === 'function'
                ? renderIngredient({
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
                  })
                : null;

            if (!placeholderLine) return;

            const nextSibling = anchor.nextSibling;
            if (nextSibling) {
              parent.insertBefore(placeholderLine, nextSibling);
            } else {
              parent.appendChild(placeholderLine);
            }

            if (typeof placeholderLine.click === 'function') {
              placeholderLine.click();
            }

            const newRow = parent.querySelector('.ingredient-edit-row.editing');
            if (newRow) {
              const qtyInput = newRow.querySelector(
                '.ingredient-edit-input[data-field="qty"]'
              );
              if (qtyInput) {
                qtyInput.focus();
              }
            }
          },
        });
      }

      parent.replaceChild(row, div);

      const qtyInput = row.querySelector(
        '.ingredient-edit-input[data-field="qty"]'
      );
      if (qtyInput) {
        qtyInput.focus();
      }
    };

    div.addEventListener('click', onClick);
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
    // Handle pluralization of unit
    let unitText = line.unit || '';
    const numericVal = parseFloat(line.quantity);

    // U.S. cookbook style: abbreviations (tsp, tbsp, cup, oz, lb, etc.) never pluralize
    // Only pluralize if it's a long-form unit word (e.g., "teaspoon" → "teaspoons")
    if (unitText && numericVal && numericVal !== 1) {
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
      if (
        !abbrevUnits.includes(unitText.toLowerCase()) &&
        !unitText.endsWith('s')
      ) {
        unitText = unitText + 's';
      }
    }
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
  return div;
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

    cell.appendChild(input);

    return cell;
  };

  // Order must match UX doc:
  // qty | unit | name | var | prep | notes | opt | loc
  const labels = ['qty', 'unit', 'name', 'var', 'prep', 'notes', 'opt', 'loc'];

  labels.forEach((lab) => {
    row.appendChild(makeCell(lab));
  });

  return row;
}
