KEY TO PURPOSE OF ALL PROJECT FILES

---

## Root

- `package.json`  
  Electron/Node package config: app name, scripts, dependencies.

- `electronMain.js`  
  Electron main process: creates browser windows, loads HTML, handles app lifecycle.

- `preload.js`  
  Preload script: exposes safe, limited APIs from Electron/Node to the renderer (browser) context.

- `index.html`  
  Main entry screen (likely menu / starting point) for the app.

- `recipes.html`  
  Recipes list view: shows all recipes and links into individual recipe editing.

- `recipeEditor.html`  
  Recipe editor screen: bootstraps the JS for viewing/editing a single recipe.

## /js

- `recipeEditor.js`  
  Core recipe editor controller: initializes the editor, wires DOM to the editing/session logic.

- `recipeEditor.stepsEdit.js`  
  Handles step editing behaviors: Enter/Backspace, blank steps, caret movement, split/merge of steps.

- `recipeEditor.session.js`  
  Manages edit session state: dirty tracking, cancel/revert behavior, interaction with Save/ESC/Blur.

- `bridge.js`  
  Bridge between renderer and Electron/Node/SQLite: IPC or similar to read/write from the DB.

- `main.js`  
  Front-end app bootstrap for renderer windows (wires up global event handlers, initial UI setup).

- `formatter.js`  
  DOM/text formatting utilities for recipe/step rendering (e.g., injecting <br>, styling helpers).

- `ingredientRenderer.js`  
  Renders ingredient-related UI: ingredients list, ingredient details, formatting of ingredient rows.

- `sql-wasm.js`  
  sql.js wrapper/loader script for running SQLite in the browser/renderer via WebAssembly.

- `sql-wasm.wasm`  
  WebAssembly binary used by `sql-wasm.js` to provide SQLite functionality in the renderer.

- `utils.js`  
  Shared utility functions used across the front-end code (DOM helpers, small generic helpers).

## /assets

- `back_arrow_light.svg`  
  Back arrow icon asset used in navigation.

- `README.txt`  
  Legacy/readme notes about the project or asset usage.

## /css

- `styles.css`  
  Main stylesheet: base layout, typography, and visual styling for the app.

- `overrides.css`  
  Overrides/patches on top of `styles.css` (quick fixes or more specific rules).

## /docs (planned)

- `ux-spec-and-status.md`  
  Combined UX spec + current PASS/FAIL status for key behaviors.

- `local-tree.md`  
  Snapshot of the real local filesystem structure.

- `file-key.md`  
  This document: descriptions of each file.

- `architecture-and-migrations.md`  
  High-level architecture notes and ongoing refactor/migration plans (e.g., “Caret One”).
