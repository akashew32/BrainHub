export type MathInputKind = "number" | "vector" | "matrix";
export type MathInputValue = number | number[] | number[][];

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

export class PrecisionError extends InputError {
  constructor(
    message = "This expression needs exact arithmetic beyond the preview's safe integer range. Your original answer can still be submitted for exact server grading.",
  ) {
    super(message);
    this.name = "PrecisionError";
  }
}

const MAX_SCALAR_LENGTH = 160;
const MAX_INPUT_LENGTH = 4000;
const MAX_TOKENS = 80;
const MAX_DEPTH = 12;
const MAX_OPERATIONS = 40;
const MAX_ENTRIES = 64;
const MAX_VALUE = 1e100;
const MAX_EXPONENT = 100;

type Token = { kind: "number" | "name" | "operator" | "end"; text: string; value?: number };

function normalizeWhitespace(source: string) {
  return source.replace(
    /[ \t\r\n\f\v\u001C-\u001F\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g,
    " ",
  );
}

function mathematicallyIntegralLiteral(text: string) {
  const [mantissa = "", exponentText = "0"] = text.split(/[eE]/);
  const fractionalDigits = mantissa.includes(".") ? mantissa.length - mantissa.indexOf(".") - 1 : 0;
  const digits = mantissa.replace(".", "");
  if (!/[1-9]/.test(digits)) return true;
  const shift = Number(exponentText) - fractionalDigits;
  if (shift >= 0) return true;
  const decimalPlaces = -shift;
  return decimalPlaces < digits.length && !/[1-9]/.test(digits.slice(-decimalPlaces));
}

function bounded(value: number, underflow = false): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_VALUE)
    throw new InputError("The expression is too large. Keep every value at or below 1e100 in magnitude.");
  if (underflow && value === 0)
    throw new InputError("The expression is too small to represent reliably. Rewrite it without underflow.");
  if (Number.isInteger(value) && !Number.isSafeInteger(value)) throw new PrecisionError();
  return Object.is(value, -0) ? 0 : value;
}

function unquote(source: string): string {
  const trimmed = source.trim();
  if (!trimmed.startsWith('"') && !trimmed.endsWith('"')) return trimmed;
  try {
    const decoded: unknown = JSON.parse(trimmed);
    if (typeof decoded === "string" && !decoded.includes("\uFEFF"))
      return normalizeWhitespace(decoded).trim();
  } catch {
    // Only a complete JSON string is accepted as a legacy scalar entry.
  }
  throw new InputError("Use double quotes only around a complete scalar expression.");
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;
  while (position < source.length) {
    const remaining = source.slice(position);
    const space = /^\s+/.exec(remaining);
    if (space) {
      position += space[0].length;
      continue;
    }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(remaining);
    if (number) {
      const value = Number(number[0]);
      const mantissa = number[0].split(/[eE]/, 1)[0]!;
      const checked = bounded(value, /[1-9]/.test(mantissa));
      if (Number.isInteger(checked) && !mathematicallyIntegralLiteral(number[0])) throw new PrecisionError();
      tokens.push({ kind: "number", text: number[0], value: checked });
      position += number[0].length;
    } else {
      const name = /^[A-Za-z_][A-Za-z_0-9]*/.exec(remaining);
      if (name) {
        if (!["sqrt", "pi", "e"].includes(name[0]))
          throw new InputError("Use numbers, pi, e, or sqrt(...); other names are not supported.");
        tokens.push({ kind: "name", text: name[0] });
        position += name[0].length;
      } else if (remaining.startsWith("**")) {
        tokens.push({ kind: "operator", text: "^" });
        position += 2;
      } else if ("+-*/^()".includes(source[position]!)) {
        tokens.push({ kind: "operator", text: source[position]! });
        position += 1;
      } else {
        throw new InputError("Use +, -, *, /, powers, parentheses, pi, e, and sqrt(...).");
      }
    }
    if (tokens.length > MAX_TOKENS) throw new InputError("The expression has too many terms.");
  }
  tokens.push({ kind: "end", text: "" });
  return tokens;
}

class ScalarParser {
  private cursor = 0;
  private operations = 0;
  private depth = 0;
  private powerWeight = 1;

  constructor(private readonly tokens: Token[]) {}

  private current() {
    return this.tokens[this.cursor]!;
  }

