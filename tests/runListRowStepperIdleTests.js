#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const listRowStepperPath = path.join(projectRoot, 'js', 'listRowStepper.js');

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
    );
  }
}

function assertTruthy(value, message) {
  if (!value) {
    throw new Error(`${message}: expected truthy value`);
  }
}

function run() {
  const source = fs.readFileSync(listRowStepperPath, 'utf8');
  let lastTimerFn = null;
  const context = {
    window: {},
    clearTimeout: () => {},
    setTimeout: (fn) => {
      lastTimerFn = fn;
      return 1;
    },
    HTMLElement: function HTMLElement() {},
    Element: function Element() {},
    Node: function Node() {},
    document: {},
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'listRowStepper.js' });
  const api = context.window.listRowStepper;
  if (!api || typeof api.createController !== 'function') {
    throw new Error('listRowStepper.createController missing.');
  }

  let idleCalls = 0;
  const listEl = new context.HTMLElement();
  listEl.addEventListener = () => {};
  listEl.contains = () => false;
  const row = new context.HTMLElement();
  row.dataset = { recipeRowStepperKey: '99' };
  row.closest = (sel) => (sel === 'li' ? row : null);
  listEl.contains = (node) => node === row;

  const ctrl = api.createController({
    listEl,
    isEnabled: () => true,
    idleCollapseMs: 3500,
    onIdleCollapse: () => {
      idleCalls += 1;
    },
    idleResetActivity: (target, activeKey) => {
      if (!(target instanceof context.Element)) return false;
      const r = typeof target.closest === 'function' ? target.closest('li') : null;
      if (!r || !listEl.contains(r)) return false;
      return String(r.dataset.recipeRowStepperKey || '') === activeKey;
    },
  });

  assertEqual(ctrl.activate('99'), true, 'activate');
  assertTruthy(lastTimerFn, 'idle timer scheduled');
  lastTimerFn();
  assertEqual(ctrl.getActiveKey(), '', 'idle collapses');
  assertEqual(idleCalls, 1, 'onIdleCollapse once');

  idleCalls = 0;
  assertEqual(ctrl.activate('99'), true, 'reactivate');
  lastTimerFn();
  assertEqual(idleCalls, 1, 'onIdleCollapse again');

  console.log('List row stepper idle tests passed.');
}

run();
