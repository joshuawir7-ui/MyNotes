import React from "react";

export default function Loading() {
  return (
    <div className="relative w-full min-h-[60vh] flex items-center justify-center py-12 px-4 select-none">
      <span
        style={{ fontFamily: "'Dancing Script', var(--font-dancing-script), cursive", fontWeight: 700 }}
        className="font-dancing-n text-7xl sm:text-8xl md:text-9xl font-bold text-black dark:text-white transition-colors duration-200 animate-pulse"
      >
        n
      </span>
    </div>
  );
}
