const ui = () => window.ui;

const goBack = () => {
  try {
    if (window.history && typeof window.history.back === 'function') {
      window.history.back();
      return;
    }
  } catch (_) {}
  window.location.href = 'recipes.html';
};

document.getElementById('galleryBackBtn')?.addEventListener('click', () => {
  goBack();
});

document.getElementById('demoAlert')?.addEventListener('click', () => {
  ui()?.alert({ title: 'Heads up', message: 'This is an alert.' });
});

document.getElementById('demoConfirm')?.addEventListener('click', async () => {
  await ui()?.confirm({ title: 'Confirm', message: 'Proceed?', confirmText: 'OK', cancelText: 'Cancel' });
});

document.getElementById('demoDangerConfirm')?.addEventListener('click', async () => {
  await ui()?.confirm({
    title: 'Delete',
    message: 'Delete "Sample Item"?',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    danger: true,
  });
});

document.getElementById('demoPrompt')?.addEventListener('click', async () => {
  await ui()?.prompt({
    title: '',
    message: 'Enter a new name:',
    label: 'Name',
    value: 'Draft',
    required: true,
  });
});

document.getElementById('demoForm')?.addEventListener('click', async () => {
  await ui()?.form({
    title: 'New Unit',
    fields: [
      { key: 'code', label: 'Code', required: true },
      { key: 'name', label: 'Name (singular)', required: true },
    ],
    confirmText: 'Create',
    cancelText: 'Cancel',
  });
});

document.getElementById('demoToast')?.addEventListener('click', () => {
  ui()?.toast({ message: 'Saved.' });
});

document.getElementById('demoToastUndo')?.addEventListener('click', () => {
  ui()?.toast({ message: 'Ingredient removed.', actionText: 'Undo', onAction: () => console.log('undo!') });
});

const mockState = {
  rows: [
    { id: 'apple', value: 'apple', suggestion: null, suggestionApplied: false, isPurple: true },
    { id: 'bacn', value: 'bacn', suggestion: 'bacon', suggestionApplied: false, isPurple: false },
    { id: 'crabz', value: 'crabz', suggestion: 'crabs', suggestionApplied: false, isPurple: false },
    { id: 'egg-plant', value: 'egg plant', suggestion: 'eggplant', suggestionApplied: false, isPurple: false },
    { id: 'dental-floss', value: 'dental floss', suggestion: null, suggestionApplied: false, isPurple: false },
    { id: 'zzhzk', value: 'zzzhzklkh', suggestion: null, suggestionApplied: false, isPurple: false },
    { id: 'bcon', value: 'bcon', suggestion: 'bacon', suggestionApplied: false, isPurple: false },
    { id: 'cillantro', value: 'cillantro', suggestion: 'cilantro', suggestionApplied: false, isPurple: false },
    { id: 'yogrt', value: 'yogrt', suggestion: 'yogurt', suggestionApplied: false, isPurple: false },
  ],
  editingId: null,
  editingStartValue: '',
};

const typeAlongOptions = [
  'apple',
  'apples',
  'apple cider',
  'bacon',
  'coke',
  'coca-cola',
  'coconut milk',
  'crabs',
  'eggplant',
  'yogurt',
  'cilantro',
  'donkey meat',
];

const escapeHtml = (v) =>
  String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const getRowById = (id) => mockState.rows.find((row) => row.id === id) || null;

const applySuggestionForRow = (row) => {
  if (!row || !row.suggestion || row.suggestionApplied) return;
  row.value = row.suggestion;
  row.suggestionApplied = true;
  row.isPurple = true;
};

const applyAllSuggestions = () => {
  mockState.rows.forEach((row) => {
    applySuggestionForRow(row);
  });
  renderUnknownItemsModal();
};

const focusEditorInput = () => {
  const input = document.querySelector('#newItemsSuggestions input[data-role="edit-original"]');
  if (!input || !(input instanceof HTMLInputElement)) return;
  input.focus();
  const pos = input.value.length;
  input.setSelectionRange(pos, pos);
  const rowEl = input.closest('.new-items-row');
  if (rowEl && typeof rowEl.scrollIntoView === 'function') {
    rowEl.scrollIntoView({ block: 'nearest' });
  }
  if (window.favoriteEatsTypeahead && typeof window.favoriteEatsTypeahead.attach === 'function') {
    window.favoriteEatsTypeahead.attach({
      inputEl: input,
      getPool: async () => typeAlongOptions,
      openOnFocus: true,
      maxVisible: 8,
    });
  }
};

