#!/usr/bin/env node
/**
 * Mirror ../locales/ into ./locales/ — the pure-Node equivalent of
 * `rsync -a --delete`, used because `rsync` is not guaranteed to exist in
 * every build environment (Vercel's build image doesn't have it, which is
 * exactly the failure that led to writing this).
 *
 * "Mirror" is the operative word: this must delete files in the destination
 * that no longer exist in the source, not just copy forward. A copy-only
 * sync previously let removed languages linger in frontend/locales/ and mobile/
 * locales/ indefinitely — see locales/REVIEW_STATUS.md and the mobile README
 * for that history. Don't regress to a copy-only version of this script.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', '..', 'locales');
const DEST = path.resolve(__dirname, '..', 'locales');

function mirror(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  const srcEntries = new Map(fs.readdirSync(src, { withFileTypes: true }).map((e) => [e.name, e]));
  const destEntries = fs.existsSync(dest) ? fs.readdirSync(dest, { withFileTypes: true }) : [];

  // Delete anything in dest that no longer exists in src.
  for (const entry of destEntries) {
    if (!srcEntries.has(entry.name)) {
      fs.rmSync(path.join(dest, entry.name), { recursive: true, force: true });
    }
  }

  // Copy/recurse everything present in src.
  for (const [name, entry] of srcEntries) {
    const srcPath = path.join(src, name);
    const destPath = path.join(dest, name);
    if (entry.isDirectory()) {
      mirror(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (!fs.existsSync(SRC)) {
  console.error(`sync-locales: source directory not found: ${SRC}`);
  process.exit(1);
}

mirror(SRC, DEST);
console.log(`sync-locales: mirrored ${SRC} -> ${DEST}`);
