import type { SimulatorValues } from "./ControlSidebar";
import type { Point, SimulationGeometry } from "./simulationGeometry";

export type DynamicVehicleLineProps = Readonly<{
  geometry: SimulationGeometry;
  values: SimulatorValues;
  className?: string;
  bodyLineHref?: string;
  bodyLineTransform?: string;
}>;

type WheelProps = Readonly<{
  center: SimulationGeometry["frontWheel"];
  diameter: number;
  offset: number;
  caliperPosition: SimulatorValues["frontCaliperPosition"];
  fender: SimulatorValues["frontFender"];
  name: "front" | "rear";
}>;

const INK = "#1f2a31";
const MECHANICAL = "#647783";
const BRAKE = "#c4473d";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

function point(x: number, y: number): Point {
  return { x, y };
}

function add(first: Point, second: Point): Point {
  return point(first.x + second.x, first.y + second.y);
}

function subtract(first: Point, second: Point): Point {
  return point(first.x - second.x, first.y - second.y);
}

function multiply(vector: Point, amount: number): Point {
  return point(vector.x * amount, vector.y * amount);
}

function length(vector: Point): number {
  return Math.hypot(vector.x, vector.y);
}

function normalize(vector: Point): Point {
  const magnitude = length(vector);
  return magnitude < 0.001 ? point(1, 0) : point(vector.x / magnitude, vector.y / magnitude);
}

function perpendicular(vector: Point): Point {
  return point(-vector.y, vector.x);
}

function mix(first: Point, second: Point, amount: number): Point {
  return add(first, multiply(subtract(second, first), amount));
}

function arcPath(center: Point, radius: number, fender: "短" | "长"): string {
  const spread = fender === "长" ? 0.9 : 0.58;
  const edgeY = center.y - radius * Math.sqrt(1 - spread * spread);
  return `M ${center.x - radius * spread} ${edgeY} A ${radius} ${radius} 0 0 1 ${center.x + radius * spread} ${edgeY}`;
}

function springPath(start: Point, end: Point, coils: number): string {
  const axis = normalize(subtract(end, start));
  const normal = perpendicular(axis);
  const points = Array.from({ length: coils * 2 + 1 }, (_, index) => {
    const progress = index / (coils * 2);
    const amplitude = index === 0 || index === coils * 2 ? 0 : index % 2 === 0 ? -5 : 5;
    return add(mix(start, end, progress), multiply(normal, amplitude));
  });
  return points.map((item, index) => `${index === 0 ? "M" : "L"} ${item.x} ${item.y}`).join(" ");
}

function Wheel({ center, diameter, offset, caliperPosition, fender, name }: WheelProps) {
  const radius = clamp(center.radius, 42, 118);
  const rimRadius = clamp(diameter * 2.8, radius * 0.42, radius * 0.72);
  const hubShift = clamp(offset * 0.18, -15, 15);
  const hub = point(center.x + hubShift, center.y);
  const discRadius = clamp(center.discRadius, 13, rimRadius * 0.88);
  const spokeRadius = rimRadius - 5;
  const spokes = Array.from({ length: 12 }, (_, index) => {
    const angle = (index / 12) * Math.PI * 2;
    return point(center.x + Math.cos(angle) * spokeRadius, center.y + Math.sin(angle) * spokeRadius);
  });
  const caliperSide = caliperPosition === "前置" ? -1 : 1;
  const caliperX = center.x + caliperSide * discRadius * 0.72;

  return (
    <g className={`motomate-line-wheel motomate-line-wheel-${name}`}>
      <circle cx={center.x} cy={center.y} r={radius} fill="rgba(255,255,255,.04)" stroke={INK} strokeWidth="3" />
      <circle cx={center.x} cy={center.y} r={radius - 7} fill="none" stroke={MECHANICAL} strokeWidth="1.25" />
      <circle cx={center.x} cy={center.y} r={rimRadius} fill="rgba(255,255,255,.42)" stroke={INK} strokeWidth="2.5" />
      <g className="motomate-line-spokes" stroke={MECHANICAL} strokeWidth="1.35">
        {spokes.map((end, index) => <line key={index} x1={hub.x} y1={hub.y} x2={end.x} y2={end.y} />)}
      </g>
      <circle cx={center.x} cy={center.y} r={discRadius} fill="none" stroke={MECHANICAL} strokeWidth="2" strokeDasharray="4 3" />
      <circle cx={hub.x} cy={hub.y} r="8" fill="#fff" stroke={INK} strokeWidth="2.5" />
      {hubShift !== 0 ? <line x1={center.x} y1={center.y} x2={hub.x} y2={hub.y} stroke={MECHANICAL} strokeWidth="2" /> : null}
      <rect x={caliperX - 7} y={center.y - 12} width="14" height="24" rx="4" fill={BRAKE} stroke="#8e302b" strokeWidth="1.5" />
      {fender !== "无" ? <path d={arcPath(center, radius + 10, fender)} fill="none" stroke={INK} strokeWidth={fender === "长" ? 5 : 4} strokeLinecap="round" /> : null}
    </g>
  );
}

