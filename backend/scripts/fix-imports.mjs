import fs from 'fs';
import path from 'path';

function fixImports(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { fixImports(full); continue; }
    if (!entry.name.endsWith('.ts')) continue;
    let content = fs.readFileSync(full, 'utf8');
    const fixed = content
      .replace(/from\s+(['"])(\.\.?\/[^'"]+?)(['"])/g, (m, q1, p, q2) => {
        if (p.endsWith('.js') || p.endsWith('.json')) return m;
        return `from ${q1}${p}.js${q2}`;
      })
      .replace(/import\s*\((['"])(\.\.?\/[^'"]+?)(['"]\))/g, (m, q1, p, q2) => {
        if (p.endsWith('.js') || p.endsWith('.json')) return m;
        return `import(${q1}${p}.js${q2}`;
      });
    if (fixed !== content) {
      fs.writeFileSync(full, fixed);
      console.log('Fixed:', full);
    }
  }
}

fixImports('src');
