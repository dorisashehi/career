"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { registerAdmin } from "@/lib/api";
import { saveAdminToken, isAdminLoggedIn } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function AdminRegisterPage() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    registrationSecret: "",
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Redirect to admin dashboard if already logged in
  useEffect(() => {
    if (isAdminLoggedIn()) {
      router.push("/admin");
    }
  }, [router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if passwords match
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match. Please try again.",
        variant: "destructive",
      });
      return;
    }

    // Check password length (basic validation)
    if (formData.password.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Call the backend register endpoint
      const response = await registerAdmin(
        formData.username,
        formData.email,
        formData.password,
        formData.registrationSecret || undefined
      );

      // Save the token to localStorage
      saveAdminToken(response.access_token);

      // Show success toast
      toast({
        title: "Registration Successful",
        description: "Your admin account has been created successfully.",
      });

      // Redirect to admin dashboard
      router.push("/admin");
    } catch (err) {
      toast({
        title: "Registration Failed",
        description:
          err instanceof Error
            ? err.message
            : "Registration failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Admin Registration
          </h1>
          <p className="text-muted-foreground">Create a new admin account</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="username"
              className="text-sm font-medium text-foreground"
            >
              Username
            </label>
            <Input
              id="username"
              type="text"
              placeholder="Choose a username"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              required
              className="text-base"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-foreground"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
              className="text-base"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="Create a strong password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
              className="text-base"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-foreground"
            >
              Confirm Password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              onChange={(e) =>
                setFormData({ ...formData, confirmPassword: e.target.value })
              }
              required
              className="text-base"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="registrationSecret"
              className="text-sm font-medium text-foreground"
            >
              Registration Secret (optional)
            </label>
            <Input
              id="registrationSecret"
              type="password"
              placeholder="Enter registration secret if required"
              value={formData.registrationSecret}
              onChange={(e) =>
                setFormData({ ...formData, registrationSecret: e.target.value })
              }
              className="text-base"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              If your backend requires a registration secret, enter it here.
            </p>
          </div>

          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create Admin Account"}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            Already have an admin account?{" "}
            <a
              href="/admin/login"
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
}
