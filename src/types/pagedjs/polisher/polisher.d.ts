export default Polisher;
declare class Polisher {
  constructor(setup: any);
  sheets: any[];
  inserted: any[];
  hooks: {};
  setup(): CSSStyleSheet;
  base: HTMLStyleElement;
  styleEl: HTMLStyleElement;
  styleSheet: CSSStyleSheet;
  add(...args: any[]): Promise<string>;
  convertViaSheet(cssStr: any, href: any): Promise<any>;
  width: any;
  height: any;
  orientation: any;
  insert(text: any): HTMLStyleElement;
  destroy(): void;
}
