# -*- coding: utf-8 -*-
"""
Chuyển tệp Word "Bình luận khoa học Bộ luật Hình sự" thành dữ liệu tra cứu
cho trang /bo-luat-hinh-su/.

Cách dùng (tại thư mục gốc của website):

    pip install python-docx
    python3 tools/build_blhs.py "duong-dan/Binh-luan-BLHS.docx"

Sau đó dựng lại trang bằng:  python3 tools/build.py

Tuỳ chọn:
    --khong-binh-luan   Chỉ xuất văn bản điều luật, bỏ toàn bộ phần bình luận.

Kết quả:
    bo-luat-hinh-su/data/toc.json       Mục lục (Phần → Chương → Mục → Điều)
    bo-luat-hinh-su/data/c01.json ...   Nội dung từng chương
    (sau đó chạy tools/build.py để sinh lại trang tổng quan, 27 trang chương
     và trang riêng cho từng điều tại /bo-luat-hinh-su/dieu-<số>/)
"""
import argparse
import html
import json
import os
import re
import sys
import unicodedata
import zipfile

try:
    from docx import Document
except ImportError:  # pragma: no cover
    sys.exit("Cần cài thư viện: pip install python-docx")

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "bo-luat-hinh-su", "data")
PAGE = None  # Trang tra cứu do tools/build.py sinh từ dữ liệu; không còn chèn mục lục vào HTML

# Tiêu đề Mục bị thiếu trong tệp gốc: bổ sung theo cấu trúc chính thức của
# Bộ luật Hình sự năm 2015 (Chương XVIII có 3 mục; Mục 3 gồm Điều 222–234).
MISSING_MUC = {"222": "Mục 3. Các tội phạm khác xâm phạm trật tự quản lý kinh tế"}

# Tên chương bị sai chính tả trong tệp gốc: sửa theo văn bản chính thức của Bộ luật Hình sự năm 2015.
CHAPTER_NAME_FIX = {
    "XV": "Các tội xâm phạm quyền tự do của con người, quyền tự do, dân chủ của công dân",  # tệp gốc thừa chữ "chế"
    "XXV": "Các tội xâm phạm nghĩa vụ, trách nhiệm của quân nhân và trách nhiệm của người phối thuộc "
           "với quân đội trong chiến đấu, phục vụ chiến đấu",  # tệp gốc thiếu chữ "với"
}


# --------------------------------------------------------------------------
# Chuẩn hoá văn bản
# --------------------------------------------------------------------------
def nfc(s):
    return unicodedata.normalize("NFC", s)


def squash(s):
    s = s.replace("\xa0", " ").replace("\t", " ").replace("​", "")
    return re.sub(r"\s+", " ", s).strip()


def fold(s):
    """Bỏ dấu tiếng Việt + chữ thường, dùng để kiểm tra độ dài tương ứng."""
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.replace("đ", "d")


def sentence_case(s):
    s = s.lower()
    s = s[:1].upper() + s[1:]
    s = re.sub(r"\bbộ luật hình sự\b", "Bộ luật Hình sự", s)
    return s


# --------------------------------------------------------------------------
# Trích xuất một đoạn thành HTML tối giản (giữ in đậm, in nghiêng, chú thích)
# --------------------------------------------------------------------------
def on(el):
    return el is not None and el.get(W + "val") not in ("0", "false", "none")


def para_segments(p, footnote_seq, keep_format):
    """Trả về danh sách (văn bản, đậm, nghiêng) hoặc ('\x00fn', id)."""
    segs = []
    for r in p._p.iter(W + "r"):
        rpr = r.find(W + "rPr")
        b = i = False
        if keep_format and rpr is not None:
            b, i = on(rpr.find(W + "b")), on(rpr.find(W + "i"))
        for ch in r:
            if ch.tag == W + "t":
                txt = ch.text or ""
            elif ch.tag in (W + "tab", W + "br", W + "cr"):
                txt = " "
            elif ch.tag == W + "footnoteReference":
                segs.append(("\x00fn", ch.get(W + "id")))
                continue
            else:
                continue
            if not txt:
                continue
            # Dấu tổ hợp rơi sang run sau: dồn về run trước để chuẩn hoá NFC đúng
            lead = len(txt) - len(txt.lstrip("".join(chr(c) for c in range(0x300, 0x370))))
            if lead and segs and segs[-1][0] != "\x00fn":
                t0, b0, i0 = segs[-1]
                segs[-1] = (t0 + txt[:lead], b0, i0)
                txt = txt[lead:]
            if segs and segs[-1][0] != "\x00fn" and segs[-1][1:] == (b, i):
                segs[-1] = (segs[-1][0] + txt, b, i)
            else:
                segs.append((txt, b, i))
    return segs


