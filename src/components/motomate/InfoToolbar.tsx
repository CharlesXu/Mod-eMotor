"use client";

import { useEffect, useId, useRef, useState } from "react";

import AccessoryLibrary from "./AccessoryLibrary";

type Panel = "accessories" | "credits";

export default function InfoToolbar() {
  const [activePanel, setActivePanel] = useState<Panel | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!activePanel) return;

    const body = document.body;
    const scrollY = window.scrollY;
    const previousBodyStyles = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    const previouslyFocused = document.activeElement;
    const focusFrame = window.requestAnimationFrame(() => overlayRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePanel(null);
        return;
      }
      if (event.key !== "Tab") return;

      const overlay = overlayRef.current;
      const focusable = overlay
        ? Array.from(overlay.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ))
        : [];
      if (!overlay || focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const focused = document.activeElement;
      if (!overlay.contains(focused)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (focused === first || focused === overlay)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && focused === last) {
        event.preventDefault();
        first.focus();
      }
    };

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      body.style.overflow = previousBodyStyles.overflow;
      body.style.position = previousBodyStyles.position;
      body.style.top = previousBodyStyles.top;
      body.style.width = previousBodyStyles.width;
      document.removeEventListener("keydown", onKeyDown);
      window.scrollTo(0, scrollY);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [activePanel]);

  const close = () => setActivePanel(null);

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

      {activePanel ? (
        <div
          className="motomate-info-overlay"
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          {activePanel === "accessories" ? (
            <>
              <h2
                className="motomate-visually-hidden"
                id={titleId}
              >
                已支持的配件与机械分类
              </h2>
              <div className="motomate-accessory-overlay-panel">
                <AccessoryLibrary onClose={close} />
              </div>
            </>
          ) : (
            <div
              className="motomate-info-dialog-card"
            >
              <header>
                <h2 id={titleId}>鸣谢</h2>
                <button type="button" aria-label="关闭对话框" onClick={close}>×</button>
              </header>
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
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
