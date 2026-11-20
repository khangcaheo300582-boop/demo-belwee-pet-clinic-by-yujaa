import type { MessageKey } from "@/lib/i18n";

export interface Doctor {
  slug: string;
  degree: string;
  name: string;
  specKey: MessageKey;
  tagKey: MessageKey;
  image: string;
  bioVi: string[];
  bioEn: string[];
  highlightsVi: string[];
  highlightsEn: string[];
}

/** Dữ liệu đội ngũ bác sĩ — thông tin minh họa cho thương hiệu Belwee. */
export const teamDoctors: Doctor[] = [
  {
    slug: "bac-si-nguyen-van-an",
    degree: "TS.",
    name: "Nguyễn Văn An",
    specKey: "home.vet1Spec",
    tagKey: "home.vet1Tag",
    image: "/anhchuyengia.png",
    bioVi: [
      "TS. Nguyễn Văn An là Trưởng khoa Nội khoa tại bệnh viện thú y Belwee, với hơn 15 năm kinh nghiệm khám và điều trị các bệnh lý nội khoa, tim mạch phức tạp trên chó mèo.",
      "Tốt nghiệp bác sĩ thú y và hoàn thành chương trình nghiên cứu về tim mạch học thú cưng, TS. An chuyên sâu trong chẩn đoán và quản lý suy tim, bệnh van tim thoái hóa, rối loạn nhịp và cao huyết áp ở thú cưng.",
      "TS. An tiên phong ứng dụng siêu âm tim (echocardiography) kết hợp điện tâm đồ (ECG) trong thực hành lâm sàng tại Belwee, giúp phát hiện sớm các bệnh lý tim mạch ngay từ giai đoạn chưa có biểu hiện.",
      "Với phương châm “chẩn đoán đúng – điều trị đúng – theo dõi sát”, TS. An luôn xây dựng phác đồ điều trị cá thể hóa và đồng hành cùng chủ nuôi trong suốt quá trình chăm sóc.",
    ],
    bioEn: [
      "Dr. Nguyen Van An is Head of Internal Medicine at Belwee Veterinary Hospital, with more than 15 years of experience examining and treating complex internal and cardiovascular conditions in dogs and cats.",
      "After completing his veterinary training and a cardiology fellowship, Dr. An specializes in diagnosing and managing heart failure, degenerative valve disease, arrhythmias and hypertension in pets.",
      "He pioneered the use of echocardiography combined with ECG at Belwee, detecting cardiovascular issues early — even before clinical signs appear.",
      "His motto is “diagnose correctly – treat correctly – follow closely”. He builds personalized treatment plans and stays with pet owners throughout the care journey.",
    ],
    highlightsVi: [
      "Hơn 15 năm kinh nghiệm nội khoa & tim mạch",
      "Chẩn đoán suy tim, rối loạn nhịp, cao huyết áp",
      "Thành thạo siêu âm tim & điện tâm đồ",
      "Điều trị nội trú ICU theo dõi sát",
    ],
    highlightsEn: [
      "15+ years in internal medicine & cardiology",
      "Heart failure, arrhythmia & hypertension diagnosis",
      "Echocardiography & ECG expertise",
      "Closely monitored in-patient ICU care",
    ],
  },
  {
    slug: "bac-si-tran-thi-binh",
    degree: "ThS.",
    name: "Trần Thị Bình",
    specKey: "home.vet2Spec",
    tagKey: "home.vet2Tag",
    image: "/anhchuyengia.png",
    bioVi: [
      "ThS. Trần Thị Bình là Trưởng nhóm Phẫu thuật Ngoại khoa tại Belwee, chuyên thực hiện các ca phẫu thuật mô mềm, chỉnh hình và nội soi chẩn đoán – điều trị cho chó mèo.",
      "Với hơn 10 năm kinh nghiệm đứng mổ, ThS. Bình thành thạo triệt sản, loại bỏ khối u, xử lý chấn thương, gãy xương và các thủ thuật ngoại khoa phức tạp theo quy trình vô khuẩn chuẩn quốc tế.",
      "ThS. Bình đặt an toàn bệnh nhân lên hàng đầu: gây mê theo dõi sát, kiểm soát đau và phác đồ kháng sinh hợp lý trước – trong – sau phẫu thuật, giúp thú cưng hồi phục nhanh và ít biến chứng.",
      "Ngoài chuyên môn, ThS. Bình thường xuyên huấn luyện đội ngũ phẫu thuật trẻ và cập nhật kỹ thuật mổ mới theo chuẩn thú y quốc tế.",
    ],
    bioEn: [
      "MSc. Tran Thi Binh leads the Surgical team at Belwee, performing soft-tissue surgery, orthopedics and diagnostic/therapeutic endoscopy for dogs and cats.",
      "With over 10 years on the operating table, she is skilled in neutering, mass removal, trauma repair, fracture fixation and complex procedures following international aseptic standards.",
      "Patient safety comes first: tight anesthesia monitoring and balanced pain-control and antibiotic protocols before, during and after surgery help pets recover faster with fewer complications.",
      "She also trains younger surgeons and keeps the team updated with the latest international techniques.",
    ],
    highlightsVi: [
      "Hơn 10 năm kinh nghiệm phẫu thuật ngoại khoa",
      "Phẫu thuật mô mềm, chỉnh hình & nội soi",
      "Quy trình vô khuẩn & gây mê chuẩn quốc tế",
      "Quản lý đau & chăm sóc sau phẫu thuật",
    ],
    highlightsEn: [
      "10+ years in surgical specialties",
      "Soft-tissue, orthopedic & endoscopic surgery",
      "International aseptic & anesthesia standards",
      "Post-operative pain management & recovery",
    ],
  },
  {
    slug: "bac-si-le-minh-chau",
    degree: "BS.",
    name: "Lê Minh Châu",
    specKey: "home.vet3Spec",
    tagKey: "home.vet3Tag",
    image: "/anhchuyengia.png",
    bioVi: [
      "BS. Lê Minh Châu chuyên khoa Da liễu & Dị ứng tại bệnh viện thú y Belwee, phụ trách khám và điều trị các bệnh lý da, lông, tai và dị ứng thường gặp ở chó mèo.",
      "BS. Châu tận tâm trong chẩn đoán phân biệt các bệnh da phức tạp: viêm da dị ứng (atopy), nấm da, viêm da mủ, ghẻ và các rối loạn nội tiết ảnh hưởng đến da như suy giáp, Cushing.",
      "Với kiến thức chuyên sâu về dị ứng học, BS. Châu xây dựng phác đồ điều trị kết hợp kiểm soát môi trường sống, chế độ dinh dưỡng và thuốc phù hợp, giúp thú cưng giảm ngứa và hạn chế bùng phát bệnh.",
      "BS. Châu luôn hướng dẫn chủ nuôi cách chăm sóc da – lông đúng cách tại nhà để duy trì kết quả điều trị lâu dài.",
    ],
    bioEn: [
      "Dr. Le Minh Chau specializes in Dermatology & Allergies at Belwee, caring for skin, coat, ear and allergy conditions common in dogs and cats.",
      "He focuses on differential diagnosis of complex skin diseases: atopic dermatitis, fungal infections, pyoderma, mange and endocrine-related skin disorders such as hypothyroidism and Cushing's disease.",
      "His allergy expertise lets him design treatment plans that combine environmental control, nutrition and medication — reducing itch and preventing flare-ups.",
      "He teaches owners proper at-home skin and coat care to keep results lasting.",
    ],
    highlightsVi: [
      "Chuyên sâu bệnh lý da, lông & dị ứng",
      "Chẩn đoán phân biệt viêm da dị ứng, nấm, ghẻ",
      "Phác đồ điều trị cá thể hóa từng ca",
      "Tư vấn chăm sóc da – lông tại nhà",
    ],
    highlightsEn: [
      "Deep expertise in skin, coat & allergy diseases",
      "Differential diagnosis of atopy, fungus, mange",
      "Case-by-case personalized treatment plans",
      "Home skin & coat care guidance",
    ],
  },
  {
    slug: "bac-si-pham-duc-duy",
    degree: "TS.",
    name: "Phạm Đức Duy",
    specKey: "home.vet4Spec",
    tagKey: "home.vet4Tag",
    image: "/anhchuyengia.png",
    bioVi: [
      "TS. Phạm Đức Duy là chuyên gia Chẩn đoán Hình ảnh tại Belwee, phụ trách hệ thống X-quang kỹ thuật số và siêu âm chẩn đoán hiện đại của bệnh viện.",
      "TS. Duy có kinh nghiệm sâu rộng trong đọc hình ảnh X-quang ngực – bụng, siêu âm tim – gan – thận, chẩn đoán sỏi, khối u và bệnh lý nội tạng, hỗ trợ đội ngũ lâm sàng ra quyết định chính xác.",
      "Với nền tảng nghiên cứu chuyên sâu về hình ảnh học, TS. Duy xây dựng quy trình chụp và chuẩn hóa chất lượng hình ảnh, đảm bảo mỗi phim X-quang, mỗi lát cắt siêu âm đều đạt chuẩn chẩn đoán.",
      "TS. Duy giảng dạy và đào tạo lại cho các bác sĩ lâm sàng về kỹ thuật siêu âm định hướng chẩn đoán, nâng cao năng lực của toàn đội ngũ.",
    ],
    bioEn: [
      "Dr. Pham Duc Duy is Belwee's Diagnostic Imaging specialist, managing the hospital's digital X-ray and diagnostic ultrasound systems.",
      "He has broad experience reading thoracic and abdominal radiographs and cardiac, liver and kidney ultrasound — detecting stones, masses and organ disease that guide accurate clinical decisions.",
      "His research background in imaging drives standardized protocols so every radiograph and every ultrasound slice meets diagnostic quality.",
      "He trains clinicians in ultrasound-guided diagnosis, raising the whole team's capability.",
    ],
    highlightsVi: [
      "Chuyên gia X-quang kỹ thuật số & siêu âm",
      "Chẩn đoán hình ảnh tim, gan, thận, tiêu hóa",
      "Phát hiện sớm sỏi, khối u, bệnh lý nội tạng",
      "Chuẩn hóa quy trình & chất lượng hình ảnh",
    ],
    highlightsEn: [
      "Digital X-ray & ultrasound specialist",
      "Cardiac, liver, kidney & GI imaging",
      "Early detection of stones, masses, organ disease",
      "Standardized imaging protocols & quality",
    ],
  },
  {
    slug: "bac-si-hoang-thi-em",
    degree: "ThS.",
    name: "Hoàng Thị Em",
    specKey: "home.vet5Spec",
    tagKey: "home.vet5Tag",
    image: "/anhchuyengia.png",
    bioVi: [
      "ThS. Hoàng Thị Em chuyên khoa Nha khoa Thú cưng tại Belwee, phụ trách chăm sóc răng miệng toàn diện — từ vệ sinh răng định kỳ đến điều trị các bệnh lý răng miệng cho chó mèo.",
      "ThS. Em thực hiện cạo vôi răng và đánh bóng dưới gây mê an toàn, nhổ răng, xử lý cao răng nặng, viêm lợi, áp xe chân răng và tầm soát khối u khoang miệng.",
      "Nhận thấy nhiều bệnh lý toàn thân bắt nguồn từ răng miệng kém vệ sinh, ThS. Em xây dựng lịch chăm sóc răng miệng định kỳ phù hợp từng giống, độ tuổi và khẩu phần ăn của thú cưng.",
      "ThS. Em hướng dẫn chủ nuôi kỹ thuật đánh răng đúng cách và lựa chọn sản phẩm nha khoa phù hợp, giúp thú cưng hơi thở thơm tho và lợi khỏe.",
    ],
    bioEn: [
      "MSc. Hoang Thi Em specializes in Veterinary Dentistry at Belwee, providing complete oral care — from routine cleaning to treatment of dental disease in dogs and cats.",
      "She performs safe dental scaling and polishing under anesthesia, tooth extractions, severe tartar, gingivitis and root-abscess management, and oral mass screening.",
      "Knowing that many systemic diseases start with poor oral hygiene, she builds breed-, age- and diet-specific dental care schedules for each pet.",
      "She coaches owners on correct brushing technique and suitable dental products for fresh breath and healthy gums.",
    ],
    highlightsVi: [
      "Chuyên sâu nha khoa chó mèo",
      "Cạo vôi, đánh bóng, nhổ răng an toàn",
      "Điều trị viêm lợi, áp xe, khối u khoang miệng",
      "Lịch vệ sinh răng miệng định kỳ phù hợp",
    ],
    highlightsEn: [
      "Deep expertise in pet dentistry",
      "Safe scaling, polishing & extractions",
      "Gingivitis, abscess & oral mass treatment",
      "Personalized dental care schedules",
    ],
  },
  {
    slug: "bac-si-vu-thanh-giang",
    degree: "BS.",
    name: "Vũ Thanh Giang",
    specKey: "home.vet6Spec",
    tagKey: "home.vet6Tag",
    image: "/anhchuyengia.png",
    bioVi: [
      "BS. Vũ Thanh Giang là chuyên gia Tiêm phòng & Kiểm soát dịch bệnh tại Belwee, phụ trách xây dựng và theo dõi chương trình tiêm phòng cho chó mèo trên toàn hệ thống.",
      "BS. Giang có kinh nghiệm triển khai các chương trình tiêm vaccine phòng bệnh truyền nhiễm nguy hiểm như Care (distemper), Parvo, FVRCP ở mèo và các chương trình phòng ký sinh trùng, ve – bọ chét.",
      "BS. Giang cá thể hóa lịch tiêm theo độ tuổi, cân nặng, lối sống và mức độ phơi nhiễm của từng thú cưng, kết hợp sổ theo dõi sức khỏe với hệ thống nhắc lịch tự động của Belwee.",
      "Với kiến thức dịch tễ vững chắc, BS. Giang tư vấn cho chủ nuôi các biện pháp phòng bệnh chủ động và kiểm soát ổ dịch khi có thú cưng mắc bệnh trong cộng đồng.",
    ],
    bioEn: [
      "Dr. Vu Thanh Giang is Belwee's Vaccination & Disease-control specialist, building and monitoring vaccination programs for dogs and cats across the clinic system.",
      "He leads vaccination programs against dangerous infectious diseases such as distemper, Parvo and FVRCP in cats, plus parasite, tick and flea prevention.",
      "He personalizes vaccination schedules by age, weight, lifestyle and exposure risk, supported by health records and Belwee's automatic appointment reminders.",
      "With a solid epidemiology background, he advises owners on proactive prevention and outbreak control in the pet community.",
    ],
    highlightsVi: [
      "Chuyên gia tiêm phòng & dịch tễ",
      "Chương trình vaccine Care, Parvo, FVRCP",
      "Lịch tiêm cá thể hóa + nhắc lịch tự động",
      "Phòng ký sinh trùng, ve – bọ chét",
    ],
    highlightsEn: [
      "Vaccination & epidemiology specialist",
      "Care, Parvo & FVRCP vaccine programs",
      "Personalized schedules + automatic reminders",
      "Parasite, tick & flea prevention",
    ],
  },
];

export function findDoctorBySlug(slug: string): Doctor | undefined {
  return teamDoctors.find((doctor) => doctor.slug === slug);
}

export function doctorHref(slug: string): string {
  return `/doi-ngu/${slug}`;
}

export function doctorFullName(doctor: Doctor): string {
  return `${doctor.degree} ${doctor.name}`;
}