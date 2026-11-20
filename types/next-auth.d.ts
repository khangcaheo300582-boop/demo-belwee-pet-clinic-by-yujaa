// types/next-auth.d.ts
// Mở rộng kiểu của next-auth v4 để các trường do dự án tự thêm vào token/session
// được kiểm tra bởi TypeScript, thay vì phải ép `as any` ở callback.
//
// Trước đây `token.provider = (user as any).provider` và
// `(session.user as any).id = token.id` khiến sai chính tả ở biên giới định danh
// người dùng không bị phát hiện. Nay đã có kiểu thật.

import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  /**
   * `id` là khoá dùng để tra cứu bệnh án / lịch hẹn phía server
   * (xem app/api/staff/* và app/api/lay-lich-su).
   */
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }

  interface User {
    /** 'credentials' | 'google' — ghi ở callback jwt để phân biệt nguồn đăng nhập. */
    provider?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    /** Luôn được gán trong callback jwt mỗi khi có `user`; có thể vắng ở token cũ. */
    id?: string;
    provider?: string;
  }
}
