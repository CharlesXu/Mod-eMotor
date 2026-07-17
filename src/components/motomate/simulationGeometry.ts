import type { SimulatorValues } from "./ControlSidebar";

export type Point = Readonly<{ x: number; y: number }>;

export type GeometryProfile = Readonly<{
  wheelbaseMm: number;
  pixelsPerMillimeter: number;
  forkAngleDegrees: number;
  handlePivot: Point;
  handle: Point;
  forkTop: Point;
  frontWheel: Point;
  rearWheel: Point;
  swingPivot: Point;
  shockTop: Point;
  shockBottom: Point;
  seat: Point;
  foot: Point;
  chassis: Point;
  frontWheelRadius: number;
  rearWheelRadius: number;
  frontDiscRadius: number;
  rearDiscRadius: number;
}>;

type WheelGeometry = Readonly<{
  x: number;
  y: number;
  radius: number;
  discRadius: number;
}>;

export type SimulationGeometry = Readonly<{
  wheelbase: number;
  seatHeight: number;
  groundClearance: number;
  tilt: number;
  forkAngle: number;
  rearShockAngle: number;
  frontWheel: WheelGeometry;
  rearWheel: WheelGeometry;
  handlePivot: Point;
  handle: Point;
  seat: Point;
  foot: Point;
  forkTop: Point;
  swingPivot: Point;
  shockTop: Point;
  shockBottom: Point;
  chassis: Point;
  triangleAngles: Readonly<{ handle: number; seat: number; foot: number }>;
  rider: Readonly<{
    head: Point;
    neck: Point;
    shoulder: Point;
    elbow: Point;
    hand: Point;
    hip: Point;
    knee: Point;
    foot: Point;
  }>;
}>;

const STAGE_GROUND_Y = 475;
const PIXELS_PER_MM = 452 / 1245;
const BASE_TIRE_RADIUS_MM = (14 * 25.4) / 2 + (90 * 0.8 + 90 * 0.9) / 2;
const WHEEL_PIXELS_PER_MM = 90 / BASE_TIRE_RADIUS_MM;

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return Math.min(maximum, Math.max(minimum, finite(value, fallback)));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function point(x: number, y: number): Point {
  return Object.freeze({ x: round(finite(x, 0)), y: round(finite(y, 0)) });
}

function translate(source: Point, delta: Point): Point {
  return point(source.x + delta.x, source.y + delta.y);
}

function deltaBetween(current: Point, baseline: Point): Point {
  return point(current.x - baseline.x, current.y - baseline.y);
}

function alignedPoint(profile: Point, current: Point, baseline: Point): Point {
  return point(
    finite(profile?.x, baseline.x) + finite(current.x - baseline.x, 0),
    finite(profile?.y, baseline.y) + finite(current.y - baseline.y, 0),
  );
}

function alignedRadius(profile: unknown, current: number, baseline: number): number {
  return round(clamp(finite(profile, baseline) + finite(current - baseline, 0), 0, 300, baseline));
}

function transformedEndpoint(
  profileStart: Point,
  profileEnd: Point,
  currentStart: Point,
  currentEnd: Point,
  baselineStart: Point,
  baselineEnd: Point,
): Point {
  const currentVector = point(currentEnd.x - currentStart.x, currentEnd.y - currentStart.y);
  const baselineVector = point(baselineEnd.x - baselineStart.x, baselineEnd.y - baselineStart.y);
  const profileVector = point(profileEnd.x - profileStart.x, profileEnd.y - profileStart.y);
  const baselineLength = Math.max(0.001, Math.hypot(baselineVector.x, baselineVector.y));
  const scale = Math.hypot(currentVector.x, currentVector.y) / baselineLength;
  const angleDelta = Math.atan2(currentVector.y, currentVector.x) - Math.atan2(baselineVector.y, baselineVector.x);
  return point(
    profileStart.x + (Math.cos(angleDelta) * profileVector.x - Math.sin(angleDelta) * profileVector.y) * scale,
    profileStart.y + (Math.sin(angleDelta) * profileVector.x + Math.cos(angleDelta) * profileVector.y) * scale,
  );
}

function tireRadius(width: unknown, ratio: unknown, rimDiameter: unknown): number {
  const safeWidth = clamp(width, 40, 220, 90);
  const safeRatio = clamp(ratio, 20, 120, 80);
  const safeRim = clamp(rimDiameter, 8, 24, 14);
  return (safeRim * 25.4) / 2 + safeWidth * (safeRatio / 100);
}

