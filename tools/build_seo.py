# -*- coding: utf-8 -*-
"""
Sinh các trang HTML dựng tĩnh phục vụ công cụ tìm kiếm (SEO) cho website tra cứu Bộ luật Hình sự.

    python3 tools/build_seo.py
    SITE_URL=https://ten-mien-rieng.vn/ python3 tools/build_seo.py     # khi đổi địa chỉ trang

Đầu vào : index.html (khuôn trang: header, footer, bộ biểu tượng…), data/toc.json, data/meta.json,
          data/c01.json … data/c26.json, data/p3.json
Đầu ra  : index.html                 – cập nhật vùng <!--seo:head--> và <!--seo:main--> của trang chủ
          dieu-<số>.html             – 428 điều luật (toàn văn, bình luận, điều liên quan)
          chuong-<số>.html, chuong-p3.html, muc-luc.html, cong-cu*.html, gioi-thieu.html,
          tim-kiem.html, da-luu.html
          sitemap.xml, robots.txt

Mỗi trang có tiêu đề, mô tả, đường dẫn chuẩn (canonical), Open Graph, dữ liệu có cấu trúc (JSON-LD) riêng và
toàn bộ nội dung đọc được khi chưa chạy JavaScript. Khi JavaScript chạy, assets/js/app.js thay nội dung tĩnh
bằng giao diện tương tác tương ứng với đường dẫn (dieu-173 → Điều 173…). Mọi trang nằm cùng thư mục gốc nên
các đường dẫn tương đối (assets/, data/) dùng chung được. GitHub Pages phục vụ "dieu-173" từ "dieu-173.html".

Chạy lại sau khi sửa index.html hoặc dữ liệu điều luật (sau tools/build_meta.py). Chạy nhiều lần cho cùng kết quả.
"""
import datetime
import glob
import html
import json
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
SITE = os.environ.get("SITE_URL", "https://willmichco.github.io/luathinhsu/").rstrip("/") + "/"

SITE_NAME = "Tra cứu Bộ luật Hình sự – Luật Sư Nam"
HOME_TITLE = "Tra cứu Bộ luật Hình sự 2015 (sửa đổi 2017, 2025) – Luật Sư Nam"
SUFFIX = " – Bộ luật Hình sự 2015 (sửa đổi 2025)"  # phải khớp setTitle() trong assets/js/app.js
HOME_DESC = ("Tra cứu nhanh toàn văn Bộ luật Hình sự 2015 (sửa đổi, bổ sung 2017, 2025): 428 điều luật, bình luận khoa học, "
             "khung hình phạt, phân loại tội phạm, công cụ tính thời hiệu và tuổi chịu trách nhiệm hình sự.")
OG_IMAGE = SITE + "assets/img/og-cover.jpg"
OG_ALT = "Tra cứu Bộ luật Hình sự 2015 (sửa đổi 2017, 2025) – Công ty Luật TNHH Luật Sư Nam"
CITE = "Bộ luật Hình sự năm 2015 (sửa đổi, bổ sung năm 2017, 2025)"

# ---- Hằng số dùng chung với assets/js/app.js ----
CLS = {
    1: {"n": "Ít nghiêm trọng", "th": 5, "d": "Phạt tiền, cải tạo không giam giữ hoặc phạt tù đến 03 năm"},
    2: {"n": "Nghiêm trọng", "th": 10, "d": "Từ trên 03 năm tù đến 07 năm tù"},
    3: {"n": "Rất nghiêm trọng", "th": 15, "d": "Từ trên 07 năm tù đến 15 năm tù"},
    4: {"n": "Đặc biệt nghiêm trọng", "th": 20, "d": "Từ trên 15 năm đến 20 năm tù, tù chung thân hoặc tử hình"},
}
POINT = {1: "a", 2: "b", 3: "c", 4: "d"}
CH_NOTE = {
    "c12": {
        "short": "Bãi bỏ từ 01/01/2026",
        "text": "Chương XII (Điều 90 – Điều 107) đã bị bãi bỏ kể từ ngày 01/01/2026 theo Điều 177 Luật Tư pháp người chưa "
                "thành niên số 59/2024/QH15. Việc xử lý người dưới 18 tuổi phạm tội hiện được thực hiện theo Luật Tư pháp "
                "người chưa thành niên. Nội dung dưới đây là văn bản trước ngày 01/01/2026, được giữ lại để tham khảo, nghiên cứu.",
    }
}
ICONS = {
    "c01": "book", "c02": "globe", "c03": "scale", "c04": "shield", "c05": "clock", "c06": "gavel", "c07": "landmark",
    "c08": "scale", "c09": "calendar", "c10": "check", "c11": "briefcase", "c12": "user", "c13": "shield", "c14": "heart",
    "c15": "unlock", "c16": "wallet", "c17": "family", "c18": "chart", "c19": "leaf", "c20": "pill", "c21": "cone",
    "c22": "landmark", "c23": "briefcase", "c24": "gavel", "c25": "star", "c26": "globe", "p3": "calendar",
}
POPULAR = ["173", "174", "134", "123", "168", "171", "175", "251", "249", "321", "260", "353"]
GENERAL = ["9", "17", "27", "50", "51", "52", "54", "65"]
TOOLS = [
    ("thoi-hieu", "clock", "Phân loại tội & thời hiệu",
     "Chọn điều luật và khoản – biết ngay loại tội (Điều 9) và thời hiệu truy cứu (Điều 27, 28)."),
    ("tuoi", "user", "Tuổi chịu trách nhiệm hình sự",
     "Tính tuổi chính xác tại thời điểm thực hiện hành vi, đối chiếu khoản 2 Điều 12."),
    ("thi-hanh-an", "calendar", "Thời hiệu thi hành bản án", "Xác định thời hiệu theo hình phạt đã tuyên (Điều 60, 61)."),
    ("so-sanh", "columns", "So sánh điều luật", "Đặt hai điều cạnh nhau để phân biệt dấu hiệu và khung hình phạt."),
    ("khung-hinh-phat", "table", "Bảng khung hình phạt",
     "Lọc toàn bộ tội danh theo mức phạt cao nhất, tử hình, chung thân, độ tuổi."),
]
PRESETS = [
    ("168", "171", "Cướp ↔ Cướp giật"), ("173", "172", "Trộm cắp ↔ Công nhiên chiếm đoạt"),
    ("174", "175", "Lừa đảo ↔ Lạm dụng tín nhiệm"), ("123", "134", "Giết người ↔ Cố ý gây thương tích"),
    ("170", "168", "Cưỡng đoạt ↔ Cướp tài sản"), ("353", "355", "Tham ô ↔ Lạm dụng chức vụ chiếm đoạt"),
    ("141", "143", "Hiếp dâm ↔ Cưỡng dâm"), ("18", "19", "Che giấu ↔ Không tố giác tội phạm"),
    ("22", "23", "Phòng vệ chính đáng ↔ Tình thế cấp thiết"), ("249", "251", "Tàng trữ ↔ Mua bán trái phép ma túy"),
]
ORG = {
    "@type": "LegalService", "@id": SITE + "#org", "name": "Công ty Luật TNHH Luật Sư Nam", "alternateName": "LSN Law Firm",
    "url": SITE, "logo": SITE + "assets/img/icon-512.png", "image": OG_IMAGE,
    "telephone": "+84983498499", "email": "luatsunam.hcm@gmail.com",
    "address": {"@type": "PostalAddress", "streetAddress": "22c Vũ Ngọc Phan", "addressLocality": "Phường Bình Lợi Trung",
                "addressRegion": "TP. Hồ Chí Minh", "addressCountry": "VN"},
    "areaServed": {"@type": "Country", "name": "Việt Nam"},
}
CODE = {
    "@type": "Legislation", "name": "Bộ luật Hình sự", "legislationIdentifier": "100/2015/QH13",
    "legislationDate": "2015-11-27", "legislationType": "Bộ luật", "legislationJurisdiction": "VN", "inLanguage": "vi",
    "url": SITE,
}


# =============================================================================
# Tiện ích
# =============================================================================
def esc(s):
    return html.escape("" if s is None else str(s), quote=True)


def ic(name, cls=None):
    return '<svg%s aria-hidden="true"><use href="#i-%s"/></svg>' % (' class="%s"' % cls if cls else "", name)


def plain(h):
    h = re.sub(r'<sup class="fn"[^>]*>.*?</sup>', "", str(h))
    return html.unescape(re.sub(r"<[^>]+>", "", h)).strip()


def cap(s):
    return s[:1].upper() + s[1:] if s else s


def read_min(chars):
    return max(1, int(chars / 900 + 0.5))


def clip(s, n):
    """Cắt chuỗi tại ranh giới từ, không quá n ký tự."""
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) <= n:
        return s
    cut = s[: n - 1].rsplit(" ", 1)[0].rstrip(" ,;:.–-")
    return cut + "…"


def jsonld(obj):
    return ('<script type="application/ld+json">' +
            json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + "</script>")


def roman_to_int(s):
    v, t, prev = {"I": 1, "V": 5, "X": 10, "L": 50}, 0, 0
    for ch in reversed(s):
        n = v.get(ch, 0)
        t += -n if n < prev else n
        prev = max(prev, n)
    return t


