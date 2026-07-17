import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import {
  alignSimulationGeometry,
  computeSimulationGeometry,
} from "../src/components/motomate/simulationGeometry.ts";
import {
  NUMERIC_CONSTRAINTS,
  buildComparisonRows,
  clampNumericValues,
  clampNumericValue,
  resolveGeometryPair,
} from "../src/components/motomate/simulatorDomain.ts";

const require = createRequire(import.meta.url);
const catalog = require("../src/data/motomate-catalog.json");
const geometryProfiles = require("../src/data/motomate-geometry-profiles.json");
const mechanicalProfiles = require("../src/data/motomate-mechanical-profiles.json");
const referenceInitialValues = require("./fixtures/motomate-reference-initial-values.json");

const BASE_DEFAULTS = {
  handlebarHeight: 97,
  handlebarAngle: 0,
  tripleClampAngle: 0,
  tripleClampDrop: 0,
  frontForkTravel: 425,
  frontWheelPosition: "中位",
  frontForkStyle: "正常",
  frontForkAirbag: "无",
  frontTireWidth: 90,
  frontTireRatio: 80,
  frontWheelDiameter: 14,
  frontWheelOffset: 0,
  frontBrakeDiscDiameter: 220,
  frontCaliperPosition: "前置",
  frontFender: "长",
  swingarmLength: 440,
  rearShockTravel: 260,
  rearShockAngle: 0,
  rearShockAirbag: "无",
  rearTireWidth: 90,
  rearTireRatio: 90,
  rearWheelDiameter: 14,
  rearWheelOffset: 0,
  rearBrakeDiscDiameter: 180,
  rearCaliperPosition: "后置",
  rearFender: "长",
  accessory: "无",
  paint: "原厂",
  seatHeight: 794,
  seatOffset: 0,
  footrestOffset: 0,
  riderHeight: 170,
  posture: "标准",
};

test("defines one numeric constraint for every simulator number", () => {
  assert.deepEqual(Object.keys(NUMERIC_CONSTRAINTS).sort(), [
    "footrestOffset",
    "frontBrakeDiscDiameter",
    "frontForkTravel",
    "frontTireRatio",
    "frontTireWidth",
    "frontWheelDiameter",
    "frontWheelOffset",
    "handlebarAngle",
    "handlebarHeight",
    "rearBrakeDiscDiameter",
    "rearShockAngle",
    "rearShockTravel",
    "rearTireRatio",
    "rearTireWidth",
    "rearWheelDiameter",
    "rearWheelOffset",
    "riderHeight",
    "seatHeight",
    "seatOffset",
    "swingarmLength",
    "tripleClampAngle",
    "tripleClampDrop",
  ]);
  assert.deepEqual(NUMERIC_CONSTRAINTS.frontForkTravel, { min: 240, max: 700, step: 1 });
  assert.deepEqual(NUMERIC_CONSTRAINTS.rearShockAngle, { min: -45, max: 45, step: 1 });
  assert.deepEqual(NUMERIC_CONSTRAINTS.swingarmLength, { min: 200, max: 700, step: 1 });
});

test("covers every reference model with matching catalog and profile keys", () => {
  const catalogKeys = catalog.flatMap((brand) =>
    brand.models.map((model) => `${brand.brand}/${model.name}`),
  ).sort();
  const referenceKeys = Object.keys(referenceInitialValues).sort();

  assert.equal(referenceKeys.length, 114);
  assert.deepEqual(catalogKeys, referenceKeys);
  assert.deepEqual(Object.keys(mechanicalProfiles).sort(), referenceKeys);
  assert.deepEqual(Object.keys(geometryProfiles).sort(), referenceKeys);
});

test("matches the audited initial values for all 114 reference models", () => {
  for (const [key, expected] of Object.entries(referenceInitialValues)) {
    const defaults = mechanicalProfiles[key]?.defaults;
    assert.ok(defaults, `${key} must have mechanical defaults`);

    for (const [field, value] of Object.entries(expected)) {
      assert.equal(defaults[field], value, `${key} ${field} must match the reference site`);
      const constraint = NUMERIC_CONSTRAINTS[field];
      if (constraint) {
        assert.ok(value >= constraint.min, `${key} ${field} must not be clipped below its minimum`);
        assert.ok(value <= constraint.max, `${key} ${field} must not be clipped above its maximum`);
      }
    }
  }
});

