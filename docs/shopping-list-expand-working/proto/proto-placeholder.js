document.addEventListener('DOMContentLoaded', () => {
  const pageId = document.body.dataset.protoPage || 'recipes';
  const shell = window.protoShell.initPage(pageId);
  shell.showEmptyState();
});
