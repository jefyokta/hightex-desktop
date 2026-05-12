export {};
declare global {
  interface Window {
    session: {
      user(): Promise<User | false>;
      login(email: string, password: string): Promise<User | false>;
      logout(): Promise<void>;
      onChange?: (cb: (u: User | false) => void) => () => void;
    };
    hightex: {
      document(): Promise<{ document: HighTexDocument }>;
      prefetch(): Promise<void>;
      onPrefetchProgress(
        data: any,
      ): Promise<{ data: string; progress: number }>;
      categories(): Promise<Category[]>;
    };
  }
}
