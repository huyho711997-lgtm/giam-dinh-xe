// Mẫu công văn cho trang "Công văn AI" (js/features/documents/official-letter-page.js).
// MỖI MẪU = dữ liệu thuần, thêm mẫu mới chỉ cần thêm một phần tử vào mảng này (không cần sửa mã khác):
//   id, name, group, summary        : hiển thị trong danh sách mẫu
//   audience                        : người nhận mặc định (gợi ý ô "Kính gửi")
//   purpose                         : mục đích + yêu cầu nội dung — đưa cho AI khi soạn
//   fields[]                        : thông tin đầu vào. key | label | type (text|textarea|date) | required | hint | max
//                                     record: khoá có thể lấy thẳng từ hồ sơ (ưu tiên hơn AI); setting: lấy từ "Thông tin đơn vị ban hành"
//   outline[]                       : dàn ý các đoạn AI cần viết (theo thứ tự)
//   closing[]                       : đoạn kết cố định, ghép sau phần AI viết; {key} được thay bằng giá trị trường (trống → "……")
//   sample[]  (tuỳ chọn)            : công văn thật đã ban hành, ĐÃ ẨN thông tin cá nhân — đưa cho AI học cấu trúc/giọng văn (không chép dữ kiện)
//   numberKey (tuỳ chọn)            : khoá trường dùng làm "Số:" của công văn (VD số hồ sơ bồi thường)
//   docs[]    (tuỳ chọn)            : TÀI LIỆU CẦN CÓ để AI đọc lấy thông tin (ảnh/PDF người dùng đính kèm theo từng mục).
//                                     key | label | short (nhãn gắn vào tên tệp) | required | hint (hướng dẫn chụp/đính kèm) | read (AI cần đọc gì) | fills[] (khoá trường sẽ điền) | max (số tệp tối đa, mặc định 3)
// Đây là các MẪU KHỞI ĐẦU theo nghiệp vụ giám định/bồi thường; thay bằng mẫu công văn thật của đơn vị khi có.
const OL_DOC = {
  gcnBh: {key: 'gcn_bh', label: 'Giấy chứng nhận bảo hiểm', short: 'GCN bảo hiểm', hint: 'Ảnh/PDF GCN bảo hiểm (trang có số GCN và thời hạn)', read: 'số GCN/hợp đồng bảo hiểm, thời hạn bảo hiểm (từ giờ ngày nào đến giờ ngày nào), chủ xe/người được bảo hiểm, biển số, số khung, số máy', fills: ['certificate', 'policyPeriod', 'insured']},
  dangKy: {key: 'dang_ky', label: 'Giấy đăng ký xe', short: 'Đăng ký xe', hint: 'Ảnh mặt trước giấy đăng ký xe (cà vẹt)', read: 'tên chủ xe, địa chỉ, biển số, nhãn hiệu, số loại, số khung, số máy, ngày đăng ký', fills: ['insured', 'plate']},
  bbGiamDinh: {key: 'bb_giam_dinh', label: 'Biên bản giám định / xác định thiệt hại', short: 'Biên bản giám định', hint: 'Ảnh/PDF biên bản có chữ ký của khách hàng', read: 'số hồ sơ, ngày giám định, địa điểm, nguyên nhân tổn thất, danh mục hạng mục hư hỏng, ý kiến của khách hàng, tên giám định viên', fills: ['claimNo', 'lossDate']},
  anhTonThat: {key: 'anh_ton_that', label: 'Ảnh tổn thất của xe', short: 'Ảnh tổn thất', hint: 'Ảnh tổng thể và cận cảnh các hạng mục hư hỏng', read: 'vị trí và mức độ hư hỏng nhìn thấy, biển số trong ảnh; chỉ mô tả điều thấy rõ', fills: [], max: 4},
  thongBaoTn: {key: 'thong_bao_tn', label: 'Thông báo / yêu cầu bồi thường của khách hàng', short: 'Thông báo tổn thất', hint: 'Ảnh/PDF giấy thông báo tổn thất, giấy yêu cầu bồi thường hoặc tin nhắn của khách', read: 'ngày thông báo, thời điểm và địa điểm xảy ra, diễn biến (chép đúng lời khách), người điều khiển xe, yêu cầu của khách', fills: ['lossDate', 'noticeDate', 'lossTime', 'lossDescription']}
};
const OFFICIAL_LETTER_TEMPLATES = [
  {
    id: 'de_nghi_cung_cap_ho_so', name: 'Đề nghị cơ quan chức năng cung cấp hồ sơ vụ tai nạn', group: 'Gửi cơ quan chức năng', starter: true,
    summary: 'Gửi Công an / CSGT / UBND để xin bản sao biên bản, kết luận điều tra, giấy tờ liên quan vụ tai nạn.',
    audience: 'Công an / Cảnh sát giao thông nơi xảy ra tai nạn',
    purpose: 'Công văn của Bảo hiểm Tasco đề nghị cơ quan chức năng hỗ trợ cung cấp hồ sơ, tài liệu liên quan vụ tai nạn giao thông để xác định nguyên nhân, lỗi của các bên và giải quyết bồi thường đúng quy định. '
      + 'Giọng văn trang trọng, lịch sự, nêu rõ căn cứ (phương tiện được bảo hiểm, giấy chứng nhận bảo hiểm) và danh mục tài liệu đề nghị cung cấp. Chỉ viện dẫn điều luật có trong căn cứ từ thư viện; không có thì không nêu điều luật cụ thể.',
    docs: [
      {...OL_DOC.thongBaoTn, required: true, hint: 'Thông báo tai nạn / giấy tờ về vụ việc — để lấy ngày, địa điểm, các bên liên quan', fills: ['lossDate', 'location', 'parties']},
      {...OL_DOC.dangKy, fills: ['insured', 'plate']},
      OL_DOC.gcnBh
    ],
    fields: [
      { key: 'recipient', label: 'Kính gửi', type: 'textarea', required: true, hint: 'Mỗi cơ quan một dòng', max: 400 },
      { key: 'plate', label: 'Biển số xe', type: 'text', required: true, record: ['bienSo'], max: 60 },
      { key: 'insured', label: 'Chủ xe / người được bảo hiểm', type: 'text', required: true, record: ['khachHang', 'chuXe', 'tenChuXe'], max: 150 },
      { key: 'certificate', label: 'Số GCN bảo hiểm', type: 'text', record: ['soGcn', 'soGCN'], max: 150 },
      { key: 'lossDate', label: 'Ngày xảy ra tai nạn', type: 'text', required: true, record: ['ngayVTT', 'ngayTonThat'], hint: 'VD: 12/11/2026 (có thể kèm giờ)', max: 60 },
      { key: 'location', label: 'Địa điểm xảy ra tai nạn', type: 'text', required: true, record: ['diaDiemVTT', 'diaDiemTonThat'], max: 300 },
      { key: 'parties', label: 'Phương tiện / người liên quan khác', type: 'textarea', hint: 'Nếu có', max: 600 },
      { key: 'docsRequested', label: 'Hồ sơ, tài liệu đề nghị cung cấp', type: 'textarea', required: true, hint: 'Mỗi tài liệu một dòng. Để trống nếu muốn AI đề xuất danh mục thông dụng', max: 900 },
      { key: 'contactPerson', label: 'Cán bộ liên hệ', type: 'text', required: true, setting: 'contactPerson', max: 120 },
      { key: 'phone', label: 'Số điện thoại liên hệ', type: 'text', required: true, setting: 'phone', max: 60 },
      { key: 'address', label: 'Địa chỉ nhận hồ sơ', type: 'textarea', setting: 'address', max: 300 }
    ],
    outline: [
      'Đoạn mở: cảm ơn sự hợp tác của cơ quan nhận.',
      'Đoạn sự việc: tóm tắt vụ tai nạn (ngày, địa điểm, phương tiện, chủ xe, số GCN bảo hiểm) chỉ bằng thông tin đã cung cấp.',
      'Đoạn đề nghị: nêu mục đích và danh mục hồ sơ/tài liệu đề nghị cung cấp (trình bày từng ý).'
    ],
    closing: ['Rất mong sớm nhận được sự phúc đáp của Quý cơ quan. Mọi thông tin xin liên hệ: {contactPerson}, điện thoại {phone}; địa chỉ nhận hồ sơ: {address}.', 'Trân trọng cảm ơn!']
  },
  {
    id: 'thong_bao_bo_sung_ho_so', name: 'Thông báo khách hàng bổ sung hồ sơ bồi thường', group: 'Gửi khách hàng', starter: true,
    summary: 'Đề nghị khách hàng bổ sung giấy tờ còn thiếu để Bảo hiểm Tasco giải quyết bồi thường.',
    audience: 'Khách hàng / chủ xe',
    purpose: 'Công văn thông báo cho khách hàng về hồ sơ bồi thường đã tiếp nhận và đề nghị bổ sung các giấy tờ còn thiếu trong thời hạn nêu rõ để Bảo hiểm Tasco có cơ sở giải quyết. '
      + 'Giọng văn lịch sự, rõ ràng, dễ hiểu; liệt kê từng giấy tờ cần bổ sung; không kết luận về trách nhiệm bồi thường và không nêu số tiền.',
    docs: [
      {key: 'ho_so_da_nop', label: 'Hồ sơ khách đã nộp', short: 'Hồ sơ đã nộp', required: true, hint: 'Ảnh/PDF các giấy tờ khách đã nộp (có thể nhiều tệp)', read: 'liệt kê từng giấy tờ đã có và đọc được; đối chiếu bộ hồ sơ yêu cầu bồi thường xe cơ giới (GCN bảo hiểm, giấy đăng ký xe, GPLX, GCN kiểm định, thông báo/biên bản tai nạn, hoá đơn sửa chữa, giấy tờ chủ xe…) để chỉ ra giấy nào còn THIẾU hoặc mờ/không hợp lệ', fills: ['missingDocs'], max: 4},
      {...OL_DOC.thongBaoTn, fills: ['lossDate', 'claimNo']},
      OL_DOC.bbGiamDinh
    ],
    fields: [
      { key: 'recipient', label: 'Kính gửi (khách hàng)', type: 'text', required: true, record: ['khachHang', 'chuXe', 'tenChuXe'], max: 200 },
      { key: 'claimNo', label: 'Số hồ sơ bồi thường', type: 'text', record: ['soHoSoBoiThuong', 'soHSBT', 'soHoSo'], max: 100 },
      { key: 'plate', label: 'Biển số xe', type: 'text', required: true, record: ['bienSo'], max: 60 },
      { key: 'lossDate', label: 'Ngày xảy ra tổn thất', type: 'text', record: ['ngayVTT', 'ngayTonThat'], max: 60 },
      { key: 'missingDocs', label: 'Giấy tờ cần bổ sung', type: 'textarea', required: true, hint: 'Mỗi giấy tờ một dòng', max: 900 },
      { key: 'deadline', label: 'Hạn bổ sung', type: 'text', hint: 'VD: trong vòng 07 ngày kể từ ngày nhận công văn / trước 30/11/2026', max: 150 },
      { key: 'submitTo', label: 'Cách thức / nơi nộp', type: 'textarea', setting: 'address', hint: 'Địa chỉ, email hoặc kênh nhận hồ sơ', max: 300 },
      { key: 'contactPerson', label: 'Cán bộ liên hệ', type: 'text', required: true, setting: 'contactPerson', max: 120 },
      { key: 'phone', label: 'Số điện thoại liên hệ', type: 'text', required: true, setting: 'phone', max: 60 }
    ],
    outline: [
      'Đoạn mở: cảm ơn khách hàng đã lựa chọn dịch vụ và đã gửi hồ sơ bồi thường (số hồ sơ, biển số, ngày tổn thất nếu có).',
      'Đoạn đề nghị: để có cơ sở giải quyết, đề nghị khách hàng bổ sung các giấy tờ sau (liệt kê từng giấy tờ).',
      'Đoạn thời hạn: nêu hạn bổ sung và cách thức nộp; nếu chưa có hạn thì nói bổ sung sớm nhất có thể.'
    ],
    closing: ['Mọi thắc mắc xin liên hệ {contactPerson}, điện thoại {phone}.', 'Trân trọng cảm ơn!']
  },
  {
    id: 'de_nghi_gara_cung_cap', name: 'Đề nghị gara cung cấp báo giá / hồ sơ sửa chữa', group: 'Gửi gara / đơn vị sửa chữa', starter: true,
    summary: 'Yêu cầu gara gửi báo giá chi tiết, hình ảnh, hóa đơn, hồ sơ sửa chữa để giám định và bồi thường.',
    audience: 'Gara / xưởng dịch vụ sửa chữa',
    purpose: 'Công văn đề nghị gara/đơn vị sửa chữa cung cấp báo giá chi tiết, hình ảnh trước – trong – sau sửa chữa, hóa đơn chứng từ và các hồ sơ liên quan đến xe đang giải quyết bồi thường. '
      + 'Giọng văn trao đổi nghiệp vụ, rõ ràng, đề nghị cụ thể; không cam kết mức bồi thường.',
    docs: [
      {...OL_DOC.bbGiamDinh, required: true, fills: ['claimNo', 'lossDate', 'plate', 'requestDocs']},
      OL_DOC.anhTonThat,
      {key: 'bao_gia', label: 'Báo giá / hồ sơ sửa chữa gara đã gửi', short: 'Báo giá gara', hint: 'Nếu gara đã gửi báo giá hoặc dự toán', read: 'số báo giá, ngày, hạng mục sửa chữa/thay thế, đơn giá, tổng tiền; hạng mục nào còn thiếu hoặc chưa rõ', fills: ['requestDocs']}
    ],
    fields: [
      { key: 'recipient', label: 'Kính gửi (gara)', type: 'text', required: true, record: ['garaSuaChua', 'tenGara', 'gara'], max: 200 },
      { key: 'plate', label: 'Biển số xe', type: 'text', required: true, record: ['bienSo'], max: 60 },
      { key: 'insured', label: 'Chủ xe', type: 'text', record: ['khachHang', 'chuXe', 'tenChuXe'], max: 150 },
      { key: 'claimNo', label: 'Số hồ sơ bồi thường', type: 'text', record: ['soHoSoBoiThuong', 'soHSBT', 'soHoSo'], max: 100 },
      { key: 'lossDate', label: 'Ngày xảy ra tổn thất', type: 'text', record: ['ngayVTT', 'ngayTonThat'], max: 60 },
      { key: 'requestDocs', label: 'Nội dung đề nghị', type: 'textarea', required: true, hint: 'VD: báo giá chi tiết phụ tùng/nhân công; ảnh trước – sau sửa chữa; hóa đơn', max: 900 },
      { key: 'deadline', label: 'Hạn gửi', type: 'text', max: 150 },
      { key: 'contactPerson', label: 'Cán bộ liên hệ', type: 'text', required: true, setting: 'contactPerson', max: 120 },
      { key: 'phone', label: 'Số điện thoại liên hệ', type: 'text', required: true, setting: 'phone', max: 60 }
    ],
    outline: [
      'Đoạn mở: Bảo hiểm Tasco đang giải quyết hồ sơ bồi thường cho xe (biển số, chủ xe, số hồ sơ, ngày tổn thất) đang sửa chữa tại gara.',
      'Đoạn đề nghị: đề nghị gara cung cấp các nội dung sau (liệt kê từng ý).',
      'Đoạn thời hạn và đầu mối liên hệ.'
    ],
    closing: ['Rất mong nhận được sự phối hợp của Quý gara. Mọi thông tin xin liên hệ {contactPerson}, điện thoại {phone}.', 'Trân trọng cảm ơn!']
  },
  {
    id: 'thong_bao_ket_qua_giam_dinh', name: 'Thông báo kết quả giám định / giải quyết bồi thường', group: 'Gửi khách hàng', starter: true,
    summary: 'Thông báo cho khách hàng kết quả giám định và hướng giải quyết (chỉ dùng thông tin bạn cung cấp).',
    audience: 'Khách hàng / chủ xe',
    purpose: 'Công văn thông báo cho khách hàng kết quả giám định và hướng giải quyết hồ sơ bồi thường. Chỉ trình bày đúng nội dung kết quả do người dùng cung cấp; TUYỆT ĐỐI không tự đặt số tiền, tỷ lệ hay kết luận trách nhiệm; điều khoản chỉ dẫn từ căn cứ thư viện được cung cấp. '
      + 'Giọng văn lịch sự, rõ ràng, đồng cảm với khách hàng.',
    docs: [
      {...OL_DOC.bbGiamDinh, required: true, fills: ['claimNo', 'lossDate', 'plate', 'result']},
      {key: 'bang_tinh', label: 'Bảng tính / đề xuất bồi thường', short: 'Bảng tính bồi thường', required: true, hint: 'Ảnh/PDF bảng tính hoặc phiếu duyệt bồi thường', read: 'tổng thiệt hại, mức khấu trừ, các khoản giảm trừ (lý do, tỷ lệ), số tiền bồi thường được duyệt, số hồ sơ', fills: ['result']},
      OL_DOC.gcnBh,
      OL_DOC.anhTonThat
    ],
    fields: [
      { key: 'recipient', label: 'Kính gửi (khách hàng)', type: 'text', required: true, record: ['khachHang', 'chuXe', 'tenChuXe'], max: 200 },
      { key: 'claimNo', label: 'Số hồ sơ bồi thường', type: 'text', required: true, record: ['soHoSoBoiThuong', 'soHSBT', 'soHoSo'], max: 100 },
      { key: 'plate', label: 'Biển số xe', type: 'text', required: true, record: ['bienSo'], max: 60 },
      { key: 'lossDate', label: 'Ngày xảy ra tổn thất', type: 'text', record: ['ngayVTT', 'ngayTonThat'], max: 60 },
      { key: 'result', label: 'Kết quả giám định / hướng giải quyết', type: 'textarea', required: true, hint: 'Ghi đúng nội dung cần thông báo (nguyên nhân, hạng mục, mức/phương án nếu đã chốt)', max: 1200 },
      { key: 'nextSteps', label: 'Việc khách hàng cần làm tiếp', type: 'textarea', hint: 'Nếu có', max: 600 },
      { key: 'contactPerson', label: 'Cán bộ liên hệ', type: 'text', required: true, setting: 'contactPerson', max: 120 },
      { key: 'phone', label: 'Số điện thoại liên hệ', type: 'text', required: true, setting: 'phone', max: 60 }
    ],
    outline: [
      'Đoạn mở: cảm ơn khách hàng, nêu hồ sơ (số hồ sơ, biển số, ngày tổn thất).',
      'Đoạn kết quả: trình bày kết quả giám định/hướng giải quyết đúng như người dùng cung cấp.',
      'Đoạn tiếp theo: việc khách hàng cần làm (nếu có) và đầu mối hỗ trợ.'
    ],
    closing: ['Mọi thắc mắc xin liên hệ {contactPerson}, điện thoại {phone}.', 'Trân trọng cảm ơn Quý khách!']
  },
  {
    id: 'giai_trinh_tra_loi', name: 'Công văn giải trình / trả lời văn bản', group: 'Giải trình – phúc đáp', starter: true,
    summary: 'Trả lời hoặc giải trình theo công văn, yêu cầu của cơ quan / đơn vị khác.',
    audience: 'Cơ quan / đơn vị đã gửi văn bản',
    purpose: 'Công văn phúc đáp, giải trình theo văn bản của cơ quan/đơn vị nhận. Trả lời từng ý được yêu cầu, bám đúng căn cứ do người dùng cung cấp, không bịa số liệu, ngày tháng; điều luật chỉ dẫn từ căn cứ thư viện được cung cấp. Giọng văn trang trọng, khách quan.',
    docs: [
      {key: 'van_ban_hoi', label: 'Văn bản cần trả lời', short: 'Văn bản cần trả lời', required: true, hint: 'Ảnh/PDF văn bản khiếu nại, yêu cầu hoặc câu hỏi cần giải trình', read: 'cơ quan/người gửi, số và ngày văn bản, từng nội dung hỏi/khiếu nại/yêu cầu (đánh số theo thứ tự trong văn bản), thời hạn trả lời nếu có', fills: ['refDocument', 'points', 'recipient'], max: 4},
      OL_DOC.bbGiamDinh,
      OL_DOC.gcnBh
    ],
    fields: [
      { key: 'recipient', label: 'Kính gửi', type: 'textarea', required: true, hint: 'Mỗi nơi một dòng', max: 400 },
      { key: 'refDocument', label: 'Văn bản được trả lời', type: 'text', required: true, hint: 'VD: Công văn số 123/… ngày … của …', max: 300 },
      { key: 'claimNo', label: 'Số hồ sơ bồi thường', type: 'text', record: ['soHoSoBoiThuong', 'soHSBT', 'soHoSo'], max: 100 },
      { key: 'plate', label: 'Biển số xe', type: 'text', record: ['bienSo'], max: 60 },
      { key: 'points', label: 'Các nội dung cần giải trình / trả lời', type: 'textarea', required: true, hint: 'Mỗi ý một dòng, kèm căn cứ nếu có', max: 1500 },
      { key: 'contactPerson', label: 'Cán bộ liên hệ', type: 'text', setting: 'contactPerson', max: 120 },
      { key: 'phone', label: 'Số điện thoại liên hệ', type: 'text', setting: 'phone', max: 60 }
    ],
    outline: [
      'Đoạn mở: Bảo hiểm Tasco đã nhận được văn bản (số, ngày, cơ quan gửi) về nội dung gì.',
      'Các đoạn nội dung: trả lời/giải trình lần lượt từng ý, đánh số 1., 2., 3.',
      'Đoạn kiến nghị/đề xuất (nếu người dùng nêu).'
    ],
    closing: ['Bảo hiểm Tasco xin thông tin để Quý cơ quan được biết. Mọi thông tin xin liên hệ {contactPerson}, điện thoại {phone}.', 'Trân trọng!']
  },
  {
    id: 'tu_choi_thong_so_lop', name: 'Từ chối bồi thường – sai thông số lốp', group: 'Từ chối bồi thường',
    docTitle: 'THÔNG BÁO KẾT QUẢ GIẢI QUYẾT BỒI THƯỜNG',
    summary: 'Thông báo từ chối khi xe lắp lốp có thông số khác GCN kiểm định / tem nhà sản xuất (điểm loại trừ chung, Quy tắc bảo hiểm xe cơ giới).',
    audience: 'Chủ xe / khách hàng',
    purpose: 'Công văn của Bảo hiểm Tasco THÔNG BÁO KẾT QUẢ GIẢI QUYẾT BỒI THƯỜNG theo hướng TỪ CHỐI vì tại thời điểm tổn thất xe đang lắp lốp có thông số khác với thông số tiêu chuẩn '
      + '(ghi trên Giấy chứng nhận kiểm định an toàn kỹ thuật và bảo vệ môi trường, tem thông số của nhà sản xuất), làm thay đổi chiều cao hông/kết cấu lốp so với thiết kế — thuộc điểm loại trừ chung của Quy tắc bảo hiểm. '
      + 'Giọng văn lịch sự, khách quan, tiếc nuối nhưng rõ ràng; không quy kết lỗi cá nhân, không hứa hẹn bồi thường. Viết nguyên dạng các thông số (VD 195/60R16), số giấy tờ, ngày giờ như dữ liệu đã có. '
      + 'Thông số lốp ĐANG LẮP chỉ nêu khi người dùng/hồ sơ đã cung cấp (đọc từ ảnh giám định); chưa có thì để "……", không đoán. '
      + 'Phần trích điều khoản loại trừ chỉ dùng nguyên văn do trường "Nguyên văn điều khoản loại trừ" hoặc CĂN CỨ TỪ THƯ VIỆN cung cấp; không có thì viết chung "theo quy định của Quy tắc bảo hiểm" và ghi vào warnings. '
      + 'Hãy bám cấu trúc của CÔNG VĂN MẪU THAM KHẢO nhưng chỉ dùng dữ kiện của vụ việc này.',
    numberKey: 'claimNo',
    docs: [
      {key: 'dang_kiem', label: 'Giấy chứng nhận kiểm định (đăng kiểm)', short: 'Đăng kiểm', required: true, hint: 'Ảnh/PDF GCN kiểm định an toàn kỹ thuật & bảo vệ môi trường — trang có thông số lốp', read: 'số GCN kiểm định (VD VA-1769601), số tem, ngày cấp và hiệu lực, biển số, số khung, số máy, nhãn hiệu/số loại, THÔNG SỐ LỐP tiêu chuẩn (chép đúng từng ký tự, VD 255/65R18), đơn vị kiểm định', fills: ['inspectionNo', 'standardTyre']},
      {key: 'anh_lop', label: 'Ảnh thông số lốp xe lúc giám định', short: 'Ảnh lốp giám định', required: true, hint: 'Chụp cận hông lốp đang lắp, thấy rõ chữ (VD 275/65R18); mỗi lốp lệch một ảnh', read: 'dãy thông số in trên hông lốp (bề rộng/tỷ lệ/đường kính, chỉ số tải, tốc độ), nhãn hiệu lốp, DOT/tuần sản xuất nếu thấy, vị trí lốp (trước/sau, trái/phải) nếu có trong ảnh, biển số xe trong ảnh', fills: ['fittedTyre', 'evidence'], max: 4},
      {key: 'tem_cua', label: 'Ảnh tem thông số dán trên cánh cửa', short: 'Tem trên cửa', required: true, hint: 'Tem thông số dán khung/cánh cửa người lái (kích thước lốp, áp suất)', read: 'kích thước lốp tiêu chuẩn của nhà sản xuất (cả lốp trước và sau), áp suất lốp khuyến cáo, tải trọng, ngày/tháng sản xuất của xe, nhãn hiệu', fills: ['standardTyre', 'evidence']},
      {...OL_DOC.gcnBh, fills: ['certificate', 'policyPeriod']},
      {...OL_DOC.thongBaoTn, fills: ['noticeDate', 'lossTime', 'lossDescription', 'driver']}
    ],
    fields: [
      { key: 'recipient', label: 'Kính gửi (khách hàng)', type: 'text', required: true, record: ['khachHang', 'chuXe', 'tenChuXe'], hint: 'VD: Ông NGUYỄN VĂN A – Chủ xe ô tô mang BKS 47A-123.45', max: 250 },
      { key: 'claimNo', label: 'Số hồ sơ bồi thường (làm số công văn)', type: 'text', required: true, record: ['soHoSoBoiThuong', 'soHSBT', 'soHoSo'], hint: 'VD: HSBT/XCG/2026/0105661', max: 100 },
      { key: 'plate', label: 'Biển số xe', type: 'text', required: true, record: ['bienSo'], max: 60 },
      { key: 'driver', label: 'Người điều khiển xe lúc tổn thất', type: 'text', record: ['laiXe'], max: 150 },
      { key: 'noticeDate', label: 'Ngày nhận thông báo tổn thất', type: 'text', record: ['ngayThongBao'], hint: 'VD: 11/11/2026', max: 60 },
      { key: 'lossTime', label: 'Thời điểm xảy ra tổn thất', type: 'text', required: true, record: ['ngayVTT', 'ngayTonThat'], hint: 'VD: 19h00 ngày 10/11/2026', max: 80 },
      { key: 'certificate', label: 'Số hợp đồng bảo hiểm / GCNBH', type: 'text', record: ['soGcn', 'soGCN', 'soHd'], max: 150 },
      { key: 'policyPeriod', label: 'Thời hạn bảo hiểm', type: 'text', hint: 'VD: từ 10:30:37 ngày 31/03/2026 đến 10:30:37 ngày 31/03/2027', max: 200 },
      { key: 'lossDescription', label: 'Diễn biến tổn thất theo thông báo của khách hàng', type: 'textarea', record: ['dienBienTonThat', 'moTaTonThat'], max: 900 },
      { key: 'inspectionNo', label: 'Số GCN kiểm định an toàn kỹ thuật & bảo vệ môi trường', type: 'text', hint: 'VD: VA-1769601', max: 80 },
      { key: 'standardTyre', label: 'Thông số lốp tiêu chuẩn của xe', type: 'text', required: true, hint: 'Theo GCN kiểm định / tem nhà sản xuất. VD: 195/60R16', max: 60 },
      { key: 'fittedTyre', label: 'Thông số lốp đang lắp lúc tổn thất', type: 'text', required: true, hint: 'Đọc trên hông lốp ở ảnh giám định. VD: 205/55R16', max: 60 },
      { key: 'evidence', label: 'Căn cứ xác định thông số lốp', type: 'textarea', hint: 'Mỗi ý một dòng. VD: ảnh giám định chi tiết; tem thông số nhà sản xuất dán trên xe; kiểm tra thực tế phương tiện', max: 500 },
      { key: 'ruleQuote', label: 'Nguyên văn điều khoản loại trừ', type: 'textarea', hint: 'Dán nguyên văn kèm tên văn bản, số điều/mục. Để trống nếu muốn lấy từ Thư viện tài liệu', max: 1500 },
      { key: 'phone', label: 'Số điện thoại tiếp nhận (hiện ở cuối công văn)', type: 'text', setting: 'phone', max: 60 },
      { key: 'address', label: 'Địa chỉ nhận văn bản khiếu nại', type: 'textarea', setting: 'address', max: 300 }
    ],
    outline: [
      'Đoạn mở: vào việc ngay bằng một hai câu nêu Bảo hiểm Tasco đang phản hồi yêu cầu bồi thường nào (xe, biển số, ngày thông báo); không dùng câu chào dập khuôn.',
      'Đoạn tiếp nhận: ngày nhận thông báo tổn thất; xe, biển số, thời điểm tổn thất; số hợp đồng/GCNBH và thời hạn hiệu lực.',
      'Đoạn diễn biến: nguyên văn/tóm lược diễn biến, nguyên nhân tổn thất theo thông báo của khách hàng (đặt trong ngoặc kép); nêu Biên bản xác định thiệt hại đã được khách hàng phối hợp với giám định viên xác nhận.',
      'Đoạn phát hiện: qua hình ảnh giám định, xe đang lắp lốp thông số nào, trong khi thông số trên GCN kiểm định (nêu số) là gì.',
      'Đoạn ghi nhận (liệt kê "li"): thông số lốp tiêu chuẩn theo GCN kiểm định; tem thông số kỹ thuật của nhà sản xuất trên xe; lốp đang lắp làm thay đổi chiều cao hông/kết cấu lốp so với thiết kế tiêu chuẩn.',
      'Đoạn căn cứ: nêu đúng mục/điều và tên văn bản chứa điểm loại trừ; trích nguyên văn giữa "Trích" và "Kết thúc trích" (kể cả ngoại lệ về thay đổi thông số lốp phù hợp khuyến cáo nhà sản xuất) — chỉ khi có nguyên văn được cung cấp.',
      'Đoạn kết luận: việc dùng lốp khác kích thước tiêu chuẩn không phù hợp thông số nhà sản xuất nên thuộc trường hợp loại trừ; Bảo hiểm Tasco rất tiếc không có cơ sở bồi thường và thông báo để khách hàng được biết, chủ động sửa chữa khắc phục tổn thất.'
    ],
    sample: [
      'Lời đầu tiên, Công ty TNHH Bảo hiểm TASCO (Bảo hiểm Tasco) xin gửi tới Quý khách hàng lời chào trân trọng.',
      'Ngày [ngày nhận], Bảo hiểm Tasco nhận được thông báo tổn thất của Quý khách hàng đối với xe ô tô mang biển kiểm soát [BKS], tổn thất được thông báo xảy ra vào lúc [giờ] ngày [ngày], thuộc Hợp đồng bảo hiểm/GCNBH số [số], có hiệu lực từ [thời điểm] đến [thời điểm].',
      'Theo thông báo tai nạn và yêu cầu bồi thường của Quý khách hàng, diễn biến và nguyên nhân tổn thất như sau:',
      '“[Diễn biến tổn thất nguyên văn theo thông báo của khách hàng].”',
      'Căn cứ Biên bản xác định thiệt hại của xe ô tô mang BKS [BKS] trong vụ việc nêu trên đã được Quý khách hàng phối hợp với giám định viên của Bảo hiểm Tasco xác nhận.',
      'Căn cứ các hình ảnh giám định chi tiết đối với phương tiện liên quan tới thời điểm xảy ra sự cố, xe [BKS] đang sử dụng lốp có thông số [lốp đang lắp], trong khi thông số lốp ghi nhận trên Giấy chứng nhận kiểm định an toàn kỹ thuật và bảo vệ môi trường số [số GCN kiểm định] của phương tiện là [lốp tiêu chuẩn].',
      'Qua kiểm tra thực tế phương tiện, đối chiếu hồ sơ kỹ thuật của nhà sản xuất và thông số kỹ thuật ghi nhận trên phương tiện, Bảo hiểm Tasco ghi nhận:',
      '- Thông số lốp tiêu chuẩn của xe theo Giấy chứng nhận kiểm định số [số] là [lốp tiêu chuẩn].',
      '- Tem thông số kỹ thuật của nhà sản xuất dán trên phương tiện cũng thể hiện kích thước lốp tiêu chuẩn [lốp tiêu chuẩn].',
      '- Tại thời điểm xảy ra tổn thất, xe đang lắp đặt lốp [lốp đang lắp], làm thay đổi chiều cao hông/kết cấu lốp so với thiết kế tiêu chuẩn của nhà sản xuất.',
      'Căn cứ [mục/điều] trên [tên Quy tắc bảo hiểm, số quyết định, ngày ban hành], quy định:',
      'Trích',
      '“[Nguyên văn điều khoản loại trừ và ngoại lệ (nếu có)].”',
      'Kết thúc trích',
      'Đối chiếu các căn cứ nêu trên, việc xe [BKS] sử dụng lốp [lốp đang lắp] thay cho kích thước tiêu chuẩn [lốp tiêu chuẩn] là không phù hợp với thông số kỹ thuật của nhà sản xuất, do đó thuộc trường hợp loại trừ trách nhiệm bảo hiểm theo quy định của Quy tắc bảo hiểm.',
      'Vì vậy, Bảo hiểm Tasco rất tiếc không có cơ sở để xem xét bồi thường đối với tổn thất của xe ô tô mang BKS [BKS] trong vụ việc nêu trên. Bảo hiểm Tasco trân trọng thông báo tới Quý Khách được biết và chủ động sửa chữa khắc phục tổn thất xe trên.'
    ],
    closing: [
      'Chúng tôi xin trân trọng cảm ơn sự hợp tác của Quý khách hàng trong thời gian qua và mong muốn tiếp tục đồng hành cùng Quý Khách trong thời gian tới.',
      'Mọi góp ý/thắc mắc/khiếu nại vui lòng liên hệ giám định viên của chúng tôi để được giải đáp hoặc gửi văn bản cho chúng tôi theo địa chỉ:',
      'Công ty TNHH Bảo Hiểm Tasco – Điện thoại: {phone}',
      'Địa chỉ: {address}',
      'Trân trọng kính chào!'
    ]
  },
  {
    id: 'tu_do', name: 'Công văn tự do (theo ý chính)', group: 'Khác', starter: true,
    summary: 'Chỉ cần gõ ý chính, AI viết thành công văn hoàn chỉnh theo thể thức hành chính.',
    audience: 'Tuỳ chọn',
    purpose: 'Công văn hành chính của Bảo hiểm Tasco soạn theo ý chính người dùng cung cấp. Xác định rõ mục đích văn bản, nêu căn cứ/sự việc, nội dung đề nghị hoặc thông báo, thời hạn (nếu có). Không bịa thông tin ngoài dữ liệu được cung cấp.',
    fields: [
      { key: 'recipient', label: 'Kính gửi', type: 'textarea', required: true, hint: 'Mỗi nơi một dòng', max: 400 },
      { key: 'topic', label: 'Vấn đề / trích yếu gợi ý', type: 'text', required: true, max: 250 },
      { key: 'mainPoints', label: 'Ý chính cần đưa vào công văn', type: 'textarea', required: true, hint: 'Gõ ngắn gọn, mỗi ý một dòng', max: 2000 },
      { key: 'claimNo', label: 'Số hồ sơ bồi thường', type: 'text', record: ['soHoSoBoiThuong', 'soHSBT', 'soHoSo'], max: 100 },
      { key: 'plate', label: 'Biển số xe', type: 'text', record: ['bienSo'], max: 60 },
      { key: 'contactPerson', label: 'Cán bộ liên hệ', type: 'text', setting: 'contactPerson', max: 120 },
      { key: 'phone', label: 'Số điện thoại liên hệ', type: 'text', setting: 'phone', max: 60 }
    ],
    outline: [
      'Đoạn mở: nêu lý do ban hành công văn.',
      'Các đoạn nội dung theo ý chính, mạch lạc, có thể đánh số.',
      'Đoạn đề nghị/thông báo cuối cùng và thời hạn (nếu có).'
    ],
    closing: ['Mọi thông tin xin liên hệ {contactPerson}, điện thoại {phone}.', 'Trân trọng!']
  }
];
