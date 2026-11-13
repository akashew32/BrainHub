"use client";

import { useId } from "react";
import type { CountingGroup } from "@/lib/counting-lab-types";

/** Linear count bars with readable mobile labels and a complete text equivalent. */
export function CountingGroups({
  groups,
  caption,
  hasResult = true,
}: {
  groups: readonly CountingGroup[];
  caption: string;
  hasResult?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const maximum = Math.max(1, ...groups.map((group) => group.total));
  const showMembership = groups.some((group) => group.included !== undefined);
  return (
    <section className="panel min-w-0 p-5 sm:p-7" aria-labelledby={`${uid}-heading`}>
      <h2 id={`${uid}-heading`} className="text-2xl font-semibold">
        Counting groups
      </h2>
      <figure className="mt-4" aria-describedby={`${uid}-caption`}>
        <figcaption id={`${uid}-caption`} className="text-sm leading-7 text-[#acc0d7]">
          {caption}
        </figcaption>
        {groups.length ? (
          <>
            <p className="mt-3 text-xs leading-6 text-[#91a8c2]">
              Each bar scales linearly to the largest shown group. Zero has no filled bar. Hatched groups are
              explicitly excluded from the result.
            </p>
            <ul className="mt-5 space-y-5">
              {groups.map((group, index) => {
                const excluded = group.included === false;
                const title = `${group.label}: ${group.total}`;
                return (
                  <li key={`${group.label}-${index}`}>
                    <div className="mb-2 flex items-start justify-between gap-3 text-sm">
                      <span className="min-w-0 break-words text-[#d1e0f3]">
                        {group.label}
                        {excluded ? (
                          <span className="ml-2 text-xs text-[#c9b8a9]">Excluded from result</span>
                        ) : null}
                      </span>
                      <strong className="shrink-0 tabular-nums text-[#b7e7ec]">{group.total}</strong>
                    </div>
                    <svg
                      role="img"
                      aria-labelledby={`${uid}-title-${index}`}
                      aria-describedby={`${uid}-desc-${index}`}
                      className="block h-6 w-full"
                      viewBox="0 0 400 24"
                      preserveAspectRatio="none"
                    >
                      <title id={`${uid}-title-${index}`}>{title}</title>
                      <desc
                        id={`${uid}-desc-${index}`}
                      >{`${title}. ${caption} ${excluded ? "This group is excluded from the result and has a hatched bar." : "The bar represents this group's count."} The largest shown group has count ${maximum}.`}</desc>
                      <defs>
                        <pattern
                          id={`${uid}-hatch-${index}`}
                          width="8"
                          height="8"
                          patternUnits="userSpaceOnUse"
                        >
                          <rect width="8" height="8" fill="#384454" />
                          <path d="M-2,2 L2,-2 M0,8 L8,0 M6,10 L10,6" stroke="#b2becd" strokeWidth="2" />
                        </pattern>
                      </defs>
                      <rect x="0" y="2" width="400" height="20" rx="3" fill="#15283d" />
                      <rect
                        data-group-label={group.label}
                        data-total={group.total}
                        data-included={group.included === undefined ? "unspecified" : String(group.included)}
                        x="0"
                        y="2"
                        width={(400 * group.total) / maximum}
                        height="20"
                        rx="3"
                        fill={excluded ? `url(#${uid}-hatch-${index})` : "#65c6cd"}
                      />
                    </svg>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-[#36506a] p-6 text-sm leading-7 text-[#91a8c2]">
            {hasResult
              ? "No feasible outcome groups were found. The exact result and constraints are explained alongside."
              : "Reveal the result to display the counting groups."}
          </p>
        )}
      </figure>
      {groups.length ? (
        <div className="mt-7 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="mb-3 text-left font-medium">Counts represented in the diagram</caption>
            <thead className="text-xs text-[#9db5cf]">
              <tr>
                <th scope="col" className="p-2">
                  Group
                </th>
                <th scope="col" className="p-2">
                  Count
                </th>
                {showMembership ? (
                  <th scope="col" className="p-2">
                    Included in result
                  </th>
                ) : null}
                <th scope="col" className="p-2">
                  Listed items
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, index) => (
                <tr key={`${group.label}-${index}`} className="border-t border-[#293d55]">
                  <th scope="row" className="p-2 font-medium text-[#cbdcf1]">
                    {group.label}
                  </th>
                  <td className="p-2 tabular-nums">{group.total}</td>
                  {showMembership ? (
                    <td className="p-2">
                      {group.included === true ? "Yes" : group.included === false ? "No" : "Not specified"}
                    </td>
                  ) : null}
                  <td className="min-w-28 break-words p-2 text-xs leading-6 text-[#a8bfd8]">
                    {group.items === undefined ? (
                      "Not itemized"
                    ) : group.items.length ? (
                      <>
                        {group.items
                          .slice(0, 40)
                          .map((item) => item || "Empty outcome")
                          .join("; ")}
                        {Math.min(group.items.length, 40) < group.total ? (
                          <span className="block text-[#8da6c2]">
                            Shown {Math.min(group.items.length, 40)} of {group.total}; these examples come
                            from the displayed construction-order prefix.
                          </span>
                        ) : null}
                      </>
                    ) : group.total === 0 ? (
                      "None (empty group)"
                    ) : (
                      "No examples from this group in the displayed prefix."
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
