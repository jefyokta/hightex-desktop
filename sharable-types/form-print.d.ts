import type { FormPrintInput } from "../src/forms/model";
export {};
declare global {
  interface FormPrintAPI {
    export(input: FormPrintInput): Promise<{ path: string } | null>;
    init(request: string): Promise<FormPrintInput>;
    ready(request: string, index: number): void;
    error(request: string, message: string): void;
  }
  interface Window {
    formPrint: FormPrintAPI;
  }
}
