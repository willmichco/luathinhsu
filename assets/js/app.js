/*
 * Tra cứu Bộ luật Hình sự – ứng dụng một trang.
 * Định tuyến bằng History API với đường dẫn sạch nằm cùng thư mục gốc: dieu-173, chuong-14, muc-luc,
 * cong-cu-thoi-hieu… Mỗi đường dẫn có sẵn một trang HTML dựng tĩnh (tools/build_seo.py) để công cụ tìm kiếm
 * đọc được; khi JavaScript chạy, ứng dụng thay nội dung tĩnh bằng giao diện tương tác.
 * Không phụ thuộc thư viện ngoài; dữ liệu nằm trong thư mục data/.
 */
(function () {
  'use strict';

  /* =========================================================================
     1. Tiện ích
     ========================================================================= */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); };
  var ic = function (n, cls) { return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true"><use href="#i-' + n + '"/></svg>'; };
  var fold = function (s) { return window.LX.fold(String(s || '')); };
  var cap = function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  var debounce = function (fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; };
  var isTouch = window.matchMedia('(hover: none)').matches;
  var VER = '20261021a';
  // Thư mục gốc của trang web (…/luathinhsu/), suy ra từ vị trí tệp assets/js/app.js
  var ROOT = document.currentScript ? new URL('../../', document.currentScript.src).href : new URL('./', location.href).href;
  var ROOT_PATH = new URL(ROOT).pathname;
  var abs = function (p) { return new URL(p, ROOT).href; };

  function plain(h) {
    return String(h).replace(/<sup class="fn"[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
  }
  function fmtDate(d) {
    if (!d) return '';
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  function readMin(chars) { return Math.max(1, Math.round(chars / 900)); }
  function vnNum(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  /* =========================================================================
     2. Lưu trữ trên trình duyệt (an toàn khi bị chặn)
     ========================================================================= */
  var Store = {
    get: function (k, d) {
      try { var v = localStorage.getItem('lx.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem('lx.' + k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } }
  };
  var Saved = {
    list: function () { return Store.get('saved', []); },
    has: function (id) { return Saved.list().some(function (x) { return x.id === id; }); },
    toggle: function (id) {
      var l = Saved.list(), i = l.findIndex(function (x) { return x.id === id; });
      if (i > -1) l.splice(i, 1); else l.unshift({ id: id, t: Date.now() });
      Store.set('saved', l);
      return i < 0;
    }
  };
  var Hist = {
    list: function () { return Store.get('hist', []); },
    push: function (id) {
      var l = Hist.list().filter(function (x) { return x.id !== id; });
      l.unshift({ id: id, t: Date.now() });
      Store.set('hist', l.slice(0, 40));
    }
  };
  var Notes = {
    all: function () { return Store.get('notes', {}); },
    get: function (id) { return (Notes.all()[id] || {}).x || ''; },
    set: function (id, x) {
      var n = Notes.all();
      if (x && x.trim()) n[id] = { x: x, t: Date.now() }; else delete n[id];
      Store.set('notes', n);
    }
  };
  var Prefs = {
    get: function () { return Store.get('prefs', {}); },
    set: function (k, v) { var p = Prefs.get(); p[k] = v; Store.set('prefs', p); Prefs.apply(); },
    apply: function () {
      var p = Prefs.get(), d = document.documentElement;
      var th = p.theme || 'light';
      d.setAttribute('data-theme', th);
      d.style.setProperty('--fs-step', p.fs || 0);
      d.classList.toggle('serif-law', p.serif === true);
      var dark = th === 'dark' || (th === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      var m = $('meta[name="theme-color"]'); if (m) m.setAttribute('content', dark ? '#2c0709' : '#7a1216');
      var cs = $('meta[name="color-scheme"]'); if (cs) cs.setAttribute('content', dark ? 'dark' : 'light');
      // Đồng bộ mọi bộ điều khiển hiển thị đang có trên trang (bảng Công cụ đọc, khối Hiển thị ở cột phải)
      $$('[data-set="theme"] button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === th)); });
      $$('[data-set="serif"] button').forEach(function (b) { b.setAttribute('aria-pressed', String((b.dataset.v === '1') === (p.serif === true))); });
      $$('.fs-out').forEach(function (o) { o.textContent = (100 + (p.fs || 0) * 6) + '%'; });
    }
  };

  /* =========================================================================
     3. Hằng số pháp lý & dữ liệu biên soạn
     ========================================================================= */
  var CITE = 'Bộ luật Hình sự năm 2015 (sửa đổi, bổ sung năm 2017, 2025)';
  var CLS = {
    1: { n: 'Ít nghiêm trọng', th: 5, d: 'Phạt tiền, cải tạo không giam giữ hoặc phạt tù đến 03 năm' },
    2: { n: 'Nghiêm trọng', th: 10, d: 'Từ trên 03 năm tù đến 07 năm tù' },
    3: { n: 'Rất nghiêm trọng', th: 15, d: 'Từ trên 07 năm tù đến 15 năm tù' },
    4: { n: 'Đặc biệt nghiêm trọng', th: 20, d: 'Từ trên 15 năm đến 20 năm tù, tù chung thân hoặc tử hình' }
  };
  // Chương bị bãi bỏ (kiểm chứng: Điều 177 Luật Tư pháp người chưa thành niên số 59/2024/QH15, hiệu lực 01/01/2026)
  var CH_NOTE = {
    c12: {
      short: 'Bãi bỏ từ 01/01/2026',
      text: 'Chương XII (Điều 90 – Điều 107) đã bị bãi bỏ kể từ ngày 01/01/2026 theo Điều 177 Luật Tư pháp người chưa thành niên số 59/2024/QH15. ' +
        'Việc xử lý người dưới 18 tuổi phạm tội hiện được thực hiện theo Luật Tư pháp người chưa thành niên. ' +
        'Nội dung dưới đây là văn bản trước ngày 01/01/2026, được giữ lại để tham khảo, nghiên cứu.'
    }
  };
  var ICONS = {
    c01: 'book', c02: 'globe', c03: 'scale', c04: 'shield', c05: 'clock', c06: 'gavel', c07: 'landmark', c08: 'scale',
    c09: 'calendar', c10: 'check', c11: 'briefcase', c12: 'user', c13: 'shield', c14: 'heart', c15: 'unlock', c16: 'wallet',
    c17: 'family', c18: 'chart', c19: 'leaf', c20: 'pill', c21: 'cone', c22: 'landmark', c23: 'briefcase', c24: 'gavel',
    c25: 'star', c26: 'globe', p3: 'calendar'
  };
  var POPULAR = ['173', '174', '134', '123', '168', '171', '175', '251', '249', '321', '260', '353'];
  // Quy định chung thường phải đối chiếu khi nghiên cứu một tội danh cụ thể
  var GENERAL = ['9', '17', '27', '50', '51', '52', '54', '65'];
  // Cách gọi thông dụng → điều luật (đã đối chiếu tên điều trong dữ liệu)
  var SYN = {
    'trom': ['173'], 'an trom': ['173'], 'trom cap': ['173'], 'trom xe': ['173'],
    'cuop': ['168', '171'], 'cuop giat': ['171'], 'giat do': ['171'],
    'giet nguoi': ['123'], 'dam chet': ['123'], 'danh nguoi': ['134'], 'gay thuong tich': ['134'], 'danh nhau': ['134', '318'],
    'lua dao': ['174', '290'], 'lua dao qua mang': ['290'], 'lua dao online': ['290'], 'chiem doat': ['174', '175', '172'],
    'vay tien khong tra': ['175'], 'vay khong tra': ['175'], 'quyt no': ['175'], 'lam dung tin nhiem': ['175'],
    'nhat duoc': ['176'], 'nhat cua roi': ['176'],
    'ma tuy': ['249', '250', '251', '255', '256a'], 'tang tru ma tuy': ['249'], 'mua ban ma tuy': ['251'], 'su dung ma tuy': ['256a'], 'choi ma tuy': ['256a', '255'],
    'danh bac': ['321', '322'], 'ca do': ['321', '322'], 'lo de': ['321', '322'], 'ga bac': ['322'],
    'tai nan giao thong': ['260'], 'giao thong': ['260'], 'nong do con': ['260'], 'say ruou lai xe': ['260'], 'dua xe': ['266'],
    'gay roi': ['318'], 'tham o': ['353'], 'hoi lo': ['354', '364', '365'], 'nhan hoi lo': ['354'], 'dua hoi lo': ['364'],
    'tham nhung': ['353', '354', '355', '356', '357'], 'lam quyen': ['357'], 'loi dung chuc vu': ['356'],
    'lam nhuc': ['155'], 'xuc pham': ['155'], 'vu khong': ['156'], 'boi nho': ['156'],
    'hiep dam': ['141', '142'], 'cuong dam': ['143', '144'], 'dam o': ['146'], 'xam hai tinh duc': ['141', '142', '145', '146'], 'giao cau': ['145'],
    'vay nang lai': ['201'], 'cho vay lai nang': ['201'], 'tin dung den': ['201'],
    'chong nguoi thi hanh cong vu': ['330'], 'chong nguoi thi hanh': ['330'], 'chong doi cong an': ['330'],
    'bao luc gia dinh': ['185'], 'nguoc dai': ['185'], 'hanh ha': ['185'],
    'mua ban nguoi': ['150', '151'], 'buon nguoi': ['150', '151'],
    'vu khi': ['304', '306'], 'sung': ['304', '306'], 'dao kiem': ['306'], 'thuoc no': ['305'], 'vat lieu no': ['305'],
    'rua tien': ['324'], 'tieu thu': ['323'], 'tieu thu do gian': ['323'], 'chua chap': ['323'],
    'huy hoai tai san': ['178'], 'dap pha': ['178'], 'cuong doat': ['170'], 'tong tien': ['170'], 'bat coc': ['169', '157'],
    'giam nguoi': ['157'], 'bat giu nguoi': ['157'], 'xam nhap cho o': ['158'], 'vao nha nguoi khac': ['158'],
    'tron thue': ['200'], 'hang gia': ['192', '193', '194', '195'], 'hang cam': ['190', '191'], 'buon lau': ['188'], 'tien gia': ['207'],
    'lam gia giay to': ['341'], 'con dau gia': ['341'], 'bang gia': ['341'], 'giay to gia': ['341'],
    'o nhiem': ['235'], 'moi truong': ['235'], 'dong vat hoang da': ['244'], 'pha rung': ['243'], 'khai thac cat': ['227'], 'khai thac khoang san': ['227'],
    'mai dam': ['327', '328', '329'], 'mua dam': ['329'], 'hack': ['289'], 'tin tac': ['289'], 'xam nhap mang': ['289'],
    'tai khoan ngan hang': ['291'], 'mua ban tai khoan': ['291'], 'khung bo': ['299', '113'], 'bao loan': ['112'], 'gian diep': ['110'],
    'nhuc hinh': ['373'], 'buc cung': ['374'], 'khai bao gian doi': ['382'], 'lam chung gian doi': ['382'], 'thieu trach nhiem': ['360'],
    'lay truyen hiv': ['148'], 'hiv': ['148'],
    'dong pham': ['17'], 'chuan bi pham toi': ['14'], 'pham toi chua dat': ['15'], 'tu y nua chung': ['16'], 'che giau toi pham': ['18', '389'],
    'khong to giac': ['19', '390'], 'phong ve chinh dang': ['22'], 'tu ve': ['22'], 'tinh the cap thiet': ['23'],
    'tuoi chiu trach nhiem': ['12'], 'tre em pham toi': ['12'], 'thoi hieu': ['27', '60'], 'mien trach nhiem': ['29'],
    'an treo': ['65'], 'giam nhe': ['51'], 'tinh tiet giam nhe': ['51'], 'tang nang': ['52'], 'tinh tiet tang nang': ['52'], 'tu thu': ['51'], 'dau thu': ['51'],
    'tai pham': ['53'], 'tong hop hinh phat': ['55', '56'], 'nhieu toi': ['55'], 'xoa an tich': ['69', '70', '71'], 'an tich': ['69', '70', '71'],
    'tu hinh': ['40'], 'chung than': ['39'], 'phat tien': ['35'], 'cai tao khong giam giu': ['36'], 'truc xuat': ['37'],
    'tha tu truoc thoi han': ['66'], 'phap nhan': ['74', '76'], 'duoi muc thap nhat': ['54'], 'phan loai toi pham': ['9']
  };
  var TOOL_KW = [
    { k: ['thoi hieu', 'het han truy cuu', 'truy cuu'], href: 'cong-cu-thoi-hieu', t: 'Tính thời hiệu truy cứu trách nhiệm hình sự', i: 'clock' },
    { k: ['tuoi', 'vi thanh nien', 'chua thanh nien', 'duoi 18', 'duoi 16'], href: 'cong-cu-tuoi', t: 'Kiểm tra tuổi chịu trách nhiệm hình sự', i: 'user' },
    { k: ['so sanh', 'phan biet', 'khac nhau'], href: 'cong-cu-so-sanh', t: 'So sánh hai điều luật', i: 'columns' },
    { k: ['khung hinh phat', 'muc phat', 'bi phat bao nhieu', 'phat tu bao nhieu', 'loai toi'], href: 'cong-cu-khung-hinh-phat', t: 'Bảng tra khung hình phạt', i: 'table' },
    { k: ['thi hanh an', 'thoi hieu thi hanh'], href: 'cong-cu-thi-hanh-an', t: 'Thời hiệu thi hành bản án', i: 'calendar' }
  ];

  /* =========================================================================
     4. Dữ liệu
     ========================================================================= */
  var DB = {
    toc: null, meta: {}, arts: [], byId: {}, chaps: [], chapById: {}, cache: {}, one: {},
    init: function () {
      var j = function (u) {
        return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
      };
      return Promise.all([j(abs('data/toc.json')), j(abs('data/meta.json'))]).then(function (res) {
        var toc = res[0];
        DB.toc = toc; DB.meta = res[1]; DB.v = toc.v;
        toc.chapters.forEach(function (c, ci) {
          var n = c.num ? romanToInt(c.num) : 0;
          var ch = {
            id: c.id, num: c.num, n: n, name: c.name, part: c.part, muc: c.muc || [], sz: c.sz, ci: ci,
            slug: c.num ? String(n) : 'p3',
            label: c.num ? 'Chương ' + c.num : 'Điều khoản thi hành',
            arts: []
          };
          ch.title = c.num ? ch.label + '. ' + c.name : c.name;
          DB.chaps.push(ch); DB.chapById[c.id] = ch;
          c.a.forEach(function (x) {
            var a = {
              id: x.id, t: x.t, m: x.m, am: !!x.am, n25: !!x.n25, rep: !!x.rep, ch: ch, i: DB.arts.length,
              r26: !!CH_NOTE[c.id]
            };
            a.lo = a.t.toLowerCase(); a.fo = fold(a.t);
            a.M = DB.meta[x.id] || {};
            DB.arts.push(a); DB.byId[x.id] = a; ch.arts.push(a);
          });
          ch.first = ch.arts[0]; ch.last = ch.arts[ch.arts.length - 1];
        });
        DB.parts = toc.parts;
      });
    },
    chapter: function (cid) {
      if (!DB.cache[cid]) {
        DB.cache[cid] = fetch(abs('data/' + cid + '.json?v=' + DB.v)).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        }).then(function (arr) {
          var map = {};
          arr.forEach(function (x) { map[x.id] = x; });
          return map;
        }).catch(function (e) { delete DB.cache[cid]; throw e; });
      }
      return DB.cache[cid];
    },
    article: function (id) {
      var a = DB.byId[id];
      if (!a) return Promise.reject(new Error('Không có điều ' + id));
      // Đã có dữ liệu cả chương (đọc offline…) thì dùng luôn; nếu không, chỉ tải tệp nhỏ của riêng điều này (data/a/…).
      // Không tải được (mất mạng, chưa lưu) → thử tệp chương, vốn được lưu khi chọn "Tải về" để đọc offline.
      if (DB.cache[a.ch.id]) return DB.cache[a.ch.id].then(function (map) { return map[id]; });
      if (!DB.one[id]) {
        DB.one[id] = fetch(abs('data/a/' + id + '.json?v=' + DB.v)).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        }).catch(function () {
          return DB.chapter(a.ch.id).then(function (map) { return map[id]; });
        }).catch(function (e) { delete DB.one[id]; throw e; });
      }
      return DB.one[id];
    },
    chapterBySlug: function (s) {
      for (var i = 0; i < DB.chaps.length; i++) if (DB.chaps[i].slug === s || DB.chaps[i].id === s) return DB.chaps[i];
      var n = /^[ivxl]+$/i.test(s) ? romanToInt(s.toUpperCase()) : parseInt(s, 10);
      for (var k = 0; k < DB.chaps.length; k++) if (DB.chaps[k].n === n) return DB.chaps[k];
      return null;
    },
    partName: function (pid) {
      var p = DB.parts.filter(function (x) { return x.id === pid; })[0];
      return p ? p.label + ': ' + p.name : '';
    }
  };
  function romanToInt(s) {
    var v = { I: 1, V: 5, X: 10, L: 50 }, t = 0, prev = 0;
    for (var i = s.length - 1; i >= 0; i--) { var n = v[s[i]] || 0; t += n < prev ? -n : n; prev = Math.max(prev, n); }
    return t;
  }

  /* =========================================================================
     5. Khung hình phạt
     ========================================================================= */
  var Pen = {
    fm: function (m) {
      if (m % 12 === 0) return (m / 12) + ' năm';
      if (m < 12) return m + ' tháng';
      return Math.floor(m / 12) + ' năm ' + (m % 12) + ' tháng';
    },
    label: function (k) {
      if (k.bs) return 'Hình phạt bổ sung';
      var s = '';
      if (k.lo != null) s = k.lo === k.hi ? 'Tù ' + Pen.fm(k.hi) : 'Tù ' + Pen.fm(k.lo) + ' – ' + Pen.fm(k.hi);
      if (k.ct) s += (s ? ', ' : 'Tù ') + 'chung thân';
      if (k.th) s += (s ? (k.ct ? ' hoặc ' : ', ') : '') + 'tử hình';
      if (!s && k.alt) s = cap(k.alt.join(', '));
      return cap(s);
    },
    maxOf: function (a) {
      var ks = (a.M.k || []).filter(function (k) { return !k.bs; });
      if (!ks.length) return null;
      var best = ks[0];
      ks.forEach(function (k) {
        var v = (k.th ? 1000 : k.ct ? 500 : (k.hi || 0)), bv = (best.th ? 1000 : best.ct ? 500 : (best.hi || 0));
        if (v > bv) best = k;
      });
      return best;
    },
    maxText: function (a) {
      var k = Pen.maxOf(a);
      if (!k) return '';
      if (k.th) return 'Cao nhất: tử hình';
      if (k.ct) return 'Cao nhất: tù chung thân';
      if (k.hi) return 'Cao nhất: ' + Pen.fm(k.hi) + ' tù';
      return 'Không giam giữ';
    },
    noLimit: function (a, kn) {
      var nl = a.M.nl;
      if (!nl) return false;
      return nl === 1 || (Array.isArray(nl) && nl.indexOf(kn) > -1);
    },
    tags: function (a, k, compact) {
      if (k.bs) return '<span class="tag tag--soft">Hình phạt bổ sung</span>';
      var c = CLS[k.c], out = [];
      out.push('<span class="tag tag--c' + k.c + '" title="' + esc(k.txt) + '">' + esc(Pen.label(k)) + '</span>');
      out.push('<span class="tag tag--c' + k.c + '">Tội ' + c.n.toLowerCase() + '</span>');
      if (!compact) {
        if (Pen.noLimit(a, k.n)) out.push('<span class="tag tag--soft">Không áp dụng thời hiệu</span>');
        else out.push('<span class="tag tag--soft">' + ic('clock') + 'Thời hiệu ' + c.th + ' năm</span>');
        if (a.M.a14 && k.c >= 3) out.push('<span class="tag tag--a14" title="Khoản 2 Điều 12">Từ đủ 14 tuổi chịu TNHS</span>');
        if (k.cb) out.push('<span class="tag tag--soft">Chuẩn bị phạm tội</span>');
      }
      return out.join('');
    },
    chart: function (a, link) {
      var ks = (a.M.k || []).filter(function (k) { return !k.bs; });
      if (!ks.length) return '';
      var rows = ks.map(function (k) {
        var bar = '';
        if (k.lo != null) {
          var l = k.lo / 240 * 80, w = Math.max(1.5, (k.hi - k.lo) / 240 * 80);
          bar = '<span class="pen-bar c' + k.c + '" style="left:' + l.toFixed(2) + '%;width:' + w.toFixed(2) + '%"></span>';
        } else if (!k.ct && !k.th) {
          bar = '<span class="pen-bar c' + k.c + '" style="left:0;width:2%;opacity:.7"></span>';
        }
        if (k.ct) bar += '<span class="pen-cell ct" title="Tù chung thân"></span>';
        if (k.th) bar += '<span class="pen-cell th" title="Tử hình"></span>';
        var lab = k.n ? 'Khoản ' + k.n : 'Điều luật';
        var nm = link && k.n ? '<a href="dieu-' + a.id + '?k=' + k.n + '" data-k="' + k.n + '">' + lab + '</a>' : lab;
        return '<div class="pen-row"><div class="pen-lab"><b>' + nm + '</b><span>' + esc(Pen.label(k)) + '</span></div>' +
          '<div class="pen-track" title="' + esc(k.txt) + ' – tội ' + CLS[k.c].n.toLowerCase() + '">' + bar + '</div></div>';
      }).join('');
      var axis = [[0, '0'], [20, '5'], [40, '10'], [60, '15'], [80, '20', 'r'], [85, 'CT'], [95, 'TH']].map(function (x) {
        return '<span' + (x[2] ? ' class="r"' : '') + ' style="left:' + x[0] + '%">' + x[1] + '</span>';
      }).join('');
      var used = {}; ks.forEach(function (k) { used[k.c] = 1; });
      return '<div class="pen">' + rows + '<div class="pen-axis" aria-hidden="true">' + axis + '</div></div>' +
        '<div class="pen-legend">' + [1, 2, 3, 4].filter(function (c) { return used[c]; }).map(function (c) { return '<span class="tag tag--c' + c + '">' + CLS[c].n + '</span>'; }).join('') + '</div>' +
        '<p class="pen-note">Thang đo: năm tù · CT: tù chung thân · TH: tử hình. Màu thể hiện loại tội theo khoản 1 Điều 9 (căn cứ mức cao nhất của khung).</p>';
    }
  };

  /* =========================================================================
     6. Giao diện dùng chung: thông báo, popover, bottom sheet, ngăn kéo
     ========================================================================= */
  var UI = {
    toast: function (msg) {
      var t = $('#toast'); t.textContent = msg; t.classList.add('on');
      clearTimeout(UI._tt); UI._tt = setTimeout(function () { t.classList.remove('on'); }, 2200);
    },
    copy: function (text, msg) {
      var done = function () { UI.toast(msg || 'Đã sao chép'); };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, function () { UI._copyOld(text); done(); });
      } else { UI._copyOld(text); done(); }
    },
    _copyOld: function (text) {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) { /* bỏ qua */ }
      ta.remove();
    },
    sheet: function (html) {
      var s = $('#sheet'); clearTimeout(UI._st);
      s.classList.remove('is-drag', 'is-settle'); $('.sheet-panel', s).style.transform = ''; $('.sheet-bg', s).style.opacity = '';
      $('#sheetBody').innerHTML = html; s.hidden = false;
      document.body.style.overflow = 'hidden';
      var f = $('#sheetBody button, #sheetBody a, #sheetBody input'); if (f && !isTouch) f.focus();
    },
    // animate: trượt xuống rồi mới ẩn (khi người dùng kéo bảng xuống để đóng)
    closeSheet: function (animate) {
      var s = $('#sheet');
      if (s.hidden) return;
      document.body.style.overflow = '';
      var p = $('.sheet-panel', s), bg = $('.sheet-bg', s);
      var done = function () { s.hidden = true; s.classList.remove('is-drag', 'is-settle'); p.style.transform = ''; bg.style.opacity = ''; };
      clearTimeout(UI._st);
      if (!animate) { done(); return; }
      s.classList.remove('is-drag'); s.classList.add('is-settle');
      p.style.transform = 'translateY(100%)'; bg.style.opacity = '0';
      UI._st = setTimeout(done, 230);
    },
    // Bảng dưới (điện thoại, < 700px): kéo xuống để đóng, như bảng mục lục
    sheetDrag: function () {
      var S = function () { return $('#sheet'); }, P = function () { return $('#sheet .sheet-panel'); };
      dragDown({
        on: function () { return !S().hidden && window.innerWidth < 700; },
        panel: P, bg: function () { return $('#sheet .sheet-bg'); },
        scroller: P,
        start: function () { S().classList.remove('is-settle'); S().classList.add('is-drag'); },
        cancel: function () { S().classList.remove('is-drag'); S().classList.add('is-settle'); P().style.transform = ''; $('#sheet .sheet-bg').style.opacity = ''; },
        close: function () { UI.closeSheet(true); }
      });
    },
    pop: function (anchor, html) {
      var p = $('#pop'); p.innerHTML = html; p.hidden = false;
      var r = anchor.getBoundingClientRect(), pw = p.offsetWidth, ph = p.offsetHeight;
      var x = Math.min(Math.max(12, r.left + r.width / 2 - pw / 2), window.innerWidth - pw - 12);
      var y = r.bottom + 10;
      if (y + ph > window.innerHeight - 12) y = Math.max(12, r.top - ph - 10);
      p.style.left = x + 'px'; p.style.top = y + 'px';
    },
    closePop: function () { $('#pop').hidden = true; },
    drawer: function (open) {
      var d = $('#drawer'); d.hidden = !open;
      $('.hd-menu').setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) { UI.fillDrawer(); var f = $('.drawer-panel a'); if (f) f.focus(); }
    },
    // Menu là điều hướng giữa các trang: mỗi mục mở đúng trang của nó (Mục lục Bộ luật → trang muc-luc).
    // Đang đọc một điều hoặc một chương thì mục "Mục lục Bộ luật" được tô như thanh dưới (cùng nhánh Bộ luật).
    fillDrawer: function () {
      var cur = parseRoute().key, sec = /^(dieu|chuong)-/.test(cur) ? 'muc-luc' : cur;
      var L = function (href, icon, t) {
        var k = href === './' ? '' : href;
        return '<a href="' + href + '"' + (k === cur ? ' class="on" aria-current="page"' : k === sec ? ' class="on"' : '') + '>' + ic(icon) + t + '</a>';
      };
      $('#drawerNav').innerHTML =
        L('./', 'home', 'Trang chủ') + L('muc-luc', 'list', 'Mục lục Bộ luật') +
        L('tim-kiem', 'search', 'Tìm kiếm toàn văn') +
        L('da-luu', 'bookmark', 'Đã lưu & ghi chú') +
        '<div class="dn-h">Công cụ nghiên cứu</div>' +
        L('cong-cu-thoi-hieu', 'clock', 'Phân loại tội & thời hiệu') + L('cong-cu-tuoi', 'user', 'Tuổi chịu trách nhiệm hình sự') +
        L('cong-cu-thi-hanh-an', 'calendar', 'Thời hiệu thi hành bản án') + L('cong-cu-so-sanh', 'columns', 'So sánh điều luật') +
        L('cong-cu-khung-hinh-phat', 'table', 'Bảng khung hình phạt') +
        '<hr>' +
        L('gioi-thieu', 'info', 'Giới thiệu & nguồn dữ liệu') +
        '<div class="dn-h">Liên hệ luật sư</div>' +
        '<a href="tel:0983498499">' + ic('phone') + 'Gọi 0983 498 499</a>' +
        '<a href="https://zalo.me/0983498499" target="_blank" rel="noopener">' + ic('chat') + 'Nhắn Zalo</a>' +
        '<a href="mailto:luatsunam.hcm@gmail.com">' + ic('mail') + 'luatsunam.hcm@gmail.com</a>';
    },
    // Bảng "Công cụ đọc": mở từ nút Aa ở góc phải trên (điện thoại, khi đang đọc) hoặc nút Aa trong hàng nút của điều
    // luật (máy tính màn hẹp). Máy tính màn rộng có sẵn khối "Hiển thị" ở cột phải (UI.disp).
    settings: function () {
      var a = Router.view && Router.view.a;
      UI.sheet('<h2 id="sheetTitle">Công cụ đọc</h2>' +
        '<p class="set-sub">' + (a ? 'Điều ' + esc(a.id) + ' · ' : '') + 'Thay đổi áp dụng ngay và được ghi nhớ trên thiết bị này</p>' +
        UI.disp() +
        '<div class="set-row"><div><b>Đọc khi không có mạng</b><small>Tải sẵn toàn bộ 428 điều và bình luận (~3 MB)</small></div>' +
        '<button type="button" class="btn btn--sm" data-act="offline">' + ic('offline') + 'Tải về</button></div>');
    },
    // Các dòng chỉnh hiển thị dùng chung cho bảng Công cụ đọc và khối Hiển thị ở cột phải
    disp: function (compact) {
      var p = Prefs.get(), th = p.theme || 'light', fs = p.fs || 0;
      return '<div class="set-row"><div><b>Giao diện</b><small>Sáng, tối hoặc theo thiết bị</small></div>' +
        '<div class="seg" data-set="theme">' + [['light', 'Sáng'], ['dark', 'Tối'], ['auto', 'Theo máy']].map(function (o) {
          return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (th === o[0]) + '">' + o[1] + '</button>';
        }).join('') + '</div></div>' +
        '<div class="set-row"><div><b>' + (compact ? 'Cỡ chữ' : 'Cỡ chữ văn bản') + '</b><small>Điều luật và bình luận</small></div>' +
        '<div class="fs-ctl"><button type="button" data-fs="-1" aria-label="Giảm cỡ chữ">A−</button><output class="fs-out" aria-live="polite">' + (100 + fs * 6) + '%</output><button type="button" data-fs="1" aria-label="Tăng cỡ chữ">A+</button></div></div>' +
        '<div class="set-row"><div><b>' + (compact ? 'Kiểu chữ' : 'Kiểu chữ điều luật') + '</b><small>Mặc định không chân</small></div>' +
        '<div class="seg" data-set="serif"><button type="button" data-v="0" aria-pressed="' + (p.serif !== true) + '">Không chân</button><button type="button" data-v="1" aria-pressed="' + (p.serif === true) + '">Có chân</button></div></div>';
    }
  };

  /* Kéo xuống để đóng một bảng trượt từ dưới lên (mục lục, công cụ đọc, xem nhanh điều luật):
     chạm vào thanh kéo/tiêu đề — hoặc vào phần cuộn được khi phần đó đang ở trên cùng — rồi kéo xuống; bảng bám theo
     ngón tay. Thả tay khi đã kéo quá 1/4 chiều cao hoặc vuốt nhanh xuống thì đóng, ngược lại bảng trở về chỗ cũ.
     Kéo ngang (dải chương cuộn ngang…) hoặc kéo lên thì trả lại cho trình duyệt. */
  function dragDown(o) {
    var s = null;
    document.addEventListener('touchstart', function (e) {
      s = null;
      if (e.touches.length !== 1 || !o.on()) return;
      var p = o.panel(), t = e.touches[0];
      if (!p.contains(e.target) || e.target.closest('input,textarea,select')) return;
      var sc = o.scroller(e.target);
      if (sc && sc.scrollTop > 0) return;
      s = { x0: t.clientX, y0: t.clientY, sc: sc, drag: false, ly: t.clientY, lt: e.timeStamp, v: 0, off: 0, h: 1 };
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!s || e.touches.length !== 1) return;
      var t = e.touches[0], dx = t.clientX - s.x0, dy = t.clientY - s.y0;
      if (!s.drag) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (dy <= 0 || Math.abs(dy) < Math.abs(dx) * 1.2 || (s.sc && s.sc.scrollTop > 0)) { s = null; return; }
        s.drag = true; s.h = o.panel().offsetHeight || 1; o.start();
      }
      if (e.cancelable) e.preventDefault();
      s.off = Math.max(0, dy);
      o.panel().style.transform = 'translateY(' + s.off + 'px)';
      var bg = o.bg(); if (bg) bg.style.opacity = String(Math.max(0, 1 - s.off / s.h));
      var dt = e.timeStamp - s.lt;
      if (dt > 0) { s.v = (t.clientY - s.ly) / dt; s.ly = t.clientY; s.lt = e.timeStamp; }
    }, { passive: false });
    var end = function () {
      var g = s; s = null;
      if (!g || !g.drag) return;
      if (g.v > 0.5 || (g.v > -0.2 && g.off > g.h / 4)) o.close(); else o.cancel();
    };
    document.addEventListener('touchend', end, { passive: true });
    document.addEventListener('touchcancel', end, { passive: true });
  }

  /* =========================================================================
     6b. Bảng tra nhanh điều luật: toàn bộ điều theo Phần → Chương → Mục; chọn một điều là chuyển ngay tới điều đó.
         Đây là công cụ khi đang đọc (trang điều, trang chương): nút "Mục lục" ở thanh dưới (điện thoại) và đầu trang
         (máy tính), nút giữa Điều trước/sau, nút cạnh ô lọc ở cột trái, Ctrl/⌘+K.
         Ở các trang khác, nút "Mục lục" đầu trang/thanh dưới mở trang Mục lục (muc-luc); menu ☰ và chân trang
         luôn mở trang Mục lục.
         Máy tính (≥ 1024px): hộp thoại giữa màn hình, cột chương bên trái. Điện thoại, máy tính bảng: bảng trượt từ
         dưới lên (cùng phía với thanh dưới vừa bấm) — kéo thanh kéo/tiêu đề xuống, hoặc kéo danh sách xuống khi đang ở
         đầu danh sách, để đóng.
         Ô lọc hiểu số điều (173), không dấu (trom cap), "khoản 2 điều 134", "chương 16". Phím: ↑ ↓ Enter Esc.
     ========================================================================= */
  var SHEET = window.matchMedia('(max-width: 1023px)');
  // Android: nút Quay lại của hệ thống phải đóng bảng chứ không rời trang → thêm một mục lịch sử tạm khi mở.
  // Không làm trên iOS: Safari không có nút Quay lại của hệ thống; mục lịch sử thừa chỉ làm rối cử chỉ vuốt mép.
  var ANDROID = /Android/i.test(navigator.userAgent || '');
  var Jump = {
    el: null, isOpen: false, hist: false, rows: [], byId: {}, secs: [], secById: {}, act: -1, cur: null, ref: null, spyCur: null,
    isSheet: function () { return SHEET.matches; },
    // Dựng sẵn bảng lúc trình duyệt rảnh (trang điều luật, chương): lần bấm "Mục lục" đầu tiên mở ra ngay, không khựng
    warm: function () {
      if (Jump.el || Jump.warming || !DB.toc) return;
      Jump.warming = true;
      var run = function () { Jump.warming = false; if (!Jump.el) Jump.build(); };
      if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 4000 }); else setTimeout(run, 1200);
    },
    build: function () {
      var J = Jump, nav = '', list = '', lastP = null;
      DB.chaps.forEach(function (c) {
        if (c.part !== lastP) {
          lastP = c.part;
          var p = DB.parts.filter(function (x) { return x.id === c.part; })[0] || {};
          nav += '<div class="jp-np">' + esc(p.label) + '</div>';
          list += '<div class="jp-part">' + esc(p.label) + ' · ' + esc(p.name) + '</div>';
        }
        nav += '<button type="button" data-jc="' + c.id + '" title="' + esc(c.title) + '"><b>' + esc(c.num || 'TH') + '</b><span>' + esc(c.name) + '</span><small>' + c.arts.length + '</small></button>';
        var rows = '', lastM = null;
        c.arts.forEach(function (a) {
          if (a.m && a.m !== lastM) { lastM = a.m; var mn = c.muc.filter(function (m) { return m.n === a.m; })[0]; if (mn) rows += '<div class="jp-muc">' + esc(mn.name) + '</div>'; }
          rows += '<a class="jp-a' + (a.rep ? ' is-rep' : '') + '" href="dieu-' + a.id + '" data-id="' + esc(a.id) + '"><b>Điều ' + esc(a.id) + '</b><span class="t">' + esc(a.t) + '</span><span class="tg">' + artTags(a, true) + '</span></a>';
        });
        var range = 'Điều ' + c.first.id + (c.first !== c.last ? ' – ' + c.last.id : '');
        list += '<section class="jp-sec" data-c="' + c.id + '"><h3 class="jp-ch"><small>' + (c.num ? esc(c.label) + ' · ' : '') + range + ' · ' + c.arts.length + ' điều</small>' + esc(c.name) +
          (CH_NOTE[c.id] ? ' <span class="tag tag--rep26">' + CH_NOTE[c.id].short + '</span>' : '') + '</h3>' + rows + '</section>';
      });
      var mod = /Mac|iP(hone|ad|od)/.test(navigator.platform || '') ? '⌘' : 'Ctrl';
      var el = document.createElement('div');
      el.className = 'jp'; el.id = 'jump'; el.hidden = true;
      el.innerHTML =
        '<div class="jp-bg" data-act="jump-close"></div>' +
        '<div class="jp-panel" role="dialog" aria-modal="true" aria-labelledby="jpTitle" tabindex="-1">' +
        '<div class="jp-grip" aria-hidden="true"></div><div class="jp-hd"><div><h2 id="jpTitle">' + ic('olist') + 'Mục lục điều luật</h2><p class="jp-sub" id="jpSub" aria-live="polite"></p></div>' +
        '<button type="button" class="jp-x" data-act="jump-close" aria-label="Đóng mục lục">' + ic('x') + '</button></div>' +
        '<div class="jp-tool"><div class="sb"><div class="sb-box">' + ic('filter') +
        '<input class="sb-in" id="jpQ" type="search" autocomplete="off" spellcheck="false" enterkeyhint="go" placeholder="' + (window.matchMedia('(max-width: 560px)').matches ? 'Số điều hoặc tên điều…' : 'Gõ số điều hoặc tên điều… (vd: 173, trom cap, ma tuy)') + '" aria-label="Lọc danh sách điều luật" aria-controls="jpList">' +
        '<button type="button" class="sb-clear" id="jpClr" aria-label="Xóa từ lọc" hidden>' + ic('x') + '</button></div></div>' +
        '<div class="jp-recent" id="jpRecent" hidden></div></div>' +
        '<div class="jp-body"><nav class="jp-nav" id="jpNav" aria-label="Đi tới chương">' + nav + '</nav>' +
        '<div class="jp-list" id="jpList">' + list + '<div class="jp-empty" id="jpEmpty" hidden></div></div></div>' +
        '<div class="jp-ft"><span class="k"><kbd>↑</kbd><kbd>↓</kbd> chọn điều</span><span class="k"><kbd>Enter</kbd> mở</span><span class="k"><kbd>Esc</kbd> đóng</span>' +
        '<span class="k"><kbd>' + mod + '</kbd>+<kbd>K</kbd> mở mục lục ở mọi trang</span>' +
        '<a href="muc-luc" title="Trang Mục lục: lọc điều sửa đổi 2025, tổng quan từng chương">Trang Mục lục đầy đủ ' + ic('arrow-r') + '</a></div>' +
        '</div>';
      document.body.appendChild(el);
      J.el = el; J.q = $('#jpQ', el); J.clr = $('#jpClr', el); J.sub = $('#jpSub', el); J.rec = $('#jpRecent', el);
      J.panel = $('.jp-panel', el); J.bg = $('.jp-bg', el);
      J.nav = $('#jpNav', el); J.list = $('#jpList', el); J.empty = $('#jpEmpty', el);
      $$('.jp-sec', el).forEach(function (s) {
        var c = DB.chapById[s.dataset.c], x = { c: c, el: s, btn: $('[data-jc="' + c.id + '"]', J.nav), lo: c.name.toLowerCase(), fo: fold(c.name) };
        x.n = $('small', x.btn);
        J.secs.push(x); J.secById[c.id] = x;
      });
      $$('.jp-a', el).forEach(function (r, i) {
        var x = { a: DB.byId[r.dataset.id], el: r, t: $('.t', r), i: i, hl: null };
        J.rows.push(x); J.byId[x.a.id] = x;
      });
      var redo = debounce(J.filter, 60);
      J.q.addEventListener('input', redo);
      J.q.addEventListener('keydown', J.onKey);
      J.clr.addEventListener('click', function () { J.q.value = ''; J.filter(); J.q.focus(); });
      J.nav.addEventListener('click', function (e) {
        var b = e.target.closest('[data-jc]'), s = b && J.secById[b.dataset.jc];
        if (!s || s.el.hidden) return;
        var smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        J.list.scrollTo({ top: s.el.offsetTop, behavior: smooth ? 'smooth' : 'auto' });
      });
      var ticking = false;
      J.list.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () { ticking = false; J.spy(); });
      }, { passive: true });
    },
    show: function (opener) {
      var J = Jump;
      if (!DB.toc) return false;
      // Đang ở trang Mục lục: không mở thêm bảng mục lục chồng lên, chỉ đưa con trỏ vào ô lọc của trang
      if (Router.view && Router.view.focusFilter) { Router.view.focusFilter(); return true; }
      if (!J.el) J.build();
      UI.closePop(); UI.closeSheet(); UI.drawer(false);
      clearTimeout(J.tHide);
      J.opener = opener || document.activeElement;
      // Điều đang đọc (hoặc chương đang xem) để đánh dấu và cuộn tới
      var v = Router.view, a = v && v.a ? v.a : null;
      var ch = a ? a.ch : (Router.cur && Router.cur.parts[0] === 'chuong' ? DB.chapterBySlug(Router.cur.parts[1] || '') : null);
      if (J.cur) { J.cur.el.classList.remove('on'); J.cur.el.removeAttribute('aria-current'); }
      J.cur = a ? J.byId[a.id] : null;
      if (J.cur) { J.cur.el.classList.add('on'); J.cur.el.setAttribute('aria-current', 'page'); }
      var ids = Hist.list().map(function (h) { return h.id; }).filter(function (id) { return DB.byId[id] && (!a || id !== a.id); }).slice(0, 6);
      J.rec.hidden = !ids.length;
      J.rec.innerHTML = '<span>' + ic('history') + 'Vừa xem</span>' + ids.map(function (id) {
        return '<a class="chip" href="dieu-' + id + '" title="' + esc(DB.byId[id].t) + '">Điều ' + esc(id) + '</a>';
      }).join('');
      J.q.value = '';
      J.filter();
      J.el.classList.remove('is-drag');
      J.el.hidden = false; J.isOpen = true;
      document.body.style.overflow = 'hidden';
      // Hiện tiêu đề chương ở trên cùng để thấy bối cảnh; chương dài thì đặt điều đang đọc ở khoảng 1/3 khung
      var L = J.list, sec = ch && J.secById[ch.id] ? J.secById[ch.id].el : null;
      if (J.cur) {
        var y = J.cur.el.offsetTop;
        L.scrollTop = y + J.cur.el.offsetHeight - sec.offsetTop < L.clientHeight * 0.7 ? sec.offsetTop : y - L.clientHeight / 3;
      } else L.scrollTop = sec ? sec.offsetTop : 0;
      if (J.spyCur) J.spyCur.btn.classList.remove('on');
      J.spyCur = null; J.spy();
      // Màn hình cảm ứng: đưa tiêu điểm vào bảng (trình đọc màn hình nhận biết) nhưng không bật bàn phím ảo
      if (isTouch) J.panel.focus({ preventScroll: true }); else J.q.focus({ preventScroll: true });
      void J.panel.offsetWidth; J.settle(true);
      return true;
    },
    // Kết thúc mở/kéo: giữ mở (open) hoặc đóng lại; bảng trượt nốt từ vị trí đang đứng
    settle: function (open) {
      var J = Jump;
      J.el.classList.remove('is-drag');
      J.panel.style.transform = ''; J.bg.style.opacity = '';
      if (!open) { J.hide(); return; }
      J.el.classList.add('is-open');
      // Đang chờ lệnh lùi lịch sử trước đó hoàn tất (đóng rồi mở lại rất nhanh) → thêm mục lịch sử sau, khi lệnh lùi xong
      if (ANDROID && J.isSheet() && !J.hist) { if (J.backing) J.pushLater = true; else J.push(); }
    },
    // Gỡ mục lịch sử tạm; đánh dấu để sự kiện popstate do chính lệnh này sinh ra (đến sau) không đóng nhầm bảng vừa mở lại
    back: function () { Jump.backing = true; history.back(); },
    push: function () { history.pushState({ jp: 1 }, '', location.href); Jump.hist = true; },
    // navigating: đóng vì đang chuyển trang → ẩn ngay, không trả tiêu điểm, không lùi lịch sử
    hide: function (navigating) {
      var J = Jump;
      if (!J.isOpen) return;
      J.isOpen = false; J.pushLater = false;
      document.body.style.overflow = '';
      if (J.hist) { J.hist = false; if (!navigating) J.back(); }
      J.el.classList.remove('is-open', 'is-drag');
      J.panel.style.transform = ''; J.bg.style.opacity = '';
      clearTimeout(J.tHide);
      if (J.isSheet() && !navigating) J.tHide = setTimeout(function () { if (!J.isOpen) J.el.hidden = true; }, 300);
      else J.el.hidden = true;
      if (!navigating && J.opener && J.opener.focus && J.opener.offsetParent) J.opener.focus({ preventScroll: true });
    },
    // Kéo xuống để đóng (điện thoại, máy tính bảng)
    swipe: function () {
      var J = Jump;
      dragDown({
        on: function () { return J.isOpen && J.isSheet(); },
        panel: function () { return J.panel; }, bg: function () { return J.bg; },
        scroller: function (t) { return J.list.contains(t) ? J.list : null; },
        start: function () { J.el.classList.add('is-drag'); },
        cancel: function () { J.settle(true); },
        close: function () { J.settle(false); }
      });
    },
    filter: function () {
      var J = Jump, v = J.q.value.trim();
      J.lastV = J.q.value;
      J.clr.hidden = !v;
      // Hiểu cú pháp tra nhanh như ô tìm kiếm: 173 · điều 173 · khoản 2 điều 134 · chương 16
      var r = v ? parseRef(v) : null, chap = null, only = null, num = null, cq = null;
      if (r && r.chap) chap = r.chap;
      else if (r && r.art) { if (r.k) only = r.art; else num = r.art; }
      else if (v) { cq = window.LX.compile(window.LX.parseQuery(v), { prefix: true }); if (cq.empty) cq = null; }
      J.ref = r && (r.a || r.chap) ? r : null;
      var on = !!(chap || only || num || cq), n = 0, per = {}, chHit = {};
      if (cq) J.secs.forEach(function (s) { chHit[s.c.id] = cq.exact(s.lo, s.fo) || cq.loose(s.lo, s.fo); });
      J.rows.forEach(function (x) {
        var a = x.a, ok = !on || (chap ? a.ch === chap : only ? a.id === only : num ? a.id.indexOf(num) === 0 :
          (cq.exact(a.lo, a.fo) || cq.loose(a.lo, a.fo) || chHit[a.ch.id]));
        x.el.hidden = !ok;
        if (ok) { n++; per[a.ch.id] = (per[a.ch.id] || 0) + 1; }
        var h = ok && cq ? hl(a.t, cq) : null;
        if (h !== x.hl) { x.t.innerHTML = h == null ? esc(a.t) : h; x.hl = h; }
      });
      J.secs.forEach(function (s) {
        var k = per[s.c.id] || 0;
        s.el.hidden = on && !k;
        s.btn.hidden = on && !k;
        s.n.textContent = on ? k : s.c.arts.length;
      });
      J.el.classList.toggle('is-filter', on);
      J.empty.hidden = !on || n > 0;
      if (on && !n) {
        J.empty.innerHTML = ic('search') + '<p>Không có điều nào khớp “' + esc(v) + '”.</p><a class="btn btn--sm" href="tim-kiem?q=' + encodeURIComponent(v) + '">' + ic('search') + 'Tìm trong toàn văn điều luật và bình luận</a>';
      }
      var tip = J.ref && J.ref.a && J.ref.k && n ? ' · Enter để mở ' + refLabel(J.ref) : '';
      J.sub.textContent = on ? (n ? 'Tìm thấy ' + n + ' điều' + tip : 'Không có điều nào phù hợp') :
        DB.arts.length + ' điều · ' + DB.toc.stats.chapters + ' chương · chọn một điều để chuyển tới ngay';
      if (on) { J.list.scrollTop = 0; J.setAct(J.firstVisible()); }
      else J.setAct(J.cur ? J.cur.i : -1);
      J.spy();
    },
    firstVisible: function () {
      for (var i = 0; i < Jump.rows.length; i++) if (!Jump.rows[i].el.hidden) return i;
      return -1;
    },
    setAct: function (i, scroll) {
      var J = Jump, old = J.rows[J.act];
      if (old) old.el.classList.remove('act');
      J.act = i;
      var x = J.rows[i];
      if (x) { x.el.classList.add('act'); if (scroll) J.reveal(x.el); }
    },
    // Đưa một dòng vào vùng nhìn thấy của danh sách, tránh bị tiêu đề chương (dính ở trên) che
    reveal: function (el) {
      var L = Jump.list, y = el.offsetTop, h = el.offsetHeight;
      var hd = (el.parentNode.querySelector('.jp-ch') || {}).offsetHeight || 0;
      if (y - hd - 6 < L.scrollTop) L.scrollTop = y - hd - 6;
      else if (y + h + 6 > L.scrollTop + L.clientHeight) L.scrollTop = y + h + 6 - L.clientHeight;
    },
    // Đánh dấu chương đang hiển thị ở đầu danh sách và giữ nút chương đó trong tầm nhìn
    spy: function () {
      var J = Jump, top = J.list.scrollTop + 12, cur = null;
      for (var i = 0; i < J.secs.length; i++) {
        var s = J.secs[i];
        if (s.el.hidden) continue;
        if (!cur || s.el.offsetTop <= top) cur = s; else break;
      }
      if (cur === J.spyCur) return;
      if (J.spyCur) J.spyCur.btn.classList.remove('on');
      J.spyCur = cur;
      if (!cur) return;
      cur.btn.classList.add('on');
      var N = J.nav, b = cur.btn;
      if (N.scrollWidth > N.clientWidth + 2) {
        if (b.offsetLeft < N.scrollLeft || b.offsetLeft + b.offsetWidth > N.scrollLeft + N.clientWidth) N.scrollLeft = b.offsetLeft - (N.clientWidth - b.offsetWidth) / 2;
      } else if (b.offsetTop < N.scrollTop || b.offsetTop + b.offsetHeight > N.scrollTop + N.clientHeight) {
        N.scrollTop = b.offsetTop - (N.clientHeight - b.offsetHeight) / 2;
      }
    },
    onKey: function (e) {
      var J = Jump;
      // Gõ (hoặc dán) rồi nhấn phím ngay, trước khi bộ lọc trễ kịp chạy → lọc ngay để không mở nhầm theo kết quả cũ
      if ((e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') && J.q.value !== J.lastV) J.filter();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var d = e.key === 'ArrowDown' ? 1 : -1, i = J.act;
        do { i += d; } while (J.rows[i] && J.rows[i].el.hidden);
        if (J.rows[i]) J.setAct(i, true);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        var x = J.rows[J.act] && !J.rows[J.act].el.hidden ? J.rows[J.act] : J.rows[J.firstVisible()];
        if (!x) { if (J.ref && J.ref.chap) go(refHref(J.ref)); return; }
        go(J.ref && J.ref.a === x.a ? refHref(J.ref) : 'dieu-' + x.a.id);
      } else if (e.key === 'Escape' && J.q.value) {
        // Esc lần đầu xóa từ lọc, lần sau mới đóng bảng
        e.preventDefault(); e.stopPropagation();
        J.q.value = ''; J.filter();
      }
    }
  };

  /* Điện thoại, máy tính bảng: cuộn xuống để đọc → header và thanh dưới thu lại; cuộn lên, về đầu hoặc tới cuối trang → hiện.
     Chỉ đổi một lớp trên <body>, hiệu ứng do CSS đảm nhận bằng transform (không bắt trình duyệt dàn trang lại).
     Cộng dồn quãng cuộn cùng chiều để ngón tay khẽ rung không làm thanh nhấp nháy. */
  var Bars = {
    hidden: false, lastY: 0, acc: 0,
    set: function (h) {
      if (h === Bars.hidden) return;
      Bars.hidden = h; document.body.classList.toggle('ui-hide', h);
    },
    reset: function () { Bars.lastY = window.scrollY; Bars.acc = 0; Bars.set(false); },
    init: function () {
      var ticking = false;
      var check = function () {
        ticking = false;
        var y = window.scrollY, dy = y - Bars.lastY;
        Bars.lastY = y;
        if (!SHEET.matches) { Bars.set(false); return; }
        var max = document.documentElement.scrollHeight - window.innerHeight;
        if (y < 140 || y > max - 80) { Bars.acc = 0; Bars.set(false); return; }
        if (!dy) return;
        if ((dy > 0) !== (Bars.acc > 0)) Bars.acc = 0;
        Bars.acc += dy;
        if (Bars.acc > 28) Bars.set(true);
        else if (Bars.acc < -18) Bars.set(false);
      };
      window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
      // Đi bằng phím Tab vào header / thanh dưới → hiện lại
      document.addEventListener('focusin', function (e) { if (e.target.closest && e.target.closest('.hd,.tabbar')) Bars.set(false); });
      if (SHEET.addEventListener) SHEET.addEventListener('change', function () { Bars.set(false); });
    }
  };

  /* =========================================================================
     7. Tìm kiếm: gợi ý tức thời + toàn văn (Web Worker)
     ========================================================================= */
  function parseRef(q) {
    var f = fold(q).replace(/[.,:;]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!f) return null;
    var m, art, k, pt;
    if ((m = f.match(/^(?:ch|chuong)\s*([0-9]{1,2}|[ivxl]{1,6})$/))) {
      var ch = DB.chapterBySlug(m[1]);
      return ch ? { chap: ch } : null;
    }
    if ((m = f.match(/^(?:diem\s+([a-z]{1,2})\s+)?(?:(?:khoan|k)\s*(\d{1,2})\s+)?(?:dieu|d)\s*(\d{1,3}[a-z]?)(?:\s+(?:khoan|k)\s*(\d{1,2}))?(?:\s+(?:diem)\s*([a-z]))?$/))) {
      art = m[3]; k = m[2] || m[4]; pt = m[1] || m[5];
    } else if ((m = f.match(/^(\d{1,3}[a-z]?)$/))) {
      art = m[1];
    } else if ((m = f.match(/^(?:bo luat hinh su|blhs)\s*(?:dieu|d)?\s*(\d{1,3}[a-z]?)$/))) {
      art = m[1];
    }
    if (!art) return null;
    if (pt === 'dd') pt = 'đ';
    return { art: art, a: DB.byId[art] || null, k: k || null, pt: pt || null };
  }
  function refHref(r) {
    if (r.chap) return 'chuong-' + r.chap.slug;
    var h = 'dieu-' + r.art;
    if (r.k) h += '?k=' + r.k + (r.pt ? '&d=' + r.pt : '');
    return h;
  }
  function refLabel(r) {
    if (r.chap) return r.chap.title;
    return (r.pt ? 'Điểm ' + r.pt + ' ' : '') + (r.k ? (r.pt ? 'khoản ' : 'Khoản ') + r.k + ' ' : '') + (r.pt || r.k ? 'Điều ' : 'Điều ') + r.art;
  }

  function suggest(q) {
    var out = [], seen = {};
    var raw = q.trim();
    if (!raw) {
      var rq = Store.get('recentQ', []);
      rq.slice(0, 5).forEach(function (x) { out.push({ kind: 'recent', q: x, href: 'tim-kiem?q=' + encodeURIComponent(x) }); });
      Hist.list().slice(0, 4).forEach(function (h) {
        var a = DB.byId[h.id]; if (a) out.push({ kind: 'art', a: a, href: 'dieu-' + a.id, sec: 'Đã xem gần đây' });
      });
      return out;
    }
    var r = parseRef(raw);
    if (r) {
      if (r.chap) out.push({ kind: 'chap', chap: r.chap, href: refHref(r), sec: 'Đi tới' });
      else if (r.a) { out.push({ kind: 'art', a: r.a, href: refHref(r), lab: refLabel(r), sec: 'Đi tới', direct: 1 }); seen[r.a.id] = 1; }
      else out.push({ kind: 'none', lab: 'Bộ luật không có Điều ' + r.art });
    }
    var pq = window.LX.parseQuery(raw), cq = window.LX.compile(pq, { prefix: true }), f = fold(raw).toLowerCase();
    if (!cq.empty && raw.length >= 2) {
      var hits = [];
      DB.arts.forEach(function (a) {
        if (seen[a.id]) return;
        if (!cq.test(a.t)) return;
        var s = 1;
        if (a.fo.indexOf(f) === 0 || a.fo.indexOf('toi ' + f) === 0) s = 3;
        else if (a.fo.indexOf(' ' + f) > -1) s = 2;
        hits.push({ a: a, s: s });
      });
      hits.sort(function (x, y) { return y.s - x.s || x.a.i - y.a.i; });
      hits.slice(0, 6).forEach(function (h, i) { seen[h.a.id] = 1; out.push({ kind: 'art', a: h.a, href: 'dieu-' + h.a.id + '?q=' + encodeURIComponent(raw), sec: i ? null : 'Tên điều luật' }); });
      // Cách gọi thông dụng
      var fw = ' ' + f + ' ', syn = [];
      Object.keys(SYN).forEach(function (key) {
        var hit = fw.indexOf(' ' + key + ' ') > -1 || (f.length >= 3 && key.indexOf(f) === 0);
        if (hit) SYN[key].forEach(function (id) { if (!seen[id] && DB.byId[id]) { seen[id] = 1; syn.push(DB.byId[id]); } });
      });
      syn.slice(0, 5).forEach(function (a, i) { out.push({ kind: 'art', a: a, href: 'dieu-' + a.id, sec: i ? null : 'Có thể bạn đang tìm' }); });
      TOOL_KW.forEach(function (t) {
        if (t.k.some(function (k) { return f.indexOf(k) > -1; })) out.push({ kind: 'tool', t: t, href: t.href, sec: 'Công cụ' });
      });
      out.push({ kind: 'full', q: raw, href: 'tim-kiem?q=' + encodeURIComponent(raw), sec: 'Tìm trong toàn văn' });
    }
    return out;
  }

  function SearchBox(host, opt) {
    opt = opt || {};
    var id = 'dd' + Math.random().toString(36).slice(2, 7);
    host.innerHTML =
      '<form class="sb' + (opt.lg ? ' sb--lg' : '') + '" role="search" autocomplete="off">' +
      '<div class="sb-box">' + ic('search') +
      '<input class="sb-in" type="search" name="q" placeholder="' + esc(opt.ph || 'Số điều, tên tội, từ khóa… (vd: 173, lừa đảo)') + '" ' +
      'aria-label="Tìm kiếm trong Bộ luật Hình sự" role="combobox" aria-expanded="false" aria-controls="' + id + '" aria-autocomplete="list" enterkeyhint="search" spellcheck="false">' +
      '<button type="button" class="sb-clear" aria-label="Xóa nội dung" hidden>' + ic('x') + '</button>' +
      (opt.kbd ? '<span class="sb-kbd" aria-hidden="true">/</span>' : '') +
      (opt.go === false ? '' : '<button class="sb-go" type="submit" aria-label="Tra cứu">' + (opt.lg ? ic('search') + '<span>Tra cứu</span>' : ic('arrow-r')) + '</button>') +
      '</div><div class="sb-dd" id="' + id + '" role="listbox" hidden></div></form>';
    var form = $('form', host), inp = $('.sb-in', host), dd = $('.sb-dd', host), clr = $('.sb-clear', host);
    var items = [], sel = -1;
    if (opt.value) inp.value = opt.value;
    clr.hidden = !inp.value;

    function render() {
      if (!DB.toc) return;
      items = suggest(inp.value);
      if (opt.onlyRefs) items = items.filter(function (x) { return x.kind !== 'full'; });
      if (!items.length) { close(); return; }
      sel = items[0].direct ? 0 : -1;
      var h = '', idx = 0;
      items.forEach(function (it) {
        if (it.sec) h += '<div class="sb-sec">' + esc(it.sec) + '</div>';
        if (it.kind === 'none') { h += '<div class="sb-it" aria-disabled="true">' + ic('info') + '<span class="tt">' + esc(it.lab) + '</span></div>'; return; }
        var i = idx++;
        it.i = i;
        var body;
        if (it.kind === 'art') {
          var a = it.a;
          body = '<span class="num">Điều ' + esc(a.id) + '</span><span class="tt">' + (it.lab && it.lab !== 'Điều ' + a.id ? '<b>' + esc(it.lab) + '</b> · ' : '') + esc(a.t) +
            '<small>' + esc(a.ch.label) + (Pen.maxText(a) ? ' · ' + esc(Pen.maxText(a)) : '') + '</small></span>';
        } else if (it.kind === 'chap') {
          body = '<span class="ic">' + ic(ICONS[it.chap.id] || 'book') + '</span><span class="tt">' + esc(it.chap.title) + '<small>' + it.chap.arts.length + ' điều · Điều ' + it.chap.first.id + ' – ' + it.chap.last.id + '</small></span>';
        } else if (it.kind === 'tool') {
          body = '<span class="ic">' + ic(it.t.i) + '</span><span class="tt">' + esc(it.t.t) + '</span>';
        } else if (it.kind === 'recent') {
          body = '<span class="ic">' + ic('history') + '</span><span class="tt">' + esc(it.q) + '</span>';
        } else {
          body = '<span class="ic">' + ic('search') + '</span><span class="tt">Tìm “' + esc(it.q) + '” trong toàn văn điều luật và bình luận</span>';
        }
        h += '<a class="sb-it" role="option" id="' + id + '-' + i + '" data-i="' + i + '" href="' + it.href + '" aria-selected="' + (sel === i) + '">' + body + '<span class="go">' + ic('chev-r') + '</span></a>';
      });
      if (!inp.value.trim()) h += '<div class="sb-hint">Mẹo: gõ <b>173</b>, <b>khoản 2 điều 134</b>, <b>chương 14</b> hoặc từ khóa không dấu như <b>lua dao</b>.</div>';
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
      if (opt.onPick) { opt.onPick(it); return; }
      go(it.href);
    }
    // Người dùng bắt đầu gõ → chuẩn bị sẵn tìm kiếm toàn văn (tải ~400 KB dữ liệu) để kết quả có ngay khi nhấn tìm
    inp.addEventListener('input', function () { clr.hidden = !inp.value; render(); FT.start(); if (opt.onInput) opt.onInput(inp.value); });
    inp.addEventListener('focus', function () { render(); });
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
      if (sel > -1) { var it = items.filter(function (x) { return x.i === sel; })[0]; if (it) { choose(it); return; } }
      if (!v) { inp.focus(); return; }
      var r = parseRef(v);
      close(); inp.blur();
      if (opt.onSubmit) { opt.onSubmit(v); return; }
      if (r && (r.chap || r.a)) { go(refHref(r)); return; }
      rememberQ(v);
      go('tim-kiem?q=' + encodeURIComponent(v));
    });
    inp.addEventListener('blur', function () { setTimeout(close, 150); });
    return { input: inp, close: close, set: function (v) { inp.value = v; clr.hidden = !v; } };
  }
  function rememberQ(q) {
    var l = Store.get('recentQ', []).filter(function (x) { return x !== q; });
    l.unshift(q); Store.set('recentQ', l.slice(0, 10));
  }

  var FT = {
    started: false, ready: false, seq: 0, cbs: {}, engine: null, worker: null, progress: null,
    start: function () {
      if (FT.started) return; FT.started = true;
      var chapters = DB.chaps.map(function (c) { return c.id; });
      var titles = DB.arts.map(function (a) { return [a.id, 'Điều ' + a.id + '. ' + a.t]; });
      try {
        var w = new Worker(abs('assets/js/search-worker.js?v=' + VER));
        w.onmessage = function (e) {
          var m = e.data;
          if (m.type === 'progress') { FT.progress = m; FT.emit('progress', m); }
          else if (m.type === 'ready') { FT.ready = true; FT.emit('ready', m); }
          else if (m.type === 'result') { var cb = FT.cbs[m.id]; delete FT.cbs[m.id]; if (cb) cb.cb(m); }
          else if (m.type === 'error') { w.terminate(); FT.worker = null; FT.fallback(chapters, titles); }
        };
        w.onerror = function () { w.terminate(); FT.worker = null; FT.fallback(chapters, titles); };
        w.postMessage({ type: 'init', chapters: chapters, titles: titles, v: DB.v, base: abs('data/') });
        FT.worker = w;
      } catch (e) { FT.fallback(chapters, titles); }
    },
    // Chạy tìm kiếm ngay trên trang khi không dùng được Web Worker (chỉ một lần, dù worker báo lỗi theo nhiều đường)
    fallback: function (chapters, titles) {
      if (FT.engine || FT.fb) return;
      FT.fb = true;
      var load = window.LXEngine ? Promise.resolve() : new Promise(function (res, rej) {
        var s = document.createElement('script'); s.src = abs('assets/js/search-engine.js?v=' + VER); s.onload = res; s.onerror = rej; document.head.appendChild(s);
      });
      load.then(function () {
        return Promise.all(chapters.map(function (c) {
          return fetch(abs('data/' + c + '.json?v=' + DB.v)).then(function (r) { return r.json(); });
        }));
      }).then(function (lists) {
        FT.engine = new window.LXEngine();
        FT.engine.load(titles, lists);
        FT.ready = true; FT.emit('ready', {});
        Object.keys(FT.cbs).forEach(function (k) { var x = FT.cbs[k]; delete FT.cbs[k]; FT.query(x.q).then(x.cb); });
      }).catch(function () {
        // Mất mạng…: cho phép thử lại ở lần tìm sau thay vì kẹt ở trạng thái "đang nạp"
        FT.fb = false; FT.started = false;
        FT.emit('error', {});
      });
    },
    listeners: [],
    on: function (fn) { FT.listeners.push(fn); },
    off: function (fn) { FT.listeners = FT.listeners.filter(function (x) { return x !== fn; }); },
    emit: function (t, m) { FT.listeners.slice().forEach(function (fn) { fn(t, m); }); },
    query: function (q) {
      FT.start();
      return new Promise(function (res) {
        if (FT.engine) { res(FT.engine.run(q)); return; }
        var id = ++FT.seq;
        FT.cbs[id] = { q: q, cb: res };
        if (FT.worker) FT.worker.postMessage({ type: 'search', id: id, q: q });
      });
    }
  };

  /* =========================================================================
     8. Định tuyến
     ========================================================================= */
  var Router = { cur: null, view: null, byClick: false, pos: {} };
  try { history.scrollRestoration = 'manual'; } catch (e) { /* bỏ qua */ }

  // Đường dẫn sạch → tuyến nội bộ: dieu-173?tab=binh-luan → ['dieu', '173', 'binh-luan']; cong-cu-tuoi → ['cong-cu', 'tuoi']
  function parseRoute() {
    var rest = location.pathname.indexOf(ROOT_PATH) === 0 ? location.pathname.slice(ROOT_PATH.length) : location.pathname;
    try { rest = decodeURIComponent(rest); } catch (e) { /* giữ nguyên */ }
    rest = rest.replace(/\.html$/, '').replace(/\/+$/, '');
    if (rest === 'index') rest = '';
    var q = new URLSearchParams(location.search), m, parts;
    if ((m = rest.match(/^dieu-(.+)$/))) parts = ['dieu', m[1]].concat(q.get('tab') ? [q.get('tab')] : []);
    else if ((m = rest.match(/^chuong-(.+)$/))) parts = ['chuong', m[1]];
    else if ((m = rest.match(/^cong-cu(?:-(.+))?$/))) parts = ['cong-cu'].concat(m[1] ? [m[1]] : []);
    else parts = rest ? rest.split('/') : [];
    return { parts: parts, q: q, key: rest, full: rest + location.search };
  }
  // Liên kết kiểu cũ (#/dieu/173/binh-luan?k=2, #d173) → đường dẫn sạch tương ứng; null nếu không phải
  function legacyHash() {
    var h = location.hash, m;
    if ((m = h.match(/^#d(\d{1,3}[a-z]?)$/))) return 'dieu-' + m[1];
    if (h.indexOf('#/') !== 0) return null;
    h = h.slice(2);
    var i = h.indexOf('?'), p = (i > -1 ? h.slice(0, i) : h).split('/').filter(Boolean), q = new URLSearchParams(i > -1 ? h.slice(i + 1) : ''), out;
    if (p[0] === 'dieu' && p[1]) { out = 'dieu-' + p[1]; if (p[2]) q.set('tab', p[2]); }
    else if (p[0] === 'chuong' && p[1]) out = 'chuong-' + p[1];
    else if (p[0] === 'cong-cu') out = 'cong-cu' + (p[1] ? '-' + p[1] : '');
    else out = p[0] || './';
    var qs = q.toString();
    return out + (qs ? '?' + qs : '');
  }
  function go(href, replace) {
    var u = abs(href);
    if (Router.stale && u !== location.href && !Jump.hist) { location.assign(u); return; }
    Router.byClick = true;
    // Chọn điều trong mục lục đang có mục lịch sử tạm (Android) → thay mục đó, để nút Quay lại không phải bấm hai lần
    Jump.pushLater = false;
    if (Jump.hist) { Jump.hist = false; if (u === location.href) Jump.back(); else replace = true; }
    if (u !== location.href) history[replace ? 'replaceState' : 'pushState'](null, '', u);
    route();
  }
  // Liên kết trỏ tới một trang của ứng dụng (cùng thư mục gốc, không phải tệp tĩnh) → URL, ngược lại null
  function appUrl(a) {
    var h = a.getAttribute('href');
    if (!h || h.charAt(0) === '#' || (a.target && a.target !== '_self') || a.hasAttribute('download')) return null;
    var u = new URL(a.href);
    if (u.origin !== location.origin || u.pathname.indexOf(ROOT_PATH) !== 0) return null;
    return /[/.]/.test(u.pathname.slice(ROOT_PATH.length).replace(/\.html$/, '')) ? null : u;
  }
  function setNav(name) {
    $$('[data-nav]').forEach(function (a) { a.classList.toggle('on', a.dataset.nav === name); if (a.dataset.nav === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.body.classList.toggle('is-home', name === 'home');
  }
  // Phải khớp với tiêu đề trong trang dựng tĩnh (tools/build_seo.py) vì công cụ tìm kiếm đọc tiêu đề sau khi chạy JavaScript
  function setTitle(t) { document.title = t ? t + ' – Bộ luật Hình sự 2015 (sửa đổi 2025)' : 'Tra cứu Bộ luật Hình sự 2015 (sửa đổi 2017, 2025) – Luật Sư Nam'; }

  var VIEWS = {};
  // Mã các công cụ (tools.js) chỉ tải khi mở trang công cụ; trang dựng tĩnh của công cụ đã nhúng sẵn tệp này
  var toolsP = null;
  function loadTools() {
    return toolsP || (toolsP = new Promise(function (res, rej) {
      var sc = document.createElement('script');
      sc.src = abs('assets/js/tools.js?v=' + VER); sc.onload = res;
      sc.onerror = function () { toolsP = null; sc.remove(); rej(new Error('tools.js')); };
      document.head.appendChild(sc);
    }));
  }
  function route() {
    var legacy = legacyHash();
    if (legacy != null) history.replaceState(null, '', abs(legacy));
    var ctx = parseRoute(), main = $('#main');
    var name = ctx.parts[0] || '';
    document.body.classList.toggle('is-reading', name === 'dieu' || name === 'chuong');
    document.body.classList.toggle('is-article', name === 'dieu');
    // Nút "Mục lục" (thanh dưới, đầu trang) mở bảng nổi khi đang đọc → báo cho trình đọc màn hình
    $$('[data-act="toc"]').forEach(function (a) { if (name === 'dieu' || name === 'chuong') a.setAttribute('aria-haspopup', 'dialog'); else a.removeAttribute('aria-haspopup'); });
    if (name === 'cong-cu' && !VIEWS['cong-cu']) {
      loadTools().then(route, function () {
        main.innerHTML = '<div class="wrap page"><div class="callout callout--warn">' + ic('alert') + '<div>Không tải được công cụ. Vui lòng kiểm tra kết nối mạng và <a href="javascript:location.reload()">tải lại trang</a>.</div></div></div>';
      });
      return;
    }
    var prevKey = Router.cur && Router.cur.full;
    if (prevKey != null) Router.pos[prevKey] = window.scrollY;
    var back = !Router.byClick;
    Router.byClick = false;
    UI.closePop(); UI.closeSheet(); UI.drawer(false); Jump.hide(true);
    Bars.reset();
    // Cùng một trang, chỉ đổi tham số (tab, khoản…) → cập nhật tại chỗ
    if (Router.view && Router.view.update && Router.cur && Router.cur.parts.join('/') === ctx.parts.join('/') && Router.view.update(ctx) !== false) {
      Router.cur = ctx; return;
    }
    if (Router.view && Router.view.leave) Router.view.leave();
    var V = VIEWS[name] || VIEWS._404;
    // Trang vừa rời đi: trang mục lục dùng để mở sẵn chương và đánh dấu điều người dùng đang đọc
    Router.prev = Router.cur;
    Router.cur = ctx;
    // Đường dẫn chuẩn theo trang đang xem (trình duyệt dùng khi chia sẻ trang)
    var can = $('link[rel="canonical"]'); if (can) can.href = abs(ctx.key || './');
    Router.view = null;
    setNav(V.nav || name || 'home');
    // Mỗi trang được vẽ trong một vùng chứa mới để không giữ lại trình nghe sự kiện cũ
    var host = document.createElement('div');
    var first = !Router.booted;
    if (!first) host.className = 'pg-in';
    main.innerHTML = ''; main.appendChild(host);
    var res = V.render(ctx, host);
    var view = Router.view = (res && typeof res === 'object' && !res.then) ? res : V;
    Router.booted = true;
    var pos = back ? Router.pos[ctx.full] : null;
    var restore = function () {
      if (Router.view !== view) return;
      if (!(first && !ctx.q.get('k'))) {
        if (pos != null) window.scrollTo(0, pos);
        else if (!view.keepScroll) window.scrollTo(0, 0);
      }
      Bars.reset();
    };
    // Quay lại một trang có nội dung tải sau (điều luật, kết quả tìm kiếm): đợi nội dung xong mới về đúng vị trí cũ —
    // khôi phục sớm khi trang còn ngắn sẽ làm vị trí bị cắt cụt rồi lệch hẳn khi nội dung chèn vào
    if (res && res.then) res.then(restore);
    else if (pos != null && view.ready && view.ready.then) { if (!view.keepScroll) window.scrollTo(0, 0); view.ready.then(restore, restore); }
    else restore();
    if (!isTouch && !back && main.focus) main.focus({ preventScroll: true });
    if (name === 'dieu' || name === 'chuong') Jump.warm();
  }

  /* =========================================================================
     9. Các trang
     ========================================================================= */
  function artCard(a, extra) {
    var k = Pen.maxOf(a);
    return '<a class="pa" href="dieu-' + a.id + '"><span class="pn">Điều ' + esc(a.id) + '</span><h3>' + esc(a.t) + '</h3>' +
      '<span class="pm">' + (k ? '<span class="tag tag--c' + k.c + '">' + esc(Pen.maxText(a).replace('Cao nhất: ', '')) + '</span>' : '<span class="tag tag--soft">' + esc(a.ch.label) + '</span>') +
      artTags(a, true) + (extra || '') + '</span></a>';
  }
  function artTags(a, short) {
    var t = '';
    if (a.rep) t += '<span class="tag tag--rep">Đã bãi bỏ</span>';
    if (a.r26) t += '<span class="tag tag--rep26">' + (short ? 'Bãi bỏ 2026' : CH_NOTE[a.ch.id].short) + '</span>';
    if (a.n25) t += '<span class="tag tag--new">' + (short ? 'Sửa đổi 2025' : 'Sửa đổi, bổ sung 2025') + '</span>';
    if (a.am && !short) t += '<span class="tag tag--am" title="Điều luật có khoản, điểm gắn dấu (*) – đã được sửa đổi, bổ sung">Có sửa đổi (*)</span>';
    return t;
  }
  function drum() { return '<div class="hero-bg" aria-hidden="true"><div class="hero-drum"></div></div>'; }
  function crumb(list) {
    return '<nav class="crumb" aria-label="Đường dẫn">' + list.map(function (x, i) {
      return (i ? ic('chev-r') : '') + (x[1] ? '<a href="' + x[1] + '">' + esc(x[0]) + '</a>' : '<span aria-current="page">' + esc(x[0]) + '</span>');
    }).join('') + '</nav>';
  }

  /* ---------- Trang chủ ---------- */
  VIEWS[''] = {
    nav: 'home',
    render: function (ctx, main) {
      setTitle('');
      var st = DB.toc.stats;
      var p2 = DB.chaps.filter(function (c) { return c.part === 'p2'; });
      var p1 = DB.chaps.filter(function (c) { return c.part !== 'p2'; });
      var hist = Hist.list().slice(0, 10).map(function (h) { return DB.byId[h.id]; }).filter(Boolean);
      var nCm = DB.arts.filter(function (a) { return a.M.ln && a.M.ln[1] > 0; }).length;
      main.innerHTML =
        '<section class="hero">' + drum() + '<div class="wrap hero-grid">' +
        '<div><span class="eyebrow">Bộ luật số 100/2015/QH13 · cập nhật 2025</span>' +
        '<h1>Tra cứu <em>Bộ luật Hình sự</em> <br>nhanh, chính xác, dễ&nbsp;hiểu</h1>' +
        '<p class="hero-sub">Toàn văn ' + st.arts + ' điều luật kèm bình luận khoa học, khung hình phạt từng khoản, phân loại tội phạm và thời hiệu — tìm được cả khi gõ không dấu.</p>' +
        '<div id="heroSearch"></div>' +
        '<div class="hero-try"><span>Thử tìm:</span>' +
        ['Điều 173', 'lừa đảo qua mạng', 'khoản 2 điều 134', 'đồng phạm', 'say rượu lái xe', '"tái phạm nguy hiểm"'].map(function (x) {
          return '<button type="button" data-try="' + esc(x) + '">' + esc(x) + '</button>';
        }).join('') + '</div></div>' +
        '<aside class="intent" aria-label="Lối tắt theo nhu cầu"><h2>Bạn đang cần gì?</h2><p>Chọn nhanh theo tình huống nghiên cứu</p>' +
        [['tim-kiem', 'search', 'Tra tội danh theo hành vi', 'Mô tả hành vi, ví dụ: “vay tiền không trả”'],
          ['cong-cu-thoi-hieu', 'clock', 'Phân loại tội & tính thời hiệu', 'Theo Điều 9, Điều 27, Điều 28'],
          ['cong-cu-tuoi', 'user', 'Kiểm tra tuổi chịu TNHS', 'Tính tuổi chính xác theo Điều 12'],
          ['cong-cu-so-sanh', 'columns', 'So sánh hai tội danh', 'Đối chiếu dấu hiệu & khung hình phạt']].map(function (x) {
          return '<a href="' + x[0] + '"' + (x[0] === 'tim-kiem' ? ' data-act="focus-hero"' : '') + '><span class="ii">' + ic(x[1]) + '</span><span><b>' + x[2] + '</b><small>' + x[3] + '</small></span><span class="go">' + ic('chev-r') + '</span></a>';
        }).join('') + '</aside></div></section>' +

        '<div class="wrap stats"><div class="stats-in">' +
        stat('book', st.arts, 'điều luật', 'gồm Điều 217a, 256a') +
        stat('list', st.chapters, 'chương', '3 phần · ' + DB.chaps.reduce(function (s, c) { return s + c.muc.length; }, 0) + ' mục') +
        stat('spark', st.n25, 'điều sửa đổi', 'theo Luật số 86/2025/QH15') +
        stat('note', nCm, 'điều có bình luận', 'phân tích khoa học kèm theo') + '</div></div>' +

        (hist.length ? '<section class="wrap sec"><div class="sec-h"><div><h2>Tiếp tục đọc</h2><p>Các điều bạn xem gần đây trên thiết bị này</p></div><a class="more" href="da-luu?tab=lich-su">Lịch sử ' + ic('chev-r') + '</a></div>' +
          '<div class="recent">' + hist.map(function (a) { return '<a href="dieu-' + a.id + '"><b>Điều ' + esc(a.id) + '</b><span>' + esc(a.t) + '</span></a>'; }).join('') + '</div></section>' : '') +

        '<section class="wrap sec"><div class="sec-h"><div><span class="eyebrow">Phần thứ hai</span><h2>Tra cứu theo nhóm tội phạm</h2><p>14 chương, từ an ninh quốc gia đến tội phạm chiến tranh</p></div><a class="more" href="muc-luc">Toàn bộ mục lục ' + ic('chev-r') + '</a></div>' +
        '<div class="groups">' + p2.map(function (c) {
          return '<a class="grp" href="chuong-' + c.slug + '"><span class="gi">' + ic(ICONS[c.id]) + '</span><span><span class="gn">' + esc(c.label) + '</span><h3>' + esc(c.name) + '</h3><span class="gm">' + c.arts.length + ' điều · Điều ' + c.first.id + ' – ' + c.last.id + '</span></span></a>';
        }).join('') +
        '<a class="grp grp--more" href="cong-cu-khung-hinh-phat"><span class="gi">' + ic('table') + '</span><span><span class="gn">Tra nhanh</span><h3>Bảng khung hình phạt của mọi tội danh</h3><span class="gm">Lọc theo tử hình, chung thân, độ tuổi</span></span></a>' +
        '<a class="grp grp--more" href="muc-luc"><span class="gi">' + ic('list') + '</span><span><span class="gn">Toàn bộ</span><h3>Mục lục ' + DB.arts.length + ' điều luật</h3><span class="gm">Lọc tức thì theo tên hoặc số điều</span></span></a>' +
        '</div></section>' +

        '<section class="wrap sec"><div class="sec-h"><div><h2>Thường được tra cứu</h2><p>Những tội danh phổ biến trong thực tiễn tố tụng</p></div></div>' +
        '<div class="pop-grid">' + POPULAR.map(function (id) { return DB.byId[id] ? artCard(DB.byId[id]) : ''; }).join('') + '</div></section>' +

        '<section class="wrap sec"><div class="sec-h"><div><span class="eyebrow">Phần thứ nhất & thứ ba</span><h2>Những quy định chung</h2><p>Nguyên tắc, hình phạt, quyết định hình phạt, thời hiệu, xóa án tích…</p></div></div>' +
        '<div class="gen">' + p1.map(function (c) {
          return '<a href="chuong-' + c.slug + '"><span class="gr">' + esc(c.num || '—') + '</span><span class="gt">' + esc(c.name) + (CH_NOTE[c.id] ? ' <span class="tag tag--rep26">' + CH_NOTE[c.id].short + '</span>' : '') + '</span><span class="gc">Đ.' + c.first.id + (c.first !== c.last ? '–' + c.last.id : '') + '</span></a>';
        }).join('') + '</div></section>' +

        '<section class="wrap sec"><div class="sec-h"><div><h2>Công cụ hỗ trợ nghiên cứu</h2><p>Tính toán tự động từ chính văn bản điều luật</p></div><a class="more" href="cong-cu">Tất cả công cụ ' + ic('chev-r') + '</a></div>' +
        toolCards() + '</section>' +

        '<section class="wrap sec"><div class="law-info">' +
        '<div class="li-card"><h3>' + ic('scale') + 'Thông tin văn bản</h3><dl>' +
        liRow('Số hiệu', 'Bộ luật Hình sự số 100/2015/QH13') +
        liRow('Ngày thông qua', '27/11/2015 (Quốc hội khóa XIII, kỳ họp thứ 10)') +
        liRow('Hiệu lực thi hành', '01/01/2018') +
        liRow('Sửa đổi, bổ sung', 'Luật số 12/2017/QH14 · Luật số 59/2024/QH15 · Luật số 86/2025/QH15 (hiệu lực 01/7/2025)') +
        liRow('Tình trạng', '<span class="ok">Còn hiệu lực</span> — Chương XII đã bãi bỏ từ 01/01/2026') +
        '</dl></div>' +
        '<div class="li-card"><h3>' + ic('info') + 'Lưu ý khi sử dụng</h3>' +
        '<p class="muted" style="font-size:.93rem;line-height:1.65">Văn bản điều luật cập nhật đến Luật số 86/2025/QH15. Phần bình luận là tài liệu khoa học tham khảo, không phải văn bản quy phạm pháp luật. Các chỉ dẫn tự động (loại tội, thời hiệu, khung hình phạt) được tính từ câu chữ điều luật để hỗ trợ nghiên cứu; khi áp dụng cho vụ việc cụ thể cần đối chiếu văn bản gốc và hướng dẫn hiện hành.</p>' +
        '<p style="margin-top:14px"><a class="btn btn--sm" href="gioi-thieu">' + ic('info') + 'Nguồn dữ liệu & phương pháp</a></p></div>' +
        '</div></section>' +
        ctaBlock();
      SearchBox($('#heroSearch'), { lg: true, ph: 'Nhập số điều, tên tội hoặc từ khóa…' });
      // Hoa văn trống đồng chỉ quay khi phần đầu trang còn trong màn hình (đỡ tốn pin, cuộn mượt hơn trên máy yếu)
      var hero = $('.hero', main), io = window.IntersectionObserver && new IntersectionObserver(function (es) { hero.classList.toggle('is-off', !es[0].isIntersecting); });
      if (io) io.observe(hero);
      return { leave: function () { if (io) io.disconnect(); } };
    }
  };
  function stat(i, n, t, s) { return '<div class="stat"><span class="si">' + ic(i) + '</span><span><b>' + n + '</b><span>' + t + '<br>' + s + '</span></span></div>'; }
  function liRow(k, v) { return '<div class="li-row"><dt>' + k + '</dt><dd>' + v + '</dd></div>'; }
  function toolCards() {
    return '<div class="tools-grid">' + [
      ['thoi-hieu', 'clock', 'Phân loại tội & thời hiệu', 'Chọn điều luật và khoản – biết ngay loại tội (Điều 9) và thời hiệu truy cứu (Điều 27, 28).'],
      ['tuoi', 'user', 'Tuổi chịu trách nhiệm hình sự', 'Tính tuổi chính xác tại thời điểm thực hiện hành vi, đối chiếu khoản 2 Điều 12.'],
      ['thi-hanh-an', 'calendar', 'Thời hiệu thi hành bản án', 'Xác định thời hiệu theo hình phạt đã tuyên (Điều 60, 61).'],
      ['so-sanh', 'columns', 'So sánh điều luật', 'Đặt hai điều cạnh nhau để phân biệt dấu hiệu và khung hình phạt.'],
      ['khung-hinh-phat', 'table', 'Bảng khung hình phạt', 'Lọc toàn bộ tội danh theo mức phạt cao nhất, tử hình, chung thân, độ tuổi.']
    ].map(function (x) {
      return '<a class="tl" href="cong-cu-' + x[0] + '"><span class="ti">' + ic(x[1]) + '</span><h3>' + x[2] + '</h3><p>' + x[3] + '</p><span class="lk">Mở công cụ ' + ic('arrow-r') + '</span></a>';
    }).join('') + '</div>';
  }
  function ctaBlock() {
    return '<section class="wrap sec"><div class="cta"><div class="cta-in"><span class="eyebrow">Công ty Luật TNHH Luật Sư Nam</span>' +
      '<h2>Cần luật sư tư vấn, bào chữa trong vụ án hình sự?</h2>' +
      '<p>Trao đổi trực tiếp với luật sư để được đánh giá hồ sơ, xác định tội danh, khung hình phạt và phương án bảo vệ quyền lợi hợp pháp.</p>' +
      '<div class="cta-acts"><a class="btn btn--g" href="tel:0983498499">' + ic('phone') + 'Gọi 0983 498 499</a>' +
      '<a class="btn" href="https://zalo.me/0983498499" target="_blank" rel="noopener">' + ic('chat') + 'Nhắn Zalo</a>' +
      '<a class="btn" href="mailto:luatsunam.hcm@gmail.com">' + ic('mail') + 'Gửi email</a></div></div></div></section>';
  }

  /* ---------- Mục lục ----------
     Trang mục lục hiểu ngữ cảnh:
       - luôn mở từ đầu trang; chương đang đọc (đến từ một điều/chương, hoặc điều đọc gần nhất trên thiết bị) được
         mở sẵn, điều đó được đánh dấu, kèm lối tắt "Xem vị trí" để cuộn tới;
       - nút Quay lại từ một điều → trả về đúng như lúc rời đi (chương đang mở, từ lọc, bộ lọc, vị trí cuộn):
         chương đang mở lưu trong history.state, từ lọc và bộ lọc nằm trên đường dẫn (muc-luc?q=…&loc=…);
       - ô lọc hiểu cú pháp tra nhanh: 173 · khoản 2 điều 134 · chương 16; Enter mở thẳng điều cần tìm. */
  VIEWS['muc-luc'] = {
    nav: 'muc-luc',
    render: function (ctx, main) {
      setTitle('Mục lục ' + DB.arts.length + ' điều');
      var filter = ctx.q.get('loc') || 'all';
      if (['all', 'n25', 'am'].indexOf(filter) < 0) filter = 'all';
      var st = history.state && history.state.toc, restoring = !!st;
      // Ngữ cảnh: điều/chương vừa rời đi; nếu không có thì điều đọc gần nhất trên thiết bị này
      var from = Router.prev, fromArt = null, fromCh = null;
      if (from && from.parts[0] === 'dieu') fromArt = DB.byId[(from.parts[1] || '').toLowerCase()] || null;
      else if (from && from.parts[0] === 'chuong') fromCh = DB.chapterBySlug(from.parts[1] || '');
      var mark = fromArt || DB.byId[(Hist.list()[0] || {}).id] || null;
      var ctxCh = [fromCh, mark && mark.ch].filter(Boolean);
      main.innerHTML =
        '<section class="ph">' + drum() + '<div class="wrap ph-in">' + crumb([['Trang chủ', './'], ['Mục lục']]) +
        '<span class="eyebrow">Cấu trúc Bộ luật</span><h1>Mục lục Bộ luật Hình sự</h1>' +
        '<p>3 phần · 26 chương · ' + DB.arts.length + ' điều. Gõ để lọc tức thì theo số điều hoặc tên điều (có dấu hay không dấu đều được).</p></div></section>' +
        '<div class="toc-bar"><div class="wrap"><div class="sb"><div class="sb-box">' + ic('filter') + '<input class="sb-in" id="tocQ" type="search" placeholder="Lọc mục lục… (vd: tai san, 250, chương 16)" aria-label="Lọc mục lục" enterkeyhint="search" autocomplete="off" spellcheck="false">' +
        '<button type="button" class="sb-clear" id="tocClr" aria-label="Xóa từ lọc" hidden>' + ic('x') + '</button></div></div>' +
        '<div class="toc-open" role="group" aria-label="Bộ lọc">' +
        [['all', 'Tất cả'], ['n25', 'Sửa đổi 2025'], ['am', 'Có dấu (*)']].map(function (x) {
          return '<button type="button" class="chip" data-loc="' + x[0] + '" aria-pressed="' + (filter === x[0]) + '">' + x[1] + '</button>';
        }).join('') +
        '<button type="button" class="chip" data-exp="1">Mở hết</button><button type="button" class="chip" data-exp="0">Thu gọn</button></div></div></div>' +
        '<div class="wrap"><p class="toc-cnt" id="tocCnt" aria-live="polite"></p>' +
        (mark ? '<div class="toc-here" id="tocHere">' + ic('history') + '<a href="dieu-' + mark.id + '"><small>' + (fromArt ? 'Đang đọc' : 'Đọc gần nhất') + '</small>' +
          '<b>Điều ' + esc(mark.id) + '. ' + esc(mark.t) + '</b></a><button type="button" class="btn btn--sm" data-here="1">Xem vị trí' + ic('chev-d') + '</button></div>' : '') +
        '<div id="tocBody"></div></div>';
      var body = $('#tocBody'), q = $('#tocQ'), clr = $('#tocClr'), cnt = $('#tocCnt'), ref = null, hits = [];
      q.value = ctx.q.get('q') || '';
      // Lưu trạng thái vào mục lịch sử hiện tại để nút Quay lại trả về đúng chỗ
      var save = debounce(function () {
        if (Router.view !== view) return;
        var p = new URLSearchParams(), v = q.value.trim();
        if (v) p.set('q', v);
        if (filter !== 'all') p.set('loc', filter);
        var s = p.toString(), open = $$('.tch[open]', body).map(function (d) { return d.dataset.c; });
        history.replaceState({ toc: { open: open } }, '', abs('muc-luc' + (s ? '?' + s : '')));
        Router.cur = parseRoute();
      }, 80);
      // openSet: danh sách chương đang mở cần khôi phục; không có thì tự quyết định theo ngữ cảnh / từ lọc
      var draw = function (openSet) {
        var v = q.value.trim(), r = v ? parseRef(v) : null, chap = null, only = null, num = null, cq = null;
        if (r && r.chap) chap = r.chap;
        else if (r && r.art) { if (r.k) only = r.art; else num = r.art; }
        else if (v) { cq = window.LX.compile(window.LX.parseQuery(v), { prefix: true }); if (cq.empty) cq = null; }
        ref = r && (r.a || r.chap) ? r : null;
        clr.hidden = !v;
        var on = !!(chap || only || num || cq), h = '', nCh = 0;
        hits = [];
        DB.parts.forEach(function (p) {
          var ch = DB.chaps.filter(function (c) { return c.part === p.id; }), ph = '';
          ch.forEach(function (c) {
            if (chap && c !== chap) return;
            var arts = c.arts.filter(function (a) {
              if (filter === 'n25' && !a.n25) return false;
              if (filter === 'am' && !a.am) return false;
              if (only) return a.id === only;
              if (num) return a.id.indexOf(num) === 0;
              if (cq) return cq.test(a.t) || cq.test(c.name);
              return true;
            });
            if (!arts.length) return;
            nCh++; hits = hits.concat(arts);
            var open = openSet ? openSet.indexOf(c.id) > -1 : (on || filter !== 'all' || ctxCh.indexOf(c) > -1);
            var list = '', lastM = null;
            arts.forEach(function (a) {
              if (a.m && a.m !== lastM) { lastM = a.m; var mn = c.muc.filter(function (m) { return m.n === a.m; })[0]; if (mn) list += '<div class="tmuc">' + esc(mn.name) + '</div>'; }
              var me = a === mark;
              list += '<a class="ta' + (a.rep ? ' is-rep' : '') + (me ? ' on' : '') + '" href="' + (ref && ref.a === a ? refHref(ref) : 'dieu-' + a.id) + '" data-id="' + esc(a.id) + '">' +
                '<span class="an">Điều ' + esc(a.id) + '</span><span class="at">' + hl(a.t, cq) + '</span><span class="tags">' + (me ? '<span class="tag tag--now">Vừa đọc</span>' : '') + artTags(a, true) + '</span></a>';
            });
            ph += '<details class="tch" data-c="' + c.id + '"' + (open ? ' open' : '') + '><summary><span class="cn">' + esc(c.num || 'TH') + '</span><span class="ct"><b>' + esc(c.title) + '</b>' +
              '<small>' + c.arts.length + ' điều · Điều ' + c.first.id + ' – ' + c.last.id + (c.muc.length ? ' · ' + c.muc.length + ' mục' : '') + ' · ~' + readMin(c.sz[0]) + ' phút đọc luật' + '</small>' +
              (CH_NOTE[c.id] ? ' <span class="tag tag--rep26">' + CH_NOTE[c.id].short + '</span>' : '') +
              '</span><a class="btn btn--sm btn--ghost" href="chuong-' + c.slug + '">Xem</a>' + ic('chev-d', 'chev') + '</summary><div class="tch-body"><a class="ta ch-open" href="chuong-' + c.slug + '">Xem trang tổng quan ' + esc(c.label) + ' ' + ic('arrow-r') + '</a>' + list + '</div></details>';
          });
          if (ph) h += '<section class="toc-part"><h2><small>' + esc(p.label) + '</small>' + esc(p.name) + '</h2>' + ph + '</section>';
        });
        body.innerHTML = h || '<div class="empty">' + ic('search') + '<h3>Không có điều nào phù hợp</h3><p>Thử từ khóa khác, chọn bộ lọc “Tất cả” hoặc <a href="tim-kiem?q=' + encodeURIComponent(v) + '">tìm trong toàn văn điều luật và bình luận</a>.</p></div>';
        var go1 = ref && ref.a && hits.indexOf(ref.a) > -1 ? refLabel(ref) : hits.length === 1 ? 'Điều ' + hits[0].id : '';
        cnt.textContent = on || filter !== 'all' ? (hits.length ? 'Tìm thấy ' + hits.length + ' điều trong ' + nCh + ' chương' + (go1 ? ' · nhấn Enter để mở ' + go1 : '') : '') : '';
        cnt.hidden = !cnt.textContent;
        if ($('#tocHere')) $('#tocHere').hidden = on || filter !== 'all';
      };
      // Cuộn tới điều đang đọc trong danh sách (mở chương nếu đang thu gọn), tô sáng thoáng qua
      var reveal = function () {
        var row = $('.ta[data-id="' + mark.id + '"]', body);
        if (!row) return;
        var d = row.closest('.tch'); if (d && !d.open) d.open = true;
        row.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
      };
      var view = {
        // Ctrl/⌘+K trên chính trang mục lục: đưa con trỏ vào ô lọc thay vì mở thêm bảng mục lục
        focusFilter: function () { q.focus(); q.select(); }
      };
      q.addEventListener('input', debounce(function () { draw(); save(); }, 120));
      q.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (ref && ref.a && hits.indexOf(ref.a) > -1) go(refHref(ref));
          else if (hits.length === 1) go('dieu-' + hits[0].id);
          else q.blur(); // điện thoại: ẩn bàn phím để xem kết quả
        } else if (e.key === 'Escape' && q.value) {
          e.preventDefault(); e.stopPropagation();
          q.value = ''; draw(); save();
        }
      });
      clr.addEventListener('click', function () { q.value = ''; draw(); save(); q.focus(); });
      // Sự kiện toggle của <details> không nổi bọt → bắt ở pha capture
      body.addEventListener('toggle', save, true);
      main.addEventListener('click', function (e) {
        var b = e.target.closest('[data-loc]');
        if (b) { filter = b.dataset.loc; $$('[data-loc]', main).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); draw(); save(); return; }
        var x = e.target.closest('[data-exp]');
        if (x) $$('.tch', body).forEach(function (d) { d.open = x.dataset.exp === '1'; });
        if (e.target.closest('[data-here]')) reveal();
      });
      draw(restoring ? st.open || [] : null);
      save(); // ghi ngay trạng thái ban đầu: Quay lại về trang này luôn khôi phục đúng như khi rời đi
      return view;
    }
  };
  function hl(text, cq) {
    if (!cq) return esc(text);
    var sp = cq.find(text), out = '', last = 0;
    sp.forEach(function (s) { out += esc(text.slice(last, s[0])) + '<mark>' + esc(text.slice(s[0], s[1])) + '</mark>'; last = s[1]; });
    return out + esc(text.slice(last));
  }

  /* ---------- Trang chương ---------- */
  VIEWS['chuong'] = {
    nav: 'muc-luc',
    render: function (ctx, main) {
      var c = DB.chapterBySlug(ctx.parts[1] || '');
      if (!c) return VIEWS._404.render(ctx, main);
      setTitle(c.title);
      var i = DB.chaps.indexOf(c), prev = DB.chaps[i - 1], next = DB.chaps[i + 1];
      var lawMin = readMin(c.sz[0]), cmMin = readMin(c.sz[1]);
      var pens = c.arts.map(function (a) { return Pen.maxOf(a); }).filter(Boolean);
      var nTH = pens.filter(function (k) { return k.th; }).length;
      var list = '', lastM = null;
      c.arts.forEach(function (a) {
        if (a.m && a.m !== lastM) { lastM = a.m; var mn = c.muc.filter(function (m) { return m.n === a.m; })[0]; if (mn) list += '<h2 class="muc-h">' + esc(mn.name) + '</h2>'; }
        var k = Pen.maxOf(a);
        list += '<a class="ca" href="dieu-' + a.id + '"><span class="cn"><small>Điều</small><b>' + esc(a.id) + '</b></span><h3>' + esc(a.t) + '</h3>' +
          '<p>' + esc(a.M.ex || '') + '</p><span class="cm">' + (k ? '<span class="tag tag--c' + k.c + '">' + esc(Pen.maxText(a)) + '</span>' : '') + artTags(a, true) +
          (a.M.a14 ? '<span class="tag tag--a14">Từ đủ 14 tuổi chịu TNHS</span>' : '') + '</span></a>';
      });
      main.innerHTML =
        '<section class="ph">' + drum() + '<div class="wrap ph-in">' + crumb([['Trang chủ', './'], ['Mục lục', 'muc-luc'], [c.label]]) +
        '<span class="eyebrow">' + esc(DB.partName(c.part)) + '</span><h1>' + esc(c.title) + '</h1>' +
        '<div class="ph-meta"><span>' + ic('book') + c.arts.length + ' điều (Điều ' + c.first.id + ' – ' + c.last.id + ')</span>' +
        '<span>' + ic('clock') + '~' + lawMin + ' phút đọc luật · ~' + cmMin + ' phút bình luận</span>' +
        (nTH ? '<span>' + ic('alert') + nTH + ' điều có khung tử hình</span>' : '') + '</div>' +
        '<div class="ph-acts"><a class="btn btn--g" href="dieu-' + c.first.id + '">' + ic('book') + 'Đọc từ Điều ' + c.first.id + '</a>' +
        (prev ? '<a class="btn" href="chuong-' + prev.slug + '">' + ic('chev-l') + esc(prev.label) + '</a>' : '') +
        (next ? '<a class="btn" href="chuong-' + next.slug + '">' + esc(next.label) + ic('chev-r') + '</a>' : '') + '</div></div></section>' +
        '<div class="wrap page">' + (CH_NOTE[c.id] ? '<div class="callout callout--warn" style="margin-bottom:18px">' + ic('alert') + '<div><b>Lưu ý hiệu lực:</b> ' + esc(CH_NOTE[c.id].text) + '</div></div>' : '') +
        '<div class="chap-list">' + list + '</div></div>';
      return null;
    }
  };

  /* ---------- Trang điều luật ---------- */
  function lawHtml(a, d) {
    var M = a.M, ks = {}, fnMap = {}, fnN = 0;
    (M.k || []).forEach(function (k) { ks[k.n] = k; });
    var groups = [], g = null;
    d.law.forEach(function (p) {
      var kind = p[0], h = p[1];
      if (kind === 'k' || kind === 'h' || !g) { g = { n: null, items: [] }; groups.push(g); }
      if (kind === 'k') { var m = plain(h).match(/^(\d{1,2})\./); if (m) g.n = m[1]; }
      g.items.push(p);
    });
    var html = groups.map(function (gr) {
      var kn = gr.n, inner = gr.items.map(function (p) {
        var kind = p[0], h = fixHtml(p[1], fnMap, function () { return ++fnN; });
        if (kind === 'k') {
          h = h.replace(/^(\d{1,2})\.\s*/, '<a class="kn" href="dieu-' + a.id + '?k=$1" data-k="$1" title="Liên kết tới khoản $1">$1.</a> ');
          return '<p class="lk">' + h + '</p>';
        }
        if (kind === 'p') {
          var lm = plain(p[1]).match(/^([a-zđ])\)/), lid = lm ? (lm[1] === 'đ' ? 'dd' : lm[1]) : '';
          h = h.replace(/^([a-zđ])\)\s*/, '<b class="pl">$1)</b> ');
          return '<p class="lp"' + (kn && lid ? ' id="k' + kn + '-' + lid + '"' : '') + '>' + h + '</p>';
        }
        if (kind === 'h') return '<p class="lh">' + h + '</p>';
        return '<p class="lx">' + h + '</p>';
      }).join('');
      var kp = '';
      var key = kn != null ? kn : (!groups.some(function (x) { return x.n; }) ? '' : null);
      if (key != null && ks[key]) kp = '<div class="kpen">' + Pen.tags(a, ks[key]) + '</div>';
      var act = kn ? '<div class="kact"><button type="button" data-cite="' + kn + '" title="Sao chép trích dẫn khoản ' + kn + '" aria-label="Sao chép trích dẫn khoản ' + kn + '">' + ic('copy') + '</button>' +
        '<button type="button" data-klink="' + kn + '" title="Sao chép liên kết tới khoản ' + kn + '" aria-label="Sao chép liên kết khoản ' + kn + '">' + ic('link') + '</button></div>' : '';
      // Đặt nhãn khung hình phạt ngay sau câu dẫn của khoản, trước danh sách các điểm
      if (kp) { var cut = inner.indexOf('</p>') + 4; inner = inner.slice(0, cut) + kp + inner.slice(cut); }
      return '<div class="kh"' + (kn ? ' id="k' + kn + '" data-k="' + kn + '"' : '') + '>' + inner + act + '</div>';
    }).join('');
    return { html: html, fnMap: fnMap };
  }
  // Chuẩn hoá HTML nguồn: liên kết chéo, dấu (*), chú thích đánh số lại theo từng điều
  function fixHtml(h, fnMap, next) {
    h = h.replace(/href="#d(\w+)"/g, 'href="dieu-$1" data-pv="$1"');
    h = h.replace(/<sup class="fn" data-fn="(\d+)">\d+<\/sup>/g, function (_, n) {
      if (!fnMap[n]) fnMap[n] = next();
      return '<sup class="fn" data-fn="' + n + '" role="button" tabindex="0" aria-label="Chú thích ' + fnMap[n] + '">' + fnMap[n] + '</sup>';
    });
    h = h.replace(/\s*\*((?:\s|<\/[a-z]+>)*)$/, '<sup class="am" title="Được sửa đổi, bổ sung (đánh dấu * trong tài liệu gốc)">*</sup>$1');
    return h;
  }
  function cmHtml(a, d, fnMap, fnN) {
    var n = fnN, out = [], toc = [];
    d.cm.forEach(function (p, i) {
      var kind = p[0], h = fixHtml(p[1], fnMap, function () { return ++n; });
      if (kind === 'h') { toc.push([i, plain(p[1])]); out.push('<h3 class="ch" id="cm' + i + '">' + h + '</h3>'); }
      else if (kind === 's') out.push('<p class="cs">' + h + '</p>');
      else if (kind === 'b') out.push('<p class="cb">' + h + '</p>');
      else if (kind === 'q') out.push('<blockquote class="cq">' + h + '</blockquote>');
      else if (kind === 'n') out.push('<div class="callout callout--new cn">' + ic('spark') + '<div>' + h + '</div></div>');
      else out.push('<p>' + h + '</p>');
    });
    return { html: out.join(''), toc: toc };
  }
  function fnListHtml(a, d, fnMap) {
    var keys = Object.keys(fnMap);
    if (!keys.length || !d.fn) return '';
    keys.sort(function (x, y) { return fnMap[x] - fnMap[y]; });
    return '<div class="fn-list"><b>Chú thích</b><ol>' + keys.map(function (k) { return '<li>' + esc(d.fn[k] || '') + '</li>'; }).join('') + '</ol></div>';
  }
  function citeText(a, kn, pt) {
    return (pt ? 'Điểm ' + pt + ' khoản ' + kn + ' ' : kn ? 'Khoản ' + kn + ' ' : '') + 'Điều ' + a.id + ' ' + CITE;
  }

  VIEWS['dieu'] = {
    nav: 'muc-luc',
    render: function (ctx, main) {
      var id = (ctx.parts[1] || '').toLowerCase(), a = DB.byId[id];
      if (!a) return VIEWS._404.render(ctx, main, 'Bộ luật Hình sự không có Điều ' + id + '.');
      var view = new ArticleView(a, ctx, main);
      return view;
    }
  };

  function ArticleView(a, ctx, main) {
    this.a = a; this.main = main; this.keepScroll = !!ctx.q.get('k');
    setTitle('Điều ' + a.id + '. ' + a.t);
    Hist.push(a.id);
    var c = a.ch, i = a.i, prev = DB.arts[i - 1], next = DB.arts[i + 1];
    var M = a.M, hasPen = (M.k || []).some(function (k) { return !k.bs; });
    var muc = a.m ? (c.muc.filter(function (m) { return m.n === a.m; })[0] || {}).name : null;
    var tab = ctx.parts[2] || 'noi-dung';
    var relN = (M.ol || []).length + (M.in || []).length + (M.oc || []).length;
    var hasCm = M.ln && M.ln[1] > 0;
    this.tab = tab;
    main.innerHTML =
      '<div class="wrap"><div class="reader">' +
      '<aside class="side" aria-label="Mục lục điều luật"><div class="side-h"><input class="inp" id="sideQ" type="search" placeholder="Lọc nhanh điều luật…" aria-label="Lọc mục lục">' +
      '<a class="side-all" href="muc-luc" data-act="jump" aria-haspopup="dialog" title="Mở mục lục đầy đủ (Ctrl+K)" aria-label="Mở mục lục đầy đủ">' + ic('olist') + '</a></div><div class="side-b" id="sideB"></div></aside>' +
      '<article class="art" id="art">' +
      '<header class="art-h">' + crumb([['Trang chủ', './'], [c.label, 'chuong-' + c.slug], ['Điều ' + a.id]]) +
      '<div class="art-tags"><span class="tag tag--soft">' + esc(DB.partName(c.part).split(':')[0]) + '</span><a class="tag tag--soft" href="chuong-' + c.slug + '">' + esc(c.label) + '</a>' + artTags(a) + (M.a14 ? '<span class="tag tag--a14" title="Người từ đủ 14 đến dưới 16 tuổi chịu TNHS ở khung rất nghiêm trọng, đặc biệt nghiêm trọng">Từ đủ 14 tuổi chịu TNHS (khoản 2 Điều 12)</span>' : '') + '</div>' +
      '<h1><span class="dn">Điều ' + esc(a.id) + '.</span> ' + esc(a.t) + '</h1>' +
      '<div class="art-sum"><span>' + ic(ICONS[c.id] || 'book') + esc(c.name) + '</span>' + (muc ? '<span>' + ic('list') + esc(muc) + '</span>' : '') +
      '<span class="rt">' + ic('clock') + '~' + readMin(M.ln ? M.ln[0] : 0) + ' phút đọc' + (hasCm ? ' · bình luận ~' + readMin(M.ln[1]) + ' phút' : '') + '</span>' +
      (hasPen ? '<span>' + ic('scale') + esc(Pen.maxText(a)) + '</span>' : '') + '</div>' +
      '<div class="tools no-print">' +
      '<button type="button" class="btn btn--p" data-act="save" aria-pressed="' + Saved.has(a.id) + '">' + ic(Saved.has(a.id) ? 'bookmark-fill' : 'bookmark') + '<span>' + (Saved.has(a.id) ? 'Đã lưu' : 'Lưu điều này') + '</span></button>' +
      '<button type="button" class="btn" data-act="copy-art" title="Sao chép toàn văn điều luật">' + ic('copy') + '<span>Sao chép</span></button>' +
      '<button type="button" class="btn" data-act="share" title="Chia sẻ">' + ic('share') + '<span>Chia sẻ</span></button>' +
      '<a class="btn" href="cong-cu-so-sanh?a=' + a.id + '" title="So sánh với điều khác">' + ic('columns') + '<span>So sánh</span></a>' +
      '<button type="button" class="btn btn--ic" data-act="print" title="In điều luật" aria-label="In điều luật">' + ic('print') + '</button>' +
      '<button type="button" class="btn btn--ic" data-act="settings" title="Công cụ đọc: cỡ chữ, kiểu chữ, sáng/tối" aria-label="Công cụ đọc" aria-haspopup="dialog">' + ic('text') + '</button>' +
      '</div></header>' +
      '<div class="tabs" role="tablist" aria-label="Nội dung điều luật">' +
      tabBtn('noi-dung', '<span class="tl-l">Nội dung điều luật</span><span class="tl-s">Điều luật</span>', null, tab) +
      (hasCm ? tabBtn('binh-luan', 'Bình luận', readMin(M.ln[1]) + ' phút', tab) : '') +
      tabBtn('lien-quan', 'Liên quan', relN || null, tab) + '</div>' +
      '<div id="panels"><div class="panel"><div class="skel" style="width:60%"></div><div class="skel"></div><div class="skel" style="width:85%"></div><div class="skel"></div></div></div>' +
      '<nav class="pager no-print" aria-label="Điều trước, điều sau">' +
      (prev ? '<a href="dieu-' + prev.id + '" rel="prev"><small>' + ic('chev-l') + 'Điều trước</small><span>Điều ' + esc(prev.id) + '. ' + esc(prev.t) + '</span></a>' : '<span></span>') +
      '<a class="pg-all" href="muc-luc" data-act="jump" aria-haspopup="dialog">' + ic('olist') + '<span>Mục lục</span></a>' +
      (next ? '<a class="nx" href="dieu-' + next.id + '" rel="next"><small>Điều sau' + ic('chev-r') + '</small><span>Điều ' + esc(next.id) + '. ' + esc(next.t) + '</span></a>' : '') +
      '</nav></article>' +
      '<aside class="rail" id="rail" aria-label="Thông tin bổ trợ"></aside>' +
      '</div></div>';
    this.side();
    var self = this;
    this.ready = DB.article(a.id).then(function (d) {
      if (Router.view !== self && Router.view != null) return;
      self.d = d;
      self.build(ctx);
    }).catch(function () {
      $('#panels').innerHTML = '<div class="callout callout--warn">' + ic('alert') + '<div>Không tải được nội dung điều luật. Vui lòng kiểm tra kết nối mạng và <a href="javascript:location.reload()">tải lại trang</a>.</div></div>';
    });
    this.onKey = function (e) {
      if (Jump.isOpen || e.target.closest('input,textarea,select,[contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft' && prev) go('dieu-' + prev.id);
      if (e.key === 'ArrowRight' && next) go('dieu-' + next.id);
    };
    document.addEventListener('keydown', this.onKey);
    // Thanh tiến độ đọc: cập nhật tối đa một lần mỗi khung hình
    var bar = $('#progress'), pending = false;
    this.onScroll = function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        var el = $('#art'); if (!el) return;
        var r = el.getBoundingClientRect(), total = r.height - window.innerHeight + 120;
        var p = total > 0 ? Math.min(1, Math.max(0, (-r.top + 80) / total)) : 0;
        bar.style.width = (p * 100) + '%';
      });
    };
    window.addEventListener('scroll', this.onScroll, { passive: true });
  }
  function tabBtn(key, label, cnt, cur) {
    return '<button type="button" role="tab" id="tab-' + key + '" data-tab="' + key + '" aria-controls="p-' + key + '" aria-selected="' + (cur === key) + '">' + label + (cnt ? '<span class="cnt">' + cnt + '</span>' : '') + '</button>';
  }
  ArticleView.prototype.leave = function () {
    if (this.spy) this.spy.disconnect();
    if (this.mq) { if (this.mq.removeEventListener) this.mq.removeEventListener('change', this.onMq); else this.mq.removeListener(this.onMq); }
    document.removeEventListener('keydown', this.onKey);
    window.removeEventListener('scroll', this.onScroll);
    $('#progress').style.width = '0';
  };
  ArticleView.prototype.side = function () {
    var a = this.a, box = $('#sideB'), q = $('#sideQ'), self = this;
    // Danh sách điều của một chương chỉ dựng khi chương đó được mở (không vẽ sẵn cả 428 liên kết)
    var list = function (arts) {
      return arts.map(function (x) { return '<a href="dieu-' + x.id + '"' + (x === a ? ' class="on" aria-current="page"' : x.rep ? ' class="is-rep"' : '') + '><b>' + esc(x.id) + '</b><span>' + esc(x.t) + '</span></a>'; }).join('');
    };
    var draw = function () {
      var v = q.value.trim(), cq = v ? window.LX.compile(window.LX.parseQuery(v), { prefix: true }) : null;
      var num = /^\d{1,3}[a-z]?$/.test(v) ? v : null, h = '', lastP = null;
      DB.chaps.forEach(function (c) {
        var arts = !v ? c.arts : c.arts.filter(function (x) { return num ? x.id.indexOf(num) === 0 : cq.test(x.t); });
        if (!arts.length) return;
        if (c.part !== lastP) { lastP = c.part; h += '<div class="sp">' + esc((DB.parts.filter(function (p) { return p.id === c.part; })[0] || {}).label || '') + '</div>'; }
        var open = c === a.ch || !!v;
        h += '<div class="sc' + (open ? ' open' : '') + '" data-c="' + c.id + '"><button type="button" aria-expanded="' + open + '">' + ic('chev-r') + '<span class="r">' + esc(c.num || 'TH') + '</span><span>' + esc(c.name) + '</span></button><div class="sc-l">' +
          (open ? list(arts) : '') + '</div></div>';
      });
      box.innerHTML = h;
    };
    q.addEventListener('input', debounce(draw, 120));
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.sc>button'); if (!b) return;
      var sc = b.parentNode, l = $('.sc-l', sc); sc.classList.toggle('open'); b.setAttribute('aria-expanded', String(sc.classList.contains('open')));
      if (sc.classList.contains('open') && !l.firstChild) l.innerHTML = list(DB.chapById[sc.dataset.c].arts);
    });
    // Cột mục lục chỉ hiện trên màn hình từ 1024px: điện thoại, máy tính bảng dọc không cần dựng
    var mq = window.matchMedia('(min-width: 1024px)');
    this.onMq = function () {
      if (!mq.matches || self.sideDone) return;
      self.sideDone = true;
      draw();
      var on = $('.sc-l a.on', box);
      if (on) { box.scrollTop = on.offsetTop - box.clientHeight / 2 + 40; }
    };
    this.mq = mq;
    if (mq.addEventListener) mq.addEventListener('change', this.onMq); else mq.addListener(this.onMq);
    this.onMq();
  };
  ArticleView.prototype.build = function (ctx) {
    var a = this.a, d = this.d, M = a.M, self = this;
    var L = lawHtml(a, d);
    var fnN = Object.keys(L.fnMap).length;
    var C = cmHtml(a, d, L.fnMap, fnN);
    this.fnMap = L.fnMap;
    var newNotes = d.cm.filter(function (p) { return p[0] === 'n'; });
    var chNote = CH_NOTE[a.ch.id];
    // Điện thoại, máy tính bảng, máy tính màn hẹp (không có cột phải): biểu đồ khung hình phạt thu gọn thành một dòng để
    // văn bản điều luật hiện ngay; mở ra thì lần sau vẫn mở (ghi nhớ trên thiết bị). Mỗi khoản đã có nhãn khung ngay trong văn bản.
    var nK = (M.k || []).filter(function (k) { return !k.bs; }).length;
    var penCard = nK ? '<details class="rc pen-sum mob-only"' + (Prefs.get().pen ? ' open' : '') + '><summary>' + ic('scale') + '<b>Biểu đồ khung hình phạt</b>' +
      '<span class="ps-n">' + (nK > 1 ? nK + ' khoản' : '1 khung') + '</span>' + ic('chev-d', 'chev') + '</summary><div class="pen-body">' + Pen.chart(a, true) + '</div></details>' : '';
    var law =
      (chNote ? '<div class="callout callout--warn" style="margin-bottom:16px">' + ic('alert') + '<div><b>Lưu ý hiệu lực:</b> ' + esc(chNote.text) + '</div></div>' : '') +
      (a.rep ? '<div class="callout callout--rep" style="margin-bottom:16px">' + ic('info') + '<div><b>Điều luật đã bị bãi bỏ.</b> Nội dung dưới đây được giữ lại để tham khảo.</div></div>' : '') +
      newNotes.map(function (p) { return '<div class="callout callout--new" style="margin-bottom:16px">' + ic('spark') + '<div>' + fixHtml(p[1], L.fnMap, function () { return ++fnN; }) + '</div></div>'; }).join('') +
      penCard +
      '<div class="law-paper"><div class="law" id="lawBody">' + L.html + '</div></div>' +
      (a.am ? '<p class="cm-note" style="margin-top:14px">' + ic('info') + '<span>Khoản, điểm gắn dấu <b>*</b> là nội dung đã được sửa đổi, bổ sung theo luật sửa đổi Bộ luật Hình sự (ghi chú của tài liệu nguồn).</span></p>' : '') +
      fnListHtml(a, d, L.fnMap);
    var cm = d.cm.length ?
      '<p class="cm-note">' + ic('info') + '<span>Bình luận khoa học mang tính học thuật, tham khảo; không phải văn bản quy phạm pháp luật. Nhấn vào “Điều …” để xem nhanh điều được dẫn chiếu.</span></p>' +
      (C.toc.length >= 2 ? '<nav class="cm-toc" aria-label="Mục lục bình luận"><b>Nội dung bình luận</b>' + C.toc.map(function (t) { return '<a href="#" data-scroll="cm' + t[0] + '">' + esc(t[1]) + '</a>'; }).join('') + '</nav>' : '') +
      '<div class="cm">' + C.html + '</div>' + fnListHtml(a, d, L.fnMap) : '';
    var rel = this.relHtml();
    $('#panels').innerHTML =
      '<div class="panel" role="tabpanel" id="p-noi-dung" aria-labelledby="tab-noi-dung">' + law + '</div>' +
      (cm ? '<div class="panel" role="tabpanel" id="p-binh-luan" aria-labelledby="tab-binh-luan" hidden>' + cm + '</div>' : '') +
      '<div class="panel" role="tabpanel" id="p-lien-quan" aria-labelledby="tab-lien-quan" hidden>' + rel + '</div>';
    this.rail();
    var ps = $('#panels .pen-sum');
    if (ps) ps.addEventListener('toggle', function () { var p = Prefs.get(); p.pen = ps.open ? 1 : 0; Store.set('prefs', p); });
    this.show(ctx.parts[2] || 'noi-dung', true);
    var q = ctx.q.get('q');
    if (q) this.highlight(q);
    var k = ctx.q.get('k');
    if (k) setTimeout(function () { self.focusK(k, ctx.q.get('d')); }, 30);
    $('.tabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]'); if (!b) return;
      var t = b.dataset.tab;
      history.replaceState(null, '', abs('dieu-' + a.id + (t === 'noi-dung' ? '' : '?tab=' + t)));
      Router.cur = parseRoute();
      self.show(t);
    });
    $('.tabs').addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var bs = $$('.tabs [data-tab]'), i = bs.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault(); e.stopPropagation();
      var n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length]; n.focus(); n.click();
    });
  };
  ArticleView.prototype.show = function (t, first) {
    if (!$('#p-' + t)) t = 'noi-dung';
    this.tab = t;
    $$('.tabs [data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === t)); b.tabIndex = b.dataset.tab === t ? 0 : -1; });
    $$('#panels .panel').forEach(function (p) { p.hidden = p.id !== 'p-' + t; });
    if (!first) {
      var tabs = $('.tabs'), top = tabs.getBoundingClientRect().top + window.scrollY - parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hd-h'), 10);
      if (window.scrollY > top) window.scrollTo(0, top);
    }
  };
  ArticleView.prototype.update = function (ctx) {
    if (!this.d) return false;
    this.show(ctx.parts[2] || 'noi-dung');
    var k = ctx.q.get('k');
    if (k) this.focusK(k, ctx.q.get('d'));
    return true;
  };
  ArticleView.prototype.focusK = function (k, pt) {
    this.show('noi-dung', true);
    var el = (pt && $('#k' + k + '-' + (pt === 'đ' ? 'dd' : pt))) || $('#k' + k);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var box = el.classList.contains('kh') ? el : el.closest('.kh') || el;
    box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
  };
  ArticleView.prototype.highlight = function (q) {
    var cq = window.LX.compile(window.LX.parseQuery(q));
    if (cq.empty) return;
    var first = null;
    ['#p-noi-dung .law', '#p-binh-luan .cm'].forEach(function (sel) {
      var root = $(sel); if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), nodes = [], n;
      while ((n = walker.nextNode())) nodes.push(n);
      nodes.forEach(function (node) {
        var t = node.nodeValue, sp = cq.find(t);
        if (!sp.length) return;
        var frag = document.createDocumentFragment(), last = 0;
        sp.forEach(function (s) {
          frag.appendChild(document.createTextNode(t.slice(last, s[0])));
          var m = document.createElement('mark'); m.textContent = t.slice(s[0], s[1]); frag.appendChild(m);
          if (!first) first = { m: m, sel: sel };
          last = s[1];
        });
        frag.appendChild(document.createTextNode(t.slice(last)));
        node.parentNode.replaceChild(frag, node);
      });
    });
    if (first) {
      var self = this;
      var inCm = first.sel.indexOf('binh-luan') > -1 && !$('#p-noi-dung .law mark');
      if (inCm) self.show('binh-luan', true);
      setTimeout(function () { first.m.scrollIntoView({ block: 'center' }); }, 60);
      UI.toast('Đã tô sáng “' + q + '” trong ' + (inCm ? 'phần bình luận' : 'điều luật'));
    }
  };
  ArticleView.prototype.relHtml = function () {
    var a = this.a, M = a.M;
    var sec = function (title, ids) {
      ids = (ids || []).filter(function (id) { return DB.byId[id] && id !== a.id; });
      if (!ids.length) return '';
      return '<section class="rel-sec"><h3>' + title + '</h3><div class="rel-grid">' + ids.map(function (id) { return artCard(DB.byId[id]); }).join('') + '</div></section>';
    };
    var near = [];
    for (var j = -2; j <= 2; j++) { var x = DB.arts[a.i + j]; if (j && x && x.ch === a.ch) near.push(x.id); }
    var gen = a.ch.part === 'p2' ? GENERAL.concat(M.a14 ? ['12'] : []).filter(function (id) { return (M.ol || []).indexOf(id) < 0; }) : [];
    var gq = encodeURIComponent('văn bản hướng dẫn Điều ' + a.id + ' Bộ luật Hình sự 2015 ' + a.t);
    return sec('Điều luật được dẫn chiếu trong văn bản', M.ol) +
      sec('Được viện dẫn tại các điều', M.in) +
      sec('Được phân tích trong phần bình luận', M.oc) +
      sec('Quy định chung thường áp dụng kèm', gen) +
      sec('Các điều lân cận trong ' + a.ch.label, near) +
      '<section class="rel-sec"><h3>Tra cứu thêm</h3><div class="ext">' +
      '<a href="https://www.google.com/search?q=' + gq + '" target="_blank" rel="noopener">' + ic('search') + 'Văn bản hướng dẫn áp dụng' + ic('external') + '</a>' +
      '<a href="https://anle.toaan.gov.vn/" target="_blank" rel="noopener">' + ic('gavel') + 'Án lệ – TAND Tối cao' + ic('external') + '</a>' +
      '<a href="https://congbobanan.toaan.gov.vn/" target="_blank" rel="noopener">' + ic('book') + 'Bản án đã công bố' + ic('external') + '</a>' +
      '<a href="https://vbpl.vn/" target="_blank" rel="noopener">' + ic('landmark') + 'CSDL quốc gia về VBPL' + ic('external') + '</a>' +
      '</div></section>' +
      '<section class="rel-sec mob-only"><h3>Ghi chú của tôi</h3><div class="rc">' + noteBox(a.id, 'm') + '</div></section>';
  };
  function noteBox(id, sfx) {
    var t = Notes.get(id);
    return '<textarea class="inp" data-note="' + esc(id) + '" id="note-' + sfx + '" placeholder="Ghi chú riêng cho Điều ' + esc(id) + ' (chỉ lưu trên thiết bị này)…" aria-label="Ghi chú">' + esc(t) + '</textarea><div class="saved" data-note-st="' + esc(id) + '">' + (t ? 'Đã lưu trên thiết bị' : '') + '</div>';
  }
  ArticleView.prototype.rail = function () {
    var a = this.a, M = a.M;
    var kl = (M.k || []).length ? '<div class="rc"><h3>' + ic('list') + 'Đi tới khoản</h3><div class="kl">' +
      $$('#lawBody .kh[data-k]').map(function (el) {
        var k = el.dataset.k, p = plain(el.querySelector('.lk') ? el.querySelector('.lk').innerHTML : '').replace(/^\d+\.\s*/, '');
        return '<a href="dieu-' + a.id + '?k=' + k + '" data-k="' + k + '"><b>Khoản ' + k + '</b><span>' + esc(p.length > 70 ? p.slice(0, 68) + '…' : p) + '</span></a>';
      }).join('') + '</div></div>' : '';
    var pen = (M.k || []).some(function (k) { return !k.bs; }) ? '<div class="rc"><h3>' + ic('scale') + 'Khung hình phạt</h3>' + Pen.chart(a, true) + '</div>' : '';
    var refs = (M.ol || []).concat(M.in || []).filter(function (x, i, arr) { return arr.indexOf(x) === i && DB.byId[x]; }).slice(0, 8);
    var rl = refs.length ? '<div class="rc"><h3>' + ic('link') + 'Điều luật liên quan</h3><div class="rl">' + refs.map(function (id) {
      var x = DB.byId[id]; return '<a href="dieu-' + id + '" data-pv="' + id + '"><b>Điều ' + esc(id) + '</b><span>' + esc(x.t) + '</span></a>';
    }).join('') + '</div></div>' : '';
    var disp = '<div class="rc rc-disp"><h3>' + ic('text') + 'Hiển thị</h3>' + UI.disp(true) + '</div>';
    $('#rail').innerHTML = disp + pen + kl + rl + '<div class="rc"><h3>' + ic('note') + 'Ghi chú của tôi</h3>' + noteBox(a.id, 'r') + '</div>';
    // Khoản đang nằm ở khoảng 1/3 trên màn hình được tô ở mục "Đi tới khoản" – luôn biết mình đang đọc tới đâu
    if (kl && window.IntersectionObserver && window.matchMedia('(min-width: 1281px)').matches) {
      var links = {}, cur = null;
      $$('#rail .kl a[data-k]').forEach(function (l) { links[l.dataset.k] = l; });
      this.spy = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          var l = links[en.target.dataset.k];
          if (!l || l === cur) return;
          if (cur) cur.classList.remove('on');
          cur = l; l.classList.add('on');
        });
      }, { rootMargin: '-25% 0px -65% 0px' });
      var spy = this.spy;
      $$('#lawBody .kh[data-k]').forEach(function (el) { spy.observe(el); });
    }
  };

  /* ---------- Tìm kiếm toàn văn ---------- */
  VIEWS['tim-kiem'] = {
    nav: 'tim-kiem',
    render: function (ctx, main) {
      var q = (ctx.q.get('q') || '').trim();
      var scope = ctx.q.get('pv') || 'all', chap = ctx.q.get('ch') || '', sort = ctx.q.get('sx') || 'rel';
      setTitle(q ? 'Tìm “' + q + '”' : 'Tìm kiếm');
      main.innerHTML =
        '<section class="ph' + (q ? ' ph--q' : '') + '">' + drum() + '<div class="wrap ph-in">' + crumb([['Trang chủ', './'], ['Tìm kiếm']]) +
        '<h1>Tìm kiếm trong Bộ luật Hình sự</h1><p>Tìm đồng thời trong tên điều, văn bản điều luật và phần bình luận. Gõ không dấu, dùng “ngoặc kép” để tìm cụm từ chính xác.</p>' +
        '<div id="srBox" style="margin-top:18px;max-width:760px"></div></div></section>' +
        '<div class="wrap"><div id="srOut"></div></div>';
      var box = SearchBox($('#srBox'), { value: q, ph: 'Nhập từ khóa, cụm từ hoặc số điều…', onSubmit: function (v) { rememberQ(v); go('tim-kiem?q=' + encodeURIComponent(v)); } });
      if (!q) { box.input.focus(); }
      var out = $('#srOut');
      if (!q) { out.innerHTML = tipsHtml(); return null; }
      rememberQ(q);
      var r = parseRef(q), goCard = '';
      if (r && (r.a || r.chap)) {
        goCard = '<a class="go-card" href="' + refHref(r) + '"><span class="gi">' + ic(r.chap ? 'list' : 'arrow-r') + '</span><span><b>Đi tới ' + esc(refLabel(r)) + '</b><small>' + esc(r.chap ? r.chap.name : r.a.t) + '</small></span><span class="go">' + ic('chev-r') + '</span></a>';
      }
      var fq = ' ' + fold(q).toLowerCase().replace(/\s+/g, ' ').trim() + ' ', sids = [];
      Object.keys(SYN).forEach(function (key) {
        if (fq.indexOf(' ' + key + ' ') > -1) SYN[key].forEach(function (x) { if (sids.indexOf(x) < 0 && DB.byId[x]) sids.push(x); });
      });
      var sugg = sids.length ? '<div class="sugg"><span>' + ic('spark') + ' Tội danh thường gắn với từ khóa này:</span>' + sids.slice(0, 6).map(function (x) {
        return '<a class="chip" href="dieu-' + x + '" data-pv="' + x + '">Điều ' + x + ' · ' + esc(DB.byId[x].t.replace(/^Tội /, '')) + '</a>';
      }).join('') + '</div>' : '';
      out.innerHTML = '<div style="margin-top:22px">' + goCard + sugg + '</div><div class="sr-meta" id="srMeta"><span class="spinner"></span> Đang nạp toàn văn để tìm kiếm…</div><div id="srRes"></div>';
      var onFt = function (t, m) {
        if (t === 'progress' && $('#srMeta') && !FT.ready) $('#srMeta').innerHTML = '<span class="spinner"></span> Đang nạp toàn văn… ' + m.done + '/' + m.total + ' chương';
        if (t === 'error' && $('#srMeta')) $('#srMeta').innerHTML = 'Không tải được dữ liệu tìm kiếm. Vui lòng kiểm tra kết nối mạng.';
      };
      FT.on(onFt);
      var view = { leave: function () { FT.off(onFt); } };
      var t0 = Date.now();
      view.ready = FT.query(q).then(function (res) {
        if (Router.view !== view) return;
        drawResults(res, { q: q, scope: scope, chap: chap, sort: sort, ms: Date.now() - t0 });
      });
      return view;
    }
  };
  function tipsHtml() {
    var ex = [['Số điều', '173', 'đi thẳng tới Điều 173'], ['Khoản, điểm', 'điểm a khoản 2 điều 134', 'mở đúng vị trí trong điều'], ['Không dấu', 'lam dung tin nhiem', 'tự hiểu là “lạm dụng tín nhiệm”'],
      ['Cụm chính xác', '"tái phạm nguy hiểm"', 'các từ phải đứng liền nhau'], ['Theo hành vi', 'vay tiền không trả', 'gợi ý tội danh tương ứng'], ['Chương', 'chương 20', 'mở chương các tội phạm về ma túy']];
    return '<h2 class="muc-h" style="margin-top:28px">Mẹo tìm kiếm</h2><div class="tips">' + ex.map(function (x) {
      return '<div class="tip"><b>' + x[0] + '</b><code data-try="' + esc(x[1]) + '">' + esc(x[1]) + '</code> → ' + x[2] + '</div>';
    }).join('') + '</div>';
  }
  function drawResults(res, o) {
    var all = res.exact.concat(res.loose);
    var cnt = { all: all.length, tt: 0, law: 0, cm: 0 };
    all.forEach(function (r) { if (r.th) cnt.tt++; if (r.lh) cnt.law++; if (r.cm) cnt.cm++; });
    var list = all.filter(function (r) {
      if (o.scope === 'tt' && !r.th) return false;
      if (o.scope === 'law' && !r.lh) return false;
      if (o.scope === 'cm' && !r.cm) return false;
      if (o.chap && DB.byId[r.id].ch.id !== o.chap) return false;
      return true;
    });
    if (o.sort === 'order') list.sort(function (x, y) { return x.o - y.o; });
    var base = 'tim-kiem?q=' + encodeURIComponent(o.q);
    var url = function (k, v) {
      var p = { pv: o.scope, ch: o.chap, sx: o.sort }; p[k] = v;
      return base + (p.pv !== 'all' ? '&pv=' + p.pv : '') + (p.ch ? '&ch=' + p.ch : '') + (p.sx !== 'rel' ? '&sx=' + p.sx : '');
    };
    var chips = [['all', 'Tất cả', cnt.all], ['tt', 'Tên điều', cnt.tt], ['law', 'Điều luật', cnt.law], ['cm', 'Bình luận', cnt.cm]].map(function (x) {
      return '<a class="chip' + (o.scope === x[0] ? ' on' : '') + '" href="' + url('pv', x[0]) + '">' + x[1] + ' <span class="n">' + x[2] + '</span></a>';
    }).join('');
    var chOpts = '<option value="">Mọi chương</option>' + DB.chaps.map(function (c) { return '<option value="' + c.id + '"' + (o.chap === c.id ? ' selected' : '') + '>' + esc(c.label) + ' – ' + esc(c.name.length > 40 ? c.name.slice(0, 38) + '…' : c.name) + '</option>'; }).join('');
    var meta = $('#srMeta');
    if (!meta) return;
    meta.innerHTML = all.length ? 'Tìm thấy <b>' + all.length + '</b> điều có nội dung phù hợp' + (res.loose.length && res.exact.length ? ' (' + res.exact.length + ' điều khớp liền cụm từ)' : '') + ' · ' + Math.max(1, o.ms) + ' ms' : '';
    var pageSize = 25, shown = 0;
    var item = function (r) {
      var a = DB.byId[r.id], href = 'dieu-' + a.id + '?q=' + encodeURIComponent(o.q);
      var sn = r.sn.slice(0, 3).map(function (s) {
        var t = s[2], m = s[3], h = '', last = 0;
        m.forEach(function (x) { h += esc(t.slice(last, x[0])) + '<mark>' + esc(t.slice(x[0], x[1])) + '</mark>'; last = x[1]; });
        h += esc(t.slice(last));
        return '<p class="sn"><i>' + (s[0] === 'l' ? 'Điều luật' : 'Bình luận') + '</i>' + (s[4] ? '…' : '') + h + (s[5] ? '…' : '') + '</p>';
      }).join('');
      var title = r.th ? hl(a.t, window.LX.compile(window.LX.parseQuery(o.q))) : esc(a.t);
      return '<a class="sr" href="' + href + '"><div class="sr-t">' +
        (r.th ? '<span class="ty ty--tt">Tên điều</span>' : '') + (r.lh ? '<span class="ty ty--law">Điều luật</span>' : '') + (r.cm ? '<span class="ty ty--cm">Bình luận</span>' : '') +
        '<span class="where">' + esc(a.ch.label) + ' · ' + esc(a.ch.name) + '</span>' + artTags(a, true) + '</div>' +
        '<h3><b>Điều ' + esc(a.id) + '.</b> ' + title + '</h3>' + sn +
        '<div class="cnts">' + (r.lh ? '<span>' + r.lh + ' đoạn trong điều luật</span>' : '') + (r.cm ? '<span>' + r.cm + ' đoạn trong bình luận</span>' : '') + '</div></a>';
    };
    var html = '<div class="sr-head"><div class="filters" role="group" aria-label="Phạm vi">' + chips + '</div>' +
      '<div class="sel"><select class="inp" id="srCh" aria-label="Lọc theo chương">' + chOpts + '</select>' +
      '<select class="inp" id="srSx" aria-label="Sắp xếp"><option value="rel"' + (o.sort === 'rel' ? ' selected' : '') + '>Liên quan nhất</option><option value="order"' + (o.sort === 'order' ? ' selected' : '') + '>Theo thứ tự điều</option></select></div></div>';
    if (!list.length) {
      html += '<div class="empty">' + ic('search') + '<h3>Không tìm thấy kết quả phù hợp</h3><p>Thử bỏ bớt từ, kiểm tra chính tả, gõ không dấu hoặc chọn “Tất cả”.</p></div>' + tipsHtml();
      $('#srRes').innerHTML = html;
    } else {
      html += '<div class="sr-list" id="srList"></div><div style="text-align:center;margin-top:18px"><button type="button" class="btn" id="srMore" hidden>Xem thêm kết quả</button></div>';
      $('#srRes').innerHTML = html;
      var more = function () {
        $('#srList').insertAdjacentHTML('beforeend', list.slice(shown, shown + pageSize).map(item).join(''));
        shown += pageSize; $('#srMore').hidden = shown >= list.length;
      };
      $('#srMore').addEventListener('click', more);
      more();
    }
    $('#srCh').addEventListener('change', function () { go(url('ch', this.value)); });
    $('#srSx').addEventListener('change', function () { go(url('sx', this.value)); });
  }

  /* ---------- Đã lưu ---------- */
  VIEWS['da-luu'] = {
    nav: 'da-luu',
    render: function (ctx, main) {
      setTitle('Đã lưu');
      var tab = ctx.q.get('tab') || 'luu';
      var saved = Saved.list().filter(function (x) { return DB.byId[x.id]; });
      var notes = Notes.all(), nk = Object.keys(notes).filter(function (id) { return DB.byId[id]; });
      var hist = Hist.list().filter(function (x) { return DB.byId[x.id]; });
      var when = function (t) { var d = new Date(t); return fmtDate(d) + ' ' + d.toTimeString().slice(0, 5); };
      var row = function (id, t, extra, kind) {
        var a = DB.byId[id];
        return '<div class="sv"><a class="t" href="dieu-' + a.id + '"><b>Điều ' + esc(a.id) + ' · ' + esc(a.ch.label) + '</b><span>' + esc(a.t) + '</span>' + (extra || '') + '</a>' +
          '<time>' + when(t) + '</time><button type="button" class="hd-ic sv-rm" data-rm="' + kind + ':' + esc(a.id) + '" aria-label="Xóa">' + ic('trash') + '</button></div>';
      };
      var body;
      if (tab === 'ghi-chu') body = nk.length ? nk.sort(function (x, y) { return notes[y].t - notes[x].t; }).map(function (id) { return row(id, notes[id].t, '<div class="note">' + esc(notes[id].x) + '</div>', 'note'); }).join('') : emptyHtml('note', 'Chưa có ghi chú', 'Mở một điều luật và ghi chú ở khung “Ghi chú của tôi”.');
      else if (tab === 'lich-su') body = hist.length ? hist.map(function (x) { return row(x.id, x.t, '', 'hist'); }).join('') : emptyHtml('history', 'Chưa có lịch sử', 'Các điều bạn đã xem sẽ xuất hiện ở đây.');
      else body = saved.length ? saved.map(function (x) { return row(x.id, x.t, '', 'saved'); }).join('') : emptyHtml('bookmark', 'Chưa lưu điều luật nào', 'Nhấn “Lưu điều này” trên trang điều luật để đánh dấu và đọc lại nhanh.');
      main.innerHTML =
        '<section class="ph">' + drum() + '<div class="wrap ph-in">' + crumb([['Trang chủ', './'], ['Đã lưu']]) +
        '<h1>Đã lưu, ghi chú & lịch sử</h1><p>Dữ liệu chỉ lưu trên trình duyệt của thiết bị này, không gửi đi đâu.</p></div></section>' +
        '<div class="wrap page"><div class="filters">' +
        [['luu', 'Đã lưu', saved.length], ['ghi-chu', 'Ghi chú', nk.length], ['lich-su', 'Lịch sử', hist.length]].map(function (x) {
          return '<a class="chip' + (tab === x[0] ? ' on' : '') + '" href="da-luu' + (x[0] === 'luu' ? '' : '?tab=' + x[0]) + '">' + x[1] + ' <span class="n">' + x[2] + '</span></a>';
        }).join('') +
        (tab === 'ghi-chu' && nk.length ? '<button type="button" class="btn btn--sm" data-act="export-notes" style="margin-left:auto">' + ic('download') + 'Xuất ghi chú (.txt)</button>' : '') +
        (tab === 'lich-su' && hist.length ? '<button type="button" class="btn btn--sm" data-act="clear-hist" style="margin-left:auto">' + ic('trash') + 'Xóa lịch sử</button>' : '') +
        '</div><div class="saved-list">' + body + '</div></div>';
      main.onclick = function (e) {
        var b = e.target.closest('[data-rm]');
        if (b) {
          var p = b.dataset.rm.split(':');
          if (p[0] === 'saved') Saved.toggle(p[1]);
          if (p[0] === 'note') Notes.set(p[1], '');
          if (p[0] === 'hist') Store.set('hist', Hist.list().filter(function (x) { return x.id !== p[1]; }));
          route(); return;
        }
        if (e.target.closest('[data-act="clear-hist"]')) { Store.set('hist', []); route(); }
        if (e.target.closest('[data-act="export-notes"]')) {
          var txt = 'GHI CHÚ – TRA CỨU BỘ LUẬT HÌNH SỰ\n\n' + nk.map(function (id) { return 'Điều ' + id + '. ' + DB.byId[id].t + '\n' + notes[id].x + '\n'; }).join('\n');
          var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' }), u = URL.createObjectURL(blob), l = document.createElement('a');
          l.href = u; l.download = 'ghi-chu-blhs.txt'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
        }
      };
      return { leave: function () { main.onclick = null; } };
    }
  };
  function emptyHtml(i, t, s) { return '<div class="empty">' + ic(i) + '<h3>' + t + '</h3><p>' + s + '</p></div>'; }

  /* ---------- Giới thiệu ---------- */
  VIEWS['gioi-thieu'] = {
    nav: '',
    render: function (ctx, main) {
      setTitle('Giới thiệu & nguồn dữ liệu');
      var st = DB.toc.stats;
      main.innerHTML =
        '<section class="ph">' + drum() + '<div class="wrap ph-in">' + crumb([['Trang chủ', './'], ['Giới thiệu']]) +
        '<h1>Giới thiệu & nguồn dữ liệu</h1><p>Công cụ tra cứu Bộ luật Hình sự do Công ty Luật TNHH Luật Sư Nam xây dựng nhằm phục vụ nghiên cứu, học tập và thực hành pháp luật.</p></div></section>' +
        '<div class="wrap page" style="max-width:900px"><div class="cm" style="font-size:1rem">' +
        '<h3 class="ch" style="margin-top:0">Phạm vi văn bản</h3>' +
        '<p>Bộ luật Hình sự số 100/2015/QH13 được Quốc hội thông qua ngày 27/11/2015, có hiệu lực từ 01/01/2018; được sửa đổi, bổ sung bởi Luật số 12/2017/QH14, Luật số 59/2024/QH15 (Luật Tư pháp người chưa thành niên) và Luật số 86/2025/QH15 (thông qua ngày 25/6/2025, hiệu lực từ 01/7/2025).</p>' +
        '<p>Trang hiện có <b>' + st.arts + ' điều</b> (kể cả Điều 217a, 256a), trong đó <b>' + st.n25 + ' điều</b> được đánh dấu sửa đổi, bổ sung năm 2025 kèm ghi chú “Điểm mới năm 2025”.</p>' +
        '<div class="callout callout--warn" style="margin:16px 0">' + ic('alert') + '<div><b>Chương XII đã bị bãi bỏ.</b> ' + esc(CH_NOTE.c12.text) + '</div></div>' +
        '<h3 class="ch">Nguồn dữ liệu & cách xử lý</h3>' +
        '<p>Văn bản điều luật và phần bình luận được chuyển đổi từ tài liệu “Bình luận khoa học Bộ luật Hình sự” (tệp Word). Trong quá trình chuyển đổi, hệ thống đã sửa một số lỗi đánh máy hiển nhiên theo văn bản chính thức (ví dụ “phạt từ từ 01 năm” tại khoản 1 Điều 348 được sửa thành “phạt tù từ 01 năm”), tách lại các điểm bị dồn dòng (khoản 2 Điều 60).</p>' +
        '<p>Các chỉ dẫn tự động gồm: <b>khung hình phạt từng khoản</b> (nhận diện từ câu “thì bị phạt…”), <b>loại tội phạm</b> theo khoản 1 Điều 9 (căn cứ mức cao nhất của khung), <b>thời hiệu truy cứu</b> theo khoản 2 Điều 27 và trường hợp không áp dụng thời hiệu theo Điều 28, <b>độ tuổi</b> theo khoản 2 Điều 12. Đây là công cụ hỗ trợ; kết luận pháp lý cho vụ việc cụ thể phải căn cứ hồ sơ và quyết định của cơ quan có thẩm quyền.</p>' +
        '<h3 class="ch">Đọc khi không có mạng</h3><p>Trang có thể cài lên màn hình chính như một ứng dụng. Nhấn nút dưới đây để tải sẵn toàn bộ nội dung (~3 MB) vào bộ nhớ đệm của trình duyệt.</p>' +
        '<p><button type="button" class="btn btn--p" data-act="offline">' + ic('offline') + 'Tải dữ liệu để đọc offline</button></p>' +
        '<h3 class="ch">Phím tắt & thao tác nhanh</h3><p><b>/</b> – mở ô tìm kiếm · <b>Ctrl/⌘ + K</b> – bảng mục lục, chọn là chuyển tới điều bất kỳ · <b>←</b> <b>→</b> – điều trước/sau khi đang đọc · <b>Esc</b> – đóng gợi ý, cửa sổ.</p>' +
        '<p>Trên điện thoại: khi đang đọc, bấm <b>Mục lục</b> ở thanh dưới để mở bảng mục lục từ dưới lên, kéo xuống để đóng; nút <b>Aa</b> ở góc phải trên để chỉnh cỡ chữ, sáng/tối. Cuộn xuống để đọc toàn màn hình, cuộn lên để hiện lại thanh điều hướng.</p>' +
        '<h3 class="ch">Miễn trừ trách nhiệm</h3><p>Nội dung trên trang nhằm mục đích tham khảo, không thay thế ý kiến tư vấn pháp lý. Khi sử dụng trong hồ sơ tố tụng, vui lòng đối chiếu văn bản đăng trên Công báo, Cơ sở dữ liệu quốc gia về pháp luật hoặc văn bản hợp nhất mới nhất của Văn phòng Quốc hội.</p>' +
        '</div></div>' + ctaBlock();
      return null;
    }
  };

  VIEWS._404 = {
    render: function (ctx, main, msg) {
      setTitle('Không tìm thấy');
      main.innerHTML = '<div class="wrap page"><div class="empty">' + ic('alert') + '<h3>Không tìm thấy trang</h3><p>' + esc(msg || 'Đường dẫn không tồn tại hoặc đã thay đổi.') + '</p>' +
        '<p style="margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn btn--p" href="./">Về trang chủ</a><a class="btn" href="muc-luc">Xem mục lục</a></p></div></div>';
      return null;
    }
  };

  /* =========================================================================
     10. Sự kiện toàn cục
     ========================================================================= */
  function previewHtml(id) {
    var a = DB.byId[id]; if (!a) return '';
    var k = Pen.maxOf(a);
    return '<div class="pv-n">Điều ' + esc(a.id) + ' · ' + esc(a.ch.label) + '</div><div class="pv-t" id="sheetTitle">' + esc(a.t) + '</div>' +
      '<div class="pv-x">' + esc(a.M.ex || '') + '</div><div class="pv-m">' + (k ? '<span class="tag tag--c' + k.c + '">' + esc(Pen.maxText(a)) + '</span>' : '') + artTags(a, true) + '</div>' +
      '<div class="pv-a"><a class="btn btn--p btn--sm" href="dieu-' + a.id + '">Mở Điều ' + esc(a.id) + ic('arrow-r') + '</a>' +
      (isTouch ? '<button type="button" class="btn btn--sm" data-act="sheet-close">Đóng</button>' : '') + '</div>';
  }
  function fnHtml(n) {
    var v = Router.view, d = v && v.d;
    var txt = d && d.fn ? d.fn[n] : '';
    var num = v && v.fnMap ? v.fnMap[n] : n;
    return '<div class="pv-n">Chú thích ' + esc(num) + '</div><div class="pv-x" id="sheetTitle" style="margin-top:6px">' + esc(txt || 'Không có nội dung chú thích.') + '</div>' +
      (isTouch ? '<div class="pv-a"><button type="button" class="btn btn--sm" data-act="sheet-close">Đóng</button></div>' : '');
  }

  function bindGlobal() {
    Jump.swipe();
    UI.sheetDrag();
    Bars.init();
    // Hộp thoại đang mở (bảng mục lục, bảng dưới, menu): phím Tab chỉ đi vòng trong hộp thoại, không lọt ra trang phía sau
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var box = Jump.isOpen ? Jump.panel : !$('#sheet').hidden ? $('#sheet .sheet-panel') : !$('#drawer').hidden ? $('#drawer .drawer-panel') : null;
      if (!box) return;
      var f = $$('a[href],button:not([disabled]),input:not([disabled]),select,textarea,summary,[tabindex]:not([tabindex="-1"])', box)
        .filter(function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1], cur = document.activeElement;
      if (!box.contains(cur)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && cur === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
    });
    document.addEventListener('click', function (e) {
      var t = e.target;
      var pv = t.closest('a[data-pv]');
      if (pv && isTouch && !pv.closest('.pop, .sheet, .rl')) { e.preventDefault(); UI.sheet(previewHtml(pv.dataset.pv)); return; }
      var fn = t.closest('sup.fn');
      if (fn) { e.preventDefault(); if (isTouch) UI.sheet(fnHtml(fn.dataset.fn)); else UI.pop(fn, fnHtml(fn.dataset.fn)); return; }
      var sc = t.closest('[data-scroll]');
      if (sc) { e.preventDefault(); var el = document.getElementById(sc.dataset.scroll); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      var tr = t.closest('[data-try]');
      if (tr) {
        var v = tr.dataset.try, inp = $('#heroSearch .sb-in') || $('#srBox .sb-in');
        if (inp) { inp.value = v; inp.dispatchEvent(new Event('input')); inp.focus(); }
        else go('tim-kiem?q=' + encodeURIComponent(v));
        return;
      }
      var kk = t.closest('a.kn, .rc .kl a[data-k], .pen-row a[data-k]');
      if (kk && Router.view && Router.view.focusK) {
        e.preventDefault();
        var k = kk.dataset.k;
        history.replaceState(null, '', abs('dieu-' + Router.view.a.id + '?k=' + k));
        Router.cur = parseRoute();
        Router.view.focusK(k);
        return;
      }
      var cite = t.closest('[data-cite]');
      if (cite && Router.view && Router.view.a) {
        var a = Router.view.a, kn = cite.dataset.cite, box = $('#k' + kn);
        var body = $$('p', box).map(function (p) { return plain(p.innerHTML).replace(/\*$/, ''); }).join('\n');
        UI.copy(body + '\n(' + citeText(a, kn) + ')', 'Đã sao chép trích dẫn khoản ' + kn);
        return;
      }
      var kl = t.closest('[data-klink]');
      if (kl && Router.view && Router.view.a) { UI.copy(abs('dieu-' + Router.view.a.id + '?k=' + kl.dataset.klink), 'Đã sao chép liên kết'); return; }
      var act = t.closest('[data-act]');
      if (!act) return;
      var A = act.dataset.act, V = Router.view;
      if (A === 'drawer') UI.drawer(true);
      else if (A === 'drawer-close') UI.drawer(false);
      else if (A === 'sheet-close') UI.closeSheet();
      else if (A === 'jump') { if (!(e.metaKey || e.ctrlKey || e.shiftKey || e.button) && Jump.show(act)) e.preventDefault(); }
      else if (A === 'toc') {
        // Nút "Mục lục" ở thanh dưới (điện thoại) và đầu trang (máy tính) — cùng một logic theo ngữ cảnh:
        // đang đọc điều/chương → mở bảng tra nhanh (đọc tiếp liền mạch); đang ở trang Mục lục → về đầu trang;
        // trang khác → liên kết mở trang Mục lục như bình thường.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
        var where = Router.cur && Router.cur.parts[0];
        if (where === 'dieu' || where === 'chuong') { if (Jump.show(act)) e.preventDefault(); }
        else if (where === 'muc-luc') { e.preventDefault(); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
      }
      else if (A === 'jump-close') Jump.hide();
      else if (A === 'settings') { UI.drawer(false); UI.settings(); }
      else if (A === 'theme') {
        var cur = Prefs.get().theme || 'light', dark = cur === 'dark' || (cur === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        Prefs.set('theme', dark ? 'light' : 'dark'); UI.toast(dark ? 'Đã chuyển sang giao diện sáng' : 'Đã chuyển sang giao diện tối');
      }
      else if (A === 'focus-hero') { var hi = $('#heroSearch .sb-in'); if (hi) { e.preventDefault(); hi.placeholder = 'Mô tả hành vi, vd: vay tiền không trả, đánh nhau…'; hi.focus(); hi.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }
      else if (A === 'offline') offline(act);
      else if (V && V.a) {
        var art = V.a;
        if (A === 'save') {
          var on = Saved.toggle(art.id);
          act.setAttribute('aria-pressed', String(on));
          act.innerHTML = ic(on ? 'bookmark-fill' : 'bookmark') + '<span>' + (on ? 'Đã lưu' : 'Lưu điều này') + '</span>';
          UI.toast(on ? 'Đã lưu Điều ' + art.id : 'Đã bỏ lưu Điều ' + art.id);
        } else if (A === 'copy-art' && V.d) {
          var txt = 'Điều ' + art.id + '. ' + art.t + '\n\n' + V.d.law.map(function (p) { return plain(p[1]).replace(/\*$/, ''); }).join('\n') + '\n\n(' + CITE + ')';
          UI.copy(txt, 'Đã sao chép toàn văn Điều ' + art.id);
        } else if (A === 'share') {
          var url = abs('dieu-' + art.id);
          if (navigator.share) navigator.share({ title: 'Điều ' + art.id + '. ' + art.t, text: 'Điều ' + art.id + '. ' + art.t + ' – ' + CITE, url: url }).catch(function () { });
          else UI.copy(url, 'Đã sao chép liên kết Điều ' + art.id);
        } else if (A === 'print') { window.print(); }
      }
    });
    document.addEventListener('click', function (e) {
      var s = e.target.closest('[data-set] button');
      if (s) {
        var key = s.parentNode.dataset.set, v = s.dataset.v;
        $$('button', s.parentNode).forEach(function (b) { b.setAttribute('aria-pressed', String(b === s)); });
        if (key === 'theme') Prefs.set('theme', v);
        if (key === 'serif') Prefs.set('serif', v === '1');
      }
      var f = e.target.closest('[data-fs]');
      if (f) {
        var fs = Math.max(-2, Math.min(5, (Prefs.get().fs || 0) + (+f.dataset.fs)));
        Prefs.set('fs', fs);
      }
      if (!e.target.closest('#pop') && !e.target.closest('sup.fn')) UI.closePop();
    });
    // Ghi chú tự lưu
    var saveNote = debounce(function (el) {
      Notes.set(el.dataset.note, el.value);
      $$('[data-note-st="' + el.dataset.note + '"]').forEach(function (s) { s.textContent = 'Đã lưu lúc ' + new Date().toTimeString().slice(0, 5); });
      $$('textarea[data-note="' + el.dataset.note + '"]').forEach(function (o) { if (o !== el) o.value = el.value; });
    }, 400);
    document.addEventListener('input', function (e) { if (e.target.matches('textarea[data-note]')) saveNote(e.target); });
    // Xem nhanh điều được dẫn chiếu khi rê chuột
    if (!isTouch) {
      var timer = null, cur = null;
      document.addEventListener('mouseover', function (e) {
        var a = e.target.closest('a[data-pv]');
        if (a === cur) return;
        if (e.target.closest('#pop')) { clearTimeout(timer); return; }
        clearTimeout(timer); cur = a;
        if (!a) { timer = setTimeout(UI.closePop, 260); return; }
        timer = setTimeout(function () { UI.pop(a, previewHtml(a.dataset.pv)); }, 280);
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { UI.closePop(); UI.closeSheet(); UI.drawer(false); Jump.hide(); }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
        if (Jump.isOpen) { e.preventDefault(); Jump.hide(); } else if (Jump.show()) e.preventDefault();
        return;
      }
      if (e.key === '/' && !e.target.closest('input,textarea,select,[contenteditable]')) {
        if (Jump.isOpen) { e.preventDefault(); Jump.q.focus(); return; }
        var inp = $('#heroSearch .sb-in') || $('#srBox .sb-in') || $('#hdSearch .sb-in');
        if (inp && inp.offsetParent) { e.preventDefault(); inp.focus(); inp.select(); }
        else { e.preventDefault(); go('tim-kiem'); }
      }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('sup.fn')) { e.preventDefault(); e.target.click(); }
    });
    // Nạp trước dữ liệu của điều sắp mở: rê chuột lên liên kết (máy tính) hoặc vừa chạm (điện thoại) → mở ra là có ngay
    var saveData = navigator.connection && navigator.connection.saveData, pfT = null;
    var artOf = function (el) {
      var a = el && el.closest && el.closest('a[href^="dieu-"]'), m = a && /^dieu-(\d{1,3}[a-z]?)(?:\?|$)/.exec(a.getAttribute('href'));
      return m && DB.byId[m[1]] ? m[1] : null;
    };
    var prefetch = function (id) { if (id && DB.toc) DB.article(id).catch(function () { }); };
    var toolOf = function (el) { return !!(el && el.closest && el.closest('a[href^="cong-cu"]')); };
    if (!saveData) {
      document.addEventListener('mouseover', function (e) {
        clearTimeout(pfT);
        var id = artOf(e.target), tool = !id && toolOf(e.target);
        if (id || tool) pfT = setTimeout(function () { if (id) prefetch(id); else loadTools().catch(function () { }); }, 80);
      });
      document.addEventListener('touchstart', function (e) { var id = artOf(e.target); if (id) prefetch(id); else if (toolOf(e.target)) loadTools().catch(function () { }); }, { passive: true });
    }
    var tt = $('#toTop');
    window.addEventListener('scroll', function () { tt.classList.toggle('on', window.scrollY > 900); }, { passive: true });
    tt.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    // Điều hướng trong ứng dụng: liên kết nội bộ chuyển trang tại chỗ, không tải lại (các trình nghe phía trên đã xử lý trước)
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest('a[href]'), u = a && appUrl(a);
      if (!u) return;
      e.preventDefault();
      go(u.href);
    });
    // Quay lại/tiến tới; bỏ qua khi chỉ đổi phần #neo trong cùng trang (vd. liên kết “Bỏ qua thanh điều hướng”)
    var onPop = function () {
      if (Jump.backing) {
        Jump.backing = false;
        if (Jump.pushLater) { Jump.pushLater = false; if (Jump.isOpen) Jump.push(); }
        return;
      }
      if (Jump.hist && Jump.isOpen) { Jump.hist = false; Jump.hide(); return; }
      if (!DB.toc) return; // chưa nạp xong dữ liệu: lần vẽ đầu tiên sẽ đọc đường dẫn hiện tại
      if (legacyHash() == null && Router.cur && parseRoute().full === Router.cur.full) return;
      route();
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', Prefs.apply);
  }

  function offline(btn) {
    if (!('caches' in window)) { UI.toast('Trình duyệt không hỗ trợ lưu ngoại tuyến'); return; }
    var files = DB.chaps.map(function (c) { return abs('data/' + c.id + '.json?v=' + DB.v); });
    var done = 0, label = btn.innerHTML;
    btn.disabled = true;
    Promise.all(files.map(function (u) {
      return fetch(u).then(function (r) { done++; btn.innerHTML = '<span class="spinner"></span> ' + done + '/' + files.length; return r; });
    })).then(function () {
      btn.innerHTML = ic('check') + 'Đã sẵn sàng offline'; UI.toast('Đã tải toàn bộ Bộ luật để đọc offline');
    }).catch(function () { btn.disabled = false; btn.innerHTML = label; UI.toast('Tải chưa xong, vui lòng thử lại khi có mạng'); });
  }

  /* =========================================================================
     11. Khởi động
     ========================================================================= */
  window.App = {
    $: $, $$: $$, esc: esc, ic: ic, fold: fold, plain: plain, fmtDate: fmtDate, vnNum: vnNum, debounce: debounce,
    DB: DB, Pen: Pen, CLS: CLS, CH_NOTE: CH_NOTE, UI: UI, VIEWS: VIEWS, go: go, crumb: crumb, drum: drum, setTitle: setTitle,
    SearchBox: SearchBox, artCard: artCard, artTags: artTags, toolCards: toolCards, lawHtml: lawHtml, Router: Router, citeText: citeText,
    parseRoute: parseRoute, abs: abs
  };

  Prefs.apply();
  bindGlobal();
  var domReady = new Promise(function (res) {
    if (document.readyState !== 'loading') res(); else document.addEventListener('DOMContentLoaded', res);
  });
  Promise.all([DB.init(), domReady]).then(function () {
    SearchBox($('#hdSearch'), { kbd: true, go: false });
    // Báo service worker phiên bản dữ liệu hiện hành để xóa dữ liệu điều luật cũ trong bộ nhớ đệm
    if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'data-version', v: DB.v });
    // Chuẩn hoá: index.html, dieu-173.html → đường dẫn sạch
    var clean = location.pathname.replace(/(^|\/)index(\.html)?$/, '$1').replace(/\.html$/, '');
    if (clean !== location.pathname) history.replaceState(null, '', clean + location.search + location.hash);
    // Mở thẳng một điều: nạp sẵn dữ liệu chương để thay nội dung tĩnh mà không chớp khung chờ
    var c0 = legacyHash() == null ? parseRoute() : null, a0 = c0 && c0.parts[0] === 'dieu' && DB.byId[(c0.parts[1] || '').toLowerCase()];
    var tick = new Promise(function (r) { setTimeout(r, 0); });
    return (a0 ? Promise.all([DB.article(a0.id).catch(function () { }), tick]) : tick).then(route);
  }).catch(function (err) {
    // Trang dựng tĩnh vẫn đọc được khi không tải được dữ liệu tương tác → giữ nguyên nội dung
    if ($('#main [data-prerender]')) { UI.toast('Không tải được dữ liệu tra cứu, đang hiển thị bản đọc tĩnh'); return; }
    $('#main').innerHTML = '<div class="wrap page"><div class="empty">' + ic('alert') + '<h3>Không tải được dữ liệu</h3><p>Vui lòng kiểm tra kết nối mạng rồi <a href="javascript:location.reload()">tải lại trang</a>.</p><p class="muted" style="font-size:.8rem;margin-top:8px">' + esc(err && err.message) + '</p></div></div>';
  });
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(abs('sw.js')).then(function (reg) {
        // Trang ứng dụng một trang không tải lại khi chuyển trang → tự hỏi máy chủ có phiên bản mới mỗi khi người dùng quay lại tab
        var last = Date.now();
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible' && Date.now() - last > 5 * 60 * 1000) { last = Date.now(); reg.update().catch(function () { }); }
        });
      }).catch(function () { });
    });
    // Phiên bản mới đã cài và nắm quyền (không phải lần cài đầu) → đánh dấu; lần bấm chuyển trang kế tiếp sẽ tải trang đầy đủ
    // theo phiên bản mới — liền mạch, người dùng không phải tự tải lại trang
    var hadSW = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (hadSW) Router.stale = true; hadSW = true; });
  }
})();
