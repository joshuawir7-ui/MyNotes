import React from "react";
import { DANCING_SCRIPT_BASE64 } from "@/lib/dancing-font";

export default function Loading() {
  return (
    <div className="relative w-full min-h-[60vh] flex items-center justify-center py-12 px-4 select-none">
      <style>{`
        @font-face {
          font-family: 'DancingScriptEmbedded';
          src: url('${DANCING_SCRIPT_BASE64}') format('truetype');
          font-weight: 100 900;
          font-style: normal;
          font-display: block;
        }
      `}</style>
      <span
        style={{
          fontFamily: "'DancingScriptEmbedded', 'Dancing Script', cursive",
          fontWeight: 700,
        }}
        className="text-7xl sm:text-8xl md:text-9xl font-bold tracking-tight text-black dark:text-white transition-colors duration-200 animate-pulse"
      >
        n
      </span>
    </div>
  );
}
