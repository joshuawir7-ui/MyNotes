import React from "react";
import { DANCING_SCRIPT_BASE64 } from "@/lib/dancing-font";

export default function Loading() {
  return (
    <div className="relative w-full min-h-[60vh] flex items-center justify-center py-12 px-4 select-none">
      <style>{`
        @font-face {
          font-family: 'DancingScriptEmbedded';
          src: url('${DANCING_SCRIPT_BASE64}') format('truetype');
          font-weight: 400 700;
          font-style: normal;
          font-display: block;
        }
      `}</style>
      <div className="flex flex-col items-center justify-center">
        <svg
          viewBox="0 -40 550 330"
          className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 text-black dark:text-white fill-current transition-colors duration-200 animate-pulse"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Dancing Script n"
        >
          <g transform="scale(1, -1) translate(40, -280)">
            <path d="M-38 7Q-38 10 -20.5 54.0Q-3 98 15.0 156.5Q33 215 33 253Q52 274 79.0 274.0Q106 274 106 248Q106 214 74 116Q189 292 282 292Q318 292 337.0 265.5Q356 239 356 202Q356 169 335.5 118.0Q315 67 315 44Q315 6 345 6Q407 6 485 162L496 149Q424 -20 323 -20Q289 -20 271.0 -2.5Q253 15 253 44Q253 64 267.5 111.5Q282 159 282 183Q282 232 242 232Q218 232 190.5 213.0Q163 194 142.0 172.0Q121 150 92.5 108.0Q64 66 52 46L15 -15Q-22 -15 -38 7Z" />
          </g>
        </svg>
      </div>
    </div>
  );
}

