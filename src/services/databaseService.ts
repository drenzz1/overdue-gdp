import { prisma } from "../db/prisma.js";
import { getSampleAnalysis } from "./tenderService.js";
import type { AnalysisResult, DatabaseStatus, TenderDashboardItem } from "../types.js";

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  if (!isDatabaseConfigured()) {
    return {
      configured: false,
      connected: false,
      message: "DATABASE_URL is not configured. Set it to enable persisted tender data."
    };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      configured: true,
      connected: true,
      message: "Connected to PostgreSQL."
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      message: error instanceof Error ? error.message : "Unable to connect to PostgreSQL."
    };
  }
}

export async function listTenderDashboardItems(): Promise<TenderDashboardItem[]> {
  if (!isDatabaseConfigured()) return [];

  const tenders = await prisma.tender.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: 10,
    include: {
      documents: true,
      scores: {
        orderBy: {
          createdAt: "desc"
        },
        take: 1
      }
    }
  });

  return tenders.map((tender) => ({
    id: tender.id,
    title: tender.title,
    buyer: tender.buyer,
    status: tender.status,
    deadline: tender.deadline?.toISOString() ?? null,
    score: tender.scores[0]?.total ?? null,
    missingDocuments: tender.documents.filter((document) => document.status !== "READY").length,
    createdAt: tender.createdAt.toISOString()
  }));
}

export async function persistAnalysisResult(analysis: AnalysisResult) {
  if (!isDatabaseConfigured()) {
    return undefined;
  }

  const tender = analysis.tender;
  const deadline = parseTenderDeadline(tender.deadline);

  const savedTender = await prisma.tender.create({
    data: {
      title: tender.title,
      buyer: tender.buyer,
      ...(tender.region ? { region: tender.region } : {}),
      ...(deadline ? { deadline } : {}),
      ...(tender.value ? { value: tender.value } : {}),
      ...(tender.language ? { language: tender.language } : {}),
      ...(tender.channel ? { channel: tender.channel } : {}),
      sourceFileName: analysis.source,
      extractionReview: analysis.reviewItems,
      status: "ANALYZED",
      rawExtraction: analysis as unknown as object,
      requirements: {
        create: tender.criteria.map((criterion) => ({
          type: "ELIGIBILITY",
          text: criterion,
          confidence: 0.75
        }))
      },
      documents: {
        create: tender.documents.map((document) => ({
          name: document.name,
          owner: document.owner,
          status: document.ready ? "READY" : document.reviewReason ? "REVIEW" : "MISSING",
          ...(document.evidence ? { evidence: document.evidence } : {}),
          ...(document.reviewReason ? { reviewReason: document.reviewReason } : {})
        }))
      },
      weights: {
        create: tender.weights.map((weight) => ({
          label: weight.label,
          points: weight.value
        }))
      },
      gaps: {
        create: analysis.gapAnalysis.map((item) => ({
          documentName: item.documentName,
          owner: item.owner,
          status: item.status === "ready" ? "READY" : item.status === "review" ? "REVIEW" : "MISSING",
          severity: item.severity.toUpperCase() as "LOW" | "MEDIUM" | "HIGH",
          reason: item.reason,
          recommendation: item.recommendation,
          ...(item.evidence ? { evidence: item.evidence } : {})
        }))
      },
      scores: {
        create: {
          total: analysis.score,
          explanation: `Estimated tender score is ${analysis.score}/100.`,
          factors: {
            deadlineRisk: analysis.deadlineRisk,
            missingDocuments: analysis.missingDocuments.length
          }
        }
      }
    }
  });

  return savedTender.id;
}

export async function seedDemoTender() {
  const analysis = getSampleAnalysis();
  const id = await persistAnalysisResult(analysis);

  if (!id) {
    throw new Error("Database is not configured.");
  }

  return id;
}

function parseTenderDeadline(value: string) {
  const parsed = new Date(value.replace(" CET", "+01:00"));
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}
