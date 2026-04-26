const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://ieancejhyihxpazturiz.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_OEspL1dwwLl7aOAH6Q8bCg_1jKnbkzu';

function assertSupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.'
    );
  }
}

function getSupabase() {
  assertSupabaseEnv();
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

function toErrorMessage(err, fallback = 'Supabase request failed.') {
  if (!err) return fallback;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err.trim();
  if (typeof err?.message === 'string' && err.message.trim()) {
    return err.message.trim();
  }
  try {
    return JSON.stringify(err);
  } catch (_) {
    return fallback;
  }
}

function createWindow() {
  const { width, height, x, y } = screen.getPrimaryDisplay().workArea;
  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    icon: path.join(__dirname, 'assets', 'app-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // isolate renderer from Node
      nodeIntegration: false, // no require() / process in renderer
      sandbox: false,
      enableRemoteModule: false, // belt & suspenders
    },
  });

  // Launch directly into the recipes home page (no splash screen).
  win.loadFile('recipes.html');

  // Enforce a consistent no-zoom baseline on every page load.
  // This prevents page-to-page zoom drift and guarantees zoom won't "stick"
  // across restarts (we do not persist zoom anywhere).
  win.webContents.on('did-finish-load', () => {
    try {
      win.webContents.setZoomFactor(1.0);
    } catch (_) {
      // ignore
    }
  });
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

ipcMain.handle('supabaseListVisibleTags', async () => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
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
        const k = name.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  } catch (err) {
    throw new Error(toErrorMessage(err, 'Failed to list visible tags.'));
  }
});

ipcMain.handle('supabaseListRecipes', async () => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
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

    return (Array.isArray(data) ? data : []).map((row) => {
      const tagRows = Array.isArray(row?.recipe_tag_map) ? row.recipe_tag_map : [];
      const tags = tagRows
        .filter((m) => Number(m?.tags?.is_hidden || 0) === 0)
        .sort(
          (a, b) => Number(a?.sort_order || 999999) - Number(b?.sort_order || 999999)
        )
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
    });
  } catch (err) {
    throw new Error(toErrorMessage(err, 'Failed to list recipes.'));
  }
});

ipcMain.handle('supabaseGetRecipeById', async (_event, recipeId) => {
  try {
    const rid = Number(recipeId);
    if (!Number.isFinite(rid) || rid <= 0) return null;
    const supabase = getSupabase();
    const { data, error } = await supabase
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

    const tags = (Array.isArray(data.recipe_tag_map) ? data.recipe_tag_map : [])
      .filter((m) => Number(m?.tags?.is_hidden || 0) === 0)
      .sort(
        (a, b) => Number(a?.sort_order || 999999) - Number(b?.sort_order || 999999)
      )
      .map((m) => String(m?.tags?.name || '').trim())
      .filter(Boolean);

    return {
      id: data.id,
      title: String(data?.title || ''),
      servings: {
        default: data?.servings_default,
        min: data?.servings_min,
        max: data?.servings_max,
      },
      tags,
      sections: [],
    };
  } catch (err) {
    throw new Error(toErrorMessage(err, 'Failed to load recipe.'));
  }
});

ipcMain.handle('supabaseCreateRecipe', async (_event, payload = {}) => {
  try {
    const supabase = getSupabase();
    const title = String(payload?.title || '').trim();
    const servingsMin = payload?.servings_min ?? 0.5;
    const servingsMax = payload?.servings_max ?? 99;

    const attemptWithServings = await supabase
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

    // Schema-safe fallback when servings columns are absent/locked.
    const attemptTitleOnly = await supabase
      .from('recipes')
      .insert({ title })
      .select('id')
      .single();
    if (!attemptTitleOnly.error) {
      return attemptTitleOnly.data?.id ?? null;
    }

    throw new Error(
      `${toErrorMessage(attemptWithServings.error)} | fallback: ${toErrorMessage(
        attemptTitleOnly.error
      )}`
    );
  } catch (err) {
    throw new Error(toErrorMessage(err, 'Failed to create recipe.'));
  }
});

ipcMain.handle('supabaseDeleteRecipe', async (_event, recipeId) => {
  try {
    const rid = Number(recipeId);
    if (!Number.isFinite(rid) || rid <= 0) return false;
    const supabase = getSupabase();
    const { error } = await supabase.from('recipes').delete().eq('id', rid);
    if (error) throw error;
    return true;
  } catch (err) {
    throw new Error(toErrorMessage(err, 'Failed to delete recipe.'));
  }
});

ipcMain.handle('supabaseSaveRecipeMeta', async (_event, payload = {}) => {
  try {
    const rid = Number(payload?.id);
    if (!Number.isFinite(rid) || rid <= 0) {
      throw new Error('Invalid recipe id.');
    }
    const supabase = getSupabase();
    const title = String(payload?.title || '').trim();
    const servings = payload?.servings || {};
    const tagNames = normalizeTagNames(payload?.tags);

    const { error: recipeError } = await supabase
      .from('recipes')
      .update({
        title,
        servings_default: servings?.default ?? null,
        servings_min: servings?.min ?? null,
        servings_max: servings?.max ?? null,
      })
      .eq('id', rid);
    if (recipeError) throw recipeError;

  const { error: clearMapError } = await supabase
    .from('recipe_tag_map')
    .delete()
    .eq('recipe_id', rid);
  if (clearMapError) throw clearMapError;

  if (tagNames.length) {
    const tagIds = [];
    for (const [index, tagName] of tagNames.entries()) {
      const { data: foundTag, error: findError } = await supabase
        .from('tags')
        .select('id')
        .ilike('name', tagName)
        .limit(1)
        .maybeSingle();
      if (findError) throw findError;
      let tagId = foundTag?.id ?? null;
      if (tagId == null) {
        const { data: createdTag, error: createTagError } = await supabase
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
      const { error: mapInsertError } = await supabase
        .from('recipe_tag_map')
        .insert(rows);
      if (mapInsertError) throw mapInsertError;
    }
  }

  const { data: refreshed, error: refreshedError } = await supabase
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
    .single();
  if (refreshedError) throw refreshedError;
  const refreshedTags = (Array.isArray(refreshed.recipe_tag_map)
    ? refreshed.recipe_tag_map
    : []
  )
    .filter((m) => Number(m?.tags?.is_hidden || 0) === 0)
    .sort((a, b) => Number(a?.sort_order || 999999) - Number(b?.sort_order || 999999))
    .map((m) => String(m?.tags?.name || '').trim())
    .filter(Boolean);
    return {
    id: refreshed.id,
    title: String(refreshed?.title || ''),
    servings: {
      default: refreshed?.servings_default,
      min: refreshed?.servings_min,
      max: refreshed?.servings_max,
    },
    tags: refreshedTags,
      sections: [],
    };
  } catch (err) {
    throw new Error(toErrorMessage(err, 'Failed to save recipe metadata.'));
  }
});

ipcMain.handle('getEnv', async () => ({
  appPath: app.getAppPath(),
  userData: app.getPath('userData'),
}));

// --- App startup ---

app.whenReady().then(() => {
  app.setName('Baby Eats');

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
