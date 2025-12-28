// --- Step numbering helpers ---
function renumberSteps(containerEl) {
  const container = containerEl || document.getElementById('stepsSection');
  if (!container) return;

  const all = container.querySelectorAll('.instruction-line.numbered') || [];
  let displayIndex = 0;

  all.forEach((line) => {
    const num = line.querySelector('.step-num');
    if (!num) return;

    const type = line.dataset.stepType || 'step';

    if (type === 'heading') {
      // Headings: unnumbered and start a new numbering group.
      num.textContent = '';
      displayIndex = 0;
      return;
    }

    displayIndex += 1;
    num.textContent = `${displayIndex}.`;
  });
}

// --- Step model helpers ---
function findStepInModel(stepId) {
  const recipeModel = window.recipeData;
  if (!recipeModel || !Array.isArray(recipeModel.sections)) return null;

  const idStr = String(stepId);

  for (const sec of recipeModel.sections) {
    const stepsArr = sec.steps || [];
    const idx = stepsArr.findIndex((st) => String(st.ID ?? st.id) === idStr);
    if (idx !== -1) {
      return { section: sec, stepsArr, idx, step: stepsArr[idx] };
    }
  }

  return null;
}

// Keep the StepNode model in sync with inline text edits.
// Phase 1: this simply mirrors edits; legacy section/step model is still updated too.
function applyEditToStepNode(stepId, normalizedVal, { deleteIfEmpty } = {}) {
  const nodes = Array.isArray(window.stepNodes) ? window.stepNodes : null;
  if (!nodes) return;

  const idStr = String(stepId);
  const idx = nodes.findIndex((n) => String(n.id) === idStr);
  if (idx === -1) return;

  const shouldDelete = deleteIfEmpty !== false && normalizedVal === '';

  if (shouldDelete) {
    nodes.splice(idx, 1);
  } else {
    nodes[idx].text = normalizedVal;
  }
}

function syncStepOrderFromDOM(containerRef) {
  if (!containerRef) return;

  const recipeModel = window.recipeData;
  if (!recipeModel || !Array.isArray(recipeModel.sections)) return;

  // Optional StepNode model (Phase 1: keep it in sync with DOM order)
  const stepNodes = Array.isArray(window.stepNodes) ? window.stepNodes : null;
  const stepNodeModelRef =
    window.StepNodeModel && typeof window.StepNodeModel === 'object'
      ? window.StepNodeModel
      : null;

  const orderedStepTexts = Array.from(
    containerRef.querySelectorAll('.instruction-line.numbered .step-text')
  );

  const counters = new Map();

  orderedStepTexts.forEach((stepTextEl) => {
    const sectionId = stepTextEl.dataset.sectionId || '';
    const current = counters.get(sectionId) || 0;
    const newOrder = current + 1;
    counters.set(sectionId, newOrder);

    const stepId = stepTextEl.dataset.stepId;
    if (!stepId) return;

    const found = findStepInModel(stepId);
    if (found && found.step) {
      found.step.step_number = newOrder;
    }

    // Phase 1 — mirror reordering into the StepNode model (if present).
    if (stepNodes) {
      const idStr = String(stepId);
      const nodeIdx = stepNodes.findIndex((n) => String(n.id) === idStr);
      if (nodeIdx !== -1) {
        stepNodes[nodeIdx].order = newOrder;
      }
    }

    // Keep StepNode list in a stable, normalized order
    if (
      stepNodes &&
      stepNodeModelRef &&
      typeof stepNodeModelRef.normalizeStepNodeOrder === 'function'
    ) {
      window.stepNodes = stepNodeModelRef.normalizeStepNodeOrder(stepNodes);
    }
  });
}

// --- Shared helpers for step editing (normalization + new step factory) ---

function ensureStepTextNotEmpty(el) {
  if (!el) return;

  // For placeholder prompts, keep the element truly empty so the CSS
  // ::before content can act like a real placeholder.
  if (el.classList && el.classList.contains('placeholder-prompt')) {
    return;
  }

  const text = (el.textContent || '').trim();
  const html = (el.innerHTML || '').trim();
  if (!text && html === '') {
    el.innerHTML = '<br>';
  }
}

function normalizeStepText(raw) {
  if (raw == null) return '';

  let newVal = String(raw);

  // collapse internal whitespace
  newVal = newVal.replace(/\s+/g, ' ');

  // trim ends
  newVal = newVal.trim();

  // Cleanup punctuation spacing
  newVal = newVal.replace(/\s+([.,!?:;])/g, '$1');
  newVal = newVal.replace(/([.,!?:;])\s+/g, '$1 ');
  newVal = newVal.trim();

  // Stray punctuation only → treat as empty
  if (/^[.,!?:;]+$/.test(newVal)) {
    return '';
  }

  return newVal;
}

let _tempStepCounter = 0;
function createSiblingStepFromExisting(sourceStep, instructions) {
  const base = sourceStep || {};
  const tempId = `tmp-step-${Date.now()}-${_tempStepCounter++}`;

  // Preserve all existing DB metadata (section id, recipe id, ordering fields, etc.)
  // but force a fresh ID so the bridge treats this as a new row.
  return {
    ...base,
    ID: null, // ensure bridge sees this as "new step", not an update
    id: tempId, // local temp id used only for DOM/model wiring
    instructions: instructions || '',
    step_number: (base.step_number ?? 0) + 1,
  };
}

// --- Inline step editing (contentEditable) ---

