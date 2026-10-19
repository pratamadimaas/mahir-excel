/** Kode galat yang dapat dihasilkan mesin spreadsheet Mahir Excel. */
export type ErrorCode =
  | '#ERROR!' // sintaks rumus salah (di Excel, rumus semacam ini tidak bisa dimasukkan sama sekali)
  | '#NAME?' // nama fungsi tidak dikenal / tidak didukung
  | '#VALUE!' // tipe nilai salah
  | '#REF!' // referensi di luar batas grid
  | '#DIV/0!' // pembagian dengan nol
  | '#NUM!' // hasil numerik tidak valid
  | '#N/A' // nilai pencarian tidak ditemukan (VLOOKUP, XLOOKUP, MATCH)
  | '#CIRC!' // referensi melingkar (Excel menampilkan peringatan dan 0)
  | '#LIMIT!'; // melewati batas sumber daya mesin

export class ErrorValue {
  constructor(
    public readonly code: ErrorCode,
    public readonly message: string,
  ) {}
  toString(): string {
    return this.code;
  }
}

export type Scalar = number | string | boolean | null;
export type Value = Scalar | ErrorValue;

export const isError = (v: unknown): v is ErrorValue => v instanceof ErrorValue;

/** Galat yang dilempar saat parsing atau evaluasi, lalu diubah menjadi ErrorValue. */
export class FormulaError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
  toValue(): ErrorValue {
    return new ErrorValue(this.code, this.message);
  }
}

export interface CellAddress {
  col: number; // 0-based
  row: number; // 0-based
}

export type Node =
  | { type: 'num'; value: number }
  | { type: 'str'; value: string }
  | { type: 'bool'; value: boolean }
  | { type: 'ref'; addr: CellAddress; text: string }
  | { type: 'range'; from: CellAddress; to: CellAddress; text: string }
  | { type: 'unary'; op: '-' | '+'; arg: Node }
  | { type: 'percent'; arg: Node }
  | { type: 'binary'; op: string; left: Node; right: Node }
  | { type: 'call'; name: string; args: Node[] };

export const LIMITS = {
  maxFormulaLength: 1000,
  maxParseDepth: 40,
  maxArgs: 64,
  maxEvalSteps: 200_000,
  maxEvalDepth: 120,
  maxRangeCells: 10_000,
  maxRows: 1000,
  maxCols: 702, // A..ZZ
} as const;
