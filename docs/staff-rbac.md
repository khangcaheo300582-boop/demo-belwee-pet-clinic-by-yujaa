# Staff RBAC — ma trận quyền theo vai trò

Nguồn sự thật duy nhất: [`lib/staffPermissions.ts`](../lib/staffPermissions.ts).
Sửa ma trận ở **một chỗ duy nhất** — mọi route và UI đều đọc từ đó.

## Vì sao file này tồn tại

`StaffRole = 'ADMIN' | 'VET' | 'RECEPTIONIST'` được khai báo, ghi vào
`data/staff.json`, hiển thị trên header dashboard — rồi **không được kiểm tra ở
bất kỳ đâu**. Mọi route ghi dữ liệu đều gọi `requireStaff()`, tức là bất kỳ ai
đăng nhập được cũng xuất hoá đơn và huỷ lịch. Vai trò chỉ là trang trí.

Bây giờ `requireStaffAction(action)` chặn ở server, và dashboard dùng cùng
`roleCan()` để ẩn nút. Việc ẩn nút là **UX**, không phải bảo mật — nếu bỏ
gate ở server thì nút vẫn bị chặn.

## Ma trận

| Hành động | ADMIN | VET | RECEPTIONIST |
| --- | :---: | :---: | :---: |
| `appointment:view` — xem hàng đợi, bệnh án, hoá đơn | ✓ | ✓ | ✓ |
| `appointment:confirm` — xác nhận lịch hẹn | ✓ | ✓ | ✓ |
| `appointment:cancel` — huỷ lịch hẹn | ✓ | ✗ | ✓ |
| `diagnosis:write` — ghi chẩn đoán / hướng điều trị / file | ✓ | ✓ | ✗ |
| `file:upload` — tải file lên | ✓ | ✓ | ✓ |
| `billing:write` — xuất hoá đơn, đánh dấu hoàn thành | ✓ | ✗ | ✓ |

### Lý do

- **VET** sở hữu phần lâm sàng: khám, chẩn đoán, kế hoạch điều trị, tệp đính
  kèm. Không huỷ lịch và không đụng vào tiền.
- **RECEPTIONIST** sở hữu quầy lễ tân: xác nhận, huỷ, xuất hoá đơn. Không ghi
  chẩn đoán — một ghi chú do lễ tân gõ **không phân biệt được** với ghi chú của
  bác sĩ trong bệnh án.
- **ADMIN** làm được tất cả. Ma trận không bao giờ khoá admin ra khỏi dashboard
  của chính họ.

### Vì sao không có `appointment:complete`

`PATCH /api/staff/appointments/[id]` chỉ cho phép `COMPLETED` khi bệnh án **đã có
hoá đơn**. Hoàn tất lịch về bản chất là một thao tác tiền, nên nó dùng chung
`billing:write` thay vì thêm một quyền giả.

### Vai trò lạ → từ chối mặc định

`normalizeRole()` chỉ nhận `ADMIN` / `VET` / `RECEPTIONIST` (không phân biệt hoa
thường). Mọi giá trị khác — kể cả `undefined`, `null`, chuỗi rỗng — nhận tập quyền
**rỗng**. Một `data/staff.json` hỏng không thể mở rộng quyền.

## Route nào gate gì

| Route | Quyền |
| --- | --- |
| `GET /api/staff/appointments` | `appointment:view` |
| `GET /api/staff/records` | `appointment:view` |
| `GET /api/staff/receipts` | `requireStaff()` (xem) |
| `GET /api/staff/me` | `requireStaff()` |
| `POST /api/staff/login` | công khai |
| `POST /api/staff/logout` | công khai |
| `POST /api/staff/receipts` | `billing:write` |
| `POST /api/staff/upload` | `file:upload` |
| `PATCH /api/staff/appointments/[id]` | **theo từng field** trong body |
| `PATCH /api/staff/records/[id]` | `diagnosis:write` và/hoặc `billing:write` |
| `GET /api/staff/files/[name]` | staff: tất cả · khách: chỉ file của chính họ |

`PATCH /api/staff/appointments/[id]` là route duy nhất gate **theo field**, vì
một body có thể vừa đổi trạng thái vừa ghi chẩn đoán:

```jsonc
{ "status": "CANCELLED", "diagnose": "..." }  // cần appointment:cancel
                                               // V + diagnosis:write
```

Route gom danh sách quyền cần thiết từ body đã parse, rồi kiểm tra **tất cả**;
thiếu một quyền là `403` kèm message tiếng Việt. Thứ tự kiểm tra là:
xác thực (401) → phân quyền (403) → nghiệp vụ/state machine (400).

## Thêm vai trò mới

1. Thêm union member vào `StaffRole` trong `lib/staff-service.ts`.
2. Thêm tên vào `KNOWN_ROLES` trong `lib/staffPermissions.ts` — **bắt buộc**,
   nếu không `normalizeRole()` sẽ trả `null` và tài khoản bị từ chối toàn bộ.
3. Thêm một hàng vào `MATRIX`.
4. Thêm biểu đồ vào bảng ở trên.

## Thêm hành động mới

Thêm member vào `StaffAction`, khai báo trong `MATRIX` cho cả 3 vai trò, thêm
nhánh message trong `permissionDeniedMessage()`, rồi dùng
`requireStaffAction('<hành động>')` ở route và `roleCan()` ở component.
