#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'dist', 'web');

const COPY_PATHS = [
  'assets',
  'css',
  'fragments',
  'js',
  'recipes.html',
  'recipeEditor.html',
];

async function safeRemove(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
}

async function copyPath(relativePath) {
  const from = path.join(projectRoot, relativePath);
  const to = path.join(outDir, relativePath);
  await fs.cp(from, to, { recursive: true });
}

async function writeIndexHtml() {
  const html = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="UTF-8" />',
    '    <meta http-equiv="refresh" content="0; url=recipes.html" />',
    '    <title>Baby Eats</title>',
    '  </head>',
    '  <body>',
    '    <a href="recipes.html">Open Baby Eats</a>',
    '  </body>',
    '</html>',
    '',
  ].join('\n');
  await fs.writeFile(path.join(outDir, 'index.html'), html, 'utf8');
}

async function writeWebBuildConfig() {
  const buildConfigPath = path.join(outDir, 'js', 'buildConfig.js');
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const supabaseAnonKey = String(process.env.SUPABASE_ANON_KEY || '').trim();
  const script = [
    '(function applyFavoriteEatsBuildConfig(global) {',
    "  if (!global) return;",
    supabaseUrl ? `  global.__SUPABASE_URL__ = ${JSON.stringify(supabaseUrl)};` : '',
    supabaseAnonKey
      ? `  global.__SUPABASE_ANON_KEY__ = ${JSON.stringify(supabaseAnonKey)};`
      : '',
    "  global.__FAVORITE_EATS_BUILD__ = { target: 'web' };",
    "})(typeof window !== 'undefined' ? window : globalThis);",
    '',
  ]
    .filter(Boolean)
    .join('\n');
  await fs.writeFile(buildConfigPath, script, 'utf8');
}

async function main() {
  await safeRemove(outDir);
  await fs.mkdir(outDir, { recursive: true });
  for (const relativePath of COPY_PATHS) {
    await copyPath(relativePath);
  }
  await writeIndexHtml();
  await writeWebBuildConfig();
  console.log(`Web build ready: ${path.relative(projectRoot, outDir)}`);
}

main().catch((err) => {
  console.error('build:web failed:', err);
  process.exit(1);
});
