"use client";

import { SignupForm } from "@/components/signup-form";
import { SnowAnimation } from "@/components/snow-animation";
import { SnowToggle } from "@/components/snow-toggle";
import { useSnow } from "@/hooks/use-snow";

export default function SignupPage() {
  const { snowEnabled, toggleSnow } = useSnow();

  return (
    <div className="relative bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      {snowEnabled && <SnowAnimation />}

      {/* Snow toggle button */}
      <div className="absolute top-4 right-4 z-20">
        <SnowToggle enabled={snowEnabled} onToggle={toggleSnow} />
      </div>

      <div className="w-full max-w-sm md:max-w-4xl">
        <SignupForm />
      </div>
    </div>
  );
}
