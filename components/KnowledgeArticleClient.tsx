'use client';

/**
 * components/KnowledgeArticleClient.tsx
 * The interactive reading shell for /kien-thuc-thu-y/[slug].
 *
 * WHY THE PAGE IS SPLIT
 *   `page.tsx` is a Server Component so it can export `generateMetadata` and
 *   render the Article JSON-LD — neither of which can exist in a client bundle.
 *   Everything that needs browser state (read progress, share, prev/next,
 *   back-to-top) lives here.
 *
 * READ PROGRESS
 *   Throttled through requestAnimationFrame with a last-value guard. The naive
 *   version called setState on every scroll event, which re-rendered the whole
 *   article — headings, icon grid, related links — up to 60 times a second.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Check, Link2, Share2 } from 'lucide-react';
import Reveal from '@/components/Reveal';
import BelweeNewsSection from '@/components/BelweeNewsSection';
import KnowledgeArticleBody from '@/components/KnowledgeArticleBody';
import { useLanguage } from '@/components/LanguageProvider';
import {
  computedReadTime,
  knowledgeArticles,
  knowledgeCategoryLabel,
  relatedArticles,
  type KnowledgeArticle,
} from '@/lib/knowledgeData';
import { HOTLINE } from '@/lib/clinics';
import { cn } from '@/lib/utils';

interface Props {
  article: KnowledgeArticle;
  /** Màu chip danh mục, truyền từ server để CSS dùng chung với trang danh sách. */
  categoryColor: string;
}

/**
 * KHÔNG truyền nhãn tiếng Việt qua props.
 *
 * Bản đầu nhận `labels` là chuỗi tiếng Việt đến từ Server Component. Hệ quả:
 * người đọc chọn English vẫn thấy nút "Chia sẻ"/"Bài liên quan", và mỗi chuỗi
 * mới lại phải khai báo ở hai file. Nay đọc trực tiếp từ `t()` trong provider —
 * Server Component chỉ còn việc truyền `article` và `categoryColor`.
 */
