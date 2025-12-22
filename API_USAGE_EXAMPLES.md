# API Usage Examples

This document provides practical examples for using the CareerPath API. All examples assume the API is running at `http://localhost:8000` (development) or your production URL.

## Table of Contents

1. [Authentication](#authentication)
2. [Chat Endpoints](#chat-endpoints)
3. [Experience Submission](#experience-submission)
4. [Admin Endpoints](#admin-endpoints)
5. [Error Handling](#error-handling)
6. [Complete Examples](#complete-examples)

---

## Authentication

### Admin Registration

Register a new admin account. Requires a registration secret if configured.

#### cURL

```bash
curl -X POST "http://localhost:8000/api/admin/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin_user",
    "email": "admin@example.com",
    "password": "secure_password_123",
    "registration_secret": "your_secret_key"
  }'
```

#### Python

```python
import requests

url = "http://localhost:8000/api/admin/register"
payload = {
    "username": "admin_user",
    "email": "admin@example.com",
    "password": "secure_password_123",
    "registration_secret": "your_secret_key"  # Optional if not configured
}

response = requests.post(url, json=payload)
data = response.json()

if response.status_code == 200:
    access_token = data["access_token"]
    print(f"Registration successful! Token: {access_token}")
else:
    print(f"Error: {data.get('detail', 'Unknown error')}")
```

#### JavaScript/TypeScript

```typescript
const registerAdmin = async () => {
  const response = await fetch("http://localhost:8000/api/admin/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "admin_user",
      email: "admin@example.com",
      password: "secure_password_123",
      registration_secret: "your_secret_key", // Optional
    }),
  });

  const data = await response.json();

  if (response.ok) {
    const accessToken = data.access_token;
    console.log("Registration successful!", accessToken);
    return accessToken;
  } else {
    console.error("Registration failed:", data.detail);
    throw new Error(data.detail);
  }
};
```

### Admin Login

Authenticate and receive a JWT token.

#### cURL

```bash
curl -X POST "http://localhost:8000/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin_user",
    "password": "secure_password_123"
  }'
```

#### Python

```python
import requests

url = "http://localhost:8000/api/admin/login"
payload = {
    "username": "admin_user",
    "password": "secure_password_123"
}

response = requests.post(url, json=payload)
data = response.json()

if response.status_code == 200:
    access_token = data["access_token"]
    print(f"Login successful! Token: {access_token}")
    # Store token for subsequent requests
    headers = {"Authorization": f"Bearer {access_token}"}
else:
    print(f"Error: {data.get('detail', 'Invalid credentials')}")
```

#### JavaScript/TypeScript

```typescript
const loginAdmin = async (username: string, password: string) => {
  const response = await fetch("http://localhost:8000/api/admin/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();

  if (response.ok) {
    const accessToken = data.access_token;
    // Store in localStorage or memory
    localStorage.setItem("admin_token", accessToken);
    return accessToken;
  } else {
    throw new Error(data.detail || "Login failed");
  }
};
```

### Using the Token

Include the JWT token in the `Authorization` header for protected endpoints.

#### cURL

```bash
TOKEN="your_jwt_token_here"

curl -X GET "http://localhost:8000/api/admin/me" \
  -H "Authorization: Bearer $TOKEN"
```

#### Python

```python
import requests

token = "your_jwt_token_here"
headers = {"Authorization": f"Bearer {token}"}

response = requests.get("http://localhost:8000/api/admin/me", headers=headers)
data = response.json()
print(data)
```

#### JavaScript/TypeScript

```typescript
const getAdminInfo = async (token: string) => {
  const response = await fetch("http://localhost:8000/api/admin/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get admin info");
  }

  return await response.json();
};
```

---

## Chat Endpoints

### Ask a Question

Ask a career-related question to the chatbot. This endpoint is public and doesn't require authentication.

#### Basic Question (cURL)

```bash
curl -X POST "http://localhost:8000/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How do I prepare for a software engineering interview?",
    "chat_history": []
  }'
```

#### With Chat History (cURL)

```bash
curl -X POST "http://localhost:8000/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What about system design questions?",
    "chat_history": [
      {
        "role": "user",
        "content": "How do I prepare for a software engineering interview?"
      },
      {
        "role": "assistant",
        "content": "To prepare for a software engineering interview, focus on..."
      }
    ]
  }'
```

#### Python

```python
import requests

def ask_question(question: str, chat_history: list = None):
    url = "http://localhost:8000/ask"
    payload = {
        "question": question,
        "chat_history": chat_history or []
    }

    response = requests.post(url, json=payload)
    data = response.json()

    if response.status_code == 200:
        answer = data["answer"]
        sources = data["sources"]

        print(f"Answer: {answer}\n")
        print(f"Sources ({len(sources)}):")
        for source in sources:
            if source.get("url"):
                print(f"  - {source['url']} (Score: {source.get('score', 'N/A')})")
            else:
                print(f"  - User Experience ID: {source.get('post_id', 'N/A')}")

        return data
    else:
        print(f"Error: {data.get('detail', 'Unknown error')}")
        return None

# Example usage
result = ask_question("What are the best practices for salary negotiation?")
```

#### JavaScript/TypeScript

```typescript
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AskResponse {
  answer: string;
  sources: Array<{
    url?: string;
    post_id?: string;
    source?: string;
    date?: string;
    score?: number;
    num_comments?: number;
  }>;
}

const askQuestion = async (
  question: string,
  chatHistory: ChatMessage[] = []
): Promise<AskResponse> => {
  const response = await fetch("http://localhost:8000/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
      chat_history: chatHistory,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to get answer");
  }

  return await response.json();
};

// Example usage
const result = await askQuestion("How do I negotiate a higher salary?");
console.log("Answer:", result.answer);
console.log("Sources:", result.sources);
```

#### React Hook Example

```typescript
import { useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const askQuestion = async (question: string) => {
    setLoading(true);
    setError(null);

    // Add user message
    const userMessage: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch("http://localhost:8000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          chat_history: messages,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get answer");
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.answer,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { messages, loading, error, askQuestion };
};
```

---

## Experience Submission

### Submit an Experience

Submit a user experience for review. This endpoint is public.

#### cURL

```bash
curl -X POST "http://localhost:8000/api/experiences" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "interview",
    "description": "I recently interviewed at a tech company and wanted to share my experience. The process involved multiple rounds including technical coding challenges, system design, and behavioral interviews. The interviewers were professional and the questions were challenging but fair."
  }'
```

#### Python

```python
import requests

def submit_experience(category: str, description: str):
    url = "http://localhost:8000/api/experiences"
    payload = {
        "category": category,
        "description": description
    }

    response = requests.post(url, json=payload)
    data = response.json()

    if response.status_code == 200:
        print(f"Experience submitted successfully!")
        print(f"ID: {data['id']}")
        print(f"Status: {data['status']}")
        print(f"Message: {data['message']}")
        return data
    else:
        print(f"Error: {data.get('detail', 'Unknown error')}")
        return None

# Example usage
submit_experience(
    category="job-search",
    description="I spent 3 months searching for a software engineering role. Here are the key lessons I learned: 1) Tailor your resume for each application, 2) Network actively on LinkedIn, 3) Practice coding problems daily, 4) Prepare for behavioral questions. I received 5 offers after applying to 50+ companies."
)
```

#### JavaScript/TypeScript

```typescript
interface ExperienceRequest {
  category: string;
  description: string;
}

interface ExperienceResponse {
  id: number;
  status: string;
  message: string;
}

const submitExperience = async (
  category: string,
  description: string
): Promise<ExperienceResponse> => {
  const response = await fetch("http://localhost:8000/api/experiences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      category,
      description,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to submit experience");
  }

  return await response.json();
};

// Example usage
try {
  const result = await submitExperience(
    "career-advice",
    "After 5 years in the industry, here is my advice for junior developers: Focus on learning fundamentals, contribute to open source, build side projects, and don't be afraid to ask questions. Mentorship is crucial for growth."
  );
  console.log("Submitted:", result);
} catch (error) {
  console.error("Error:", error);
}
```

#### Available Categories

- `interview`
- `job-search`
- `career-advice`
- `salary-negotiation`
- `workplace-issues`
- `career-transition`
- `professional-development`
- `other`

---

## Admin Endpoints

All admin endpoints require JWT authentication. Include the token in the `Authorization` header.

### Get Current Admin Info

#### cURL

```bash
TOKEN="your_jwt_token_here"

curl -X GET "http://localhost:8000/api/admin/me" \
  -H "Authorization: Bearer $TOKEN"
```

#### Python

```python
import requests

def get_admin_info(token: str):
    url = "http://localhost:8000/api/admin/me"
    headers = {"Authorization": f"Bearer {token}"}

    response = requests.get(url, headers=headers)
    data = response.json()

    if response.status_code == 200:
        print(f"Admin ID: {data['id']}")
        print(f"Username: {data['username']}")
        print(f"Email: {data['email']}")
        return data
    else:
        print(f"Error: {data.get('detail', 'Unknown error')}")
        return None
```

### List Experiences for Review

Get experiences filtered by status (pending, approved, rejected).

#### cURL

```bash
TOKEN="your_jwt_token_here"

# Get pending experiences
curl -X GET "http://localhost:8000/api/admin/experiences?status=pending" \
  -H "Authorization: Bearer $TOKEN"

# Get approved experiences
curl -X GET "http://localhost:8000/api/admin/experiences?status=approved" \
  -H "Authorization: Bearer $TOKEN"
```

#### Python

```python
import requests

def get_experiences(token: str, status: str = "pending"):
    url = f"http://localhost:8000/api/admin/experiences"
    headers = {"Authorization": f"Bearer {token}"}
    params = {"status": status}

    response = requests.get(url, headers=headers, params=params)
    data = response.json()

    if response.status_code == 200:
        print(f"Found {len(data)} {status} experiences:")
        for exp in data:
            print(f"\nID: {exp['id']}")
            print(f"Title: {exp.get('title', 'N/A')}")
            print(f"Type: {exp.get('experience_type', 'N/A')}")
            print(f"Status: {exp['status']}")
            if exp.get('severity'):
                print(f"Severity: {exp['severity']}")
            if exp.get('flagged_reason'):
                print(f"Flagged Reason: {exp['flagged_reason']}")
            print(f"Text: {exp['text'][:100]}...")
        return data
    else:
        print(f"Error: {data.get('detail', 'Unknown error')}")
        return None

# Example usage
token = "your_jwt_token_here"
pending_experiences = get_experiences(token, "pending")
```

#### JavaScript/TypeScript

```typescript
interface ExperienceListItem {
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

const getExperiences = async (
  token: string,
  status: "pending" | "approved" | "rejected" = "pending"
): Promise<ExperienceListItem[]> => {
  const response = await fetch(
    `http://localhost:8000/api/admin/experiences?status=${status}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to get experiences");
  }

  return await response.json();
};
```

### Approve an Experience

#### cURL

```bash
TOKEN="your_jwt_token_here"
EXPERIENCE_ID=123

curl -X PUT "http://localhost:8000/api/admin/experiences/$EXPERIENCE_ID/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

#### Python

```python
import requests

def approve_experience(token: str, experience_id: int):
    url = f"http://localhost:8000/api/admin/experiences/{experience_id}/approve"
    headers = {"Authorization": f"Bearer {token}"}

    response = requests.put(url, headers=headers)
    data = response.json()

    if response.status_code == 200:
        print(f"Experience {data['id']} approved successfully!")
        print(f"Status: {data['status']}")
        print(f"Message: {data['message']}")
        return data
    else:
        print(f"Error: {data.get('detail', 'Unknown error')}")
        return None

# Example usage
token = "your_jwt_token_here"
approve_experience(token, 123)
```

#### JavaScript/TypeScript

```typescript
const approveExperience = async (
  token: string,
  experienceId: number
): Promise<{ id: number; status: string; message: string }> => {
  const response = await fetch(
    `http://localhost:8000/api/admin/experiences/${experienceId}/approve`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to approve experience");
  }

  return await response.json();
};
```

### Reject an Experience

#### cURL

```bash
TOKEN="your_jwt_token_here"
EXPERIENCE_ID=123

curl -X PUT "http://localhost:8000/api/admin/experiences/$EXPERIENCE_ID/reject" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

#### Python

```python
import requests

def reject_experience(token: str, experience_id: int):
    url = f"http://localhost:8000/api/admin/experiences/{experience_id}/reject"
    headers = {"Authorization": f"Bearer {token}"}

    response = requests.put(url, headers=headers)
    data = response.json()

    if response.status_code == 200:
        print(f"Experience {data['id']} rejected successfully!")
        print(f"Status: {data['status']}")
        print(f"Message: {data['message']}")
        return data
    else:
        print(f"Error: {data.get('detail', 'Unknown error')}")
        return None

# Example usage
token = "your_jwt_token_here"
reject_experience(token, 123)
```

#### JavaScript/TypeScript

```typescript
const rejectExperience = async (
  token: string,
  experienceId: number
): Promise<{ id: number; status: string; message: string }> => {
  const response = await fetch(
    `http://localhost:8000/api/admin/experiences/${experienceId}/reject`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to reject experience");
  }

  return await response.json();
};
```

---

## Error Handling

### Common Error Responses

All errors follow a consistent format:

```json
{
  "detail": "Error message here"
}
```

### HTTP Status Codes

- `200 OK`: Request successful
- `400 Bad Request`: Invalid input (e.g., missing fields, description too short)
- `401 Unauthorized`: Invalid or missing authentication token
- `403 Forbidden`: Invalid registration secret or insufficient permissions
- `404 Not Found`: Resource not found (e.g., experience ID doesn't exist)
- `413 Payload Too Large`: Request too large (e.g., question too long)
- `500 Internal Server Error`: Server error

### Python Error Handling Example

```python
import requests
from requests.exceptions import RequestException