export function DynamicVehicleLine({
  geometry,
  values,
  className,
  bodyLineHref,
  bodyLineTransform,
}: DynamicVehicleLineProps) {
  const front = point(geometry.frontWheel.x, geometry.frontWheel.y);
  const rear = point(geometry.rearWheel.x, geometry.rearWheel.y);

  const handleRadians = ((35 + clamp(values.handlebarAngle, -65, 65)) * Math.PI) / 180;
  const crown = geometry.forkTop;
  const forkAxis = normalize(subtract(crown, front));
  const forkNormal = perpendicular(forkAxis);
  const forkSpacing = values.frontForkStyle === "倒置" ? 8 : 6;
  const crownLeft = add(crown, multiply(forkNormal, 14));
  const crownRight = add(crown, multiply(forkNormal, -14));
  const lowerFork = mix(front, crown, values.frontForkStyle === "倒置" ? 0.44 : 0.62);

  const barDirection = normalize(point(Math.cos(handleRadians), Math.sin(handleRadians)));
  const barHalfWidth = 31;
  const barStart = add(geometry.handle, multiply(barDirection, -barHalfWidth));
  const barEnd = add(geometry.handle, multiply(barDirection, barHalfWidth));

  const deckFront = point(geometry.foot.x - 64, geometry.foot.y + 4);
  const deckRear = geometry.chassis;
  const neckLower = mix(crown, front, 0.43);
  const seatFront = point(geometry.seat.x - 55, geometry.seat.y + 2);
  const seatRear = point(geometry.seat.x + 68, geometry.seat.y + 8);
  const tail = point(Math.min(rear.x - 18, seatRear.x + 54), geometry.seat.y + 49);
  const swingPivot = geometry.swingPivot;
  const swingNormal = perpendicular(normalize(subtract(rear, swingPivot)));
  const swingWidth = 8;

  const shockBottom = geometry.shockBottom;
  const shockTop = geometry.shockTop;
  const shockStart = mix(shockTop, shockBottom, 0.16);
  const shockEnd = mix(shockTop, shockBottom, 0.84);
  const shockCoils = Math.round(clamp(values.rearShockTravel / 38, 5, 10));

  const paintFill = values.paint === "亮黑"
    ? "rgba(31,42,49,.16)"
    : values.paint === "哑光"
      ? "rgba(100,119,131,.12)"
      : "rgba(255,255,255,.72)";

  return (
    <g
      className={`motomate-dynamic-vehicle-line${className ? ` ${className}` : ""}`}
      aria-hidden="true"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Wheel center={geometry.frontWheel} diameter={values.frontWheelDiameter} offset={values.frontWheelOffset} caliperPosition={values.frontCaliperPosition} fender={values.frontFender} name="front" />
      <Wheel center={geometry.rearWheel} diameter={values.rearWheelDiameter} offset={values.rearWheelOffset} caliperPosition={values.rearCaliperPosition} fender={values.rearFender} name="rear" />

      {bodyLineHref ? (
        <g
          className="motomate-line-model-body"
          transform={bodyLineTransform}
        >
          <image
            className="motomate-line-model-image"
            href={bodyLineHref}
            x="0"
            y="0"
            width="727"
            height="545"
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
      ) : null}

      <g className="motomate-line-front-assembly" fill="none">
        <line x1={front.x + forkNormal.x * forkSpacing} y1={front.y + forkNormal.y * forkSpacing} x2={crown.x + forkNormal.x * forkSpacing} y2={crown.y + forkNormal.y * forkSpacing} stroke={INK} strokeWidth={values.frontForkStyle === "倒置" ? 5 : 3.5} />
        <line x1={front.x - forkNormal.x * forkSpacing} y1={front.y - forkNormal.y * forkSpacing} x2={crown.x - forkNormal.x * forkSpacing} y2={crown.y - forkNormal.y * forkSpacing} stroke={MECHANICAL} strokeWidth={values.frontForkStyle === "倒置" ? 3 : 4.5} />
        <line x1={lowerFork.x - forkNormal.x * 8} y1={lowerFork.y - forkNormal.y * 8} x2={lowerFork.x + forkNormal.x * 8} y2={lowerFork.y + forkNormal.y * 8} stroke={MECHANICAL} strokeWidth="2" />
        <line x1={crownLeft.x} y1={crownLeft.y} x2={crownRight.x} y2={crownRight.y} stroke={INK} strokeWidth="5" />
        <line x1={crown.x} y1={crown.y} x2={geometry.handle.x} y2={geometry.handle.y} stroke={INK} strokeWidth="4" />
        <line x1={barStart.x} y1={barStart.y} x2={barEnd.x} y2={barEnd.y} stroke={INK} strokeWidth="5" />
        <line x1={barStart.x - barDirection.x * 10} y1={barStart.y - barDirection.y * 10} x2={barStart.x} y2={barStart.y} stroke={MECHANICAL} strokeWidth="8" />
        <line x1={barEnd.x} y1={barEnd.y} x2={barEnd.x + barDirection.x * 10} y2={barEnd.y + barDirection.y * 10} stroke={MECHANICAL} strokeWidth="8" />
        {values.frontForkAirbag !== "无" ? <rect x={lowerFork.x - 8} y={lowerFork.y - (values.frontForkAirbag === "P2" ? 20 : 15)} width="16" height={values.frontForkAirbag === "P2" ? 40 : 30} rx="8" fill="#fff" stroke={MECHANICAL} strokeWidth="2" transform={`rotate(${geometry.forkAngle - 90} ${lowerFork.x} ${lowerFork.y})`} /> : null}
      </g>

      <g className="motomate-line-rear-assembly" fill="none">
        <path d={`M ${swingPivot.x + swingNormal.x * swingWidth} ${swingPivot.y + swingNormal.y * swingWidth} L ${rear.x + swingNormal.x * swingWidth} ${rear.y + swingNormal.y * swingWidth} L ${rear.x - swingNormal.x * swingWidth} ${rear.y - swingNormal.y * swingWidth} L ${swingPivot.x - swingNormal.x * swingWidth} ${swingPivot.y - swingNormal.y * swingWidth} Z`} stroke={INK} strokeWidth="2.5" fill="rgba(255,255,255,.42)" />
        <line x1={shockTop.x} y1={shockTop.y} x2={shockStart.x} y2={shockStart.y} stroke={MECHANICAL} strokeWidth="4" />
        <path d={springPath(shockStart, shockEnd, shockCoils)} stroke={INK} strokeWidth="2" />
        <line x1={shockEnd.x} y1={shockEnd.y} x2={shockBottom.x} y2={shockBottom.y} stroke={MECHANICAL} strokeWidth="4" />
        <circle cx={shockTop.x} cy={shockTop.y} r="5" fill="#fff" stroke={INK} strokeWidth="2" />
        <circle cx={shockBottom.x} cy={shockBottom.y} r="5" fill="#fff" stroke={INK} strokeWidth="2" />
      </g>

      {!bodyLineHref ? (
        <g className="motomate-line-frame-body">
          <path d={`M ${neckLower.x} ${neckLower.y} Q ${crown.x + 34} ${crown.y + 82} ${deckFront.x} ${deckFront.y - 38} L ${deckFront.x} ${deckFront.y} Q ${(deckFront.x + deckRear.x) / 2} ${deckFront.y + 13} ${deckRear.x} ${deckRear.y} L ${tail.x} ${tail.y} Q ${seatRear.x + 28} ${geometry.seat.y + 15} ${seatRear.x} ${seatRear.y} L ${seatFront.x} ${seatFront.y} Q ${geometry.seat.x - 88} ${geometry.seat.y + 55} ${neckLower.x} ${neckLower.y} Z`} fill={paintFill} stroke={INK} strokeWidth="2.8" />
          <path d={`M ${neckLower.x + 5} ${neckLower.y + 13} Q ${geometry.foot.x - 84} ${geometry.foot.y - 62} ${deckFront.x + 8} ${deckFront.y - 8} L ${deckRear.x - 12} ${deckRear.y - 8} Q ${geometry.seat.x + 24} ${geometry.seat.y + 70} ${seatRear.x + 5} ${seatRear.y + 16}`} fill="none" stroke={MECHANICAL} strokeWidth="1.7" />
          <path d={`M ${seatFront.x} ${seatFront.y} Q ${geometry.seat.x} ${geometry.seat.y - 14} ${seatRear.x} ${seatRear.y} Q ${geometry.seat.x + 22} ${geometry.seat.y + 22} ${seatFront.x} ${seatFront.y} Z`} fill="#fff" stroke={INK} strokeWidth="2.8" />
          <line x1={tail.x} y1={tail.y} x2={geometry.chassis.x} y2={geometry.chassis.y} stroke={MECHANICAL} strokeWidth="2" />
        </g>
      ) : null}

      <g className="motomate-line-mechanical-connections">
        <line x1={deckFront.x} y1={deckFront.y + 3} x2={deckRear.x} y2={deckRear.y + 3} stroke={INK} strokeWidth="6" />
        <line x1={geometry.foot.x - 22} y1={geometry.foot.y} x2={geometry.foot.x + 22} y2={geometry.foot.y} stroke={INK} strokeWidth="6" />
        <circle cx={geometry.foot.x} cy={geometry.foot.y} r="4" fill="#fff" stroke={INK} strokeWidth="2" />
        <line x1={deckRear.x} y1={deckRear.y - 5} x2={swingPivot.x} y2={swingPivot.y} stroke={MECHANICAL} strokeWidth="5" />
      </g>

      <g className="motomate-line-accessory">
        {values.accessory === "尾箱" ? <g><rect x={seatRear.x + 14} y={geometry.seat.y - 57} width="78" height="46" rx="9" fill="#fff" stroke={INK} strokeWidth="2.8" /><line x1={seatRear.x + 21} y1={geometry.seat.y - 10} x2={tail.x} y2={tail.y - 7} stroke={MECHANICAL} strokeWidth="4" /></g> : null}
        {values.accessory === "风挡" ? <path d={`M ${geometry.handle.x - 3} ${geometry.handle.y + 18} Q ${geometry.handle.x + 24} ${geometry.handle.y - 69} ${geometry.handle.x + 54} ${geometry.handle.y - 13} Z`} fill="rgba(150,202,225,.12)" stroke={MECHANICAL} strokeWidth="2.2" /> : null}
      </g>
    </g>
  );
}

export default DynamicVehicleLine;
