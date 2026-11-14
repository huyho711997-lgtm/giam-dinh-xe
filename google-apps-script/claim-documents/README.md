# Kích hoạt tài liệu hồ sơ trên Google Drive

Trạng thái của ứng dụng hiện tại: đã cấp quyền và triển khai dịch vụ, URL trong `CONFIG.CLAIM_DOCUMENTS_ENDPOINT`. Các bước bên dưới dành cho cài đặt mới; khi cập nhật mã, dùng Manage deployments để tạo phiên bản mới trên cùng URL. Không dùng thư mục biểu mẫu công khai cho hồ sơ.

## Thiết lập bằng tài khoản sở hữu Drive

1. Mở https://script.google.com, tạo dự án độc lập và sao chép `Code.gs` vào trình soạn thảo.
2. Trong Project Settings, bật hiển thị `appsscript.json`; thay nội dung bằng manifest trong thư mục này.
3. Trong Script Properties, thêm:
   - `FIREBASE_API_KEY`: giá trị `CONFIG.FIREBASE.apiKey` trong `js/config.js` (API key cần cho phép gọi Firebase Authentication từ Apps Script; không nới hạn chế của key đang dùng nếu cần tạo key riêng).
   - `FIREBASE_DATABASE_URL`: giá trị `CONFIG.FIREBASE.databaseURL`.
   - `ALLOWED_UIDS`: UID các tài khoản ứng dụng được dùng kho tài liệu, ngăn cách bằng dấu phẩy. Lấy từ Firebase Console → Authentication → Users. Mặc định không cấp quyền cho ai.
4. Chạy `setupClaimDocuments` và cấp quyền Google. Hàm tạo thư mục riêng **TASCO DLK - Tai lieu ho so** và tự lưu `ROOT_FOLDER_ID`. Chạy lại không tạo thêm thư mục. Không thay ROOT_FOLDER_ID sau khi đã lưu hồ sơ trừ khi thực hiện chuyển dữ liệu.
5. Deploy → New deployment → Web app. Chọn **Execute as: Me**, **Who has access: Anyone**. Đây là quyền gọi endpoint; mọi thao tác vẫn bắt buộc Firebase ID token hợp lệ, UID có trong danh sách cấp quyền và quyền đọc hồ sơ theo Firebase Database Rules. Không có GET công khai danh sách/file.
6. Sao chép URL `/exec` vào `CONFIG.CLAIM_DOCUMENTS_ENDPOINT` trong `js/config.js`, rồi triển khai ứng dụng. Khi đổi mã Apps Script, tạo phiên bản mới trong Manage deployments.

## Sử dụng

