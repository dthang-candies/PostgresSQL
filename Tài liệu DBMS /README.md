# Spatial Web Viewer (PostgreSQL/PostGIS)

Web app hiển thị dữ liệu không gian từ PostgreSQL/PostGIS lên bản đồ Leaflet.

## 1) Cài đặt

Yêu cầu:
- Node.js 18+
- PostgreSQL có PostGIS extension

Cài dependency:

```bash
npm install
```

## 2) Cấu hình môi trường

Tạo file `.env` từ mẫu:

```bash
cp .env.example .env
```

Sửa `.env`:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/your_database
MAX_FEATURES=10000
```

## 3) Chạy ứng dụng

```bash
npm start
```

Mở trình duyệt: `http://localhost:3000`

## API

- `GET /api/health`: kiểm tra kết nối DB
- `GET /api/layers`: lấy danh sách bảng có cột geometry
- `GET /api/layers/:schema/:table`: lấy GeoJSON cho 1 layer

## Gợi ý kiểm tra dữ liệu PostGIS

```sql
SELECT f_table_schema, f_table_name, f_geometry_column, type, srid
FROM public.geometry_columns
ORDER BY f_table_schema, f_table_name;
```

Nếu đã import các shapefile `bounds`, `building`, `garbadge`, `road`, app sẽ tự hiển thị chúng trong danh sách layer.