def segments_to_html(segs, footnote_seq):
    out = []
    for s in segs:
        if s[0] == "\x00fn":
            fid = s[1]
            n = footnote_seq.setdefault(fid, len(footnote_seq) + 1)
            out.append(f'<sup class="fn" data-fn="{n}">{n}</sup>')
            continue
        txt, b, i = s
        t = html.escape(nfc(txt.replace("\xa0", " ").replace("\t", " ")), quote=False)
        if b:
            t = f"<b>{t}</b>"
        if i:
            t = f"<i>{t}</i>"
        out.append(t)
    h = re.sub(r"\s+", " ", "".join(out)).strip()
    h = re.sub(r"<(b|i)>\s*</\1>", "", h)          # thẻ rỗng
    h = re.sub(r"</i><i>|</b><b>", "", h)          # thẻ liền nhau
    return h


def plain(h):
    h = re.sub(r'<sup class="fn"[^>]*>.*?</sup>', "", h)
    return html.unescape(re.sub(r"<[^>]+>", "", h)).strip()


# --------------------------------------------------------------------------
# Phân loại đoạn để trình bày
# --------------------------------------------------------------------------
RE_KHOAN = re.compile(r"^\d{1,2}\.\s")
RE_DIEM = re.compile(r"^[a-zđ]\)\s")
RE_LEAD = re.compile(r"^([^\d:<>]{3,42}):\s")


def law_kind(t):
    if t.startswith("Hiệu lực thi hành và điều khoản chuyển tiếp"):
        return "h"
    if RE_KHOAN.match(t):
        return "k"
    if RE_DIEM.match(t):
        return "p"
    return "x"


def cm_kind(t, style):
    short = len(t) <= 95
    if re.match(r"^Điểm mới\b", t):
        return "n"
    if style == "ITALIC":
        return "s" if short else "q"
    if short and re.match(r"^\d{1,2}\.\s", t) and not t.endswith((".", ";", ",")):
        return "h"
    if short and (t.startswith("* ") or re.match(r"^[a-zđ][\.\)]\s", t)) and not t.endswith((";", ",")):
        return "s"
    if len(t) <= 70 and t.endswith(":") and not re.match(r"^[-+–]", t):
        return "s"
    if re.match(r"^[-+–•]\s", t):
        return "b"
    return "x"


def bold_lead(h, t):
    """In đậm nhãn mở đầu kiểu 'Khách thể của tội phạm: ...'."""
    m = RE_LEAD.match(t)
    if not m or len(m.group(1).split()) > 7:
        return h
    lab = html.escape(m.group(1), quote=False) + ":"
    return f"<b>{lab}</b>" + h[len(lab):] if h.startswith(lab) else h


# --------------------------------------------------------------------------
# Liên kết chéo "Điều N" trong cùng Bộ luật
# --------------------------------------------------------------------------
# "Luật X" viết hoa chữ L là tên một đạo luật khác; "bộ luật" viết thường thì không.
OTHER_LAW = re.compile(
    r"((?i:bộ luật (dân sự|tố tụng|lao động|hàng hải))|(?<![Bb]ộ )Luật\s+\w|(?i:luật đất đai)|"
    r"(?i:nghị định|nghị quyết|thông tư|hiến pháp|pháp lệnh|công ước|quyết định|chỉ thị|"
    r"văn bản|tuyên ngôn|của luật)|1999|1985|1789)")
THIS_CODE = r"(?i:bộ luật này|bộ luật hình sự|BLHS)(?!\s*(năm\s*)?(1999|1985))"


