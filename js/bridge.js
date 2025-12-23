// bridge.js
// A single place for translating between the SQL.js database and in-memory objects.

// --- Shared DB helpers ---
function getTableColumns(activeDb, tableName) {
  try {
    const q = activeDb.exec(`PRAGMA table_info(${tableName});`);
    if (!q.length) return [];
    // PRAGMA table_info returns: cid, name, type, notnull, dflt_value, pk
    return q[0].values.map((row) => String(row[1]));
  } catch (_) {
    return [];
  }
}

function pickIdColumn(cols) {
  const hit = cols.find((c) => String(c).toLowerCase() === 'id');
  return hit || 'ID';
}

function tableExists(activeDb, tableName) {
  if (!activeDb || !tableName) return false;
  try {
    const q = activeDb.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${String(
        tableName
      ).replace(/'/g, "''")}';`
    );
    return !!(q && q.length && q[0].values && q[0].values.length);
  } catch (_) {
    return false;
  }
}

function ensureRecipeIngredientMapSortOrderSchema(activeDb) {
  if (!activeDb) return false;
  const cols = getTableColumns(activeDb, 'recipe_ingredient_map').map((c) =>
    String(c).toLowerCase()
  );
  const hasSortOrder = cols.includes('sort_order');
  if (!hasSortOrder) {
    try {
      activeDb.run(
        'ALTER TABLE recipe_ingredient_map ADD COLUMN sort_order INTEGER;'
      );
    } catch (_) {
      // If schema is already upgraded (or ALTER fails), ignore.
    }
  }

  // Best-effort index (safe to attempt repeatedly).
  try {
    activeDb.run(
      'CREATE INDEX IF NOT EXISTS idx_rim_recipe_section_sort ON recipe_ingredient_map(recipe_id, section_id, sort_order, ID);'
    );
  } catch (_) {}

  return true;
}

function ensureRecipeIngredientHeadingsSchema(activeDb) {
  if (!activeDb) return false;

  // Only create if missing; do not mutate schemas on load paths unless called explicitly.
  const exists = tableExists(activeDb, 'recipe_ingredient_headings');
  if (!exists) {
    try {
      activeDb.run(`
        CREATE TABLE IF NOT EXISTS recipe_ingredient_headings (
          ID INTEGER PRIMARY KEY,
          recipe_id INTEGER NOT NULL,
          section_id INTEGER,
          sort_order INTEGER,
          text TEXT
        );
      `);
    } catch (_) {
      // ignore
    }
  }

  // Best-effort index (safe to attempt repeatedly).
  try {
    activeDb.run(
      'CREATE INDEX IF NOT EXISTS idx_rih_recipe_section_sort ON recipe_ingredient_headings(recipe_id, section_id, sort_order, ID);'
    );
  } catch (_) {}

  return true;
}

function ensureRecipeIngredientMapParentheticalNoteSchema(activeDb) {
  if (!activeDb) return false;

  const rimCols = getTableColumns(activeDb, 'recipe_ingredient_map').map((c) =>
    String(c).toLowerCase()
  );
  const hasRimParen = rimCols.includes('parenthetical_note');
  if (!hasRimParen) {
    try {
      activeDb.run(
        'ALTER TABLE recipe_ingredient_map ADD COLUMN parenthetical_note TEXT;'
      );
    } catch (_) {
      // ignore
    }
  }

  // Best-effort backfill from legacy ingredients.parenthetical_note.
  // Only if ingredients table has that column.
  try {
    const ingCols = getTableColumns(activeDb, 'ingredients').map((c) =>
      String(c).toLowerCase()
    );
    const hasIngParen = ingCols.includes('parenthetical_note');
    if (hasIngParen) {
      activeDb.run(`
        UPDATE recipe_ingredient_map
        SET parenthetical_note = (
          SELECT i.parenthetical_note
          FROM ingredients i
          WHERE i.ID = recipe_ingredient_map.ingredient_id
        )
        WHERE (parenthetical_note IS NULL OR parenthetical_note = '')
          AND (SELECT COALESCE(i.parenthetical_note, '')
               FROM ingredients i
               WHERE i.ID = recipe_ingredient_map.ingredient_id) <> '';
      `);
    }
  } catch (_) {}

  // Index is optional; keep it small to avoid surprises.
  try {
    activeDb.run(
      'CREATE INDEX IF NOT EXISTS idx_rim_recipe_paren ON recipe_ingredient_map(recipe_id, parenthetical_note);'
    );
  } catch (_) {}

  return true;
}

// --- Unit suggestions (soft-add) ---
function ensureUnitSuggestionsSchema(activeDb) {
  if (!activeDb) return false;
  const exists = tableExists(activeDb, 'unit_suggestions');
  if (!exists) {
    try {
      activeDb.run(`
        CREATE TABLE IF NOT EXISTS unit_suggestions (
          code TEXT PRIMARY KEY,
          use_count INTEGER NOT NULL DEFAULT 0,
          last_used_at INTEGER,
          is_hidden INTEGER NOT NULL DEFAULT 0
        );
      `);
    } catch (_) {
      return false;
    }
  }
  try {
    activeDb.run(
      'CREATE INDEX IF NOT EXISTS idx_unit_suggestions_hidden_last ON unit_suggestions(is_hidden, last_used_at);'
    );
  } catch (_) {}
  return true;
}

function normalizeUnitCode(unitText) {
  return String(unitText || '')
    .trim()
    .toLowerCase();
}

function recordUnitSuggestionsFromRecipeModel(activeDb, recipe) {
  if (!activeDb) return;
  if (!ensureUnitSuggestionsSchema(activeDb)) return;
  if (!tableExists(activeDb, 'units')) return;

  const sections = Array.isArray(recipe?.sections) ? recipe.sections : [];
  const seen = new Set();

  const consider = (u) => {
    const code = normalizeUnitCode(u);
    if (!code) return;
    seen.add(code);
  };

  sections.forEach((sec) => {
    const list = Array.isArray(sec?.ingredients) ? sec.ingredients : [];
    list.forEach((row) => {
      if (!row || row.isPlaceholder) return;
      if (row.rowType === 'heading') return;
      consider(row.unit);
      if (Array.isArray(row.substitutes)) {
        row.substitutes.forEach((sub) => consider(sub && sub.unit));
      }
    });
  });

  if (seen.size === 0) return;

  const ts = Math.floor(Date.now() / 1000);

  const existsStmt = activeDb.prepare(
    'SELECT 1 AS ok FROM units WHERE lower(code) = lower(?) LIMIT 1;'
  );
  const upsertStmt = activeDb.prepare(`
    INSERT INTO unit_suggestions (code, use_count, last_used_at, is_hidden)
    VALUES (?, 1, ?, 0)
    ON CONFLICT(code) DO UPDATE SET
      use_count = unit_suggestions.use_count + 1,
      last_used_at = excluded.last_used_at;
  `);

  try {
    seen.forEach((code) => {
      let isOfficial = false;
      try {
        existsStmt.bind([code]);
        if (existsStmt.step()) isOfficial = true;
      } catch (_) {
        isOfficial = false;
      } finally {
        try {
          existsStmt.reset();
        } catch (_) {}
      }
      if (isOfficial) return;

      try {
        upsertStmt.run([code, ts]);
      } catch (_) {}
    });
  } finally {
    try {
      existsStmt.free();
    } catch (_) {}
    try {
      upsertStmt.free();
    } catch (_) {}
  }
}

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
  saveRecipeIngredientsFromModel,
  ensureRecipeIngredientMapSortOrderSchema,
  ensureRecipeIngredientHeadingsSchema,
  ensureRecipeIngredientMapParentheticalNoteSchema,
  writeIngredientSortOrderFromModel,
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

  // --- Load ingredients ---
  const rimCols = getTableColumns(db, 'recipe_ingredient_map');
  const rimHas = (col) => rimCols.map((c) => c.toLowerCase()).includes(col);
  const hasSectionId = rimHas('section_id');
  const hasSortOrder = rimHas('sort_order');
  const hasRimParen = rimHas('parenthetical_note');

  const ingCols = getTableColumns(db, 'ingredients');
  const ingHas = (col) => ingCols.map((c) => String(c).toLowerCase()).includes(col);
  const hasIngParen = ingHas('parenthetical_note');
  const hasLemma = ingHas('lemma');
  const hasPluralByDefault = ingHas('plural_by_default');
  const hasIsMassNoun = ingHas('is_mass_noun');
  const hasPluralOverride = ingHas('plural_override');

  const selectParts = [
    'rim.ID',
    hasSectionId ? 'rim.section_id' : 'NULL AS section_id',
    hasSortOrder ? 'rim.sort_order' : 'NULL AS sort_order',
    'rim.quantity',
    'rim.unit',
    'i.name',
    'i.variant',
    'i.size',
    hasLemma ? 'i.lemma' : 'NULL AS lemma',
    hasPluralByDefault ? 'COALESCE(i.plural_by_default, 0) AS plural_by_default' : '0 AS plural_by_default',
    hasIsMassNoun ? 'COALESCE(i.is_mass_noun, 0) AS is_mass_noun' : '0 AS is_mass_noun',
    hasPluralOverride
      ? 'COALESCE(i.plural_override, \'\') AS plural_override'
      : "'' AS plural_override",
    'rim.prep_notes',
    'rim.is_optional',
    hasRimParen
      ? "COALESCE(rim.parenthetical_note, '') AS parenthetical_note"
      : hasIngParen
      ? "COALESCE(i.parenthetical_note, '') AS parenthetical_note"
      : "'' AS parenthetical_note",
    'i.location_at_home',
  ];

  const orderParts = [];
  if (hasSectionId) {
    // Global (no section) first, then by section id.
    orderParts.push('CASE WHEN rim.section_id IS NULL THEN 0 ELSE 1 END');
    orderParts.push('rim.section_id');
  }
  if (hasSortOrder) {
    orderParts.push('COALESCE(rim.sort_order, 999999)');
  }
  orderParts.push('rim.ID');

  const ingredientsQ = db.exec(`
    SELECT ${selectParts.join(', ')}
    FROM recipe_ingredient_map rim
    JOIN ingredients i ON rim.ingredient_id = i.ID
    WHERE rim.recipe_id = ${id}
    ORDER BY ${orderParts.join(', ')};
  `);

  const ingredients = ingredientsQ.length
    ? ingredientsQ[0].values.map(
        ([
          rimId,
          sectionId,
          sortOrder,
          qty,
          unit,
          name,
          variant,
          size,
          lemma,
          pluralByDefault,
          isMassNoun,
          pluralOverride,
          prepNotes,
          isOptional,
          parentheticalNote,
          locationAtHome,
        ]) => ({
          rowType: 'ingredient',
          rimId,
          clientId: rimId != null ? `i-${rimId}` : null,
          sectionId: sectionId == null ? null : Number(sectionId),
          sortOrder: sortOrder == null ? null : Number(sortOrder),
          quantity: isNaN(parseFloat(qty)) ? qty : parseFloat(qty),
          unit: unit || '',
          name:
            typeof name === 'string' && name.trim() === 'Add an ingredient.'
              ? ''
              : name,
          variant: variant || '',
          size: size || '',
          lemma: lemma || '',
          pluralByDefault: !!pluralByDefault,
          isMassNoun: !!isMassNoun,
          pluralOverride: pluralOverride || '',
          prepNotes: prepNotes || '',
          isOptional: !!isOptional,
          parentheticalNote: parentheticalNote || '',
          locationAtHome: locationAtHome ? locationAtHome.toLowerCase() : '',
        })
      )
    : [];

  // --- Load ingredient subsection headings (optional table) ---
  const headings = [];
  try {
    if (tableExists(db, 'recipe_ingredient_headings')) {
      const rihCols = getTableColumns(db, 'recipe_ingredient_headings');
      const rihHas = (col) =>
        rihCols.map((c) => String(c).toLowerCase()).includes(col);
      const hasRihSection = rihHas('section_id');

      const select = [
        'ID',
        'recipe_id',
        hasRihSection ? 'section_id' : 'NULL AS section_id',
        'sort_order',
        'text',
      ];
      const order = [];
      if (hasRihSection) {
        order.push('CASE WHEN section_id IS NULL THEN 0 ELSE 1 END');
        order.push('section_id');
      }
      order.push('COALESCE(sort_order, 999999)');
      order.push('ID');

      const q = db.exec(`
        SELECT ${select.join(', ')}
        FROM recipe_ingredient_headings
        WHERE recipe_id = ${id}
        ORDER BY ${order.join(', ')};
      `);

      if (q.length) {
        q[0].values.forEach(([ID, _rid, section_id, sort_order, text]) => {
          const hid = ID == null ? null : Number(ID);
          const sid = section_id == null ? null : Number(section_id);
          const so = sort_order == null ? null : Number(sort_order);
          const t = text == null ? '' : String(text);
          headings.push({
            rowType: 'heading',
            headingId: Number.isFinite(hid) ? hid : null,
            headingClientId: Number.isFinite(hid) ? `h-${hid}` : null,
            sectionId: Number.isFinite(sid) ? sid : null,
            sortOrder: Number.isFinite(so) ? so : null,
            text: t,
          });
        });
      }
    }
  } catch (_) {}

  // --- Interleave headings + ingredients by shared sort_order namespace (best-effort) ---
  let ingredientRows = ingredients;
  if (headings.length > 0) {
    const typeRank = (row) => {
      if (!row) return 9;
      if (row.rowType === 'heading') return 0;
      if (row.rowType === 'ingredient') return 1;
      return 5;
    };
    const sortKey = (row) =>
      row && Number.isFinite(row.sortOrder) ? row.sortOrder : 999999;
    ingredientRows = [...ingredients, ...headings].sort((a, b) => {
      const sa = sortKey(a);
      const sb = sortKey(b);
      if (sa !== sb) return sa - sb;
      const ta = typeRank(a);
      const tb = typeRank(b);
      if (ta !== tb) return ta - tb;
      const ida =
        a.rowType === 'heading'
          ? a.headingId ?? 0
          : a.rowType === 'ingredient'
          ? a.rimId ?? 0
          : 0;
      const idb =
        b.rowType === 'heading'
          ? b.headingId ?? 0
          : b.rowType === 'ingredient'
          ? b.rimId ?? 0
          : 0;
      return Number(ida) - Number(idb);
    });
  }

  // --- Synthetic single section to keep renderRecipe happy ---
  const hasContent = steps.length || ingredientRows.length;

  const sections = hasContent
    ? [
        {
          ID: null,
          name: '(unnamed)',
          steps,
          ingredients: ingredientRows,
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

function saveRecipeIngredientsFromModel(activeDb, recipeId, recipe) {
  if (!activeDb) throw new Error('saveRecipeIngredientsFromModel: missing db');
  const rid = Number(recipeId || recipe?.id);
  if (!Number.isFinite(rid)) {
    throw new Error('saveRecipeIngredientsFromModel: invalid recipe id');
  }

  // Ensure schema supports sort_order so we can persist order safely.
  ensureRecipeIngredientMapSortOrderSchema(activeDb);
  // Ensure schema supports ingredient headings.
  ensureRecipeIngredientHeadingsSchema(activeDb);
  // Ensure schema supports recipe-level parenthetical notes.
  ensureRecipeIngredientMapParentheticalNoteSchema(activeDb);

  const ingredientsCols = getTableColumns(activeDb, 'ingredients');
  const rimCols = getTableColumns(activeDb, 'recipe_ingredient_map');
  const ingIdCol = pickIdColumn(ingredientsCols);

  const rimHas = (col) => rimCols.map((c) => c.toLowerCase()).includes(col);
  const ingHas = (col) =>
    ingredientsCols.map((c) => c.toLowerCase()).includes(col);

  if (!rimHas('recipe_id') || !rimHas('ingredient_id')) {
    throw new Error(
      'saveRecipeIngredientsFromModel: recipe_ingredient_map missing required columns'
    );
  }
  if (!ingHas('name')) {
    throw new Error(
      'saveRecipeIngredientsFromModel: ingredients table missing name column'
    );
  }

  const sections = Array.isArray(recipe?.sections) ? recipe.sections : [];

  const isHeadingRow = (row) => {
    if (!row) return false;
    if (row.rowType === 'heading') return true;
    if (row.headingId != null) return true;
    if (row.headingClientId && row.text != null && row.name == null) return true;
    return false;
  };

  // Snapshot current heading IDs so we can update/insert/delete safely.
  const existingHeadingIds = new Set();
  try {
    if (tableExists(activeDb, 'recipe_ingredient_headings')) {
      const sel = activeDb.prepare(
        'SELECT ID FROM recipe_ingredient_headings WHERE recipe_id = ?;'
      );
      try {
        sel.bind([rid]);
        while (sel.step()) {
          const row = sel.getAsObject();
          if (row && row.ID != null) existingHeadingIds.add(Number(row.ID));
        }
      } finally {
        sel.free();
      }
    }
  } catch (_) {}
  const keptHeadingIds = new Set();

  // Snapshot current DB mapping IDs so we can update/insert/delete without
  // nuking substitutes (children are ON DELETE CASCADE from mapping IDs).
  const existingIds = new Set();
  try {
    const sel = activeDb.prepare(
      'SELECT ID FROM recipe_ingredient_map WHERE recipe_id = ?;'
    );
    try {
      sel.bind([rid]);
      while (sel.step()) {
        const row = sel.getAsObject();
        if (row && row.ID != null) existingIds.add(Number(row.ID));
      }
    } finally {
      sel.free();
    }
  } catch (_) {}

  const keptIds = new Set();

  const findOrCreateIngredientId = (ing) => {
    const name = (ing.name || '').trim();
    const variant = (ing.variant || '').trim();
    const size = (ing.size || '').trim();
    const loc = (ing.locationAtHome || '').trim();

    const where = ['lower(name) = lower(?)'];
    const params = [name];

    if (ingHas('variant')) {
      where.push("COALESCE(variant, '') = ?");
      params.push(variant);
    }
    if (ingHas('size')) {
      where.push("COALESCE(size, '') = ?");
      params.push(size);
    }
    if (ingHas('location_at_home')) {
      where.push("COALESCE(location_at_home, '') = ?");
      params.push(loc);
    }

    // Use prepared statements (SQL.js exec() is not reliably parameterized).
    let foundId = null;
    const selStmt = activeDb.prepare(
      `SELECT ${ingIdCol} AS id FROM ingredients WHERE ${where.join(
        ' AND '
      )} LIMIT 1;`
    );
    try {
      selStmt.bind(params);
      if (selStmt.step()) {
        const row = selStmt.getAsObject();
        if (row && row.id != null) {
          const v = Number(row.id);
          if (Number.isFinite(v)) foundId = v;
        }
      }
    } finally {
      selStmt.free();
    }

    if (foundId != null) return foundId;

    // Insert new ingredient row (best-effort to include extra columns if present)
    const cols = ['name'];
    const vals = [name];

    if (ingHas('variant')) {
      cols.push('variant');
      vals.push(variant);
    }
    if (ingHas('size')) {
      cols.push('size');
      vals.push(size);
    }
    if (ingHas('location_at_home')) {
      cols.push('location_at_home');
      vals.push(loc);
    }

    const placeholders = cols.map(() => '?').join(', ');
    const insStmt = activeDb.prepare(
      `INSERT INTO ingredients (${cols.join(', ')}) VALUES (${placeholders});`
    );
    try {
      insStmt.run(vals);
    } finally {
      insStmt.free();
    }

    const idQ = activeDb.exec('SELECT last_insert_rowid();');
    if (idQ.length && idQ[0].values.length) {
      return Number(idQ[0].values[0][0]);
    }
    throw new Error(
      'saveRecipeIngredientsFromModel: failed to insert ingredient'
    );
  };

  const rimHasSection = rimHas('section_id');
  const rimHasSortOrder = rimHas('sort_order');

  const rihCols = getTableColumns(activeDb, 'recipe_ingredient_headings');
  const rihHas = (col) =>
    rihCols.map((c) => String(c).toLowerCase()).includes(col);
  const rihHasSection = rihHas('section_id');

  // Upsert mappings in current model order (per section)
  let inserted = 0;
  let updated = 0;

  sections.forEach((sec) => {
    const sectionId = rimHasSection ? sec?.ID ?? sec?.id ?? null : null;
    const list = Array.isArray(sec?.ingredients) ? sec.ingredients : [];

    // Only persist "real" rows; placeholders are view-only.
    // Headings persist when their text is non-empty.
    const realRows = list.filter((row) => {
      if (!row || row.isPlaceholder) return false;
      if (isHeadingRow(row)) {
        const t = row.text != null ? String(row.text).trim() : '';
        return t.length > 0;
      }
      return (row.name || '').trim() !== '';
    });

    let sortN = 1;
    realRows.forEach((row) => {
      // Shared ordering namespace across headings + ingredients.
      const assignedSort = sortN;
      sortN += 1;

      if (isHeadingRow(row)) {
        const text = (row.text != null ? String(row.text) : '').trim();
        const headingId =
          row.headingId != null ? Number(row.headingId) : null;

        try {
          if (headingId != null && existingHeadingIds.has(headingId)) {
            if (rihHasSection) {
              activeDb.run(
                'UPDATE recipe_ingredient_headings SET section_id = ?, sort_order = ?, text = ? WHERE recipe_id = ? AND ID = ?;',
                [sectionId ?? null, assignedSort, text, rid, headingId]
              );
            } else {
              activeDb.run(
                'UPDATE recipe_ingredient_headings SET sort_order = ?, text = ? WHERE recipe_id = ? AND ID = ?;',
                [assignedSort, text, rid, headingId]
              );
            }
            keptHeadingIds.add(headingId);
          } else {
            if (rihHasSection) {
              activeDb.run(
                'INSERT INTO recipe_ingredient_headings (recipe_id, section_id, sort_order, text) VALUES (?, ?, ?, ?);',
                [rid, sectionId ?? null, assignedSort, text]
              );
            } else {
              activeDb.run(
                'INSERT INTO recipe_ingredient_headings (recipe_id, sort_order, text) VALUES (?, ?, ?);',
                [rid, assignedSort, text]
              );
            }
            const idQ = activeDb.exec('SELECT last_insert_rowid();');
            const newId =
              idQ.length && idQ[0].values.length
                ? Number(idQ[0].values[0][0])
                : null;
            if (Number.isFinite(newId)) {
              row.headingId = newId;
              row.headingClientId = `h-${newId}`;
              keptHeadingIds.add(newId);
            }
          }
        } catch (_) {}

        row.sortOrder = assignedSort;
        return;
      }

      const ing = row;
      const ingredientId = findOrCreateIngredientId(ing);
      const rimId = ing.rimId != null ? Number(ing.rimId) : null;
      ing.sortOrder = assignedSort;

      // Build common column sets
      const cols = ['recipe_id', 'ingredient_id'];
      const vals = [rid, ingredientId];

      if (rimHasSection) {
        cols.push('section_id');
        vals.push(sectionId ?? null);
      }
      if (rimHas('quantity')) {
        cols.push('quantity');
        vals.push(ing.quantity ?? '');
      }
      if (rimHas('unit')) {
        cols.push('unit');
        vals.push((ing.unit || '').trim());
      }
      if (rimHas('prep_notes')) {
        cols.push('prep_notes');
        vals.push((ing.prepNotes || '').trim());
      }
      if (rimHas('parenthetical_note')) {
        cols.push('parenthetical_note');
        vals.push((ing.parentheticalNote || '').trim());
      }
      if (rimHas('is_optional')) {
        cols.push('is_optional');
        vals.push(ing.isOptional ? 1 : 0);
      }
      if (rimHasSortOrder) {
        cols.push('sort_order');
        vals.push(assignedSort);
      }

      // Update existing row if we have a valid rimId still present in DB.
      if (rimId != null && existingIds.has(rimId)) {
        // Convert insert-shape into update-shape (skip recipe_id)
        const setCols = cols
          .filter((c) => c !== 'recipe_id')
          .map((c) => `${c} = ?`);
        const setVals = vals.slice(1); // drop recipe_id

        const sql = `UPDATE recipe_ingredient_map SET ${setCols.join(
          ', '
        )} WHERE ID = ? AND recipe_id = ?;`;

        const stmt = activeDb.prepare(sql);
        try {
          stmt.run([...setVals, rimId, rid]);
        } finally {
          stmt.free();
        }
        keptIds.add(rimId);
        updated += 1;
      } else {
        // Insert new mapping row (keeps children safe because none exist yet)
        const placeholders = cols.map(() => '?').join(', ');
        const mapStmt = activeDb.prepare(
          `INSERT INTO recipe_ingredient_map (${cols.join(
            ', '
          )}) VALUES (${placeholders});`
        );
        try {
          mapStmt.run(vals);
        } finally {
          mapStmt.free();
        }
        const idQ = activeDb.exec('SELECT last_insert_rowid();');
        const newId =
          idQ.length && idQ[0].values.length ? Number(idQ[0].values[0][0]) : null;
        if (Number.isFinite(newId)) {
          ing.rimId = newId;
          keptIds.add(newId);
        }
        inserted += 1;
      }

    });
  });

  // Delete removed mapping rows (and their substitutes).
  existingIds.forEach((id) => {
    if (!keptIds.has(id)) {
      try {
        activeDb.run(
          'DELETE FROM recipe_ingredient_map WHERE recipe_id = ? AND ID = ?;',
          [rid, id]
        );
      } catch (_) {}
    }
  });

  // Delete removed headings.
  existingHeadingIds.forEach((id) => {
    if (!keptHeadingIds.has(id)) {
      try {
        activeDb.run(
          'DELETE FROM recipe_ingredient_headings WHERE recipe_id = ? AND ID = ?;',
          [rid, id]
        );
      } catch (_) {}
    }
  });

  // Soft-add unit suggestions (unknown units only).
  try {
    recordUnitSuggestionsFromRecipeModel(activeDb, recipe);
  } catch (_) {}

  console.info(
    `💾 saveRecipeIngredientsFromModel: updated ${updated}, inserted ${inserted}, deleted ${
      existingIds.size - keptIds.size
    }`
  );
}

// Persist sort_order only (in place, does NOT delete rows).
function writeIngredientSortOrderFromModel(activeDb, recipeId, recipe) {
  if (!activeDb) return false;
  const rid = Number(recipeId || recipe?.id);
  if (!Number.isFinite(rid)) return false;

  ensureRecipeIngredientMapSortOrderSchema(activeDb);
  const rimCols = getTableColumns(activeDb, 'recipe_ingredient_map');
  const rimHas = (col) => rimCols.map((c) => c.toLowerCase()).includes(col);
  if (!rimHas('sort_order')) return false;

  const rimHasSection = rimHas('section_id');

  const sections = Array.isArray(recipe?.sections) ? recipe.sections : [];
  sections.forEach((sec) => {
    const sid = rimHasSection ? sec?.ID ?? sec?.id ?? null : null;
    const list = Array.isArray(sec?.ingredients) ? sec.ingredients : [];
    const real = list.filter(
      (ing) => ing && !ing.isPlaceholder && ing.rimId != null
    );

    let n = 1;
    real.forEach((ing) => {
      const rimId = Number(ing.rimId);
      if (!Number.isFinite(rimId)) return;
      try {
        if (rimHasSection) {
          activeDb.run(
            'UPDATE recipe_ingredient_map SET sort_order = ? WHERE recipe_id = ? AND section_id IS ? AND ID = ?;',
            [n++, rid, sid ?? null, rimId]
          );
        } else {
          activeDb.run(
            'UPDATE recipe_ingredient_map SET sort_order = ? WHERE recipe_id = ? AND ID = ?;',
            [n++, rid, rimId]
          );
        }
      } catch (_) {
        // ignore
      }
    });
  });

  return true;
}
