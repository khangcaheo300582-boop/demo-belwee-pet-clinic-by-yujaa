import { PageSkeleton } from "@/app/lib/route-skeletons";

export default function Loading() {
  return (
    <div className="min-h-dvh w-full">
      <PageSkeleton pathname="/ChiTietBookingForm" />
    </div>
  );
}
