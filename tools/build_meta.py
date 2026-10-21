# -*- coding: utf-8 -*-
"""
Sinh dữ liệu phụ trợ cho website tra cứu Bộ luật Hình sự.

    python3 tools/build_meta.py

Đầu vào : data/toc.json, data/c01.json … data/c26.json, data/p3.json
          (do tools/build_blhs.py tạo từ tệp Word "Bình luận khoa học BLHS").
Đầu ra  : data/meta.json  – trích đoạn, khung hình phạt từng khoản, phân loại tội phạm
                            (Điều 9), dẫn chiếu qua lại giữa các điều.
          data/toc.json    – cập nhật mã phiên bản "v" để trình duyệt tải lại dữ liệu mới.

Script chạy lặp lại nhiều lần vẫn cho cùng kết quả.
"""
import glob
import hashlib
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")

# Lỗi đánh máy trong tệp nguồn — sửa theo văn bản Bộ luật Hình sự được công bố chính thức.
TYPO_FIX = {
    "216": [("phạt tù từ 06 tháng năm đến 03 năm", "phạt tù từ 06 tháng đến 03 năm")],
    "348": [("thì bị phạt từ từ 01 năm đến 05 năm", "thì bị phạt tù từ 01 năm đến 05 năm")],
    "364": [("thì bị phạt từ tù 12 năm đến 20 năm", "thì bị phạt tù từ 12 năm đến 20 năm")],
    "403": [("thì bị phạt từ từ 05 năm đến 10 năm", "thì bị phạt tù từ 05 năm đến 10 năm")],
}

# Người từ đủ 14 đến dưới 16 tuổi chịu TNHS về tội rất nghiêm trọng, đặc biệt nghiêm trọng
# tại các điều sau (khoản 2 Điều 12) — được đối chiếu tự động với văn bản Điều 12 bên dưới.
AGE14 = ["123", "134", "141", "142", "143", "144", "150", "151", "168", "169", "170", "171", "173", "178",
         "248", "249", "250", "251", "252", "265", "266", "286", "287", "289", "290", "299", "303", "304"]


def plain(h):
    h = re.sub(r'<sup class="fn"[^>]*>.*?</sup>', "", h)
    return html.unescape(re.sub(r"<[^>]+>", "", h)).strip()


def months(n, unit):
    return int(n) * (12 if unit == "năm" else 1)


NUM = r"(\d{1,2})\s*(năm|tháng)"


def parse_sanction(body):
    """Tách khung hình phạt chính từ nội dung một khoản. Trả về None nếu khoản không quy định khung."""
    hits = list(re.finditer(r"thì bị\s+((?:phạt|xử phạt)[^:]*)", body))
    if not hits:
        hits = [m for m in re.finditer(r"\bbị\s+((?:phạt|xử phạt)[^:]*)", body)
                if not m.group(1).startswith("xử phạt vi phạm hành chính")]
    if not hits:
        return None
    s = hits[-1].group(1)
    s = re.split(r"(?<=[^\d])\.\s|:\s*$", s)[0].strip().rstrip(".;:*").strip()
    lo = hi = None
    m = re.search(r"phạt tù từ\s+" + NUM + r"\s+đến\s+" + NUM, s)
    if m:
        lo, hi = months(*m.group(1, 2)), months(*m.group(3, 4))
    else:
        m = re.search(r"phạt tù đến\s+" + NUM, s)
        if m:
            lo, hi = 3, months(*m.group(1, 2))
        else:
            m = re.search(r"phạt tù\s+" + NUM + r"(?!\s+đến)", s)
            if m:
                lo = hi = months(*m.group(1, 2))
    ct = "chung thân" in s
    th = "tử hình" in s
    alt = [w for w in ("cảnh cáo", "phạt tiền", "cải tạo không giam giữ") if w in s]
    if lo is None and not ct and not th and not alt:
        return None
    return {"lo": lo, "hi": hi, "ct": ct, "th": th, "alt": alt, "txt": s[0].upper() + s[1:]}


