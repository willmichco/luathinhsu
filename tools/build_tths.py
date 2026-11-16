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
          to-tung-hinh-su/tim-kiem.html, tim-kiem.json (toàn văn theo đoạn), muc-luc.json (gợi ý khi gõ) – tìm kiếm trên trình duyệt
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
SUFFIX = " – Bộ luật Tố tụng hình sự 2015 – Tra cứu Luật Hình sự"
SITE_NAME = "Tra cứu Luật Hình sự – Luật Sư Nam"
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
        cur_p = {"id": top["id"], "so": clean(top.get("so")).capitalize(),
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
REFS = {}   # điều → các điều của Bộ luật được dẫn chiếu trong văn bản (thu thập khi dựng trang)


def link_refs(h, self_id=None):
    """Liên kết "Điều N" (của Bộ luật này) → trang điều đó. h đã thoát HTML."""
    def rep(m):
        n, rest = m.group(1), h[m.end(): m.end() + 70]
        if n not in BY or n == self_id:
            return m.group(0)
        if re.match(r"\s*(?:,\s*\d+\s*)*(?:và\s+\d+\s*)?(?:của|tại)\s+(?:các\s+)?(?:Luật|Bộ luật [Hh]ình sự|Bộ luật Dân sự|Bộ luật Tố tụng dân sự|"
                    r"Bộ luật Lao động|Nghị|Pháp lệnh|Hiến pháp|Công ước|điều ước)", rest):
            return m.group(0)
        if REFS is not None and self_id:
            REFS.setdefault(self_id, [])
            if n not in REFS[self_id]:
                REFS[self_id].append(n)
        return '<a href="%sdieu-%s" data-pv="%s">Điều %s</a>' % (DIR, n, n, n)
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
            act = ('<div class="kact no-print js-only"><button type="button" data-cite="%s" title="Sao chép trích dẫn khoản %s" aria-label="Sao chép trích dẫn khoản %s">%s</button>'
                   '<button type="button" data-klink="%s" title="Sao chép liên kết tới khoản %s" aria-label="Sao chép liên kết khoản %s">%s</button></div>'
                   % (kn, kn, kn, ic("copy"), kn, kn, kn, ic("link"))) if kn else ""
            out.append('<div class="kh" id="k%s" data-k="%s">%s%s</div>' % (kn, kn, "".join(inner), act))
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
    # tths.css nạp SAU app.css (giao diện gốc) để chỉ bổ sung, không bị app.css ghi đè
    t, n = re.subn(r'(<link rel="stylesheet" href="assets/css/app\.css\?v=[^"]+">)', r'\1\n<link rel="stylesheet" href="%stths.css?v=__V__">' % DIR, t, count=1)
    assert n == 1
    # Thương hiệu, ô tìm kiếm, điều hướng: trỏ vào phân mục Tố tụng hình sự
    # Thanh chọn mục: đánh dấu mục Bộ luật Tố tụng hình sự
    t = t.replace('data-sec="blhs" class="on" aria-current="true"', 'data-sec="blhs"', 1)
    t = t.replace('<a href="to-tung-hinh-su/" data-sec="tths">', '<a href="to-tung-hinh-su/" data-sec="tths" class="on" aria-current="true">', 1)
    t = re.sub(r'<form class="sb" role="search" action="tim-kiem" method="get">(.*?)</form>',
               lambda m: ('<form class="sb" role="search" action="%stim-kiem" method="get">' % DIR) + m.group(1)
               .replace("Số điều, tên tội, từ khóa… (vd: 173, lừa đảo)", "Số điều, từ khóa… (vd: 143, tạm giam)")
               .replace("Tìm kiếm trong Bộ luật Hình sự", "Tìm kiếm trong Bộ luật Tố tụng hình sự") + "</form>", t, count=1, flags=re.S)
    t = re.sub(r'<nav class="hd-nav" aria-label="Điều hướng chính">.*?</nav>',
               '<nav class="hd-nav" aria-label="Điều hướng chính"><a href="%s#muc-luc" data-nav="muc-luc" data-act="jump" title="Mục lục (Ctrl+K)">Mục lục</a>'
               '<a href="%scong-cu" data-nav="cong-cu">Công cụ</a><a href="%sda-luu" data-nav="da-luu">Đã lưu</a></nav>' % (DIR, DIR, DIR),
               t, count=1, flags=re.S)
    t = re.sub(r'<nav class="tabbar" aria-label="Điều hướng nhanh">.*?</nav>',
               '<nav class="tabbar" aria-label="Điều hướng nhanh">'
               '<a href="%s" data-nav="home">%s<span>Trang chủ</span></a>'
               '<a href="%stim-kiem" data-nav="tim-kiem">%s<span>Tra cứu</span></a>'
               '<a href="%s#muc-luc" data-nav="muc-luc" data-act="jump">%s<span>Mục lục</span></a>'
               '<a href="%scong-cu" data-nav="cong-cu">%s<span>Công cụ</span></a>'
               '<a href="%sda-luu" data-nav="da-luu">%s<span>Đã lưu</span></a></nav>'
               % (DIR, ic("home"), DIR, ic("search"), DIR, ic("list"), DIR, ic("tools"), DIR, ic("bookmark")), t, count=1, flags=re.S)
    t = t.replace('<nav class="drawer-nav" id="drawerNav"></nav>', '<nav class="drawer-nav" id="drawerNav">' + drawer_html() + "</nav>")
    t = re.sub(r'(<div class="ft-col">\s*<h2>Tra cứu</h2>).*?(</div>)',
               lambda m: m.group(1) + '\n      <a href="%s#muc-luc">Mục lục Bộ luật Tố tụng hình sự</a>\n      <a href="%stim-kiem">Tìm kiếm toàn văn</a>'
               '\n      <a href="%sthoi-han">Bảng thời hạn tố tụng</a>\n      <a href="%sso-sanh">So sánh điều luật</a>'
               '\n      <a href="%ssua-doi">Các văn bản sửa đổi, bổ sung</a>\n      <a href="%sgioi-thieu">Giới thiệu &amp; nguồn dữ liệu</a>\n    '
               % (DIR, DIR, DIR, DIR, DIR, DIR) + m.group(2), t, count=1, flags=re.S)
    t = re.sub(r'<script src="assets/js/app\.js\?v=[^"]+" defer></script>',
               '<script src="%stths.js?v=__V__" defer></script>' % DIR, t, count=1)
    t = t.replace(' data-act="toc"', "")
    return t


def drawer_html():
    L = lambda href, icon, t: '<a href="%s">%s%s</a>' % (href, ic(icon), t)
    return ('<div class="dn-h">Bộ luật Tố tụng hình sự</div>' + L(DIR, "home", "Trang chủ Tố tụng hình sự") + L(DIR + "#muc-luc", "list", "Mục lục Bộ luật") +
            L(DIR + "tim-kiem", "search", "Tìm kiếm toàn văn") + L(DIR + "da-luu", "bookmark", "Đã lưu & ghi chú") +
            '<div class="dn-h">Công cụ nghiên cứu</div>' + L(DIR + "thoi-han", "clock", "Thời hạn tố tụng") + L(DIR + "so-sanh", "columns", "So sánh điều luật") +
            L(DIR + "sua-doi", "history", "Các văn bản sửa đổi, bổ sung") + L(DIR + "lich-su", "book", "Bộ luật 2003, 1988") +
            '<hr>' + L(DIR + "gioi-thieu", "info", "Giới thiệu & nguồn dữ liệu") +
            '<div class="dn-h">Bộ luật Hình sự</div>' + L("./", "home", "Trang chủ") + L("muc-luc", "scale", "Mục lục Bộ luật Hình sự") +
            L("tim-kiem", "search", "Tìm kiếm Bộ luật Hình sự") + L("cong-cu", "tools", "Công cụ nghiên cứu") +
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
                '<small>%d điều · Điều %s – %s</small>%s</span><a class="btn btn--sm btn--ghost" href="%schuong-%s">Xem</a>%s</summary><div class="tch-body">'
                '<a class="ta ch-open" href="%schuong-%s">Xem trang tổng quan %s %s</a>%s</div></details>'
                % (c["slug"], esc(c["num"] or "TH"), esc(c["ten"].capitalize() if c["ten"].isupper() else c["ten"]), len(c["arts"]),
                   c["arts"][0].id, c["arts"][-1].id,
                   ' <span class="tag tag--rep26">Bãi bỏ từ %s</span>' % vnd(rep["law"]["hl"]) if rep and not rep["law"]["future"] else "",
                   DIR, c["slug"], ic("chev-d", "chev"), DIR, c["slug"], esc(chap_label(c)), ic("arrow-r"), lst))
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



# =============================================================================
# Liên quan, trang chương, công cụ, đã lưu, giới thiệu (cùng bộ tính năng với mục Bộ luật Hình sự)
# =============================================================================
INREFS = {}


def collect_refs():
    """Dựng trước toàn văn từng điều để thu dẫn chiếu "Điều N" (đi và đến)."""
    for a in ARTS:
        if a.node is not None:
            art_law_html(a)
        if a.whole or a.new:
            whole_html(a.whole or a.new)
    for a, outs in list(REFS.items()):
        for x in outs:
            INREFS.setdefault(x, [])
            if a not in INREFS[x]:
                INREFS[x].append(a)
    for k in INREFS:
        INREFS[k].sort(key=akey)


def excerpt(a, n=170):
    ps = law_paras(a)
    return clip(" ".join(ps), n) if ps else ""


def art_card(a):
    return ('<a class="pa" href="%sdieu-%s" data-pv="%s"><span class="pn">Điều %s</span><h3>%s</h3><span class="pm"><span class="tag tag--soft">%s</span>%s</span></a>'
            % (DIR, a.id, a.id, esc(a.id), esc(a.t), esc(chap_label(a.ch)), art_tags(a, True)))


def rel_html(a):
    def sec(title, ids):
        ids = [i for i in ids if i in BY and i != a.id]
        if not ids:
            return "", 0
        return ('<section class="rel-sec"><h3>%s</h3><div class="rel-grid">%s</div></section>' % (title, "".join(art_card(BY[i]) for i in ids)), len(ids))
    near = [ARTS[a.i + j].id for j in (-2, -1, 1, 2) if 0 <= a.i + j < len(ARTS) and ARTS[a.i + j].ch is a.ch]
    out, n = "", 0
    for title, ids in (("Điều luật được dẫn chiếu trong văn bản", REFS.get(a.id) or []), ("Được viện dẫn tại các điều", INREFS.get(a.id) or []),
                       ("Các điều lân cận trong " + chap_label(a.ch), near)):
        h, k = sec(title, ids)
        out += h
        if title.startswith(("Điều luật được", "Được viện")):
            n += k
    return out, n


def page_chapter(c):
    i = CHAPS.index(c)
    prev, nxt = (CHAPS[i - 1] if i else None), (CHAPS[i + 1] if i + 1 < len(CHAPS) else None)
    lst, last_m = "", None
    for a in c["arts"]:
        if a.muc and a.muc != last_m:
            last_m = a.muc
            lst += '<h2 class="muc-h">%s</h2>' % esc(sentence(a.muc))
        lst += ('<a class="ca" href="%sdieu-%s" data-pv="%s"><span class="cn"><small>Điều</small><b>%s</b></span><h3>%s</h3><p>%s</p><span class="cm">%s</span></a>'
                % (DIR, a.id, a.id, esc(a.id), esc(a.t), esc(excerpt(a)), art_tags(a, True)))
    crumbs = [("Trang chủ", "./"), ("Tố tụng hình sự", DIR), (chap_label(c), None)]
    n_am = len([a for a in c["arts"] if a.eff and not a.rep])
    meta = ('<div class="ph-meta"><span>%s%d điều (Điều %s – %s)</span>%s</div>'
            % (ic("book"), len(c["arts"]), c["arts"][0].id, c["arts"][-1].id, "<span>%s%d điều có sửa đổi, bổ sung</span>" % (ic("note"), n_am) if n_am else ""))
    acts = ('<div class="ph-acts"><a class="btn btn--g" href="%sdieu-%s">%sĐọc từ Điều %s</a>%s%s</div>'
            % (DIR, c["arts"][0].id, ic("book"), c["arts"][0].id,
               '<a class="btn" href="%schuong-%s">%s%s</a>' % (DIR, prev["slug"], ic("chev-l"), esc(chap_label(prev))) if prev else "",
               '<a class="btn" href="%schuong-%s">%s%s</a>' % (DIR, nxt["slug"], esc(chap_label(nxt)), ic("chev-r")) if nxt else ""))
    title = (chap_label(c) + ". " if c["num"] else "") + sentence(c["ten"])
    note = ""
    if c["rep"] and not c["rep"]["law"]["future"]:
        it = c["rep"]
        note = ('<div class="callout callout--warn" style="margin-bottom:18px">%s<div><b>Lưu ý hiệu lực:</b> chương này đã bị bãi bỏ kể từ ngày %s theo %s %s (%s). '
                "Nội dung được giữ lại để tham khảo, nghiên cứu.</div></div>" % (ic("alert"), vnd(it["law"]["hl"]), esc(lc(it["cite"])), esc(law_label(it["law"])), esc(it["law"]["ten"])))
    main = (ph(crumbs, title, None, c["part"]["so"] + " · " + sentence(c["part"]["ten"]), meta + acts) +
            '<div class="wrap page">' + note + '<div class="chap-list">' + lst + "</div></div>")
    desc = clip("%s Bộ luật Tố tụng hình sự 2015 gồm %d điều (Điều %s – %s): %s" % (title, len(c["arts"]), c["arts"][0].id, c["arts"][-1].id,
                                                                                      "; ".join(a.t for a in c["arts"][:6])), 175)
    return {"path": DIR + "chuong-" + c["slug"], "title": title + SUFFIX, "desc": desc, "main": main, "crumbs": crumbs, "nav": "muc-luc", "body": "is-reading"}


TOOLS_T = [
    ("thoi-han", "clock", "Thời hạn tố tụng", "Bảng thời hạn giữ người, tạm giữ, điều tra, tạm giam, truy tố, xét xử, kháng cáo, kháng nghị – trích nguyên văn điều luật."),
    ("so-sanh", "columns", "So sánh điều luật", "Đặt hai điều cạnh nhau để phân biệt thủ tục, thẩm quyền, thời hạn – kèm nội dung sửa đổi, bổ sung."),
    ("tim-kiem", "search", "Tìm kiếm toàn văn", "Tìm trong tên điều, văn bản điều luật và nội dung sửa đổi; gõ không dấu, cụm từ chính xác."),
    ("sua-doi", "history", "Dòng thời gian sửa đổi", "9 văn bản sửa đổi, bổ sung, bãi bỏ theo thứ tự hiệu lực; bấm số điều để xem nguyên văn."),
]


def tool_cards():
    return '<div class="tools-grid">' + "".join(
        '<a class="tl" href="%s%s"><span class="ti">%s</span><h3>%s</h3><p>%s</p><span class="lk">Mở công cụ %s</span></a>'
        % (DIR, k, ic(i), t, d, ic("arrow-r")) for k, i, t, d in TOOLS_T) + "</div>"


def page_tools():
    crumbs = [("Trang chủ", "./"), ("Tố tụng hình sự", DIR), ("Công cụ", None)]
    main = (ph(crumbs, "Công cụ nghiên cứu tố tụng hình sự", "Tra nhanh thời hạn tố tụng, so sánh điều luật, tìm kiếm toàn văn và theo dõi các lần sửa đổi.",
               "Công cụ") + '<div class="wrap page">' + tool_cards() + "</div>")
    return {"path": DIR + "cong-cu", "title": "Công cụ nghiên cứu" + SUFFIX, "desc": "Công cụ nghiên cứu Bộ luật Tố tụng hình sự 2015: bảng thời hạn tố tụng, so sánh điều luật, tìm kiếm toàn văn.",
            "main": main, "crumbs": crumbs, "nav": "cong-cu"}


def page_deadlines():
    import tths_thoi_han as TH
    crumbs = [("Trang chủ", "./"), ("Tố tụng hình sự", DIR), ("Công cụ", DIR + "cong-cu"), ("Thời hạn tố tụng", None)]
    rows, last = "", None
    for st, viec, th, dieu, kh, quote in TH.ROWS:
        a = BY[dieu]
        txt = " ".join(law_paras(a))
        if quote not in re.sub(r"\s+", " ", txt):
            raise SystemExit("Bảng thời hạn: câu trích không có trong Điều %s – %s" % (dieu, quote))
        am = [it for it in a.eff if it["kind"] != "repeal-chapter"]
        fut = a.fut
        href = DIR + "dieu-" + dieu + ("#k" + kh if kh else "")
        rows += ('<tr><td><b>%s</b><small>%s</small></td><td class="n">%s</td><td><a href="%s" data-pv="%s">%s Điều %s</a>%s</td>'
                 '<td class="q">“%s”</td></tr>'
                 % (esc(viec), esc(st), esc(th), href, dieu, "Khoản " + kh if kh else "", dieu,
                    ('<br><a class="tag tag--am" href="%sdieu-%s#p-sua-doi">Điều có sửa đổi</a>' % (DIR, dieu) if am else "") +
                    ('<br><span class="tag tag--fut">Sắp sửa đổi</span>' if fut else ""), esc(quote)))
    main = (ph(crumbs, "Bảng thời hạn tố tụng hình sự", "Các thời hạn chính theo Bộ luật Tố tụng hình sự 2015. Mỗi dòng trích nguyên văn điều luật; "
               "bấm vào điều để xem đầy đủ các trường hợp gia hạn, ngoại lệ và nội dung sửa đổi.", "Công cụ") +
            '<div class="wrap page"><div class="callout callout--info" style="margin-bottom:16px">%s<div>Bảng chỉ tóm tắt <b>thời hạn chung</b>. Thời hạn gia hạn, '
            'thẩm quyền gia hạn, cách tính thời hạn (Điều 9 BLTTHS) và trường hợp đặc biệt phải đọc tại điều luật tương ứng. Câu trích được '
            'tự động đối chiếu với văn bản điều luật khi dựng trang.</div></div>'
            '<div class="tbl-wrap"><table class="tbl tbl--cards tbl--th"><thead><tr><th>Việc</th><th>Thời hạn</th><th>Căn cứ</th><th>Trích nguyên văn</th></tr></thead>'
            '<tbody>%s</tbody></table></div></div>' % (ic("info"), rows))
    return {"path": DIR + "thoi-han", "title": "Bảng thời hạn tố tụng" + SUFFIX,
            "desc": "Bảng thời hạn tố tụng hình sự: giữ người khẩn cấp, tạm giữ, giải quyết tố giác, điều tra, tạm giam, truy tố, chuẩn bị xét xử, kháng cáo, kháng nghị – trích nguyên văn BLTTHS 2015.",
            "main": main, "crumbs": crumbs, "nav": "cong-cu"}


PRESETS_T = [("117", "119", "Tạm giữ ↔ Tạm giam"), ("110", "111", "Giữ người khẩn cấp ↔ Bắt quả tang"), ("121", "122", "Bảo lĩnh ↔ Đặt tiền"),
             ("123", "124", "Cấm đi khỏi nơi cư trú ↔ Tạm hoãn xuất cảnh"), ("331", "336", "Kháng cáo ↔ Kháng nghị"),
             ("370", "397", "Giám đốc thẩm ↔ Tái thẩm"), ("229", "230", "Tạm đình chỉ ↔ Đình chỉ điều tra"),
             ("247", "248", "Tạm đình chỉ ↔ Đình chỉ vụ án"), ("172", "173", "Thời hạn điều tra ↔ Thời hạn tạm giam"),
             ("157", "155", "Không khởi tố ↔ Khởi tố theo yêu cầu bị hại")]


def page_compare():
    crumbs = [("Trang chủ", "./"), ("Tố tụng hình sự", DIR), ("Công cụ", DIR + "cong-cu"), ("So sánh", None)]
    main = (ph(crumbs, "So sánh điều luật", "Đặt hai điều của Bộ luật Tố tụng hình sự cạnh nhau để phân biệt thủ tục, thẩm quyền, thời hạn – kèm nội dung sửa đổi, bổ sung.",
               "So sánh") +
            '<div class="wrap page"><div class="card" style="padding:18px"><div class="cmp" style="margin-top:0">'
            '<label class="field"><span>Điều luật thứ nhất</span><input class="inp" id="cmpA" inputmode="text" placeholder="Số điều, vd: 117" list="cmpList"></label>'
            '<label class="field"><span>Điều luật thứ hai</span><input class="inp" id="cmpB" inputmode="text" placeholder="Số điều, vd: 119" list="cmpList"></label></div>'
            '<datalist id="cmpList">%s</datalist>'
            '<div class="field" style="margin-top:16px"><span>Cặp thường được so sánh</span><div class="presets">%s</div></div></div><div id="cmpOut"></div></div>'
            % ("".join('<option value="%s">Điều %s. %s</option>' % (a.id, a.id, esc(a.t)) for a in ARTS),
               "".join('<button type="button" class="chip" data-ps="%s,%s">%s</button>' % (x, y, esc(t)) for x, y, t in PRESETS_T)))
    return {"path": DIR + "so-sanh", "title": "So sánh điều luật" + SUFFIX, "desc": "So sánh hai điều của Bộ luật Tố tụng hình sự 2015: tạm giữ – tạm giam, kháng cáo – kháng nghị, giám đốc thẩm – tái thẩm…",
            "main": main, "crumbs": crumbs, "nav": "cong-cu"}


def page_saved():
    crumbs = [("Trang chủ", "./"), ("Tố tụng hình sự", DIR), ("Đã lưu", None)]
    main = (ph(crumbs, "Đã lưu, ghi chú & lịch sử", "Dữ liệu chỉ lưu trên trình duyệt của thiết bị này, không gửi đi đâu.") +
            '<div class="wrap page" id="savedOut"><noscript>Cần bật JavaScript để xem các điều đã lưu.</noscript></div>')
    return {"path": DIR + "da-luu", "title": "Đã lưu" + SUFFIX, "desc": "Các điều Bộ luật Tố tụng hình sự đã lưu, ghi chú và lịch sử đọc trên thiết bị này.",
            "main": main, "crumbs": crumbs, "nav": "da-luu", "noindex": True}


def page_about():
    crumbs = [("Trang chủ", "./"), ("Tố tụng hình sự", DIR), ("Giới thiệu", None)]
    srcs = "".join('<li><b>%s</b> – %s%s</li>' % (esc(law_label(L)), esc(L["ten"]), ' (<a href="%s" target="_blank" rel="noopener nofollow">nguồn</a>)' % esc(L["nguon"]) if L.get("nguon") else "") for L in ORDER)
    main = (ph(crumbs, "Giới thiệu & nguồn dữ liệu", "Mục Bộ luật Tố tụng hình sự của trang Tra cứu Luật Hình sự do Công ty Luật TNHH Luật Sư Nam xây dựng, phục vụ nghiên cứu, học tập và thực hành.") +
            '<div class="wrap page"><div class="lawdoc">'
            '<h2 class="muc-h">Văn bản gốc</h2><p>Bộ luật Tố tụng hình sự số 101/2015/QH13 được Quốc hội thông qua ngày 27/11/2015, có hiệu lực từ 01/01/2018 '
            '(theo Nghị quyết số 144/2016/QH13). Toàn văn %d điều được trích từ kho dữ liệu tracuuphapluat (nguồn luatvietnam.vn) và giữ nguyên văn.</p>'
            '<h2 class="muc-h">Các văn bản sửa đổi, bổ sung, bãi bỏ</h2><ul class="src-list">%s</ul>'
            '<h2 class="muc-h">Cách trình bày</h2><ul class="src-list"><li>Văn bản điều luật là nguyên văn năm 2015; điều khoản sửa đổi được trích nguyên văn ngay dưới điều, theo thứ tự ngày có hiệu lực.</li>'
            '<li>Điều bị thay thế toàn bộ hiển thị nội dung mới; văn bản gốc thu gọn bên dưới.</li>'
            '<li>Văn bản chưa đến ngày có hiệu lực được ghi rõ “chưa có hiệu lực”.</li>'
            '<li>Các thay đổi chỉ thay một cụm từ không được tự hợp nhất vào văn bản, để tránh sai lệch.</li></ul>'
            '<div class="callout callout--warn" style="margin-top:18px">%s<div>Nội dung nhằm mục đích tham khảo, nghiên cứu; không thay thế ý kiến tư vấn pháp lý cho từng vụ việc. '
            'Khi sử dụng trong hồ sơ tố tụng, vui lòng đối chiếu văn bản đăng trên Công báo hoặc văn bản hợp nhất của Văn phòng Quốc hội.</div></div></div></div>'
            % (len(ARTS) - 1, srcs, ic("alert")))
    return {"path": DIR + "gioi-thieu", "title": "Giới thiệu & nguồn dữ liệu" + SUFFIX, "desc": "Nguồn dữ liệu, cách trình bày văn bản Bộ luật Tố tụng hình sự 2015 và các văn bản sửa đổi trên trang Tra cứu Luật Hình sự.",
            "main": main, "crumbs": crumbs}


def preview_data(a):
    """Dữ liệu một điều cho xem nhanh và công cụ so sánh: to-tung-hinh-su/a/<số>.json."""
    return {"id": a.id, "t": a.t, "ch": chap_label(a.ch) + (". " + sentence(a.ch["ten"]) if a.ch["num"] else ""), "ex": excerpt(a, 220),
            "fl": flags(a), "law": [[para_cls(p), p] for p in law_paras(a)],
            "am": [[it["cite"] + " " + law_label(it["law"]), vnd(it["law"]["hl"]), 1 if it["law"]["future"] else 0,
                    [p for _, p in node_paras(it["node"], [], prefix=False)]] for it in a.items if it["kind"] != "repeal-chapter" and it is not a.new]}


POPULAR_T = ["119", "173", "147", "110", "117", "72", "331", "336", "245", "143", "370", "471"]

def page_index():
    n_am, n_rep, n_fut = stats()
    rep = [c for c in CHAPS if c["rep"]]
    crumbs = [("Trang chủ", "./"), ("Bộ luật Tố tụng hình sự", None)]
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
            '<section class="sec-s"><h2 class="muc-h">Thường được tra cứu</h2><div class="pop-grid">%s</div></section>' % "".join(art_card(BY[i]) for i in POPULAR_T if i in BY) +
            '<section class="sec-s"><h2 class="muc-h">Công cụ hỗ trợ nghiên cứu</h2>%s</section>' % tool_cards() +
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
    ld = {"@context": "https://schema.org", "@graph": [dict(CODE_LD, description=desc), breadcrumb_ld([("Trang chủ", ""), ("Bộ luật Tố tụng hình sự", DIR)])]}
    return {"path": DIR + "index", "title": "Bộ luật Tố tụng hình sự 2015 (sửa đổi 2021, 2025) – Tra cứu Luật Hình sự – Luật Sư Nam", "desc": desc,
            "main": main, "ld": ld, "nav": "muc-luc", "body": "is-toc"}


def side_html(a):
    h = ""
    for p in PARTS:
        h += '<div class="sp">%s</div>' % esc(p["so"])
        for c in p["chaps"]:
            cur = c is a.ch
            h += ('<div class="sc%s"><a href="%schuong-%s">%s<span class="r">%s</span><span>%s</span></a>'
                  % (" open" if cur else "", DIR, c["slug"], ic("chev-r"), esc(c["num"] or "TH"), esc(sentence(c["ten"]))))
            if cur:
                h += '<div class="sc-l">' + "".join(
                    '<a href="%sdieu-%s"%s><b>%s</b><span>%s</span></a>'
                    % (DIR, x.id, ' class="on" aria-current="page"' if x is a else ' class="is-rep"' if x.rep else "", esc(x.id), esc(x.t))
                    for x in c["arts"]) + "</div>"
            h += "</div>"
    return ('<aside class="side" aria-label="Mục lục điều luật"><div class="side-h js-only"><input class="inp" id="sideQ" type="search" '
            'placeholder="Lọc nhanh điều luật…" aria-label="Lọc mục lục"><a class="side-all" href="%s#muc-luc" title="Mục lục đầy đủ" '
            'aria-label="Mục lục đầy đủ" data-act="jump">%s</a></div><div class="side-b">' % (DIR, ic("olist")) + h + "</div></aside>")


def plain_art(a):
    if a.node is None:
        return ""
    return re.sub(r"\s+", " ", " ".join(p for _, p in node_paras(a.node, [], prefix=True)))


def page_article(a):
    c = a.ch
    prev = ARTS[a.i - 1] if a.i else None
    nxt = ARTS[a.i + 1] if a.i + 1 < len(ARTS) else None
    crumbs = [("Trang chủ", "./"), ("Tố tụng hình sự", DIR), (chap_label(c), DIR + "chuong-" + c["slug"]), ("Điều " + a.id, None)]
    tags = ('<div class="art-tags"><span class="tag tag--soft">%s</span><a class="tag tag--soft" href="%schuong-%s">%s</a>%s</div>'
            % (esc(c["part"]["so"]), DIR, c["slug"], esc(chap_label(c)), art_tags(a)))
    n_chars = len(plain_art(a)) + sum(len(tree_text(it["node"])) for it in a.items if it["kind"] != "repeal-chapter")
    sm = ('<div class="art-sum"><span>%s%s</span>%s<span class="rt">%s~%d phút đọc</span></div>'
          % (ic("book"), esc(sentence(c["ten"])), "<span>%s%s</span>" % (ic("list"), esc(sentence(a.muc))) if a.muc else "",
             ic("clock"), max(1, int(n_chars / 900 + 0.5))))
    head = ('<header class="art-h">' + crumb(crumbs) + tags + '<h1><span class="dn">Điều %s.</span> %s</h1>' % (esc(a.id), esc(a.t)) + sm +
            '<div class="tools no-print js-only"><button type="button" class="btn btn--p" data-act="save" aria-pressed="false">%s<span>Lưu điều này</span></button>'
            '<button type="button" class="btn" data-act="copy-art" title="Sao chép toàn văn điều luật">%s<span>Sao chép</span></button>'
            '<button type="button" class="btn" data-act="share" title="Chia sẻ">%s<span>Chia sẻ</span></button>'
            '<a class="btn" href="%sso-sanh?a=%s" title="So sánh với điều khác">%s<span>So sánh</span></a>'
            '<button type="button" class="btn btn--ic" data-act="print" title="In điều luật" aria-label="In điều luật">%s</button>'
            '<button type="button" class="btn btn--ic" data-act="settings" title="Công cụ đọc: cỡ chữ, kiểu chữ, sáng/tối" aria-label="Công cụ đọc" '
            'aria-haspopup="dialog">%s</button></div></header>' % (ic("bookmark"), ic("copy"), ic("share"), DIR, a.id, ic("columns"), ic("print"), ic("text")))
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
                                                    "Văn bản gốc <small>Bộ luật số 101/2015/QH13</small>") if (a.rep or others) else
                    '<h2 class="vh">Nội dung Điều %s</h2>' % esc(a.id))
        orig = ""
    amend = ""
    if others:
        amend = ('<section class="panel" id="p-sua-doi" aria-labelledby="h-sd"><h2 class="muc-h" id="h-sd">Sửa đổi, bổ sung Điều %s</h2>'
                 '<p class="cm-note">%s<span>Trích nguyên văn điều khoản sửa đổi theo thứ tự ngày có hiệu lực. Cụm từ được thay thế, bổ sung, '
                 'bãi bỏ áp dụng vào vị trí tương ứng của văn bản phía trên.</span></p>%s</section>'
                 % (esc(a.id), ic("info"), "".join('<div id="sd-%d">%s</div>' % (j + 1, item_html(it, cur=a.id)) for j, it in enumerate(others))))
    pager = ('<nav class="pager no-print" aria-label="Điều trước, điều sau">%s%s%s</nav>'
             % ('<a href="%sdieu-%s" rel="prev"><small>%sĐiều trước</small><span>Điều %s. %s</span></a>' % (DIR, prev.id, ic("chev-l"), esc(prev.id), esc(prev.t)) if prev else "<span></span>",
                '<a class="pg-all" href="%s#muc-luc" data-act="jump" aria-haspopup="dialog">%s<span>Mục lục</span></a>' % (DIR, ic("olist")),
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
    refs = [x for x in (REFS.get(a.id) or []) + INREFS.get(a.id, []) if x in BY and x != a.id]
    refs = list(dict.fromkeys(refs))[:8]
    if refs:
        rail += ('<div class="rc"><h3>%sĐiều luật liên quan</h3><div class="rl">%s</div></div>'
                 % (ic("link"), "".join('<a href="%sdieu-%s" data-pv="%s"><b>Điều %s</b><span>%s</span></a>' % (DIR, x, x, esc(x), esc(BY[x].t)) for x in refs)))
    rail += '<div class="rc rc-note js-only"><h3>%sGhi chú của tôi</h3><textarea class="inp" id="noteBox" rows="4" placeholder="Ghi chú riêng cho Điều %s – chỉ lưu trên thiết bị này" aria-label="Ghi chú cho Điều %s"></textarea><small class="muted" id="noteSt"></small></div>' % (ic("note"), esc(a.id), esc(a.id))
    rail += ('<div class="rc"><h3>%sTrích dẫn</h3><p class="cite-t" id="citeT">Điều %s Bộ luật Tố tụng hình sự số 101/2015/QH13%s</p></div>'
             % (ic("copy"), esc(a.id), " (sửa đổi, bổ sung năm %s)" % ", ".join(sorted({it["law"]["hl"][:4] for it in a.eff if it["kind"] != "repeal-chapter"}))
                if [1 for it in a.eff if it["kind"] != "repeal-chapter"] else ""))
    rel, rel_n = rel_html(a)
    tabs = ('<nav class="tabs" aria-label="Nội dung điều luật"><a href="#p-noi-dung" aria-current="true"><span class="tl-l">Nội dung điều luật</span>'
            '<span class="tl-s">Điều luật</span></a>' +
            ('<a href="#p-sua-doi">Sửa đổi, bổ sung<span class="cnt">%d</span></a>' % len(others) if others else "") +
            ('<a href="#p-lien-quan">Liên quan<span class="cnt">%d</span></a>' % rel_n if rel_n else "") + "</nav>")
    body = (tabs + '<div class="panel" id="p-noi-dung">' + callouts + law_head + '<div class="law-paper"><div class="law" id="lawBody">' + body_law +
            "</div></div>" + orig + "</div>" + amend +
            ('<section class="panel" id="p-lien-quan" aria-labelledby="h-lq"><h2 class="muc-h" id="h-lq">Điều luật liên quan</h2>%s</section>' % rel if rel else ""))
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
        breadcrumb_ld([("Trang chủ", "./"), ("Tố tụng hình sự", DIR), (chap_label(c), DIR), ("Điều " + a.id, DIR + "dieu-" + a.id)])]}
    return {"path": DIR + "dieu-" + a.id, "title": "Điều %s. %s" % (a.id, a.t) + SUFFIX, "desc": desc, "main": main, "ld": ld,
            "og_type": "article", "body": "is-reading is-article", "nav": "muc-luc"}


