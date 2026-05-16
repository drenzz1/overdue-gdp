import { GoogleGenAI } from "@google/genai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
const vertexModel = process.env.VERTEX_MODEL ?? "gemini-2.5-flash";
const apiKey = process.env.GEMINI_API_KEY ?? "";

export const hasGemini = Boolean(project) || apiKey.length > 0;

// Vertex AI client (preferred when GOOGLE_CLOUD_PROJECT is set)
let vertexClient: GoogleGenAI | null = null;

function getVertexClient(): GoogleGenAI {
  if (!vertexClient) {
    vertexClient = new GoogleGenAI({ vertexai: true, project: project!, location });
  }
  return vertexClient;
}

export async function generateText(prompt: string, systemInstruction?: string): Promise<string> {
  if (project) {
    const ai = getVertexClient();
    const result = await ai.models.generateContent({
      model: vertexModel,
      contents: prompt,
      config: {
        maxOutputTokens: 2048,
        temperature: 0.4,
        ...(systemInstruction ? { systemInstruction } : {})
      }
    });
    return String(result.text ?? "").trim();
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(
    systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt
  );
  return result.response.text().trim();
}

export async function generateJson(prompt: string): Promise<string> {
  if (project) {
    const ai = getVertexClient();
    const result = await ai.models.generateContent({
      model: vertexModel,
      contents: prompt,
      config: { maxOutputTokens: 4096, temperature: 0.2, responseMimeType: "application/json" }
    });
    return String(result.text ?? "").trim();
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" }
  });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

export async function generateTextFromPdf(pdfBase64: string, prompt: string): Promise<string> {
  if (project) {
    const ai = getVertexClient();
    const result = await ai.models.generateContent({
      model: vertexModel,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: pdfBase64, mimeType: "application/pdf" } },
            { text: prompt }
          ]
        }
      ],
      config: { maxOutputTokens: 4096, temperature: 0.2 }
    });
    return String(result.text ?? "").trim();
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent([
    { inlineData: { data: pdfBase64, mimeType: "application/pdf" } },
    prompt
  ]);
  return result.response.text().trim();
}

export function extractJsonFromResponse(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}
