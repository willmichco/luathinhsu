# -*- coding: utf-8 -*-
"""
Sinh phân mục "Bộ luật Tố tụng hình sự" của website: thư mục to-tung-hinh-su/.

    python3 tools/tths_nguon.py /duong-dan/tracuuphapluat     # (khi cần) lấy lại dữ liệu nguồn
    python3 tools/build_tths.py

Đầu vào : index.html (khuôn trang), tools/nguon-tths/*.json (hồ sơ văn bản trích từ kho tracuuphapluat)
Đầu ra  : to-tung-hinh-su/index.html            – giới thiệu + mục lục 9 phần, 36 chương, 510 điều (+ Điều 506a)
          to-tung-hinh-su/dieu-<số>.html         – toàn văn từng điều, kèm mọi lần sửa đổi, bổ sung, bãi bỏ
          to-tung-hinh-su/sua-doi.html           – bảng các văn bản sửa đổi theo thứ tự hiệu lực
          to-tung-hinh-su/luat-<số hiệu>.html     – từng văn bản sửa đổi (các điều khoản tác động tới Bộ luật)
          to-tung-hinh-su/lich-su.html, van-ban-<số hiệu>.html – Bộ luật 2003, 1988 và các luật sửa đổi trước 2015
          to-tung-hinh-su/tim-kiem.html, to-tung-hinh-su/tim-kiem.json – tìm kiếm toàn văn (chạy trên trình duyệt)
          sitemap-tths.xml                        – được tools/build_seo.py gộp vào sitemap.xml

Nguyên tắc trình bày (vì văn bản tố tụng dùng trong hồ sơ vụ án):
  - Văn bản gốc của Bộ luật 2015 được giữ NGUYÊN VĂN theo nguồn; không tự "hợp nhất" các thay đổi từng cụm từ.
  - Mỗi điều bị tác động hiển thị đủ nguyên văn điều khoản sửa đổi (văn bản, điều/khoản/điểm, ngày hiệu lực).
  - Khi một văn bản thay thế toàn bộ một điều ("Sửa đổi, bổ sung Điều N như sau: “Điều N. …”"), nội dung mới được
    hiển thị là nội dung hiện hành, văn bản gốc thu gọn bên dưới.
  - Văn bản chưa đến ngày có hiệu lực (so với ngày dựng trang) được ghi rõ "chưa có hiệu lực".
Trang tĩnh, không cần app.js: mọi trang dùng <base href="../"> để chia sẻ assets/ với trang Bộ luật Hình sự.
"""
import datetime
import glob
import html
import json
import os
import re
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "nguon-tths")
OUT = os.path.join(ROOT, "to-tung-hinh-su")
DIR = "to-tung-hinh-su/"
SITE = os.environ.get("SITE_URL", "https://willmichco.github.io/luathinhsu/").rstrip("/") + "/"
TODAY = os.environ.get("TTHS_TODAY") or datetime.date.today().isoformat()

NAME = "Bộ luật Tố tụng hình sự"
SUFFIX = " – Bộ luật Tố tụng hình sự 2015"
SITE_NAME = "Tra cứu Bộ luật Tố tụng hình sự – Luật Sư Nam"
OG_IMAGE = SITE + "assets/img/og-cover.jpg"

# Văn bản sửa đổi, bổ sung, bãi bỏ BLTTHS 2015 và vị trí các điều khoản tác động trong từng văn bản.
#   at   : đường tới nút chứa các điều khoản sửa đổi, vd [("dieu","150"),("khoan","1")]
#   mode : "children" – mỗi nút con là một điều khoản sửa đổi; "self" – chính nút đó là một điều khoản sửa đổi
#   cite : mẫu trích dẫn của điều khoản sửa đổi ({x} = số hiệu nút con)
#   def  : điều của Bộ luật bị tác động khi điều khoản sửa đổi không ghi số điều (vd. Điều 73 Luật 128/2025/QH15)
LAWS = [
    {"id": "lvn-213366", "slug": "02-2021-qh15", "so": "02/2021/QH15", "hl": "2021-12-01", "full": True,
     "ten": "Luật sửa đổi, bổ sung một số điều của Bộ luật Tố tụng hình sự",
     "at": [("dieu", "1")], "mode": "children", "cite": "Khoản {x} Điều 1"},
    {"id": "lvn-360843", "slug": "34-2024-qh15", "so": "34/2024/QH15", "hl": "2025-01-01",
     "ten": "Luật Tổ chức Tòa án nhân dân",
     "at": [("dieu", "150"), ("khoan", "1")], "mode": "children", "cite": "Điểm {x} khoản 1 Điều 150"},
    {"id": "lvn-404081", "slug": "99-2025-qh15", "so": "99/2025/QH15", "hl": "2025-07-01", "full": True,
     "ten": "Luật sửa đổi, bổ sung một số điều của Bộ luật Tố tụng hình sự",
     "at": [("dieu", "1")], "mode": "children", "cite": "Khoản {x} Điều 1"},
    {"id": "lvn-379410", "slug": "59-2024-qh15", "so": "59/2024/QH15", "hl": "2026-01-01",
     "ten": "Luật Tư pháp người chưa thành niên",
     "at": [("dieu", "177"), ("khoan", "2")], "mode": "children", "cite": "Điểm {x} khoản 2 Điều 177"},
    {"id": "lvn-422131", "slug": "105-2025-qh15", "so": "105/2025/QH15", "hl": "2026-05-01",
     "ten": "Luật Giám định tư pháp",
     "at": [("dieu", "43")], "mode": "self", "cite": "Điều 43", "def": ["136"]},
    {"id": "lvn-423513", "slug": "103-2025-qh15", "so": "103/2025/QH15", "hl": "2026-07-01",
     "ten": "Luật Tương trợ tư pháp về hình sự",
     "at": [("dieu", "40"), ("khoan", "1")], "mode": "children", "cite": "Điểm {x} khoản 1 Điều 40"},
    {"id": "lvn-422291", "slug": "106-2025-qh15", "so": "106/2025/QH15", "hl": "2026-07-01",
     "ten": "Luật Thi hành án dân sự",
     "at": [("dieu", "114"), ("khoan", "1")], "mode": "self", "cite": "Khoản 1 Điều 114"},
    {"id": "lvn-422292", "slug": "128-2025-qh15", "so": "128/2025/QH15", "hl": "2026-07-01",
     "ten": "Luật Thi hành tạm giữ, tạm giam và cấm đi khỏi nơi cư trú",
     "at": [("dieu", "73")], "mode": "children", "cite": "Khoản {x} Điều 73", "def": ["123"]},
    {"id": "lvn-445854", "slug": "11-2026-qh16", "so": "11/2026/QH16", "hl": "2027-03-01",
     "ten": "Luật sửa đổi, bổ sung một số điều của Luật Hải quan",
     "at": [("dieu", "2"), ("khoan", "3")], "mode": "self", "cite": "Khoản 3 Điều 2"},
]
# Văn bản trước Bộ luật 2015 (đã hết hiệu lực) – trang toàn văn để nghiên cứu, đối chiếu
HIST = [
    {"id": "lvn-15809", "slug": "19-2003-qh11", "so": "19/2003/QH11", "ten": "Bộ luật Tố tụng hình sự năm 2003",
     "hl": "2004-07-01", "het": "Hết hiệu lực từ 01/01/2018 (thay thế bởi Bộ luật số 101/2015/QH13)"},
    {"id": "lvn-10555", "slug": "20-2000-qh10", "so": "20/2000/QH10",
     "ten": "Luật sửa đổi, bổ sung một số điều của Bộ luật Tố tụng hình sự năm 1988 (năm 2000)", "hl": None,
     "het": "Hết hiệu lực cùng Bộ luật năm 1988"},
    {"id": "lvn-2573", "slug": "5-l-ctn", "so": "5-L/CTN",
     "ten": "Luật sửa đổi, bổ sung một số điều của Bộ luật Tố tụng hình sự năm 1988 (năm 1992)", "hl": None,
     "het": "Hết hiệu lực cùng Bộ luật năm 1988"},
    {"id": "lvn-2004", "slug": "39-lct-hdnn8", "so": "39-LCT/HĐNN8",
     "ten": "Luật sửa đổi, bổ sung một số điều của Bộ luật Tố tụng hình sự năm 1988 (năm 1990)", "hl": None,
     "het": "Hết hiệu lực cùng Bộ luật năm 1988"},
    {"id": "lvn-1593", "slug": "7-lct-hdnn8", "so": "7-LCT/HĐNN8", "ten": "Bộ luật Tố tụng hình sự năm 1988",
     "hl": "1989-01-01", "het": "Hết hiệu lực từ 01/7/2004 (thay thế bởi Bộ luật số 19/2003/QH11)"},
]
# Lỗi tách chữ trong dữ liệu nguồn (chỉ xuất hiện ở phần tiêu đề, căn cứ của văn bản sửa đổi)
SPLIT_FIX = [("Đ ỔI", "ĐỔI"), ("S U NG", "SUNG"), ("S Ố", "SỐ"), ("T Ố", "TỐ"), ("B Ộ", "BỘ"), ("đ ổ i", "đổi"),
             ("s ố", "số"), ("đ i ều", "điều"), ("T ố", "Tố"), ("s ử a", "sửa")]


