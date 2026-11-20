'use client';

// app/kien-thuc-thu-y/page.tsx
// Trang danh sách kiến thức thú y.
//
// Mỗi thẻ giờ có MỘT KHUNG ẢNH VUÔNG bên cạnh phần chữ (yêu cầu H1). Trước đây
// thẻ chỉ toàn chữ, nên danh sách 11 bài trông như một bảng văn bản và người đọc
// phải mở từng bài mới biết bài nào về cái gì.

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Reveal from '@/components/Reveal';
import { useLanguage } from '@/components/LanguageProvider';
import BelweeNewsSection from '@/components/BelweeNewsSection';
import {
  knowledgeCategories,
  knowledgeArticles,
  knowledgeCategoryLabel,
  computedReadTime,
  type KnowledgeBlock,
} from '@/lib/knowledgeData';
import { cn } from '@/lib/utils';

const CATEGORY_COLORS: Record<string, string> = {
  'suc-khoe': 'border-red-300/25 bg-red-500/10 text-red-300',
  'dinh-duong': 'border-amber-300/25 bg-amber-500/10 text-amber-300',
  'cham-soc': 'border-emerald-300/25 bg-emerald-500/10 text-emerald-300',
  'hanh-vi': 'border-indigo-300/25 bg-indigo-500/10 text-indigo-300',
};

/**
 * Rút gọn các khối nội dung thành vài dòng hiển thị ngay trên thẻ.
 *
 * Không dùng `detailContent` cũ (đã bỏ) và cũng không nhét `dangerouslySetInnerHTML`
 * vào đây: thẻ chỉ cần "xem nhanh", phần đầy đủ thuộc về trang bài viết. Giới hạn
 * ở 3 khối `paragraph` đầu để giữ chiều cao thẻ đồng đều nhau — thẻ cao lệch nhau
 * khiến lưới trông rối và mất nhịp khi cuộn.
 */
function previewBlocks(blocks: KnowledgeBlock[]): string[] {
  return blocks
    .filter((block): block is Extract<KnowledgeBlock, { kind: 'paragraph' }> =>
      block.kind === 'paragraph'
    )
    .slice(0, 3)
    .map((block) => block.text);
}

