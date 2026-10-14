# Tra cứu Bộ luật Hình sự – Luật Sư Nam

Website tra cứu, nghiên cứu **Bộ luật Hình sự số 100/2015/QH13** (sửa đổi, bổ sung bởi Luật số 12/2017/QH14,
Luật số 59/2024/QH15 và Luật số 86/2025/QH15) dành cho luật sư, sinh viên luật và người dân.

**Xem trực tiếp:** https://willmichco.github.io/luathinhsu/

## Tính năng

| Nhóm | Chi tiết |
|---|---|
| Tra cứu | 428 điều (kể cả Điều 217a, 256a), mục lục Phần → Chương → Mục → Điều, lọc tức thì |
| Tất cả điều luật | Bảng mở đè lên trang (nút “Tất cả điều” ở đầu trang, thanh bên, giữa “Điều trước/Điều sau”, menu; phím `Ctrl/⌘ + K`): toàn bộ 428 điều liên tục theo chương, cột chương để cuộn nhanh, đánh dấu điều đang đọc, “Vừa xem”; lọc theo số, không dấu, `khoản 2 điều 134`, `chương 16`; ↑ ↓ Enter để mở |
| Tìm kiếm thông minh | Gõ không dấu; `173`, `khoản 2 điều 134`, `điểm a khoản 1 điều 51`, `chương 20`; “cụm từ chính xác”; gợi ý theo cách gọi thông dụng (“vay tiền không trả” → Điều 175) |
| Trình đọc điều luật | Văn bản luật, bình luận khoa học, điều liên quan; chú thích; xem nhanh điều được dẫn chiếu khi rê chuột/chạm; sao chép trích dẫn từng khoản; lưu, ghi chú cá nhân; điều trước/sau bằng phím ← → |
| Khung hình phạt | Nhận diện tự động khung của từng khoản, phân loại tội (Điều 9), thời hiệu (Điều 27, 28), độ tuổi (Điều 12), biểu đồ trực quan |
| Công cụ | Phân loại tội & thời hiệu truy cứu · Tuổi chịu TNHS · Thời hiệu thi hành bản án · So sánh hai điều luật · Bảng khung hình phạt |
| Đa thiết bị | Tối ưu PC, máy tính bảng, điện thoại; giao diện sáng/tối (nền tối than chì ấm, mọi cặp chữ–nền đạt WCAG AA ≥ 4,5:1); chỉnh cỡ chữ (trong trang điều luật); cài như ứng dụng (PWA); đọc offline |
| SEO | Mỗi điều, chương, công cụ có đường dẫn riêng (`dieu-173`, `chuong-14`, `cong-cu-thoi-hieu`…) với trang HTML dựng sẵn toàn văn; tiêu đề, mô tả, canonical, Open Graph, JSON-LD (Legislation, BreadcrumbList, WebSite, LegalService); `sitemap.xml` |

Lưu ý hiệu lực đã được gắn trên trang: Chương XII (Điều 90 – 107) bị bãi bỏ từ 01/01/2026 theo Điều 177
Luật Tư pháp người chưa thành niên số 59/2024/QH15; Điều 292 đã bị bãi bỏ; 39 điều sửa đổi theo Luật số 86/2025/QH15.

## Cấu trúc

```
index.html               Khung ứng dụng + khuôn cho mọi trang (vùng <!--seo:head-->, <!--seo:main-->)
dieu-*.html, chuong-*.html, muc-luc.html, cong-cu*.html, gioi-thieu.html, tim-kiem.html, da-luu.html
                         Trang dựng tĩnh cho công cụ tìm kiếm (sinh tự động, không sửa tay)
sitemap.xml, robots.txt  Sơ đồ trang (sinh tự động)
assets/css/app.css       Giao diện (đỏ son – vàng đồng, hoa văn trống đồng). Màu chữ đỏ dùng --primary-ink (nền tối: đỏ san hô sáng),
                         màu nền nút dùng --primary; không dùng --primary làm màu chữ
assets/js/app.js         Dữ liệu, định tuyến, trang chủ, mục lục, chương, điều luật, tìm kiếm, đã lưu
assets/js/tools.js       Các công cụ nghiên cứu
assets/js/lx-core.js     Chuẩn hoá và so khớp tiếng Việt (tìm không dấu)
assets/js/search-*.js    Tìm kiếm toàn văn chạy nền (Web Worker)
data/toc.json            Mục lục
data/c01…c26.json, p3.json  Nội dung điều luật + bình luận theo chương
data/meta.json           Trích đoạn, khung hình phạt, dẫn chiếu (sinh tự động)
data/a/<số>.json         Dữ liệu riêng từng điều – trang điều luật chỉ tải vài KB thay vì cả chương (sinh tự động)
assets/fonts/            Be Vietnam Pro: mỗi độ đậm 1 tệp chỉ gồm ký tự tiếng Việt (tools/build_fonts.py); OFL.txt
tools/build_blhs.py      Chuyển tệp Word “Bình luận khoa học BLHS” → data/*.json
tools/build_meta.py      Sinh data/meta.json, sửa lỗi đánh máy nguồn
tools/build_seo.py       Sinh các trang dựng tĩnh, data/a/*.json, sitemap.xml, robots.txt từ index.html + data/
tools/build_fonts.py     Tạo phông thu gọn (cần: pip install fonttools brotli); chỉ chạy lại khi đổi phông/bộ ký tự
tools/serve.py           Máy chủ thử nghiệm mô phỏng GitHub Pages (đường dẫn không đuôi .html, trang 404, nén gzip)
sw.js, manifest.webmanifest  Đọc offline, cài đặt như ứng dụng
```

