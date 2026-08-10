#!/usr/bin/env node
'use strict';
/** Regenerate bonus-videos.js + repetition-graphics.js from their folders. */
const fs = require('fs');
const path = require('path');

const root = __dirname;

function writeList(outFile, globalName, dir, relPrefix, extRe) {
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir)
        .filter((f) => extRe.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((f) => relPrefix + f)
    : [];
  fs.writeFileSync(
    path.join(root, outFile),
    `window.${globalName} = ` + JSON.stringify(files, null, 2) + ';\n'
  );
  console.log(`Synced ${outFile} (${files.length} file${files.length === 1 ? '' : 's'})`);
}

writeList(
  'bonus-videos.js',
  'BONUS_VIDEOS',
  path.join(root, 'video', 'bonus videos'),
  'video/bonus videos/',
  /\.(mov|mp4|webm|m4v)$/i
);

writeList(
  'bunny-videos.js',
  'BUNNY_VIDEOS',
  path.join(root, 'video', 'bunny videos'),
  'video/bunny videos/',
  /\.(mov|mp4|webm|m4v)$/i
);

writeList(
  'repetition-graphics.js',
  'REPETITION_GRAPHICS',
  path.join(root, 'graphics', 'repititions'),
  'graphics/repititions/',
  /\.(png|jpe?g|webp|gif|svg)$/i
);
