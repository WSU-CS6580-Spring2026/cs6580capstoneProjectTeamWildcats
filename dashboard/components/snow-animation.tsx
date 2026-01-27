"use client";

import { useEffect, useState, memo } from "react";

interface Snowflake {
  id: number;
  x: number;
  size: number;
  opacity: number;
  animationDuration: number;
  animationDelay: number;
  drift: number;
  rotation: number;
  type: number; // Different snowflake designs
}

// SVG snowflake designs
const SnowflakeSVG = ({ size, type }: { size: number; type: number }) => {
  const designs = [
    // Classic 6-pointed snowflake
    <svg
      key="type0"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-blue-300 dark:text-white"
    >
      <path d="M12 0L12 24M0 12L24 12M3.5 3.5L20.5 20.5M20.5 3.5L3.5 20.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="4" r="1.5" fill="currentColor" />
      <circle cx="12" cy="20" r="1.5" fill="currentColor" />
      <circle cx="4" cy="12" r="1.5" fill="currentColor" />
      <circle cx="20" cy="12" r="1.5" fill="currentColor" />
      <circle cx="6" cy="6" r="1" fill="currentColor" />
      <circle cx="18" cy="6" r="1" fill="currentColor" />
      <circle cx="6" cy="18" r="1" fill="currentColor" />
      <circle cx="18" cy="18" r="1" fill="currentColor" />
    </svg>,
    // Detailed crystal snowflake
    <svg
      key="type1"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      className="text-blue-200 dark:text-white"
    >
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
      <line x1="12" y1="2" x2="9" y2="5" />
      <line x1="12" y1="2" x2="15" y2="5" />
      <line x1="12" y1="22" x2="9" y2="19" />
      <line x1="12" y1="22" x2="15" y2="19" />
      <line x1="2" y1="12" x2="5" y2="9" />
      <line x1="2" y1="12" x2="5" y2="15" />
      <line x1="22" y1="12" x2="19" y2="9" />
      <line x1="22" y1="12" x2="19" y2="15" />
    </svg>,
    // Simple star snowflake
    <svg
      key="type2"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-cyan-200 dark:text-blue-100"
    >
      <polygon points="12,2 14,10 22,12 14,14 12,22 10,14 2,12 10,10" />
    </svg>,
    // Branching snowflake
    <svg
      key="type3"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="text-blue-300 dark:text-white"
    >
      <path d="M12 2v20M2 12h20M5.64 5.64l12.72 12.72M18.36 5.64L5.64 18.36" />
      <path d="M12 2l-2 3M12 2l2 3M12 22l-2-3M12 22l2-3" />
      <path d="M2 12l3-2M2 12l3 2M22 12l-3-2M22 12l-3 2" />
      <path d="M5.64 5.64l1 2.5M5.64 5.64l2.5 1" />
      <path d="M18.36 5.64l-1 2.5M18.36 5.64l-2.5 1" />
      <path d="M5.64 18.36l1-2.5M5.64 18.36l2.5-1" />
      <path d="M18.36 18.36l-1-2.5M18.36 18.36l-2.5-1" />
    </svg>,
    // Unicode snowflake character
    <span
      key="type4"
      style={{ fontSize: size, lineHeight: 1 }}
      className="text-blue-300 dark:text-white select-none"
    >
      ❄
    </span>,
    // Another unicode snowflake
    <span
      key="type5"
      style={{ fontSize: size, lineHeight: 1 }}
      className="text-cyan-300 dark:text-blue-100 select-none"
    >
      ❅
    </span>,
    // Heavy snowflake
    <span
      key="type6"
      style={{ fontSize: size, lineHeight: 1 }}
      className="text-blue-200 dark:text-white select-none"
    >
      ❆
    </span>,
  ];

  return designs[type % designs.length];
};

function SnowAnimationComponent() {
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const flakes: Snowflake[] = [];
    const count = 50;

    for (let i = 0; i < count; i++) {
      flakes.push({
        id: i,
        x: Math.random() * 100,
        size: Math.random() * 12 + 10, // 10-22px
        opacity: Math.random() * 0.4 + 0.4, // 0.4-0.8
        animationDuration: Math.random() * 10 + 10, // 10-20s
        animationDelay: Math.random() * -20,
        drift: Math.random() * 30 - 15, // -15 to 15px horizontal drift
        rotation: Math.random() * 360,
        type: Math.floor(Math.random() * 7), // 7 different snowflake types
      });
    }

    setSnowflakes(flakes);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 9999 }}
      aria-hidden="true"
    >
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute top-0 animate-snowfall"
          style={{
            left: `${flake.x}%`,
            opacity: flake.opacity,
            animationDuration: `${flake.animationDuration}s`,
            animationDelay: `${flake.animationDelay}s`,
            ["--drift" as string]: `${flake.drift}px`,
            filter: "drop-shadow(0 0 2px rgba(147, 197, 253, 0.5))",
          }}
        >
          <div
            className="animate-spin-slow"
            style={{
              animationDuration: `${flake.animationDuration * 2}s`,
              transform: `rotate(${flake.rotation}deg)`,
            }}
          >
            <SnowflakeSVG size={flake.size} type={flake.type} />
          </div>
        </div>
      ))}
    </div>
  );
}

export const SnowAnimation = memo(SnowAnimationComponent);
