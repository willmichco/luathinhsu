# -*- coding: utf-8 -*-
"""
Tạo phông Be Vietnam Pro tối giản cho website: mỗi độ đậm một tệp WOFF2 duy nhất, chỉ gồm các ký tự cần cho
tiếng Việt (thay cho 2 tệp "latin" + "vietnamese" như trước) → ít yêu cầu mạng hơn, nhẹ hơn.

    pip install fonttools brotli
    python3 tools/build_fonts.py

Phông gốc (SIL Open Font License 1.1) được tải từ kho Google Fonts về tools/goc/fonts/ (không đưa lên git).
Đầu ra: assets/fonts/be-vietnam-pro-<400|500|600|700>.woff2 và giấy phép assets/fonts/OFL.txt.
Ký tự nằm ngoài tập dưới đây vẫn hiển thị bằng phông hệ thống (khai báo unicode-range trong app.css phải khớp UNICODES).
"""
import os
import urllib.request

from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "goc", "fonts")
OUT = os.path.join(ROOT, "assets", "fonts")
BASE = "https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/"
WEIGHTS = {400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold"}

# ASCII; chữ có dấu tiếng Việt thuộc Latin-1 và ký hiệu § © « ° ± · » × ÷; chữ Việt mở rộng; dấu thanh tổ hợp;
# dấu câu thông dụng (– — ‘ ’ “ ” • …), ₫ €, № ™, mũi tên, dấu trừ, ≤ ≥.
UNICODES = ("U+0020-007E,U+00A0,U+00A7,U+00A9,U+00AB,U+00B0-00B1,U+00B7,U+00BB,U+00C0-00C3,U+00C8-00CA,U+00CC-00CD,"
            "U+00D2-00D5,U+00D7,U+00D9-00DA,U+00DD,U+00E0-00E3,U+00E8-00EA,U+00EC-00ED,U+00F2-00F5,U+00F7,U+00F9-00FA,U+00FD,U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,"
            "U+0300-0301,U+0303,U+0309,U+0323,U+1EA0-1EF9,U+2010-2027,U+2030,U+2039-203A,U+20AB-20AC,U+2116,U+2122,"
            "U+2190-2195,U+2212,U+2264-2265")


def fetch(name):
    path = os.path.join(SRC, name)
    if not os.path.exists(path):
        os.makedirs(SRC, exist_ok=True)
        urllib.request.urlretrieve(BASE + name, path)
    return path


def main():
    for w, style in WEIGHTS.items():
        src = fetch("BeVietnamPro-%s.ttf" % style)
        dest = os.path.join(OUT, "be-vietnam-pro-%d.woff2" % w)
        subset.main([src, "--unicodes=" + UNICODES, "--flavor=woff2", "--output-file=" + dest,
                     "--layout-features+=case"])  # tính năng mặc định (dấu, kerning, ghép chữ…) + case
        print("%s  %.1f KB" % (os.path.relpath(dest, ROOT), os.path.getsize(dest) / 1024.0))
    lic = fetch("OFL.txt")
    with open(lic, "rb") as f, open(os.path.join(OUT, "OFL.txt"), "wb") as g:
        g.write(f.read())


if __name__ == "__main__":
    main()