def link_refs(h, known, self_id):
    """Chỉ gắn liên kết khi 'Điều N' chắc chắn thuộc Bộ luật Hình sự hiện hành."""
    txt = re.sub(r"<[^>]+>", "", h)          # ngữ cảnh xét trên văn bản thuần
    # Đoạn có so sánh với Bộ luật cũ: "Điều N" rất dễ là điều của luật cũ,
    # nên chỉ gắn liên kết khi ghi rõ "của Bộ luật này" / "Bộ luật Hình sự".
    mentions_old_code = bool(re.search(r"1999|1985", txt))

    def ok(pos_start, pos_end, num):
        if num not in known or num == self_id:
            return False
        after = txt[pos_end: pos_end + 80]
        before = txt[max(0, pos_start - 60): pos_start]
        explicit = re.match(r"\s*((,|và|hoặc)\s*(Điều\s*)?\d{1,3}[a-z]?\s*)*(,\s*)?(của\s+)?" + THIS_CODE, after)
        if explicit:
            return True
        if mentions_old_code:
            return False
        clause = re.split(r"[.;:]\s|\)", after, maxsplit=1)[0]
        # "Bộ luật này", "Bộ luật Hình sự" hiện hành không phải là luật khác
        clause = re.sub(THIS_CODE, "", clause)
        before = re.sub(THIS_CODE, "", before)
        if OTHER_LAW.search(clause) or OTHER_LAW.search(before[-40:]):
            return False
        return True

    # Đánh dấu vị trí hợp lệ trên văn bản thuần, rồi gắn liên kết theo đúng thứ tự xuất hiện
    valid = [ok(m.start(2) - 5, m.end(2), m.group(2))
             for m in re.finditer(r"(^|[\s(“\"])Điều (\d{1,3}[a-z]?)(?![\d/])", txt)]
    it = iter(valid)
    parts = re.split(r"(<[^>]+>)", h)
    for k in range(0, len(parts), 2):
        parts[k] = re.sub(r"(^|[\s(“\"])Điều (\d{1,3}[a-z]?)(?![\d/])",
                          lambda m: (f'{m.group(1)}<a class="xr" href="#d{m.group(2)}">Điều {m.group(2)}</a>'
                                     if next(it, False) else m.group(0)), parts[k])
    return "".join(parts)


