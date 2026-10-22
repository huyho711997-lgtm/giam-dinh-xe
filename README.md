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

## Biểu mẫu dùng chung

Mở **Biểu mẫu dùng chung** trên thanh điều hướng hoặc nút ở trang chủ. Trang hỗ trợ tìm kiếm không dấu, lọc loại file, phân loại, sắp xếp, phân trang, tải nhiều file, sửa tên/phân loại/ghi chú và xóa khỏi thư viện. Hai mẫu Word có sẵn của dự án luôn hiển thị. Người đã đăng nhập được xem và tải lên; người tải quản lý file của mình, người có quyền `users.admin` quản lý toàn bộ.

- File mới lưu bằng cấu hình Cloudinary hiện có tại thư mục `<folder>/shared_forms`, dùng endpoint `raw/upload`. Upload preset cần cho phép tài liệu `raw` và các định dạng sử dụng, không chỉ ảnh; giới hạn giao diện là 20 MB/file, giới hạn của tài khoản Cloudinary vẫn áp dụng. PDF cần được cho phép phân phối trong thiết lập bảo mật Cloudinary nếu tài khoản đang chặn định dạng này. Danh sách/metadata nằm ở Firebase Realtime Database `shared_forms/files`, không lưu file dạng base64 vào database.
- DOCX dùng `docx-preview`, PDF dùng PDF.js, Excel/CSV dùng XLSX hiện có; thư viện xem Word/PDF chỉ nạp khi mở tài liệu. Có thu phóng và nút **In tài liệu**. Excel in trang tính đang chọn, tối đa 5.000 dòng và 100 cột để tránh treo trình duyệt; đây là bản xem dữ liệu, không bảo toàn hoàn toàn bố cục in gốc của Excel. PDF giới hạn 100 trang và dung lượng dựng ảnh. Ảnh/TXT cũng xem và in trong trang. File `.doc` cũ dùng trình xem Office/Drive và nút in của dịch vụ đó; nên chuyển sang DOCX để dùng trình in tích hợp.
- Xóa biểu mẫu gỡ metadata khỏi thư viện dùng chung. File vật lý vẫn nằm trong Cloudinary; quản trị viên xóa tài nguyên đó trong Cloudinary Console khi cần. Trình duyệt không giữ API secret để ký lệnh xóa tài nguyên.
- Kho Drive `1uPf8jI8nOnl8KW9j4JRpnXSkfTswIxD5` đã được gắn sẵn trong `js/config.js` theo liên kết chủ dự án cung cấp. Khi chưa có API key, danh sách do ứng dụng dựng từ danh mục thật tại `js/data/shared-forms-drive.json`, có cả thư mục con; file được mở bằng khung `/preview` của Drive ngay bên cạnh danh sách. Không dùng khung danh sách của Google vốn mở file ở tab khác. **Kết nối Drive** dành cho quản trị viên: bổ sung Google Drive API key để danh sách được đồng bộ trực tiếp khi thư mục thay đổi và để dựng PDF/DOCX bằng trình xem tích hợp. Cấu hình lưu tại `shared_forms/drive`. Gỡ kết nối lưu trạng thái tắt để kho mặc định không tự xuất hiện trở lại.
- Kho Drive hỗ trợ thư mục con và dùng lại các file gốc, không sao chép dữ liệu. File tải bằng nút **Tải file lên** nằm trong **Thư viện ứng dụng**. Dùng **Mở thư mục Drive** để thêm/sửa file trong kho Drive. Cấu hình Drive chỉ là API key đọc thư mục công khai; không nhập OAuth token, service-account key hoặc API secret.

### Quyền Firebase khi triển khai

`firebase/shared-forms.rules.json` là phần rules tham khảo cho nhánh mới `shared_forms`. Ghép riêng nhánh này vào rules hiện có trong Firebase Console; không ghi đè toàn bộ rules đang vận hành. Kiểm tra và bỏ các quyền đọc/ghi quá rộng ở nhánh cha vì Firebase Rules cho phép kế thừa không thể bị thu hẹp bằng rules con. Rules kiểm tra quyền trên server, giữ nguyên chủ sở hữu và liên kết file khi sửa metadata. Chưa tự triển khai rules hoặc thay đổi dữ liệu thật.

Kiểm tra phần lưu trữ bằng `node --test tests/shared-forms.test.mjs`. Chạy `node scripts/check.mjs` để kiểm tra cú pháp và các tài nguyên giao diện.

### Giao diện premium và xem file trong trang

Trang biểu mẫu dùng bảng màu ivory, xanh trầm, champagne theo mẫu `premium-report-ui`. Dropdown loại tài liệu, phân loại, sắp xếp, số dòng, phân loại trong hộp thoại và trang tính/thu phóng trong trình xem dùng chung `shared-forms-controls.js`: header, tìm kiếm không dấu, dấu chọn, bàn phím, đóng ngoài và định vị trong viewport. Phân loại tùy ý vẫn có thể thêm bằng ô tìm kiếm của dropdown.

Nhấn biểu mẫu để mở vùng đọc bên cạnh danh sách, chuyển file ngay trong vùng đọc hoặc mở rộng vùng này mà không mở tab mới. File DOC cũ và Drive chưa có API key dùng iframe Drive; nút mở cửa sổ của dịch vụ bị sandbox chặn. Nếu trình xem dịch vụ không cung cấp nút In, tải bản gốc để in trong Office. PDF/DOCX, ảnh/TXT và bảng tính do ứng dụng dựng có nút In trực tiếp. Liên kết **Quản lý kho gốc** là hành động quản lý Drive bên ngoài riêng biệt.

Danh mục Drive không có API key là bản chụp metadata tại thời điểm đồng bộ, không phải dữ liệu mẫu. Nhấn Làm mới đọc lại danh mục đã được triển khai; thêm API key để đọc trực tiếp thay đổi mới trên Drive. Có thể chạy `node scripts/sync-shared-forms-drive.mjs` rồi triển khai lại `js/data/shared-forms-drive.json` để cập nhật danh mục công khai. Script chỉ lấy tên, ID, định dạng và ngày sửa của các file/thư mục được chia sẻ; không tải hay sao chép nội dung tài liệu.

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