function attachStepInlineEditor(textEl) {
  if (!textEl) return;

  textEl.addEventListener('click', () => {
    if (window.editingStepId) return; // one at a time
    window.editingStepId = textEl.dataset.stepId;

    window._dirtyBeforeThisEdit =
      typeof isDirty !== 'undefined' && isDirty === true;

    const lineEl = textEl.closest('.instruction-line');
    if (!lineEl) return;

    if (typeof setActiveStep === 'function') {
      setActiveStep(lineEl);
    }

    // Visual editing state
    lineEl.classList.add('editing');
    try {
      document.body.classList.add('step-editing');
    } catch (_) {}

    const original = textEl.textContent || '';

    const placeholderText =
      (textEl.dataset && textEl.dataset.placeholder) || 'Add a step.';
    const startedFromPlaceholder =
      textEl.classList.contains('placeholder-prompt') &&
      !normalizeStepText(original);
    let placeholderActive = startedFromPlaceholder;

    // If this is the "Add a step." placeholder, treat it like an empty field
    // so clicking anywhere puts the caret at position 0 for easy typing.
    const isPlaceholder =
      textEl.classList.contains('placeholder-prompt') &&
      (original || '').trim() === 'Add a step.';

    if (isPlaceholder) {
      textEl.classList.remove('placeholder-prompt');
      textEl.textContent = '';
      ensureStepTextNotEmpty(textEl);
    }

    textEl.contentEditable = 'true';
    textEl.focus();

    if (startedFromPlaceholder) {
      try {
        const sel = window.getSelection();
        const range = document.createRange();

        // Keep DOM empty; visual prompt comes from CSS ::before.
        textEl.innerHTML = '';
        const textNode = document.createTextNode('');
        textEl.appendChild(textNode);

        range.setStart(textNode, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (err) {
        // Best-effort; safe to ignore.
      }
    }

    window._activeStepInput = textEl;
    window._hasPendingEdit = false;

    const commitWithValue = (normalizedVal, { deleteIfEmpty } = {}) => {
      const shouldDelete = deleteIfEmpty !== false && normalizedVal === '';
      const isHeadingLine =
        (lineEl && lineEl.dataset && lineEl.dataset.stepType === 'heading') ||
        (textEl &&
          textEl.closest &&
          textEl.closest('.instruction-line')?.dataset?.stepType === 'heading');

      // Phase 1: mirror update into StepNode model (if present).
      if (typeof applyEditToStepNode === 'function' && window.editingStepId) {
        applyEditToStepNode(window.editingStepId, normalizedVal, {
          deleteIfEmpty,
        });
      }

      // Update the legacy recipe model
      const found = findStepInModel(window.editingStepId);

      if (found) {
        const { stepsArr, idx } = found;

        // 🛑 Never allow zero steps in the model — last step becomes blank instead.
        let effectiveDelete = shouldDelete;
        if (shouldDelete) {
          const parent = lineEl.parentElement;
          const allLines =
            parent?.querySelectorAll('.instruction-line.numbered') || [];
          if (allLines.length === 1) {
            effectiveDelete = false;
          }
        }

        if (effectiveDelete) {
          stepsArr.splice(idx, 1);
        } else {
          stepsArr[idx].instructions = normalizedVal;
        }
      }

      // Delete step from DOM
      if (shouldDelete) {
        const parent = lineEl.parentElement;
        if (parent) {
          // We may have "insert rails" (step-insert-zone) interleaved between lines.
          // If we delete a line but leave both adjacent rails, they become back-to-back
          // and create a large vertical gap. Collapse to a single rail.
          const prevSibling = lineEl.previousSibling;
          const nextSibling = lineEl.nextSibling;

          const allLines =
            parent.querySelectorAll('.instruction-line.numbered') || [];
          const isLastLine = allLines.length === 1;

          if (isLastLine) {
            // Keep last line as a real blank step / placeholder.
            textEl.textContent = '';

            textEl.classList.add('placeholder-prompt');
            if (textEl.dataset && !textEl.dataset.placeholder) {
              textEl.dataset.placeholder = 'Add a step.';
            }
            // Ensure placeholder row styling (hide number + left-align prompt).
            try {
              if (!isHeadingLine) {
                lineEl.classList.add('instruction-line--placeholder');
              }
            } catch (_) {}

            ensureStepTextNotEmpty(textEl);
          } else {
            parent.removeChild(lineEl);

            try {
              const isZone = (el) =>
                el &&
                el.classList &&
                el.classList.contains('step-insert-zone');
              if (isZone(prevSibling) && isZone(nextSibling)) {
                // Remove the "after" zone; keep the "before" zone.
                parent.removeChild(nextSibling);
              }

              // If the remaining zone was previously adjacent to a heading, it may still
              // be flagged disabled. Recompute its enabled/disabled state based on the
              // new neighbors so ctrl-click works again at the same spot.
              const keptZone = isZone(prevSibling)
                ? prevSibling
                : isZone(nextSibling)
                ? nextSibling
                : null;
              if (keptZone) {
                const prevLine =
                  keptZone.previousElementSibling &&
                  keptZone.previousElementSibling.classList &&
                  keptZone.previousElementSibling.classList.contains(
                    'instruction-line'
                  )
                    ? keptZone.previousElementSibling
                    : null;
                const nextLine =
                  keptZone.nextElementSibling &&
                  keptZone.nextElementSibling.classList &&
                  keptZone.nextElementSibling.classList.contains(
                    'instruction-line'
                  )
                    ? keptZone.nextElementSibling
                    : null;
                const prevIsHeading =
                  !!(prevLine && prevLine.dataset && prevLine.dataset.stepType === 'heading');
                const nextIsHeading =
                  !!(nextLine && nextLine.dataset && nextLine.dataset.stepType === 'heading');
                keptZone.classList.toggle(
                  'step-insert-zone--disabled',
                  prevIsHeading || nextIsHeading
                );
              }
            } catch (_) {}
          }
        }

        renumberSteps(document.getElementById('stepsSection'));
      } else {
        textEl.textContent = normalizedVal;

        ensureStepTextNotEmpty(textEl);
      }

      // Placeholder row bookkeeping:
      // - If the user committed real text, this is no longer the empty-state placeholder.
      // - If the field is empty AND showing the placeholder prompt, keep it marked as placeholder.
      try {
        const isStepPlaceholder =
          !isHeadingLine &&
          textEl &&
          textEl.classList &&
          textEl.classList.contains('placeholder-prompt') &&
          textEl.dataset &&
          String(textEl.dataset.placeholder || '').trim() === 'Add a step.';

        if (!isHeadingLine && normalizedVal !== '') {
          lineEl.classList.remove('instruction-line--placeholder');
        } else if (isStepPlaceholder && normalizedVal === '') {
          lineEl.classList.add('instruction-line--placeholder');
        } else if (!isHeadingLine && normalizedVal === '') {
          // Don't accidentally keep hiding numbers for genuinely-empty non-placeholder steps.
          lineEl.classList.remove('instruction-line--placeholder');
        }
      } catch (_) {}

      textEl.contentEditable = 'false';

      window.editingStepId = null;
      window._activeStepInput = null;
      window._hasPendingEdit = false;

      lineEl.classList.remove('editing');
      try {
        document.body.classList.remove('step-editing');
      } catch (_) {}

      textEl.removeEventListener('keydown', onKeyDown);
      textEl.removeEventListener('blur', onBlur);
      textEl.removeEventListener('input', onInput);

      if (typeof markDirty === 'function') {
        markDirty();
      }
    };

    const commit = () => {
      if (window._suppressStepCommit) {
        window._suppressStepCommit = false;
        return;
      }

      const raw = textEl.textContent || '';
      const newVal = normalizeStepText(raw);

      if (startedFromPlaceholder && !newVal) {
        placeholderActive = true;
      }

      const effectiveVal =
        startedFromPlaceholder && placeholderActive ? '' : newVal;

      // Steps: blanks are “real” steps (never auto-delete).
      // Headings: blanks should disappear on blur/Enter so placeholder text never persists.
      const isHeadingLine =
        (lineEl && lineEl.dataset && lineEl.dataset.stepType === 'heading') ||
        (textEl &&
          textEl.closest &&
          textEl.closest('.instruction-line')?.dataset?.stepType === 'heading');

      commitWithValue(effectiveVal, { deleteIfEmpty: !!isHeadingLine });
    };

    const handleEnterSplit = () => {
      const fullText = textEl.textContent || '';

      // Compute selection offsets within this step
      const selInfo = getSelectionOffsetsInStep(textEl);
      let start = fullText.length;
      let end = fullText.length;

      if (selInfo) {
        start = selInfo.start;
        end = selInfo.end;
      }

      if (start < 0) start = 0;
      if (end < 0) end = 0;
      if (start > fullText.length) start = fullText.length;
      if (end > fullText.length) end = fullText.length;

      // Split into left / right halves
      const leftRaw = fullText.slice(0, start);
      const rightRaw = fullText.slice(end);

      const leftVal = normalizeStepText(leftRaw);
      const rightVal = normalizeStepText(rightRaw);

      // Lookup current step in model BEFORE committing, since commitWithValue
      // clears editingStepId.
      const found = findStepInModel(window.editingStepId);
      if (!found) {
        // Fallback: just commit as a normal edit
        commit();
        return;
      }

      const { stepsArr, idx, step } = found;

      // 1) Commit the left half to the existing step, but NEVER delete it here
      commitWithValue(leftVal, { deleteIfEmpty: false });

      // 2) Create a new step for the right half (may be empty to allow blank line)
      const newStep = createSiblingStepFromExisting(step, rightVal);
      stepsArr.splice(idx + 1, 0, newStep);

      // Phase 1 — mirror the split into the StepNode model (if present).
      if (Array.isArray(window.stepNodes)) {
        const nodes = window.stepNodes;
        const parentIdStr = String(step.id ?? step.ID);
        const parentIdx = nodes.findIndex((n) => String(n.id) === parentIdStr);

        if (parentIdx !== -1) {
          const baseNode = nodes[parentIdx];

          const baseOrder =
            typeof baseNode.order === 'number' && !Number.isNaN(baseNode.order)
              ? baseNode.order
              : parentIdx + 1;

          const nextNode = nodes[parentIdx + 1] || null;
          let newOrder = baseOrder + 1;

          if (
            nextNode &&
            typeof nextNode.order === 'number' &&
            !Number.isNaN(nextNode.order) &&
            nextNode.order > baseOrder
          ) {
            newOrder = (baseOrder + nextNode.order) / 2;
          }

          const stepNodeModelRef =
            window.StepNodeModel && typeof window.StepNodeModel === 'object'
              ? window.StepNodeModel
              : null;
          const stepNodeTypeRef =
            window.StepNodeType && typeof window.StepNodeType === 'object'
              ? window.StepNodeType
              : null;

          const nodePayload = {
            id: newStep.id ?? newStep.ID,
            type:
              baseNode.type ||
              (stepNodeTypeRef && stepNodeTypeRef.STEP) ||
              'step',
            text: newStep.instructions ?? '',
            order: newOrder,
          };

          const newNode =
            stepNodeModelRef &&
            typeof stepNodeModelRef.createStepNode === 'function'
              ? stepNodeModelRef.createStepNode(nodePayload)
              : nodePayload;

          nodes.splice(parentIdx + 1, 0, newNode);

          if (
            stepNodeModelRef &&
            typeof stepNodeModelRef.normalizeStepNodeOrder === 'function'
          ) {
            window.stepNodes = stepNodeModelRef.normalizeStepNodeOrder(nodes);
          }
        }
      }

      // 🧾 Remember enough to "heal" this split if user presses ESC
      window._lastStepSplitContext = {
        parentStepId: String(step.id ?? step.ID),
        newStepId: String(newStep.id ?? newStep.ID),
        originalText: fullText,
        dirtyBefore: !!window._dirtyBeforeThisEdit,
      };

      // 3) Insert new DOM line below current one

      const parent = lineEl.parentElement;
      let newTextEl = null;

      if (parent) {
        const newLine = document.createElement('div');
        newLine.className = 'instruction-line numbered';

        // Inherit section id from the current line/text so numbering stays within section
        const sectionId =
          lineEl.dataset.sectionId || textEl.dataset.sectionId || '';
        if (sectionId) {
          newLine.dataset.sectionId = sectionId;
        }

        const numSpan = document.createElement('span');
        numSpan.className = 'step-num';
        numSpan.textContent = ''; // will be filled by renumber

        const textSpan = document.createElement('span');
        textSpan.className = 'step-text';
        textSpan.dataset.stepId = String(newStep.id ?? newStep.ID);
        textSpan.textContent = newStep.instructions ?? '';

        ensureStepTextNotEmpty(textSpan);

        if (sectionId) {
          textSpan.dataset.sectionId = sectionId;
        }

        newLine.appendChild(numSpan);
        newLine.appendChild(textSpan);

        if (lineEl.nextSibling) {
          parent.insertBefore(newLine, lineEl.nextSibling);
        } else {
          parent.appendChild(newLine);
        }

        // Wire up inline editor on the new text span
        attachStepInlineEditor(textSpan);
        newTextEl = textSpan;
      }

      // 4) Renumber + sync order in the model
      const stepsContainer = document.getElementById('stepsSection');
      renumberSteps(stepsContainer);
      if (stepsContainer) syncStepOrderFromDOM(stepsContainer);

      if (typeof markDirty === 'function') {
        markDirty();
      }

      // 5) Move focus into the new step (Google Docs–style behavior)
      if (newTextEl) {
        newTextEl.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
          })
        );
      }
    };

    const handleBackspaceMerge = () => {
      console.log('[BKS] entered handleBackspaceMerge');

      // Only merge if there *is* a previous instruction-line
      const prevLine = lineEl.previousElementSibling;
      if (!prevLine || !prevLine.classList.contains('instruction-line')) {
        console.log('[BKS] early return: no previous instruction-line');

        return; // nothing to merge with (top of list)
      }

      const prevTextEl = prevLine.querySelector('.step-text');
      if (!prevTextEl) {
        console.log('[BKS] early return: no prevTextEl');
        return;
      }

      const currentStepId = textEl.dataset.stepId || window.editingStepId;
      if (!currentStepId) {
        console.log('[BKS] early return: no currentStepId', {
          editingStepId: window.editingStepId,
          domStepId: textEl && textEl.dataset && textEl.dataset.stepId,
        });
        return;
      }

      const prevStepId = prevTextEl.dataset.stepId;
      if (!prevStepId) {
        console.log('[BKS] early return: no prevStepId');
        return;
      }

      const currentFound = findStepInModel(currentStepId);
      if (!currentFound) {
        console.log('[BKS] early return: findStepInModel failed', {
          currentStepId,
        });
        return;
      }

      const prevFound = findStepInModel(prevStepId);
      if (!prevFound) {
        console.log('[BKS] early return: findStepInModel failed for prev', {
          prevStepId,
        });
        return;
      }

      const thisStep = currentFound.step;
      const prevStep = prevFound.step;

      const prevStepsArr = prevFound.stepsArr;
      if (!Array.isArray(prevStepsArr) || prevFound.idx < 0) {
        console.log('[BKS] early return: invalid prev stepsArr/idx', {
          hasArray: Array.isArray(prevStepsArr),
          idx: prevFound.idx,
          length: Array.isArray(prevStepsArr) ? prevStepsArr.length : null,
          prevStepId,
        });
        return;
      }

      // Use live DOM text for the current step so we don't lose
      // newly typed content that hasn't been synced into the model yet.
      const prevText = prevStep.instructions || '';
      const thisText = textEl.textContent || '';

      // Merge with spacing + normalization
      const merged = normalizeStepText(
        prevText && thisText
          ? `${prevText} ${thisText}`
          : `${prevText}${thisText}`
      );

      // Find where second-step text begins, so caret lands intuitively
      const thisNorm = normalizeStepText(thisText);

      let caretOffsetInMerged = merged.length;
      if (thisNorm) {
        const idxNorm = merged.lastIndexOf(thisNorm);
        if (idxNorm >= 0) caretOffsetInMerged = idxNorm;
      }

      // 🔁 Model: keep *current* step, delete previous step.
      thisStep.instructions = merged;

      prevStepsArr.splice(prevFound.idx, 1);

      // Phase 1 — mirror this merge into the StepNode model (if present).
      if (Array.isArray(window.stepNodes)) {
        const nodes = window.stepNodes;
        const prevIdStr = String(prevStep.id ?? prevStep.ID);
        const thisIdStr = String(thisStep.id ?? thisStep.ID);

        const prevNodeIdx = nodes.findIndex((n) => String(n.id) === prevIdStr);
        const thisNodeIdx = nodes.findIndex((n) => String(n.id) === thisIdStr);

        // Update the surviving node's text to the merged value
        if (thisNodeIdx !== -1) {
          nodes[thisNodeIdx].text = merged;
        }

        // Drop the previous node from the StepNode list
        if (prevNodeIdx !== -1) {
          nodes.splice(prevNodeIdx, 1);
        }

        const stepNodeModelRef =
          window.StepNodeModel && typeof window.StepNodeModel === 'object'
            ? window.StepNodeModel
            : null;

        if (
          stepNodeModelRef &&
          typeof stepNodeModelRef.normalizeStepNodeOrder === 'function'
        ) {
          window.stepNodes = stepNodeModelRef.normalizeStepNodeOrder(nodes);
        }
      }

      // 🧱 DOM: move current line into previous line’s position,
      // update its text, remove the old previous line.
      const parent = lineEl.parentElement;

      if (parent && parent.contains(lineEl) && parent.contains(prevLine)) {
        parent.insertBefore(lineEl, prevLine);
        parent.removeChild(prevLine);
      }

      textEl.textContent = merged;

      // Renumber + sync
      const stepsContainer = document.getElementById('stepsSection');
      renumberSteps(stepsContainer);
      if (stepsContainer) syncStepOrderFromDOM(stepsContainer);

      if (typeof markDirty === 'function') {
        markDirty();
      }

      // 🎯 Keep caret inside the same inline editor,
      // at the exact intuitive offset inside merged text.

      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel) return;

        const fullText = textEl.textContent || '';
        let targetOffset = caretOffsetInMerged;
        if (targetOffset < 0) targetOffset = 0;
        if (targetOffset > fullText.length) targetOffset = fullText.length;

        let remaining = targetOffset;
        const range = document.createRange();
        const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);

        let node = walker.nextNode();
        while (node) {
          const len = node.textContent.length;
          if (remaining <= len) {
            range.setStart(node, remaining);
            break;
          }
          remaining -= len;
          node = walker.nextNode();
        }

        if (!node) {
          range.selectNodeContents(textEl);
          range.collapse(false);
        }

        sel.removeAllRanges();
        sel.addRange(range);
      }, 0);
    };

    const cancel = () => {
      window._suppressStepCommit = true;

      // This inline edit is the ONLY dirty thing if:
      //   - This edit actually changed text (_hasPendingEdit)
      //   - There were NO dirty edits before this edit session began
      const onlyThisEditIsDirty =
        window._hasPendingEdit === true &&
        window._dirtyBeforeThisEdit === false;

      // 🔁 Check if this step is the "child" created by an Enter split.
      const splitCtx = window._lastStepSplitContext || null;
      const isSplitChild =
        splitCtx && String(window.editingStepId || '') === splitCtx.newStepId;

      if (isSplitChild) {
        // --- Model: restore original text on parent  remove child step ---
        const parentFound = findStepInModel(splitCtx.parentStepId);
        const childFound = findStepInModel(splitCtx.newStepId);

        if (parentFound) {
          parentFound.step.instructions = splitCtx.originalText;
        }

        if (childFound) {
          childFound.stepsArr.splice(childFound.idx, 1);
        }

        // Keep StepNode model in sync with this ESC-based split undo.
        if (Array.isArray(window.stepNodes)) {
          const nodes = window.stepNodes;
          const parentIdStr = String(splitCtx.parentStepId || '');
          const childIdStr = String(splitCtx.newStepId || '');

          const parentIdx = nodes.findIndex(
            (n) => String(n.id) === parentIdStr
          );
          const childIdx = nodes.findIndex((n) => String(n.id) === childIdStr);

          if (parentIdx !== -1) {
            nodes[parentIdx].text = splitCtx.originalText || '';
          }
          if (childIdx !== -1) {
            nodes.splice(childIdx, 1);
          }
        }

        // --- DOM: restore parent text, remove this (child) line ---

        const stepsContainer = document.getElementById('stepsSection');

        if (stepsContainer) {
          const parentTextEl = stepsContainer.querySelector(
            `.instruction-line .step-text[data-step-id="${splitCtx.parentStepId}"]`
          );
          if (parentTextEl) {
            parentTextEl.textContent = splitCtx.originalText;
          }

          const parent = lineEl.parentElement;
          if (parent && parent.contains(lineEl)) {
            parent.removeChild(lineEl);
          }

          renumberSteps(stepsContainer);
          syncStepOrderFromDOM(stepsContainer);
        }

        // --- Clear editing state ---
        window.editingStepId = null;
        window._activeStepInput = null;
        window._hasPendingEdit = false;

        lineEl.classList.remove('editing');

        textEl.removeEventListener('keydown', onKeyDown);
        textEl.removeEventListener('blur', onBlur);
        textEl.removeEventListener('input', onInput);

        // If this split was the only thing making things dirty, we can revert
        if (
          splitCtx.dirtyBefore === false &&
          typeof revertChanges === 'function'
        ) {
          revertChanges();
        }

        window._dirtyBeforeThisEdit = false;
        window._lastStepSplitContext = null;

        return;
      }

      // 🧹 NEW: If this was a newly-created step AND it's empty,
      // cancel should *delete the step*, not restore ''.
      const isNewStep = String(window.editingStepId || '').startsWith(
        'tmp-step-'
      );
      const isEmptyNow = !normalizeStepText(textEl.textContent || '');
      const wasOriginallyEmpty = !normalizeStepText(original || '');

      if (isNewStep && isEmptyNow && wasOriginallyEmpty) {
        const parent = lineEl.parentElement;
        if (parent) parent.removeChild(lineEl);

        // Remove from model as well
        const found = findStepInModel(window.editingStepId);
        if (found) {
          found.stepsArr.splice(found.idx, 1);
        }

        // Renumber if needed
        renumberSteps(document.getElementById('stepsSection'));

        window.editingStepId = null;
        window._activeStepInput = null;
        window._hasPendingEdit = false;

        // If this was the only thing making the editor dirty → full revert
        if (onlyThisEditIsDirty && typeof revertChanges === 'function') {
          revertChanges();
        }
        window._dirtyBeforeThisEdit = false;
        return;
      }

      // Default cancel behavior (no split-heal, no new-empty-step case)

      textEl.textContent = original;

      if (startedFromPlaceholder && !normalizeStepText(original)) {
        textEl.classList.add('placeholder-prompt');
        if (textEl.dataset && !textEl.dataset.placeholder) {
          textEl.dataset.placeholder = placeholderText;
        }
        placeholderActive = true;
        try {
          if (
            lineEl &&
            lineEl.classList &&
            String(placeholderText || '').trim() === 'Add a step.' &&
            lineEl.dataset &&
            lineEl.dataset.stepType !== 'heading'
          ) {
            lineEl.classList.add('instruction-line--placeholder');
          }
        } catch (_) {}
      }

      // Restore placeholder styling if we reverted back to the prompt text.
      if ((original || '').trim() === 'Add a step.') {
        textEl.classList.add('placeholder-prompt');
        try {
          if (
            lineEl &&
            lineEl.classList &&
            lineEl.dataset &&
            lineEl.dataset.stepType !== 'heading'
          ) {
            lineEl.classList.add('instruction-line--placeholder');
          }
        } catch (_) {}
      }

      textEl.contentEditable = 'false';

      window.editingStepId = null;
      window._activeStepInput = null;
      window._hasPendingEdit = false;

      lineEl.classList.remove('editing');

      textEl.removeEventListener('keydown', onKeyDown);
      textEl.removeEventListener('blur', onBlur);
      textEl.removeEventListener('input', onInput);

      if (onlyThisEditIsDirty && typeof revertChanges === 'function') {
        revertChanges();
      }
      window._dirtyBeforeThisEdit = false;
    };

    const onKeyDown = (e) => {
      // Safari-style placeholder behavior for the "Add a step." row.
      const isPlaceholderMode =
        startedFromPlaceholder ||
        (textEl.classList.contains('placeholder-prompt') &&
          !normalizeStepText(textEl.textContent || ''));

      if (isPlaceholderMode) {
        const isPrintable =
          e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey;

        if (placeholderActive && isPrintable) {
          // First character: clear placeholder, insert typed char.
          e.preventDefault();

          textEl.classList.remove('placeholder-prompt');
          placeholderActive = false;

          textEl.innerHTML = '';
          const node = document.createTextNode(e.key);
          textEl.appendChild(node);

          // Make the editor dirty on the *first* real keystroke.
          if (!window._hasPendingEdit) {
            window._hasPendingEdit = true;
            if (typeof markDirty === 'function') {
              markDirty();
            }
          }

          try {
            const range = document.createRange();
            const sel = window.getSelection();
            range.setStart(node, node.textContent.length);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          } catch (err) {
            // ignore
          }

          return;
        }

        if (!placeholderActive && e.key === 'Backspace') {
          const fullText = textEl.textContent || '';
          const selInfo = getSelectionOffsetsInStep(textEl);
          const caretAtEnd =
            selInfo &&
            selInfo.start === fullText.length &&
            selInfo.end === fullText.length;

          // Deleting the single typed char → restore placeholder.
          if (caretAtEnd && fullText.length === 1) {
            e.preventDefault();

            textEl.textContent = '';
            textEl.classList.add('placeholder-prompt');

            if (textEl.dataset) {
              textEl.dataset.placeholder = placeholderText;
            }

            placeholderActive = true;

            try {
              const range = document.createRange();
              const sel = window.getSelection();
              if (!textEl.firstChild) {
                textEl.appendChild(document.createTextNode(''));
              }
              range.setStart(textEl.firstChild, 0);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
            } catch (err) {
              // ignore
            }

            return;
          }
        }

        if (placeholderActive && e.key === 'Backspace') {
          // Nothing real to delete yet; keep caret at 0.
          e.preventDefault();
          try {
            const range = document.createRange();
            const sel = window.getSelection();
            if (!textEl.firstChild) {
              textEl.appendChild(document.createTextNode(''));
            }
            range.setStart(textEl.firstChild, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          } catch (err) {
            // ignore
          }
          return;
        }
      }

      // --- TAB / SHIFT+TAB → toggle heading/step (model + DOM + renumber) ---
      if (e.key === 'Tab') {
        const stepId =
          window.editingStepId ||
          (textEl && textEl.dataset && textEl.dataset.stepId);

        const stepNodeModelRef =
          window.StepNodeModel && typeof window.StepNodeModel === 'object'
            ? window.StepNodeModel
            : null;
        const stepNodeTypeRef =
          window.StepNodeType && typeof window.StepNodeType === 'object'
            ? window.StepNodeType
            : null;
        const nodes = Array.isArray(window.stepNodes) ? window.stepNodes : null;
        const line = lineEl || textEl.closest('.instruction-line');

        // If wiring isn't present, let browser handle TAB normally.
        if (
          !stepId ||
          !stepNodeModelRef ||
          !stepNodeTypeRef ||
          !nodes ||
          !line
        ) {
          return;
        }

        // Structural-only TAB: no real tab chars, no focus change.
        e.preventDefault();

        const idStr = String(stepId);
        const idx = nodes.findIndex((n) => String(n.id) === idStr);
        if (idx === -1) return;

        const node = nodes[idx];
        let nextType = node.type;

        if (e.shiftKey) {
          // SHIFT+TAB: step → heading; heading → no-op.
          if (node.type !== stepNodeTypeRef.STEP) {
            return;
          }
          nextType = stepNodeTypeRef.HEADING;
          if (typeof stepNodeModelRef.convertNodeToHeading === 'function') {
            window.stepNodes = stepNodeModelRef.convertNodeToHeading(
              nodes,
              stepId
            );
          }
        } else {
          // TAB: heading → step; step → no-op.
          if (node.type !== stepNodeTypeRef.HEADING) {
            return;
          }
          nextType = stepNodeTypeRef.STEP;
          if (typeof stepNodeModelRef.convertNodeToStep === 'function') {
            window.stepNodes = stepNodeModelRef.convertNodeToStep(
              nodes,
              stepId
            );
          }
        }

        // Mirror new type into DOM for this line.
        line.dataset.stepType = nextType || 'step';
        const numEl = line.querySelector('.step-num');
        if (numEl && nextType === stepNodeTypeRef.HEADING) {
          // Headings are visually unnumbered.
          numEl.textContent = '';
        }

        // Re-number all lines, skipping headings.
        renumberSteps(document.getElementById('stepsSection'));

        // Structural promotion/demotion is a real edit → enable Save/Cancel.
        if (typeof markDirty === 'function') {
          markDirty();
        }

        return;
      }

      if (e.key === 'Backspace') {
        console.log('[BKS] keydown Backspace');
        // Backspace at the *very start* of the step merges with previous (Docs-style)
        const sel = getSelectionOffsetsInStep(textEl);
        const isEmptyNow = !normalizeStepText(textEl.textContent || '');
        const atStart =
          (sel && sel.start === 0 && sel.end === 0) || (!sel && isEmptyNow);

        const hasPrev =
          lineEl.previousElementSibling &&
          lineEl.previousElementSibling.classList.contains('instruction-line');

        if (atStart && hasPrev) {
          e.preventDefault();
          // Prevent blur -> commit from killing inline edit while we juggle DOM
          window._suppressStepCommit = true;
          handleBackspaceMerge();
          // If commit ran during merge, it has already reset this flag.
          // If not, clear it now so future commits work normally.
          window._suppressStepCommit = false;
          return;
        }

        // else: fall through to normal Backspace behavior
      }

      if (e.key === 'Enter') {
        const sel = getSelectionOffsetsInStep(textEl);
        const fullText = textEl.textContent || '';
        const atStart = sel && sel.start === 0 && sel.end === 0;
        const atEnd =
          sel && sel.start === fullText.length && sel.end === fullText.length;

        const norm = normalizeStepText(fullText);
        const isBlank = !norm;

        e.preventDefault();

        // Special-case: caret at very beginning of line
        if (atStart) {
          // Prevent blur -> commit from deleting this step while we
          // programmatically create/select a neighbor.
          const prevSuppress = window._suppressStepCommit === true;
          window._suppressStepCommit = true;

          const currentStepId = window.editingStepId;

          if (!currentStepId) {
            console.log('[BKS] early return: no currentStepId', {
              editingStepId: window.editingStepId,
              domStepId: textEl && textEl.dataset && textEl.dataset.stepId,
            });

            return;
          }

          // Save current text into the model (normalize but never delete here)
          const raw = textEl.textContent || '';
          const newVal = normalizeStepText(raw);
          commitWithValue(newVal, { deleteIfEmpty: false });

          // Re-find step after commit
          const found = findStepInModel(currentStepId);
          if (!found) return;

          const { stepsArr, idx, step } = found;
          if (!Array.isArray(stepsArr) || idx < 0 || !step) return;

          // Insert a new *blank* sibling step BEFORE this one
          const newStep = createSiblingStepFromExisting(step, '');
          stepsArr.splice(idx, 0, newStep);

          // Phase 1 — mirror the blank insert into the StepNode model (if present).
          if (Array.isArray(window.stepNodes)) {
            const nodes = window.stepNodes;
            const baseIdStr = String(step.id ?? step.ID);
            const baseIdx = nodes.findIndex((n) => String(n.id) === baseIdStr);

            if (baseIdx !== -1) {
              const stepNodeModelRef =
                window.StepNodeModel && typeof window.StepNodeModel === 'object'
                  ? window.StepNodeModel
                  : null;
              const stepNodeTypeRef =
                window.StepNodeType && typeof window.StepNodeType === 'object'
                  ? window.StepNodeType
                  : null;

              const prevNode = nodes[baseIdx - 1] || null;
              const baseNode = nodes[baseIdx] || null;

              let newOrder =
                baseNode && typeof baseNode.order === 'number'
                  ? baseNode.order - 1
                  : baseIdx;

              if (
                prevNode &&
                typeof prevNode.order === 'number' &&
                typeof baseNode?.order === 'number' &&
                !Number.isNaN(prevNode.order) &&
                !Number.isNaN(baseNode.order) &&
                prevNode.order < baseNode.order
              ) {
                newOrder = (prevNode.order + baseNode.order) / 2;
              }

              const nodePayload = {
                id: newStep.id ?? newStep.ID,
                type:
                  (baseNode && baseNode.type) ||
                  (stepNodeTypeRef && stepNodeTypeRef.STEP) ||
                  'step',
                text: newStep.instructions ?? '',
                order: newOrder,
              };

              const newNode =
                stepNodeModelRef &&
                typeof stepNodeModelRef.createStepNode === 'function'
                  ? stepNodeModelRef.createStepNode(nodePayload)
                  : nodePayload;

              nodes.splice(baseIdx, 0, newNode);

              if (
                stepNodeModelRef &&
                typeof stepNodeModelRef.normalizeStepNodeOrder === 'function'
              ) {
                window.stepNodes =
                  stepNodeModelRef.normalizeStepNodeOrder(nodes);
              }
            }
          }

          // DOM: insert new blank line above the current line

          const parent = lineEl.parentElement;
          if (parent) {
            const newLine = document.createElement('div');
            newLine.className = 'instruction-line numbered';

            // Inherit section id from the current line/text
            const sectionId =
              lineEl.dataset.sectionId || textEl.dataset.sectionId || '';
            if (sectionId) {
              newLine.dataset.sectionId = sectionId;
            }

            const numSpan = document.createElement('span');
            numSpan.className = 'step-num';
            numSpan.textContent = ''; // filled by renumber

            const textSpan = document.createElement('span');
            textSpan.className = 'step-text';
            textSpan.dataset.stepId = String(newStep.id ?? newStep.ID);
            textSpan.textContent = '';

            ensureStepTextNotEmpty(textSpan);

            if (sectionId) {
              textSpan.dataset.sectionId = sectionId;
            }

            newLine.appendChild(numSpan);
            newLine.appendChild(textSpan);
            parent.insertBefore(newLine, lineEl);

            // Wire inline editor for the new blank step
            attachStepInlineEditor(textSpan);

            // Renumber + sync
            const stepsContainer = document.getElementById('stepsSection');
            renumberSteps(stepsContainer);
            if (stepsContainer) syncStepOrderFromDOM(stepsContainer);

            if (typeof markDirty === 'function') {
              markDirty();
            }

            // Start editing again in the original step (content line)
            textEl.dispatchEvent(
              new MouseEvent('click', {
                bubbles: true,
              })
            );
          }

          // Allow future commits again (the blur we just caused was suppressed).
          if (!prevSuppress) {
            window._suppressStepCommit = false;
          }

          return;
        }

        // Default: mid-line / end-of-line / anything-not-caught-above
        handleEnterSplit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        try {
          document.body.classList.remove('step-editing');
        } catch (_) {}

        // ESC should revert the entire edit session via the central handler,
        // which restores both recipeData and stepNodes.
        if (typeof window.revertChanges === 'function') {
          window.revertChanges();
        } else {
          // Fallback: blur without committing changes
          if (textEl && typeof textEl.blur === 'function') {
            const prevSuppress = window._suppressStepCommit === true;
            window._suppressStepCommit = true;
            textEl.blur();
            if (!prevSuppress) window._suppressStepCommit = false;
          }
        }
      }
    };

    const onBlur = () => {
      commit();
    };

    const onInput = () => {
      if (!window._hasPendingEdit) {
        window._hasPendingEdit = true;
        if (typeof markDirty === 'function') {
          markDirty();
        }
      }

      const current = textEl.textContent || '';

      // If there's real text, never show the pseudo placeholder.
      if (
        current.length > 0 &&
        textEl.classList &&
        textEl.classList.contains('placeholder-prompt')
      ) {
        textEl.classList.remove('placeholder-prompt');
      }
      // If we removed the placeholder prompt due to real text, this is no longer
      // the empty-state placeholder row, so numbers should show after blur.
      try {
        if (
          current.length > 0 &&
          lineEl &&
          lineEl.classList &&
          lineEl.classList.contains('instruction-line--placeholder')
        ) {
          lineEl.classList.remove('instruction-line--placeholder');
        }
      } catch (_) {}

      // Safety net for the Safari-style placeholder:
      // if we started from the placeholder, the user has typed *something*
      // (placeholderActive === false) and then erased everything so that
      // the content is now truly empty again, restore the placeholder.
      if (startedFromPlaceholder && !placeholderActive) {
        if (current.length === 0) {
          textEl.classList.add('placeholder-prompt');
          if (textEl.dataset) {
            textEl.dataset.placeholder = placeholderText;
          }
          placeholderActive = true;
          try {
            if (
              lineEl &&
              lineEl.classList &&
              String(placeholderText || '').trim() === 'Add a step.' &&
              lineEl.dataset &&
              lineEl.dataset.stepType !== 'heading'
            ) {
              lineEl.classList.add('instruction-line--placeholder');
            }
          } catch (_) {}
        }
      }

      // Single-step recipes: when the only step is cleared, treat it as the
      // "Add a step." placeholder again.
      if (!startedFromPlaceholder && current.length === 0) {
        const parent = lineEl && lineEl.parentElement;
        if (parent) {
          const allLines = parent.querySelectorAll('.instruction-line');
          if (allLines.length === 1) {
            textEl.classList.add('placeholder-prompt');
            if (textEl.dataset) {
              textEl.dataset.placeholder = placeholderText;
            }
            try {
              if (
                lineEl &&
                lineEl.classList &&
                String(placeholderText || '').trim() === 'Add a step.' &&
                lineEl.dataset &&
                lineEl.dataset.stepType !== 'heading'
              ) {
                lineEl.classList.add('instruction-line--placeholder');
              }
            } catch (_) {}

            // Enter placeholder mode for this newly-blank single step.
            placeholderActive = true;

            // Put caret at position 0 so Backspace behaves like a real placeholder.
            try {
              const range = document.createRange();
              const sel = window.getSelection();

              // Always replace any leftover <br> etc with a clean text node.
              while (textEl.firstChild) {
                textEl.removeChild(textEl.firstChild);
              }
              const tn = document.createTextNode('');
              textEl.appendChild(tn);
              range.setStart(tn, 0);

              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
            } catch (err) {
              // ignore
            }
          }
        }
      }
    };

    textEl.addEventListener('keydown', onKeyDown);
    textEl.addEventListener('blur', onBlur);
    textEl.addEventListener('input', onInput);
  });
}