def page_law(L):
    d = L["doc"]
    crumbs = [("Trang chủ", "./"), ("Tố tụng hình sự", DIR), ("Sửa đổi, bổ sung", DIR + "sua-doi"), (L["so"], None)]
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
    crumbs = [("Trang chủ", "./"), ("Tố tụng hình sự", DIR), ("Sửa đổi, bổ sung", None)]
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
    crumbs = [("Trang chủ", "./"), ("Tố tụng hình sự", DIR), ("Văn bản trước 2015", DIR + "lich-su"), (H["so"], None)]
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
    crumbs = [("Trang chủ", "./"), ("Tố tụng hình sự", DIR), ("Văn bản trước 2015", None)]
    cards = "".join('<a class="ca" href="%svan-ban-%s"><span class="cn"><small>Số</small><b>%s</b></span><h3>%s</h3><p>%s</p></a>'
                    % (DIR, H["slug"], esc(H["so"]), esc(H["ten"]), esc(H["het"])) for H in HIST)
    main = (ph(crumbs, "Bộ luật Tố tụng hình sự qua các thời kỳ", "Bộ luật năm 1988 (sửa đổi 1990, 1992, 2000) và Bộ luật năm 2003 – "
               "toàn văn để nghiên cứu, đối chiếu.", "Văn bản lịch sử") + '<div class="wrap page"><div class="chap-list">%s</div></div>' % cards)
    return {"path": DIR + "lich-su", "title": "Bộ luật Tố tụng hình sự 1988, 2003 – văn bản lịch sử – Luật Sư Nam",
            "desc": "Toàn văn Bộ luật Tố tụng hình sự năm 1988, năm 2003 và các luật sửa đổi, bổ sung năm 1990, 1992, 2000 để nghiên cứu, đối chiếu.",
            "main": main, "crumbs": crumbs, "nav": "lich-su"}


