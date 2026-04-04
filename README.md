# Container Packing Pro

## Cách chạy nhanh
1) Cài dependencies: `npm run install-all`
2) Khởi tạo dữ liệu mẫu:
   ```bash
   cd server
   npm run reset-db
   ```
3) Chạy dev: `npm run dev` (ở thư mục gốc)
4) Mở trình duyệt: http://localhost:3000  
   Đăng nhập demo: **admin / 123456**

## Tính năng mới
- AI Pro nâng cấp: tối ưu 3D có COG, cân bằng tải, kế hoạch step-by-step.
- Tối ưu nhiều container: `POST /api/optimize/multi`.
- Nhập Excel: `POST /api/import/excel` (form-data file) & tải template `/api/import/template/excel`.
- Seed dữ liệu mẫu và admin qua `npm run reset-db`.

## Biến môi trường
Tạo file `server/.env` (có sẵn `.env.example`):
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/container-packing-pro
JWT_SECRET=change-me
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```
