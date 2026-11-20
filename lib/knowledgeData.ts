/**
 * lib/knowledgeData.ts
 * Dữ liệu kiến thức thú y dùng chung cho:
 *   • /kien-thuc-thu-y          — danh sách thẻ (có khung ảnh vuông)
 *   • /kien-thuc-thu-y/[slug]   — trang bài viết (mục lục, khối nội dung, CTA)
 *   • components/BelweeNewsSection — các thẻ "kiến thức ngẫu nhiên" cuối trang
 *
 * NỘI DUNG LÀ KHỐI CẤU TRÚC, KHÔNG PHẢI HTML
 *   Bản cũ lưu `detailContent` là một chuỗi rồi render bằng
 *   `dangerouslySetInnerHTML`. Hai vấn đề: (1) không có tiêu đề/danh sách/khung
 *   nhấn mạnh nên bài đọc là một khối chữ dài; (2) `dangerouslySetInnerHTML`
 *   là bề mặt XSS — hôm nay nội dung viết tay trong repo nên chưa nguy hiểm,
 *   nhưng ngày nào nội dung lấy từ CMS/API thì nó trở thành lỗ hổng thật.
 *   Ở đây nội dung là `KnowledgeBlock[]` và được render bằng JSX thuần.
 *
 * LƯU Ý PHÁP LÝ — đây là nội dung QUẢNG BÁ DỊCH VỤ, không phải tư vấn y khoa
 *   Mỗi bài kết bằng khối `disclaimer` nhắc khách đưa thú cưng đến bác sĩ thú y
 *   khám trực tiếp. Các bài mô tả quy trình của phòng khám, KHÔNG đưa liều
 *   thuốc, KHÔNG đưa phác đồ tự điều trị tại nhà.
 */

/** Khối nội dung của một bài. Render bằng components/KnowledgeArticleBody.tsx. */
export type KnowledgeBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'list'; ordered?: boolean; items: string[] }
  /** Icon-grid — dùng cho mục "7 triệu chứng" cần lướt nhanh. */
  | { kind: 'iconGrid'; items: Array<{ icon: string; label: string; detail: string }> }
  /** Khung nhấn mạnh: info / warning / success. */
  | {
      kind: 'callout';
      tone: 'info' | 'warning' | 'success';
      title?: string;
      text: string;
    }
  /** Ảnh minh hoạ trong bài, bo góc + caption. */
  | { kind: 'image'; src: string; alt: string; caption: string }
  /** So sánh trước / sau. */
  | {
      kind: 'beforeAfter';
      before: { label: string; caption: string };
      after: { label: string; caption: string };
      note: string;
    }
  /** Đường dẫn tới bài liên quan. */
  | { kind: 'related'; slugs: string[] }
  /** CTA đặt lịch. */
  | { kind: 'cta'; href: string; label: string; hint: string }
  /** Nhắc bắt buộc về mặt y khoa. */
  | { kind: 'disclaimer' };

export interface KnowledgeArticle {
  id: number;
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  /** Ảnh bìa — khung VUÔNG trên thẻ danh sách, banner trên trang bài. */
  image: string;
  /** Alt text riêng: mô tả NỘI DUNG ảnh, không nhồi từ khoá. */
  imageAlt: string;
  date: string;
  author: string;
  readTime: string;
  views: string;
  tags: string[];
  sections: KnowledgeBlock[];
}

export const knowledgeCategories = [
  { id: 'all', label: '✨ Tất cả kiến thức' },
  { id: 'suc-khoe', label: '🩺 Y tế & Bệnh học' },
  { id: 'dinh-duong', label: '🥩 Chế độ Dinh dưỡng' },
  { id: 'cham-soc', label: '✂️ Cẩm nang Chăm sóc' },
  { id: 'hanh-vi', label: '🧠 Tâm lý & Hành vi' },
] as const;

/** Khối nhắc y khoa — dùng lại cho mọi bài để không phải viết lại 11 lần. */
const DISCLAIMER: KnowledgeBlock = {
  kind: 'disclaimer',
};

