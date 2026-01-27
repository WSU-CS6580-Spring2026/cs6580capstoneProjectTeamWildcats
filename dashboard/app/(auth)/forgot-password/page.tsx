"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
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
import { Input } from "@/components/ui/input";
import { Loader2, Snowflake, ArrowLeft, Mail, CheckCircle } from "lucide-react";
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

export default function ForgotPasswordPage() {
  const { snowEnabled, toggleSnow } = useSnow();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error(error.message);
      } else {
        setSuccess(true);
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
            Snowbasin
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
                    <Mail className="h-6 w-6 text-blue-500" />
                  )}
                </div>
                <CardTitle className="text-xl">
                  {success ? "Check your email" : "Forgot password?"}
                </CardTitle>
                <CardDescription>
                  {success
                    ? "We've sent you a password reset link"
                    : "No worries, we'll send you reset instructions"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {success ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground text-center">
                      We sent a password reset link to{" "}
                      <span className="font-medium text-foreground">{email}</span>
                    </p>
                    <p className="text-xs text-muted-foreground text-center">
                      Didn't receive the email? Check your spam folder or{" "}
                      <button
                        onClick={() => setSuccess(false)}
                        className="text-blue-500 hover:text-blue-600 underline"
                      >
                        try again
                      </button>
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <FieldGroup>
                      <motion.div variants={itemVariants}>
                        <Field>
                          <FieldLabel htmlFor="email">Email</FieldLabel>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="transition-all focus:ring-2 focus:ring-blue-400/20"
                          />
                        </Field>
                      </motion.div>

                      <motion.div variants={itemVariants}>
                        <Field>
                          <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-linear-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40"
                          >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Send Reset Link
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
            <Link href="/login">
              <Button
                variant="ghost"
                className="w-full gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Button>
            </Link>
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
