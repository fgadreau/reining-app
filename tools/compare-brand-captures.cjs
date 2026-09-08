// Usage: node tools/compare-brand-captures.cjs BEFORE_DIR AFTER_DIR [REPORT.json]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const [before, after, report] = process.argv.slice(2);
if (!before || !after) throw new Error('Provide before and after capture directories');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const results = fs.readdirSync(before)
  .filter(name => /^(tv|livestream|shortcut|overlay)-.*\.png$/.test(name))
  .map(name => {
    const original = fs.readFileSync(path.join(before, name));
    const updated = fs.readFileSync(path.join(after, name));
    return { name, identical: original.equals(updated), before: hash(original), after: hash(updated) };
  });
if (report) fs.writeFileSync(report, JSON.stringify(results, null, 2) + '\n');
for (const result of results) console.log(`${result.identical ? 'IDENTICAL' : 'DIFFERENT'} ${result.name}`);
if (results.some(result => !result.identical)) process.exitCode = 1;