test("clamps numeric state writes and falls back for invalid values", () => {
  assert.equal(clampNumericValue("handlebarHeight", 19, 97), 20);
  assert.equal(clampNumericValue("handlebarHeight", 301, 97), 300);
  assert.equal(clampNumericValue("handlebarHeight", 123, 97), 123);
  assert.equal(clampNumericValue("handlebarHeight", Number.NaN, 97), 97);
  assert.equal(clampNumericValue("handlebarHeight", Number.POSITIVE_INFINITY, 301), 300);
});

test("sanitizes loaded numeric values through the shared constraints", () => {
  const fallbacks = Object.fromEntries(
    Object.keys(NUMERIC_CONSTRAINTS).map((key) => [key, NUMERIC_CONSTRAINTS[key].min]),
  );
  const candidate = {
    ...fallbacks,
    handlebarHeight: 999,
    rearShockAngle: Number.NaN,
    riderHeight: 139,
    posture: "标准",
  };
  const result = clampNumericValues(candidate, { ...fallbacks, rearShockAngle: 7, posture: "标准" });

  assert.equal(result.handlebarHeight, 300);
  assert.equal(result.rearShockAngle, 7);
  assert.equal(result.riderHeight, 140);
  assert.equal(result.posture, "标准");
});

test("uses the selected model baseline for all comparison rows", () => {
  const original = {
    wheelbase: 1300,
    seatHeight: 810,
    groundClearance: 170,
    forkAngle: 62,
    rearShockAngle: 68,
  };

  assert.deepEqual(
    buildComparisonRows(original, original).map((row) => row.current - row.original),
    [0, 0, 0, 0, 0],
  );

  const current = { ...original, wheelbase: 1335, seatHeight: 825 };
  const rows = buildComparisonRows(current, original);
  assert.deepEqual(rows[0], { label: "轴距", original: 1300, current: 1335, unit: "mm" });
  assert.deepEqual(rows[1], { label: "座高", original: 810, current: 825, unit: "mm" });
});

test("aligns current and original geometry through the same model profile", () => {
  const current = { wheelbase: 1335 };
  const original = { wheelbase: 1300 };
  const profile = { id: "selected-model" };
  const calls = [];
  const align = (subject, baseline, selectedProfile) => {
    calls.push({ subject, baseline, selectedProfile });
    return { wheelbase: subject.wheelbase + 10 };
  };

  assert.deepEqual(resolveGeometryPair(current, original, profile, align), {
    current: { wheelbase: 1345 },
    original: { wheelbase: 1310 },
  });
  assert.deepEqual(calls, [
    { subject: current, baseline: original, selectedProfile: profile },
    { subject: original, baseline: original, selectedProfile: profile },
  ]);
  assert.deepEqual(resolveGeometryPair(current, original, undefined, align), {
    current,
    original,
  });
});

test("switches comparison baselines across all ten brands and stays at zero on each model default", () => {
  const cases = [
    ["ZEEKU", "EX85 pro"],
    ["ZEEHO", "AE5i"],
    ["ninebot", "Kz110"],
    ["NIU", "NXT 2"],
    ["Honda", "Zoomer e"],
    ["YADEA", "白鲨 II"],
    ["TAILG", "F1"],
    ["SYUAN", "535t"],
    ["skymotor", "Y3 95c"],
    ["OTHER", "YAMAHA Cygnus"],
  ];

  const baselines = cases.map(([brand, model]) => {
    const key = `${brand}/${model}`;
    const catalogBrand = catalog.find((item) => item.brand === brand);
    assert.ok(catalogBrand?.models.some((item) => item.name === model), `${key} must exist in the catalog`);
    assert.ok(mechanicalProfiles[key], `${key} must have defaults`);
    assert.ok(geometryProfiles[key], `${key} must have a geometry profile`);

    const defaults = { ...BASE_DEFAULTS, ...mechanicalProfiles[key].defaults };
    const rawDefault = computeSimulationGeometry(defaults);
    const pair = resolveGeometryPair(
      rawDefault,
      rawDefault,
      geometryProfiles[key],
      alignSimulationGeometry,
    );
    const rows = buildComparisonRows(pair.current, pair.original);
    assert.deepEqual(rows.map((row) => row.current - row.original), [0, 0, 0, 0, 0]);
    return rows.map((row) => row.original).join("/");
  });

  assert.equal(new Set(baselines).size, cases.length, "each selected model must use a different baseline");
});
