"use client";

import React, { ReactNode, ElementType, useEffect } from "react";
import { markAnimationWindow } from "@/lib/frame-sampler";

type Props = {
  variant: "sheet" | "sheet-action" | "bar-top";
  as?: ElementType;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
  [key: string]: any;
};

export function GlassSurface({
  variant,
  as: Tag = "div",
  className = "",
  style,
  children,
  ...rest
}: Props) {
  useEffect(() => {
    if (variant === "sheet" || variant === "sheet-action") {
      markAnimationWindow(450);
      const prev = parseInt(document.body.dataset.modalOpen || "0", 10);
      document.body.dataset.modalOpen = String(prev + 1);
      return () => {
        markAnimationWindow(450);
        const cur = parseInt(document.body.dataset.modalOpen || "1", 10) - 1;
        if (cur <= 0) {
          delete document.body.dataset.modalOpen;
        } else {
          document.body.dataset.modalOpen = String(cur);
        }
      };
    }
  }, [variant]);

  return (
    <Tag
      className={`glass glass--${variant} ${className}`}
      style={style}
      {...rest}
    >
      <div className="glass-layers" aria-hidden="true">
        <i className="g1" />
        <i className="g2" />
        <i className="g3" />
        <i className="tint" />
        <i className="rim" />
      </div>
      <div className="glass-content">{children}</div>
    </Tag>
  );
}