# --------------------------------------------------------------------------
# Chương trình chính
# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("docx")
    ap.add_argument("--khong-binh-luan", action="store_true")
    a = ap.parse_args()
    with_cm = not a.khong_binh_luan

    doc = Document(a.docx)
    P = doc.paragraphs

    z = zipfile.ZipFile(a.docx)
    notes = {}
    if "word/footnotes.xml" in z.namelist():
        fx = z.read("word/footnotes.xml").decode("utf8")
        for fid, body in re.findall(r'<w:footnote [^>]*w:id="(-?\d+)"[^>]*>(.*?)</w:footnote>', fx, re.S):
            txt = squash(nfc(re.sub(r"<[^>]+>", "", re.sub(r"</w:p>", " ", body))))
            if int(fid) > 0 and txt:
                notes[fid] = txt

    # ---- Duyệt tuần tự dựng cây cấu trúc ----
    parts, chapters, arts = [], [], []
    cur_part = cur_chap = cur_art = None
    cur_muc = None
    mode = None  # 'law' | 'cm'
    fseq = {}

    def new_chapter(num, name, pid):
        c = {"id": f"c{len(chapters) + 1:02d}", "num": num, "name": name, "part": pid,
             "muc": [], "arts": []}
        chapters.append(c)
        return c

    for idx, p in enumerate(P):
        style = p.style.name
        raw = nfc(p.text)
        t = squash(raw)
        if not t:
            continue
        lines = [squash(x) for x in raw.split("\n") if squash(x)]

        if style in ("PHAN BR", "center-thuong") and re.match(r"^phần", t, re.I):
            name = sentence_case(" ".join(lines[1:]))
            cur_part = {"id": f"p{len(parts) + 1}", "label": sentence_case(lines[0]), "name": name}
            parts.append(cur_part)
            cur_chap, cur_muc, cur_art = None, None, None
            if len(parts) == 3:  # Phần thứ ba không chia chương
                cur_chap = new_chapter("", name, cur_part["id"])
                cur_chap["id"] = "p3"
            continue

        if style == "CHUONG BR":
            num = re.sub(r"^chương\s+", "", lines[0], flags=re.I).upper()
            cur_chap = new_chapter(num, CHAPTER_NAME_FIX.get(num) or sentence_case(" ".join(lines[1:])), cur_part["id"])
            cur_muc, cur_art = None, None
            continue

        if style == "CENTER" and re.match(r"^mục\s+\d", t, re.I):
            m = re.match(r"^mục\s+(\d+)\.?\s*(.*)$", t, re.I)
            cur_muc = {"n": int(m.group(1)), "name": f"Mục {m.group(1)}. {sentence_case(m.group(2))}"}
            cur_chap["muc"].append(cur_muc)
            continue
        if style == "CENTER":
            continue  # trang bìa, "MỤC LỤC" rỗng ở cuối

        if style == "DIEU":
            m = re.match(r"^Điều\s*(\d+[a-zđ]?)\s*[.:]?\s*(.*)$", t)
            num, title = m.group(1), m.group(2)
            title = re.sub(r"\s*\(Điều \d+ Bộ luật hình sự\)\s*$", "", title)
            amended = title.endswith("*")
            title = title.rstrip("* ").strip()
            if num in MISSING_MUC:
                cur_muc = {"n": int(MISSING_MUC[num].split()[1].rstrip(".")), "name": MISSING_MUC[num],
                           "added": True}
                cur_chap["muc"].append(cur_muc)
            cur_art = {"id": num, "title": title, "chap": cur_chap["id"],
                       "muc": cur_muc["n"] if cur_muc else None,
                       "am": amended, "law": [], "cm": [], "fn": {}}
            if cur_muc is not None:
                cur_muc.setdefault("arts", []).append(num)
            cur_chap["arts"].append(num)
            arts.append(cur_art)
            mode = "law"
            continue

        if cur_art is None:
            continue
        # "Bình luận" nhận diện theo NỘI DUNG, không theo style (3 điều bị gán sai style)
        if re.fullmatch(r"bình luận\s*[:.]?", t.lower()):
            mode = "cm"
            continue

        keep_fmt = mode == "cm"
        segs = para_segments(p, fseq, keep_fmt)
        h = segments_to_html(segs, fseq)
        for s in segs:
            if s[0] == "\x00fn" and s[1] in notes:
                cur_art["fn"][str(fseq[s[1]])] = notes[s[1]]
        pt = plain(h)
        if not pt:
            continue

        if mode == "law":
            # Điều 159: toàn văn điều luật được đặt trong ngoặc kép
            if cur_art["id"] == "159":
                h = h.lstrip("“\"").rstrip("”\"")
                pt = plain(h)
            cur_art["law"].append([law_kind(pt), h])
        elif with_cm:
            k = cm_kind(pt, style)
            if k == "x":
                h = bold_lead(h, pt)
            cur_art["cm"].append([k, h])

    # ---- Hậu kiểm ----
    known = {x["id"] for x in arts}
    for x in arts:
        x["law"] = [[k, link_refs(h, known, x["id"])] for k, h in x["law"]]
        x["cm"] = [[k, link_refs(h, known, x["id"])] for k, h in x["cm"]]
        cm_text = " ".join(plain(h) for _, h in x["cm"])
        x["n25"] = bool(re.search(r"Điểm mới năm 2025", cm_text))
        law_text = " ".join(plain(h) for _, h in x["law"])
        x["rep"] = bool(re.search(r"đã được bãi bỏ", law_text)) and len(x["law"]) <= 2

    # Văn bản điều luật không bao giờ chứa các cụm phân tích học thuật này
    LEAK = re.compile(r"(Khách thể của tội phạm|Mặt khách quan|Mặt chủ quan|Dấu hiệu pháp lý|"
                      r"Chủ thể của tội phạm|^Bình luận)", re.I)
    leaks = [(x["id"], plain(h)[:70]) for x in arts for _, h in x["law"] if LEAK.search(plain(h))]
    if leaks:
        print("CẢNH BÁO — nghi lời bình luận lọt vào văn bản điều luật:")
        for lk in leaks[:20]:
            print("   Điều", *lk)
    bad = [(x["id"], h[:60]) for x in arts for _, h in x["law"] + x["cm"]
           if len(fold(plain(h))) != len(plain(h).lower())]
    stray = sum(1 for x in arts for _, h in x["law"] + x["cm"] for c in plain(h) if unicodedata.combining(c))

    # ---- Ghi dữ liệu ----
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if re.match(r"^(c\d\d|p3)\.json$", f):
            os.remove(os.path.join(OUT, f))
    by_id = {x["id"]: x for x in arts}
    import hashlib
    toc = {"parts": parts, "chapters": [], "withCommentary": with_cm,
           "source": os.path.basename(a.docx)}
    digest = hashlib.sha1()
    for c in chapters:
        items = []
        for aid in c["arts"]:
            x = by_id[aid]
            items.append({"id": aid, "t": x["title"], "m": x["muc"],
                          **({"am": 1} if x["am"] else {}), **({"n25": 1} if x["n25"] else {}),
                          **({"rep": 1} if x["rep"] else {})})
        law_chars = sum(len(plain(h)) for aid in c["arts"] for _, h in by_id[aid]["law"])
        cm_chars = sum(len(plain(h)) for aid in c["arts"] for _, h in by_id[aid]["cm"])
        toc["chapters"].append({"id": c["id"], "num": c["num"], "name": c["name"], "part": c["part"],
                                "sz": [law_chars, cm_chars],
                                "muc": [{"n": m["n"], "name": m["name"], **({"added": 1} if m.get("added") else {})}
                                        for m in c["muc"]],
                                "a": items})
        chunk = [{"id": aid, "law": by_id[aid]["law"], "cm": by_id[aid]["cm"],
                  **({"fn": by_id[aid]["fn"]} if by_id[aid]["fn"] else {})} for aid in c["arts"]]
        body = json.dumps(chunk, ensure_ascii=False, separators=(",", ":"))
        digest.update(body.encode("utf-8"))
        with open(os.path.join(OUT, f"{c['id']}.json"), "w", encoding="utf-8") as fh:
            fh.write(body)
    # Mục lục (tên phần, chương, mục, điều) cũng vào mã phiên bản: sửa riêng tên vẫn buộc trình duyệt tải lại toc.json
    digest.update(json.dumps([toc["parts"], toc["chapters"]], ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    toc["v"] = digest.hexdigest()[:10]
    toc["stats"] = {"arts": len(arts), "am": sum(x["am"] for x in arts),
                    "n25": sum(x["n25"] for x in arts), "chapters": sum(1 for c in chapters if c["num"])}
    with open(os.path.join(OUT, "toc.json"), "w", encoding="utf-8") as fh:
        json.dump(toc, fh, ensure_ascii=False, separators=(",", ":"))

    # ---- Chèn mục lục tĩnh vào trang (hiển thị ngay, kể cả khi JS chưa tải) ----
    if PAGE and os.path.exists(PAGE):
        page = open(PAGE, encoding="utf-8").read()
        static = render_static_toc(toc)
        page = re.sub(r"<!-- TOC:START -->.*?<!-- TOC:END -->",
                      lambda _: f"<!-- TOC:START -->\n{static}\n<!-- TOC:END -->", page, flags=re.S)
        page = re.sub(r'<script type="application/json" id="toc-data">.*?</script>',
                      lambda _: '<script type="application/json" id="toc-data">'
                      + json.dumps(toc, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
                      + "</script>", page, flags=re.S)
        open(PAGE, "w", encoding="utf-8").write(page)

    # ---- Báo cáo ----
    size = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    n_law = sum(len(x["law"]) for x in arts)
    n_cm = sum(len(x["cm"]) for x in arts)
    n_xr = sum(h.count('class="xr"') for x in arts for _, h in x["law"] + x["cm"])
    print(f"Phần: {len(parts)} | Chương: {sum(1 for c in chapters if c['num'])} | "
          f"Mục: {sum(len(c['muc']) for c in chapters)} | Điều: {len(arts)}")
    print(f"Đoạn điều luật: {n_law} | Đoạn bình luận: {n_cm} | Chú thích: {len(fseq)} | Liên kết chéo: {n_xr}")
    print(f"Điều có dấu (*): {sum(x['am'] for x in arts)} | Điểm mới 2025: {sum(x['n25'] for x in arts)} | "
          f"Đã bãi bỏ: {[x['id'] for x in arts if x['rep']]}")
    print(f"Điều không có nội dung luật: {[x['id'] for x in arts if not x['law']]}")
    print(f"Điều không có bình luận: {[x['id'] for x in arts if not x['cm']]}")
    print(f"Ký tự tổ hợp còn sót: {stray} | Đoạn lệch độ dài khi bỏ dấu: {len(bad)}")
    print(f"Dung lượng dữ liệu: {size / 1024:.0f} KB ({len(os.listdir(OUT))} tệp)")


def render_static_toc(toc):
    e = html.escape
    out = ['<nav class="lx-toc-static" aria-label="Mục lục Bộ luật Hình sự">']
    for part in toc["parts"]:
        out.append(f'<h2 class="lx-ts-part">{e(part["label"])} · {e(part["name"])}</h2>')
        for c in (c for c in toc["chapters"] if c["part"] == part["id"]):
            if c["num"]:
                out.append(f'<h3 class="lx-ts-chap">Chương {e(c["num"])} · {e(c["name"])}</h3>')
            out.append("<ol>")
            for x in c["a"]:
                out.append(f'<li><a href="#d{x["id"]}">Điều {x["id"]}. {e(x["t"])}</a></li>')
            out.append("</ol>")
    out.append("</nav>")
    return "\n".join(out)


if __name__ == "__main__":
    main()
