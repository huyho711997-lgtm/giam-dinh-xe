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
