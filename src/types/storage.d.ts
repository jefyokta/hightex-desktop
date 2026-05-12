interface Keywords {
  indonesian: string[];
  english: string[];
}

interface User {
  name: string;
  email: string;
}
interface RawCategory extends Category {
  chapters: string;
}
interface Category {
  name: string;
  chapters: {
    chapter: string;
    title: string;
  }[];
  id: number;
}
interface Mentor extends User {
  role: "primary" | "secondary";
}
interface HighTexChapter {
  id: string;
  content: any;
}
interface HighTexConfig {
  consentDate: Date;
  validityDate: Date;
  statementDate: Date;
  leader: string;
  member1: string;
  member2: string;
}
interface HighTexDocument {
  id: string;
  category: string;
  title: string;
  altTitle: string;
  keywords: Keywords;
  config: HighTexConfig;
  updatedAt?: Date;
}

interface CiteRecord {
  key: string;
  bib: string;
}

interface ChapterGraph {
  id: string;
  data: {
    headings: HeadingGraph[];
    images: ImageGraph[];
    tables: TableGraph[];
  };
}
