// Trích từ Quy tắc bảo hiểm tự nguyện xe cơ giới — Công ty TNHH Bảo hiểm Tasco
// (ban hành kèm Quyết định số 08/2025/QĐ-BH Tasco ngày 06/01/2025).
// Điều 14 (bảo hiểm vật chất xe) và Điều 24 (bảo hiểm TNDS đối với hàng hóa trên xe) có cùng cấu trúc.
// Khi quy tắc thay đổi, chỉ cần sửa file này; giao diện và cách tính đọc toàn bộ từ đây.
const INSURANCE_REDUCTION_RULES = Object.freeze({
  source: {
    title: 'Quy tắc bảo hiểm tự nguyện xe cơ giới của Công ty TNHH Bảo hiểm Tasco',
    decision: 'Quyết định số 08/2025/QĐ-BH Tasco ngày 06/01/2025',
    short: 'QĐ 08/2025/QĐ-BH Tasco'
  },
  scopes: {
    vcx: {label: 'Vật chất xe', article: 14, heading: 'Điều 14. Giảm trừ bồi thường (bảo hiểm vật chất xe)'},
    hh: {label: 'Hàng hóa trên xe', article: 24, heading: 'Điều 24. Giảm trừ bồi thường (TNDS đối với hàng hóa)'}
  },
  tiers: [
    {id: 'fixed10', clause: '1.1', label: 'Giảm trừ 10%'},
    {id: 'range20', clause: '1.2', label: 'Giảm trừ từ 20% đến 50%'},
    {id: 'range50', clause: '1.3', label: 'Giảm trừ từ 50% đến toàn bộ'},
    {id: 'load', clause: '1.4', label: 'Giảm theo tỷ lệ % quá tải'}
  ],
  items: [
    {
      id: 'rescue', tier: 'fixed10', point: 'a', clause: '1.1', min: 10, max: 10,
      title: 'Không cứu chữa, hạn chế thiệt hại hoặc không thông báo ngay',
      text: 'Chủ xe/ Lái xe không thực hiện đầy đủ các biện pháp cứu chữa, hạn chế thiệt hại về người và tài sản; không thông báo ngay vụ tổn thất cho Bảo hiểm Tasco và/hoặc cơ quan công an có thẩm quyền nơi xảy ra tổn thất theo hướng dẫn của Bảo hiểm Tasco.'
    },
    {
      id: 'late-notice', tier: 'fixed10', point: 'b', clause: '1.1', min: 10, max: 10,
      title: 'Không gửi thông báo tổn thất, yêu cầu bồi thường bằng văn bản trong 05 ngày',
      text: 'Chủ xe/ Lái xe không gửi thông báo tổn thất và yêu cầu bồi thường bằng văn bản hoặc các hình thức khác được Bảo hiểm Tasco chấp thuận trong thời hạn 05 ngày kể từ ngày xảy ra tổn thất.',
      exception: 'Không áp dụng khi bất khả kháng, trở ngại khách quan hoặc đã được Bảo hiểm Tasco giám định thiệt hại trong thời gian này.'
    },
    {
      id: 'moved', tier: 'range20', point: 'a', clause: '1.2', min: 20, max: 50,
      title: 'Tự ý di chuyển xe, tháo gỡ hoặc sửa chữa khi chưa được chấp thuận',
      text: 'Chủ xe/ Lái xe tự ý di chuyển xe ra khỏi hiện trường tổn thất, tháo gỡ hoặc sửa chữa xe khi chưa có ý kiến chấp thuận của Bảo hiểm Tasco.',
      exception: 'Không áp dụng khi cần thiết để đảm bảo an toàn, đề phòng hạn chế thiệt hại về người và tài sản hoặc phải thi hành theo yêu cầu của cơ quan có thẩm quyền.'
    },
    {
      id: 'speed', tier: 'range20', point: 'b', clause: '1.2', min: 20, max: 50, measure: 'speed',
      title: 'Vượt quá tốc độ cho phép từ trên 20% đến 50%',
      text: 'Thời điểm xảy ra tổn thất, xe vượt quá tốc độ cho phép tham gia giao thông từ trên 20% đến 50%.',
      exclusion: {above: 50, article: 10, item: 10, text: 'Xe chạy vượt quá 50% tốc độ cho phép trở lên thuộc điểm loại trừ chung (mục 10 Điều 10): không giảm trừ mà từ chối bồi thường.'}
    },
    {
      id: 'disclosure', tier: 'range20', point: 'c', clause: '1.2', min: 20, max: 50,
      title: 'Kê khai không đầy đủ, trung thực hoặc không thông báo gia tăng rủi ro',
      text: 'Bên mua bảo hiểm/ Chủ xe không kê khai đầy đủ, trung thực những nội dung liên quan đến hợp đồng bảo hiểm hoặc không thông báo cho Bảo hiểm Tasco trong trường hợp có sự gia tăng mức độ rủi ro bảo hiểm để bổ sung phí bảo hiểm (như chuyển đổi mục đích sử dụng, hoán cải…).'
    },
    {
      id: 'subrogation', tier: 'range50', point: 'a', clause: '1.3', min: 50, max: 100,
      title: 'Không bảo lưu quyền khiếu nại, chuyển quyền đòi người thứ ba',
      text: 'Chủ xe/ Lái xe không bảo lưu quyền khiếu nại và chuyển quyền/ thế quyền đòi người thứ ba cho Bảo hiểm Tasco kèm theo toàn bộ hồ sơ, các tài liệu cần thiết; không hợp tác với Bảo hiểm Tasco để đòi lại người thứ ba hoặc tự động thỏa thuận bồi thường với người thứ ba gây thiệt hại cho Bảo hiểm Tasco.'
    },
    {
      id: 'dishonest', tier: 'range50', point: 'b', clause: '1.3', min: 50, max: 100,
      title: 'Không trung thực, che giấu hoặc làm sai lệch thông tin, tài liệu',
      text: 'Chủ xe/ Lái xe và người có quyền lợi liên quan không trung thực trong việc cung cấp các thông tin, tài liệu liên quan đến vụ tai nạn; cố tình che dấu và/hoặc làm sai lệch thông tin, tài liệu của vụ tai nạn; không tạo điều kiện cho Bảo hiểm Tasco trong quá trình xác minh tính chân thực của các thông tin, tài liệu đó.'
    },
    {
      id: 'overload', tier: 'load', point: '', clause: '1.4', min: 20, max: 50, measure: 'load', proportional: true,
      title: 'Chở/ kéo/ cẩu quá tải trọng hoặc quá số người trên 20% đến 50%',
      text: 'Giảm số tiền bồi thường tương ứng với tỷ lệ % xe chở/ kéo/ cẩu quá tải trọng hoặc quá số lượng người (không bao gồm trẻ em dưới 07 tuổi) trên 20% đến 50% theo quy định trên giấy chứng nhận kiểm định an toàn kỹ thuật và bảo vệ môi trường.',
      scopeText: {hh: 'Giảm số tiền bồi thường tương ứng với tỷ lệ % xe chở/ kéo/ cẩu quá tải trọng trên 20% đến 50% theo quy định trên giấy chứng nhận kiểm định an toàn kỹ thuật và bảo vệ môi trường.'},
      exclusion: {above: 50, article: 10, item: 9, text: 'Chở/ kéo/ cẩu quá tải trọng hoặc quá số người trên 50% thuộc điểm loại trừ chung (mục 9 Điều 10): không giảm trừ mà từ chối bồi thường.'}
    }
  ],
  principles: [
    {clause: '2.1', text: 'Khi bị giảm trừ theo nhiều tỷ lệ khác nhau cho các hành vi vi phạm khác nhau, Bảo hiểm Tasco lựa chọn áp dụng tỷ lệ cao nhất.'},
    {clause: '2.2', scopes: ['vcx'], text: 'Việc giảm trừ được áp dụng trong cả trường hợp bồi thường tổn thất bộ phận và tổn thất toàn bộ.'}
  ],
  deductibleNote: 'Mức khấu trừ (tối thiểu 500.000 đồng chưa VAT/vụ theo khoản 1.5 mục 1 Điều 15, hoặc theo HĐ/GCNBH và điều khoản bổ sung) được áp dụng riêng, không thay thế giảm trừ.'
});
