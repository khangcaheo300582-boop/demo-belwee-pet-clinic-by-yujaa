/**
 * lib/staffRules.ts
 * The Belwee staff code of conduct — eight sections, each an accordion on
 * /staff/rules.
 *
 * WHY THE CONTENT LIVES HERE
 *   Every employee must be able to read the SAME text, and the acknowledgement
 *   timestamp recorded against their account has to refer to a specific version.
 *   If the text lived inside the component, editing a typo would silently change
 *   what people already agreed to. Keeping it in data means a revision bumps
 *   `version`, and `rulesAcknowledgedAt` can be compared against it: an account
 *   that acknowledged v1 has NOT accepted v2.
 */

export interface StaffRuleSection {
  id: string;
  icon: string;
  title: string;
  /** Short lead-in shown above the bullets. */
  summary: string;
  items: string[];
}

/**
 * Bump this whenever the text below changes. Acknowledgements recorded against
 * an older version show up as "cần đọc lại" on the profile page.
 */
export const RULES_VERSION = 3;

export const RULES_LAST_UPDATED = '01/10/2026';

export const STAFF_RULES: readonly StaffRuleSection[] = [
  {
    id: 'dong-phuc-ve-sinh',
    icon: '🧥',
    title: 'Đồng phục & vệ sinh cá nhân',
    summary:
      'Đồng phục là trang phục bảo hộ cho người bệnh. Mặc đúng đồng phục, giặt sạch và thay đúng lịch là nghĩa vụ với bé khách.',
    items: [
      'Mặc đồng phục có tên Belwee đúng từ đầu ca; không mặc áo khoác cá nhân bên ngoài trong khu vực khám.',
      'Giày đế đóng, không đi dép lê hoặc giày vải — đây là yêu cầu bắt buộc vì bệnh viện có bệnh nhân nhiễm trùng.',
      'Tóc buộc gọn, móng tay cắt ngắn, không đeo giỏ nhôm cho nhân viên tiếp xúc trực tiếp thú cưng.',
      'Sát trùng tay trước và sau mỗi lần tiếp xúc với thú cưng, sau khi dọn vệ sinh và khi rời phòng thủ dụng.',
      'Đồng phục giặt ở 60°C sau mỗi ca có tiếp xúc bệnh nhân; không mặc đồng phục đi ra ngoài khuôn viên phòng khám.',
      'Báo ngay cho quản lý khi có vết thương hở trên tay, vì đây là đường vào của bệnh truyền nhiễm.',
    ],
  },
  {
    id: 'quy-trinh-tiep-nhan',
    icon: '🐾',
    title: 'Quy trình tiếp nhận thú cưng',
    summary:
      'Mỗi bước tiếp nhận đều có lý do. Bỏ qua một bước không tiết kiệm thời gian — nó tạo ra việc phải làm lại sau đó.',
    items: [
      'Kiểm tra lịch hẹn và mã đặt lịch trước khi gọi tên khách, tránh nhầm lịch giữa các chi nhánh.',
      'Thông báo lịch hẹn cho bác sĩ phụ trách TRƯỚC khi đưa thú cưng vào phòng khám.',
      'Hỏi lịch sử tiêm phòng, thuốc đang dùng và triệu chứng trong 2 tuần gần nhất — ghi vào bệnh án, không chỉ nói miệng.',
      'Kiểm tra thể trọng trước mỗi lần khám; cân đo lại sau khi thú cưng đi vệ sinh.',
      'Giữ khoảng cách an toàn với thú cưng đang hoảng loạn hoặc đau — không dùng dây dắt quá chặt khi thú chưa quen khuôn viên.',
      'Bàn gạo bệnh án bằng lời nói trực tiếp giữa hai nhân viên, không chỉ qua ghi chú trong hệ thống.',
    ],
  },
  {
    id: 'an-toan-sinh-hoc',
    icon: '🧫',
    title: 'An toàn sinh học',
    summary:
      'Một đôi găng, một chiếc khẩu trang và một thùng rác đúng chỗ có thể quyết định một ca lây chéo.',
    items: [
      'Đeo găng nitrile mới cho MỖI thú cưng — thay đổi giữa hai bé, kể cả khi hai bé đều khoẻ.',
      'Dùng riêng dụng cụ cho khu vực cách ly; không mang dụng cụ qua lại giữa khu cách ly và khu thường.',
      'Khẩu trang đúng cách, thay khi ướt hoặc bẩn; không kéo xuống dưới cằm rồi kéo lại.',
      'Xử lý chất thải sinh học theo đúng phân loại — kim tiêm, dao mổ và bông gạc dính máu vào thùng vàng chuyên dụng.',
      'Rửa tay trước khi rời phòng thủ dụng kể cả khi đã đeo găng; găng không thay thế cho việc rửa tay.',
      'Báo ngay khi phát hiện dấu hiệu lây nhiễm chéo để phòng khám kịp thời cách ly khu vực.',
    ],
  },
  {
    id: 'bao-mat-thong-t',
    icon: '🔒',
    title: 'Bảo mật thông tin khách hàng',
    summary:
      'Thông tin của khách là tài sản của khách. Ảnh chụp thú cưng, số điện thoại và bệnh án đều là dữ liệu cá nhân.',
    items: [
      'KHÔNG chụp ảnh thú cưng hoặc gửi ảnh qua mạng xã hội cá nhân khi chưa có sự đồng ý bằng văn bản của chủ.',
      'Không gọi điện trao đổi thông tin bệnh án ngoài giờ làm việc và không gọi cho số điện thoại khách khi không được yêu cầu.',
      'Không thảo luận tình trạng thú cưng của khách ở nơi công cộng hoặc trong khu vực chờ có thể nghe thấy.',
      'Không in, sao chép hoặc chụp màn hình bệnh án về thiết bị cá nhân.',
      'Khóa màn hình khi rời máy tính, kể cả khi chỉ ra khỏi phòng trong vài phút.',
      'Báo ngay cho quản lý khi mất thiết bị hoặc nghi ngờ thông tin bị lộ — báo cáo sớm luôn tốt hơn báo cáo muộn.',
    ],
  },
  {
    id: 'thai-do-phuc-vu',
    icon: '💬',
    title: 'Thái độ phục vụ',
    summary:
      'Chủ thú cưng thường đang lo lắng. Giọng điệu bình tĩnh có giá trị hơn một câu xin lỗi dài dòng.',
    items: [
      'Chào hỏi bằng giọng nhẹ nhàng, gọi chủ bằng tên; không xưng "anh/chị" theo thói quen mà không hỏi.',
      'Không tranh luận về chẩn đoán với chủ. Nếu chủ hỏi, mô tả đúng những gì bạn thấy và chuyển câu hỏi lâm sàng cho bác sĩ.',
      'Nói rõ thời gian chờ và báo trước nếu có thể chậm — im lặng là nguồn bực bội nhất.',
      'Không nhận quà biếu, không nhận tiền và không thương lượng giá ngoài giá niêm yết.',
      'Nếu bạn sai, nhận lỗi và sửa. Không đổ lỗi cho đồng nghiệp hoặc hệ thống.',
      'Giữ giọng điệu và thái độ lịch sự ngay cả khi chủ nổi giận hoặc thú cưng gầm.',
    ],
  },
  {
    id: 'gay-me-phau-thuat',
    icon: '🩺',
    title: 'Quy trình gây mê & phẫu thuật',
    summary:
      'Chỉ bác sĩ mới được gây mê và phẫu thuật. Nhân viên hỗ trợ có vai trò chuẩn bị, kiểm tra và hỗ trợ trong phòng mổ.',
    items: [
      'Trước gây mê: xác nhận đúng bệnh nhân, đúng thủ thuật và đúng vị trí mổ bằng cách hỏi lại với chủ — không dựa vào mẩu giấy.',
      'Kiểm tra chắc chắn thú cưng đã nhịn ăn đúng thời gian theo hướng dẫn; nếu không chắc chắn, hỏi bác sĩ chứ không tự quyết định.',
      'Thân nhiệt, mạch, SpO2, huyết áp được theo dõi liên tục và ghi vào phiếu gây mê.',
      'Dùng đúng liều thuốc, đúng đường dùng, có kiểm tra đối chiếu lần hai với bác sĩ trước khi tiêm.',
      'Thuốc gây mê và thuốc giảm đau được kiểm kê hai bên sau mỗi ca; thiếu bất kỳ lọ nào phải báo ngay.',
      'Sau phẫu thuật: theo dõi đến khi thú cưng tỉnh, báo bác sĩ ngay khi có bất thường về nhịp thở, nhiệt độ hoặc vết mổ.',
    ],
  },
  {
    id: 'xu-ly-su-co',
    icon: '🚨',
    title: 'Xử lý sự cố',
    summary:
      'Khi có sự cố, thứ tự luôn là: an toàn con người → an toàn thú cưng → báo cáo. Đừng đảo thứ tự.',
    items: [
      'Chảy máu: đè trực tiếp bằng gạc sạch, giữ liên tục, đưa tới phòng mổ nếu không dừng được trong 3 phút.',
      'Thú cưng bỏ chạy: mở cửa thoát hiểm trước, sau đó đóng cửa — đuổi theo thú cưng vào khuôn viên là nguy hiểm cho bạn.',
      'Hỏa hoạn: báo động, dẫn khách ra ngoài qua lối thoát hiểm gần nhất, không dùng thang máy.',
      'Chủ khách có dấu hiệu nguy hiểm: giữ khoảng cách, gọi quản lý và hotline 115 nếu cần — không tự xử lý.',
      'Sự cố thiết bị hoặc điện: báo phòng kỹ thuật và dừng sử dụng thiết bị đó ngay.',
      'Sau mọi sự cố: ghi nhận vào biên bản NGAY trong ca. Sự cố ghi muộn gần như không bao giờ được điều tra được.',
    ],
  },
  {
    id: 'cham-cong',
    icon: '🕐',
    title: 'Chấm công & nghỉ phép',
    summary:
      'Ca làm việc bắt đầu sớm hơn lúc mở cửa vì công việc chuẩn bị không được tính là giờ nghỉ.',
    items: [
      'Có mặt trước giờ mở cửa 15 phút để mặc đồng phục, vệ sinh tay và nhận bàn giao ca.',
      'Ra về đúng giờ; làm thêm giờ phải được quản lý phê duyệt và ghi nhận rõ ràng.',
      'Nghỉ trưa tối đa 45 phút, không gộp với nghỉ ngắn quanh ca.',
      'Báo nghỉ trước ít nhất 24 giờ khi có kế hoạch; nghỉ bất ngờ chỉ chấp nhận với lý do thực sự khẩn cấp.',
      'Không tự ý đổi ca với đồng nghiệp — việc đổi ca phải thông qua quản lý để giữ đúng ca làm việc trong hệ thống.',
      'Điểm danh sớm muộn nhiều lần trong tháng sẽ bị trừ phần thưởng chuyên cần.',
    ],
  },
] as const;

/** Total rule text — the PDF/print export prints this many items. */
export const RULES_ITEM_COUNT = STAFF_RULES.reduce((sum, section) => sum + section.items.length, 0);

/** True when an acknowledgement was recorded against the current version. */
export function isAcknowledgementCurrent(
  acknowledgedAt: string | null,
  acknowledgedVersion: number | null
): boolean {
  if (!acknowledgedAt || acknowledgedVersion === null) return false;
  return acknowledgedVersion >= RULES_VERSION;
}