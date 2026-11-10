// 把 graphics.astro 中的远程 URL 替换为本地路径
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'results.json'), 'utf8'));
const map = new Map(results.map(r => [r.src, r.local]));

const file = path.join(ROOT, 'src/pages/graphics.astro');
let text = fs.readFileSync(file, 'utf8');
let replaced = 0, missed = [];
for (const [src, local] of map) {
  const needle = `src: "${src}"`;
  if (text.includes(needle)) {
    text = text.split(needle).join(`src: "${local}"`);
    replaced++;
  } else {
    missed.push(src);
  }
}
fs.writeFileSync(file, text);
console.log('替换成功:', replaced, '处');
if (missed.length) console.log('未找到对应行(请检查):', missed);
console.log('仍保留远程 URL:');
for (const m of text.matchAll(/src: "(https?:[^"]+)"/g)) console.log(' -', m[1]);