# =============================================================================
# Dữ liệu
# =============================================================================
class Art(object):
    pass


def load():
    toc = json.load(open(os.path.join(DATA, "toc.json"), encoding="utf-8"))
    meta = json.load(open(os.path.join(DATA, "meta.json"), encoding="utf-8"))
    chaps, arts, by_id = [], [], {}
    for c in toc["chapters"]:
        n = roman_to_int(c["num"]) if c.get("num") else 0
        ch = {"id": c["id"], "num": c.get("num"), "n": n, "name": c["name"], "part": c["part"], "muc": c.get("muc") or [],
              "sz": c["sz"], "slug": str(n) if c.get("num") else "p3",
              "label": "Chương " + c["num"] if c.get("num") else "Điều khoản thi hành", "arts": []}
        ch["title"] = ch["label"] + ". " + c["name"] if c.get("num") else c["name"]
        body = {x["id"]: x for x in json.load(open(os.path.join(DATA, c["id"] + ".json"), encoding="utf-8"))}
        for x in c["a"]:
            a = Art()
            a.id, a.t, a.m = x["id"], x["t"], x.get("m")
            a.am, a.n25, a.rep = bool(x.get("am")), bool(x.get("n25")), bool(x.get("rep"))
            a.ch, a.i, a.r26 = ch, len(arts), c["id"] in CH_NOTE
            a.M = meta.get(x["id"], {})
            a.d = body[x["id"]]
            arts.append(a)
            by_id[a.id] = a
            ch["arts"].append(a)
        ch["first"], ch["last"] = ch["arts"][0], ch["arts"][-1]
        chaps.append(ch)
    return toc, chaps, arts, by_id


TOC, CHAPS, ARTS, BY_ID = load()
PARTS = TOC["parts"]


def part_name(pid):
    p = [x for x in PARTS if x["id"] == pid]
    return p[0]["label"] + ": " + p[0]["name"] if p else ""


def muc_name(ch, m):
    x = [y for y in ch["muc"] if y["n"] == m]
    return x[0]["name"] if x else None


# =============================================================================
# Khung hình phạt (giống Pen trong app.js)
# =============================================================================
def fm(m):
    if m % 12 == 0:
        return "%d năm" % (m // 12)
    if m < 12:
        return "%d tháng" % m
    return "%d năm %d tháng" % (m // 12, m % 12)


def pen_label(k):
    if k.get("bs"):
        return "Hình phạt bổ sung"
    s = ""
    if k.get("lo") is not None:
        s = "Tù " + fm(k["hi"]) if k["lo"] == k["hi"] else "Tù " + fm(k["lo"]) + " – " + fm(k["hi"])
    if k.get("ct"):
        s += (", " if s else "Tù ") + "chung thân"
    if k.get("th"):
        s += ((" hoặc " if k.get("ct") else ", ") if s else "") + "tử hình"
    if not s and k.get("alt"):
        s = cap(", ".join(k["alt"]))
    return cap(s)


def main_frames(a):
    return [k for k in a.M.get("k", []) if not k.get("bs")]


def pen_score(k):
    return 1000 if k.get("th") else 500 if k.get("ct") else (k.get("hi") or 0)


def max_of(a):
    ks = main_frames(a)
    if not ks:
        return None
    best = ks[0]
    for k in ks:
        if pen_score(k) > pen_score(best):
            best = k
    return best


def max_text(a):
    k = max_of(a)
    if not k:
        return ""
    if k.get("th"):
        return "Cao nhất: tử hình"
    if k.get("ct"):
        return "Cao nhất: tù chung thân"
    if k.get("hi"):
        return "Cao nhất: " + fm(k["hi"]) + " tù"
    return "Không giam giữ"


def no_limit(a, kn):
    nl = a.M.get("nl")
    return bool(nl) and (nl == 1 or (isinstance(nl, list) and kn in nl))


def pen_tags(a, k, compact=False):
    if k.get("bs"):
        return '<span class="tag tag--soft">Hình phạt bổ sung</span>'
    c = CLS[k["c"]]
    out = ['<span class="tag tag--c%d" title="%s">%s</span>' % (k["c"], esc(k["txt"]), esc(pen_label(k))),
           '<span class="tag tag--c%d">Tội %s</span>' % (k["c"], c["n"].lower())]
    if not compact:
        if no_limit(a, k["n"]):
            out.append('<span class="tag tag--soft">Không áp dụng thời hiệu</span>')
        else:
            out.append('<span class="tag tag--soft">%sThời hiệu %d năm</span>' % (ic("clock"), c["th"]))
        if a.M.get("a14") and k["c"] >= 3:
            out.append('<span class="tag tag--a14" title="Khoản 2 Điều 12">Từ đủ 14 tuổi chịu TNHS</span>')
        if k.get("cb"):
            out.append('<span class="tag tag--soft">Chuẩn bị phạm tội</span>')
    return "".join(out)


def pen_chart(a):
    ks = main_frames(a)
    if not ks:
        return ""
    rows = []
    for k in ks:
        bar = ""
        if k.get("lo") is not None:
            left, w = k["lo"] / 240.0 * 80, max(1.5, (k["hi"] - k["lo"]) / 240.0 * 80)
            bar = '<span class="pen-bar c%d" style="left:%.2f%%;width:%.2f%%"></span>' % (k["c"], left, w)
        elif not k.get("ct") and not k.get("th"):
            bar = '<span class="pen-bar c%d" style="left:0;width:2%%;opacity:.7"></span>' % k["c"]
        if k.get("ct"):
            bar += '<span class="pen-cell ct" title="Tù chung thân"></span>'
        if k.get("th"):
            bar += '<span class="pen-cell th" title="Tử hình"></span>'
        lab = "Khoản " + k["n"] if k["n"] else "Điều luật"
        nm = '<a href="#k%s">%s</a>' % (k["n"], lab) if k["n"] else lab
        rows.append('<div class="pen-row"><div class="pen-lab"><b>%s</b><span>%s</span></div>'
                    '<div class="pen-track" title="%s">%s</div></div>'
                    % (nm, esc(pen_label(k)), esc(k["txt"] + " – tội " + CLS[k["c"]]["n"].lower()), bar))
    axis = "".join('<span%s style="left:%d%%">%s</span>' % (' class="r"' if r else "", x, t)
                   for x, t, r in [(0, "0", 0), (20, "5", 0), (40, "10", 0), (60, "15", 0), (80, "20", 1), (85, "CT", 0), (95, "TH", 0)])
    used = sorted({k["c"] for k in ks})
    return ('<div class="pen">' + "".join(rows) + '<div class="pen-axis" aria-hidden="true">' + axis + "</div></div>" +
            '<div class="pen-legend">' + "".join('<span class="tag tag--c%d">%s</span>' % (c, CLS[c]["n"]) for c in used) + "</div>" +
            '<p class="pen-note">Thang đo: năm tù · CT: tù chung thân · TH: tử hình. Màu thể hiện loại tội theo khoản 1 Điều 9 '
            "(căn cứ mức cao nhất của khung).</p>")


# =============================================================================
# Thành phần giao diện (giống app.js)
# =============================================================================
def art_tags(a, short=False):
    t = ""
    if a.rep:
        t += '<span class="tag tag--rep">Đã bãi bỏ</span>'
    if a.r26:
        t += '<span class="tag tag--rep26">%s</span>' % ("Bãi bỏ 2026" if short else CH_NOTE[a.ch["id"]]["short"])
    if a.n25:
        t += '<span class="tag tag--new">%s</span>' % ("Sửa đổi 2025" if short else "Sửa đổi, bổ sung 2025")
    if a.am and not short:
        t += ('<span class="tag tag--am" title="Điều luật có khoản, điểm gắn dấu (*) – đã được sửa đổi, bổ sung">'
              "Có sửa đổi (*)</span>")
    return t


def art_card(a):
    k = max_of(a)
    first = ('<span class="tag tag--c%d">%s</span>' % (k["c"], esc(max_text(a).replace("Cao nhất: ", ""))) if k
             else '<span class="tag tag--soft">%s</span>' % esc(a.ch["label"]))
    return ('<a class="pa" href="dieu-%s"><span class="pn">Điều %s</span><h3>%s</h3><span class="pm">%s%s</span></a>'
            % (a.id, esc(a.id), esc(a.t), first, art_tags(a, True)))


def drum():
    return '<div class="hero-bg" aria-hidden="true"><div class="hero-drum"></div></div>'


def crumb(items):
    out = []
    for i, (t, href) in enumerate(items):
        out.append((ic("chev-r") if i else "") +
                   ('<a href="%s">%s</a>' % (href, esc(t)) if href else '<span aria-current="page">%s</span>' % esc(t)))
    return '<nav class="crumb" aria-label="Đường dẫn">' + "".join(out) + "</nav>"


def breadcrumb_ld(items):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": t, "item": SITE + ("" if href == "./" else href)}
        for i, (t, href) in enumerate(items)]}


def tool_cards():
    return '<div class="tools-grid">' + "".join(
        '<a class="tl" href="cong-cu-%s"><span class="ti">%s</span><h3>%s</h3><p>%s</p><span class="lk">Mở công cụ %s</span></a>'
        % (k, ic(i), t, d, ic("arrow-r")) for k, i, t, d in TOOLS) + "</div>"


