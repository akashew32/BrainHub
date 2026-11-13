import {
  LAB_MODES,
  type GeometryOperation,
  type LabExperiment,
  type LabMode,
  type LabPreset,
  type LabScene,
  type Mat2,
  type Vec2,
} from "@/lib/linear-algebra-lab-types";

const ORIGIN: Vec2 = [0, 0];
const withoutNegativeZero = (value: number) => (value === 0 ? 0 : value);
const OPERATIONS: readonly GeometryOperation[] = [
  "rotate90",
  "rotate180",
  "reflect-x",
  "reflect-diagonal",
  "shear-x",
  "shear-y",
  "project-line",
];

export function add2(left: Vec2, right: Vec2): Vec2 {
  return [withoutNegativeZero(left[0] + right[0]), withoutNegativeZero(left[1] + right[1])];
}
export function scale2(coefficient: number, value: Vec2): Vec2 {
  return [withoutNegativeZero(coefficient * value[0]), withoutNegativeZero(coefficient * value[1])];
}
export function dot2(left: Vec2, right: Vec2) {
  return withoutNegativeZero(left[0] * right[0] + left[1] * right[1]);
}
export function apply2(matrix: Mat2, value: Vec2): Vec2 {
  return [dot2(matrix[0], value), dot2(matrix[1], value)];
}
export function multiply2(left: Mat2, right: Mat2): Mat2 {
  return [
    [
      left[0][0] * right[0][0] + left[0][1] * right[1][0],
      left[0][0] * right[0][1] + left[0][1] * right[1][1],
    ],
    [
      left[1][0] * right[0][0] + left[1][1] * right[1][0],
      left[1][0] * right[0][1] + left[1][1] * right[1][1],
    ],
  ];
}
export function determinant2(matrix: Mat2) {
  return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
}
const equalVectors = (left: Vec2, right: Vec2) => left[0] === right[0] && left[1] === right[1];
const equalMatrices = (left: Mat2, right: Mat2) =>
  equalVectors(left[0], right[0]) && equalVectors(left[1], right[1]);
const isZero = (value: Vec2) => value[0] === 0 && value[1] === 0;

function gcd(a: number, b: number): number {
  let left = Math.abs(a),
    right = Math.abs(b);
  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left;
}
function fraction(numerator: number, denominator: number) {
  if (denominator === 0) throw new RangeError("A fraction needs a nonzero denominator.");
  const divisor = gcd(numerator, denominator);
  const sign = denominator < 0 ? -1 : 1;
  return { numerator: (sign * numerator) / divisor, denominator: (sign * denominator) / divisor };
}
function fractionText(numerator: number, denominator: number) {
  const reduced = fraction(numerator, denominator);
  return reduced.denominator === 1
    ? String(reduced.numerator || 0)
    : `${reduced.numerator}/${reduced.denominator}`;
}
function fractionTex(numerator: number, denominator: number) {
  const reduced = fraction(numerator, denominator);
  if (reduced.denominator === 1) return String(reduced.numerator || 0);
  return `${reduced.numerator < 0 ? "-" : ""}\\frac{${Math.abs(reduced.numerator)}}{${reduced.denominator}}`;
}

/** Small rational scene outputs are exact fractions; other decimals say rounded. */
export function formatScalar(value: number): string {
  if (!Number.isFinite(value)) return "not finite";
  if (Number.isSafeInteger(value)) return String(value || 0);
  for (let denominator = 2; denominator <= 128; denominator += 1) {
    const numerator = Math.round(value * denominator);
    if (numerator !== 0 && Number.isSafeInteger(numerator) && numerator / denominator === value)
      return fractionText(numerator, denominator);
  }
  return `${Number(value.toPrecision(6))} (rounded)`;
}
export function formatVector(value: Vec2): string {
  const entries = value.map(formatScalar);
  const rounded = entries.some((entry) => entry.endsWith(" (rounded)"));
  const text = `(${entries.map((entry) => entry.replace(" (rounded)", "")).join(", ")})`;
  return rounded ? `approximately ${text} (rounded)` : text;
}
function scalarTex(value: number) {
  const formatted = formatScalar(value);
  if (formatted.includes("/")) {
    const [numerator, denominator] = formatted.split("/").map(Number);
    return fractionTex(numerator!, denominator!);
  }
  return formatted.endsWith(" (rounded)")
    ? `\\text{approximately }${formatted.replace(" (rounded)", "")}`
    : formatted;
}
const vectorTex = (value: Vec2) => `\\left(${scalarTex(value[0])},${scalarTex(value[1])}\\right)`;
const matrixTex = (value: Mat2) =>
  `\\begin{pmatrix}${scalarTex(value[0][0])}&${scalarTex(value[0][1])}\\\\${scalarTex(value[1][0])}&${scalarTex(value[1][1])}\\end{pmatrix}`;
