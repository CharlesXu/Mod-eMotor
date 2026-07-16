import Image from "next/image";

import mechanicalProfileData from "../../data/motomate-mechanical-profiles.json";
import { publicPath } from "@/lib/publicPath";
import type { SimulatorValues } from "./ControlSidebar";
import type { Point, SimulationGeometry } from "./simulationGeometry";
import styles from "./OriginalMechanicalLayer.module.css";

type MechanicalProfile = Readonly<{
  sourceScale: number;
  pixelsPerMillimeter: number;
  handle: Readonly<{ height: number; angle: number }>;
  frontFork: Readonly<{ height: number; angle: number; wheelOffset: number }>;
  frontWheel: Readonly<{ radius: number; hubRadius: number; discRadius: number }>;
  swingarm: Readonly<{
    height: number;
    angle: number;
    shockMountLeft: number;
    shockMountBottom: number;
  }>;
  rearShock: Readonly<{ height: number; angle: number }>;
  rearWheel: Readonly<{ radius: number; hubRadius: number; discRadius: number }>;
  defaults: Readonly<{ frontForkTravel: number }>;
}>;

export type OriginalMechanicalLayerProps = Readonly<{
  brand: string;
  modelName: string;
  geometry: SimulationGeometry;
  values: SimulatorValues;
  bodyLineHref: string;
}>;

type SourcePoint = Readonly<{ x: number; y: number }>;
type WheelProfile = MechanicalProfile["frontWheel"];
type WheelGeometry = SimulationGeometry["frontWheel"];

const PROFILES = mechanicalProfileData as Readonly<Record<string, MechanicalProfile>>;
const PARTS_ROOT = "/motomate/original-parts";
const DISC_SRC = publicPath(`${PARTS_ROOT}/disc.bb55ca51.png`);
const FRONT_FENDER_SRC = publicPath(`${PARTS_ROOT}/fender_front.1e9857a9.png`);
const REAR_FENDER_SRC = publicPath(`${PARTS_ROOT}/fender_back.c84bddef.png`);
const FRONT_BOTTLE_P1 = publicPath(`${PARTS_ROOT}/bottle_F_z1.69bfdc7f.png`);
const FRONT_BOTTLE_P2 = publicPath(`${PARTS_ROOT}/bottle_F_z2.eb818b6c.png`);
const REAR_BOTTLE_P1 = publicPath(`${PARTS_ROOT}/bottle_B_z1.08e0a20c.png`);
const REAR_BOTTLE_P2 = publicPath(`${PARTS_ROOT}/bottle_B_z2.644343dc.png`);
const REAR_BOTTLE_P3 = publicPath(`${PARTS_ROOT}/bottle_B_z3.1980ac73.png`);

