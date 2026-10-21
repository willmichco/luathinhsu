// Chạy: python3 tools/serve.py 8765 & node tools/test/typotest.js  (cần Playwright; BASE đổi được qua biến môi trường)
// Dàn chữ: lề treo khoản/điểm/gạch đầu dòng thẳng mép ở mọi dòng, sao chép giữ "1. Người…", căn đều theo bề rộng cột,
// ghi chú căn cứ không vỡ dòng, bảng nhiều cột không ép chữ thành cột hẹp trên điện thoại.
const BASE = process.env.BASE || 'http://localhost:8765/luathinhsu/';
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const check = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
  // Độ lệch lớn nhất (px) giữa mép trái các dòng chữ của từng đoạn có nhãn treo (bỏ qua chính nhãn). Mỗi mảnh chữ được xếp vào
  // dòng theo tâm theo chiều dọc (chỉ số trên "*", chú thích vẫn thuộc dòng của nó); mép trái của dòng là mảnh chữ ngoài cùng bên trái
  const hang = sel => Math.max.apply(0, [...document.querySelectorAll(sel)].map(p => {
    const mk = p.querySelector('.kn,.pl,.bm'), r = document.createRange(), top = p.getBoundingClientRect().top;
    const lh = parseFloat(getComputedStyle(p).lineHeight), lines = {};
    r.setStartAfter(mk); r.setEnd(p, p.childNodes.length);
    [...r.getClientRects()].forEach(x => {
      if (x.width < 1) return;
      const k = Math.floor((x.top + x.height / 2 - top) / lh);
      lines[k] = Math.min(lines[k] == null ? 1e9 : lines[k], x.left);
    });
    const ls = Object.values(lines);
    return ls.length > 1 ? Math.round(Math.max.apply(0, ls) - Math.min.apply(0, ls)) : 0;
  }).concat(0));
  for (const [w, mob] of [[390, true], [768, true], [1440, false]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: mob, hasTouch: mob });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(w + ' ' + e.message));
    await p.goto(BASE + 'dieu-173', { waitUntil: 'networkidle' }); await p.waitForSelector('#lawBody .kn');
    const law = await p.evaluate(hang, '#lawBody .lk, #lawBody .lp');
    check(law <= 1, w + 'px: khoản, điểm – mọi dòng chữ thẳng một mép (lệch ' + law + 'px)');
    const r = await p.evaluate(() => {
      const s = getSelection(), rg = document.createRange(); rg.selectNodeContents(document.querySelector('#k1')); s.removeAllRanges(); s.addRange(rg);
      const t = s.toString(); s.removeAllRanges();
      const ta = getComputedStyle(document.querySelector('#lawBody .lk')).textAlign;
      const k = document.querySelector('#k1 .lk').getBoundingClientRect().left, pt = document.querySelector('#k1-a .pl').getBoundingClientRect().left;
      return { t, ta, nest: Math.round(pt - k) };
    });
    check(/^1\. Người nào/.test(r.t) && /\na\) Đã bị/.test(r.t), w + 'px: sao chép giữ "1. Người nào…", "a) Đã bị…"');
    check(w < 700 ? r.ta !== 'justify' : r.ta === 'justify', w + 'px: căn ' + r.ta + (w < 700 ? ' (cột hẹp không căn đều)' : ' (cột rộng căn đều)'));
    check(w < 700 ? r.nest === 0 : r.nest > 10, w + 'px: nhãn điểm ' + (w < 700 ? 'chung rãnh với số khoản' : 'lùi vào dưới khoản') + ' (' + r.nest + 'px)');
    await p.click('#tab-binh-luan'); await p.waitForSelector('.cm .cb .bm');
    const cm = await p.evaluate(hang, '.cm .cb');
    check(cm <= 1, w + 'px: gạch đầu dòng bình luận – mọi dòng thẳng một mép (lệch ' + cm + 'px)');
    await p.goto(BASE + 'cong-cu', { waitUntil: 'networkidle' }); await p.waitForSelector('.legal-src');
    const t = await p.evaluate(() => {
      const n = document.querySelector('.cmp-tbl--stack'), cells = [...n.querySelectorAll('td:nth-child(2)')];
      // "(" đứng ngay trước liên kết "Điều 28" phải cùng dòng với liên kết (trước đây khối flex tách chúng thành hai mảnh rời)
      const lp = [...document.querySelectorAll('.legal-src')].find(x => /Điều 28/.test(x.textContent)), a = lp.querySelector('a');
      const tn = a.previousSibling, rg = document.createRange(); rg.setStart(tn, tn.length - 1); rg.setEnd(tn, tn.length);
      return { narrow: Math.min.apply(0, cells.map(c => c.offsetWidth)), over: n.offsetWidth - n.parentElement.clientWidth,
        link: Math.abs(rg.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom) < 4 };
    });
    check(t.over <= 0 && t.narrow > 150, w + 'px: bảng phân loại tội vừa khung, cột mô tả rộng ' + t.narrow + 'px');
    check(t.link, w + 'px: ghi chú căn cứ chảy liền dòng, "(" và "Điều 28" cùng một dòng');
    await ctx.close();
  }
  console.log(errs.length ? 'ERR ' + errs.join(';') : 'Không có lỗi JavaScript');
  await b.close();
})();