  private consume(operator: string) {
    if (this.current().text !== operator) return false;
    this.cursor += 1;
    return true;
  }

  private operation(value: number, underflow = false, weight = this.powerWeight) {
    this.operations += 1;
    if (this.operations > MAX_OPERATIONS) throw new InputError("The expression needs too many operations.");
    this.powerWeight = weight;
    return bounded(value, underflow);
  }

  private nested(compute: () => number) {
    this.depth += 1;
    if (this.depth > MAX_DEPTH) throw new InputError("The expression is nested too deeply.");
    try {
      return compute();
    } finally {
      this.depth -= 1;
    }
  }

  parse() {
    if (this.current().kind === "end") throw new InputError("Enter a number or a complete expression.");
    const value = this.expression();
    if (this.current().kind !== "end")
      throw new InputError("Unexpected text after the expression. Use * for multiplication.");
    return value;
  }

  private expression(): number {
    let value = this.term();
    let weight = this.powerWeight;
    while (true) {
      if (this.consume("+")) {
        const right = this.term();
        const sum = value + right;
        if ((right !== 0 && sum === value) || (value !== 0 && sum === right)) throw new PrecisionError();
        weight += this.powerWeight;
        value = this.operation(sum, false, weight);
      } else if (this.consume("-")) {
        const right = this.term();
        const difference = value - right;
        if ((right !== 0 && difference === value) || (value !== 0 && difference === -right))
          throw new PrecisionError();
        weight += this.powerWeight;
        value = this.operation(difference, false, weight);
      } else return value;
    }
  }

  private term(): number {
    let value = this.unary();
    let weight = this.powerWeight;
    while (true) {
      if (this.consume("*")) {
        const right = this.unary();
        weight += this.powerWeight;
        value = this.operation(value * right, value !== 0 && right !== 0, weight);
      } else if (this.consume("/")) {
        const right = this.unary();
        if (right === 0) throw new InputError("Division by zero is not defined.");
        weight += this.powerWeight;
        value = this.operation(value / right, value !== 0, weight);
      } else {
        return value;
      }
    }
  }

  private unary(): number {
    if (this.consume("+")) return this.nested(() => this.operation(this.unary()));
    if (this.consume("-")) return this.nested(() => this.operation(-this.unary()));
    return this.power();
  }

  private power(): number {
    const base = this.primary();
    const baseWeight = this.powerWeight;
    if (!this.consume("^")) return base;
    const exponent = this.nested(() => this.unary());
    if (Math.abs(exponent) > MAX_EXPONENT) throw new InputError("Keep power exponents between -100 and 100.");
    if (base === 0 && exponent === 0) throw new InputError("Zero to the power zero is not defined here.");
    if (base === 0 && exponent < 0) throw new InputError("Zero cannot have a negative power.");
    if (base < 0 && !Number.isInteger(exponent))
      throw new InputError("A negative base needs an integer exponent for a real-valued power.");
    const weight = baseWeight * Math.max(1, Math.abs(exponent));
    if (weight > 4096)
      throw new PrecisionError(
        "These nested powers exceed the preview's arithmetic budget. Simplify the expression; your original draft is kept for submission.",
      );
    return this.operation(base ** exponent, base !== 0, weight);
  }

  private primary(): number {
    const token = this.current();
    if (token.kind === "number") {
      this.cursor += 1;
      this.powerWeight = 1;
      return token.value!;
    }
    if (token.text === "pi" || token.text === "e") {
      this.cursor += 1;
      this.powerWeight = 1;
      return token.text === "pi" ? Math.PI : Math.E;
    }
    if (token.text === "sqrt") {
      this.cursor += 1;
      if (!this.consume("(")) throw new InputError("Write a square root as sqrt(...).");
      const value = this.nested(() => this.expression());
      if (!this.consume(")")) throw new InputError("Close the square-root parentheses.");
      if (value < 0) throw new InputError("Square roots of negative numbers are not real.");
      return this.operation(Math.sqrt(value), value !== 0);
    }
    if (this.consume("(")) {
      const value = this.nested(() => this.expression());
      if (!this.consume(")")) throw new InputError("Close each opening parenthesis.");
      return value;
    }
    throw new InputError("Complete the expression with a number, constant, or parenthesized expression.");
  }
}

