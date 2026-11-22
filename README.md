# Giám định xe — Tasco DLK

Ứng dụng web tĩnh phục vụ giám định, quản lý hồ sơ và bồi thường xe cơ giới. Dự án chạy trực tiếp trên GitHub Pages, không cần cài thư viện hoặc chạy bước build để triển khai.

## Cấu trúc

```text
index.html                  Khung giao diện và thứ tự nạp tài nguyên
css/                        Giao diện, quản trị, sơ đồ, AI và responsive
js/
  config.js                 Cấu hình các dịch vụ hiện có
  core/                     Khởi tạo, trạng thái chung, điều hướng, tiện ích
  data/                     Dữ liệu mẫu để xem trước và xuất tài liệu
  features/
    auth/                   Đăng nhập và hồ sơ cá nhân
    admin/                  Người dùng, phân quyền, cấu hình và nhật ký
    claims/                 Hồ sơ, nhập Excel, OCR và theo dõi bổ sung
    dashboard/              Không gian làm việc
    evidence/               Ảnh, camera, tải lên và xem ảnh
    workshop/               Cổng gara và kết quả giám định
    reports/                Báo cáo tháng, tuần, KPI và dự phòng
    accounting/             Bàn giao và xử lý kế toán
    reimbursements/         Công tác phí và xuất biểu mẫu
    documents/              Mẫu Word, xem trước, in và chỉnh nội dung
    scene/                  Sơ đồ hiện trường, đối tượng và công cụ vẽ
    notifications/          Trung tâm thông báo
    ai/                     Trợ lý AI
assets/
  images/                   Logo, tiêu đề và ảnh nền biểu mẫu
  templates/                Hai mẫu Word gốc (.docx)
scripts/                    Máy chủ phát triển và kiểm tra mã
```

## Chạy tại máy

Cài Node.js phiên bản 20 trở lên, mở terminal trong thư mục dự án rồi chạy:

```sh
npm run dev
```

Mở `http://127.0.0.1:4173`. Không cần `npm install` vì các công cụ phát triển dùng thư viện có sẵn của Node.js. Dùng máy chủ HTTP thay vì mở `index.html` bằng `file://`, vì trình duyệt tải mẫu Word bằng `fetch`.

Kiểm tra cú pháp JavaScript và các đường dẫn tài nguyên:

```sh
npm run check
```

## Triển khai GitHub Pages

Giữ `index.html`, `css/`, `js/` và `assets/` cùng cấp ở thư mục được GitHub Pages xuất bản. Với thiết lập xuất bản từ nhánh `main` tại thư mục gốc, đưa toàn bộ cấu trúc này lên `main`; không có thư mục build riêng. Các đường dẫn tương đối hỗ trợ URL `/giam-dinh-xe/`.

Thư viện Firebase, JSZip, XLSX, html2canvas, Chart.js và Google Fonts tiếp tục được nạp từ các địa chỉ CDN hiện có.

## Quy tắc khi sửa mã

- Sửa chức năng trong thư mục `js/features/` tương ứng; sửa giao diện trong `css/`.
- Dự án giữ JavaScript kiểu classic để tương thích với các sự kiện HTML `onclick`, các hàm dùng chung và dữ liệu hiện tại. Chưa chuyển sang ES modules hoặc framework.
- Các file chức năng được khai báo trước `js/core/runtime.js`; runtime khởi tạo biến và đăng ký sự kiện theo thứ tự của bản gốc. Phần sơ đồ cũng có runtime riêng. Giữ thứ tự thẻ `<script>` trong `index.html` khi thêm hoặc chuyển file.
- CSS giữ thứ tự của bản gốc để bảo toàn các quy tắc ghi đè. CSS nằm trong chuỗi HTML dùng cho cửa sổ in hoặc giao diện tạo động vẫn đi cùng chức năng đó.
- `js/data/` chứa metadata của biểu mẫu. File `.docx` và ảnh được tách thành tài nguyên nhị phân; mẫu Word chỉ tải khi xuất, được dùng lại trong phiên và cho phép thử lại nếu tải lỗi. Khi đổi biểu mẫu, cập nhật đồng bộ metadata và tài nguyên gốc.
- Cấu hình dịch vụ nằm trong `js/config.js`; việc tách file không thay đổi quyền truy cập Firebase hoặc cấu hình triển khai.

## Hiệu quả của việc tách file

`index.html` giảm từ 3.557.000 byte xuống khoảng 215 KB. Tổng dữ liệu dự án vẫn chủ yếu là mã nghiệp vụ và mẫu biểu; việc chia nhỏ giúp bảo trì, lưu bộ nhớ đệm từng tài nguyên và tránh tải mẫu Word trước khi cần. Đây là bước tổ chức lại mã, chưa phải chuyển toàn bộ giao diện sang cơ chế tải theo nhu cầu.

## Công văn AI

Mở **Công văn AI** (nhóm Nghiệp vụ, đường dẫn `#cong-van-ai`; dùng chung quyền xem với Biểu mẫu dùng chung). Giao diện hội thoại giống TASCO AI: chọn mẫu công văn → **tìm và chọn hồ sơ** (gõ biển số, số hồ sơ, tên chủ xe, số GCN… không cần dấu) và/hoặc gõ ý chính, đính kèm tối đa 4 ảnh/PDF ở khung chat → AI phân tích: nói rõ **cách hiểu yêu cầu**, điền các trường, ghi nhận thông tin bổ sung, **đề xuất dàn ý riêng cho yêu cầu này** (bám mẫu nhưng bỏ/thêm/đổi ý) và **hỏi làm rõ** những điểm thật sự đổi nội dung công văn (mỗi câu có phương án bấm chọn hoặc gõ tự do; câu hỏi về một trường sẽ điền thẳng vào trường) → bạn duyệt/sửa thông tin bổ sung và dàn ý (tick bỏ ý không cần, sửa chữ, thêm ý) → **Soạn công văn** đúng theo dàn ý đã duyệt → sửa trực tiếp trên bản xem trước hoặc nhắn AI chỉnh lại (“viết ngắn gọn hơn”…) → tải Word (.docx, thể thức theo Nghị định 30/2020/NĐ-CP), in hoặc sao chép. Chưa chọn mẫu mà gõ thẳng ý chính thì AI soạn công văn tự do. Giá trị lấy từ hồ sơ luôn được ưu tiên; chỗ chưa có thông tin để “……” và tô vàng, AI không tự bịa số liệu.

Thêm mẫu mới: thêm một phần tử vào `OFFICIAL_LETTER_TEMPLATES` trong `js/data/official-letter-templates.js` (trường nhập, dàn ý, lời kết); không cần sửa mã khác. Năm mẫu khởi đầu (đề nghị cơ quan chức năng, nhắc bổ sung hồ sơ, gửi gara, kết quả giám định, giải trình) nên thay bằng công văn thật của đơn vị; mẫu **Từ chối bồi thường – sai thông số lốp** (`tu_choi_thong_so_lop`) dựng từ công văn thật đã ban hành. Hai khoá tuỳ chọn của mẫu: `sample[]` — công văn thật đã **ẩn thông tin cá nhân** (thay bằng `[..]`), đưa cho AI học cấu trúc/giọng văn nhưng bị cấm chép dữ kiện và điều khoản (chỉ nêu điều khoản khi có nguyên văn ở trường "Nguyên văn điều khoản loại trừ" hoặc từ Thư viện); `numberKey` — khoá trường làm "Số:" của công văn (mẫu từ chối dùng số hồ sơ bồi thường, VD `HSBT/XCG/2026/0105661`). Mẫu này tự tìm căn cứ trong Thư viện (điểm loại trừ chung về thông số lốp/kiểm định) và có thẻ gợi ý ở màn mở đầu. Thông tin đơn vị ban hành (tên, người ký, địa chỉ…) chỉnh ở nút ⚙️ trên đầu khung, lưu trên máy.

