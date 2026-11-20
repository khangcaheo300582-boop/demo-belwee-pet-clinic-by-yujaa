"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTransitionNavigate } from '@/hooks/useTransitionNavigate';

interface InfoBlock {
  t: 'h' | 'p' | 'li' | 'table' | 'src' | 'warn';
  text?: string;
  items?: string[];
  head?: string[];
  rows?: string[][];
}

interface ServiceCardDetail {
  id: string;
  icon: string;
  title: string;
  badge: string;
  price: string;
  description: string;
  features: string[];
  bookingHref: string;
  infoTitle: string;
  infoBlocks: InfoBlock[];
}

// === CHỈ 4 DỊCH VỤ CHÍNH ===
const servicesList: ServiceCardDetail[] = [
  {
    id: 'spa-grooming',
    icon: '✂️',
    badge: 'Chăm sóc thẩm mỹ',
    title: 'Spa - Grooming',
    price: 'Từ 250.000 VNĐ',
    description: 'Dịch vụ tắm xả dưỡng lông, vắt tuyến hôi, cắt tỉa lông thẩm mỹ theo phong cách hiện đại cho bé yêu lộng lẫy.',
    features: ['Tắm sấy khử mùi chuyên sâu', 'Cắt tỉa lông tạo kiểu nghệ thuật', 'Vệ sinh tai, móng & vắt tuyến hôi'],
    bookingHref: '/booking/spa-grooming',
    infoTitle: 'Tầm quan trọng của Spa & Grooming',
    infoBlocks: [
      { t: 'p', text: 'Vệ sinh và chăm sóc lông định kỳ không chỉ giúp thú cưng sạch đẹp mà còn là cơ hội để phát hiện sớm các vấn đề trên da, tai, mắt và móng. Lịch grooming nên được điều chỉnh theo giống, độ dài lông, mùa và lối sống của từng bé.' },
      { t: 'h', text: 'Tần suất chăm sóc' },
      {
        t: 'table',
        head: ['Hạng mục', 'Tần suất nên làm'],
        rows: [
          ['Tắm & sấy lông', 'Mỗi 2–4 tuần hoặc theo tình trạng lông'],
          ['Cắt tỉa lông tạo kiểu', 'Mỗi 4–8 tuần tùy giống và tốc độ mọc lông'],
          ['Cắt móng', 'Mỗi 3–6 tuần nếu không tự mài'],
          ['Vệ sinh tai', 'Hằng tuần; kiểm tra mỗi lần tắm'],
          ['Vắt tuyến hôi', 'Mỗi 1–2 tháng hoặc khi có dấu hiệu'],
          ['Đánh răng', '2–3 lần/tuần hoặc hằng ngày'],
        ],
      },
      { t: 'p', text: 'Sau khi tắm phải sấy khô hoàn toàn lớp lông tơ để tránh ẩm gây viêm da, nấm và hắc lào. Kiểm tra kỹ vùng bụng, kẽ ngón chân và sau tai sau mỗi lần dắt bé đi chơi về.' },
      { t: 'h', text: 'Lưu ý khi tự grooming tại nhà' },
      {
        t: 'li',
        items: [
          'Không dùng sữa tắm của người cho chó mèo: pH khác nhau dễ gây khô da, bong vảy.',
          'Tuyệt đối không cắt phạm vào tủy móng (phần hồng bên trong móng).',
          'Không chọc tăm bông sâu vào tai; chỉ lau phần tai ngoài bằng bông khô.',
          'Với lông bị rối nặng nên nhờ groomer xử lý thay vì kéo mạnh gây đau cho bé.',
        ],
      },
      { t: 'warn', text: 'Nếu da có vết đỏ, sưng, rụng lông bất thường, vảy tiết hoặc bé liên tục ngứa gãi: nên thăm khám để loại trừ ký sinh trùng, nấm hoặc dị ứng thay vì chỉ tắm thêm.' },
    ],
  },
  {
    id: 'kham-dieu-tri',
    icon: '🩺',
    badge: 'Chuyên khoa sâu',
    title: 'Khám & Chữa Bệnh',
    price: 'Từ 150.000 VNĐ',
    description: 'Chẩn đoán lâm sàng, xét nghiệm máu công nghệ cao, tầm soát và điều trị triệt để các bệnh lý nội ngoại khoa cho thú cưng.',
    features: ['Khám lâm sàng tổng quát', 'Xét nghiệm máu & sinh hóa', 'Kê đơn & theo dõi phác đồ 24/7'],
    bookingHref: '/booking/kham-benh',
    infoTitle: 'Quy trình khám & điều trị chuẩn y khoa',
    infoBlocks: [
      { t: 'p', text: 'Phòng khám của Belwee áp dụng quy trình khám chữa bệnh có hệ thống từ tiếp nhận triệu chứng đến chẩn đoán và theo dõi phác đồ, giúp phát hiện bệnh sớm và điều trị đúng nguyên nhân.' },
      { t: 'h', text: 'Các bước thăm khám' },
      {
        t: 'table',
        head: ['Bước', 'Nội dung'],
        rows: [
          ['Tiếp nhận & khai thác', 'Hỏi về chế độ ăn, môi trường, lịch tiêm, triệu chứng hiện tại'],
          ['Khám lâm sàng', 'Nghe tim phổi, sờ bụng, kiểm tra mắt – tai – da – răng miệng'],
          ['Xét nghiệm & chẩn đoán hình ảnh', 'Công thức máu, sinh hóa, soi phân, xét nghiệm FIV/FeLV, X-quang, siêu âm'],
          ['Chẩn đoán & tư vấn', 'Giải thích kết quả, phác đồ điều trị và chi phí rõ ràng'],
          ['Điều trị & kê đơn', 'Thuốc, truyền dịch, chăm sóc vết thương... theo đúng phác đồ'],
          ['Tái khám & theo dõi', 'Nhắc lịch tự động, điều chỉnh thuốc theo tiến triển'],
        ],
      },
      { t: 'h', text: 'Khi nào nên đưa thú cưng đi khám' },
      {
        t: 'li',
        items: [
          'Bỏ ăn quá 24 giờ hoặc uống nước nhiều bất thường',
          'Nôn, tiêu chảy kéo dài, có máu hoặc bụng trướng căng',
          'Ho, khó thở, chảy dịch mũi, mắt hoặc sốt',
          'Lờ đờ, đi đứng khó khăn, co giật hoặc hôn mê',
          'Vết thương sâu, cắn nhau, gãy xương nghi ngờ',
        ],
      },
      { t: 'h', text: 'Lưu ý điều trị tại nhà' },
      {
        t: 'li',
        items: [
          'Không tự ý dùng thuốc của người hoặc thuốc còn thừa cho thú cưng.',
          'Dùng đúng liều, đúng giờ theo đơn; không tự tăng liều khi thấy không đỡ.',
          'Theo dõi phản ứng sau khi uống thuốc và báo ngay cho bác sĩ khi có bất thường.',
        ],
      },
      { t: 'warn', text: 'Các triệu chứng như nướu nhợt nhạt, sụt cân nhanh, tiểu ra máu hoặc vàng da là dấu hiệu cần được kiểm tra khẩn cấp, không nên chờ đợi.' },
    ],
  },
  {
    id: 'khach-san',
    icon: '🏨',
    badge: 'Đăng ký 5 sao',
    title: 'Hotel - Khách Sạn Thú Cưng',
    price: 'Từ 180.000 VNĐ/ngày',
    description: 'Không gian lưu trú điều hòa chuẩn 5 sao, chế độ dinh dưỡng cá nhân hóa cùng camera giám sát trực tiếp cho chủ nuôi.',
    features: ['Phòng riêng máy lạnh sạch sẽ', 'Chế độ ăn theo yêu cầu', 'Vui chơi & tương tác hàng ngày'],
    bookingHref: '/booking/khach-san',
    infoTitle: 'Tiêu chuẩn lưu trú 5 sao cho thú cưng',
    infoBlocks: [
      { t: 'p', text: 'Khách sạn thú cưng Belwee được thiết kế như không gian sống thu nhỏ: phòng điều hòa riêng, bày biện đồ dùng quen thuộc của bé và có camera giám sát cho chủ nuôi theo dõi từ xa.' },
      { t: 'h', text: 'Dịch vụ bao gồm khi nhận phòng' },
      {
        t: 'li',
        items: [
          'Phòng riêng máy lạnh, vệ sinh khử khuẩn giữa các lượt khách',
          'Chế độ ăn theo yêu cầu và lịch cho ăn cá nhân hóa',
          'Vui chơi, đi dạo và tương tác ít nhất 2 lần/ngày',
          'Camera giám sát trực tiếp cho chủ nuôi',
          'Theo dõi sức khỏe, dùng thuốc đúng lịch nếu có',
        ],
      },
      { t: 'h', text: 'Trước khi nhận phòng cần chuẩn bị' },
      {
        t: 'table',
        head: ['Hạng mục', 'Yêu cầu'],
        rows: [
          ['Lịch tiêm phòng', 'Cập nhật vaccine; còn hiệu lực phòng Care, vaccine dại'],
          ['Sổ khám sức khỏe', 'Xác nhận tình trạng sức khỏe trước khi lưu trú'],
          ['Đồ dùng quen thuộc', 'Đồ chơi, mền, bát ăn giúp bé bớt căng thẳng'],
          ['Thức ăn riêng', 'Theo khẩu phần quen thuộc nếu bé cần chế độ đặc biệt'],
        ],
      },
      { t: 'h', text: 'Lưu ý khi đón bé về' },
      {
        t: 'li',
        items: [
          'Kiểm tra da, tai và lông; báo ngay nếu nghi ngờ có ve bọ chét.',
          'Cho bé thời gian làm quen lại với không gian quen — một số bé sẽ mất ngủ, ăn ít ngày đầu.',
          'Giữ lịch tẩy giun, phòng ve – bọ chét song song với kỳ lưu trú.',
        ],
      },
      { t: 'warn', text: 'Thú cưng chưa tiêm phòng đầy đủ, đang sốt hoặc nghi nhiễm ký sinh trùng nên được thăm khám và điều trị trước khi lưu trú để bảo vệ cộng đồng thú cưng khác.' },
    ],
  },
  {
    id: 'tiem-vac-xin',
    icon: '💉',
    badge: 'Phòng bệnh chuẩn',
    title: 'Tiêm Vaccine',
    price: 'Từ 200.000 VNĐ',
    description: 'Cung cấp các dòng vắc-xin phòng bệnh đa chủng chính hãng cho Chó & Mèo, đảm bảo hệ miễn dịch khỏe mạnh toàn diện.',
    features: ['Vắc-xin 4 bệnh / 7 bệnh nhập khẩu', 'Tái khám & nhắc lịch tự động', 'Sổ theo dõi sức khỏe điện tử'],
    bookingHref: '/booking/tiem-ngua',
    infoTitle: 'Lịch chăm sóc cơ bản cho chó & mèo',
    infoBlocks: [
      { t: 'p', text: 'Lịch chăm sóc cơ bản cho chó mèo thường gồm tiêm vaccine, tẩy giun, nhỏ gáy/phòng ký sinh trùng và phòng ve–bọ chét. Lịch cụ thể phải điều chỉnh theo tuổi, cân nặng, tình trạng sức khỏe và việc thú có ra ngoài hay không.' },
      { t: 'h', text: 'Chó' },
      {
        t: 'table',
        head: ['Độ tuổi', 'Việc nên làm'],
        rows: [
          ['2–8 tuần', 'Tẩy giun vào khoảng 2, 4, 6 và 8 tuần tuổi'],
          ['6–8 tuần', 'Bắt đầu vaccine tổng hợp: Care, Parvo, viêm gan truyền nhiễm và có thể kèm Parainfluenza'],
          ['Mỗi 3–4 tuần sau đó', 'Nhắc vaccine tổng hợp cho đến khi chó đạt ít nhất 16 tuần tuổi'],
          ['Từ khoảng 12 tuần trở lên', 'Tiêm vaccine dại theo loại vaccine và quy định địa phương'],
          ['Sau mũi vaccine cuối 1 năm', 'Tiêm nhắc theo lịch của bác sĩ và loại vaccine'],
          ['Trưởng thành', 'Tẩy giun định kỳ; thường 1–3 tháng/lần tùy nguy cơ'],
          ['Hằng tháng hoặc theo nhãn thuốc', 'Phòng ve, bọ chét; có thể chọn dạng nhỏ gáy, viên uống hoặc vòng cổ'],
        ],
      },
      { t: 'p', text: 'Chó con cần được tẩy giun lặp lại ở các mốc 2, 4, 6 và 8 tuần; sau đó thường chuyển sang thuốc phòng định kỳ theo hướng dẫn của sản phẩm. Vaccine tổng hợp nên được tiêm thành nhiều mũi vì kháng thể từ chó mẹ có thể làm giảm hiệu quả của những mũi tiêm quá sớm.' },
      { t: 'src', text: 'capcvet.org' },
      { t: 'h', text: 'Mèo' },
      {
        t: 'table',
        head: ['Độ tuổi', 'Việc nên làm'],
        rows: [
          ['2–8 tuần', 'Tẩy giun theo hướng dẫn thú y, thường bắt đầu từ khoảng 2 tuần tuổi'],
          ['6–8 tuần', 'Bắt đầu vaccine 3 bệnh FVRCP: giảm bạch cầu, herpesvirus và calicivirus'],
          ['Mỗi 3–4 tuần sau đó', 'Nhắc FVRCP đến khoảng 16–20 tuần tuổi'],
          ['8–12 tuần trở lên', 'Cân nhắc vaccine FeLV, đặc biệt với mèo có nguy cơ tiếp xúc mèo khác'],
          ['Khoảng 12–16 tuần', 'Tiêm vaccine dại theo loại vaccine được sử dụng'],
          ['Sau mũi cuối 1 năm', 'Nhắc vaccine theo lịch của bác sĩ'],
          ['Trưởng thành', 'Tẩy giun định kỳ và phòng ve–bọ chét theo nguy cơ'],
        ],
      },
      { t: 'p', text: 'Vaccine FVRCP là vaccine nền tảng cho mèo. FeLV thường được ưu tiên cho mèo con và mèo có tiếp xúc ngoài trời hoặc sống chung với nhiều mèo; nên xét nghiệm FeLV trước khi tiêm trong các trường hợp có nguy cơ.' },
      { t: 'src', text: 'catvets.com' },
      { t: 'h', text: 'Nhỏ gáy và phòng ve, bọ chét' },
      {
        t: 'li',
        items: [
          'Thuốc nhỏ gáy có thể phòng bọ chét, ve, rận, ghẻ tai hoặc một số loại giun tùy hoạt chất.',
          'Không phải thuốc nhỏ gáy nào cũng thay thế được thuốc tẩy giun đường ruột.',
          'Một số sản phẩm dùng mỗi tháng; một số loại có thời gian bảo vệ dài hơn. Phải dùng đúng loài, cân nặng và độ tuổi ghi trên nhãn.',
        ],
      },
      { t: 'src', text: 'capcvet.org' },
      { t: 'warn', text: 'Tuyệt đối không dùng thuốc chứa permethrin dành cho chó cho mèo, vì có thể gây ngộ độc thần kinh nghiêm trọng.' },
      {
        t: 'li',
        items: [
          'Nếu nhà có nhiều chó mèo, nên xử lý đồng thời các con cùng sống chung và vệ sinh ổ nằm, sàn nhà, thảm vì bọ chét có thể tồn tại trong môi trường.',
          'Ve và bọ chét có thể truyền bệnh, gây thiếu máu, viêm da và làm thú nuốt phải sán dây; phòng định kỳ thường hiệu quả hơn chỉ xử lý khi đã thấy ve.',
        ],
      },
      { t: 'src', text: 'esccap.org' },
      { t: 'h', text: 'Lịch đơn giản dễ nhớ' },
      {
        t: 'li',
        items: [
          'Mỗi tháng: phòng ve–bọ chét; một số thuốc nhỏ gáy/viên có thể đồng thời phòng giun tim hoặc giun đường ruột.',
          'Mỗi 1–3 tháng: tẩy giun đường ruột, tùy tuổi và nguy cơ.',
          'Mỗi 3–4 tuần ở chó mèo con: nhắc vaccine tổng hợp cho đến khi hoàn tất liệu trình.',
          'Mỗi năm: khám tổng quát, kiểm tra phân và xem lại lịch vaccine.',
        ],
      },
      { t: 'warn', text: 'Khi có ve nhiều, tiêu chảy, nôn, bụng trướng, sụt cân, nướu nhợt hoặc ho khó thở: đưa đi khám thay vì tự tăng liều thuốc.' },
    ],
  }
];