# =============================================================================
# Tiện ích
# =============================================================================
def esc(s):
    return html.escape(s or "", quote=True)


def ic(name, cls=None):
    return '<svg%s aria-hidden="true"><use href="#i-%s"/></svg>' % (' class="%s"' % cls if cls else "", name)


def clean(s):
    s = unicodedata.normalize("NFC", s or "").replace("\u00a0", " ").replace("\r", "")
    for a, b in SPLIT_FIX:
        s = s.replace(a, b)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r" +([,;.:!?)”])", r"\1", s)
    s = re.sub(r"([(“]) +", r"\1", s)
    s = re.sub(r" *\n *", "\n", s)
    return s.strip()


def vnd(iso):
    """2025-07-01 → 01/7/2025 (cách ghi ngày trong văn bản pháp luật)."""
    if not iso:
        return ""
    y, m, d = iso.split("-")
    return "%s/%s/%s" % (d, m, y)


def clip(s, n):
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= n else s[: n - 1].rsplit(" ", 1)[0] + "…"


def roman(s):
    v = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}
    n = 0
    for i, ch in enumerate(s):
        x = v[ch]
        n += -x if i + 1 < len(s) and v[s[i + 1]] > x else x
    return n


def akey(i):
    m = re.match(r"(\d+)([a-z]?)$", i)
    return (int(m.group(1)), m.group(2))


def load(i):
    return json.load(open(os.path.join(SRC, i + ".json"), encoding="utf-8"))


def dequote(s):
    return re.sub(r"“[^”]*(?:”|$)", " ", s, flags=re.S)


def find_node(cay, path):
    nodes = cay
    cur = None
    for cap, so in path:
        cur = None
        stack = list(nodes)
        while stack:
            x = stack.pop(0)
            if x.get("cap") == cap and (x.get("so") or "").strip() == so:
                cur = x
                break
            if x.get("cap") not in ("dieu",) or cap != "dieu":
                stack.extend(x.get("con", []))
        if cur is None:
            raise SystemExit("Không tìm thấy %s %s trong đường dẫn %r" % (cap, so, path))
        nodes = cur.get("con", [])
    return cur


# =============================================================================
# Bộ luật 2015: cấu trúc Phần → Chương → (Mục) → Điều
# =============================================================================
class Art:
    pass


CODE = load("lvn-101322")
PARTS, CHAPS, ARTS, BY = [], [], [], {}


def build_code():
    cur_p = cur_c = None
    for top in CODE["noiDung"]["duLieu"]["cay"]:
        if top.get("cap") != "phan":
            continue
        cur_p = {"id": top["id"], "so": clean(top.get("so")).title().replace("Thứ", "thứ"),
                 "ten": clean(top.get("tieuDe")), "chaps": []}
        PARTS.append(cur_p)
        direct = [x for x in top.get("con", []) if x.get("cap") == "dieu"]
        if direct:
            # Phần thứ chín (Điều 509, 510) không chia chương → một "chương" ảo mang tên phần
            top = dict(top, con=[x for x in top.get("con", []) if x.get("cap") != "dieu"] +
                       [{"cap": "chuong", "id": "chuong-" + top["id"], "so": "", "tieuDe": top.get("tieuDe"), "con": direct}])
        for ch in top.get("con", []):
            if ch.get("cap") != "chuong":
                continue
            num = clean(ch.get("so")).replace("Chương ", "")
            cur_c = {"id": ch["id"], "num": num, "slug": ch["id"].replace("chuong-", ""), "ten": clean(ch.get("tieuDe")),
                     "part": cur_p, "arts": [], "rep": None}
            cur_p["chaps"].append(cur_c)
            CHAPS.append(cur_c)

            def add(x, muc):
                if not x.get("so"):
                    # Vài điều trong nguồn chưa tách số hiệu: "Điều 429. Tên điều\nNội dung…" → so, tieuDe, text
                    m = re.match(r"\s*Điều\s+(\d+[a-z]?)\s*\.\s*([^\n]*)\n?(.*)$", clean(x.get("text")), flags=re.S)
                    x = dict(x, so=m.group(1), tieuDe=m.group(2), text=m.group(3))
                a = Art()
                a.id = x["so"].strip()
                a.t0 = clean(x.get("tieuDe"))
                a.t = a.t0
                a.node = x
                a.ch = cur_c
                a.muc = muc
                a.items = []
                a.new = None
                cur_c["arts"].append(a)
                ARTS.append(a)
                BY[a.id] = a

            for x in ch.get("con", []):
                if x.get("cap") == "dieu":
                    add(x, None)
                elif x.get("cap") == "muc":
                    t = clean(x.get("tieuDe"))
                    if x.get("so") and not t.startswith("Mục"):
                        t = clean(x["so"]) + ". " + t
                    for y in x.get("con", []):
                        if y.get("cap") == "dieu":
                            add(y, t)
    assert len(ARTS) == CODE["noiDung"]["duLieu"]["soDieu"] == 510, len(ARTS)


build_code()
for i, a in enumerate(ARTS):
    a.i = i


# =============================================================================
# Văn bản sửa đổi: tách từng điều khoản sửa đổi và điều bị tác động
# =============================================================================
ITEMS = []


def own_text(x):
    t = clean(x.get("text"))
    if not t and x.get("cap") == "dieu":
        t = clean(x.get("tieuDe"))
    return t


def tree_text(x):
    out = [own_text(x)]
    for c in x.get("con", []):
        out.append(tree_text(c))
    return "\n".join(t for t in out if t)


def targets_of(instr):
    """Các điều của Bộ luật được nhắc tới trong câu lệnh sửa đổi (đã bỏ phần trong ngoặc kép)."""
    out = []
    for m in re.finditer(r"Điều (\d{1,3}[a-z]?)\b(?!\s+của\s+(?:Luật|Bộ luật Hình sự|Bộ luật hình sự|Nghị))", instr):
        n = m.group(1)
        if (n in BY or re.match(r"\d+a$", n)) and n not in out:
            out.append(n)
    return out


def build_items():
    for L in LAWS:
        d = load(L["id"])
        L["doc"] = d
        L["ngay"] = d.get("ngayBanHanh")
        L["future"] = L["hl"] > TODAY
        L["nguon"] = (d.get("nguon") or {}).get("url")
        L["items"] = []
        base = find_node(d["noiDung"]["duLieu"]["cay"], L["at"])
        nodes = [base] if L["mode"] == "self" else [c for c in base.get("con", []) if c.get("cap") in ("khoan", "diem")]
        for x in nodes:
            text = own_text(x)
            instr = clean(dequote(text))
            tg = targets_of(instr) or list(L.get("def") or [])
            it = {"law": L, "node": x, "cite": L["cite"].format(x=(x.get("so") or "").strip()), "instr": instr, "targets": tg,
                  "kind": "part", "chap": None, "title": None}
            m = re.match(r"Bãi bỏ chương ([IVXLC]+)", instr, flags=re.I)
            if m:
                it["kind"] = "repeal-chapter"
                it["chap"] = m.group(1).upper()
                ch = [c for c in CHAPS if c["num"] == it["chap"]][0]
                it["targets"] = [a.id for a in ch["arts"]]
            m = re.match(r"Bổ sung Điều (\d+[a-z]) vào sau Điều (\d+)", instr)
            if m:
                it["kind"] = "new"
                it["targets"] = [m.group(1)]
                it["after"] = m.group(2)
            m = re.match(r"Sửa đổi, bổ sung Điều (\d+[a-z]?) như sau", instr)
            if m and re.search(r"“\s*Điều %s\." % m.group(1), text):
                it["kind"] = "whole"
                it["targets"] = [m.group(1)]
            # Tên điều mới (thay toàn bộ điều, bổ sung điều mới, sửa tên điều)
            full = tree_text(x)
            if it["kind"] in ("whole", "new") or "Sửa tên Điều" in full:
                tm = re.search(r"“\s*Điều (\d+[a-z]?)\.\s*([^\n”]+)", full)
                if tm and tm.group(1) in it["targets"]:
                    it["title"] = clean(tm.group(2)).rstrip(";.")
            L["items"].append(it)
            ITEMS.append(it)


build_items()

# Điều 506a (bổ sung bởi Luật 99/2025/QH15): tạo điều mới trong chương của Điều 506
for it in ITEMS:
    if it["kind"] == "new" and it["targets"][0] not in BY:
        prev = BY[it["after"]]
        a = Art()
        a.id = it["targets"][0]
        a.t0 = None
        a.t = it["title"]
        a.node = None
        a.ch = prev.ch
        a.muc = prev.muc
        a.items = []
        a.new = it
        a.ch["arts"].insert(a.ch["arts"].index(prev) + 1, a)
        ARTS.insert(ARTS.index(prev) + 1, a)
        BY[a.id] = a
for i, a in enumerate(ARTS):
    a.i = i