export default function KnowledgeArticleClient({
  article,
  categoryColor,
}: Props) {
  const { t } = useLanguage();
  const [readProgress, setReadProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  // ─── Tiến độ đọc ──────────────────────────────────────────────────
  useEffect(() => {
    let ticking = false;
    let lastValue = -1;

    const update = () => {
      ticking = false;
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const next = Math.min(window.scrollY / scrollable, 1);
      // Bỏ qua giá trị không đổi: setState với cùng số vẫn kích hoạt một lượt
      // render trong React 18 nếu nó nằm trong cùng batch.
      if (Math.abs(next - lastValue) < 0.001) return;
      lastValue = next;
      setReadProgress(next);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ─── Chia sẻ ─────────────────────────────────────────────────────
  const share = useCallback(async () => {
    const url = window.location.href;
    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
    };

    // navigator.share chỉ tồn tại trên HTTPS / mobile. Trên desktop http:// nó
    // vắng mặt, nên phải có đường dự phòng clipboard.
    if (typeof nav.share === 'function') {
      try {
        await nav.share({ title: article.title, text: article.excerpt, url });
        return;
      } catch {
        // Người dùng đóng sheet chia sẻ — không phải lỗi, im lặng là đúng.
        return;
      }
    }
    try {
      await window.navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard bị chặn (không có HTTPS, quyền bị từ chối). Im lặng: nút
      // vẫn là control hợp lệ, chỉ là không có gì để báo.
    }
  }, [article.title, article.excerpt]);

  const index = knowledgeArticles.findIndex((a) => a.slug === article.slug);
  const prev = index > 0 ? knowledgeArticles[index - 1] : null;
  const next =
    index < knowledgeArticles.length - 1 ? knowledgeArticles[index + 1] : null;
  const related = useMemo(() => relatedArticles(article), [article]);
  const readTime = useMemo(() => computedReadTime(article), [article]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 text-white">
      {/* Thanh tiến độ đọc */}
      <div
        className="fixed top-0 left-0 z-50 h-[3px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-[width] duration-100"
        style={{ width: `${readProgress * 100}%` }}
        role="progressbar"
        aria-label={t('knowledge.progressAria')}
        aria-valuenow={Math.round(readProgress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      />

      {/* Về đầu trang */}
      {readProgress > 0.15 && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 flex size-11 items-center justify-center rounded-full border border-white/15 bg-slate-900/80 text-lg text-white shadow-xl backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-slate-800/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label={t('knowledge.toTopAria')}
        >
          ↑
        </button>
      )}

      {/* Quầng sáng trang trí */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-48 top-20 h-[480px] w-[480px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute right-0 bottom-1/3 h-[420px] w-[420px] rounded-full bg-indigo-500/10 blur-[100px]" />
      </div>

      {/* Thanh dẫn hướng nhỏ */}
      <div className="relative z-10 mx-auto max-w-4xl px-4 pt-28 sm:px-6 lg:px-8">
        <nav
          aria-label={t('knowledge.breadcrumbAria')}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <Link
            href="/kien-thuc-thu-y"
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3.5 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-300 backdrop-blur-md transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            {t('knowledge.backToList')}
          </Link>

          <button
            type="button"
            onClick={() => void share()}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3.5 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-300 backdrop-blur-md transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-300" aria-hidden="true" />
                {t('knowledge.copied')}
              </>
            ) : (
              <>
                <Share2 className="size-3.5" aria-hidden="true" />
                {t('knowledge.share')}
              </>
            )}
          </button>
        </nav>
      </div>

      <article className="relative mx-auto max-w-4xl px-4 pt-8 pb-24 sm:px-6 lg:px-8">
        {/* Ảnh bìa — khung vuông/16:10 bo góc, zoom nhẹ khi rê chuột */}
        <Reveal as="div" className="mb-8" delay={0.05}>
          <div className="group relative aspect-[16/9] w-full overflow-hidden rounded-[28px] border border-white/10 bg-slate-900">
            <Image
              src={article.image}
              alt={article.imageAlt}
              fill
              priority
              sizes="(min-width: 1024px) 896px, 100vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent"
            />
          </div>
        </Reveal>

        {/* Header */}
        <Reveal as="header" className="mb-10" delay={0.1}>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            <Link
              href="/kien-thuc-thu-y"
              className="text-blue-400 transition-colors hover:text-blue-300"
            >
              {t('knowledge.badge')}
            </Link>
            <span>›</span>
            <span
              className={cn(
                'rounded-full border px-2.5 py-1',
                categoryColor
              )}
            >
              {knowledgeCategoryLabel(article.category)}
            </span>
          </div>

          <h1 className="mt-5 text-3xl leading-snug font-light tracking-tight sm:text-4xl lg:text-5xl">
            {article.title}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400">
            <span>✍️ {article.author}</span>
            <span>📅 {article.date}</span>
            {/* Đếm lại từ nội dung thật thay vì dùng con số ghi tay. */}
            <span>📖 {readTime}</span>
            <span>👁️ {article.views} {t('knowledge.views')}</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </Reveal>

        {/* Trích dẫn */}
        <Reveal
          as="div"
          className="mb-10 rounded-[24px] border border-blue-400/20 bg-blue-500/10 p-6 backdrop-blur-md sm:p-8"
          delay={0.16}
        >
          <p className="text-base leading-relaxed text-blue-200 italic sm:text-lg">
            &ldquo;{article.excerpt}&rdquo;
          </p>
        </Reveal>

        {/* Nội dung — khối có cấu trúc, không phải dangerouslySetInnerHTML */}
        <Reveal as="div" delay={0.2}>
          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl sm:p-10">
            <KnowledgeArticleBody article={article} />
          </div>
        </Reveal>

        {/* Hotline cấp cứu */}
        <Reveal
          as="div"
          className="mt-8 flex flex-col items-start gap-4 rounded-[26px] border border-emerald-400/25 bg-emerald-500/10 p-6 backdrop-blur-md sm:flex-row sm:items-center"
          delay={0.24}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-emerald-200">
              {t('knowledge.hotlineTitle')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-200/75">
              {t('knowledge.hotlineDesc')}
            </p>
          </div>
          <a
            href={`tel:${HOTLINE}`}
            className="shrink-0 rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-extrabold text-slate-950 transition-colors hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            {t('knowledge.hotlineCta')}
          </a>
        </Reveal>

        {/* Bài liên quan */}
        {related.length > 0 && (
          <Reveal as="section" className="mt-12" delay={0.28}>
            <h2 className="mb-5 flex items-center gap-2.5 text-lg font-bold text-white">
              <Link2 className="size-4.5 text-blue-400" aria-hidden="true" />
              {t('knowledge.relatedTitle')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={`/kien-thuc-thu-y/${item.slug}`}
                  className="group flex gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-all hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-white/[0.07]"
                >
                  <span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-slate-800">
                    <Image
                      src={item.image}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-3 text-sm font-semibold text-white transition-colors group-hover:text-blue-300">
                      {item.title}
                    </span>
                    <span className="mt-2 block text-[11px] text-slate-500">
                      {computedReadTime(item)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </Reveal>
        )}

        {/* Trước / Sau */}
        <Reveal
          as="section"
          aria-label={t('knowledge.prevNextAria')}
          className="mt-10 grid gap-4 sm:grid-cols-2"
          delay={0.32}
        >
          {prev ? (
            <Link
              href={`/kien-thuc-thu-y/${prev.slug}`}
              className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-all hover:border-blue-400/30 hover:bg-white/[0.07]"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                ← {t('knowledge.prev')}
              </span>
              <p className="mt-2 line-clamp-2 text-sm font-semibold text-white transition-colors group-hover:text-blue-300">
                {prev.title}
              </p>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/kien-thuc-thu-y/${next.slug}`}
              className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-right transition-all hover:border-blue-400/30 hover:bg-white/[0.07]"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                {t('knowledge.next')} →
              </span>
              <p className="mt-2 line-clamp-2 text-sm font-semibold text-white transition-colors group-hover:text-blue-300">
                {next.title}
              </p>
            </Link>
          ) : (
            <div />
          )}
        </Reveal>
      </article>

      <div className="relative mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <BelweeNewsSection variant="dark" />
      </div>
    </div>
  );
}