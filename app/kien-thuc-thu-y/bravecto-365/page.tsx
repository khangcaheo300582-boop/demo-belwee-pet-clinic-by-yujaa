// app/kien-thuc-thu-y/bravecto-365/page.tsx
//
// SERVER COMPONENT — chỉ để sinh metadata/Open Graph; toàn bộ phần hiển thị nằm
// trong components/bravecto/Bravecto365Page.tsx (client, có state video/FAQ).
//
// Đặt dưới /kien-thuc-thu-y/ để mục "Kiến thức thú y" tự động active trên
// Navbar: SiteNavbar tính active bằng `pathname.startsWith("/kien-thuc-thu-y/")`
// — không cần thêm biến cấu hình nào.

import Bravecto365Page from "@/components/bravecto/Bravecto365Page";
import type { Metadata } from "next";

const ROUTE = "/kien-thuc-thu-y/bravecto-365";
const TITLE = "Bravecto 365 – MSD Animal Health x Belwee";
const DESCRIPTION =
  "Chương trình Bravecto 365 do MSD Animal Health giới thiệu tại Bệnh viện thú y Belwee: một lần tiêm bảo vệ bé khỏi ve, giun, bọ chét trong 365 ngày, cùng tư vấn và theo dõi của bác sĩ thú y.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "Bravecto 365",
    "Bravecto Plus",
    "MSD Animal Health",
    "Belwee",
    "phòng ve bọ chét cho bé",
    "bệnh viện thú y Belwee",
  ],
  alternates: { canonical: ROUTE },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "Belwee Pet Clinic",
    title: TITLE,
    description: DESCRIPTION,
    url: ROUTE,
    images: [
      {
        url: "/belwee-hop-tac-cung-msd.png",
        width: 770,
        height: 393,
        alt: "Belwee cùng MSD Animal Health – chương trình Bravecto 365",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/belwee-hop-tac-cung-msd.png"],
  },
};

export default function Bravecto365RoutePage() {
  return <Bravecto365Page />;
}
