#!/bin/sh
# Kiểm thử toàn bộ trên trình duyệt thật (Playwright): công cụ tuổi, mục lục (hộp thoại, bảng dưới), rà toàn bộ trang.
#   sh tools/test/run.sh        → mã thoát khác 0 nếu có bài không đạt hoặc bị lỗi giữa chừng
cd "$(dirname "$0")/../.." || exit 1
python3 tools/serve.py 8765 >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV' EXIT
sleep 1
fail=0
for t in agetest jumptest reopen crawl; do
  echo "== $t"
  node "tools/test/$t.js" > /tmp/lx-test-$t.log 2>&1 || fail=1
  grep -v '^PASS' /tmp/lx-test-$t.log
  echo "   $(grep -c '^PASS' /tmp/lx-test-$t.log) đạt"
done
[ $fail = 0 ] && echo "TẤT CẢ ĐẠT" || echo "CÓ BÀI KHÔNG ĐẠT"
exit $fail
