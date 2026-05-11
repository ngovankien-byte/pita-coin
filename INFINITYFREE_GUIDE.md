# Hướng dẫn đưa lên pita-napxu.42web.io

### Bước 1: Tải mã nguồn về máy (Export to ZIP)
Vì trình duyệt không hỗ trợ tải từng file riêng lẻ bằng cách chuột phải, bạn hãy làm như sau:
1. Nhìn lên góc trên bên phải màn hình AI Studio.
2. Nhấn vào biểu tượng **Settings** (hình bánh răng ⚙️) hoặc nút **Export**.
3. Chọn **Download as ZIP** (Tải về dạng .zip).
4. Sau khi tải về, hãy giải nén file đó trên máy tính của bạn.
5. Bạn sẽ thấy file `PitaCoins_InfinityFree.html` và `.htaccess` nằm bên trong.

### Bước 2: Cấu hình Firebase (Bắt buộc)
Để hệ thống nạp xu hoạt động trên tên miền mới, bạn phải:
1. Truy cập [Firebase Console](https://console.firebase.google.com/).
2. Chọn dự án: `gen-lang-client-0194923047`.
3. Vào **Authentication** > **Settings** > **Authorized domains**.
4. Nhấn **Add Domain** và nhập: `pita-napxu.42web.io`.

### Bước 3: Tải lên InfinityFree
1. Đăng nhập vào **File Manager** của InfinityFree.
2. Mở thư mục `htdocs`.
3. Tải file `PitaCoins_InfinityFree.html` lên và **đổi tên** nó thành `index.html`.
4. Tải file `.htaccess` lên cùng thư mục đó.

---
**Mẹo:** Nếu bạn muốn đổi số tài khoản hay Zalo, hãy mở file `PitaCoins_InfinityFree.html` bằng Notepad, tìm phần `BANK_CONFIG` và sửa lại trước khi tải lên.
