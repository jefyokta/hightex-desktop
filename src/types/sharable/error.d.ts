declare global {
  interface MainError {
    name: string;
    message: string;
    safe: boolean;
  }
}

export {};
