#!/usr/bin/env node
'use strict';

// Static `dist/web` (GitHub Pages) builds are no longer supported — use Electron (`npm start`).
console.error(
  'build:web is disabled. This project runs as a desktop app only. Use: npm start',
);
process.exit(1);