### Giao diện: AI agent dạng trang
- **Mở đầu:** "Hôm nay cần soạn công văn gì?" + một ô yêu cầu lớn. Trong ô có nút **Đính kèm**, **Hồ sơ** (ô tìm nổi), **Loại** (menu, mặc định Tự do) và nút gửi (Enter; Shift+Enter xuống dòng); 4 gợi ý mẫu bên dưới. Gõ số HSBT/biển số trong yêu cầu là tự nhận hồ sơ (`detectRecord`, chỉ khi xác định duy nhất; không thấy thì báo).
- **Làm việc:** tóm tắt yêu cầu (Sửa yêu cầu / Công văn mới) · tờ công văn lớn sửa trực tiếp (Ngày, Tải Word, In, Sao chép) · cột ghi chú hẹp (chỗ "……", căn cứ ✓/⚠, chọn nhanh, giả định, nên kiểm tra, lưu ý hồ sơ) · ô **Nhờ AI sửa** ghim cố định ở đáy (nội dung phía trên cuộn riêng, chiều cao tự khớp cửa sổ).
- **Tiến trình agent:** nằm ngay trong khung nhập, có vòng quỹ đạo và nhịp sóng khi đang xử lý. Nút **Tiến trình** mở/thu gọn ba bước đọc yêu cầu → căn cứ → soạn hoặc chỉnh sửa; mỗi bước cập nhật khi tác vụ thực sự trả kết quả. Hoàn tất tự thu gọn, chỉnh sửa chuyển sang chờ duyệt; lỗi và đếm ngược thử lại được hiển thị rõ. Mở lại phiên đã gián đoạn không chạy animation vô hạn. Tôn trọng tuỳ chọn giảm chuyển động của thiết bị.
- **Chi tiết** (thông tin, dàn ý, căn cứ, hồ sơ) nằm trong ngăn trượt bên phải, nút "Soạn lại theo chi tiết này".
- **Lịch sử** (khung trái, thu gọn được; trên màn hẹp là ngăn trượt): mọi công văn soạn xong tự lưu (`OfficialLetterHistory`) — kể cả khi sửa trên tờ, đổi ngày, tải Word; nhóm Hôm nay / Hôm qua / 7 ngày / 30 ngày / Cũ hơn, tìm theo trích yếu/hồ sơ, bấm để mở lại nguyên trạng (tờ, ghi chú, chi tiết), xoá từng bản.
- **Sửa đoạn và duyệt thay đổi:** bôi đen một phần hoặc nhiều đoạn trên tờ, rồi nhập yêu cầu ở ô **Nhờ AI sửa**. AI chỉ được thay phần bôi đen; bỏ chọn đoạn để sửa toàn công văn. Màn so sánh đánh dấu chữ thêm/bỏ, cho chọn từng thay đổi trước khi **Áp dụng** hoặc **Bỏ đề xuất**; xuất Word luôn dùng bản đã áp dụng.
- **Phiên bản:** nút **Phiên bản** trên thanh công cụ mở các bản lưu trước/sau khi AI sửa và các lần khôi phục. Xem nội dung rồi chọn **Khôi phục phiên bản này**; bản hiện tại được giữ để quay lại. Giữ tối đa 12 phiên bản mới nhất trong giới hạn 150.000 ký tự của lịch sử hiện có; chỉ lưu nội dung công văn, không nhân đôi tệp đính kèm. Công văn cũ vẫn mở được.

### Đọc sâu hồ sơ (`official-letter-dossier.js`)
Khi chọn hồ sơ, AI không nhận bản ghi thô nữa mà nhận "hồ sơ đọc được" do `OfficialLetterDossier` dựng:
- Nhóm theo nghiệp vụ, nhãn tiếng Việt (định danh, khách hàng, xe, hợp đồng, vụ tổn thất, giám định & xử lý, mốc thời gian, tài chính, ghi chú); ngày dạng dd/mm/yyyy, tiền dạng `1.234.567 đ`; giữ diễn biến/mô tả dài (tới 1.500 ký tự); có hạng mục tổn thất/báo giá/yêu cầu ảnh, thông tin giảm trừ (`thongBaoGiamTru`), 8 ghi chú tiến độ mới nhất (`pending_notes`) và tối đa 6 hồ sơ khác cùng biển số. Bỏ CCCD/CMND/GPLX, ảnh, đường dẫn, mã kỹ thuật.
- **Nhận định tính sẵn** (quy tắc, không do AI đoán): ngày tổn thất trong/ngoài thời hạn BH, tổn thất sát ngày hiệu lực/hết hạn, phí đóng sau ngày tổn thất, số ngày báo tổn thất (quá 5 ngày → lưu ý), số ngày hồ sơ đã mở, đã/chưa nhận đủ hồ sơ, giai đoạn & bước kế tiếp, PASC so với ước thiệt hại, đã thanh toán/còn lại, thiệt hại ≥75% số tiền BH, đồng bảo hiểm, giảm trừ, từ chối, mục quan trọng còn trống.
- Bước phân tích trả thêm `insights` (nhận định của AI cho đúng công văn này) và `keyFacts` (dữ kiện cụ thể sẽ nêu); bước soạn nhận cả hồ sơ, nhận định và dữ kiện nên viết cụ thể theo vụ việc thay vì câu chung chung. Tất cả hiện ở khối **Phân tích hồ sơ** (lưu ý màu cam lên đầu, mở "Xem toàn bộ hồ sơ AI đã đọc" để đối chiếu).

