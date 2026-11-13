/** Public, original 2D experiments; these types never contain assessment keys. */
export type Vec2 = readonly [number, number];
export type Mat2 = readonly [Vec2, Vec2];
export const LAB_MODES = ["combinations", "projection", "matrices", "maps", "geometry", "affine"] as const;
export type LabMode = (typeof LAB_MODES)[number];
export type GeometryOperation =
  "rotate90" | "rotate180" | "reflect-x" | "reflect-diagonal" | "shear-x" | "shear-y" | "project-line";
export type LabScene = {
  u: Vec2;
  v: Vec2;
  a: number;
  b: number;
  A: Mat2;
  B: Mat2;
  t: Vec2;
  order: "AB" | "BA";
  operation: GeometryOperation;
};
export type PlotVector = {
  label: string;
  from: Vec2;
  to: Vec2;
  tone: "input" | "secondary" | "result";
  dashed?: boolean;
};
export type PlotPoint = { label: string; at: Vec2; tone: "input" | "secondary" | "result" };
export type LabExperiment = {
  output: Vec2 | null;
  steps: string[];
  observations: string[];
  facts: Array<{ label: string; value: string }>;
  vectors: PlotVector[];
  points: PlotPoint[];
  gridMatrix?: Mat2;
  lineDirection?: Vec2;
  error: string | null;
};
export type LabPreset = { id: string; label: string; description: string; mode: LabMode; scene: LabScene };
export const LAB_LESSONS: Record<LabMode, { title: string; topic: string; prediction: string }> = {
  combinations: {
    title: "Linear combinations",
    topic: "vector-arithmetic-and-linear-combinations",
    prediction: "Predict the two coordinates of au + bv.",
  },
  projection: {
    title: "Dot products and projections",
    topic: "dot-products-norms-and-angles",
    prediction: "Predict the projection of u onto the line in direction v.",
  },
  matrices: {
    title: "Matrix multiplication",
    topic: "matrix-arithmetic",
    prediction: "Predict the output of the selected matrix product applied to u.",
  },
  maps: {
    title: "Linear maps and dimension",
    topic: "linear-transformations-in-coordinates",
    prediction: "Predict the two coordinates of A u.",
  },
  geometry: {
    title: "Geometry of transformations",
    topic: "rotations-reflections-projections-and-shears",
    prediction: "Predict the transformed coordinates of u.",
  },
  affine: {
    title: "Affine points and displacements",
    topic: "affine-versus-linear-maps",
    prediction: "Predict the displacement F(v) − F(u), where F(x) = A x + t.",
  },
};
