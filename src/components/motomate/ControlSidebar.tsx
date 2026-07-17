"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import { publicPath } from "@/lib/publicPath";
import {
  NUMERIC_CONSTRAINTS,
  clampNumericValue,
  clampNumericValues,
  type NumericSimulatorKey,
} from "./simulatorDomain";

export type SimulatorValues = {
  handlebarHeight: number;
  handlebarAngle: number;
  tripleClampAngle: number;
  tripleClampDrop: number;
  frontForkTravel: number;
  frontWheelPosition: "前位" | "中位" | "后位";
  frontForkStyle: "正常" | "倒置";
  frontForkAirbag: "无" | "P1" | "P2";
  frontTireWidth: number;
  frontTireRatio: number;
  frontWheelDiameter: number;
  frontWheelOffset: number;
  frontBrakeDiscDiameter: number;
  frontCaliperPosition: "前置" | "后置";
  frontFender: "无" | "短" | "长";
  swingarmLength: number;
  rearShockTravel: number;
  rearShockAngle: number;
  rearShockAirbag: "无" | "P1" | "P2" | "P3";
  rearTireWidth: number;
  rearTireRatio: number;
  rearWheelDiameter: number;
  rearWheelOffset: number;
  rearBrakeDiscDiameter: number;
  rearCaliperPosition: "前置" | "后置";
  rearFender: "无" | "短" | "长";
  accessory: "无" | "尾箱" | "风挡";
  paint: "原厂" | "亮黑" | "哑光";
  seatHeight: number;
  seatOffset: number;
  footrestOffset: number;
  riderHeight: number;
  posture: "标准" | "运动" | "舒适";
};

type ControlSidebarProps = {
  values: SimulatorValues;
  defaultValues: SimulatorValues;
  onChange: (nextValues: SimulatorValues) => void;
  onBack: () => void;
  onSave: () => void;
};

type SectionId =
  | "handlebar"
  | "frontSuspension"
  | "frontWheel"
  | "frontBrake"
  | "rearSuspension"
  | "rearWheel"
  | "rearBrake"
  | "accessories"
  | "posture";

const sections: ReadonlyArray<{
  id: SectionId;
  title: string;
  shortLabel: string;
  icon: string;
}> = [
  { id: "handlebar", title: "车把 & 龙头", shortLabel: "车把", icon: "/motomate/direct.62cc6def.png" },
  { id: "frontSuspension", title: "三星柱 & 前减震", shortLabel: "前轮", icon: "/motomate/suspension.12dcc26c.png" },
  { id: "frontWheel", title: "(前轮) 轮毂 & 轮胎", shortLabel: "前胎", icon: "/motomate/tyre.5c74b885.png" },
  { id: "frontBrake", title: "(前轮) 制动 & 挡泥瓦", shortLabel: "前刹", icon: "/motomate/brake.1dfa4137.png" },
  { id: "rearSuspension", title: "后平叉 & 后减震", shortLabel: "后轮", icon: "/motomate/suspension.12dcc26c.png" },
  { id: "rearWheel", title: "(后轮) 轮毂 & 轮胎", shortLabel: "后胎", icon: "/motomate/tyre.5c74b885.png" },
  { id: "rearBrake", title: "(后轮) 制动 & 挡泥瓦", shortLabel: "后刹", icon: "/motomate/brake.1dfa4137.png" },
  { id: "accessories", title: "加装 & 涂装", shortLabel: "加装", icon: "/motomate/install.45862da6.png" },
  { id: "posture", title: "坐姿调整", shortLabel: "坐姿", icon: "/motomate/pose.51212ff4.png" },
];

type NumberRowProps = {
  constraintKey: NumericSimulatorKey;
  label: string;
  value: number;
  onChange: (value: number) => void;
};

