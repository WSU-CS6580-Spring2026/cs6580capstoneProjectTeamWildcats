"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrength, getStrength } from "@/components/ui/password-strength";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Loader2,
  ArrowLeft,
  User,
  Key,
  Shield,
  Trash2,
  AlertTriangle,
  Unlink,
  Camera,
  ImageIcon,
} from "lucide-react";
import { SnowAnimation } from "@/components/snow-animation";
import { SnowToggle } from "@/components/snow-toggle";
import { useSnow } from "@/hooks/use-snow";
import { toast } from "sonner";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
};

interface Identity {
  provider: string;
  identity_id: string;
  created_at: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { snowEnabled, toggleSnow } = useSnow();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  // Loading states
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);

  // User identities (connected accounts)
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    if (user) {
      setIdentities((user.identities || []) as Identity[]);
      setAvatarUrl(user.user_metadata?.avatar_url || null);
      setNewName(user.user_metadata?.name || "");
    }
  }, [user, authLoading, router]);

  const hasPasswordAuth = identities.some((i) => i.provider === "email");
  const hasOAuthOnly = identities.length > 0 && !hasPasswordAuth;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    setAvatarLoading(true);

    try {
      // Create a unique file name
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage (bucket is 'avatars', file goes at root)
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        // If bucket doesn't exist, show helpful error
        if (uploadError.message.includes("Bucket not found")) {
          toast.error("Avatar storage not configured. Please create an 'avatars' bucket in Supabase.");
        } else {
          toast.error(uploadError.message);
        }
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      if (updateError) {
        toast.error(updateError.message);
        return;
      }

      setAvatarUrl(publicUrl);
      toast.success("Profile picture updated!");
    } catch {
      toast.error("Failed to upload image. Please try again.");
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { name: newName },
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Profile updated successfully!");
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    const strength = getStrength(newPassword);
    if (strength < 3) {
      toast.error("Please choose a stronger password");
      return;
    }

    setPasswordLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password updated successfully!");
        setNewPassword("");
        setConfirmPassword("");
        // Refresh identities
        const { data: { user: updatedUser } } = await supabase.auth.getUser();
        if (updatedUser) {
          setIdentities((updatedUser.identities || []) as Identity[]);
        }
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleUnlinkProvider = async (provider: string) => {
    const oauthIdentities = identities.filter((i) => i.provider !== "email");
    // Can only unlink if there's another OAuth provider OR password auth is set up
    if (oauthIdentities.length <= 1 && !hasPasswordAuth) {
      toast.error("You must have at least one login method. Add a password first.");
      return;
    }

    setUnlinkLoading(provider);

    try {
      const identity = identities.find((i) => i.provider === provider);
      if (!identity) return;

      // Note: unlinkIdentity requires the full identity object
      // For now, we'll just show an error since this requires admin API
      toast.error("Please contact support to disconnect this account.");
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setUnlinkLoading(null);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (deleteConfirm !== "DELETE") {
      toast.error("Please type DELETE to confirm");
      return;
    }

    setDeleteLoading(true);

    try {
      // Call a server action or API to delete the user
      const response = await fetch("/api/user/delete", {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to delete account");
      } else {
        toast.success("Account deleted");
        await signOut();
        router.push("/login");
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const passwordsMatch = confirmPassword === "" || newPassword === confirmPassword;

  if (authLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const userName = user.user_metadata?.name || user.email?.split("@")[0] || "User";
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative min-h-svh bg-muted">
      {snowEnabled && <SnowAnimation />}

      <div className="absolute top-4 right-4 z-20">
        <SnowToggle enabled={snowEnabled} onToggle={toggleSnow} />
      </div>

      <div className="container max-w-2xl mx-auto py-8 px-4">
        <motion.div
          className="flex flex-col gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-muted-foreground text-sm">Manage your account settings</p>
            </div>
          </motion.div>

          {/* Profile Card with Avatar Upload */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5" />
                  Profile
                </CardTitle>
                <CardDescription>Update your profile information</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile}>
                  <FieldGroup>
                    {/* Avatar Upload */}
                    <Field>
                      <FieldLabel>Profile Picture</FieldLabel>
                      <div className="flex items-center gap-4">
                        <div className="relative group">
                          <Avatar className="h-20 w-20 border-2 border-muted">
                            <AvatarImage src={avatarUrl || undefined} />
                            <AvatarFallback className="text-xl">{userInitials}</AvatarFallback>
                          </Avatar>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={avatarLoading}
                            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            {avatarLoading ? (
                              <Loader2 className="h-6 w-6 text-white animate-spin" />
                            ) : (
                              <Camera className="h-6 w-6 text-white" />
                            )}
                          </button>
                        </div>
                        <div className="flex-1">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={avatarLoading}
                          >
                            <ImageIcon className="h-4 w-4 mr-2" />
                            {avatarLoading ? "Uploading..." : "Change Photo"}
                          </Button>
                          <p className="text-xs text-muted-foreground mt-1">
                            JPG, PNG or GIF. Max 2MB.
                          </p>
                        </div>
                      </div>
                    </Field>

                    {/* Name */}
                    <Field>
                      <FieldLabel htmlFor="name">Display Name</FieldLabel>
                      <Input
                        id="name"
                        type="text"
                        placeholder="Your name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                    </Field>

                    {/* Email (read-only here) */}
                    <Field>
                      <FieldLabel htmlFor="profile-email">Email</FieldLabel>
                      <Input
                        id="profile-email"
                        type="email"
                        value={user.email || ""}
                        disabled
                        className="bg-muted"
                      />
                      <FieldDescription>
                        Your email address associated with this account.
                      </FieldDescription>
                    </Field>

                    <Button type="submit" disabled={profileLoading}>
                      {profileLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Change/Add Password */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Key className="h-5 w-5" />
                  {hasOAuthOnly ? "Add Password" : "Change Password"}
                </CardTitle>
                <CardDescription>
                  {hasOAuthOnly
                    ? "Add a password to enable email login alongside your social account"
                    : "Update your password"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdatePassword}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="new-password">
                        {hasOAuthOnly ? "Password" : "New Password"}
                      </FieldLabel>
                      <PasswordInput
                        id="new-password"
                        name="new-password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                      <PasswordStrength password={newPassword} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="confirm-new-password">Confirm Password</FieldLabel>
                      <PasswordInput
                        id="confirm-new-password"
                        name="confirm-password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className={cn(!passwordsMatch && "border-red-500")}
                      />
                      {!passwordsMatch && (
                        <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                      )}
                    </Field>
                    <Button
                      type="submit"
                      disabled={passwordLoading || !passwordsMatch || getStrength(newPassword) < 3}
                    >
                      {passwordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {hasOAuthOnly ? "Add Password" : "Update Password"}
                    </Button>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Connected Accounts */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5" />
                  Connected Accounts
                </CardTitle>
                <CardDescription>
                  Manage your connected login methods
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <div className="space-y-3">
                    {identities
                      .filter((identity) => identity.provider !== "email") // Only show OAuth providers
                      .map((identity) => (
                      <div
                        key={identity.identity_id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          {identity.provider === "google" && (
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                              <path
                                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                                fill="currentColor"
                              />
                            </svg>
                          )}
                          {identity.provider === "github" && (
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                          )}
                          <div>
                            <p className="font-medium capitalize">{identity.provider}</p>
                            <p className="text-xs text-muted-foreground">
                              Connected {new Date(identity.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {(identities.length > 1 || hasPasswordAuth) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnlinkProvider(identity.provider)}
                            disabled={unlinkLoading === identity.provider}
                          >
                            {unlinkLoading === identity.provider ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Unlink className="h-4 w-4" />
                            )}
                            <span className="ml-2">Disconnect</span>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  {identities.filter((i) => i.provider !== "email").length === 0 && (
                    <FieldDescription className="text-center text-muted-foreground">
                      No OAuth providers connected. You can add Google or GitHub login from the login page.
                    </FieldDescription>
                  )}
                  {identities.filter((i) => i.provider !== "email").length === 1 && !hasPasswordAuth && (
                    <FieldDescription className="text-center">
                      Add a password in the section above to enable disconnecting this account.
                    </FieldDescription>
                  )}
                </FieldGroup>
              </CardContent>
            </Card>
          </motion.div>

          {/* Delete Account */}
          <motion.div variants={itemVariants}>
            <Card className="border-red-200 dark:border-red-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-red-600 dark:text-red-400">
                  <Trash2 className="h-5 w-5" />
                  Delete Account
                </CardTitle>
                <CardDescription>
                  Permanently delete your account and all associated data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleDeleteAccount}>
                  <FieldGroup>
                    <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-red-600 dark:text-red-400">
                          <p className="font-medium mb-1">Warning: This action cannot be undone</p>
                          <p>
                            This will permanently delete your account, all your chats, and remove
                            your data from our servers.
                          </p>
                        </div>
                      </div>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="delete-confirm">
                        Type <span className="font-mono font-bold">DELETE</span> to confirm
                      </FieldLabel>
                      <Input
                        id="delete-confirm"
                        type="text"
                        placeholder="DELETE"
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                        className="border-red-200 focus:border-red-400 focus:ring-red-400/20"
                      />
                    </Field>
                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={deleteLoading || deleteConfirm !== "DELETE"}
                    >
                      {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Delete My Account
                    </Button>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
