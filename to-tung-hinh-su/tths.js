/*
 * Phân mục Bộ luật Tố tụng hình sự: trang tĩnh, script nhỏ cho giao diện (sáng/tối, cỡ chữ, menu), lọc mục lục,
 * tìm kiếm toàn văn (tim-kiem.json) và các nút của trang điều luật. Dùng chung tùy chọn hiển thị với trang
 * Bộ luật Hình sự (localStorage "lx.prefs").
 */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var DIR = 'to-tung-hinh-su/';
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var fold = function (s) { return window.LX ? LX.fold(s) : s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); };

  /* ---------- Tùy chọn hiển thị ---------- */
  var Prefs = {
    get: function () { try { return JSON.parse(localStorage.getItem('lx.prefs') || '{}'); } catch (e) { return {}; } },
    set: function (k, v) { var p = Prefs.get(); p[k] = v; try { localStorage.setItem('lx.prefs', JSON.stringify(p)); } catch (e) { } Prefs.apply(); },
    apply: function () {
      var p = Prefs.get(), d = document.documentElement, th = p.theme || 'light';
      var dark = th === 'dark' || (th === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      d.setAttribute('data-theme', th === 'auto' ? (dark ? 'dark' : 'light') : th);
      d.style.setProperty('--fs-step', p.fs || 0);
      d.classList.toggle('serif-law', p.serif === true);
      var m = $('meta[name="theme-color"]'); if (m) m.setAttribute('content', dark ? '#2c0709' : '#7a1216');
      var cs = $('meta[name="color-scheme"]'); if (cs) cs.setAttribute('content', dark ? 'dark' : 'light');
      $$('[data-set="theme"] button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === th)); });
      $$('[data-set="serif"] button').forEach(function (b) { b.setAttribute('aria-pressed', String((b.dataset.v === '1') === (p.serif === true))); });
      $$('.fs-out').forEach(function (o) { o.textContent = (100 + (p.fs || 0) * 6) + '%'; });
    }
  };
  Prefs.apply();

  var toastT;
  function toast(t) {
    var el = $('#toast'); if (!el) return;
    el.textContent = t; el.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('on'); }, 2200);
  }
  function copy(t, msg) {
    var done = function () { toast(msg); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, fallback); else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Không sao chép được'); }
      ta.remove();
    }
  }

  /* ---------- Menu, bảng công cụ đọc ---------- */
  function drawer(open) {
    var d = $('#drawer'); if (!d) return;
    d.hidden = !open;
    var b = $('.hd-menu'); if (b) b.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) { var f = $('.drawer-panel a'); if (f) f.focus(); }
  }
  function sheet(html) {
    var s = $('#sheet'); if (!s) return;
    if (html == null) { s.hidden = true; document.body.style.overflow = ''; return; }
    $('#sheetBody').innerHTML = html; s.hidden = false; document.body.style.overflow = 'hidden';
    var f = $('#sheetBody button'); if (f) f.focus();
  }
  function settings() {
    var p = Prefs.get(), th = p.theme || 'light', fs = p.fs || 0;
    sheet('<h2 id="sheetTitle">Công cụ đọc</h2><p class="set-sub">Thay đổi áp dụng ngay và được ghi nhớ trên thiết bị này</p>' +
      '<div class="set-row"><div><b>Giao diện</b><small>Sáng, tối hoặc theo thiết bị</small></div><div class="seg" data-set="theme">' +
      [['light', 'Sáng'], ['dark', 'Tối'], ['auto', 'Theo máy']].map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (th === o[0]) + '">' + o[1] + '</button>'; }).join('') +
      '</div></div><div class="set-row"><div><b>Cỡ chữ văn bản</b><small>Điều luật và văn bản sửa đổi</small></div><div class="fs-ctl">' +
      '<button type="button" data-fs="-1" aria-label="Giảm cỡ chữ">A−</button><output class="fs-out" aria-live="polite">' + (100 + fs * 6) + '%</output>' +
      '<button type="button" data-fs="1" aria-label="Tăng cỡ chữ">A+</button></div></div>' +
      '<div class="set-row"><div><b>Kiểu chữ điều luật</b><small>Mặc định không chân</small></div><div class="seg" data-set="serif">' +
      '<button type="button" data-v="0" aria-pressed="' + (p.serif !== true) + '">Không chân</button><button type="button" data-v="1" aria-pressed="' + (p.serif === true) + '">Có chân</button></div></div>');
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]'), A = a && a.dataset.act;
    if (A === 'drawer') { e.preventDefault(); drawer(true); }
    else if (A === 'drawer-close') { e.preventDefault(); drawer(false); }
    else if (A === 'sheet-close') { sheet(null); }
    else if (A === 'settings') { e.preventDefault(); drawer(false); settings(); }
    else if (A === 'theme') {
      var cur = Prefs.get().theme || 'light', dark = cur === 'dark' || (cur === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      Prefs.set('theme', dark ? 'light' : 'dark'); toast(dark ? 'Đã chuyển sang giao diện sáng' : 'Đã chuyển sang giao diện tối');
    }
    else if (A === 'print') window.print();
    else if (A === 'copy-art') {
      var art = $('#art'), h = $('#art h1'), body = $('#lawBody');
      if (!art || !body) return;
      var lines = $$('p', body).map(function (p) { return p.textContent.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
      var cite = ($('#citeT') || {}).textContent || 'Bộ luật Tố tụng hình sự số 101/2015/QH13';
      copy(h.textContent.replace(/\s+/g, ' ').trim() + '\n\n' + lines.join('\n') + '\n\n(' + cite + ')', 'Đã sao chép toàn văn ' + h.querySelector('.dn').textContent.replace(/\.$/, ''));
    }
    else if (A === 'share') {
      var t = document.title, url = location.href.split('#')[0];
      if (navigator.share) navigator.share({ title: t, url: url }).catch(function () { });
      else copy(url, 'Đã sao chép liên kết');
    }
    var s = e.target.closest('[data-set] button');
    if (s) { var key = s.parentNode.dataset.set; if (key === 'theme') Prefs.set('theme', s.dataset.v); if (key === 'serif') Prefs.set('serif', s.dataset.v === '1'); }
    var f = e.target.closest('[data-fs]');
    if (f) Prefs.set('fs', Math.max(-2, Math.min(5, (Prefs.get().fs || 0) + (+f.dataset.fs))));
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { drawer(false); sheet(null); }
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) {
      var i = $('#srQ') || $('#tocQ') || $('#hdSearch .sb-in'); if (i) { e.preventDefault(); i.focus(); }
    }
    if (!/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      var r = e.key === 'ArrowLeft' ? $('.pager a[rel="prev"]') : e.key === 'ArrowRight' ? $('.pager a[rel="next"]') : null;
      if (r) location.href = r.href;
    }
  });

  // Số điều gõ vào ô tìm kiếm → mở thẳng điều đó ("143", "điều 143", "khoản 2 điều 173")
  function direct(q) {
    var f = fold(q).trim(), m;
    if ((m = f.match(/^(?:dieu\s*)?(\d{1,3}[a-z]?)$/)) || (m = f.match(/^khoan\s*(\d+[a-z]?)\s*dieu\s*(\d{1,3}[a-z]?)$/))) {
      var id = m[2] || m[1], k = m[2] ? m[1] : null;
      return DIR + 'dieu-' + id + (k ? '#k' + k : '');
    }
    return null;
  }
  $$('form.sb').forEach(function (fm) {
    fm.addEventListener('submit', function (e) {
      var i = $('.sb-in', fm), u = i && direct(i.value);
      if (u) { e.preventDefault(); location.href = document.baseURI.replace(/[^/]*$/, '') + u; }
    });
  });

  /* ---------- Lên đầu trang, đánh dấu khoản ---------- */
  var tt = $('#toTop');
  if (tt) {
    tt.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    window.addEventListener('scroll', function () { tt.classList.toggle('on', window.scrollY > 600); }, { passive: true });
  }
  function flash() {
    var h = location.hash.slice(1); if (!h) return;
    var el = document.getElementById(h); if (!el) return;
    var k = el.closest('.kh') || el;
    k.classList.remove('flash'); void k.offsetWidth; k.classList.add('flash');
  }
  window.addEventListener('hashchange', flash); flash();

  /* ---------- Cột trái: lọc điều trong chương đang đọc ---------- */
  var sq = $('#sideQ');
  if (sq) {
    sq.addEventListener('input', function () {
      var f = fold(sq.value.trim());
      $$('.side .sc-l a').forEach(function (a) { a.hidden = f && fold(a.textContent).indexOf(f) < 0; });
    });
    sq.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var u = direct(sq.value); if (u) location.href = document.baseURI.replace(/[^/]*$/, '') + u; } });
    var on = $('.side .sc-l a.on'); if (on && on.scrollIntoView) { var b = $('.side-b'); b.scrollTop = on.offsetTop - b.clientHeight / 3; }
  }

  /* ---------- Trang mục lục: lọc ---------- */
  var tq = $('#tocQ');
  if (tq) {
    var mode = 'all';
    var all = $$('.toc-part .ta');
    var tocFilter = function () {
      var raw = tq.value.trim(), f = fold(raw).replace(/^dieu\s+/, ''), any = false;
      var num = /^\d{1,3}[a-z]?$/.test(f), chm = f.match(/^chuong\s+([ivxlc]+)$/);
      $$('.tch').forEach(function (ch) {
        var n = 0, chNum = fold($('.cn', ch).textContent);
        $$('.ta', ch).forEach(function (a) {
          var ok = true, txt = a.dataset.f || '';
          if (chm) ok = chNum === chm[1];
          else if (num) ok = (' ' + txt + ' ').indexOf('dieu ' + f + ' ') >= 0;
          else if (f) ok = fold(txt).indexOf(f) >= 0 || fold($('.ct b', ch).textContent).indexOf(f) >= 0;
          if (ok && mode === 'am') ok = !!$('.tag--am,.tag--new', a);
          if (ok && mode === 'fut') ok = !!$('.tag--fut', a);
          a.hidden = !ok; if (ok) n++;
        });
        $$('.tmuc', ch).forEach(function (m) {
          var x = m.nextElementSibling, vis = false;
          while (x && !x.classList.contains('tmuc')) { if (!x.hidden) vis = true; x = x.nextElementSibling; }
          m.hidden = !vis;
        });
        ch.hidden = n === 0;
        if (raw || mode !== 'all') ch.open = n > 0;
        if (n) any = true;
      });
      $$('.toc-part').forEach(function (p) { p.hidden = !$$('.tch', p).some(function (c) { return !c.hidden; }); });
      $('.toc-empty').hidden = any;
    };
    tq.addEventListener('input', tocFilter);
    tq.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var u = direct(tq.value); if (u) location.href = document.baseURI.replace(/[^/]*$/, '') + u; } });
    $$('.toc-open .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.f) {
          mode = b.dataset.f;
          $$('.toc-open [data-f]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          if (mode === 'all' && !tq.value.trim()) { $$('.tch').forEach(function (c) { c.hidden = false; c.open = false; }); }
          tocFilter();
        } else {
          var o = b.dataset.x === 'open';
          $$('.tch').forEach(function (c) { if (!c.hidden) c.open = o; });
        }
      });
    });
    // Mở sẵn chương theo địa chỉ (#chuong-ix) – liên kết từ trang điều luật
    var openHash = function () {
      var h = location.hash.slice(1), el = h && document.getElementById(h);
      if (el && el.tagName === 'DETAILS') { el.open = true; setTimeout(function () { el.scrollIntoView({ block: 'start' }); }, 0); }
    };
    window.addEventListener('hashchange', openHash); openHash();
    void all;
  }

  /* ---------- Trang tìm kiếm ---------- */
  var srList = $('#srList');
  if (srList) {
    var qs = new URLSearchParams(location.search).get('q') || '';
    var inp = $('#srQ'); if (inp) inp.value = qs;
    var stat = $('#srStat');
    var run = function (D) {
      var q = (inp ? inp.value : qs).trim();
      if (!q) { stat.textContent = 'Nhập từ khóa để tìm trong ' + D.a.length + ' điều luật và nội dung sửa đổi, bổ sung.'; srList.innerHTML = ''; return; }
      var pq = LX.parseQuery(q), M = LX.compile(pq, { prefix: true }), fq = fold(q).trim(), res = [];
      var num = fq.match(/^(?:dieu\s*)?(\d{1,3}[a-z]?)$/);
      D.a.forEach(function (r) {
        var id = r[0], t = r[1], body = r[3], am = r[4], sc = 0;
        if (num && id === num[1]) sc = 1000;
        if (fold(t).toLowerCase() === fq) sc += 200;
        var tl = t.toLowerCase(), tf = fold(t);
        if (M.exact(tl, tf)) sc += 60; else if (M.loose(tl, tf)) sc += 30;
        var bl = body.toLowerCase(), bf = fold(body);
        if (M.exact(bl, bf)) sc += 20; else if (M.loose(bl, bf)) sc += 8;
        var al = am.toLowerCase(), af = fold(am), inAm = false;
        if (am && (M.exact(al, af) || M.loose(al, af))) { sc += 5; inAm = true; }
        if (r[5]) sc -= 3;
        if (sc > 0) res.push({ r: r, sc: sc, am: inAm });
      });
      res.sort(function (a, b) { return b.sc - a.sc || (parseInt(a.r[0], 10) - parseInt(b.r[0], 10)); });
      var snip = function (txt) {
        var sp = M.find(txt, txt.toLowerCase());
        if (!sp.length) return esc(txt.slice(0, 220)) + (txt.length > 220 ? '…' : '');
        var s0 = Math.max(0, sp[0][0] - 90), e0 = Math.min(txt.length, sp[0][1] + 150), out = '', pos = s0;
        sp.forEach(function (s) { if (s[0] >= s0 && s[1] <= e0) { out += esc(txt.slice(pos, s[0])) + '<mark>' + esc(txt.slice(s[0], s[1])) + '</mark>'; pos = s[1]; } });
        return (s0 ? '…' : '') + out + esc(txt.slice(pos, e0)) + (e0 < txt.length ? '…' : '');
      };
      var hl = function (t) {
        var sp = M.find(t, t.toLowerCase()), out = '', pos = 0;
        sp.forEach(function (s) { out += esc(t.slice(pos, s[0])) + '<b>' + esc(t.slice(s[0], s[1])) + '</b>'; pos = s[1]; });
        return out + esc(t.slice(pos));
      };
      stat.textContent = res.length ? 'Tìm thấy ' + res.length + ' điều cho “' + q + '”' + (res.length > 80 ? ' – hiển thị 80 kết quả đầu' : '') : 'Không tìm thấy điều nào cho “' + q + '”. Thử gõ ít từ hơn hoặc không dấu.';
      srList.innerHTML = res.slice(0, 80).map(function (x) {
        var r = x.r, inBody = M.test(r[3]);
        return '<a class="sr" href="' + DIR + 'dieu-' + esc(r[0]) + '"><div class="sr-t"><span class="ty ty--law">Điều ' + esc(r[0]) + '</span>' +
          (r[5] ? '<span class="tag tag--rep">Đã bãi bỏ</span>' : '') + (x.am ? '<span class="ty ty--am">Có trong nội dung sửa đổi</span>' : '') +
          '<span class="where">' + esc(r[2]) + '</span></div><h3>' + hl(r[1]) + '</h3>' +
          '<p class="sn">' + snip(inBody || !x.am ? r[3] : r[4]) + '</p></a>';
      }).join('');
    };
    fetch(DIR + 'tim-kiem.json', { cache: 'force-cache' }).then(function (r) { return r.json(); }).then(function (D) {
      run(D);
      if (inp) {
        var tmr;
        inp.addEventListener('input', function () {
          clearTimeout(tmr);
          tmr = setTimeout(function () { run(D); history.replaceState(null, '', '?q=' + encodeURIComponent(inp.value.trim())); }, 160);
        });
      }
    }).catch(function () { stat.textContent = 'Không tải được dữ liệu tìm kiếm. Vui lòng kiểm tra kết nối mạng.'; });
  }
})();