def handle_api_request(url, method="GET", headers=None, json_data=None):
    try:
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=json_data)
        elif method == "PUT":
            response = requests.put(url, headers=headers)

        response.raise_for_status()  # Raises exception for 4xx/5xx status codes
        return response.json()

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            print("Authentication failed. Please check your token.")
        elif e.response.status_code == 404:
            print("Resource not found.")
        elif e.response.status_code == 400:
            error_detail = e.response.json().get("detail", "Bad request")
            print(f"Invalid request: {error_detail}")
        else:
            print(f"HTTP Error {e.response.status_code}: {e}")
        return None

    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None
```

### JavaScript/TypeScript Error Handling Example

```typescript
class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public detail?: string
  ) {
    super(message);
    this.name = "APIError";
  }
}

const handleApiRequest = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(
        response.status,
        errorData.detail || `HTTP ${response.status}`,
        errorData.detail
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof APIError) {
      // Handle specific API errors
      switch (error.statusCode) {
        case 401:
          console.error("Authentication failed. Please login again.");
          // Redirect to login or refresh token
          break;
        case 404:
          console.error("Resource not found.");
          break;
        case 400:
          console.error("Invalid request:", error.detail);
          break;
        default:
          console.error("API Error:", error.message);
      }
      throw error;
    }
    // Handle network errors
    console.error("Network error:", error);
    throw error;
  }
};
```

---

## Complete Examples

### Example 1: Complete Chat Flow (Python)

```python
import requests
from typing import List, Dict

