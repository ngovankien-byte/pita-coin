# Hướng dẫn đưa lên pita-napxu.42web.io (BẢN TỔNG HỢP)

Tôi đã tạo cho bạn một file duy nhất chứa tất cả mã nguồn: `index_infinityfree.html`.

### Bước 1: Tải mã nguồn về máy
1. Nhấn vào nút **Export** hoặc **Settings (⚙️)** ở góc trên bên phải màn hình AI Studio.
2. Chọn **Download as ZIP**.
3. Giải nén file ZIP đó trên máy tính của bạn.

### Bước 2: Chuẩn bị file để tải lên
1. Tìm file `index_infinityfree.html` trong thư mục vừa giải nén.
2. **Đổi tên** nó thành `index.html`.
3. Tìm file `.htaccess` (quan trọng để bảo mật và điều hướng).

### Bước 3: Tải lên InfinityFree
1. Đăng nhập vào **File Manager** (Trình quản lý tệp) của InfinityFree.
2. Mở thư mục `htdocs`.
3. Tải file `index.html` (đã đổi tên ở bước trên) lên đây.
4. Tải file `.htaccess` lên cùng thư mục `htdocs`.

### Bước 4: Cấu hình Firebase
Hệ thống nạp xu cần được cấp quyền chạy trên tên miền mới của bạn:
1. Truy cập [Firebase Console](https://console.firebase.google.com/).
2. Chọn dự án của bạn.
3. Vào **Authentication** > **Settings** > **Authorized domains**.
4. Nhấn **Add Domain** và nhập: `pita-napxu.42web.io`.

---
Bây giờ bạn có thể truy cập [http://pita-napxu.42web.io](http://pita-napxu.42web.io) để kiểm tra kết quả!
