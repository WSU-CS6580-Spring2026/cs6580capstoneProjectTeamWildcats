"use client";

import { Snowflake } from "lucide-react";
import { motion } from "framer-motion";
import { LoginForm } from "@/components/login-form";
import { SnowAnimation } from "@/components/snow-animation";
import { SnowToggle } from "@/components/snow-toggle";
import { useSnow } from "@/hooks/use-snow";

export default function LoginPage() {
  const { snowEnabled, toggleSnow } = useSnow();

  return (
    <div className="relative bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      {snowEnabled && <SnowAnimation />}

      {/* Snow toggle button */}
      <div className="absolute top-4 right-4 z-20">
        <SnowToggle enabled={snowEnabled} onToggle={toggleSnow} />
      </div>

      <div className="flex w-full max-w-sm flex-col gap-6">
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
          <span className="text-lg bg-linear-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent font-semibold">
            Snowbasin
          </span>
        </motion.a>
        <LoginForm />
      </div>
    </div>
  );
}