def page_search():
    crumbs = [("Trang chủ", "./"), ("Tố tụng hình sự", DIR), ("Tìm kiếm", None)]
    form = ('<form class="sb sb--lg" role="search" action="%stim-kiem" method="get"><div class="sb-box">%s'
            '<input class="sb-in" id="srQ" type="search" name="q" placeholder="Nhập từ khóa, cụm từ hoặc số điều…" aria-label="Tìm kiếm trong Bộ luật Tố tụng hình sự" '
            'enterkeyhint="search" spellcheck="false"><button class="sb-go" type="submit" aria-label="Tra cứu">%s<span>Tra cứu</span></button>'
            "</div></form>" % (DIR, ic("search"), ic("search")))
    main = ('<section class="ph"><div class="hero-bg" aria-hidden="true"><div class="hero-drum"></div></div><div class="wrap ph-in">' + crumb(crumbs) +
            "<h1>Tìm kiếm trong Bộ luật Tố tụng hình sự</h1><p>Tìm đồng thời trong tên điều, văn bản điều luật và nội dung sửa đổi, bổ sung. "
            "Gõ không dấu, dùng “ngoặc kép” để tìm cụm từ chính xác.</p>"
            '<div id="srBox" style="margin-top:18px;max-width:760px">' + form + "</div></div></section>"
            '<div class="wrap"><div id="srOut"><noscript><p style="margin-top:22px">Cần bật JavaScript để tìm kiếm. Bạn có thể mở '
            '<a href="%s#muc-luc">mục lục</a>.</p></noscript></div></div>' % DIR)
    return {"path": DIR + "tim-kiem", "title": "Tìm kiếm" + SUFFIX, "desc": "Tìm kiếm toàn văn Bộ luật Tố tụng hình sự 2015 và các văn bản sửa đổi, bổ sung.",
            "main": main, "crumbs": crumbs, "nav": "tim-kiem", "noindex": True, "body": "is-search"}


