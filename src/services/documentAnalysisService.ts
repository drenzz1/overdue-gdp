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

export const defaultDocumentAnalysisProvider: DocumentAnalysisProvider = new TextExtractionProvider();