### Căn cứ pháp lý từ Thư viện tài liệu (`official-letter-legal.js`)
**Mặc định không viện dẫn điều luật.** Chỉ tự tìm căn cứ cho công văn kết quả giải quyết/giải trình (`NEEDS_BASIS`) hoặc khi ý chính nhắc tới căn cứ, luật, quy tắc, giảm trừ, từ chối, khiếu nại…; công văn đề nghị, nhắc bổ sung, gửi gara không mở đầu bằng "Căn cứ…". Đoạn tìm được phải chứa ≥60% từ có nghĩa của truy vấn và đạt ≥40% điểm đoạn tốt nhất, tối đa 5 đoạn; AI chỉ dẫn tối đa 2 căn cứ quy định đúng vấn đề, đặt ngay tại câu cần căn cứ. AI không được tự nhớ điều luật; căn cứ lấy từ **Thư viện tài liệu** (`doc_library`, cùng kho TASCO AI dùng, tìm BM25 ngay trên máy):
- Truy vấn tự dựng từ loại công văn (`TOPICS`), tình huống hồ sơ (báo trễ, giảm trừ kèm tên vi phạm, từ chối, ngoài thời hạn BH, phí đóng sau tổn thất, tổn thất toàn bộ, đồng BH…) và `legalQueries` AI gợi ý ở bước phân tích. Chỉ lấy văn bản **đang hiệu lực**, tối đa 8 đoạn, mã `[C1]…`.
- Khối **Căn cứ pháp lý từ Thư viện tài liệu** (trước khi soạn): tick/bỏ tick từng đoạn, xem nguyên văn, mở văn bản gốc, ô **Tìm thêm căn cứ**. Thư viện trống/lỗi → báo rõ, nút mở Thư viện, AI không nêu điều luật cụ thể.
- Bước soạn chỉ được viện dẫn các đoạn đang tick, đúng tên/số hiệu/số điều như nguyên văn; không có căn cứ phù hợp thì viết chung "theo quy định của pháp luật và Quy tắc bảo hiểm".
- **Kiểm chứng tự động** trên bản thảo (cả khi sửa tay): mọi "khoản/điểm … Điều N <văn bản>", "Luật/Nghị định/Thông tư/Quy tắc …", số hiệu `xx/yyyy/…` đều được đối chiếu với các đoạn đã chọn — ✓ kèm mã nguồn hoặc ⚠ "chưa kiểm chứng" (đúng số điều nhưng sai văn bản cũng bị bắt). Tải Word khi còn ⚠ sẽ có cảnh báo.
- Chất lượng phụ thuộc thư viện: cần nạp Luật Kinh doanh bảo hiểm 08/2022/QH15, Nghị định 67/2023/NĐ-CP, Quy tắc bảo hiểm xe cơ giới Tasco… (mỗi Điều thành một mục để tìm trúng).

### Soạn công văn có chiều sâu (`official-letter-core.js` · `buildReasonRequest`)
Luồng soạn: **đọc hồ sơ → tra căn cứ → suy luận nghiệp vụ → viết**. Khi bật **Suy luận sâu**, bước *Suy luận nghiệp vụ* dựng **kế hoạch lập luận** từ hồ sơ + nguyên văn căn cứ (ý chính, chuỗi dữ kiện → quy định → áp dụng → kết luận, điểm đã kiểm tra, phản biện có thể gặp, giọng văn, cách vào đề, bước tiếp theo, rủi ro) rồi đưa vào bước viết; lỗi ở bước này không chặn việc soạn. Bước viết có quy tắc văn phong riêng: vào việc ngay, không câu chào sáo ngữ, mỗi đoạn một việc, giải thích *vì sao*, kết bằng bước tiếp theo cụ thể; công văn mẫu và dàn ý chỉ là khung (không chép câu của mẫu). Chỉnh sửa theo yêu cầu mới không dùng lại kế hoạch cũ.

### Tab Biên bản hiện trường — nhập theo 4 bước (`scene-report-ui.js`, `scene-report-model.js`)
Form không còn là một trang dài mà chia **4 bước**, thứ tự theo cách làm thực tế: **1 Thông tin chung** (thời gian, địa điểm, thành phần, xe/lái xe) → **2 Ảnh & AI** (tùy chọn, AI điền trước từ ảnh) → **3 Hiện trường** [1–11] → **4 Thiệt hại & xuất** [12–16], kiểm tra, xem trước/Tải Word/In. Thanh bước phía trên luôn hiện số mục đã nhập của từng bước (✓ khi đủ); cuối mỗi bước có **Quay lại / Tiếp**. Mục còn thiếu hiện thành các chip ngay cuối bước, bấm chip để nhảy đúng tới ô cần nhập (tự đổi bước và nhấp sáng ô). Bước 4 có bảng **Kiểm tra trước khi in/tải** gom mọi mục thiếu của cả 4 bước (không chặn xuất file, vì có mục như mẫu vật có thể "không có"). "Va chạm với" không bắt buộc (tai nạn một xe). Khối lái xe [6]/[7] là hai nhánh loại trừ nên được tính đủ khi nhánh đang chọn đã có dữ liệu (trước đây tiến độ không bao giờ đạt 16/16). Sau khi áp dụng đề xuất AI có nút *Soát lại ở bước 3*. Bước đang mở được giữ khi form vẽ lại.

### AI phân tích ảnh hiện trường (`scene-report-ai.js`, `scene-report-ai-ui.js`)
Bước 2 của **Biên bản hiện trường** có khối *AI phân tích ảnh hiện trường*: chọn hoặc kéo thả tối đa 20 ảnh (tự thu nhỏ còn 1280 px, ảnh nhiều chi tiết giảm dần xuống 800 px để mỗi ảnh ≤ ~450 KB và tổng ≤ ~9 MB — vừa giới hạn 12 MB của cầu nối Antigravity), bấm nhãn trên mỗi ảnh để gắn loại **Hiện trường / Dấu vết / Mẫu vật**, có thể thêm ghi chú cho AI. Bấm **Phân tích ảnh** → Gemini (khoá và mô hình dùng chung với Trợ lý AI) đọc ảnh cùng ngữ cảnh hồ sơ (biển số, địa điểm, diễn biến khai báo, nội dung đã nhập) và nháp **[9] mô tả hiện trường, [10] dấu vết, [11] mẫu vật** và điền trước các mục còn lại đọc được từ ảnh: **[3] địa hình, [4] tính chất nền, [5] thời tiết/ánh sáng, [12] vị trí tổn thất (đầu/thân/đuôi/gầm), [13] đánh giá thiệt hại sơ bộ, [14] phụ tùng và loại tài sản** (khối *Các mục khác đọc được từ ảnh*; mục biên bản đã có nội dung thì mặc định không tick để khỏi ghi đè, nhưng vẫn tick tay được). Các mục ảnh không chứng minh được — [1] nguyên vẹn, [2] nhiệt độ động cơ, [6][7] lái xe, [8] giấy tờ, mức ước tính tiền, [15] thiệt hại về người, [16] lời khai — AI không đụng tới, giám định viên tự nhập. Kết quả hiện ra để sửa trực tiếp, chọn từng mục và cách ghi (*Thêm vào cuối* hoặc *Thay nội dung hiện có*), chỉ ghi vào biên bản khi bấm **Áp dụng**. Kèm danh sách *Cần xác minh/đo tại hiện trường* và *Căn cứ AI nhìn thấy trong ảnh*. Văn phong theo biên bản thực tế: **[10] là văn xuôi theo từng xe** ("Tại hiện trường ghi nhận xe … tại vị trí …", "Đối với xe …", chiều tác động "từ phải qua trái", đối chiếu vệt sơn/mảnh vỡ giữa hai xe, vệt chà trên mặt đường, điểm đâm va), **[11] mỗi mẫu vật một dòng ngắn** ("Một số mảnh vỡ của phần cản trước của xe …"), [9] đánh số theo vị trí trên sơ đồ. Xe còn lại lấy biển số từ ô "Va chạm / xảy ra với" hoặc ảnh; không đọc rõ thì AI gọi "xe thứ ba" và nhắc kiểm tra. Quy tắc cho AI: chỉ ghi điều nhìn thấy, không bịa số đo và không để "…" trong câu (mô tả vị trí tương đối, số đo cần đo ghi ở mục cần xác minh), không kết luận lỗi hay nguyên nhân, điều suy luận chưa chắc phải ghi "cần xác minh". Ảnh chỉ nằm trong bộ nhớ trang, không lưu vào hồ sơ và tự bỏ khi đổi hồ sơ. **Chọn mô hình** ngay trong khối (dùng chung danh sách và khoá với Công văn AI, chỉ liệt kê mô hình đọc được ảnh): Gemini (mặc định), DeepSeek hoặc **Antigravity** qua công cụ trung gian trên máy (cần bật công cụ và đăng nhập website). Có công tắc **Suy luận sâu** cho mô hình hỗ trợ (Antigravity/Gemini gửi `reasoning_effort: high`, chờ tới 170 giây); lựa chọn được nhớ trên máy. Gemini hết hạn mức miễn phí (429) thì đổi sang Antigravity hoặc DeepSeek.