const matrixText = (value: Mat2) => `[${formatVector(value[0])}, ${formatVector(value[1])}]`;

function blank(error: string): LabExperiment {
  return { output: null, steps: [], observations: [], facts: [], vectors: [], points: [], error };
}
function validate(mode: LabMode, scene: LabScene): string | null {
  if (!(LAB_MODES as readonly string[]).includes(mode)) return "Choose one of the six laboratory modes.";
  if (scene === null || typeof scene !== "object") return "Enter a valid experiment scene.";
  const vectorError = (field: "u" | "v" | "t") => {
    const value = scene[field];
    return Array.isArray(value) &&
      value.length === 2 &&
      value.every((entry) => Number.isInteger(entry) && entry >= -4 && entry <= 4)
      ? null
      : `${field} must have exactly two integer coordinates from -4 to 4.`;
  };
  const scalarError = (field: "a" | "b") =>
    Number.isInteger(scene[field]) && scene[field] >= -3 && scene[field] <= 3
      ? null
      : `${field} must be an integer from -3 to 3.`;
  const matrixError = (field: "A" | "B") => {
    const value = scene[field];
    return Array.isArray(value) &&
      value.length === 2 &&
      value.every(
        (row) =>
          Array.isArray(row) &&
          row.length === 2 &&
          row.every((entry) => Number.isInteger(entry) && entry >= -3 && entry <= 3),
      )
      ? null
      : `${field} must be a 2 by 2 matrix of integers from -3 to 3.`;
  };
  const uError = vectorError("u");
  if (uError) return uError;
  if (mode === "combinations") return vectorError("v") ?? scalarError("a") ?? scalarError("b");
  if (mode === "projection") return vectorError("v");
  if (mode === "matrices")
    return (
      matrixError("A") ??
      matrixError("B") ??
      (scene.order === "AB" || scene.order === "BA" ? null : "Choose AB or BA for the matrix order.")
    );
  if (mode === "maps") return matrixError("A");
  if (mode === "affine") return vectorError("v") ?? matrixError("A") ?? vectorError("t");
  if (!OPERATIONS.includes(scene.operation)) return "Choose a supported geometry transformation.";
  if (scene.operation === "project-line") return vectorError("v");
  if (scene.operation === "shear-x" || scene.operation === "shear-y") return scalarError("a");
  return null;
}