def cta_block():
    return ('<section class="wrap sec"><div class="cta"><div class="cta-in"><span class="eyebrow">Công ty Luật TNHH Luật Sư Nam</span>'
            "<h2>Cần luật sư tư vấn, bào chữa trong vụ án hình sự?</h2>"
            "<p>Trao đổi trực tiếp với luật sư để được đánh giá hồ sơ, xác định tội danh, khung hình phạt và phương án bảo vệ "
            "quyền lợi hợp pháp.</p>"
            '<div class="cta-acts"><a class="btn btn--g" href="tel:0983498499">' + ic("phone") + "Gọi 0983 498 499</a>"
            '<a class="btn" href="https://zalo.me/0983498499" target="_blank" rel="noopener">' + ic("chat") + "Nhắn Zalo</a>"
            '<a class="btn" href="mailto:luatsunam.hcm@gmail.com">' + ic("mail") + "Gửi email</a></div></div></div></section>")


def search_form(lg=False, value=""):
    """Ô tìm kiếm hoạt động cả khi chưa có JavaScript (gửi tới trang tim-kiem?q=…)."""
    return ('<form class="sb%s" role="search" action="tim-kiem" method="get"><div class="sb-box">%s'
            '<input class="sb-in" type="search" name="q" value="%s" placeholder="%s" aria-label="Tìm kiếm trong Bộ luật Hình sự" '
            'enterkeyhint="search" spellcheck="false">'
            '<button class="sb-go" type="submit" aria-label="Tra cứu">%s</button></div></form>'
            % (" sb--lg" if lg else "", ic("search"), esc(value),
               "Nhập số điều, tên tội hoặc từ khóa…" if lg else "Nhập từ khóa, cụm từ hoặc số điều…",
               ic("search") + "<span>Tra cứu</span>" if lg else ic("arrow-r")))


def ph(crumbs, title, sub, eyebrow=None, extra=""):
    return ('<section class="ph">' + drum() + '<div class="wrap ph-in">' + crumb(crumbs) +
            ('<span class="eyebrow">%s</span>' % esc(eyebrow) if eyebrow else "") +
            "<h1>%s</h1>" % esc(title) + ("<p>%s</p>" % sub if sub else "") + extra + "</div></section>")


# =============================================================================
# Văn bản điều luật & bình luận (giống lawHtml, fixHtml, cmHtml trong app.js)
# =============================================================================
def fix_html(h, fn_map):
    h = re.sub(r'href="#d(\w+)"', r'href="dieu-\1" data-pv="\1"', h)

    def fn(m):
        n = m.group(1)
        if n not in fn_map:
            fn_map[n] = len(fn_map) + 1
        return '<sup class="fn" data-fn="%s"><a href="#fn-%d" aria-label="Chú thích %d">%d</a></sup>' % (n, fn_map[n], fn_map[n], fn_map[n])

    h = re.sub(r'<sup class="fn" data-fn="(\d+)">\d+</sup>', fn, h)
    h = re.sub(r"\s*\*((?:\s|</[a-z]+>)*)$",
               r'<sup class="am" title="Được sửa đổi, bổ sung (đánh dấu * trong tài liệu gốc)">*</sup>\1', h)
    return h


def law_html(a, fn_map):
    ks = {k["n"]: k for k in a.M.get("k", [])}
    groups, g = [], None
    for kind, h in a.d["law"]:
        if kind in ("k", "h") or g is None:
            g = {"n": None, "items": []}
            groups.append(g)
        if kind == "k":
            m = re.match(r"^(\d{1,2})\.", plain(h))
            if m:
                g["n"] = m.group(1)
        g["items"].append((kind, h))
    numbered = any(x["n"] for x in groups)
    out = []
    for gr in groups:
        kn, inner = gr["n"], []
        for kind, raw in gr["items"]:
            h = fix_html(raw, fn_map)
            if kind == "k":
                h = re.sub(r"^(\d{1,2})\.\s*", r'<a class="kn" href="#k\1" title="Khoản \1">\1.</a> ', h)
                inner.append('<p class="lk">%s</p>' % h)
            elif kind == "p":
                lm = re.match(r"^([a-zđ])\)", plain(raw))
                lid = ("dd" if lm.group(1) == "đ" else lm.group(1)) if lm else ""
                h = re.sub(r"^([a-zđ])\)\s*", r'<b class="pl">\1)</b> ', h)
                inner.append('<p class="lp"%s>%s</p>' % (' id="k%s-%s"' % (kn, lid) if kn and lid else "", h))
            elif kind == "h":
                inner.append('<p class="lh">%s</p>' % h)
            else:
                inner.append('<p class="lx">%s</p>' % h)
        body = "".join(inner)
        key = kn if kn is not None else ("" if not numbered else None)
        if key is not None and key in ks:
            cut = body.index("</p>") + 4
            body = body[:cut] + '<div class="kpen">' + pen_tags(a, ks[key]) + "</div>" + body[cut:]
        out.append('<div class="kh"%s>%s</div>' % (' id="k%s" data-k="%s"' % (kn, kn) if kn else "", body))
    return "".join(out)


def cm_html(a, fn_map):
    out = []
    for i, (kind, raw) in enumerate(a.d["cm"]):
        h = fix_html(raw, fn_map)
        if kind == "h":
            out.append('<h3 class="ch" id="cm%d">%s</h3>' % (i, h))
        elif kind == "s":
            out.append('<p class="cs">%s</p>' % h)
        elif kind == "b":
            out.append('<p class="cb">%s</p>' % h)
        elif kind == "q":
            out.append('<blockquote class="cq">%s</blockquote>' % h)
        elif kind == "n":
            out.append('<div class="callout callout--new cn">%s<div>%s</div></div>' % (ic("spark"), h))
        else:
            out.append("<p>%s</p>" % h)
    return "".join(out)


def fn_list(a, fn_map):
    fns = a.d.get("fn") or {}
    if not fn_map or not fns:
        return ""
    items = sorted(fn_map.items(), key=lambda x: x[1])
    return ('<div class="fn-list"><b>Chú thích</b><ol>' +
            "".join('<li id="fn-%d">%s</li>' % (num, esc(fns.get(k, ""))) for k, num in items) + "</ol></div>")


# =============================================================================
# Các trang
# =============================================================================
def stat(i, n, t, s):
    return ('<div class="stat"><span class="si">%s</span><span><b>%s</b><span>%s<br>%s</span></span></div>' % (ic(i), n, t, s))


def li_row(k, v):
    return '<div class="li-row"><dt>%s</dt><dd>%s</dd></div>' % (k, v)


