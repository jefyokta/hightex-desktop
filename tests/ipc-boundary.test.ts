import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

test("renderer preload consumers use the shared IPC resolver", () => {
  const root = path.resolve(import.meta.dir, "..");
  const preload = readFileSync(path.join(root, "electron/preload/index.ts"), "utf8");
  const namespaces = new Set([...preload.matchAll(/exposeInMainWorld\("([^"]+)"/g)].map(match => match[1]));
  const violations: string[] = [];
  const windowExpression = (node: ts.Expression): boolean => {
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) return windowExpression(node.expression);
    if (ts.isIdentifier(node)) return node.text === "window";
    return ts.isPropertyAccessExpression(node)
      && ((node.expression.getText() === "globalThis" && node.name.text === "window")
        || (["parent", "top"].includes(node.name.text) && windowExpression(node.expression)));
  };
  for (const file of new Bun.Glob("**/*.{ts,tsx}").scanSync({ cwd: path.join(root, "src") })) {
    const source = ts.createSourceFile(file, readFileSync(path.join(root, "src", file), "utf8"), ts.ScriptTarget.Latest, true);
    const record = (node: ts.Node) => violations.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
    const visit = (node: ts.Node) => {
      if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && windowExpression(node.expression)) {
        const key = ts.isPropertyAccessExpression(node) ? node.name.text
          : node.argumentExpression && ts.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text : undefined;
        if (key && namespaces.has(key)) {
          // These are frame-local adapter definitions, not preload consumers. Never route writes to a parent.
          const snapshotAdapter = file === "pages/submission-print.tsx" && ["hightex", "ipcRenderer"].includes(key)
            && ts.isBinaryExpression(node.parent) && node.parent.left === node && node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
          if (!snapshotAdapter) record(node);
        }
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InKeyword
        && ts.isStringLiteral(node.left) && namespaces.has(node.left.text) && windowExpression(node.right)) record(node);
      if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer && windowExpression(node.initializer)) {
        for (const binding of node.name.elements) if (namespaces.has((binding.propertyName ?? binding.name).getText())) record(binding);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(namespaces.size).toBeGreaterThan(0);
  expect(violations).toEqual([]);
});
