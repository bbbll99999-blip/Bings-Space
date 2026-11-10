// 下载全部远程原图 → sharp 转 JPEG（全尺寸 + 120px 缩略图）
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'plan.json'), 'utf8'));

const remote = plan.filter(i => i.src.startsWith('http'));
const uniq = [...new Map(remote.map(i => [i.src, i])).entries()];
console.log('待处理唯一图片:', uniq.length);

async function fetchWithRetry(url, tries = 3) {
  for (let t = 1; t <= tries; t++) {
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 90000);
      const res = await fetch(url, { signal: ac.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (t === tries) throw e;
      await new Promise(r => setTimeout(r, 1500 * t));
    }
  }
}

async function convertOne(item) {
  const outFull = path.join(__dirname, '..', 'public', item.local.replace(/^\//, ''));
  const outThumb = outFull.replace(/\.jpg$/, '.thumb.jpg');
  fs.mkdirSync(path.dirname(outFull), { recursive: true });
  if (fs.existsSync(outFull) && fs.existsSync(outThumb)) return { ...item, cached: true };

  const buf = await fetchWithRetry(item.src);
  if (buf.length < 10000) throw new Error('内容过小(' + buf.length + 'B)，疑似错误页');
  // 确认是真实图像（JPEG ffd8 / PNG 8950）
  const head = buf.slice(0, 2).toString('hex');
  if (head !== 'ffd8' && buf.slice(0, 4).toString('hex') !== '89504e47') {
    throw new Error('非图像内容');
  }
  await sharp(buf, { limitInputPixels: false })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(outFull);
  await sharp(buf, { limitInputPixels: false })
    .resize({ width: 120, withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(outThumb);
  const fullSize = fs.statSync(outFull).size;
  const thumbSize = fs.statSync(outThumb).size;
  return { ...item, origBytes: buf.length, fullBytes: fullSize, thumbBytes: thumbSize };
}

(async () => {
  const results = [], failures = [];
  const queue = [...uniq];
  let done = 0;
  async function worker() {
    while (queue.length) {
      const [src, item] = queue.shift();
      try {
        const r = await convertOne({ ...item, src });
        results.push(r);
      } catch (e) {
        failures.push({ project: item.project, title: item.title, src, err: e.message });
      }
      done++;
      if (done % 10 === 0 || done === uniq.length) {
        console.log(`进度 ${done}/${uniq.length}，失败 ${failures.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));

  const fullMB = results.reduce((s, r) => s + (r.fullBytes || 0), 0) / 1048576;
  const thumbKB = results.reduce((s, r) => s + (r.thumbBytes || 0), 0) / 1024;
  const origMB = results.reduce((s, r) => s + (r.origBytes || 0), 0) / 1048576;
  console.log(`\n成功 ${results.length} 张`);
  console.log(`原图合计 ${origMB.toFixed(1)}MB → 全尺寸JPEG ${fullMB.toFixed(1)}MB + 缩略图 ${thumbKB.toFixed(0)}KB`);
  console.log(`首屏缩略图总量: ${(thumbKB / 1024).toFixed(2)}MB`);
  if (failures.length) {
    console.log('\n失败清单:');
    failures.forEach(f => console.log(' -', f.project, '|', f.title, '|', f.err));
    fs.writeFileSync(path.join(__dirname, 'failures.json'), JSON.stringify(failures, null, 1));
  }
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 1));
})();
