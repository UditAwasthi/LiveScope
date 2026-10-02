export const VERSION = '1.0.0';

export type CompareOp = '>' | '<' | '>=' | '<=' | '=' | '!=';

export interface Clause {
  field: string;
  op: CompareOp;
  value: string | number;
}

export interface Filter {
  clauses: Clause[];
}

const OPS = new Set<CompareOp>(['>', '<', '>=', '<=', '=', '!=']);

export function parseFilter(source: string): Filter {
  const clauses = source
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const match = /^([A-Za-z_][\w.]*)\s*(>=|<=|!=|>|<|=)\s*(.+)$/.exec(part);
      if (!match) throw new Error(`invalid filter: ${part}`);
      const field = match[1];
      const op = match[2];
      const raw = match[3];
      if (!field || !op || raw === undefined || !OPS.has(op as CompareOp)) {
        throw new Error(`invalid filter: ${part}`);
      }
      const numeric = Number(raw);
      return { field, op: op as CompareOp, value: Number.isFinite(numeric) && raw.trim() !== '' ? numeric : raw.trim() };
    });
  return { clauses };
}

function compare(left: unknown, op: CompareOp, right: string | number): boolean {
  if (op === '=' || op === '!=') {
    const same = left === right || String(left) === String(right);
    return op === '=' ? same : !same;
  }
  const a = typeof left === 'number' ? left : Number(left);
  const b = typeof right === 'number' ? right : Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (op === '>') return a > b;
  if (op === '<') return a < b;
  if (op === '>=') return a >= b;
  return a <= b;
}

/** Comma-separated clauses are OR. */
export function evaluate(filter: Filter, context: Record<string, unknown>): boolean {
  if (filter.clauses.length === 0) return true;
  return filter.clauses.some((clause) => compare(context[clause.field], clause.op, clause.value));
}
