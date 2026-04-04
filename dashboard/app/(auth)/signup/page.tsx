"use client";

import { useState, useEffect } from "react";
import { SignupForm } from "@/components/signup-form";

function SnowParticles() {
  const [particles, setParticles] = useState<{ id: number; x: number; size: number; opacity: number; duration: number; delay: number; drift: number }[]>([]);
  useEffect(() => {
    setParticles(Array.from({ length: 25 }, (_, i) => ({
      id: i, x: Math.random() * 100, size: Math.random() * 8 + 4,
      opacity: Math.random() * 0.4 + 0.15, duration: Math.random() * 8 + 6,
      delay: Math.random() * -12, drift: Math.random() * 30 - 15,
    })));
  }, []);
  if (particles.length === 0) return null;
  return <>{particles.map(f => (
    <div key={f.id} className="absolute top-0 animate-snowfall pointer-events-none"
      style={{ left: `${f.x}%`, opacity: f.opacity, animationDuration: `${f.duration}s`, animationDelay: `${f.delay}s`, ["--drift" as string]: `${f.drift}px` }}>
      <span className="text-white/60 select-none" style={{ fontSize: f.size }}>❄</span>
    </div>
  ))}</>;
}

export default function SignupPage() {
  return (
    <main id="main-content" className="relative flex min-h-svh flex-col items-center justify-center p-6 md:p-10 overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-br from-slate-950 via-indigo-950 to-slate-900" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <SnowParticles />
      </div>
      <div className="relative z-10 w-full max-w-sm md:max-w-4xl">
        <h1 className="sr-only">Create your Snowbasin account</h1>
        <SignupForm />
      </div>
    </main>
  );
}