- Mở hồ sơ đã lưu → **Tài liệu hồ sơ** → chọn nhiều file, tối đa 10 MB/file.
- Mỗi hồ sơ có thư mục theo biển số + số hồ sơ + khóa nhận diện ổn định. Sửa biển số không chuyển tài liệu sang hồ sơ khác. Khóa Firebase khác nhau luôn được phân thư mục khác nhau.
- Giao diện chia Hình ảnh / Tài liệu, có bộ lọc và kiểu xem Thẻ / Danh sách. Ảnh dùng lightbox chung với phóng to, xoay, chuyển ảnh; Office/PDF tiếp tục dùng trình xem tài liệu.
- Nút Xóa yêu cầu xác nhận và chuyển tệp vào Thùng rác Drive. Dịch vụ kiểm tra tệp thuộc hồ sơ, người tải lên hoặc vai trò quản trị từ Firebase trước khi xóa.
- Tải tối đa hai file đồng thời; danh sách cập nhật trực tiếp từ kết quả tải lên, không gọi lại toàn bộ danh sách sau mỗi đợt. Cache metadata 60 giây trong phiên theo UID + mã hồ sơ; nút Làm mới chủ động đọc lại Drive. Bộ nhớ đệm file tối đa 40 MB, xóa khi đổi tài khoản; không lưu nội dung hồ sơ vào localStorage.
- **Tốc độ tải:** danh sách được tải trước ngay khi mở hồ sơ (song song với form), dùng chung một request với lúc mở tab. Ảnh thu nhỏ được gom theo lô (`action: 'thumbnails'`, tối đa 8 ảnh/request phía trình duyệt, 12 phía máy chủ) và chỉ xin khi thẻ sắp vào khung nhìn. Nếu Apps Script chưa cập nhật, trình duyệt tự lùi về thao tác `thumbnail` từng ảnh.
- **Cache phía máy chủ (CacheService):** kết quả xác thực lưu 5 phút theo băm(token + mã hồ sơ) — không lưu token, chỉ lưu UID và 3 trường định danh hồ sơ; thu hồi quyền/UID có hiệu lực tối đa sau 5 phút (UID bị gỡ khỏi `ALLOWED_UIDS` bị chặn ngay). ID thư mục hồ sơ và thư mục con lưu 6 giờ, luôn kiểm tra lại (`getFolderById` + `isTrashed`) và tự tìm lại nếu thư mục bị xóa/di chuyển. Kiểm tra chế độ Riêng tư của thư mục gốc 10 phút/lần.
- **Cập nhật mã máy chủ:** sau khi sao chép `Code.gs` mới, vào Deploy → Manage deployments → Edit → Version: *New version* → Deploy (giữ nguyên URL `/exec`). Không cần đổi `js/config.js`.
- Các thư mục con: **Tai lieu tai len**, **Word da xuat**.
- Ba luồng Word (hướng dẫn thu thập hồ sơ, trưng cầu, tạm ứng TNDS) tiếp tục tải về máy và lưu thêm vào Drive khi đã cấu hình endpoint.
- Nếu lưu Drive lỗi, tab tài liệu có **Thử lưu lại** trong phiên hiện tại. Thử lại sử dụng cùng mã thao tác để tránh bản trùng do mất phản hồi. Đóng hoặc tải lại trang sẽ mất tệp chờ trong bộ nhớ; có thể tải lại tệp Word đã tải về máy.
- Không tạo liên kết Drive công khai. Người dùng tải qua dịch vụ đã xác thực; họ không cần quyền trực tiếp trong Drive của chủ tài khoản.
- Nút **Xem** mở trình xem chung của ứng dụng: ảnh, PDF, Word DOCX, Excel XLS/XLSX và TXT. Có thu phóng, chọn trang tính, in và tải bản gốc. Word DOC cũ dùng trình xem Drive, cần đăng nhập tài khoản Google có quyền trực tiếp với tệp. Không gửi tài liệu riêng tới trình xem Office công khai.
- Danh sách UID cho phép là lớp giới hạn bổ sung. Quyền truy cập từng hồ sơ dựa trên Firebase Database Rules hiện có: cần kiểm tra các rules đó thực sự giới hạn hồ sơ theo mô hình phân quyền của đơn vị. Không cấp quyền sửa Script Properties cho người dùng thông thường.

## Xác nhận trước khi sử dụng thật

Đăng nhập tài khoản được cấp UID, mở một hồ sơ mẫu, tải file nhỏ, làm mới, tải lại file và so nội dung. Xuất từng loại Word rồi kiểm tra thư mục Word đã xuất. Dùng hồ sơ thứ hai để xác nhận tách thư mục; tài khoản không được cấp UID phải bị từ chối. Kiểm tra tab Network cho POST từ GitHub Pages tới `/exec`; Google Workspace có thể chặn triển khai Anyone và cần quản trị viên cho phép hoặc thay bằng backend được tổ chức phê duyệt.

Giới hạn: Apps Script có hạn mức thực thi của tài khoản Google; giới hạn 10 MB/file, không tải tiếp phần dở dang. Thời gian thực tế phụ thuộc mạng và Drive. Không chia sẻ công khai hay đồng bộ các file Word đã xuất trước khi kích hoạt. Thumbnails Drive chưa sẵn sàng sẽ dùng bản gốc, vẫn qua dịch vụ xác thực.

Tài liệu gốc: https://developers.google.com/apps-script/guides/web · https://developers.google.com/apps-script/guides/content · https://firebase.google.com/docs/reference/rest/auth#section-get-account-info


