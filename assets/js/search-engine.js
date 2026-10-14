/*
 * Bộ máy tìm kiếm toàn văn Bộ luật Hình sự.
 * Dùng chung cho luồng nền (search-worker.js) và phương án dự phòng trên luồng chính.
 * Cần nạp trước: lx-core.js (window.LX / self.LX).
 *
 * Kết quả trả về theo từng điều:
 *   { id, o (thứ tự), th (khớp tên điều), lh (số đoạn luật khớp), cm (số đoạn bình luận khớp),
 *     sc (điểm liên quan), sn: [[loại, chỉ số đoạn, đoạn trích, [[đầu, cuối]…], cắt đầu, cắt cuối]…] }
 */
(function (g) {
  'use strict';

  function strip(h) {
    return h.replace(/<sup class="fn"[^>]*>.*?<\/sup>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  }

  function Engine() {
    this.P = [];   // đoạn văn
    this.T = [];   // tên điều
    this.ready = false;
  }

  /* titles: [[id, "Điều 173. Tội trộm cắp tài sản"], …] theo thứ tự Bộ luật
     lists : mảng nội dung các chương ([{id, law, cm}, …]) */
  Engine.prototype.load = function (titles, lists) {
    var order = {}, self = this, LX = g.LX;
    this.T = titles.map(function (x, o) {
      order[x[0]] = o;
      return { id: x[0], o: o, t: x[1], lo: x[1].toLowerCase(), fo: LX.fold(x[1]) };
    });
    lists.forEach(function (arr) {
      arr.forEach(function (a) {
        var o = order[a.id];
        a.law.forEach(function (p, i) { self.add(a.id, o, 'l', i, p[1]); });
        a.cm.forEach(function (p, i) { self.add(a.id, o, 'c', i, p[1]); });
      });
    });
    this.ready = true;
    return this.P.length;
  };

  Engine.prototype.add = function (a, o, k, i, h) {
    var t = strip(h).trim();
    if (t) this.P.push({ a: a, o: o, k: k, i: i, t: t, lo: t.toLowerCase(), fo: g.LX.fold(t) });
  };

  function snippet(p, cq) {
    var sp = cq.find(p.t, p.lo);
    var first = sp.length ? sp[0][0] : 0;
    var s = Math.max(0, first - 70);
    if (s > 0) { var a = p.t.indexOf(' ', s); if (a > -1 && a < first) s = a + 1; }
    var e = Math.min(p.t.length, (sp.length ? sp[0][1] : 0) + 190);
    if (e < p.t.length) { var b = p.t.lastIndexOf(' ', e); if (b > first + 30) e = b; }
    var marks = [];
    for (var k = 0; k < sp.length; k++) if (sp[k][0] >= s && sp[k][1] <= e) marks.push([sp[k][0] - s, sp[k][1] - s]);
    return [p.k, p.i, p.t.slice(s, e), marks, s > 0 ? 1 : 0, e < p.t.length ? 1 : 0];
  }

  Engine.prototype.run = function (q) {
    var t0 = Date.now(), LX = g.LX;
    var pq = LX.parseQuery(q);
    var cq = LX.compile(pq);
    if (cq.empty) return { q: q, exact: [], loose: [], ms: 0 };
    var exact = new Map(), loose = new Map();

    function rec(map, id, o) {
      var r = map.get(id);
      if (!r) { r = { id: id, o: o, th: 0, lh: 0, cm: 0, sc: 0, sn: [] }; map.set(id, r); }
      return r;
    }

    for (var n = 0; n < this.P.length; n++) {
      var p = this.P[n], map = null;
      if (cq.exact(p.lo, p.fo)) map = exact;
      else if (cq.hasLoose && cq.loose(p.lo, p.fo)) map = loose;
      if (!map) continue;
      var r = rec(map, p.a, p.o);
      if (p.k === 'l') r.lh++; else r.cm++;
      var same = 0;
      for (var j = 0; j < r.sn.length; j++) if (r.sn[j][0] === p.k) same++;
      if (same < 2) r.sn.push(snippet(p, cq));
    }
    for (var k = 0; k < this.T.length; k++) {
      var t = this.T[k];
      if (cq.exact(t.lo, t.fo)) rec(exact, t.id, t.o).th = 2;
      else if (cq.hasLoose && cq.loose(t.lo, t.fo)) rec(loose, t.id, t.o).th = 1;
    }
    function score(r, bonus) {
      return bonus + r.th * 45 + Math.min(r.lh, 8) * 7 + Math.min(r.cm, 25) * 1.4;
    }
    var ex = Array.from(exact.values()), lo = [];
    ex.forEach(function (r) { r.sc = score(r, 30); });
    loose.forEach(function (r) { if (!exact.has(r.id)) { r.sc = score(r, 0); lo.push(r); } });
    var byScore = function (a, b) { return b.sc - a.sc || a.o - b.o; };
    ex.sort(byScore); lo.sort(byScore);
    return { q: q, exact: ex, loose: lo, ms: Date.now() - t0 };
  };

  g.LXEngine = Engine;
})(typeof self !== 'undefined' ? self : this);
