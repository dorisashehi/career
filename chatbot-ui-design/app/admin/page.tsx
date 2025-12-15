"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Home, Menu, Search, Briefcase, CheckCircle, XCircle, Flag, BookOpen, TrendingUp } from "lucide-react"

type FlaggedContent = {
  id: string
  type: "post" | "comment"
  author: string
  content: string
  reason: string
  timestamp: string
  status: "pending" | "approved" | "rejected"
}

type Advice = {
  id: string
  title: string
  category: string
  content: string
  basedOn: string
  usageCount: number
  effectivenessScore: number
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"flagged" | "advice">("flagged")
  const [flaggedContent, setFlaggedContent] = useState<FlaggedContent[]>([
    {
      id: "1",
      type: "post",
      author: "user_john_doe",
      content: "This company is terrible and I would never recommend working there. The management is awful.",
      reason: "Inappropriate language",
      timestamp: "2 hours ago",
      status: "pending",
    },
    {
      id: "2",
      type: "comment",
      author: "career_seeker_23",
      content: "You should definitely lie on your resume about your experience to get the job.",
      reason: "Unethical advice",
      timestamp: "5 hours ago",
      status: "pending",
    },
    {
      id: "3",
      type: "post",
      author: "professional_mike",
      content: "Looking for advice on negotiating salary for a senior developer position.",
      reason: "Flagged by mistake",
      timestamp: "1 day ago",
      status: "pending",
    },
  ])

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
  ])

  const handleApprove = (id: string) => {
    setFlaggedContent((prev) => prev.map((item) => (item.id === id ? { ...item, status: "approved" } : item)))
  }

  const handleReject = (id: string) => {
    setFlaggedContent((prev) => prev.map((item) => (item.id === id ? { ...item, status: "rejected" } : item)))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "text-green-600 bg-green-50"
      case "rejected":
        return "text-red-600 bg-red-50"
      default:
        return "text-yellow-600 bg-yellow-50"
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Menu className="w-5 h-5 md:hidden" />
            <h1 className="text-lg md:text-xl font-semibold">CareerPath Admin</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
              <Home className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
              <Search className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
              <Briefcase className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b border-border">
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
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Flagged Posts & Comments</h2>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm font-medium">
                  {flaggedContent.filter((c) => c.status === "pending").length} Pending
                </span>
              </div>
            </div>

            {flaggedContent.map((item) => (
              <Card key={item.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium uppercase ${
                          item.type === "post" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {item.type}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium uppercase ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                      <span className="text-sm text-muted-foreground">by {item.author}</span>
                      <span className="text-sm text-muted-foreground">{item.timestamp}</span>
                    </div>

                    <p className="text-foreground leading-relaxed">{item.content}</p>

                    <div className="flex items-center gap-2 text-sm">
                      <Flag className="w-4 h-4 text-red-500" />
                      <span className="text-muted-foreground">Reason:</span>
                      <span className="text-red-600 font-medium">{item.reason}</span>
                    </div>
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
            ))}
          </div>
        )}

        {/* Advice Library Tab */}
        {activeTab === "advice" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Career Advice Library</h2>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <TrendingUp className="w-4 h-4 mr-2" />
                Generate New Advice
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {adviceLibrary.map((advice) => (
                <Card key={advice.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-foreground mb-2">{advice.title}</h3>
                        <span className="inline-block px-3 py-1 bg-accent/20 text-accent-foreground text-sm font-medium">
                          {advice.category}
                        </span>
                      </div>
                    </div>

                    <p className="text-muted-foreground leading-relaxed">{advice.content}</p>

                    <div className="pt-4 border-t border-border space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Based on:</span>
                        <span className="font-medium text-foreground">{advice.basedOn}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Times used:</span>
                        <span className="font-medium text-foreground">{advice.usageCount.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Effectiveness:</span>
                        <span className="font-medium text-green-600">{advice.effectivenessScore} / 5.0</span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 bg-transparent">
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
  )
}
