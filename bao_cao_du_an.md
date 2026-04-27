# Báo Cáo Dự Án: VRTX Studio Portfolio

## III. Kiến trúc và Thiết kế

### 1. Kiến trúc tổng quan
Kiến trúc của ứng dụng được xây dựng theo mô hình Static Site Application kết hợp với kết xuất đồ họa WebGL phía client. Quy trình tổng quan bao gồm việc tải các tài nguyên tĩnh từ CDN (Cloudflare Pages), sau đó trình duyệt biên dịch và thực thi luồng tương tác:

- **Sơ đồ tổng quan luồng xử lý:**
  `Input người dùng (Chuột/Phím/Cảm ứng)` -> `Trình quản lý sự kiện (Event Listeners)` -> `DOM Manipulation & WebGL Render Loop` -> `Màn hình hiển thị (Screen)`

Các module chức năng chính của hệ thống bao gồm:
1.  **Module Giao diện (UI/DOM Module):** Chịu trách nhiệm quản lý cấu trúc HTML đa trang (`index.html`, `works.html`, v.v.) và định dạng CSS. Đầu vào là dữ liệu tĩnh, đầu ra là giao diện hiển thị cơ bản, đảm bảo tính đáp ứng (responsive).
2.  **Module Đồ họa 3D (WebGL Module):** Đảm nhiệm việc kết xuất không gian 3D trên trang chủ. Đầu vào là ma trận không gian, tọa độ chuột người dùng và các thông số vật liệu; đầu ra là Canvas chứa các đối tượng đồ họa 3D được cập nhật theo thời gian thực (60 FPS).
3.  **Module Tương tác & Trải nghiệm (Interaction Module):** Quản lý các hiệu ứng chuyển động tĩnh (animations), luồng chuyển trang (page transitions), chế độ sáng/tối (Dark/Light mode) và cuộn trang (scroll reveal). 

### 2. Yêu cầu thiết kế
Bài toán tổng quát được phân rã thành các bài toán kỹ thuật nhỏ hơn nhằm tối ưu hóa quá trình phát triển:

- **Bài toán 1: Xây dựng hệ thống đồ họa 3D tương tác.**
  - *Phân tích:* Cần một điểm nhấn trực quan ở trang chủ thể hiện nhận diện thương hiệu (Logo) dưới dạng 3D, có khả năng phản hồi thao tác của người dùng.
  - *Giải pháp lý thuyết:* Áp dụng thư viện Three.js để khởi tạo `Scene`, `PerspectiveCamera` và `WebGLRenderer`. Logo được dựng bằng `TextGeometry` kết hợp `MeshPhysicalMaterial` để mô phỏng vật liệu obsidian có tính chất phản quang (iridescence).
- **Bài toán 2: Đảm bảo trải nghiệm chuyển trang mượt mà (Seamless Navigation).**
  - *Phân tích:* Do kiến trúc đa trang (multi-page), việc chuyển đổi giữa các file HTML thông thường sẽ gây ra hiện tượng chớp màn hình trắng (flash of white).
  - *Giải pháp lý thuyết:* Triển khai thuật toán chặn sự kiện điều hướng mặc định (Event Intercept), khởi chạy hiệu ứng fade-out qua lớp overlay CSS, sau đó mới thực thi `window.location.href`.
- **Bài toán 3: Quản lý trạng thái giao diện (Theme State Management).**
  - *Phân tích:* Hệ thống cần hỗ trợ giao diện Sáng/Tối nhưng phải giữ được trạng thái đồng nhất khi người dùng tải lại trang hoặc chuyển trang.
  - *Giải pháp lý thuyết:* Sử dụng `localStorage` để lưu trữ biến trạng thái, kết hợp với các biến môi trường (CSS Custom Properties) để thay đổi đồng loạt phổ màu của toàn bộ ứng dụng.

---

## IV. Triển khai

### 1. Cấu trúc dự án
Dự án được phân bổ theo mô hình chuẩn của một ứng dụng Front-end hiện đại sử dụng công cụ đóng gói Vite:

