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

export class IndexDefinition {
  constructor(public readonly columns: string[]) {
    if (!columns.length) throw new Error("An index needs at least one column");
  }
}

export class SchemaBuilder {
  public static compileColumn(
    columnName: string,
    def: ColumnDefinition,
  ): string {
    let sqliteType: string = def.colType;
    if (def.colType === "JSON") sqliteType = "TEXT";
    if (def.colType === "BOOLEAN") sqliteType = "INTEGER";

    const nullability = def.isNullable ? "" : "NOT NULL";
    const uniqueness = def.isUnique ? "UNIQUE" : "";

    let defaultClause = "";
    if (def.defaultValue !== null) {
      if (typeof def.defaultValue === "string") {
        defaultClause = `DEFAULT '${def.defaultValue.replace(/'/g, "''")}'`;
      } else if (typeof def.defaultValue === "boolean") {
        defaultClause = `DEFAULT ${def.defaultValue ? 1 : 0}`;
      } else if (typeof def.defaultValue === "object") {
        defaultClause = `DEFAULT '${JSON.stringify(def.defaultValue).replace(/'/g, "''")}'`;
      } else {
        defaultClause = `DEFAULT ${def.defaultValue}`;
      }
    }

    return `${columnName} ${sqliteType} ${nullability} ${uniqueness} ${defaultClause}`
      .trim()
      .replace(/\s+/g, " ");
  }

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
    for (const [columnName, def] of Object.entries(schema))
      columnDefinitions.push(this.compileColumn(columnName, def));

    columnDefinitions.push(
      "createdAt TEXT DEFAULT (datetime('now', 'localtime'))",
    );

    return columnDefinitions.join(", ");
  }

  public static compileIndexes(
    tableName: string,
    indexes: IndexDefinition[],
  ): string[] {
    return indexes.map((index) => {
      const name = `${tableName}_${index.columns.join("_")}`;
      return `CREATE INDEX IF NOT EXISTS ${name} ON ${tableName} (${index.columns.join(", ")})`;
    });
  }
}

export const table = {
  integer: () => new ColumnDefinition().integer(),
  text: () => new ColumnDefinition().text(),
  date: () => new ColumnDefinition().date(),
  json: () => new ColumnDefinition().json(),
  boolean: () => new ColumnDefinition().boolean(),
  index: (...columns: string[]) => new IndexDefinition(columns),
};
