document.addEventListener('DOMContentLoaded', () => {
  const shell = window.protoShell.initPage('recipes');
  const recipeListEl = document.getElementById('protoRecipeList');
  const dbFileInputEl = document.getElementById('protoDbFileInput');

  function getEmptyCopy(reason) {
    if (reason === 'db-unavailable') {
      return window.protoDb.canUseBrowserFilePicker()
        ? 'Choose your recipes DB to load the recipe list.'
        : 'Could not load recipes from the prototype DB path.';
    }
    if (reason === 'query-failed') {
      return 'Could not read recipes from the DB.';
    }
    if (reason === 'empty') {
      return 'No recipes found in the DB.';
    }
    return 'No recipes loaded yet.';
  }

  function renderRecipeRows(rows) {
    recipeListEl.innerHTML = '';
    rows.forEach((row) => {
      const item = document.createElement('li');
      item.className = 'proto-recipe-list-item';

      const recipeRow = document.createElement('a');
      recipeRow.className = 'proto-recipe-row';
      recipeRow.href = `recipe.html?id=${encodeURIComponent(row.id)}`;

      const title = document.createElement('span');
      title.className = 'proto-recipe-row-title';
      title.textContent = row.title;

      const chevron = document.createElement('span');
      chevron.className = 'proto-recipe-row-chevron';
      chevron.textContent = 'chevron_right';
      chevron.setAttribute('aria-hidden', 'true');

      recipeRow.appendChild(title);
      recipeRow.appendChild(chevron);
      item.appendChild(recipeRow);
      recipeListEl.appendChild(item);
    });
  }

  async function loadRecipes() {
    shell.showEmptyState({ copy: 'Loading recipes...' });

    const result = await window.protoDb.loadRecipeTitles();
    if (!result.rows || !result.rows.length) {
      shell.showEmptyState({
        copy: getEmptyCopy(result.reason),
        actionLabel: window.protoDb.canUseBrowserFilePicker() ? 'Load DB' : '',
        onAction: window.protoDb.canUseBrowserFilePicker()
          ? () => dbFileInputEl.click()
          : null,
      });
      return;
    }

    renderRecipeRows(result.rows);
    shell.showContent(recipeListEl);
  }

  dbFileInputEl.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await window.protoDb.storeBrowserDbFile(file);
      await loadRecipes();
    } catch (err) {
      console.warn('Proto browser DB file load failed:', err);
      shell.showEmptyState({
        copy: 'Could not read that DB file.',
        actionLabel: 'Load DB',
        onAction: () => dbFileInputEl.click(),
      });
    } finally {
      dbFileInputEl.value = '';
    }
  });

  void loadRecipes();
});
