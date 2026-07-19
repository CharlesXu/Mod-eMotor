"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { publicPath } from "@/lib/publicPath";
import type { SimulatorValues } from "./ControlSidebar";
import DynamicVehicleLine from "./DynamicVehicleLine";
import OriginalMechanicalLayer from "./OriginalMechanicalLayer";
import { buildComparisonRows, resolveGeometryPair } from "./simulatorDomain";
import {
  alignSimulationGeometry,
  computeSimulationGeometry,
  type GeometryProfile,
} from "./simulationGeometry";

export interface MotorCanvasModel {
  name: string;
  image: string;
  category: string;
}

interface MotorCanvasProps {
  brand: string;
  model: MotorCanvasModel | null;
  values: SimulatorValues;
  defaultValues: SimulatorValues;
  geometryProfiles: Readonly<Record<string, unknown>>;
  lineAssets: Readonly<Record<string, string>>;
  mechanicalProfiles: Readonly<Record<string, unknown>>;
  imageSrc?: string;
}

type ViewMode = "edit" | "compare" | "triangle" | "pose";
type PhotoOpacity = 0 | 0.2 | 0.6;

const VIEW_MODES: ReadonlyArray<{ id: ViewMode; label: string }> = [
  { id: "edit", label: "编辑视角" },
  { id: "compare", label: "原车对比" },
  { id: "triangle", label: "骑行三角" },
  { id: "pose", label: "姿势模拟" },
];

const BLUE = "#718ea7";
const ACCENT = "#3999ce";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function localImageFor(model: MotorCanvasModel, imageSrc?: string): string | null {
  if (model.name.toLowerCase().replaceAll(" ", "") === "kz110") {
    return publicPath("/motomate/Ninebot_Kz110.394b728e.png");
  }

  const source = imageSrc || model.image;
  if (!source) return null;
  const encodeLocalPath = (value: string) => value
    .split("/")
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join("/");
  if (source.startsWith("/motomate/")) return publicPath(encodeLocalPath(source));
  const assetName = source.split("/assets/").at(-1);
  return assetName ? publicPath(encodeLocalPath(`/motomate/${assetName}`)) : source;
}

