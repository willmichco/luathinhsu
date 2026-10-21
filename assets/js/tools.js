/*
 * Công cụ nghiên cứu: phân loại tội & thời hiệu, tuổi chịu TNHS, thời hiệu thi hành án,
 * so sánh điều luật, bảng khung hình phạt.
 * Mọi kết luận được suy ra từ câu chữ điều luật trong dữ liệu (Điều 9, 12, 14, 27, 28, 60, 61).
 */
(function () {
  'use strict';
  var A = window.App, $ = A.$, $$ = A.$$, esc = A.esc, ic = A.ic, DB = A.DB, Pen = A.Pen, CLS = A.CLS;
  var POINT = { 1: 'a', 2: 'b', 3: 'c', 4: 'd' };
  var AGE14_NOTE = 'khoản 2 Điều 12';

  /* ---------- Tiện ích ngày tháng ---------- */
  function parseD(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function isoD(d) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  // Ngày tương ứng sau n năm; nếu không có ngày tương ứng (29/02) thì lấy ngày cuối tháng
  function addYears(d, n) {
    var r = new Date(d.getFullYear() + n, d.getMonth(), 1);
    var last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
    r.setDate(Math.min(d.getDate(), last));
    return r;
  }
  function diff(a, b) { // a <= b → {y, m, d}
    var y = b.getFullYear() - a.getFullYear(), m = b.getMonth() - a.getMonth(), d = b.getDate() - a.getDate();
    if (d < 0) { m--; d += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); }
    if (m < 0) { y--; m += 12; }
    return { y: y, m: m, d: d };
  }
  function span(o) {
    var s = [];
    if (o.y) s.push(o.y + ' năm');
    if (o.m) s.push(o.m + ' tháng');
    if (o.d || !s.length) s.push(o.d + ' ngày');
    return s.join(' ');
  }
  function today() { var t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
  var fd = A.fmtDate;
  // Khung mặc định khi chọn một điều: khoản đầu tiên có khung hình phạt chính (tội phạm ở dạng cơ bản)
  function firstK(a) { var k = (a.M.k || []).filter(function (x) { return !x.bs; })[0]; return k ? k.n : null; }
  function lk(id, label) { return '<a href="dieu-' + id + '" data-pv="' + id + '">' + (label || 'Điều ' + id) + '</a>'; }

  /* ---------- Ô chọn điều luật ---------- */
  function ArtPicker(host, opt) {
    host.innerHTML = '<div class="combo"><div class="sb-box">' + ic('search') +
      '<input class="sb-in" type="search" placeholder="' + esc(opt.ph || 'Gõ số điều hoặc tên tội…') + '" aria-label="' + esc(opt.label || 'Chọn điều luật') + '" autocomplete="off" spellcheck="false"></div>' +
      '<div class="combo-dd" role="listbox" hidden></div></div>';
    var inp = $('input', host), dd = $('.combo-dd', host), list = [], sel = 0, cur = null;
    var pool = DB.arts.filter(opt.filter || function () { return true; });
    function setVal(a) { cur = a; inp.value = a ? 'Điều ' + a.id + '. ' + a.t : ''; }
    function draw() {
      var v = inp.value.trim();
      if (cur && v === 'Điều ' + cur.id + '. ' + cur.t) v = '';
      var num = /^(?:d|đ|điều|dieu)?\s*(\d{1,3}[a-z]?)$/i.exec(v);
      var cq = v && !num ? window.LX.compile(window.LX.parseQuery(v), { prefix: true }) : null;
      list = pool.filter(function (a) { return !v || (num ? a.id.indexOf(num[1]) === 0 : cq.test(a.t)); }).slice(0, 40);
      if (num) list.sort(function (x, y) { return (x.id === num[1] ? -1 : 0) - (y.id === num[1] ? -1 : 0); });
      sel = 0;
      dd.innerHTML = list.length ? list.map(function (a, i) {
        return '<button type="button" role="option" data-i="' + i + '" aria-selected="' + (i === sel) + '"><b>Điều ' + esc(a.id) + '</b><span>' + esc(a.t) + '</span></button>';
      }).join('') : '<div class="muted" style="padding:10px">Không có điều phù hợp</div>';
      dd.hidden = false;
    }
    function pick(a) { setVal(a); dd.hidden = true; opt.onChange(a); }
    inp.addEventListener('focus', function () { inp.select(); draw(); });
    inp.addEventListener('input', draw);
    inp.addEventListener('keydown', function (e) {
      if (dd.hidden) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); sel = Math.max(0, Math.min(list.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1)));
        $$('button', dd).forEach(function (b) { b.setAttribute('aria-selected', String(+b.dataset.i === sel)); });
        var b = $('button[data-i="' + sel + '"]', dd); if (b) b.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') { e.preventDefault(); if (list[sel]) pick(list[sel]); }
      else if (e.key === 'Escape') { dd.hidden = true; }
    });
    dd.addEventListener('mousedown', function (e) { e.preventDefault(); });
    dd.addEventListener('click', function (e) { var b = e.target.closest('button[data-i]'); if (b) pick(list[+b.dataset.i]); });
    inp.addEventListener('blur', function () { setTimeout(function () { dd.hidden = true; if (cur) setVal(cur); }, 120); });
    if (opt.value) setVal(opt.value);
    return { set: setVal, get: function () { return cur; } };
  }

  function page(title, sub, crumbName, body) {
    return '<section class="ph">' + A.drum() + '<div class="wrap ph-in">' +
      A.crumb([['Trang chủ', './'], ['Công cụ', 'cong-cu']].concat(crumbName ? [[crumbName]] : [])) +
      '<span class="eyebrow">Công cụ nghiên cứu</span><h1>' + title + '</h1><p>' + sub + '</p></div></section>' +
      '<div class="wrap page">' + body + '</div>';
  }
  function replaceQuery(params) {
    var q = new URLSearchParams();
    Object.keys(params).forEach(function (k) { if (params[k] != null && params[k] !== '') q.set(k, params[k]); });
    var s = q.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
    A.Router.cur = A.parseRoute();
  }
  var disclaimer = '<div class="callout callout--info">' + ic('info') + '<div>Kết quả được tính tự động từ câu chữ điều luật để hỗ trợ nghiên cứu. Việc xác định tội danh, khung hình phạt và thời hiệu trong vụ án cụ thể thuộc thẩm quyền của cơ quan tiến hành tố tụng, căn cứ hồ sơ và hướng dẫn áp dụng pháp luật hiện hành.</div></div>';

  /* =========================================================================
     Trang tổng hợp công cụ
     ========================================================================= */
  function hub(ctx, main) {
    A.setTitle('Công cụ nghiên cứu');
    var rows9 = [1, 2, 3, 4].map(function (c) {
      return '<tr><td><span class="tag tag--c' + c + '">' + CLS[c].n + '</span></td><td data-l="Mức cao nhất của khung">' + CLS[c].d + '</td><td data-l="Căn cứ">Điểm ' + POINT[c] + ' khoản 1 Điều 9</td><td data-l="Thời hiệu"><b>' + CLS[c].th + ' năm</b></td></tr>';
    }).join('');
    main.innerHTML = page('Công cụ hỗ trợ nghiên cứu', 'Các phép tính được xây dựng trực tiếp từ quy định của Bộ luật Hình sự, giúp luật sư, sinh viên và người dân tra cứu nhanh, có căn cứ.', null,
      A.toolCards() +
      '<section class="sec"><div class="sec-h"><div><h2>Bảng tra nhanh: phân loại tội phạm & thời hiệu</h2><p>Khoản 1 Điều 9 và khoản 2 Điều 27</p></div></div>' +
      '<div style="overflow:auto"><table class="cmp-tbl cmp-tbl--stack"><thead><tr><th>Loại tội phạm</th><th>Mức cao nhất của khung hình phạt</th><th>Căn cứ</th><th>Thời hiệu truy cứu</th></tr></thead><tbody>' + rows9 + '</tbody></table></div>' +
      '<p class="legal-src">' + ic('info') + 'Không áp dụng thời hiệu truy cứu đối với: các tội tại Chương XIII, Chương XXVI; tội tham ô tài sản, nhận hối lộ thuộc khoản 3, khoản 4 Điều 353, Điều 354 (' + lk('28', 'Điều 28') + ').</p></section>' +
      '<section class="sec"><div class="sec-h"><div><h2>Thời hiệu thi hành bản án</h2><p>Khoản 2, khoản 3 Điều 60</p></div></div>' +
      '<div style="overflow:auto"><table class="cmp-tbl"><thead><tr><th>Hình phạt đã tuyên</th><th>Thời hiệu</th></tr></thead><tbody>' +
      '<tr><td>Phạt tiền, cải tạo không giam giữ hoặc phạt tù từ 03 năm trở xuống</td><td><b>05 năm</b></td></tr>' +
      '<tr><td>Phạt tù từ trên 03 năm đến 15 năm</td><td><b>10 năm</b></td></tr>' +
      '<tr><td>Phạt tù từ trên 15 năm đến 30 năm</td><td><b>15 năm</b></td></tr>' +
      '<tr><td>Tù chung thân hoặc tử hình</td><td><b>20 năm</b></td></tr>' +
      '<tr><td>Pháp nhân thương mại bị kết án</td><td><b>05 năm</b></td></tr></tbody></table></div></section>');
    return null;
  }

  /* =========================================================================
     1. Phân loại tội phạm & thời hiệu truy cứu TNHS
     ========================================================================= */
  var MANUAL = [
    [1, 'Chỉ phạt cảnh cáo, phạt tiền hoặc cải tạo không giam giữ', 'phạt tiền, cải tạo không giam giữ'],
    [1, 'Phạt tù đến 03 năm', 'phạt tù đến 03 năm'],
    [2, 'Phạt tù từ trên 03 năm đến 07 năm', 'từ trên 03 năm tù đến 07 năm tù'],
    [3, 'Phạt tù từ trên 07 năm đến 15 năm', 'từ trên 07 năm tù đến 15 năm tù'],
    [4, 'Phạt tù từ trên 15 năm đến 20 năm', 'từ trên 15 năm tù đến 20 năm tù'],
    [4, 'Tù chung thân', 'tù chung thân'],
    [4, 'Tử hình', 'tử hình']
  ];
  function thoiHieu(ctx, main) {
    A.setTitle('Phân loại tội & thời hiệu truy cứu');
    var st = {
      mode: ctx.q.get('m') ? 'manual' : 'art',
      a: DB.byId[ctx.q.get('a')] || null, k: ctx.q.get('k') || null,
      lv: +(ctx.q.get('m') || 3), nl: ctx.q.get('nl') === '1',
      d0: ctx.q.get('d') || '', nc: '', nw: ''
    };
    if (st.a && !st.k) st.k = firstK(st.a);
    main.innerHTML = page('Phân loại tội phạm & thời hiệu truy cứu', 'Chọn điều luật và khoản (hoặc tự nhập mức cao nhất của khung hình phạt) để xác định loại tội theo Điều 9 và thời hiệu truy cứu trách nhiệm hình sự theo Điều 27, Điều 28.', 'Thời hiệu',
      '<div class="tool"><form class="tool-form" onsubmit="return false">' +
      '<div class="seg" role="group" aria-label="Cách nhập"><button type="button" data-mode="art" aria-pressed="' + (st.mode === 'art') + '">Theo điều luật</button><button type="button" data-mode="manual" aria-pressed="' + (st.mode === 'manual') + '">Tự nhập khung</button></div>' +
      '<div id="mArt"><label class="field"><span>Điều luật (Phần thứ hai – các tội phạm)</span><div id="pick"></div></label>' +
      '<div class="field" style="margin-top:14px"><span>Khung hình phạt áp dụng (khoản)</span><div class="kpick" id="kpick"></div><small>Mỗi khoản là một khung hình phạt; loại tội xác định theo mức cao nhất của khung được áp dụng.</small></div></div>' +
      '<div id="mMan"><label class="field"><span>Mức cao nhất của khung hình phạt</span><select class="inp" id="lv">' +
      MANUAL.map(function (x, i) { return '<option value="' + (i + 1) + '"' + (st.lv === i + 1 ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="check" style="margin-top:12px"><input type="checkbox" id="nl"' + (st.nl ? ' checked' : '') + '><span>Tội thuộc Chương XIII, Chương XXVI hoặc khoản 3, 4 Điều 353, Điều 354</span></label></div>' +
      '<label class="field"><span>Ngày tội phạm được thực hiện (không bắt buộc)</span><input class="inp" type="date" id="d0" value="' + esc(st.d0) + '" max="' + isoD(today()) + '"></label>' +
      '<label class="check"><input type="checkbox" id="cnc"><span>Trong thời hạn, người phạm tội lại thực hiện tội phạm mới mà mức cao nhất của khung hình phạt trên 01 năm tù</span></label>' +
      '<label class="field" id="fnc" hidden><span>Ngày thực hiện tội phạm mới</span><input class="inp" type="date" id="dnc"></label>' +
      '<label class="check"><input type="checkbox" id="cnw"><span>Người phạm tội cố tình trốn tránh và đã có quyết định truy nã</span></label>' +
      '<label class="field" id="fnw" hidden><span>Ngày ra đầu thú hoặc bị bắt giữ</span><input class="inp" type="date" id="dnw"></label>' +
      '</form><div class="tool-out" id="out" aria-live="polite"></div></div>');
    var picker = ArtPicker($('#pick'), {
      value: st.a, ph: 'Ví dụ: 173 hoặc trộm cắp',
      filter: function (a) { return (a.M.k || []).some(function (k) { return !k.bs; }); },
      onChange: function (a) { st.a = a; st.k = firstK(a); drawK(); calc(); }
    });
    function drawK() {
      var box = $('#kpick');
      if (!st.a) { box.innerHTML = '<span class="muted" style="font-size:.88rem">Chọn điều luật trước</span>'; return; }
      box.innerHTML = (st.a.M.k || []).filter(function (k) { return !k.bs; }).map(function (k) {
        return '<button type="button" class="chip" data-k="' + k.n + '" aria-pressed="' + (st.k === k.n) + '" title="' + esc(k.txt) + '">' + (k.n ? 'Khoản ' + k.n : 'Điều luật') + ' · ' + esc(Pen.label(k)) + '</button>';
      }).join('');
    }
    function mode(m) {
      st.mode = m;
      $$('[data-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === m)); });
      $('#mArt').hidden = m !== 'art'; $('#mMan').hidden = m !== 'manual';
      calc();
    }
    function calc() {
      var out = $('#out'), c, nl = false, desc, a = null, k = null;
      if (st.mode === 'art') {
        a = st.a;
        if (!a) { out.innerHTML = '<div class="res"><h3>Hướng dẫn</h3><p class="sub" style="margin:0">Chọn một điều luật thuộc Phần thứ hai, sau đó chọn khoản (khung hình phạt) cần xem.</p><div class="presets" style="margin-top:12px">' +
          ['173', '134', '174', '251', '353'].map(function (id) { return '<button type="button" class="chip" data-pa="' + id + '">Điều ' + id + '</button>'; }).join('') + '</div></div>'; replaceQuery({}); return; }
        k = (a.M.k || []).filter(function (x) { return x.n === st.k && !x.bs; })[0] || (a.M.k || []).filter(function (x) { return !x.bs; })[0];
        c = k.c; nl = Pen.noLimit(a, k.n);
        desc = (k.n ? 'Khoản ' + k.n + ' ' : '') + 'Điều ' + a.id + ': ' + k.txt.charAt(0).toLowerCase() + k.txt.slice(1);
        replaceQuery({ a: a.id, k: k.n, d: st.d0 });
      } else {
        var mv = MANUAL[st.lv - 1]; c = mv[0]; nl = st.nl; desc = 'Mức cao nhất của khung hình phạt: ' + mv[2];
        replaceQuery({ m: st.lv, nl: st.nl ? 1 : '', d: st.d0 });
      }
      var C = CLS[c];
      var html = '<div class="res c' + c + '"><h3>Loại tội phạm</h3><div class="big">Tội phạm ' + C.n.toLowerCase() + '</div>' +
        '<div class="sub">' + esc(desc) + '</div>' +
        '<div class="ladder">' + [1, 2, 3, 4].map(function (i) { return '<div class="l' + i + (i === c ? ' on' : '') + '"><b>' + CLS[i].n + '</b>' + CLS[i].d.replace('Phạt tiền, cải tạo không giam giữ hoặc phạt tù', 'Tiền, CTKGG, tù') + '</div>'; }).join('') + '</div>' +
        '<p class="legal-src">' + ic('scale') + 'Căn cứ: điểm ' + POINT[c] + ' khoản 1 ' + lk('9', 'Điều 9') + '</p></div>';
      if (nl) {
        html += '<div class="res c4"><h3>Thời hiệu truy cứu trách nhiệm hình sự</h3><div class="big">Không áp dụng thời hiệu</div>' +
          '<div class="sub">Người phạm tội có thể bị truy cứu trách nhiệm hình sự bất kể thời gian đã qua.</div><p class="legal-src">' + ic('scale') + 'Căn cứ: ' + lk('28', 'Điều 28') + '</p></div>';
      } else {
        html += '<div class="res"><h3>Thời hiệu truy cứu trách nhiệm hình sự</h3><div class="big">' + C.th + ' năm</div>' +
          '<div class="sub">Kể từ ngày tội phạm được thực hiện (khoản 3 Điều 27).</div><p class="legal-src">' + ic('scale') + 'Căn cứ: điểm ' + POINT[c] + ' khoản 2 ' + lk('27', 'Điều 27') + '</p>' + timeline(C.th) + '</div>';
      }
      if (a) html += ageNote(a, k);
      out.innerHTML = html + disclaimer;
    }
    function timeline(n) {
      var d0 = parseD(st.d0);
      if (!d0) return '<p class="sub" style="margin-top:10px">Nhập ngày thực hiện tội phạm để tính mốc hết thời hiệu.</p>';
      var start = d0, steps = ['Ngày tội phạm được thực hiện: <b>' + fd(d0) + '</b>'];
      var end = addYears(start, n);
      var dnc = $('#cnc').checked ? parseD($('#dnc').value) : null;
      if (dnc) {
        if (dnc > start && dnc < end) { start = dnc; end = addYears(start, n); steps.push('Thực hiện tội phạm mới ngày <b>' + fd(dnc) + '</b> (trong thời hạn) → thời hiệu đối với tội cũ được tính lại từ ngày này (khoản 3 Điều 27).'); }
        else steps.push('Ngày thực hiện tội phạm mới (' + fd(dnc) + ') không nằm trong thời hạn thời hiệu nên không làm tính lại thời hiệu.');
      }
      var dnw = $('#cnw').checked ? parseD($('#dnw').value) : null;
      if (dnw) {
        if (dnw > start) { start = dnw; end = addYears(start, n); steps.push('Có quyết định truy nã; ra đầu thú/bị bắt giữ ngày <b>' + fd(dnw) + '</b> → thời hiệu tính lại từ ngày này (khoản 3 Điều 27).'); }
        else steps.push('Ngày ra đầu thú/bị bắt giữ phải sau mốc đang tính (' + fd(start) + ').');
      }
      var t = today(), state;
      if (t < end) state = '<span class="tag tag--c1">Còn thời hiệu · khoảng ' + span(diff(t, end)) + '</span>';
      else state = '<span class="tag tag--c4">Đã hết thời hiệu (theo cách tính tham khảo)</span>';
      steps.push('Hết thời hiệu vào ngày tương ứng: <b>' + fd(end) + '</b> ' + state);
      return '<ul>' + steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul>';
    }
    main.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mode]'); if (b) { mode(b.dataset.mode); return; }
      var k = e.target.closest('#kpick [data-k]'); if (k) { st.k = k.dataset.k; drawK(); calc(); return; }
      var pa = e.target.closest('[data-pa]'); if (pa) { st.a = DB.byId[pa.dataset.pa]; picker.set(st.a); st.k = firstK(st.a); drawK(); calc(); }
    });
    $('#lv').addEventListener('change', function () { st.lv = +this.value; calc(); });
    $('#nl').addEventListener('change', function () { st.nl = this.checked; calc(); });
    $('#d0').addEventListener('change', function () { st.d0 = this.value; calc(); });
    $('#cnc').addEventListener('change', function () { $('#fnc').hidden = !this.checked; calc(); });
    $('#cnw').addEventListener('change', function () { $('#fnw').hidden = !this.checked; calc(); });
    $('#dnc').addEventListener('change', calc); $('#dnw').addEventListener('change', calc);
    drawK(); mode(st.mode);
    return null;
  }
  function ageNote(a, k) {
    var s;
    if (a.M.a14 && k.c >= 3) s = '<b>Người từ đủ 14 tuổi đến dưới 16 tuổi phải chịu trách nhiệm hình sự</b> ở khung này (tội ' + CLS[k.c].n.toLowerCase() + ', Điều ' + a.id + ' thuộc danh sách tại ' + AGE14_NOTE + ').';
    else if (a.M.a14) s = 'Điều ' + a.id + ' thuộc danh sách tại ' + AGE14_NOTE + ', nhưng khung này là tội ' + CLS[k.c].n.toLowerCase() + ' nên <b>người từ đủ 14 đến dưới 16 tuổi không phải chịu TNHS</b> ở khung này; người từ đủ 16 tuổi trở lên phải chịu TNHS.';
    else if (a.M.a18) s = 'Điều ' + a.id + ' quy định chủ thể là <b>người từ đủ 18 tuổi trở lên</b>; người dưới 18 tuổi không phải là chủ thể của tội này.';
    else s = 'Điều ' + a.id + ' không thuộc danh sách tại ' + AGE14_NOTE + ': <b>chủ thể phải từ đủ 16 tuổi trở lên</b>.';
    if (k.cb && (a.id === '123' || a.id === '168')) s += ' Riêng hành vi chuẩn bị phạm tội tại Điều ' + a.id + ', người từ đủ 14 đến dưới 16 tuổi phải chịu TNHS (khoản 3 ' + lk('14', 'Điều 14') + ').';
    return '<div class="res"><h3>Độ tuổi chịu trách nhiệm hình sự</h3><p style="line-height:1.6">' + s + '</p><p class="legal-src">' + ic('scale') + 'Căn cứ: ' + lk('12', 'Điều 12') + ' · <a href="cong-cu-tuoi?a=' + a.id + '&k=' + k.n + '">Tính tuổi cụ thể ' + ic('arrow-r') + '</a></p></div>';
  }

  /* =========================================================================
     2. Tuổi chịu trách nhiệm hình sự
     ========================================================================= */
  function tuoi(ctx, main) {
    A.setTitle('Tuổi chịu trách nhiệm hình sự');
    var st = { a: DB.byId[ctx.q.get('a')] || null, k: ctx.q.get('k') || null };
    main.innerHTML = page('Tuổi chịu trách nhiệm hình sự', 'Tính tuổi chính xác của người thực hiện hành vi tại thời điểm phạm tội và đối chiếu với Điều 12 Bộ luật Hình sự.', 'Tuổi chịu TNHS',
      '<div class="tool"><form class="tool-form" onsubmit="return false">' +
      '<label class="field"><span>Ngày, tháng, năm sinh</span><input class="inp" type="date" id="dob" max="' + isoD(today()) + '"></label>' +
      '<label class="field"><span>Ngày thực hiện hành vi</span><input class="inp" type="date" id="dact" value="' + isoD(today()) + '"><small>Tuổi được xác định tại thời điểm thực hiện hành vi phạm tội.</small></label>' +
      '<label class="field"><span>Tội danh (không bắt buộc)</span><div id="pick"></div><small>Chọn để biết người ở độ tuổi này có phải chịu TNHS về hành vi cụ thể không.</small></label>' +
      '<div class="field" id="kf" hidden><span>Khung hình phạt (khoản)</span><div class="kpick" id="kpick"></div></div>' +
      '</form><div class="tool-out" id="out" aria-live="polite"></div></div>');
    ArtPicker($('#pick'), {
      value: st.a, ph: 'Ví dụ: 134 hoặc cướp giật',
      filter: function (a) { return (a.M.k || []).some(function (k) { return !k.bs; }); },
      onChange: function (a) { st.a = a; st.k = null; drawK(); calc(); }
    });
    function drawK() {
      var kf = $('#kf'); kf.hidden = !st.a;
      if (!st.a) return;
      var ks = (st.a.M.k || []).filter(function (k) { return !k.bs; });
      if (!st.k || !ks.some(function (k) { return k.n === st.k; })) st.k = ks[0].n;
      $('#kpick').innerHTML = ks.map(function (k) {
        return '<button type="button" class="chip" data-k="' + k.n + '" aria-pressed="' + (st.k === k.n) + '">' + (k.n ? 'Khoản ' + k.n : 'Điều luật') + ' · ' + CLS[k.c].n + '</button>';
      }).join('');
    }
    function calc() {
      var out = $('#out'), dob = parseD($('#dob').value), dact = parseD($('#dact').value);
      if (!dob || !dact) {
        out.innerHTML = '<div class="res"><h3>Quy định tại Điều 12</h3><ul>' +
          '<li>Người từ <b>đủ 16 tuổi</b> trở lên phải chịu TNHS về mọi tội phạm, trừ những tội phạm mà Bộ luật có quy định khác.</li>' +
          '<li>Người từ <b>đủ 14 tuổi đến dưới 16 tuổi</b> chỉ phải chịu TNHS về tội phạm rất nghiêm trọng, đặc biệt nghiêm trọng tại 28 điều được liệt kê ở khoản 2 Điều 12.</li>' +
          '<li>Người <b>chưa đủ 14 tuổi</b> không phải chịu trách nhiệm hình sự.</li></ul>' + age14List() + '</div>' + disclaimer;
        return;
      }
      if (dact < dob) { out.innerHTML = '<div class="callout callout--warn">' + ic('alert') + '<div>Ngày thực hiện hành vi phải sau ngày sinh.</div></div>'; return; }
      var ag = diff(dob, dact), y = ag.y;
      var m14 = addYears(dob, 14), m16 = addYears(dob, 16), m18 = addYears(dob, 18);
      var cls, big, sub;
      if (y < 14) { cls = 'c1'; big = 'Chưa đủ 14 tuổi'; sub = 'Không phải chịu trách nhiệm hình sự (Điều 12).'; }
      else if (y < 16) { cls = 'c3'; big = 'Từ đủ 14 đến dưới 16 tuổi'; sub = 'Chỉ phải chịu TNHS về tội rất nghiêm trọng, đặc biệt nghiêm trọng tại các điều được liệt kê ở khoản 2 Điều 12.'; }
      else if (y < 18) { cls = 'c2'; big = 'Từ đủ 16 đến dưới 18 tuổi'; sub = 'Phải chịu TNHS về mọi tội phạm, trừ những tội phạm mà Bộ luật có quy định khác (khoản 1 Điều 12).'; }
      else { cls = 'c4'; big = 'Đủ 18 tuổi trở lên'; sub = 'Phải chịu trách nhiệm hình sự về mọi tội phạm (khoản 1 Điều 12).'; }
      var html = '<div class="res ' + cls + '"><h3>Tuổi tại thời điểm thực hiện hành vi</h3><div class="big">' + big + '</div>' +
        '<div class="sub">Chính xác: <b>' + span(ag) + '</b> (sinh ' + fd(dob) + ', hành vi ngày ' + fd(dact) + ')</div><p style="margin-top:10px;line-height:1.6">' + sub + '</p>' +
        '<ul><li>Đủ 14 tuổi từ ngày: <b>' + fd(m14) + '</b></li><li>Đủ 16 tuổi từ ngày: <b>' + fd(m16) + '</b></li><li>Đủ 18 tuổi từ ngày: <b>' + fd(m18) + '</b></li></ul>' +
        '<p class="legal-src">' + ic('scale') + 'Căn cứ: ' + lk('12', 'Điều 12') + '</p></div>';
      if (st.a && y >= 14) {
        var a = st.a, k = (a.M.k || []).filter(function (x) { return x.n === st.k; })[0];
        var r, rc;
        if (y >= 16) {
          if (a.M.a18 && y < 18) { rc = 'c1'; r = 'Không thuộc chủ thể của Điều ' + a.id + ': điều luật này chỉ áp dụng với người <b>đủ 18 tuổi trở lên</b>.'; }
          else { rc = 'c4'; r = '<b>Phải chịu trách nhiệm hình sự</b> về hành vi theo Điều ' + a.id + (k && k.n ? ' (khoản ' + k.n + ')' : '') + ', nếu thỏa mãn các dấu hiệu cấu thành tội phạm.'; }
        } else if (a.M.a14 && k && k.c >= 3) { rc = 'c4'; r = '<b>Phải chịu trách nhiệm hình sự</b>: Điều ' + a.id + ' thuộc danh sách tại khoản 2 Điều 12 và khung ' + (k.n ? 'khoản ' + k.n : 'này') + ' là tội ' + CLS[k.c].n.toLowerCase() + '.'; }
        else if (a.M.a14) { rc = 'c1'; r = '<b>Không phải chịu TNHS</b> ở khung ' + (k && k.n ? 'khoản ' + k.n : 'này') + ' vì đây là tội ' + (k ? CLS[k.c].n.toLowerCase() : '') + ' (khoản 2 Điều 12 chỉ áp dụng với tội rất nghiêm trọng, đặc biệt nghiêm trọng).'; }
        else { rc = 'c1'; r = '<b>Không phải chịu TNHS</b>: Điều ' + a.id + ' không thuộc danh sách các điều tại khoản 2 Điều 12.'; }
        if (y < 16 && k && k.cb && (a.id === '123' || a.id === '168')) { rc = 'c4'; r = '<b>Phải chịu trách nhiệm hình sự</b> về hành vi chuẩn bị phạm tội tại Điều ' + a.id + ' (khoản 3 Điều 14).'; }
        html += '<div class="res ' + rc + '"><h3>Đối với ' + lk(a.id, 'Điều ' + a.id + '. ' + esc(a.t)) + '</h3><p style="line-height:1.65">' + r + '</p>' +
          (k ? '<p class="legal-src">Khung: ' + esc(Pen.label(k)) + ' · tội ' + CLS[k.c].n.toLowerCase() + '</p>' : '') + '</div>';
      }
      if (y < 18 && y >= 14) {
        html += '<div class="callout callout--warn">' + ic('alert') + '<div><b>Người dưới 18 tuổi phạm tội:</b> từ ngày 01/01/2026, nguyên tắc xử lý, biện pháp xử lý chuyển hướng và hình phạt đối với người dưới 18 tuổi được áp dụng theo Luật Tư pháp người chưa thành niên số 59/2024/QH15 (Chương XII Bộ luật Hình sự đã bị bãi bỏ).</div></div>';
      }
      if (y >= 14 && y < 16 && !st.a) html += '<div class="res">' + age14List() + '</div>';
      out.innerHTML = html + disclaimer;
    }
    function age14List() {
      var ids = DB.arts.filter(function (a) { return a.M.a14; });
      return '<h3 style="margin-top:14px">28 điều tại khoản 2 Điều 12</h3><div class="kpick">' + ids.map(function (a) { return '<a class="chip" href="dieu-' + a.id + '" data-pv="' + a.id + '" title="' + esc(a.t) + '">Điều ' + a.id + '</a>'; }).join('') + '</div>';
    }
    main.addEventListener('click', function (e) { var k = e.target.closest('#kpick [data-k]'); if (k) { st.k = k.dataset.k; drawK(); calc(); } });
    $('#dob').addEventListener('change', calc); $('#dact').addEventListener('change', calc);
    drawK(); calc();
    return null;
  }

  /* =========================================================================
     3. Thời hiệu thi hành bản án
     ========================================================================= */
  var SENT = [
    [5, 'Phạt tiền'], [5, 'Cải tạo không giam giữ'], [5, 'Phạt tù từ 03 năm trở xuống'], [10, 'Phạt tù từ trên 03 năm đến 15 năm'],
    [15, 'Phạt tù từ trên 15 năm đến 30 năm'], [20, 'Tù chung thân'], [20, 'Tử hình']
  ];
  var SENT_PT = { 5: 'a', 10: 'b', 15: 'c', 20: 'd' };
  function thiHanh(ctx, main) {
    A.setTitle('Thời hiệu thi hành bản án');
    main.innerHTML = page('Thời hiệu thi hành bản án hình sự', 'Xác định thời hiệu thi hành bản án theo hình phạt đã tuyên (Điều 60) và các trường hợp không áp dụng thời hiệu (Điều 61).', 'Thi hành án',
      '<div class="tool"><form class="tool-form" onsubmit="return false">' +
      '<div class="seg" role="group" aria-label="Người bị kết án"><button type="button" data-sub="cn" aria-pressed="true">Cá nhân</button><button type="button" data-sub="pn" aria-pressed="false">Pháp nhân thương mại</button></div>' +
      '<label class="field" id="fs"><span>Hình phạt đã tuyên</span><select class="inp" id="sent">' + SENT.map(function (s, i) { return '<option value="' + i + '"' + (i === 3 ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="check"><input type="checkbox" id="ex"><span>Bị kết án về tội tại Chương XIII, Chương XXVI, khoản 3, 4 Điều 353 hoặc khoản 3, 4 Điều 354</span></label>' +
      '<label class="field"><span>Ngày bản án có hiệu lực pháp luật (không bắt buộc)</span><input class="inp" type="date" id="d0"></label>' +
      '<label class="check"><input type="checkbox" id="cnc"><span>Trong thời hạn, người (pháp nhân) bị kết án lại thực hiện hành vi phạm tội mới</span></label>' +
      '<label class="field" id="fnc" hidden><span>Ngày thực hiện hành vi phạm tội mới</span><input class="inp" type="date" id="dnc"></label>' +
      '<label class="check" id="lnw"><input type="checkbox" id="cnw"><span>Người bị kết án cố tình trốn tránh và đã có quyết định truy nã</span></label>' +
      '<label class="field" id="fnw" hidden><span>Ngày ra trình diện hoặc bị bắt giữ</span><input class="inp" type="date" id="dnw"></label>' +
      '</form><div class="tool-out" id="out" aria-live="polite"></div></div>');
    var sub = 'cn';
    function calc() {
      var out = $('#out'), ex = $('#ex').checked, html;
      if (ex) {
        html = '<div class="res c4"><h3>Thời hiệu thi hành bản án</h3><div class="big">Không áp dụng thời hiệu</div><div class="sub">Bản án được thi hành không phụ thuộc thời gian đã trôi qua.</div><p class="legal-src">' + ic('scale') + 'Căn cứ: ' + lk('61', 'Điều 61') + '</p></div>';
      } else {
        var n = sub === 'pn' ? 5 : SENT[+$('#sent').value][0];
        var basis = sub === 'pn' ? 'khoản 3 Điều 60' : 'điểm ' + SENT_PT[n] + ' khoản 2 Điều 60';
        html = '<div class="res"><h3>Thời hiệu thi hành bản án</h3><div class="big">' + n + ' năm</div><div class="sub">Tính từ ngày bản án có hiệu lực pháp luật (khoản 4 Điều 60).</div>' +
          '<p class="legal-src">' + ic('scale') + 'Căn cứ: ' + basis.replace('Điều 60', lk('60', 'Điều 60')) + '</p>' + timeline(n) + '</div>';
      }
      out.innerHTML = html + disclaimer;
    }
    function timeline(n) {
      var d0 = parseD($('#d0').value);
      if (!d0) return '<p class="sub" style="margin-top:10px">Nhập ngày bản án có hiệu lực để tính mốc hết thời hiệu.</p>';
      var start = d0, steps = ['Bản án có hiệu lực pháp luật: <b>' + fd(d0) + '</b>'], end = addYears(start, n);
      var dnc = $('#cnc').checked ? parseD($('#dnc').value) : null;
      if (dnc) {
        if (dnc > start && dnc < end) { start = dnc; end = addYears(start, n); steps.push('Phạm tội mới ngày <b>' + fd(dnc) + '</b> (trong thời hạn) → thời hiệu tính lại từ ngày này (khoản 4 Điều 60).'); }
        else steps.push('Ngày phạm tội mới (' + fd(dnc) + ') không nằm trong thời hạn thời hiệu nên không làm tính lại thời hiệu.');
      }
      var dnw = sub === 'cn' && $('#cnw').checked ? parseD($('#dnw').value) : null;
      if (dnw) {
        if (dnw > start) { start = dnw; end = addYears(start, n); steps.push('Có quyết định truy nã; ra trình diện/bị bắt giữ ngày <b>' + fd(dnw) + '</b> → thời hiệu tính lại từ ngày này (khoản 5 Điều 60).'); }
        else steps.push('Ngày ra trình diện/bị bắt giữ phải sau mốc đang tính (' + fd(start) + ').');
      }
      var t = today();
      steps.push('Hết thời hiệu vào ngày tương ứng: <b>' + fd(end) + '</b> ' + (t < end ? '<span class="tag tag--c1">Còn khoảng ' + span(diff(t, end)) + '</span>' : '<span class="tag tag--c4">Đã hết thời hiệu (tham khảo)</span>'));
      return '<ul>' + steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul>';
    }
    main.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sub]'); if (!b) return;
      sub = b.dataset.sub;
      $$('[data-sub]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      $('#fs').hidden = sub === 'pn'; $('#lnw').hidden = sub === 'pn'; if (sub === 'pn') $('#fnw').hidden = true;
      calc();
    });
    ['sent', 'ex', 'd0', 'dnc', 'dnw'].forEach(function (id) { $('#' + id).addEventListener('change', calc); });
    $('#cnc').addEventListener('change', function () { $('#fnc').hidden = !this.checked; calc(); });
    $('#cnw').addEventListener('change', function () { $('#fnw').hidden = !this.checked; calc(); });
    calc();
    return null;
  }

  /* =========================================================================
     4. So sánh điều luật
     ========================================================================= */
  var PRESETS = [
    ['168', '171', 'Cướp ↔ Cướp giật'], ['173', '172', 'Trộm cắp ↔ Công nhiên chiếm đoạt'], ['174', '175', 'Lừa đảo ↔ Lạm dụng tín nhiệm'],
    ['123', '134', 'Giết người ↔ Cố ý gây thương tích'], ['170', '168', 'Cưỡng đoạt ↔ Cướp tài sản'], ['353', '355', 'Tham ô ↔ Lạm dụng chức vụ chiếm đoạt'],
    ['141', '143', 'Hiếp dâm ↔ Cưỡng dâm'], ['18', '19', 'Che giấu ↔ Không tố giác tội phạm'], ['22', '23', 'Phòng vệ chính đáng ↔ Tình thế cấp thiết'],
    ['249', '251', 'Tàng trữ ↔ Mua bán trái phép ma túy']
  ];
  function soSanh(ctx, main) {
    A.setTitle('So sánh điều luật');
    var st = { a: DB.byId[ctx.q.get('a')] || null, b: DB.byId[ctx.q.get('b')] || null };
    main.innerHTML = page('So sánh điều luật', 'Đặt hai điều luật cạnh nhau để phân biệt dấu hiệu pháp lý, khung hình phạt và loại tội — đặc biệt hữu ích với các tội danh dễ nhầm lẫn.', 'So sánh',
      '<div class="card" style="padding:18px"><div class="cmp" style="margin-top:0">' +
      '<label class="field"><span>Điều luật thứ nhất</span><div id="pa"></div></label><label class="field"><span>Điều luật thứ hai</span><div id="pb"></div></label></div>' +
      '<div class="field" style="margin-top:16px"><span>Cặp thường được so sánh</span><div class="presets">' +
      PRESETS.map(function (p, i) { return '<button type="button" class="chip" data-ps="' + i + '">' + p[2] + '</button>'; }).join('') + '</div></div></div>' +
      '<div id="out"></div>');
    var pa = ArtPicker($('#pa'), { value: st.a, onChange: function (a) { st.a = a; draw(); } });
    var pb = ArtPicker($('#pb'), { value: st.b, onChange: function (b) { st.b = b; draw(); } });
    main.addEventListener('click', function (e) {
      var p = e.target.closest('[data-ps]'); if (!p) return;
      var x = PRESETS[+p.dataset.ps]; st.a = DB.byId[x[0]]; st.b = DB.byId[x[1]]; pa.set(st.a); pb.set(st.b); draw();
    });
    function draw() {
      var out = $('#out');
      replaceQuery({ a: st.a && st.a.id, b: st.b && st.b.id });
      if (!st.a || !st.b) { out.innerHTML = '<div class="empty">' + ic('columns') + '<h3>Chọn hai điều luật để so sánh</h3><p>Hoặc chọn nhanh một cặp gợi ý ở trên.</p></div>'; return; }
      out.innerHTML = '<div style="margin-top:20px"><div class="skel"></div><div class="skel" style="width:70%"></div></div>';
      Promise.all([DB.article(st.a.id), DB.article(st.b.id)]).then(function (r) {
        var a = st.a, b = st.b;
        var ks = function (x) { return (x.M.k || []).filter(function (k) { return !k.bs; }); };
        var row = function (label, fa, fb) { return '<tr><th scope="row">' + label + '</th><td>' + fa + '</td><td>' + fb + '</td></tr>'; };
        var penList = function (x) { var l = ks(x); return l.length ? l.map(function (k) { return '<div class="pk">' + (k.n ? '<b>K' + k.n + '</b>' : '') + '<span class="tag tag--c' + k.c + '">' + esc(Pen.label(k)) + '</span></div>'; }).join('') : '<span class="muted">Không quy định khung hình phạt</span>'; };
        var clsRange = function (x) { var l = ks(x); if (!l.length) return '—'; var lo = Math.min.apply(0, l.map(function (k) { return k.c; })), hi = Math.max.apply(0, l.map(function (k) { return k.c; })); return lo === hi ? CLS[lo].n : CLS[lo].n + ' → ' + CLS[hi].n; };
        var age = function (x) { return ks(x).length ? (x.M.a14 ? 'Từ đủ 14 tuổi (khung rất/đặc biệt nghiêm trọng)' : x.M.a18 ? 'Từ đủ 18 tuổi' : 'Từ đủ 16 tuổi') : '—'; };
        var thr = function (x) { var l = ks(x); if (!l.length) return '—'; if (x.M.nl === 1) return 'Không áp dụng (Điều 28)'; var t = l.map(function (k) { return CLS[k.c].th; }); return Math.min.apply(0, t) + ' – ' + Math.max.apply(0, t) + ' năm' + (x.M.nl ? ' (khoản ' + x.M.nl.join(', ') + ': không áp dụng)' : ''); };
        var col = function (x, d) {
          return '<div class="cmp-col"><h3><a href="dieu-' + x.id + '"><b>Điều ' + esc(x.id) + '.</b> ' + esc(x.t) + '</a></h3><div class="law-paper"><div class="law">' + A.lawHtml(x, d).html + '</div></div></div>';
        };
        out.innerHTML = '<section class="sec" style="margin-top:24px"><div class="sec-h"><div><h2>Đối chiếu nhanh</h2></div></div><div style="overflow:auto"><table class="cmp-tbl cmp-tbl--2up"><thead><tr><th></th><th>Điều ' + esc(a.id) + '</th><th>Điều ' + esc(b.id) + '</th></tr></thead><tbody>' +
          row('Tội danh', esc(a.t), esc(b.t)) + row('Vị trí', esc(a.ch.title), esc(b.ch.title)) +
          row('Khung hình phạt', penList(a), penList(b)) + row('Loại tội phạm', clsRange(a), clsRange(b)) + row('Thời hiệu truy cứu', thr(a), thr(b)) +
          row('Tuổi chịu TNHS', age(a), age(b)) + row('Sửa đổi 2025', a.n25 ? 'Có' : '—', b.n25 ? 'Có' : '—') +
          '</tbody></table></div></section>' +
          '<section class="sec" style="margin-top:28px"><div class="sec-h"><div><h2>Toàn văn hai điều luật</h2><p>Mẹo: chú ý các dấu hiệu khách quan (hành vi, thủ đoạn) và hậu quả được nêu ở khoản 1 của mỗi điều.</p></div></div><div class="cmp">' + col(a, r[0]) + col(b, r[1]) + '</div></section>' + disclaimer;
      }).catch(function () { out.innerHTML = '<div class="callout callout--warn">' + ic('alert') + '<div>Không tải được nội dung. Vui lòng thử lại.</div></div>'; });
    }
    draw();
    return null;
  }

  /* =========================================================================
     5. Bảng khung hình phạt
     ========================================================================= */
  function bang(ctx, main) {
    A.setTitle('Bảng khung hình phạt');
    var rows = DB.arts.filter(function (a) { return (a.M.k || []).some(function (k) { return !k.bs; }); }).map(function (a) {
      var all = a.M.k.filter(function (k) { return !k.bs; });
      // Khung dành cho hành vi chuẩn bị phạm tội không tính vào khung thấp nhất / loại tội của tội phạm hoàn thành
      var ks = all.filter(function (k) { return !k.cb; });
      if (!ks.length) ks = all;
      var min = ks.slice().sort(function (x, y) { return (x.hi == null ? (x.ct || x.th ? 999 : -1) : x.hi) - (y.hi == null ? (y.ct || y.th ? 999 : -1) : y.hi); })[0];
      var max = Pen.maxOf(a);
      return {
        a: a, min: min, max: max, th: ks.some(function (k) { return k.th; }), ct: ks.some(function (k) { return k.ct; }),
        cmin: Math.min.apply(0, ks.map(function (k) { return k.c; })), cmax: Math.max.apply(0, ks.map(function (k) { return k.c; })),
        score: max.th ? 1000 : max.ct ? 500 : (max.hi || 0)
      };
    });
    var st = { q: ctx.q.get('q') || '', ch: ctx.q.get('ch') || '', f: (ctx.q.get('f') || '').split(',').filter(Boolean), sort: ctx.q.get('sx') || 'id' };
    var FL = [['th', 'Có khung tử hình'], ['ct', 'Có tù chung thân'], ['a14', 'Từ đủ 14 tuổi chịu TNHS'], ['c1', 'Có khung ít nghiêm trọng'], ['n25', 'Sửa đổi 2025']];
    main.innerHTML = page('Bảng tra khung hình phạt', rows.length + ' tội danh tại Phần thứ hai, được tổng hợp tự động từ các khoản có quy định khung hình phạt chính. Nhấn vào tội danh để xem toàn văn.', 'Khung hình phạt',
      '<div class="filters"><div class="sb" style="flex:1;min-width:220px"><div class="sb-box">' + ic('filter') + '<input class="sb-in" id="fq" type="search" placeholder="Lọc theo tên tội hoặc số điều…" value="' + esc(st.q) + '" aria-label="Lọc"></div></div>' +
      '<select class="inp" id="fch" style="width:auto;max-width:100%" aria-label="Chương"><option value="">Mọi chương</option>' + DB.chaps.filter(function (c) { return c.part === 'p2'; }).map(function (c) { return '<option value="' + c.id + '"' + (st.ch === c.id ? ' selected' : '') + '>' + esc(c.label) + ' – ' + esc(c.name.length > 42 ? c.name.slice(0, 40) + '…' : c.name) + '</option>'; }).join('') + '</select>' +
      '<select class="inp" id="fsx" style="width:auto" aria-label="Sắp xếp"><option value="id"' + (st.sort === 'id' ? ' selected' : '') + '>Theo số điều</option><option value="max"' + (st.sort === 'max' ? ' selected' : '') + '>Khung cao nhất giảm dần</option></select></div>' +
      '<div class="filters" role="group" aria-label="Bộ lọc">' + FL.map(function (f) { return '<button type="button" class="chip" data-f="' + f[0] + '" aria-pressed="' + (st.f.indexOf(f[0]) > -1) + '">' + f[1] + '</button>'; }).join('') + '<span class="muted" id="cnt" style="margin-left:auto;font-size:.88rem"></span></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Điều</th><th>Tội danh</th><th>Khung thấp nhất</th><th>Khung cao nhất</th><th>Loại tội</th><th>Tuổi</th></tr></thead><tbody id="tb"></tbody></table></div>' +
      '<div class="mcards" id="mc"></div>' +
      '<p class="legal-src" style="margin-top:14px">' + ic('info') + 'Loại tội xác định theo khoản 1 Điều 9 cho từng khung; không tính khung dành cho hành vi chuẩn bị phạm tội. “Tuổi”: độ tuổi tối thiểu phải chịu TNHS theo Điều 12 (và câu chữ của điều luật).</p>');
    function draw() {
      var cq = st.q ? window.LX.compile(window.LX.parseQuery(st.q), { prefix: true }) : null, num = /^\d{1,3}[a-z]?$/.test(st.q) ? st.q : null;
      var list = rows.filter(function (r) {
        var a = r.a;
        if (st.ch && a.ch.id !== st.ch) return false;
        if (st.q && !(num ? a.id.indexOf(num) === 0 : cq.test(a.t))) return false;
        for (var i = 0; i < st.f.length; i++) {
          var f = st.f[i];
          if (f === 'th' && !r.th) return false;
          if (f === 'ct' && !r.ct) return false;
          if (f === 'a14' && !a.M.a14) return false;
          if (f === 'c1' && r.cmin !== 1) return false;
          if (f === 'n25' && !a.n25) return false;
        }
        return true;
      });
      if (st.sort === 'max') list.sort(function (x, y) { return y.score - x.score || x.a.i - y.a.i; });
      $('#cnt').textContent = list.length + ' / ' + rows.length + ' tội danh';
      var age = function (a) { return a.M.a14 ? '14' : a.M.a18 ? '18' : '16'; };
      var cr = function (r) { return r.cmin === r.cmax ? '<span class="tag tag--c' + r.cmin + '">' + CLS[r.cmin].n + '</span>' : '<span class="tag tag--c' + r.cmin + '">' + CLS[r.cmin].n + '</span> → <span class="tag tag--c' + r.cmax + '">' + CLS[r.cmax].n + '</span>'; };
      // Chỉ dựng dạng đang hiển thị: bảng (màn hình rộng) hoặc thẻ (điện thoại) — dạng kia để trống
      var wide = mq.matches;
      $('#tb').innerHTML = !wide ? '' : list.map(function (r) {
        var a = r.a;
        return '<tr><td class="n"><a href="dieu-' + a.id + '" data-pv="' + a.id + '">' + esc(a.id) + '</a></td><td><a href="dieu-' + a.id + '" style="color:var(--ink);font-weight:500">' + esc(a.t) + '</a> ' + A.artTags(a, true) + '</td>' +
          '<td>' + esc(Pen.label(r.min)) + '</td><td><span class="tag tag--c' + r.max.c + '">' + esc(Pen.label(r.max)) + '</span></td><td>' + cr(r) + '</td><td>' + age(a) + '</td></tr>';
      }).join('') || '<tr><td colspan="6" class="muted" style="text-align:center;padding:30px">Không có tội danh phù hợp bộ lọc</td></tr>';
      $('#mc').innerHTML = wide ? '' : list.slice(0, 150).map(function (r) {
        var a = r.a;
        return '<a class="mc" href="dieu-' + a.id + '"><b>Điều ' + esc(a.id) + '</b> · <span class="muted" style="font-size:.8rem">' + esc(a.ch.label) + '</span><div class="mt">' + esc(a.t) + '</div>' +
          '<div class="kpick"><span class="tag tag--soft">Thấp nhất: ' + esc(Pen.label(r.min)) + '</span><span class="tag tag--c' + r.max.c + '">Cao nhất: ' + esc(Pen.label(r.max)) + '</span><span class="tag tag--soft">Từ ' + age(a) + ' tuổi</span></div></a>';
      }).join('') + (list.length > 150 ? '<p class="muted" style="text-align:center">Hiển thị 150/' + list.length + ' – dùng bộ lọc để thu hẹp.</p>' : '') || '<div class="empty">' + ic('search') + '<h3>Không có tội danh phù hợp</h3></div>';
      replaceQuery({ q: st.q, ch: st.ch, f: st.f.join(','), sx: st.sort === 'id' ? '' : st.sort });
    }
    $('#fq').addEventListener('input', A.debounce(function () { st.q = this.value.trim(); draw(); }, 150));
    $('#fch').addEventListener('change', function () { st.ch = this.value; draw(); });
    $('#fsx').addEventListener('change', function () { st.sort = this.value; draw(); });
    main.addEventListener('click', function (e) {
      var b = e.target.closest('[data-f]'); if (!b) return;
      var i = st.f.indexOf(b.dataset.f); if (i > -1) st.f.splice(i, 1); else st.f.push(b.dataset.f);
      b.setAttribute('aria-pressed', String(i < 0)); draw();
    });
    var mq = window.matchMedia('(min-width: 861px)');
    if (mq.addEventListener) mq.addEventListener('change', draw); else mq.addListener(draw);
    draw();
    return { leave: function () { if (mq.removeEventListener) mq.removeEventListener('change', draw); else mq.removeListener(draw); } };
  }

  var SUB = { 'thoi-hieu': thoiHieu, 'tuoi': tuoi, 'thi-hanh-an': thiHanh, 'so-sanh': soSanh, 'khung-hinh-phat': bang };
  A.VIEWS['cong-cu'] = {
    nav: 'cong-cu',
    render: function (ctx, main) {
      var fn = SUB[ctx.parts[1]];
      if (ctx.parts[1] && !fn) return A.VIEWS._404.render(ctx, main);
      // Tạo vùng hiển thị mới để không giữ trình nghe sự kiện của công cụ trước
      var host = document.createElement('div');
      main.innerHTML = ''; main.appendChild(host);
      return (fn || hub)(ctx, host);
    }
  };
})();
