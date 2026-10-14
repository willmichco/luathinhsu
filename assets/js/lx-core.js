/*
 * Lõi tìm kiếm tiếng Việt — dùng chung cho trang tra cứu và luồng tìm kiếm nền.
 *
 * Quy tắc so khớp:
 *  - Chữ gõ KHÔNG dấu được hiểu là "mọi dấu":  "pham"  khớp  phạm, phàm, phẩm…
 *  - Chữ gõ CÓ dấu thì khớp đúng dấu đó:       "phạm"  chỉ khớp  phạm
 *  - Khớp theo ranh giới từ: "an" không khớp bên trong "toàn", "bản".
 *  - Cụm trong ngoặc kép "…" bắt buộc xuất hiện liền nhau.
 */
(function (g) {
  'use strict';

  var fold = function (s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  };

  var escRe = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };

  // Chữ cái gõ thiếu dấu → mọi biến thể có thể có trong văn bản
  var VAR = {
    a: 'aàáảãạăằắẳẵặâầấẩẫậ', 'ă': 'ăằắẳẵặ', 'â': 'âầấẩẫậ',
    e: 'eèéẻẽẹêềếểễệ', 'ê': 'êềếểễệ',
    i: 'iìíỉĩị',
    o: 'oòóỏõọôồốổỗộơờớởỡợ', 'ô': 'ôồốổỗộ', 'ơ': 'ơờớởỡợ',
    u: 'uùúủũụưừứửữự', 'ư': 'ưừứửữự',
    y: 'yỳýỷỹỵ',
    d: 'dđ'
  };

  function vnRe(s, openEnd) {
    var src = '';
    for (var k = 0; k < s.length; k++) {
      var ch = s[k];
      if (ch === ' ') src += '\\s+';
      else if (VAR[ch]) src += '[' + VAR[ch] + ']';
      else src += escRe(ch);
    }
    return new RegExp('(?<![\\p{L}\\p{N}])' + src + (openEnd ? '' : '(?![\\p{L}\\p{N}])'), 'gu');
  }

  function parseQuery(raw) {
    var q = String(raw || '').normalize('NFC').replace(/\s+/g, ' ').trim();
    var phrases = [];
    var rest = q.replace(/["“”„]([^"“”„]+)["“”„]/g, function (_, x) {
      x = x.trim().toLowerCase();
      if (x) phrases.push(x);
      return ' ';
    });
    rest = rest.replace(/["“”„]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    return {
      q: q,
      phrases: phrases,
      rest: rest,
      terms: rest ? rest.split(' ') : [],
      toned: fold(q) !== q.toLowerCase()
    };
  }

  function merge(sp) {
    sp.sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
    var out = [];
    for (var k = 0; k < sp.length; k++) {
      var last = out[out.length - 1];
      if (last && sp[k][0] <= last[1]) last[1] = Math.max(last[1], sp[k][1]);
      else out.push([sp[k][0], sp[k][1]]);
    }
    return out;
  }

  /*
   * compile(pq, { prefix }) → bộ so khớp
   *   exact(lo, fo): mọi cụm + toàn bộ phần còn lại xuất hiện LIỀN NHAU
   *   loose(lo, fo): mọi cụm + mọi từ đều xuất hiện (không cần liền nhau)
   *   find(text):    vị trí cần tô sáng (ưu tiên cụm liền nhau)
   * lo = văn bản chữ thường; fo = văn bản đã bỏ dấu (dùng để lọc nhanh).
   */
  function compile(pq, opt) {
    opt = opt || {};
    var exactItems = pq.phrases.concat(pq.rest ? [pq.rest] : []);
    var looseItems = pq.phrases.concat(pq.terms);
    var mk = function (list) {
      return list.map(function (s, k) {
        return { fo: fold(s), re: vnRe(s, opt.prefix && k === list.length - 1) };
      });
    };
    var E = mk(exactItems), L = mk(looseItems);

    function all(items, lo, fo) {
      if (!items.length) return false;
      for (var k = 0; k < items.length; k++) {
        var it = items[k];
        if (fo.indexOf(it.fo) < 0) return false;
        it.re.lastIndex = 0;
        if (!it.re.test(lo)) return false;
      }
      return true;
    }
    function spans(items, lo) {
      var out = [];
      for (var k = 0; k < items.length; k++) {
        var re = items[k].re, m;
        re.lastIndex = 0;
        while ((m = re.exec(lo))) {
          out.push([m.index, m.index + m[0].length]);
          if (!m[0].length) re.lastIndex++;
        }
      }
      return merge(out);
    }
    return {
      empty: !E.length && !L.length,
      hasLoose: L.length > E.length,
      exact: function (lo, fo) { return all(E, lo, fo); },
      loose: function (lo, fo) { return all(L, lo, fo); },
      test: function (text) {
        var lo = text.toLowerCase(), fo = fold(text);
        return all(E, lo, fo) || all(L, lo, fo);
      },
      find: function (text, lo) {
        lo = lo || text.toLowerCase();
        var s = spans(E, lo);
        return s.length ? s : spans(L, lo);
      }
    };
  }

  g.LX = { fold: fold, parseQuery: parseQuery, compile: compile, escRe: escRe };
})(typeof self !== 'undefined' ? self : this);