export default function KienThucThuYPage() {
  const [active, setActive] = useState('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const { t } = useLanguage();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return knowledgeArticles.filter((article) => {
      if (active !== 'all' && article.category !== active) return false;
      if (!needle) return true;
      // Tìm trong tiêu đề + trích dẫn + thẻ. Không tìm trong nội dung khối:
      // bài nào cũng dài hơn 300 từ nên mọi bài sẽ "khớp" và bộ lọc vô nghĩa.
      return [article.title, article.excerpt, ...article.tags]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [active, query]);

  return (
    <div className="knowledge-page relative min-h-screen overflow-hidden text-white">
      {/* ── GĐ9 · (f): nền ảnh dịch vụ + lớp phủ mờ đổi theo hệ sáng/tối ──────

        Trước GĐ9 trang này ghim cứng `from-slate-950 via-blue-950 to-indigo-950`
        và toàn bộ chữ là `text-white`/`text-slate-300`. Ở theme SÁNG, phần còn
        lại của site nền kem `#fdf6e3` còn trang này vẫn xanh đen ⇒ lệch hẳn.

        Nay: ảnh nền + MỘT lớp phủ màu độ đậm khác nhau cho hai theme. Chọn bằng
        `[data-theme='…']` chứ KHÔNG dùng biến thể `dark:` của Tailwind — xem
        khối CSS `.knowledge-page` trong globals.css để biết vì sao.

        `aria-hidden` vì đây là trang trang trí; trình đọc màn hình không cần
        biết nền là ảnh gì, và `alt=""` tránh đọc vô nghĩa "ảnh". */}
      <Image
        src="/anhnentcdichvu.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="knowledge-page__bg object-cover"
        aria-hidden
      />
      <div className="knowledge-page__scrim" aria-hidden />

      <Reveal as="div" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-48 top-0 h-[480px] w-[480px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-[420px] w-[420px] rounded-full bg-indigo-500/10 blur-[100px]" />
      </Reveal>

      <section className="relative mx-auto max-w-6xl px-4 pt-32 pb-24 sm:px-6 lg:px-8">
        <Reveal as="header" className="mb-10 text-center" delay={0.1}>
          <span className="inline-block rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-[0.28em] text-blue-300 uppercase backdrop-blur-md">
            ✨ {t('knowledge.badge')}
          </span>
          <h1 className="mt-4 text-3xl font-light tracking-tight sm:text-4xl lg:text-5xl">
            {t('knowledge.title')}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            {t('knowledge.desc')}
          </p>
        </Reveal>

        {/* Ô tìm kiếm */}
        <Reveal as="div" className="mb-6 flex justify-center" delay={0.14}>
          <label className="relative w-full max-w-md">
            <span className="sr-only">Tìm bài kiến thức</span>
            <svg
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('knowledge.searchPlaceholder')}
              className="w-full rounded-full border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white outline-none backdrop-blur-md transition-all placeholder:text-slate-500 focus:border-blue-400/40 focus:shadow-[0_0_0_4px_rgba(96,165,250,0.12)]"
            />
          </label>
        </Reveal>

        <Reveal as="div" className="mb-10 flex flex-wrap justify-center gap-2" delay={0.16}>
          {knowledgeCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActive(cat.id)}
              aria-pressed={active === cat.id}
              className={cn(
                'rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200',
                active === cat.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'border border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10'
              )}
            >
              {cat.label}
            </button>
          ))}
        </Reveal>

        {query.trim() && (
          <p className="mb-6 text-center text-xs text-slate-400" role="status">
            {filtered.length === 0
              ? t('knowledge.searchEmpty')
              : t('knowledge.searchFound')
                  .replace('{n}', String(filtered.length))
                  .replace('{q}', query.trim())}
          </p>
        )}

        {filtered.length === 0 ? (
          <div className="kn-empty rounded-[22px] border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
            <span aria-hidden="true" className="text-4xl">
              🔍
            </span>
            <p className="mt-4 font-semibold text-white">{t('knowledge.emptyTitle')}</p>
            <p className="mt-1 text-sm text-slate-400">
              {t('knowledge.emptyDesc')}
            </p>
          </div>
        ) : (
          <Reveal as="div" className="grid gap-4 md:grid-cols-2" delay={0.22}>
            {filtered.map((article) => {
              const catColor =
                CATEGORY_COLORS[article.category] ??
                'border-white/10 bg-white/5 text-slate-300';
              const isOpen = expandedId === article.id;
              const preview = previewBlocks(article.sections);

              return (
                /*
                 * GĐ9 · (f) — bấm ở BẤT KỲ đâu trên thẻ cũng mở trang chi tiết.
                 *
                 * ── VÌ SAO DÙNG LINK PHỦ (`inset-0`) CHỨ KHÔNG BỌC THẺ ──────────
                 * Hai cách người ta hay làm:
                 *   a) `<Link>` bọc ngoài cả thẻ — SAI ở đây: bên trong còn có
                 *      `<button>` "Xem nhanh" và `<Link>` "Đọc toàn bài" ⇒ link
                 *      lồng link và link lồng button. HTML không cho, trình
                 *      đọc màn hình đọc sai, và bấm nút trong thẻ sẽ kích hoạt
                 *      cả hai.
                 *   b) `<Link>` phủ `absolute inset-0` — MỘT link duy nhất, không
                 *      lồng nhau. Đây là cách dùng.
                 *
                 * Thứ tự vẽ: `<Link>` phủ nằm SAU trong DOM nhưng có `z-0`, còn
                 * nút "Xem nhanh" và pill có `relative z-10` ⇒ bấm nút thì trúng
                 * nút, bấm chỗ khác thì trúng link phủ.
                 *
                 * Trạng thái focus: `<Link>` phủ nhận focus (viền focus chạy
                 * quanh thẻ nhờ `focus-visible:ring` trên chính nó), nên vòng
                 * tab đi đúng THỨ TỰ ĐỌC: tới thẻ → tới nút xem nhanh.
                 */
                <article
                  key={article.id}
                  className={cn(
                    'kn-card group relative flex flex-col overflow-hidden rounded-[22px] border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-white/[0.07] backdrop-blur-xl transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:border-blue-400/30 hover:shadow-[0_12px_36px_-8px_rgba(96,165,250,0.25)]',
                    // Mở rộng: thẻ chiếm cả hàng, ảnh vuông ở bên trái.
                    isOpen && 'md:col-span-2 md:flex-row'
                  )}
                >
                  {/* Link phủ toàn thẻ — xem khối giải thích ở trên.

                      `z-20` chứ không phải `z-0`: khối ảnh `.kn-thumb` có
                      `position: relative` và nằm SAU link phủ trong DOM, nên vẽ
                      ĐÈ lên link và nuốt mọi cú bấm lên ảnh. Lần đầu đặt `z-0`
                      nên bấm vào ảnh không điều hướng (đo được bằng
                      `elementFromPoint`). Các nút bên trong thẻ dùng `z-30` để
                      vẫn bấm được. */}
                  <Link
                    href={`/kien-thuc-thu-y/${article.slug}`}
                    className="absolute inset-0 z-20 rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    aria-label={t('knowledge.readFullFor', { title: article.title })}
                  />

                  {/* KHUNG ẢNH VUÔNG — yêu cầu H1. GĐ9 · (f): thu nhỏ thêm một
                      chút (aspect-[4/3] thay vì vuông) để người đọc thấy được
                      nhiều thẻ hơn mà không phải cuộn quá nhiều. */}
                  <div
                    className={cn(
                      'kn-thumb relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-slate-800',
                      isOpen ? 'md:aspect-[4/3] md:w-52 md:rounded-none' : ''
                    )}
                  >
                    <Image
                      src={article.image}
                      alt={article.imageAlt}
                      fill
                      sizes={
                        isOpen
                          ? '(min-width: 768px) 208px, 100vw'
                          : '(min-width: 768px) 340px, 100vw'
                      }
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                      loading="lazy"
                    />
                    <span aria-hidden="true" className="kn-index">
                      {article.id}
                    </span>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">
                      <span className={cn('rounded-full border px-2.5 py-1', catColor)}>
                        {knowledgeCategoryLabel(article.category)}
                      </span>
                      <span>{article.date}</span>
                    </div>

                    <h3 className="text-[15px] leading-snug font-semibold transition-colors duration-200 group-hover:text-blue-300 sm:text-base">
                      {article.title}
                    </h3>

                    <p className="line-clamp-3 text-[13px] leading-5 text-slate-300">
                      {article.excerpt}
                    </p>

                    {/* Xem nhanh — 3 đoạn đầu, chỉ khi mở rộng */}
                    {isOpen && preview.length > 0 && (
                      <div className="relative z-10 space-y-2 rounded-xl border border-blue-400/20 bg-blue-500/10 p-4">
                        {preview.map((text, index) => (
                          <p key={index} className="text-[13px] leading-5 text-slate-200">
                            {text}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span>✍️ {article.author}</span>
                      <span>📖 {computedReadTime(article)}</span>
                      <span>👁️ {article.views}</span>
                    </div>

                    {/* Chỉ giữ tối đa 3 thẻ — thẻ thứ 4 trở đi làm hàng thêm cao
                        mà không thêm thông tin đọc được. */}
                    <div className="flex flex-wrap gap-1.5">
                      {article.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300"
                        >
                          {tag}
                        </span>
                      ))}
                      {article.tags.length > 3 && (
                        <span className="px-1 py-0.5 text-[10px] text-slate-500">
                          +{article.tags.length - 3}
                        </span>
                      )}
                    </div>

                    <div className="mt-auto flex flex-wrap items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : article.id)}
                        aria-expanded={isOpen}
                        className="kn-quick relative z-30 inline-flex items-center gap-1 rounded-full border border-transparent px-3 py-1.5 text-xs font-semibold transition-colors hover:border-blue-400/40"
                      >
                        {isOpen ? t('knowledge.readLess') : t('knowledge.quickView')}
                      </button>

                      {/* Pill trang trí, nằm TRONG link phủ chứ không phải link
                          riêng — hai link cùng href là trùng lặp cho trình đọc
                          màn hình. Chữ nằm ở đây nên vẫn hiện khi bấm. */}
                      <span aria-hidden="true" className="kn-pill">
                        {t('knowledge.readFull')} →
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </Reveal>
        )}

        {/* ── Tin tức Belwee ───────────────────────── */}
        <div className="mt-16">
          <BelweeNewsSection variant="dark" />
        </div>
      </section>
    </div>
  );
}