"""Bounded arithmetic input shared by mathematical grading and answer previews.

This is a small parser, not a Python expression evaluator. It recognizes only
the documented arithmetic grammar and retains rational arithmetic internally
so exact counting questions do not lose integer precision.
"""

from __future__ import annotations

import json
import math
import re
from fractions import Fraction
from typing import Any, Literal

VERSION = 1
MAX_SCALAR_LENGTH = 160
MAX_CONTAINER_LENGTH = 4000
MAX_TOKENS = 80
MAX_DEPTH = 12
MAX_OPERATIONS = 40
MAX_ENTRIES = 64
MAX_EXPONENT = 100
MAX_MAGNITUDE = 10**100
MAX_RATIONAL_BITS = 4096
MAX_SAFE_INTEGER = 2**53 - 1

_NUMBER = re.compile(r"(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?")
_NAME = re.compile(r"[A-Za-z_][A-Za-z_0-9]*")
Scalar = Fraction | float
_WHITESPACE = frozenset(
    " \t\r\n\v\f"
    + "".join(chr(codepoint) for codepoint in range(0x1C, 0x20))
    + "\u0085\u00a0\u1680"
    + "".join(chr(codepoint) for codepoint in range(0x2000, 0x200B))
    + "\u2028\u2029\u202f\u205f\u3000"
)


def _normalize_whitespace(source: str) -> str:
    if "\ufeff" in source:
        raise ValueError("Remove the byte order mark from this answer.")
    return "".join(" " if character in _WHITESPACE else character for character in source)


def _exceeds(value: Scalar, bound: int) -> bool:
    if isinstance(value, Fraction):
        return abs(value.numerator) > bound * value.denominator
    return abs(value) > bound


def _checked(value: Scalar, *, nonzero_expected: bool = False) -> Scalar:
    if (
        isinstance(value, Fraction)
        and max(value.numerator.bit_length(), value.denominator.bit_length()) > MAX_RATIONAL_BITS
    ):
        raise ValueError("The exact expression is too complex. Simplify it before submitting.")
    try:
        approximate = float(value)
    except (ValueError, OverflowError) as error:
        raise ValueError("The result exceeds the supported numeric range.") from error
    if not math.isfinite(approximate) or _exceeds(value, MAX_MAGNITUDE):
        raise ValueError("Use finite values with magnitude at most 1e100.")
    if isinstance(value, float) and abs(value) > MAX_SAFE_INTEGER:
        raise ValueError("An approximate intermediate is too large. Use an exact rational form.")
    if approximate == 0 and (value != 0 or nonzero_expected):
        raise ValueError("The result is too small to represent without underflow.")
    return value


def _guard_binary(left: Scalar, right: Scalar, operator: str) -> None:
    if not isinstance(left, Fraction) or not isinstance(right, Fraction):
        _guard_approximate(left, right)
        return
    ln, ld = max(1, left.numerator.bit_length()), left.denominator.bit_length()
    rn, rd = max(1, right.numerator.bit_length()), right.denominator.bit_length()
    if operator in {"+", "-"}:
        projected = max(max(ln + rd, rn + ld) + 1, ld + rd)
    elif operator == "*":
        projected = max(ln + rn, ld + rd)
    else:
        projected = max(ln + rd, ld + rn)
    if projected > MAX_RATIONAL_BITS:
        raise ValueError("The exact expression is too complex. Simplify it before submitting.")


def _guard_approximate(*values: Scalar) -> None:
    if any(_exceeds(value, MAX_SAFE_INTEGER) for value in values):
        raise ValueError("An approximate intermediate is too large. Use an exact rational form.")


def _tokens(source: str) -> list[tuple[str, str]]:
    tokens: list[tuple[str, str]] = []
    position = 0
    while position < len(source):
        if source[position] == " ":
            position += 1
            continue
        number = _NUMBER.match(source, position)
        name = _NAME.match(source, position)
        if number:
            tokens.append(("number", number.group()))
            position = number.end()
        elif name:
            if name.group() not in {"pi", "e", "sqrt"}:
                raise ValueError("Only the constants pi, e and the function sqrt are supported.")
            tokens.append((name.group(), name.group()))
            position = name.end()
        elif source.startswith("**", position):
            tokens.append(("^", "**"))
            position += 2
        elif source[position] in "+-*/^()":
            tokens.append((source[position], source[position]))
            position += 1
        else:
            raise ValueError("Use numbers, pi, e, sqrt, parentheses and + - * / ^ only.")
        if len(tokens) > MAX_TOKENS:
            raise ValueError("The expression contains too many tokens.")
    tokens.append(("end", ""))
    return tokens