### Suy luận sâu với model Antigravity (`official-letter-models.js` · `profile`, `timeoutMs`)
Model Antigravity (`gemini-3-flash` qua cầu nối cục bộ) nay dùng được chip **Suy luận sâu**: bật → gửi `reasoning_effort: "high"` (CLIProxyAPI đổi thành mức suy nghĩ cao của Gemini 3) và cho phép đầu ra tới 16000 token; tắt → `reasoning_effort: "low"`. Bước *Suy luận nghiệp vụ* của Soạn công văn, Hỏi nghiệp vụ và chỉnh sửa theo yêu cầu đều dùng chung công tắc. Hạn chờ phía trình duyệt là **170 giây** khi suy luận sâu (45 giây khi tắt); cầu nối cục bộ tự giới hạn 180 giây phía upstream. Lỗi quá hạn báo riêng ("chưa trả kết quả suy luận sâu…, hãy thử lại hoặc tắt Suy luận sâu"). Suy luận sâu tốn hạn mức và thời gian hơn; có hiệu lực thật hay không còn phụ thuộc CLIProxyAPI/Antigravity chấp nhận `reasoning_effort`.

### Khối "Tài liệu để AI lấy thông tin" (`official-letter-page.js` · `docsHtml`)
Tài liệu bắt buộc (hoặc đã có tệp) hiện thành **ô gọn** xếp lưới: dấu tròn/✓, tên, gợi ý tối đa 2 dòng, bấm cả ô để đính kèm, ảnh thu nhỏ nằm ngay trong ô. Tài liệu **"Nếu có"** chưa đính kèm chỉ là chip một dòng. Tiêu đề có bộ đếm *n/m bắt buộc* và nút thu gọn/mở (`st.docsFold`).

### Duyệt đề xuất chỉnh sửa của AI (`official-letter-page.js` · `reviewHtml`)
Khi nhờ AI sửa công văn, các thay đổi hiện thành **thẻ riêng từng mục** (Trích yếu, Đoạn 1…) với công tắc **Áp dụng / Bỏ qua** (bấm cả hàng tiêu đề), số từ thêm/bớt, ô **chọn tất cả** kèm bộ đếm, và thanh **Áp dụng N thay đổi** ghim ở đáy vùng cuộn. Hai kiểu xem: **Gộp** (gạch xanh/đỏ theo từ) và **Trước / Sau** (hai cột). Đoạn bị viết lại gần hết (ít từ giữ nguyên) được hiện thành hai khối Hiện tại / Đề xuất thay vì gạch xen kẽ khó đọc. Bản thảo chỉ đổi khi bấm Áp dụng.

### Hỏi nghiệp vụ trong Công văn AI (`official-letter-qa.js`)
Nút chuyển **Soạn công văn ⇄ Hỏi nghiệp vụ** ở đầu trang Công văn AI. Chế độ hỏi đáp chạy 3 bước rồi trả lời **chỉ dựa trên các đoạn tra được**:

Để thêm quy tắc, quản trị viên có thể đính kèm một tệp vào ô hỏi, hoặc gõ `Thêm quy tắc vào cơ sở dữ liệu:` rồi dán nguyên văn ở dòng tiếp theo. Hệ thống mở bản xem trước để sửa tên, hiệu lực và nội dung; chỉ lưu vào `doc_library` khi bấm **Lưu vào thư viện**. Tệp gốc không được lưu; ảnh và PDF scan cần khoá Gemini để đọc chữ. Sau khi lưu, thư viện được làm mới để tra cứu và chọn trong Công văn AI.
1. **Lập kế hoạch tra cứu** (1 lệnh DeepSeek JSON, rẻ): AI viết lại câu hỏi đời thường thành 3–8 cụm tìm kiếm theo từ ngữ điều khoản (vd. "vỏ pin" → "tổn thất riêng pin xe điện", "loại trừ bảo hiểm"), cộng thêm bộ từ điển thuật ngữ cố định (pin/ắc quy, ngập nước, phạm vi/loại trừ, khấu hao…) để vẫn tra được khi bước này lỗi.
2. **Tra thư viện** (BM25 nhiều truy vấn, giới hạn số đoạn/điều) rồi **mở rộng nguồn**: lấy các phần liền kề của cùng điều (điều khoản bị cắt qua ranh giới đoạn) và các "Điều N" được dẫn chiếu; tối đa 12 nguồn, đoạn bổ sung có nhãn "Vì sao có đoạn này".
3. **Suy luận sâu** (DeepSeek thinking, `reasoning_effort: high`): đi qua định nghĩa → phạm vi → loại trừ chung → loại trừ chương → ngoại lệ "trừ trường hợp" → điều khoản bổ sung → khấu hao → thủ tục, rồi trả lời theo khung Kết luận / Căn cứ / Điều kiện, ngoại lệ cần kiểm tra / Cần xác nhận thêm. Chip **Suy luận sâu** tắt được để trả lời nhanh hơn; nút dừng ngắt giữa chừng. Công tắc này **dùng chung với Soạn công văn**: khi bật, cả 3 bước (phân tích hồ sơ, viết công văn, chỉnh sửa theo yêu cầu/đoạn chọn) đều chạy DeepSeek thinking (chậm hơn 30–90 giây, tốn token hơn); nút bật/tắt nằm ở ô soạn và ô "Nhờ AI sửa", lưu trên máy (`officialLetter.qaDeep.v1`), mặc định bật.
- Câu trả lời dẫn mã `[C1]…`; bấm mã để xem nguyên văn đoạn thư viện; danh sách "Nguồn đã tra" mặc định thu gọn thành một dòng (kèm mã đã dẫn), bấm tiêu đề để mở. Mã không có trong nguồn đã tra bị đánh dấu đỏ và cảnh báo; câu trả lời không dẫn nguồn cũng có cảnh báo.
- Chữ kết luận được **tô màu**: xanh = có/được/thuộc phạm vi/được bồi thường, đỏ = không/không được/bị loại trừ. Chỉ tô chữ in đậm mang nghĩa kết luận và một số cụm cố định (prompt yêu cầu AI in đậm từ quyết định); không tô từng chữ "không" lẻ.
- Không có đoạn nào khớp (và chưa có ngữ cảnh hội thoại/hồ sơ) thì **không gọi AI** — báo thư viện chưa có, tránh trả lời bằng trí nhớ.
- **Câu không cần căn cứ** (chào hỏi, cảm ơn, hỏi "bạn làm được gì"): nhận diện cục bộ (`isSmallTalk`) hoặc do bước phân tích trả `kind: "chat"`; khi đó không tra Thư viện, trả lời tự nhiên bằng prompt trò chuyện (`CHAT_SYSTEM`, 1 lần gọi AI, không suy luận sâu), không hiện cảnh báo/nguồn/nút Soạn công văn. Câu nghiệp vụ luôn đi theo 3 bước ở trên.
- Dùng chung khoá DeepSeek, chip **Hồ sơ** (AI áp dụng vào hồ sơ đó) và **Quy tắc** (chỉ tra trong văn bản đã chọn). Giữ 6 lượt gần nhất làm ngữ cảnh; nhiều cuộc trò chuyện, lưu trên máy (`officialLetter.qaChats.v1`, tối đa 30 cuộc, tự chuyển từ bản một cuộc `officialLetter.qa.v1`), có đếm token riêng. Nút **+** (thanh trên và thanh Lịch sử) mở cuộc trò chuyện mới; ở chế độ Hỏi nghiệp vụ thanh Lịch sử liệt kê, tìm, mở và xoá các cuộc trò chuyện (tiêu đề lấy từ câu hỏi đầu tiên).
- Nút **Soạn công văn từ câu trả lời** chuyển sang chế độ soạn, điền sẵn kết luận vào yêu cầu và ghim văn bản được dẫn làm căn cứ.