const openInlineEditor = (rowId) => {
  const row = getRowById(rowId);
  if (!row) return;
  mockState.editingId = rowId;
  mockState.editingStartValue = row.value;
  renderUnknownItemsModal();
  focusEditorInput();
};

const closeInlineEditor = () => {
  mockState.editingId = null;
  mockState.editingStartValue = '';
  if (window.favoriteEatsTypeahead && typeof window.favoriteEatsTypeahead.close === 'function') {
    window.favoriteEatsTypeahead.close();
  }
};

const renderUnknownItemsModal = () => {
  const titleEl = document.getElementById('newItemsTitle');
  const suggestionsEl = document.getElementById('newItemsSuggestions');
  if (!titleEl || !suggestionsEl) return;

  titleEl.textContent = `New items (${mockState.rows.length})`;

  if (!mockState.rows.length) {
    suggestionsEl.innerHTML = '<div class="new-items-empty-state">No pending suggestions.</div>';
  } else {
    suggestionsEl.innerHTML = mockState.rows
      .map((row) => {
        const isEditing = mockState.editingId === row.id;
        const showSuggestionPill = !!row.suggestion && !row.suggestionApplied;
        return `
          <div class="new-items-row">
            ${
              isEditing
                ? `<input
                     class="new-items-original-input"
                     data-role="edit-original"
                     data-id="${escapeHtml(row.id)}"
                     type="text"
                     value="${escapeHtml(row.value)}"
                   />`
                : `<button class="new-items-original-btn" data-role="open-inline-edit" data-id="${escapeHtml(row.id)}" type="button">
                     <span class="new-items-original-text ${row.isPurple ? 'is-purple' : ''}">${escapeHtml(row.value)}</span>
                   </button>`
            }
            <div class="new-items-suggestion">
              ${
                showSuggestionPill
                  ? `<button class="new-items-suggestion-label" data-role="apply-suggestion" data-id="${escapeHtml(
                      row.id
                    )}" type="button">${escapeHtml(row.suggestion)}</button>`
                  : ''
              }
            </div>
          </div>
        `;
      })
      .join('');
  }
};

document.getElementById('newItemsApplyAll')?.addEventListener('click', () => {
  applyAllSuggestions();
});

document.getElementById('newItemsEditFirst')?.addEventListener('click', () => {
  const first = mockState.rows[0];
  if (!first) return;
  openInlineEditor(first.id);
});

document.getElementById('newItemsSuggestions')?.addEventListener('click', (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const role = target.dataset.role;
  const id = target.dataset.id;
  if (role === 'apply-suggestion' && id) {
    const row = getRowById(id);
    applySuggestionForRow(row);
    renderUnknownItemsModal();
    return;
  }
  if (role === 'open-inline-edit' && id) {
    openInlineEditor(id);
  }
});

document.getElementById('newItemsSuggestions')?.addEventListener('input', (e) => {
  const target = e.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.dataset.role !== 'edit-original') return;
  const rowId = target.dataset.id || '';
  const row = getRowById(rowId);
  if (!row) return;
  row.value = target.value;
  if (row.value !== mockState.editingStartValue) {
    row.isPurple = false;
  }
});

document.getElementById('newItemsSuggestions')?.addEventListener(
  'blur',
  (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.role !== 'edit-original') return;
    const rowId = target.dataset.id || '';
    const row = getRowById(rowId);
    if (!row) return;
    row.value = target.value;
    if (row.value !== mockState.editingStartValue) {
      row.isPurple = false;
    }
    closeInlineEditor();
    renderUnknownItemsModal();
  },
  true
);

document.getElementById('newItemsSuggestions')?.addEventListener('keydown', (e) => {
  const target = e.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.dataset.role !== 'edit-original') return;
  if (e.key === 'Enter') {
    e.preventDefault();
    target.blur();
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    const rowId = target.dataset.id || '';
    const row = getRowById(rowId);
    if (row) row.value = mockState.editingStartValue;
    closeInlineEditor();
    renderUnknownItemsModal();
  }
});

renderUnknownItemsModal();

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowUp') {
    e.preventDefault();
    goBack();
  }
});