function NumberRow({ constraintKey, label, value, onChange }: NumberRowProps) {
  const { min, max, step } = NUMERIC_CONSTRAINTS[constraintKey];
  return (
    <div className="motomate-number-row">
      <label className="motomate-number-label">
        {label}
        <span className="motomate-number-colon">:</span>
      </label>
      <div className="motomate-number-control">
        <button
          className="motomate-number-step motomate-number-step-minus"
          type="button"
          aria-label={`${label}减小`}
          onClick={() => onChange(clampNumericValue(constraintKey, value - step, value))}
        >
          −
        </button>
        <input
          className="motomate-number-input"
          type="number"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const next = event.currentTarget.valueAsNumber;
            if (Number.isFinite(next)) {
              onChange(clampNumericValue(constraintKey, next, value));
            }
          }}
        />
        <button
          className="motomate-number-step motomate-number-step-plus"
          type="button"
          aria-label={`${label}增大`}
          onClick={() => onChange(clampNumericValue(constraintKey, value + step, value))}
        >
          +
        </button>
      </div>
    </div>
  );
}

type ChoiceRowProps<Option extends string> = {
  label: string;
  value: Option;
  options: readonly Option[];
  onChange: (value: Option) => void;
};

function ChoiceRow<Option extends string>({ label, value, options, onChange }: ChoiceRowProps<Option>) {
  return (
    <div className="motomate-choice-row">
      <span className="motomate-choice-label">
        {label}
        <span className="motomate-choice-colon">:</span>
      </span>
      <div className="motomate-choice-group" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            className={`motomate-choice${value === option ? " motomate-choice-selected" : ""}`}
            type="button"
            role="radio"
            aria-checked={value === option}
            key={option}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ControlSidebar({ values, defaultValues, onChange, onBack, onSave }: ControlSidebarProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("handlebar");
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement>>>({});

  const update = <Key extends keyof SimulatorValues>(key: Key, value: SimulatorValues[Key]) => {
    onChange({ ...values, [key]: value });
  };

  const numeric = (key: NumericSimulatorKey) => (value: number) => {
    update(key, clampNumericValue(key, value, values[key]));
  };

  const resetSection = (id: SectionId) => {
    const sectionDefaults: Partial<SimulatorValues> = (() => {
      switch (id) {
        case "handlebar":
          return {
            handlebarHeight: defaultValues.handlebarHeight,
            handlebarAngle: defaultValues.handlebarAngle,
          };
        case "frontSuspension":
          return {
            tripleClampAngle: defaultValues.tripleClampAngle,
            tripleClampDrop: defaultValues.tripleClampDrop,
            frontForkTravel: defaultValues.frontForkTravel,
            frontWheelPosition: defaultValues.frontWheelPosition,
            frontForkStyle: defaultValues.frontForkStyle,
            frontForkAirbag: defaultValues.frontForkAirbag,
          };
        case "frontWheel":
          return {
            frontTireWidth: defaultValues.frontTireWidth,
            frontTireRatio: defaultValues.frontTireRatio,
            frontWheelDiameter: defaultValues.frontWheelDiameter,
            frontWheelOffset: defaultValues.frontWheelOffset,
          };
        case "frontBrake":
          return {
            frontBrakeDiscDiameter: defaultValues.frontBrakeDiscDiameter,
            frontCaliperPosition: defaultValues.frontCaliperPosition,
            frontFender: defaultValues.frontFender,
          };
        case "rearSuspension":
          return {
            swingarmLength: defaultValues.swingarmLength,
            rearShockTravel: defaultValues.rearShockTravel,
            rearShockAngle: defaultValues.rearShockAngle,
            rearShockAirbag: defaultValues.rearShockAirbag,
          };
        case "rearWheel":
          return {
            rearTireWidth: defaultValues.rearTireWidth,
            rearTireRatio: defaultValues.rearTireRatio,
            rearWheelDiameter: defaultValues.rearWheelDiameter,
            rearWheelOffset: defaultValues.rearWheelOffset,
          };
        case "rearBrake":
          return {
            rearBrakeDiscDiameter: defaultValues.rearBrakeDiscDiameter,
            rearCaliperPosition: defaultValues.rearCaliperPosition,
            rearFender: defaultValues.rearFender,
          };
        case "accessories":
          return {
            accessory: defaultValues.accessory,
            paint: defaultValues.paint,
          };
        case "posture":
          return {
            seatHeight: defaultValues.seatHeight,
            seatOffset: defaultValues.seatOffset,
            footrestOffset: defaultValues.footrestOffset,
            riderHeight: defaultValues.riderHeight,
            posture: defaultValues.posture,
          };
      }
    })();

    const nextValues = { ...values, ...sectionDefaults };
    onChange(clampNumericValues(nextValues, nextValues));
  };

  const scrollToSection = (id: SectionId) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const section = (id: SectionId, children: React.ReactNode) => {
    const definition = sections.find((item) => item.id === id);
    if (!definition) return null;

    return (
      <section
        className="motomate-control-section"
        id={`motomate-section-${id}`}
        key={id}
        ref={(node) => {
          if (node) sectionRefs.current[id] = node;
        }}
      >
        <div className="motomate-section-heading">
          <h2 className="motomate-section-title">{definition.title}</h2>
          <button
            className="motomate-section-reset"
            type="button"
            aria-label={`重置${definition.title}`}
            title="重置当前组"
            onClick={() => resetSection(id)}
          >
            ↻
          </button>
        </div>
        <div className="motomate-section-body">{children}</div>
      </section>
    );
  };

  return (
    <aside className="motomate-control-sidebar">
      <nav className="motomate-icon-rail" aria-label="车辆参数分类">
        <div className="motomate-rail-scroll">
          {sections.map((item) => (
            <button
              className={`motomate-rail-item${activeSection === item.id ? " motomate-rail-item-active" : ""}`}
              type="button"
              title={item.title}
              aria-label={item.title}
              aria-current={activeSection === item.id ? "true" : undefined}
              key={item.id}
              onClick={() => scrollToSection(item.id)}
            >
              <span className="motomate-rail-label">{item.shortLabel}</span>
              <Image className="motomate-rail-icon" src={publicPath(item.icon)} alt="" height={38} width={38} unoptimized />
            </button>
          ))}
        </div>
        <button className="motomate-rail-save" type="button" aria-label="保存" title="保存" onClick={onSave}>
          <Image src={publicPath("/motomate/save.2ad46c25.png")} alt="" height={32} width={32} unoptimized />
        </button>
        <button className="motomate-rail-back" type="button" aria-label="返回车型选择" title="返回" onClick={onBack}>
          <Image src={publicPath("/motomate/back.4a05c013.png")} alt="" height={32} width={32} unoptimized />
        </button>
      </nav>

      <div className="motomate-inspector">
        <div className="motomate-inspector-content">
          {section(
            "handlebar",
            <>
              <NumberRow constraintKey="handlebarHeight" label="车把高度" value={values.handlebarHeight} onChange={numeric("handlebarHeight")} />
              <NumberRow constraintKey="handlebarAngle" label="车把角度" value={values.handlebarAngle} onChange={numeric("handlebarAngle")} />
            </>,
          )}

          {section(
            "frontSuspension",
            <>
              <NumberRow constraintKey="tripleClampAngle" label="三星柱角度" value={values.tripleClampAngle} onChange={numeric("tripleClampAngle")} />
              <NumberRow constraintKey="tripleClampDrop" label="三星柱下沉量" value={values.tripleClampDrop} onChange={numeric("tripleClampDrop")} />
              <NumberRow constraintKey="frontForkTravel" label="减震孔距 / 行程" value={values.frontForkTravel} onChange={numeric("frontForkTravel")} />
              <ChoiceRow label="前轮安装位置" value={values.frontWheelPosition} options={["前位", "中位", "后位"]} onChange={(value) => update("frontWheelPosition", value)} />
              <ChoiceRow label="前减样式 | 形态" value={values.frontForkStyle} options={["正常", "倒置"]} onChange={(value) => update("frontForkStyle", value)} />
              <ChoiceRow label="前减样式 | 气瓶" value={values.frontForkAirbag} options={["无", "P1", "P2"]} onChange={(value) => update("frontForkAirbag", value)} />
            </>,
          )}

          {section(
            "frontWheel",
            <>
              <NumberRow constraintKey="frontTireWidth" label="轮胎-宽度" value={values.frontTireWidth} onChange={numeric("frontTireWidth")} />
              <NumberRow constraintKey="frontTireRatio" label="轮胎-扁平比" value={values.frontTireRatio} onChange={numeric("frontTireRatio")} />
              <NumberRow constraintKey="frontWheelDiameter" label="轮毂-直径" value={values.frontWheelDiameter} onChange={numeric("frontWheelDiameter")} />
              <NumberRow constraintKey="frontWheelOffset" label="轮毂-偏距" value={values.frontWheelOffset} onChange={numeric("frontWheelOffset")} />
            </>,
          )}

          {section(
            "frontBrake",
            <>
              <NumberRow constraintKey="frontBrakeDiscDiameter" label="刹车盘直径" value={values.frontBrakeDiscDiameter} onChange={numeric("frontBrakeDiscDiameter")} />
              <ChoiceRow label="卡钳安装位置" value={values.frontCaliperPosition} options={["前置", "后置"]} onChange={(value) => update("frontCaliperPosition", value)} />
              <ChoiceRow label="挡泥瓦" value={values.frontFender} options={["无", "短", "长"]} onChange={(value) => update("frontFender", value)} />
            </>,
          )}

          {section(
            "rearSuspension",
            <>
              <NumberRow constraintKey="swingarmLength" label="后平叉长度" value={values.swingarmLength} onChange={numeric("swingarmLength")} />
              <NumberRow constraintKey="rearShockTravel" label="后减震行程" value={values.rearShockTravel} onChange={numeric("rearShockTravel")} />
              <NumberRow constraintKey="rearShockAngle" label="后减震角度" value={values.rearShockAngle} onChange={numeric("rearShockAngle")} />
              <ChoiceRow label="后减气瓶" value={values.rearShockAirbag} options={["无", "P1", "P2", "P3"]} onChange={(value) => update("rearShockAirbag", value)} />
            </>,
          )}

          {section(
            "rearWheel",
            <>
              <NumberRow constraintKey="rearTireWidth" label="轮胎-宽度" value={values.rearTireWidth} onChange={numeric("rearTireWidth")} />
              <NumberRow constraintKey="rearTireRatio" label="轮胎-扁平比" value={values.rearTireRatio} onChange={numeric("rearTireRatio")} />
              <NumberRow constraintKey="rearWheelDiameter" label="轮毂-直径" value={values.rearWheelDiameter} onChange={numeric("rearWheelDiameter")} />
              <NumberRow constraintKey="rearWheelOffset" label="轮毂-偏距" value={values.rearWheelOffset} onChange={numeric("rearWheelOffset")} />
            </>,
          )}

          {section(
            "rearBrake",
            <>
              <NumberRow constraintKey="rearBrakeDiscDiameter" label="刹车盘直径" value={values.rearBrakeDiscDiameter} onChange={numeric("rearBrakeDiscDiameter")} />
              <ChoiceRow label="卡钳安装位置" value={values.rearCaliperPosition} options={["前置", "后置"]} onChange={(value) => update("rearCaliperPosition", value)} />
              <ChoiceRow label="挡泥瓦" value={values.rearFender} options={["无", "短", "长"]} onChange={(value) => update("rearFender", value)} />
            </>,
          )}

          {section(
            "accessories",
            <>
              <ChoiceRow label="加装配件" value={values.accessory} options={["无", "尾箱", "风挡"]} onChange={(value) => update("accessory", value)} />
              <ChoiceRow label="车身涂装" value={values.paint} options={["原厂", "亮黑", "哑光"]} onChange={(value) => update("paint", value)} />
            </>,
          )}

          {section(
            "posture",
            <>
              <NumberRow constraintKey="seatHeight" label="坐垫高度" value={values.seatHeight} onChange={numeric("seatHeight")} />
              <NumberRow constraintKey="seatOffset" label="坐垫前后" value={values.seatOffset} onChange={numeric("seatOffset")} />
              <NumberRow constraintKey="footrestOffset" label="脚踏前后" value={values.footrestOffset} onChange={numeric("footrestOffset")} />
              <NumberRow constraintKey="riderHeight" label="身高调整 (cm)" value={values.riderHeight} onChange={numeric("riderHeight")} />
              <ChoiceRow label="坐姿模式" value={values.posture} options={["标准", "运动", "舒适"]} onChange={(value) => update("posture", value)} />
            </>,
          )}
        </div>
      </div>
    </aside>
  );
}
