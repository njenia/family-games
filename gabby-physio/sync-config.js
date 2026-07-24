#!/usr/bin/env node
'use strict';
/** Optional helper: regenerate bonus-videos.js from the bonus video folder. */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const bonusDir = path.join(root, 'video', 'bonus videos');
const videoExt = /\.(mov|mp4|webm|m4v)$/i;

const files = fs.existsSync(bonusDir)
  ? fs.readdirSync(bonusDir)
      .filter((f) => videoExt.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((f) => 'video/bonus videos/' + f)
  : [];

fs.writeFileSync(
  path.join(root, 'bonus-videos.js'),
  'window.BONUS_VIDEOS = ' + JSON.stringify(files, null, 2) + ';\n'
);

console.log(`Synced bonus-videos.js (${files.length} clip${files.length === 1 ? '' : 's'})`);