## Tải biểu mẫu lên đúng thư mục Google Drive (trang Biểu mẫu dùng chung)

- Thêm vào Script Properties: `FORMS_ROOT_FOLDER_ID` = ID thư mục gốc kho biểu mẫu (đúng thư mục đã bấm "Kết nối Drive" trong ứng dụng). Chỉ ghi được vào thư mục gốc này và các thư mục con.
- Tài khoản chạy script phải có quyền **chỉnh sửa** thư mục đó (chủ sở hữu hoặc được chia sẻ quyền Editor). UID người dùng phải nằm trong `ALLOWED_UIDS`.
- Sau khi cập nhật `Code.gs`, tạo phiên bản mới trong Manage deployments (giữ nguyên URL `/exec`).
- Quản trị viên có nút **Xóa** ở cột Thao tác của Kho Google Drive: file được chuyển vào thùng rác Drive (khôi phục được), chỉ áp dụng cho file trong kho `FORMS_ROOT_FOLDER_ID`. Cần Deploy phiên bản mới của `Code.gs` (hành động `forms_delete`).
- Trong ứng dụng: mở tab **Kho Google Drive**, vào thư mục cần thiết, bấm **Tải biểu mẫu lên** → file được đẩy vào đúng thư mục đang mở (tối đa 10 MB/file; trùng tên sẽ thêm số thứ tự, không ghi đè). Tab **Thư viện ứng dụng** vẫn tải lên Cloudinary như trước.


## Trang "Google Drive" – quản lý toàn bộ Drive của chủ tài khoản

Trang nằm ở thanh bên → **Hệ thống → Google Drive** (đường dẫn `#/google-drive`), chỉ hiện với Admin hệ thống. Dịch vụ chạy dưới tài khoản sở hữu Drive (Execute as: Me) nên thao tác trên **toàn bộ** Drive của tài khoản đó.

### Kích hoạt (một lần)

1. Trong dự án Apps Script, bấm **+ → Script**, đặt tên `DriveManager`, dán nội dung `DriveManager.gs` (giữ nguyên `Code.gs` bản mới trong thư mục này).
2. **Services (+) → Drive API → Version v3 → Identifier `Drive` → Add** (hoặc dán `appsscript.json` mới, đã khai báo sẵn dịch vụ nâng cao này).
3. Script Properties → thêm `DRIVE_MANAGER_UIDS` = UID Firebase của người được quản lý Drive (phân tách bằng dấu phẩy). Danh sách này **tách riêng** với `ALLOWED_UIDS`; để trống = không ai dùng được trang.
4. Deploy → Manage deployments → Edit → Version: *New version* → Deploy (giữ nguyên URL `/exec`). Lần đầu Google sẽ hỏi cấp quyền lại.

### Tính năng