function distance(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function vertexAngle(vertex: Point, first: Point, second: Point): number {
  const a = distance(vertex, first);
  const b = distance(vertex, second);
  const opposite = distance(first, second);
  if (a < 0.001 || b < 0.001) return 0;
  const cosine = Math.min(1, Math.max(-1, (a * a + b * b - opposite * opposite) / (2 * a * b)));
  return round((Math.acos(cosine) * 180) / Math.PI);
}

/** Finds a stable two-link joint, falling back to a bent midpoint when out of reach. */
function jointBetween(start: Point, end: Point, firstLength: number, secondLength: number, bend: number): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const rawDistance = Math.hypot(dx, dy);
  if (rawDistance < 0.001) return point(start.x, start.y);

  const reachableDistance = Math.min(
    firstLength + secondLength - 0.001,
    Math.max(Math.abs(firstLength - secondLength) + 0.001, rawDistance),
  );
  const along = (firstLength ** 2 - secondLength ** 2 + reachableDistance ** 2) / (2 * reachableDistance);
  const height = Math.sqrt(Math.max(0, firstLength ** 2 - along ** 2));
  const ux = dx / rawDistance;
  const uy = dy / rawDistance;
  return point(
    start.x + ux * along - uy * height * bend,
    start.y + uy * along + ux * height * bend,
  );
}