# Gắn điều khoản sửa đổi vào từng điều (theo thứ tự ngày hiệu lực, rồi ngày ban hành)
ORDER = sorted(LAWS, key=lambda L: (L["hl"], L["ngay"] or ""))
for L in ORDER:
    for it in L["items"]:
        for t in it["targets"]:
            if t in BY:
                BY[t].items.append(it)
        if it["kind"] == "repeal-chapter":
            ch = [c for c in CHAPS if c["num"] == it["chap"]][0]
            ch["rep"] = it

for a in ARTS:
    eff = [it for it in a.items if not it["law"]["future"]]
    a.eff = eff
    a.fut = [it for it in a.items if it["law"]["future"]]
    a.rep = next((it for it in eff if it["kind"] == "repeal-chapter"), None)
    a.whole = None
    for it in eff:
        if it["kind"] in ("whole", "new"):
            a.whole = it
        if it["title"]:
            a.t = it["title"]
    a.years = sorted({it["law"]["hl"][:4] for it in a.items})


def lc(s):
    return s[:1].lower() + s[1:]


def chap_label(c):
    return "Chương " + c["num"] if c["num"] else sentence(c["part"]["so"])


def law_label(L):
    return "Luật số " + L["so"]


# =============================================================================
# Hiển thị văn bản
# =============================================================================
def link_refs(h, self_id=None):
    """Liên kết "Điều N" (của Bộ luật này) → trang điều đó. h đã thoát HTML."""
    def rep(m):
        n, rest = m.group(1), h[m.end(): m.end() + 70]
        if n not in BY or n == self_id:
            return m.group(0)
        if re.match(r"\s*(?:,\s*\d+\s*)*(?:và\s+\d+\s*)?(?:của|tại)\s+(?:các\s+)?(?:Luật|Bộ luật [Hh]ình sự|Bộ luật Dân sự|Bộ luật Tố tụng dân sự|"
                    r"Bộ luật Lao động|Nghị|Pháp lệnh|Hiến pháp|Công ước|điều ước)", rest):
            return m.group(0)
        return '<a href="%sdieu-%s">Điều %s</a>' % (DIR, n, n)
    return re.sub(r"(?<![\w>])Điều (\d{1,3}[a-z]?)(?![\w.])", rep, h)


def para_cls(p):
    s = p.lstrip("“\"")
    if re.match(r"\d+[a-z]?\.\s", s):
        return "lk"
    if re.match(r"[a-zđ]\)\s", s):
        return "lp"
    if re.match(r"(Điều \d+[a-z]?\.|Chương [IVXLC]+|Mục \d+|PHẦN THỨ)", s):
        return "lh"
    return "lx"


def node_paras(x, out, prefix=True):
    """Văn bản tự do (điều khoản sửa đổi, văn bản lịch sử) → các đoạn (lớp CSS, chữ)."""
    t = clean(x.get("text") or "")
    so = (x.get("so") or "").strip()
    cap = x.get("cap")
    if prefix and so and cap in ("khoan", "diem") and t:
        pre = so + ("." if cap == "khoan" or so[0].isdigit() else ")")
        if not t.lstrip("“").startswith(pre):
            t = pre + " " + t
    for p in [p for p in t.split("\n") if p.strip()]:
        out.append((para_cls(p), p))
    for c in x.get("con", []):
        node_paras(c, out)
    return out


def paras_html(ps, link=False):
    o = []
    for cls, p in ps:
        h = esc(p)
        if link:
            h = link_refs(h)
        if cls == "lk":
            h = re.sub(r"^(“?)(\d+[a-z]?\.)\s*", r'<b class="kn">\1\2 </b>', h)
        elif cls == "lp":
            h = re.sub(r"^(“?)([a-zđ]\))\s*", r'<b class="pl">\1\2 </b>', h)
        o.append('<p class="%s">%s</p>' % (cls, h))
    return "".join(o)


def art_law_html(a):
    """Toàn văn một điều của Bộ luật 2015 (giống cấu trúc .law của trang Bộ luật Hình sự)."""
    x = a.node
    out = []
    intro = clean(x.get("text"))
    if intro:
        out.append('<div class="kh">%s</div>' % "".join('<p class="lx">%s</p>' % link_refs(esc(p), a.id) for p in intro.split("\n")))
    for k in x.get("con", []):
        cap = k.get("cap")
        if cap == "khoan":
            kn = (k.get("so") or "").strip()
            ps = [p for p in clean(k.get("text")).split("\n") if p]
            inner = []
            for j, p in enumerate(ps):
                h = link_refs(esc(p), a.id)
                if j == 0 and kn:
                    inner.append('<p class="lk"><a class="kn" href="%sdieu-%s#k%s" title="Khoản %s">%s. </a>%s</p>' % (DIR, a.id, kn, kn, kn, h))
                else:
                    inner.append('<p class="lx">%s</p>' % h)
            for dd in k.get("con", []):
                if dd.get("cap") == "diem":
                    ln = (dd.get("so") or "").strip()
                    dps = [p for p in clean(dd.get("text")).split("\n") if p]
                    for j, p in enumerate(dps):
                        h = link_refs(esc(p), a.id)
                        if j == 0 and ln:
                            inner.append('<p class="lp" id="k%s-%s"><b class="pl">%s) </b>%s</p>' % (kn, "dd" if ln == "đ" else ln, esc(ln), h))
                        else:
                            inner.append('<p class="lx">%s</p>' % h)
                elif dd.get("cap") == "ghi-chu":
                    inner.append('<p class="lnote">%sGhi chú của nguồn dữ liệu: %s</p>' % (ic("info"), esc(clean(dd.get("text")))))
                else:
                    inner.append(paras_html(node_paras(dd, [])))
            out.append('<div class="kh" id="k%s" data-k="%s">%s</div>' % (kn, kn, "".join(inner)))
        elif cap == "ket":
            out.append('<div class="kh law-end">%s</div>' % "".join('<p class="lx">%s</p>' % esc(p) for p in clean(k.get("text")).split("\n")))
        elif cap == "ghi-chu":
            out.append('<p class="lnote">%sGhi chú của nguồn dữ liệu: %s</p>' % (ic("info"), esc(clean(k.get("text")))))
        else:
            out.append('<div class="kh">%s</div>' % paras_html(node_paras(k, [])))
    return "".join(out)


def item_html(it, show_targets=True, cur=None):
    L = it["law"]
    ps = node_paras(it["node"], [], prefix=False)
    st = ('<span class="tag tag--fut">Chưa có hiệu lực – từ %s</span>' % vnd(L["hl"]) if L["future"]
          else '<span class="tag tag--now">Hiệu lực từ %s</span>' % vnd(L["hl"]))
    kind = {"whole": "Thay thế toàn bộ điều", "new": "Bổ sung điều mới", "repeal-chapter": "Bãi bỏ chương"}.get(it["kind"], "")
    tg = ""
    if show_targets and it["targets"] and it["kind"] != "repeal-chapter":
        tg = '<div class="am-tg">Tác động: %s</div>' % " ".join(
            '<a class="chip%s" href="%sdieu-%s">Điều %s</a>' % (" on" if t == cur else "", DIR, t, t) for t in it["targets"] if t in BY)
    elif it["kind"] == "repeal-chapter":
        ch = [c for c in CHAPS if c["num"] == it["chap"]][0]
        tg = '<div class="am-tg">Tác động: <a class="chip" href="%s#chuong-%s">Chương %s (Điều %s – %s)</a></div>' % (
            DIR, ch["slug"], ch["num"], ch["arts"][0].id, ch["arts"][-1].id)
    return ('<article class="am%s"><header class="am-h"><a class="am-law" href="%sluat-%s"><b>%s %s</b><span>%s</span></a>'
            '<div class="am-st">%s%s</div></header><div class="law am-body"><div class="kh">%s</div></div>%s</article>'
            % (" am--fut" if L["future"] else "", DIR, L["slug"], esc(it["cite"]), esc(law_label(L)), esc(L["ten"]), st,
               '<span class="tag tag--soft">%s</span>' % kind if kind else "", paras_html(ps, link=False), tg))


def whole_html(it):
    """Nội dung mới của điều bị thay thế toàn bộ: bỏ câu lệnh và dòng "Điều N. Tên điều" (đã là tiêu đề trang)."""
    ps = node_paras(it["node"], [], prefix=True)
    out, started = [], False
    for cls, p in ps:
        s = p
        if not started:
            i = s.find("“")
            if i < 0:
                continue
            s = s[i + 1:]
            started = True
            if re.match(r"\s*Điều \d+[a-z]?\.", s):
                continue
        if not s.strip():
            continue
        out.append((para_cls(s), s))
    if out:
        cls, last = out[-1]
        out[-1] = (cls, re.sub(r"”\s*[.;]?\s*$", "", last))
    return paras_html(out, link=True)


# =============================================================================
# Khuôn trang
# =============================================================================
TPL = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()