### Chọn nhà cung cấp/mô hình AI (`official-letter-models.js`, `provider-key.js`)
Nút **Mô hình** cạnh ô soạn và ô hỏi nghiệp vụ chọn AI dùng cho Công văn AI: **DeepSeek** (mặc định, trả phí rẻ), **Google Gemini** và **Groq** (có gói miễn phí), hoặc mục **Tuỳ chỉnh** cho dịch vụ tương thích OpenAI (OpenRouter có model miễn phí, Cerebras, Together, Ollama cục bộ…). Tất cả gọi `POST <địa chỉ gốc>/chat/completions` bằng khoá Bearer.
- **Khoá và mô hình** nhập ở ⚙ Cài đặt: mỗi nhà cung cấp một thẻ (khoá, danh sách mô hình cách nhau dấu phẩy, nút **Lấy danh sách mô hình** gọi `GET <gốc>/models` để chọn đúng tên). Khoá Gemini dùng chung với Thư viện tài liệu/Trợ lý AI; khoá DeepSeek như cũ; khoá Groq và tuỳ chỉnh lưu ở `user_secrets/{uid}/groqApiKey` và `customAiApiKey` (cần publish lại `firebase/database.rules.json`; chưa publish thì tạm lưu trên trình duyệt). Cấu hình mô hình (không chứa khoá) lưu ở `officialLetter.aiConfig.v1`.
- Tên mô hình đổi nhanh nên mặc định (`gemini-3.8-flash`, `openai/gpt-oss-120b`, `llama-3.3-70b-versatile`) có thể lỗi thời — sửa trong Cài đặt hoặc bấm **Lấy danh sách mô hình**; lỗi 404 nghĩa là tên mô hình sai.
- **Suy luận sâu** map theo từng loại: DeepSeek dùng `thinking`, Gemini và gpt-oss dùng `reasoning_effort`, mô hình không có suy luận (vd Llama) bỏ qua công tắc.
- **Giới hạn gói miễn phí**: Groq khoảng 8.000 token/phút nên ứng dụng tự giảm số nguồn tra cứu (5) và trần trả lời (4.000 token) — hợp để hỏi nghiệp vụ ngắn, không hợp soạn công văn dài; Llama trên Groq không đọc ảnh (ảnh/PDF scan sẽ báo lỗi và gợi ý chọn Gemini/DeepSeek). Gói miễn phí của Gemini có thể bị Google dùng để cải thiện sản phẩm — không dùng cho dữ liệu nhạy cảm của khách hàng.
- Dịch vụ không hỗ trợ JSON mode (HTTP 400 nhắc `response_format`) được tự thử lại một lần không có `response_format`.

## Biểu mẫu dùng chung

Mở **Biểu mẫu dùng chung** trên thanh điều hướng hoặc nút ở trang chủ. Trang hỗ trợ tìm kiếm không dấu, lọc loại file, phân loại, sắp xếp, phân trang, tải nhiều file, sửa tên/phân loại/ghi chú và xóa khỏi thư viện. Hai mẫu Word có sẵn của dự án luôn hiển thị. Người đã đăng nhập được xem và tải lên; người tải quản lý file của mình, người có quyền `users.admin` quản lý toàn bộ.

- File mới lưu bằng cấu hình Cloudinary hiện có tại thư mục `<folder>/shared_forms`, dùng endpoint `raw/upload`. Upload preset cần cho phép tài liệu `raw` và các định dạng sử dụng, không chỉ ảnh; giới hạn giao diện là 20 MB/file, giới hạn của tài khoản Cloudinary vẫn áp dụng. PDF cần được cho phép phân phối trong thiết lập bảo mật Cloudinary nếu tài khoản đang chặn định dạng này. Danh sách/metadata nằm ở Firebase Realtime Database `shared_forms/files`, không lưu file dạng base64 vào database.
- Bộ mẫu Word chuẩn dùng PDF xuất trực tiếp từ Microsoft Word để giữ font, bảng, lề và phân trang gốc. PDF dùng PDF.js; DOCX chưa có bản PDF dùng `docx-preview` (không cam kết khớp tuyệt đối Microsoft Word). Excel/CSV dùng XLSX hiện có; thư viện xem Word/PDF chỉ nạp khi mở tài liệu. Có thu phóng và nút **In tài liệu** mở hộp thoại in của trình duyệt. Excel in trang tính đang chọn, tối đa 5.000 dòng và 100 cột; đây là bản xem dữ liệu, không bảo toàn hoàn toàn bố cục in gốc của Excel. PDF giới hạn 100 trang và dung lượng dựng ảnh. Ảnh/TXT cũng xem và in trong trang. File `.doc` mới chưa có PDF dùng trình xem Office/Drive; muốn giữ chính xác bố cục nên tải lên bản PDF xuất từ Word.
- Xóa biểu mẫu gỡ metadata khỏi thư viện dùng chung. File vật lý vẫn nằm trong Cloudinary; quản trị viên xóa tài nguyên đó trong Cloudinary Console khi cần. Trình duyệt không giữ API secret để ký lệnh xóa tài nguyên.
- Kho Drive `1uPf8jI8nOnl8KW9j4JRpnXSkfTswIxD5` đã được gắn sẵn trong `js/config.js` theo liên kết chủ dự án cung cấp. Khi chưa có API key, danh sách do ứng dụng dựng từ danh mục thật tại `js/data/shared-forms-drive.json`, có cả thư mục con. Bộ mẫu chuẩn ở thư mục gốc có PDF xem/in nội bộ; file khác dùng khung `/preview` của Drive. Không dùng khung danh sách của Google vốn mở file ở tab khác. **Kết nối Drive** dành cho quản trị viên: bổ sung Google Drive API key để danh sách được đồng bộ trực tiếp khi thư mục thay đổi và để dựng PDF/DOCX bằng trình xem tích hợp. Cấu hình lưu tại `shared_forms/drive`. Gỡ kết nối lưu trạng thái tắt để kho mặc định không tự xuất hiện trở lại.
- Kho Drive hỗ trợ thư mục con; nút tải về luôn lấy file gốc. Chỉ bộ mẫu chuẩn ở thư mục gốc và hai mẫu hệ thống có bản PDF phụ trợ trong mã nguồn, không sao chép file hồ sơ trong thư mục con. File tải bằng nút **Tải file lên** nằm trong **Thư viện ứng dụng**. Dùng **Quản lý kho gốc** để thêm/sửa file trong kho Drive. Cấu hình Drive chỉ là API key đọc thư mục công khai; không nhập OAuth token, service-account key hoặc API secret.

