"use client";

import { useEffect, useRef, useState } from "react";

type Panel = "accessories" | "credits";

const accessoryGroups = [
  { title: "加装与外观", items: "尾箱、风挡、原厂 / 亮黑 / 哑光涂装" },
  { title: "前部机械", items: "车把、三星柱、前减震、前轮毂与轮胎、前制动与挡泥瓦" },
  { title: "后部机械", items: "后平叉、后减震、后轮毂与轮胎、后制动与挡泥瓦" },
  { title: "人机姿态", items: "坐垫、脚踏、骑手身高与标准 / 运动 / 舒适坐姿" },
] as const;

export default function InfoToolbar() {
  const [activePanel, setActivePanel] = useState<Panel | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (activePanel && !dialog.open) dialog.showModal();
    if (!activePanel && dialog.open) dialog.close();
  }, [activePanel]);

  const close = () => {
    dialogRef.current?.close();
    setActivePanel(null);
  };

  return (
    <>
      <nav className="motomate-info-toolbar" aria-label="项目信息">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={activePanel === "accessories"}
          onClick={() => setActivePanel("accessories")}
        >
          配件
        </button>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={activePanel === "credits"}
          onClick={() => setActivePanel("credits")}
        >
          鸣谢
        </button>
      </nav>

      <dialog
        className="motomate-info-dialog"
        ref={dialogRef}
        aria-labelledby="motomate-info-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => setActivePanel(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="motomate-info-dialog-card">
          <header>
            <h2 id="motomate-info-dialog-title">
              {activePanel === "credits" ? "鸣谢" : "已支持的配件与机械分类"}
            </h2>
            <button type="button" aria-label="关闭对话框" onClick={close}>×</button>
          </header>

          {activePanel === "credits" ? (
            <div className="motomate-credit-list">
              <article>
                <strong>1. SenZQ</strong>
                <p>SenZQ 的电鸡模拟器网站是本项目的重要参考与车型资源来源，感谢其原创工作与资源积累。</p>
              </article>
              <article>
                <strong>2. 车型与品牌资料贡献者</strong>
                <p>感谢公开车型参数、图片和校准资料的作者与各品牌权利人。</p>
              </article>
              <a
                href="https://github.com/CharlesXu/Mod-eMotor/blob/main/THIRD_PARTY_NOTICES.md"
                rel="noreferrer"
                target="_blank"
              >
                查看第三方资源说明
              </a>
            </div>
          ) : (
            <div className="motomate-accessory-list">
              <p>以下为模拟器当前可调整或显示的项目，不提供第三方资源下载。</p>
              <dl>
                {accessoryGroups.map((group) => (
                  <div key={group.title}>
                    <dt>{group.title}</dt>
                    <dd>{group.items}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