def page_home():
    st = TOC["stats"]
    p2 = [c for c in CHAPS if c["part"] == "p2"]
    p1 = [c for c in CHAPS if c["part"] != "p2"]
    n_cm = len([a for a in ARTS if a.M.get("ln") and a.M["ln"][1] > 0])
    tries = ["Điều 173", "lừa đảo qua mạng", "khoản 2 điều 134", "đồng phạm", "say rượu lái xe", '"tái phạm nguy hiểm"']
    intent = [("tim-kiem", "search", "Tra tội danh theo hành vi", "Mô tả hành vi, ví dụ: “vay tiền không trả”"),
              ("cong-cu-thoi-hieu", "clock", "Phân loại tội & tính thời hiệu", "Theo Điều 9, Điều 27, Điều 28"),
              ("cong-cu-tuoi", "user", "Kiểm tra tuổi chịu TNHS", "Tính tuổi chính xác theo Điều 12"),
              ("cong-cu-so-sanh", "columns", "So sánh hai tội danh", "Đối chiếu dấu hiệu & khung hình phạt")]
    main = (
        '<section class="hero">' + drum() + '<div class="wrap hero-grid">'
        '<div><span class="eyebrow">Bộ luật số 100/2015/QH13 · cập nhật 2025</span>'
        "<h1>Tra cứu <em>Bộ luật Hình sự</em> <br>nhanh, chính xác, dễ hiểu</h1>"
        '<p class="hero-sub">Toàn văn %d điều luật kèm bình luận khoa học, khung hình phạt từng khoản, phân loại tội phạm và '
        "thời hiệu — tìm được cả khi gõ không dấu.</p>" % st["arts"] +
        '<div id="heroSearch">' + search_form(lg=True) + "</div>"
        '<div class="hero-try js-only"><span>Thử tìm:</span>' +
        "".join('<button type="button" data-try="%s">%s</button>' % (esc(x), esc(x)) for x in tries) + "</div></div>"
        '<aside class="intent" aria-label="Lối tắt theo nhu cầu"><h2>Bạn đang cần gì?</h2><p>Chọn nhanh theo tình huống nghiên cứu</p>' +
        "".join('<a href="%s"%s><span class="ii">%s</span><span><b>%s</b><small>%s</small></span><span class="go">%s</span></a>'
                % (h, ' data-act="focus-hero"' if h == "tim-kiem" else "", ic(i), t, s, ic("chev-r")) for h, i, t, s in intent) +
        "</aside></div></section>"
        '<div class="wrap stats"><div class="stats-in">' +
        stat("book", st["arts"], "điều luật", "gồm Điều 217a, 256a") +
        stat("list", st["chapters"], "chương", "3 phần · %d mục" % sum(len(c["muc"]) for c in CHAPS)) +
        stat("spark", st["n25"], "điều sửa đổi", "theo Luật số 86/2025/QH15") +
        stat("note", n_cm, "điều có bình luận", "phân tích khoa học kèm theo") + "</div></div>"
        '<section class="wrap sec"><div class="sec-h"><div><span class="eyebrow">Phần thứ hai</span><h2>Tra cứu theo nhóm tội phạm</h2>'
        "<p>14 chương, từ an ninh quốc gia đến tội phạm chiến tranh</p></div>"
        '<a class="more" href="muc-luc">Toàn bộ mục lục ' + ic("chev-r") + "</a></div>"
        '<div class="groups">' +
        "".join('<a class="grp" href="chuong-%s"><span class="gi">%s</span><span><span class="gn">%s</span><h3>%s</h3>'
                '<span class="gm">%d điều · Điều %s – %s</span></span></a>'
                % (c["slug"], ic(ICONS[c["id"]]), esc(c["label"]), esc(c["name"]), len(c["arts"]), c["first"].id, c["last"].id) for c in p2) +
        '<a class="grp grp--more" href="cong-cu-khung-hinh-phat"><span class="gi">' + ic("table") + '</span><span><span class="gn">Tra nhanh</span>'
        '<h3>Bảng khung hình phạt của mọi tội danh</h3><span class="gm">Lọc theo tử hình, chung thân, độ tuổi</span></span></a>'
        '<a class="grp grp--more" href="muc-luc"><span class="gi">' + ic("list") + '</span><span><span class="gn">Toàn bộ</span>'
        "<h3>Mục lục %d điều luật</h3><span class=\"gm\">Lọc tức thì theo tên hoặc số điều</span></span></a>" % len(ARTS) +
        "</div></section>"
        '<section class="wrap sec"><div class="sec-h"><div><h2>Thường được tra cứu</h2><p>Những tội danh phổ biến trong thực tiễn tố tụng</p></div></div>'
        '<div class="pop-grid">' + "".join(art_card(BY_ID[i]) for i in POPULAR if i in BY_ID) + "</div></section>"
        '<section class="wrap sec"><div class="sec-h"><div><span class="eyebrow">Phần thứ nhất &amp; thứ ba</span><h2>Những quy định chung</h2>'
        "<p>Nguyên tắc, hình phạt, quyết định hình phạt, thời hiệu, xóa án tích…</p></div></div>"
        '<div class="gen">' +
        "".join('<a href="chuong-%s"><span class="gr">%s</span><span class="gt">%s%s</span><span class="gc">Đ.%s%s</span></a>'
                % (c["slug"], esc(c["num"] or "—"), esc(c["name"]),
                   ' <span class="tag tag--rep26">%s</span>' % CH_NOTE[c["id"]]["short"] if c["id"] in CH_NOTE else "",
                   c["first"].id, "–" + c["last"].id if c["first"] is not c["last"] else "") for c in p1) +
        "</div></section>"
        '<section class="wrap sec"><div class="sec-h"><div><h2>Công cụ hỗ trợ nghiên cứu</h2><p>Tính toán tự động từ chính văn bản điều luật</p></div>'
        '<a class="more" href="cong-cu">Tất cả công cụ ' + ic("chev-r") + "</a></div>" + tool_cards() + "</section>"
        '<section class="wrap sec"><div class="law-info">'
        '<div class="li-card"><h3>' + ic("scale") + "Thông tin văn bản</h3><dl>" +
        li_row("Số hiệu", "Bộ luật Hình sự số 100/2015/QH13") +
        li_row("Ngày thông qua", "27/11/2015 (Quốc hội khóa XIII, kỳ họp thứ 10)") +
        li_row("Hiệu lực thi hành", "01/01/2018") +
        li_row("Sửa đổi, bổ sung", "Luật số 12/2017/QH14 · Luật số 59/2024/QH15 · Luật số 86/2025/QH15 (hiệu lực 01/7/2025)") +
        li_row("Tình trạng", '<span class="ok">Còn hiệu lực</span> — Chương XII đã bãi bỏ từ 01/01/2026') +
        "</dl></div>"
        '<div class="li-card"><h3>' + ic("info") + "Lưu ý khi sử dụng</h3>"
        '<p class="muted" style="font-size:.93rem;line-height:1.65">Văn bản điều luật cập nhật đến Luật số 86/2025/QH15. Phần bình luận là '
        "tài liệu khoa học tham khảo, không phải văn bản quy phạm pháp luật. Các chỉ dẫn tự động (loại tội, thời hiệu, khung hình phạt) "
        "được tính từ câu chữ điều luật để hỗ trợ nghiên cứu; khi áp dụng cho vụ việc cụ thể cần đối chiếu văn bản gốc và hướng dẫn hiện hành.</p>"
        '<p style="margin-top:14px"><a class="btn btn--sm" href="gioi-thieu">' + ic("info") + "Nguồn dữ liệu &amp; phương pháp</a></p></div>"
        "</div></section>" + cta_block())
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebSite", "@id": SITE + "#website", "url": SITE, "name": SITE_NAME, "inLanguage": "vi",
         "description": HOME_DESC, "publisher": {"@id": SITE + "#org"},
         "potentialAction": {"@type": "SearchAction",
                             "target": {"@type": "EntryPoint", "urlTemplate": SITE + "tim-kiem?q={search_term_string}"},
                             "query-input": "required name=search_term_string"}},
        ORG,
        dict(CODE, **{"@id": SITE + "#blhs", "description": "Bộ luật Hình sự số 100/2015/QH13, sửa đổi, bổ sung bởi Luật số "
                      "12/2017/QH14, Luật số 59/2024/QH15 và Luật số 86/2025/QH15.", "legislationLegalForce": "https://schema.org/InForce"}),
    ]}
    return {"path": "", "title": HOME_TITLE, "og_title": SITE_NAME, "desc": HOME_DESC, "main": main, "body": "is-home",
            "ld": ld, "lastmod": True}


def page_toc():
    parts = []
    for p in PARTS:
        chs = []
        for c in [c for c in CHAPS if c["part"] == p["id"]]:
            lst, last_m = "", None
            for a in c["arts"]:
                if a.m and a.m != last_m:
                    last_m = a.m
                    mn = muc_name(c, a.m)
                    if mn:
                        lst += '<div class="tmuc">%s</div>' % esc(mn)
                lst += ('<a class="ta%s" href="dieu-%s"><span class="an">Điều %s</span><span class="at">%s</span><span class="tags">%s</span></a>'
                        % (" is-rep" if a.rep else "", a.id, esc(a.id), esc(a.t), art_tags(a, True)))
            chs.append(
                '<details class="tch" data-c="%s"><summary><span class="cn">%s</span><span class="ct"><b>%s</b>'
                "<small>%d điều · Điều %s – %s%s · ~%d phút đọc luật</small>%s</span>"
                '<a class="btn btn--sm btn--ghost" href="chuong-%s">Xem</a>%s</summary><div class="tch-body">'
                '<a class="ta ch-open" href="chuong-%s">Xem trang tổng quan %s %s</a>%s</div></details>'
                % (c["id"], esc(c["num"] or "TH"), esc(c["title"]), len(c["arts"]), c["first"].id, c["last"].id,
                   " · %d mục" % len(c["muc"]) if c["muc"] else "", read_min(c["sz"][0]),
                   ' <span class="tag tag--rep26">%s</span>' % CH_NOTE[c["id"]]["short"] if c["id"] in CH_NOTE else "",
                   c["slug"], ic("chev-d", "chev"), c["slug"], esc(c["label"]), ic("arrow-r"), lst))
        parts.append('<section class="toc-part"><h2><small>%s</small>%s</h2>%s</section>' % (esc(p["label"]), esc(p["name"]), "".join(chs)))
    crumbs = [("Trang chủ", "./"), ("Mục lục", None)]
    main = (ph(crumbs, "Mục lục Bộ luật Hình sự",
               "3 phần · 26 chương · %d điều. Gõ để lọc tức thì theo số điều hoặc tên điều (có dấu hay không dấu đều được)." % len(ARTS),
               "Cấu trúc Bộ luật") +
            '<div class="toc-bar js-only"><div class="wrap"><div class="sb"><div class="sb-box">' + ic("filter") +
            '<input class="sb-in" type="search" placeholder="Lọc mục lục… (vd: tai san, 250)" aria-label="Lọc mục lục"></div></div>'
            '<div class="toc-open" role="group" aria-label="Bộ lọc">' +
            "".join('<button type="button" class="chip" aria-pressed="%s">%s</button>' % ("true" if i == 0 else "false", t)
                    for i, t in enumerate(["Tất cả", "Sửa đổi 2025", "Có dấu (*)"])) +
            '<button type="button" class="chip">Mở hết</button><button type="button" class="chip">Thu gọn</button></div></div></div>'
            '<div class="wrap">' + "".join(parts) + "</div>")
    desc = ("Mục lục đầy đủ Bộ luật Hình sự 2015 (sửa đổi 2017, 2025): 3 phần, 26 chương, %d điều; đánh dấu %d điều sửa đổi "
            "năm 2025, các điều đã bãi bỏ. Lọc nhanh theo số điều hoặc tên tội." % (len(ARTS), TOC["stats"]["n25"]))
    return {"path": "muc-luc", "title": "Mục lục %d điều" % len(ARTS) + SUFFIX, "desc": desc, "main": main,
            "crumbs": crumbs, "lastmod": True}


