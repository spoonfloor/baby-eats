(function () {
  function clamp(value, min, max) {
    let next = value;
    if (min != null && next < min) next = min;
    if (max != null && next > max) next = max;
    return next;
  }

  function bind(root, options = {}) {
    if (!root) {
      throw new Error('protoStepper.bind requires a root element');
    }

    const decreaseButton =
      options.decreaseButton ||
      root.querySelector('[data-stepper-action="decrease"]');
    const increaseButton =
      options.increaseButton ||
      root.querySelector('[data-stepper-action="increase"]');
    const valueEl =
      options.valueEl || root.querySelector('[data-stepper-value="true"]');

    if (!decreaseButton || !increaseButton || !valueEl) {
      throw new Error('protoStepper.bind could not find required stepper elements');
    }

    const formatValue =
      typeof options.formatValue === 'function'
        ? options.formatValue
        : (value) => String(value);
    const onChange =
      typeof options.onChange === 'function' ? options.onChange : null;
    const step =
      Number.isFinite(Number(options.step)) && Number(options.step) > 0
        ? Number(options.step)
        : 1;
    const min =
      options.min == null || !Number.isFinite(Number(options.min))
        ? null
        : Number(options.min);
    const max =
      options.max == null || !Number.isFinite(Number(options.max))
        ? null
        : Number(options.max);

    let value = clamp(Number(options.value), min, max);

    function render() {
      valueEl.textContent = formatValue(value);
      decreaseButton.disabled = min != null && value <= min;
      increaseButton.disabled = max != null && value >= max;
    }

    function setValue(nextValue, emitChange = true) {
      value = clamp(Number(nextValue), min, max);
      render();
      if (emitChange && onChange) onChange(value);
      return value;
    }

    decreaseButton.addEventListener('click', () => {
      setValue(value - step);
    });

    increaseButton.addEventListener('click', () => {
      setValue(value + step);
    });

    render();

    return {
      getValue() {
        return value;
      },
      setValue(nextValue) {
        return setValue(nextValue, false);
      },
      render,
    };
  }

  window.protoStepper = {
    bind,
  };
})();
