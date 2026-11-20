/**
 * Khai báo kiểu cho CSS đi kèm package.
 *
 * Leaflet xuất file CSS trong package, và Next.js xử lý được việc import nó
 * từ một client component. Nhưng TypeScript mặc định không có kiểu cho file
 * `.css`, nên `import "leaflet/dist/leaflet.css"` sẽ báo TS2307 dù build chạy
 * được. Khai báo ở đây cho compiler biết, không ảnh hưởng lúc chạy.
 */
declare module "*.css";
declare module "leaflet/dist/leaflet.css";