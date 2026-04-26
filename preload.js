const { contextBridge, ipcRenderer } = require('electron');

const api = Object.freeze({
  getEnv: () => ipcRenderer.invoke('getEnv'),
  supabaseListVisibleTags: () => ipcRenderer.invoke('supabaseListVisibleTags'),
  supabaseListRecipes: () => ipcRenderer.invoke('supabaseListRecipes'),
  supabaseGetRecipeById: (recipeId) =>
    ipcRenderer.invoke('supabaseGetRecipeById', recipeId),
  supabaseCreateRecipe: (payload) =>
    ipcRenderer.invoke('supabaseCreateRecipe', payload),
  supabaseDeleteRecipe: (recipeId) =>
    ipcRenderer.invoke('supabaseDeleteRecipe', recipeId),
  supabaseSaveRecipeMeta: (payload) =>
    ipcRenderer.invoke('supabaseSaveRecipeMeta', payload),
});

contextBridge.exposeInMainWorld('electronAPI', api);
