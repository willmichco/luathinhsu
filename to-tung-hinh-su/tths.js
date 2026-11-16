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
  var VER = ((document.currentScript && document.currentScript.src.match(/[?&]v=([^&]+)/)) || [])[1] || '';
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
  // Các dòng chỉnh hiển thị – cùng markup với UI.disp() của mục Bộ luật Hình sự (assets/js/app.js)
  function disp(compact) {
    var p = Prefs.get(), th = p.theme || 'light', fs = p.fs || 0;
    return '<div class="set-row"><div><b>Giao diện</b><small>Sáng, tối hoặc theo thiết bị</small></div><div class="seg" data-set="theme">' +
      [['light', 'Sáng'], ['dark', 'Tối'], ['auto', 'Theo máy']].map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (th === o[0]) + '">' + o[1] + '</button>'; }).join('') +
      '</div></div><div class="set-row"><div><b>' + (compact ? 'Cỡ chữ' : 'Cỡ chữ văn bản') + '</b><small>Điều luật và văn bản sửa đổi</small></div><div class="fs-ctl">' +
      '<button type="button" data-fs="-1" aria-label="Giảm cỡ chữ">A−</button><output class="fs-out" aria-live="polite">' + (100 + fs * 6) + '%</output>' +
      '<button type="button" data-fs="1" aria-label="Tăng cỡ chữ">A+</button></div></div>' +
      '<div class="set-row"><div><b>' + (compact ? 'Kiểu chữ' : 'Kiểu chữ điều luật') + '</b><small>Mặc định không chân</small></div><div class="seg" data-set="serif">' +
      '<button type="button" data-v="0" aria-pressed="' + (p.serif !== true) + '">Không chân</button><button type="button" data-v="1" aria-pressed="' + (p.serif === true) + '">Có chân</button></div></div>';
  }
  function settings() {
    var a = $('#art');
    sheet('<h2 id="sheetTitle">Công cụ đọc</h2><p class="set-sub">' + (a ? 'Điều ' + esc(a.dataset.id) + ' · ' : '') +
      'Thay đổi áp dụng ngay và được ghi nhớ trên thiết bị này</p>' + disp());
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

  /* ======================================================================
     Tìm kiếm – cùng cách hoạt động với mục Bộ luật Hình sự (assets/js/app.js: suggest, SearchBox,
     parseRef, trang tim-kiem; assets/js/search-engine.js: chấm điểm theo đoạn)
     ====================================================================== */
  var ROOT = document.baseURI.replace(/[^/]*$/, '');          // <base href="../"> → gốc trang
  var abs = function (h) { return ROOT + h; };
  var go = function (h) { location.href = abs(h); };
  var Store = {
    get: function (k, d) { try { var v = localStorage.getItem('lx.tths.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('lx.tths.' + k, JSON.stringify(v)); } catch (e) { } }
  };
  function rememberQ(q) {
    var l = Store.get('recentQ', []).filter(function (x) { return x !== q; });
    l.unshift(q); Store.set('recentQ', l.slice(0, 10));
  }
  var ic = function (n, cls) { return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true"><use href="#i-' + n + '"/></svg>'; };
  var ROMAN = function (s) { var v = { i: 1, v: 5, x: 10, l: 50 }, n = 0; for (var i = 0; i < s.length; i++) { var a = v[s[i]], b = v[s[i + 1]] || 0; n += a < b ? -a : a; } return n; };

  // Mục lục gọn (to-tung-hinh-su/muc-luc.json): tên điều, chương, nhãn sửa đổi – nạp khi bấm vào ô tìm kiếm
  var DB = null, dbP = null;
  function loadDB() {
    return dbP || (dbP = fetch(abs(DIR + 'muc-luc.json?v=' + VER)).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (d) {
      var chaps = d.ch.map(function (c) { return { slug: c[0], num: c[1], name: c[2], label: c[1] ? 'Chương ' + c[1] : 'Phần thứ chín', arts: [] }; });
      var arts = d.a.map(function (x, i) {
        var a = { id: x[0], t: x[1], ch: chaps[x[2]], fl: x[3], i: i, fo: fold(x[1]).toLowerCase() };
        a.ch.arts.push(a); return a;
      });
      var byId = {}; arts.forEach(function (a) { byId[a.id] = a; });
      DB = { v: d.v, chaps: chaps, arts: arts, byId: byId };
      return DB;
    }).catch(function (e) { dbP = null; throw e; }));
  }
  function artTags(a) {
    var f = a.fl || '', o = '';
    if (f.indexOf('r') > -1) o += '<span class="tag tag--rep">Đã bãi bỏ</span>';
    else if (f.indexOf('n') > -1) o += '<span class="tag tag--am">Bổ sung 2025</span>';
    if (f.indexOf('a') > -1 && f.indexOf('r') < 0) o += '<span class="tag tag--am">Sửa đổi</span>';
    if (f.indexOf('f') > -1) o += '<span class="tag tag--fut">Sắp sửa đổi</span>';
    return o;
  }

  // Cách gọi thông dụng → điều luật (khóa đã bỏ dấu)
  var SYN = {
    'tam giam': ['119', '173', '113'], 'thoi han tam giam': ['173', '119'], 'tam giu': ['117', '118'], 'thoi han tam giu': ['118'],
    'giu nguoi khan cap': ['110'], 'bat khan cap': ['110'], 'bat qua tang': ['111'], 'truy na': ['112', '231'], 'bat bi can': ['113'],
    'bao linh': ['121'], 'dat tien': ['122'], 'cam di khoi noi cu tru': ['123'], 'xuat canh': ['124'], 'tam hoan xuat canh': ['124'],
    'bien phap ngan chan': ['109', '125'], 'ke bien': ['128'], 'phong toa tai khoan': ['129'], 'ap giai': ['127'], 'dan giai': ['127'],
    'bao chua': ['72', '73', '74', '76', '78'], 'luat su': ['72', '73', '78', '80'], 'chi dinh nguoi bao chua': ['76'], 'dang ky bao chua': ['78'],
    'gap bi can': ['80'], 'bi hai': ['62', '155'], 'nguoi lam chung': ['66', '185', '186'], 'bi can': ['60', '179'], 'bi cao': ['61'],
    'to giac': ['144', '145', '146', '147'], 'tin bao': ['144', '147'], 'kien nghi khoi to': ['144', '147'], 'tu thu': ['152'], 'dau thu': ['152'],
    'khoi to': ['143', '153', '154', '179'], 'khoi to theo yeu cau': ['155'], 'rut yeu cau khoi to': ['155'], 'khong khoi to': ['157', '158'],
    'khoi to bi can': ['179'], 'hoi cung': ['183', '184'], 'ghi am': ['183'], 'ghi hinh': ['183'], 'lay loi khai': ['186', '188'],
    'doi chat': ['189'], 'nhan dang': ['190'], 'kham xet': ['192', '193', '194', '195'], 'du lieu dien tu': ['196'],
    'kham nghiem hien truong': ['201'], 'kham nghiem tu thi': ['202'], 'thuc nghiem dieu tra': ['204'],
    'giam dinh': ['205', '206', '208', '213'], 'dinh gia': ['215', '216', '221'], 'dieu tra dac biet': ['223', '224', '226'],
    'thoi han dieu tra': ['172'], 'tam dinh chi dieu tra': ['229'], 'dinh chi dieu tra': ['230'], 'phuc hoi dieu tra': ['235'],
    'ket luan dieu tra': ['232', '233', '234'], 'truy to': ['239', '240', '243'], 'cao trang': ['243', '244'],
    'tra ho so': ['245', '280'], 'dieu tra bo sung': ['245', '246', '280'], 'dinh chi vu an': ['248', '282'], 'tam dinh chi vu an': ['247'],
    'tham quyen xet xu': ['268', '269'], 'chuan bi xet xu': ['277'], 'hoan phien toa': ['297', '352'], 'xet hoi': ['307'],
    'tranh luan': ['320', '322'], 'loi sau cung': ['324'], 'nghi an': ['326'], 'tuyen an': ['327'],
    'khang cao': ['331', '332', '333', '335'], 'khang cao qua han': ['335'], 'khang nghi': ['336', '337'], 'phuc tham': ['330', '345', '355'],
    'sua ban an': ['357'], 'huy ban an': ['358', '359'], 'giam doc tham': ['370', '371', '373', '379'], 'tai tham': ['397', '398', '401'],
    'thi hanh an': ['363', '364'], 'tu hinh': ['367'], 'tha tu truoc thoi han': ['368'], 'xoa an tich': ['369'],
    'rut gon': ['455', '456', '457'], 'thu tuc rut gon': ['455', '456', '457'], 'phap nhan': ['431', '432', '433'],
    'khieu nai': ['469', '470', '471', '474'], 'to cao': ['478', '481'], 'bao ve nguoi to giac': ['484', '486'],
    'dan do': ['503', '506a'], 'tuong tro tu phap': ['491', '492'], 'bat buoc chua benh': ['447', '449'],
    'nguoi duoi 18 tuoi': ['413', '414'], 'nguoi chua thanh nien': ['413', '414'], 'suy doan vo toi': ['13'],
    'boi thuong': ['31'], 'oan sai': ['31'], 'chung cu': ['86', '87', '88', '108'], 'ho so vu an': ['131']
  };

  // "143", "điều 143", "khoản 2 điều 173", "điểm a khoản 1 điều 4", "chương 9", "chương ix" → nơi cần mở
  function parseRef(q) {
    if (!DB) return null;
    var f = fold(q).toLowerCase().replace(/[.,:;]+/g, ' ').replace(/\s+/g, ' ').trim(), m, art, k, pt;
    if (!f) return null;
    if ((m = f.match(/^(?:ch|chuong)\s*([0-9]{1,2}|[ivxl]{1,6})$/))) {
      var n = /^\d/.test(m[1]) ? +m[1] : ROMAN(m[1]);
      var ch = DB.chaps.filter(function (c) { return c.num && ROMAN(c.num.toLowerCase()) === n; })[0];
      return ch ? { chap: ch } : null;
    }
    if ((m = f.match(/^(?:diem\s+([a-z]{1,2})\s+)?(?:(?:khoan|k)\s*(\d{1,2}[a-z]?)\s+)?(?:dieu|d)\s*(\d{1,3}[a-z]?)(?:\s+(?:khoan|k)\s*(\d{1,2}[a-z]?))?(?:\s+(?:diem)\s*([a-z]))?$/))) {
      art = m[3]; k = m[2] || m[4]; pt = m[1] || m[5];
    } else if ((m = f.match(/^(\d{1,3}[a-z]?)$/))) art = m[1];
    else if ((m = f.match(/^(?:bo luat to tung hinh su|bltths|btths)\s*(?:dieu|d)?\s*(\d{1,3}[a-z]?)$/))) art = m[1];
    if (!art) return null;
    return { art: art, a: DB.byId[art] || null, k: k || null, pt: pt || null };
  }
  function refHref(r) {
    if (r.chap) return DIR + '#chuong-' + r.chap.slug;
    return DIR + 'dieu-' + r.art + (r.k ? '#k' + r.k + (r.pt ? '-' + r.pt : '') : '');
  }
  function refLabel(r) {
    if (r.chap) return r.chap.label + '. ' + r.chap.name;
    return (r.pt ? 'Điểm ' + r.pt + ' ' : '') + (r.k ? (r.pt ? 'khoản ' : 'Khoản ') + r.k + ' ' : '') + 'Điều ' + r.art;
  }
  function synIds(f) {
    var fw = ' ' + f + ' ', out = [];
    Object.keys(SYN).forEach(function (key) {
      var hit = fw.indexOf(' ' + key + ' ') > -1 || (f.length >= 3 && key.indexOf(f) === 0);
      if (hit) SYN[key].forEach(function (id) { if (out.indexOf(id) < 0 && DB.byId[id]) out.push(id); });
    });
    return out;
  }
  function suggest(q) {
    var out = [], seen = {}, raw = q.trim();
    if (!raw) {
      Store.get('recentQ', []).slice(0, 5).forEach(function (x) { out.push({ kind: 'recent', q: x, href: DIR + 'tim-kiem?q=' + encodeURIComponent(x) }); });
      Store.get('hist', []).slice(0, 4).forEach(function (h, i) { var a = DB.byId[h.id]; if (a) out.push({ kind: 'art', a: a, href: DIR + 'dieu-' + a.id, sec: i ? null : 'Đã xem gần đây' }); });
      return out;
    }
    var r = parseRef(raw);
    if (r) {
      if (r.chap) out.push({ kind: 'chap', chap: r.chap, href: refHref(r), sec: 'Đi tới', direct: 1 });
      else if (r.a) { out.push({ kind: 'art', a: r.a, href: refHref(r), lab: refLabel(r), sec: 'Đi tới', direct: 1 }); seen[r.a.id] = 1; }
      else out.push({ kind: 'none', lab: 'Bộ luật Tố tụng hình sự không có Điều ' + r.art });
    }
    var cq = LX.compile(LX.parseQuery(raw), { prefix: true }), f = fold(raw).toLowerCase();
    if (!cq.empty && raw.length >= 2) {
      var hits = [];
      DB.arts.forEach(function (a) {
        if (seen[a.id] || !cq.test(a.t)) return;
        var s = a.fo.indexOf(f) === 0 ? 3 : a.fo.indexOf(' ' + f) > -1 ? 2 : 1;
        hits.push({ a: a, s: s });
      });
      hits.sort(function (x, y) { return y.s - x.s || x.a.i - y.a.i; });
      hits.slice(0, 6).forEach(function (h, i) { seen[h.a.id] = 1; out.push({ kind: 'art', a: h.a, href: DIR + 'dieu-' + h.a.id + '?q=' + encodeURIComponent(raw), sec: i ? null : 'Tên điều luật' }); });
      synIds(f).filter(function (id) { return !seen[id]; }).slice(0, 5).forEach(function (id, i) {
        seen[id] = 1; out.push({ kind: 'art', a: DB.byId[id], href: DIR + 'dieu-' + id, sec: i ? null : 'Có thể bạn đang tìm' });
      });
      out.push({ kind: 'full', q: raw, href: DIR + 'tim-kiem?q=' + encodeURIComponent(raw), sec: 'Tìm trong toàn văn' });
    }
    return out;
  }

  // Ô tìm kiếm có gợi ý (giống SearchBox của mục Bộ luật Hình sự), gắn vào mọi form.sb có sẵn trên trang
  function SearchBox(form, opt) {
    opt = opt || {};
    var inp = $('.sb-in', form), box = $('.sb-box', form);
    if (!inp || form.dataset.sbx) return null;
    form.dataset.sbx = 1;
    var id = 'dd' + Math.random().toString(36).slice(2, 7);
    form.setAttribute('autocomplete', 'off');
    inp.setAttribute('role', 'combobox'); inp.setAttribute('aria-expanded', 'false'); inp.setAttribute('aria-controls', id); inp.setAttribute('aria-autocomplete', 'list');
    var clr = document.createElement('button');
    clr.type = 'button'; clr.className = 'sb-clear'; clr.setAttribute('aria-label', 'Xóa nội dung'); clr.innerHTML = ic('x'); clr.hidden = true;
    var kbd = $('.sb-kbd', box), goBtn = $('.sb-go', box);
    box.insertBefore(clr, kbd || goBtn || null);
    var dd = document.createElement('div'); dd.className = 'sb-dd'; dd.id = id; dd.setAttribute('role', 'listbox'); dd.hidden = true;
    form.appendChild(dd);
    if (opt.value) inp.value = opt.value;
    clr.hidden = !inp.value;
    var items = [], sel = -1;
    function render() {
      if (!DB) { loadDB().then(function () { if (document.activeElement === inp) render(); }, function () { }); return; }
      items = suggest(inp.value);
      if (!items.length) { close(); return; }
      sel = items[0].direct ? 0 : -1;
      var h = '', idx = 0;
      items.forEach(function (it) {
        if (it.sec) h += '<div class="sb-sec">' + esc(it.sec) + '</div>';
        if (it.kind === 'none') { h += '<div class="sb-it" aria-disabled="true">' + ic('info') + '<span class="tt">' + esc(it.lab) + '</span></div>'; return; }
        var i = idx++; it.i = i;
        var body;
        if (it.kind === 'art') {
          var a = it.a;
          body = '<span class="num">Điều ' + esc(a.id) + '</span><span class="tt">' + (it.lab && it.lab !== 'Điều ' + a.id ? '<b>' + esc(it.lab) + '</b> · ' : '') + esc(a.t) +
            '<small>' + esc(a.ch.label) + ' · ' + esc(a.ch.name) + '</small></span>';
        } else if (it.kind === 'chap') {
          body = '<span class="ic">' + ic('list') + '</span><span class="tt">' + esc(it.chap.label + '. ' + it.chap.name) + '<small>' + it.chap.arts.length + ' điều · Điều ' +
            it.chap.arts[0].id + ' – ' + it.chap.arts[it.chap.arts.length - 1].id + '</small></span>';
        } else if (it.kind === 'recent') {
          body = '<span class="ic">' + ic('history') + '</span><span class="tt">' + esc(it.q) + '</span>';
        } else {
          body = '<span class="ic">' + ic('search') + '</span><span class="tt">Tìm “' + esc(it.q) + '” trong toàn văn điều luật và nội dung sửa đổi</span>';
        }
        h += '<a class="sb-it" role="option" id="' + id + '-' + i + '" data-i="' + i + '" href="' + abs(it.href) + '" aria-selected="' + (sel === i) + '">' + body + '<span class="go">' + ic('chev-r') + '</span></a>';
      });
      if (!inp.value.trim()) h += '<div class="sb-hint">Mẹo: gõ <b>143</b>, <b>khoản 2 điều 173</b>, <b>chương 9</b> hoặc từ khóa không dấu như <b>tam giam</b>.</div>';
      dd.innerHTML = h; dd.hidden = false; inp.setAttribute('aria-expanded', 'true');
    }
    function close() { dd.hidden = true; inp.setAttribute('aria-expanded', 'false'); sel = -1; }
    function mark() {
      $$('.sb-it[data-i]', dd).forEach(function (el) { el.setAttribute('aria-selected', String(+el.dataset.i === sel)); });
      var cur = $('.sb-it[data-i="' + sel + '"]', dd);
      if (cur) { cur.scrollIntoView({ block: 'nearest' }); inp.setAttribute('aria-activedescendant', cur.id); }
    }
    function choose(it) {
      close();
      if (it.kind === 'full' || it.kind === 'recent') rememberQ(it.q);
      if (opt.onPick && (it.kind === 'full' || it.kind === 'recent')) { opt.onPick(it.q); return; }
      go(it.href);
    }
    inp.addEventListener('input', function () { clr.hidden = !inp.value; render(); if (opt.onInput) opt.onInput(inp.value); });
    inp.addEventListener('focus', render);
    inp.addEventListener('keydown', function (e) {
      var n = items.filter(function (x) { return x.kind !== 'none'; }).length;
      if (e.key === 'ArrowDown') { e.preventDefault(); if (dd.hidden) render(); sel = Math.min(n - 1, sel + 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(-1, sel - 1); mark(); }
      else if (e.key === 'Escape') { if (!dd.hidden) { e.stopPropagation(); close(); } else inp.blur(); }
    });
    dd.addEventListener('mousedown', function (e) { e.preventDefault(); });
    dd.addEventListener('click', function (e) {
      var a = e.target.closest('.sb-it[data-i]'); if (!a) return;
      e.preventDefault();
      var it = items.filter(function (x) { return x.i === +a.dataset.i; })[0];
      if (it) choose(it);
    });
    clr.addEventListener('click', function () { inp.value = ''; clr.hidden = true; inp.focus(); render(); if (opt.onInput) opt.onInput(''); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = inp.value.trim();
      if (sel > -1 && !dd.hidden) { var it = items.filter(function (x) { return x.i === sel; })[0]; if (it) { choose(it); return; } }
      if (!v) { inp.focus(); return; }
      var finish = function () {
        var r = parseRef(v);
        close(); inp.blur();
        if (r && (r.chap || r.a)) { go(refHref(r)); return; }
        rememberQ(v);
        if (opt.onPick) opt.onPick(v); else go(DIR + 'tim-kiem?q=' + encodeURIComponent(v));
      };
      if (DB) finish(); else loadDB().then(finish, finish);
    });
    inp.addEventListener('blur', function () { setTimeout(close, 150); });
    return { input: inp, close: close, set: function (v) { inp.value = v; clr.hidden = !v; } };
  }
  function direct(q) { var r = DB && parseRef(q); return r && (r.chap || r.a) ? refHref(r) : null; }
  $$('form.sb').forEach(function (fm) { if (!fm.closest('#srBox')) SearchBox(fm); });

  // Lịch sử điều đã xem (cho gợi ý "Đã xem gần đây")
  (function () {
    var art = $('#art'), h1 = $('#art h1');
    if (!art || !h1) return;
    var t = h1.textContent.replace(/^\s*Điều\s+\S+\.\s*/, '').trim();
    var l = Store.get('hist', []).filter(function (x) { return x.id !== art.dataset.id; });
    l.unshift({ id: art.dataset.id, t: t }); Store.set('hist', l.slice(0, 30));
  })();

  // Mở điều luật từ kết quả tìm kiếm (?q=…): tô sáng từ khóa trong văn bản điều luật và nội dung sửa đổi, cuộn tới chỗ đầu tiên
  (function () {
    var q = new URLSearchParams(location.search).get('q');
    if (!q || !$('#art') || !window.LX) return;
    var cq = LX.compile(LX.parseQuery(q));
    if (cq.empty) return;
    var first = null;
    $$('#lawBody, .am-body, details.orig .law').forEach(function (root) {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), nodes = [], n;
      while ((n = walker.nextNode())) nodes.push(n);
      nodes.forEach(function (node) {
        var t = node.nodeValue, sp = cq.find(t);
        if (!sp.length) return;
        var frag = document.createDocumentFragment(), last = 0;
        sp.forEach(function (s) {
          frag.appendChild(document.createTextNode(t.slice(last, s[0])));
          var m = document.createElement('mark'); m.textContent = t.slice(s[0], s[1]); frag.appendChild(m);
          if (!first) first = m;
          last = s[1];
        });
        frag.appendChild(document.createTextNode(t.slice(last)));
        node.parentNode.replaceChild(frag, node);
      });
    });
    if (first) {
      var d = first.closest('details'); if (d) d.open = true;
      setTimeout(function () { first.scrollIntoView({ block: 'center' }); }, 60);
    }
  })();

  /* ---------- Trang điều luật: khối Hiển thị ở cột phải, thanh tab (giống mục Bộ luật Hình sự) ---------- */
  var rail = $('.rail');
  if (rail && $('#art')) rail.insertAdjacentHTML('afterbegin', '<div class="rc rc-disp"><h3><svg aria-hidden="true"><use href="#i-text"/></svg>Hiển thị</h3>' + disp(true) + '</div>');
  var tabs = $$('.tabs a');
  if (tabs.length) {
    var mark = function (id) { tabs.forEach(function (t) { if (t.getAttribute('href') === '#' + id) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current'); }); };
    tabs.forEach(function (t) { t.addEventListener('click', function () { mark(t.getAttribute('href').slice(1)); }); });
    if (window.IntersectionObserver && tabs.length > 1) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) mark(en.target.id); }); }, { rootMargin: '-30% 0px -60% 0px' });
      tabs.forEach(function (t) { var el = document.getElementById(t.getAttribute('href').slice(1)); if (el) io.observe(el); });
    }
  }

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
    sq.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var v = sq.value; loadDB().then(function () { var u = direct(v); if (u) go(u); }, function () { }); } });
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
    tq.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var v = tq.value; loadDB().then(function () { var u = direct(v); if (u) go(u); }, function () { }); } });
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

  /* ---------- Trang tìm kiếm (giống trang tim-kiem của mục Bộ luật Hình sự) ---------- */
  // Bộ máy chấm điểm theo đoạn – cùng công thức với assets/js/search-engine.js:
  //   tên điều trùng/bắt đầu bằng từ khóa +80/+40, khớp tên điều ×45, mỗi đoạn điều luật ×7 (tối đa 8), mỗi đoạn sửa đổi ×1,4 (tối đa 25), khớp liền cụm +30
  function Engine(D) {
    var P = [], T = [];
    DB.arts.forEach(function (a) { T.push({ id: a.id, o: a.i, lo: ('Điều ' + a.id + '. ' + a.t).toLowerCase(), fo: fold('Điều ' + a.id + '. ' + a.t), tf: fold(a.t).toLowerCase() }); });
    D.a.forEach(function (r) {
      var a = DB.byId[r[0]]; if (!a) return;
      r[1].forEach(function (t, i) { P.push({ a: a.id, o: a.i, k: 'l', i: i, t: t, lo: t.toLowerCase(), fo: fold(t) }); });
      r[2].forEach(function (t, i) { P.push({ a: a.id, o: a.i, k: 'a', i: i, t: t, lo: t.toLowerCase(), fo: fold(t) }); });
    });
    function snippet(p, cq) {
      var sp = cq.find(p.t, p.lo), first = sp.length ? sp[0][0] : 0, s = Math.max(0, first - 70);
      if (s > 0) { var x = p.t.indexOf(' ', s); if (x > -1 && x < first) s = x + 1; }
      var e = Math.min(p.t.length, (sp.length ? sp[0][1] : 0) + 190);
      if (e < p.t.length) { var y = p.t.lastIndexOf(' ', e); if (y > first + 30) e = y; }
      var marks = [];
      sp.forEach(function (m) { if (m[0] >= s && m[1] <= e) marks.push([m[0] - s, m[1] - s]); });
      return [p.k, p.i, p.t.slice(s, e), marks, s > 0 ? 1 : 0, e < p.t.length ? 1 : 0];
    }
    this.run = function (q) {
      var t0 = Date.now(), cq = LX.compile(LX.parseQuery(q));
      if (cq.empty) return { q: q, exact: [], loose: [], ms: 0 };
      var exact = new Map(), loose = new Map();
      var rec = function (map, id, o) { var r = map.get(id); if (!r) { r = { id: id, o: o, th: 0, lh: 0, am: 0, sc: 0, sn: [] }; map.set(id, r); } return r; };
      P.forEach(function (p) {
        var map = cq.exact(p.lo, p.fo) ? exact : (cq.hasLoose && cq.loose(p.lo, p.fo) ? loose : null);
        if (!map) return;
        var r = rec(map, p.a, p.o);
        if (p.k === 'l') r.lh++; else r.am++;
        if (r.sn.filter(function (x) { return x[0] === p.k; }).length < 2) r.sn.push(snippet(p, cq));
      });
      // Tên điều trùng đúng từ khóa (vd. "tạm giam" → Điều 119. Tạm giam) hoặc bắt đầu bằng từ khóa: đưa lên trước
      var qf = fold(q).toLowerCase().replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();
      T.forEach(function (t) {
        var eq = t.tf === qf ? 2 : t.tf.indexOf(qf) === 0 ? 1 : 0;
        if (eq && qf.length >= 2) rec(exact, t.id, t.o).eq = eq;
        if (cq.exact(t.lo, t.fo)) rec(exact, t.id, t.o).th = 2;
        else if (cq.hasLoose && cq.loose(t.lo, t.fo)) rec(loose, t.id, t.o).th = 1;
      });
      var score = function (r, b) { return b + (r.eq || 0) * 40 + r.th * 45 + Math.min(r.lh, 8) * 7 + Math.min(r.am, 25) * 1.4; };
      var ex = Array.from(exact.values()), lo = [];
      ex.forEach(function (r) { r.sc = score(r, 30); });
      loose.forEach(function (r) { if (!exact.has(r.id)) { r.sc = score(r, 0); lo.push(r); } });
      var by = function (a, b) { return b.sc - a.sc || a.o - b.o; };
      ex.sort(by); lo.sort(by);
      return { q: q, exact: ex, loose: lo, ms: Date.now() - t0 };
    };
  }
  var srOut = $('#srOut');
  if (srOut) {
    var engP = null;
    var engine = function () {
      return engP || (engP = Promise.all([loadDB(), fetch(abs(DIR + 'tim-kiem.json?v=' + VER)).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })])
        .then(function (x) { return new Engine(x[1]); }).catch(function (e) { engP = null; throw e; }));
    };
    var state = function () {
      var p = new URLSearchParams(location.search);
      return { q: (p.get('q') || '').trim(), scope: p.get('pv') || 'all', chap: p.get('ch') || '', sort: p.get('sx') || 'rel' };
    };
    var urlOf = function (o) {
      return DIR + 'tim-kiem?q=' + encodeURIComponent(o.q) + (o.scope !== 'all' ? '&pv=' + o.scope : '') + (o.chap ? '&ch=' + o.chap : '') + (o.sort !== 'rel' ? '&sx=' + o.sort : '');
    };
    var tipsHtml = function () {
      var ex = [['Số điều', '143', 'đi thẳng tới Điều 143'], ['Khoản, điểm', 'điểm a khoản 1 điều 4', 'mở đúng vị trí trong điều'],
        ['Không dấu', 'tam giam', 'tự hiểu là “tạm giam”'], ['Cụm chính xác', '"thời hạn tạm giam"', 'các từ phải đứng liền nhau'],
        ['Theo cách gọi', 'kháng cáo quá hạn', 'gợi ý điều luật tương ứng'], ['Chương', 'chương 9', 'mở Chương IX – Khởi tố vụ án hình sự']];
      return '<h2 class="muc-h" style="margin-top:28px">Mẹo tìm kiếm</h2><div class="tips">' + ex.map(function (x) {
        return '<div class="tip"><b>' + x[0] + '</b><code data-try="' + esc(x[1]) + '">' + esc(x[1]) + '</code> → ' + x[2] + '</div>';
      }).join('') + '</div>';
    };
    var hl = function (t, cq) {
      var sp = cq.find(t, t.toLowerCase()), out = '', last = 0;
      sp.forEach(function (s) { out += esc(t.slice(last, s[0])) + '<mark>' + esc(t.slice(s[0], s[1])) + '</mark>'; last = s[1]; });
      return out + esc(t.slice(last));
    };
    var box = SearchBox($('#srBox form'), { value: state().q, onPick: function (v) { history.pushState(null, '', abs(urlOf({ q: v, scope: 'all', chap: '', sort: 'rel' }))); show(); } });
    var draw = function (res, o) {
      var all = res.exact.concat(res.loose), cnt = { all: all.length, tt: 0, law: 0, am: 0 };
      all.forEach(function (r) { if (r.th) cnt.tt++; if (r.lh) cnt.law++; if (r.am) cnt.am++; });
      var list = all.filter(function (r) {
        if (o.scope === 'tt' && !r.th) return false;
        if (o.scope === 'law' && !r.lh) return false;
        if (o.scope === 'am' && !r.am) return false;
        if (o.chap && DB.byId[r.id].ch.slug !== o.chap) return false;
        return true;
      });
      if (o.sort === 'order') list.sort(function (x, y) { return x.o - y.o; });
      var link = function (k, v) { var p = { q: o.q, scope: o.scope, chap: o.chap, sort: o.sort }; p[k] = v; return abs(urlOf(p)); };
      var chips = [['scope', 'all', 'Tất cả', cnt.all], ['scope', 'tt', 'Tên điều', cnt.tt], ['scope', 'law', 'Điều luật', cnt.law], ['scope', 'am', 'Sửa đổi, bổ sung', cnt.am]].map(function (x) {
        return '<a class="chip' + (o.scope === x[1] ? ' on' : '') + '" href="' + link(x[0], x[1]) + '" data-nav-in>' + x[2] + ' <span class="n">' + x[3] + '</span></a>';
      }).join('');
      var chOpts = '<option value="">Mọi chương</option>' + DB.chaps.map(function (c) {
        return '<option value="' + c.slug + '"' + (o.chap === c.slug ? ' selected' : '') + '>' + esc(c.label) + ' – ' + esc(c.name.length > 40 ? c.name.slice(0, 38) + '…' : c.name) + '</option>';
      }).join('');
      $('#srMeta').innerHTML = all.length ? 'Tìm thấy <b>' + all.length + '</b> điều có nội dung phù hợp' + (res.loose.length && res.exact.length ? ' (' + res.exact.length + ' điều khớp liền cụm từ)' : '') + ' · ' + Math.max(1, res.ms) + ' ms' : '';
      var cq = LX.compile(LX.parseQuery(o.q));
      var item = function (r) {
        var a = DB.byId[r.id], href = abs(DIR + 'dieu-' + a.id + '?q=' + encodeURIComponent(o.q));
        var sn = r.sn.slice(0, 3).map(function (s) {
          var t = s[2], h = '', last = 0;
          s[3].forEach(function (x) { h += esc(t.slice(last, x[0])) + '<mark>' + esc(t.slice(x[0], x[1])) + '</mark>'; last = x[1]; });
          h += esc(t.slice(last));
          return '<p class="sn"><i>' + (s[0] === 'l' ? 'Điều luật' : 'Sửa đổi, bổ sung') + '</i>' + (s[4] ? '…' : '') + h + (s[5] ? '…' : '') + '</p>';
        }).join('');
        return '<a class="sr" href="' + href + '"><div class="sr-t">' +
          (r.th ? '<span class="ty ty--tt">Tên điều</span>' : '') + (r.lh ? '<span class="ty ty--law">Điều luật</span>' : '') + (r.am ? '<span class="ty ty--am">Sửa đổi</span>' : '') +
          '<span class="where">' + esc(a.ch.label) + ' · ' + esc(a.ch.name) + '</span>' + artTags(a) + '</div>' +
          '<h3><b>Điều ' + esc(a.id) + '.</b> ' + (r.th ? hl(a.t, cq) : esc(a.t)) + '</h3>' + sn +
          '<div class="cnts">' + (r.lh ? '<span>' + r.lh + ' đoạn trong điều luật</span>' : '') + (r.am ? '<span>' + r.am + ' đoạn trong nội dung sửa đổi</span>' : '') + '</div></a>';
      };
      var html = '<div class="sr-head"><div class="filters" role="group" aria-label="Phạm vi">' + chips + '</div>' +
        '<div class="sel"><select class="inp" id="srCh" aria-label="Lọc theo chương">' + chOpts + '</select>' +
        '<select class="inp" id="srSx" aria-label="Sắp xếp"><option value="rel"' + (o.sort === 'rel' ? ' selected' : '') + '>Liên quan nhất</option><option value="order"' + (o.sort === 'order' ? ' selected' : '') + '>Theo thứ tự điều</option></select></div></div>';
      var res$ = $('#srRes');
      if (!list.length) {
        res$.innerHTML = html + '<div class="empty">' + ic('search') + '<h3>Không tìm thấy kết quả phù hợp</h3><p>Thử bỏ bớt từ, kiểm tra chính tả, gõ không dấu hoặc chọn “Tất cả”.</p></div>' + tipsHtml();
      } else {
        res$.innerHTML = html + '<div class="sr-list" id="srList"></div><div style="text-align:center;margin-top:18px"><button type="button" class="btn" id="srMore" hidden>Xem thêm kết quả</button></div>';
        var shown = 0, more = function () {
          $('#srList').insertAdjacentHTML('beforeend', list.slice(shown, shown + 25).map(item).join(''));
          shown += 25; $('#srMore').hidden = shown >= list.length;
        };
        $('#srMore').addEventListener('click', more);
        more();
      }
      $('#srCh').addEventListener('change', function () { history.pushState(null, '', link('chap', this.value)); show(); });
      $('#srSx').addEventListener('change', function () { history.pushState(null, '', link('sort', this.value)); show(); });
      $$('[data-nav-in]', res$).forEach(function (a) { a.addEventListener('click', function (e) { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); history.pushState(null, '', a.href); show(); }); });
    };
    var show = function () {
      var o = state();
      if (box) { box.set(o.q); box.close(); }
      document.title = (o.q ? 'Tìm “' + o.q + '”' : 'Tìm kiếm') + ' – Bộ luật Tố tụng hình sự 2015 – Tra cứu Luật Hình sự';
      if (!o.q) { srOut.innerHTML = tipsHtml(); return; }
      srOut.innerHTML = '<div style="margin-top:22px" id="srTop"></div><div class="sr-meta" id="srMeta"><span class="spinner"></span> Đang nạp toàn văn để tìm kiếm…</div><div id="srRes"></div>';
      loadDB().then(function () {
        var r = parseRef(o.q), top = '';
        if (r && (r.a || r.chap)) {
          top += '<a class="go-card" href="' + abs(refHref(r)) + '"><span class="gi">' + ic(r.chap ? 'list' : 'arrow-r') + '</span><span><b>Đi tới ' + esc(refLabel(r)) +
            '</b><small>' + esc(r.chap ? r.chap.arts.length + ' điều' : r.a.t) + '</small></span><span class="go">' + ic('chev-r') + '</span></a>';
        }
        var ids = synIds(fold(o.q).toLowerCase().replace(/\s+/g, ' ').trim());
        if (ids.length) top += '<div class="sugg"><span>' + ic('spark') + ' Điều luật thường gắn với từ khóa này:</span>' + ids.slice(0, 6).map(function (x) {
          return '<a class="chip" href="' + abs(DIR + 'dieu-' + x) + '">Điều ' + x + ' · ' + esc(DB.byId[x].t.length > 48 ? DB.byId[x].t.slice(0, 46) + '…' : DB.byId[x].t) + '</a>';
        }).join('') + '</div>';
        $('#srTop').innerHTML = top;
        return engine();
      }).then(function (eng) {
        if (state().q !== o.q) return;
        draw(eng.run(o.q), o);
      }).catch(function () {
        var m = $('#srMeta'); if (m) m.textContent = 'Không tải được dữ liệu tìm kiếm. Vui lòng kiểm tra kết nối mạng.';
      });
    };
    srOut.addEventListener('click', function (e) {
      var c = e.target.closest('[data-try]'); if (!c) return;
      history.pushState(null, '', abs(urlOf({ q: c.dataset.try, scope: 'all', chap: '', sort: 'rel' }))); rememberQ(c.dataset.try); show();
    });
    window.addEventListener('popstate', show);
    show();
    if (!state().q) { var si = $('#srQ'); if (si) si.focus(); }
  }
})();
