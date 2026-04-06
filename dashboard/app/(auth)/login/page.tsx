"use client";

import { useState, useEffect } from "react";
import { Snowflake } from "lucide-react";
import { motion } from "framer-motion";
import { LoginForm } from "@/components/login-form";

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

export default function LoginPage() {
  return (
    <main id="main-content" className="relative flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-linear-to-br from-slate-950 via-indigo-950 to-slate-900" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <SnowParticles />
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col gap-6">
        <motion.a
          href="/"
          className="flex items-center gap-2 self-center font-medium"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 100 }}
        >
          <div className="bg-linear-to-br from-blue-400 to-cyan-500 text-white flex size-8 items-center justify-center rounded-lg shadow-lg shadow-blue-500/25">
            <Snowflake className="size-5" />
          </div>
          <h1 className="text-lg bg-linear-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent font-semibold">
            Snowbasin
          </h1>
        </motion.a>
        <LoginForm />
      </div>
    </main>
  );
}
