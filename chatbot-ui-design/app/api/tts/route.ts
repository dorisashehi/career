import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // Get Google Cloud credentials from environment variable
    const credentials = process.env.GOOGLE_CLOUD_CREDENTIALS;
    if (!credentials) {
      console.error("GOOGLE_CLOUD_CREDENTIALS environment variable is not set");
      return NextResponse.json(
        {
          error: "Google Cloud credentials not configured",
          message: "Please set GOOGLE_CLOUD_CREDENTIALS environment variable. See GOOGLE_CLOUD_SETUP.md for instructions.",
        },
        { status: 500 }
      );
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(credentials);
      // Validate that it has required fields
      const missingFields = [];
      if (!serviceAccount.project_id) missingFields.push("project_id");
      if (!serviceAccount.private_key) missingFields.push("private_key");
      if (!serviceAccount.client_email) missingFields.push("client_email");

      if (missingFields.length > 0) {
        throw new Error(
          `Missing required fields in service account JSON: ${missingFields.join(", ")}. ` +
          `Make sure your .env.local file contains the complete JSON from your Google Cloud service account key file.`
        );
      }
    } catch (e: any) {
      console.error("Failed to parse GOOGLE_CLOUD_CREDENTIALS:", e.message);
      console.error("Credentials length:", credentials?.length || 0);
      console.error("First 100 chars:", credentials?.substring(0, 100) || "N/A");

      let errorMessage = e.message;
      if (e.message.includes("Unexpected token") || e.message.includes("JSON")) {
        errorMessage =
          "Invalid JSON format. Make sure the JSON is properly formatted and on a single line. " +
          "If your JSON has newlines, you need to escape them or use single quotes around the entire JSON string.";
      }

      return NextResponse.json(
        {
          error: "Invalid Google Cloud credentials format",
          message: errorMessage || "The credentials JSON is malformed. Please check your .env.local file.",
          hint: "Your .env.local file should look like: GOOGLE_CLOUD_CREDENTIALS='{\"type\":\"service_account\",...}' (entire JSON on one line)",
        },
        { status: 500 }
      );
    }

    // Import @google-cloud/text-to-speech dynamically
    const { TextToSpeechClient } = await import("@google-cloud/text-to-speech");

    // Initialize the client
    const client = new TextToSpeechClient({
      credentials: serviceAccount,
    });

    // Configure the request
    const requestConfig = {
      input: { text },
      voice: {
        languageCode: "en-US",
        name: "en-US-Neural2-F", // High-quality neural voice
        ssmlGender: "FEMALE" as const,
      },
      audioConfig: {
        audioEncoding: "MP3" as const,
        speakingRate: 1.0,
        pitch: 0,
        volumeGainDb: 0,
      },
    };

    // Perform the text-to-speech request
    let response;
    try {
      [response] = await client.synthesizeSpeech(requestConfig);
    } catch (apiError: any) {
      console.error("Google Cloud TTS API Error:", apiError);
      const errorMessage = apiError.message || "Unknown API error";
      // Check for common errors
      if (errorMessage.includes("PERMISSION_DENIED") || errorMessage.includes("403")) {
        return NextResponse.json(
          {
            error: "Permission denied",
            message: "The service account doesn't have permission to use Text-to-Speech API. Please check the service account roles.",
          },
          { status: 403 }
        );
      }
      if (errorMessage.includes("API not enabled") || errorMessage.includes("not enabled")) {
        return NextResponse.json(
          {
            error: "API not enabled",
            message: "Cloud Text-to-Speech API is not enabled for this project. Please enable it in Google Cloud Console.",
          },
          { status: 400 }
        );
      }
      throw apiError; // Re-throw to be caught by outer catch
    }

    if (!response.audioContent) {
      return NextResponse.json(
        { error: "No audio content received" },
        { status: 500 }
      );
    }

    // Convert audio content to base64
    const audioBase64 = Buffer.from(response.audioContent).toString("base64");

    return NextResponse.json({
      audio: audioBase64,
      format: "mp3",
    });
  } catch (error: any) {
    console.error("TTS Error:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      status: error.status,
      stack: error.stack,
    });
    return NextResponse.json(
      {
        error: "Failed to generate speech",
        message: error.message || "Unknown error",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
