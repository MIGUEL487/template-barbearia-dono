import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
const walk = p => fs.readdirSync(p, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(p,e.name)) : [path.join(p,e.name)]);
const errors = [];
const property = /^(?:(?:margin|padding)(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?|(?:row-|column-)?gap|(?:scroll-margin|scroll-padding)(?:-\w+)*|top|left|right|bottom|inset(?:-\w+)?)$/;
for (const file of walk('src')) {
 const source = fs.readFileSync(file,'utf8');
 if (file.endsWith('.css')) postcss.parse(source).walkDecls(d => {
  if (!property.test(d.prop) && d.prop !== '--page-gutter') return;
  for (const [,value,unit] of d.value.matchAll(/(-?\d*\.?\d+)(px|rem)\b/g)) {
   if ((Number(value) * (unit === 'rem' ? 16 : 1)) % 8) errors.push(`${file}: ${d.prop}: ${d.value}`);
  }
 });
 else if (/\.(tsx?|jsx?)$/.test(file)) for (const match of source.matchAll(/(?<![\w-])(-?(?:p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|space-[xy]|top|bottom|left|right|inset(?:-[xy])?))-(\d+(?:\.\d+)?)(?![\w.%-])/g)) {
  if ((Number(match[2]) * 4) % 8) errors.push(`${file}: ${match[0]}`);
 }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode=1; }
else console.log('8px spacing grid: CSS pixel/rem spacing and numeric Tailwind utilities passed. Percentages, auto, safe-area and intrinsic layout are allowed; typography, borders, radii and image dimensions are not spacing.');