## Chạy thử trên máy

```bash
python3 tools/serve.py
# mở http://localhost:8000/luathinhsu/
```

Sau khi cập nhật dữ liệu điều luật, chạy `python3 tools/build_meta.py` để sinh lại `data/meta.json`.
Sau khi sửa `index.html` (header, footer…) hoặc dữ liệu, chạy `python3 tools/build_seo.py` để sinh lại các trang dựng tĩnh
và sitemap. Khi chuyển sang tên miền riêng: `SITE_URL=https://ten-mien.vn/ python3 tools/build_seo.py`.

## Tốc độ tải

- Mỗi trang có sẵn nội dung HTML, hiển thị trước khi JavaScript chạy; phông chữ 400 và hoa văn đầu trang được nạp sẵn.
- Trang điều luật chỉ tải dữ liệu của chính điều đó (`data/a/…`); dữ liệu tìm kiếm toàn văn (~400 KB) chỉ tải khi người
  dùng bắt đầu gõ tìm kiếm; mã công cụ (`tools.js`) chỉ tải khi mở trang công cụ.
- Rê chuột/chạm vào liên kết điều luật → nạp trước dữ liệu điều đó (tắt khi bật chế độ tiết kiệm dữ liệu).
- Danh sách dài dùng `content-visibility` để trình duyệt chỉ dàn trang phần đang nhìn thấy.
- Service worker: tệp có `?v=` (CSS, JS, dữ liệu), phông, hình lấy thẳng từ bộ nhớ đệm; HTML ưu tiên mạng (chờ tối đa 3 giây).
  Khi sửa CSS/JS, tăng mã phiên bản `?v=` trong `index.html`, `VER` trong `assets/js/app.js`, `sw.js`, `search-worker.js`.

## Đường dẫn

| Trang | Đường dẫn |
|---|---|
| Trang chủ | `./` |
| Điều luật · tab · khoản | `dieu-173` · `dieu-173?tab=binh-luan` · `dieu-173?k=2&d=a` |
| Chương · Mục lục | `chuong-16`, `chuong-p3` · `muc-luc` |
| Công cụ | `cong-cu`, `cong-cu-thoi-hieu`, `cong-cu-tuoi`, `cong-cu-thi-hanh-an`, `cong-cu-so-sanh`, `cong-cu-khung-hinh-phat` |
| Khác | `tim-kiem?q=…`, `da-luu`, `gioi-thieu` |

Liên kết kiểu cũ (`#/dieu/173`, `#d173`) vẫn mở đúng trang và được tự đổi sang đường dẫn mới.

**Google Search Console:** thêm thuộc tính dạng tiền tố URL `https://willmichco.github.io/luathinhsu/` rồi gửi
`sitemap.xml`. Với trang dự án GitHub Pages, `robots.txt` chỉ có hiệu lực khi đặt ở gốc tên miền.

## Miễn trừ trách nhiệm

Nội dung nhằm mục đích tham khảo, nghiên cứu; không thay thế ý kiến tư vấn pháp lý cho vụ việc cụ thể.
Khi sử dụng trong hồ sơ tố tụng, cần đối chiếu văn bản đăng trên Công báo hoặc văn bản hợp nhất mới nhất.

Công ty Luật TNHH Luật Sư Nam · 0983 498 499 · luatsunam.hcm@gmail.com