def make_template():
    t = TPL
    t = t.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="../">', 1)
    t = re.sub(r'<link rel="preload" href="data/(toc|meta)\.json"[^>]*>\n', "", t)
    t = t.replace('<link rel="manifest" href="manifest.webmanifest">', '<link rel="manifest" href="manifest.webmanifest">\n'
                  '<link rel="stylesheet" href="%stths.css?v=__V__">' % DIR)
    # Thương hiệu, ô tìm kiếm, điều hướng: trỏ vào phân mục Tố tụng hình sự
    t = t.replace('<a class="brand" href="./" aria-label="Trang chủ – Tra cứu Bộ luật Hình sự">',
                  '<a class="brand" href="%s" aria-label="Trang chủ – Tra cứu Bộ luật Tố tụng hình sự">' % DIR)
    t = t.replace("<b>Tra cứu Bộ luật Hình sự</b><small>Luật Sư Nam · Từ điển pháp luật</small>",
                  "<b>Bộ luật Tố tụng hình sự</b><small>Luật Sư Nam · Từ điển pháp luật</small>")
    t = re.sub(r'<form class="sb" role="search" action="tim-kiem" method="get">(.*?)</form>',
               lambda m: ('<form class="sb" role="search" action="%stim-kiem" method="get">' % DIR) + m.group(1)
               .replace("Số điều, tên tội, từ khóa… (vd: 173, lừa đảo)", "Số điều, từ khóa… (vd: 143, tạm giam)")
               .replace("Tìm kiếm trong Bộ luật Hình sự", "Tìm kiếm trong Bộ luật Tố tụng hình sự") + "</form>", t, count=1, flags=re.S)
    t = re.sub(r'<nav class="hd-nav" aria-label="Điều hướng chính">.*?</nav>',
               '<nav class="hd-nav" aria-label="Điều hướng chính"><a href="%s" data-nav="muc-luc">Mục lục</a>'
               '<a href="%ssua-doi" data-nav="sua-doi">Sửa đổi</a><a href="./" data-nav="blhs">Bộ luật Hình sự</a></nav>' % (DIR, DIR),
               t, count=1, flags=re.S)
    t = re.sub(r'<nav class="tabbar" aria-label="Điều hướng nhanh">.*?</nav>',
               '<nav class="tabbar" aria-label="Điều hướng nhanh">'
               '<a href="%s" data-nav="muc-luc">%s<span>Mục lục</span></a>'
               '<a href="%stim-kiem" data-nav="tim-kiem">%s<span>Tra cứu</span></a>'
               '<a href="%ssua-doi" data-nav="sua-doi">%s<span>Sửa đổi</span></a>'
               '<a href="%slich-su" data-nav="lich-su">%s<span>Lịch sử</span></a>'
               '<a href="./" data-nav="blhs">%s<span>BL Hình sự</span></a></nav>'
               % (DIR, ic("list"), DIR, ic("search"), DIR, ic("history"), DIR, ic("book"), ic("scale")), t, count=1, flags=re.S)
    t = t.replace('<nav class="drawer-nav" id="drawerNav"></nav>', '<nav class="drawer-nav" id="drawerNav">' + drawer_html() + "</nav>")
    t = re.sub(r'(<div class="ft-brand">.*?<p>).*?(</p>)',
               r"\1Trang tra cứu Bộ luật Tố tụng hình sự số 101/2015/QH13 và các văn bản sửa đổi, bổ sung, bãi bỏ "
               r"(cập nhật đến Luật số 11/2026/QH16).\2", t, count=1, flags=re.S)
    t = re.sub(r'(<div class="ft-col">\s*<h2>Tra cứu</h2>).*?(</div>)',
               lambda m: m.group(1) + '\n      <a href="%s">Mục lục Bộ luật Tố tụng hình sự</a>\n      <a href="%stim-kiem">Tìm kiếm toàn văn</a>'
               '\n      <a href="%ssua-doi">Các văn bản sửa đổi, bổ sung</a>\n      <a href="%slich-su">Bộ luật 2003, 1988</a>'
               '\n      <a href="./">Bộ luật Hình sự 2015</a>\n    ' % (DIR, DIR, DIR, DIR) + m.group(2), t, count=1, flags=re.S)
    t = re.sub(r'<script src="assets/js/app\.js\?v=[^"]+" defer></script>',
               '<script src="%stths.js?v=__V__" defer></script>' % DIR, t, count=1)
    t = t.replace(' data-act="toc"', "")
    return t


def drawer_html():
    L = lambda href, icon, t: '<a href="%s">%s%s</a>' % (href, ic(icon), t)
    return (L(DIR, "list", "Mục lục Bộ luật Tố tụng hình sự") + L(DIR + "tim-kiem", "search", "Tìm kiếm toàn văn") +
            L(DIR + "sua-doi", "history", "Các văn bản sửa đổi, bổ sung") + L(DIR + "lich-su", "book", "Bộ luật 2003, 1988") +
            '<hr><div class="dn-h">Bộ luật Hình sự</div>' + L("./", "scale", "Tra cứu Bộ luật Hình sự 2015") +
            L("cong-cu", "tools", "Công cụ nghiên cứu hình sự") +
            '<div class="dn-h">Liên hệ luật sư</div>' +
            '<a href="tel:0983498499">%sGọi 0983 498 499</a>' % ic("phone") +
            '<a href="https://zalo.me/0983498499" target="_blank" rel="noopener">%sNhắn Zalo</a>' % ic("chat") +
            '<a href="mailto:luatsunam.hcm@gmail.com">%sluatsunam.hcm@gmail.com</a>' % ic("mail"))


def crumb(items):
    out = []
    for i, (t, href) in enumerate(items):
        out.append((ic("chev-r") if i else "") +
                   ('<a href="%s">%s</a>' % (href, esc(t)) if href is not None else '<span aria-current="page">%s</span>' % esc(t)))
    return '<nav class="crumb" aria-label="Đường dẫn">' + "".join(out) + "</nav>"


def breadcrumb_ld(items):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": t, "item": SITE + href}
        for i, (t, href) in enumerate(items) if href is not None]}


def ph(crumbs, title, sub, eyebrow=None, extra=""):
    return ('<section class="ph"><div class="hero-bg" aria-hidden="true"><div class="hero-drum"></div></div><div class="wrap ph-in">' +
            crumb(crumbs) + ('<span class="eyebrow">%s</span>' % esc(eyebrow) if eyebrow else "") +
            "<h1>%s</h1>" % esc(title) + ("<p>%s</p>" % sub if sub else "") + extra + "</div></section>")


