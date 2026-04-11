(function () {
  const STEPPER_EPSILON = 1e-9;

  function normalizeKey(rawKey) {
    return String(rawKey || '').trim();
  }

  function getNextStepQty(currentQty, delta, options = {}) {
    const numeric = Number(currentQty);
    const stepDelta = Number(delta);
    const min = Number(options.min ?? 0);
    const hasMax = Number.isFinite(Number(options.max));
    const max = hasMax ? Number(options.max) : Infinity;
    const epsilon = Number(options.epsilon);
    const threshold = Number.isFinite(epsilon) ? Math.abs(epsilon) : STEPPER_EPSILON;
    const isFractional = (value) => Math.abs(value - Math.round(value)) > threshold;
    const clamp = (value) => Math.max(min, Math.min(max, value));

    if (!Number.isFinite(numeric)) {
      return clamp(stepDelta > 0 ? 1 : 0);
    }

    if (stepDelta > 0 && isFractional(numeric)) {
      return clamp(Math.ceil(numeric));
    }
    if (stepDelta < 0 && isFractional(numeric)) {
      return clamp(Math.floor(numeric));
    }
    return clamp(numeric + stepDelta);
  }

  function createStepperDOM(options = {}) {
    const decreaseLabel = String(options.decreaseLabel || 'Decrease quantity');
    const increaseLabel = String(options.increaseLabel || 'Increase quantity');

    const stepper = document.createElement('span');
    stepper.className = 'shopping-list-row-stepper';
    stepper.style.display = 'none';

    const minusBtn = document.createElement('button');
    minusBtn.type = 'button';
    minusBtn.className = 'shopping-stepper-btn';
    minusBtn.setAttribute('aria-label', decreaseLabel);
    const minusIcon = document.createElement('span');
    minusIcon.className = 'material-symbols-outlined';
    minusIcon.textContent = 'remove';
    minusIcon.setAttribute('aria-hidden', 'true');
    minusBtn.appendChild(minusIcon);

    const qtySpan = document.createElement('span');
    qtySpan.className = 'shopping-stepper-qty';
    qtySpan.textContent = '0';

    const plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.className = 'shopping-stepper-btn';
    plusBtn.setAttribute('aria-label', increaseLabel);
    const plusIcon = document.createElement('span');
    plusIcon.className = 'material-symbols-outlined';
    plusIcon.textContent = 'add';
    plusIcon.setAttribute('aria-hidden', 'true');
    plusBtn.appendChild(plusIcon);

    stepper.appendChild(minusBtn);
    stepper.appendChild(qtySpan);
    stepper.appendChild(plusBtn);

    return { stepper, minusBtn, qtySpan, plusBtn };
  }

  function formatStepperQtyLabel(rawQty) {
    const qty = Number(rawQty);
    if (
      typeof window !== 'undefined' &&
      typeof window.formatShoppingQtyForDisplay === 'function'
    ) {
      return window.formatShoppingQtyForDisplay(qty);
    }
    if (!Number.isFinite(qty) || qty <= 0) return '0';
    return String(Number(qty.toFixed(2)));
  }

  function syncRowVisuals(rowEl, options = {}) {
    if (!(rowEl instanceof HTMLElement)) return;

    const enabled = !!options.enabled;
    const qty = Math.max(0, Math.min(99, Number(options.qty || 0)));
    const isActive = !!options.isActive;
    const selectedDatasetKey = String(options.selectedDatasetKey || '').trim();
    const isSelected = qty > 0;

    if (selectedDatasetKey) {
      rowEl.dataset[selectedDatasetKey] = enabled && isSelected ? 'true' : 'false';
    }

    rowEl.classList.toggle('shopping-row-checked', enabled && isSelected);

    const icon = rowEl.querySelector('.shopping-list-row-icon');
    const stepper = rowEl.querySelector('.shopping-list-row-stepper');
    const badge = rowEl.querySelector('.shopping-list-row-badge');
    const qtyEl = stepper?.querySelector('.shopping-stepper-qty');

    if (qtyEl) qtyEl.textContent = formatStepperQtyLabel(qty);

    if (!enabled) {
      if (icon) icon.style.display = '';
      if (stepper) stepper.style.display = 'none';
      if (badge) badge.style.display = 'none';
      return;
    }

    if (isActive) {
      if (icon) icon.style.display = 'none';
      if (stepper) stepper.style.display = '';
      if (badge) badge.style.display = 'none';
      return;
    }

    if (isSelected) {
      if (icon) icon.style.display = 'none';
      if (stepper) stepper.style.display = 'none';
      if (badge) {
        badge.style.display = 'inline-block';
        badge.textContent = `${formatStepperQtyLabel(qty)}x`;
      }
      return;
    }

    if (icon) icon.style.display = '';
    if (stepper) stepper.style.display = 'none';
    if (badge) badge.style.display = 'none';
  }

  function createController(options = {}) {
    const listEl = options.listEl;
    const isEnabled =
      typeof options.isEnabled === 'function' ? options.isEnabled : () => true;
    const collapseExpanded =
      typeof options.collapseExpanded === 'function' ? options.collapseExpanded : null;

    let activeKey = normalizeKey(options.activeKey);

    const getActiveKey = () => activeKey;
    const isActive = (key) => {
      const normalized = normalizeKey(key);
      return !!normalized && normalized === activeKey;
    };

    const collapseActive = () => {
      if (!activeKey) return false;
      activeKey = '';
      return true;
    };

    const activate = (key) => {
      const normalized = normalizeKey(key);
      if (!normalized || normalized === activeKey) return false;
      activeKey = normalized;
      return true;
    };

    const toggle = (key) => {
      const normalized = normalizeKey(key);
      if (!normalized) return false;
      if (normalized === activeKey) return collapseActive();
      activeKey = normalized;
      return true;
    };

    const collapseAll = () => {
      const activeChanged = collapseActive();
      const expandedChanged = collapseExpanded ? !!collapseExpanded() : false;
      return activeChanged || expandedChanged;
    };

    const bindAutoDismiss = (dismissOptions = {}) => {
      if (!(listEl instanceof HTMLElement)) return () => {};

      const shouldIgnoreTarget =
        typeof dismissOptions.shouldIgnoreTarget === 'function'
          ? dismissOptions.shouldIgnoreTarget
          : null;
      const onDismissed =
        typeof dismissOptions.onDismissed === 'function'
          ? dismissOptions.onDismissed
          : null;

      const dismissAndNotify = () => {
        if (!isEnabled()) return;
        if (!collapseAll()) return;
        if (onDismissed) onDismissed();
      };

      const onListClick = (event) => {
        const target = event?.target;
        if (!(target instanceof Element)) return;
        const row = target.closest('li');
        if (row && listEl.contains(row)) return;
        dismissAndNotify();
      };

      const onDocumentMouseDown = (event) => {
        const target = event?.target;
        if (!(target instanceof Node)) return;
        if (listEl.contains(target)) return;
        if (shouldIgnoreTarget && shouldIgnoreTarget(target)) return;
        dismissAndNotify();
      };

      listEl.addEventListener('click', onListClick);
      document.addEventListener('mousedown', onDocumentMouseDown, true);

      return () => {
        listEl.removeEventListener('click', onListClick);
        document.removeEventListener('mousedown', onDocumentMouseDown, true);
      };
    };

    return {
      getActiveKey,
      isActive,
      collapseActive,
      activate,
      toggle,
      collapseAll,
      bindAutoDismiss,
    };
  }

  window.listRowStepper = {
    createStepperDOM,
    syncRowVisuals,
    getNextStepQty,
    createController,
  };
})();
