"use client";

import { Button } from "@/components/ui/button";
import { Home, Briefcase, Menu, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface HeaderProps {
  title?: string;
  showLogo?: boolean;
  showCareerResources?: boolean;
  showLogout?: boolean;
  onLogout?: () => void;
  className?: string;
}

export function Header({
  title = "404ella",
  showLogo = true,
  showCareerResources = true,
  showLogout = false,
  onLogout,
  className = "",
}: HeaderProps) {
  const router = useRouter();

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <header
      className={`px-6 py-4 rounded-b-3xl shadow-sm border-b border-white/20 ${className}`}
      style={{ backgroundColor: "lab(58.4127% 35.0187 29.1238)" }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Menu className="w-5 h-5 md:hidden text-white" />
          {showLogo ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-sm flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg md:text-xl font-semibold text-white">
                {title}
              </h1>
            </div>
          ) : (
            <h1 className="text-lg md:text-xl font-semibold text-white">
              {title}
            </h1>
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <Link href="/">
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10 smooth-hover claude-button-hover flex items-center gap-2"
            >
              <Home className="w-5 h-5" />
              <span className="hidden md:inline">Home</span>
            </Button>
          </Link>
          {showLogout && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          )}
          {showCareerResources && (
            <Link href="/feedback">
              <Button
                variant="outline"
                className="hidden md:flex bg-white/10 text-white hover:bg-white/20 border-white/30 smooth-hover shadow-sm backdrop-blur-sm"
              >
                Share Experiences
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
