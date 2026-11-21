// Mẫu công văn cho trang "Công văn AI" (js/features/documents/official-letter-page.js).
// MỖI MẪU = dữ liệu thuần, thêm mẫu mới chỉ cần thêm một phần tử vào mảng này (không cần sửa mã khác):
//   id, name, group, summary        : hiển thị trong danh sách mẫu
//   audience                        : người nhận mặc định (gợi ý ô "Kính gửi")
//   purpose                         : mục đích + yêu cầu nội dung — đưa cho AI khi soạn
//   fields[]                        : thông tin đầu vào. key | label | type (text|textarea|date) | required | hint | max
//                                     record: khoá có thể lấy thẳng từ hồ sơ (ưu tiên hơn AI); setting: lấy từ "Thông tin đơn vị ban hành"
//   outline[]                       : dàn ý các đoạn AI cần viết (theo thứ tự)
//   closing[]                       : đoạn kết cố định, ghép sau phần AI viết; {key} được thay bằng giá trị trường (trống → "……")
// Đây là các MẪU KHỞI ĐẦU theo nghiệp vụ giám định/bồi thường; thay bằng mẫu công văn thật của đơn vị khi có.
const OFFICIAL_LETTER_TEMPLATES = [
  {
    id: 'de_nghi_cung_cap_ho_so', name: 'Đề nghị cơ quan chức năng cung cấp hồ sơ vụ tai nạn', group: 'Gửi cơ quan chức năng', starter: true,
    summary: 'Gửi Công an / CSGT / UBND để xin bản sao biên bản, kết luận điều tra, giấy tờ liên quan vụ tai nạn.',
    audience: 'Công an / Cảnh sát giao thông nơi xảy ra tai nạn',
    purpose: 'Công văn của Bảo hiểm Tasco đề nghị cơ quan chức năng hỗ trợ cung cấp hồ sơ, tài liệu liên quan vụ tai nạn giao thông để xác định nguyên nhân, lỗi của các bên và giải quyết bồi thường đúng quy định. '
      + 'Giọng văn trang trọng, lịch sự, nêu rõ căn cứ (phương tiện được bảo hiểm, giấy chứng nhận bảo hiểm) và danh mục tài liệu đề nghị cung cấp. Không viết điều luật cụ thể nếu không được cung cấp.',
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
    purpose: 'Công văn thông báo cho khách hàng kết quả giám định và hướng giải quyết hồ sơ bồi thường. Chỉ trình bày đúng nội dung kết quả do người dùng cung cấp; TUYỆT ĐỐI không tự đặt số tiền, tỷ lệ, điều khoản hay kết luận trách nhiệm. '
      + 'Giọng văn lịch sự, rõ ràng, đồng cảm với khách hàng.',
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
    purpose: 'Công văn phúc đáp, giải trình theo văn bản của cơ quan/đơn vị nhận. Trả lời từng ý được yêu cầu, bám đúng căn cứ do người dùng cung cấp, không bịa số liệu, ngày tháng hay điều luật. Giọng văn trang trọng, khách quan.',
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