export const knowledgeArticles: KnowledgeArticle[] = [
  // ─────────────────────────────────────────────────────────────── 1
  {
    id: 1,
    slug: 'phong-benh-care',
    category: 'suc-khoe',
    title: 'Phòng ngừa và xử lý bệnh Care (Distemper) nguy hiểm ở chó',
    excerpt:
      'Bệnh Care là căn bệnh truyền nhiễm có tỷ lệ tử vong cực cao ở cún con. Tìm hiểu ngay lịch tiêm phòng và cách phát hiện sớm các triệu chứng lâm sàng...',
    image: '/care.png',
    imageAlt: 'Chó con đang được bác sĩ thú y khám sức khoẻ định kỳ tại Belwee',
    date: '04/07/2026',
    author: 'BS. Nguyễn Văn Minh',
    readTime: '5 phút đọc',
    views: '1,420',
    tags: ['Bệnh học', 'Chó cảnh'],
    sections: [
      {
        kind: 'paragraph',
        text: 'Bệnh Care (Canine Distemper) do virus thuộc họ Paramyxoviridae gây ra. Bệnh lây lan nhanh qua đường hô hấp và tiêu hóa, và chưa có thuốc đặc trị — điều duy nhất quyết định số phần là tiêm phòng đúng lịch.',
      },
      { kind: 'heading', text: 'Triệu chứng thường gặp' },
      {
        kind: 'list',
        items: [
          'Sốt cao hai pha: sốt rồi hạ, vài ngày sau sốt trở lại',
          'Chảy dịch đặc ở mắt và mũi, kèm hắt hơi thường xuyên',
          'Ho khan, khó thở, nôn mửa kèm tiêu chảy',
          'Mệt mỏi, lười biếng, bỏ ăn dù đồ ăn vẫn còn',
          'Xuất hiện vảy cứng trên mũi và trên bàn chân',
          'Co giật, run rẩy, loạng choạng ở giai đoạn cuối',
        ],
      },
      {
        kind: 'callout',
        tone: 'warning',
        title: 'Dấu hiệu cần đến viện NGAY',
        text: 'Co giật, hôn mê, hoặc thú cưng bỏ ăn hơn 24 giờ kèm tiêu chảy ra máu là triệu chứng nặng. Mỗi giờ chậm trị kéo dài đáng kể tỷ lệ sống sót — hãy gọi hotline thay vì chờ xem.',
      },
      { kind: 'heading', text: 'Phòng ngừa bằng vắc-xin' },
      {
        kind: 'paragraph',
        text: 'Lịch tiêm vắc-xin Care bắt đầu từ 6–8 tuần tuổi, tiêm nhắc lại theo phác đồ khuyến cáo. Với chó trưởng thành chưa từng tiêm, bác sĩ sẽ bắt đầu lại lịch từ đầu.',
      },
      { kind: 'cta', href: '/lien-he', label: 'Đặt lịch tiêm phòng', hint: 'Tiêm phòng cho bé ngay hôm nay tại Belwee' },
      DISCLAIMER,
    ],
  },

  // ─────────────────────────────────────────────────────────────── 2
  {
    id: 2,
    slug: 'che-do-an-barf-cho-meo',
    category: 'dinh-duong',
    title: 'Xây dựng chế độ ăn BARF (Thức ăn thô tươi) chuẩn khoa học cho mèo',
    excerpt:
      'Chế độ ăn tươi sống mang lại bộ lông bóng mượt và hệ tiêu hóa khỏe mạnh cho mèo, nhưng làm sao để cân bằng dưỡng chất và tránh nhiễm khuẩn?',
    image: '/noisoi.png',
    imageAlt: 'Bác sĩ thú y đang kiểm tra dinh dưỡng cho mèo tại phòng khám',
    date: '02/07/2026',
    author: 'BS. Lê Thị Hồng',
    readTime: '7 phút đọc',
    views: '1,150',
    tags: ['Dinh dưỡng', 'Mèo cưng'],
    sections: [
      {
        kind: 'paragraph',
        text: 'BARF (Biologically Appropriate Raw Food) không phải là chế độ "cho ăn thịt bất kỳ". Đó là một công thức cân bằng cụ thể, và nếu tỷ lệ sai thì nguy hiểm không kém gì cho ăn hằng ngày.',
      },
      { kind: 'heading', text: 'Tỷ lệ vàng trong công thức' },
      {
        kind: 'list',
        items: [
          '80% thịt cơ — nhiều loại, xay nhỏ để mèo nhai được',
          '10% xương sống nghiền — nguồn canxi chính',
          '5% gan — bổ sung vitamin A dạng tiền chuyển hóa',
          '5% nội tạng khác (tim, thận, lạc…) để đủ khoáng vi tố',
        ],
      },
      {
        kind: 'callout',
        tone: 'warning',
        title: 'Nguồn thịt phải được cấp đông sâu',
        text: 'Thịt dành cho người ăn KHÔNG an toàn cho mèo. Thịt cho mèo phải từ nguồn chuyên dụng, cấp đông sâu ở −20°C trong tối thiểu 3–5 ngày để diệt ký sinh trùng. Đây là bước không thể bỏ qua.',
      },
      { kind: 'heading', text: 'Nên chuyển đổi thế nào' },
      {
        kind: 'list',
        ordered: true,
        items: [
          'Chuyển dần trong 7–10 ngày để hệ tiêu hóa kịp thích nghi',
          'Theo dõi phân trong toàn bộ giai đoạn chuyển đổi',
          'Bổ sung vitamin định kỳ nếu bác sĩ chỉ định',
          'Tái khám sau 1 tháng để đánh giá cân nặng và chất lượng lông',
        ],
      },
      { kind: 'cta', href: '/lien-he', label: 'Tư vấn dinh dưỡng', hint: 'Bác sĩ Belwee sẽ lập chế độ ăn riêng cho bé' },
      DISCLAIMER,
    ],
  },

  // ─────────────────────────────────────────────────────────────── 3
  {
    id: 3,
    slug: 've-sinh-tai-cat-mong-an-toan',
    category: 'cham-soc',
    title: 'Hướng dẫn vệ sinh tai và cắt mài móng an toàn tại nhà cho thú cưng',
    excerpt:
      'Giúp bạn vượt qua nỗi sợ cắt phạm vào tủy móng của chó mèo và phương pháp làm sạch tai ngăn ngừa triệt để bệnh viêm tai giữa phát.',
    image: '/spagroming.png',
    imageAlt: 'Chuyên gia spa đang cắt móng cho chó tại khu vực chăm sóc của Belwee',
    date: '28/06/2026',
    author: 'Chuyên gia spa & grooming Belwee',
    readTime: '4 phút đọc',
    views: '980',
    tags: ['Grooming', 'Chăm sóc tại nhà'],
    sections: [
      {
        kind: 'paragraph',
        text: 'Cắt móng không khó — khó là ở chỗ người ta thường cắm quá sâu vì không biết tủy ở đâu. Với móng trắng, hãy nhìn thấy phần tủy hồng. Với móng đen, cắt từng chút nhỏ cho đến khi thấy một chấm tối ở trung tâm mặt cắt.',
      },
      { kind: 'heading', text: 'Vệ sinh tai đúng cách' },
      {
        kind: 'list',
        items: [
          'Chỉ nhỏ dung dịch rửa tai chuyên dụng vào vành tai',
          'Massage nhẹ gốc tai để dung dịch thấm đều',
          'Để thú cưng tự lắc tai để đẩy chất bẩn ra ngoài',
          'Chỉ lau phần ở vành tai bên ngoài, không đưa tăm bông vào ống tai',
        ],
      },
      {
        kind: 'callout',
        tone: 'warning',
        title: 'Khi nào dừng làm tại nhà',
        text: 'Tai có mùi khó chịu, chảy dịch, thú cưng liên tục nghiêng đầu hoặc cào tai — đó là viêm tai, cần bác sĩ soi tai bằng kính hiển vi. Tự xử lý lúc này làm bệnh nặng thêm.',
      },
      { kind: 'cta', href: '/lien-he', label: 'Đặt lịch spa & grooming', hint: 'Nhân viên y tế sẽ chăm sóc bé giúp bạn' },
      DISCLAIMER,
    ],
  },

  // ─────────────────────────────────────────────────────────────── 4
  {
    id: 4,
    slug: 'lo-au-xa-cach-o-cho',
    category: 'hanh-vi',
    title: 'Hội chứng lo âu xa cách ở chó: Nguyên nhân và phác đồ điều trị hành vi',
    excerpt:
      'Cún cưng liên tục sủa vĩ đại, cào rách cửa hoặc phá hoại đồ đạc mỗi khi bạn rời khỏi nhà? Đây là cách huấn luyện tâm lý giúp cún an tâm cô đơn.',
    image: '/khachsan.png',
    imageAlt: 'Chó được chăm sóc tại khuôn viên Belwee trong thời gian chờ',
    date: '25/06/2026',
    author: 'Chuyên gia hành vi Belwee',
    readTime: '6 phút đọc',
    views: '1,860',
    tags: ['Tâm lý', 'Huấn luyện'],
    sections: [
      {
        kind: 'paragraph',
        text: 'Hội chứng lo âu xa cách bắt nguồn từ sự phụ thuộc cảm xúc quá lớn vào chủ nhân. Bé không "hậu" vì bạn bỏ đi — bé hoảng loạn vì không biết bạn còn quay lại hay không.',
      },
      { kind: 'heading', text: 'Phác đồ giảm mẫn cảm' },
      {
        kind: 'list',
        ordered: true,
        items: [
          'Tập bỏ ra khỏi phòng vài giây rồi quay lại, lặp lại nhiều lần',
          'Tăng dần thời gian vắng mặt từ vài giây lên vài phút',
          'Luôn quay lại TRƯỚC khi bé kịp bồn chồn — để bé học "bạn luôn quay về"',
          'Không gọi lại hay dỗ dỗi khi đang ra khỏi nhà — tránh tạo tín hiệu "sự chia ly"',
        ],
      },
      {
        kind: 'callout',
        tone: 'info',
        title: 'Mẹo quan trọng nhất',
        text: 'Chơi với đồ chơi nhồi thức ăn (Kong, Snuffle mat) trước khi ra khỏi nhà để bé có việc gì đó để làm. Đây là thay đổi đơn giản nhưng hiệu quả nhất trong tất cả các bước.',
      },
      { kind: 'cta', href: '/lien-he', label: 'Tư vấn hành vi', hint: 'Chuyên gia hành vi Belwee hỗ trợ huấn luyện tại nhà' },
      DISCLAIMER,
    ],
  },

  // ═══════════════════════════════ BÀI MỚI (yêu cầu H2) ══════════════
  {
    id: 5,
    slug: 'kham-da-dang-loai-dong-vat',
    category: 'suc-khoe',
    title: 'Khám và điều trị đa dạng các loài động vật',
    excerpt:
      'Belwee không giới hạn ở chó mèo. Từ hamster nhỏ xíu đến alpaca châu Mỹ, mọi loài đều được tiếp đón với thao tác phù hợp từng loài.',
    image: '/hamster.png',
    imageAlt: 'Chuột hamster đang được nhân viên Belwee kiểm tra sức khoẻ',
    date: '01/10/2026',
    author: 'BS. Lê Nguyên Vũ',
    readTime: '6 phút đọc',
    views: '2,140',
    tags: ['Đa dạng loài', 'Thú cưng độc lạ'],
    sections: [
      {
        kind: 'paragraph',
        text: 'Nhiều phòng khám chỉ chăm chó mèo vì đó là phần lớn khách hàng — nhưng ngành thú y không hoạt động như vậy. Tại Belwee, thú nhỏ và thú độc lạ là một phần công việc hằng ngày, và sự đa dạng chuyên môn đó chính là điểm chúng tôi tự hào.',
      },
      { kind: 'heading', text: 'Chăm sóc dịu dàng với thú nhỏ' },
      {
        kind: 'paragraph',
        text: 'Chuột hamster, chuột lang, sóc, nhím — những bé này cực kỳ nhạy với nhiệt độ, mùi và âm thanh. Chúng hoảng loạn rất nhanh, và một cử chộng động vô tình có thể gây stress nặng cho cả buổi khám.',
      },
      {
        kind: 'list',
        items: [
          'Giữ khoảng cách an toàn, không chộp vào bỗng',
          'Thao tác nhẹ nhàng, đặt tay từ phía dưới để bé không giật mình lùi',
          'Giữ nhiệt độ phòng ấm và ổn định — thú nhỏ mất nhiệt rất nhanh',
          'Dùng lồng có nắp khi chuyển, tránh thoát ra giữa chừng',
          'Cho phép bé quen dần với mùi của nhân viên trước khi thao tác',
        ],
      },
      { kind: 'heading', text: 'Tiếp nhận thú cưng độc lạ (Exotic pets)' },
      {
        kind: 'paragraph',
        text: 'Lạc đà alpaca (American Alpaca), vẹt, rùa, chim, chồn sương, bọ rùa — mỗi loài có một bộ chỉ số sinh học riêng. Ví dụ, nhiệt độ và nhịp tim bình thường của alpaca hoàn toàn khác với của chó, nên đọc kết quả cũng phải đúng chuẩn loài.',
      },
      {
        kind: 'callout',
        tone: 'info',
        title: 'Vì sao sự đa dạng chuyên môn quan trọng',
        text: 'Bác sĩ chỉ chẩn đoán đúng khi hiểu sinh lý của loài mình đang khám. Một phòng khám chỉ quen chó mèo sẽ đọc sai chỉ số của alpaca — và chẩn đoán sai thì điều trị cũng sai theo.',
      },
      { kind: 'related', slugs: ['chan-doan-noi-soi-hien-dai', 'cap-cu-phan-doan-benh-ly'] },
      { kind: 'cta', href: '/lien-he', label: 'Đặt lịch khám', hint: 'Gọi trước để được chuẩn bị lồng và dụng cụ phù hợp loài' },
      DISCLAIMER,
    ],
  },

  {
    id: 6,
    slug: 'nha-khoa-thu-y-cao-voi-rang',
    category: 'suc-khoe',
    title: 'Nha khoa thú y: cạo vôi răng chuyên nghiệp',
    excerpt:
      'Sức khoẻ răng miệng quyết định tuổi thọ và chất lượng sống của thú cưng. Tìm hiểu quy trình cạo vôi chuẩn y khoa tại Belwee.',
    image: '/caovoirang.png',
    imageAlt: 'Bác sĩ thú y đang thực hiện cạo vôi răng cho chó dưới gây mê an toàn',
    date: '01/10/2026',
    author: 'BS. Lê Nguyên Vũ',
    readTime: '5 phút đọc',
    views: '1,930',
    tags: ['Nha khoa thú y', 'Cạo vôi răng'],
    sections: [
      {
        kind: 'paragraph',
        text: 'Ở người, cao răng là vấn đề thẩm mỹ. Ở chó mèo, cao răng là nguyên nhân hàng đầu dẫn đến bệnh nướu, viêm tủy và rụng răng sớm — và mọi thứ trong miệng đều liên quan trực tiếp đến sức khoẻ toàn thân.',
      },
      { kind: 'heading', text: 'Quy trình chuẩn y khoa tại Belwee' },
      {
        kind: 'list',
        ordered: true,
        items: [
          'Khám nha khoa và chụp ảnh răng để đánh giá mức độ cao vôi',
          'Gây mê an toàn — bé không cảm thấy đau và không giật mình khi thao tác',
          'Cạo vôi bằng máy siêu âm, nhẹ hơn nhiều so với dụng cụ kim loại thủ công',
          'Đánh bóng răng để bề mặt mịn, vi khuẩn khó bám lại',
          'Hướng dẫn chăm sóc tại nhà để duy trì kết quả lâu dài',
        ],
      },
      { kind: 'heading', text: 'Lợi ích cụ thể' },
      {
        kind: 'list',
        items: [
          'Loại bỏ cao răng và mảng bám cứng đầu',
          'Giảm viêm nướu triệt để',
          'Trị dứt điểm mùi hôi miệng kéo dài',
          'Bảo vệ răng chắc khỏe lâu dài hơn nhiều năm',
        ],
      },
      {
        kind: 'beforeAfter',
        before: { label: 'Trước', caption: 'Cao răng dày, nướu đỏ, hôi miệng' },
        after: { label: 'Sau', caption: 'Răng trắng, nướu hồng phục hồi' },
        note: 'Hình minh hoạ trước — sau. Kết quả thực tế phụ thuộc mức độ cao răng ban đầu và chế độ chăm sóc sau đó.',
      },
      {
        kind: 'callout',
        tone: 'success',
        title: 'Ai nên cạo vôi định kỳ?',
        text: 'Hầu hết chó trên 3 tuổi và mèo trên 2 tuổi đều nên. Việc vệ sinh răng hằng ngày tại nhà giúp giảm tần suất, nhưng không thay thế được lần cạo vôi chuyên nghiệp.',
      },
      { kind: 'cta', href: '/booking/kham-benh', label: 'Đặt lịch cạo vôi răng', hint: 'Bác sĩ giàu kinh nghiệm thực hiện trực tiếp' },
      DISCLAIMER,
    ],
  },

  {
    id: 7,
    slug: 'chan-doan-noi-soi-hien-dai',
    category: 'suc-khoe',
    title: 'Chẩn đoán chuyên sâu: kỹ thuật nội soi hiện đại',
    excerpt:
      'Nội soi giúp bác sĩ nhìn thấy những bệnh lý bên trong mà khám ngoài không phát hiện được — từ đường tiêu hóa đến hô hấp.',
    image: '/xquang-ctsan.png',
    imageAlt: 'Thiết bị chẩn đoán hình ảnh và nội soi của phòng khám Belwee',
    date: '01/10/2026',
    author: 'BS. Lê Nguyên Vũ',
    readTime: '6 phút đọc',
    views: '1,760',
    tags: ['Nội soi', 'Chẩn đoán hình ảnh'],
    sections: [
      {
        kind: 'paragraph',
        text: 'Có những bệnh lý bên trong mà khám ngoài hoàn toàn bình thường — thú cưng vẫn ăn uống bình thường, vẫn vận động bình thường, nhưng bên trong có vấn đề. Khi đó, nội soi là cách nhìn thấy trực tiếp thay vì đoán qua triệu chứng.',
      },
      { kind: 'heading', text: 'Khi nào cần nội soi' },
      {
        kind: 'list',
        items: [
          'Nôn mửa kéo dài dù đã điều chỉnh chế độ ăn',
          'Không ăn được, hoặc sụt cân bất thường',
          'Nghi ngờ dị vật mắc trong đường tiêu hóa',
          'Ho mãn tính không rõ nguyên nhân, nghi ngờ vấn đề hô hấp',
          'Bất thường ở khoang miệng, thực quản, dạ dày, ruột',
        ],
      },
      { kind: 'heading', text: 'Quy trình tại Belwee' },
      {
        kind: 'paragraph',
        text: 'Nội soi được thực hiện cùng hệ thống gây mê an toàn và thiết bị hiện đại. Bé được gây mê trước khi đưa ống nội soi vào, hoàn toàn không cảm thấy đau đớn trong suốt quá trình. Ống có camera và đèn, đưa hình ảnh lên màn hình để bác sĩ quan sát và can thiệp chính xác.',
      },
      {
        kind: 'list',
        items: [
          'Gây mê và chuẩn bị thể trạng trước thủ thuật',
          'Đưa ống nội soi có camera + đèn soi vào vị trí cần quan sát',
          'Ghi hình và chụp ảnh để đối chiếu theo dõi',
          'Thực hiện can thiệp chính xác ngay khi phát hiện bệnh lý',
          'Theo dõi hồi phục sau thủ thuật',
        ],
      },
      {
        kind: 'callout',
        tone: 'info',
        title: 'Một số bước có thể gắn với nội soi',
        text: 'Gắp dị vật, lấy mẫu môi để xét nghiệm, sinh thiết khối u, và nội soi khớp để đánh giá tình trạng khớp. Tùy tình huống bác sĩ sẽ kết hợp các bước trong cùng một lần gây mê để tiết kiệm thời gian cho thú cưng.',
      },
      { kind: 'related', slugs: ['cap-cu-phan-doan-benh-ly', 'van-chuyen-thu-cung-quoc-te'] },
      { kind: 'cta', href: '/lien-he', label: 'Đặt lịch khám chuyên sâu', hint: 'Bác sĩ sẽ đánh giá và chỉ định mọi chỉ dẫn' },
      DISCLAIMER,
    ],
  },

  {
    id: 8,
    slug: 'cham-soc-van-dong-hoa',
    category: 'cham-soc',
    title: 'Chăm sóc vận động: hướng dẫn dạo bộ chuyên nghiệp',
    excerpt:
      'Dịch vụ dạo bộ tận tâm của Belwee: nhân viên y tế dắt bé đi dạo trong khuôn viên sạch sẽ, giúp giảm căng thẳng và hợp tác hơn khi điều trị.',
    image: '/huanluyenthucung.png',
    imageAlt: 'Nhân viên Belwee đang dẫn chó đi dạo trong khuôn viên phòng khám',
    date: '01/10/2026',
    author: 'Chuyên gia spa & grooming Belwee',
    readTime: '4 phút đọc',
    views: '1,520',
    tags: ['Dạo bộ', 'Hành vi', 'Phục hồi'],
    sections: [
      {
        kind: 'paragraph',
        text: '"Guided with care — A professional walk" không chỉ là đi bộ cho vui. Một buổi dạo bộ đúng cách giúp bé giảm căng thẳng, đốt mỡ, điều hoà hệ tiêu hóa và — quan trọng không kém — khiến bé hợp tác hơn trong mọi thủ thuật tiếp theo.',
      },
      { kind: 'heading', text: 'Vì sao nên để nhân viên y tế dắt bé' },
      {
        kind: 'list',
        items: [
          'Khuôn viên sạch sẽ, hiện đại — tránh bệnh ký sinh từ mặt đất và chó lạ',
          'Dây dắt chắc chắn theo đúng chuẩn, không siết cổ',
          'Nhân viên được huấn luyện nhận biết dấu hiệu bé mệt, căng thẳng hoặc đau',
          'Bài tập phục hồi gắn với từng bài đi bộ riêng',
          'Bé quen dần với việc đi xa và với người lạ trước khi điều trị',
        ],
      },
      { kind: 'heading', text: 'Lợi ích thực tế' },
      {
        kind: 'list',
        items: [
          'Giảm căng thẳng — đặc biệt với bé bị nhốt nhà hoặc vừa đổi nhà',
          'Giữ thể trạng tốt sau thời gian nằm viện',
          'Kích thích tiêu hóa, giảm táo bón',
          'Bé hợp tác hơn khi khám và tiêm',
        ],
      },
      {
        kind: 'callout',
        tone: 'info',
        title: 'Mẹo: dạo bộ cũng là cách huấn luyện',
        text: 'Đi dạo là cơ hội để thưởng bé bằng cách đi bộ chậm rãi, để bé tự quyết định dừng lại hít thở. Bé được tự chọn sẽ ít phản kháng hơn nhiều so với bị ép đi.',
      },
      { kind: 'cta', href: '/lien-he', label: 'Đặt lịch dạo bộ', hint: 'Nhân viên y tế Belwee chăm sóc bé tận tâm' },
      DISCLAIMER,
    ],
  },

  {
    id: 9,
    slug: 'tiem-phong-la-chan-bao-ve',
    category: 'suc-khoe',
    title: 'Tiêm phòng: lá chắn bảo vệ sức khoẻ toàn diện',
    excerpt:
      'Phòng bệnh hơn chữa bệnh. Tìm hiểu vắc-xin phòng dại và bệnh Care, cùng 7 triệu chứng sớm nhất của bệnh Care ở chó.',
    image: '/tiemngua.png',
    imageAlt: 'Nhân viên Belwee đang tiêm phòng cho chó tại phòng tiêm',
    date: '01/10/2026',
    author: 'BS. Lê Nguyên Vũ',
    readTime: '7 phút đọc',
    views: '3,120',
    tags: ['Vắc-xin', 'Phòng bệnh Care', 'Phòng dại'],
    sections: [
      {
        kind: 'paragraph',
        text: 'Có những căn bệnh không thể chữa trị, chỉ có thể phòng từ trước. Tiêm phòng không phải chi phí — đó là cách bạn bảo vệ bé khỏi một con số mà không đồng nào có thể bù lại.',
      },
      { kind: 'heading', text: 'Vắc-xin phòng dại (Rabies)' },
      {
        kind: 'paragraph',
        text: 'Bệnh dại do virus Rabies gây ra. Đây là bệnh nguy hiểm vì nó LÂY SANG NGƯỜI, và tỷ lệ tử vong khi phát bệnh gần như 100% — nghĩa là thú cưng mắc bệnh là mối nguy cho cả gia đình.',
      },
      {
        kind: 'list',
        items: [
          'Chó và mèo cần tiêm định kỳ hằng năm theo quy định',
          'Tiêm phòng vừa bảo vệ thú cưng, vừa là trách nhiệm với cộng đồng',
          'Giữ sổ tiêm chủng để làm căn cứ khi cần',
          'Sau khi bị cắn cắn, rửa vết thương ngay và đến cơ sở y tế — đừng chờ',
        ],
      },
      { kind: 'heading', text: 'Vắc-xin phòng bệnh Care (Canine Distemper)' },
      {
        kind: 'paragraph',
        text: 'Cực kỳ nguy hiểm với chó con chưa tiêm. Bệnh lây nhanh qua đường hô hấp và tấn công nhiều hệ cơ quan cùng lúc — não, phổi, gan, ruột.',
      },
      { kind: 'heading', text: '7 triệu chứng ban đầu cần nhận biết' },
      {
        kind: 'iconGrid',
        items: [
          { icon: '🤮', label: 'Nôn mửa', detail: 'Thường xuyên, không liên quan đổi khẩu phần' },
          { icon: '🌡️', label: 'Sốt', detail: 'Sốt cao hai pha: sốt rồi hạ, vài ngày sau sốt lại' },
          { icon: '😢', label: 'Chảy nước mắt', detail: 'Dịch đặc, dính quanh mắt' },
          { icon: '👃', label: 'Chảy nước mũi', detail: 'Dịch đặc kèm hắt hơi liên tục' },
          { icon: '😮‍💨', label: 'Ho', detail: 'Ho khan, nặng hơn thành khò khè' },
          { icon: '🥱', label: 'Mệt mỏi', detail: 'Lười biếng, bỏ chơi, ốm dần' },
          { icon: '🍽️', label: 'Chán ăn', detail: 'Bỏ ăn hoàn toàn, dù đồ ăn vẫn còn' },
        ],
      },
      {
        kind: 'callout',
        tone: 'warning',
        title: 'Đừng chờ',
        text: 'Trong 7 triệu chứng trên, chỉ cần một vài dấu hiệu xuất hiện cùng lúc là nên đến khám ngay. Bệnh Care tiến triển rất nhanh, và việc điều trị sớm làm thay đổi hoàn toàn cơ hội sống sót.',
      },
      { kind: 'related', slugs: ['phong-benh-care', 'van-chuyen-thu-cung-quoc-te'] },
      { kind: 'cta', href: '/booking/tiem-ngua', label: 'Đặt lịch tiêm phòng', hint: 'Tiêm đủ phác đồ tại Belwee với bác sĩ thú y' },
      DISCLAIMER,
    ],
  },

  {
    id: 10,
    slug: 'cap-cu-phan-doan-benh-ly',
    category: 'suc-khoe',
    title: 'Cấp cứu và chẩn đoán chuyên sâu các bệnh lý phức tạp',
    excerpt:
      'Phẫu thuật gắp dị vật và chẩn đoán điều trị bệnh tiêu hóa — những ca cấp cứu mà phần lớn phòng khám không trang bị đủ thiết bị để xử lý.',
    image: '/gapdivat.png',
    imageAlt: 'Bé thú cưng đang được chăm sóc tại phòng thủ dụng của Belwee',
    date: '01/10/2026',
    author: 'BS. Lê Nguyên Vũ',
    readTime: '6 phút đọc',
    views: '2,480',
    tags: ['Cấp cứu', 'Phẫu thuật', 'Dị vật'],
    sections: [
      { kind: 'heading', text: 'Phẫu thuật và gắp dị vật' },
      {
        kind: 'paragraph',
        text: 'Chó mèo hay gặm nuốt vật lạ — dép, bông, xương, đồ chơi. Phần lớn sẽ tự đi qua, nhưng không phải lúc nào cũng vậy. Một vật bị kẹt gây tắc ruột nếu không được xử lý, và biến chứng có thể xảy ra rất nhanh.',
      },
      {
        kind: 'list',
        items: [
          'Phòng mổ hiện đại trang bị đầy đủ thiết bị cần thiết',
          'Hỗ trợ phát hiện dị vật bên trong bằng hình ảnh và nội soi',
          'Cứu thú cưng khỏi biến chứng tắc ruột cũng như thủ thuật dạ dày',
          'Gây mê an toàn và theo dõi sát trong suốt thủ thuật',
          'Hồi phục có theo dõi, không để bé một mình',
        ],
      },
      { kind: 'heading', text: 'Chẩn đoán và điều trị bệnh tiêu hóa' },
      {
        kind: 'paragraph',
        text: 'Nôn mửa, tiêu chảy, bỏ ăn, sụt cân — đây là những dấu hiệu thường gặp nhưng không đơn giản, vì chúng có thể do rất nhiều nguyên nhân khác nhau gây ra.',
      },
      {
        kind: 'callout',
        tone: 'warning',
        title: 'Khi nào cần đưa đến ngay',
        text: 'Nôn mửa, tiêu chảy, bỏ ăn hoặc sụt cân — hãy đưa thú cưng đến Belwee ngay để được thăm khám, xét nghiệm và lên phác đồ phù hợp. Đừng tự thử thuốc hoặc đợi xem tự khỏi.',
      },
      { kind: 'list', ordered: true, items: [
        'Thăm khám lâm sàng đầy đủ',
        'Xét nghiệm máu, xét nghiệm để xác định nguyên nhân',
        'Chẩn đoán hình ảnh khi cần thiết',
        'Lên phác đồ điều trị phù hợp với từng trường hợp',
        'Theo dõi và tái khám để điều chỉnh phác đồ',
      ] },
      { kind: 'related', slugs: ['chan-doan-noi-soi-hien-dai', 'kham-da-dang-loai-dong-vat'] },
      { kind: 'cta', href: '/lien-he', label: 'Gọi cấp cứu', hint: 'Mô tả tình trạng bé để được hướng dẫn và xử lý nhanh nhất' },
      DISCLAIMER,
    ],
  },

  {
    id: 11,
    slug: 'van-chuyen-thu-cung-quoc-te',
    category: 'dinh-duong',
    title: 'Dịch vụ vận chuyển thú cưng quốc tế (Pet Relocation)',
    excerpt:
      'Hỗ trợ thủ tục giấy tờ phức tạp khi định cư hay du lịch cùng thú cưng, với sổ khám sức khoẻ chuẩn quốc tế đáp ứng yêu cầu kiểm dịch.',
    image: '/passport.png',
    imageAlt: 'Sổ khám sức khoẻ thú cưng tiêu chuẩn quốc tế do Belwee cấp',
    date: '01/10/2026',
    author: 'MK. Đinh Phan Hữu Khang',
    readTime: '5 phút đọc',
    views: '1,690',
    tags: ['Vận chuyển quốc tế', 'Giấy tờ', 'Pet Passport'],
    sections: [
      {
        kind: 'paragraph',
        text: 'Đưa thú cưng ra nước ngoài không chỉ là đặt vé máy bay. Giấy tờ kiểm dịch là phần khó nhất và cũng là phần làm chuyến đi bị trì hoãn nhiều nhất.',
      },
      { kind: 'heading', text: 'Pet Passport — sổ khám sức khoẻ chuẩn quốc tế' },
      {
        kind: 'paragraph',
        text: 'Chúng tôi cấp sổ khám sức khoả tiêu chuẩn quốc tế (International Pet Health Book — Pet Passport Vietnam). Sổ này ghi lại toàn bộ lịch sử tiêm phòng và tình trạng sức khoẻ của thú cưng.',
      },
      {
        kind: 'list',
        items: [
          'Lịch sử tiêm phòng đầy đủ, có xác nhận của bác sĩ',
          'Tình trạng sức khoẻ tại thời điểm xuất cảnh',
          'Thông tin nhận dạng thú cưng và chủ nuôi',
          'Đáp ứng yêu cầu kiểm dịch của nước đến',
        ],
      },
      { kind: 'heading', text: 'Dịch vụ chúng tôi đảm nhận' },
      {
        kind: 'list',
        items: [
          'Tư vấn quy trình và thủ tục theo nước đến cụ thể',
          'Chuẩn bị đầy đủ paperwork đáp ứng yêu cầu kiểm dịch',
          'Hỗ trợ kiểm tra những nội dung thường bị yêu cầu bổ sung',
          'Cấp sổ khám sức khoẻ chuẩn quốc tế',
        ],
      },
      {
        kind: 'callout',
        tone: 'success',
        title: 'Câu chuyện thành công',
        text: 'Chú chó Jasper đã trở về Mỹ an toàn. Gia đình rất hài lòng với "hộ chiếu" và bộ giấy tờ hoàn hảo — mọi thứ qua cửa kiểm dịch lần đầu tiên, không phải bổ sung giấy tờ lần hai.',
      },
      {
        kind: 'callout',
        tone: 'info',
        title: 'Hãy đến sớm',
        text: 'Nhiều nước yêu cầu vắc-xin cách ngày xuất cảnh tối thiểu 30 ngày. Đến phòng khám sớm để có đủ thời gian cho toàn bộ mũi tiêm và chứng tờ.',
      },
      { kind: 'cta', href: '/lien-he', label: 'Tư vấn vận chuyển quốc tế', hint: 'Chúng tôi sẽ hướng dẫn từng bước giấy tờ cần thiết' },
      DISCLAIMER,
    ],
  },
];

