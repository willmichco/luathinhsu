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
      'Thay đổi áp dụng ngay và được ghi nhớ trên thiết bị này</p>' + disp() +
      '<div class="set-row"><div><b>Đọc khi không có mạng</b><small>Tải sẵn toàn bộ 511 điều Bộ luật Tố tụng hình sự (~25 MB)</small></div>' +
      '<button type="button" class="btn btn--sm" data-act="offline"><svg aria-hidden="true"><use href="#i-offline"/></svg>Tải về</button></div>');
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
    if (r.chap) return DIR + 'chuong-' + r.chap.slug;
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
    l.unshift({ id: art.dataset.id, t: t, at: Date.now() }); Store.set('hist', l.slice(0, 30));
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

  /* ======================================================================
     Các tính năng như mục Bộ luật Hình sự: lưu điều, ghi chú, lịch sử, xem nhanh điều dẫn chiếu, sao chép trích dẫn khoản,
     bảng tra nhanh mục lục (Ctrl/⌘+K), thu thanh khi cuộn (điện thoại), vạch tiến độ đọc, đánh dấu khoản đang đọc,
     so sánh điều luật, trang Đã lưu, tải về đọc offline
     ====================================================================== */
  var CITE = 'Bộ luật Tố tụng hình sự số 101/2015/QH13';
  var isTouch = window.matchMedia('(hover: none)').matches;
  var SHEETQ = window.matchMedia('(max-width: 1023px)');
  var ART = $('#art'), AID = ART && ART.dataset.id;
  var Saved = {
    list: function () { return Store.get('saved', []); },
    has: function (id) { return Saved.list().some(function (x) { return x.id === id; }); },
    toggle: function (id, t) {
      var l = Saved.list(), on = !l.some(function (x) { return x.id === id; });
      l = l.filter(function (x) { return x.id !== id; });
      if (on) l.unshift({ id: id, t: t, at: Date.now() });
      Store.set('saved', l); return on;
    }
  };
  var Notes = {
    all: function () { return Store.get('notes', {}); },
    get: function (id) { return (Notes.all()[id] || {}).x || ''; },
    set: function (id, x, t) { var n = Notes.all(); if (x && x.trim()) n[id] = { x: x, t: Date.now(), tt: t }; else delete n[id]; Store.set('notes', n); }
  };
  var artTitle = function () { var h = $('#art h1'); return h ? h.textContent.replace(/^\s*Điều\s+\S+\.\s*/, '').trim() : ''; };

  // Lưu điều này
  var saveBtn = $('[data-act="save"]');
  var drawSave = function () {
    if (!saveBtn) return;
    var on = Saved.has(AID);
    saveBtn.setAttribute('aria-pressed', String(on));
    saveBtn.innerHTML = ic(on ? 'bookmark-fill' : 'bookmark') + '<span>' + (on ? 'Đã lưu' : 'Lưu điều này') + '</span>';
  };
  drawSave();
  // Ghi chú của tôi (cột phải)
  var nb = $('#noteBox');
  if (nb && AID) {
    nb.value = Notes.get(AID);
    var nst = $('#noteSt'), nt;
    if (nb.value) nst.textContent = 'Đã lưu trên thiết bị';
    nb.addEventListener('input', function () {
      clearTimeout(nt); nst.textContent = 'Đang lưu…';
      nt = setTimeout(function () { Notes.set(AID, nb.value, artTitle()); nst.textContent = nb.value.trim() ? 'Đã lưu trên thiết bị' : ''; }, 400);
    });
  }

  // Nút trên trang điều luật: lưu, trích dẫn khoản, liên kết khoản
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-act="save"]') && AID) {
      var on = Saved.toggle(AID, artTitle()); drawSave();
      toast(on ? 'Đã lưu Điều ' + AID : 'Đã bỏ lưu Điều ' + AID); return;
    }
    var c = t.closest('[data-cite]');
    if (c && AID) {
      var kn = c.dataset.cite, box = $('#k' + kn);
      var body = $$('p', box).map(function (p) { return p.textContent.replace(/\s+/g, ' ').trim(); }).filter(Boolean).join('\n');
      copy(body + '\n(Khoản ' + kn + ' Điều ' + AID + ' ' + CITE + ')', 'Đã sao chép trích dẫn khoản ' + kn); return;
    }
    var kl = t.closest('[data-klink]');
    if (kl && AID) { copy(location.href.split('#')[0].split('?')[0] + '#k' + kl.dataset.klink, 'Đã sao chép liên kết khoản ' + kl.dataset.klink); return; }
  });

  /* ---------- Xem nhanh điều được dẫn chiếu (rê chuột trên máy tính, chạm trên điện thoại) ---------- */
  var pvCache = {};
  function pvData(id) { return pvCache[id] || (pvCache[id] = fetch(abs(DIR + 'a/' + id + '.json?v=' + VER)).then(function (r) { if (!r.ok) throw 0; return r.json(); }).catch(function (e) { delete pvCache[id]; throw e; })); }
  function pvTags(fl) {
    fl = fl || '';
    return (fl.indexOf('r') > -1 ? '<span class="tag tag--rep">Đã bãi bỏ</span>' : '') + (fl.indexOf('n') > -1 ? '<span class="tag tag--am">Bổ sung 2025</span>' : '') +
      (fl.indexOf('a') > -1 && fl.indexOf('r') < 0 ? '<span class="tag tag--am">Sửa đổi</span>' : '') + (fl.indexOf('f') > -1 ? '<span class="tag tag--fut">Sắp sửa đổi</span>' : '');
  }
  function pvHtml(d) {
    return '<div class="pv-n">Điều ' + esc(d.id) + ' · ' + esc(d.ch.split('.')[0]) + '</div><div class="pv-t" id="sheetTitle">' + esc(d.t) + '</div>' +
      '<div class="pv-x">' + esc(d.ex) + '</div><div class="pv-m">' + pvTags(d.fl) + '</div>' +
      '<div class="pv-a"><a class="btn btn--p btn--sm" href="' + abs(DIR + 'dieu-' + d.id) + '">Mở Điều ' + esc(d.id) + ic('arrow-r') + '</a>' +
      (isTouch ? '<button type="button" class="btn btn--sm" data-act="sheet-close">Đóng</button>' : '') + '</div>';
  }
  var pop = $('#pop'), pvT = null, pvA = null;
  function popAt(a, html) {
    pop.innerHTML = html; pop.hidden = false;
    var r = a.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    var x = Math.min(Math.max(12, r.left + r.width / 2 - pw / 2), window.innerWidth - pw - 12), y = r.bottom + 10;
    if (y + ph > window.innerHeight - 12) y = Math.max(12, r.top - ph - 10);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  }
  function closePop() { if (pop) pop.hidden = true; pvA = null; }
  if (pop) {
    document.addEventListener('mouseover', function (e) {
      if (isTouch) return;
      var a = e.target.closest('[data-pv]');
      if (!a) { if (!e.target.closest('#pop')) { clearTimeout(pvT); pvT = setTimeout(closePop, 220); } return; }
      if (a === pvA) { clearTimeout(pvT); return; }
      clearTimeout(pvT);
      pvT = setTimeout(function () { pvA = a; pvData(a.dataset.pv).then(function (d) { if (pvA === a) popAt(a, pvHtml(d)); }, function () { }); }, 280);
    });
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-pv]');
      // Chạm vào điều được dẫn chiếu trong văn bản luật: xem nhanh trước, bấm "Mở" để chuyển trang
      if (a && isTouch && a.closest('.law, .rl') && !e.metaKey) {
        e.preventDefault();
        pvData(a.dataset.pv).then(function (d) { sheet(pvHtml(d)); }, function () { location.href = a.href; });
        return;
      }
      if (!e.target.closest('#pop')) closePop();
    });
  }

  /* ---------- Bảng tra nhanh mục lục (giống bảng "Mục lục điều luật" của BLHS) ---------- */
  var Jump = {
    el: null, rows: [], secs: [], act: -1,
    build: function () {
      var nav = '', list = '';
      var parts = {};
      DB.chaps.forEach(function (c, ci) {
        var first = c.arts[0].id, last = c.arts[c.arts.length - 1].id;
        nav += '<button type="button" data-jc="' + ci + '" title="' + esc(c.label + '. ' + c.name) + '"><b>' + esc(c.num || 'TH') + '</b><span>' + esc(c.name) + '</span><small>' + c.arts.length + '</small></button>';
        list += '<section class="jp-sec" data-c="' + ci + '"><h3 class="jp-ch"><small>' + esc(c.num ? c.label + ' · ' : '') + 'Điều ' + first + (first !== last ? ' – ' + last : '') + ' · ' + c.arts.length + ' điều</small>' + esc(c.name) + '</h3>' +
          c.arts.map(function (a) {
            return '<a class="jp-a' + ((a.fl || '').indexOf('r') > -1 ? ' is-rep' : '') + '" href="' + abs(DIR + 'dieu-' + a.id) + '" data-id="' + esc(a.id) + '"><b>Điều ' + esc(a.id) + '</b><span class="t">' + esc(a.t) + '</span><span class="tg">' + pvTags(a.fl) + '</span></a>';
          }).join('') + '</section>';
      });
      void parts;
      var mod = /Mac|iP(hone|ad|od)/.test(navigator.platform || '') ? '⌘' : 'Ctrl';
      var el = document.createElement('div');
      el.className = 'jp'; el.id = 'jump'; el.hidden = true;
      el.innerHTML = '<div class="jp-bg" data-act="jump-close"></div><div class="jp-panel" role="dialog" aria-modal="true" aria-labelledby="jpTitle" tabindex="-1">' +
        '<div class="jp-grip" aria-hidden="true"></div><div class="jp-hd"><div><h2 id="jpTitle">' + ic('olist') + 'Mục lục điều luật</h2><p class="jp-sub" id="jpSub" aria-live="polite"></p></div>' +
        '<button type="button" class="jp-x" data-act="jump-close" aria-label="Đóng mục lục">' + ic('x') + '</button></div>' +
        '<div class="jp-tool"><div class="sb"><div class="sb-box">' + ic('filter') +
        '<input class="sb-in" id="jpQ" type="search" autocomplete="off" spellcheck="false" enterkeyhint="go" placeholder="Gõ số điều hoặc tên điều… (vd: 119, tam giam)" aria-label="Lọc danh sách điều luật" aria-controls="jpList">' +
        '<button type="button" class="sb-clear" id="jpClr" aria-label="Xóa từ lọc" hidden>' + ic('x') + '</button></div></div><div class="jp-recent" id="jpRecent" hidden></div></div>' +
        '<div class="jp-body"><nav class="jp-nav" id="jpNav" aria-label="Đi tới chương">' + nav + '</nav><div class="jp-list" id="jpList">' + list + '<div class="jp-empty" id="jpEmpty" hidden></div></div></div>' +
        '<div class="jp-ft"><span class="k"><kbd>↑</kbd><kbd>↓</kbd> chọn điều</span><span class="k"><kbd>Enter</kbd> mở</span><span class="k"><kbd>Esc</kbd> đóng</span>' +
        '<span class="k"><kbd>' + mod + '</kbd>+<kbd>K</kbd> mở mục lục ở mọi trang</span><a href="' + abs(DIR + 'muc-luc') + '">Trang Mục lục đầy đủ ' + ic('arrow-r') + '</a></div></div>';
      document.body.appendChild(el);
      Jump.el = el; Jump.q = $('#jpQ', el); Jump.list = $('#jpList', el); Jump.nav = $('#jpNav', el); Jump.sub = $('#jpSub', el); Jump.clr = $('#jpClr', el);
      Jump.rows = $$('.jp-a', el).map(function (r, i) { var a = DB.byId[r.dataset.id]; return { el: r, a: a, i: i, lo: ('điều ' + a.id + ' ' + a.t).toLowerCase(), fo: fold('dieu ' + a.id + ' ' + a.t).toLowerCase() }; });
      Jump.secs = $$('.jp-sec', el).map(function (s) { return { el: s, btn: $('[data-jc="' + s.dataset.c + '"]', Jump.nav) }; });
      Jump.q.addEventListener('input', Jump.filter);
      Jump.q.addEventListener('keydown', Jump.key);
      Jump.clr.addEventListener('click', function () { Jump.q.value = ''; Jump.filter(); Jump.q.focus(); });
      Jump.nav.addEventListener('click', function (e) { var b = e.target.closest('[data-jc]'); if (!b) return; var s = Jump.secs[+b.dataset.jc]; if (s && !s.el.hidden) Jump.list.scrollTo({ top: s.el.offsetTop, behavior: 'smooth' }); });
      el.addEventListener('click', function (e) { if (e.target.closest('[data-act="jump-close"]')) Jump.hide(); });
    },
    show: function () {
      if (!DB) { loadDB().then(Jump.show, function () { go(DIR + 'muc-luc'); }); return; }
      if (!Jump.el) Jump.build();
      closePop(); drawer(false);
      $$('.jp-a.on', Jump.el).forEach(function (x) { x.classList.remove('on'); x.removeAttribute('aria-current'); });
      var cur = AID && Jump.rows.filter(function (r) { return r.a.id === AID; })[0];
      if (cur) { cur.el.classList.add('on'); cur.el.setAttribute('aria-current', 'page'); }
      var rec = Store.get('hist', []).map(function (h) { return h.id; }).filter(function (id) { return DB.byId[id] && id !== AID; }).slice(0, 6), R = $('#jpRecent', Jump.el);
      R.hidden = !rec.length;
      R.innerHTML = '<span>' + ic('history') + 'Vừa xem</span>' + rec.map(function (id) { return '<a class="chip" href="' + abs(DIR + 'dieu-' + id) + '" title="' + esc(DB.byId[id].t) + '">Điều ' + esc(id) + '</a>'; }).join('');
      Jump.q.value = ''; Jump.filter();
      Jump.el.hidden = false; document.body.style.overflow = 'hidden';
      void Jump.el.offsetWidth; Jump.el.classList.add('is-open');
      if (cur) Jump.list.scrollTop = cur.el.offsetTop - Jump.list.clientHeight / 3;
      if (isTouch) $('.jp-panel', Jump.el).focus({ preventScroll: true }); else Jump.q.focus({ preventScroll: true });
    },
    hide: function () {
      if (!Jump.el || Jump.el.hidden) return;
      Jump.el.classList.remove('is-open'); document.body.style.overflow = '';
      setTimeout(function () { if (!Jump.el.classList.contains('is-open')) Jump.el.hidden = true; }, SHEETQ.matches ? 280 : 0);
    },
    filter: function () {
      var v = Jump.q.value.trim(), r = v ? parseRef(v) : null, cq = null, only = null, chap = null, num = null;
      Jump.clr.hidden = !v;
      if (r && r.chap) chap = r.chap; else if (r && r.art) { if (r.k) only = r.art; else num = r.art; }
      else if (v) { cq = LX.compile(LX.parseQuery(v), { prefix: true }); if (cq.empty) cq = null; }
      Jump.ref = r && (r.a || r.chap) ? r : null;
      var on = !!(chap || only || num || cq), n = 0, per = {};
      Jump.rows.forEach(function (x) {
        var a = x.a, ok = !on || (chap ? a.ch === chap : only ? a.id === only : num ? a.id.indexOf(num) === 0 : (cq.exact(x.lo, x.fo) || cq.loose(x.lo, x.fo)));
        x.el.hidden = !ok;
        if (ok) { n++; per[DB.chaps.indexOf(a.ch)] = (per[DB.chaps.indexOf(a.ch)] || 0) + 1; }
      });
      Jump.secs.forEach(function (s, i) { var k = per[i] || 0; s.el.hidden = on && !k; s.btn.hidden = on && !k; $('small', s.btn).textContent = on ? k : DB.chaps[i].arts.length; });
      var E = $('#jpEmpty', Jump.el); E.hidden = !on || n > 0;
      if (on && !n) E.innerHTML = ic('search') + '<p>Không có điều nào khớp “' + esc(v) + '”.</p><a class="btn btn--sm" href="' + abs(DIR + 'tim-kiem?q=' + encodeURIComponent(v)) + '">' + ic('search') + 'Tìm trong toàn văn</a>';
      Jump.sub.textContent = on ? (n ? 'Tìm thấy ' + n + ' điều' : 'Không có điều nào phù hợp') : DB.arts.length + ' điều · ' + DB.chaps.filter(function (c) { return c.num; }).length + ' chương · chọn một điều để chuyển tới ngay';
      Jump.el.classList.toggle('is-filter', on);
      Jump.setAct(on ? Jump.first() : -1);
      if (on) Jump.list.scrollTop = 0;
    },
    first: function () { for (var i = 0; i < Jump.rows.length; i++) if (!Jump.rows[i].el.hidden) return i; return -1; },
    setAct: function (i) {
      var o = Jump.rows[Jump.act]; if (o) o.el.classList.remove('act');
      Jump.act = i; var x = Jump.rows[i];
      if (x) { x.el.classList.add('act'); var L = Jump.list, y = x.el.offsetTop; if (y < L.scrollTop + 40 || y > L.scrollTop + L.clientHeight - 40) L.scrollTop = y - L.clientHeight / 2; }
    },
    key: function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var d = e.key === 'ArrowDown' ? 1 : -1, i = Jump.act;
        do { i += d; } while (Jump.rows[i] && Jump.rows[i].el.hidden);
        if (Jump.rows[i]) Jump.setAct(i);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        var x = Jump.rows[Jump.act] && !Jump.rows[Jump.act].el.hidden ? Jump.rows[Jump.act] : Jump.rows[Jump.first()];
        if (Jump.ref && (Jump.ref.chap || (x && Jump.ref.a === x.a))) { go(refHref(Jump.ref)); return; }
        if (x) location.href = x.el.href;
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        if (Jump.q.value) { Jump.q.value = ''; Jump.filter(); } else Jump.hide();
      }
    }
  };
  // Nút "Mục lục" (đầu trang, thanh dưới, cột trái, giữa Điều trước/sau): đang đọc điều/chương → mở bảng tra nhanh;
  // ở trang chủ phân mục → cuộn tới mục lục; trang khác → mở trang mục lục
  var reading = document.body.classList.contains('is-reading');
  document.addEventListener('click', function (e) {
    var j = e.target.closest('[data-act="jump"]');
    if (!j || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var toc = $('#muc-luc');
    if (toc) { e.preventDefault(); toc.scrollIntoView({ behavior: 'smooth' }); var q = $('#tocQ'); if (q) setTimeout(function () { q.focus({ preventScroll: true }); }, 400); return; }
    if (reading || document.body.dataset.page === 'muc-luc') { e.preventDefault(); Jump.show(); }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (Jump.el && !Jump.el.hidden) Jump.hide(); else { var q = $('#tocQ'); if (q) { q.focus(); q.scrollIntoView({ block: 'center' }); } else Jump.show(); }
    }
    if (e.key === 'Escape' && Jump.el && !Jump.el.hidden) Jump.hide();
  });
  if (reading) { var warm = function () { loadDB().catch(function () { }); }; if (window.requestIdleCallback) requestIdleCallback(warm, { timeout: 4000 }); else setTimeout(warm, 1500); }

  /* ---------- Điện thoại: thu header/thanh dưới khi cuộn xuống đọc; vạch tiến độ đọc; đánh dấu khoản đang đọc ---------- */
  (function () {
    var hidden = false, lastY = window.scrollY, acc = 0, ticking = false, prog = $('#progress');
    var set = function (h) { if (h !== hidden) { hidden = h; document.body.classList.toggle('ui-hide', h); } };
    var check = function () {
      ticking = false;
      var y = window.scrollY, dy = y - lastY, max = document.documentElement.scrollHeight - window.innerHeight;
      lastY = y;
      if (prog && ART) prog.style.width = (max > 0 ? Math.min(100, y / max * 100) : 0) + '%';
      if (!SHEETQ.matches) { set(false); return; }
      if (y < 140 || y > max - 80) { acc = 0; set(false); return; }
      if (!dy) return;
      if ((dy > 0) !== (acc > 0)) acc = 0;
      acc += dy;
      if (acc > 28) set(true); else if (acc < -18) set(false);
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
    document.addEventListener('focusin', function (e) { if (e.target.closest && e.target.closest('.hd,.tabbar')) set(false); });
    var links = {}, cur = null;
    $$('.rail .kl a').forEach(function (l) { var m = l.getAttribute('href').match(/#k(\w+)$/); if (m) links[m[1]] = l; });
    if (Object.keys(links).length && window.IntersectionObserver && window.matchMedia('(min-width: 1281px)').matches) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          var l = links[en.target.dataset.k]; if (!l || l === cur) return;
          if (cur) cur.classList.remove('on'); cur = l; l.classList.add('on');
        });
      }, { rootMargin: '-25% 0px -65% 0px' });
      $$('#lawBody .kh[data-k]').forEach(function (k) { io.observe(k); });
    }
  })();

  /* ---------- Trang Đã lưu ---------- */
  var savedOut = $('#savedOut');
  if (savedOut) {
    var drawSaved = function () {
      var tab = new URLSearchParams(location.search).get('tab') || 'luu';
      var saved = Saved.list(), notes = Notes.all(), nk = Object.keys(notes), hist = Store.get('hist', []);
      var when = function (t) { if (!t) return ''; var d = new Date(t); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear() + ' ' + d.toTimeString().slice(0, 5); };
      var row = function (id, t, tm, extra, kind) {
        return '<div class="sv"><a class="t" href="' + abs(DIR + 'dieu-' + id) + '"><b>Điều ' + esc(id) + '</b><span>' + esc(t || '') + '</span>' + (extra || '') + '</a>' +
          '<time>' + when(tm) + '</time><button type="button" class="hd-ic sv-rm" data-rm="' + kind + ':' + esc(id) + '" aria-label="Xóa">' + ic('trash') + '</button></div>';
      };
      var empty = function (i, t, s) { return '<div class="empty">' + ic(i) + '<h3>' + t + '</h3><p>' + s + '</p></div>'; };
      var body;
      if (tab === 'ghi-chu') body = nk.length ? nk.sort(function (x, y) { return notes[y].t - notes[x].t; }).map(function (id) { return row(id, notes[id].tt, notes[id].t, '<div class="note">' + esc(notes[id].x) + '</div>', 'note'); }).join('') :
        empty('note', 'Chưa có ghi chú', 'Mở một điều luật và ghi chú ở khung “Ghi chú của tôi”.');
      else if (tab === 'lich-su') body = hist.length ? hist.map(function (x) { return row(x.id, x.t, x.at, '', 'hist'); }).join('') : empty('history', 'Chưa có lịch sử', 'Các điều bạn đã xem sẽ xuất hiện ở đây.');
      else body = saved.length ? saved.map(function (x) { return row(x.id, x.t, x.at, '', 'saved'); }).join('') : empty('bookmark', 'Chưa lưu điều luật nào', 'Nhấn “Lưu điều này” trên trang điều luật để đánh dấu và đọc lại nhanh.');
      savedOut.innerHTML = '<div class="filters">' + [['luu', 'Đã lưu', saved.length], ['ghi-chu', 'Ghi chú', nk.length], ['lich-su', 'Lịch sử', hist.length]].map(function (x) {
        return '<a class="chip' + (tab === x[0] ? ' on' : '') + '" href="' + abs(DIR + 'da-luu' + (x[0] === 'luu' ? '' : '?tab=' + x[0])) + '">' + x[1] + ' <span class="n">' + x[2] + '</span></a>';
      }).join('') +
        (tab === 'ghi-chu' && nk.length ? '<button type="button" class="btn btn--sm" data-act="export-notes" style="margin-left:auto">' + ic('download') + 'Xuất ghi chú (.txt)</button>' : '') +
        (tab === 'lich-su' && hist.length ? '<button type="button" class="btn btn--sm" data-act="clear-hist" style="margin-left:auto">' + ic('trash') + 'Xóa lịch sử</button>' : '') +
        '</div><div class="saved-list">' + body + '</div>';
    };
    savedOut.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rm]');
      if (b) {
        var p = b.dataset.rm.split(':');
        if (p[0] === 'saved') Saved.toggle(p[1]);
        if (p[0] === 'note') Notes.set(p[1], '');
        if (p[0] === 'hist') Store.set('hist', Store.get('hist', []).filter(function (x) { return x.id !== p[1]; }));
        drawSaved(); return;
      }
      if (e.target.closest('[data-act="clear-hist"]')) { Store.set('hist', []); drawSaved(); }
      if (e.target.closest('[data-act="export-notes"]')) {
        var n = Notes.all();
        var txt = 'GHI CHÚ – BỘ LUẬT TỐ TỤNG HÌNH SỰ\n\n' + Object.keys(n).map(function (id) { return 'Điều ' + id + '. ' + (n[id].tt || '') + '\n' + n[id].x + '\n'; }).join('\n');
        var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' }), u = URL.createObjectURL(blob), l = document.createElement('a');
        l.href = u; l.download = 'ghi-chu-bltths.txt'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
      }
    });
    drawSaved();
  }

  /* ---------- So sánh điều luật ---------- */
  var cmpOut = $('#cmpOut');
  if (cmpOut) {
    var ia = $('#cmpA'), ib = $('#cmpB');
    var clean = function (v) { var m = fold(v || '').toLowerCase().match(/(\d{1,3}[a-z]?)/); return m ? m[1] : ''; };
    var lawCol = function (d) {
      return '<div class="cmp-col"><h3><a href="' + abs(DIR + 'dieu-' + d.id) + '"><b>Điều ' + esc(d.id) + '.</b> ' + esc(d.t) + '</a></h3><div class="law-paper"><div class="law">' +
        d.law.map(function (p) {
          var h = esc(p[1]);
          if (p[0] === 'lk') h = h.replace(/^(\d+[a-z]?\.)\s*/, '<b class="kn">$1 </b>');
          if (p[0] === 'lp') h = h.replace(/^([a-zđ]\))\s*/, '<b class="pl">$1 </b>');
          return '<p class="' + p[0] + '">' + h + '</p>';
        }).join('') + '</div></div>' +
        (d.am.length ? '<details class="orig"><summary>' + ic('history') + 'Nội dung sửa đổi, bổ sung (' + d.am.length + ')</summary><div class="law-paper"><div class="law">' +
          d.am.map(function (x) { return '<p class="lh">' + esc(x[0]) + ' – ' + (x[2] ? 'chưa có hiệu lực, từ ' : 'hiệu lực từ ') + esc(x[1]) + '</p>' + x[3].map(function (t) { return '<p class="lx">' + esc(t) + '</p>'; }).join(''); }).join('') +
          '</div></div></details>' : '') + '</div>';
    };
    var draw = function () {
      var a = clean(ia.value), b = clean(ib.value);
      var u = new URL(location.href); u.search = (a ? '?a=' + a : '') + (b ? (a ? '&' : '?') + 'b=' + b : ''); history.replaceState(null, '', u);
      if (!a || !b) { cmpOut.innerHTML = '<div class="empty">' + ic('columns') + '<h3>Chọn hai điều luật để so sánh</h3><p>Gõ số điều hoặc chọn nhanh một cặp gợi ý ở trên.</p></div>'; return; }
      cmpOut.innerHTML = '<div style="margin-top:20px"><div class="skel"></div><div class="skel" style="width:70%"></div></div>';
      Promise.all([pvData(a), pvData(b)]).then(function (r) {
        var A = r[0], B = r[1];
        var row = function (l, x, y) { return '<tr><th scope="row">' + l + '</th><td>' + x + '</td><td>' + y + '</td></tr>'; };
        var st = function (d) { return pvTags(d.fl) || '<span class="muted">Chưa sửa đổi</span>'; };
        cmpOut.innerHTML = '<section class="sec" style="margin-top:24px"><div class="sec-h"><div><h2>Đối chiếu nhanh</h2></div></div><div style="overflow:auto"><table class="cmp-tbl cmp-tbl--2up"><thead><tr><th></th><th>Điều ' + esc(A.id) + '</th><th>Điều ' + esc(B.id) + '</th></tr></thead><tbody>' +
          row('Tên điều', esc(A.t), esc(B.t)) + row('Vị trí', esc(A.ch), esc(B.ch)) + row('Số khoản', A.law.filter(function (p) { return p[0] === 'lk'; }).length || '—', B.law.filter(function (p) { return p[0] === 'lk'; }).length || '—') +
          row('Tình trạng', st(A), st(B)) + row('Lần sửa đổi, bổ sung', A.am.length || '—', B.am.length || '—') + '</tbody></table></div></section>' +
          '<section class="sec" style="margin-top:28px"><div class="sec-h"><div><h2>Toàn văn hai điều luật</h2><p>Nội dung sửa đổi, bổ sung của từng điều nằm ở mục thu gọn bên dưới mỗi cột.</p></div></div><div class="cmp">' + lawCol(A) + lawCol(B) + '</div></section>';
      }).catch(function () { cmpOut.innerHTML = '<div class="callout callout--warn" style="margin-top:20px">' + ic('alert') + '<div>Không tìm thấy điều luật. Bộ luật Tố tụng hình sự có Điều 1 – Điều 510 (và Điều 506a).</div></div>'; });
    };
    var qp = new URLSearchParams(location.search);
    ia.value = qp.get('a') || ''; ib.value = qp.get('b') || '';
    [ia, ib].forEach(function (x) { x.addEventListener('change', draw); x.addEventListener('keydown', function (e) { if (e.key === 'Enter') draw(); }); });
    document.addEventListener('click', function (e) { var p = e.target.closest('[data-ps]'); if (!p) return; var v = p.dataset.ps.split(','); ia.value = v[0]; ib.value = v[1]; draw(); });
    draw();
  }

  /* ---------- Đọc offline: tải sẵn toàn bộ trang điều luật vào bộ nhớ đệm của service worker ---------- */
  function offline(btn) {
    if (!('caches' in window)) { toast('Trình duyệt không hỗ trợ lưu ngoại tuyến'); return; }
    loadDB().then(function () {
      var urls = DB.arts.map(function (a) { return abs(DIR + 'dieu-' + a.id); }).concat([abs(DIR), abs(DIR + 'tim-kiem'), abs(DIR + 'tim-kiem.json?v=' + VER), abs(DIR + 'muc-luc.json?v=' + VER)]);
      var done = 0, label = btn.innerHTML, i = 0;
      btn.disabled = true;
      return caches.open('tths-offline').then(function (c) {
        var next = function () {
          if (i >= urls.length) return Promise.resolve();
          var batch = urls.slice(i, i + 8); i += 8;
          return Promise.all(batch.map(function (u) { return fetch(u).then(function (r) { if (r.ok) return c.put(u, r); }).then(function () { done++; btn.innerHTML = '<span class="spinner"></span> ' + done + '/' + urls.length; }); })).then(next);
        };
        return next();
      }).then(function () { btn.innerHTML = ic('check') + 'Đã sẵn sàng offline'; toast('Đã tải toàn bộ Bộ luật Tố tụng hình sự để đọc offline'); },
        function () { btn.disabled = false; btn.innerHTML = label; toast('Tải chưa xong, vui lòng thử lại khi có mạng'); });
    });
  }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-act="offline"]'); if (b) offline(b); });
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', function () { navigator.serviceWorker.register(abs('sw.js')).catch(function () { }); });
  }

  /* ---------- Trang chủ mục: "Thử tìm", "Bạn đang cần gì?" (như trang chủ Bộ luật Hình sự) ---------- */
  document.addEventListener('click', function (e) {
    var tr = e.target.closest('[data-try]');
    if (tr && !tr.closest('#srOut')) {
      var inp = $('#heroSearch .sb-in');
      if (inp) { inp.value = tr.dataset.try; inp.dispatchEvent(new Event('input')); inp.focus(); }
      else go(DIR + 'tim-kiem?q=' + encodeURIComponent(tr.dataset.try));
      return;
    }
    var fh = e.target.closest('[data-act="focus-hero"]'), hi = $('#heroSearch .sb-in');
    if (fh && hi) { e.preventDefault(); hi.placeholder = 'Mô tả thủ tục, vd: kháng cáo quá hạn, trả hồ sơ điều tra bổ sung…'; hi.focus(); hi.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  });
})();
