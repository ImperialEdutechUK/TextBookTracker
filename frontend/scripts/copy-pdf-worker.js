// Copies the pdf.js worker into public/ so it is served self-hosted at
// /pdf.worker.min.mjs. Resolving it from node_modules means the worker always
// matches the installed pdfjs-dist version — no manual step, no version drift.
// Runs automatically via the predev / prebuild npm hooks.
const fs = require('fs');
const path = require('path');

const pkgJson = require.resolve('pdfjs-dist/package.json');
const src = path.join(path.dirname(pkgJson), 'build', 'pdf.worker.min.mjs');
const destDir = path.join(__dirname, '..', 'public');
const dest = path.join(destDir, 'pdf.worker.min.mjs');

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Copied pdf.worker.min.mjs -> public/ (from ${path.relative(process.cwd(), src)})`);
