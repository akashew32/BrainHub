"use client";

import { useMemo, useRef, type KeyboardEventHandler } from "react";
import type { ChallengeLanguage } from "@/lib/challenges";

type TokenKind = "comment" | "keyword" | "number" | "plain" | "string";

type SyntaxToken = {
  kind: TokenKind;
  value: string;
};

const keywordSets: Record<ChallengeLanguage, ReadonlySet<string>> = {
  python: new Set([
    "False",
    "None",
    "True",
    "and",
    "as",
    "assert",
    "async",
    "await",
    "break",
    "class",
    "continue",
    "def",
    "del",
    "elif",
    "else",
    "except",
    "finally",
    "for",
    "from",
    "global",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "nonlocal",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "self",
    "try",
    "while",
    "with",
    "yield",
  ]),
  java: new Set([
    "String",
    "abstract",
    "assert",
    "boolean",
    "break",
    "byte",
    "case",
    "catch",
    "char",
    "class",
    "const",
    "continue",
    "default",
    "do",
    "double",
    "else",
    "enum",
    "extends",
    "false",
    "final",
    "finally",
    "float",
    "for",
    "goto",
    "if",
    "implements",
    "import",
    "instanceof",
    "int",
    "interface",
    "long",
    "native",
    "new",
    "null",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "short",
    "static",
    "strictfp",
    "super",
    "switch",
    "synchronized",
    "this",
    "throw",
    "throws",
    "transient",
    "true",
    "try",
    "void",
    "volatile",
    "while",
  ]),
  cpp: new Set([
    "alignas",
    "alignof",
    "and",
    "asm",
    "auto",
    "bool",
    "break",
    "case",
    "catch",
    "char",
    "class",
    "const",
    "constexpr",
    "continue",
    "decltype",
    "default",
    "delete",
    "do",
    "double",
    "else",
    "enum",
    "explicit",
    "export",
    "extern",
    "false",
    "float",
    "for",
    "friend",
    "if",
    "inline",
    "int",
    "long",
    "namespace",
    "new",
    "noexcept",
    "nullptr",
    "operator",
    "private",
    "protected",
    "public",
    "register",
    "reinterpret_cast",
    "return",
    "short",
    "signed",
    "sizeof",
    "static",
    "string",
    "struct",
    "switch",
    "template",
    "this",
    "throw",
    "true",
    "try",
    "typedef",
    "typename",
    "union",
    "unsigned",
    "using",
    "vector",
    "virtual",
    "void",
    "volatile",
    "while",
  ]),
};

const tokenClasses: Record<Exclude<TokenKind, "plain">, string> = {
  comment: "text-[#637777] italic",
  keyword: "font-semibold text-[#c792ea]",
  number: "text-[#f78c6c]",
  string: "text-[#c3e88d]",
};

function consumeQuoted(source: string, start: number, language: ChallengeLanguage) {
  const quote = source[start]!;
  const delimiter =
    language === "python" && source.startsWith(quote.repeat(3), start) ? quote.repeat(3) : quote;
  let index = start + delimiter.length;
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }
    if (source.startsWith(delimiter, index)) return index + delimiter.length;
    index += 1;
  }
  return source.length;
}

export function tokenizeSource(source: string, language: ChallengeLanguage): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  const keywords = keywordSets[language];
  let index = 0;

  function add(kind: TokenKind, end: number) {
    tokens.push({ kind, value: source.slice(index, end) });
    index = end;
  }

  while (index < source.length) {
    if (source.startsWith("//", index) || (language === "python" && source[index] === "#")) {
      const newline = source.indexOf("\n", index);
      add("comment", newline === -1 ? source.length : newline);
      continue;
    }
    if (language !== "python" && source.startsWith("/*", index)) {
      const close = source.indexOf("*/", index + 2);
      add("comment", close === -1 ? source.length : close + 2);
      continue;
    }
    if (source[index] === '"' || source[index] === "'") {
      add("string", consumeQuoted(source, index, language));
      continue;
    }

    const rest = source.slice(index);
    const number = rest.match(/^(?:0[xX][\dA-Fa-f]+|0[bB][01]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[fFlL]?)/)?.[0];
    if (number) {
      add("number", index + number.length);
      continue;
    }
    const identifier = rest.match(/^[A-Za-z_]\w*/)?.[0];
    if (identifier) {
      add(keywords.has(identifier) ? "keyword" : "plain", index + identifier.length);
      continue;
    }
    add("plain", index + 1);
  }
  return tokens;
}

type SyntaxEditorProps = {
  ariaLabel: string;
  language: ChallengeLanguage;
  onChange: (source: string) => void;
  onKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  value: string;
};

export function SyntaxEditor({ ariaLabel, language, onChange, onKeyDown, value }: SyntaxEditorProps) {
  const highlightRef = useRef<HTMLPreElement>(null);
  const tokens = useMemo(() => tokenizeSource(value, language), [language, value]);

  return (
    <div className="relative min-h-[510px] overflow-hidden bg-[#080c12]">
      <pre
        ref={highlightRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre p-5 font-mono text-sm leading-6 text-[#d6deeb]"
      >
        {tokens.map((token, index) =>
          token.kind === "plain" ? (
            token.value
          ) : (
            <span className={tokenClasses[token.kind]} data-token={token.kind} key={index}>
              {token.value}
            </span>
          ),
        )}
        {value.endsWith("\n") ? " " : null}
      </pre>
      <textarea
        className="relative z-10 min-h-[510px] w-full resize-y overflow-auto whitespace-pre bg-transparent p-5 font-mono text-sm leading-6 text-transparent caret-[#d6deeb] outline-none selection:bg-[#29455f]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onScroll={(event) => {
          if (!highlightRef.current) return;
          highlightRef.current.scrollTop = event.currentTarget.scrollTop;
          highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
        aria-label={ariaLabel}
        style={{ caretColor: "#d6deeb" }}
      />
    </div>
  );
}