def page_chapter(c):
    i = CHAPS.index(c)
    prev, nxt = (CHAPS[i - 1] if i else None), (CHAPS[i + 1] if i + 1 < len(CHAPS) else None)
    n_th = len([1 for a in c["arts"] if (max_of(a) or {}).get("th")])
    lst, last_m = "", None
    for a in c["arts"]:
        if a.m and a.m != last_m:
            last_m = a.m
            mn = muc_name(c, a.m)
            if mn:
                lst += '<h2 class="muc-h">%s</h2>' % esc(mn)
        k = max_of(a)
        lst += ('<a class="ca" href="dieu-%s"><span class="cn"><small>Điều</small><b>%s</b></span><h3>%s</h3><p>%s</p><span class="cm">%s%s%s</span></a>'
                % (a.id, esc(a.id), esc(a.t), esc(a.M.get("ex", "")),
                   '<span class="tag tag--c%d">%s</span>' % (k["c"], esc(max_text(a))) if k else "", art_tags(a, True),
                   '<span class="tag tag--a14">Từ đủ 14 tuổi chịu TNHS</span>' if a.M.get("a14") else ""))
    crumbs = [("Trang chủ", "./"), ("Mục lục", "muc-luc"), (c["label"], None)]
    meta = ('<div class="ph-meta"><span>%s%d điều (Điều %s – %s)</span><span>%s~%d phút đọc luật · ~%d phút bình luận</span>%s</div>'
            % (ic("book"), len(c["arts"]), c["first"].id, c["last"].id, ic("clock"), read_min(c["sz"][0]), read_min(c["sz"][1]),
               "<span>%s%d điều có khung tử hình</span>" % (ic("alert"), n_th) if n_th else ""))
    acts = ('<div class="ph-acts"><a class="btn btn--g" href="dieu-%s">%sĐọc từ Điều %s</a>%s%s</div>'
            % (c["first"].id, ic("book"), c["first"].id,
               '<a class="btn" href="chuong-%s">%s%s</a>' % (prev["slug"], ic("chev-l"), esc(prev["label"])) if prev else "",
               '<a class="btn" href="chuong-%s">%s%s</a>' % (nxt["slug"], esc(nxt["label"]), ic("chev-r")) if nxt else ""))
    main = (ph(crumbs, c["title"], None, part_name(c["part"]), meta + acts) +
            '<div class="wrap page">' +
            ('<div class="callout callout--warn" style="margin-bottom:18px">%s<div><b>Lưu ý hiệu lực:</b> %s</div></div>'
             % (ic("alert"), esc(CH_NOTE[c["id"]]["text"])) if c["id"] in CH_NOTE else "") +
            '<div class="chap-list">' + lst + "</div></div>")
    names = "; ".join(a.t for a in c["arts"][:6])
    desc = clip("%s Bộ luật Hình sự 2015 (sửa đổi 2025)%s gồm %d điều (Điều %s – %s): %s"
                % (c["label"], " – " + c["name"] if c["num"] else "", len(c["arts"]), c["first"].id, c["last"].id, names), 175)
    return {"path": "chuong-" + c["slug"], "title": c["title"] + SUFFIX, "desc": desc, "main": main, "crumbs": crumbs, "lastmod": True}


def side_html(a):
    h, last_p = "", None
    for c in CHAPS:
        if c["part"] != last_p:
            last_p = c["part"]
            h += '<div class="sp">%s</div>' % esc([p for p in PARTS if p["id"] == c["part"]][0]["label"])
        cur = c is a.ch
        h += ('<div class="sc%s"><a href="chuong-%s">%s<span class="r">%s</span><span>%s</span></a>'
              % (" open" if cur else "", c["slug"], ic("chev-r"), esc(c["num"] or "TH"), esc(c["name"])))
        if cur:
            h += '<div class="sc-l">' + "".join(
                '<a href="dieu-%s"%s><b>%s</b><span>%s</span></a>'
                % (x.id, ' class="on" aria-current="page"' if x is a else ' class="is-rep"' if x.rep else "", esc(x.id), esc(x.t))
                for x in c["arts"]) + "</div>"
        h += "</div>"
    return ('<aside class="side" aria-label="Mục lục điều luật"><div class="side-h js-only"><input class="inp" type="search" '
            'placeholder="Lọc nhanh điều luật…" aria-label="Lọc mục lục"></div><div class="side-b">' + h + "</div></aside>")


def rel_html(a):
    M = a.M

    def sec(title, ids):
        ids = [i for i in (ids or []) if i in BY_ID and i != a.id]
        if not ids:
            return ""
        return ('<section class="rel-sec"><h3>%s</h3><div class="rel-grid">%s</div></section>'
                % (title, "".join(art_card(BY_ID[i]) for i in ids)))

    near = [ARTS[a.i + j].id for j in (-2, -1, 1, 2) if 0 <= a.i + j < len(ARTS) and ARTS[a.i + j].ch is a.ch]
    gen = ([i for i in GENERAL + (["12"] if M.get("a14") else []) if i not in (M.get("ol") or [])]
           if a.ch["part"] == "p2" else [])
    return (sec("Điều luật được dẫn chiếu trong văn bản", M.get("ol")) + sec("Được viện dẫn tại các điều", M.get("in")) +
            sec("Được phân tích trong phần bình luận", M.get("oc")) + sec("Quy định chung thường áp dụng kèm", gen) +
            sec("Các điều lân cận trong " + a.ch["label"], near))


def article_desc(a):
    t = a.t[0].lower() + a.t[1:] if a.t.startswith("Tội ") else a.t
    lead = "Điều %s Bộ luật Hình sự 2015 (sửa đổi 2025) quy định về %s" % (a.id, t)
    if a.rep or a.r26:
        lead += " (đã bãi bỏ)"
    k = max_of(a)
    if k and not a.rep:
        lead += ", mức phạt " + max_text(a).replace("Cao nhất: ", "cao nhất ").lower()
    lead += ". "
    ex = re.sub(r"\*", "", a.M.get("ex", "")).rstrip("…").strip()
    if a.rep:
        ex = ""
    body = lead + ex if ex else lead + "Toàn văn điều luật, bình luận khoa học và các điều liên quan."
    return clip(body, 175)


