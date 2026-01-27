"use client";

import { useState } from "react";
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
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Loader2, User } from "lucide-react";
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

export function LoginForm({
  className,
}: {
  className?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: "google" | "github") => {
    setOauthLoading(provider);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast.error(error.message);
        setOauthLoading(null);
      }
    } catch {
      toast.error("An error occurred. Please try again.");
      setOauthLoading(null);
    }
  };

  return (
    <motion.div
      className={cn("flex flex-col gap-6", className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl bg-linear-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Welcome back
            </CardTitle>
            <CardDescription>
              Sign in with your Google or GitHub account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <motion.div variants={itemVariants}>
                  <Field className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      type="button"
                      disabled={oauthLoading !== null}
                      onClick={() => handleOAuthLogin("google")}
                      className="transition-all hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-blue-300"
                    >
                      {oauthLoading === "google" ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                          <path
                            d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                            fill="currentColor"
                          />
                        </svg>
                      )}
                      <span className="ml-2">Google</span>
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      disabled={oauthLoading !== null}
                      onClick={() => handleOAuthLogin("github")}
                      className="transition-all hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-blue-300"
                    >
                      {oauthLoading === "github" ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                      )}
                      <span className="ml-2">GitHub</span>
                    </Button>
                  </Field>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                    Or continue with email
                  </FieldSeparator>
                </motion.div>

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
                    <div className="flex items-center">
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      <Link
                        href="/forgot-password"
                        className="ml-auto text-sm text-blue-500 hover:text-blue-600 underline-offset-4 hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <PasswordInput
                      id="password"
                      name="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                      Sign In
                    </Button>
                  </Field>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <FieldDescription className="text-center">
                    Don&apos;t have an account?{" "}
                    <Link href="/signup" className="text-blue-500 hover:text-blue-600">
                      Sign up
                    </Link>
                  </FieldDescription>
                </motion.div>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* Guest mode */}
      <motion.div variants={itemVariants}>
        <Link href="/guest">
          <Button
            variant="outline"
            className="w-full gap-2 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950/50"
          >
            <User className="h-4 w-4" />
            Continue as Guest
          </Button>
        </Link>
      </motion.div>

      <motion.div variants={itemVariants}>
        <FieldDescription className="px-6 text-center">
          By signing in, you agree to our{" "}
          <Link href="#" className="text-blue-500 hover:text-blue-600">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="#" className="text-blue-500 hover:text-blue-600">
            Privacy Policy
          </Link>
          .
        </FieldDescription>
      </motion.div>
    </motion.div>
  );
}
