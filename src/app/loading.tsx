import React from "react";

export default function Loading() {
  return (
    <div className="relative w-full min-h-[60vh] flex items-center justify-center py-12 px-4 select-none">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');
      `}</style>
      <span
        style={{ fontFamily: "var(--font-dancing-script), 'Dancing Script', cursive" }}
        className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-tight text-black dark:text-white transition-colors duration-200 animate-pulse"
      >
        n
      </span>
    </div>
  );
}
