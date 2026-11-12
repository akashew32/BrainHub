import katex from "katex";
import { Fragment } from "react";

/** Authored prose with inline/display TeX. KaTeX emits accessible MathML too. */
export function MathText({ children, className = "" }: { children: string; className?: string }) {
  const parts = children.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);
  return (
    <span className={`math-prose ${className}`}>
      {parts.map((part, index) => {
        const display = part.startsWith("$$") && part.endsWith("$$");
        const inline = !display && part.startsWith("$") && part.endsWith("$");
        if (!display && !inline) return <Fragment key={index}>{part}</Fragment>;
        const source = part.slice(display ? 2 : 1, display ? -2 : -1);
        return (
          <span
            key={index}
            className={display ? "math-display" : undefined}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(source, {
                displayMode: display,
                output: "htmlAndMathml",
                throwOnError: false,
                trust: false,
                strict: "warn",
                maxExpand: 500,
              }),
            }}
          />
        );
      })}
    </span>
  );
}
