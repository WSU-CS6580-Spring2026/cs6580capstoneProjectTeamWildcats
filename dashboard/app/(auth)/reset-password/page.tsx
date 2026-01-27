"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrength, getStrength } from "@/components/ui/password-strength";
import { Loader2, Snowflake, KeyRound, CheckCircle } from "lucide-react";
import { SnowAnimation } from "@/components/snow-animation";
import { SnowToggle } from "@/components/snow-toggle";
import { useSnow } from "@/hooks/use-snow";
import { toast } from "sonner";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 120,
      damping: 17,
    },
  },
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const { snowEnabled, toggleSnow } = useSnow();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionError, setSessionError] = useState(false);

  useEffect(() => {
    // Check if user has a valid session from the reset link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSessionError(true);
        toast.error("Invalid or expired reset link. Please request a new one.");
      }
      setSessionChecked(true);
    };
    checkSession();
  }, [supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    const strength = getStrength(password);
    if (strength < 3) {
      toast.error("Please choose a stronger password");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        toast.error(error.message);
      } else {
        setSuccess(true);
        toast.success("Password updated successfully!");
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const passwordsMatch = confirmPassword === "" || password === confirmPassword;

  if (!sessionChecked) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="relative bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      {snowEnabled && <SnowAnimation />}

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
            Snowbase
          </span>
        </motion.a>

        <motion.div
          className="flex flex-col gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants}>
            <Card className="overflow-hidden">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  {success ? (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : (
                    <KeyRound className="h-6 w-6 text-blue-500" />
                  )}
                </div>
                <CardTitle className="text-xl">
                  {success ? "Password updated!" : "Set new password"}
                </CardTitle>
                <CardDescription>
                  {success
                    ? "Your password has been successfully reset"
                    : "Please enter your new password below"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {success ? (
                  <div className="space-y-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Redirecting you to login...
                    </p>
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-blue-500" />
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <FieldGroup>
                      <motion.div variants={itemVariants}>
                        <Field>
                          <FieldLabel htmlFor="password">New Password</FieldLabel>
                          <PasswordInput
                            id="password"
                            name="new-password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="transition-all focus:ring-2 focus:ring-blue-400/20"
                          />
                          <PasswordStrength password={password} />
                        </Field>
                      </motion.div>

                      <motion.div variants={itemVariants}>
                        <Field>
                          <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
                          <PasswordInput
                            id="confirm-password"
                            name="confirm-password"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className={cn(
                              "transition-all focus:ring-2 focus:ring-blue-400/20",
                              !passwordsMatch && "border-red-500 focus:ring-red-400/20"
                            )}
                          />
                          {!passwordsMatch && (
                            <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                          )}
                        </Field>
                      </motion.div>

                      <motion.div variants={itemVariants}>
                        <Field>
                          <Button
                            type="submit"
                            disabled={loading || !passwordsMatch || getStrength(password) < 3}
                            className="w-full bg-linear-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40"
                          >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Reset Password
                          </Button>
                        </Field>
                      </motion.div>
                    </FieldGroup>
                  </form>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <FieldDescription className="px-6 text-center">
              Remember your password?{" "}
              <Link href="/login" className="text-blue-500 hover:text-blue-600">
                Sign in
              </Link>
            </FieldDescription>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