def head_html(p):
    url = SITE + p["path"].replace("index", "").rstrip("/") if p["path"] != DIR + "index" else SITE + DIR
    if p["path"].endswith("/index"):
        url = SITE + DIR
    title = p["title"]
    lines = [
        "<title>%s</title>" % esc(title),
        '<meta name="description" content="%s">' % esc(p["desc"]),
        '<link rel="canonical" href="%s">' % esc(url),
        '<meta name="robots" content="%s">' % ("noindex, follow" if p.get("noindex") else "index, follow, max-snippet:-1, max-image-preview:large"),
        '<meta property="og:type" content="%s">' % p.get("og_type", "website"),
        '<meta property="og:site_name" content="%s">' % esc(SITE_NAME),
        '<meta property="og:locale" content="vi_VN">',
        '<meta property="og:title" content="%s">' % esc(p.get("og_title", title)),
        '<meta property="og:description" content="%s">' % esc(p["desc"]),
        '<meta property="og:url" content="%s">' % esc(url),
        '<meta property="og:image" content="%s">' % OG_IMAGE,
        '<meta name="twitter:card" content="summary_large_image">',
        '<meta name="twitter:title" content="%s">' % esc(p.get("og_title", title)),
        '<meta name="twitter:description" content="%s">' % esc(p["desc"]),
        '<meta name="twitter:image" content="%s">' % OG_IMAGE,
        '<link rel="preload" href="assets/img/trong-dong.svg" as="image" type="image/svg+xml" crossorigin>',
    ]
    ld = p.get("ld")
    if ld is None and p.get("crumbs"):
        cr = p["crumbs"]
        ld = {"@context": "https://schema.org", "@graph": [breadcrumb_ld(cr[:-1] + [(cr[-1][0], p["path"].replace("/index", "/"))])]}
    if ld:
        lines.append('<script type="application/ld+json">%s</script>' % json.dumps(ld, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"))
    return "\n".join(lines)


def render(tpl, p):
    out = re.sub(r"<!--seo:head-->.*?<!--/seo:head-->", lambda m: "<!--seo:head-->\n" + head_html(p) + "\n<!--/seo:head-->",
                 tpl, count=1, flags=re.S)
    out = re.sub(r"<body[^>]*>", '<body class="tths %s" data-page="%s">' % (p.get("body", ""), p.get("nav", "")), out, count=1)
    out = re.sub(r"<!--seo:main-->.*?<!--/seo:main-->", lambda m: "<!--seo:main-->\n" + p["main"] + "\n<!--/seo:main-->",
                 out, count=1, flags=re.S)
    nav = p.get("nav")
    if nav:
        out = re.sub(r'(<a href="[^"]*" data-nav="%s")' % nav, r'\1 class="on" aria-current="page"', out)
    return out


CODE_LD = {"@type": "Legislation", "@id": SITE + DIR + "#bltths", "name": "Bộ luật Tố tụng hình sự", "legislationIdentifier": "101/2015/QH13",
           "legislationDate": "2015-11-27", "legislationType": "Bộ luật", "legislationJurisdiction": "VN", "inLanguage": "vi",
           "url": SITE + DIR}


# =============================================================================
# Các trang
# =============================================================================
def art_tags(a, short=False):
    out = []
    if a.rep:
        out.append('<span class="tag tag--rep">Bãi bỏ từ %s</span>' % vnd(a.rep["law"]["hl"]))
    elif a.new:
        out.append('<span class="tag tag--am">Bổ sung %s</span>' % a.new["law"]["hl"][:4])
    elif a.eff:
        ys = sorted({it["law"]["hl"][:4] for it in a.eff})
        out.append('<span class="tag tag--am">Sửa đổi %s</span>' % ", ".join(ys))
    if a.fut:
        out.append('<span class="tag tag--fut">Sắp sửa đổi %s</span>' % vnd(a.fut[0]["law"]["hl"]) if not short else
                   '<span class="tag tag--fut">Sắp sửa đổi</span>')
    return "".join(out)


def toc_html():
    parts = []
    for p in PARTS:
        chs = []
        for c in p["chaps"]:
            lst, last_m = "", None
            for a in c["arts"]:
                if a.muc and a.muc != last_m:
                    last_m = a.muc
                    lst += '<div class="tmuc">%s</div>' % esc(a.muc)
                lst += ('<a class="ta%s" href="%sdieu-%s" data-f="%s"><span class="an">Điều %s</span><span class="at">%s</span><span class="tags">%s</span></a>'
                        % (" is-rep" if a.rep else "", DIR, a.id, esc(("dieu %s %s" % (a.id, a.t)).lower()), esc(a.id), esc(a.t), art_tags(a, True)))
            rep = c["rep"]
            chs.append(
                '<details class="tch" id="chuong-%s"><summary><span class="cn">%s</span><span class="ct"><b>%s</b>'
                '<small>%d điều · Điều %s – %s</small>%s</span>%s</summary><div class="tch-body">%s</div></details>'
                % (c["slug"], esc(c["num"] or "TH"), esc(c["ten"].capitalize() if c["ten"].isupper() else c["ten"]), len(c["arts"]),
                   c["arts"][0].id, c["arts"][-1].id,
                   ' <span class="tag tag--rep26">Bãi bỏ từ %s</span>' % vnd(rep["law"]["hl"]) if rep and not rep["law"]["future"] else "",
                   ic("chev-d", "chev"), lst))
        parts.append('<section class="toc-part"><h2><small>%s</small>%s</h2>%s</section>' % (esc(p["so"]), esc(sentence(p["ten"])), "".join(chs)))
    return "".join(parts)


def sentence(s):
    return s[:1] + s[1:].lower() if s.isupper() else s


def law_rows():
    rows = []
    for L in ORDER:
        n_art = len({t for it in L["items"] for t in it["targets"] if t in BY})
        rows.append('<tr><td><a href="%sluat-%s"><b>%s</b></a></td><td>%s</td><td>%s</td><td>%s</td><td>%d</td></tr>'
                    % (DIR, L["slug"], esc(L["so"]), esc(L["ten"]), vnd(L["ngay"]),
                       ('<span class="tag tag--fut">%s – chưa có hiệu lực</span>' if L["future"] else '<span class="tag tag--now">%s</span>') % vnd(L["hl"]),
                       n_art))
    return ('<div class="tbl-wrap"><table class="tbl tbl--cards"><thead><tr><th>Số hiệu</th><th>Tên văn bản</th><th>Ngày ban hành</th>'
            '<th>Hiệu lực</th><th>Số điều bị tác động</th></tr></thead><tbody>%s</tbody></table></div>' % "".join(rows))


def stats():
    n_am = len([a for a in ARTS if a.eff and not a.rep and not a.new])
    n_rep = len([a for a in ARTS if a.rep])
    n_fut = len([a for a in ARTS if a.fut])
    return n_am, n_rep, n_fut


def page_index():
    n_am, n_rep, n_fut = stats()
    rep = [c for c in CHAPS if c["rep"]]
    crumbs = [("Bộ luật Hình sự", "./"), ("Bộ luật Tố tụng hình sự", None)]
    sub = ("Toàn văn Bộ luật số 101/2015/QH13: %d phần, %d chương, %d điều (kể cả Điều 506a bổ sung năm 2025). "
           "Mỗi điều kèm nguyên văn mọi lần sửa đổi, bổ sung, bãi bỏ của %d văn bản, ghi rõ ngày có hiệu lực."
           % (len(PARTS), len([c for c in CHAPS if c["num"]]), len(ARTS), len(LAWS)))
    extra = ('<div class="ph-meta"><span>%s%d điều đã được sửa đổi, bổ sung</span><span>%s%d điều thuộc chương đã bãi bỏ</span>'
             '<span>%sCập nhật đến Luật số 11/2026/QH16</span></div>' % (ic("note"), n_am, ic("alert"), n_rep, ic("calendar")) +
             '<form class="sb sb--lg" role="search" action="%stim-kiem" method="get" style="margin-top:18px"><div class="sb-box">%s'
             '<input class="sb-in" type="search" name="q" placeholder="Nhập số điều hoặc từ khóa… (vd: 143, tạm giam, bào chữa)" '
             'aria-label="Tìm kiếm trong Bộ luật Tố tụng hình sự" enterkeyhint="search" spellcheck="false">'
             '<button class="sb-go" type="submit" aria-label="Tra cứu">%s<span>Tra cứu</span></button></div></form>' % (DIR, ic("search"), ic("search")))
    notes = ""
    for c in rep:
        it = c["rep"]
        notes += ('<div class="callout callout--warn">%s<div><b>Lưu ý hiệu lực:</b> Chương %s “%s” (Điều %s – Điều %s) đã bị bãi bỏ kể từ ngày %s '
                  'theo %s %s (%s). Thủ tục tố tụng đối với người chưa thành niên hiện thực hiện theo Luật Tư pháp người chưa thành niên. '
                  'Nội dung chương được giữ lại để tham khảo, nghiên cứu.</div></div>'
                  % (ic("alert"), c["num"], esc(sentence(c["ten"])), c["arts"][0].id, c["arts"][-1].id, vnd(it["law"]["hl"]),
                     esc(lc(it["cite"])), esc(law_label(it["law"])), esc(it["law"]["ten"])))
    fut = [L for L in LAWS if L["future"]]
    for L in fut:
        notes += ('<div class="callout callout--info">%s<div><b>Sắp có hiệu lực:</b> <a href="%sluat-%s">%s</a> (%s) sửa đổi %d điều của Bộ luật, '
                  'có hiệu lực từ ngày %s. Các điều liên quan được gắn nhãn “Sắp sửa đổi”.</div></div>'
                  % (ic("info"), DIR, L["slug"], esc(law_label(L)), esc(L["ten"]), len({t for it in L["items"] for t in it["targets"]}), vnd(L["hl"])))
    notes += ('<div class="callout callout--info">%s<div><b>Cách đọc:</b> văn bản điều luật là <b>nguyên văn Bộ luật năm 2015</b>. Các thay đổi '
              'được trích nguyên văn ngay dưới từng điều, theo thứ tự hiệu lực. Điều bị thay thế toàn bộ hiển thị nội dung mới. '
              'Khi dùng trong hồ sơ tố tụng, đối chiếu văn bản đăng Công báo hoặc văn bản hợp nhất của Văn phòng Quốc hội.</div></div>' % ic("book"))
    main = (ph(crumbs, "Bộ luật Tố tụng hình sự 2015", sub, "Bộ luật số 101/2015/QH13 · sửa đổi 2021, 2024, 2025, 2026", extra) +
            '<div class="wrap page"><div class="tths-notes">%s</div>' % notes +
            '<section class="sec-s"><h2 class="muc-h">Các văn bản sửa đổi, bổ sung, bãi bỏ</h2>%s</section>' % law_rows() +
            '<section class="sec-s" id="muc-luc"><h2 class="muc-h">Mục lục Bộ luật</h2>'
            '<div class="toc-bar js-only"><div class="sb"><div class="sb-box">%s<input class="sb-in" id="tocQ" type="search" '
            'placeholder="Lọc mục lục… (vd: 143, tam giam, bào chữa)" aria-label="Lọc mục lục"></div></div>'
            '<div class="toc-open" role="group" aria-label="Bộ lọc"><button type="button" class="chip" data-f="all" aria-pressed="true">Tất cả</button>'
            '<button type="button" class="chip" data-f="am" aria-pressed="false">Đã sửa đổi</button>'
            '<button type="button" class="chip" data-f="fut" aria-pressed="false">Sắp sửa đổi</button>'
            '<button type="button" class="chip" data-x="open">Mở hết</button><button type="button" class="chip" data-x="close">Thu gọn</button></div></div>'
            '<p class="toc-empty" hidden>Không có điều nào khớp.</p>%s</section></div>' % (ic("filter"), toc_html()))
    desc = ("Tra cứu toàn văn Bộ luật Tố tụng hình sự 2015 (số 101/2015/QH13): %d điều, mục lục 9 phần 36 chương; nguyên văn sửa đổi "
            "theo Luật 02/2021/QH15, 34/2024/QH15, 59/2024/QH15, 99/2025/QH15 và các luật năm 2025, 2026." % len(ARTS))
    ld = {"@context": "https://schema.org", "@graph": [dict(CODE_LD, description=desc), breadcrumb_ld([("Bộ luật Hình sự", ""), ("Bộ luật Tố tụng hình sự", DIR)])]}
    return {"path": DIR + "index", "title": "Tra cứu Bộ luật Tố tụng hình sự 2015 (sửa đổi 2021, 2025) – Luật Sư Nam", "desc": desc,
            "main": main, "ld": ld, "nav": "muc-luc", "body": "is-toc"}


def side_html(a):
    h = ""
    for p in PARTS:
        h += '<div class="sp">%s</div>' % esc(p["so"])
        for c in p["chaps"]:
            cur = c is a.ch
            h += ('<div class="sc%s"><a href="%s#chuong-%s">%s<span class="r">%s</span><span>%s</span></a>'
                  % (" open" if cur else "", DIR, c["slug"], ic("chev-r"), esc(c["num"] or "TH"), esc(sentence(c["ten"]))))
            if cur:
                h += '<div class="sc-l">' + "".join(
                    '<a href="%sdieu-%s"%s><b>%s</b><span>%s</span></a>'
                    % (DIR, x.id, ' class="on" aria-current="page"' if x is a else ' class="is-rep"' if x.rep else "", esc(x.id), esc(x.t))
                    for x in c["arts"]) + "</div>"
            h += "</div>"
    return ('<aside class="side" aria-label="Mục lục điều luật"><div class="side-h js-only"><input class="inp" id="sideQ" type="search" '
            'placeholder="Lọc nhanh điều luật…" aria-label="Lọc mục lục"><a class="side-all" href="%s#muc-luc" title="Mục lục đầy đủ" '
            'aria-label="Mục lục đầy đủ">%s</a></div><div class="side-b">' % (DIR, ic("olist")) + h + "</div></aside>")


def plain_art(a):
    if a.node is None:
        return ""
    return re.sub(r"\s+", " ", " ".join(p for _, p in node_paras(a.node, [], prefix=True)))


def page_article(a):
    c = a.ch
    prev = ARTS[a.i - 1] if a.i else None
    nxt = ARTS[a.i + 1] if a.i + 1 < len(ARTS) else None
    crumbs = [("BLTTHS 2015", DIR), (chap_label(c), DIR + "#chuong-" + c["slug"]), ("Điều " + a.id, None)]
    tags = ('<div class="art-tags"><span class="tag tag--soft">%s</span><a class="tag tag--soft" href="%s#chuong-%s">%s</a>%s</div>'
            % (esc(c["part"]["so"]), DIR, c["slug"], esc(chap_label(c)), art_tags(a)))
    sm = ('<div class="art-sum"><span>%s%s</span>%s</div>'
          % (ic("book"), esc(sentence(c["ten"])), "<span>%s%s</span>" % (ic("list"), esc(sentence(a.muc))) if a.muc else ""))
    head = ('<header class="art-h">' + crumb(crumbs) + tags + '<h1><span class="dn">Điều %s.</span> %s</h1>' % (esc(a.id), esc(a.t)) + sm +
            '<div class="tools no-print js-only"><button type="button" class="btn btn--p" data-act="copy-art">%s<span>Sao chép</span></button>'
            '<button type="button" class="btn" data-act="share">%s<span>Chia sẻ</span></button>'
            '<button type="button" class="btn btn--ic" data-act="print" title="In điều luật" aria-label="In điều luật">%s</button>'
            '<button type="button" class="btn btn--ic" data-act="settings" title="Công cụ đọc: cỡ chữ, sáng/tối" aria-label="Công cụ đọc" '
            'aria-haspopup="dialog">%s</button></div></header>' % (ic("copy"), ic("share"), ic("print"), ic("text")))
    callouts = ""
    if a.rep:
        it = a.rep
        callouts += ('<div class="callout callout--warn">%s<div><b>Điều luật đã bị bãi bỏ</b> kể từ ngày %s: Chương %s bị bãi bỏ theo %s %s (%s). '
                     "Nội dung dưới đây được giữ lại để tham khảo, nghiên cứu.</div></div>"
                     % (ic("alert"), vnd(it["law"]["hl"]), c["num"], esc(lc(it["cite"])), esc(law_label(it["law"])), esc(it["law"]["ten"])))
    others = [it for it in a.items if it["kind"] != "repeal-chapter" and it is not a.new]
    if others:
        li = "".join('<li><a href="#sd-%d">%s %s</a> – %s</li>'
                     % (j + 1, esc(it["cite"]), esc(law_label(it["law"])),
                        "chưa có hiệu lực, từ %s" % vnd(it["law"]["hl"]) if it["law"]["future"] else "hiệu lực từ %s" % vnd(it["law"]["hl"]))
                     for j, it in enumerate(others))
        callouts += ('<div class="callout callout--info">%s<div><b>Điều này đã được sửa đổi, bổ sung</b> (%d lần, xem nguyên văn ở mục '
                     '<a href="#p-sua-doi">Sửa đổi, bổ sung</a>):<ul class="sd-list">%s</ul></div></div>' % (ic("spark"), len(others), li))
    if a.new:
        it = a.new
        body_law = whole_html(it)
        law_head = ('<h2 class="law-cap">Nội dung điều luật <small>bổ sung theo %s %s, hiệu lực từ %s</small></h2>'
                    % (esc(lc(it["cite"])), esc(law_label(it["law"])), vnd(it["law"]["hl"])))
        orig = ""
    elif a.whole:
        it = a.whole
        body_law = whole_html(it)
        law_head = ('<h2 class="law-cap">Nội dung hiện hành <small>theo %s %s, hiệu lực từ %s</small></h2>'
                    % (esc(lc(it["cite"])), esc(law_label(it["law"])), vnd(it["law"]["hl"])))
        orig = ('<details class="orig"><summary>%sVăn bản gốc năm 2015: Điều %s. %s</summary><div class="law-paper"><div class="law">%s</div></div></details>'
                % (ic("history"), esc(a.id), esc(a.t0), art_law_html(a)))
    else:
        body_law = art_law_html(a)
        law_head = ('<h2 class="law-cap">%s</h2>' % ("Văn bản trước khi bãi bỏ <small>Bộ luật số 101/2015/QH13</small>" if a.rep else
                                                    "Văn bản gốc <small>Bộ luật số 101/2015/QH13</small>" if others else
                                                    "Nội dung điều luật <small>chưa được sửa đổi, bổ sung</small>"))
        orig = ""
    amend = ""
    if others:
        amend = ('<section class="panel" id="p-sua-doi" aria-labelledby="h-sd"><h2 class="muc-h" id="h-sd">Sửa đổi, bổ sung Điều %s</h2>'
                 '<p class="cm-note">%s<span>Trích nguyên văn điều khoản sửa đổi theo thứ tự ngày có hiệu lực. Cụm từ được thay thế, bổ sung, '
                 'bãi bỏ áp dụng vào vị trí tương ứng của văn bản phía trên.</span></p>%s</section>'
                 % (esc(a.id), ic("info"), "".join('<div id="sd-%d">%s</div>' % (j + 1, item_html(it, cur=a.id)) for j, it in enumerate(others))))
    pager = ('<nav class="pager no-print" aria-label="Điều trước, điều sau">%s%s%s</nav>'
             % ('<a href="%sdieu-%s" rel="prev"><small>%sĐiều trước</small><span>Điều %s. %s</span></a>' % (DIR, prev.id, ic("chev-l"), esc(prev.id), esc(prev.t)) if prev else "<span></span>",
                '<a class="pg-all" href="%s#chuong-%s">%s<span>Mục lục</span></a>' % (DIR, c["slug"], ic("olist")),
                '<a class="nx" href="%sdieu-%s" rel="next"><small>Điều sau%s</small><span>Điều %s. %s</span></a>' % (DIR, nxt.id, ic("chev-r"), esc(nxt.id), esc(nxt.t)) if nxt else ""))
    rail = ""
    if a.node is not None and not a.whole:
        kl = []
        for k in a.node.get("con", []):
            if k.get("cap") == "khoan" and k.get("so"):
                p = clean(k.get("text"))
                kl.append('<a href="%sdieu-%s#k%s"><b>Khoản %s</b><span>%s</span></a>' % (DIR, a.id, k["so"], k["so"], esc(clip(p, 70))))
        if kl:
            rail += '<div class="rc"><h3>%sĐi tới khoản</h3><div class="kl">%s</div></div>' % (ic("list"), "".join(kl))
    if others:
        rail += ('<div class="rc"><h3>%sVăn bản sửa đổi</h3><div class="rl">%s</div></div>'
                 % (ic("history"), "".join('<a href="%sdieu-%s#sd-%d"><b>%s</b><span>%s · %s</span></a>'
                                           % (DIR, a.id, j + 1, esc(it["law"]["so"]), esc(it["cite"]),
                                              ("từ " if it["law"]["future"] else "hiệu lực ") + vnd(it["law"]["hl"]))
                                           for j, it in enumerate(others))))
    rail += ('<div class="rc"><h3>%sTrích dẫn</h3><p class="cite-t" id="citeT">Điều %s Bộ luật Tố tụng hình sự số 101/2015/QH13%s</p></div>'
             % (ic("copy"), esc(a.id), " (sửa đổi, bổ sung năm %s)" % ", ".join(sorted({it["law"]["hl"][:4] for it in a.eff if it["kind"] != "repeal-chapter"}))
                if [1 for it in a.eff if it["kind"] != "repeal-chapter"] else ""))
    body = ('<div class="panel" id="p-noi-dung">' + callouts + law_head + '<div class="law-paper"><div class="law" id="lawBody">' + body_law +
            "</div></div>" + orig + "</div>" + amend)
    main = ('<div class="wrap"><div class="reader">' + side_html(a) + '<article class="art" id="art" data-id="%s">' % esc(a.id) + head + body + pager +
            '</article><aside class="rail" aria-label="Thông tin bổ trợ">' + rail + "</aside></div></div>")
    txt = plain_art(a) if not (a.whole or a.new) else re.sub(r"<[^>]+>", " ", body_law)
    desc = clip("Điều %s Bộ luật Tố tụng hình sự 2015 – %s: %s" % (a.id, a.t, html.unescape(re.sub(r"\s+", " ", txt))), 170)
    url = SITE + DIR + "dieu-" + a.id
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "Legislation", "@id": url + "#dieu", "name": "Điều %s. %s" % (a.id, a.t),
         "alternateName": "Điều %s Bộ luật Tố tụng hình sự 2015" % a.id, "url": url, "inLanguage": "vi", "description": desc,
         "legislationJurisdiction": "VN", "legislationLegalForce": "https://schema.org/NotInForce" if a.rep else "https://schema.org/InForce",
         "isPartOf": CODE_LD},
        breadcrumb_ld([("BLTTHS 2015", DIR), (chap_label(c), DIR), ("Điều " + a.id, DIR + "dieu-" + a.id)])]}
    return {"path": DIR + "dieu-" + a.id, "title": "Điều %s. %s" % (a.id, a.t) + SUFFIX, "desc": desc, "main": main, "ld": ld,
            "og_type": "article", "body": "is-reading is-article", "nav": "muc-luc"}


