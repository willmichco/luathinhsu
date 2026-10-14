/*
 * Tra cứu Bộ luật Hình sự – ứng dụng một trang (định tuyến bằng #/…)
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
  var VER = '20261014a';

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
      d.setAttribute('data-theme', p.theme || 'auto');
      d.style.setProperty('--fs-step', p.fs || 0);
      d.classList.toggle('sans-law', p.serif === false);
      var dark = p.theme === 'dark' || (p.theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      var m = $('meta[name="theme-color"]'); if (m) m.setAttribute('content', dark ? '#2c0709' : '#7a1216');
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
    { k: ['thoi hieu', 'het han truy cuu', 'truy cuu'], href: '#/cong-cu/thoi-hieu', t: 'Tính thời hiệu truy cứu trách nhiệm hình sự', i: 'clock' },
    { k: ['tuoi', 'vi thanh nien', 'chua thanh nien', 'duoi 18', 'duoi 16'], href: '#/cong-cu/tuoi', t: 'Kiểm tra tuổi chịu trách nhiệm hình sự', i: 'user' },
    { k: ['so sanh', 'phan biet', 'khac nhau'], href: '#/cong-cu/so-sanh', t: 'So sánh hai điều luật', i: 'columns' },
    { k: ['khung hinh phat', 'muc phat', 'bi phat bao nhieu', 'phat tu bao nhieu', 'loai toi'], href: '#/cong-cu/khung-hinh-phat', t: 'Bảng tra khung hình phạt', i: 'table' },
    { k: ['thi hanh an', 'thoi hieu thi hanh'], href: '#/cong-cu/thi-hanh-an', t: 'Thời hiệu thi hành bản án', i: 'calendar' }
  ];

  /* =========================================================================
     4. Dữ liệu
     ========================================================================= */
  var DB = {
    toc: null, meta: {}, arts: [], byId: {}, chaps: [], chapById: {}, cache: {},
    init: function () {
      var j = function (u) {
        return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
      };
      return Promise.all([j('data/toc.json'), j('data/meta.json')]).then(function (res) {
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
        DB.cache[cid] = fetch('data/' + cid + '.json?v=' + DB.v).then(function (r) {
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
      return DB.chapter(a.ch.id).then(function (map) { return map[id]; });
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
        var nm = link && k.n ? '<a href="#/dieu/' + a.id + '?k=' + k.n + '" data-k="' + k.n + '">' + lab + '</a>' : lab;
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
      var s = $('#sheet'); $('#sheetBody').innerHTML = html; s.hidden = false;
      document.body.style.overflow = 'hidden';
      var f = $('#sheetBody button, #sheetBody a, #sheetBody input'); if (f && !isTouch) f.focus();
    },
    closeSheet: function () { $('#sheet').hidden = true; document.body.style.overflow = ''; },
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
    fillDrawer: function () {
      var cur = location.hash.split('?')[0];
      var L = function (href, icon, t) { return '<a href="' + href + '"' + (cur === href ? ' class="on"' : '') + '>' + ic(icon) + t + '</a>'; };
      $('#drawerNav').innerHTML =
        L('#/', 'home', 'Trang chủ') + L('#/muc-luc', 'list', 'Mục lục Bộ luật') + L('#/tim-kiem', 'search', 'Tìm kiếm toàn văn') +
        L('#/da-luu', 'bookmark', 'Đã lưu & ghi chú') +
        '<div class="dn-h">Công cụ nghiên cứu</div>' +
        L('#/cong-cu/thoi-hieu', 'clock', 'Phân loại tội & thời hiệu') + L('#/cong-cu/tuoi', 'user', 'Tuổi chịu trách nhiệm hình sự') +
        L('#/cong-cu/thi-hanh-an', 'calendar', 'Thời hiệu thi hành bản án') + L('#/cong-cu/so-sanh', 'columns', 'So sánh điều luật') +
        L('#/cong-cu/khung-hinh-phat', 'table', 'Bảng khung hình phạt') +
        '<hr><button type="button" data-act="settings">' + ic('text') + 'Cỡ chữ & giao diện</button>' +
        L('#/gioi-thieu', 'info', 'Giới thiệu & nguồn dữ liệu') +
        '<div class="dn-h">Liên hệ luật sư</div>' +
        '<a href="tel:0983498499">' + ic('phone') + 'Gọi 0983 498 499</a>' +
        '<a href="https://zalo.me/0983498499" target="_blank" rel="noopener">' + ic('chat') + 'Nhắn Zalo</a>' +
        '<a href="mailto:luatsunam.hcm@gmail.com">' + ic('mail') + 'luatsunam.hcm@gmail.com</a>';
    },
    settings: function () {
      var p = Prefs.get(), th = p.theme || 'auto', fs = p.fs || 0;
      UI.sheet('<h2 id="sheetTitle">Tùy chỉnh hiển thị</h2>' +
        '<div class="set-row"><div><b>Giao diện</b><small>Sáng, tối hoặc theo thiết bị</small></div>' +
        '<div class="seg" data-set="theme">' + [['light', 'Sáng'], ['dark', 'Tối'], ['auto', 'Tự động']].map(function (o) {
          return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (th === o[0]) + '">' + o[1] + '</button>';
        }).join('') + '</div></div>' +
        '<div class="set-row"><div><b>Cỡ chữ văn bản</b><small>Áp dụng cho điều luật và bình luận</small></div>' +
        '<div class="fs-ctl"><button type="button" data-fs="-1" aria-label="Giảm cỡ chữ">A−</button><output id="fsOut">' + (100 + fs * 6) + '%</output><button type="button" data-fs="1" aria-label="Tăng cỡ chữ">A+</button></div></div>' +
        '<div class="set-row"><div><b>Kiểu chữ điều luật</b><small>Có chân (trang trọng) hoặc không chân</small></div>' +
        '<div class="seg" data-set="serif"><button type="button" data-v="1" aria-pressed="' + (p.serif !== false) + '">Có chân</button><button type="button" data-v="0" aria-pressed="' + (p.serif === false) + '">Không chân</button></div></div>' +
        '<div class="set-row"><div><b>Đọc khi không có mạng</b><small>Tải sẵn toàn bộ 428 điều và bình luận (~3 MB)</small></div>' +
        '<button type="button" class="btn btn--sm" data-act="offline">' + ic('offline') + 'Tải về</button></div>');
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
    if (r.chap) return '#/chuong/' + r.chap.slug;
    var h = '#/dieu/' + r.art;
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
      rq.slice(0, 5).forEach(function (x) { out.push({ kind: 'recent', q: x, href: '#/tim-kiem?q=' + encodeURIComponent(x) }); });
      Hist.list().slice(0, 4).forEach(function (h) {
        var a = DB.byId[h.id]; if (a) out.push({ kind: 'art', a: a, href: '#/dieu/' + a.id, sec: 'Đã xem gần đây' });
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
      hits.slice(0, 6).forEach(function (h, i) { seen[h.a.id] = 1; out.push({ kind: 'art', a: h.a, href: '#/dieu/' + h.a.id + '?q=' + encodeURIComponent(raw), sec: i ? null : 'Tên điều luật' }); });
      // Cách gọi thông dụng
      var fw = ' ' + f + ' ', syn = [];
      Object.keys(SYN).forEach(function (key) {
        var hit = fw.indexOf(' ' + key + ' ') > -1 || (f.length >= 3 && key.indexOf(f) === 0);
        if (hit) SYN[key].forEach(function (id) { if (!seen[id] && DB.byId[id]) { seen[id] = 1; syn.push(DB.byId[id]); } });
      });
      syn.slice(0, 5).forEach(function (a, i) { out.push({ kind: 'art', a: a, href: '#/dieu/' + a.id, sec: i ? null : 'Có thể bạn đang tìm' }); });
      TOOL_KW.forEach(function (t) {
        if (t.k.some(function (k) { return f.indexOf(k) > -1; })) out.push({ kind: 'tool', t: t, href: t.href, sec: 'Công cụ' });
      });
      out.push({ kind: 'full', q: raw, href: '#/tim-kiem?q=' + encodeURIComponent(raw), sec: 'Tìm trong toàn văn' });
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
    inp.addEventListener('input', function () { clr.hidden = !inp.value; render(); if (opt.onInput) opt.onInput(inp.value); });
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
      go('#/tim-kiem?q=' + encodeURIComponent(v));
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
        var w = new Worker('assets/js/search-worker.js?v=' + VER);
        w.onmessage = function (e) {
          var m = e.data;
          if (m.type === 'progress') { FT.progress = m; FT.emit('progress', m); }
          else if (m.type === 'ready') { FT.ready = true; FT.emit('ready', m); }
          else if (m.type === 'result') { var cb = FT.cbs[m.id]; delete FT.cbs[m.id]; if (cb) cb.cb(m); }
          else if (m.type === 'error') { w.terminate(); FT.worker = null; FT.fallback(chapters, titles); }
        };
        w.onerror = function () { w.terminate(); FT.worker = null; FT.fallback(chapters, titles); };
        w.postMessage({ type: 'init', chapters: chapters, titles: titles, v: DB.v, base: new URL('data/', location.href).href });
        FT.worker = w;
      } catch (e) { FT.fallback(chapters, titles); }
    },
    fallback: function (chapters, titles) {
      if (FT.engine) return;
      var load = window.LXEngine ? Promise.resolve() : new Promise(function (res, rej) {
        var s = document.createElement('script'); s.src = 'assets/js/search-engine.js?v=' + VER; s.onload = res; s.onerror = rej; document.head.appendChild(s);
      });
      load.then(function () {
        return Promise.all(chapters.map(function (c) {
          return fetch('data/' + c + '.json?v=' + DB.v).then(function (r) { return r.json(); });
        }));
      }).then(function (lists) {
        FT.engine = new window.LXEngine();
        FT.engine.load(titles, lists);
        FT.ready = true; FT.emit('ready', {});
        Object.keys(FT.cbs).forEach(function (k) { var x = FT.cbs[k]; delete FT.cbs[k]; FT.query(x.q).then(x.cb); });
      }).catch(function () { FT.emit('error', {}); });
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

  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '');
    var i = h.indexOf('?');
    var path = i > -1 ? h.slice(0, i) : h, qs = i > -1 ? h.slice(i + 1) : '';
    return { parts: path.split('/').filter(Boolean).map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } }), q: new URLSearchParams(qs), key: path, full: h };
  }
  function go(href) {
    Router.byClick = true;
    if (location.hash === href) route(); else location.hash = href;
  }
  function setNav(name) {
    $$('[data-nav]').forEach(function (a) { a.classList.toggle('on', a.dataset.nav === name); if (a.dataset.nav === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.body.classList.toggle('is-home', name === 'home');
  }
  function setTitle(t) { document.title = t ? t + ' – Tra cứu Bộ luật Hình sự' : 'Tra cứu Bộ luật Hình sự 2015 (sửa đổi 2017, 2025) – Luật Sư Nam'; }

  var VIEWS = {};
  function route() {
    var ctx = parseHash(), main = $('#main');
    var name = ctx.parts[0] || '';
    // Liên kết kiểu cũ: #d173
    var legacy = location.hash.match(/^#d(\d{1,3}[a-z]?)$/);
    if (legacy) { location.replace('#/dieu/' + legacy[1]); return; }
    var prevKey = Router.cur && Router.cur.full;
    if (prevKey != null) Router.pos[prevKey] = window.scrollY;
    var back = !Router.byClick;
    Router.byClick = false;
    UI.closePop(); UI.closeSheet(); UI.drawer(false);
    // Cùng một trang, chỉ đổi tham số (tab, khoản…) → cập nhật tại chỗ
    if (Router.view && Router.view.update && Router.cur && Router.cur.parts.join('/') === ctx.parts.join('/') && Router.view.update(ctx) !== false) {
      Router.cur = ctx; return;
    }
    if (Router.view && Router.view.leave) Router.view.leave();
    var V = VIEWS[name] || VIEWS._404;
    Router.cur = ctx;
    Router.view = null;
    setNav(V.nav || name || 'home');
    // Mỗi trang được vẽ trong một vùng chứa mới để không giữ lại trình nghe sự kiện cũ
    var host = document.createElement('div');
    main.innerHTML = ''; main.appendChild(host);
    var res = V.render(ctx, host);
    Router.view = (res && typeof res === 'object' && !res.then) ? res : V;
    var restore = function () {
      if (back && Router.pos[ctx.full] != null) window.scrollTo(0, Router.pos[ctx.full]);
      else if (!(Router.view && Router.view.keepScroll)) window.scrollTo(0, 0);
    };
    if (res && res.then) res.then(restore); else restore();
    if (!isTouch && !back && main.focus) main.focus({ preventScroll: true });
  }

  /* =========================================================================
     9. Các trang
     ========================================================================= */
  function artCard(a, extra) {
    var k = Pen.maxOf(a);
    return '<a class="pa" href="#/dieu/' + a.id + '"><span class="pn">Điều ' + esc(a.id) + '</span><h3>' + esc(a.t) + '</h3>' +
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
        '<h1>Tra cứu <em>Bộ luật Hình sự</em> <br>nhanh, chính xác, dễ hiểu</h1>' +
        '<p class="hero-sub">Toàn văn ' + st.arts + ' điều luật kèm bình luận khoa học, khung hình phạt từng khoản, phân loại tội phạm và thời hiệu — tìm được cả khi gõ không dấu.</p>' +
        '<div id="heroSearch"></div>' +
        '<div class="hero-try"><span>Thử tìm:</span>' +
        ['Điều 173', 'lừa đảo qua mạng', 'khoản 2 điều 134', 'đồng phạm', 'say rượu lái xe', '"tái phạm nguy hiểm"'].map(function (x) {
          return '<button type="button" data-try="' + esc(x) + '">' + esc(x) + '</button>';
        }).join('') + '</div></div>' +
        '<aside class="intent" aria-label="Lối tắt theo nhu cầu"><h2>Bạn đang cần gì?</h2><p>Chọn nhanh theo tình huống nghiên cứu</p>' +
        [['#/tim-kiem', 'search', 'Tra tội danh theo hành vi', 'Mô tả hành vi, ví dụ: “vay tiền không trả”'],
          ['#/cong-cu/thoi-hieu', 'clock', 'Phân loại tội & tính thời hiệu', 'Theo Điều 9, Điều 27, Điều 28'],
          ['#/cong-cu/tuoi', 'user', 'Kiểm tra tuổi chịu TNHS', 'Tính tuổi chính xác theo Điều 12'],
          ['#/cong-cu/so-sanh', 'columns', 'So sánh hai tội danh', 'Đối chiếu dấu hiệu & khung hình phạt']].map(function (x) {
          return '<a href="' + x[0] + '"' + (x[0] === '#/tim-kiem' ? ' data-act="focus-hero"' : '') + '><span class="ii">' + ic(x[1]) + '</span><span><b>' + x[2] + '</b><small>' + x[3] + '</small></span><span class="go">' + ic('chev-r') + '</span></a>';
        }).join('') + '</aside></div></section>' +

        '<div class="wrap stats"><div class="stats-in">' +
        stat('book', st.arts, 'điều luật', 'gồm Điều 217a, 256a') +
        stat('list', st.chapters, 'chương', '3 phần · ' + DB.chaps.reduce(function (s, c) { return s + c.muc.length; }, 0) + ' mục') +
        stat('spark', st.n25, 'điều sửa đổi', 'theo Luật số 86/2025/QH15') +
        stat('note', nCm, 'điều có bình luận', 'phân tích khoa học kèm theo') + '</div></div>' +

        (hist.length ? '<section class="wrap sec"><div class="sec-h"><div><h2>Tiếp tục đọc</h2><p>Các điều bạn xem gần đây trên thiết bị này</p></div><a class="more" href="#/da-luu?tab=lich-su">Lịch sử ' + ic('chev-r') + '</a></div>' +
          '<div class="recent">' + hist.map(function (a) { return '<a href="#/dieu/' + a.id + '"><b>Điều ' + esc(a.id) + '</b><span>' + esc(a.t) + '</span></a>'; }).join('') + '</div></section>' : '') +

        '<section class="wrap sec"><div class="sec-h"><div><span class="eyebrow">Phần thứ hai</span><h2>Tra cứu theo nhóm tội phạm</h2><p>14 chương, từ an ninh quốc gia đến tội phạm chiến tranh</p></div><a class="more" href="#/muc-luc">Toàn bộ mục lục ' + ic('chev-r') + '</a></div>' +
        '<div class="groups">' + p2.map(function (c) {
          return '<a class="grp" href="#/chuong/' + c.slug + '"><span class="gi">' + ic(ICONS[c.id]) + '</span><span><span class="gn">' + esc(c.label) + '</span><h3>' + esc(c.name) + '</h3><span class="gm">' + c.arts.length + ' điều · Điều ' + c.first.id + ' – ' + c.last.id + '</span></span></a>';
        }).join('') +
        '<a class="grp grp--more" href="#/cong-cu/khung-hinh-phat"><span class="gi">' + ic('table') + '</span><span><span class="gn">Tra nhanh</span><h3>Bảng khung hình phạt của mọi tội danh</h3><span class="gm">Lọc theo tử hình, chung thân, độ tuổi</span></span></a>' +
        '<a class="grp grp--more" href="#/muc-luc"><span class="gi">' + ic('list') + '</span><span><span class="gn">Toàn bộ</span><h3>Mục lục ' + DB.arts.length + ' điều luật</h3><span class="gm">Lọc tức thì theo tên hoặc số điều</span></span></a>' +
        '</div></section>' +

        '<section class="wrap sec"><div class="sec-h"><div><h2>Thường được tra cứu</h2><p>Những tội danh phổ biến trong thực tiễn tố tụng</p></div></div>' +
        '<div class="pop-grid">' + POPULAR.map(function (id) { return DB.byId[id] ? artCard(DB.byId[id]) : ''; }).join('') + '</div></section>' +

        '<section class="wrap sec"><div class="sec-h"><div><span class="eyebrow">Phần thứ nhất & thứ ba</span><h2>Những quy định chung</h2><p>Nguyên tắc, hình phạt, quyết định hình phạt, thời hiệu, xóa án tích…</p></div></div>' +
        '<div class="gen">' + p1.map(function (c) {
          return '<a href="#/chuong/' + c.slug + '"><span class="gr">' + esc(c.num || '—') + '</span><span class="gt">' + esc(c.name) + (CH_NOTE[c.id] ? ' <span class="tag tag--rep26">' + CH_NOTE[c.id].short + '</span>' : '') + '</span><span class="gc">Đ.' + c.first.id + (c.first !== c.last ? '–' + c.last.id : '') + '</span></a>';
        }).join('') + '</div></section>' +

        '<section class="wrap sec"><div class="sec-h"><div><h2>Công cụ hỗ trợ nghiên cứu</h2><p>Tính toán tự động từ chính văn bản điều luật</p></div><a class="more" href="#/cong-cu">Tất cả công cụ ' + ic('chev-r') + '</a></div>' +
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
        '<p style="margin-top:14px"><a class="btn btn--sm" href="#/gioi-thieu">' + ic('info') + 'Nguồn dữ liệu & phương pháp</a></p></div>' +
        '</div></section>' +
        ctaBlock();
      SearchBox($('#heroSearch'), { lg: true, ph: 'Nhập số điều, tên tội hoặc từ khóa…' });
      return null;
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
      return '<a class="tl" href="#/cong-cu/' + x[0] + '"><span class="ti">' + ic(x[1]) + '</span><h3>' + x[2] + '</h3><p>' + x[3] + '</p><span class="lk">Mở công cụ ' + ic('arrow-r') + '</span></a>';
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

  /* ---------- Mục lục ---------- */
  VIEWS['muc-luc'] = {
    nav: 'muc-luc',
    render: function (ctx, main) {
      setTitle('Mục lục');
      var filter = ctx.q.get('loc') || 'all';
      main.innerHTML =
        '<section class="ph">' + drum() + '<div class="wrap ph-in">' + crumb([['Trang chủ', '#/'], ['Mục lục']]) +
        '<span class="eyebrow">Cấu trúc Bộ luật</span><h1>Mục lục Bộ luật Hình sự</h1>' +
        '<p>3 phần · 26 chương · ' + DB.arts.length + ' điều. Gõ để lọc tức thì theo số điều hoặc tên điều (có dấu hay không dấu đều được).</p></div></section>' +
        '<div class="toc-bar"><div class="wrap"><div class="sb"><div class="sb-box">' + ic('filter') + '<input class="sb-in" id="tocQ" type="search" placeholder="Lọc mục lục… (vd: tai san, 250)" aria-label="Lọc mục lục"></div></div>' +
        '<div class="toc-open" role="group" aria-label="Bộ lọc">' +
        [['all', 'Tất cả'], ['n25', 'Sửa đổi 2025'], ['am', 'Có dấu (*)']].map(function (x) {
          return '<button type="button" class="chip" data-loc="' + x[0] + '" aria-pressed="' + (filter === x[0]) + '">' + x[1] + '</button>';
        }).join('') +
        '<button type="button" class="chip" data-exp="1">Mở hết</button><button type="button" class="chip" data-exp="0">Thu gọn</button></div></div></div>' +
        '<div class="wrap" id="tocBody"></div>';
      var body = $('#tocBody'), q = $('#tocQ');
      var draw = function () {
        var v = q.value.trim(), cq = v ? window.LX.compile(window.LX.parseQuery(v), { prefix: true }) : null;
        var num = /^\d{1,3}[a-z]?$/.test(v) ? v : null;
        var h = '';
        DB.parts.forEach(function (p) {
          var ch = DB.chaps.filter(function (c) { return c.part === p.id; }), ph = '';
          ch.forEach(function (c) {
            var arts = c.arts.filter(function (a) {
              if (filter === 'n25' && !a.n25) return false;
              if (filter === 'am' && !a.am) return false;
              if (!v) return true;
              if (num) return a.id === num || a.id.indexOf(num) === 0;
              return cq.test(a.t) || cq.test(c.name);
            });
            if (!arts.length) return;
            var open = !!v || filter !== 'all';
            var list = '', lastM = null;
            arts.forEach(function (a) {
              if (a.m && a.m !== lastM) { lastM = a.m; var mn = c.muc.filter(function (m) { return m.n === a.m; })[0]; if (mn) list += '<div class="tmuc">' + esc(mn.name) + '</div>'; }
              list += '<a class="ta' + (a.rep ? ' is-rep' : '') + '" href="#/dieu/' + a.id + '"><span class="an">Điều ' + esc(a.id) + '</span><span class="at">' + hl(a.t, cq) + '</span><span class="tags">' + artTags(a, true) + '</span></a>';
            });
            ph += '<details class="tch" data-c="' + c.id + '"' + (open ? ' open' : '') + '><summary><span class="cn">' + esc(c.num || 'TH') + '</span><span class="ct"><b>' + esc(c.title) + '</b>' +
              '<small>' + c.arts.length + ' điều · Điều ' + c.first.id + ' – ' + c.last.id + (c.muc.length ? ' · ' + c.muc.length + ' mục' : '') + ' · ~' + readMin(c.sz[0]) + ' phút đọc luật' + '</small>' +
              (CH_NOTE[c.id] ? ' <span class="tag tag--rep26">' + CH_NOTE[c.id].short + '</span>' : '') +
              '</span><a class="btn btn--sm btn--ghost" href="#/chuong/' + c.slug + '" onclick="event.stopPropagation()">Xem</a>' + ic('chev-d', 'chev') + '</summary><div class="tch-body"><a class="ta ch-open" href="#/chuong/' + c.slug + '">Xem trang tổng quan ' + esc(c.label) + ' ' + ic('arrow-r') + '</a>' + list + '</div></details>';
          });
          if (ph) h += '<section class="toc-part"><h2><small>' + esc(p.label) + '</small>' + esc(p.name) + '</h2>' + ph + '</section>';
        });
        body.innerHTML = h || '<div class="empty">' + ic('search') + '<h3>Không có điều nào phù hợp</h3><p>Thử từ khóa khác hoặc <a href="#/tim-kiem?q=' + encodeURIComponent(v) + '">tìm trong toàn văn</a>.</p></div>';
      };
      q.addEventListener('input', debounce(draw, 120));
      main.addEventListener('click', function (e) {
        var b = e.target.closest('[data-loc]');
        if (b) { filter = b.dataset.loc; $$('[data-loc]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); draw(); return; }
        var x = e.target.closest('[data-exp]');
        if (x) $$('.tch', body).forEach(function (d) { d.open = x.dataset.exp === '1'; });
      });
      draw();
      return null;
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
        list += '<a class="ca" href="#/dieu/' + a.id + '"><span class="cn"><small>Điều</small><b>' + esc(a.id) + '</b></span><h3>' + esc(a.t) + '</h3>' +
          '<p>' + esc(a.M.ex || '') + '</p><span class="cm">' + (k ? '<span class="tag tag--c' + k.c + '">' + esc(Pen.maxText(a)) + '</span>' : '') + artTags(a, true) +
          (a.M.a14 ? '<span class="tag tag--a14">Từ đủ 14 tuổi chịu TNHS</span>' : '') + '</span></a>';
      });
      main.innerHTML =
        '<section class="ph">' + drum() + '<div class="wrap ph-in">' + crumb([['Trang chủ', '#/'], ['Mục lục', '#/muc-luc'], [c.label]]) +
        '<span class="eyebrow">' + esc(DB.partName(c.part)) + '</span><h1>' + esc(c.title) + '</h1>' +
        '<div class="ph-meta"><span>' + ic('book') + c.arts.length + ' điều (Điều ' + c.first.id + ' – ' + c.last.id + ')</span>' +
        '<span>' + ic('clock') + '~' + lawMin + ' phút đọc luật · ~' + cmMin + ' phút bình luận</span>' +
        (nTH ? '<span>' + ic('alert') + nTH + ' điều có khung tử hình</span>' : '') + '</div>' +
        '<div class="ph-acts"><a class="btn btn--g" href="#/dieu/' + c.first.id + '">' + ic('book') + 'Đọc từ Điều ' + c.first.id + '</a>' +
        (prev ? '<a class="btn" href="#/chuong/' + prev.slug + '">' + ic('chev-l') + esc(prev.label) + '</a>' : '') +
        (next ? '<a class="btn" href="#/chuong/' + next.slug + '">' + esc(next.label) + ic('chev-r') + '</a>' : '') + '</div></div></section>' +
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
          h = h.replace(/^(\d{1,2})\.\s*/, '<a class="kn" href="#/dieu/' + a.id + '?k=$1" data-k="$1" title="Liên kết tới khoản $1">$1.</a> ');
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
    h = h.replace(/href="#d(\w+)"/g, 'href="#/dieu/$1" data-pv="$1"');
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
      '<aside class="side" aria-label="Mục lục điều luật"><div class="side-h"><input class="inp" id="sideQ" type="search" placeholder="Lọc nhanh điều luật…" aria-label="Lọc mục lục"></div><div class="side-b" id="sideB"></div></aside>' +
      '<article class="art" id="art">' +
      '<header class="art-h">' + crumb([['Trang chủ', '#/'], [c.label, '#/chuong/' + c.slug], ['Điều ' + a.id]]) +
      '<div class="art-tags"><span class="tag tag--soft">' + esc(DB.partName(c.part).split(':')[0]) + '</span><a class="tag tag--soft" href="#/chuong/' + c.slug + '">' + esc(c.label) + '</a>' + artTags(a) + (M.a14 ? '<span class="tag tag--a14" title="Người từ đủ 14 đến dưới 16 tuổi chịu TNHS ở khung rất nghiêm trọng, đặc biệt nghiêm trọng">Từ đủ 14 tuổi chịu TNHS (khoản 2 Điều 12)</span>' : '') + '</div>' +
      '<h1><span class="dn">Điều ' + esc(a.id) + '.</span> ' + esc(a.t) + '</h1>' +
      '<div class="art-sum"><span>' + ic(ICONS[c.id] || 'book') + esc(c.name) + '</span>' + (muc ? '<span>' + ic('list') + esc(muc) + '</span>' : '') +
      '<span>' + ic('clock') + '~' + readMin(M.ln ? M.ln[0] : 0) + ' phút đọc' + (hasCm ? ' · bình luận ~' + readMin(M.ln[1]) + ' phút' : '') + '</span>' +
      (hasPen ? '<span>' + ic('scale') + esc(Pen.maxText(a)) + '</span>' : '') + '</div>' +
      '<div class="tools no-print">' +
      '<button type="button" class="btn btn--p" data-act="save" aria-pressed="' + Saved.has(a.id) + '">' + ic(Saved.has(a.id) ? 'bookmark-fill' : 'bookmark') + '<span>' + (Saved.has(a.id) ? 'Đã lưu' : 'Lưu điều này') + '</span></button>' +
      '<button type="button" class="btn" data-act="copy-art" title="Sao chép toàn văn điều luật">' + ic('copy') + '<span>Sao chép</span></button>' +
      '<button type="button" class="btn" data-act="share" title="Chia sẻ">' + ic('share') + '<span>Chia sẻ</span></button>' +
      '<a class="btn" href="#/cong-cu/so-sanh?a=' + a.id + '" title="So sánh với điều khác">' + ic('columns') + '<span>So sánh</span></a>' +
      '<button type="button" class="btn btn--ic" data-act="print" title="In điều luật" aria-label="In điều luật">' + ic('print') + '</button>' +
      '<button type="button" class="btn btn--ic" data-act="settings" title="Cỡ chữ & giao diện" aria-label="Cỡ chữ và giao diện">' + ic('text') + '</button>' +
      '</div></header>' +
      '<div class="tabs" role="tablist" aria-label="Nội dung điều luật">' +
      tabBtn('noi-dung', '<span class="tl-l">Nội dung điều luật</span><span class="tl-s">Điều luật</span>', null, tab) +
      (hasCm ? tabBtn('binh-luan', 'Bình luận', readMin(M.ln[1]) + ' phút', tab) : '') +
      tabBtn('lien-quan', 'Liên quan', relN || null, tab) + '</div>' +
      '<div id="panels"><div class="panel"><div class="skel" style="width:60%"></div><div class="skel"></div><div class="skel" style="width:85%"></div><div class="skel"></div></div></div>' +
      '<nav class="pager no-print" aria-label="Điều trước, điều sau">' +
      (prev ? '<a href="#/dieu/' + prev.id + '" rel="prev"><small>' + ic('chev-l') + 'Điều trước</small><span>Điều ' + esc(prev.id) + '. ' + esc(prev.t) + '</span></a>' : '<span></span>') +
      (next ? '<a class="nx" href="#/dieu/' + next.id + '" rel="next"><small>Điều sau' + ic('chev-r') + '</small><span>Điều ' + esc(next.id) + '. ' + esc(next.t) + '</span></a>' : '') +
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
      if (e.target.closest('input,textarea,select,[contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft' && prev) go('#/dieu/' + prev.id);
      if (e.key === 'ArrowRight' && next) go('#/dieu/' + next.id);
    };
    document.addEventListener('keydown', this.onKey);
    this.onScroll = function () {
      var el = $('#art'); if (!el) return;
      var r = el.getBoundingClientRect(), total = r.height - window.innerHeight + 120;
      var p = total > 0 ? Math.min(1, Math.max(0, (-r.top + 80) / total)) : 0;
      $('#progress').style.width = (p * 100) + '%';
    };
    window.addEventListener('scroll', this.onScroll, { passive: true });
  }
  function tabBtn(key, label, cnt, cur) {
    return '<button type="button" role="tab" id="tab-' + key + '" data-tab="' + key + '" aria-controls="p-' + key + '" aria-selected="' + (cur === key) + '">' + label + (cnt ? '<span class="cnt">' + cnt + '</span>' : '') + '</button>';
  }
  ArticleView.prototype.leave = function () {
    document.removeEventListener('keydown', this.onKey);
    window.removeEventListener('scroll', this.onScroll);
    $('#progress').style.width = '0';
  };
  ArticleView.prototype.side = function () {
    var a = this.a, box = $('#sideB'), q = $('#sideQ');
    var draw = function () {
      var v = q.value.trim(), cq = v ? window.LX.compile(window.LX.parseQuery(v), { prefix: true }) : null;
      var num = /^\d{1,3}[a-z]?$/.test(v) ? v : null, h = '', lastP = null;
      DB.chaps.forEach(function (c) {
        var arts = !v ? c.arts : c.arts.filter(function (x) { return num ? x.id.indexOf(num) === 0 : cq.test(x.t); });
        if (!arts.length) return;
        if (c.part !== lastP) { lastP = c.part; h += '<div class="sp">' + esc((DB.parts.filter(function (p) { return p.id === c.part; })[0] || {}).label || '') + '</div>'; }
        var open = c === a.ch || !!v;
        h += '<div class="sc' + (open ? ' open' : '') + '"><button type="button" aria-expanded="' + open + '">' + ic('chev-r') + '<span class="r">' + esc(c.num || 'TH') + '</span><span>' + esc(c.name) + '</span></button><div class="sc-l">' +
          arts.map(function (x) { return '<a href="#/dieu/' + x.id + '"' + (x === a ? ' class="on" aria-current="page"' : x.rep ? ' class="is-rep"' : '') + '><b>' + esc(x.id) + '</b><span>' + esc(x.t) + '</span></a>'; }).join('') + '</div></div>';
      });
      box.innerHTML = h;
    };
    q.addEventListener('input', debounce(draw, 120));
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.sc>button'); if (!b) return;
      var sc = b.parentNode; sc.classList.toggle('open'); b.setAttribute('aria-expanded', String(sc.classList.contains('open')));
    });
    draw();
    var on = $('.sc-l a.on', box);
    if (on) { box.scrollTop = on.offsetTop - box.clientHeight / 2 + 40; }
  };
  ArticleView.prototype.build = function (ctx) {
    var a = this.a, d = this.d, M = a.M, self = this;
    var L = lawHtml(a, d);
    var fnN = Object.keys(L.fnMap).length;
    var C = cmHtml(a, d, L.fnMap, fnN);
    this.fnMap = L.fnMap;
    var newNotes = d.cm.filter(function (p) { return p[0] === 'n'; });
    var chNote = CH_NOTE[a.ch.id];
    var penCard = (M.k || []).some(function (k) { return !k.bs; }) ?
      '<details class="rc mob-only" open style="margin-bottom:16px"><summary style="cursor:pointer;font-weight:700;display:flex;gap:8px;align-items:center">' + ic('scale') + 'Tóm tắt khung hình phạt</summary><div style="margin-top:12px">' + Pen.chart(a, true) + '</div></details>' : '';
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
    this.show(ctx.parts[2] || 'noi-dung', true);
    var q = ctx.q.get('q');
    if (q) this.highlight(q);
    var k = ctx.q.get('k');
    if (k) setTimeout(function () { self.focusK(k, ctx.q.get('d')); }, 30);
    $('.tabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]'); if (!b) return;
      var t = b.dataset.tab, base = '#/dieu/' + a.id + (t === 'noi-dung' ? '' : '/' + t);
      history.replaceState(null, '', base);
      Router.cur = parseHash();
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
        return '<a href="#/dieu/' + a.id + '?k=' + k + '" data-k="' + k + '"><b>Khoản ' + k + '</b><span>' + esc(p.length > 70 ? p.slice(0, 68) + '…' : p) + '</span></a>';
      }).join('') + '</div></div>' : '';
    var pen = (M.k || []).some(function (k) { return !k.bs; }) ? '<div class="rc"><h3>' + ic('scale') + 'Khung hình phạt</h3>' + Pen.chart(a, true) + '</div>' : '';
    var refs = (M.ol || []).concat(M.in || []).filter(function (x, i, arr) { return arr.indexOf(x) === i && DB.byId[x]; }).slice(0, 8);
    var rl = refs.length ? '<div class="rc"><h3>' + ic('link') + 'Điều luật liên quan</h3><div class="rl">' + refs.map(function (id) {
      var x = DB.byId[id]; return '<a href="#/dieu/' + id + '" data-pv="' + id + '"><b>Điều ' + esc(id) + '</b><span>' + esc(x.t) + '</span></a>';
    }).join('') + '</div></div>' : '';
    $('#rail').innerHTML = pen + kl + rl + '<div class="rc"><h3>' + ic('note') + 'Ghi chú của tôi</h3>' + noteBox(a.id, 'r') + '</div>';
  };

  /* ---------- Tìm kiếm toàn văn ---------- */
  VIEWS['tim-kiem'] = {
    nav: 'tim-kiem',
    render: function (ctx, main) {
      var q = (ctx.q.get('q') || '').trim();
      var scope = ctx.q.get('pv') || 'all', chap = ctx.q.get('ch') || '', sort = ctx.q.get('sx') || 'rel';
      setTitle(q ? 'Tìm “' + q + '”' : 'Tìm kiếm');
      main.innerHTML =
        '<section class="ph">' + drum() + '<div class="wrap ph-in">' + crumb([['Trang chủ', '#/'], ['Tìm kiếm']]) +
        '<h1>Tìm kiếm trong Bộ luật Hình sự</h1><p>Tìm đồng thời trong tên điều, văn bản điều luật và phần bình luận. Gõ không dấu, dùng “ngoặc kép” để tìm cụm từ chính xác.</p>' +
        '<div id="srBox" style="margin-top:18px;max-width:760px"></div></div></section>' +
        '<div class="wrap"><div id="srOut"></div></div>';
      var box = SearchBox($('#srBox'), { value: q, ph: 'Nhập từ khóa, cụm từ hoặc số điều…', onSubmit: function (v) { rememberQ(v); go('#/tim-kiem?q=' + encodeURIComponent(v)); } });
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
        return '<a class="chip" href="#/dieu/' + x + '" data-pv="' + x + '">Điều ' + x + ' · ' + esc(DB.byId[x].t.replace(/^Tội /, '')) + '</a>';
      }).join('') + '</div>' : '';
      out.innerHTML = '<div style="margin-top:22px">' + goCard + sugg + '</div><div class="sr-meta" id="srMeta"><span class="spinner"></span> Đang nạp toàn văn để tìm kiếm…</div><div id="srRes"></div>';
      var onFt = function (t, m) {
        if (t === 'progress' && $('#srMeta') && !FT.ready) $('#srMeta').innerHTML = '<span class="spinner"></span> Đang nạp toàn văn… ' + m.done + '/' + m.total + ' chương';
        if (t === 'error' && $('#srMeta')) $('#srMeta').innerHTML = 'Không tải được dữ liệu tìm kiếm. Vui lòng kiểm tra kết nối mạng.';
      };
      FT.on(onFt);
      var view = { leave: function () { FT.off(onFt); } };
      var t0 = Date.now();
      FT.query(q).then(function (res) {
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
    var base = '#/tim-kiem?q=' + encodeURIComponent(o.q);
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
      var a = DB.byId[r.id], href = '#/dieu/' + a.id + '?q=' + encodeURIComponent(o.q);
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
        return '<div class="sv"><a class="t" href="#/dieu/' + a.id + '"><b>Điều ' + esc(a.id) + ' · ' + esc(a.ch.label) + '</b><span>' + esc(a.t) + '</span>' + (extra || '') + '</a>' +
          '<time>' + when(t) + '</time><button type="button" class="hd-ic" style="color:var(--faint)" data-rm="' + kind + ':' + esc(a.id) + '" aria-label="Xóa">' + ic('trash') + '</button></div>';
      };
      var body;
      if (tab === 'ghi-chu') body = nk.length ? nk.sort(function (x, y) { return notes[y].t - notes[x].t; }).map(function (id) { return row(id, notes[id].t, '<div class="note">' + esc(notes[id].x) + '</div>', 'note'); }).join('') : emptyHtml('note', 'Chưa có ghi chú', 'Mở một điều luật và ghi chú ở khung “Ghi chú của tôi”.');
      else if (tab === 'lich-su') body = hist.length ? hist.map(function (x) { return row(x.id, x.t, '', 'hist'); }).join('') : emptyHtml('history', 'Chưa có lịch sử', 'Các điều bạn đã xem sẽ xuất hiện ở đây.');
      else body = saved.length ? saved.map(function (x) { return row(x.id, x.t, '', 'saved'); }).join('') : emptyHtml('bookmark', 'Chưa lưu điều luật nào', 'Nhấn “Lưu điều này” trên trang điều luật để đánh dấu và đọc lại nhanh.');
      main.innerHTML =
        '<section class="ph">' + drum() + '<div class="wrap ph-in">' + crumb([['Trang chủ', '#/'], ['Đã lưu']]) +
        '<h1>Đã lưu, ghi chú & lịch sử</h1><p>Dữ liệu chỉ lưu trên trình duyệt của thiết bị này, không gửi đi đâu.</p></div></section>' +
        '<div class="wrap page"><div class="filters">' +
        [['luu', 'Đã lưu', saved.length], ['ghi-chu', 'Ghi chú', nk.length], ['lich-su', 'Lịch sử', hist.length]].map(function (x) {
          return '<a class="chip' + (tab === x[0] ? ' on' : '') + '" href="#/da-luu' + (x[0] === 'luu' ? '' : '?tab=' + x[0]) + '">' + x[1] + ' <span class="n">' + x[2] + '</span></a>';
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
        '<section class="ph">' + drum() + '<div class="wrap ph-in">' + crumb([['Trang chủ', '#/'], ['Giới thiệu']]) +
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
        '<h3 class="ch">Phím tắt</h3><p><b>/</b> – mở ô tìm kiếm · <b>←</b> <b>→</b> – điều trước/sau khi đang đọc · <b>Esc</b> – đóng gợi ý, cửa sổ.</p>' +
        '<h3 class="ch">Miễn trừ trách nhiệm</h3><p>Nội dung trên trang nhằm mục đích tham khảo, không thay thế ý kiến tư vấn pháp lý. Khi sử dụng trong hồ sơ tố tụng, vui lòng đối chiếu văn bản đăng trên Công báo, Cơ sở dữ liệu quốc gia về pháp luật hoặc văn bản hợp nhất mới nhất của Văn phòng Quốc hội.</p>' +
        '</div></div>' + ctaBlock();
      return null;
    }
  };

  VIEWS._404 = {
    render: function (ctx, main, msg) {
      setTitle('Không tìm thấy');
      main.innerHTML = '<div class="wrap page"><div class="empty">' + ic('alert') + '<h3>Không tìm thấy trang</h3><p>' + esc(msg || 'Đường dẫn không tồn tại hoặc đã thay đổi.') + '</p>' +
        '<p style="margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn btn--p" href="#/">Về trang chủ</a><a class="btn" href="#/muc-luc">Xem mục lục</a></p></div></div>';
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
      '<div class="pv-a"><a class="btn btn--p btn--sm" href="#/dieu/' + a.id + '">Mở Điều ' + esc(a.id) + ic('arrow-r') + '</a>' +
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
    document.addEventListener('click', function (e) {
      var t = e.target;
      var link = t.closest('a[href^="#/"]');
      if (link && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey) Router.byClick = true;
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
        else go('#/tim-kiem?q=' + encodeURIComponent(v));
        return;
      }
      var kk = t.closest('a.kn, .rc .kl a[data-k], .pen-row a[data-k]');
      if (kk && Router.view && Router.view.focusK) {
        e.preventDefault();
        var k = kk.dataset.k;
        history.replaceState(null, '', '#/dieu/' + Router.view.a.id + '?k=' + k);
        Router.cur = parseHash();
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
      if (kl && Router.view && Router.view.a) { UI.copy(location.href.split('#')[0] + '#/dieu/' + Router.view.a.id + '?k=' + kl.dataset.klink, 'Đã sao chép liên kết'); return; }
      var act = t.closest('[data-act]');
      if (!act) return;
      var A = act.dataset.act, V = Router.view;
      if (A === 'drawer') UI.drawer(true);
      else if (A === 'drawer-close') UI.drawer(false);
      else if (A === 'sheet-close') UI.closeSheet();
      else if (A === 'settings') { UI.drawer(false); UI.settings(); }
      else if (A === 'theme') {
        var cur = Prefs.get().theme || 'auto', dark = cur === 'dark' || (cur === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        Prefs.set('theme', dark ? 'light' : 'dark'); UI.toast(dark ? 'Đã chuyển sang giao diện sáng' : 'Đã chuyển sang giao diện tối');
      }
      else if (A === 'find') { go('#/tim-kiem'); }
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
          var url = location.href.split('?')[0].replace(/\/(binh-luan|lien-quan)$/, '');
          if (navigator.share) navigator.share({ title: 'Điều ' + art.id + '. ' + art.t, text: 'Điều ' + art.id + '. ' + art.t + ' – ' + CITE, url: url }).catch(function () { });
          else UI.copy(url, 'Đã sao chép liên kết Điều ' + art.id);
        } else if (A === 'print') { window.print(); }
      }
    });
    document.addEventListener('click', function (e) {
      var s = e.target.closest('#sheetBody [data-set] button');
      if (s) {
        var key = s.parentNode.dataset.set, v = s.dataset.v;
        $$('button', s.parentNode).forEach(function (b) { b.setAttribute('aria-pressed', String(b === s)); });
        if (key === 'theme') Prefs.set('theme', v);
        if (key === 'serif') Prefs.set('serif', v === '1');
      }
      var f = e.target.closest('#sheetBody [data-fs]');
      if (f) {
        var fs = Math.max(-2, Math.min(5, (Prefs.get().fs || 0) + (+f.dataset.fs)));
        Prefs.set('fs', fs); $('#fsOut').textContent = (100 + fs * 6) + '%';
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
      if (e.key === 'Escape') { UI.closePop(); UI.closeSheet(); UI.drawer(false); }
      if (e.key === '/' && !e.target.closest('input,textarea,select,[contenteditable]')) {
        var inp = $('#heroSearch .sb-in') || $('#srBox .sb-in') || $('#hdSearch .sb-in');
        if (inp && inp.offsetParent) { e.preventDefault(); inp.focus(); inp.select(); }
        else { e.preventDefault(); go('#/tim-kiem'); }
      }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('sup.fn')) { e.preventDefault(); e.target.click(); }
    });
    var tt = $('#toTop');
    window.addEventListener('scroll', function () { tt.classList.toggle('on', window.scrollY > 900); }, { passive: true });
    tt.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    window.addEventListener('hashchange', route);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', Prefs.apply);
  }

  function offline(btn) {
    if (!('caches' in window)) { UI.toast('Trình duyệt không hỗ trợ lưu ngoại tuyến'); return; }
    var files = DB.chaps.map(function (c) { return 'data/' + c.id + '.json?v=' + DB.v; });
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
    SearchBox: SearchBox, artCard: artCard, artTags: artTags, toolCards: toolCards, lawHtml: lawHtml, Router: Router, citeText: citeText
  };

  Prefs.apply();
  bindGlobal();
  var domReady = new Promise(function (res) {
    if (document.readyState !== 'loading') res(); else document.addEventListener('DOMContentLoaded', res);
  });
  Promise.all([DB.init(), domReady]).then(function () {
    SearchBox($('#hdSearch'), { kbd: true, go: false });
    if (!location.hash) history.replaceState(null, '', '#/');
    route();
    // Khởi động trước luồng tìm kiếm nền khi trình duyệt rảnh
    var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 2500); };
    idle(function () { FT.start(); });
  }).catch(function (err) {
    $('#main').innerHTML = '<div class="wrap page"><div class="empty">' + ic('alert') + '<h3>Không tải được dữ liệu</h3><p>Vui lòng kiểm tra kết nối mạng rồi <a href="javascript:location.reload()">tải lại trang</a>.</p><p class="muted" style="font-size:.8rem;margin-top:8px">' + esc(err && err.message) + '</p></div></div>';
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { }); });
  }
})();
