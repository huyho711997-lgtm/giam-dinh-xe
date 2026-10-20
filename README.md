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
