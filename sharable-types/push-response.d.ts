export {};
declare global {
  type PushResponse = ConflictResponse | NormalResponse;

  type ConflictResponse = {
    error: string;
    sha256: string;
  };

  type NormalResponse = {
    changed: boolean;
    sha256: string;
  };
}