class CareerPathClient:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.chat_history: List[Dict[str, str]] = []

    def ask(self, question: str) -> Dict:
        """Ask a question and maintain chat history."""
        url = f"{self.base_url}/ask"
        payload = {
            "question": question,
            "chat_history": self.chat_history
        }

        response = requests.post(url, json=payload)
        response.raise_for_status()
        data = response.json()

        # Update chat history
        self.chat_history.append({"role": "user", "content": question})
        self.chat_history.append({"role": "assistant", "content": data["answer"]})

        return data

    def clear_history(self):
        """Clear chat history."""
        self.chat_history = []

# Usage
client = CareerPathClient()

# First question
result1 = client.ask("How do I prepare for a technical interview?")
print(f"Answer: {result1['answer']}\n")

# Follow-up question (uses chat history)
result2 = client.ask("What about system design questions specifically?")
print(f"Answer: {result2['answer']}\n")

# Clear history and start fresh
client.clear_history()
result3 = client.ask("What are the best practices for salary negotiation?")
print(f"Answer: {result3['answer']}\n")
```

### Example 2: Admin Workflow (Python)

```python
import requests
from typing import Optional

class AdminClient:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.token: Optional[str] = None

    def login(self, username: str, password: str) -> bool:
        """Login and store token."""
        url = f"{self.base_url}/api/admin/login"
        payload = {"username": username, "password": password}

        response = requests.post(url, json=payload)
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            return True
        return False

    def get_pending_experiences(self) -> list:
        """Get all pending experiences."""
        if not self.token:
            raise ValueError("Not authenticated. Call login() first.")

        url = f"{self.base_url}/api/admin/experiences"
        headers = {"Authorization": f"Bearer {self.token}"}
        params = {"status": "pending"}

        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()

    def approve_experience(self, experience_id: int) -> dict:
        """Approve an experience."""
        if not self.token:
            raise ValueError("Not authenticated. Call login() first.")

        url = f"{self.base_url}/api/admin/experiences/{experience_id}/approve"
        headers = {"Authorization": f"Bearer {self.token}"}

        response = requests.put(url, headers=headers)
        response.raise_for_status()
        return response.json()

    def reject_experience(self, experience_id: int) -> dict:
        """Reject an experience."""
        if not self.token:
            raise ValueError("Not authenticated. Call login() first.")

        url = f"{self.base_url}/api/admin/experiences/{experience_id}/reject"
        headers = {"Authorization": f"Bearer {self.token}"}

        response = requests.put(url, headers=headers)
        response.raise_for_status()
        return response.json()

