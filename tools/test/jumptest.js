// Chạy: python3 tools/serve.py 8765 & node tools/test/jumptest.js  (cần Playwright; BASE, OUT đổi được qua biến môi trường)
const path = require('path'), os = require('os');
const BASE = process.env.BASE || 'http://localhost:8765/luathinhsu/';
const OUT = (process.env.OUT || os.tmpdir()) + path.sep;
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs = [];
  async function page(w, h, theme, mobile) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: !!mobile, hasTouch: !!mobile, deviceScaleFactor: 1 });
    await ctx.addInitScript(t => { localStorage.setItem('lx.prefs', JSON.stringify({ tv: 3, theme: t })); localStorage.setItem('lx.hist', JSON.stringify([{id:'168',t:1},{id:'173',t:1},{id:'51',t:1}])); }, theme);
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(w + ' ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(w + ' ' + m.text()); });
    return p;
  }
  const check = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };

  // ---- Máy tính, nền tối ----
  let p = await page(1440, 900, 'dark');
  await p.goto(BASE + 'dieu-171', { waitUntil: 'networkidle' });
  await p.waitForSelector('#lawBody');
  await p.click('.hd-nav a[data-nav="muc-luc"]');
  await p.waitForSelector('#jump:not([hidden])');
  check(await p.$eval('#jpQ', e => document.activeElement === e), 'desktop: ô lọc được focus khi mở');
  check(await p.$$eval('.jp-a', r => r.length) === 428, 'hiển thị đủ 428 điều');
  check(await p.$eval('.jp-a.on', e => e.dataset.id) === '171', 'điều đang đọc (171) được đánh dấu');
  check(await p.$eval('.jp-nav button.on', e => e.dataset.jc) === 'c16', 'mục lục trái đánh dấu Chương XVI');
  const vis = await p.$eval('.jp-a.on', e => { const r = e.getBoundingClientRect(), L = document.getElementById('jpList').getBoundingClientRect(); return r.top >= L.top && r.bottom <= L.bottom; });
  check(vis, 'điều đang đọc nằm trong vùng nhìn thấy');
  check(await p.$eval('#jpRecent', e => !e.hidden && e.querySelectorAll('.chip').length === 3), 'dòng "Vừa xem" có 3 điều');
  await p.waitForTimeout(400); await p.screenshot({ path: OUT + 'jp-desktop-dark.png' });
  // lọc không dấu
  await p.fill('#jpQ', 'trom cap'); await p.waitForTimeout(150);
  const n1 = await p.$$eval('.jp-a:not([hidden])', r => r.map(x => x.dataset.id));
  check(n1.includes('173'), 'lọc "trom cap" → có Điều 173 (' + n1.join(',') + ')');
  check(await p.$eval('.jp-a:not([hidden]) mark', e => !!e), 'tô sáng từ khớp');
  await p.screenshot({ path: OUT + 'jp-desktop-filter.png' });
  // số điều + Enter
  await p.fill('#jpQ', '17'); await p.waitForTimeout(150);
  const n2 = await p.$$eval('.jp-a:not([hidden])', r => r.map(x => x.dataset.id));
  check(n2[0] === '17' && n2.includes('175'), 'lọc "17" → Điều 17 đứng đầu, gồm 170–179 (' + n2.length + ' điều)');
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
  check(await p.$eval('.jp-a.act', e => e.dataset.id) === '171', '↓↓ chuyển chọn sang Điều 171');
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  check(p.url().endsWith('dieu-171') && await p.$eval('#jump', e => e.hidden), 'Enter mở Điều 171 và đóng bảng');
  // khoản 2 điều 134 → mở đúng khoản
  await p.keyboard.press('Control+k'); await p.waitForSelector('#jump:not([hidden])');
  check(true, 'Ctrl+K mở bảng');
  await p.fill('#jpQ', 'khoản 2 điều 134'); await p.waitForTimeout(150);
  check((await p.$eval('#jpSub', e => e.textContent)).includes('Enter để mở Khoản 2 Điều 134'), 'gợi ý "Enter để mở Khoản 2 Điều 134"');
  await p.keyboard.press('Enter'); await p.waitForTimeout(600);
  check(p.url().includes('dieu-134?k=2'), 'Enter → dieu-134?k=2 (' + p.url() + ')');
  // chương 16
  await p.keyboard.press('Control+k'); await p.waitForSelector('#jump:not([hidden])');
  await p.fill('#jpQ', 'chuong 16'); await p.waitForTimeout(150);
  check(await p.$$eval('.jp-a:not([hidden])', r => r.length) === 13, 'lọc "chuong 16" → 13 điều của Chương XVI');
  // Esc: lần 1 xóa, lần 2 đóng
  await p.keyboard.press('Escape');
  check(await p.$eval('#jpQ', e => e.value === '') && await p.$eval('#jump', e => !e.hidden), 'Esc lần 1 xóa từ lọc');
  await p.keyboard.press('Escape');
  check(await p.$eval('#jump', e => e.hidden), 'Esc lần 2 đóng bảng');
  // bấm chương ở cột trái → cuộn tới
  await p.keyboard.press('Control+k'); await p.waitForSelector('#jump:not([hidden])');
  await p.click('.jp-nav [data-jc="c20"]'); await p.waitForTimeout(900);
  check(await p.$eval('.jp-nav button.on', e => e.dataset.jc) === 'c20', 'bấm Chương XX → danh sách cuộn tới và đánh dấu XX');
  await p.click('.jp-a[data-id="251"]'); await p.waitForTimeout(500);
  check(p.url().endsWith('dieu-251'), 'bấm chuột vào Điều 251 → chuyển trang');
  // nút ở thanh bên & thanh chuyển điều
  await p.click('.side-all'); await p.waitForSelector('#jump:not([hidden])');
  check(true, 'nút cạnh ô "Lọc nhanh" mở bảng');
  await p.click('.jp-x'); 
  await p.click('.pager .pg-all'); await p.waitForSelector('#jump:not([hidden])');
  check(true, 'nút "Mục lục" giữa Điều trước/sau mở bảng');
  await p.keyboard.press('Escape');
  // ←/→ không chuyển điều khi bảng mở
  await p.keyboard.press('Control+k'); await p.waitForSelector('#jump:not([hidden])');
  await p.click('.jp-ch'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300);
  check(p.url().endsWith('dieu-251'), 'phím → không chuyển điều phía sau khi bảng đang mở');
  await p.keyboard.press('Escape');
  // trang chủ, nền sáng
  await p.context().close();
  p = await page(1280, 860, 'light');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('.hd-nav a[data-nav="muc-luc"]'); await p.waitForSelector('#jump:not([hidden])');
  await p.waitForTimeout(400); await p.screenshot({ path: OUT + 'jp-desktop-light-home.png' });
  await p.fill('#jpQ', 'ma tuy'); await p.waitForTimeout(200); await p.screenshot({ path: OUT + 'jp-desktop-light-filter.png' });
  check(await p.$$eval('.jp-nav button:not([hidden])', b => b.length) < 27, 'khi lọc chỉ còn các chương có kết quả ở cột trái');
  await p.context().close();

  // ---- Điện thoại ----
  p = await page(390, 844, 'dark', true);
  await p.goto(BASE + 'dieu-171', { waitUntil: 'networkidle' });
  await p.waitForSelector('#lawBody');
  await p.screenshot({ path: OUT + 'mob-dark-171.png' });
  await p.tap('.tabbar a[data-nav="muc-luc"]'); await p.waitForSelector('#jump:not([hidden])');
  check(await p.$eval('#jpQ', e => document.activeElement !== e), 'điện thoại: không tự bật bàn phím');
  check(await p.evaluate(() => !!document.activeElement.closest('.jp-panel')), 'điện thoại: tiêu điểm nằm trong bảng');
  await p.waitForTimeout(450); await p.screenshot({ path: OUT + 'jp-mob-dark.png' });
  await p.tap('.jp-nav [data-jc="c14"]'); await p.waitForTimeout(900);
  await p.screenshot({ path: OUT + 'jp-mob-dark-c14.png' });
  await p.tap('.jp-a[data-id="134"]'); await p.waitForTimeout(600);
  check(p.url().endsWith('dieu-134'), 'điện thoại: chạm Điều 134 → chuyển trang');
  // menu
  await p.tap('.hd-menu'); await p.waitForTimeout(200);
  await p.tap('#drawerNav [data-act="jump"]'); await p.waitForSelector('#jump:not([hidden])');
  check(await p.$eval('#drawer', e => e.hidden), 'mục "Mục lục Bộ luật" trong menu mở bảng và đóng menu');
  await p.context().close();
  p = await page(360, 740, 'light', true);
  await p.goto(BASE + 'chuong-20', { waitUntil: 'networkidle' });
  await p.tap('.tabbar a[data-nav="muc-luc"]'); await p.waitForSelector('#jump:not([hidden])'); await p.waitForTimeout(450);
  check(await p.$eval('.jp-nav button.on', e => e.dataset.jc) === 'c20', 'mở từ trang Chương XX → cuộn tới và đánh dấu Chương XX');
  await p.fill('#jpQ', 'lua dao'); await p.waitForTimeout(200); await p.screenshot({ path: OUT + 'jp-mob-light-filter.png' });
  await p.tap('.jp-x');
  await p.goto(BASE + 'dieu-171', { waitUntil: 'networkidle' });
  await p.waitForSelector('#lawBody');
  await p.screenshot({ path: OUT + 'mob-light-360-head.png', clip: { x: 0, y: 0, width: 360, height: 140 } });
  await p.evaluate(() => document.querySelector('.pager').scrollIntoView());
  await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + 'mob-light-pager.png' });
  await p.context().close();
  console.log(errs.length ? 'JS ERRORS:\n' + errs.join('\n') : 'Không có lỗi JavaScript');
  await b.close();
})();
