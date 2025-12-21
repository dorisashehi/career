"use client";

import type React from "react";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/header";
import { useToast } from "@/hooks/use-toast";

export default function UserFeedback() {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category || !description.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (description.trim().length < 50) {
      toast({
        title: "Description Too Short",
        description: "Please provide at least 50 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("http://localhost:8000/api/experiences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: category,
          description: description.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to submit experience");
      }

      const data = await response.json();

      toast({
        title: "Experience Submitted!",
        description:
          data.message || "Your experience has been submitted successfully.",
      });

      setCategory("");
      setDescription("");
      setIsSubmitted(true);

      setTimeout(() => {
        setIsSubmitted(false);
      }, 3000);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to submit experience. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        showLogo={true}
        showCareerResources={false}
        showSearch={false}
        showBriefcase={false}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-primary hover:underline mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Chat
        </Link>

        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Share Your Experience
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Help us improve by sharing your career experiences. No login
              required - your feedback is anonymous and valuable.
            </p>
          </div>

          <Card className="p-6 md:p-8 shadow-xl">
            {isSubmitted ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto">
                  <svg
                    className="w-8 h-8 text-accent-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-foreground">
                  Thank You!
                </h2>
                <p className="text-muted-foreground">
                  Your experience has been submitted successfully.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label
                    htmlFor="category"
                    className="block text-sm font-medium text-foreground"
                  >
                    Category
                  </label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  >
                    <option value="">Select a category</option>
                    <option value="interview">Interview</option>
                    <option value="job-search">Job Search</option>
                    <option value="career-advice">Career Advice</option>
                    <option value="salary-negotiation">
                      Salary Negotiation
                    </option>
                    <option value="workplace-issues">Workplace Issues</option>
                    <option value="career-transition">Career Transition</option>
                    <option value="professional-development">
                      Professional Development
                    </option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-foreground"
                  >
                    Your Experience
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell us about your experience... What happened? What challenges did you face? What did you learn?"
                    rows={8}
                    className="w-full px-4 py-3 bg-background border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    required
                    minLength={50}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum 50 characters
                  </p>
                </div>

                <div className="bg-muted p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    Why share your experience?
                  </h3>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Help others learn from your journey</li>
                    <li>Contribute to our career advice database</li>
                    <li>Get anonymous insights analyzed by our AI coach</li>
                    <li>Build a better career community</li>
                  </ul>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Submitting..." : "Submit Experience"}
                </Button>
              </form>
            )}
          </Card>

          <div className="grid md:grid-cols-3 gap-4 mt-8">
            <Card className="p-6 text-center">
              <div className="text-3xl font-bold text-primary mb-2">1,247</div>
              <p className="text-sm text-muted-foreground">
                Experiences Shared
              </p>
            </Card>
            <Card className="p-6 text-center">
              <div className="text-3xl font-bold text-accent mb-2">8</div>
              <p className="text-sm text-muted-foreground">Categories</p>
            </Card>
            <Card className="p-6 text-center">
              <div className="text-3xl font-bold text-chart-3 mb-2">100%</div>
              <p className="text-sm text-muted-foreground">Anonymous</p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
