import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/site-url";
import { knowledgeArticles } from "@/lib/knowledgeData";

/**
 * Sitemap động — sinh tại build/deploy từ danh sách route công khai.
 * URL thân thiện tiếng Việt không dấu (slug đã chuẩn sẵn trong codebase).
 * priority: trang chủ > dịch vụ/đặt lịch > nội dung > phụ.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getBaseUrl();
  const now = new Date();

  const staticRoutes: Array<{
    path: string;
    priority: number;
    changeFrequency: "daily" | "weekly" | "monthly";
  }> = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/dich-vu", priority: 0.9, changeFrequency: "weekly" },
    { path: "/booking/kham-benh", priority: 0.9, changeFrequency: "monthly" },
    { path: "/booking/tiem-ngua", priority: 0.9, changeFrequency: "monthly" },
    { path: "/booking/spa-grooming", priority: 0.9, changeFrequency: "monthly" },
    { path: "/booking/khach-san", priority: 0.9, changeFrequency: "monthly" },
    { path: "/lien-he", priority: 0.8, changeFrequency: "monthly" },
    { path: "/doi-ngu", priority: 0.7, changeFrequency: "monthly" },
    { path: "/gioi-thieu", priority: 0.7, changeFrequency: "monthly" },
    { path: "/tien-ich", priority: 0.7, changeFrequency: "monthly" },
    { path: "/kien-thuc-thu-y", priority: 0.7, changeFrequency: "daily" },
    { path: "/tuyen-dung", priority: 0.5, changeFrequency: "monthly" },
  ];

  const routes: MetadataRoute.Sitemap = staticRoutes.map((r) => ({
    url: `${base}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  /**
   * 11 bài kiến thức.
   *
   * Trước đây sitemap chỉ liệt kê trang `/kien-thuc-thu-y`, nên mọi bài viết chi
   * tiết đều không được khai báo ở đây. Chúng lại là nhóm nội dung chính của
   * site — bỏ sót thì các trang đó không được Google lập chỉ mục.
   * `lastModified` dùng `date` của bài: nội dung tĩnh, ngày trong bài là ngày
   * xuất bản thật, tốt hơn `now` (mà `now` đổi mỗi lần build).
   */
  for (const article of knowledgeArticles) {
    routes.push({
      url: `${base}/kien-thuc-thu-y/${article.slug}`,
      lastModified: parseVnDate(article.date) ?? now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  return routes;
}

/** "04/07/2026" → Date. Trả về null nếu định dạng lạ. */
function parseVnDate(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}