- `src/assets/`: Lưu trữ các tệp phương tiện (hình ảnh `.webp`, video `.mp4`).
- `src/styles/`: Chứa tập hợp các file CSS được phân tách theo module (`base.css`, `home.css`, v.v.).
- `src/scripts/`: Khối logic điều khiển JavaScript (`main.js` cho Three.js, `transitions.js` cho UI/UX, `contact.js` cho xử lý biểu mẫu).
- `*.html`: Các tệp HTML gốc định nghĩa cấu trúc từng trang độc lập.

### 2. Các khối chức năng chính
Hai module cốt lõi đã được triển khai chuyên sâu nhằm đáp ứng yêu cầu thiết kế:

#### 2.1. Module Đồ họa 3D (`main.js`)
- **Triển khai:** Khởi tạo môi trường WebGL. Thay vì sử dụng model nhập từ bên ngoài, Logo được tạo trực tiếp từ file font chữ bằng `TTFLoader` và `TextGeometry`. Quá trình hậu kỳ (Post-processing) sử dụng `UnrealBloomPass` để tạo hiệu ứng phát sáng mờ và `RGBShiftShader` cho hiệu ứng quang sai.
- **Đánh giá & Phát sinh kỹ thuật:** Quá trình triển khai khớp với thiết kế lý thuyết. Tuy nhiên, trong thực tế, `TextGeometry` tạo ra lưới đa giác (topology) quá phức tạp gây sụt giảm khung hình.
- **Giải quyết:** Thực hiện tinh chỉnh thuật toán tạo wireframe: tính toán khoảng cách vector và độ phẳng của bề mặt để tự động loại bỏ các đoạn thẳng không cần thiết trên bề mặt logo, giảm tải cho bộ xử lý đồ họa (GPU).

#### 2.2. Module Tương tác (`transitions.js`)
- **Triển khai:** Sử dụng API `IntersectionObserver` để nhận diện vị trí cuộn của người dùng, từ đó kích hoạt các lớp CSS (classes) tạo hiệu ứng xuất hiện (fade-in) dần cho văn bản và bộ đếm số thống kê.
- **Đánh giá & Phát sinh kỹ thuật:** Trải nghiệm chuyển trang trên các thiết bị di động đôi lúc bị khựng do trình duyệt khôi phục vị trí cuộn cũ (scroll restoration).
- **Giải quyết:** Sử dụng API `history.scrollRestoration = 'manual'` và ép thanh cuộn về vị trí tọa độ `(0,0)` khi sự kiện `pageshow` được kích hoạt.

### 3. Demo giao diện

*(Lưu ý: Các hình ảnh dưới đây là hình ảnh minh họa cho các màn hình theo luồng người dùng)*

