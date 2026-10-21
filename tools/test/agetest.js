// Chạy: python3 tools/serve.py 8765 & node tools/test/agetest.js  (cần Playwright; BASE, OUT đổi được qua biến môi trường)
const path = require('path'), os = require('os');
const BASE = process.env.BASE || 'http://localhost:8765/luathinhsu/';
const OUT = (process.env.OUT || os.tmpdir()) + path.sep;
const { chromium } = require('playwright');
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(), p = await (await b.newContext()).newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const B = BASE;
  async function age(id, dob, act) {
    await p.goto(B + 'cong-cu-tuoi?a=' + id, { waitUntil: 'networkidle' });
    await p.fill('#dob', dob); await p.dispatchEvent('#dob', 'change');
    await p.fill('#dact', act); await p.dispatchEvent('#dact', 'change');
    return p.$$eval('#out .res', r => r.map(x => x.innerText).join(' | '));
  }
  for (const id of ['325', '329', '145']) {
    const t = await age(id, '2008-05-01', '2025-09-01');   // 17 tuổi
    check(t.includes('Không thuộc chủ thể') && t.includes('đủ 18 tuổi'), 'Điều ' + id + ', người 17 tuổi → không thuộc chủ thể (đủ 18 tuổi)');
  }
  const t2 = await age('325', '2000-01-01', '2025-09-01');
  check(t2.includes('Phải chịu trách nhiệm hình sự'), 'Điều 325, người 25 tuổi → phải chịu TNHS');
  const t3 = await age('173', '2008-05-01', '2025-09-01');
  check(t3.includes('Phải chịu trách nhiệm hình sự'), 'Điều 173, người 17 tuổi → phải chịu TNHS (không bị ảnh hưởng)');
  await p.goto(B + 'cong-cu-thoi-hieu?a=329', { waitUntil: 'networkidle' });
  check((await p.textContent('#out')).includes('người từ đủ 18 tuổi trở lên'), 'Công cụ thời hiệu, Điều 329: ghi đúng chủ thể đủ 18 tuổi');
  check(await p.$$eval('.kpick .chip', c => c.some(x => x.getAttribute('aria-pressed') === 'true' && x.textContent.startsWith('Khoản 1'))), 'Công cụ thời hiệu: mặc định chọn khoản 1');
  await p.goto(B + 'cong-cu-khung-hinh-phat?q=325', { waitUntil: 'networkidle' });
  check((await p.textContent('#tb')).includes('18'), 'Bảng khung hình phạt: Điều 325 cột tuổi = 18');
  await p.goto(B + 'cong-cu-so-sanh?a=325&b=329', { waitUntil: 'networkidle' }); await p.waitForSelector('.cmp-tbl');
  check((await p.textContent('.cmp-tbl')).split('Từ đủ 18 tuổi').length === 3, 'So sánh 325 ↔ 329: cả hai "Từ đủ 18 tuổi"');
  // Lọc mục lục: gõ rồi Enter ngay lập tức
  await p.goto(B + 'dieu-1', { waitUntil: 'networkidle' }); await p.waitForSelector('#lawBody');
  await p.keyboard.press('Control+k'); await p.waitForSelector('#jump:not([hidden])');
  await p.fill('#jpQ', '17'); await p.waitForTimeout(150);
  await p.evaluate(() => { const q = document.getElementById('jpQ'); q.value = '173'; q.dispatchEvent(new Event('input')); q.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
  await p.waitForTimeout(500);
  check(p.url().endsWith('dieu-173'), 'Mục lục: đổi "17"→"173" rồi Enter tức thì → mở đúng Điều 173 (' + p.url().split('/').pop() + ')');
  console.log(errs.length ? 'ERR ' + errs : 'Không có lỗi JavaScript');
  await b.close();
})();