### Quyền Firebase khi triển khai

`firebase/database.rules.json` là bộ rules HOÀN CHỈNH (giai đoạn 1: khoá toàn bộ DB cho người chưa đăng nhập, riêng cổng garage vẫn đọc/ghi hồ sơ theo mã; đã gộp 4 file rules bên dưới). Dán thay toàn bộ nội dung ở Firebase Console → Realtime Database → Rules → Publish, rồi thử bằng Rules Playground.

`firebase/user-secrets.rules.json` (đã nằm trong `database.rules.json`): nhánh `user_secrets/{uid}` lưu khoá Gemini API riêng từng tài khoản, chỉ chính chủ đọc/ghi.

### Thư viện tài liệu nghiệp vụ (hỏi đáp có trích dẫn)
Nút sách ở đầu khung Trợ lý AI mở **Thư viện tài liệu**. Quản trị viên nạp quy trình, điều khoản, bảng giá… (`.md`, `.txt`, `.docx`, `.pdf`, `.xlsx`, `.csv`, ảnh scan hoặc dán văn bản), xem trước các đoạn đã cắt rồi lưu vào `doc_library/{id}` (chỉ lưu chữ đã trích, không lưu file gốc; `nguon` là link bản gốc trên Drive/SharePoint). Chat AI dùng công cụ `tra_cuu_tai_lieu` (tìm BM25 ngay trong trình duyệt, không tốn quota) rồi trả lời kèm nút trích dẫn bấm để xem đoạn gốc; trích dẫn không khớp đoạn đã tra được đánh dấu "chưa xác minh". Chỉ tài liệu **đang hiệu lực** được tra mặc định. File Markdown nên mở đầu bằng khối `---` gồm `ten`, `so_hieu`, `hieu_luc_tu`, `trang_thai`, `thay_the`, `nguon` và dùng `## Điều …` cho từng mục. Bản scan/PDF không có lớp chữ được Gemini đọc (dùng khoá Gemini của người nạp). Cần publish `firebase/database.rules.json` để chỉ quản trị viên được ghi `doc_library`.

`user_chats/{uid}` (đã nằm trong `database.rules.json`): lịch sử trò chuyện của Trợ lý AI theo từng tài khoản (tối đa 40 tin, văn bản thuần) và các câu hay hỏi; chỉ chính chủ đọc/ghi. Chưa publish rules thì lịch sử tạm lưu trên trình duyệt.

`user_letters/{uid}` (đã nằm trong `database.rules.json`, cần publish lại rules): lịch sử Công văn AI theo từng tài khoản — `index/{id}` = {title, sub, updatedAt} (danh sách nhẹ) và `items/{id}` = {data (chuỗi JSON cả phiên, ≤150.000 ký tự), updatedAt}; chỉ chính chủ đọc/ghi, giữ 60 bản mới nhất. Chưa publish rules/mất mạng thì tự lưu trên trình duyệt (25 bản). Không lưu ảnh/PDF đính kèm.

`firebase/shared-forms.rules.json` là phần rules tham khảo cho nhánh mới `shared_forms`. Ghép riêng nhánh này vào rules hiện có trong Firebase Console; không ghi đè toàn bộ rules đang vận hành. Kiểm tra và bỏ các quyền đọc/ghi quá rộng ở nhánh cha vì Firebase Rules cho phép kế thừa không thể bị thu hẹp bằng rules con. Rules kiểm tra quyền trên server, giữ nguyên chủ sở hữu và liên kết file khi sửa metadata. Chưa tự triển khai rules hoặc thay đổi dữ liệu thật.

Kiểm tra phần lưu trữ bằng `node --test tests/shared-forms.test.mjs`. Chạy `node scripts/check.mjs` để kiểm tra cú pháp và các tài nguyên giao diện.

### Giao diện premium và xem file trong trang

Trang biểu mẫu dùng bảng màu ivory, xanh trầm, champagne theo mẫu `premium-report-ui`. Dropdown loại tài liệu, phân loại, sắp xếp, số dòng, phân loại trong hộp thoại và trang tính/thu phóng trong trình xem dùng chung `shared-forms-controls.js`: header, tìm kiếm không dấu, dấu chọn, bàn phím, đóng ngoài và định vị trong viewport. Phân loại tùy ý vẫn có thể thêm bằng ô tìm kiếm của dropdown.

Nhấn biểu mẫu để mở trình xem toàn màn hình, không có chế độ xem nhanh bên cạnh hay nút thu gọn. Đóng bằng nút X hoặc phím Escape để trở về đúng biểu mẫu trong danh sách. Bộ mẫu chuẩn hiển thị từ PDF xuất bằng Word; in theo đúng kích thước từng trang, không thêm lề lần hai hoặc ép lại chiều rộng bảng. Hộp thoại in của trình duyệt cho phép chọn máy in, số bản và trang in; khi in đúng tỷ lệ gốc nên chọn tỷ lệ 100% và khổ giấy phù hợp. File Word chưa có PDF phụ trợ vẫn phụ thuộc trình kết xuất HTML/Drive; nếu cần giống Word tuyệt đối, cung cấp PDF xuất từ bản Word đó. Liên kết **Quản lý kho gốc** là hành động quản lý Drive bên ngoài riêng biệt.

`js/data/shared-forms-print.json` ánh xạ 31 mẫu Word tại gốc Drive và ba mẫu hệ thống (TNDS, hướng dẫn thu thập hồ sơ, sơ đồ hiện trường để khách ký trước) sang `assets/shared-form-previews/*.pdf`. Bản PDF chỉ dùng khi khớp thời điểm danh mục và ngày sửa; nếu có API key hoặc là mẫu nội bộ, ứng dụng đối chiếu SHA-256 file gốc trước khi dùng, tránh in nhầm bản cũ. Chạy `node scripts/sync-shared-forms-drive.mjs` rồi `powershell -ExecutionPolicy Bypass -File scripts/build-shared-form-previews.ps1` trên Windows có Microsoft Word, sau đó triển khai cả danh mục, manifest và PDF. Script mở tài liệu chỉ đọc, tắt macro, tắt cập nhật liên kết và không sửa file gốc; không xử lý thư mục con chứa hồ sơ. Không có dịch vụ chuyển đổi Word trên GitHub Pages nên file Word tải lên mới chưa tự sinh PDF.

Danh mục Drive không có API key là bản chụp metadata tại thời điểm đồng bộ, không phải dữ liệu mẫu. Nhấn Làm mới đọc lại danh mục đã được triển khai; thêm API key để đọc trực tiếp thay đổi mới trên Drive. Có thể chạy `node scripts/sync-shared-forms-drive.mjs` rồi triển khai lại `js/data/shared-forms-drive.json` để cập nhật danh mục công khai. Script chỉ lấy tên, ID, định dạng và ngày sửa của các file/thư mục được chia sẻ; không tải hay sao chép nội dung tài liệu.