function scalar(input: string, quotedEntry = false) {
  if (input.length > MAX_SCALAR_LENGTH)
    throw new InputError("Keep each scalar expression within 160 characters.");
  if (!quotedEntry && input.trim().startsWith('"'))
    throw new InputError(
      "Enter scalar expressions without quotes. Quoted entries are supported inside vectors and matrices.",
    );
  const source = (quotedEntry ? unquote(input) : input.trim()).replace(/\u2212/g, "-").replace(/π/g, "pi");
  if (source.length > MAX_SCALAR_LENGTH)
    throw new InputError("Keep each scalar expression within 160 characters.");
  return new ScalarParser(tokenize(source)).parse();
}

/** Split only outside parentheses, brackets, and complete JSON strings. */
function splitTopLevel(source: string, separator: "," | ";", containerDepth = 0): string[] {
  const parts: string[] = [];
  const stack: string[] = [];
  let quoted = false;
  let escaped = false;
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') {
      quoted = true;
      continue;
    }
    if (character === "(" || character === "[") {
      stack.push(character);
      if (stack.length + containerDepth > MAX_DEPTH) throw new InputError("The input is nested too deeply.");
    } else if (character === ")" || character === "]") {
      const expected = character === ")" ? "(" : "[";
      if (stack.pop() !== expected) throw new InputError("Match every opening bracket and parenthesis.");
    } else if (character === separator && stack.length === 0) {
      parts.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (quoted || escaped) throw new InputError("Close every quoted scalar entry.");
  if (stack.length) throw new InputError("Close every opening bracket and parenthesis.");
  parts.push(source.slice(start).trim());
  if (parts.some((part) => part.length === 0))
    throw new InputError("Each entry must contain an expression; remove empty or trailing cells.");
  return parts;
}

function removeOuterBrackets(input: string) {
  const source = input.trim();
  if (!source.startsWith("[")) return source;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === "[") depth += 1;
    else if (character === "]") {
      depth -= 1;
      if (depth === 0) {
        if (index !== source.length - 1) throw new InputError("Remove text after the closing bracket.");
        return source.slice(1, -1).trim();
      }
    }
  }
  throw new InputError("Close the vector or matrix brackets.");
}

function vector(input: string, outerDepth = 0): number[] {
  const containerDepth = outerDepth + (input.trim().startsWith("[") ? 1 : 0);
  const entries = splitTopLevel(removeOuterBrackets(input), ",", containerDepth);
  if (entries.length > MAX_ENTRIES) throw new InputError("Use at most 64 scalar entries.");
  return entries.map((entry) => scalar(entry, true));
}

function matrix(input: string): number[][] {
  const source = removeOuterBrackets(input);
  const containerDepth = input.trim().startsWith("[") ? 1 : 0;
  const rowSources = splitTopLevel(source, ";", containerDepth);
  let rows: number[][];
  if (rowSources.length > 1) {
    rows = rowSources.map((row) => vector(row, containerDepth));
  } else if (source.startsWith("[")) {
    rows = splitTopLevel(source, ",", containerDepth).map((row) => {
      if (!row.startsWith("[") || !row.endsWith("]"))
        throw new InputError("Use a bracketed vector for every matrix row.");
      return vector(row, containerDepth);
    });
  } else {
    throw new InputError("Wrap each matrix row in brackets, or separate rows with semicolons.");
  }
  const width = rows[0]!.length;
  if (rows.some((row) => row.length !== width))
    throw new InputError("Every matrix row must have the same number of entries.");
  if (rows.reduce((total, row) => total + row.length, 0) > MAX_ENTRIES)
    throw new InputError("Use at most 64 scalar entries in the matrix.");
  return rows;
}

/** Parse only the documented arithmetic grammar. This never executes input as code. */
export function parseMathInput(kind: MathInputKind, input: string): MathInputValue {
  if (input.includes("\uFEFF")) throw new InputError("Remove the unsupported byte-order-mark whitespace.");
  if (input.length > MAX_INPUT_LENGTH) throw new InputError("Keep the answer within 4000 characters.");
  const source = normalizeWhitespace(input);
  if (!source.trim()) throw new InputError("Enter an answer to see its interpreted value.");
  if (kind === "number") return scalar(source);
  if (kind === "vector") return vector(source);
  return matrix(source);
}
