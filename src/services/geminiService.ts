import { GoogleGenAI } from "@google/genai";

const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
const model = process.env.VERTEX_MODEL || "gemini-2.5-flash";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!project) {
    throw new Error("GOOGLE_CLOUD_PROJECT is not set");
  }
  if (!client) {
    client = new GoogleGenAI({ vertexai: true, project, location });
  }
  return client;
}

export async function generateText(prompt: string, systemInstruction?: string): Promise<string> {
  const ai = getClient();
  const result = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      maxOutputTokens: 1024,
      temperature: 0.4,
      ...(systemInstruction ? { systemInstruction } : {})
    }
  });
  return String(result.text ?? "").trim();
}