## Trang vẽ sơ đồ hiện trường độc lập

`so-do-hien-truong.html` (menu bên → Nghiệp vụ → "Vẽ sơ đồ hiện trường", mở ngay trong thẻ hiện tại; nút X trên trang đó quay về app) cho phép vẽ, in và in lên giấy ký sẵn mà không cần mở hồ sơ, không cần đăng nhập. Dùng lại đúng các module trong `js/features/scene/`; `js/features/scene/standalone.js` thay phần lưu theo hồ sơ bằng: tự lưu nháp trong localStorage (khoá `sceneStandalone.v1`, chỉ nằm trên máy/trình duyệt đang dùng), "Lưu file"/"Mở file" (`.json`) và "Xuất ảnh" PNG.

- **Lưu lên đám mây (Cloudinary):** nút **Lưu** (Ctrl+S) đưa sơ đồ lên Cloudinary bằng đúng cấu hình/upload preset không ký của app (`CONFIG.CLOUDINARY_*` hoặc `claimvision-cloudinary-*` trong localStorage) — không cần đăng nhập. File JSON cùng định dạng "Lưu file", tải dạng `raw` vào `<folder>/scene_diagrams` (preset phải cho phép tài liệu `raw`, như biểu mẫu dùng chung). Sau khi lưu, địa chỉ trang thành `so-do-hien-truong.html?cloud=<đường dẫn>` và được chép vào clipboard; ai mở liên kết sẽ thấy đúng sơ đồ (bản sao). Nút **Mở sơ đồ** mở hộp thoại: danh sách đã lưu (chỉ nằm trên máy này, `sceneStandalone.cloud.v1`), dán liên kết, mở file `.json`, tải sơ đồ về máy. Mất mạng/preset sai → tự tải file `.json` về máy để không mất dữ liệu. Mã: `js/features/scene-cloud/scene-cloud.js` (chỉ nhận đường dẫn nằm trong `scene_diagrams` của cloud đã cấu hình) + `standalone.js`.
  - Lưu ý: ai có liên kết đều xem được sơ đồ; mỗi lần Lưu tạo một file mới (danh sách trên máy chỉ giữ bản mới nhất của cùng sơ đồ) và trình duyệt không có API secret nên không xoá được file trên Cloudinary — dọn trong Cloudinary Console khi cần. Google Drive chưa nối vì Apps Script Drive yêu cầu đăng nhập Firebase, trang này cố ý không đăng nhập.
- Giao diện trình vẽ nằm giữa hai dấu `SCENE-EDITOR:BEGIN/END` trong `index.html` và được sao sang trang này. Sau khi sửa khối đó hoặc đổi `?v=` của file vẽ trong `index.html`, chạy `npm run sync:scene-page` (test `tests/scene-standalone.test.mjs` báo lỗi nếu quên).
- Vùng rừng/đồng lúa/bãi đá/đồi: bấm từng điểm để vẽ ranh giới. Cạnh mặc định là **thẳng** đúng các điểm đã bấm (`shape.areaEdge = 'straight'`); nét rê tay được làm mượt thành **cong** (`'curve'`). Chọn vùng rồi dùng nút **Cạnh thẳng / Cạnh cong** để đổi; nhấp đúp lên viền để thêm điểm, nhấp đúp điểm để xoá. Bản vẽ cũ không có `areaEdge` sẽ hiển thị cạnh thẳng.
- Thanh công cụ vẽ chia 13 nhóm theo chức năng (id công cụ không đổi nên bản vẽ cũ vẫn mở được; phím tắt nhóm L/C/A/S/B/O/X/D/K/J/Y/H/G/I). Mục "Thao tác" có ô **Tìm công cụ** (phím `/`, gõ không dấu), nút **Sơ đồ mẫu** (`js/features/scene/scene-samples.js`: đường thẳng, ngã ba, ngã tư, đường cong, cầu — chèn thành một nhóm nằm dưới các đối tượng đã vẽ) và mục **Dùng gần đây** (`js/features/scene/toolbar-ui.js`, localStorage `sceneToolRail.recent.v1`, `sceneToolRail.collapsed.v1`). Xe/biển báo/ký hiệu đường bộ mới khai báo trong `vehicle-assets.js`, `road-assets.js`, `traffic-signs.js`; hướng Bắc và thước tỷ lệ ở nhóm "Ký hiệu bản vẽ" không vào bảng Ký hiệu.
- Sơ đồ vẽ ở trang này chưa gắn vào hồ sơ nào; muốn đưa vào hồ sơ, mở file `.json` trong trình vẽ của hồ sơ chưa được hỗ trợ — hiện chỉ dùng "Xuất ảnh"/in.

## Tự lưu sơ đồ và hướng dẫn theo số HSBT

Sơ đồ hiện trường và hướng dẫn thu thập tự lưu ngay trong màn hình hồ sơ. Không cần mở trang lưu trữ hoặc bấm nút lưu giữ riêng.

- Số HSBT là khoá liên kết ổn định. Sau khi xoá hồ sơ và nhập lại Excel, mở hồ sơ có cùng số HSBT để tự nạp lại sơ đồ, danh sách giấy tờ, trạng thái bổ sung và nội dung hướng dẫn A4 đã chỉnh. Không phụ thuộc mã nội bộ của hồ sơ nhập lại.
- Tự lưu hướng dẫn sau khi ngừng sửa khoảng 650 ms, sơ đồ sau khoảng 1 giây; đóng màn hình cũng chốt phần đang sửa trước khi xoá trạng thái biểu mẫu. Dòng trạng thái cho biết đang lưu hoặc chưa lưu được. Các yêu cầu lưu cùng tài liệu chạy lần lượt để bản cũ không ghi đè bản mới.
- Chuẩn hoá chữ hoa và khoảng trắng của số HSBT. Không ghép theo biển số. Hồ sơ chưa có số HSBT giữ dữ liệu theo mã hồ sơ hiện tại, vì chưa có căn cứ để tự ghép sang một mã nhập lại khác.
- Khi đổi số HSBT, phần sửa đang chờ lưu được ghi về số cũ trước, rồi tự nạp tài liệu của số mới. Bản nháp chưa có số được chuyển sang số vừa nhập nếu số đó chưa có tài liệu.
- Tài liệu cũ lưu theo mã nội bộ được tự nhận diện từ số HSBT trong thông tin đi kèm và chuyển sang khoá mới khi mở hồ sơ hoặc trước khi xoá dữ liệu. Không cần thao tác chuyển thủ công.
- Dữ liệu nằm ngoài `pending_claims`, tại `scene_diagrams/<hsbtKey>` và `collection_guides/<hsbtKey>`. Với hồ sơ chưa có số HSBT, dùng mã hồ sơ làm khoá dự phòng. `hsbtKey` mã hoá đầy đủ số HSBT thành hex UTF-8 để dùng được với ký tự / và các ký tự bị Firebase cấm trong tên khoá.
- Xoá hồ sơ chỉ xoá dữ liệu hồ sơ. Việc xoá sơ đồ bằng nút riêng ghi dấu xoá tại số HSBT, tránh tự khôi phục nhầm một bản sơ đồ cũ.

