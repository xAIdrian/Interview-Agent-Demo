declare module 'tabulator-tables' {
  export class TabulatorFull {
    constructor(selector: string | HTMLElement, options?: TabulatorOptions);
    destroy(): void;
    setData(data: any[]): void;
  }

  interface TabulatorOptions {
    data?: any[];
    columns?: ColumnDefinition[];
    layout?: string;
    pagination?: boolean;
    paginationSize?: number;
    paginationSizeSelector?: number[];
    movableColumns?: boolean;
    resizableRows?: boolean;
    initialSort?: SortDefinition[];
    dataLoaded?: (data: any[]) => void;
    rowClick?: (e: Event, row: Row) => void;
  }

  interface ColumnDefinition {
    title: string;
    field: string;
    formatter?: (cell: Cell) => string | HTMLElement;
    sorter?: string;
    widthGrow?: number;
    headerFilter?: boolean;
    headerFilterParams?: Record<string, any>;
    hozAlign?: string;
    cellClick?: (e: Event, cell: Cell) => void;
  }

  interface SortDefinition {
    column: string;
    dir: 'asc' | 'desc';
  }

  interface Cell {
    getValue(): any;
  }

  interface Row {
    getData(): any;
  }
} 
