"use client";

import { useId } from "react";
import type { LogicProof, LogicResult } from "@/lib/logic-lab-types";
import { MathText } from "@/components/roadmaps/math-text";

function EvidenceCell({ value }: { value: string }) {
  const positive = /^(true|yes|t)$/i.test(value),
    negative = /^(false|no|f)$/i.test(value);
  return (
    <MathText
      className={
        positive || negative
          ? `inline-block rounded-md border px-2 py-1 text-xs font-semibold ${positive ? "border-[#387d70] bg-[#153c36] text-[#b3ebd5]" : "border-[#8a6657] bg-[#3c2927] text-[#f2c9b4]"}`
          : "inline-block max-w-full overflow-x-auto align-middle"
      }
    >
      {value}
    </MathText>
  );
}

/** Full numerical/logical evidence remains readable without a visual diagram. */
export function LogicEvidence({ result, proof }: { result: LogicResult | null; proof?: LogicProof }) {
  const uid = useId();
  const stepLabel = (id: string) => {
    const index = proof?.steps.findIndex((step) => step.id === id) ?? -1;
    return index < 0 ? id : `Step ${index + 1}`;
  };
  return (
    <section className="panel min-w-0 space-y-6 p-5 sm:p-7" aria-labelledby={`${uid}-heading`}>
      <h2 id={`${uid}-heading`} className="text-2xl font-semibold">
        Logical evidence
      </h2>
      {!result ? (
        <div className="rounded-xl border border-dashed border-[#36506a] p-5 text-sm leading-8 text-[#adc3db]">
          <p>Reveal a valid experiment to inspect its truth rows, witnesses, memberships or construction.</p>
          <p className="mt-3">
            A finite check and a proof have different roles. The explanation will state which conclusion the
            model justifies.
          </p>
        </div>
      ) : (
        <>
          {result.proofFeedback ? (
            <section aria-labelledby={`${uid}-dependencies`}>
              <h3 id={`${uid}-dependencies`} className="font-semibold">
                Proof dependency review
              </h3>
              <p className="mt-2 text-sm leading-7 text-[#a8bfd9]">
                A step may use only facts established earlier. Independent steps can have more than one valid
                order.
              </p>
              <ol className="mt-4 space-y-3">
                {result.proofFeedback.map((step) => (
                  <li
                    key={step.id}
                    className={`rounded-lg border p-3 text-sm leading-7 ${step.valid ? "border-[#325d54] bg-[#102b29]" : "border-[#705342] bg-[#30231f]"}`}
                  >
                    <strong>
                      Position {step.position}: {stepLabel(step.id)}
                    </strong>
                    <p className="mt-1 text-[#c1d3e7]">
                      {step.valid
                        ? "Its prerequisites have already been established."
                        : `Requires ${step.missing.map(stepLabel).join(", ")} to be established earlier in the proof.`}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          {result.tables.map((table, index) => (
            <div
              key={`${table.caption}-${index}`}
              role="region"
              tabIndex={0}
              aria-labelledby={`${uid}-table-caption-${index}`}
              className="max-h-[32rem] overflow-auto rounded-lg border border-[#2b425c] outline-offset-4 focus-visible:outline-2 focus-visible:outline-[#8ccfff]"
            >
              <table className="w-full text-left text-sm">
                <caption
                  id={`${uid}-table-caption-${index}`}
                  className="p-3 text-left font-medium leading-7 text-[#d7e5f5]"
                >
                  <MathText>{table.caption}</MathText>
                </caption>
                <thead className="border-y border-[#304963] bg-[#122338] text-xs text-[#b3c8df]">
                  <tr>
                    {table.headers.map((header, column) => (
                      <th key={column} scope="col" className="min-w-20 p-3">
                        <MathText>{header}</MathText>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, position) => (
                    <tr key={position} className="border-t border-[#263b53]">
                      {row.map((cell, column) =>
                        column === 0 ? (
                          <th key={column} scope="row" className="p-3 font-normal">
                            <EvidenceCell value={cell} />
                          </th>
                        ) : (
                          <td key={column} className="p-3">
                            <EvidenceCell value={cell} />
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!table.rows.length ? (
                <p className="border-t border-[#263b53] p-3 text-xs leading-7 text-[#a3bbd5]">
                  This table has no listed rows. The result explains the relevant domain and evidence.
                </p>
              ) : null}
            </div>
          ))}
          {!result.tables.length && !result.proofFeedback ? (
            <p className="text-sm leading-8 text-[#adc3db]">
              The construction is explained by the result and its logical steps.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
