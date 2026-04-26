/* global supabase */
(function initSupabaseDataApi(global) {
  if (!global) return;

  const SUPABASE_URL =
    String(global.__SUPABASE_URL__ || 'https://ieancejhyihxpazturiz.supabase.co').trim();
  const SUPABASE_ANON_KEY =
    String(
      global.__SUPABASE_ANON_KEY__ ||
        'sb_publishable_OEspL1dwwLl7aOAH6Q8bCg_1jKnbkzu'
    ).trim();

  function toErrorMessage(err, fallback) {
    if (!err) return fallback;
    if (err instanceof Error && err.message) return err.message;
    if (typeof err?.message === 'string' && err.message.trim()) {
      return err.message.trim();
    }
    if (typeof err === 'string' && err.trim()) return err.trim();
    return fallback;
  }

  function normalizeTagNames(raw) {
    const source = Array.isArray(raw) ? raw : [];
    const seen = new Set();
    const out = [];
    source.forEach((v) => {
      const tag = String(v || '').trim().replace(/\s+/g, ' ');
      if (!tag) return;
      const clipped = tag.length > 48 ? tag.slice(0, 48).trim() : tag;
      if (!clipped) return;
      const key = clipped.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(clipped);
    });
    return out;
  }

  function assertSupabaseGlobals() {
    if (!global.supabase || typeof global.supabase.createClient !== 'function') {
      throw new Error('Supabase client library is not loaded.');
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase URL/key for web app.');
    }
  }

  function getSupabase() {
    assertSupabaseGlobals();
    if (!global.__favoriteEatsSupabaseClient) {
      global.__favoriteEatsSupabaseClient = global.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        { auth: { persistSession: false } }
      );
    }
    return global.__favoriteEatsSupabaseClient;
  }

  async function listVisibleTags() {
    const client = getSupabase();
    const { data, error } = await client
      .from('tags')
      .select('id,name,is_hidden,intended_use,sort_order')
      .eq('is_hidden', 0)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });
    if (error) throw error;
    const seen = new Set();
    return (Array.isArray(data) ? data : [])
      .filter(
        (row) =>
          String(row?.name || '').trim() &&
          String(row?.intended_use || 'recipes').trim().toLowerCase() === 'recipes'
      )
      .map((row) => String(row.name || '').trim())
      .filter((name) => {
        const key = name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function normalizeRecipeRow(row) {
    const tagRows = Array.isArray(row?.recipe_tag_map) ? row.recipe_tag_map : [];
    const tags = tagRows
      .filter((m) => Number(m?.tags?.is_hidden || 0) === 0)
      .sort((a, b) => Number(a?.sort_order || 999999) - Number(b?.sort_order || 999999))
      .map((m) => String(m?.tags?.name || '').trim())
      .filter(Boolean);
    return {
      id: row.id,
      title: String(row?.title || ''),
      servings_default: row?.servings_default,
      servings_min: row?.servings_min,
      servings_max: row?.servings_max,
      tags,
    };
  }

  async function listRecipes() {
    const client = getSupabase();
    const { data, error } = await client
      .from('recipes')
      .select(
        `
      id,
      title,
      servings_default,
      servings_min,
      servings_max,
      recipe_tag_map (
        sort_order,
        tags (
          name,
          is_hidden
        )
      )
    `
      )
      .order('title', { ascending: true });
    if (error) throw error;
    return (Array.isArray(data) ? data : []).map(normalizeRecipeRow);
  }

  async function getRecipeById(recipeId) {
    const rid = Number(recipeId);
    if (!Number.isFinite(rid) || rid <= 0) return null;
    const client = getSupabase();
    const { data, error } = await client
      .from('recipes')
      .select(
        `
      id,
      title,
      servings_default,
      servings_min,
      servings_max,
      recipe_tag_map (
        sort_order,
        tags (
          name,
          is_hidden
        )
      )
    `
      )
      .eq('id', rid)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const normalized = normalizeRecipeRow(data);
    return {
      id: normalized.id,
      title: normalized.title,
      servings: {
        default: normalized.servings_default,
        min: normalized.servings_min,
        max: normalized.servings_max,
      },
      tags: normalized.tags,
      sections: [],
    };
  }

  async function createRecipe(payload = {}) {
    const client = getSupabase();
    const title = String(payload?.title || '').trim();
    const servingsMin = payload?.servings_min ?? 0.5;
    const servingsMax = payload?.servings_max ?? 99;

    const attemptWithServings = await client
      .from('recipes')
      .insert({
        title,
        servings_min: servingsMin,
        servings_max: servingsMax,
      })
      .select('id')
      .single();
    if (!attemptWithServings.error) {
      return attemptWithServings.data?.id ?? null;
    }

    const attemptTitleOnly = await client
      .from('recipes')
      .insert({ title })
      .select('id')
      .single();
    if (!attemptTitleOnly.error) {
      return attemptTitleOnly.data?.id ?? null;
    }

    throw new Error(
      `${toErrorMessage(attemptWithServings.error, 'Create failed.')} | fallback: ${toErrorMessage(
        attemptTitleOnly.error,
        'Create failed.'
      )}`
    );
  }

  async function deleteRecipe(recipeId) {
    const rid = Number(recipeId);
    if (!Number.isFinite(rid) || rid <= 0) return false;
    const client = getSupabase();
    const { error } = await client.from('recipes').delete().eq('id', rid);
    if (error) throw error;
    return true;
  }

  async function saveRecipeMeta(payload = {}) {
    const rid = Number(payload?.id);
    if (!Number.isFinite(rid) || rid <= 0) {
      throw new Error('Invalid recipe id.');
    }
    const client = getSupabase();
    const title = String(payload?.title || '').trim();
    const servings = payload?.servings || {};
    const tagNames = normalizeTagNames(payload?.tags);

    const { error: recipeError } = await client
      .from('recipes')
      .update({
        title,
        servings_default: servings?.default ?? null,
        servings_min: servings?.min ?? null,
        servings_max: servings?.max ?? null,
      })
      .eq('id', rid);
    if (recipeError) throw recipeError;

    const { error: clearMapError } = await client
      .from('recipe_tag_map')
      .delete()
      .eq('recipe_id', rid);
    if (clearMapError) throw clearMapError;

    if (tagNames.length) {
      const tagIds = [];
      for (const [index, tagName] of tagNames.entries()) {
        const { data: foundTag, error: findError } = await client
          .from('tags')
          .select('id')
          .ilike('name', tagName)
          .limit(1)
          .maybeSingle();
        if (findError) throw findError;
        let tagId = foundTag?.id ?? null;
        if (tagId == null) {
          const { data: createdTag, error: createTagError } = await client
            .from('tags')
            .insert({
              name: tagName,
              sort_order: 100000 + index,
              intended_use: 'recipes',
              is_hidden: 0,
            })
            .select('id')
            .single();
          if (createTagError) throw createTagError;
          tagId = createdTag?.id ?? null;
        }
        if (tagId != null) tagIds.push({ tagId, sort_order: index + 1 });
      }
      if (tagIds.length) {
        const rows = tagIds.map((entry) => ({
          recipe_id: rid,
          tag_id: entry.tagId,
          sort_order: entry.sort_order,
        }));
        const { error: mapInsertError } = await client.from('recipe_tag_map').insert(rows);
        if (mapInsertError) throw mapInsertError;
      }
    }

    return getRecipeById(rid);
  }

  global.favoriteEatsDataApi = Object.freeze({
    listVisibleTags: () =>
      listVisibleTags().catch((err) => {
        throw new Error(toErrorMessage(err, 'Failed to list visible tags.'));
      }),
    listRecipes: () =>
      listRecipes().catch((err) => {
        throw new Error(toErrorMessage(err, 'Failed to list recipes.'));
      }),
    getRecipeById: (recipeId) =>
      getRecipeById(recipeId).catch((err) => {
        throw new Error(toErrorMessage(err, 'Failed to load recipe.'));
      }),
    createRecipe: (payload) =>
      createRecipe(payload).catch((err) => {
        throw new Error(toErrorMessage(err, 'Failed to create recipe.'));
      }),
    deleteRecipe: (recipeId) =>
      deleteRecipe(recipeId).catch((err) => {
        throw new Error(toErrorMessage(err, 'Failed to delete recipe.'));
      }),
    saveRecipeMeta: (payload) =>
      saveRecipeMeta(payload).catch((err) => {
        throw new Error(toErrorMessage(err, 'Failed to save recipe metadata.'));
      }),
  });
})(typeof window !== 'undefined' ? window : globalThis);
