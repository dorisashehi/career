/**
 * API Client for Career Catalyst Backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface AskRequest {
  question: string
  chat_history?: ChatMessage[]
}

export interface AskResponse {
  answer: string
}

export interface ApiError {
  message: string
  status?: number
}

/**
 * Sends a question to the backend /ask endpoint
 * @param question - The user's question
 * @param chatHistory - Previous messages in the conversation
 * @returns The AI's response
 * @throws ApiError if the request fails
 */
export async function askQuestion(
  question: string,
  chatHistory: ChatMessage[] = []
): Promise<string> {
  try {
    console.log("Calling API:", `${API_BASE_URL}/ask`)
    console.log("Request payload:", { question, chat_history: chatHistory })

    const response = await fetch(`${API_BASE_URL}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question,
        chat_history: chatHistory,
      } as AskRequest),
    })

    console.log("Response status:", response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      const errorMessage = `API request failed: ${response.status} ${response.statusText}. ${errorText || "No error details"}`
      console.error("API Error:", errorMessage)
      throw new Error(errorMessage)
    }

    const data: AskResponse = await response.json()
    console.log("API Response:", data)
    return data.answer
  } catch (error) {
    // Handle network errors (CORS, connection refused, etc.)
    if (error instanceof TypeError && error.message.includes("fetch")) {
      const networkError = new Error(
        `Failed to connect to backend API at ${API_BASE_URL}. Make sure the backend server is running.`
      )
      console.error("Network Error:", networkError.message)
      throw networkError
    }

    // Re-throw Error instances as-is
    if (error instanceof Error) {
      console.error("API Error:", error.message)
      throw error
    }

    // Handle unknown errors
    const unknownError = new Error("An unexpected error occurred while calling the API")
    console.error("Unknown Error:", error)
    throw unknownError
  }
}

