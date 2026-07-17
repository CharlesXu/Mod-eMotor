# 全车型初始参数一致性规格

## 范围

- 参考站：SenZQ 电鸡模拟器 PC 站 `http://motomate.cn:58183/tools/PC/#/`
- 核对对象：参考站 `motor_list` 的全部 114 个车型，覆盖 10 个品牌
- 本次只同步车型载入后侧栏实际显示的原车初始值；角度调整量、偏距、配件、涂装和坐姿等本地扩展字段继续以 `0` 或既有默认值起步

## 原站初始化规则

参考站的车型载入逻辑以 `proportion.millimeter / proportion.pixel` 将像素尺寸换算为毫米：

| 本项目字段 | 参考站来源/公式 |
| --- | --- |
| `handlebarHeight` | `parseInt(motor_hander_location.height * mm / px)` |
| `handlebarAngle` | `realNum__hander_angle_set`，初始为 `0` |
| `tripleClampAngle` | `realNum__sxz_angle_set`，初始为 `0` |
| `frontForkTravel` | `parseInt(motor_front_suspension_reality)` |
| `frontWheelPosition` | `motor_front_wheel_location.left`：`-29px` 前位、`-13px` 中位、`3px` 后位 |
| 前轮胎/轮毂 | `motor_front_wheel_model`、`motor_front_hub_model` |
| `frontBrakeDiscDiameter` | `round(motor_front_disc_size.height / 0.9 * mm / px)` |
| `swingarmLength` | `round(motor_second_body_location.height * mm / px)` |
| `rearShockTravel` | `parseInt(motor_back_suspension_reality)` |
| 后轮胎/轮毂 | `motor_back_wheel_model`、`motor_back_hub_model` |
| `rearBrakeDiscDiameter` | `round(motor_back_disc_size.height / 0.9 * mm / px)` |

## 审计发现

- 参考站有 114 个车型，本地有 113 个车型；本地缺少 `YADEA/白鲨 II`。
- 现有 113 个车型中：车把高度 103 处不一致、前轮安装位 15 处、前刹车盘 28 处、后平叉长度 107 处、后减震行程 1 处、后刹车盘 31 处。
- 轮胎宽度、扁平比、轮毂直径和前减震行程在现有车型中一致。
- 原站角度控件显示相对调整量，不能用车型绝对 CSS 角度覆盖本地的 `0` 初始值。
- 原站后平叉初始值范围为 214–558 mm；本项目原有 280 mm 下限会把 11 个车型静默截断，必须将边界和几何层同步放宽。

## 验收标准

1. 本地目录、机械参数和几何基准均覆盖 114 个车型，三者键集合一致。
2. 上表可映射字段与参考站逐车型一致。
3. 车型载入后不因数值边界再次改变初始值。
4. 自动化测试至少覆盖 ZEEKU、ZEEHO、ninebot、NIU、Honda、YADEA、TAILG、SYUAN、skymotor、OTHER 各一个车型。
5. 角度调整量仍以 0 起步，修改后仅产生相对几何变化。
