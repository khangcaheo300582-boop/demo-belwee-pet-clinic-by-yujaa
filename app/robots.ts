import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/site-url";

/**
 * robots — cho phép bot lấy nội dung công khai, chặn vùng có dữ liệu cá nhân /
 * trang quản trị. Sitemap trỏ tới sitemap.ts sinh cùng lúc.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/staff", // cổng nhân viên
          "/api", // API nội bộ — không có gì để index
          "/trang-ca-nhan", // hồ sơ cá nhân (dữ liệu người dùng)
          "/client-portal",
          "/care-schedule",
          "/dang-nhap",
          "/tao-tai-khoan",
          "/cap-lai-mat-khau",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