Nhánh collection_guides và scene_diagrams cần quyền đọc/ghi phù hợp với chính sách Firebase hiện có. Tính năng không thay đổi Security Rules. Nếu lưu giữ tài liệu gặp lỗi, thao tác xoá hồ sơ dừng lại. Xem [đọc/ghi Firebase](https://firebase.google.com/docs/database/web/read-and-write) và [Security Rules](https://firebase.google.com/docs/database/security).

Chạy npm test để kiểm tra xoá rồi nhập lại với ID khác, chuẩn hoá số HSBT, tìm bản cũ, tự lưu, đổi số, tránh ghép nhầm biển số, bản chưa có số, xử lý lỗi và phản hồi đến muộn. Các kiểm tra dùng dữ liệu giả, không tác động Firebase thật.

## Công văn trưng cầu hồ sơ từ cơ quan chức năng

Trong màn hình chỉnh sửa hồ sơ, mở tab **Trưng cầu hồ sơ**. Nhập cơ quan nhận, số thứ tự công văn (nếu đã cấp), chọn nhóm giấy tờ cần cung cấp và bổ sung thông tin liên hệ. Biển số, ngày/địa điểm tai nạn lấy trực tiếp từ hồ sơ. GCNBH và giờ tai nạn tự lấy từ hồ sơ khi chưa sửa riêng trong tab này; cần đối chiếu đúng GCNBH của nghiệp vụ liên quan.

- Bốn nhóm tài liệu: giấy tờ phương tiện/người lái; kết quả điều tra; thỏa thuận dân sự; khám nghiệm. Có thể thêm tài liệu khác theo từng dòng và đề nghị thông tin cơ quan tiếp tục thụ lý.
- Các đoạn về đã cử cán bộ, hậu quả tai nạn và căn cứ TNDS đều chưa được chọn sẵn. Chỉ đưa vào công văn khi người lập chọn, nhập và kiểm tra thông tin phù hợp. Không tự suy ra tử vong từ mẫu gốc.
- Xem trước được khi đã đủ dữ liệu. Xuất Word hoặc in yêu cầu tích xác nhận đã kiểm tra nội dung; thay đổi nội dung liên quan sẽ làm xác nhận cũ hết hiệu lực.
- Xuất tại tab này hoặc qua **Xuất Word → Trưng cầu hồ sơ từ cơ quan chức năng**. Mẫu chưa được cấp số công văn để dấu “…”.
- Trạng thái tab nằm trong `collection_guides/<hsbtKey>/state/authorityRequest`, dùng cơ chế tự lưu/khôi phục theo số HSBT hiện có. Xoá rồi nạp lại hồ sơ cùng số sẽ nạp lại phần đã lưu.

Mã tại `js/features/documents/authority-request.js`, CSS tại `css/authority-request.css`, metadata tại `js/data/authority-request.js`, mẫu tại `assets/templates/authority-request.docx`. Mẫu đã bỏ toàn bộ thông tin vụ việc và liên hệ cá nhân của tài liệu tham chiếu. Khi xuất, chỉ thay `word/document.xml`; logo, styles, numbering, section, header/footer và các phần khác của ZIP được giữ nguyên. Bản xem trước HTML dùng cùng XML đã điền, có thể khác phân trang của Microsoft Word. Môi trường triển khai tính năng chưa có trình kết xuất Word/LibreOffice hoạt động để đối chiếu phân trang DOCX.


## Cập nhật dữ liệu hồ sơ từ Excel (phiên bản, chỉ quản trị viên)

Trang **Hồ sơ bồi thường → Cập nhật dữ liệu từ Excel** dùng file xuất đầy đủ làm dữ liệu hiển thị:

- Đối chiếu theo Số HSBT (thiếu thì Mã VTT, rồi Biển số + ngày tổn thất). Hồ sơ trong file được thêm hoặc cập nhật; hồ sơ có Số HSBT không còn trong file được gỡ khỏi danh sách; hồ sơ tạo trong ứng dụng chưa có Số HSBT được giữ nguyên.
- Chỉ ghi các trường thay đổi. Dữ liệu chỉ có trong ứng dụng (thông báo giảm trừ, ghi chú TNDS, đề xuất hủy…) không bị đụng tới. Ô trống trong file chỉ xóa giá trị do file trước ghi vào; cột trống toàn bộ không xóa gì.
- Trước khi ghi, ứng dụng lưu một phiên bản: bản sao toàn bộ `pending_claims` và dữ liệu của file (gzip, chia khối ≤ 4 MB). Không lưu được phiên bản thì không ghi gì.
- **Lịch sử cập nhật**: xem các lần nhập/khôi phục, so sánh hai file bất kỳ (thêm mới, thay đổi theo từng trường, không còn trong file), **khôi phục về trước một lần cập nhật**. Khôi phục cũng tự sao lưu dữ liệu hiện tại thành phiên bản mới nên có thể hoàn tác.
- Dữ liệu lưu tại `claim_import_history/{id}` (thông tin) và `claim_import_blobs/{id}/rows|before` (dữ liệu nén). Gộp `firebase/claim-imports.rules.json` vào Realtime Database Rules để chỉ quản trị viên đọc/ghi các nhánh này.

## Danh bạ email thông báo giảm trừ

- Trong hộp "Thông báo đơn vị cấp đơn" có mục **Email đã lưu cho đơn vị này**: lưu email đơn vị cấp đơn (To), email cán bộ cấp đơn, TPKD phụ trách phòng KD và quản lý khu vực giám định (CC). Lần sau soạn cho cùng đơn vị, To/CC được điền sẵn (chỉ khi ô còn trống).
- Dữ liệu dùng chung ở `reduction_email_directory/{units|issuers|departments|zones}/{khóa}`; cán bộ và phòng KD gắn theo đơn vị (`<đơn-vị>__<tên>`), khu vực giám định lấy theo trường "Zone / Khu vực GĐ". Gộp `firebase/email-directory.rules.json` vào Firebase Realtime Database Rules (chỉ thêm nhánh này, không ghi đè toàn bộ rules).



### Bảo mật Realtime Database (cần publish `firebase/database.rules.json`)
- Chỉ **quản trị viên** được đặt `profile/role = Admin`, `profile/isAdmin` và `profile/permissions/users/admin` (người dùng thường vẫn sửa được hồ sơ, cài đặt và bộ lọc yêu thích của chính mình). Trước đây ai đăng nhập cũng tự nâng quyền được.
- Nhánh dữ liệu nghiệp vụ (`$other`) chỉ cho tài khoản **đã có `users/{uid}/profile`**; tài khoản chỉ tạo hồ sơ qua quản trị viên (màn Quản trị hệ thống), không tự tạo.
- **Trước khi publish:** mở Quản trị hệ thống và chắc chắn mọi người đang dùng đều có tên trong danh sách người dùng (có `profile`); tài khoản chỉ có trong Authentication mà không có hồ sơ sẽ mất quyền đọc/ghi dữ liệu cho tới khi quản trị viên tạo hồ sơ.
- Kiểm thử logic rules: `tests/database-rules.test.mjs` (giả lập tối giản, không thay thế Firebase Emulator/Rules Playground).
- Cũng nên tắt tự đăng ký tài khoản (Authentication → Settings) và giới hạn khoá API theo tên miền trong Google Cloud Console.
