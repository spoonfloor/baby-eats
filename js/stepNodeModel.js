// Central StepNode model for the instruction editor.
// Phase 1 scaffolding: not yet wired into the editor; safe no-op for behavior.

/**
 * @typedef {'heading' | 'step'} StepNodeType
 */

/**
 * @typedef {Object} StepNode
 * @property {string|number} id    - Stable identifier for this line.
 * @property {StepNodeType}  type  - 'heading' or 'step'.
 * @property {string}        text  - Raw line text.
 * @property {number}        order - Sort key within the recipe.
 */

(function initStepNodeModel(global) {
  const StepNodeType = {
    HEADING: 'heading',
    STEP: 'step',
  };

  /**
   * Create a normalized StepNode.
   * Missing fields will throw; callers should always provide id/type/text/order.
   * @param {Partial<StepNode>} params
   * @returns {StepNode}
   */
  function createStepNode(params) {
    const { id, type, text, order } = params;

    if (id === undefined || id === null) {
      throw new Error('createStepNode: id is required');
    }
    if (type !== StepNodeType.HEADING && type !== StepNodeType.STEP) {
      throw new Error(`createStepNode: invalid type "${type}"`);
    }
    if (typeof text !== 'string') {
      throw new Error('createStepNode: text must be a string');
    }
    if (typeof order !== 'number') {
      throw new Error('createStepNode: order must be a number');
    }

    return { id, type, text, order };
  }

  /**
   * Deep-ish clone of a StepNode array (nodes themselves are copied).
   * @param {StepNode[]} nodes
   * @returns {StepNode[]}
   */
  function cloneStepNodes(nodes) {
    return nodes.map((n) => ({ ...n }));
  }

  /**
   * Build a normalized StepNode array from a flat list of step-like records.
   * Each record is expected to look like what bridge/loadRecipe currently
   * produces: { ID?, id?, instructions?, step_number? }.
   *
   * For Phase 1, everything is treated as a "step"; headings come later via
   * TAB / SHIFT+TAB behavior.
   *
   * @param {Array<{ID?: string|number, id?: string|number, instructions?: string, step_number?: number}>} rawSteps
   * @returns {StepNode[]}
   */
  function fromFlatStepsArray(rawSteps) {
    if (!Array.isArray(rawSteps)) return [];

    const nodes = rawSteps.map((s, index) =>
      createStepNode({
        id: s.ID ?? s.id ?? `tmp-${index + 1}`,
        type: StepNodeType.STEP,
        text: s.instructions ?? '',
        order:
          typeof s.step_number === 'number' && !Number.isNaN(s.step_number)
            ? s.step_number
            : index + 1,
      })
    );

    return normalizeStepNodeOrder(nodes);
  }

  /**
   * Return a new array with deterministic ordering (by order, then id).
   * Does NOT mutate the input array.
   * @param {StepNode[]} nodes
   * @returns {StepNode[]}
   */
  function normalizeStepNodeOrder(nodes) {
    return nodes
      .slice()
      .sort(
        (a, b) => a.order - b.order || String(a.id).localeCompare(String(b.id))
      );
  }

  global.StepNodeType = StepNodeType;
  global.StepNodeModel = {
    createStepNode,
    cloneStepNodes,
    normalizeStepNodeOrder,

    fromFlatStepsArray,
  };
})(window);
