import React from "react";

export default function Loading() {
  return (
    <div className="relative w-full min-h-[60vh] flex items-center justify-center py-12 px-4 select-none">
      <svg
        viewBox="0 0 120 120"
        className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 text-black dark:text-white transition-colors duration-200 animate-pulse"
        fill="currentColor"
        role="img"
        aria-label="Cargando..."
      >
        <path d="M 28,64 C 25,58 24,48 29,40 C 34,30 42,26 48,26 C 53,26 53,32 50,40 C 47,48 45,56 45,62 C 45,66 47,68 50,68 C 55,68 62,56 67,45 C 72,32 80,26 87,26 C 93,26 94,32 90,42 C 86,52 84,60 84,65 C 84,68 86,70 90,70 C 95,70 100,65 105,56 C 107,59 105,63 100,68 C 93,75 85,79 79,79 C 72,79 69,73 71,64 C 73,55 77,44 79,37 C 80,33 78,32 75,32 C 70,32 62,41 57,53 C 51,66 45,79 38,79 C 31,79 28,72 30,64 Z" />
      </svg>
    </div>
  );
}