function combinations(scene: LabScene): LabExperiment {
  const first = scale2(scene.a, scene.u),
    second = scale2(scene.b, scene.v);
  const output = add2(first, second);
  const spanDeterminant = scene.u[0] * scene.v[1] - scene.v[0] * scene.u[1];
  return {
    output,
    error: null,
    steps: [
      `$a u=(${scene.a})${vectorTex(scene.u)}=${vectorTex(first)}$.`,
      `$b v=(${scene.b})${vectorTex(scene.v)}=${vectorTex(second)}$.`,
      `$a u+b v=${vectorTex(first)}+${vectorTex(second)}=${vectorTex(output)}$.`,
    ],
    facts: [
      { label: "Scaled u", value: formatVector(first) },
      { label: "Scaled v", value: formatVector(second) },
      { label: "Combination", value: formatVector(output) },
      {
        label: "Span of the input directions",
        value:
          spanDeterminant !== 0
            ? "The whole coordinate plane"
            : isZero(scene.u) && isZero(scene.v)
              ? "Only the zero vector"
              : "A line through the origin",
      },
    ],
    observations: [
      "Adding the shifted second vector to the first gives the same endpoint as the result arrow.",
      spanDeterminant !== 0
        ? "These two input vectors are independent; every vector in the plane has unique real coefficients in their basis."
        : "These input vectors are dependent. Coefficients that are not all zero can give the zero vector.",
    ],
    vectors: [
      { label: "u", from: ORIGIN, to: scene.u, tone: "input", dashed: true },
      { label: "v", from: ORIGIN, to: scene.v, tone: "secondary", dashed: true },
      { label: "a u", from: ORIGIN, to: first, tone: "input" },
      { label: "b v", from: ORIGIN, to: second, tone: "secondary" },
      { label: "shifted b v", from: first, to: output, tone: "secondary", dashed: true },
      { label: "a u + b v", from: ORIGIN, to: output, tone: "result" },
    ],
    points: [],
  };
}

function projection(scene: LabScene): LabExperiment {
  const numerator = dot2(scene.u, scene.v),
    denominator = dot2(scene.v, scene.v);
  if (denominator === 0)
    return blank("The zero vector gives no line direction. Choose a nonzero v to define the line.");
  const projectedNumerators: Vec2 = [numerator * scene.v[0], numerator * scene.v[1]];
  const residualNumerators: Vec2 = [
    scene.u[0] * denominator - projectedNumerators[0],
    scene.u[1] * denominator - projectedNumerators[1],
  ];
  // Divide each integer numerator directly: this also preserves small exact fraction formatting.
  const exactOutput: Vec2 = [
    withoutNegativeZero(projectedNumerators[0] / denominator),
    withoutNegativeZero(projectedNumerators[1] / denominator),
  ];
  const residual: Vec2 = [
    withoutNegativeZero(residualNumerators[0] / denominator),
    withoutNegativeZero(residualNumerators[1] / denominator),
  ];
  const residualDot = dot2(residualNumerators, scene.v) / denominator;
  const squaredNormU = dot2(scene.u, scene.u);
  const normText = (squared: number) =>
    Number.isInteger(Math.sqrt(squared)) ? String(Math.sqrt(squared)) : `√${squared} (exact)`;
  const cosine =
    squaredNormU === 0 ? null : Math.max(-1, Math.min(1, numerator / Math.sqrt(squaredNormU * denominator)));
  const angle = cosine === null ? null : (Math.acos(cosine) * 180) / Math.PI;
  const angleText =
    angle === null
      ? "Undefined: the zero input has no angle"
      : `approximately ${Number(angle.toFixed(3))}° (rounded)`;
  return {
    output: exactOutput,
    error: null,
    lineDirection: scene.v,
    steps: [
      `$u\\cdot v=${numerator},\\quad v\\cdot v=${denominator}$.`,
      `$\\|u\\|=\\sqrt{${squaredNormU}},\\quad \\|v\\|=\\sqrt{${denominator}}$.`,
      angle === null
        ? "$\\|u\\|=0$, so the angle between u and v is undefined."
        : `$\\theta=\\arccos\\!\\left(\\frac{${numerator}}{\\sqrt{${squaredNormU}}\\sqrt{${denominator}}}\\right)\\approx ${Number(angle.toFixed(3))}^\\circ$ (rounded).`,
      `$p=\\frac{u\\cdot v}{v\\cdot v}v=${fractionTex(numerator, denominator)}${vectorTex(scene.v)}=${vectorTex(exactOutput)}$.`,
      `$r=u-p=${vectorTex(residual)},\\quad r\\cdot v=${residualDot}$.`,
    ],
    facts: [
      { label: "u dot v", value: String(numerator) },
      { label: "v dot v", value: String(denominator) },
      { label: "Norm of u", value: normText(squaredNormU) },
      { label: "Norm of v", value: normText(denominator) },
      { label: "Angle between u and v", value: angleText },
      { label: "Projection coefficient", value: fractionText(numerator, denominator) },
      { label: "Projection p", value: formatVector(exactOutput) },
      { label: "Residual u − p", value: formatVector(residual) },
      { label: "Residual dot direction", value: String(residualDot) },
    ],
    observations: [
      "The projection lies on the chosen line, and the residual is perpendicular to its direction.",
      isZero(scene.u)
        ? "The zero input projects to the origin. The nonzero direction still defines a line."
        : numerator === 0
          ? "The input is perpendicular to the line, so its projection is zero."
          : scene.u[0] * scene.v[1] === scene.u[1] * scene.v[0]
            ? "The input is already on the line, so projection leaves it unchanged."
            : "This is the nearest point on the line to the input vector.",
      "Multiplying the direction by a nonzero scalar, including a negative one, leaves the projection unchanged.",
    ],
    vectors: [
      { label: "u", from: ORIGIN, to: scene.u, tone: "input" },
      { label: "direction v", from: ORIGIN, to: scene.v, tone: "secondary", dashed: true },
      { label: "projection p", from: ORIGIN, to: exactOutput, tone: "result" },
      { label: "residual u − p", from: exactOutput, to: scene.u, tone: "secondary", dashed: true },
    ],
    points: [],
  };
}

