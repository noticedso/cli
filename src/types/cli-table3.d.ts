declare module "cli-table3" {
  interface TableOptions {
    head?: string[];
    colWidths?: number[];
    style?: Record<string, unknown>;
    chars?: Record<string, string>;
    wordWrap?: boolean;
  }

  class Table {
    constructor(options?: TableOptions);
    push(...items: unknown[]): void;
    toString(): string;
    length: number;
  }

  export default Table;
}