class _Parser:
    def __init__(self, source: str):
        self.tokens = _tokens(source.replace("−", "-").replace("π", "pi"))
        self.position = 0
        self.operations = 0

    def current(self) -> str:
        return self.tokens[self.position][0]

    def consume(self, kind: str) -> None:
        if self.current() != kind:
            raise ValueError("Check the expression's operators and parentheses.")
        self.position += 1

    def operation(self) -> None:
        self.operations += 1
        if self.operations > MAX_OPERATIONS:
            raise ValueError("The expression contains too many operations.")

    @staticmethod
    def check_depth(depth: int) -> None:
        if depth > MAX_DEPTH:
            raise ValueError("The expression is nested too deeply.")

    def parse(self) -> Scalar:
        value = self.sum(0)
        if self.current() != "end":
            raise ValueError("Use explicit multiplication and remove trailing input.")
        return _checked(value)

    def sum(self, depth: int) -> Scalar:
        self.check_depth(depth)
        value = self.product(depth)
        while self.current() in {"+", "-"}:
            operator = self.current()
            self.position += 1
            self.operation()
            right = self.product(depth)
            _guard_binary(value, right, operator)
            value = _checked(value + right if operator == "+" else value - right)
        return value

    def product(self, depth: int) -> Scalar:
        value = self.unary(depth)
        while self.current() in {"*", "/"}:
            operator = self.current()
            self.position += 1
            self.operation()
            right = self.unary(depth)
            if operator == "/" and right == 0:
                raise ValueError("Division by zero is not defined.")
            _guard_binary(value, right, operator)
            nonzero = value != 0 and right != 0
            value = _checked(
                value * right if operator == "*" else value / right,
                nonzero_expected=nonzero,
            )
        return value

    def unary(self, depth: int) -> Scalar:
        self.check_depth(depth)
        if self.current() in {"+", "-"}:
            operator = self.current()
            self.position += 1
            self.operation()
            value = self.unary(depth + 1)
            return _checked(value if operator == "+" else -value)
        return self.power(depth)

    def power(self, depth: int) -> Scalar:
        value = self.atom(depth)
        if self.current() == "^":
            self.position += 1
            self.operation()
            exponent = self.unary(depth + 1)
            if _exceeds(exponent, MAX_EXPONENT):
                raise ValueError("Power exponents must have magnitude at most 100.")
            integer_exponent = (
                exponent.denominator == 1
                if isinstance(exponent, Fraction)
                else exponent.is_integer()
            )
            if value == 0 and exponent <= 0:
                raise ValueError("Zero cannot be raised to a zero or negative power.")
            if value < 0 and not integer_exponent:
                raise ValueError("Use integer exponents with a negative base.")
            try:
                if isinstance(value, Fraction) and integer_exponent:
                    projected = max(
                        value.numerator.bit_length(), value.denominator.bit_length()
                    ) * abs(int(exponent))
                    if projected > MAX_RATIONAL_BITS:
                        raise ValueError("The exact power is too complex. Simplify it first.")
                    powered: Scalar = value ** int(exponent)
                else:
                    _guard_approximate(value, exponent)
                    powered = math.pow(float(value), float(exponent))
            except (ValueError, OverflowError, ZeroDivisionError) as error:
                raise ValueError("This power has no supported finite real value.") from error
            value = _checked(powered, nonzero_expected=value != 0)
        return value

    def atom(self, depth: int) -> Scalar:
        kind, source = self.tokens[self.position]
        if kind == "number":
            self.position += 1
            try:
                # Screen huge scientific exponents before Fraction constructs
                # any power of ten. Zero mantissas require no allocation at all.
                approximate = float(source)
                if approximate == 0:
                    mantissa = re.split("[eE]", source, maxsplit=1)[0]
                    if any(character in "123456789" for character in mantissa):
                        raise ValueError("This nonzero literal underflows the numeric range.")
                    return Fraction(0)
                if not math.isfinite(approximate) or abs(approximate) > float(MAX_MAGNITUDE):
                    raise ValueError("The literal exceeds the supported numeric range.")
                return _checked(Fraction(source))
            except (ValueError, OverflowError, ZeroDivisionError) as error:
                raise ValueError(
                    "Enter a finite number within the supported numeric range."
                ) from error
        if kind in {"pi", "e"}:
            self.position += 1
            return math.pi if kind == "pi" else math.e
        if kind == "(":
            self.position += 1
            value = self.sum(depth + 1)
            self.consume(")")
            return value
        if kind == "sqrt":
            self.position += 1
            self.consume("(")
            self.operation()
            value = self.sum(depth + 1)
            self.consume(")")
            if value < 0:
                raise ValueError("A real square root requires a nonnegative input.")
            if isinstance(value, Fraction):
                numerator = math.isqrt(value.numerator)
                denominator = math.isqrt(value.denominator)
                if numerator**2 == value.numerator and denominator**2 == value.denominator:
                    return _checked(Fraction(numerator, denominator))
            _guard_approximate(value)
            return _checked(math.sqrt(float(value)), nonzero_expected=value != 0)
        raise ValueError("Enter a number, constant, square root or parenthesized expression.")


