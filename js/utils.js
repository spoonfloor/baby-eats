// Utility functions

/**
 * Round a number to the nearest fraction denominator
 * @param {number} value
 * @param {number} denominator
 * @returns {number}
 */
function roundToFraction(value, denominator = 8) {
  return Math.round(value * denominator) / denominator;
}

/**
 * Convert a decimal to a fractional display string using Unicode glyphs
 * (e.g., 1.5 -> "1½", 0.25 -> "¼")
 * @param {number} value
 * @param {number} denominator
 * @returns {string}
 */
function decimalToFractionDisplay(value, denominator = 8) {
  const rounded = roundToFraction(value, denominator);
  const whole = Math.floor(rounded);
  const fraction = rounded - whole;
  const fractionMap = {
    1: '⅛',
    2: '¼',
    3: '⅜',
    4: '½',
    5: '⅝',
    6: '¾',
    7: '⅞',
  };
  const fracGlyph = fractionMap[Math.round(fraction * denominator)] || '';
  if (whole === 0 && fracGlyph) return fracGlyph;
  return fracGlyph ? `${whole}${fracGlyph}` : `${whole}`;
}

/**
 * Make a span element editable on click
 * Dynamically replaces it with an input, inheriting the font
 * @param {HTMLElement} span
 * @param {'qty'|'text'} type
 */

/**
 * Generic inline row editing helper (servings, ingredients, etc.).
 *
 * @param {{
 *   rowElement: HTMLElement;
 *   isEmpty: () => boolean;
 *   commit: () => void;
 *   cancel: () => void;
 *   getIsEditing: () => boolean;
 *   setIsEditing: (bool: boolean) => void;
 * }} options
 *
 * @returns {{
 *   enterEdit: () => void;
 *   exitEdit: (shouldCommit: boolean) => void;
 *   destroy: () => void;
 * } | null}
 */
function setupInlineRowEditing(options) {
  if (!options || typeof options !== 'object') return null;

  const {
    rowElement,
    isEmpty,
    commit,
    cancel,
    getIsEditing,
    setIsEditing,
    onEnterCommit,
  } = options;

  if (
    !rowElement ||
    typeof isEmpty !== 'function' ||
    typeof commit !== 'function' ||
    typeof cancel !== 'function' ||
    typeof getIsEditing !== 'function' ||
    typeof setIsEditing !== 'function'
  ) {
    return null;
  }

  // Single-active-row guard across the app.
  if (!window._inlineRowEditState) {
    window._inlineRowEditState = { activeRow: null };
  }
  const globalState = window._inlineRowEditState;

  const enterEdit = () => {
    if (getIsEditing()) return;
    if (globalState.activeRow && globalState.activeRow !== rowElement) {
      // v1: block second editor instead of auto-committing.
      return;
    }
    globalState.activeRow = rowElement;
    setIsEditing(true);
  };

  const exitEdit = (shouldCommit) => {
    if (!getIsEditing()) return;

    if (shouldCommit && !isEmpty()) {
      commit();
    } else {
      cancel();
    }

    setIsEditing(false);
    if (globalState.activeRow === rowElement) {
      globalState.activeRow = null;
    }
  };

  const handleClick = () => {
    if (!getIsEditing()) {
      enterEdit();
    }
  };

  const handleKeyDown = (e) => {
    if (!getIsEditing()) return;

    if (e.key === 'Enter') {
      e.preventDefault();

      const empty = isEmpty();
      if (!empty) {
        commit();
        if (typeof onEnterCommit === 'function') {
          onEnterCommit();
        }
      } else {
        cancel();
      }

      setIsEditing(false);
      if (globalState.activeRow === rowElement) {
        globalState.activeRow = null;
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      exitEdit(false);
    }
  };

  const handleFocusOut = (e) => {
    if (!getIsEditing()) return;

    const next = e.relatedTarget;
    if (rowElement.contains(next)) return;

    exitEdit(!isEmpty());
  };

  rowElement.addEventListener('click', handleClick);
  rowElement.addEventListener('keydown', handleKeyDown);
  rowElement.addEventListener('focusout', handleFocusOut);

  return {
    enterEdit,
    exitEdit,
    destroy() {
      rowElement.removeEventListener('click', handleClick);
      rowElement.removeEventListener('keydown', handleKeyDown);
      rowElement.removeEventListener('focusout', handleFocusOut);
      if (globalState.activeRow === rowElement) {
        globalState.activeRow = null;
      }
    },
  };
}

/**
 * Wire a label-like element so clicking it focuses/selects a target input.
 * Shared by servings + ingredient inline editors.
 * @param {HTMLElement} labelEl
 * @param {HTMLInputElement|HTMLTextAreaElement} inputEl
 */
function wireLabelToInput(labelEl, inputEl) {
  if (!labelEl || !inputEl) return;

  labelEl.addEventListener('mousedown', (e) => {
    // Keep focus inside the row so blur logic sees focus staying in the row.
    e.preventDefault();
    inputEl.focus();
    if (typeof inputEl.select === 'function') {
      inputEl.select();
    }
  });
}
