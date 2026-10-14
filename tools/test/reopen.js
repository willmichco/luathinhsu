// Chạy: python3 tools/serve.py 8765 & node tools/test/reopen.js  (cần Playwright; BASE, OUT đổi được qua biến môi trường)
const path = require('path'), os = require('os');
const BASE = process.env.BASE || 'http://localhost:8765/luathinhsu/';
const OUT = (process.env.OUT || os.tmpdir()) + path.sep;
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + 'dieu-171', { waitUntil: 'networkidle' }); await p.waitForSelector('#lawBody');
  await p.keyboard.press('Control+k'); await p.waitForSelector('#jump:not([hidden])');
  await p.click('.jp-a[data-id="40"]'); await p.waitForTimeout(500);           // sang Điều 40 (Chương VI)
  await p.keyboard.press('Control+k'); await p.waitForSelector('#jump:not([hidden])');
  const on = await p.$$eval('.jp-nav button.on', b => b.map(x => x.dataset.jc));
  const cur = await p.$$eval('.jp-a.on', r => r.map(x => x.dataset.id));
  console.log((on.length === 1 && on[0] === 'c06' ? 'PASS' : 'FAIL') + ' mở lại: chỉ 1 chương được đánh dấu ' + JSON.stringify(on));
  console.log((cur.length === 1 && cur[0] === '40' ? 'PASS' : 'FAIL') + ' mở lại: chỉ Điều 40 là "Đang đọc" ' + JSON.stringify(cur));
  const rec = await p.$$eval('#jpRecent .chip', c => c.map(x => x.textContent));
  console.log((rec[0] === 'Điều 171' ? 'PASS' : 'FAIL') + ' "Vừa xem" cập nhật: ' + rec.join(', '));
  console.log(errs.length ? 'ERR ' + errs.join(';') : 'Không có lỗi JavaScript');
  await b.close();
})();