function matrices(scene: LabScene): LabExperiment {
  const AB = multiply2(scene.A, scene.B),
    BA = multiply2(scene.B, scene.A);
  const selected = scene.order === "AB" ? AB : BA;
  const inner = scene.order === "AB" ? scene.B : scene.A;
  const outer = scene.order === "AB" ? scene.A : scene.B;
  const innerName = scene.order === "AB" ? "B" : "A",
    outerName = scene.order === "AB" ? "A" : "B";
  const intermediate = apply2(inner, scene.u),
    output = apply2(outer, intermediate);
  const otherOutput = apply2(scene.order === "AB" ? BA : AB, scene.u);
  return {
    output,
    error: null,
    gridMatrix: selected,
    steps: [
      `The first row of ${outerName} meets the first column of ${innerName}: $(${scene.order})_{11}=(${outer[0][0]})(${inner[0][0]})+(${outer[0][1]})(${inner[1][0]})=${selected[0][0]}$.`,
      `$${scene.order}=${matrixTex(outer)}${matrixTex(inner)}=${matrixTex(selected)}$.`,
      `$${innerName}u=${matrixTex(inner)}${vectorTex(scene.u)}=${vectorTex(intermediate)}$.`,
      `$${scene.order}u=${outerName}(${innerName}u)=${matrixTex(outer)}${vectorTex(intermediate)}=${vectorTex(output)}$.`,
    ],
    facts: [
      { label: "Selected order", value: `${scene.order}: ${innerName} first, then ${outerName}` },
      { label: `Intermediate ${innerName}u`, value: formatVector(intermediate) },
      { label: "AB", value: matrixText(AB) },
      { label: "BA", value: matrixText(BA) },
      { label: "Selected output", value: formatVector(output) },
      { label: "Other-order output", value: formatVector(otherOutput) },
      { label: "Do these matrices commute?", value: equalMatrices(AB, BA) ? "Yes" : "No" },
    ],
    observations: [
      "The rightmost factor acts first. Matrix multiplication records composition in that order.",
      equalMatrices(AB, BA)
        ? "These products agree as matrices, so both orders agree on every input."
        : equalVectors(output, otherOutput)
          ? "The products differ, but happen to agree on this input. One matching input does not prove commutativity."
          : "Reversing the factors changes this input's output.",
    ],
    vectors: [
      { label: "u", from: ORIGIN, to: scene.u, tone: "input" },
      { label: `${innerName} u`, from: ORIGIN, to: intermediate, tone: "secondary" },
      { label: `${scene.order} u`, from: ORIGIN, to: output, tone: "result" },
      { label: "other-order output", from: ORIGIN, to: otherOutput, tone: "secondary", dashed: true },
    ],
    points: [],
  };
}