// --- Map current selection → character range inside a step ---
function getSelectionOffsetsInStep(textEl) {
  if (!textEl) return null;

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  if (!range || !range.startContainer) return null;

  // Ensure the selection is inside this step's text element
  if (
    !textEl.contains(range.startContainer) ||
    !textEl.contains(range.endContainer)
  ) {
    return null;
  }

  // Special-case: some browsers report the caret at the very start of the
  // contentEditable element as (element, offset 0) instead of a text node.
  // In that case we want a clean "start of step" offset (0, 0) so that
  // Enter behaves like "push all text down into the next step".
  if (
    range.collapsed &&
    range.startContainer === textEl &&
    range.startOffset === 0
  ) {
    return { start: 0, end: 0 };
  }

  function computeOffset(node, nodeOffset) {
    let offset = 0;
    const walker = document.createTreeWalker(
      textEl,
      NodeFilter.SHOW_TEXT,
      null
    );
    let current = walker.nextNode();

    while (current) {
      if (current === node) {
        offset += nodeOffset;
        break;
      } else {
        offset += current.textContent.length;
      }
      current = walker.nextNode();
    }

    return offset;
  }

  const startOffset = computeOffset(range.startContainer, range.startOffset);
  const endOffset = computeOffset(range.endContainer, range.endOffset);

  const fullText = textEl.textContent || '';
  const start = Math.max(0, Math.min(fullText.length, startOffset));
  const end = Math.max(0, Math.min(fullText.length, endOffset));

  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
  };
}

// --- Map click position → character index inside a step (currently unused) ---
function getClickCharIndexInStep(textEl, event) {
  if (!textEl || !event) return null;

  const x = event.clientX;
  const y = event.clientY;
  let range = null;

  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y);
  } else if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }

  if (!range || !range.startContainer) return null;

  // Ensure the click is inside this step's text element
  if (!textEl.contains(range.startContainer)) return null;

  let offset = 0;
  const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT, null);

  let node = walker.nextNode();
  while (node) {
    if (node === range.startContainer) {
      offset += range.startOffset;
      break;
    } else {
      offset += node.textContent.length;
    }
    node = walker.nextNode();
  }

  const fullText = textEl.textContent || '';
  if (offset < 0) offset = 0;
  if (offset > fullText.length) offset = fullText.length;

  return offset;
}
