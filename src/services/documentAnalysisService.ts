import { createRequire } from "module";
import mammoth from "mammoth";
import { hasGemini } from "./geminiService.js";

// pdf-parse v1 is CJS-only; use createRequire for ESM interop
const require = createRequire(import.meta.url);
type PdfParseResult = { text: string; numpages: number };
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<PdfParseResult>;

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

    // PDF — extract text locally with pdf-parse
    const parsed = await pdfParse(buffer);
    return {
      extractedText: parsed.text,
      metadata: { pageCount: parsed.numpages, provider: "pdf-parse" }
    };
  }
}

export const defaultDocumentAnalysisProvider: DocumentAnalysisProvider = hasGemini
  ? new GeminiDocumentAnalysisProvider()
  : new TextExtractionProvider();
