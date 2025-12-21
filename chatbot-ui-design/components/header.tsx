"use client";

import { Button } from "@/components/ui/button";
import { Home, Briefcase, Menu, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface HeaderProps {
  title?: string;
  showLogo?: boolean;
  showCareerResources?: boolean;
  showLogout?: boolean;
  showHome?: boolean;
  showUser?: boolean;
  onLogout?: () => void;
  className?: string;
}

export function Header({
  title = "CareerPath",
  showLogo = false,
  showCareerResources = true,
  showLogout = false,
  showHome = true,
  showUser = false,
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
      className={`bg-primary text-primary-foreground px-6 py-4 rounded-b-3xl shadow-lg ${className}`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Menu className="w-5 h-5 md:hidden" />
          {showLogo ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-accent rounded-sm flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-accent-foreground" />
              </div>
              <h1 className="text-lg md:text-xl font-semibold">{title}</h1>
            </div>
          ) : (
            <h1 className="text-lg md:text-xl font-semibold">{title}</h1>
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          {showHome && (
            <Link href="/">
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Home className="w-5 h-5" />
              </Button>
            </Link>
          )}
          {showUser && (
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/10"
              title="User"
            >
              <User className="w-5 h-5" />
            </Button>
          )}
          {showLogout && (
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/10"
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
                className="hidden md:flex bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                Share Experience
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
