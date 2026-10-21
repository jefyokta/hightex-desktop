export {};

declare global {
  interface CloudAcademicData {
    session: CloudSession;
    serverDocumentId: string | null;
    author: {
      name: string;
      nim: string;
      advisorName: string;
      advisorNip: string;
      secondAdvisor?: { name: string; nip: string };
    };
    committee: {
      leader: string;
      member_1: string;
      member_2: string;
      kaprodi: { name: string; nip: string };
      dekan: { name: string; nip: string };
    };
  }
  interface CloudAcademicSource {
    serverUrl: string;
    accountId: string;
    serverDocumentId: string;
    author: CloudAcademicData["author"];
    committee: CloudAcademicData["committee"];
  }
  interface CloudAcademicAPI {
    locked(localDocumentId: string): Promise<boolean>;
    load(input: {
      sessionId: string;
      serverDocumentId: string | null;
    }): Promise<CloudAcademicData>;
  }
}