def page_law(L):
    d = L["doc"]
    crumbs = [("BLTTHS 2015", DIR), ("Sửa đổi, bổ sung", DIR + "sua-doi"), (L["so"], None)]
    n_art = sorted({t for it in L["items"] for t in it["targets"] if t in BY}, key=akey)
    meta = ('<div class="ph-meta"><span>%sBan hành %s</span><span>%s%s</span><span>%s%d điều khoản tác động tới %d điều của Bộ luật</span></div>'
            % (ic("calendar"), vnd(L["ngay"]), ic("clock"),
               "Chưa có hiệu lực – có hiệu lực từ %s" % vnd(L["hl"]) if L["future"] else "Hiệu lực từ %s" % vnd(L["hl"]),
               ic("list"), len(L["items"]), len(n_art)))
    src = ('<p class="cm-note">%s<span>Nguồn dữ liệu: <a href="%s" target="_blank" rel="noopener nofollow">%s</a> (kho dữ liệu tracuuphapluat). '
           "Đối chiếu Công báo trước khi sử dụng trong hồ sơ tố tụng.</span></p>" % (ic("info"), esc(L["nguon"]), "luatvietnam.vn") if L.get("nguon") else "")
    body = "".join(item_html(it) for it in L["items"])
    full = ""
    if L.get("full"):
        ps = []
        for x in d["noiDung"]["duLieu"]["cay"]:
            if x.get("cap") == "dau-de":
                continue
            if x.get("cap") == "dieu":
                ps.append(("lh", "Điều %s. %s" % (x.get("so"), clean(x.get("tieuDe")))))
                node_paras(dict(x, tieuDe=None, so=None, cap="doan"), ps)
            else:
                node_paras(x, ps)
        full = ('<details class="orig"><summary>%sToàn văn %s</summary><div class="law-paper"><div class="law">%s</div></div></details>'
                % (ic("book"), esc(law_label(L)), paras_html(ps)))
    else:
        full = ('<p class="cm-note">%s<span>Trang này trích các điều khoản của %s sửa đổi, bổ sung, bãi bỏ Bộ luật Tố tụng hình sự '
                "(%s); các nội dung khác của luật không thuộc phạm vi trang.</span></p>"
                % (ic("info"), esc(law_label(L)), esc(", ".join(sorted({"Điều " + it["cite"].rsplit("Điều ", 1)[-1] for it in L["items"]})))))
    main = (ph(crumbs, "%s – %s" % (law_label(L), L["ten"]), None, "Văn bản sửa đổi, bổ sung Bộ luật Tố tụng hình sự", meta) +
            '<div class="wrap page"><div class="lawdoc">%s<h2 class="muc-h">Các điều khoản tác động tới Bộ luật Tố tụng hình sự</h2>%s%s</div></div>'
            % (src, body, full))
    desc = clip("%s – %s (ban hành %s, hiệu lực %s): nguyên văn %d điều khoản sửa đổi, bổ sung Bộ luật Tố tụng hình sự 2015, gồm các Điều %s."
                % (law_label(L), L["ten"], vnd(L["ngay"]), vnd(L["hl"]), len(L["items"]), ", ".join(n_art[:12])), 175)
    return {"path": DIR + "luat-" + L["slug"], "title": "%s %s" % (law_label(L), L["ten"]) + SUFFIX, "desc": desc, "main": main,
            "crumbs": crumbs, "nav": "sua-doi"}