export default function ServicesPage() {
  const navigate = useTransitionNavigate();

  const [activeInfo, setActiveInfo] = useState<ServiceCardDetail | null>(null);

  // Khoá cuộn nền khi mở thẻ nội dung — KHÔNG gọi scrollTo(0,0), chỉ
  // lưu vị trí cuộn trước khi mở và khôi phục đúng vị trí đó khi đóng.
  const previousScrollYRef = useRef(0);
  useEffect(() => {
    if (activeInfo) {
      previousScrollYRef.current = window.scrollY;
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
        window.scrollTo(0, previousScrollYRef.current);
      };
    }
    return undefined;
  }, [activeInfo]);

  const openInfo = (service: ServiceCardDetail) => {
    setActiveInfo(service);
  };

  const closeInfo = () => {
    setActiveInfo(null);
  };

  const renderBlocks = (blocks: InfoBlock[]) =>
    blocks.map((b, idx) => {
      if (b.t === 'h') {
        return (
          <h3 key={idx} className="text-sm sm:text-base text-slate-900 font-semibold tracking-wide mt-5 mb-2">
            {b.text}
          </h3>
        );
      }
      if (b.t === 'p') {
        return (
          <p key={idx} className="text-slate-600 text-xs sm:text-sm font-light leading-relaxed mt-3">
            {b.text}
          </p>
        );
      }
      if (b.t === 'li') {
        return (
          <ul key={idx} className="space-y-2 mt-2">
            {(b.items ?? []).map((item, i) => (
              <li key={i} className="text-slate-600 text-xs sm:text-sm font-light leading-relaxed flex items-start gap-2">
                <span className="text-blue-600 font-bold shrink-0 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        );
      }
      if (b.t === 'table') {
        return (
          <div key={idx} className="overflow-x-auto mt-3 rounded-xl border border-slate-200 bg-white/60">
            <table className="w-full text-left text-[11px] sm:text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  {(b.head ?? []).map((h, hi) => (
                    <th key={hi} className="px-3 py-2.5 text-blue-700 font-semibold tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(b.rows ?? []).map((row, ri) => (
                  <tr key={ri} className="border-t border-slate-200">
                    {row.map((cell, ci) => (
                      <td key={ci} className={`px-3 py-2.5 text-slate-600 font-light leading-relaxed align-top ${ci === 0 ? 'font-medium text-slate-900 whitespace-nowrap pr-4' : ''}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      if (b.t === 'src') {
        return (
          <span key={idx} className="block mt-1.5 text-[10px] text-slate-500 italic">
            Nguồn: {b.text}
          </span>
        );
      }
      if (b.t === 'warn') {
        return (
          <div key={idx} className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-100 p-3.5 text-amber-800 text-xs sm:text-sm font-light leading-relaxed">
            <span className="shrink-0 mt-0.5" aria-hidden="true">⚠️</span>
            <span>{b.text}</span>
          </div>
        );
      }
      return null;
    });

  return (
    <div className="relative min-h-screen text-slate-800 font-sans antialiased bg-cover bg-center bg-no-repeat bg-fixed overflow-x-hidden selection:bg-blue-500 selection:text-white">
      {/* Background Image */}
      <div
        className="fixed inset-0 w-full h-full scale-105 pointer-events-none z-0"
        style={{
          backgroundImage: "url('/anhnentcdichvu.webp')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'brightness(0.95) contrast(1.05) saturate(1.05)'
        }}
      />
      {/* Smooth light veil + top fade from page background into content */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/85 via-white/75 to-white/90 pointer-events-none z-0" />

      {/*
        Injecting the stylesheet as a raw HTML child instead of a JSX text
        child. As a text child React HTML-escapes the content on the server but
        not on the client, so any character with an entity form breaks
        hydration: this block's `content: ''` (the pseudo-element content)
        rendered as `content: &#x27;&#x27;` in the SSR payload, React saw a text
        node that did not match, and it threw away the server-rendered tree for
        the whole page to re-render it on the client — the flash of
        unstyled/recomputed layout that reads as a hitch. Passing the CSS via
        dangerouslySetInnerHTML keeps the server and client markup
        byte-identical. This matches every other <style> block in the app
        (app/gioi-thieu, app/tuyen-dung, the booking pages, app/loading).
      */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        /* ===== SERVICE CARD GLASS ===== */
        .subtle-glass-card {
          background: rgba(255,255,255,0.62);
          backdrop-filter: blur(24px) saturate(170%);
          -webkit-backdrop-filter: blur(24px) saturate(170%);
          border: 1px solid rgba(255,255,255,0.6);
          border-top: 1px solid rgba(255,255,255,0.9);
          box-shadow: 0 20px 45px -15px rgba(2,6,23,0.2), inset 0 1px 1px rgba(255,255,255,0.7);
          transition: all 0.5s cubic-bezier(0.25,1,0.3,1);
        }
        .subtle-glass-card::before {
          content: '';
          position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 0;
          background: radial-gradient(500px circle at 50% 50%, rgba(59,130,246,0.12), transparent 50%);
          opacity: 0; transition: opacity 0.5s ease;
        }
        .subtle-glass-card:hover::before { opacity: 1; }
        .subtle-glass-card:hover {
          background: rgba(255,255,255,0.82);
          border-color: rgba(59,130,246,0.35);
          transform: translateY(-6px);
          box-shadow: 0 28px 55px -18px rgba(2,6,23,0.28), 0 0 22px rgba(147,197,253,0.25);
        }

        /* ===== INBOX BUTTON ===== */
        .btn-inbox-liquid {
          position: relative;
          background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
          border: 1px solid rgba(255,255,255,0.4);
          backdrop-filter: blur(12px);
          box-shadow: 0 8px 20px rgba(37,99,235,0.35), inset 0 1px 1px rgba(255,255,255,0.4);
          transition: all 0.35s cubic-bezier(0.34,1.56,0.64,1);
        }
        .btn-inbox-liquid:hover {
          transform: translateY(-4px) scale(1.04);
          background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
          border-color: rgba(255,255,255,0.7);
          box-shadow: 0 14px 28px rgba(37,99,235,0.5), 0 0 18px rgba(147,197,253,0.6), inset 0 1px 2px rgba(255,255,255,0.8);
        }
        .paw-glow-icon {
          transition: all 0.35s cubic-bezier(0.34,1.56,0.64,1);
        }
        .btn-inbox-liquid:hover .paw-glow-icon {
          color: #fcd34d !important;
          transform: scale(1.35) rotate(12deg);
          filter: drop-shadow(0 0 10px rgba(252,211,77,1));
        }

        /* ===== INFO MODAL LIQUID GLASS ===== */
        .info-modal-panel {
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(28px) saturate(170%);
          -webkit-backdrop-filter: blur(28px) saturate(170%);
          border: 1px solid rgba(255,255,255,0.7);
          border-top: 1px solid rgba(255,255,255,0.95);
          box-shadow: 0 30px 70px rgba(2,6,23,0.3), 0 0 30px rgba(147,197,253,0.15);
        }
      `,
        }}
      />

      {/* Main Content */}
      <main className="relative z-20 pt-36 pb-24 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span data-reveal="fade" className="inline-block text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full bg-blue-600/10 border border-blue-600/25 text-blue-700 backdrop-blur-md">
            🐾 Hệ Thống Dịch Vụ Khám & Chăm Sóc Toàn Diện
          </span>
          <h1 data-reveal="fade-up" data-delay="0.1" className="text-3xl sm:text-4xl md:text-5xl font-light text-slate-900 uppercase tracking-wider leading-tight drop-shadow-sm">
            Dịch Vụ Nổi Bật Tại Belwee
          </h1>
          <p data-reveal="fade-up" data-delay="0.2" className="text-slate-600 text-sm sm:text-base leading-relaxed font-normal">
            Chúng tôi tự hào mang lại dịch vụ y tế thú y & chăm sóc sắc đẹp cao cấp chuẩn quốc tế. Vui lòng chọn dịch vụ bên dưới để xem thông tin chi tiết và đặt lịch hẹn trực tiếp.
          </p>
          <div className="w-16 h-[2px] bg-gradient-to-r from-transparent via-blue-600 to-transparent mx-auto mt-4" />
        </div>

        {/* Services Grid — 4 main services */}
        <div data-reveal-group className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {servicesList.map((service) => (
            <div
              key={service.id}
              className="subtle-glass-card rounded-[2.2rem] p-7 flex flex-col justify-between relative group overflow-hidden"
            >
              <div className="space-y-5" style={{ position: 'relative', zIndex: 1 }}>
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                    {service.icon}
                  </div>
                  <span className="text-[11px] font-semibold tracking-wider px-3 py-1 rounded-full bg-blue-600/10 border border-blue-600/20 text-blue-700">
                    {service.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-slate-900 tracking-wide mb-1 group-hover:text-blue-700 transition-colors duration-300">
                    {service.title}
                  </h3>
                  <p className="text-blue-700 font-semibold text-xs tracking-wide mb-3">
                    {service.price}
                  </p>
                  <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-normal">
                    {service.description}
                  </p>
                </div>

                <ul className="space-y-2 pt-2 border-t border-slate-200">
                  {service.features.map((feat, fIdx) => (
                    <li key={fIdx} className="text-xs text-slate-700 flex items-center gap-2">
                      <span className="text-blue-600 font-bold text-sm">✓</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-200 flex items-center justify-between" style={{ position: 'relative', zIndex: 1 }}>
                <button
                  onClick={() => openInfo(service)}
                  aria-label={`Xem nội dung ${service.title}`}
                  className="btn-inbox-liquid w-full py-3 px-6 rounded-full flex items-center justify-center gap-3 text-white text-xs font-semibold tracking-wider uppercase cursor-pointer"
                >
                  <span>Inbox Ngay</span>
                  <svg
                    className="paw-glow-icon w-5 h-5 text-blue-100"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <ellipse cx="6.2" cy="9.8" rx="2" ry="2.5" />
                    <ellipse cx="10.3" cy="6.3" rx="2" ry="2.5" />
                    <ellipse cx="13.7" cy="6.3" rx="2" ry="2.5" />
                    <ellipse cx="17.8" cy="9.8" rx="2" ry="2.5" />
                    <path d="M12 11.4c-2.2 0-4 1.8-4 4 0 1.1.4 2.1 1.2 2.9a3.6 3.6 0 002.8 1.2c1.1 0 2-.5 2.8-1.2.8-.8 1.2-1.8 1.2-2.9 0-2.2-1.8-4-4-4z" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Thẻ cuối trang — chuyên gia & kiến thức ngẫu nhiên */}
        <div className="mt-16">
        </div>
      </main>

      {/* THẺ LIQUID GLASS HIỂN THỊ NỘI DUNG DỊCH VỤ — portal ra document.body để luôn center viewport */}
      {activeInfo && createPortal(
        <div
          className="fixed inset-0 z-[3500] overflow-y-auto bg-black/60 backdrop-blur-md transition-opacity duration-300"
          onClick={(e) => { if (e.target === e.currentTarget) closeInfo(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') closeInfo(); }}
          role="dialog"
          aria-modal="true"
          aria-label={`Nội dung ${activeInfo.title}`}
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
            <div className="info-modal-panel w-full max-w-2xl rounded-[2.5rem] p-6 sm:p-8 relative animate-in fade-in zoom-in-95 duration-200 max-h-[calc(100dvh-2rem)] sm:max-h-[min(85dvh,calc(100dvh-3rem))] overflow-y-auto no-scrollbar">
              {/* Nút đóng */}
              <button
                onClick={closeInfo}
                aria-label="Đóng"
                className="absolute right-6 top-6 w-9 h-9 rounded-full bg-slate-900/5 hover:bg-slate-900/10 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-all text-sm"
              >
                ✕
              </button>

              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest bg-blue-600/10 px-2.5 py-1 rounded-md">
                {activeInfo.badge}
              </span>

              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-3 mb-1 tracking-wide pr-10 leading-tight">
                {activeInfo.title}
              </h2>

              <div className="mb-5 flex items-center gap-3 text-xs">
                <span className="text-blue-700 font-semibold">{activeInfo.price}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-600 font-light">{activeInfo.infoTitle}</span>
              </div>

              {/* Nội dung chi tiết */}
              <div className="space-y-1">
                {renderBlocks(activeInfo.infoBlocks)}
              </div>

              {/* Chân thẻ: đặt lịch ngay */}
              <div className="mt-7 pt-5 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={() => {
                    const href = activeInfo.bookingHref;
                    closeInfo();
                    navigate(href);
                  }}
                  className="flex-1 py-3.5 px-6 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-[1.03] active:scale-95 shadow-[0_10px_25px_rgba(37,99,235,0.4)] cursor-pointer"
                >
                  📅 Đặt lịch hẹn ngay
                </button>
                <button
                  onClick={closeInfo}
                  className="px-6 py-3 rounded-full text-xs font-semibold bg-slate-900/5 border border-slate-300 text-slate-600 hover:bg-slate-900/10 hover:text-slate-900 transition-all"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}