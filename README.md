# Tra cứu Bộ luật Hình sự – Luật Sư Nam

Website tra cứu, nghiên cứu **Bộ luật Hình sự số 100/2015/QH13** (sửa đổi, bổ sung bởi Luật số 12/2017/QH14,
Luật số 59/2024/QH15 và Luật số 86/2025/QH15) dành cho luật sư, sinh viên luật và người dân.

**Xem trực tiếp:** https://willmichco.github.io/luathinhsu/

## Tính năng

| Nhóm | Chi tiết |
|---|---|
| Tra cứu | 428 điều (kể cả Điều 217a, 256a), mục lục Phần → Chương → Mục → Điều, lọc tức thì |
| Tìm kiếm thông minh | Gõ không dấu; `173`, `khoản 2 điều 134`, `điểm a khoản 1 điều 51`, `chương 20`; “cụm từ chính xác”; gợi ý theo cách gọi thông dụng (“vay tiền không trả” → Điều 175) |
| Trình đọc điều luật | Văn bản luật, bình luận khoa học, điều liên quan; chú thích; xem nhanh điều được dẫn chiếu khi rê chuột/chạm; sao chép trích dẫn từng khoản; lưu, ghi chú cá nhân; điều trước/sau bằng phím ← → |
| Khung hình phạt | Nhận diện tự động khung của từng khoản, phân loại tội (Điều 9), thời hiệu (Điều 27, 28), độ tuổi (Điều 12), biểu đồ trực quan |
| Công cụ | Phân loại tội & thời hiệu truy cứu · Tuổi chịu TNHS · Thời hiệu thi hành bản án · So sánh hai điều luật · Bảng khung hình phạt |
| Đa thiết bị | Tối ưu PC, máy tính bảng, điện thoại; giao diện sáng/tối; chỉnh cỡ chữ; cài như ứng dụng (PWA); đọc offline |

Lưu ý hiệu lực đã được gắn trên trang: Chương XII (Điều 90 – 107) bị bãi bỏ từ 01/01/2026 theo Điều 177
Luật Tư pháp người chưa thành niên số 59/2024/QH15; Điều 292 đã bị bãi bỏ; 39 điều sửa đổi theo Luật số 86/2025/QH15.

## Cấu trúc

```
index.html               Khung ứng dụng (định tuyến bằng #/…)
assets/css/app.css       Giao diện (đỏ son – vàng đồng, hoa văn trống đồng)
assets/js/app.js         Dữ liệu, định tuyến, trang chủ, mục lục, chương, điều luật, tìm kiếm, đã lưu
assets/js/tools.js       Các công cụ nghiên cứu
assets/js/lx-core.js     Chuẩn hoá và so khớp tiếng Việt (tìm không dấu)
assets/js/search-*.js    Tìm kiếm toàn văn chạy nền (Web Worker)
data/toc.json            Mục lục
data/c01…c26.json, p3.json  Nội dung điều luật + bình luận theo chương
data/meta.json           Trích đoạn, khung hình phạt, dẫn chiếu (sinh tự động)
tools/build_blhs.py      Chuyển tệp Word “Bình luận khoa học BLHS” → data/*.json
tools/build_meta.py      Sinh data/meta.json, sửa lỗi đánh máy nguồn
sw.js, manifest.webmanifest  Đọc offline, cài đặt như ứng dụng
```

## Chạy thử trên máy

```bash
python3 -m http.server 8000
# mở http://localhost:8000/
```

Sau khi cập nhật dữ liệu điều luật, chạy `python3 tools/build_meta.py` để sinh lại `data/meta.json`.

## Miễn trừ trách nhiệm

Nội dung nhằm mục đích tham khảo, nghiên cứu; không thay thế ý kiến tư vấn pháp lý cho vụ việc cụ thể.
Khi sử dụng trong hồ sơ tố tụng, cần đối chiếu văn bản đăng trên Công báo hoặc văn bản hợp nhất mới nhất.

Công ty Luật TNHH Luật Sư Nam · 0983 498 499 · luatsunam.hcm@gmail.com
