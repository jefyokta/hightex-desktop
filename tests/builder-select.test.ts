import { Select } from "@main/database/builder/select";
import { Grammar } from "@main/database/builder/grammar";
import { expect, test } from "bun:test";

const testClass = new (class Test implements Queryable<any> {
  getTableName(): string {
    return new Grammar().pluralize(this.constructor.name);
  }
  get schemaKeys(): any[] {
    return []
  }
})();
test("select test", () => {
  const select = new Select(testClass);
  expect(String(select)).toBe("SELECT tests.* FROM tests");
});

test("binding test", () => {
  const select = new Select(testClass);
  select.where("name", "okta");
  expect(String(select)).toBe("SELECT tests.* FROM tests WHERE tests.name = ?");
  expect(select.getBindings()).not.toBeEmpty();
});