def strip_tags(h):
    return html.unescape(re.sub(r"<[^>]+>", "", h))


def law_paras(a):
    """Các đoạn văn bản đang hiển thị là nội dung chính của điều (nội dung mới nếu điều bị thay thế toàn bộ)."""
    if a.new or a.whole:
        h = whole_html(a.whole or a.new)
        return [strip_tags(x).strip() for x in re.findall(r"<p[^>]*>(.*?)</p>", h, flags=re.S) if strip_tags(x).strip()]
    return [re.sub(r"\s+", " ", p).strip() for _, p in node_paras(a.node, [], prefix=True) if p.strip()]


def flags(a):
    return ("r" if a.rep else "") + ("n" if a.new else "") + ("a" if [1 for it in a.eff if it["kind"] != "repeal-chapter" and it is not a.new] else "") + \
        ("f" if a.fut else "")


def toc_index(ver):
    """Mục lục gọn cho ô tìm kiếm (gợi ý khi gõ) – vài chục KB, nạp khi người dùng bấm vào ô tìm kiếm."""
    chs = [c for c in CHAPS]
    return {"v": ver, "ch": [[c["slug"], c["num"], sentence(c["ten"])] for c in chs],
            "a": [[a.id, a.t, chs.index(a.ch), flags(a)] for a in ARTS]}


