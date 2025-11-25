// --- Inline edit state ---
window.editingStepId = null; // step id currently being edited (string)
window._activeStepInput = null; // live input element (if any)
window._suppressStepCommit = false; // guards blur->commit during cancel flows
window._hasPendingEdit = false; // enables Cancel as soon as typing starts

// --- Session baseline snapshot for Cancel ---
// Captures the original recipe state when a recipe is first rendered or reloaded from DB.
window.originalRecipeSnapshot = null;

// --- Display / selection helpers shared across editor ---

function enableSave() {
  const saveBtn = document.getElementById('editorActionBtn');
  if (saveBtn) {
    saveBtn.disabled = false;
  }
}

function disableSave() {
  const saveBtn = document.getElementById('editorActionBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
  }
}

// --- Shared helper: clear any selected instruction line ---
function clearSelectedStep() {
  document
    .querySelectorAll('.instruction-line.selected')
    .forEach((el) => el.classList.remove('selected'));
  // 🧠 Optional: reset global tracking
  window.activeStep = null;
}

function setActiveStep(lineEl) {
  if (!lineEl) return;

  // Logical selection only (no visual highlight here)
  window.activeStep = lineEl;

  if (typeof stepReorderCtx !== 'undefined' && stepReorderCtx) {
    stepReorderCtx.activeStep = lineEl;
  }
}

// --- Cancel / Dirty state tracking ---
let isDirty = false;
const cancelBtn = document.getElementById('cancelEditsBtn');

if (cancelBtn) {
  cancelBtn.disabled = true; // ✅ start disabled
}

function markDirty() {
  if (!isDirty) {
    isDirty = true;

    if (cancelBtn) {
      cancelBtn.disabled = false;
    }

    enableSave();
  }
}

function revertChanges() {
  // ✅ Prefer original snapshot for restore; fall back to current recipeData if missing
  const source = window.originalRecipeSnapshot || window.recipeData;
  if (!source) {
    console.warn('⚠️ revertChanges called with no snapshot or recipeData');
    return;
  }

  // Deep clone to avoid mutating the snapshot
  const restoreSource = source?.sections
    ? JSON.parse(JSON.stringify(source))
    : JSON.parse(JSON.stringify(source));

  renderRecipe(restoreSource);

  // Clean up selection and UI state

  // 🔧 Quill v1.1 — fully reset inline-edit globals
  window.editingStepId = null;
  window._activeStepInput = null;
  window._suppressStepCommit = false;
  window._hasPendingEdit = false;

  if (window.getSelection) window.getSelection().removeAllRanges();
  clearSelectedStep();
  isDirty = false;

  if (cancelBtn) {
    cancelBtn.disabled = true;
  }

  disableSave();
}

if (cancelBtn) {
  cancelBtn.addEventListener('click', () => {
    if (isDirty) {
      revertChanges();
      const saveBtn = document.getElementById('editorActionBtn');
      if (saveBtn) {
        // no-op: intentionally left without logging
      }
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isDirty) {
    revertChanges();
  }
});

// --- Save / Cancel Integration (Option A: robust fix) ---
const saveBtn = document.getElementById('editorActionBtn');
if (saveBtn) {
  saveBtn.addEventListener('click', async () => {
    if (!isDirty) return;

    try {
      const savedRecipe = await saveRecipeToDB();

      // ✨ Persist SQL.js memory to disk (Electron or browser fallback)
      const binaryArray = window.dbInstance.export();
      const isElectron = !!window.electronAPI;
      if (isElectron) {
        const ok = await window.electronAPI.saveDB(binaryArray, {
          // pre-overwrite backup + write
          overwriteOnly: false,
        });

        if (ok) alert('Database saved successfully.');
        else alert('Save failed — check console for details.');
      } else {
        const blob = new Blob([binaryArray], {
          type: 'application/octet-stream',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'favorite_eats_updated.sqlite';
        a.click();
        URL.revokeObjectURL(url);
      }

      if (savedRecipe) {
        const refreshed = bridge.loadRecipeFromDB(
          window.dbInstance,
          window.recipeId
        );

        // 🧠 After a successful save, the "truth" is now the DB-backed recipe.
        // Use this as the new baseline so Cancel + future loads see post-save data,
        // but keep the current StepNode/heading view intact in this session.
        window.originalRecipeSnapshot = JSON.parse(JSON.stringify(refreshed));
        window.recipeData = JSON.parse(JSON.stringify(refreshed));
        // NOTE: Intentionally do NOT call renderRecipe() here.
        // Re-rendering would rebuild window.stepNodes from DB-only steps
        // and drop heading promotions immediately after save.
      }

      isDirty = false;
      cancelBtn.disabled = true;
      disableSave();
      clearSelectedStep(); // 🧹 remove highlight after save
    } catch (err) {
      console.error('❌ Save failed:', err);
    }
  });
}

async function saveRecipeToDB() {
  // Delegate to the bridge, which now owns all DB write logic
  const db = window.dbInstance;
  const recipe = window.recipeData;

  bridge.saveRecipeStepsFromStepNodes(db, window.recipeId, window.stepNodes);

  // Re-read from DB to return a fully refreshed object
  return bridge.loadRecipeFromDB(db, window.recipeId);
}
