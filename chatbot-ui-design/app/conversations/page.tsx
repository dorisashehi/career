"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MessageSquare, Clock, Trash2, Download, Search } from "lucide-react";
import { Header } from "@/components/header";

type Conversation = {
  id: string;
  title: string;
  date: string;
  messageCount: number;
  preview: string;
  tags: string[];
};

export default function SavedConversations() {
  const [searchTerm, setSearchTerm] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: "1",
      title: "Salary Negotiation Discussion",
      date: "2024-01-15",
      messageCount: 12,
      preview:
        "We discussed strategies for negotiating a 20% salary increase...",
      tags: ["Salary", "Negotiation"],
    },
    {
      id: "2",
      title: "Career Change to Tech",
      date: "2024-01-10",
      messageCount: 24,
      preview: "Planning transition from marketing to software engineering...",
      tags: ["Career Change", "Tech"],
    },
    {
      id: "3",
      title: "Interview Preparation",
      date: "2024-01-08",
      messageCount: 18,
      preview:
        "Practiced STAR method responses and technical interview questions...",
      tags: ["Interview", "Job Search"],
    },
    {
      id: "4",
      title: "LinkedIn Profile Review",
      date: "2024-01-05",
      messageCount: 8,
      preview: "Optimized headline, summary, and experience sections...",
      tags: ["LinkedIn", "Personal Branding"],
    },
    {
      id: "5",
      title: "Work-Life Balance Strategies",
      date: "2024-01-03",
      messageCount: 15,
      preview: "Discussed setting boundaries and managing time effectively...",
      tags: ["Work-Life Balance", "Wellness"],
    },
    {
      id: "6",
      title: "Freelance vs Full-Time",
      date: "2023-12-28",
      messageCount: 20,
      preview:
        "Compared pros and cons of freelancing versus traditional employment...",
      tags: ["Freelance", "Career Planning"],
    },
  ]);

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.preview.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.tags.some((tag) =>
        tag.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this conversation?")) {
      setConversations((prev) => prev.filter((conv) => conv.id !== id));
    }
  };

  const handleExport = (conv: Conversation) => {
    // In a real app, this would export the conversation
    alert(`Exporting conversation: ${conv.title}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header showCareerResources={false} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Saved Conversations
          </h1>
          <p className="text-muted-foreground">
            Review and manage your career coaching sessions
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search conversations by title, content, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-base"
            />
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 text-primary">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {conversations.length}
                </p>
                <p className="text-sm text-muted-foreground">
                  Total Conversations
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 text-accent">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {conversations.reduce(
                    (sum, conv) => sum + conv.messageCount,
                    0
                  )}
                </p>
                <p className="text-sm text-muted-foreground">Total Messages</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 text-green-600">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">6</p>
                <p className="text-sm text-muted-foreground">Career Topics</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Conversations List */}
        <div className="space-y-4">
          {filteredConversations.length === 0 ? (
            <Card className="p-12 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">
                No conversations found
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Try adjusting your search or start a new conversation
              </p>
            </Card>
          ) : (
            filteredConversations.map((conversation) => (
              <Card
                key={conversation.id}
                className="p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold text-foreground">
                        {conversation.title}
                      </h3>
                    </div>

                    <p className="text-muted-foreground leading-relaxed">
                      {conversation.preview}
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {new Date(conversation.date).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MessageSquare className="w-4 h-4" />
                        {conversation.messageCount} messages
                      </div>
                      <div className="flex gap-2">
                        {conversation.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-accent/20 text-accent-foreground text-xs font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(conversation)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(conversation.id)}
                      className="text-red-600 border-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