def page_article(a):
    c, M = a.ch, a.M
    prev = ARTS[a.i - 1] if a.i else None
    nxt = ARTS[a.i + 1] if a.i + 1 < len(ARTS) else None
    muc = muc_name(c, a.m) if a.m else None
    has_cm = bool(M.get("ln") and M["ln"][1] > 0 and a.d["cm"])
    fn_map = {}
    law = law_html(a, fn_map)
    cm = cm_html(a, fn_map) if has_cm else ""
    crumbs = [("Trang chủ", "./"), (c["label"], "chuong-" + c["slug"]), ("Điều " + a.id, None)]
    callouts = ""
    if c["id"] in CH_NOTE:
        callouts += ('<div class="callout callout--warn" style="margin-bottom:16px">%s<div><b>Lưu ý hiệu lực:</b> %s</div></div>'
                     % (ic("alert"), esc(CH_NOTE[c["id"]]["text"])))
    if a.rep:
        callouts += ('<div class="callout callout--rep" style="margin-bottom:16px">%s<div><b>Điều luật đã bị bãi bỏ.</b> '
                     "Nội dung dưới đây được giữ lại để tham khảo.</div></div>" % ic("info"))
    note_map = {}
    for kind, raw in a.d["cm"]:
        if kind == "n":
            callouts += ('<div class="callout callout--new" style="margin-bottom:16px">%s<div>%s</div></div>'
                         % (ic("spark"), fix_html(raw, note_map)))
    has_pen = bool(main_frames(a))
    pen_card = ('<details class="rc mob-only" open style="margin-bottom:16px"><summary style="cursor:pointer;font-weight:700;'
                'display:flex;gap:8px;align-items:center">%sTóm tắt khung hình phạt</summary><div style="margin-top:12px">%s</div></details>'
                % (ic("scale"), pen_chart(a))) if has_pen else ""
    head = (
        '<header class="art-h">' + crumb(crumbs) +
        '<div class="art-tags"><span class="tag tag--soft">%s</span><a class="tag tag--soft" href="chuong-%s">%s</a>%s%s</div>'
        % (esc(part_name(c["part"]).split(":")[0]), c["slug"], esc(c["label"]), art_tags(a),
           '<span class="tag tag--a14" title="Người từ đủ 14 đến dưới 16 tuổi chịu TNHS ở khung rất nghiêm trọng, đặc biệt nghiêm trọng">'
           "Từ đủ 14 tuổi chịu TNHS (khoản 2 Điều 12)</span>" if M.get("a14") else "") +
        '<h1><span class="dn">Điều %s.</span> %s</h1>' % (esc(a.id), esc(a.t)) +
        '<div class="art-sum"><span>%s%s</span>%s<span>%s~%d phút đọc%s</span>%s</div>'
        % (ic(ICONS.get(c["id"], "book")), esc(c["name"]), "<span>%s%s</span>" % (ic("list"), esc(muc)) if muc else "",
           ic("clock"), read_min(M["ln"][0] if M.get("ln") else 0),
           " · bình luận ~%d phút" % read_min(M["ln"][1]) if has_cm else "",
           "<span>%s%s</span>" % (ic("scale"), esc(max_text(a))) if has_pen else "") +
        '<div class="tools no-print js-only">'
        '<button type="button" class="btn btn--p" data-act="save" aria-pressed="false">%s<span>Lưu điều này</span></button>' % ic("bookmark") +
        '<button type="button" class="btn" data-act="copy-art" title="Sao chép toàn văn điều luật">%s<span>Sao chép</span></button>' % ic("copy") +
        '<button type="button" class="btn" data-act="share" title="Chia sẻ">%s<span>Chia sẻ</span></button>' % ic("share") +
        '<a class="btn" href="cong-cu-so-sanh?a=%s" title="So sánh với điều khác">%s<span>So sánh</span></a>' % (a.id, ic("columns")) +
        '<button type="button" class="btn btn--ic" data-act="print" title="In điều luật" aria-label="In điều luật">%s</button>' % ic("print") +
        '<button type="button" class="btn btn--ic" data-act="settings" title="Tùy chỉnh hiển thị: cỡ chữ, kiểu chữ, giao diện" '
        'aria-label="Tùy chỉnh hiển thị" aria-haspopup="dialog">%s</button></div></header>' % ic("text"))
    rel = rel_html(a)
    rel_n = len(M.get("ol") or []) + len(M.get("in") or []) + len(M.get("oc") or [])
    tabs = ('<nav class="tabs" aria-label="Nội dung điều luật"><a href="#p-noi-dung" aria-current="true"><span class="tl-l">Nội dung điều luật</span>'
            '<span class="tl-s">Điều luật</span></a>' +
            ('<a href="#p-binh-luan">Bình luận<span class="cnt">%d phút</span></a>' % read_min(M["ln"][1]) if has_cm else "") +
            ('<a href="#p-lien-quan">Liên quan%s</a>' % ('<span class="cnt">%d</span>' % rel_n if rel_n else "") if rel else "") + "</nav>")
    body = tabs + (
        '<div class="panel" id="p-noi-dung"><h2 class="vh">Nội dung Điều %s</h2>' % esc(a.id) + callouts + pen_card +
        '<div class="law-paper"><div class="law" id="lawBody">' + law + "</div></div>" +
        ('<p class="cm-note" style="margin-top:14px">%s<span>Khoản, điểm gắn dấu <b>*</b> là nội dung đã được sửa đổi, bổ sung theo luật '
         "sửa đổi Bộ luật Hình sự (ghi chú của tài liệu nguồn).</span></p>" % ic("info") if a.am else "") +
        ("" if has_cm else fn_list(a, fn_map)) + "</div>")
    if has_cm:
        body += ('<section class="panel" id="p-binh-luan" aria-labelledby="h-bl"><h2 class="muc-h" id="h-bl">Bình luận Điều %s</h2>'
                 '<p class="cm-note">%s<span>Bình luận khoa học mang tính học thuật, tham khảo; không phải văn bản quy phạm pháp luật.</span></p>'
                 '<div class="cm">%s</div>%s</section>' % (esc(a.id), ic("info"), cm, fn_list(a, fn_map)))
    if rel:
        body += ('<section class="panel" id="p-lien-quan" aria-labelledby="h-lq"><h2 class="muc-h" id="h-lq">Điều luật liên quan</h2>%s</section>'
                 % rel)
    pager = ('<nav class="pager no-print" aria-label="Điều trước, điều sau">%s%s</nav>'
             % ('<a href="dieu-%s" rel="prev"><small>%sĐiều trước</small><span>Điều %s. %s</span></a>'
                % (prev.id, ic("chev-l"), esc(prev.id), esc(prev.t)) if prev else "<span></span>",
                '<a class="nx" href="dieu-%s" rel="next"><small>Điều sau%s</small><span>Điều %s. %s</span></a>'
                % (nxt.id, ic("chev-r"), esc(nxt.id), esc(nxt.t)) if nxt else ""))
    # Cột phải: khung hình phạt, đi tới khoản, điều liên quan
    rail = ""
    if has_pen:
        rail += '<div class="rc"><h3>%sKhung hình phạt</h3>%s</div>' % (ic("scale"), pen_chart(a))
    kl = []
    for kind, raw in a.d["law"]:
        m = re.match(r"^(\d{1,2})\.\s*(.*)$", plain(raw)) if kind == "k" else None
        if m:
            p = m.group(2)
            kl.append('<a href="#k%s"><b>Khoản %s</b><span>%s</span></a>' % (m.group(1), m.group(1), esc(p[:68] + "…" if len(p) > 70 else p)))
    if kl:
        rail += '<div class="rc"><h3>%sĐi tới khoản</h3><div class="kl">%s</div></div>' % (ic("list"), "".join(kl))
    refs = []
    for x in (M.get("ol") or []) + (M.get("in") or []):
        if x in BY_ID and x not in refs:
            refs.append(x)
    if refs:
        rail += ('<div class="rc"><h3>%sĐiều luật liên quan</h3><div class="rl">%s</div></div>'
                 % (ic("link"), "".join('<a href="dieu-%s" data-pv="%s"><b>Điều %s</b><span>%s</span></a>'
                                        % (x, x, esc(x), esc(BY_ID[x].t)) for x in refs[:8])))
    main = ('<div class="wrap"><div class="reader">' + side_html(a) +
            '<article class="art" id="art">' + head + body + pager + "</article>" +
            '<aside class="rail" aria-label="Thông tin bổ trợ">' + rail + "</aside></div></div>")
    url = SITE + "dieu-" + a.id
    desc = article_desc(a)
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "Legislation", "@id": url + "#dieu", "name": "Điều %s. %s" % (a.id, a.t),
         "alternateName": "Điều %s Bộ luật Hình sự 2015" % a.id, "url": url, "inLanguage": "vi", "description": desc,
         "legislationJurisdiction": "VN",
         "legislationLegalForce": "https://schema.org/NotInForce" if (a.rep or a.r26) else "https://schema.org/InForce",
         "isPartOf": dict(CODE, **{"@id": SITE + "#blhs"})},
        breadcrumb_ld(crumbs[:-1] + [("Điều " + a.id, "dieu-" + a.id)])]}
    preload = ['<link rel="preload" href="data/%s.json?v=%s" as="fetch" crossorigin>' % (c["id"], TOC["v"])]
    return {"path": "dieu-" + a.id, "title": "Điều %s. %s" % (a.id, a.t) + SUFFIX, "og_type": "article",
            "desc": desc, "main": main, "ld": ld, "preload": preload, "lastmod": True}


def law_quote(ids):
    """Trích nguyên văn các điều làm căn cứ cho công cụ."""
    out = []
    for i in ids:
        a = BY_ID[i]
        out.append('<div class="cmp-col"><h3><a href="dieu-%s"><b>Điều %s.</b> %s</a></h3><div class="law-paper"><div class="law">%s</div></div></div>'
                   % (a.id, esc(a.id), esc(a.t), law_html(a, {})))
    return ('<section class="sec"><div class="sec-h"><div><h2>Căn cứ pháp lý</h2><p>Nguyên văn điều luật được công cụ sử dụng</p></div></div>'
            '<div class="cmp" style="margin-top:0">' + "".join(out) + "</div></section>")


def lk(i, label=None):
    return '<a href="dieu-%s" data-pv="%s">%s</a>' % (i, i, label or "Điều " + i)


def tool_page(key, title, h1, sub, crumb_name, body, desc=None):
    crumbs = [("Trang chủ", "./"), ("Công cụ", "cong-cu")] + ([(crumb_name, None)] if crumb_name else [])
    if not crumb_name:
        crumbs = [("Trang chủ", "./"), ("Công cụ", None)]
    main = ph(crumbs, h1, sub, "Công cụ nghiên cứu") + '<div class="wrap page">' + body + "</div>"
    return {"path": "cong-cu" + ("-" + key if key else ""), "title": title + SUFFIX, "desc": clip(desc or plain(sub), 175),
            "main": main, "crumbs": crumbs, "lastmod": True}


def table9():
    rows = "".join('<tr><td><span class="tag tag--c%d">%s</span></td><td>%s</td><td>Điểm %s khoản 1 Điều 9</td><td><b>%d năm</b></td></tr>'
                   % (c, CLS[c]["n"], CLS[c]["d"], POINT[c], CLS[c]["th"]) for c in (1, 2, 3, 4))
    return ('<section class="sec"><div class="sec-h"><div><h2>Bảng tra nhanh: phân loại tội phạm &amp; thời hiệu</h2><p>Khoản 1 Điều 9 và khoản 2 Điều 27</p></div></div>'
            '<div style="overflow:auto"><table class="cmp-tbl"><thead><tr><th>Loại tội phạm</th><th>Mức cao nhất của khung hình phạt</th><th>Căn cứ</th>'
            "<th>Thời hiệu truy cứu</th></tr></thead><tbody>" + rows + "</tbody></table></div>"
            '<p class="legal-src">' + ic("info") + "Không áp dụng thời hiệu truy cứu đối với: các tội tại Chương XIII, Chương XXVI; tội tham ô "
            "tài sản, nhận hối lộ thuộc khoản 3, khoản 4 Điều 353, Điều 354 (" + lk("28", "Điều 28") + ").</p></section>")


