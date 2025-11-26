// bridge.js
// A single place for translating between the SQL.js database and in-memory objects.

// --- StepNode → DB save adapter (Option A: minimal) ---
function saveRecipeStepsFromStepNodes(activeDb, recipeId, stepNodes) {
  // Remove existing rows for this recipe
  activeDb.exec(`DELETE FROM recipe_steps WHERE recipe_id = ${recipeId};`);

  // Insert fresh rows from StepNode model (section_id removed from schema)
  const stmt = activeDb.prepare(`
    INSERT INTO recipe_steps (ID, recipe_id, step_number, instructions, type)
    VALUES (?, ?, ?, ?, ?);
  `);

  stepNodes.forEach((node) => {
    const dbType = node.type === 'heading' ? 'heading' : 'step';
    stmt.run([node.id, recipeId, node.order, node.text, dbType]);
  });

  stmt.free();
}

window.bridge = {
  loadRecipeFromDB,
  saveRecipeToDB,
  saveRecipeStepsFromStepNodes,
};

// Load a recipe and all its pieces from the database into a full JS object.

function loadRecipeFromDB(db, recipeId) {
  const recipeRows = db.exec(`
    SELECT ID, title, servings_default, servings_min, servings_max
    FROM recipes WHERE ID = ${recipeId};
  `);
  if (!recipeRows.length) return null;

  const [id, title, servingsDefault, servingsMin, servingsMax] =
    recipeRows[0].values[0];

  // --- Load steps from new schema (no sections, type column present) ---
  const stepsQ = db.exec(`
    SELECT ID, step_number, instructions, type
    FROM recipe_steps
    WHERE recipe_id = ${id}
    ORDER BY step_number;
  `);

  const steps = stepsQ.length
    ? stepsQ[0].values.map(([ID, step_number, instructions, type]) => ({
        ID,
        step_number,
        instructions,
        type,
      }))
    : [];

  // --- Load ingredients (no more section_id) ---
  const ingredientsQ = db.exec(`
    SELECT rim.ID, rim.quantity, rim.unit,
           i.name, i.variant, rim.prep_notes,
           rim.is_optional, i.parenthetical_note, i.location_at_home
    FROM recipe_ingredient_map rim
    JOIN ingredients i ON rim.ingredient_id = i.ID
    WHERE rim.recipe_id = ${id}
    ORDER BY rim.ID;
  `);

  const ingredients = ingredientsQ.length
    ? ingredientsQ[0].values.map(
        ([
          rimId,
          qty,
          unit,
          name,
          variant,
          prepNotes,
          isOptional,
          parentheticalNote,
          locationAtHome,
        ]) => ({
          rimId,
          quantity: isNaN(parseFloat(qty)) ? qty : parseFloat(qty),
          unit: unit || '',
          name,
          variant: variant || '',
          prepNotes: prepNotes || '',
          isOptional: !!isOptional,
          parentheticalNote: parentheticalNote || '',
          locationAtHome: locationAtHome ? locationAtHome.toLowerCase() : '',
        })
      )
    : [];

  // --- Synthetic single section to keep renderRecipe happy ---
  const hasContent = steps.length || ingredients.length;

  const sections = hasContent
    ? [
        {
          ID: null,
          name: '(unnamed)',
          steps,
          ingredients,
        },
      ]
    : [];

  return {
    id,
    title,
    servings: {
      default: servingsDefault,
      min: servingsMin,
      max: servingsMax,
    },
    sections,
  };
}

function saveRecipeToDB(db, recipe) {
  const activeDb = db || window.dbInstance;
  if (!activeDb) throw new Error('No active database found');
  const rid = recipe.id || window.recipeId;
  if (!rid) throw new Error('No recipe id');

  // 1) Gather model steps by section (source of truth for text/section)
  const sections = Array.isArray(recipe.sections) ? recipe.sections : [];
  const byId = new Map(); // stepId -> {section_id, instructions, ID}
  const bySection = new Map(); // section_id|null -> [{ID, instructions}]
  sections.forEach((sec) => {
    const sid = sec.ID ?? sec.id ?? null;
    (sec.steps || []).forEach((s) => {
      const stepId = s.ID ?? s.id ?? null;
      if (stepId != null) {
        byId.set(String(stepId), {
          ID: stepId,
          section_id: s.section_id ?? sid,
          instructions: s.instructions,
        });
      }
    });
    bySection.set(
      sid,
      (sec.steps || []).map((s) => ({
        ID: s.ID ?? s.id ?? null,
        section_id: s.section_id ?? sid,
        instructions: s.instructions,
      }))
    );
  });

  // 2) Read current DOM ordering for the visible instruction list (keeps current UX intact)
  const domIds = Array.from(
    document.querySelectorAll('.instruction-line.numbered .step-text')
  )
    .map((el) => el.dataset.stepId)
    .filter(Boolean);

  // 3) Rebuild per-section arrays, applying DOM order where applicable
  const reorderedBySection = new Map();
  bySection.forEach((list, sid) => {
    const idsInThisSection = new Set(list.map((s) => String(s.ID)));
    const domOrderForSection = domIds.filter((id) =>
      idsInThisSection.has(String(id))
    );
    if (domOrderForSection.length > 0) {
      const ordered = [];
      domOrderForSection.forEach((id) => {
        const rec = byId.get(String(id));
        if (rec) ordered.push(rec);
      });
      // append any remaining (not in DOM list) in original order
      list.forEach((s) => {
        if (!domOrderForSection.includes(String(s.ID))) ordered.push(s);
      });
      reorderedBySection.set(sid, ordered);
    } else {
      reorderedBySection.set(sid, list);
    }
  });

  // 4) Transaction: clear + reinsert in compact order (per section)
  activeDb.run('BEGIN;');
  try {
    activeDb.run(`DELETE FROM recipe_steps WHERE recipe_id = ?;`, [rid]);
    reorderedBySection.forEach((list, sid) => {
      let n = 1;
      list.forEach((s) => {
        // Let SQLite assign a fresh INTEGER PRIMARY KEY for ID; do not reuse JS IDs
        activeDb.run(
          `INSERT INTO recipe_steps (ID, recipe_id, section_id, step_number, instructions)
           VALUES (NULL, ?, ?, ?, ?);`,
          [rid, sid ?? null, n++, s.instructions ?? '']
        );
      });
    });
    activeDb.run('COMMIT;');
    console.info('💾 bridge.saveRecipeToDB → steps saved (transactional)');
  } catch (e) {
    activeDb.run('ROLLBACK;');
    console.error('❌ saveRecipeToDB failed', e);
    throw e;
  }
}
