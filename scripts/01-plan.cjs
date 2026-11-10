// 解析 graphics.astro 中的图片清单，生成本地化计划
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const text = fs.readFileSync(path.join(ROOT, 'src/pages/graphics.astro'), 'utf8');

// 项目中文名 → ASCII slug
const SLUGS = {
  '季风服饰': 'jifeng', '宇梦锐': 'yumengrui', '东升': 'dongsheng', '鑫瑞': 'xinrui',
  '铭烨': 'mingye', '骄之阳新版': 'jiaozhiyang', '鼎盛服饰': 'dingshengfs', '鼎盛': 'dingsheng',
  '博远鑫': 'boyuanxin', '崇瑧': 'chongzhen', '乾海': 'qianhai', '禾森': 'hesen',
  '佳泰': 'jiatai', '擎洲': 'qingzhou', '博远': 'boyuan', '英络': 'yingluo',
  '航程': 'hangcheng', '弘硕': 'hongshuo', '凡优卓': 'fanyouzhuo', '允硕': 'yunshuo', '尤佳': 'youjia'
};

const workRe = /name:\s*"([^"]+)"[\s\S]*?previews:\s*\[([\s\S]*?)\]\s*\n\s*\}/g;
let m, items = [], projects = new Set();
while ((m = workRe.exec(text))) {
  const proj = m[1].split(' - ')[0].replace(/ \(.*\)/, '');
  const prevRe = /\{\s*title:\s*"([^"]+)",\s*src:\s*"([^"]+)"\s*\}/g;
  let p;
  while ((p = prevRe.exec(m[2]))) {
    items.push({ project: proj, title: p[1], src: p[2] });
    projects.add(proj);
  }
}

// 为每张图分配本地目标路径
let counters = {};
for (const it of items) {
  const slug = SLUGS[it.project];
  if (!slug) { console.error('缺 slug:', it.project); process.exit(1); }
  counters[slug] = (counters[slug] || 0) + 1;
  it.slug = slug;
  it.local = `/graphics/${slug}/${String(counters[slug]).padStart(2, '0')}.jpg`;
}

console.log('项目数:', projects.size, ' 图片总数:', items.length);
console.log('远程:', items.filter(i => i.src.startsWith('http')).length,
            '已是本地:', items.filter(i => i.src.startsWith('/')).length);
const uniq = new Set(items.filter(i => i.src.startsWith('http')).map(i => i.src));
console.log('需下载的唯一远程图:', uniq.size);
fs.writeFileSync(path.join(__dirname, 'plan.json'), JSON.stringify(items, null, 1));
console.log('计划写入 scripts/plan.json');