export function computeSimulationGeometry(values: SimulatorValues): SimulationGeometry {
  const frontRadiusMm = tireRadius(values.frontTireWidth, values.frontTireRatio, values.frontWheelDiameter);
  const rearRadiusMm = tireRadius(values.rearTireWidth, values.rearTireRatio, values.rearWheelDiameter);
  const swingarmLength = clamp(values.swingarmLength, 200, 700, 440);
  const frontPositionMm = values.frontWheelPosition === "前位" ? -30 : values.frontWheelPosition === "后位" ? 30 : 0;
  const baseWheelbase = clamp(1245 + (swingarmLength - 440) * 0.72, 850, 1750, 1245);
  const wheelbase = clamp(baseWheelbase - frontPositionMm, 850, 1750, 1245);
  const forkRootX = 129;
  const frontX = forkRootX + frontPositionMm * PIXELS_PER_MM;
  const rearX = forkRootX + baseWheelbase * PIXELS_PER_MM;
  const frontRadius = frontRadiusMm * WHEEL_PIXELS_PER_MM;
  const rearRadius = rearRadiusMm * WHEEL_PIXELS_PER_MM;
  const frontY = STAGE_GROUND_Y - frontRadius;
  const rearY = STAGE_GROUND_Y - rearRadius;
  const tilt = (Math.atan2(rearY - frontY, rearX - frontX) * 180) / Math.PI;

  const forkAngle = clamp(65 + clamp(values.tripleClampAngle, -20, 20, 0), 45, 80, 65);
  const forkRadians = (forkAngle * Math.PI) / 180;
  const forkLength = clamp(values.frontForkTravel, 240, 700, 425) * 0.59;
  const clampDrop = clamp(values.tripleClampDrop, -100, 180, 0) * PIXELS_PER_MM;
  const forkTop = point(
    forkRootX + Math.cos(forkRadians) * forkLength,
    frontY - Math.sin(forkRadians) * forkLength + clampDrop,
  );
  const handleHeight = clamp(values.handlebarHeight, 20, 300, 97) * 0.85;
  const handleAngle = ((35 + clamp(values.handlebarAngle, -65, 65, 0)) * Math.PI) / 180;
  const handlePivot = forkTop;
  const handle = point(
    forkTop.x + Math.sin(handleAngle) * handleHeight,
    forkTop.y - Math.cos(handleAngle) * handleHeight,
  );

  const averageRadiusMm = (frontRadiusMm + rearRadiusMm) / 2;
  const rearTravel = clamp(values.rearShockTravel, 140, 500, 260);
  const groundClearance = clamp(
    154 + (averageRadiusMm - BASE_TIRE_RADIUS_MM) * 0.55 + (rearTravel - 260) * 0.12,
    60,
    350,
    154,
  );
  const seatHeight = clamp(values.seatHeight, 520, 1050, 794);
  const seatOffset = clamp(values.seatOffset, -250, 250, 0);
  const footrestOffset = clamp(values.footrestOffset, -250, 250, 0);
  const postureSeatShift = values.posture === "运动" ? -35 : values.posture === "舒适" ? 25 : 0;
  const postureFootShift = values.posture === "运动" ? 45 : values.posture === "舒适" ? -35 : 0;
  const seat = point(
    rearX - (325 - seatOffset - postureSeatShift) * PIXELS_PER_MM,
    STAGE_GROUND_Y - seatHeight * 0.36,
  );
  const foot = point(
    forkRootX + (510 + footrestOffset + postureFootShift) * PIXELS_PER_MM,
    STAGE_GROUND_Y - groundClearance * 0.64,
  );

  const riderHeightCm = clamp(values.riderHeight, 140, 210, 175);
  const riderScale = riderHeightCm * 10 * PIXELS_PER_MM;
  const hip = point(seat.x - 10, seat.y - 4);
  const torsoLean = values.posture === "运动" ? 40 : values.posture === "舒适" ? 8 : 22;
  const torsoRadians = (torsoLean * Math.PI) / 180;
  const torsoLength = riderScale * 0.285;
  const neck = point(
    hip.x - Math.sin(torsoRadians) * torsoLength,
    hip.y - Math.cos(torsoRadians) * torsoLength,
  );
  const shoulder = point(
    neck.x + Math.cos(torsoRadians) * riderScale * 0.035,
    neck.y - Math.sin(torsoRadians) * riderScale * 0.035,
  );
  const head = point(
    neck.x - Math.sin(torsoRadians * 0.35) * riderScale * 0.055,
    neck.y - Math.cos(torsoRadians * 0.35) * riderScale * 0.075,
  );
  const hand = handle;
  const elbow = jointBetween(shoulder, hand, riderScale * 0.186, riderScale * 0.146, -1);
  const riderFoot = foot;
  const knee = jointBetween(hip, riderFoot, riderScale * 0.245, riderScale * 0.246, 1);

  const frontWheel = Object.freeze({
    x: round(frontX),
    y: round(frontY),
    radius: round(frontRadius),
    discRadius: round(Math.min(frontRadius * 0.88, clamp(values.frontBrakeDiscDiameter, 80, 420, 220) * WHEEL_PIXELS_PER_MM / 2)),
  });
  const rearWheel = Object.freeze({
    x: round(rearX),
    y: round(rearY),
    radius: round(rearRadius),
    discRadius: round(Math.min(rearRadius * 0.88, clamp(values.rearBrakeDiscDiameter, 80, 420, 180) * WHEEL_PIXELS_PER_MM / 2)),
  });
  const swingPivot = point(foot.x + 146, foot.y - 15);
  const shockBottom = point(
    swingPivot.x + (rearWheel.x - swingPivot.x) * 0.58,
    swingPivot.y + (rearWheel.y - swingPivot.y) * 0.58,
  );
  const rearShockAngle = clamp(70 + values.rearShockAngle, 25, 88, 70);
  const shockLength = clamp(values.rearShockTravel * 0.42, 72, 180, 109.2);
  const shockRadians = (rearShockAngle * Math.PI) / 180;
  const shockTop = point(
    shockBottom.x - Math.cos(shockRadians) * shockLength,
    shockBottom.y - Math.sin(shockRadians) * shockLength,
  );
  const chassis = point(
    rearWheel.x - rearWheel.radius * 0.74,
    rearWheel.y - rearWheel.radius * 0.48,
  );

  return Object.freeze({
    wheelbase: round(wheelbase),
    seatHeight: round(seatHeight),
    groundClearance: round(groundClearance),
    tilt: round(tilt),
    forkAngle: round(forkAngle),
    rearShockAngle: round(rearShockAngle),
    frontWheel,
    rearWheel,
    handlePivot,
    handle,
    seat,
    foot,
    forkTop,
    swingPivot,
    shockTop,
    shockBottom,
    chassis,
    triangleAngles: Object.freeze({
      handle: vertexAngle(handle, seat, foot),
      seat: vertexAngle(seat, handle, foot),
      foot: vertexAngle(foot, handle, seat),
    }),
    rider: Object.freeze({ head, neck, shoulder, elbow, hand, hip, knee, foot: riderFoot }),
  });
}

/**
 * Places generic parameter deltas on top of a model's extracted mechanical
 * anchors. The baseline stays fixed so saved and freshly-entered values align
 * identically for a given model.
 */