def table60():
    return ('<section class="sec"><div class="sec-h"><div><h2>Thời hiệu thi hành bản án</h2><p>Khoản 2, khoản 3 Điều 60</p></div></div>'
            '<div style="overflow:auto"><table class="cmp-tbl"><thead><tr><th>Hình phạt đã tuyên</th><th>Thời hiệu</th></tr></thead><tbody>'
            "<tr><td>Phạt tiền, cải tạo không giam giữ hoặc phạt tù từ 03 năm trở xuống</td><td><b>05 năm</b></td></tr>"
            "<tr><td>Phạt tù từ trên 03 năm đến 15 năm</td><td><b>10 năm</b></td></tr>"
            "<tr><td>Phạt tù từ trên 15 năm đến 30 năm</td><td><b>15 năm</b></td></tr>"
            "<tr><td>Tù chung thân hoặc tử hình</td><td><b>20 năm</b></td></tr>"
            "<tr><td>Pháp nhân thương mại bị kết án</td><td><b>05 năm</b></td></tr></tbody></table></div></section>")


def penalty_rows():
    rows = []
    for a in ARTS:
        all_k = main_frames(a)
        if not all_k:
            continue
        ks = [k for k in all_k if not k.get("cb")] or all_k

        def lo_key(k):
            return k["hi"] if k.get("hi") is not None else (999 if (k.get("ct") or k.get("th")) else -1)
        mn = sorted(ks, key=lo_key)[0]
        rows.append({"a": a, "min": mn, "max": max_of(a), "cmin": min(k["c"] for k in ks), "cmax": max(k["c"] for k in ks)})
    return rows


def page_tools():
    pages = []
    hub_body = tool_cards() + table9() + table60()
    pages.append(tool_page("", "Công cụ nghiên cứu", "Công cụ hỗ trợ nghiên cứu",
                           "Các phép tính được xây dựng trực tiếp từ quy định của Bộ luật Hình sự, giúp luật sư, sinh viên và người dân "
                           "tra cứu nhanh, có căn cứ.", None, hub_body,
                           "Công cụ nghiên cứu Bộ luật Hình sự 2015 (sửa đổi 2025): phân loại tội phạm, tính thời hiệu truy cứu, tuổi chịu "
                           "trách nhiệm hình sự, thời hiệu thi hành bản án, so sánh điều luật, bảng khung hình phạt."))
    pages.append(tool_page("thoi-hieu", "Phân loại tội & thời hiệu truy cứu", "Phân loại tội phạm & thời hiệu truy cứu",
                           "Chọn điều luật và khoản (hoặc tự nhập mức cao nhất của khung hình phạt) để xác định loại tội theo Điều 9 và "
                           "thời hiệu truy cứu trách nhiệm hình sự theo Điều 27, Điều 28.", "Thời hiệu",
                           table9() + law_quote(["9", "27", "28"])))
    age14 = [a for a in ARTS if a.M.get("a14")]
    pages.append(tool_page("tuoi", "Tuổi chịu trách nhiệm hình sự", "Tuổi chịu trách nhiệm hình sự",
                           "Tính tuổi chính xác của người thực hiện hành vi tại thời điểm phạm tội và đối chiếu với Điều 12 Bộ luật Hình sự.",
                           "Tuổi chịu TNHS",
                           '<section class="sec" style="margin-top:0"><div class="sec-h"><div><h2>%d điều tại khoản 2 Điều 12</h2>'
                           "<p>Người từ đủ 14 tuổi đến dưới 16 tuổi chịu TNHS về tội phạm rất nghiêm trọng, đặc biệt nghiêm trọng tại các điều sau</p></div></div>"
                           '<div class="kpick">%s</div></section>' % (len(age14), "".join(
                               '<a class="chip" href="dieu-%s" title="%s">Điều %s</a>' % (a.id, esc(a.t), a.id) for a in age14)) +
                           law_quote(["12", "14"])))
    pages.append(tool_page("thi-hanh-an", "Thời hiệu thi hành bản án", "Thời hiệu thi hành bản án hình sự",
                           "Xác định thời hiệu thi hành bản án theo hình phạt đã tuyên (Điều 60) và các trường hợp không áp dụng thời hiệu (Điều 61).",
                           "Thi hành án", table60() + law_quote(["60", "61"])))
    pairs = "".join('<tr><td>%s</td><td>%s</td><td>%s</td></tr>'
                    % (esc(lab), lk(x, "Điều %s. %s" % (x, esc(BY_ID[x].t))), lk(y, "Điều %s. %s" % (y, esc(BY_ID[y].t))))
                    for x, y, lab in PRESETS if x in BY_ID and y in BY_ID)
    pages.append(tool_page("so-sanh", "So sánh điều luật", "So sánh điều luật",
                           "Đặt hai điều luật cạnh nhau để phân biệt dấu hiệu pháp lý, khung hình phạt và loại tội — đặc biệt hữu ích với các "
                           "tội danh dễ nhầm lẫn.", "So sánh",
                           '<section class="sec" style="margin-top:0"><div class="sec-h"><div><h2>Các cặp tội danh dễ nhầm lẫn</h2></div></div>'
                           '<div style="overflow:auto"><table class="cmp-tbl"><thead><tr><th>Cặp tội danh</th><th>Điều luật</th><th>Đối chiếu với</th></tr></thead>'
                           "<tbody>" + pairs + "</tbody></table></div></section>"))
    rows = penalty_rows()

    def age(a):
        return "14" if a.M.get("a14") else "18" if a.id in ("145", "146", "147") else "16"

    def cr(r):
        t = '<span class="tag tag--c%d">%s</span>' % (r["cmin"], CLS[r["cmin"]]["n"])
        return t if r["cmin"] == r["cmax"] else t + ' → <span class="tag tag--c%d">%s</span>' % (r["cmax"], CLS[r["cmax"]]["n"])
    trs = "".join(
        '<tr><td class="n"><a href="dieu-%s">%s</a></td><td><a href="dieu-%s" style="color:var(--ink);font-weight:500">%s</a> %s</td>'
        "<td>%s</td><td><span class=\"tag tag--c%d\">%s</span></td><td>%s</td><td>%s</td></tr>"
        % (r["a"].id, esc(r["a"].id), r["a"].id, esc(r["a"].t), art_tags(r["a"], True), esc(pen_label(r["min"])),
           r["max"]["c"], esc(pen_label(r["max"])), cr(r), age(r["a"])) for r in rows)
    pages.append(tool_page("khung-hinh-phat", "Bảng khung hình phạt", "Bảng tra khung hình phạt",
                           "%d tội danh tại Phần thứ hai, được tổng hợp tự động từ các khoản có quy định khung hình phạt chính. "
                           "Nhấn vào tội danh để xem toàn văn." % len(rows), "Khung hình phạt",
                           '<div style="overflow:auto"><table class="tbl cmp-tbl"><thead><tr><th>Điều</th><th>Tội danh</th><th>Khung thấp nhất</th>'
                           "<th>Khung cao nhất</th><th>Loại tội</th><th>Tuổi</th></tr></thead><tbody>" + trs + "</tbody></table></div>"
                           '<p class="legal-src" style="margin-top:14px">' + ic("info") + "Loại tội xác định theo khoản 1 Điều 9 cho từng khung; không tính "
                           "khung dành cho hành vi chuẩn bị phạm tội. “Tuổi”: độ tuổi tối thiểu phải chịu TNHS theo Điều 12 (và câu chữ của điều luật).</p>",
                           "Bảng khung hình phạt %d tội danh trong Bộ luật Hình sự 2015 (sửa đổi 2025): khung thấp nhất, khung cao nhất, "
                           "loại tội theo Điều 9 và độ tuổi chịu trách nhiệm hình sự của từng tội." % len(rows)))
    return pages


