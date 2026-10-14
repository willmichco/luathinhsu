// Chạy: python3 tools/serve.py 8765 & node tools/test/drawertest.js  (cần Playwright; BASE, OUT đổi được qua biến môi trường)
const path = require('path'), os = require('os');
const BASE = process.env.BASE || 'http://localhost:8765/luathinhsu/';
const OUT = (process.env.OUT || os.tmpdir()) + path.sep;
const { chromium } = require('playwright');
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const AND = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const line = (x0, y0, x1, y1, n) => Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);
async function swipe(p, pts, ms = 16) {
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
  for (const [x, y] of pts.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await p.waitForTimeout(ms); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}
const state = p => p.evaluate(() => { const j = document.getElementById('jump'); if (!j) return 'none'; const r = j.querySelector('.jp-panel').getBoundingClientRect();
  return { hidden: j.hidden, open: j.classList.contains('is-open'), left: Math.round(r.left), right: Math.round(r.right), url: location.pathname.split('/').pop() + location.search, hl: history.length, sy: Math.round(scrollY) }; });
(async () => {
  const b = await chromium.launch();
  const errs = [];
  async function page(w, h, ua, theme = 'light', fresh = true) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 1024, hasTouch: w < 1024, userAgent: ua, deviceScaleFactor: 1 });
    await ctx.addInitScript(t => { localStorage.setItem('lx.prefs', JSON.stringify({ tv: 3, theme: t })); }, theme);
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(w + ' ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(w + ' ' + m.text()); });
    return p;
  }
  // ===== iPhone =====
  let p = await page(390, 844, IOS);
  await p.goto(BASE + 'dieu-171', { waitUntil: 'networkidle' }); await p.waitForSelector('#lawBody');
  const hdr = await p.evaluate(() => { const t = document.querySelector('.brand-t b'); return { clipped: t.scrollWidth > t.clientWidth, icons: [...document.querySelectorAll('.hd-acts > *')].filter(e => e.offsetParent).length }; });
  check(!hdr.clipped && hdr.icons === 1, 'đầu trang điện thoại gọn: tên trang không bị cắt, chỉ còn nút giao diện (' + JSON.stringify(hdr) + ')');
  check(await p.$eval('.jp-edge', e => getComputedStyle(e).display !== 'none'), 'trang điều luật: có tay nắm mục lục ở mép phải');
  // 1. Tab "Mục lục" → ngăn kéo bên phải, không chuyển trang
  await p.tap('.tabbar a[data-nav="muc-luc"]'); await p.waitForTimeout(450);
  let st = await state(p);
  check(st.open && st.right === 390 && st.left > 30 && st.url === 'dieu-171', 'tab Mục lục mở ngăn kéo bên phải tại chỗ (' + JSON.stringify(st) + ')');
  check(await p.$eval('.jp-a.on', e => e.dataset.id) === '171', 'ngăn kéo đánh dấu Điều 171 đang đọc');
  check(await p.$eval('#jpTip', e => !e.hidden), 'lần đầu: có mẹo "vuốt từ mép phải"');
  await p.screenshot({ path: OUT + 'dr-ios-open.png' });
  // 2. Chạm phần tối bên trái → đóng (có hiệu ứng trượt ra)
  await p.tap('.jp-bg', { position: { x: 20, y: 400 } }); await p.waitForTimeout(80);
  st = await state(p); check(!st.open && !st.hidden, 'chạm vùng tối: bắt đầu trượt ra'); await p.waitForTimeout(350);
  st = await state(p); check(st.hidden && st.url === 'dieu-171', 'chạm vùng tối: đóng hẳn, vẫn ở Điều 171');
  // 3. Vuốt ngắn, chậm từ mép phải → không mở (trả về)
  await swipe(p, line(384, 420, 344, 424, 10), 30); await p.waitForTimeout(400);
  st = await state(p); check(st.hidden, 'vuốt ngắn và chậm: không mở (ngăn kéo tự trả về)');
  // 4. Vuốt dọc ở mép phải → cuộn trang, không mở
  await swipe(p, line(372, 650, 368, 250, 20), 16); await p.waitForTimeout(400);
  st = await state(p); check(st.hidden && st.sy > 100, 'vuốt dọc ở mép phải: trang cuộn bình thường, không mở (scrollY=' + st.sy + ')');
  // 5. Vuốt từ mép phải sang trái → mở, ngăn kéo bám ngón tay
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 382, y: 400 }] });
  for (const [x, y] of line(382, 400, 250, 404, 12)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await p.waitForTimeout(20); }
  const mid = await p.evaluate(() => { const j = document.getElementById('jump'), r = j.querySelector('.jp-panel').getBoundingClientRect(); return { drag: j.classList.contains('is-drag'), left: Math.round(r.left), bg: +getComputedStyle(j.querySelector('.jp-bg')).opacity }; });
  check(mid.drag && mid.left > 230 && mid.left < 300 && mid.bg > 0.1 && mid.bg < 0.7, 'đang vuốt: ngăn kéo bám theo ngón tay (' + JSON.stringify(mid) + ')');
  await p.screenshot({ path: OUT + 'dr-ios-drag.png' });
  for (const [x, y] of line(250, 404, 120, 408, 8)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await p.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
  await p.waitForTimeout(400);
  st = await state(p); check(st.open && st.left > 30, 'thả tay: ngăn kéo mở hẳn');
  check(await p.evaluate(() => JSON.parse(localStorage.getItem('lx.swipeOk'))) === 1 && await p.$eval('#jpTip', e => e.hidden), 'đã dùng cử chỉ vuốt → ẩn mẹo cho những lần sau');
  // 6. Cuộn ngang dải chương trong ngăn kéo không làm đóng ngăn kéo
  await swipe(p, line(150, 205, 340, 207, 12), 16); await p.waitForTimeout(400);
  st = await state(p); check(st.open, 'vuốt ngang trên dải số chương: chỉ cuộn dải, ngăn kéo vẫn mở');
  // 7. Kéo ngăn kéo sang phải → đóng
  await swipe(p, line(150, 600, 360, 602, 14), 16); await p.waitForTimeout(400);
  st = await state(p); check(st.hidden, 'kéo ngăn kéo sang phải: đóng');
  // 8. Tay nắm mép phải: chạm → mở; chọn điều → chuyển trang, ngăn kéo đóng
  await p.evaluate(() => scrollTo(0, 0));
  await p.tap('.jp-edge'); await p.waitForTimeout(400);
  st = await state(p); check(st.open, 'chạm tay nắm mép phải: mở mục lục');
  await p.tap('.jp-a[data-id="173"]'); await p.waitForTimeout(600);
  st = await state(p); check(st.hidden && st.url === 'dieu-173', 'chọn Điều 173 trong ngăn kéo: chuyển trang, ngăn kéo đóng');
  // 9. Thanh chuyển điều & menu ☰ cùng mở ngăn kéo này
  await p.evaluate(() => document.querySelector('.pager .pg-all').scrollIntoView());
  await p.tap('.pager .pg-all'); await p.waitForTimeout(400);
  check((await state(p)).open && await p.$eval('.pager .pg-all span', e => e.textContent) === 'Mục lục', 'nút "Mục lục" giữa Điều trước/sau mở ngăn kéo');
  await p.tap('.jp-x'); await p.waitForTimeout(400);
  await p.tap('.hd-menu'); await p.waitForTimeout(250);
  check(await p.$$eval('#drawerNav [data-act="jump"]', a => a.length) === 1, 'menu ☰ chỉ còn một mục Mục lục (không trùng lặp)');
  await p.tap('#drawerNav [data-act="jump"]'); await p.waitForTimeout(400);
  check((await state(p)).open && await p.$eval('#drawer', e => e.hidden), 'menu ☰ → "Mục lục Bộ luật": đóng menu trái, mở mục lục phải');
  // 10. Liên kết trang Mục lục đầy đủ trong ngăn kéo
  await p.tap('.jp-ft a'); await p.waitForTimeout(600);
  st = await state(p); check(st.hidden && st.url === 'muc-luc', 'chân ngăn kéo → mở trang Mục lục đầy đủ');
  await p.context().close();
  // 11. Màn hình 360: vuốt trên thanh tab cuộn ngang không mở mục lục
  p = await page(360, 740, IOS, 'dark');
  await p.goto(BASE + 'dieu-171', { waitUntil: 'networkidle' }); await p.waitForSelector('#lawBody');
  const ty = await p.$eval('.tabs', e => { const r = e.getBoundingClientRect(); return { y: r.top + r.height / 2, over: e.scrollWidth > e.clientWidth }; });
  if (ty.over) { await swipe(p, line(340, ty.y, 150, ty.y, 12), 16); await p.waitForTimeout(400); check((await state(p)) === 'none' || (await state(p)).hidden, 'vuốt trên thanh tab cuộn ngang: không mở mục lục'); }
  else console.log('SKIP thanh tab không tràn ở 360px');
  await swipe(p, line(352, 500, 120, 500, 14), 16); await p.waitForTimeout(450);
  await p.screenshot({ path: OUT + 'dr-ios-dark-360.png' });
  check((await state(p)).open, 'màn hình 360, nền tối: vuốt từ mép phải mở mục lục');
  await p.context().close();
  // ===== Android: nút/cử chỉ Quay lại đóng ngăn kéo =====
  p = await page(412, 900, AND);
  await p.goto(BASE + 'dieu-171', { waitUntil: 'networkidle' }); await p.waitForSelector('#lawBody');
  const h0 = await p.evaluate(() => history.length);
  await p.tap('.tabbar a[data-nav="muc-luc"]'); await p.waitForTimeout(400);
  await p.evaluate(() => history.back()); await p.waitForTimeout(500);
  st = await state(p); check(st.hidden && st.url === 'dieu-171', 'Android: Quay lại khi ngăn kéo mở → chỉ đóng ngăn kéo, vẫn ở Điều 171');
  await p.tap('.tabbar a[data-nav="muc-luc"]'); await p.waitForTimeout(400);
  await p.tap('.jp-x'); await p.waitForTimeout(450);
  await p.tap('.tabbar a[data-nav="muc-luc"]'); await p.waitForTimeout(400);
  // đóng rồi mở lại ngay (trước khi sự kiện Quay lại tới nơi) → ngăn kéo vẫn mở
  await p.evaluate(() => { document.querySelector('.jp-x').click(); document.querySelector('.tabbar a[data-nav="muc-luc"]').click(); });
  await p.waitForTimeout(500);
  check((await state(p)).open, 'Android: đóng rồi mở lại tức thì → ngăn kéo vẫn mở (không bị đóng nhầm)');
  await p.tap('.jp-a[data-id="168"]'); await p.waitForTimeout(600);
  await p.evaluate(() => history.back()); await p.waitForTimeout(600);
  st = await state(p); check(st.url === 'dieu-171', 'Android: chọn Điều 168 rồi Quay lại 1 lần → về đúng Điều 171 (' + st.url + ')');
  await p.context().close();
  // ===== Máy tính =====
  p = await page(1440, 900, undefined, 'dark');
  await p.goto(BASE + 'dieu-171', { waitUntil: 'networkidle' }); await p.waitForSelector('#lawBody');
  check(await p.$$eval('.hd-nav a', a => a.map(x => x.textContent).join('|')) === 'Mục lục|Công cụ|Đã lưu', 'đầu trang máy tính: Mục lục | Công cụ | Đã lưu (bỏ nút "Tất cả điều" trùng lặp)');
  await p.click('.hd-nav a[data-nav="muc-luc"]'); await p.waitForTimeout(350);
  st = await state(p); check(st.open && st.left > 100 && st.right < 1340, 'máy tính: "Mục lục" mở hộp thoại giữa màn hình (' + st.left + '–' + st.right + ')');
  await p.screenshot({ path: OUT + 'dr-desktop.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  check((await state(p)).hidden, 'máy tính: Esc đóng ngay');
  const [np] = await Promise.all([p.context().waitForEvent('page', { timeout: 3000 }).catch(() => null), p.click('.hd-nav a[data-nav="muc-luc"]', { modifiers: ['Control'] })]);
  await p.waitForTimeout(300);
  check(np && (await state(p)).hidden, 'máy tính: Ctrl+bấm "Mục lục" mở trang Mục lục ở thẻ mới như liên kết thường');
  await p.context().close();
  console.log(errs.length ? 'JS ERRORS:\n' + errs.join('\n') : 'Không có lỗi JavaScript');
  await b.close();
})();
