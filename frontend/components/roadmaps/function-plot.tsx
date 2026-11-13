"use client";

import { useId } from "react";
import type { FunctionBounds, FunctionPlotData, FunctionVec } from "@/lib/function-lab-types";

const finitePoint = (point: FunctionVec) => Number.isFinite(point[0]) && Number.isFinite(point[1]);
const inBounds = (point: FunctionVec, bounds: FunctionBounds) =>
  finitePoint(point) &&
  point[0] >= bounds.xMin &&
  point[0] <= bounds.xMax &&
  point[1] >= bounds.yMin &&
  point[1] <= bounds.yMax;
const samePoint = (left: FunctionVec, right: FunctionVec) =>
  Math.abs(left[0] - right[0]) < 1e-10 && Math.abs(left[1] - right[1]) < 1e-10;

/** Liang–Barsky clipping intersects line segments; it never clamps samples into fake plateaus. */
function clipSegment(
  start: FunctionVec,
  end: FunctionVec,
  bounds: FunctionBounds,
): [FunctionVec, FunctionVec] | null {
  if (!finitePoint(start) || !finitePoint(end)) return null;
  const dx = end[0] - start[0],
    dy = end[1] - start[1];
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  let lower = 0,
    upper = 1;
  for (const [p, q] of [
    [-dx, start[0] - bounds.xMin],
    [dx, bounds.xMax - start[0]],
    [-dy, start[1] - bounds.yMin],
    [dy, bounds.yMax - start[1]],
  ]) {
    if (p === 0) {
      if (q! < 0) return null;
      continue;
    }
    const ratio = q! / p!;
    if (p! < 0) lower = Math.max(lower, ratio);
    else upper = Math.min(upper, ratio);
    if (lower > upper) return null;
  }
  return [
    [start[0] + lower * dx, start[1] + lower * dy],
    [start[0] + upper * dx, start[1] + upper * dy],
  ];
}

export function clipPolyline(points: readonly FunctionVec[], bounds: FunctionBounds): FunctionVec[][] {
  if (
    ![bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax].every(Number.isFinite) ||
    bounds.xMin >= bounds.xMax ||
    bounds.yMin >= bounds.yMax
  )
    return [];
  const paths: FunctionVec[][] = [];
  let current: FunctionVec[] | null = null;
  for (let index = 1; index < points.length; index += 1) {
    const clipped = clipSegment(points[index - 1]!, points[index]!, bounds);
    if (!clipped) {
      current = null;
      continue;
    }
    if (current && samePoint(current[current.length - 1]!, clipped[0])) current.push(clipped[1]);
    else {
      current = [...clipped];
      paths.push(current);
    }
  }
  return paths;
}

const numberText = (value: number) => (value === 0 ? "0" : String(Number(value.toPrecision(6))));
const coordinateText = (point: FunctionVec) => `(${numberText(point[0])}, ${numberText(point[1])})`;