def page_amend():
    crumbs = [("BLTTHS 2015", DIR), ("Sửa đổi, bổ sung", None)]
    tl = []
    for L in ORDER:
        arts = sorted({t for it in L["items"] for t in it["targets"] if t in BY}, key=akey)
        rep = [it for it in L["items"] if it["kind"] == "repeal-chapter"]
        tl.append('<li class="tl-i%s"><div class="tl-d">%s</div><div class="tl-b"><a href="%sluat-%s"><b>%s</b> – %s</a>'
                  '<p>Ban hành %s · %d điều khoản · tác động %d điều%s%s</p><div class="tl-a">%s</div></div></li>'
                  % (" is-fut" if L["future"] else "", vnd(L["hl"]), DIR, L["slug"], esc(law_label(L)), esc(L["ten"]), vnd(L["ngay"]),
                     len(L["items"]), len(arts), " · bãi bỏ Chương " + ", ".join(it["chap"] for it in rep) if rep else "",
                     " · <b>chưa có hiệu lực</b>" if L["future"] else "",
                     " ".join('<a class="chip" href="%sdieu-%s">%s</a>' % (DIR, t, t) for t in arts[:80])))
    main = (ph(crumbs, "Các văn bản sửa đổi, bổ sung Bộ luật Tố tụng hình sự", "%d văn bản, sắp theo ngày có hiệu lực. Bấm số điều để xem "
               "nguyên văn điều luật và điều khoản sửa đổi." % len(LAWS), "Lịch sử sửa đổi") +
            '<div class="wrap page">' + law_rows() + '<h2 class="muc-h">Dòng thời gian hiệu lực</h2><ol class="tl">%s</ol>' % "".join(tl) +
            '<div class="callout callout--info">%s<div><b>Văn bản hướng dẫn thi hành liên quan</b> (không sửa đổi nội dung Bộ luật): Nghị quyết số '
            '110/2015/QH13 về việc thi hành Bộ luật Tố tụng hình sự; Nghị quyết số 144/2016/QH13 lùi hiệu lực thi hành Bộ luật đến 01/01/2018; '
            'Nghị quyết số 41/2017/QH14 về việc thi hành Bộ luật Hình sự, Bộ luật Tố tụng hình sự; Nghị quyết số 33/2021/QH15 về tổ chức phiên tòa trực tuyến.</div></div></div>'
            % ic("info"))
    desc = ("Danh sách %d văn bản sửa đổi, bổ sung, bãi bỏ Bộ luật Tố tụng hình sự 2015 theo thứ tự hiệu lực: Luật 02/2021/QH15, 34/2024/QH15, "
            "99/2025/QH15, 59/2024/QH15, 105/2025/QH15, 103/2025/QH15, 106/2025/QH15, 128/2025/QH15, 11/2026/QH16." % len(LAWS))
    return {"path": DIR + "sua-doi", "title": "Các văn bản sửa đổi, bổ sung" + SUFFIX, "desc": desc, "main": main, "crumbs": crumbs, "nav": "sua-doi"}