function signed(value: number, digits = 0): string {
  const rounded = Number(value.toFixed(digits));
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function paintFilter(paint: SimulatorValues["paint"]): string {
  if (paint === "亮黑") return "saturate(.55) brightness(.46) contrast(1.35)";
  if (paint === "哑光") return "saturate(.48) brightness(.78) contrast(.82)";
  return "none";
}

export default function MotorCanvas({ brand, defaultValues, geometryProfiles, imageSrc, lineAssets, mechanicalProfiles, model, values }: MotorCanvasProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [showScale, setShowScale] = useState(true);
  const [showText, setShowText] = useState(true);
  const [photoOpacity, setPhotoOpacity] = useState<PhotoOpacity>(0.2);
  const rawGeometry = useMemo(() => computeSimulationGeometry(values), [values]);
  const modelBaseline = useMemo(() => computeSimulationGeometry(defaultValues), [defaultValues]);
  const vehicleImage = useMemo(() => model ? localImageFor(model, imageSrc) : null, [imageSrc, model]);
  const modelKey = model ? `${brand}/${model.name}` : "";
  const typedGeometryProfiles = geometryProfiles as Readonly<Record<string, GeometryProfile>>;
  const bodyLineHref = lineAssets[modelKey] ? publicPath(lineAssets[modelKey]) : undefined;
  const geometryProfile = typedGeometryProfiles[modelKey];

  if (!model) {
    return (
      <div className="motomate-canvas" style={{ display: "grid", placeItems: "center", minHeight: 300 }}>
        <p style={{ color: "rgba(65,91,117,0.4)", fontSize: 13 }}>请选择车型</p>
      </div>
    );
  }
  const { current: geometry, original: originalGeometry } = useMemo(
    () => resolveGeometryPair(
      rawGeometry,
      modelBaseline,
      geometryProfile,
      alignSimulationGeometry,
    ),
    [geometryProfile, modelBaseline, rawGeometry],
  );

  const vehicleTransform = useMemo(() => {
    const scaleX = clamp(rawGeometry.wheelbase / modelBaseline.wheelbase, 0.91, 1.09);
    const shiftX = clamp((rawGeometry.wheelbase - modelBaseline.wheelbase) / -11, -18, 18);
    const shiftY = clamp((modelBaseline.groundClearance - rawGeometry.groundClearance) * 0.14, -18, 18);
    const tilt = clamp(rawGeometry.tilt - modelBaseline.tilt, -7, 7);
    return `translate(${shiftX}px, ${shiftY}px) scaleX(${scaleX}) rotate(${tilt}deg)`;
  }, [modelBaseline, rawGeometry.groundClearance, rawGeometry.tilt, rawGeometry.wheelbase]);
  const groundY = clamp(
    Math.max(
      geometry.frontWheel.y + geometry.frontWheel.radius,
      geometry.rearWheel.y + geometry.rearWheel.radius,
    ),
    430,
    500,
  );
  const clearancePixels = clamp(geometry.groundClearance * 0.25, 22, 56);
  const clearanceX = (geometry.frontWheel.x + geometry.rearWheel.x) / 2;
  const guideStyle = {
    stroke: BLUE,
    strokeWidth: 1.25,
    strokeDasharray: "5 5",
    fill: "none",
  } as const;

  const comparisonRows = buildComparisonRows(geometry, originalGeometry);

  const cyclePhotoOpacity = () => {
    setPhotoOpacity((current) => (current === 0.2 ? 0.6 : current === 0.6 ? 0 : 0.2));
  };

  return (
    <section
      className="motomate-canvas"
      aria-label={`${brand} ${model.name} 车辆尺寸模拟`}
      style={{
        position: "relative",
        flex: "1 1 auto",
        minWidth: 1022,
        height: "100vh",
        minHeight: 760,
        overflow: "hidden",
        background: "#fff",
        color: "#1d2730",
        fontFamily: 'Arial, "PingFang SC", "Microsoft YaHei", ui-sans-serif, sans-serif',
      }}
    >
      <header className="motomate-canvas-title" style={{ position: "absolute", top: 12, left: 25, zIndex: 5 }}>
        <h1 className="motomate-canvas-heading" style={{ margin: 0, fontSize: 40, lineHeight: 1.2, fontWeight: 700 }}>
          {brand} {model.name}
        </h1>
      </header>

      {viewMode === "compare" && (
        <div
          className="motomate-compare-table"
          style={{
            position: "absolute",
            zIndex: 8,
            top: 76,
            left: 25,
            width: 330,
            overflow: "hidden",
            border: "1px solid #d8e0e6",
            borderRadius: 6,
            background: "rgba(255,255,255,.93)",
            boxShadow: "0 8px 24px rgba(42,65,82,.1)",
            fontSize: 12,
          }}
        >
          <div className="motomate-compare-row motomate-compare-header" style={{ display: "grid", gridTemplateColumns: "1.15fr repeat(3,1fr)", padding: "8px 10px", background: "#eef3f6", color: "#607788", fontWeight: 700 }}>
            <span>尺寸指标</span><span>原车</span><span>当前</span><span>变化</span>
          </div>
          {comparisonRows.map((row) => (
            <div className="motomate-compare-row" key={row.label} style={{ display: "grid", gridTemplateColumns: "1.15fr repeat(3,1fr)", padding: "7px 10px", borderTop: "1px solid #e8edf0", color: "#526572" }}>
              <span>{row.label}</span>
              <span>{row.original}{row.unit}</span>
              <span>{Math.round(row.current)}{row.unit}</span>
              <span style={{ color: Math.abs(row.current - row.original) < 0.1 ? "#87949d" : ACCENT }}>{signed(row.current - row.original)}{row.unit}</span>
            </div>
          ))}
        </div>
      )}

      <div className="motomate-vehicle-stage" style={{ position: "absolute", left: 163, top: 146, width: 727, height: 547 }}>
        <div
          className="motomate-vehicle-image"
          style={{
            position: "absolute",
            zIndex: 1,
            inset: 0,
            transform: vehicleTransform,
            transformOrigin: "50% 82%",
            opacity: photoOpacity,
            display: photoOpacity === 0 || viewMode === "compare" ? "none" : "block",
            transition: "transform 180ms ease, filter 180ms ease, opacity 180ms ease",
            filter: paintFilter(values.paint),
            pointerEvents: "none",
          }}
        >
          {vehicleImage ? (
            <Image src={vehicleImage} alt={`${brand} ${model.name}`} fill priority sizes="727px" style={{ objectFit: "contain" }} unoptimized />
          ) : (
            <div className="motomate-missing-vehicle" role="img" aria-label={`${brand} ${model.name} 暂无车型图`}>
              <span>暂无车型图</span><small>{brand} {model.name}</small>
            </div>
          )}
        </div>

        {viewMode === "compare" && vehicleImage && (
          <div
            className="motomate-compare-outline"
            aria-hidden="true"
            style={{
              position: "absolute",
              zIndex: 3,
              inset: 0,
              display: photoOpacity === 0 ? "none" : "block",
              opacity: photoOpacity,
              transform: "translate(-14px,-10px) scale(.98)",
              transformOrigin: "50% 82%",
              filter: "grayscale(1) sepia(.4) hue-rotate(160deg) saturate(5)",
              pointerEvents: "none",
            }}
          >
            <Image src={vehicleImage} alt="" fill sizes="727px" style={{ objectFit: "contain" }} unoptimized />
          </div>
        )}

        {bodyLineHref ? (
          <OriginalMechanicalLayer
            bodyLineHref={bodyLineHref}
            brand={brand}
            geometry={geometry}
            mechanicalProfiles={mechanicalProfiles}
            modelName={model.name}
            values={values}
          />
        ) : null}

        <svg
          className="motomate-simulation-layer"
          viewBox="0 0 727 547"
          role="img"
          aria-label={`车辆动态几何模拟：轴距 ${Math.round(geometry.wheelbase)} 毫米，座高 ${Math.round(geometry.seatHeight)} 毫米，离地间隙 ${Math.round(geometry.groundClearance)} 毫米，前叉角 ${Math.round(geometry.forkAngle)} 度，后减震角 ${Math.round(geometry.rearShockAngle)} 度`}
          style={{ position: "absolute", zIndex: 4, inset: 0, overflow: "visible", pointerEvents: "none" }}
        >
          {!bodyLineHref ? <DynamicVehicleLine geometry={geometry} values={values} /> : null}

          {showScale && (
            <g className="motomate-scale-guides">
              <line x1={geometry.rearWheel.x} y1={groundY + 23} x2={geometry.frontWheel.x} y2={groundY + 23} {...guideStyle} />
              <line x1={geometry.rearWheel.x} y1={groundY - 2} x2={geometry.rearWheel.x} y2={groundY + 38} {...guideStyle} />
              <line x1={geometry.frontWheel.x} y1={groundY - 2} x2={geometry.frontWheel.x} y2={groundY + 38} {...guideStyle} />
              <path d={`M ${geometry.rearWheel.x} ${groundY + 23} l 12 -5 v 10 z M ${geometry.frontWheel.x} ${groundY + 23} l -12 -5 v 10 z`} fill={BLUE} />
              <line x1={geometry.seat.x + 126} y1={geometry.seat.y} x2={geometry.seat.x + 126} y2={groundY} {...guideStyle} />
              <line x1={geometry.seat.x + 104} y1={geometry.seat.y} x2={geometry.seat.x + 144} y2={geometry.seat.y} {...guideStyle} />
              <line x1={clearanceX} y1={groundY - clearancePixels} x2={clearanceX} y2={groundY} {...guideStyle} />
            </g>
          )}

          {showText && (
            <g className="motomate-measurement-text" fill={BLUE} fontSize="14" fontWeight="500">
              <text x={(geometry.rearWheel.x + geometry.frontWheel.x) / 2 - 54} y={groundY + 48}>轴距 {Math.round(geometry.wheelbase)} mm</text>
              <text x={geometry.seat.x + 151} y={(geometry.seat.y + groundY) / 2} transform={`rotate(90 ${geometry.seat.x + 151} ${(geometry.seat.y + groundY) / 2})`}>座高 {Math.round(geometry.seatHeight)} mm</text>
              <text x={clearanceX + 10} y={groundY - clearancePixels / 2}>离地 {Math.round(geometry.groundClearance)} mm</text>
              <text x={geometry.handle.x + 22} y={geometry.handle.y + 47}>前叉 {Math.round(geometry.forkAngle)}°</text>
              <text x={geometry.rearWheel.x - 10} y={geometry.seat.y + 78}>后减 {Math.round(geometry.rearShockAngle)}°</text>
              <text x={geometry.foot.x + 10} y={geometry.foot.y + 5}>脚踏</text>
              <text x={geometry.seat.x - 25} y={geometry.seat.y - 20}>骑手 {Math.round(values.riderHeight)} cm</text>
            </g>
          )}

          {viewMode === "triangle" && (
            <g className="motomate-riding-triangle">
              <path d={`M ${geometry.handle.x} ${geometry.handle.y} L ${geometry.seat.x} ${geometry.seat.y} L ${geometry.foot.x} ${geometry.foot.y} Z`} fill="rgba(57,153,206,.08)" stroke={ACCENT} strokeWidth="3" strokeDasharray="9 6" strokeLinejoin="round" />
              {[geometry.handle, geometry.seat, geometry.foot].map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="7" fill="#fff" stroke={ACCENT} strokeWidth="4" />)}
              <g fill="#267ba8" fontSize="15" fontWeight="700">
                <text x={geometry.handle.x + 11} y={geometry.handle.y - 10}>{Math.round(geometry.triangleAngles.handle)}°</text>
                <text x={geometry.seat.x - 42} y={geometry.seat.y - 11}>{Math.round(geometry.triangleAngles.seat)}°</text>
                <text x={geometry.foot.x + 10} y={geometry.foot.y + 23}>{Math.round(geometry.triangleAngles.foot)}°</text>
              </g>
            </g>
          )}

          {viewMode === "pose" && (
            <g className="motomate-rider-pose" fill="none" stroke="#488fba" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" opacity=".58">
              <circle cx={geometry.rider.head.x} cy={geometry.rider.head.y} r="27" fill="rgba(72,143,186,.22)" strokeWidth="6" />
              <path d={`M ${geometry.rider.neck.x} ${geometry.rider.neck.y} L ${geometry.rider.shoulder.x} ${geometry.rider.shoulder.y} L ${geometry.rider.elbow.x} ${geometry.rider.elbow.y} L ${geometry.rider.hand.x} ${geometry.rider.hand.y}`} />
              <path d={`M ${geometry.rider.shoulder.x} ${geometry.rider.shoulder.y} L ${geometry.rider.hip.x} ${geometry.rider.hip.y} L ${geometry.rider.knee.x} ${geometry.rider.knee.y} L ${geometry.rider.foot.x} ${geometry.rider.foot.y}`} />
              <circle cx={geometry.rider.hand.x} cy={geometry.rider.hand.y} r="5" fill="#488fba" stroke="none" />
              <circle cx={geometry.rider.hip.x} cy={geometry.rider.hip.y} r="5" fill="#488fba" stroke="none" />
              <circle cx={geometry.rider.foot.x} cy={geometry.rider.foot.y} r="5" fill="#488fba" stroke="none" />
            </g>
          )}
        </svg>
      </div>

      <div className="motomate-view-switcher" role="group" aria-label="视图模式" style={{ position: "absolute", left: "50%", bottom: 24, width: 500, height: 50, display: "grid", gridTemplateColumns: "repeat(4,1fr)", overflow: "hidden", border: "1px solid #dfe5e9", borderRadius: 7, background: "#f7f9fa", transform: "translateX(-50%)", boxShadow: "0 3px 12px rgba(28,49,64,.08)" }}>
        {VIEW_MODES.map((item, index) => {
          const active = viewMode === item.id;
          return <button className={`motomate-view-button motomate-view-button-${item.id}`} key={item.id} type="button" aria-pressed={active} onClick={() => setViewMode(item.id)} style={{ border: 0, borderLeft: index === 0 ? 0 : "1px solid #dfe5e9", background: active ? "#455b6d" : "transparent", color: active ? "#fff" : "#556673", fontSize: 14, cursor: "pointer" }}>{item.label}</button>;
        })}
      </div>

      <div className="motomate-display-switcher" role="group" aria-label="图层与标注显示" style={{ position: "absolute", right: 24, bottom: 24, width: 260, height: 50, display: "grid", gridTemplateColumns: "1.25fr 1fr 1fr", overflow: "hidden", border: "1px solid #dfe5e9", borderRadius: 7, background: "#f7f9fa" }}>
        <button className="motomate-display-button motomate-photo-button" type="button" aria-label={`原车图透明度 ${Math.round(photoOpacity * 100)}%`} aria-pressed={photoOpacity > 0} onClick={cyclePhotoOpacity} style={{ border: 0, background: photoOpacity > 0 ? "#455b6d" : "transparent", color: photoOpacity > 0 ? "#fff" : "#556673", fontSize: 13, cursor: "pointer" }}>原车图 {Math.round(photoOpacity * 100)}%</button>
        <button className="motomate-display-button motomate-scale-button" type="button" aria-pressed={showScale} onClick={() => setShowScale((current) => !current)} style={{ border: 0, borderLeft: "1px solid #dfe5e9", background: showScale ? "#455b6d" : "transparent", color: showScale ? "#fff" : "#556673", fontSize: 14, cursor: "pointer" }}>刻度</button>
        <button className="motomate-display-button motomate-text-button" type="button" aria-pressed={showText} onClick={() => setShowText((current) => !current)} style={{ border: 0, borderLeft: "1px solid #dfe5e9", background: showText ? "#455b6d" : "transparent", color: showText ? "#fff" : "#556673", fontSize: 14, cursor: "pointer" }}>文本</button>
      </div>
    </section>
  );
}
