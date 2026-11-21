# Kế hoạch & thiết kế — Hệ thống nhắc lịch & thông báo (feat/notification-engine)

Trạng thái: Đã triển khai + smoke (SW, Push VAPID, desktop Notification, routes, admin page).

## 1. Mục tiêu

Biến hệ thống nhắc lịch (email T+2 via `/api/cron/reminders`) thành hệ thống nhắc đa loại, đa kênh:

- **Nhắc lịch hẹn, tiêm vắc-xin/tiêm ngừa, tái khám/xét nghiệm định kỳ, chăm sóc.** Payment + Zalo/WhatsApp/LINE/Telegram/IVR: Phase 2+ (payment cần dữ liệu billing; IVR cho lịch trọng điểm).

## 2. Kiến trúc

```
                    ┌──────────────────────────────────────────────────────┐
                    │ computeDue (engine)                                  │
                    │  bookings CONFIRMED (T+2, golden hour)               │
                    │  records: nextDoseDueAt/followUpDueAt (golden hour)  │
                    │  careRegistrations (consent, biweekly)               │
                    └───────────────┬──────────────────────────────────────┘
                                    │ DueItem { type, scope, ownerEmail, dueAt, sendAt, channels[] }
                                    ▼
        ┌─────────────────────────────────────────────────────────────┐
        │ runEngine: enqueue → due rows (status QUEUED, idempotencyKey=type:scope:entity:dueAt)
        │            → deliverChannels: prefs(master/type/channel) × row.channels          │
        │            → log (event: queued→sent/failed)                  │
        │            → markSent/markComplete/markFailed (retry < 8)     │
        └───────┬──────────────┬──────────────────┬───────────────────┬────┘
                ▼              ▼                  ▼                   ▼
        ┌────────────┐   ┌─────────────┐   ┌────────────────┐   ┌────────────────┐
        │ email      │   │ webPush     │   │ desktop toast  │   │ later: Zalo/   │
        │ (smtp)     │   │ (push API)  │   │ (SSE+Notify)   │   │ WhatsApp/...   │
        └────────────┘   └─────────────┘   └────────────────┘   └────────────────┘
```

- **Queue**: `data/notification-queue.json` (idempotencyKey = type:scope.type:entityId:dueAt; status QUEUED/SENT/FAILED/CANCELLED; sentChannels[]; attempts).
- **Preferences**: `data/customer-notification-preferences.json` (master, channels{email,desktop,push}, types{...5...}, sendWindow, timezone; lazily migrated from legacy `notification-preferences.json`).
- **Subscriptions**: `data/push-subscriptions.json` (endpoint, p256dh/auth [thường null — Chrome dùng VAPID], subId hash(endpoint), unsubscribeToken).
- **Delivery logs**: `data/delivery-logs.json` (event: queued/sent/opened/clicked/unsubscribed).
- **Care regs**: `data/reminder-sources-extra.json` (name/email/pet/consent/unsubscribeToken/nextDueAt/repeatEveryMs).

## 3. Dữ liệu nguồn (tham khảo)

- Booking: `data/bookings.json` — `status: CONFIRMED` + time (T+2 send window, golden hour 9h).
- MedicalRecord: `data/records.json` — `nextDoseDueAt` (vaccination, tiêm sau 1 năm), `followUpDueAt` (tái khám sau 6 tháng) — + database seeds backfill dữ liệu cũ.
- Payment: Giai đoạn 2 — lệnh: receipts có totalAmount/createdAt — nếu dữ liệu được bổ sung → type 'payment'.

## 4. Channels (kênh, thiết bị)

| Kênh | Thiết bị | Cơ chế | Ghi chú |
|------|----------|--------|---------|
| email | laptop/PC/Mac | SMTP (app/lib/mail-service) — 2 lần thử transport-code | Tồn tại — nhắc chính. Open-rate tracking pixel + CTA redirect + unsubscribe one-click. |
| desktop | laptop/iPad/Mac/Linux — tab open | SSE toast (lib/realtime + dbNotifications) | Giữ hành vi cũ. |
| push (Web Push) | điện thoại/iPad/iPhone/laptop — nền | Service Worker + Push API (VAPID, web-push) | Swift iOS chỉ nhận khi PWA đã Add-to-Home-Screen (documented assumption). |

## 5. Invariants

- Invariant 6: Không nhắc khi khách tắt/từ chối — `channelsFor()` không đưa kênh tắt. Mọi kênh có cách hủy: email (unsubscribe link), push (token/subId), desktop (prefs).
- Hơn cả Email hiện tại không hứa "đã gửi": `sendEngineEmail` returns ok — adadter false nếu không gửi thật.
- ICSF: notification chỉ gửi phần personalization — không hứa about phones — no SMS by design.
- Rolling back: NOTIFICATIONS_ENGINE_ENABLED=false → engine chạy 0 nhắc; scheduler chuyển về /api/cron/reminders (legacy email cron).
- Data: new files (thêm mới — nothing destructive). Khi rollback: xóa notification-queue.json, push-subscriptions.json, delivery-logs.json, customer-notification-preferences.json; notification-preferences.json không bị sửa.

## 6. Todo/vướng tiếp theo

- **Giai đoạn 2**: Payment source (dữ liệu billing), edit tracking, tam thử nghiệm Web Push thực tế trên Mac/Android với nội dung thật (đã spike với mock).
- **Phase 5+**: Zalo OA, WhatsApp Business API, LINE OA, Telegram (adapters mở rộng lib/adapters/).
- **IVR**: nền tảng cho lịch hẹn đầy (cắt tóc, gâm răng) — gọi điện tự động xác nhận/chốt.
- **Native app**: PWA tích hợp widget badge (iOS)/Android Badging — sau khi engine ổn định.
- **Analytics**: report tự động trên màn hình quản trị (C4 done partially — prefs+subscriptions+queue).

## 7. Tech đã dùng (coi cập nhật)

- web-push@4 (server), Service Worker (public/sw.js), VAPID (generateVAPIDKeys), lib/notificationEngine (computeDue/runEngine), lib/adapters/{emailAdapter,webPushAdapter,desktopAdapter}, lib/pushSubscriptions, lib/deliveryLog, lib/notificationQueue, lib/customerNotificationPreferences, app/api/cron/notifications, app/api/admin/notifications/*, app/api/customer/notification-preferences, app/api/push/{subscribe,unsubscribe}, app/api/notifications/{track,latest,unsubscribe}, components/{BrowserNotificationsToggle,NotificationTypesCard,staff/StaffNotificationsPanel}, app/staff/notifications, app/trang-ca-nhan/page.tsx (thêm toggles).