function finite(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positive(value: unknown, fallback: number): number {
  const resolved = finite(value, fallback);
  return resolved > 0 ? resolved : fallback;
}

function sourcePoint(value: Point, sourceScale: number): SourcePoint {
  return Object.freeze({
    x: finite(value.x) / sourceScale,
    y: finite(value.y) / sourceScale,
  });
}

function distance(start: SourcePoint, end: SourcePoint): number {
  return Math.max(0.001, Math.hypot(end.x - start.x, end.y - start.y));
}

/** CSS parts grow down their local Y axis to match the reference component geometry. */
function verticalAngle(start: SourcePoint, end: SourcePoint): number {
  return (Math.atan2(-(end.x - start.x), end.y - start.y) * 180) / Math.PI;
}

function rootStyle(start: SourcePoint, end: SourcePoint): React.CSSProperties {
  return Object.freeze({
    left: start.x,
    top: start.y,
    height: distance(start, end),
    transform: `rotate(${verticalAngle(start, end)}deg)`,
  });
}

function rootedPartStyle(start: SourcePoint, height: number, rotation: number): React.CSSProperties {
  return Object.freeze({
    left: start.x,
    top: start.y,
    height: positive(height, 1),
    transform: `rotate(${finite(rotation)}deg)`,
  });
}

function Wheel({
  center,
  geometry,
  profile,
  sourceScale,
  assemblyRotation,
  hubOffset,
  caliperPosition,
  fender,
  kind,
}: Readonly<{
  center: SourcePoint;
  geometry: WheelGeometry;
  profile: WheelProfile;
  sourceScale: number;
  assemblyRotation: number;
  hubOffset: number;
  caliperPosition: SimulatorValues["frontCaliperPosition"];
  fender: SimulatorValues["frontFender"];
  kind: "front" | "rear";
}>) {
  const radius = positive(geometry.radius / sourceScale, positive(profile.radius, 90));
  const profileRadius = positive(profile.radius, radius);
  const hubRadius = positive(profile.hubRadius, profileRadius * 0.68) * (radius / profileRadius);
  const discRadius = Math.min(radius * 0.92, positive(geometry.discRadius / sourceScale, profile.discRadius));
  const fenderPadding = kind === "front" ? 25 : 15;
  const fenderRadius = radius + fenderPadding;
  const localCaliperRotation = kind === "front"
    ? caliperPosition === "前置" ? -25 : -140
    : caliperPosition === "后置" ? 80 : -80;
  const caliperRotation = assemblyRotation + localCaliperRotation;
  const fenderRotation = assemblyRotation + (kind === "front" ? -25 : -15);
  const fenderClass = fender === "短" ? styles.fenderShort : styles.fenderLong;
  const hubShift = finite(hubOffset) / sourceScale * .18;

  return (
    <div className={styles.wheel} style={{ left: center.x, top: center.y }}>
      <div
        className={styles.tire}
        style={{ width: radius * 2, height: radius * 2, marginLeft: -radius, marginTop: -radius }}
      />
      <div
        className={styles.hub}
        style={{ width: hubRadius * 2, height: hubRadius * 2, marginLeft: -hubRadius + hubShift, marginTop: -hubRadius }}
      />
      <div
        className={styles.disc}
        style={{ width: discRadius * 2, height: discRadius * 2, marginLeft: -discRadius + hubShift, marginTop: -discRadius }}
      >
        <Image src={DISC_SRC} alt="" width={180} height={180} loading="eager" unoptimized />
      </div>
      <div className={styles.caliperOrbit} style={{ left: hubShift, transform: `rotate(${caliperRotation}deg)` }}>
        <div
          className={kind === "front" ? styles.frontCaliper : styles.rearCaliper}
          style={{ marginLeft: discRadius * 0.62 }}
        >
          {kind === "front" ? (
            <>
              <span className={styles.frontPiston} />
              <span className={styles.frontPiston} />
            </>
          ) : <span className={styles.rearPiston} />}
        </div>
      </div>
      {fender !== "无" ? (
        <div
          className={`${styles.fender} ${kind === "front" ? styles.frontFender : styles.rearFender} ${fenderClass}`}
          style={{
            width: fenderRadius * 2,
            height: fenderRadius * 2,
            marginLeft: -fenderRadius,
            marginTop: -fenderRadius,
            transform: `rotate(${fenderRotation}deg)`,
          }}
        >
          <Image
            src={kind === "front" ? FRONT_FENDER_SRC : REAR_FENDER_SRC}
            alt=""
            width={542}
            height={542}
            loading="eager"
            unoptimized
          />
        </div>
      ) : null}
    </div>
  );
}

function Handlebar({
  pivot,
  handle,
  handlebarAngle,
}: Readonly<{ pivot: SourcePoint; handle: SourcePoint; handlebarAngle: number }>) {
  return (
    <div className={styles.handlebar} style={rootStyle(pivot, handle)}>
      <div className={styles.handleStem} />
      <div className={styles.handleEnd} style={{ transform: `rotate(${172 + finite(handlebarAngle)}deg)` }}>
        <div className={styles.mainHandle}>
          <span className={styles.controllerOne} />
          <span className={styles.circleOne} />
          <span className={styles.controllerTwo} />
          <span className={styles.circleTwo} />
        </div>
      </div>
    </div>
  );
}

function FrontFork({
  top,
  style,
  airbag,
  height,
  rotation,
  foreground = false,
}: Readonly<{
  top: SourcePoint;
  style: SimulatorValues["frontForkStyle"];
  airbag: SimulatorValues["frontForkAirbag"];
  height: number;
  rotation: number;
  foreground?: boolean;
}>) {
  const inverted = style === "倒置";
  const bottleSrc = foreground
    ? airbag === "P1" ? FRONT_BOTTLE_P1 : airbag === "P2" ? FRONT_BOTTLE_P2 : null
    : null;

  return (
    <div className={styles.frontFork} style={rootedPartStyle(top, height, rotation)}>
      <div className={styles.forkBody}>
        {!foreground ? <div className={styles.forkCrownSecond} /> : null}
        <div className={styles.forkCrown} />
        {inverted ? (
          <>
            <div className={styles.invertedForkTop} />
            <div className={styles.invertedForkCenter} />
            <div className={styles.invertedForkBottom} />
          </>
        ) : (
          <>
            <div className={styles.normalForkTop} />
            <div className={styles.normalForkCenter} />
            <div className={styles.normalForkBottom} />
          </>
        )}
        {bottleSrc ? (
          <div className={`${styles.frontBottle} ${airbag === "P1" ? styles.frontBottleP1 : styles.frontBottleP2}`}>
            <Image src={bottleSrc} alt="" width={60} height={70} loading="eager" unoptimized />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Swingarm({ pivot, wheel }: Readonly<{ pivot: SourcePoint; wheel: SourcePoint }>) {
  return (
    <div className={styles.swingarm} style={rootStyle(pivot, wheel)}>
      <div className={styles.swingBody}>
        <div className={styles.swingYcm} />
        <div className={styles.swingKd} />
        <div className={styles.swingHl} />
        <div className={styles.swingSketchTop} />
        <div className={styles.swingSketchBottom} />
      </div>
    </div>
  );
}

function RearShock({
  top,
  bottom,
  airbag,
}: Readonly<{
  top: SourcePoint;
  bottom: SourcePoint;
  airbag: SimulatorValues["rearShockAirbag"];
}>) {
  const bottleSrc = airbag === "P1"
    ? REAR_BOTTLE_P1
    : airbag === "P2"
      ? REAR_BOTTLE_P2
      : airbag === "P3"
        ? REAR_BOTTLE_P3
        : null;

  return (
    <div className={styles.rearShock} style={rootStyle(top, bottom)}>
      <div className={styles.shockBody}>
        {bottleSrc ? (
          <div className={`${styles.rearBottle} ${airbag === "P1" ? styles.rearBottleP1 : airbag === "P2" ? styles.rearBottleP2 : styles.rearBottleP3}`}>
            <Image src={bottleSrc} alt="" width={airbag === "P3" ? 70 : 60} height={airbag === "P3" ? 60 : 70} loading="eager" unoptimized />
          </div>
        ) : null}
        <div className={styles.shockTop}>
          <span className={styles.shockTopHole} />
          <span className={styles.shockTopPlane} />
        </div>
        <div className={styles.springStack}>
          {Array.from({ length: 25 }, (_, index) => <span className={styles.springRing} key={index} />)}
        </div>
        <div className={styles.shockBottom}>
          <span className={styles.shockBottomHole}><i /></span>
          <span className={styles.shockBottomPlane} />
        </div>
      </div>
    </div>
  );
}

export default function OriginalMechanicalLayer({
  brand,
  modelName,
  geometry,
  values,
  bodyLineHref,
}: OriginalMechanicalLayerProps) {
  const profile = PROFILES[`${brand}/${modelName}`];
  const sourceScale = positive(profile?.sourceScale, 0);
  if (!profile || !bodyLineHref || sourceScale <= 0) return null;

  const handlePivot = sourcePoint(geometry.handlePivot, sourceScale);
  const handle = sourcePoint(geometry.handle, sourceScale);
  const forkTop = sourcePoint(geometry.forkTop, sourceScale);
  const frontWheel = sourcePoint(geometry.frontWheel, sourceScale);
  const rearWheel = sourcePoint(geometry.rearWheel, sourceScale);
  const swingPivot = sourcePoint(geometry.swingPivot, sourceScale);
  const shockTop = sourcePoint(geometry.shockTop, sourceScale);
  const shockBottom = sourcePoint(geometry.shockBottom, sourceScale);
  const forkHeight = profile.frontFork.height
    + (values.frontForkTravel - profile.defaults.frontForkTravel) * positive(profile.pixelsPerMillimeter, .45);
  const forkRotation = profile.frontFork.angle - values.tripleClampAngle;

  return (
    <div className={styles.layer} aria-hidden="true">
      <div className={styles.sourceCanvas} style={{ transform: `scale(${sourceScale})` }}>
        <div className={styles.rearAssembly}>
          <Swingarm pivot={swingPivot} wheel={rearWheel} />
          <Wheel
            center={rearWheel}
            geometry={geometry.rearWheel}
            profile={profile.rearWheel}
            sourceScale={sourceScale}
            assemblyRotation={verticalAngle(swingPivot, rearWheel)}
            hubOffset={values.rearWheelOffset}
            caliperPosition={values.rearCaliperPosition}
            fender={values.rearFender}
            kind="rear"
          />
        </div>
        <div className={styles.frontWheelAssembly}>
          <FrontFork top={forkTop} style={values.frontForkStyle} airbag={values.frontForkAirbag} height={forkHeight} rotation={forkRotation} />
          <Wheel
            center={frontWheel}
            geometry={geometry.frontWheel}
            profile={profile.frontWheel}
            sourceScale={sourceScale}
            assemblyRotation={forkRotation}
            hubOffset={values.frontWheelOffset}
            caliperPosition={values.frontCaliperPosition}
            fender={values.frontFender}
            kind="front"
          />
        </div>
        <div className={styles.suspensionAssembly}>
          <FrontFork
            top={forkTop}
            style={values.frontForkStyle}
            airbag={values.frontForkAirbag}
            height={forkHeight}
            rotation={forkRotation}
            foreground
          />
          <RearShock top={shockTop} bottom={shockBottom} airbag={values.rearShockAirbag} />
        </div>
        <Image
          className={styles.bodyLine}
          src={bodyLineHref}
          alt=""
          width={900}
          height={675}
          loading="eager"
          unoptimized
        />
        <Handlebar pivot={handlePivot} handle={handle} handlebarAngle={values.handlebarAngle} />
      </div>
    </div>
  );
}
