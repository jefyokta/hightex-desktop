import { Grammar } from "@main/database/builder/grammar";
import { Select } from "@main/database/builder/select";
import { test, expect } from "bun:test";
test("relation ", () => {
  const user = {
    getTableName() {
      return "users";
    },
    get schemaKeys() {
      return [];
    },
  };

  const post = {
    getTableName() {
      return "posts";
    },
    get schemaKeys() {
      return [];
    },
  };

  const userSelect = new Select(user);
  const postSelect = new Select(post);

  userSelect.join(post.getTableName(), "users.id = posts.author");

  postSelect.where("archive", false);
  postSelect.select("title");
  userSelect.import(postSelect);
  expect(String(userSelect)).toBe(
    "SELECT users.*, posts.title FROM users INNER JOIN posts ON users.id = posts.author WHERE posts.archive = ?",
  );
  expect(userSelect.getBindings()[0]).toBe(false);
});

class FakeModel implements Queryable<any> {
  protected select = new Select(this);
  with(relation: FakeModel, callback?: (builder: Select) => any) {
    this.select.join(
      relation.getTableName(),
      `${this.getTableName()}.id = ${relation.getTableName()}.${this.constructor.name.toLowerCase()}Id`,
    );
    let tmp: null | Select = null;
    if (callback) {
      tmp = new Select(relation);
      callback(tmp);
    }
    if (tmp) this.select.import(tmp);

    return this.select;
  }

  getTableName(): string {
    return new Grammar().pluralize(this.constructor.name);
  }
  get schemaKeys() {
    return [];
  }
}

class User extends FakeModel {}
class Post extends FakeModel {}

test("relation model style", () => {
  const select = new User().with(new Post(), (query) => {
    query.where("archive", false).select("title");
  });

  expect(String(select)).toBe(
    "SELECT users.*, posts.title FROM users INNER JOIN posts ON users.id = posts.userId WHERE posts.archive = ?",
  );
});