function primitiveDirection(value: Vec2): Vec2 {
  const divisor = gcd(value[0], value[1]);
  const divided: Vec2 = [value[0] / divisor, value[1] / divisor];
  return (divided[0] !== 0 ? divided[0] : divided[1]) < 0 ? scale2(-1, divided) : divided;
}
function maps(scene: LabScene): LabExperiment {
  const output = apply2(scene.A, scene.u),
    determinant = determinant2(scene.A);
  const rank = determinant !== 0 ? 2 : scene.A.some((row) => row.some((entry) => entry !== 0)) ? 1 : 0;
  const firstColumn: Vec2 = [scene.A[0][0], scene.A[1][0]],
    secondColumn: Vec2 = [scene.A[0][1], scene.A[1][1]];
  const row = !isZero(scene.A[0]) ? scene.A[0] : scene.A[1];
  const kernel = rank === 1 ? primitiveDirection([-row[1], row[0]]) : null;
  const image = rank === 1 ? primitiveDirection(!isZero(firstColumn) ? firstColumn : secondColumn) : null;
  return {
    output,
    error: null,
    gridMatrix: scene.A,
    ...(image ? { lineDirection: image } : {}),
    steps: [
      `$Au=${scene.u[0]}${vectorTex(firstColumn)}+(${scene.u[1]})${vectorTex(secondColumn)}=${vectorTex(output)}$.`,
      `$\\det A=(${scene.A[0][0]})(${scene.A[1][1]})-(${scene.A[0][1]})(${scene.A[1][0]})=${determinant}$.`,
      rank === 2
        ? "$\\det A\\ne0$, so the kernel is only $\\{(0,0)\\}$ and the image is $\\mathbb R^2$."
        : rank === 0
          ? "$A=0$, so every input is in the kernel and the image is only $\\{(0,0)\\}$."
          : `$A${vectorTex(kernel!)}=${vectorTex(ORIGIN)}$. The kernel is the line in that direction; the columns span the line in direction $${vectorTex(image!)}$.`,
    ],
    facts: [
      { label: "Rank", value: String(rank) },
      {
        label: "Kernel",
        value:
          rank === 2
            ? "{(0, 0)}"
            : rank === 0
              ? "The whole coordinate plane"
              : `span{${formatVector(kernel!)}}`,
      },
      {
        label: "Image",
        value:
          rank === 2
            ? "The whole coordinate plane"
            : rank === 0
              ? "{(0, 0)}"
              : `span{${formatVector(image!)}}`,
      },
      { label: "First column A e₁", value: formatVector(firstColumn) },
      { label: "Second column A e₂", value: formatVector(secondColumn) },
      { label: "Determinant", value: String(determinant) },
      { label: "Area scale", value: String(Math.abs(determinant)) },
      {
        label: "Orientation",
        value:
          determinant > 0
            ? "Preserved"
            : determinant < 0
              ? "Reversed"
              : "Collapsed; no two-dimensional orientation",
      },
    ],
    observations: [
      rank === 2
        ? "The transformed grid still spans two dimensions, and each output has one preimage."
        : rank === 1
          ? "The plane collapses onto one line. Moving along the kernel direction does not change an output."
          : "Every vector is sent to the origin. The entire plane is the kernel.",
      "Matrix columns are the images of the standard coordinate directions.",
    ],
    vectors: [
      { label: "u", from: ORIGIN, to: scene.u, tone: "input" },
      { label: "A e₁", from: ORIGIN, to: firstColumn, tone: "secondary", dashed: true },
      { label: "A e₂", from: ORIGIN, to: secondColumn, tone: "secondary", dashed: true },
      { label: "A u", from: ORIGIN, to: output, tone: "result" },
      ...(kernel
        ? [{ label: "kernel direction", from: ORIGIN, to: kernel, tone: "input" as const, dashed: true }]
        : []),
    ],
    points: [],
  };
}

