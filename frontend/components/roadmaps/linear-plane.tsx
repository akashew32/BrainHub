"use client";

import { useId } from "react";
import type { Mat2, PlotPoint, PlotVector, Vec2 } from "@/lib/linear-algebra-lab-types";
import { formatScalar, formatVector } from "@/lib/linear-algebra-lab";

type PlaneProps = {
  vectors: PlotVector[];
  points: PlotPoint[];
  gridMatrix?: Mat2;
  gridOffset?: Vec2;
  lineDirection?: Vec2;
  description?: string;
};

const COLORS = { input: "#67e8f9", secondary: "#c4b5fd", result: "#fbbf24" } as const;
const SIZE = 600;

function transformed(point: Vec2, matrix: Mat2, offset: Vec2): Vec2 {
  return [
    matrix[0][0] * point[0] + matrix[0][1] * point[1] + offset[0],
    matrix[1][0] * point[0] + matrix[1][1] * point[1] + offset[1],
  ];
}

/** An equal-scale, y-up SVG; the accompanying table is its text equivalent. */
export function LinearPlane({
  vectors,
  points,
  gridMatrix,
  gridOffset = [0, 0],
  lineDirection,
  description = "Vectors use mathematical coordinates: positive x goes right and positive y goes up.",
}: PlaneProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const grid: Array<readonly [Vec2, Vec2]> = [];
  if (gridMatrix) {
    for (let coordinate = -3; coordinate <= 3; coordinate += 1) {
      grid.push(
        [
          transformed([coordinate, -3], gridMatrix, gridOffset),
          transformed([coordinate, 3], gridMatrix, gridOffset),
        ],
        [
          transformed([-3, coordinate], gridMatrix, gridOffset),
          transformed([3, coordinate], gridMatrix, gridOffset),
        ],
      );
    }
  }
  const allPoints = [
    ...vectors.flatMap((vector) => [vector.from, vector.to]),
    ...points.map((point) => point.at),
    ...grid.flatMap((segment) => segment),
  ];
  const largest = allPoints.reduce(
    (bound, point) => Math.max(bound, Math.abs(point[0]), Math.abs(point[1])),
    3,
  );
  const extent = Math.max(4, Math.ceil(largest * 1.2));
  const project = ([x, y]: Vec2): Vec2 => [SIZE / 2 + (x / extent) * 250, SIZE / 2 - (y / extent) * 250];
  const tickStep = Math.max(1, Math.ceil(extent / 5));
  const ticks: number[] = [];
  for (let value = -Math.floor(extent / tickStep) * tickStep; value <= extent; value += tickStep)
    ticks.push(value);
  const lineLength = lineDirection ? Math.hypot(...lineDirection) : 0;
  const lineEnds: readonly [Vec2, Vec2] | null =
    lineDirection && lineLength > 0
      ? [
          [
            gridOffset[0] - (lineDirection[0] / lineLength) * extent * 3,
            gridOffset[1] - (lineDirection[1] / lineLength) * extent * 3,
          ],
          [
            gridOffset[0] + (lineDirection[0] / lineLength) * extent * 3,
            gridOffset[1] + (lineDirection[1] / lineLength) * extent * 3,
          ],
        ]
      : null;

  return (
    <figure className="min-w-0 rounded-2xl border border-[#2a3c52] bg-[#08111d] p-3 sm:p-5">
      <svg
        aria-describedby={`${uid}-description`}
        aria-labelledby={`${uid}-title`}
        className="aspect-square w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        data-extent={extent}
      >
        <title id={`${uid}-title`}>Coordinate plane</title>
        <desc
          id={`${uid}-description`}
        >{`${description} Both axes use the same scale. ${vectors.map((vector) => `${vector.label}: from ${formatVector(vector.from)} to ${formatVector(vector.to)}.`).join(" ")} ${points.map((point) => `${point.label}: ${formatVector(point.at)}.`).join(" ")}`}</desc>
        <defs>
          <clipPath id={`${uid}-clip`}>
            <rect x="35" y="35" width="530" height="530" />
          </clipPath>
          {Object.entries(COLORS).map(([tone, color]) => (
            <marker
              key={tone}
              id={`${uid}-arrow-${tone}`}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L8,4 L0,8 Z" fill={color} />
            </marker>
          ))}
        </defs>
        {ticks.map((tick) => {
          const [vertical] = project([tick, 0]);
          const [, horizontal] = project([0, tick]);
          return (
            <g key={tick} aria-hidden="true">
              <line x1={vertical} y1="50" x2={vertical} y2="550" stroke="#203044" strokeWidth="1" />
              <line x1="50" y1={horizontal} x2="550" y2={horizontal} stroke="#203044" strokeWidth="1" />
              {tick !== 0 ? (
                <>
                  <text x={vertical} y="319" fill="#a6b8cd" fontSize="12" textAnchor="middle">
                    {tick}
                  </text>
                  <text x="290" y={horizontal + 4} fill="#a6b8cd" fontSize="12" textAnchor="end">
                    {tick}
                  </text>
                </>
              ) : null}
            </g>
          );
        })}
        <g clipPath={`url(#${uid}-clip)`} aria-hidden="true">
          {grid.map(([from, to], index) => {
            const [x1, y1] = project(from);
            const [x2, y2] = project(to);
            return (
              <line
                key={index}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#69b7aa"
                strokeWidth="1.5"
                strokeDasharray="2 5"
                opacity="0.65"
              />
            );
          })}
          {lineEnds ? (
            <line
              x1={project(lineEnds[0])[0]}
              y1={project(lineEnds[0])[1]}
              x2={project(lineEnds[1])[0]}
              y2={project(lineEnds[1])[1]}
              stroke="#9bc2f0"
              strokeWidth="2"
              strokeDasharray="12 5 2 5"
            />
          ) : null}
        </g>
        <g aria-hidden="true">
          <line x1="45" y1="300" x2="555" y2="300" stroke="#adc1d8" strokeWidth="1.5" />
          <line x1="300" y1="45" x2="300" y2="555" stroke="#adc1d8" strokeWidth="1.5" />
          <text x="568" y="305" fill="#d7e4f4" fontSize="16">
            x
          </text>
          <text x="306" y="37" fill="#d7e4f4" fontSize="16">
            y
          </text>
          <text x="306" y="317" fill="#d7e4f4" fontSize="12">
            0
          </text>
        </g>
        {vectors.map((vector, index) => {
          const [x1, y1] = project(vector.from);
          const [x2, y2] = project(vector.to);
          const zero = Math.hypot(vector.to[0] - vector.from[0], vector.to[1] - vector.from[1]) < 1e-12;
          const color = COLORS[vector.tone];
          const anchor = x2 > 480 ? "end" : "start";
          return (
            <g
              key={`${vector.label}-${index}`}
              data-vector-label={vector.label}
              data-from-x={vector.from[0]}
              data-from-y={vector.from[1]}
              data-to-x={vector.to[0]}
              data-to-y={vector.to[1]}
            >
              <title>{`${vector.label}: ${formatVector(vector.from)} to ${formatVector(vector.to)}${zero ? "; zero vector, no direction" : ""}`}</title>
              {zero ? (
                <circle cx={x2} cy={y2} r="6" fill="none" stroke={color} strokeWidth="3" />
              ) : (
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={color}
                  strokeWidth={vector.tone === "result" ? 3.5 : 2.4}
                  strokeDasharray={vector.dashed ? "3 4" : vector.tone === "secondary" ? "8 5" : undefined}
                  markerEnd={`url(#${uid}-arrow-${vector.tone})`}
                />
              )}
              <text
                x={x2 + (anchor === "end" ? -9 : 9)}
                y={y2 + (y2 < 65 ? 20 : -10) + (index % 2) * 13}
                textAnchor={anchor}
                fill={color}
                fontSize="14"
                fontWeight="600"
                paintOrder="stroke"
                stroke="#08111d"
                strokeWidth="4"
              >
                {vector.label}
                {zero ? " = 0" : ""}
              </text>
            </g>
          );
        })}
        {points.map((point, index) => {
          const [x, y] = project(point.at);
          return (
            <g
              key={`${point.label}-${index}`}
              data-point-label={point.label}
              data-x={point.at[0]}
              data-y={point.at[1]}
            >
              <title>{`${point.label}: ${formatVector(point.at)}`}</title>
              <rect
                x={x - 5}
                y={y - 5}
                width="10"
                height="10"
                fill={COLORS[point.tone]}
                stroke="#08111d"
                strokeWidth="2"
              />
              <text
                x={x > 480 ? x - 10 : x + 10}
                y={y + 19 + (index % 2) * 14}
                textAnchor={x > 480 ? "end" : "start"}
                fill={COLORS[point.tone]}
                fontSize="14"
                fontWeight="600"
                paintOrder="stroke"
                stroke="#08111d"
                strokeWidth="4"
              >
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="space-y-2 text-xs leading-6 text-[#9eb1c8]">
        <p>
          Positive y points up. Equal axis scale; view extends to ±{formatScalar(extent)} units. The view fits
          every vector, point, and transformed-grid endpoint.
        </p>
        <p>
          Input: solid cyan · Second quantity: dashed violet · Result: heavy amber. Labels identify every
          quantity. {gridMatrix ? "Dotted green lines are the transformed reference grid." : ""}{" "}
          {lineEnds ? "The dash-dot direction line continues beyond the view." : ""}
        </p>
        <p>Overlapping labels are listed separately in the coordinates table after reveal.</p>
      </figcaption>
    </figure>
  );
}