def page_about():
    st = TOC["stats"]
    crumbs = [("Trang chủ", "./"), ("Giới thiệu", None)]
    main = (ph(crumbs, "Giới thiệu & nguồn dữ liệu",
               "Công cụ tra cứu Bộ luật Hình sự do Công ty Luật TNHH Luật Sư Nam xây dựng nhằm phục vụ nghiên cứu, học tập và thực hành pháp luật.") +
            '<div class="wrap page" style="max-width:900px"><div class="cm" style="font-size:1rem">'
            '<h2 class="ch" style="margin-top:0">Phạm vi văn bản</h2>'
            "<p>Bộ luật Hình sự số 100/2015/QH13 được Quốc hội thông qua ngày 27/11/2015, có hiệu lực từ 01/01/2018; được sửa đổi, bổ sung bởi "
            "Luật số 12/2017/QH14, Luật số 59/2024/QH15 (Luật Tư pháp người chưa thành niên) và Luật số 86/2025/QH15 (thông qua ngày 25/6/2025, "
            "hiệu lực từ 01/7/2025).</p>"
            "<p>Trang hiện có <b>%d điều</b> (kể cả Điều 217a, 256a), trong đó <b>%d điều</b> được đánh dấu sửa đổi, bổ sung năm 2025 kèm ghi chú "
            "“Điểm mới năm 2025”.</p>" % (st["arts"], st["n25"]) +
            '<div class="callout callout--warn" style="margin:16px 0">' + ic("alert") + "<div><b>Chương XII đã bị bãi bỏ.</b> " +
            esc(CH_NOTE["c12"]["text"]) + "</div></div>"
            '<h2 class="ch">Nguồn dữ liệu &amp; cách xử lý</h2>'
            "<p>Văn bản điều luật và phần bình luận được chuyển đổi từ tài liệu “Bình luận khoa học Bộ luật Hình sự” (tệp Word). Trong quá trình "
            "chuyển đổi, hệ thống đã sửa một số lỗi đánh máy hiển nhiên theo văn bản chính thức (ví dụ “phạt từ từ 01 năm” tại khoản 1 Điều 348 "
            "được sửa thành “phạt tù từ 01 năm”), tách lại các điểm bị dồn dòng (khoản 2 Điều 60).</p>"
            "<p>Các chỉ dẫn tự động gồm: <b>khung hình phạt từng khoản</b> (nhận diện từ câu “thì bị phạt…”), <b>loại tội phạm</b> theo khoản 1 "
            "Điều 9 (căn cứ mức cao nhất của khung), <b>thời hiệu truy cứu</b> theo khoản 2 Điều 27 và trường hợp không áp dụng thời hiệu theo "
            "Điều 28, <b>độ tuổi</b> theo khoản 2 Điều 12. Đây là công cụ hỗ trợ; kết luận pháp lý cho vụ việc cụ thể phải căn cứ hồ sơ và quyết "
            "định của cơ quan có thẩm quyền.</p>"
            '<h2 class="ch">Đọc khi không có mạng</h2><p>Trang có thể cài lên màn hình chính như một ứng dụng và tải sẵn toàn bộ nội dung '
            "(~3 MB) vào bộ nhớ đệm của trình duyệt.</p>"
            '<h2 class="ch">Miễn trừ trách nhiệm</h2><p>Nội dung trên trang nhằm mục đích tham khảo, không thay thế ý kiến tư vấn pháp lý. Khi sử '
            "dụng trong hồ sơ tố tụng, vui lòng đối chiếu văn bản đăng trên Công báo, Cơ sở dữ liệu quốc gia về pháp luật hoặc văn bản hợp nhất "
            "mới nhất của Văn phòng Quốc hội.</p>"
            "</div></div>" + cta_block())
    return {"path": "gioi-thieu", "title": "Giới thiệu & nguồn dữ liệu" + SUFFIX, "main": main, "crumbs": crumbs, "lastmod": True,
            "desc": "Giới thiệu công cụ tra cứu Bộ luật Hình sự 2015 (sửa đổi 2017, 2025) của Công ty Luật TNHH Luật Sư Nam: phạm vi văn bản, "
                    "nguồn dữ liệu, phương pháp xác định khung hình phạt, loại tội, thời hiệu và lưu ý khi sử dụng."}


def page_search():
    crumbs = [("Trang chủ", "./"), ("Tìm kiếm", None)]
    main = (ph(crumbs, "Tìm kiếm trong Bộ luật Hình sự",
               "Tìm đồng thời trong tên điều, văn bản điều luật và phần bình luận. Gõ không dấu, dùng “ngoặc kép” để tìm cụm từ chính xác.",
               extra='<div id="srBox" style="margin-top:18px;max-width:760px">' + search_form() + "</div>") +
            '<div class="wrap"><div id="srOut"></div></div>')
    return {"path": "tim-kiem", "title": "Tìm kiếm" + SUFFIX, "main": main, "crumbs": crumbs, "noindex": True,
            "desc": "Tìm kiếm toàn văn Bộ luật Hình sự 2015 (sửa đổi 2025): tên điều, nội dung điều luật và bình luận khoa học; gõ không dấu."}


def page_saved():
    crumbs = [("Trang chủ", "./"), ("Đã lưu", None)]
    main = ph(crumbs, "Đã lưu, ghi chú & lịch sử", "Dữ liệu chỉ lưu trên trình duyệt của thiết bị này, không gửi đi đâu.")
    return {"path": "da-luu", "title": "Đã lưu" + SUFFIX, "main": main, "crumbs": crumbs, "noindex": True,
            "desc": "Các điều luật đã lưu, ghi chú cá nhân và lịch sử tra cứu Bộ luật Hình sự trên thiết bị này."}


# =============================================================================
# Ghép khuôn trang & ghi tệp
# =============================================================================
def head_html(p):
    url = SITE + p["path"]
    robots = "noindex, follow" if p.get("noindex") else "index, follow, max-snippet:-1, max-image-preview:large"
    og_title = p.get("og_title") or p["title"]
    lines = [
        "<title>%s</title>" % esc(p["title"]),
        '<meta name="description" content="%s">' % esc(p["desc"]),
        '<link rel="canonical" href="%s">' % esc(url),
        '<meta name="robots" content="%s">' % robots,
        '<meta property="og:type" content="%s">' % p.get("og_type", "website"),
        '<meta property="og:site_name" content="%s">' % esc(SITE_NAME),
        '<meta property="og:locale" content="vi_VN">',
        '<meta property="og:title" content="%s">' % esc(og_title),
        '<meta property="og:description" content="%s">' % esc(p["desc"]),
        '<meta property="og:url" content="%s">' % esc(url),
        '<meta property="og:image" content="%s">' % OG_IMAGE,
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta property="og:image:alt" content="%s">' % esc(OG_ALT),
        '<meta name="twitter:card" content="summary_large_image">',
        '<meta name="twitter:title" content="%s">' % esc(og_title),
        '<meta name="twitter:description" content="%s">' % esc(p["desc"]),
        '<meta name="twitter:image" content="%s">' % OG_IMAGE,
    ] + p.get("preload", [])
    ld = p.get("ld")
    if ld is None and p.get("crumbs"):
        crumbs = p["crumbs"]
        ld = {"@context": "https://schema.org", "@graph": [breadcrumb_ld(crumbs[:-1] + [(crumbs[-1][0], p["path"])])]}
    if ld:
        lines.append(jsonld(ld))
    return "\n".join(lines)


def render(tpl, p):
    out = re.sub(r"<!--seo:head-->.*?<!--/seo:head-->", lambda m: "<!--seo:head-->\n" + head_html(p) + "\n<!--/seo:head-->",
                 tpl, count=1, flags=re.S)
    out = re.sub(r"<body[^>]*>", '<body class="%s">' % p["body"] if p.get("body") else "<body>", out, count=1)
    out = re.sub(r"<!--seo:main-->.*?<!--/seo:main-->",
                 lambda m: "<!--seo:main-->\n<div data-prerender>" + p["main"] + "</div>\n<!--/seo:main-->", out, count=1, flags=re.S)
    return out


def lastmod_date():
    """Ngày cập nhật dữ liệu điều luật gần nhất (theo git), để sitemap không đổi mỗi lần chạy lại."""
    try:
        d = subprocess.check_output(["git", "log", "-1", "--format=%cs", "--", "data/"], cwd=ROOT, text=True).strip()
        if d:
            return d
    except Exception:
        pass
    return datetime.date.today().isoformat()


def main():
    tpl_path = os.path.join(ROOT, "index.html")
    tpl = open(tpl_path, encoding="utf-8").read()
    for mark in ("<!--seo:head-->", "<!--/seo:head-->", "<!--seo:main-->", "<!--/seo:main-->"):
        assert mark in tpl, "index.html thiếu vùng đánh dấu " + mark

    pages = [page_home(), page_toc()] + [page_chapter(c) for c in CHAPS] + [page_article(a) for a in ARTS] + \
        page_tools() + [page_about(), page_search(), page_saved()]

    # Xóa trang sinh từ lần trước nhưng không còn tương ứng (vd. điều/chương đổi số hiệu)
    keep = {p["path"] + ".html" for p in pages if p["path"]}
    for f in glob.glob(os.path.join(ROOT, "dieu-*.html")) + glob.glob(os.path.join(ROOT, "chuong-*.html")):
        if os.path.basename(f) not in keep:
            os.remove(f)

    written = 0
    for p in pages:
        dest = os.path.join(ROOT, (p["path"] or "index") + ".html")
        html_out = render(tpl, p)
        old = open(dest, encoding="utf-8").read() if os.path.exists(dest) else None
        if old != html_out:
            with open(dest, "w", encoding="utf-8", newline="\n") as f:
                f.write(html_out)
            written += 1

    day = lastmod_date()
    urls = ["  <url><loc>%s</loc><lastmod>%s</lastmod></url>" % (esc(SITE + p["path"]), day) for p in pages if not p.get("noindex")]
    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8", newline="\n") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
                "\n".join(urls) + "\n</urlset>\n")
    with open(os.path.join(ROOT, "robots.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write("# Công cụ tìm kiếm chỉ đọc robots.txt ở gốc tên miền. Với địa chỉ dạng …github.io/luathinhsu/, hãy khai báo\n"
                "# sitemap trong Google Search Console; tệp này có hiệu lực khi trang chạy trên tên miền riêng.\n"
                "User-agent: *\nAllow: /\n\nSitemap: %ssitemap.xml\n" % SITE)
    print("Đã sinh %d trang (%d tệp thay đổi), sitemap %d URL – %s" % (len(pages), written, len(urls), SITE))


if __name__ == "__main__":
    main()