function geometry(scene: LabScene): LabExperiment {
  if (scene.operation === "project-line") {
    const result = projection(scene);
    if (result.error) return result;
    const denominator = dot2(scene.v, scene.v);
    const P: Mat2 = [
      [(scene.v[0] * scene.v[0]) / denominator, (scene.v[0] * scene.v[1]) / denominator],
      [(scene.v[1] * scene.v[0]) / denominator, (scene.v[1] * scene.v[1]) / denominator],
    ];
    return {
      ...result,
      gridMatrix: P,
      steps: [`$P=\\frac{vv^T}{v^Tv}=${matrixTex(P)}$.`, ...result.steps],
      facts: [
        { label: "Transformation", value: "Orthogonal projection onto a line" },
        { label: "Transformation matrix", value: matrixText(P) },
        { label: "Area scale", value: "0" },
        ...result.facts,
      ],
      observations: [
        "This projection discards the perpendicular component, so it is not invertible. It has no two-dimensional orientation sign.",
        ...result.observations,
      ],
    };
  }
  const choices: Record<Exclude<GeometryOperation, "project-line">, { matrix: Mat2; label: string }> = {
    rotate90: {
      matrix: [
        [0, -1],
        [1, 0],
      ],
      label: "90° counterclockwise rotation",
    },
    rotate180: {
      matrix: [
        [-1, 0],
        [0, -1],
      ],
      label: "180° rotation",
    },
    "reflect-x": {
      matrix: [
        [1, 0],
        [0, -1],
      ],
      label: "Reflection in the x-axis",
    },
    "reflect-diagonal": {
      matrix: [
        [0, 1],
        [1, 0],
      ],
      label: "Reflection in y = x",
    },
    "shear-x": {
      matrix: [
        [1, scene.a],
        [0, 1],
      ],
      label: `Horizontal shear, k = ${scene.a}`,
    },
    "shear-y": {
      matrix: [
        [1, 0],
        [scene.a, 1],
      ],
      label: `Vertical shear, k = ${scene.a}`,
    },
  };
  const selected = choices[scene.operation],
    output = apply2(selected.matrix, scene.u);
  const determinant = determinant2(selected.matrix),
    before = dot2(scene.u, scene.u),
    after = dot2(output, output);
  const shear = scene.operation === "shear-x" || scene.operation === "shear-y";
  return {
    output,
    error: null,
    gridMatrix: selected.matrix,
    steps: [
      `$Cu=${matrixTex(selected.matrix)}${vectorTex(scene.u)}=${vectorTex(output)}$.`,
      `$\\|u\\|^2=${before},\\quad\\|Cu\\|^2=${after},\\quad\\det C=${determinant}$.`,
    ],
    facts: [
      { label: "Transformation", value: selected.label },
      { label: "Transformation matrix", value: matrixText(selected.matrix) },
      { label: "Squared input length", value: String(before) },
      { label: "Squared output length", value: String(after) },
      { label: "Area scale", value: String(Math.abs(determinant)) },
      { label: "Orientation", value: determinant > 0 ? "Preserved" : "Reversed" },
    ],
    observations: [
      shear
        ? scene.a === 0
          ? "A shear with parameter zero is the identity, so every vector is unchanged."
          : "This shear preserves area, but does not preserve every length. Some individual vectors can still keep their length."
        : "This rotation or reflection preserves every Euclidean length.",
      determinant < 0
        ? "A reflection reverses orientation even though it preserves lengths and area magnitude."
        : "The determinant is positive, so orientation is preserved.",
    ],
    vectors: [
      { label: "u", from: ORIGIN, to: scene.u, tone: "input" },
      { label: "C u", from: ORIGIN, to: output, tone: "result" },
    ],
    points: [],
  };
}

