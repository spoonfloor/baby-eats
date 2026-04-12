document.addEventListener('DOMContentLoaded', async () => {
  const STORAGE_PREFIX = 'favoriteEatsProto.recipeServings.';
  const EPSILON = 1e-9;
  const titleEl = document.getElementById('protoRecipeTitle');
  const servingsRowEl = document.getElementById('protoRecipeServingsRow');
  const servingsEl = document.getElementById('protoRecipeServings');
  const servingsStepperEl = document.getElementById('protoRecipeServingsStepper');
  const ingredientsListEl = document.getElementById('protoRecipeIngredients');
  const instructionsSectionEl = document.getElementById('protoInstructionsSection');
  const instructionsListEl = document.getElementById('protoRecipeInstructions');
  const searchParams = new URLSearchParams(window.location.search);
  const recipeId = searchParams.get('id');
  let recipe = null;
  let currentServings = null;
  let servingsStepper = null;

  function toPositiveNumberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function toWholeNumberOrNull(value) {
    const number = toPositiveNumberOrNull(value);
    return number == null ? null : Math.round(number);
  }

  function clamp(value, min, max) {
    let next = value;
    if (min != null && next < min) next = min;
    if (max != null && next > max) next = max;
    return next;
  }

  function getSessionKey(id) {
    return `${STORAGE_PREFIX}${id}`;
  }

  function readStoredServings(id) {
    try {
      const raw = sessionStorage.getItem(getSessionKey(id));
      if (raw == null || raw === '') return null;
      const number = Number(raw);
      return Number.isFinite(number) ? Math.round(number) : null;
    } catch (err) {
      console.warn('Proto servings session read failed:', err);
      return null;
    }
  }

  function writeStoredServings(id, value) {
    try {
      sessionStorage.setItem(getSessionKey(id), String(value));
    } catch (err) {
      console.warn('Proto servings session write failed:', err);
    }
  }

  function formatQuantityNumber(value) {
    if (!Number.isFinite(value)) return '';
    if (Math.abs(value - Math.round(value)) < EPSILON) {
      return String(Math.round(value));
    }

    const rounded = Number(value.toFixed(3));
    return String(rounded)
      .replace(/\.0+$/, '')
      .replace(/(\.\d*?)0+$/, '$1');
  }

  function hasStructuredQuantity(ingredient) {
    return (
      toPositiveNumberOrNull(ingredient?.quantityMin) != null ||
      toPositiveNumberOrNull(ingredient?.quantityMax) != null
    );
  }

  function buildScaledQuantityText(ingredient, multiplier) {
    let quantityMin = toPositiveNumberOrNull(ingredient.quantityMin);
    let quantityMax = toPositiveNumberOrNull(ingredient.quantityMax);

    if (quantityMin == null && quantityMax == null) return '';
    if (quantityMin == null) quantityMin = quantityMax;
    if (quantityMax == null) quantityMax = quantityMin;

    const scaledMin = quantityMin * multiplier;
    const scaledMax = quantityMax * multiplier;
    let quantityText =
      Math.abs(scaledMin - scaledMax) < EPSILON
        ? formatQuantityNumber(scaledMin)
        : `${formatQuantityNumber(scaledMin)} to ${formatQuantityNumber(scaledMax)}`;

    if (ingredient.quantityIsApprox && quantityText) {
      quantityText = `about ${quantityText}`;
    }

    return quantityText;
  }

  function renderIngredientLines(lines) {
    ingredientsListEl.innerHTML = '';
    lines.forEach((line) => {
      const item = document.createElement('p');
      item.className = 'proto-detail-line';
      item.textContent = line;
      ingredientsListEl.appendChild(item);
    });
  }

  function normalizeInstructionRow(line) {
    if (line && typeof line === 'object') {
      const text = String(line.text != null ? line.text : line.instructions || '').trim();
      if (!text) return null;
      return {
        text,
        type: String(line.type || '').trim() === 'heading' ? 'heading' : 'step',
      };
    }

    const text = String(line || '').trim();
    if (!text) return null;
    return { text, type: 'step' };
  }

  function appendInstructionNodes(container, line) {
    const text = String(line || '');
    const tokenPattern = /\[\[recipe:(\d+)\|([^\]]+)\]\]/g;
    let cursor = 0;
    let match = tokenPattern.exec(text);

    while (match) {
      const matchStart = match.index;
      const matchEnd = tokenPattern.lastIndex;

      if (matchStart > cursor) {
        container.appendChild(
          document.createTextNode(text.slice(cursor, matchStart))
        );
      }

      const recipeId = Number(match[1]);
      const recipeLabel = String(match[2] || '').trim();
      if (Number.isFinite(recipeId) && recipeId > 0 && recipeLabel) {
        const link = document.createElement('a');
        link.className = 'proto-inline-recipe-link';
        link.href = `recipe.html?id=${encodeURIComponent(recipeId)}`;
        link.textContent = recipeLabel;
        container.appendChild(link);
      } else {
        container.appendChild(document.createTextNode(match[0]));
      }

      cursor = matchEnd;
      match = tokenPattern.exec(text);
    }

    if (cursor < text.length) {
      container.appendChild(document.createTextNode(text.slice(cursor)));
    }
  }

  function renderIngredients(ingredients, selectedServings, defaultServings) {
    if (!Array.isArray(ingredients) || !ingredients.length) {
      renderIngredientLines(['No ingredients found.']);
      return;
    }

    const baseServings = toPositiveNumberOrNull(defaultServings);
    const multiplier =
      baseServings != null && selectedServings != null
        ? selectedServings / baseServings
        : null;
    const shouldScaleStructuredQuantities =
      multiplier != null && Math.abs(multiplier - 1) > EPSILON;

    const lines = ingredients
      .map((ingredient) => {
        if (
          shouldScaleStructuredQuantities &&
          hasStructuredQuantity(ingredient) &&
          typeof window.protoDb?.buildIngredientLine === 'function'
        ) {
          return window.protoDb.buildIngredientLine({
            ...ingredient,
            quantityDisplay: buildScaledQuantityText(ingredient, multiplier),
          });
        }

        if (ingredient.displayText) return ingredient.displayText;
        if (typeof window.protoDb?.buildIngredientLine === 'function') {
          return window.protoDb.buildIngredientLine(ingredient);
        }
        return '';
      })
      .filter(Boolean);

    renderIngredientLines(lines.length ? lines : ['No ingredients found.']);
  }

  function renderInstructions(lines) {
    instructionsListEl.innerHTML = '';
    let displayIndex = 0;

    lines
      .map((line) => normalizeInstructionRow(line))
      .filter(Boolean)
      .forEach((line) => {
        const item = document.createElement('div');
        item.className = 'proto-instruction-step';
        if (line.type === 'heading') {
          item.classList.add('proto-instruction-step--heading');
          displayIndex = 0;
        }

        const text = document.createElement('p');
        text.className = 'proto-instruction-step-text';
        if (line.type === 'heading') {
          text.classList.add('proto-instruction-step-text--heading');
        } else {
          const number = document.createElement('span');
          number.className = 'proto-instruction-step-number';
          displayIndex += 1;
          number.textContent = `${displayIndex}.`;
          item.appendChild(number);
        }
        appendInstructionNodes(text, line.text);

        item.appendChild(text);
        instructionsListEl.appendChild(item);
      });
  }

  function getServingsConfig(nextRecipe) {
    const defaultServings = toWholeNumberOrNull(nextRecipe?.servingsDefault);
    let minServings = toWholeNumberOrNull(nextRecipe?.servingsMin);
    let maxServings = toWholeNumberOrNull(nextRecipe?.servingsMax);

    if (minServings != null && maxServings != null && minServings > maxServings) {
      const temp = minServings;
      minServings = maxServings;
      maxServings = temp;
    }

    return {
      defaultServings,
      minServings,
      maxServings,
      showPicker:
        defaultServings != null && minServings != null && maxServings != null,
    };
  }

  function renderServings(nextRecipe, selectedServings) {
    const { defaultServings, showPicker } = getServingsConfig(nextRecipe);
    const visibleServings = selectedServings ?? defaultServings;
    const hasVisibleServings = visibleServings != null;

    servingsRowEl.hidden = !hasVisibleServings;
    servingsEl.textContent = hasVisibleServings ? `Serves ${visibleServings}` : '';
    servingsStepperEl.hidden = !showPicker;
    if (showPicker && servingsStepper && hasVisibleServings) {
      servingsStepper.setValue(visibleServings);
    }
  }

  function renderRecipe() {
    const { defaultServings } = getServingsConfig(recipe);
    renderServings(recipe, currentServings);
    renderIngredients(recipe.ingredients, currentServings, defaultServings);
  }

  const result = await window.protoDb.loadRecipeDetail(recipeId);
  if (!result.ok || !result.recipe) {
    titleEl.textContent = 'Recipe';
    servingsRowEl.hidden = true;
    renderIngredientLines(['Could not load this recipe yet.']);
    instructionsSectionEl.hidden = true;
    return;
  }

  recipe = result.recipe;
  titleEl.textContent = recipe.title;
  document.title = `Favorite Eats Proto - ${recipe.title}`;

  const { defaultServings, minServings, maxServings, showPicker } =
    getServingsConfig(recipe);
  const storedServings = showPicker ? readStoredServings(recipe.id) : null;

  if (showPicker) {
    currentServings = clamp(
      storedServings ?? defaultServings,
      minServings,
      maxServings
    );
    writeStoredServings(recipe.id, currentServings);
    servingsStepper = window.protoStepper.bind(servingsStepperEl, {
      min: minServings,
      max: maxServings,
      value: currentServings,
      onChange(nextValue) {
        currentServings = nextValue;
        writeStoredServings(recipe.id, currentServings);
        renderRecipe();
      },
    });
  } else {
    currentServings = defaultServings;
  }

  renderRecipe();

  if (recipe.instructions.length) {
    renderInstructions(recipe.instructions);
    instructionsSectionEl.hidden = false;
  } else {
    instructionsSectionEl.hidden = true;
  }

  if (!showPicker) return;
});
