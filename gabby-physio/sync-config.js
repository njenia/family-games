#!/usr/bin/env node
'use strict';
/** Optional helper: regenerate exercises.js from exercises.json (for file:// fallback). */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const config = JSON.parse(fs.readFileSync(path.join(root, 'exercises.json'), 'utf8'));
delete config.bonusVideos;

fs.writeFileSync(
  path.join(root, 'exercises.js'),
  'window.EXERCISES_CONFIG = ' + JSON.stringify(config, null, 2) + ';\n'
);

console.log('Synced exercises.js from exercises.json');