function affine(scene: LabScene): LabExperiment {
  const Fu = add2(apply2(scene.A, scene.u), scene.t),
    Fv = add2(apply2(scene.A, scene.v), scene.t);
  const displacement = add2(scene.v, scale2(-1, scene.u)),
    output = add2(Fv, scale2(-1, Fu));
  const midpoint = scale2(0.5, add2(scene.u, scene.v)),
    mappedMidpoint = add2(apply2(scene.A, midpoint), scene.t);
  return {
    output,
    error: null,
    gridMatrix: scene.A,
    steps: [
      `$F(u)=Au+t=${vectorTex(Fu)},\\quad F(v)=Av+t=${vectorTex(Fv)}$.`,
      `$F(v)-F(u)=(Av+t)-(Au+t)=A(v-u)=${matrixTex(scene.A)}${vectorTex(displacement)}=${vectorTex(output)}$.`,
      `$m=\\frac{u+v}{2}=${vectorTex(midpoint)},\\quad F(m)=\\frac{F(u)+F(v)}2=${vectorTex(mappedMidpoint)}$.`,
      `$F(0)=t=${vectorTex(scene.t)}$.`,
    ],
    facts: [
      { label: "F(u)", value: formatVector(Fu) },
      { label: "F(v)", value: formatVector(Fv) },
      { label: "Input displacement v − u", value: formatVector(displacement) },
      { label: "Output displacement F(v) − F(u)", value: formatVector(output) },
      { label: "Input midpoint", value: formatVector(midpoint) },
      { label: "Mapped midpoint", value: formatVector(mappedMidpoint) },
      { label: "F(0)", value: formatVector(scene.t) },
      {
        label: "Is F linear?",
        value: isZero(scene.t) ? "Yes: the translation is zero" : "No: the origin moves",
      },
    ],
    observations: [
      "The same translation appears at both endpoints and cancels from their displacement.",
      "Affine maps preserve midpoints, including when the linear part is singular.",
      isZero(scene.t)
        ? "With zero translation this affine map is a linear map."
        : "A nonzero translation makes this map affine without being linear; its effect on displacements is still linear.",
    ],
    vectors: [
      { label: "v − u", from: scene.u, to: scene.v, tone: "input" },
      { label: "F(v) − F(u)", from: Fu, to: Fv, tone: "result" },
      { label: "translation t", from: ORIGIN, to: scene.t, tone: "secondary", dashed: true },
    ],
    points: [
      { label: "u", at: scene.u, tone: "input" },
      { label: "v", at: scene.v, tone: "input" },
      { label: "midpoint", at: midpoint, tone: "secondary" },
      { label: "F(u)", at: Fu, tone: "result" },
      { label: "F(v)", at: Fv, tone: "result" },
      { label: "F(midpoint)", at: mappedMidpoint, tone: "secondary" },
    ],
  };
}

export function evaluateScene(mode: LabMode, scene: LabScene): LabExperiment {
  const error = validate(mode, scene);
  if (error) return blank(error);
  switch (mode) {
    case "combinations":
      return combinations(scene);
    case "projection":
      return projection(scene);
    case "matrices":
      return matrices(scene);
    case "maps":
      return maps(scene);
    case "geometry":
      return geometry(scene);
    case "affine":
      return affine(scene);
  }
}

