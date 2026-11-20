"use server";

/**
 * app/actions/care-reminder.ts
 *
 * Hạng mục 25.7 — Nhắc lịch chăm sóc (opt-in), Server Action + Zod.
 *
 * ── ⚠️ CHƯA KẾT NỐI GỬI THẬT ───────────────────────────────────────────────
 * Action này **kiểm tra dữ liệu rồi trả về thành công**, nhưng KHÔNG gửi email,
 * KHÔNG ghi vào hệ thống nhắc lịch, KHÔNG lưu vào CRM. Lý do:
 *   1. Dự án chưa có kênh nhắc lịch cho khách (chỉ có `/api/cron/reminders`
 *      nhắn bác sĩ/nhân viên — `lib/dbReminderQueue.ts`).
 *   2. Nội dung đồng ý và thời hạn lưu dữ liệu CHƯA được pháp chế duyệt theo
 *      Nghị định 13/2023/NĐ-CP. Ta không tự kết luận pháp lý.
 * Nên giao diện hiển thị rõ chữ "chưa được nối với dịch vụ gửi thật" để không
 * ai tưởng đã đăng ký xong thật.
 *
 * Khi chủ dự án duyệt, chỉ cần thay phần `TODO` bên dưới — không phải sửa lại
 * form, không phải sửa lại schema.
 *
 * ── RÀNG BUỘC ────────────────────────────────────────────────────────────────
 * • Validate bằng Zod ở PHÍA SERVER (không tin vào `required` của HTML).
 * • Trả lỗi có cấu trúc, không ném exception ra phía client.
 * • Không log dữ liệu cá nhân vào console.
 */

import { z } from "zod";

export interface CareReminderResult {
  status: "idle" | "success" | "error";
  /** Khoá i18n để client hiển thị đúng câu — không trả về câu văn từ server. */
  messageKey?: "remind.success" | "remind.error";
  /** Lỗi theo từng trường, key là `name` của input. */
  fieldErrors?: Partial<Record<"name" | "email" | "consent", string>>;
}

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "name_required" })
    .max(120, { message: "name_too_long" }),
  email: z
    .string()
    .trim()
    // Không dùng `z.string().email()` vì biểu thức của nó thiếu một số trường
    // hợp lệ; dùng `safeParse` + kiểm tra rõ ràng cho thông báo lỗi.
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), { message: "email_invalid" }),
  pet: z.string().trim().max(80, { message: "pet_too_long" }),
  consent: z.literal("on", { message: "consent_required" }),
});

export async function submitCareReminder(
  _prev: CareReminderResult,
  formData: FormData
): Promise<CareReminderResult> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    pet: formData.get("pet"),
    consent: formData.get("consent"),
  });

  if (!parsed.success) {
    const fieldErrors: CareReminderResult["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "name" || field === "email" || field === "consent") {
        // Chỉ giữ lỗi đầu tiên mỗi trường.
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
    }
    return { status: "error", messageKey: "remind.error", fieldErrors };
  }

  // ── TODO(chủ dự án): nối vào kênh nhắc lịch thật ───────────────────────────
  // 1. Ghi vào bảng "người đồng ý nhận nhắc lịch" kèm mốc thời gian + nguồn.
  // 2. Hàng PHẢI có cờ đồng ý + link huỷ đăng ký đi kèm mỗi email.
  // 3. Nội dung email KHÔNG được chứa thông tin bệnh án của thú cưng khác.
  // Hiện tại: dữ liệu chỉ tồn tại trong vòng đời của request rồi bị bỏ.
  void parsed.data;

  return { status: "success", messageKey: "remind.success" };
}