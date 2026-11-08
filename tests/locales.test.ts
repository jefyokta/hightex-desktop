import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import en from "../src/locales/en.json";
import id from "../src/locales/id.json";
import { setCurrentLanguage, t } from "../src/utils/lang";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
afterEach(() => {
  if (originalWindow)
    Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  setCurrentLanguage("en");
});

function flatten(object: object, prefix = ""): Record<string, string> {
  return Object.fromEntries(
    Object.entries(object).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof value === "string"
        ? [[path, value]]
        : Object.entries(flatten(value, path));
    }),
  );
}
const messages = { en: flatten(en), id: flatten(id) };
const parameters = (message: string) =>
  [
    ...new Set([...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1])),
  ].sort();

function literalKeys(node: ts.Node | undefined): string[] {
  if (!node) return [];
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return [node.text];
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node))
    return literalKeys(node.expression);
  if (ts.isConditionalExpression(node))
    return [...literalKeys(node.whenTrue), ...literalKeys(node.whenFalse)];
  return [];
}

// Check known keys and inline parameter objects; dynamic keys/objects need runtime coverage.
function missingParameters(source: string, filename: string) {
  const file = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const errors: string[] = [];
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["t", "translate"].includes(node.expression.text)
    ) {
      const [key, values] = node.arguments;
      if (
        !values ||
        (ts.isObjectLiteralExpression(values) &&
          !values.properties.some(ts.isSpreadAssignment))
      ) {
        const supplied =
          values && ts.isObjectLiteralExpression(values)
            ? values.properties.flatMap((property) =>
                property.name &&
                (ts.isIdentifier(property.name) ||
                  ts.isStringLiteral(property.name))
                  ? [property.name.text]
                  : [],
              )
            : [];
        for (const name of literalKeys(key)) {
          if (!messages.en[name]) continue;
          const missing = parameters(messages.en[name]).filter(
            (p) => !supplied.includes(p),
          );
          if (missing.length) {
            const line =
              file.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            errors.push(
              `${filename}:${line} ${name}: missing ${missing.join(", ")}`,
            );
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return errors;
}

test("English and Indonesian locales have matching keys and interpolation parameters", () => {
  expect(Object.keys(messages.id).sort()).toEqual(
    Object.keys(messages.en).sort(),
  );
  const errors: string[] = [];
  for (const [key, message] of Object.entries(messages.en)) {
    if (
      JSON.stringify(parameters(messages.id[key])) !==
      JSON.stringify(parameters(message))
    )
      errors.push(`${key}: interpolation parameters differ between languages`);
    for (const language of ["id", "en"] as const)
      if (/\$\{\w+\}/.test(messages[language][key]))
        errors.push(
          `${language}.${key}: use {name}, not JavaScript template syntax`,
        );
  }
  expect(errors).toEqual([]);
});

test("locale calls supply every required interpolation parameter", () => {
  const root = new URL("../src/", import.meta.url);
  const errors = [
    ...new Bun.Glob("**/*.{ts,tsx}").scanSync({ cwd: root.pathname }),
  ].flatMap((filename) =>
    missingParameters(readFileSync(new URL(filename, root), "utf8"), filename),
  );
  expect(errors).toEqual([]);
});

test("locale check catches missing and misspelled parameters", () => {
  const errors = missingParameters(
    `
    t("editor.findReplace.matchCount");
    t("editor.findReplace.matchCount", { count: 1, total: 3 });
    t("editor.findReplace.matchCount", { current: 1, total: 3 });
  `,
    "example.tsx",
  );
  expect(errors).toHaveLength(2);
  expect(errors[0]).toContain("missing current, total");
  expect(errors[1]).toContain("missing current");
});

for (const language of ["id", "en"] as const) {
  test(`${language} cleanup and progress messages render counts without unresolved placeholders`, () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { config: { get: () => ({ language }) } },
    });
    const cleanup = t("settings.data.clear_cache.progress.start", {
      chaptersCount: 4,
      imagesCount: 6,
    });
    expect(cleanup).toContain("0/4");
    expect(cleanup).toContain("0/6");
    expect(cleanup).not.toContain("$");
    const deleted = t("settings.data.clear_data.deleting.done", { total: 3 });
    expect(deleted).toContain("3");
    expect(deleted).not.toMatch(/\{\w+\}/);
    expect(t("editor.findReplace.matchCount", { current: 2, total: 7 })).toBe(
      language === "id" ? "2 dari 7" : "2 of 7",
    );
    const identifier = "$& $1 $$ {current}";
    const progress = t("settings.data.clear_data.deleting.progress", {
      deleted: 1,
      total: 3,
      identifier,
    });
    expect(progress).toContain("1/3");
    expect(progress).toEndWith(identifier);
  });
}