const BASE: LabScene = {
  u: [2, 1],
  v: [-1, 2],
  a: 2,
  b: 1,
  A: [
    [1, 1],
    [0, 1],
  ],
  B: [
    [2, 0],
    [0, 1],
  ],
  t: [2, -1],
  order: "AB",
  operation: "rotate90",
};
function copyScene(scene: LabScene): LabScene {
  return {
    ...scene,
    u: [...scene.u],
    v: [...scene.v],
    t: [...scene.t],
    A: [[...scene.A[0]], [...scene.A[1]]],
    B: [[...scene.B[0]], [...scene.B[1]]],
  };
}
function preset(
  id: string,
  label: string,
  description: string,
  mode: LabMode,
  values: Partial<LabScene>,
): LabPreset {
  return { id, label, description, mode, scene: copyScene({ ...BASE, ...values }) };
}
export const LAB_PRESETS: readonly LabPreset[] = [
  preset(
    "independent-sum",
    "Two independent directions",
    "Combine independent vectors with different weights.",
    "combinations",
    {},
  ),
  preset(
    "cancelling-directions",
    "Opposite directions cancel",
    "Nonzero weighted arrows can sum to zero.",
    "combinations",
    { u: [2, -1], v: [-2, 1], a: 1, b: 1 },
  ),
  preset(
    "slanted-projection",
    "A sloping projection line",
    "Use a non-unit direction and retain exact fractions.",
    "projection",
    { u: [3, 2], v: [2, 1] },
  ),
  preset(
    "perpendicular-projection",
    "Perpendicular input",
    "A perpendicular input has zero projection.",
    "projection",
    { u: [1, 2], v: [2, -1] },
  ),
  preset(
    "zero-input-projection",
    "Zero input, valid line",
    "The zero input projects to zero on a well-defined line.",
    "projection",
    { u: [0, 0], v: [2, -1] },
  ),
  preset(
    "zero-direction",
    "No line direction",
    "A zero direction vector does not specify a line.",
    "projection",
    { v: [0, 0] },
  ),
  preset(
    "noncommuting-matrices",
    "Order changes the result",
    "Compare a shear and a stretch in both orders.",
    "matrices",
    { u: [1, 2] },
  ),
  preset("commuting-scalings", "Commuting scalings", "Scalar matrices commute on every input.", "matrices", {
    A: [
      [2, 0],
      [0, 2],
    ],
    B: [
      [-1, 0],
      [0, -1],
    ],
    u: [2, -1],
  }),
  preset(
    "invertible-map",
    "A two-dimensional image",
    "An invertible matrix has only the zero vector in its kernel.",
    "maps",
    {
      A: [
        [2, 1],
        [1, 1],
      ],
      u: [1, 2],
    },
  ),
  preset(
    "line-collapse",
    "Collapse onto a line",
    "A nonzero singular matrix loses one input direction.",
    "maps",
    {
      A: [
        [1, 1],
        [2, 2],
      ],
      u: [2, -1],
    },
  ),
  preset("zero-map", "The zero map", "The whole plane is the kernel of the zero matrix.", "maps", {
    A: [
      [0, 0],
      [0, 0],
    ],
    u: [3, -2],
  }),
  preset(
    "quarter-turn",
    "A counterclockwise quarter-turn",
    "Check the direction of a 90-degree rotation.",
    "geometry",
    { u: [3, -2], operation: "rotate90" },
  ),
  preset(
    "diagonal-reflection",
    "Reflect across y = x",
    "Swap coordinates and reverse orientation.",
    "geometry",
    { u: [-2, 3], operation: "reflect-diagonal" },
  ),
  preset(
    "horizontal-shear",
    "Area without length preservation",
    "A shear can change length while preserving area.",
    "geometry",
    { u: [1, 2], operation: "shear-x", a: 2 },
  ),
  preset(
    "projection-matrix",
    "Projection as a matrix",
    "The transformed grid collapses onto the chosen line.",
    "geometry",
    { u: [3, 2], v: [1, 1], operation: "project-line" },
  ),
  preset(
    "translation-cancels",
    "Translated endpoints",
    "The translation cancels when two outputs are subtracted.",
    "affine",
    {
      A: [
        [1, 1],
        [0, 2],
      ],
      u: [1, -1],
      v: [3, 2],
      t: [2, -1],
    },
  ),
  preset(
    "singular-affine",
    "Two points, one output",
    "Midpoint preservation remains true for a singular affine map.",
    "affine",
    {
      A: [
        [1, 1],
        [0, 0],
      ],
      u: [0, 1],
      v: [2, -1],
      t: [2, 3],
    },
  ),
  preset(
    "linear-limit",
    "Zero translation is linear",
    "An affine rule with zero translation is a linear map.",
    "affine",
    {
      A: [
        [0, -1],
        [1, 0],
      ],
      u: [1, 0],
      v: [0, 1],
      t: [0, 0],
    },
  ),
];
export function defaultScene(mode: LabMode): LabScene {
  const selected = LAB_PRESETS.find((item) => item.mode === mode);
  if (!selected) throw new RangeError("Choose a supported laboratory mode.");
  return copyScene(selected.scene);
}
