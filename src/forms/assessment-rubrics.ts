export interface AssessmentSection {
  title: string;
  criteria: { label: string; weight: number }[];
}
export const ADVISOR_RUBRIC: AssessmentSection[] = [
  {
    title: "I. Usaha",
    criteria: [
      { label: "Motivasi dan semangat", weight: 20 },
      { label: "Keuletan dalam bekerja", weight: 10 },
      { label: "Kesediaan untuk bekerja keras", weight: 10 },
    ],
  },
  {
    title: "II. Kreativitas",
    criteria: [
      { label: "Kemampuan melahirkan ide dalam penelitian", weight: 10 },
      { label: "Kesediaan untuk belajar hal baru/berbeda", weight: 5 },
      {
        label: "Kesediaan menerapkan hal berbeda dalam penelitian",
        weight: 10,
      },
      { label: "Kemampuan menggunakan bahasa ilmiah", weight: 5 },
    ],
  },
  {
    title: "III. Tanggung Jawab",
    criteria: [
      { label: "Ketepatan waktu penelitian sesuai jadwal", weight: 5 },
      { label: "Kesediaan memenuhi arahan pembimbing", weight: 10 },
      {
        label: "Kesediaan mengikuti aturan ilmiah dalam penelitian",
        weight: 10,
      },
      { label: "Kesediaan memenuhi aturan penulisan laporan TA", weight: 5 },
    ],
  },
];
export const EXAM_RUBRIC: AssessmentSection[] = [
  {
    title: "I. Sikap & Kemampuan Presentasi",
    criteria: [
      { label: "Penampilan/etika", weight: 10 },
      { label: "Kecakapan dalam menggunakan alat bantu", weight: 5 },
      { label: "Kelengkapan bahan presentasi", weight: 5 },
    ],
  },
  {
    title: "II. Penguasaan Materi",
    criteria: [
      {
        label: "Pemahaman terhadap materi & pelaksanaan penelitian",
        weight: 20,
      },
      { label: "Kemampuan menjawab pertanyaan", weight: 10 },
      { label: "Penguasaan terhadap literatur pendukung", weight: 10 },
    ],
  },
  {
    title: "III. Penulisan Laporan Tugas Akhir",
    criteria: [
      { label: "Kelengkapan isi laporan", weight: 10 },
      { label: "Kesesuaian dengan format penulisan laporan", weight: 10 },
      {
        label: "Kelengkapan daftar pustaka, lampiran dan pendukung",
        weight: 10,
      },
      {
        label: "Kelengkapan khusus (model, sampel, perhitungan, dll)",
        weight: 10,
      },
    ],
  },
];
export const CHAIR_RUBRIC: AssessmentSection[] = [
  {
    title: "I. Sikap dan Kemampuan Presentasi",
    criteria: [
      { label: "Penampilan/etika", weight: 20 },
      { label: "Kecakapan dalam menggunakan alat bantu", weight: 10 },
      { label: "Kelengkapan bahan presentasi", weight: 10 },
    ],
  },
  {
    title: "II. Basic Keislaman",
    criteria: [
      { label: "Pemahaman Keislaman", weight: 10 },
      { label: "Hafalan Juz 30", weight: 20 },
      { label: "Hafalan doa-doa", weight: 10 },
      { label: "Praktik ibadah", weight: 20 },
    ],
  },
];