def search_index(ver):
    """Toàn văn theo đoạn: [số điều, [đoạn điều luật…], [đoạn sửa đổi, bổ sung…]]."""
    rows = []
    for a in ARTS:
        am = []
        for it in a.items:
            if it["kind"] == "repeal-chapter" or it is a.new:
                continue
            am.extend(re.sub(r"\s+", " ", p).strip() for _, p in node_paras(it["node"], [], prefix=False) if p.strip())
        rows.append([a.id, law_paras(a), am])
    return {"v": ver, "a": rows}


# =============================================================================
def main():
    ver = TODAY.replace("-", "") + "i"  # tăng chữ cuối khi sửa tths.css, tths.js
    tpl = make_template().replace("__V__", ver)
    for m in ("<!--seo:head-->", "<!--seo:main-->", '<base href="../">', DIR + "tths.js"):
        assert m in tpl, "Khuôn trang thiếu " + m
    os.makedirs(OUT, exist_ok=True)
    collect_refs()
    pages = [page_index(), page_amend(), page_search(), page_hist_list(), page_tools(), page_deadlines(), page_compare(), page_saved(), page_about()] + \
        [page_chapter(c) for c in CHAPS] + [page_law(L) for L in ORDER] + \
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
        json.dump(search_index(ver), f, ensure_ascii=False, separators=(",", ":"))
    adir = os.path.join(OUT, "a")
    os.makedirs(adir, exist_ok=True)
    keep_a = {a.id + ".json" for a in ARTS}
    for f in os.listdir(adir):
        if f not in keep_a:
            os.remove(os.path.join(adir, f))
    for a in ARTS:
        body = json.dumps(preview_data(a), ensure_ascii=False, separators=(",", ":"))
        dest = os.path.join(adir, a.id + ".json")
        if not os.path.exists(dest) or open(dest, encoding="utf-8").read() != body:
            with open(dest, "w", encoding="utf-8", newline="\n") as f:
                f.write(body)
    with open(os.path.join(OUT, "muc-luc.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(toc_index(ver), f, ensure_ascii=False, separators=(",", ":"))
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
