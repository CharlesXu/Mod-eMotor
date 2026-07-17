export type NumericSimulatorKey =
  | "handlebarHeight"
  | "handlebarAngle"
  | "tripleClampAngle"
  | "tripleClampDrop"
  | "frontForkTravel"
  | "frontTireWidth"
  | "frontTireRatio"
  | "frontWheelDiameter"
  | "frontWheelOffset"
  | "frontBrakeDiscDiameter"
  | "swingarmLength"
  | "rearShockTravel"
  | "rearShockAngle"
  | "rearTireWidth"
  | "rearTireRatio"
  | "rearWheelDiameter"
  | "rearWheelOffset"
  | "rearBrakeDiscDiameter"
  | "seatHeight"
  | "seatOffset"
  | "footrestOffset"
  | "riderHeight";

export type NumericConstraint = Readonly<{
  min: number;
  max: number;
  step: number;
}>;

export const NUMERIC_CONSTRAINTS: Readonly<Record<NumericSimulatorKey, NumericConstraint>> = {
  handlebarHeight: { min: 20, max: 300, step: 1 },
  handlebarAngle: { min: -65, max: 65, step: 1 },
  tripleClampAngle: { min: -20, max: 20, step: 1 },
  tripleClampDrop: { min: -100, max: 180, step: 1 },
  frontForkTravel: { min: 240, max: 700, step: 1 },
  frontTireWidth: { min: 40, max: 220, step: 1 },
  frontTireRatio: { min: 20, max: 120, step: 1 },
  frontWheelDiameter: { min: 8, max: 24, step: 1 },
  frontWheelOffset: { min: -80, max: 80, step: 1 },
  frontBrakeDiscDiameter: { min: 80, max: 420, step: 1 },
  swingarmLength: { min: 280, max: 700, step: 1 },
  rearShockTravel: { min: 140, max: 500, step: 1 },
  rearShockAngle: { min: -45, max: 45, step: 1 },
  rearTireWidth: { min: 40, max: 220, step: 1 },
  rearTireRatio: { min: 20, max: 120, step: 1 },
  rearWheelDiameter: { min: 8, max: 24, step: 1 },
  rearWheelOffset: { min: -80, max: 80, step: 1 },
  rearBrakeDiscDiameter: { min: 80, max: 420, step: 1 },
  seatHeight: { min: 520, max: 1050, step: 1 },
  seatOffset: { min: -250, max: 250, step: 1 },
  footrestOffset: { min: -250, max: 250, step: 1 },
  riderHeight: { min: 140, max: 210, step: 1 },
};

export function clampNumericValue(
  key: NumericSimulatorKey,
  candidate: number,
  fallback: number,
): number {
  const { min, max } = NUMERIC_CONSTRAINTS[key];
  const finiteFallback = Number.isFinite(fallback) ? fallback : min;
  const value = Number.isFinite(candidate) ? candidate : finiteFallback;
  return Math.min(max, Math.max(min, value));
}

export function clampNumericValues<Values extends Record<NumericSimulatorKey, number>>(
  candidate: Partial<Record<NumericSimulatorKey, unknown>>,
  fallbacks: Values,
): Values {
  const next = { ...fallbacks };
  const writable = next as Record<NumericSimulatorKey, number>;
  for (const key of Object.keys(NUMERIC_CONSTRAINTS) as NumericSimulatorKey[]) {
    const value = candidate[key];
    writable[key] = clampNumericValue(
      key,
      typeof value === "number" ? value : Number.NaN,
      fallbacks[key],
    );
  }
  return next;
}

export type ComparisonGeometry = Readonly<{
  wheelbase: number;
  seatHeight: number;
  groundClearance: number;
  forkAngle: number;
  rearShockAngle: number;
}>;

export type ComparisonRow = Readonly<{
  label: string;
  original: number;
  current: number;
  unit: "mm" | "°";
}>;

export function buildComparisonRows(
  current: ComparisonGeometry,
  original: ComparisonGeometry,
): readonly ComparisonRow[] {
  return [
    { label: "轴距", original: original.wheelbase, current: current.wheelbase, unit: "mm" },
    { label: "座高", original: original.seatHeight, current: current.seatHeight, unit: "mm" },
    { label: "离地间隙", original: original.groundClearance, current: current.groundClearance, unit: "mm" },
    { label: "前叉角", original: original.forkAngle, current: current.forkAngle, unit: "°" },
    { label: "后减角", original: original.rearShockAngle, current: current.rearShockAngle, unit: "°" },
  ];
}

export function resolveGeometryPair<Geometry, Profile>(
  current: Geometry,
  original: Geometry,
  profile: Profile | undefined,
  align: (subject: Geometry, baseline: Geometry, profile: Profile) => Geometry,
): Readonly<{ current: Geometry; original: Geometry }> {
  if (!profile) return { current, original };
  return {
    current: align(current, original, profile),
    original: align(original, original, profile),
  };
}