export function alignSimulationGeometry(
  current: SimulationGeometry,
  baseline: SimulationGeometry,
  profile: GeometryProfile,
): SimulationGeometry {
  const handlePivot = point(profile.handlePivot.x, profile.handlePivot.y);
  const handle = transformedEndpoint(
    handlePivot,
    profile.handle,
    current.handlePivot,
    current.handle,
    baseline.handlePivot,
    baseline.handle,
  );
  const seat = alignedPoint(profile.seat, current.seat, baseline.seat);
  const foot = alignedPoint(profile.foot, current.foot, baseline.foot);
  const forkTop = point(profile.forkTop.x, profile.forkTop.y);
  const swingPivot = point(profile.swingPivot.x, profile.swingPivot.y);
  const shockTop = point(profile.shockTop.x, profile.shockTop.y);
  const chassis = point(profile.chassis.x, profile.chassis.y);
  const frontCenter = transformedEndpoint(
    forkTop,
    profile.frontWheel,
    current.forkTop,
    current.frontWheel,
    baseline.forkTop,
    baseline.frontWheel,
  );
  const rearCenter = transformedEndpoint(
    swingPivot,
    profile.rearWheel,
    current.swingPivot,
    current.rearWheel,
    baseline.swingPivot,
    baseline.rearWheel,
  );
  const shockBottom = transformedEndpoint(
    shockTop,
    profile.shockBottom,
    current.shockTop,
    current.shockBottom,
    baseline.shockTop,
    baseline.shockBottom,
  );
  const frontWheel = Object.freeze({
    ...frontCenter,
    radius: alignedRadius(profile.frontWheelRadius, current.frontWheel.radius, baseline.frontWheel.radius),
    discRadius: alignedRadius(profile.frontDiscRadius, current.frontWheel.discRadius, baseline.frontWheel.discRadius),
  });
  const rearWheel = Object.freeze({
    ...rearCenter,
    radius: alignedRadius(profile.rearWheelRadius, current.rearWheel.radius, baseline.rearWheel.radius),
    discRadius: alignedRadius(profile.rearDiscRadius, current.rearWheel.discRadius, baseline.rearWheel.discRadius),
  });

  const seatDelta = deltaBetween(seat, current.seat);
  const handleDelta = deltaBetween(handle, current.handle);
  const footDelta = deltaBetween(foot, current.foot);
  const torsoDelta = seatDelta;
  const elbowDelta = point(
    (torsoDelta.x + handleDelta.x) / 2,
    (torsoDelta.y + handleDelta.y) / 2,
  );
  const kneeDelta = point(
    (torsoDelta.x + footDelta.x) / 2,
    (torsoDelta.y + footDelta.y) / 2,
  );
  const rider = Object.freeze({
    head: translate(current.rider.head, torsoDelta),
    neck: translate(current.rider.neck, torsoDelta),
    shoulder: translate(current.rider.shoulder, torsoDelta),
    elbow: translate(current.rider.elbow, elbowDelta),
    hand: handle,
    hip: translate(current.rider.hip, torsoDelta),
    knee: translate(current.rider.knee, kneeDelta),
    foot,
  });
  const swingAngle = Math.atan2(rearCenter.y - swingPivot.y, rearCenter.x - swingPivot.x);
  const shockAngle = Math.atan2(shockBottom.y - shockTop.y, shockBottom.x - shockTop.x);
  const rearShockAngle = Math.abs(((shockAngle - swingAngle) * 180) / Math.PI);
  const stagePixelsPerMillimeter = finite(profile.pixelsPerMillimeter, 0.45) * (727 / 900);
  const groundY = Math.max(frontWheel.y + frontWheel.radius, rearWheel.y + rearWheel.radius);
  const groundClearance = stagePixelsPerMillimeter > 0
    ? (groundY - chassis.y - (727 / 900) * 6) / stagePixelsPerMillimeter
    : current.groundClearance;

  return Object.freeze({
    wheelbase: round(finite(profile.wheelbaseMm, current.wheelbase) + (current.wheelbase - baseline.wheelbase)),
    seatHeight: round(finite(current.seatHeight, baseline.seatHeight)),
    groundClearance: round(finite(groundClearance, current.groundClearance)),
    tilt: round(finite(current.tilt, baseline.tilt)),
    forkAngle: round(finite(profile.forkAngleDegrees, current.forkAngle) + (current.forkAngle - baseline.forkAngle)),
    rearShockAngle: round(finite(rearShockAngle, current.rearShockAngle)),
    frontWheel,
    rearWheel,
    handlePivot,
    handle,
    seat,
    foot,
    forkTop,
    swingPivot,
    shockTop,
    shockBottom,
    chassis,
    triangleAngles: Object.freeze({
      handle: vertexAngle(handle, seat, foot),
      seat: vertexAngle(seat, handle, foot),
      foot: vertexAngle(foot, handle, seat),
    }),
    rider,
  });
}
