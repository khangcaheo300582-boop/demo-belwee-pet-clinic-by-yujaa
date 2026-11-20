// app/kien-thuc-thu-y/[slug]/page.tsx
// SERVER COMPONENT — chủ yếu để sinh metadata + JSON-LD cho mỗi bài.
//
// Trước đây trang này là "use client", nên `generateMetadata` không tồn tại và
// Google chỉ thấy tiêu đề chung của layout. Chia như vậy giúp mỗi bài có
// description, Open Graph và JSON-LD `Article` riêng, đồng thời phần tương tác
// (tiến độ đọc, chia sẻ, prev/next) nằm trong KnowledgeArticleClient.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import KnowledgeArticleClient from '@/components/KnowledgeArticleClient';
import {
  knowledgeArticles,
  knowledgeCategoryLabel,
} from '@/lib/knowledgeData';
import { getBaseUrl } from '@/lib/site-url';
import { translate } from '@/lib/i18n';

/** Màu chip danh mục — dùng chung với trang danh sách, khai báo ở cả hai nơi
 *  vì nó là thuần CSS class, không phải dữ liệu dùng chung. */
const CATEGORY_COLORS: Record<string, string> = {
  'suc-khoe': 'border-red-300/25 bg-red-500/10 text-red-300',
  'dinh-duong': 'border-amber-300/25 bg-amber-500/10 text-amber-300',
  'cham-soc': 'border-emerald-300/25 bg-emerald-500/10 text-emerald-300',
  'hanh-vi': 'border-indigo-300/25 bg-indigo-500/10 text-indigo-300',
};

/** Bài viết là nội dung tĩnh, không có dữ liệu theo request → prerender sẵn. */
export const dynamicParams = false;

export function generateStaticParams() {
  return knowledgeArticles.map((article) => ({ slug: article.slug }));
}

interface PageProps {
  params: { slug: string };
}

export function generateMetadata({ params }: PageProps): Metadata {
  const article = knowledgeArticles.find((a) => a.slug === params.slug);
  // Metadata render trên server, không đọc được localStorage nên chốt tiếng Việt —
  // đây cũng là ngôn ngữ đích của bài và của nhóm khách chính của Belwee.
  if (!article) return { title: translate('vi', 'knowledge.notFound') };

  const title = `${article.title} | Belwee Pet Clinic`;
  const description = article.excerpt;

  return {
    title,
    description,
    keywords: [...article.tags, 'thú y', 'phòng khám thú cưng', 'Belwee'],
    alternates: { canonical: `/kien-thuc-thu-y/${article.slug}` },
    openGraph: {
      type: 'article',
      title: article.title,
      description,
      url: `/kien-thuc-thu-y/${article.slug}`,
      siteName: 'Belwee Pet Clinic',
      locale: 'vi_VN',
      images: [{ url: article.image, width: 1200, height: 630, alt: article.imageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description,
      images: [article.image],
    },
  };
}

export default function KnowledgeSlugPage({ params }: PageProps) {
  const article = knowledgeArticles.find((a) => a.slug === params.slug);
  // dynamicParams = false nên slug lạ không bao giờ tới đây, nhưng notFound()
  // vẫn là đường thoát đúng nếu danh sách bài thay đổi giữa build và deploy.
  if (!article) notFound();

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/kien-thuc-thu-y/${article.slug}`;

  /**
   * JSON-LD `Article`.
   *
   * `datePublished` phải là ISO-8601 đầy đủ (có múi giờ), không phải chuỗi
   * dd/mm/yyyy đang hiển thị trên thẻ. Chuyển đổi tại đây thay vì đổi dữ liệu
   * để `date` vẫn đọc được với người.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    image: [`${baseUrl}${article.image}`],
    datePublished: toIsoDate(article.date),
    dateModified: toIsoDate(article.date),
    author: { '@type': 'Person', name: article.author },
    publisher: {
      '@type': 'Organization',
      name: 'Belwee Pet Clinic',
      logo: { '@type': 'ImageObject', url: `${baseUrl}/logo-belwee.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    articleSection: knowledgeCategoryLabel(article.category),
    keywords: article.tags.join(', '),
    inLanguage: 'vi',
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Nội dung JSON-LD là dữ liệu tĩnh từ repo, không phải input người dùng.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <KnowledgeArticleClient
        article={article}
        categoryColor={
          CATEGORY_COLORS[article.category] ?? 'border-white/10 bg-white/5 text-slate-300'
        }
      />
    </>
  );
}

/** "04/07/2026" → "2026-07-04T00:00:00+07:00". */
function toIsoDate(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return new Date().toISOString();
  const [, day, month, year] = match;
  return `${year}-${month}-${day}T00:00:00+07:00`;
}