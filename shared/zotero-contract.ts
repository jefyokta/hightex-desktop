export interface ZoteroCreator {
  creatorType: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

export interface ZoteroItem {
  key: string;
  title: string;
  itemType?: string;
  creators?: ZoteroCreator[];
  date?: string;
  url?: string;
  doi?: string;
}

export interface ZoteroConnectionResult {
  connected: boolean;
  message: string;
  host: string;
  port: number;
}
