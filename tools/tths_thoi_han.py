# -*- coding: utf-8 -*-
"""
Bảng thời hạn tố tụng chính (công cụ "Thời hạn tố tụng" của mục Bộ luật Tố tụng hình sự).

Mỗi dòng: (giai đoạn, việc, thời hạn tóm tắt, điều, khoản, câu trích NGUYÊN VĂN).
tools/build_tths.py đối chiếu từng câu trích với văn bản hiện hành của điều (gồm cả nội dung sửa đổi):
câu trích không có trong văn bản → dừng, không sinh trang. Nhờ vậy bảng không thể lệch khỏi luật.
"""
ROWS = [
    ("Giữ người, tạm giữ", "Ra quyết định tạm giữ hoặc trả tự do sau khi giữ người trong trường hợp khẩn cấp, nhận người bị bắt",
     "12 giờ", "110", "4",
     "Trong thời hạn 12 giờ kể từ khi giữ người trong trường hợp khẩn cấp hoặc nhận người bị giữ trong trường hợp khẩn cấp"),
    ("Giữ người, tạm giữ", "Thời hạn tạm giữ", "Không quá 03 ngày", "118", "1",
     "Thời hạn tạm giữ không quá 03 ngày"),
    ("Giữ người, tạm giữ", "Gia hạn tạm giữ (tối đa 2 lần)", "Mỗi lần không quá 03 ngày", "118", "2",
     "người ra quyết định tạm giữ có thể gia hạn tạm giữ nhưng không quá 03 ngày"),
    ("Giải quyết nguồn tin", "Giải quyết tố giác, tin báo về tội phạm, kiến nghị khởi tố", "20 ngày", "147", "1",
     "Trong thời hạn 20 ngày kể từ ngày nhận được tố giác, tin báo về tội phạm, kiến nghị khởi tố"),
    ("Giải quyết nguồn tin", "Kéo dài thời hạn giải quyết (vụ việc phức tạp)", "Không quá 02 tháng", "147", "2",
     "thời hạn giải quyết tố giác, tin báo, kiến nghị khởi tố có thể kéo dài nhưng không quá 02 tháng"),
    ("Điều tra", "Thời hạn điều tra vụ án hình sự", "02 / 03 / 04 tháng theo loại tội", "172", "1",
     "Thời hạn điều tra vụ án hình sự không quá 02 tháng đối với tội phạm ít nghiêm trọng, không quá 03 tháng đối với tội phạm nghiêm trọng, không quá 04 tháng đối với tội phạm rất nghiêm trọng và tội phạm đặc biệt nghiêm trọng"),
    ("Điều tra", "Thời hạn tạm giam để điều tra", "02 / 03 / 04 tháng theo loại tội", "173", "1",
     "Thời hạn tạm giam bị can để điều tra không quá 02 tháng đối với tội phạm ít nghiêm trọng, không quá 03 tháng đối với tội phạm nghiêm trọng, không quá 04 tháng đối với tội phạm rất nghiêm trọng và tội phạm đặc biệt nghiêm trọng"),
    ("Truy tố", "Quyết định việc truy tố", "20 ngày / 30 ngày theo loại tội", "240", "1",
     "Trong thời hạn 20 ngày đối với tội phạm ít nghiêm trọng và tội phạm nghiêm trọng, 30 ngày đối với tội phạm rất nghiêm trọng và tội phạm đặc biệt nghiêm trọng"),
    ("Xét xử sơ thẩm", "Chuẩn bị xét xử sơ thẩm", "30 ngày / 45 ngày / 02 tháng / 03 tháng theo loại tội", "277", "1",
     "30 ngày đối với tội phạm ít nghiêm trọng, 45 ngày đối với tội phạm nghiêm trọng, 02 tháng đối với tội phạm rất nghiêm trọng, 03 tháng đối với tội phạm đặc biệt nghiêm trọng"),
    ("Phúc thẩm", "Kháng cáo bản án sơ thẩm", "15 ngày kể từ ngày tuyên án", "333", "1",
     "Thời hạn kháng cáo đối với bản án sơ thẩm là 15 ngày kể từ ngày tuyên án"),
    ("Phúc thẩm", "Kháng nghị bản án sơ thẩm", "15 ngày (VKS cùng cấp), 30 ngày (VKS cấp trên trực tiếp) kể từ ngày tuyên án", "337", "1",
     "Thời hạn kháng nghị của Viện kiểm sát cùng cấp đối với bản án của Tòa án cấp sơ thẩm là 15 ngày, của Viện kiểm sát cấp trên trực tiếp là 30 ngày kể từ ngày Tòa án tuyên án"),
    ("Giám đốc thẩm, tái thẩm", "Kháng nghị giám đốc thẩm theo hướng không có lợi cho người bị kết án", "01 năm kể từ ngày bản án, quyết định có hiệu lực pháp luật", "379", "1",
     "Việc kháng nghị theo hướng không có lợi cho người bị kết án chỉ được tiến hành trong thời hạn 01 năm kể từ ngày bản án, quyết định có hiệu lực pháp luật"),
    ("Khiếu nại", "Thời hiệu khiếu nại quyết định, hành vi tố tụng", "15 ngày", "471", "1",
     "Thời hiệu khiếu nại là 15 ngày kể từ ngày người khiếu nại nhận được hoặc biết được quyết định, hành vi tố tụng"),
]