![Màn hình trang chủ với đồ họa 3D logo VRTX](file:///c:/Users/Anomal/Documents/GitHub/assets/images/VRTX_BANNER.webp)
*Hình 1. Màn hình bắt đầu của ứng dụng (Trang chủ).*
**Mô tả:** Giao diện trang chủ tập trung hoàn toàn vào logo 3D tương tác. Thiết kế tối giản (minimalist) nhằm thu hút toàn bộ sự chú ý của người dùng vào yếu tố thị giác đồ họa. Trải nghiệm bắt đầu bằng không gian 3D ấn tượng.

![Màn hình danh sách dự án - Works](file:///c:/Users/Anomal/Documents/GitHub/assets/images/VRTX_BANNER.webp)
*Hình 2. Màn hình danh mục dự án (Works).*
**Mô tả:** Hiển thị danh sách các dự án dưới dạng danh sách kết hợp chức năng theo dõi con trỏ chuột (custom cursor) để xem trước hình ảnh thu nhỏ (thumbnail). Thiết kế này tạo cảm giác hiện đại và tăng tính tương tác khi khách hàng duyệt qua các sản phẩm của Studio.

---

## V. Kết quả và Đánh giá

### 1. Kết quả
Dự án đã đạt được các mục tiêu cốt lõi đề ra ban đầu. Ứng dụng hoạt động ổn định như một portfolio điện tử chuyên nghiệp, thể hiện được năng lực thiết kế đồ họa 3D trực tiếp trên trình duyệt Web mà không cần cài đặt phần mềm thứ ba.

### 2. Đánh giá
- **Hiệu năng:** 
  - Ứng dụng chạy mượt mà đạt tốc độ làm mới 60 FPS trên các thiết bị máy tính để bàn có GPU độc lập. Tuy nhiên, trên một số thiết bị di động cũ, hiệu ứng `UnrealBloomPass` đôi lúc gây hiện tượng trễ khung hình nhẹ. 
  - Chưa ghi nhận lỗi (bug) nghiêm trọng nào ảnh hưởng đến trải nghiệm người dùng luồng chính.
- **Ưu điểm:** Tích hợp thành công WebGL vào trải nghiệm web truyền thống một cách mượt mà; cấu trúc mã nguồn thuần (Vanilla Javascript) giúp website nhẹ, độc lập và dễ kiểm soát. Kiến trúc đa trang hỗ trợ tốt cho SEO.
- **Nhược điểm & Định hướng:** Kích thước bundle của Three.js tương đối lớn nếu người dùng mạng yếu tải trang lần đầu. Định hướng cải thiện: Sử dụng kỹ thuật Lazy Loading cho script 3D, hoặc cân nhắc nâng cấp lên React Three Fiber để tối ưu hóa quản lý trạng thái nếu dự án tiếp tục mở rộng quy mô sản phẩm.

---

## VI. Quá trình làm việc nhóm

### 1. Phân công công việc
Dưới đây là bảng thống kê phân công công việc dựa trên vai trò chuyên môn của từng thành viên trong nhóm:

Bảng 1. Phân công công việc.

| Họ tên | MSV | Phân công | Tỉ lệ đóng góp (%) |
| :--- | :--- | :--- | :--- |
| Trần Gia Bảo | [Mã SV] | Quản lý dự án & Cấu trúc nội dung | 20% |
| Hoàng Đức Duy | [Mã SV] | Lập trình đồ họa 3D (Three.js) & WebGL | 20% |
| Nguyễn Phạm Sơn Hà | [Mã SV] | Thiết kế UI/UX & Tối ưu Responsive CSS | 20% |
| Hồ Trung Hiếu | [Mã SV] | Tích hợp Media (Âm thanh, Video) & Testing | 20% |
| Trần Khánh Long | [Mã SV] | Xử lý hiệu ứng Tương tác (Transitions, Animations) | 20% |

### 2. Tuyên bố về việc sử dụng AI
Trong suốt quá trình triển khai dự án, nhóm đã sử dụng các công cụ Trí tuệ Nhân tạo (AI) với các mục đích hỗ trợ cụ thể như sau nhằm tối ưu hóa tiến độ công việc:
- **Tối ưu hóa mã nguồn (Code Refactoring):** Sử dụng AI để đề xuất giải pháp tối ưu hóa thuật toán tính toán và cắt gọt đỉnh (vertices) cho `TextGeometry` nhằm tăng số khung hình trên giây (FPS).
- **Hỗ trợ Debug WebGL:** Dùng AI hỗ trợ phát hiện lỗi logic trong quá trình cấu hình cường độ sáng (lighting rig) và các thông số cho Material của logo Three.js.
- **Hỗ trợ viết Script Transition:** Sử dụng AI để tham khảo mẫu logic xử lý bắt sự kiện điều hướng (intercept navigation event) để tạo lớp overlay chuyển tiếp mượt mà trước khi thay đổi URL.

---

## TÀI LIỆU THAM KHẢO

1. **Three.js Documentation:** Tài liệu chính thức về thư viện đồ họa 3D. Hỗ trợ cách sử dụng TextGeometry và Post-processing. *[https://threejs.org/docs/]*
2. **MDN Web Docs:** Tài liệu tham khảo về API web tiêu chuẩn, đặc biệt là `IntersectionObserver` và `LocalStorage`. *[https://developer.mozilla.org/vi/]*
3. **Vitejs Dev Guide:** Tài liệu tham khảo việc thiết lập và đóng gói tài nguyên dự án Front-end hiện đại. *[https://vitejs.dev/guide/]*
4. **Google Fonts (Montserrat):** Phông chữ sử dụng làm nguyên liệu chuyển đổi file `.ttf` sang JSON 3D Font. *[https://fonts.google.com/specimen/Montserrat]*