- Khu vực: Drive của tôi, Gần đây, Có gắn dấu sao, Được chia sẻ với tôi, Thùng rác; thanh dung lượng (Drive / Thùng rác / Gmail & Ảnh).
- Tìm kiếm toàn Drive (phím `/`), lọc theo loại, sắp xếp, xem Danh sách / Lưới (có ảnh thu nhỏ), phân trang "Tải thêm".
- Tạo thư mục, tải tệp lên (nút Mới hoặc kéo thả, ≤ 10 MB/tệp, 2 tệp song song, trùng tên tự thêm số thứ tự, gửi lại không tạo trùng), xem trước trong ứng dụng (PDF, Word, Excel, ảnh, Google Docs/Sheets/Slides xuất PDF), tải về (≤ 20 MB; tệp Google xuất DOCX/XLSX/PPTX).
- Bộ xem riêng theo loại tệp: **ảnh** (phóng to/thu nhỏ bằng con lăn, kéo để di chuyển, xoay, ←/→ chuyển ảnh trong thư mục), **video / âm thanh** (trình phát, ≤ 20 MB), **bảng tính** (thẻ trang tính, tiêu đề cột/dòng cố định, ô gộp, nút *Bản in*), **văn bản / JSON** (số dòng, ngắt dòng, sao chép). PDF, Word và tệp Google vẫn mở bằng trình xem tài liệu có dàn trang và in.
- **Tải ảnh nhanh (cần Deploy lại Apps Script):** ảnh nặng (> 600 KB) mở bằng bản thu nhỏ 2048 px do Google dựng sẵn (nhẹ hơn ảnh gốc nhiều lần), nút **Bản gốc** trong trình xem tải ảnh đầy đủ khi cần phóng to chi tiết; ảnh nhỏ của cả thư mục tải song song. Phía trình duyệt lưu ảnh đã xem trong Cache Storage 7 ngày (tự xóa khi đăng xuất). Chưa Deploy lại thì ứng dụng vẫn chạy bằng cách cũ (chậm hơn). Không thêm quyền mới.
- **Xem tệp .doc / .ppt / .pptx trong ứng dụng (cần Deploy lại Apps Script):** máy chủ tạo bản sao tạm sang định dạng Google, xuất PDF rồi xóa bản tạm ngay (không để lại gì trong Drive). Chưa Deploy lại thì ứng dụng báo và mở tệp trên Google Drive như cũ.
- **Chỉnh sửa trực tiếp Word (.docx):** menu chuột phải → *Chỉnh sửa Word* (hoặc nút *Chỉnh sửa* trong trình xem, tệp ≤ 10 MB). Gõ trực tiếp trên trang; Enter tách đoạn, Backspace ở đoạn trống để xóa đoạn, Tab chèn tab, tìm/thay thế, hoàn tác/làm lại, Ctrl+S. Khi lưu luôn hỏi: **ghi đè bản gốc** (cần **Deploy lại Apps Script** để có action `drive_update_content`; máy chủ so thời gian sửa nên không đè lên bản người khác vừa sửa, Drive giữ phiên bản cũ), **lưu bản sao** hoặc **tải về máy**. Chỉ vá các đoạn chữ đã đổi trong `word/document.xml` nên ảnh, bảng, kiểu chữ, đầu/chân trang giữ nguyên. Có thanh định dạng: phông, cỡ chữ, đậm/nghiêng/gạch chân/gạch ngang, màu chữ, căn lề (bôi đen chữ hoặc đặt con trỏ trong đoạn; Ctrl+A / Shift+bấm để chọn nhiều đoạn). Giới hạn: chưa có đánh số/gạch đầu dòng, giãn dòng, thụt lề; đoạn chứa trường tự động, theo dõi thay đổi, hộp văn bản, công thức bị khóa.
- Đổi tên (F2), di chuyển (hộp thoại chọn thư mục hoặc kéo thả vào thư mục / đường dẫn), tạo bản sao, gắn sao, sao chép liên kết, chi tiết tệp.
- Chọn nhiều (Ctrl/Shift + click, Ctrl+A), menu chuột phải, thùng rác (Delete) / khôi phục / xóa vĩnh viễn / dọn sạch thùng rác (có xác nhận).
- Mỗi thao tác thay đổi được ghi vào Nhật ký hoạt động (`DRIVE_MANAGE`).

### An toàn

- Bắt buộc Firebase ID token hợp lệ + UID trong `DRIVE_MANAGER_UIDS` (cache 5 phút theo băm token; gỡ UID có hiệu lực ngay).
- Client không gửi được truy vấn Drive thô: điều kiện `q`, `orderBy`, `fields` do máy chủ dựng từ danh sách trắng; chuỗi tìm kiếm được thoát ký tự; mọi ID kiểm tra định dạng.
- Thư mục hệ thống của ứng dụng (`ROOT_FOLDER_ID`, `FORMS_ROOT_FOLDER_ID`, gốc Drive) không thể đổi tên / di chuyển / xóa. Không cho chuyển thư mục vào thư mục con của chính nó.
- Xóa vĩnh viễn chỉ áp dụng cho mục đã ở thùng rác; dọn thùng rác cần mã xác nhận. Không có thao tác đổi quyền chia sẻ.
