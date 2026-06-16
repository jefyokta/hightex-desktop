type ColType = "INTEGER" | "TEXT" | "DATE" | "JSON" | "BOOLEAN";

export class ColumnDefinition {
  public colType: ColType = "TEXT";
  public isNullable: boolean = false;
  public isUnique: boolean = false;
  public defaultValue: any = null;

  integer(): this {
    this.colType = "INTEGER";
    return this;
  }

  text(): this {
    this.colType = "TEXT";
    return this;
  }

  date(): this {
    this.colType = "DATE";
    return this;
  }

  json(): this {
    this.colType = "JSON";
    return this;
  }

  boolean(): this {
    this.colType = "BOOLEAN";
    return this;
  }

  nullable(): this {
    this.isNullable = true;
    return this;
  }

  unique(): this {
    this.isUnique = true;
    return this;
  }

  default(value: any): this {
    this.defaultValue = value;
    return this;
  }
}

export class SchemaBuilder {
  public static compile(
    schema: Record<string, ColumnDefinition>,
    primaryKeyName: string,
    primaryKeyType: "INTEGER" | "TEXT",
  ): string {
    const columnDefinitions: string[] = [];

    if (primaryKeyType === "INTEGER") {
      columnDefinitions.push(
        `${primaryKeyName} INTEGER PRIMARY KEY AUTOINCREMENT`,
      );
    } else {
      columnDefinitions.push(`${primaryKeyName} TEXT PRIMARY KEY`);
    }
    for (const [columnName, def] of Object.entries(schema)) {
      let sqliteType: string = def.colType;
      if (def.colType === "JSON") sqliteType = "TEXT";
      if (def.colType === "BOOLEAN") sqliteType = "INTEGER";

      const nullability = def.isNullable ? "" : "NOT NULL";
      const uniqueness = def.isUnique ? "UNIQUE" : "";

      let defaultClause = "";
      if (def.defaultValue !== null) {
        if (typeof def.defaultValue === "string") {
          defaultClause = `DEFAULT '${def.defaultValue}'`;
        } else if (typeof def.defaultValue === "boolean") {
          defaultClause = `DEFAULT ${def.defaultValue ? 1 : 0}`;
        } else if (typeof def.defaultValue === "object") {
          defaultClause = `DEFAULT '${JSON.stringify(def.defaultValue)}'`;
        } else {
          defaultClause = `DEFAULT ${def.defaultValue}`;
        }
      }

      columnDefinitions.push(
        `${columnName} ${sqliteType} ${nullability} ${uniqueness} ${defaultClause}`
          .trim()
          .replace(/\s+/g, " "),
      );
    }

    columnDefinitions.push(
      "createdAt TEXT DEFAULT (datetime('now', 'localtime'))",
    );

    return columnDefinitions.join(", ");
  }
}

export const table = {
  integer: () => new ColumnDefinition().integer(),
  text: () => new ColumnDefinition().text(),
  date: () => new ColumnDefinition().date(),
  json: () => new ColumnDefinition().json(),
  boolean: () => new ColumnDefinition().boolean(),
};
