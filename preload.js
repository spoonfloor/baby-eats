const { contextBridge, ipcRenderer } = require('electron');

const api = Object.freeze({
  loadDB: (path = null) => ipcRenderer.invoke('loadDB', path),
  saveDB: (bytes, options = { overwriteOnly: false }) =>
    ipcRenderer.invoke('saveDB', bytes, options),
  pickDB: (lastPath = null) => ipcRenderer.invoke('pickDB', lastPath),
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
