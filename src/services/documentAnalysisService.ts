import mammoth from "mammoth";
import { generateTextFromPdf, hasGemini } from "./geminiService.js";

export type DocumentAnalysisResult = {
  extractedText: string;
  metadata: {
    pageCount?: number;
    language?: string;
    provider: string;
  };
};

export interface DocumentAnalysisProvider {
  analyzeDocument(buffer: Buffer, fileName: string, mimeType: string): Promise<DocumentAnalysisResult>;
}

class TextExtractionProvider implements DocumentAnalysisProvider {
  async analyzeDocument(buffer: Buffer, _fileName: string, _mimeType: string): Promise<DocumentAnalysisResult> {
    return {
      extractedText: buffer.toString("utf8"),
      metadata: { provider: "text-extraction" }
    };
  }
}

function isDocx(mimeType: string): boolean {
  return (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  );
}

class GeminiDocumentAnalysisProvider implements DocumentAnalysisProvider {
  async analyzeDocument(buffer: Buffer, _fileName: string, mimeType: string): Promise<DocumentAnalysisResult> {
    if (isDocx(mimeType)) {
      const result = await mammoth.extractRawText({ buffer });
      return {
        extractedText: result.value,
        metadata: { provider: "gemini-mammoth" }
      };
    }

    // PDF — send inline to Gemini for text extraction
    const text = await generateTextFromPdf(
      buffer.toString("base64"),
      "Extract all text from this tender document. Return only the raw extracted text, preserving structure with newlines. Do not summarize or interpret — just extract."
    );

    return {
      extractedText: text,
      metadata: { provider: "gemini-pdf" }
    };
  }
}

export const defaultDocumentAnalysisProvider: DocumentAnalysisProvider = hasGemini
  ? new GeminiDocumentAnalysisProvider()
  : new TextExtractionProvider();
