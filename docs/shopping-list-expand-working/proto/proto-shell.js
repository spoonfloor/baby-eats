(function () {
  const TOP_LEVEL_PAGES = [
    {
      id: 'recipes',
      label: 'Recipes',
      title: 'Recipes',
      href: 'index.html',
      icon: 'menu_book',
      emptyCopy: 'No recipes loaded yet.',
    },
    {
      id: 'items',
      label: 'Items',
      title: 'Items',
      href: 'items.html',
      icon: 'shopping_bag',
      emptyCopy: 'No extra shopping items selected yet.',
    },
    {
      id: 'menu-plan',
      label: 'Menu Plan',
      title: 'Menu Plan',
      href: 'menu-plan.html',
      icon: 'event_note',
      emptyCopy: 'No recipes in your menu plan yet.',
    },
    {
      id: 'stores',
      label: 'Stores',
      title: 'Stores',
      href: 'stores.html',
      icon: 'storefront',
      emptyCopy: 'No stores selected yet.',
    },
    {
      id: 'shopping-list',
      label: 'Shopping List',
      title: 'Shopping List',
      href: 'shopping-list.html',
      icon: 'checklist',
      emptyCopy: 'No shopping list yet.',
    },
  ];

  function getPage(pageId) {
    return TOP_LEVEL_PAGES.find((page) => page.id === pageId) || TOP_LEVEL_PAGES[0];
  }

  function getElements() {
    return {
      titleEl: document.getElementById('protoAppbarTitle'),
      tabRowEl: document.getElementById('protoTabRow'),
      panelBodyEl: document.getElementById('protoPanelBody'),
      emptyStateEl: document.getElementById('protoEmptyState'),
      emptyIconEl: document.getElementById('protoEmptyIcon'),
      emptyCopyEl: document.getElementById('protoEmptyCopy'),
      emptyActionEl: document.getElementById('protoEmptyAction'),
    };
  }

  function hideContentRegions() {
    document.querySelectorAll('[data-proto-content-region="true"]').forEach((node) => {
      node.hidden = true;
    });
  }

  function renderTabs(activePageId) {
    const { tabRowEl } = getElements();
    if (!tabRowEl) return;
    tabRowEl.innerHTML = '';

    TOP_LEVEL_PAGES.forEach((page) => {
      const link = document.createElement('a');
      link.href = page.href;
      link.className = 'proto-tab';
      link.textContent = page.label;
      if (page.id === activePageId) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      }
      tabRowEl.appendChild(link);
    });
  }

  function setEmptyAction(actionLabel, onAction) {
    const { emptyActionEl } = getElements();
    if (!emptyActionEl) return;

    if (!actionLabel || typeof onAction !== 'function') {
      emptyActionEl.hidden = true;
      emptyActionEl.onclick = null;
      emptyActionEl.textContent = '';
      return;
    }

    emptyActionEl.hidden = false;
    emptyActionEl.textContent = actionLabel;
    emptyActionEl.onclick = onAction;
  }

  function showEmptyState(options = {}) {
    const {
      icon = 'menu_book',
      copy = 'Nothing to show yet.',
      actionLabel = '',
      onAction = null,
    } = options;
    const {
      panelBodyEl,
      emptyStateEl,
      emptyIconEl,
      emptyCopyEl,
    } = getElements();

    hideContentRegions();
    if (emptyStateEl) {
      emptyStateEl.hidden = false;
      emptyStateEl.style.display = '';
    }
    if (emptyIconEl) emptyIconEl.textContent = icon;
    if (emptyCopyEl) emptyCopyEl.textContent = copy;
    if (panelBodyEl) {
      panelBodyEl.classList.add('is-empty');
      panelBodyEl.classList.remove('is-content');
    }
    setEmptyAction(actionLabel, onAction);
  }

  function showContent(contentEl) {
    const { panelBodyEl, emptyStateEl } = getElements();

    hideContentRegions();
    if (emptyStateEl) {
      emptyStateEl.hidden = true;
      emptyStateEl.style.display = 'none';
    }
    setEmptyAction('', null);
    if (panelBodyEl) {
      panelBodyEl.classList.remove('is-empty');
      panelBodyEl.classList.add('is-content');
    }
    if (contentEl) {
      contentEl.hidden = false;
      contentEl.style.display = '';
    }
  }

  function initPage(pageId) {
    const page = getPage(pageId);
    const { titleEl } = getElements();

    renderTabs(page.id);
    hideContentRegions();
    if (titleEl) titleEl.textContent = page.title;
    document.title = `Favorite Eats Proto - ${page.title}`;

    return {
      page,
      showEmptyState(overrides = {}) {
        showEmptyState({
          icon: page.icon,
          copy: page.emptyCopy,
          ...overrides,
        });
      },
      showContent,
    };
  }

  window.protoShell = {
    pages: TOP_LEVEL_PAGES,
    getPage,
    initPage,
    showEmptyState,
    showContent,
  };
})();