def classify(p):
    """Phân loại theo khoản 1 Điều 9: căn cứ mức cao nhất của khung hình phạt."""
    if p["th"] or p["ct"]:
        return 4
    hi = p["hi"]
    if hi is None:
        return 1  # chỉ có phạt tiền / cải tạo không giam giữ / cảnh cáo
    if hi > 180:
        return 4
    if hi > 84:
        return 3
    if hi > 36:
        return 2
    return 1


def excerpt(a, n=190):
    text = " ".join(plain(h).rstrip("*") for _, h in a["law"])
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= n:
        return text
    return text[:n].rsplit(" ", 1)[0] + "…"


def main():
    with open(os.path.join(DATA, "toc.json"), encoding="utf-8") as fh:
        toc = json.load(fh)
    files = sorted(f for f in glob.glob(os.path.join(DATA, "*.json"))
                   if re.search(r"(c\d\d|p3)\.json$", f))
    chunks, A = {}, {}
    for f in files:
        with open(f, encoding="utf-8") as fh:
            arr = json.load(fh)
        chunks[f] = arr
        for a in arr:
            A[a["id"]] = a

    # ---- 1. Sửa dữ liệu nguồn ----
    fixed = 0
    for aid, pairs in TYPO_FIX.items():
        for i, (k, h) in enumerate(A[aid]["law"]):
            for old, new in pairs:
                if old in h:
                    h = h.replace(old, new)
                    fixed += 1
            A[aid]["law"][i] = [k, h]
    # Điều 60: điểm b, c, d khoản 2 bị dồn vào một đoạn trong tệp nguồn
    law60 = []
    for k, h in A["60"]["law"]:
        if k == "p" and re.search(r";\s+[c-d]\)\s", h):
            for part in re.split(r"(?<=;)\s+(?=[c-d]\)\s)", h):
                law60.append(["p", part.strip()])
                fixed += 1
        else:
            law60.append([k, h])
    A["60"]["law"] = law60
    # Thẻ định dạng rỗng nằm giữa hai từ (khoảng trắng bị nuốt khi chuyển đổi): "Mặt<i></i>khách" → "Mặt khách"
    for a in A.values():
        for part in ("law", "cm"):
            for i, (k, h) in enumerate(a[part]):
                h2 = re.sub(r"\s*<(i|b)>\s*</\1>\s*", " ", h)
                if h2 != h:
                    a[part][i] = [k, h2.strip()]
                    fixed += 1
    for f, arr in chunks.items():
        body = json.dumps(arr, ensure_ascii=False, separators=(",", ":"))
        with open(f, "w", encoding="utf-8") as fh:
            fh.write(body)

    # Đối chiếu danh sách khoản 2 Điều 12
    t12 = " ".join(plain(h) for _, h in A["12"]["law"])
    listed = re.search(r"các điều ([\d,\s và]+) của Bộ luật này", t12).group(1)
    ids12 = re.findall(r"\d+", listed)
    assert ids12 == AGE14, ("Danh sách Điều 12 thay đổi", ids12)

    # ---- 2. Phân tích ----
    order = [x["id"] for c in toc["chapters"] for x in c["a"]]
    part_of = {x["id"]: c["part"] for c in toc["chapters"] for x in c["a"]}
    chap_of = {x["id"]: c["id"] for c in toc["chapters"] for x in c["a"]}
    xr = re.compile(r'class="xr" href="#d(\w+)"')
    meta = {}
    for aid in order:
        a = A[aid]
        out_law = []
        for _, h in a["law"]:
            for x in xr.findall(h):
                if x != aid and x in A and x not in out_law:
                    out_law.append(x)
        out_cm = []
        for _, h in a["cm"]:
            for x in xr.findall(h):
                if x != aid and x in A and x not in out_cm and x not in out_law:
                    out_cm.append(x)
        m = {"ex": excerpt(a), "ln": [sum(len(plain(h)) for _, h in a["law"]),
                                      sum(len(plain(h)) for _, h in a["cm"])]}
        if out_law:
            m["ol"] = out_law
        if out_cm:
            m["oc"] = out_cm[:12]
        if part_of[aid] == "p2":
            ks = []
            # Điều luật không chia khoản: đoạn đầu tiên là khung hình phạt duy nhất
            single = not any(k == "k" for k, _ in a["law"])
            for k, h in a["law"]:
                t = plain(h).rstrip("*").strip()
                if single and k == "x":
                    num, body = "", t
                elif k == "k":
                    mm = re.match(r"^(\d+)\.\s*(.*)$", t)
                    if not mm:
                        continue
                    num, body = mm.group(1), mm.group(2)
                else:
                    continue
                if re.match(r"^(Người phạm tội|Pháp nhân)", body) and re.search(r"\bcòn (có thể )?bị\b", body[:60]):
                    ks.append({"n": num, "bs": 1, "txt": body})
                    continue
                if re.match(r"^Pháp nhân", body):
                    continue
                p = parse_sanction(body)
                if not p:
                    continue
                item = {"n": num, "lo": p["lo"], "hi": p["hi"], "txt": p["txt"], "c": classify(p)}
                if p["ct"]:
                    item["ct"] = 1
                if p["th"]:
                    item["th"] = 1
                if p["alt"]:
                    item["alt"] = p["alt"]
                if re.search(r"chuẩn bị phạm tội", body):
                    item["cb"] = 1
                ks.append(item)
            if ks:
                m["k"] = ks
            if aid in AGE14:
                m["a14"] = 1
            # Chủ thể đặc biệt: điều luật tự quy định người phạm tội phải "đủ 18 tuổi trở lên" (vd. Điều 145, 146, 147, 325, 329)
            first = next((plain(h) for k, h in a["law"] if k in ("k", "x")), "")
            if re.match(r"^(1\.\s*)?Người nào đủ 18 tuổi trở lên", first):
                m["a18"] = 1
            if chap_of[aid] in ("c13", "c26"):
                m["nl"] = 1  # không áp dụng thời hiệu (Điều 28, Điều 61)
            if aid in ("353", "354"):
                m["nl"] = ["3", "4"]
        meta[aid] = m

    inc = {}
    for aid in order:
        for x in meta[aid].get("ol", []):
            inc.setdefault(x, []).append(aid)
    for x, lst in inc.items():
        meta[x]["in"] = lst

    # ---- 3. Ghi ----
    digest = hashlib.sha1()
    for f in files:
        with open(f, "rb") as fh:
            digest.update(fh.read())
    body = json.dumps(meta, ensure_ascii=False, separators=(",", ":"))
    digest.update(body.encode("utf-8"))
    digest.update(json.dumps([toc["parts"], toc["chapters"]], ensure_ascii=False).encode("utf-8"))
    toc["v"] = digest.hexdigest()[:10]
    with open(os.path.join(DATA, "meta.json"), "w", encoding="utf-8") as fh:
        fh.write(body)
    with open(os.path.join(DATA, "toc.json"), "w", encoding="utf-8") as fh:
        json.dump(toc, fh, ensure_ascii=False, separators=(",", ":"))

    n_k = sum(len(m.get("k", [])) for m in meta.values())
    no_k = [aid for aid in order if part_of[aid] == "p2" and not meta[aid].get("k")]
    print(f"Điều: {len(meta)} | Khoản có khung hình phạt: {n_k} | Sửa lỗi nguồn: {fixed}")
    print(f"Điều thuộc Phần thứ hai chưa nhận diện khung: {no_k}")
    print(f"meta.json: {len(body.encode('utf-8')) / 1024:.0f} KB | v = {toc['v']}")


if __name__ == "__main__":
    main()
