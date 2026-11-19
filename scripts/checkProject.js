const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ejs = require('ejs');

const root = path.resolve(__dirname, '..');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'node_modules' || entry.name === '.git') return [];
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const files = walk(root);
for (const file of files.filter(file => file.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}
for (const file of files.filter(file => file.endsWith('.ejs'))) {
  ejs.compile(fs.readFileSync(file, 'utf8'), { filename: file });
}
console.log(`Static checks passed: ${files.filter(f => f.endsWith('.js')).length} JS, ${files.filter(f => f.endsWith('.ejs')).length} EJS files.`);
