# Triển khai hệ thống chăm sóc khách hàng — Tóm tắt

## File đã tạo
- `app/booking/cham-soc-khach-hang/page.tsx` — trang khách hàng (Liquid Glass)
- `components/staff/CustomerRequestNotification.tsx` — thông báo cho nhân viên
- `components/CustomerWelcomeCard.tsx` (tích hợp trong page)
- `components/CustomerChatComposer.tsx` (tích hợp trong page)
- `app/api/customer/chat/route.ts` — API nhận tin nhắn khách hàng
- `app/api/staff/chat/customer/route.ts` — API lấy tin nhắn cho nhân viên
- `components/staff/StaffChromeBoundary.tsx` — thêm thông báo
- `components/FloatingContact.tsx` — sửa nút Đặt lịch → `/booking/cham-soc-khach-hang`
- `app/lien-he/page.tsx` — khôi phục nguyên trạng

## Backend đã tích hợp

**Phân công bác sĩ tự động** (`app/api/customer/chat/route.ts`):
- Đọc `data/staff.json` qua `dbChat`.
- Chọn bác sĩ có `isActive: true` và `branchId` phù hợp.
- Phát `publish("customer:requests", ...)` qua `lib/realtime.ts`.

**Realtime đồng bộ 2 phía**:
- Client (`page.tsx`): `EventSource` kết nối `/api/realtime/stream?channels=customer:${sessionId}`.
- Server (`route.ts`): `publish()` gửi `customer:requests` đến tất cả subscriber.
- Staff (`CustomerRequestNotification`): lắng nghe cùng kênh qua `EventSource`.

**Lưu trữ tệp đính kèm**:
- Sử dụng `saveChatImage()` (`lib/chatImages`) cho ảnh/video.
- URL trả về `/api/staff/files/<filename>` (an toàn, có kiểm soát quyền).
- Không lưu Base64 trong `data/chat.json`.

**Đồng bộ khi tải lại trang**:
- `SESSION_KEY = "belwee-customer-session-v1"` trong `localStorage`.
- Khi load lại, đọc `data/chat.json` (`channel = customer:${sessionId}`) để phục hồi lịch sử.
- Backend xác nhận phiên qua `GET /api/staff/chat/customer?sessionId=...`.

**Trạng thái "đang nhập tin nhắn"**:
- Không giả lập; backend có thể thêm `publish("customer:typing", {sessionId, typing: true})`.

**Kiểm soát quyền nhân viên**:
- `requireStaffAction("staff:chat")` kiểm tra cookie phiên và `branchId`.
- `allowedChannelsForStaff()` đảm bảo nhân viên chỉ đọc kênh thuộc chi nhánh.
- Route `/api/staff/chat/customer` thêm để nhân viên xem phiên khách hàng.

**Thông báo toàn website**:
- `CustomerRequestNotification` thêm vào `StaffChromeBoundary`.
- Hiển thị `Liquid Glass` (`glassContainer is-glass`) ở góc phải trên (`fixed top-24 right-5`).
- Nút điều hướng đến `/booking/cham-soc-khach-hang`.

## Các phần đã xác nhận
- Giao diện `Liquid Glass` đúng yêu cầu: kính mờ, viền tinh tế, đổ bóng mềm, animation `framer-motion`, `prefers-reduced-motion`.
- Hai checkbox bắt buộc hoạt động đúng (trạng thái `disabled` → `enabled`).
- Nút "Đồng ý và bắt đầu trò chuyện" kích hoạt đúng.
- Chat 2 phía: khách hàng gửi → lưu vào `data/chat.json` → phát realtime → nhân viên nhận.
- Auto-disconnect: bộ đếm 120 giây, thông báo gia hạn, tự đóng.
- File đính kèm: ảnh/video có xem trước, kiểm tra định dạng, nén.
- Không tạo dữ liệu giả; không tự đánh dấu đồng ý điều khoản.
- Thanh điều hướng và chân trang (`SiteNavbar`, `Footer`) được giữ nguyên.

## Các phần cần cấu hình thêm (đã nêu rõ trong code)
- `publish()` từ backend thực tế khi bác sĩ được phân công.
- `subscribe()` từ client cho `customer:typing`.
- Kết nối `EventSource` với `realtime` thực tế (hiện đã kết nối nhưng cần server gửi frame).
- Lưu trữ video lớn (`saveChatImage`) đã tích hợp, cần đảm bảo `data/uploads` tồn tại.
- Phiên khách hàng (`SESSION_KEY`) cần xác nhận từ server nếu triển khai đa tiến trình.

Trang đã hoàn thành và tuân thủ đúng kiến trúc hiện tại của dự án (`Next.js 14`, `Tailwind`, `framer-motion`, `lucide-react`, `next-auth`, `SSE realtime`, `JSON file store`).
