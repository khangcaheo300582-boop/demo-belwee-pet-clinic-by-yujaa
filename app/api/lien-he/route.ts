// app/api/lien-he/route.ts
// Nhận yêu cầu hỗ trợ nhanh từ trang Liên hệ (/lien-he) và gửi về hộp thư Belwee.
// Dùng chung transporter của lib/mailer (retry + timeout, không chặn request khác).

import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { validateRequired, validatePhone, readJsonBody } from '@/lib/validators';
import { isBelweeHotline } from '@/lib/clinics';

export async function POST(request: Request) {
  // Parsed outside the try below so a malformed body is answered with 400
  // instead of being caught as "Lỗi server xử lý liên hệ." (500).
  const parsed = await readJsonBody<{ name?: string; phone?: string; message?: string }>(request);
  if (!parsed.ok) {
    return NextResponse.json({ success: false, message: parsed.message }, { status: 400 });
  }

  try {
    const body = parsed.data;
    const name = String(body?.name ?? '').trim();
    const phone = String(body?.phone ?? '').trim();
    const message = String(body?.message ?? '').trim();

    const nameError = validateRequired(name, 'Họ tên');
    if (nameError) {
      return NextResponse.json({ success: false, message: nameError.message }, { status: 400 });
    }

    const phoneError = validatePhone(phone);
    if (phoneError) {
      return NextResponse.json({ success: false, message: phoneError.message }, { status: 400 });
    }

    // Chặn số hotline của Belwee — ô này dành cho số điện thoại cá nhân.
    if (isBelweeHotline(phone)) {
      return NextResponse.json(
        { success: false, message: 'Vui lòng điền số điện thoại của bạn thay vì số hotline của Belwee' },
        { status: 400 }
      );
    }

    const messageError = validateRequired(message, 'Nội dung');
    if (messageError) {
      return NextResponse.json({ success: false, message: messageError.message }, { status: 400 });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return NextResponse.json({ success: false, message: 'Lỗi cấu hình email hệ thống.' }, { status: 500 });
    }

    const escape = (value: string) =>
      value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const sent = await sendMail({
      to: process.env.EMAIL_USER,
      subject: `✉️ [LIÊN HỆ] Yêu cầu hỗ trợ từ ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #2563eb; margin: 0 0 12px;">Yêu cầu hỗ trợ từ trang Liên hệ</h2>
          <p style="margin: 4px 0;"><b>Họ tên:</b> ${escape(name)}</p>
          <p style="margin: 4px 0;"><b>Số điện thoại:</b> ${escape(phone)}</p>
          <p style="margin: 12px 0 4px;"><b>Nội dung:</b></p>
          <div style="white-space: pre-wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">${escape(message)}</div>
        </div>
      `,
    });

    if (!sent) {
      return NextResponse.json(
        { success: false, message: 'Không thể gửi yêu cầu, vui lòng gọi hotline 0772 003 915.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('❌ Lỗi API liên hệ:', error);
    return NextResponse.json({ success: false, message: 'Lỗi server xử lý liên hệ.' }, { status: 500 });
  }
}
