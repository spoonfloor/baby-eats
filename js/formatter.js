function formatRecipe(db, recipeId) {
  // Title + Servings
  const recipeTitleQuery = db.exec(
    `SELECT title, servings_default, servings_min, servings_max FROM recipes WHERE ID=${recipeId};`
  );
  let title = 'Untitled';
  let servingsDefault = null;
  let servingsMin = null;
  let servingsMax = null;
  let tags = [];
  if (recipeTitleQuery.length) {
    const row = recipeTitleQuery[0].values[0];
    title = row[0];
    servingsDefault = row[1];
    servingsMin = row[2];
    servingsMax = row[3];
  }
  try {
    const tagQ = db.exec(`
      SELECT t.name
      FROM recipe_tag_map m
      JOIN tags t ON t.id = m.tag_id
      WHERE m.recipe_id = ${recipeId}
      ORDER BY COALESCE(m.sort_order, 999999), m.id, t.name COLLATE NOCASE;
    `);
    if (tagQ.length) {
      tags = tagQ[0].values
        .map((r) => String((Array.isArray(r) ? r[0] : '') || '').trim())
        .filter(Boolean);
    }
  } catch (_) {}

  // Sections (may be empty)
  const sectionsQuery = db.exec(
    `SELECT ID, name FROM recipe_sections WHERE recipe_id=${recipeId} ORDER BY sort_order;`
  );
  const sectionRows = sectionsQuery.length ? sectionsQuery[0].values : [];

  // Helpers
  const tableExists = (name) => {
    try {
      const q = db.exec(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='${String(
          name
        ).replace(/'/g, "''")}';`
      );
      return !!(q && q.length && q[0].values && q[0].values.length);
    } catch (_) {
      return false;
    }
  };

  const rimCols = (() => {
    try {
      const info = db.exec('PRAGMA table_info(recipe_ingredient_map);');
      const rows = info.length ? info[0].values : [];
      return rows.map((r) => String(r[1] || '').toLowerCase());
    } catch (_) {
      return [];
    }
  })();
  const rimHasSortOrder = rimCols.includes('sort_order');
  const rimHasSectionId = rimCols.includes('section_id');
  const rimHasParen = rimCols.includes('parenthetical_note');
  const rimHasIsRecipe = rimCols.includes('is_recipe');
  const rimHasLinkedRecipeId = rimCols.includes('linked_recipe_id');
  const rimHasRecipeText = rimCols.includes('recipe_text');
  const rimHasLegacySubrecipeId = rimCols.includes('subrecipe_id');
  const linkedRecipeJoinIdSql = rimHasLinkedRecipeId
    ? rimHasLegacySubrecipeId
      ? 'COALESCE(rim.linked_recipe_id, rim.subrecipe_id)'
      : 'rim.linked_recipe_id'
    : rimHasLegacySubrecipeId
    ? 'rim.subrecipe_id'
    : null;
  const linkedRecipeTitleSql = linkedRecipeJoinIdSql ? 'lr.title' : 'NULL';

  const ingCols = (() => {
    try {
      const info = db.exec('PRAGMA table_info(ingredients);');
      const rows = info.length ? info[0].values : [];
      return rows.map((r) => String(r[1] || '').toLowerCase());
    } catch (_) {
      return [];
    }
  })();
  const ingHasParen = ingCols.includes('parenthetical_note');
  const ingHasLemma = ingCols.includes('lemma');
  const ingHasPluralByDefault = ingCols.includes('plural_by_default');
  const ingHasIsMassNoun = ingCols.includes('is_mass_noun');
  const ingHasPluralOverride = ingCols.includes('plural_override');
  const variantCols = (() => {
    try {
      const info = db.exec('PRAGMA table_info(ingredient_variants);');
      const rows = info.length ? info[0].values : [];
      return rows.map((r) => String(r[1] || '').toLowerCase());
    } catch (_) {
      return [];
    }
  })();
  const variantHasDep = variantCols.includes('is_deprecated');
  const variantDeprecatedSelectSql = variantHasDep
    ? `(SELECT COALESCE((SELECT ivd.is_deprecated FROM ingredient_variants ivd WHERE ivd.ingredient_id = COALESCE(rim.ingredient_id, i.ID) AND lower(trim(COALESCE(ivd.variant, ''))) = lower(trim(COALESCE(CASE WHEN rim.variant IS NULL THEN COALESCE(i.variant, '') ELSE COALESCE(rim.variant, '') END, ''))) LIMIT 1), 0) AS variant_deprecated`
    : '0 AS variant_deprecated';
  const ingredientHomeLocationSql = variantCols.includes('home_location')
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
       LIMIT 1)`
    : "'none'";

  function loadHeadings(whereClause) {
    if (!tableExists('recipe_ingredient_headings')) return [];
    try {
      const q = db.exec(
        `
        SELECT ID, sort_order, text
        FROM recipe_ingredient_headings
        WHERE recipe_id=${recipeId} AND ${whereClause}
        ORDER BY COALESCE(sort_order, 999999), ID;
        `
      );
      if (!q.length) return [];
      return q[0].values.map(([id, sortOrder, text]) => ({
        rowType: 'heading',
        headingId: id,
        sortOrder: sortOrder == null ? null : Number(sortOrder),
        text: text == null ? '' : String(text),
      }));
    } catch (_) {
      return [];
    }
  }

  function loadIngredients(whereClause) {
    const q = db.exec(
      `
      SELECT rim.ID,
             ${rimHasSortOrder ? 'rim.sort_order,' : 'NULL AS sort_order,'}
             rim.quantity,
             rim.unit,
             ${
               rimHasIsRecipe
                 ? rimHasRecipeText
                   ? `CASE
                        WHEN COALESCE(rim.is_recipe, 0) = 1
                          THEN COALESCE(NULLIF(TRIM(rim.recipe_text), ''), ${linkedRecipeTitleSql}, i.name, '')
                        ELSE i.name
                      END AS name,`
                   : `CASE
                        WHEN COALESCE(rim.is_recipe, 0) = 1
                          THEN COALESCE(${linkedRecipeTitleSql}, i.name, '')
                        ELSE i.name
                      END AS name,`
                 : 'i.name,'
             }
             ${rimCols.includes('variant') ? "CASE WHEN rim.variant IS NULL THEN COALESCE(i.variant, '') ELSE COALESCE(rim.variant, '') END" : "COALESCE(i.variant, '')"} AS variant,
             ${rimCols.includes('size') ? "CASE WHEN rim.size IS NULL THEN COALESCE(i.size, '') ELSE COALESCE(rim.size, '') END" : "COALESCE(i.size, '')"} AS size,
             ${ingHasLemma ? 'i.lemma,' : 'NULL AS lemma,'}
             ${
               ingHasPluralByDefault
                 ? 'COALESCE(i.plural_by_default, 0) AS plural_by_default,'
                 : '0 AS plural_by_default,'
             }
             ${
               ingHasIsMassNoun
                 ? 'COALESCE(i.is_mass_noun, 0) AS is_mass_noun,'
                 : '0 AS is_mass_noun,'
             }
             ${
               ingHasPluralOverride
                 ? "COALESCE(i.plural_override, '') AS plural_override,"
                 : "'' AS plural_override,"
             }
             rim.prep_notes,
             rim.is_optional,
             ${
               rimHasParen
                 ? "COALESCE(rim.parenthetical_note, '')"
                 : ingHasParen
                 ? "COALESCE(i.parenthetical_note, '')"
                 : "''"
             },
             ${ingredientHomeLocationSql},
             ${
               rimHasIsRecipe
                 ? 'COALESCE(rim.is_recipe, 0)'
                 : '0'
             },
             ${
               rimHasLinkedRecipeId
                 ? 'rim.linked_recipe_id'
                 : rimHasLegacySubrecipeId
                 ? 'rim.subrecipe_id'
                 : 'NULL'
             },
             ${linkedRecipeTitleSql},
             ${rimHasRecipeText ? "COALESCE(rim.recipe_text, '')" : "''"},
             ${variantDeprecatedSelectSql}
      FROM recipe_ingredient_map rim
      LEFT JOIN ingredients i ON rim.ingredient_id = i.ID
      ${linkedRecipeJoinIdSql ? `LEFT JOIN recipes lr ON lr.ID = ${linkedRecipeJoinIdSql}` : ''}
      WHERE rim.recipe_id=${recipeId} AND ${whereClause}
      ORDER BY ${
        rimHasSortOrder ? 'COALESCE(rim.sort_order, 999999), rim.ID' : 'rim.ID'
      };
      `
    );

    if (!q.length) return [];

    return q[0].values.map(
      ([
        rimId,
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
        isRecipe,
        linkedRecipeId,
        linkedRecipeTitle,
        recipeText,
        variantDeprecated,
      ]) => {
        // Fetch substitutes for this ingredient
        const subsQ = db.exec(
          `SELECT r.quantity,
                  r.unit,
                  i.name,
                  i.variant
           FROM recipe_ingredient_substitutes r
           JOIN ingredients i ON r.ingredient_id = i.ID
           WHERE r.recipe_ingredient_id=${rimId};`
        );

        const substitutes = subsQ.length
          ? subsQ[0].values.map(([sQty, sUnit, sName, sVariant]) => ({
              quantity: parseFloat(sQty) || sQty,
              unit: sUnit || '',
              name: sName,
              variant: sVariant || '',
            }))
          : [];
        const linkedRecipeIdRaw = Number(linkedRecipeId);
        const normalizedLinkedRecipeId =
          Number.isFinite(linkedRecipeIdRaw) && linkedRecipeIdRaw > 0
            ? linkedRecipeIdRaw
            : null;
        const normalizedRecipeText =
          recipeText == null ? '' : String(recipeText).trim();
        const normalizedLinkedRecipeTitle =
          linkedRecipeTitle == null ? '' : String(linkedRecipeTitle).trim();
        const normalizedIsRecipe =
          Number(isRecipe) === 1 && normalizedLinkedRecipeId != null;

        return {
          rowType: 'ingredient',
          quantity: isNaN(parseFloat(qty)) ? qty : parseFloat(qty),

          unit: unit || '',
          name,
          variant: variant || '',
          size: size || '',
          lemma: lemma || '',
          pluralByDefault: !!pluralByDefault,
          isMassNoun: !!isMassNoun,
          pluralOverride: pluralOverride || '',
          prepNotes: prepNotes || '',
          parentheticalNote: parentheticalNote || '',
          isOptional: !!isOptional,
          substitutes,
          locationAtHome: locationAtHome ? locationAtHome.toLowerCase() : '',
          isRecipe: normalizedIsRecipe,
          linkedRecipeId: normalizedLinkedRecipeId,
          linkedRecipeTitle: normalizedLinkedRecipeTitle,
          recipeText: normalizedRecipeText,
          variantDeprecated: !!variantDeprecated,
          rimId,
          sortOrder: sortOrder == null ? null : Number(sortOrder),
        };
      }
    );
  }

  function loadSteps(whereClause) {
    const q = db.exec(
      `SELECT ID, instructions
       FROM recipe_steps
       WHERE recipe_id=${recipeId} AND ${whereClause}
       ORDER BY step_number;`
    );
    return q.length
      ? q[0].values.map(([id, instructions]) => ({ ID: id, instructions }))
      : [];
  }

  // Build sections
  let sections = sectionRows.map(([id, name]) => ({
    name,
    contexts: [],
    ingredients: (() => {
      const ing = loadIngredients(`rim.section_id=${id}`);
      const heads = loadHeadings(`section_id=${id}`);
      const combined = [...heads, ...ing].sort((a, b) => {
        const sa = a && a.sortOrder != null ? Number(a.sortOrder) : 999999;
        const sb = b && b.sortOrder != null ? Number(b.sortOrder) : 999999;
        if (sa !== sb) return sa - sb;
        const ta = a && a.rowType === 'heading' ? 0 : 1;
        const tb = b && b.rowType === 'heading' ? 0 : 1;
        if (ta !== tb) return ta - tb;
        return 0;
      });
      return combined;
    })(),
    steps: loadSteps(`section_id=${id}`),
  }));

  // Fallback for global (no-section) items
  const globalIngredients = (() => {
    const where = rimHasSectionId ? `rim.section_id IS NULL` : `1=1`;
    const ing = loadIngredients(where);
    const heads = loadHeadings(`section_id IS NULL`);
    const combined = [...heads, ...ing].sort((a, b) => {
      const sa = a && a.sortOrder != null ? Number(a.sortOrder) : 999999;
      const sb = b && b.sortOrder != null ? Number(b.sortOrder) : 999999;
      if (sa !== sb) return sa - sb;
      const ta = a && a.rowType === 'heading' ? 0 : 1;
      const tb = b && b.rowType === 'heading' ? 0 : 1;
      if (ta !== tb) return ta - tb;
      return 0;
    });
    return combined;
  })();
  const globalSteps = loadSteps(`section_id IS NULL`);
  if (globalIngredients.length || globalSteps.length) {
    sections = [
      {
        name: null,
        contexts: [],
        ingredients: globalIngredients,
        steps: globalSteps,
      },
      ...sections,
    ];
  }

  return {
    title,
    servings: {
      default: servingsDefault,
      min: servingsMin,
      max: servingsMax,
    },
    servingsDefault, // ← ✅ add this line
    tags,
    sections,
  };
}

window.formatRecipe = formatRecipe;