def exact_value(value: Any) -> Scalar:
    """Parse a scalar while retaining rational precision for authoritative grading."""
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise ValueError("Enter a number or supported arithmetic expression.")
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("Answers must be finite.")
        return _checked(Fraction(str(value)))
    source = str(value)
    if len(source) > MAX_SCALAR_LENGTH:
        raise ValueError("Use an expression containing at most 160 characters.")
    source = _normalize_whitespace(source)
    if not source.strip():
        raise ValueError("Enter a number or supported arithmetic expression.")
    return _Parser(source).parse()


def parse_number(value: Any) -> float:
    return float(exact_value(value))


def matches_integer(value: Any, expected: int) -> bool:
    actual = exact_value(value)
    if isinstance(actual, Fraction):
        return actual.denominator == 1 and actual.numerator == expected
    raise ValueError("For an integer answer, use an exact integer or rational expression.")


def _split(source: str, separator: str) -> list[str]:
    stack: list[str] = []
    quoted = False
    escaped = False
    parts = []
    start = 0
    for index, character in enumerate(source):
        if quoted:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                quoted = False
            continue
        if character == '"':
            quoted = True
        elif character in "([":
            stack.append(character)
            if len(stack) > MAX_DEPTH:
                raise ValueError("The answer is nested too deeply.")
        elif character in ")]":
            expected = "(" if character == ")" else "["
            if not stack or stack.pop() != expected:
                raise ValueError("Check the answer's parentheses and brackets.")
        elif character == separator and not stack:
            parts.append(source[start:index].strip())
            start = index + 1
    if quoted or stack:
        raise ValueError("Close every quoted entry, parenthesis and bracket.")
    parts.append(source[start:].strip())
    if any(not part for part in parts):
        raise ValueError("Every answer entry must contain a value.")
    return parts


def _unwrap(source: str) -> str | None:
    if not source.startswith("["):
        return None
    depth = 0
    quoted = False
    escaped = False
    for index, character in enumerate(source):
        if quoted:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                quoted = False
        elif character == '"':
            quoted = True
        elif character == "[":
            depth += 1
        elif character == "]":
            depth -= 1
            if depth == 0:
                return source[1:-1].strip() if index == len(source) - 1 else None
    raise ValueError("Close every answer bracket.")


def _cell(source: str) -> float:
    if source.startswith('"'):
        try:
            value = json.loads(source)
        except (ValueError, TypeError) as error:
            raise ValueError("Use valid double quotes around a quoted arithmetic entry.") from error
        if not isinstance(value, str):
            raise ValueError("A quoted entry must contain one arithmetic expression.")
        return parse_number(value)
    return parse_number(source)


def parse_container(value: Any, kind: Literal["vector", "matrix"]) -> list[Any]:
    """Parse natural comma/semicolon input and existing JSON-style arrays."""
    if kind not in {"vector", "matrix"}:
        raise ValueError("Choose a vector or matrix answer format.")
    if isinstance(value, list):
        if kind == "vector":
            if not value or len(value) > MAX_ENTRIES:
                raise ValueError("Use between one and 64 vector entries.")
            return [parse_number(item) for item in value]
        if (
            not value
            or any(not isinstance(row, list) or not row for row in value)
            or sum(len(row) for row in value) > MAX_ENTRIES
            or any(len(row) != len(value[0]) for row in value)
        ):
            raise ValueError("Use a rectangular matrix with between one and 64 total entries.")
        return [[parse_number(item) for item in row] for row in value]
    if not isinstance(value, str) or len(value) > MAX_CONTAINER_LENGTH:
        raise ValueError("Use at most 4000 characters for a vector or matrix.")
    source = _normalize_whitespace(value).strip()
    # Validate overall nesting before removing the outer container brackets.
    _split(source, ";")
    unwrapped = _unwrap(source)
    source = unwrapped if unwrapped is not None else source
    if kind == "vector":
        entries = _split(source, ",")
        if len(entries) > MAX_ENTRIES:
            raise ValueError("Use at most 64 vector entries.")
        return [_cell(entry) for entry in entries]
    rows = _split(source, ";")
    if len(rows) == 1:
        rows = _split(source, ",")
        if any(_unwrap(row) is None for row in rows):
            raise ValueError(
                "Separate matrix rows with semicolons or enclose each row in brackets."
            )
    cells = []
    for row in rows:
        inner = _unwrap(row)
        cells.append(_split(inner if inner is not None else row, ","))
    if sum(len(row) for row in cells) > MAX_ENTRIES or any(
        len(row) != len(cells[0]) for row in cells
    ):
        raise ValueError("Use a rectangular matrix with at most 64 total entries.")
    return [[_cell(entry) for entry in row] for row in cells]


def parse_answer(value: Any, kind: Literal["number", "vector", "matrix"]) -> float | list[Any]:
    return parse_number(value) if kind == "number" else parse_container(value, kind)
