"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

interface Requirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: Requirement[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "Contains uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "Contains lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "Contains a number", test: (p) => /[0-9]/.test(p) },
  { label: "Contains special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function getStrength(password: string): number {
  return requirements.filter((req) => req.test(password)).length;
}

function getStrengthLabel(strength: number): string {
  if (strength === 0) return "Very weak";
  if (strength === 1) return "Weak";
  if (strength === 2) return "Fair";
  if (strength === 3) return "Good";
  if (strength === 4) return "Strong";
  return "Very strong";
}

function getStrengthColor(strength: number): string {
  if (strength <= 1) return "bg-red-500";
  if (strength === 2) return "bg-orange-500";
  if (strength === 3) return "bg-yellow-500";
  if (strength === 4) return "bg-lime-500";
  return "bg-green-500";
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const strength = getStrength(password);
  const label = getStrengthLabel(strength);
  const color = getStrengthColor(strength);

  if (!password) return null;

  return (
    <motion.div
      className={cn("space-y-3", className)}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
    >
      {/* Strength bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Password strength</span>
          <span
            className={cn(
              "font-medium",
              strength <= 1 && "text-red-500",
              strength === 2 && "text-orange-500",
              strength === 3 && "text-yellow-500",
              strength === 4 && "text-lime-500",
              strength === 5 && "text-green-500"
            )}
          >
            {label}
          </span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((level) => (
            <motion.div
              key={level}
              className={cn(
                "h-1.5 flex-1 rounded-full bg-muted",
                level <= strength && color
              )}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: level * 0.05 }}
            />
          ))}
        </div>
      </div>

      {/* Requirements checklist */}
      <div className="grid gap-1.5">
        {requirements.map((req, index) => {
          const met = req.test(password);
          return (
            <motion.div
              key={req.label}
              className="flex items-center gap-2 text-xs"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full transition-colors",
                  met
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {met ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )}
              </div>
              <span
                className={cn(
                  "transition-colors",
                  met ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {req.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

export { getStrength, requirements };