export function FunctionPlot({ data }: { data: FunctionPlotData | null }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  if (!data)
    return (
      <section className="panel min-w-0 p-5 sm:p-7" aria-labelledby={`${uid}-heading`}>
        <h2 id={`${uid}-heading`} className="text-2xl font-semibold">
          Function plot
        </h2>
        <p className="mt-4 rounded-xl border border-dashed border-[#36506a] p-6 text-sm leading-7 text-[#a4bbd3]">
          Reveal a valid experiment to inspect its plot, excluded points and numerical coordinates.
        </p>
      </section>
    );
  const { bounds } = data;
  const xSpan = bounds.xMax - bounds.xMin,
    ySpan = bounds.yMax - bounds.yMin;
  if (
    ![bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax, xSpan, ySpan].every(Number.isFinite) ||
    xSpan <= 0 ||
    ySpan <= 0
  )
    return (
      <p className="panel p-6 text-sm">
        The plot window is unavailable. Read the function definition and result table.
      </p>
    );
  const width = data.equalScale ? (480 * xSpan) / Math.max(xSpan, ySpan) : 480;
  const height = data.equalScale ? (480 * ySpan) / Math.max(xSpan, ySpan) : 480;
  const left = (600 - width) / 2,
    top = (600 - height) / 2;
  const screenPoint = (point: FunctionVec): FunctionVec => [
    left + ((point[0] - bounds.xMin) / xSpan) * width,
    top + ((bounds.yMax - point[1]) / ySpan) * height,
  ];
  const title = "Function plot";
  const hasParameter = data.curves.some((curve) => curve.direction === "parameter" && curve.style === "line");
  const displacementCurves = data.curves.filter(
    (curve) => curve.direction === "displacement" && curve.style === "line",
  );
  const hasNonzeroDisplacement = displacementCurves.some(
    (curve) =>
      curve.points.length > 1 &&
      curve.points.some((point) => finitePoint(point) && !samePoint(point, curve.points[0]!)),
  );
  const hasDiscrete = data.curves.some((curve) => curve.style === "points");
  const directionDescription = [
    hasParameter ? "Arrowheads show increasing parameter, not a velocity vector." : "",
    displacementCurves.length
      ? hasNonzeroDisplacement
        ? "The arrow shows signed displacement from the origin to the Cartesian point, not traversal of a curve."
        : "The signed displacement is zero, so no direction arrow is drawn."
      : "",
    hasDiscrete ? "Discrete sequence points are never connected into a continuous curve." : "",
  ]
    .filter(Boolean)
    .join(" ");
  const description = `${data.caption} Horizontal axis: ${data.xLabel}. Vertical axis: ${data.yLabel}. ${data.equalScale ? "Both axes have the same scale per unit." : "The axes use independent scales."} Open circles mark excluded points; filled markers are included. Dashed curves are references. ${directionDescription}`;
  const rows: Array<{ label: string; point: FunctionVec; detail: string }> = [];
  for (const curve of data.curves) {
    const points = curve.points.filter(finitePoint);
    if (curve.style === "points")
      points.forEach((point) =>
        rows.push({
          label: curve.label,
          point,
          detail: inBounds(point, bounds) ? "Discrete sample" : "Discrete sample outside the window",
        }),
      );
    else if (points.length) {
      rows.push({ label: curve.label, point: points[0]!, detail: "First finite sample of this component" });
      if (points.length > 1)
        rows.push({
          label: curve.label,
          point: points.at(-1)!,
          detail: "Last finite sample of this component",
        });
    }
  }
  for (const marker of data.markers)
    if (finitePoint(marker.at))
      rows.push({
        label: marker.label,
        point: marker.at,
        detail: `${marker.open ? "Excluded (open circle)" : "Included (filled marker)"}${inBounds(marker.at, bounds) ? "" : "; outside the window"}`,
      });
  return (
    <section className="panel min-w-0 p-5 sm:p-7" aria-labelledby={`${uid}-heading`}>
      <h2 id={`${uid}-heading`} className="text-2xl font-semibold">
        Function plot
      </h2>
      <figure className="mt-4">
        <svg
          role="img"
          aria-labelledby={`${uid}-title`}
          aria-describedby={`${uid}-description ${uid}-caption`}
          viewBox="0 0 600 600"
          preserveAspectRatio="xMidYMid meet"
          className="block aspect-square w-full rounded-xl bg-[#091421]"
          data-equal-scale={data.equalScale}
          data-x-min={bounds.xMin}
          data-x-max={bounds.xMax}
          data-y-min={bounds.yMin}
          data-y-max={bounds.yMax}
        >
          <title id={`${uid}-title`}>{title}</title>
          <desc id={`${uid}-description`}>{description}</desc>
          <defs>
            <clipPath id={`${uid}-window`}>
              <rect x={left} y={top} width={width} height={height} />
            </clipPath>
            <marker
              id={`${uid}-arrow`}
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="#83dce1" />
            </marker>
          </defs>
          <rect x={left} y={top} width={width} height={height} fill="#0c1a2b" stroke="#39536e" />
          {[0, 1, 2, 3, 4].map((index) => {
            const x = left + (width * index) / 4,
              y = top + (height * index) / 4;
            return (
              <g key={index}>
                <line x1={x} x2={x} y1={top} y2={top + height} stroke="#233951" />
                <line x1={left} x2={left + width} y1={y} y2={y} stroke="#233951" />
                <text x={x} y={top + height + 20} textAnchor="middle" fill="#a1b8d1" fontSize="12">
                  {numberText(bounds.xMin + (xSpan * index) / 4)}
                </text>
                <text x={left - 10} y={y + 4} textAnchor="end" fill="#a1b8d1" fontSize="12">
                  {numberText(bounds.yMax - (ySpan * index) / 4)}
                </text>
              </g>
            );
          })}
          {bounds.xMin <= 0 && bounds.xMax >= 0 ? (
            <line
              x1={screenPoint([0, 0])[0]}
              x2={screenPoint([0, 0])[0]}
              y1={top}
              y2={top + height}
              stroke="#809ab6"
              strokeWidth="1.5"
            />
          ) : null}
          {bounds.yMin <= 0 && bounds.yMax >= 0 ? (
            <line
              x1={left}
              x2={left + width}
              y1={screenPoint([0, 0])[1]}
              y2={screenPoint([0, 0])[1]}
              stroke="#809ab6"
              strokeWidth="1.5"
            />
          ) : null}
          <g clipPath={`url(#${uid}-window)`}>
            {(data.bands ?? []).map((band, index) => {
              if (!Number.isFinite(band.low) || !Number.isFinite(band.high) || band.low >= band.high)
                return null;
              const low = Math.max(bounds.yMin, band.low),
                high = Math.min(bounds.yMax, band.high);
              if (low >= high) return null;
              return (
                <rect
                  key={index}
                  data-band-label={band.label}
                  x={left}
                  y={screenPoint([bounds.xMin, high])[1]}
                  width={width}
                  height={((high - low) / ySpan) * height}
                  fill="#55a69c"
                  fillOpacity="0.13"
                />
              );
            })}
            {data.curves.map((curve, index) => {
              const color = curve.role === "reference" ? "#e7bd78" : "#83dce1";
              return (
                <g
                  key={`${curve.label}-${index}`}
                  data-curve-label={curve.label}
                  data-curve-role={curve.role}
                  data-style={curve.style}
                >
                  {curve.style === "points"
                    ? curve.points
                        .filter((point) => inBounds(point, bounds))
                        .map((point, pointIndex) => {
                          const at = screenPoint(point);
                          return (
                            <circle
                              key={pointIndex}
                              data-point-style="discrete"
                              data-x={point[0]}
                              data-y={point[1]}
                              cx={at[0]}
                              cy={at[1]}
                              r="3.5"
                              fill={color}
                            />
                          );
                        })
                    : clipPolyline(curve.points, bounds).map((points, segment) => (
                        <polyline
                          key={segment}
                          points={points.map((point) => screenPoint(point).join(",")).join(" ")}
                          fill="none"
                          stroke={color}
                          strokeWidth={curve.role === "reference" ? 1.5 : 2.5}
                          strokeDasharray={curve.dashed || curve.role === "reference" ? "7 5" : undefined}
                        />
                      ))}
                  {curve.direction && curve.style === "line"
                    ? (curve.direction === "displacement" ? [1] : [0.25, 0.75]).map((fraction) => {
                        const end = Math.floor((curve.points.length - 1) * fraction),
                          start = Math.max(0, end - 2);
                        if (end < 1) return null;
                        const segment = clipSegment(curve.points[start]!, curve.points[end]!, bounds);
                        if (!segment || samePoint(segment[0], segment[1])) return null;
                        const from = screenPoint(segment[0]),
                          to = screenPoint(segment[1]);
                        return (
                          <line
                            key={fraction}
                            data-direction-arrow={
                              curve.direction === "displacement" ? "displacement" : "increasing-parameter"
                            }
                            x1={from[0]}
                            y1={from[1]}
                            x2={to[0]}
                            y2={to[1]}
                            stroke={color}
                            strokeWidth="2"
                            markerEnd={`url(#${uid}-arrow)`}
                          />
                        );
                      })
                    : null}
                </g>
              );
            })}
          </g>
          {data.markers
            .filter((marker) => inBounds(marker.at, bounds))
            .map((marker, index) => {
              const at = screenPoint(marker.at);
              return (
                <circle
                  key={`${marker.label}-${index}`}
                  data-marker-label={marker.label}
                  data-open={marker.open}
                  data-x={marker.at[0]}
                  data-y={marker.at[1]}
                  cx={at[0]}
                  cy={at[1]}
                  r={marker.open ? 5.5 : 4.5}
                  fill={marker.open ? "#091421" : "#f1d395"}
                  stroke="#f1d395"
                  strokeWidth="2"
                />
              );
            })}
          <text x={left + width / 2} y={top + height + 44} textAnchor="middle" fill="#cbdcf0" fontSize="14">
            {data.xLabel}
          </text>
          <text
            x="17"
            y="300"
            textAnchor="middle"
            transform="rotate(-90 17 300)"
            fill="#cbdcf0"
            fontSize="14"
          >
            {data.yLabel}
          </text>
        </svg>
        <figcaption id={`${uid}-caption`} className="mt-3 text-sm leading-7 text-[#acc0d7]">
          {data.caption}
        </figcaption>
      </figure>
      <p className="mt-3 text-xs leading-6 text-[#98b0ca]">
        {data.equalScale
          ? "Equal units on both axes."
          : "Axes use independent scales; compare values using the labels."}{" "}
        Curves are finite samples clipped to the shown window; separate domain components are not joined. Open
        circles are excluded, filled markers are included, and dashed lines are references.{" "}
        {data.clipped
          ? "Some values lie outside this window."
          : "A finite window does not determine all global behavior."}{" "}
        {directionDescription ||
          "The drawn curve approximates the stated function within this finite window."}
      </p>
      {rows.length ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="mb-3 text-left font-medium">Coordinates represented in the plot</caption>
            <thead className="text-xs text-[#9fb5ce]">
              <tr>
                <th scope="col" className="p-2">
                  Object
                </th>
                <th scope="col" className="p-2">
                  Coordinates (rounded)
                </th>
                <th scope="col" className="p-2">
                  Meaning
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-[#293d55]">
                  <th scope="row" className="p-2 font-medium">
                    {row.label}
                  </th>
                  <td className="whitespace-nowrap p-2 tabular-nums">{coordinateText(row.point)}</td>
                  <td className="min-w-40 p-2 text-xs leading-6 text-[#b0c5dd]">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs leading-6 text-[#91a8c2]">
            The table includes every discrete sample and marked point, plus the first and last finite samples
            of each continuous component. Coordinates are rounded to six significant digits; the function
            definition and explanation specify the mathematical result.
          </p>
        </div>
      ) : null}
    </section>
  );
}
