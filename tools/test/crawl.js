// Chạy: python3 tools/serve.py 8765 & node tools/test/crawl.js  (cần Playwright; BASE, OUT đổi được qua biến môi trường)
const path = require('path'), os = require('os');
const BASE = process.env.BASE || 'http://localhost:8765/luathinhsu/';
const OUT = (process.env.OUT || os.tmpdir()) + path.sep;
const { chromium } = require('playwright');
const fs = require('fs');
const R = path.resolve(__dirname, '../..') + '/';
const pages = fs.readdirSync(R).filter(f => f.endsWith('.html') && f !== '404.html').map(f => f === 'index.html' ? '' : f.replace(/\.html$/, ''));
(async () => {
  const b = await chromium.launch();
  const out = { err: {}, bad: {}, overflow: {}, links: new Set(), empty: [] };
  for (const [vw, mob] of [[1366, false], [375, true]]) {
    const ctx = await b.newContext({ viewport: { width: vw, height: 800 }, isMobile: mob, hasTouch: mob });
    const p = await ctx.newPage();
    let cur = '';
    p.on('pageerror', e => (out.err[cur + '@' + vw] = out.err[cur + '@' + vw] || []).push(e.message));
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') (out.err[cur + '@' + vw] = out.err[cur + '@' + vw] || []).push(m.type() + ': ' + m.text()); });
    p.on('response', r => { if (r.status() >= 400) (out.bad[r.url()] = out.bad[r.url()] || new Set()).add(cur); });
    const list = mob ? pages.filter((x, i) => !x.startsWith('dieu-') || i % 7 === 0) : pages;
    for (const path of list) {
      cur = path || 'home';
      await p.goto(BASE + path, { waitUntil: 'networkidle' });
      await p.waitForTimeout(120);
      const r = await p.evaluate(() => ({
        ov: document.documentElement.scrollWidth - innerWidth,
        pre: !!document.querySelector('[data-prerender]'),
        main: (document.querySelector('#main') || {}).innerText ? document.querySelector('#main').innerText.length : 0,
        links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => /^(dieu|chuong|cong-cu|muc-luc|tim-kiem|da-luu|gioi-thieu)/.test(h)).map(h => h.split(/[?#]/)[0])
      }));
      if (r.ov > 1) out.overflow[cur + '@' + vw] = r.ov;
      if (r.pre || r.main < 200) out.empty.push(cur + '@' + vw + ' pre=' + r.pre + ' len=' + r.main);
      r.links.forEach(l => out.links.add(l));
    }
    await ctx.close();
  }
  const missing = [...out.links].filter(l => !fs.existsSync(R + l + '.html'));
  console.log('JS/console errors:', JSON.stringify(out.err, null, 1).slice(0, 3000));
  console.log('HTTP>=400:', JSON.stringify(Object.fromEntries(Object.entries(out.bad).map(([k, v]) => [k, [...v].slice(0, 3)]))));
  console.log('Horizontal overflow:', JSON.stringify(out.overflow));
  console.log('Not hydrated / empty:', out.empty.slice(0, 20));
  console.log('Internal links:', out.links.size, 'missing targets:', missing);
  await b.close();
})();