# Usage
admin = AdminClient()

# Login
if admin.login("admin_user", "password"):
    print("Logged in successfully!")

    # Get pending experiences
    pending = admin.get_pending_experiences()
    print(f"Found {len(pending)} pending experiences")

    # Review and approve/reject
    for exp in pending:
        print(f"\nReviewing experience {exp['id']}:")
        print(f"Type: {exp.get('experience_type')}")
        print(f"Text: {exp['text'][:200]}...")

        # Example: Approve if no severity flags
        if not exp.get('severity'):
            result = admin.approve_experience(exp['id'])
            print(f"Approved: {result['message']}")
        else:
            print(f"Flagged with severity: {exp['severity']}")
            # Manual review needed
```

### Example 3: React Component for Chat

```typescript
import React, { useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    url?: string;
    post_id?: string;
    source?: string;
  }>;
}

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const chatHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("http://localhost:8000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: userMessage.content,
          chat_history: chatHistory,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get answer");
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.answer,
        sources: data.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <p>{msg.content}</p>
            {msg.sources && msg.sources.length > 0 && (
              <div className="sources">
                <strong>Sources:</strong>
                {msg.sources.map((source, i) => (
                  <div key={i}>
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {source.url}
                      </a>
                    ) : (
                      <span>User Experience #{source.post_id}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask a career question..."
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
};
```

### Example 4: Batch Experience Submission (Python)

```python
import requests
import time
from typing import List, Dict

def submit_experiences_batch(experiences: List[Dict[str, str]]):
    """Submit multiple experiences with rate limiting."""
    url = "http://localhost:8000/api/experiences"
    results = []

    for i, exp in enumerate(experiences):
        try:
            response = requests.post(url, json=exp)
            if response.status_code == 200:
                data = response.json()
                results.append({"success": True, "id": data["id"], "exp": exp})
                print(f"✓ Submitted: {exp['category']} (ID: {data['id']})")
            else:
                error = response.json().get("detail", "Unknown error")
                results.append({"success": False, "error": error, "exp": exp})
                print(f"✗ Failed: {exp['category']} - {error}")
        except Exception as e:
            results.append({"success": False, "error": str(e), "exp": exp})
            print(f"✗ Error: {exp['category']} - {e}")

        # Rate limiting: wait 1 second between requests
        if i < len(experiences) - 1:
            time.sleep(1)

    return results

# Usage
experiences = [
    {
        "category": "interview",
        "description": "I had a great interview experience at Company X. The process was smooth and the interviewers were helpful."
    },
    {
        "category": "job-search",
        "description": "After 3 months of searching, I finally landed my dream job. Key tip: customize your resume for each application."
    },
    {
        "category": "career-advice",
        "description": "For junior developers: focus on fundamentals, build projects, and don't be afraid to ask questions."
    }
]

results = submit_experiences_batch(experiences)
print(f"\nSubmitted {sum(1 for r in results if r['success'])}/{len(experiences)} experiences")
```

---

## Testing with Postman

### Import Collection

You can import these endpoints into Postman:

1. **Create a new collection**: "CareerPath API"
2. **Set collection variable**: `base_url` = `http://localhost:8000`
3. **Set collection variable**: `token` = (leave empty, will be set after login)

### Example Postman Requests

#### 1. Admin Login

- **Method**: POST
- **URL**: `{{base_url}}/api/admin/login`
- **Body** (raw JSON):

```json
{
  "username": "admin_user",
  "password": "password"
}
```

- **Tests** (to save token):

```javascript
if (pm.response.code === 200) {
  const jsonData = pm.response.json();
  pm.collectionVariables.set("token", jsonData.access_token);
}
```

#### 2. Ask Question

- **Method**: POST
- **URL**: `{{base_url}}/ask`
- **Body** (raw JSON):

```json
{
  "question": "How do I prepare for interviews?",
  "chat_history": []
}
```

#### 3. Get Pending Experiences

- **Method**: GET
- **URL**: `{{base_url}}/api/admin/experiences?status=pending`
- **Headers**: `Authorization: Bearer {{token}}`

---

## Rate Limiting & Best Practices

### Rate Limiting

Currently, the API does not enforce strict rate limiting, but consider:

- **Chat requests**: Limit to reasonable frequency (e.g., 1 request per second)
- **Experience submissions**: Batch submissions with delays
- **Admin operations**: No specific limits, but use responsibly

### Best Practices

1. **Store tokens securely**: Never commit tokens to version control
2. **Handle errors gracefully**: Always check response status codes
3. **Use connection pooling**: For high-volume applications
4. **Cache responses**: When appropriate (e.g., admin info)
5. **Validate input client-side**: Before sending to API
6. **Use HTTPS in production**: Never send tokens over HTTP
7. **Implement retry logic**: For transient failures

### Example: Retry Logic (Python)

```python
import requests
import time
from typing import Optional

def api_request_with_retry(
    url: str,
    method: str = "GET",
    max_retries: int = 3,
    retry_delay: float = 1.0,
    **kwargs
) -> Optional[dict]:
    """Make API request with automatic retry on failure."""
    for attempt in range(max_retries):
        try:
            if method == "GET":
                response = requests.get(url, **kwargs)
            elif method == "POST":
                response = requests.post(url, **kwargs)
            elif method == "PUT":
                response = requests.put(url, **kwargs)

            response.raise_for_status()
            return response.json()

        except requests.exceptions.HTTPError as e:
            # Don't retry on client errors (4xx)
            if 400 <= e.response.status_code < 500:
                raise
            # Retry on server errors (5xx)
            if attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))
                continue
            raise

        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))
                continue
            raise

    return None
```

---

## Additional Resources

- **API Documentation**: Visit `/docs` for interactive Swagger UI
- **ReDoc Documentation**: Visit `/redoc` for alternative documentation
- **OpenAPI Schema**: Available at `/openapi.json`

---

**Last Updated**: 2024
**API Version**: 1.0.0
