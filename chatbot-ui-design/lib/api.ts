const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AskRequest {
  question: string;
  chat_history?: ChatMessage[];
}

export interface Source {
  url: string;
  post_id?: string;
  source?: string;
  date?: string;
  score?: number;
  num_comments?: number;
}

export interface AskResponse {
  answer: string;
  sources: Source[];
}

// This function sends a question to the backend and gets an answer back
export async function askQuestion(
  question: string,
  chatHistory: ChatMessage[] = []
): Promise<AskResponse> {
  try {
    const requestData: AskRequest = {
      question: question,
      chat_history: chatHistory,
    };

    const response = await fetch(`${API_URL}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      throw new Error(
        `Backend error: ${response.status} ${response.statusText}`
      );
    }

    // Get the answer and sources from the response
    const data: AskResponse = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error) {
      // Handle network errors (can't connect to backend)
      if (
        error.message.includes("fetch") ||
        error.message.includes("Failed to fetch")
      ) {
        throw new Error(
          "Cannot connect to backend. Make sure the backend server is running on port 8000."
        );
      }
      throw error;
    }
    throw new Error("Something went wrong. Please try again.");
  }
}
