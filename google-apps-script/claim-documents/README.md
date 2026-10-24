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
