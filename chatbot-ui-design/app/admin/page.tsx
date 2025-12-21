"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, XCircle, Flag, BookOpen, TrendingUp } from "lucide-react";
import { Header } from "@/components/header";
import { getAdminToken, removeAdminToken, isAdminLoggedIn } from "@/lib/auth";
import {
  getPendingExperiences,
  approveExperience,
  rejectExperience,
  ExperienceListItem,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp } from "lucide-react";

// We'll use ExperienceListItem from the API instead of FlaggedContent

type Advice = {
  id: string;
  title: string;
  category: string;
  content: string;
  basedOn: string;
  usageCount: number;
  effectivenessScore: number;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"flagged" | "advice">("flagged");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [flaggedContent, setFlaggedContent] = useState<ExperienceListItem[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  // Fetch pending experiences when component loads and user is authenticated
  useEffect(() => {
    const fetchExperiences = async () => {
      if (!isAuthenticated) return;

      setLoading(true);
      try {
        const token = getAdminToken();
        if (!token) {
          // No token found, redirect to login
          removeAdminToken();
          router.push("/admin/login");
          return;
        }

        const experiences = await getPendingExperiences(token, "pending");
        setFlaggedContent(experiences);
      } catch (error: any) {
        // Check if it's a token expiration error (401 status)
        if (
          error?.status === 401 ||
          (error instanceof Error &&
            (error.message.includes("expired") ||
              error.message.includes("Invalid or expired token") ||
              error.message.includes("401")))
        ) {
          // Token expired or invalid, remove it and redirect to login immediately
          removeAdminToken();
          setIsAuthenticated(false);
          router.push("/admin/login");
          return;
        }

        // For other errors, show notification
        if (error instanceof Error) {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchExperiences();
  }, [isAuthenticated, router, toast]);

  const [adviceLibrary, setAdviceLibrary] = useState<Advice[]>([
    {
      id: "1",
      title: "Salary Negotiation Framework",
      category: "Compensation",
      content:
        "Research market rates, document your achievements, practice your pitch, and always negotiate with confidence while remaining professional.",
      basedOn: "500+ successful negotiations",
      usageCount: 1247,
      effectivenessScore: 4.8,
    },
    {
      id: "2",
      title: "Career Transition Strategy",
      category: "Career Change",
      content:
        "Identify transferable skills, network in target industry, consider bridge roles, and invest in necessary certifications or training.",
      basedOn: "350+ career transitions",
      usageCount: 892,
      effectivenessScore: 4.6,
    },
    {
      id: "3",
      title: "Interview Preparation Guide",
      category: "Job Search",
      content:
        "Use STAR method for behavioral questions, research company culture, prepare thoughtful questions, and practice common technical scenarios.",
      basedOn: "1000+ successful interviews",
      usageCount: 2103,
      effectivenessScore: 4.9,
    },
    {
      id: "4",
      title: "LinkedIn Profile Optimization",
      category: "Personal Branding",
      content:
        "Craft compelling headline, write achievement-focused summary, optimize for keywords, and maintain active engagement with industry content.",
      basedOn: "750+ profile reviews",
      usageCount: 1567,
      effectivenessScore: 4.7,
    },
  ]);

  // Check if admin is logged in when component loads
  useEffect(() => {
    const checkAuth = async () => {
      if (!isAdminLoggedIn()) {
        router.push("/admin/login");
        setIsAuthenticated(false);
        return;
      }

      // Token exists, but we should verify it's still valid
      // We'll verify it when fetching experiences
      setIsAuthenticated(true);
    };

    checkAuth();
  }, [router]);

  const handleLogout = () => {
    removeAdminToken();
    router.push("/admin/login");
  };

  // Show nothing (or loading) while checking authentication
  if (isAuthenticated === null || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Toggle expand/collapse for long text
  const toggleExpand = (id: number) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Check if text is long enough to need expand/collapse
  const isLongText = (text: string) => {
    return text.length > 200;
  };

  // Get preview text (first 200 characters)
  const getPreviewText = (text: string) => {
    return text.substring(0, 200) + "...";
  };

  const handleApprove = async (id: number) => {
    try {
      const token = getAdminToken();
      if (!token) {
        toast({
          title: "Error",
          description: "You are not logged in. Please login again.",
          variant: "destructive",
        });
        router.push("/admin/login");
        return;
      }

      // Call the backend API to approve the experience
      await approveExperience(token, id);

      // Remove the item from the list since it's now approved
      setFlaggedContent((prev) => prev.filter((item) => item.id !== id));

      toast({
        title: "Approved",
        description:
          "Experience has been approved and status updated in database.",
      });
    } catch (error: any) {
      // Check if it's a token expiration error
      if (
        error?.status === 401 ||
        (error instanceof Error &&
          (error.message.includes("expired") ||
            error.message.includes("Invalid or expired token") ||
            error.message.includes("401")))
      ) {
        removeAdminToken();
        router.push("/admin/login");
        return;
      }

      // Show error message
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to approve experience.",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (id: number) => {
    try {
      const token = getAdminToken();
      if (!token) {
        toast({
          title: "Error",
          description: "You are not logged in. Please login again.",
          variant: "destructive",
        });
        router.push("/admin/login");
        return;
      }

      // Call the backend API to reject the experience
      await rejectExperience(token, id);

      // Remove the item from the list since it's now rejected
      setFlaggedContent((prev) => prev.filter((item) => item.id !== id));

      toast({
        title: "Rejected",
        description:
          "Experience has been rejected and status updated in database.",
      });
    } catch (error: any) {
      // Check if it's a token expiration error
      if (
        error?.status === 401 ||
        (error instanceof Error &&
          (error.message.includes("expired") ||
            error.message.includes("Invalid or expired token") ||
            error.message.includes("401")))
      ) {
        removeAdminToken();
        router.push("/admin/login");
        return;
      }

      // Show error message
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to reject experience.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "text-green-600 bg-green-50";
      case "rejected":
        return "text-red-600 bg-red-50";
      default:
        return "text-yellow-600 bg-yellow-50";
    }
  };

  // Get severity color
  const getSeverityColor = (severity: string | null) => {
    if (!severity) return "text-gray-600 bg-gray-50";
    switch (severity.toLowerCase()) {
      case "critical":
        return "text-red-600 bg-red-50";
      case "medium":
        return "text-orange-600 bg-orange-50";
      case "low":
        return "text-yellow-600 bg-yellow-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  // Format date to show time ago
  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="animate-fade-in">
        <Header
          title="CareerPath Admin"
          showLogout={true}
          onLogout={handleLogout}
          showCareerResources={false}
        />
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8 pb-16">
        {/* Tab Navigation */}
        <div
          className="flex gap-4 mb-8 border-b border-border animate-page-entrance"
          style={{ animationDelay: "0.1s" }}
        >
          <button
            onClick={() => setActiveTab("flagged")}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === "flagged"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4" />
              Flagged Content
            </div>
          </button>
          <button
            onClick={() => setActiveTab("advice")}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === "advice"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Advice Library
            </div>
          </button>
        </div>

        {/* Flagged Content Tab */}
        {activeTab === "flagged" && (
          <div
            className="space-y-4 animate-page-entrance"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">
                Pending User Experiences
              </h2>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm font-medium">
                  {flaggedContent.length} Pending
                </span>
              </div>
            </div>

            {loading && (
              <div className="text-center py-8 text-muted-foreground">
                Loading experiences...
              </div>
            )}

            {!loading && flaggedContent.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No pending experiences to review.
              </div>
            )}

            {!loading && flaggedContent.length > 0 && (
              <div
                className={`space-y-4 ${
                  flaggedContent.length > 5
                    ? "max-h-[1250px] overflow-y-auto pr-2"
                    : ""
                }`}
              >
                {flaggedContent.map((item) => {
                  const isExpanded = expandedItems.has(item.id);
                  const shouldShowExpand = isLongText(item.text);
                  const displayText =
                    isExpanded || !shouldShowExpand
                      ? item.text
                      : getPreviewText(item.text);

                  return (
                    <Card key={item.id} className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            {/* Show severity instead of type */}
                            {item.severity && (
                              <span
                                className={`px-2 py-1 text-xs font-medium uppercase ${getSeverityColor(
                                  item.severity
                                )}`}
                              >
                                {item.severity}
                              </span>
                            )}
                            <span
                              className={`px-2 py-1 text-xs font-medium uppercase ${getStatusColor(
                                item.status
                              )}`}
                            >
                              {item.status}
                            </span>
                            {item.experience_type && (
                              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                                {item.experience_type.replace("_", " ")}
                              </span>
                            )}
                            <span className="text-sm text-muted-foreground">
                              {formatTimeAgo(item.submitted_at)}
                            </span>
                          </div>

                          {item.title && (
                            <h3 className="text-lg font-semibold text-foreground">
                              {item.title}
                            </h3>
                          )}

                          <div className="space-y-2">
                            <p className="text-foreground leading-relaxed">
                              {displayText}
                            </p>
                            {shouldShowExpand && (
                              <button
                                onClick={() => toggleExpand(item.id)}
                                className="flex items-center gap-1 text-sm text-primary hover:underline"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-4 h-4" />
                                    Show less
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-4 h-4" />
                                    Show more
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          {item.flagged_reason && (
                            <div className="flex items-center gap-2 text-sm">
                              <Flag className="w-4 h-4 text-red-500" />
                              <span className="text-muted-foreground">
                                Reason:
                              </span>
                              <span className="text-red-600 font-medium">
                                {item.flagged_reason}
                              </span>
                            </div>
                          )}
                        </div>

                        {item.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleApprove(item.id)}
                              variant="outline"
                              size="sm"
                              className="text-green-600 border-green-600 hover:bg-green-50"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              onClick={() => handleReject(item.id)}
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-600 hover:bg-red-50"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Advice Library Tab */}
        {activeTab === "advice" && (
          <div
            className="space-y-4 animate-page-entrance"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">
                Career Advice Library
              </h2>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <TrendingUp className="w-4 h-4 mr-2" />
                Generate New Advice
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {adviceLibrary.map((advice) => (
                <Card
                  key={advice.id}
                  className="p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-foreground mb-2">
                          {advice.title}
                        </h3>
                        <span className="inline-block px-3 py-1 bg-accent/20 text-accent-foreground text-sm font-medium">
                          {advice.category}
                        </span>
                      </div>
                    </div>

                    <p className="text-muted-foreground leading-relaxed">
                      {advice.content}
                    </p>

                    <div className="pt-4 border-t border-border space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Based on:</span>
                        <span className="font-medium text-foreground">
                          {advice.basedOn}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Times used:
                        </span>
                        <span className="font-medium text-foreground">
                          {advice.usageCount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Effectiveness:
                        </span>
                        <span className="font-medium text-green-600">
                          {advice.effectivenessScore} / 5.0
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent"
                      >
                        View Analytics
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
