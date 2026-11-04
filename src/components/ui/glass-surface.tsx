"use client";

import React, { ReactNode, ElementType, useEffect } from "react";
import { useStore } from "@/lib/store";

export function useGlassLite() {
  return typeof navigator !== "undefined" &&
    (((navigator as any).deviceMemory ?? 8) <= 2 || (navigator.hardwareConcurrency ?? 8) <= 4);
}

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
  const lite = useGlassLite();
  const perf = useStore((s: any) => !!s.performanceMode);

  useEffect(() => {
    if (variant === "sheet" || variant === "sheet-action") {
      const prev = parseInt(document.body.dataset.modalOpen || "0", 10);
      document.body.dataset.modalOpen = String(prev + 1);
      return () => {
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
      data-lite={lite ? "true" : "false"}
      data-perf={perf ? "true" : "false"}
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