export function knowledgeCategoryLabel(cat: string): string {
  return (
    knowledgeCategories.find((c) => c.id === cat)?.label.split(' ').slice(1).join(' ') ?? ''
  );
}

/** Tổng số bài viết — dùng để chọn ngẫu nhiên ổn định. */
export const KNOWLEDGE_COUNT = knowledgeArticles.length;

/** Mục lục, dựng từ các khối `heading` — nguồn duy nhất cho cả sidebar và JSON-LD. */
export function knowledgeToc(article: KnowledgeArticle): Array<{ id: string; text: string }> {
  return article.sections
    .filter((block): block is Extract<KnowledgeBlock, { kind: 'heading' }> =>
      block.kind === 'heading'
    )
    .map((block, index) => ({
      id: `sec-${index}-${slugifyHeading(block.text)}`,
      text: block.text,
    }));
}

/** Khoá chữ tiếng Việt thành id không dấu, dùng cho neo mục lục. */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Bài liên quan, đã kiểm tra slug có tồn tại — tránh link chết trong `related`. */
export function relatedArticles(article: KnowledgeArticle): KnowledgeArticle[] {
  const block = article.sections.find((b) => b.kind === 'related');
  if (!block || block.kind !== 'related') return [];
  return block.slugs
    .map((slug) => knowledgeArticles.find((a) => a.slug === slug))
    .filter((a): a is KnowledgeArticle => Boolean(a));
}