def hist_doc_html(d):
    ps = []
    dl = (d.get("noiDung") or {}).get("duLieu") or {}
    toc = []

    def walk(x):
        cap = x.get("cap")
        if cap in ("phan", "chuong", "muc"):
            t = clean(((x.get("so") or "") + " " + (x.get("tieuDe") or "")).strip())
            ps.append(("lh", t))
            if cap != "muc":
                toc.append((cap, t, len(ps)))
            for c in x.get("con", []):
                walk(c)
        elif cap == "dieu":
            ps.append(("lh", "Điều %s. %s" % ((x.get("so") or "").strip(), clean(x.get("tieuDe")))))
            node_paras(dict(x, so=None, tieuDe=None, cap="doan"), ps)
        elif cap == "dau-de":
            return
        else:
            node_paras(x, ps)

    for x in dl.get("cay", []):
        walk(x)
    return ps, toc


def page_hist(H):
    d = load(H["id"])
    crumbs = [("BLTTHS 2015", DIR), ("Văn bản trước 2015", DIR + "lich-su"), (H["so"], None)]
    ps, toc = hist_doc_html(d)
    meta = '<div class="ph-meta"><span>%sBan hành %s</span><span>%s%s</span></div>' % (ic("calendar"), vnd(d.get("ngayBanHanh")), ic("alert"), esc(H["het"]))
    if not ps:
        body = ('<div class="callout callout--warn">%s<div>Kho dữ liệu nguồn chưa thu thập được toàn văn văn bản này. '
                'Trang sẽ được cập nhật khi có dữ liệu.</div></div>' % ic("alert"))
    else:
        h = []
        for j, (cls, p) in enumerate(ps):
            hid = ""
            m = re.match(r"Điều (\d+[a-z]?)\.", p) if cls == "lh" else None
            if m:
                hid = ' id="d%s"' % m.group(1)
            h.append('<p class="%s"%s>%s</p>' % (cls, hid, esc(p)) if cls in ("lh", "lx") else paras_html([(cls, p)]))
        body = ('<div class="callout callout--rep">%s<div><b>Văn bản đã hết hiệu lực.</b> Đăng để nghiên cứu, đối chiếu lịch sử lập pháp và '
                'giải quyết các vụ án theo nguyên tắc áp dụng pháp luật theo thời gian.</div></div><div class="law-paper"><div class="law">%s</div></div>'
                % (ic("info"), "".join(h)))
    main = (ph(crumbs, H["ten"], "Số hiệu " + esc(H["so"]), "Văn bản lịch sử", meta) + '<div class="wrap page"><div class="lawdoc">%s</div></div>' % body)
    desc = clip("%s (số %s, ban hành %s) – toàn văn để nghiên cứu, đối chiếu. %s." % (H["ten"], H["so"], vnd(d.get("ngayBanHanh")), H["het"]), 170)
    return {"path": DIR + "van-ban-" + H["slug"], "title": "%s (%s)" % (H["ten"], H["so"]) + " – Luật Sư Nam", "desc": desc, "main": main,
            "crumbs": crumbs, "nav": "lich-su", "noindex": not ps}


def page_hist_list():
    crumbs = [("BLTTHS 2015", DIR), ("Văn bản trước 2015", None)]
    cards = "".join('<a class="ca" href="%svan-ban-%s"><span class="cn"><small>Số</small><b>%s</b></span><h3>%s</h3><p>%s</p></a>'
                    % (DIR, H["slug"], esc(H["so"]), esc(H["ten"]), esc(H["het"])) for H in HIST)
    main = (ph(crumbs, "Bộ luật Tố tụng hình sự qua các thời kỳ", "Bộ luật năm 1988 (sửa đổi 1990, 1992, 2000) và Bộ luật năm 2003 – "
               "toàn văn để nghiên cứu, đối chiếu.", "Văn bản lịch sử") + '<div class="wrap page"><div class="chap-list">%s</div></div>' % cards)
    return {"path": DIR + "lich-su", "title": "Bộ luật Tố tụng hình sự 1988, 2003 – văn bản lịch sử – Luật Sư Nam",
            "desc": "Toàn văn Bộ luật Tố tụng hình sự năm 1988, năm 2003 và các luật sửa đổi, bổ sung năm 1990, 1992, 2000 để nghiên cứu, đối chiếu.",
            "main": main, "crumbs": crumbs, "nav": "lich-su"}


def page_search():
    crumbs = [("BLTTHS 2015", DIR), ("Tìm kiếm", None)]
    main = (ph(crumbs, "Tìm kiếm trong Bộ luật Tố tụng hình sự", "Gõ có dấu hoặc không dấu; số điều (143), “khoản 2 điều 173”; cụm từ "
               "chính xác đặt trong ngoặc kép. Tìm cả trong nội dung sửa đổi, bổ sung.", "Tìm kiếm toàn văn",
               '<form class="sb sb--lg" role="search" action="%stim-kiem" method="get" style="margin-top:18px"><div class="sb-box">%s'
               '<input class="sb-in" id="srQ" type="search" name="q" placeholder="vd: tạm giam, bào chữa, 147" aria-label="Từ khóa" '
               'enterkeyhint="search" spellcheck="false" autofocus><button class="sb-go" type="submit" aria-label="Tra cứu">%s<span>Tra cứu</span></button>'
               "</div></form>" % (DIR, ic("search"), ic("search"))) +
            '<div class="wrap page"><p class="sr-stat" id="srStat" aria-live="polite"></p><div class="sr-list" id="srList"></div>'
            '<noscript><p>Cần bật JavaScript để tìm kiếm. Bạn có thể mở <a href="%s#muc-luc">mục lục</a>.</p></noscript></div>' % DIR)
    return {"path": DIR + "tim-kiem", "title": "Tìm kiếm" + SUFFIX, "desc": "Tìm kiếm toàn văn Bộ luật Tố tụng hình sự 2015 và các văn bản sửa đổi, bổ sung.",
            "main": main, "crumbs": crumbs, "nav": "tim-kiem", "noindex": True, "body": "is-search"}


def search_index():
    rows = []
    for a in ARTS:
        if a.new or a.whole:
            cur = html.unescape(re.sub(r"<[^>]+>", " ", whole_html(a.whole or a.new)))
        else:
            cur = plain_art(a)
        am = " ".join(" ".join(p for _, p in node_paras(it["node"], [], prefix=False)) for it in a.items if it["kind"] != "repeal-chapter")
        if a.whole:
            cur += " " + plain_art(a)
        rows.append([a.id, a.t, chap_label(a.ch), re.sub(r"\s+", " ", cur).strip(), re.sub(r"\s+", " ", am).strip(),
                     1 if a.rep else 0])
    return rows


# =============================================================================
def main():
    ver = TODAY.replace("-", "") + "b"  # tăng chữ cuối khi sửa tths.css, tths.js
    tpl = make_template().replace("__V__", ver)
    for m in ("<!--seo:head-->", "<!--seo:main-->", '<base href="../">', DIR + "tths.js"):
        assert m in tpl, "Khuôn trang thiếu " + m
    os.makedirs(OUT, exist_ok=True)
    pages = [page_index(), page_amend(), page_search(), page_hist_list()] + [page_law(L) for L in ORDER] + \
            [page_hist(H) for H in HIST] + [page_article(a) for a in ARTS]
    keep = {os.path.basename(p["path"]) + ".html" for p in pages}
    for f in glob.glob(os.path.join(OUT, "*.html")):
        if os.path.basename(f) not in keep:
            os.remove(f)
    written = 0
    for p in pages:
        dest = os.path.join(ROOT, p["path"] + ".html")
        out = render(tpl, p)
        old = open(dest, encoding="utf-8").read() if os.path.exists(dest) else None
        if old != out:
            with open(dest, "w", encoding="utf-8", newline="\n") as f:
                f.write(out)
            written += 1
    with open(os.path.join(OUT, "tim-kiem.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump({"v": ver, "a": search_index()}, f, ensure_ascii=False, separators=(",", ":"))
    urls = ["  <url><loc>%s</loc></url>" % esc(SITE + (p["path"][:-5] if p["path"].endswith("index") else p["path"]))
            for p in pages if not p.get("noindex")]
    with open(os.path.join(ROOT, "sitemap-tths.xml"), "w", encoding="utf-8", newline="\n") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(urls) + "\n</urlset>\n")
    n_am, n_rep, n_fut = stats()
    print("Đã sinh %d trang (%d tệp thay đổi): %d điều, %d văn bản sửa đổi (%d điều khoản), %d điều đã sửa đổi, %d điều bãi bỏ, %d điều sắp sửa đổi"
          % (len(pages), written, len(ARTS), len(LAWS), len(ITEMS), n_am, n_rep, n_fut))
    for it in ITEMS:
        if not it["targets"]:
            print("  ! Không xác định được điều bị tác động: %s %s – %s" % (it["cite"], it["law"]["so"], it["instr"][:90]))


if __name__ == "__main__":
    main()
