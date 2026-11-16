# -*- coding: utf-8 -*-
"""
Trích dữ liệu Bộ luật Tố tụng hình sự và các văn bản sửa đổi từ kho dữ liệu tracuuphapluat
→ tools/nguon-tths/<id>.json (đầu vào của tools/build_tths.py).

    python3 tools/tths_nguon.py /duong-dan/tracuuphapluat [nhánh]

Nhánh mặc định: origin/claude/compassionate-ritchie-wwgrw7. Dữ liệu nằm trong bot/du-lieu/ho-so/<đợt>.jsonl.gz
(mỗi dòng một hồ sơ JSON). Hồ sơ được tìm theo "id", không theo số dòng (số dòng đổi mỗi lần gộp thêm hồ sơ).

Với Bộ luật (2015, 2003, 1988) và các luật chỉ để sửa đổi Bộ luật: giữ toàn văn.
Với luật khác có điều khoản sửa đổi Bộ luật (vd. Luật Tư pháp người chưa thành niên): chỉ giữ các điều liên quan
(khai báo trong KEEP) và điều về hiệu lực thi hành.
"""
import gzip
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tools", "nguon-tths")

# id hồ sơ → (tệp đợt, các điều cần giữ; None = giữ toàn văn)
WANT = {
    "lvn-101322": ("phap-quy-08", None),        # BLTTHS 2015, 101/2015/QH13
    "lvn-213366": ("phap-quy-05", None),        # Luật 02/2021/QH15
    "lvn-404081": ("phap-quy-02", None),        # Luật 99/2025/QH15
    "lvn-360843": ("phap-quy-03", {"150"}),     # Luật Tổ chức TAND 34/2024/QH15
    "lvn-379410": ("phap-quy-03", {"177"}),     # Luật Tư pháp người chưa thành niên 59/2024/QH15
    "lvn-423513": ("phap-quy-01", {"40"}),      # Luật Tương trợ tư pháp về hình sự 103/2025/QH15
    "lvn-422131": ("phap-quy-01", {"43"}),      # Luật Giám định tư pháp 105/2025/QH15
    "lvn-422291": ("phap-quy-01", {"114"}),     # Luật Thi hành án dân sự 106/2025/QH15
    "lvn-422292": ("phap-quy-01", {"73"}),      # Luật Thi hành tạm giữ, tạm giam và cấm đi khỏi nơi cư trú 128/2025/QH15
    "lvn-445854": ("phap-quy-01.2", {"2"}),     # Luật Hải quan (sửa đổi) 11/2026/QH16
    "lvn-15809": ("phap-quy-14", None),         # BLTTHS 2003, 19/2003/QH11
    "lvn-10555": ("phap-quy-15", None),         # Luật sửa đổi 2000, 20/2000/QH10
    "lvn-2573": ("phap-quy-16e", None),         # Luật sửa đổi 1992, 5-L/CTN
    "lvn-2004": ("phap-quy-16d2", None),        # Luật sửa đổi 1990, 39-LCT/HĐNN8 (nguồn chưa có nội dung)
    "lvn-1593": ("phap-quy-16c", None),         # BLTTHS 1988, 7-LCT/HĐNN8
}
FIELDS = ("id", "slug", "ten", "soHieu", "loai", "coQuan", "nguoiKy", "ngayBanHanh", "trichYeu", "nguon", "noiDung")


def slim(d, keep):
    d = {k: d.get(k) for k in FIELDS}
    if keep is None or not (d.get("noiDung") or {}).get("duLieu"):
        return d
    out = []

    def walk(x):
        if x.get("cap") == "dieu":
            if x.get("so") in keep or re.search(r"[Hh]iệu lực", x.get("tieuDe") or ""):
                out.append(x)
            return
        for c in x.get("con", []):
            walk(c)

    for c in d["noiDung"]["duLieu"]["cay"]:
        walk(c)
    d["noiDung"] = {"trangThai": d["noiDung"].get("trangThai"), "duLieu": {"cay": out, "chiGiu": sorted(keep)}}
    return d


def main():
    repo = sys.argv[1] if len(sys.argv) > 1 else "../tracuuphapluat"
    ref = sys.argv[2] if len(sys.argv) > 2 else "origin/claude/compassionate-ritchie-wwgrw7"
    os.makedirs(OUT, exist_ok=True)
    by_file = {}
    for i, (f, keep) in WANT.items():
        by_file.setdefault(f, {})[i] = keep
    found = set()
    for f, ids in sorted(by_file.items()):
        raw = subprocess.check_output(["git", "show", "%s:bot/du-lieu/ho-so/%s.jsonl.gz" % (ref, f)], cwd=repo)
        for line in gzip.decompress(raw).decode("utf-8").splitlines():
            m = re.match(r'\{"id": ?"([^"]+)"', line)
            if not m or m.group(1) not in ids:
                continue
            d = json.loads(line)
            body = json.dumps(slim(d, ids[d["id"]]), ensure_ascii=False, indent=0, sort_keys=False)
            with open(os.path.join(OUT, d["id"] + ".json"), "w", encoding="utf-8", newline="\n") as fo:
                fo.write(body + "\n")
            found.add(d["id"])
            print("  %-11s %-16s %s" % (d["id"], d.get("soHieu"), d.get("ten")))
    miss = set(WANT) - found
    if miss:
        sys.exit("Không tìm thấy hồ sơ: " + ", ".join(sorted(miss)))
    print("Đã ghi %d hồ sơ vào %s" % (len(found), os.path.relpath(OUT, ROOT)))


if __name__ == "__main__":
    main()
