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

function deriveIngredientLemma(rawTitle) {
  const t = String(rawTitle || '').trim();
  if (!t) return '';
  // Small heuristic singularizer (good enough for simple plurals).
  if (/^tomatoes$/i.test(t)) return t.slice(0, -2);
  if (/^potatoes$/i.test(t)) return t.slice(0, -2);
  if (/ies$/i.test(t) && t.length > 3) return t.slice(0, -3) + 'y';
  if (/(ch|sh|s|x|z)es$/i.test(t) && t.length > 2) return t.slice(0, -2);
  if (/ses$/i.test(t) && t.length > 3) return t.slice(0, -2);
  if (/s$/i.test(t) && !/ss$/i.test(t) && t.length > 1) return t.slice(0, -1);
  return t;
}

function regenerateAllIngredientLemmas(activeDb) {
  if (!activeDb || !tableExists(activeDb, 'ingredients')) return 0;
  const ingCols = getTableColumns(activeDb, 'ingredients');
  const ingColsLower = ingCols.map((c) => String(c).toLowerCase());
  if (!ingColsLower.includes('lemma')) return 0;
  const ingIdCol = pickIdColumn(ingCols);
  let changedCount = 0;
  let txStarted = false;
  let stmt = null;

  try {
    const rowsQ = activeDb.exec(
      `SELECT ${ingIdCol}, COALESCE(name, ''), COALESCE(lemma, '') FROM ingredients;`
    );
    const rows = rowsQ.length && Array.isArray(rowsQ[0].values) ? rowsQ[0].values : [];
    if (!rows.length) return 0;

    try {
      activeDb.run('BEGIN IMMEDIATE;');
      txStarted = true;
    } catch (_) {
      activeDb.run('BEGIN;');
      txStarted = true;
    }

    stmt = activeDb.prepare(`UPDATE ingredients SET lemma = ? WHERE ${ingIdCol} = ?;`);
    rows.forEach((row) => {
      const id = Array.isArray(row) ? row[0] : null;
      const name = Array.isArray(row) ? row[1] : '';
      const currentLemma = Array.isArray(row) ? row[2] : '';
      const nextLemma = deriveIngredientLemma(name);
      if (String(currentLemma || '') === String(nextLemma || '')) return;
      stmt.run([nextLemma, id]);
      changedCount += 1;
    });

    if (stmt) {
      stmt.free();
      stmt = null;
    }
    if (txStarted) activeDb.run('COMMIT;');
    return changedCount;
  } catch (err) {
    if (stmt) {
      try {
        stmt.free();
      } catch (_) {}
    }
    if (txStarted) {
      try {
        activeDb.run('ROLLBACK;');
      } catch (_) {}
    }
    throw err;
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

function ensureRecipeIngredientMapQuantityRangeSchema(activeDb) {
  if (!activeDb) return false;
  const rimCols = getTableColumns(activeDb, 'recipe_ingredient_map').map((c) =>
    String(c).toLowerCase()
  );

  if (!rimCols.includes('quantity_min')) {
    try {
      activeDb.run(
        'ALTER TABLE recipe_ingredient_map ADD COLUMN quantity_min REAL;'
      );
    } catch (_) {}
  }
  if (!rimCols.includes('quantity_max')) {
    try {
      activeDb.run(
        'ALTER TABLE recipe_ingredient_map ADD COLUMN quantity_max REAL;'
      );
    } catch (_) {}
  }
  if (!rimCols.includes('quantity_is_approx')) {
    try {
      activeDb.run(
        'ALTER TABLE recipe_ingredient_map ADD COLUMN quantity_is_approx INTEGER NOT NULL DEFAULT 0;'
      );
    } catch (_) {}
  }
  return true;
}

function ensureRecipeIngredientMapIsAltSchema(activeDb) {
  if (!activeDb) return false;
  const rimCols = getTableColumns(activeDb, 'recipe_ingredient_map').map((c) =>
    String(c).toLowerCase()
  );
  if (!rimCols.includes('is_alt')) {
    try {
      activeDb.run(
        'ALTER TABLE recipe_ingredient_map ADD COLUMN is_alt INTEGER NOT NULL DEFAULT 0;'
      );
    } catch (_) {}
  }
  return true;
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

function ensureRecipeIngredientMapDisplayNameSchema(activeDb) {
  if (!activeDb) return false;
  const cols = getTableColumns(activeDb, 'recipe_ingredient_map').map((c) =>
    String(c).toLowerCase()
  );
  if (!cols.includes('display_name')) {
    try {
      activeDb.run(
        'ALTER TABLE recipe_ingredient_map ADD COLUMN display_name TEXT;'
      );
    } catch (_) {}
  }
  return true;
}

function ensureRecipeIngredientMapVariantSizeSchema(activeDb) {
  if (!activeDb) return false;
  const cols = getTableColumns(activeDb, 'recipe_ingredient_map').map((c) =>
    String(c).toLowerCase()
  );
  if (!cols.includes('variant')) {
    try {
      activeDb.run(
        'ALTER TABLE recipe_ingredient_map ADD COLUMN variant TEXT;'
      );
    } catch (_) {}
  }
  if (!cols.includes('size')) {
    try {
      activeDb.run(
        'ALTER TABLE recipe_ingredient_map ADD COLUMN size TEXT;'
      );
    } catch (_) {}
  }
  // Backfill from ingredients table for existing rows that have no rim-level variant/size.
  try {
    activeDb.run(`
      UPDATE recipe_ingredient_map SET
        variant = COALESCE(variant, (SELECT i.variant FROM ingredients i WHERE i.ID = recipe_ingredient_map.ingredient_id)),
        size = COALESCE(size, (SELECT i.size FROM ingredients i WHERE i.ID = recipe_ingredient_map.ingredient_id))
      WHERE ingredient_id IS NOT NULL AND variant IS NULL AND size IS NULL;
    `);
  } catch (_) {}
  return true;
}

function ensureIngredientSynonymsSchema(activeDb) {
  if (!activeDb) return false;
  const exists = tableExists(activeDb, 'ingredient_synonyms');
  if (!exists) {
    try {
      activeDb.run(`
        CREATE TABLE IF NOT EXISTS ingredient_synonyms (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          ingredient_id INTEGER NOT NULL REFERENCES ingredients(ID),
          synonym       TEXT NOT NULL COLLATE NOCASE
        );
      `);
    } catch (_) {}
  }
  try {
    activeDb.run(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredient_synonyms_synonym ON ingredient_synonyms(synonym COLLATE NOCASE);'
    );
  } catch (_) {}
  return true;
}

function propagateIngredientGrammarFlags(activeDb) {
  if (!activeDb) return;
  try {
    activeDb.run(`
      UPDATE ingredients SET
        is_mass_noun = (
          SELECT MAX(COALESCE(s.is_mass_noun, 0))
          FROM ingredients s WHERE lower(s.name) = lower(ingredients.name)
        ),
        plural_by_default = (
          SELECT MAX(COALESCE(s.plural_by_default, 0))
          FROM ingredients s WHERE lower(s.name) = lower(ingredients.name)
        ),
        plural_override = CASE
          WHEN COALESCE(plural_override, '') = '' THEN COALESCE(
            (SELECT s.plural_override FROM ingredients s
             WHERE lower(s.name) = lower(ingredients.name)
               AND COALESCE(s.plural_override, '') != '' LIMIT 1),
            '')
          ELSE plural_override
        END
      WHERE COALESCE(is_mass_noun, 0) = 0
        AND COALESCE(plural_by_default, 0) = 0
        AND COALESCE(plural_override, '') = ''
        AND EXISTS (
          SELECT 1 FROM ingredients s
          WHERE lower(s.name) = lower(ingredients.name)
            AND s.ID != ingredients.ID
            AND (COALESCE(s.is_mass_noun, 0) != 0
              OR COALESCE(s.plural_by_default, 0) != 0
              OR COALESCE(s.plural_override, '') != '')
        );
    `);
  } catch (_) {}
}

function ensureRecipeTagsSchema(activeDb) {
  if (!activeDb) return false;
  try {
    activeDb.run('PRAGMA foreign_keys = ON;');
  } catch (_) {}
  try {
    activeDb.run(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL COLLATE NOCASE,
        is_hidden INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER
      );
    `);
  } catch (_) {}
  try {
    activeDb.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_nocase
      ON tags(name COLLATE NOCASE);
    `);
  } catch (_) {}
  try {
    activeDb.run(`
      CREATE TABLE IF NOT EXISTS recipe_tag_map (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL REFERENCES recipes(ID) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        sort_order INTEGER,
        UNIQUE(recipe_id, tag_id)
      );
    `);
  } catch (_) {}
  try {
    activeDb.run(`
      CREATE INDEX IF NOT EXISTS idx_recipe_tag_map_recipe
      ON recipe_tag_map(recipe_id, sort_order, id);
    `);
  } catch (_) {}
  try {
    activeDb.run(`
      CREATE INDEX IF NOT EXISTS idx_recipe_tag_map_tag
      ON recipe_tag_map(tag_id, recipe_id);
    `);
  } catch (_) {}
  return true;
}

function parseRecipeTags(rawTags) {
  if (rawTags == null) return [];
  const seen = new Set();
  const out = [];
  String(rawTags)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .forEach((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(tag);
    });
  return out;
}

window.bridge = {
  loadRecipeFromDB,
  saveRecipeToDB,
  saveRecipeStepsFromStepNodes,
  saveRecipeIngredientsFromModel,
  deriveIngredientLemma,
  regenerateAllIngredientLemmas,
  ensureRecipeIngredientMapSortOrderSchema,
  ensureRecipeIngredientHeadingsSchema,
  ensureRecipeIngredientMapParentheticalNoteSchema,
  ensureRecipeIngredientMapQuantityRangeSchema,
  ensureRecipeIngredientMapDisplayNameSchema,
  ensureIngredientSynonymsSchema,
  ensureRecipeTagsSchema,
  propagateIngredientGrammarFlags,
  ensureRecipeIngredientMapVariantSizeSchema,
  writeIngredientSortOrderFromModel,
};

// Load a recipe and all its pieces from the database into a full JS object.

function loadRecipeFromDB(db, recipeId) {
  ensureRecipeTagsSchema(db);
  const recipeRows = db.exec(`
    SELECT ID, title, servings_default, servings_min, servings_max
    FROM recipes WHERE ID = ${recipeId};
  `);
  if (!recipeRows.length) return null;

  const [id, title, servingsDefault, servingsMin, servingsMax] =
    recipeRows[0].values[0];
  let tags = [];
  try {
    const tagQ = db.exec(`
      SELECT t.name
      FROM recipe_tag_map m
      JOIN tags t ON t.id = m.tag_id
      WHERE m.recipe_id = ${id}
        AND COALESCE(t.is_hidden, 0) = 0
      ORDER BY COALESCE(m.sort_order, 999999), m.id, t.name COLLATE NOCASE;
    `);
    if (tagQ.length) {
      tags = tagQ[0].values
        .map((row) => String((Array.isArray(row) ? row[0] : '') || '').trim())
        .filter(Boolean);
    }
  } catch (_) {
    tags = [];
  }

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
  const hasQtyMin = rimHas('quantity_min');
  const hasQtyMax = rimHas('quantity_max');
  const hasQtyApprox = rimHas('quantity_is_approx');
  const hasIsRecipe = rimHas('is_recipe');
  const hasLinkedRecipeId = rimHas('linked_recipe_id');
  const hasRecipeText = rimHas('recipe_text');
  const hasLegacySubrecipeId = rimHas('subrecipe_id');
  const hasIsAlt = rimHas('is_alt');
  const hasDisplayName = rimHas('display_name');

  const ingCols = getTableColumns(db, 'ingredients');
  const ingHas = (col) => ingCols.map((c) => String(c).toLowerCase()).includes(col);
  const hasIngParen = ingHas('parenthetical_note');
  const hasLemma = ingHas('lemma');
  const hasPluralByDefault = ingHas('plural_by_default');
  const hasIsMassNoun = ingHas('is_mass_noun');
  const hasPluralOverride = ingHas('plural_override');
  const variantCols = getTableColumns(db, 'ingredient_variants');
  const variantHas = (col) =>
    variantCols.map((c) => String(c).toLowerCase()).includes(col);
  const recipeIngredientHomeLocationSql = variantHas('home_location')
    ? `(SELECT COALESCE(ivh.home_location, 'none')
        FROM ingredient_variants ivh
       WHERE ivh.ingredient_id = i.ID
         AND lower(trim(COALESCE(ivh.variant, ''))) IN ('', 'default')
       ORDER BY
         CASE
           WHEN lower(trim(COALESCE(ivh.variant, ''))) = 'default' THEN 0
           ELSE 1
         END,
         ivh.id ASC
       LIMIT 1) AS home_location`
    : "'none' AS home_location";
  const hasIngDeprecated = ingHas('is_deprecated');
  const hasIngHideLegacy = ingHas('hide_from_shopping_list');
  const ingredientDeprecatedSql = hasIngDeprecated
    ? 'COALESCE(i.is_deprecated, 0) AS ingredient_deprecated'
    : hasIngHideLegacy
      ? 'COALESCE(i.hide_from_shopping_list, 0) AS ingredient_deprecated'
      : '0 AS ingredient_deprecated';

  const linkedRecipeJoinIdSql = hasLinkedRecipeId
    ? hasLegacySubrecipeId
      ? 'COALESCE(rim.linked_recipe_id, rim.subrecipe_id)'
      : 'rim.linked_recipe_id'
    : hasLegacySubrecipeId
    ? 'rim.subrecipe_id'
    : null;
  const linkedRecipeTitleSql = linkedRecipeJoinIdSql ? 'lr.title' : 'NULL';
  const nonRecipeNameSql = hasDisplayName
    ? `CASE
         WHEN TRIM(COALESCE(rim.display_name, '')) != ''
              AND LOWER(TRIM(rim.display_name)) != LOWER(TRIM(i.name))
           THEN rim.display_name
         ELSE i.name
       END`
    : 'i.name';
  const recipeDisplayNameSql = hasIsRecipe
    ? hasRecipeText
      ? `CASE
           WHEN COALESCE(rim.is_recipe, 0) = 1
             THEN COALESCE(NULLIF(TRIM(rim.recipe_text), ''), ${linkedRecipeTitleSql}, i.name, '')
           ELSE ${nonRecipeNameSql}
         END AS name`
      : `CASE
           WHEN COALESCE(rim.is_recipe, 0) = 1
             THEN COALESCE(${linkedRecipeTitleSql}, i.name, '')
           ELSE ${nonRecipeNameSql}
         END AS name`
    : `${nonRecipeNameSql} AS name`;

  const selectParts = [
    'rim.ID',
    hasSectionId ? 'rim.section_id' : 'NULL AS section_id',
    hasSortOrder ? 'rim.sort_order' : 'NULL AS sort_order',
    'rim.quantity',
    hasQtyMin ? 'rim.quantity_min' : 'NULL AS quantity_min',
    hasQtyMax ? 'rim.quantity_max' : 'NULL AS quantity_max',
    hasQtyApprox ? 'COALESCE(rim.quantity_is_approx, 0) AS quantity_is_approx' : '0 AS quantity_is_approx',
    'rim.unit',
    recipeDisplayNameSql,
    rimHas('variant')
      ? "CASE WHEN rim.variant IS NULL THEN COALESCE(i.variant, '') ELSE COALESCE(rim.variant, '') END AS variant"
      : "COALESCE(i.variant, '') AS variant",
    rimHas('size')
      ? "CASE WHEN rim.size IS NULL THEN COALESCE(i.size, '') ELSE COALESCE(rim.size, '') END AS size"
      : "COALESCE(i.size, '') AS size",
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
    recipeIngredientHomeLocationSql,
    hasIsRecipe ? 'COALESCE(rim.is_recipe, 0) AS is_recipe' : '0 AS is_recipe',
    hasLinkedRecipeId
      ? 'rim.linked_recipe_id AS linked_recipe_id'
      : hasLegacySubrecipeId
      ? 'rim.subrecipe_id AS linked_recipe_id'
      : 'NULL AS linked_recipe_id',
    `${linkedRecipeTitleSql} AS linked_recipe_title`,
    hasRecipeText
      ? "COALESCE(rim.recipe_text, '') AS recipe_text"
      : "'' AS recipe_text",
    ingredientDeprecatedSql,
    hasIsAlt ? 'COALESCE(rim.is_alt, 0) AS is_alt' : '0 AS is_alt',
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
    LEFT JOIN ingredients i ON rim.ingredient_id = i.ID
    ${linkedRecipeJoinIdSql ? `LEFT JOIN recipes lr ON lr.ID = ${linkedRecipeJoinIdSql}` : ''}
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
          qtyMin,
          qtyMax,
          qtyApprox,
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
          isRecipe,
          linkedRecipeId,
          linkedRecipeTitle,
          recipeText,
          ingredientDeprecated,
          isAlt,
        ]) => ({
          rowType: 'ingredient',
          rimId,
          clientId: rimId != null ? `i-${rimId}` : null,
          sectionId: sectionId == null ? null : Number(sectionId),
          sortOrder: sortOrder == null ? null : Number(sortOrder),
          quantity:
            typeof qty === 'number'
              ? qty
              : typeof qty === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(qty)
              ? parseFloat(qty)
              : qty,
          quantityMin:
            Number.isFinite(Number(qtyMin)) && Number(qtyMin) > 0
              ? Number(qtyMin)
              : null,
          quantityMax:
            Number.isFinite(Number(qtyMax)) && Number(qtyMax) > 0
              ? Number(qtyMax)
              : null,
          quantityIsApprox: !!qtyApprox,
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
          isRecipe: (() => {
            const lid = Number(linkedRecipeId);
            return Number(isRecipe) === 1 && Number.isFinite(lid) && lid > 0;
          })(),
          linkedRecipeId: (() => {
            const lid = Number(linkedRecipeId);
            return Number.isFinite(lid) && lid > 0 ? lid : null;
          })(),
          linkedRecipeTitle:
            linkedRecipeTitle == null ? '' : String(linkedRecipeTitle).trim(),
          recipeText: recipeText == null ? '' : String(recipeText).trim(),
          isDeprecated: !!ingredientDeprecated,
          isAlt: !!isAlt,
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
    tags,
    sections,
  };
}

function saveRecipeToDB(db, recipe) {
  const activeDb = db || window.dbInstance;
  if (!activeDb) throw new Error('No active database found');
  const rid = recipe.id || window.recipeId;
  if (!rid) throw new Error('No recipe id');

  const normalizeStepInstructions = (raw) => {
    if (raw == null) return '';
    let next = String(raw);
    next = next.replace(/[\u200B-\u200D\uFEFF]/g, '');
    next = next.replace(/\s+/g, ' ');
    next = next.trim();
    next = next.replace(/\s+([.,!?:;])/g, '$1');
    next = next.replace(/([.,!?:;])\s+/g, '$1 ');
    next = next.trim();
    if (/^[.,!?:;]+$/.test(next)) return '';
    return next;
  };

  // 1) Gather model steps by section (source of truth for text/section)
  const sections = Array.isArray(recipe.sections) ? recipe.sections : [];
  const byId = new Map(); // stepId -> {section_id, instructions, ID}
  const bySection = new Map(); // section_id|null -> [{ID, instructions}]
  sections.forEach((sec) => {
    const sid = sec.ID ?? sec.id ?? null;
    (sec.steps || []).forEach((s) => {
      const normalizedInstructions = normalizeStepInstructions(s.instructions);
      if (!normalizedInstructions) return;
      const stepId = s.ID ?? s.id ?? null;
      if (stepId != null) {
        byId.set(String(stepId), {
          ID: stepId,
          section_id: s.section_id ?? sid,
          instructions: normalizedInstructions,
        });
      }
    });
    bySection.set(
      sid,
      (sec.steps || [])
        .map((s) => ({
          ID: s.ID ?? s.id ?? null,
          section_id: s.section_id ?? sid,
          instructions: normalizeStepInstructions(s.instructions),
        }))
        .filter((s) => !!s.instructions)
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
  // Ensure schema supports structured quantity range fields.
  ensureRecipeIngredientMapQuantityRangeSchema(activeDb);
  // Ensure display_name column exists for preserving typed ingredient names.
  ensureRecipeIngredientMapDisplayNameSchema(activeDb);
  // Ensure variant/size columns exist on recipe_ingredient_map.
  ensureRecipeIngredientMapVariantSizeSchema(activeDb);
  // Ensure ingredient synonyms table exists.
  ensureIngredientSynonymsSchema(activeDb);
  // Ensure schema supports is_alt flag.
  ensureRecipeIngredientMapIsAltSchema(activeDb);
  // Repair any same-name ingredients missing grammar flags from a sibling.
  propagateIngredientGrammarFlags(activeDb);

  const ingredientsCols = getTableColumns(activeDb, 'ingredients');
  const rimCols = getTableColumns(activeDb, 'recipe_ingredient_map');
  const ingIdCol = pickIdColumn(ingredientsCols);

  const rimHas = (col) => rimCols.map((c) => c.toLowerCase()).includes(col);
  const ingHas = (col) =>
    ingredientsCols.map((c) => c.toLowerCase()).includes(col);
  const ingredientVariantCols = getTableColumns(activeDb, 'ingredient_variants');
  const variantHas = (col) =>
    ingredientVariantCols.map((c) => String(c).toLowerCase()).includes(col);
  const hasVariantTable = ingredientVariantCols.length > 0;

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

    // Match on name only — variant/size are per-recipe-line (stored on rim).
    let foundId = null;
    const selStmt = activeDb.prepare(
      `SELECT ${ingIdCol} AS id FROM ingredients WHERE lower(name) = lower(?) LIMIT 1;`
    );
    try {
      selStmt.bind([name]);
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

    // Check synonym table before creating a new ingredient.
    try {
      const synStmt = activeDb.prepare(
        `SELECT ingredient_id FROM ingredient_synonyms
         WHERE lower(trim(synonym)) = lower(trim(?))
         LIMIT 1;`
      );
      try {
        synStmt.bind([name]);
        if (synStmt.step()) {
          const row = synStmt.getAsObject();
          const v = row && row.ingredient_id != null ? Number(row.ingredient_id) : NaN;
          if (Number.isFinite(v)) foundId = v;
        }
      } finally {
        synStmt.free();
      }
      if (foundId != null) return foundId;
    } catch (_) {}

    // Insert new ingredient row — variant/size belong on recipe_ingredient_map now.
    const cols = ['name'];
    const vals = [name];

    if (ingHas('lemma')) {
      cols.push('lemma');
      vals.push(deriveIngredientLemma(name));
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
      const newIngredientId = Number(idQ[0].values[0][0]);
      if (
        Number.isFinite(newIngredientId) &&
        hasVariantTable &&
        variantHas('ingredient_id') &&
        variantHas('variant')
      ) {
        const variantInsertCols = ['ingredient_id', 'variant'];
        const variantInsertVals = [newIngredientId, 'default'];
        if (variantHas('sort_order')) {
          variantInsertCols.push('sort_order');
          variantInsertVals.push(0);
        }
        if (variantHas('home_location')) {
          variantInsertCols.push('home_location');
          variantInsertVals.push('none');
        }
        const variantPlaceholders = variantInsertCols.map(() => '?').join(', ');
        try {
          activeDb.run(
            `INSERT INTO ingredient_variants (${variantInsertCols.join(
              ', ',
            )}) VALUES (${variantPlaceholders});`,
            variantInsertVals,
          );
        } catch (_) {}
      }
      return newIngredientId;
    }
    throw new Error(
      'saveRecipeIngredientsFromModel: failed to insert ingredient'
    );
  };

  const rimHasSection = rimHas('section_id');
  const rimHasSortOrder = rimHas('sort_order');
  const rimHasQtyMin = rimHas('quantity_min');
  const rimHasQtyMax = rimHas('quantity_max');
  const rimHasQtyApprox = rimHas('quantity_is_approx');
  const rimHasIsRecipe = rimHas('is_recipe');
  const rimHasLinkedRecipeId = rimHas('linked_recipe_id');
  const rimHasRecipeText = rimHas('recipe_text');
  const rimHasIsAlt = rimHas('is_alt');
  const rimHasDisplayName = rimHas('display_name');

  const rihCols = getTableColumns(activeDb, 'recipe_ingredient_headings');
  const rihHas = (col) =>
    rihCols.map((c) => String(c).toLowerCase()).includes(col);
  const rihHasSection = rihHas('section_id');
  const rihHasSortOrder = rihHas('sort_order');

  const normalizeSortOrder = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n);
  };

  const readSectionMaxSortOrder = (sectionId) => {
    const maxes = [];
    try {
      if (rimHasSortOrder) {
        const rimSql = rimHasSection
          ? 'SELECT COALESCE(MAX(sort_order), 0) AS m FROM recipe_ingredient_map WHERE recipe_id = ? AND section_id IS ?;'
          : 'SELECT COALESCE(MAX(sort_order), 0) AS m FROM recipe_ingredient_map WHERE recipe_id = ?;';
        const rimStmt = activeDb.prepare(rimSql);
        try {
          rimStmt.bind(rimHasSection ? [rid, sectionId ?? null] : [rid]);
          if (rimStmt.step()) {
            const row = rimStmt.getAsObject();
            const v = Number(row?.m);
            if (Number.isFinite(v)) maxes.push(v);
          }
        } finally {
          rimStmt.free();
        }
      }
    } catch (_) {}
    try {
      if (rihHasSortOrder) {
        const rihSql = rihHasSection
          ? 'SELECT COALESCE(MAX(sort_order), 0) AS m FROM recipe_ingredient_headings WHERE recipe_id = ? AND section_id IS ?;'
          : 'SELECT COALESCE(MAX(sort_order), 0) AS m FROM recipe_ingredient_headings WHERE recipe_id = ?;';
        const rihStmt = activeDb.prepare(rihSql);
        try {
          rihStmt.bind(rihHasSection ? [rid, sectionId ?? null] : [rid]);
          if (rihStmt.step()) {
            const row = rihStmt.getAsObject();
            const v = Number(row?.m);
            if (Number.isFinite(v)) maxes.push(v);
          }
        } finally {
          rihStmt.free();
        }
      }
    } catch (_) {}
    if (!maxes.length) return 1;
    return Math.max(...maxes) + 1;
  };

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
      const linkedRecipeId = Number(row.linkedRecipeId);
      const hasLinkedRecipe = Number.isFinite(linkedRecipeId) && linkedRecipeId > 0;
      if (row.isRecipe && hasLinkedRecipe) return true;
      return (row.name || '').trim() !== '';
    });

    let nextSort = readSectionMaxSortOrder(sectionId);
    realRows.forEach((row) => {
      if (isHeadingRow(row)) {
        const text = (row.text != null ? String(row.text) : '').trim();
        const headingId =
          row.headingId != null ? Number(row.headingId) : null;
        const isExisting = headingId != null && existingHeadingIds.has(headingId);
        let assignedSort = normalizeSortOrder(row.sortOrder);
        if (assignedSort == null && !isExisting) {
          assignedSort = nextSort++;
        } else if (assignedSort != null && assignedSort >= nextSort) {
          nextSort = assignedSort + 1;
        }

        try {
          if (isExisting) {
            if (rihHasSection) {
              if (assignedSort != null) {
                activeDb.run(
                  'UPDATE recipe_ingredient_headings SET section_id = ?, sort_order = ?, text = ? WHERE recipe_id = ? AND ID = ?;',
                  [sectionId ?? null, assignedSort, text, rid, headingId]
                );
              } else {
                activeDb.run(
                  'UPDATE recipe_ingredient_headings SET section_id = ?, text = ? WHERE recipe_id = ? AND ID = ?;',
                  [sectionId ?? null, text, rid, headingId]
                );
              }
            } else {
              if (assignedSort != null) {
                activeDb.run(
                  'UPDATE recipe_ingredient_headings SET sort_order = ?, text = ? WHERE recipe_id = ? AND ID = ?;',
                  [assignedSort, text, rid, headingId]
                );
              } else {
                activeDb.run(
                  'UPDATE recipe_ingredient_headings SET text = ? WHERE recipe_id = ? AND ID = ?;',
                  [text, rid, headingId]
                );
              }
            }
            keptHeadingIds.add(headingId);
          } else {
            if (rihHasSection) {
              if (assignedSort != null) {
                activeDb.run(
                  'INSERT INTO recipe_ingredient_headings (recipe_id, section_id, sort_order, text) VALUES (?, ?, ?, ?);',
                  [rid, sectionId ?? null, assignedSort, text]
                );
              } else {
                activeDb.run(
                  'INSERT INTO recipe_ingredient_headings (recipe_id, section_id, text) VALUES (?, ?, ?);',
                  [rid, sectionId ?? null, text]
                );
              }
            } else {
              if (assignedSort != null) {
                activeDb.run(
                  'INSERT INTO recipe_ingredient_headings (recipe_id, sort_order, text) VALUES (?, ?, ?);',
                  [rid, assignedSort, text]
                );
              } else {
                activeDb.run(
                  'INSERT INTO recipe_ingredient_headings (recipe_id, text) VALUES (?, ?);',
                  [rid, text]
                );
              }
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

        if (assignedSort != null) row.sortOrder = assignedSort;
        return;
      }

      const ing = row;
      const rimId = ing.rimId != null ? Number(ing.rimId) : null;
      const isExisting = rimId != null && existingIds.has(rimId);
      let assignedSort = normalizeSortOrder(ing.sortOrder);
      if (assignedSort == null && !isExisting) {
        assignedSort = nextSort++;
      } else if (assignedSort != null && assignedSort >= nextSort) {
        nextSort = assignedSort + 1;
      }
      if (assignedSort != null) ing.sortOrder = assignedSort;

      const linkedRecipeIdRaw = Number(ing.linkedRecipeId);
      const normalizedLinkedRecipeId =
        Number.isFinite(linkedRecipeIdRaw) &&
        linkedRecipeIdRaw > 0 &&
        linkedRecipeIdRaw !== rid
          ? linkedRecipeIdRaw
          : null;
      const normalizedIsRecipe = !!(ing.isRecipe && normalizedLinkedRecipeId != null);
      const ingredientId = normalizedIsRecipe ? null : findOrCreateIngredientId(ing);

      // Build common column sets
      const cols = ['recipe_id', 'ingredient_id'];
      const vals = [rid, ingredientId];

      if (rimHasSection) {
        cols.push('section_id');
        vals.push(sectionId ?? null);
      }
      if (rimHas('quantity')) {
        const quantityRaw = ing.quantity;
        let normalizedQuantity = quantityRaw ?? '';
        const quantityNum = Number(quantityRaw);
        if (Number.isFinite(quantityNum) && quantityNum <= 0) {
          normalizedQuantity = '';
        }
        cols.push('quantity');
        vals.push(normalizedQuantity);
      }
      if (rimHasQtyMin) {
        cols.push('quantity_min');
        const minVal = Number.isFinite(Number(ing.quantityMin))
          ? Number(ing.quantityMin) > 0
            ? Number(ing.quantityMin)
            : null
          : Number.isFinite(Number(ing.quantity)) && Number(ing.quantity) > 0
          ? Number(ing.quantity)
          : null;
        vals.push(minVal);
      }
      if (rimHasQtyMax) {
        cols.push('quantity_max');
        const maxVal = Number.isFinite(Number(ing.quantityMax))
          ? Number(ing.quantityMax) > 0
            ? Number(ing.quantityMax)
            : null
          : Number.isFinite(Number(ing.quantity)) && Number(ing.quantity) > 0
          ? Number(ing.quantity)
          : null;
        vals.push(maxVal);
      }
      if (rimHasQtyApprox) {
        cols.push('quantity_is_approx');
        vals.push(ing.quantityIsApprox ? 1 : 0);
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
      if (rimHasIsRecipe) {
        cols.push('is_recipe');
        vals.push(normalizedIsRecipe ? 1 : 0);
      }
      if (rimHasLinkedRecipeId) {
        cols.push('linked_recipe_id');
        vals.push(normalizedIsRecipe ? normalizedLinkedRecipeId : null);
      }
      if (rimHasRecipeText) {
        cols.push('recipe_text');
        vals.push(
          normalizedIsRecipe ? (ing.name || ing.recipeText || '').trim() : ''
        );
      }
      if (rimHasSortOrder && assignedSort != null) {
        cols.push('sort_order');
        vals.push(assignedSort);
      }
      if (rimHasIsAlt) {
        cols.push('is_alt');
        vals.push(ing.isAlt ? 1 : 0);
      }
      if (rimHasDisplayName && !normalizedIsRecipe) {
        cols.push('display_name');
        const typed = (ing.name || '').trim();
        let canonicalIngName = '';
        if (ingredientId != null) {
          try {
            const cq = activeDb.exec(
              `SELECT name FROM ingredients WHERE ${ingIdCol} = ? LIMIT 1;`,
              [ingredientId],
            );
            if (cq.length && cq[0].values.length) {
              canonicalIngName = String(cq[0].values[0][0] || '').trim();
            }
          } catch (_) {}
        }
        vals.push(
          typed.toLowerCase() === canonicalIngName.toLowerCase() ? null : typed,
        );
      }
      if (rimHas('variant')) {
        cols.push('variant');
        vals.push((ing.variant || '').trim());
      }
      if (rimHas('size')) {
        cols.push('size');
        vals.push((ing.size || '').trim());
      }

      // Update existing row if we have a valid rimId still present in DB.
      if (isExisting) {
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

    real.forEach((ing) => {
      const rimId = Number(ing.rimId);
      const sortOrder = Number(ing.sortOrder);
      if (!Number.isFinite(rimId)) return;
      if (!Number.isFinite(sortOrder) || sortOrder <= 0) return;
      try {
        if (rimHasSection) {
          activeDb.run(
            'UPDATE recipe_ingredient_map SET sort_order = ? WHERE recipe_id = ? AND section_id IS ? AND ID = ?;',
            [Math.floor(sortOrder), rid, sid ?? null, rimId]
          );
        } else {
          activeDb.run(
            'UPDATE recipe_ingredient_map SET sort_order = ? WHERE recipe_id = ? AND ID = ?;',
            [Math.floor(sortOrder), rid, rimId]
          );
        }
      } catch (_) {
        // ignore
      }
    });
  });

  return true;
}
