import type { Source } from "@/lib/api";

export type Message = {
  id: string;
  role: "user" | "coach";
  content: string;
  timestamp: string;
  sources?: Source[];
  isError?: boolean;
};

