/**
 * app/booking/loading.tsx
 *
 * Loading của segment /booking — Next render file này khi RSC của segment (hoặc
 * con như /[service], /tiem-ngua, /spa-grooming, /khach-san… chưa có loading
 * riêng) đang chờ. Route nền tối → dùng tone `ondark` của hệ Skeleton dùng
 * chung, khớp nền thật của trang (`#070b16`).
 */
import { PageSkeleton } from "@/app/lib/route-skeletons";

export default function Loading() {
  return (
    <div className="min-h-dvh w-full">
      <PageSkeleton pathname="/booking" />
    </div>
  );
}
