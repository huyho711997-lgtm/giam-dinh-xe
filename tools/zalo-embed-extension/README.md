# Tiện ích "TASCO – Cho phép nhúng Zalo Web"

Zalo Web (`chat.zalo.me`, `id.zalo.me`) mặc định không hiển thị khi nhúng vào trang khác, nên khung Zalo trong app TASCO DLK có thể bị trắng.
Tiện ích này chạy **ngay trên trình duyệt của bạn** (không qua máy chủ nào) và làm hai việc:

1. Gỡ các tiêu đề `X-Frame-Options` / `Content-Security-Policy` của Zalo, **chỉ** cho khung nhúng do app TASCO mở (`rules.json`).
2. Đổi cookie của `zalo.me` / `zaloapp.com` sang `SameSite=None; Secure` để phiên đăng nhập hoạt động trong khung (`background.js`).

## Cài đặt (một lần mỗi máy, Chrome / Edge / Brave)
1. Tải thư mục này về máy (hoặc tải cả kho mã rồi mở thư mục `tools/zalo-embed-extension`).
2. Mở `chrome://extensions`, bật **Chế độ dành cho nhà phát triển** (Developer mode).
3. Bấm **Tải tiện ích đã giải nén** (Load unpacked) và chọn thư mục `zalo-embed-extension`.
4. Tải lại trang app, bấm nút Zalo ở góc phải-dưới, quét mã QR đăng nhập trong khung.

Không dùng được trong cửa sổ ẩn danh (trừ khi bật "Cho phép ở chế độ ẩn danh" cho tiện ích) và không dùng được trên Firefox/Safari.

## Thêm tên miền khác của app
Sửa `initiatorDomains` trong `rules.json` và `matches` trong `manifest.json`, rồi bấm **Tải lại** ở `chrome://extensions`.

## Đánh đổi bảo mật (đọc trước khi cài)
- Cookie Zalo trên máy bạn được gửi cả khi trang khác nhúng Zalo; chỉ cài trên máy cá nhân/công việc của bạn và gỡ khi không dùng.
- Tiêu đề chống nhúng chỉ bị gỡ khi trang nhúng là tên miền app trong `rules.json`; các trang khác vẫn không nhúng được Zalo.
- Tiện ích không đọc, không gửi đi nội dung tin nhắn hay thông tin đăng nhập; bạn tự quét mã QR trong khung Zalo.
- Cách này không do Zalo hỗ trợ chính thức; Zalo có thể thay đổi bất cứ lúc nào làm khung lại bị trắng. Khi đó dùng nút **Mở cửa sổ nổi** trong khung Zalo.

## Gỡ
`chrome://extensions` → **Xóa** tiện ích. Cookie Zalo trở về như Zalo đặt ban đầu sau lần đăng nhập kế tiếp.