/**
 * Thời gian đọc ước tính lại từ nội dung thật.
 *
 * `readTime` trong dữ liệu là con số ghi tay và sẽ trôi khỏi thực tế khi bài
 * được sửa. Hàm này đếm lại từ `sections` — chừng 220 từ/phút là tốc độ đọc
 * phổ biến của người lớn đọc nội dung thông tin.
 */
export function computedReadTime(article: KnowledgeArticle): string {
  const words = article.sections.reduce((total, block) => {
    switch (block.kind) {
      case 'paragraph':
      case 'heading':
        return total + block.text.trim().split(/\s+/).length;
      case 'list':
        return total + block.items.reduce((n, i) => n + i.trim().split(/\s+/).length, 0);
      case 'iconGrid':
        return total + block.items.reduce((n, i) => n + i.label.split(/\s+/).length, 6);
      case 'callout':
        // `title` là tuỳ chọn, nên chỉ cộng khi có.
        return (
          total +
          block.text.trim().split(/\s+/).length +
          (block.title ? block.title.trim().split(/\s+/).length : 0)
        );
      case 'image':
        return total + block.caption.trim().split(/\s+/).length;
      case 'beforeAfter':
        return (
          total +
          block.note.trim().split(/\s+/).length +
          block.before.caption.trim().split(/\s+/).length +
          block.after.caption.trim().split(/\s+/).length
        );
      case 'cta':
        return total + (block.label + ' ' + block.hint).trim().split(/\s+/).length;
      default:
        return total;
    }
  }, 0);
  const minutes = Math.max(1, Math.round(words / 220));
  return `${minutes} phút đọc`;
}