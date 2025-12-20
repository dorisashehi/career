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

// Admin auth types
export interface AdminRegisterRequest {
  username: string;
  email: string;
  password: string;
  registration_secret?: string;
}

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface AdminInfo {
  id: number;
  username: string;
  email: string;
  created_at: string | null;
}

export interface ExperienceListItem {
  id: number;
  title: string | null;
  text: string;
  experience_type: string | null;
  status: string;
  severity: string | null;
  flagged_reason: string | null;
  flagged_at: string | null;
  submitted_at: string | null;
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
      // Handle 413 error specifically (Request Entity Too Large)
      if (response.status === 413) {
        const errorData = await response
          .json()
          .catch(() => ({
            detail: "Request too large. Please try a shorter question.",
          }));
        throw new Error(
          errorData.detail ||
            "Request too large. Please try asking a shorter question or start a new conversation."
        );
      }
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

// Admin authentication functions

// Register a new admin user
export async function registerAdmin(
  username: string,
  email: string,
  password: string,
  registrationSecret?: string
): Promise<TokenResponse> {
  try {
    const requestData: AdminRegisterRequest = {
      username,
      email,
      password,
      registration_secret: registrationSecret,
    };

    const response = await fetch(`${API_URL}/api/admin/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ detail: "Registration failed" }));
      throw new Error(
        errorData.detail || `Registration failed: ${response.status}`
      );
    }

    const data: TokenResponse = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error) {
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
    throw new Error(
      "Something went wrong during registration. Please try again."
    );
  }
}

// Login as admin
export async function loginAdmin(
  username: string,
  password: string
): Promise<TokenResponse> {
  try {
    const requestData: AdminLoginRequest = {
      username,
      password,
    };

    const response = await fetch(`${API_URL}/api/admin/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ detail: "Login failed" }));
      throw new Error(errorData.detail || `Login failed: ${response.status}`);
    }

    const data: TokenResponse = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error) {
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
    throw new Error("Something went wrong during login. Please try again.");
  }
}

// Get current admin info (requires authentication)
export async function getCurrentAdminInfo(token: string): Promise<AdminInfo> {
  try {
    const response = await fetch(`${API_URL}/api/admin/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Invalid or expired token. Please login again.");
      }
      throw new Error(`Failed to get admin info: ${response.status}`);
    }

    const data: AdminInfo = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error) {
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

// Get pending experiences for admin review
export async function getPendingExperiences(
  token: string,
  status: string = "pending"
): Promise<ExperienceListItem[]> {
  try {
    const response = await fetch(
      `${API_URL}/api/admin/experiences?status=${status}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        // Throw error with 401 in message so we can detect it
        const error = new Error(
          "Invalid or expired token. Please login again."
        );
        (error as any).status = 401;
        throw error;
      }
      throw new Error(`Failed to fetch experiences: ${response.status}`);
    }

    const data: ExperienceListItem[] = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error) {
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

// Approve a user experience
export async function approveExperience(
  token: string,
  experienceId: number
): Promise<void> {
  try {
    const response = await fetch(
      `${API_URL}/api/admin/experiences/${experienceId}/approve`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        const error = new Error(
          "Invalid or expired token. Please login again."
        );
        (error as any).status = 401;
        throw error;
      }
      const errorData = await response
        .json()
        .catch(() => ({ detail: "Failed to approve experience" }));
      throw new Error(
        errorData.detail || `Failed to approve experience: ${response.status}`
      );
    }
  } catch (error) {
    if (error instanceof Error) {
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

// Reject a user experience
export async function rejectExperience(
  token: string,
  experienceId: number
): Promise<void> {
  try {
    const response = await fetch(
      `${API_URL}/api/admin/experiences/${experienceId}/reject`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        const error = new Error(
          "Invalid or expired token. Please login again."
        );
        (error as any).status = 401;
        throw error;
      }
      const errorData = await response
        .json()
        .catch(() => ({ detail: "Failed to reject experience" }));
      throw new Error(
        errorData.detail || `Failed to reject experience: ${response.status}`
      );
    }
  } catch (error) {
    if (error instanceof Error) {
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
