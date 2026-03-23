/**
 * Centralized hint controller for the Ingredients section.
 *
 * Manages a single "active hint" slot at any time, resolving priority:
 *   1. Hover > Edit-mode focus
 *   2. Edit-mode focus > nothing
 *   3. Empty-state hint is always visible when list is empty
 *
 * The INGREDIENTS header participates as an entity only in non-empty
 * state: hovering it shows the top CTA and can steal from an entity in
 * edit mode. In empty state, that same CTA stays visible persistently.
 *
 * Usage: call `initIngredientHintController(ingredientsSection)` after
 * every rerender.  It is safe to call repeatedly — the previous instance
 * is torn down automatically.
 */

(function () {
  'use strict';

  const ACTIVE_CLASS = 'ingredient-slot--hint-active';
  const HOVER_HANDOFF_GRACE_MS = 120;
  const HINT_ACTIVATION_DELAY_MS = 400;

  let _teardown = null;

  function initIngredientHintController(section) {
    if (_teardown) {
      _teardown();
      _teardown = null;
    }

    if (!section) return;

    // --- State ---
    let hoverTarget = null;   // slot or header element currently hovered
    let focusTarget = null;   // slot that currently owns an active editor
    let hoverOverCta = false; // cursor is over the CTA itself (keep it alive)
    let hoverClearTimer = null;
    let activationTimer = null;
    let pendingActivationTarget = null;
    let activeTarget = null;
    let requestedTarget = null; // one-shot target requested by insert flow

    const slots = () => section.querySelectorAll('.ingredient-slot');
    const headerCta = () => section.querySelector('.ingredient-header-cta');
    const headerCanHoverActivate = () => {
      const cta = headerCta();
      return !!(cta && !cta.classList.contains('ingredient-header-cta--persistent'));
    };

    function slotHasActiveEditor(slot) {
      if (!slot || !slot.isConnected || !section.contains(slot)) return false;
      return !!(
        slot.querySelector('.ingredient-edit-row.editing') ||
        slot.querySelector(
          '.ingredient-subsection-heading-text[contenteditable="true"]'
        )
      );
    }

    function escapeAttrValue(value) {
      const raw = String(value || '');
      if (window.CSS && typeof window.CSS.escape === 'function') {
        return window.CSS.escape(raw);
      }
      return raw.replace(/["\\]/g, '\\$&');
    }

    function getActiveHeadingEditorSlot() {
      const active = window._activeIngredientHeadingEditor;
      const clientId =
        active && active.clientId != null ? String(active.clientId) : '';
      if (!clientId) return null;

      const text = section.querySelector(
        `.ingredient-subsection-heading-text[data-heading-client-id="${escapeAttrValue(
          clientId
        )}"]`
      );
      const slot = text && text.closest ? text.closest('.ingredient-slot') : null;
      return slot && section.contains(slot) ? slot : null;
    }

    function normalizeTargets() {
      if (hoverTarget && (!hoverTarget.isConnected || !section.contains(hoverTarget))) {
        hoverTarget = null;
      }
      if (!slotHasActiveEditor(focusTarget)) {
        // Subheading edit sessions should keep owning their hint until commit/cancel,
        // even if focus bookkeeping briefly drops during rerender or hover handoff.
        focusTarget = getActiveHeadingEditorSlot();
      }
      if (requestedTarget && (!requestedTarget.isConnected || !section.contains(requestedTarget))) {
        requestedTarget = null;
      }
    }

    function cancelPendingHoverClear() {
      if (hoverClearTimer) {
        clearTimeout(hoverClearTimer);
        hoverClearTimer = null;
      }
    }

    function clearHoverNow() {
      cancelPendingHoverClear();
      hoverTarget = null;
      resolve();
    }

    function scheduleHoverClear() {
      cancelPendingHoverClear();
      hoverClearTimer = setTimeout(() => {
        hoverClearTimer = null;
        hoverTarget = null;
        resolve();
      }, HOVER_HANDOFF_GRACE_MS);
    }

    function cancelPendingActivation() {
      if (activationTimer) {
        clearTimeout(activationTimer);
        activationTimer = null;
      }
      pendingActivationTarget = null;
    }

    function applyWinnerNow(winner) {
      // Clear all
      slots().forEach((s) => s.classList.remove(ACTIVE_CLASS));
      const hCta = headerCta();
      if (hCta) hCta.classList.remove('ingredient-header-cta--active');

      activeTarget = winner || null;
      if (!winner) return;

      if (winner.classList.contains('section-header')) {
        if (hCta) hCta.classList.add('ingredient-header-cta--active');
      } else if (winner.classList.contains('ingredient-slot')) {
        winner.classList.add(ACTIVE_CLASS);
      }
      if (winner === requestedTarget) {
        requestedTarget = null;
      }
    }

    function consumePendingRequestedTarget() {
      const clientId =
        window._pendingIngredientHintClientId != null
          ? String(window._pendingIngredientHintClientId)
          : '';
      if (!clientId) return;

      window._pendingIngredientHintClientId = null;
      const card = section.querySelector(
        `.ingredient-line[data-client-id="${escapeAttrValue(clientId)}"]`
      );
      const slot = card && card.closest ? card.closest('.ingredient-slot') : null;
      if (slot && section.contains(slot)) {
        requestedTarget = slot;
      }
    }

    function getDesiredWinner() {
      // Priority: hover > edit-mode focus > requested one-shot target > nothing.
      // Hover always wins. When nothing is hovered, the focused entity
      // (edit tray open) keeps its hint.
      return hoverTarget || focusTarget || requestedTarget || null;
    }

    function scheduleActivation(winner) {
      if (!winner) return;
      if (activeTarget === winner) return;
      if (pendingActivationTarget === winner) return;

      cancelPendingActivation();
      pendingActivationTarget = winner;
      activationTimer = setTimeout(() => {
        activationTimer = null;
        pendingActivationTarget = null;
        normalizeTargets();
        consumePendingRequestedTarget();
        const desired = getDesiredWinner();
        if (desired !== winner) {
          resolve();
          return;
        }
        applyWinnerNow(winner);
      }, HINT_ACTIVATION_DELAY_MS);
    }

    // --- Resolve: who gets the hint? ---
    function resolve() {
      normalizeTargets();
      consumePendingRequestedTarget();

      // Any direct user intent cancels a stale one-shot post-add target.
      if (hoverTarget || focusTarget) {
        requestedTarget = null;
      }
      const winner = getDesiredWinner();

      if (!winner) {
        cancelPendingActivation();
        applyWinnerNow(null);
        return;
      }
      scheduleActivation(winner);
    }

    // --- Hover tracking (per-slot + header) ---
    // We use mouseover/mouseout on the container (they bubble) and
    // resolve the slot from the event target.

    function findEntity(target) {
      if (!target || !target.closest) return null;
      const cta = target.closest('.ingredient-add-cta');
      if (cta) return null; // CTA hover handled separately
      const slot = target.closest('.ingredient-slot');
      if (slot && section.contains(slot)) return slot;
      const insertZone = target.closest('.ingredient-insert-zone');
      if (insertZone) return null; // insert zones are not entities
      const h = target.closest('.section-header');
      if (h && section.contains(h) && headerCanHoverActivate()) return h;
      return null;
    }

    function onMouseOver(e) {
      cancelPendingHoverClear();

      // If cursor moved onto a CTA, flag it so we don't hide on mouseout.
      const cta = e.target.closest && e.target.closest('.ingredient-add-cta');
      if (cta && section.contains(cta)) {
        hoverOverCta = true;
        return;
      }
      hoverOverCta = false;

      const entity = findEntity(e.target);
      if (entity && entity !== hoverTarget) {
        hoverTarget = entity;
        resolve();
      }
    }

    function onMouseOut(e) {
      const cta = e.target.closest && e.target.closest('.ingredient-add-cta');
      if (cta) {
        const related = e.relatedTarget;
        const stillInCta = related && related.closest && related.closest('.ingredient-add-cta');
        if (!stillInCta) {
          hoverOverCta = false;
          // Check if we moved back onto the parent slot
          const entity = related ? findEntity(related) : null;
          if (entity) {
            cancelPendingHoverClear();
            hoverTarget = entity;
            resolve();
          } else if (related && section.contains(related)) {
            scheduleHoverClear();
          } else {
            clearHoverNow();
          }
        }
        return;
      }

      if (!hoverTarget) return;

      const related = e.relatedTarget;

      // Moving into a CTA that belongs to the current hint? Keep it.
      if (related && related.closest) {
        const relCta = related.closest('.ingredient-add-cta');
        if (relCta && section.contains(relCta)) {
          hoverOverCta = true;
          return;
        }
      }

      // Still inside the same entity?
      const nextEntity = related ? findEntity(related) : null;
      if (nextEntity === hoverTarget) return;

      if (nextEntity) {
        cancelPendingHoverClear();
        hoverTarget = nextEntity;
        resolve();
        return;
      }

      if (related && section.contains(related)) {
        scheduleHoverClear();
        return;
      }

      clearHoverNow();
    }

    function onMouseLeave() {
      cancelPendingHoverClear();
      hoverTarget = null;
      hoverOverCta = false;
      resolve();
    }

    // --- Focus tracking (edit-mode entity) ---
    function onFocusIn(e) {
      const target = e.target;
      if (!target || !target.closest) return;

      const isActiveEditorTarget =
        !!target.closest('.ingredient-edit-row.editing') ||
        !!target.closest(
          '.ingredient-subsection-heading-text[contenteditable="true"]'
        );

      if (!isActiveEditorTarget) return;

      const slot = target.closest('.ingredient-slot');
      if (!slot || !section.contains(slot)) return;

      focusTarget = slot;
      resolve();
    }

    function onFocusOut() {
      if (!focusTarget) return;

      // Defer until the edit controller finishes any commit/cancel + rerender.
      setTimeout(() => {
        resolve();
      }, 0);
    }

    // --- Bind ---
    section.addEventListener('mouseover', onMouseOver);
    section.addEventListener('mouseout', onMouseOut);
    section.addEventListener('mouseleave', onMouseLeave);
    section.addEventListener('focusin', onFocusIn);
    section.addEventListener('focusout', onFocusOut);

    // Listen for edit-mode changes on body so we can re-resolve.
    const observer = new MutationObserver(() => resolve());
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Initial resolve. The shared header CTA handles both the empty-state
    // persistent hint and the non-empty hover hint via CSS classes.
    resolve();

    _teardown = () => {
      section.removeEventListener('mouseover', onMouseOver);
      section.removeEventListener('mouseout', onMouseOut);
      section.removeEventListener('mouseleave', onMouseLeave);
      section.removeEventListener('focusin', onFocusIn);
      section.removeEventListener('focusout', onFocusOut);
      observer.disconnect();
      cancelPendingHoverClear();
      cancelPendingActivation();
      hoverTarget = null;
      focusTarget = null;
      hoverOverCta = false;
      activeTarget = null;
      requestedTarget = null;
    };
  }

  window.initIngredientHintController = initIngredientHintController;
})();
