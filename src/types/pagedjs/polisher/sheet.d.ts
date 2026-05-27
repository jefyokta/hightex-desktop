export default Sheet;
declare class Sheet {
  constructor(url: any, hooks: any);
  hooks: any;
  url: URL;
  parse(text: any): Promise<any>;
  set text(t: any);
  get text(): any;
  ast: any;
  id: string;
  imported: any[];
  insertRule(rule: any): any;
  urls(ast: any): void;
  atrules(ast: any): void;
  rules(ast: any): void;
  declarations(ruleNode: any, ruleItem: any, rulelist: any): void;
  onSelector(ruleNode: any, ruleItem: any, rulelist: any): void;
  replaceUrls(ast: any): void;
  addScope(ast: any, id: any): void;
  getNamedPageSelectors(ast: any): {};
  replaceIds(ast: any): void;
  imports(node: any, item: any, list: any): void;
  _text: any;
  toString(ast: any): any;
}
