import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

export const hasGemini = Boolean(apiKey);

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

export async function generateText(prompt: string, systemInstruction?: string, maxTokens = 1024): Promise<string> {
  const openai = getClient();
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          ...(systemInstruction ? [{ role: "system" as const, content: systemInstruction }] : []),
          { role: "user" as const, content: prompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.4
      });
      return response.choices[0]?.message?.content?.trim() ?? "";
    } catch (err: unknown) {
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes("429") || err.message.includes("rate limit") || err.message.includes("Rate limit"));

      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = 2000 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw err;
    }
  }

  throw new Error("OpenAI request failed after retries");
}

export async function generateJson(prompt: string): Promise<string> {
  const openai = getClient();
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system" as const, content: "Respond with valid JSON only." },
      { role: "user" as const, content: prompt }
    ],
    response_format: { type: "json_object" },
    max_tokens: 4096,
    temperature: 0.2
  });
  return response.choices[0]?.message?.content?.trim() ?? "{}";
}

export async function generateTextFromPdf(_pdfBase64: string, prompt: string): Promise<string> {
  // OpenAI does not support inline PDF base64; analyze using the prompt context only
  const openai = getClient();
  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: "user" as const, content: prompt }],
    max_tokens: 4096,
    temperature: 0.2
  });
  return response.choices[0]?.message?.content?.trim() ?? "";
}

export function extractJsonFromResponse(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}
