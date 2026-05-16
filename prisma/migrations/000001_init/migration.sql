CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "TenderStatus" AS ENUM ('UPLOADED', 'ANALYZING', 'ANALYZED', 'DRAFTING', 'SUBMITTED', 'ARCHIVED');
CREATE TYPE "RequirementType" AS ENUM ('ELIGIBILITY', 'TECHNICAL', 'FINANCIAL', 'LEGAL', 'DEADLINE', 'SCORING');
CREATE TYPE "DocumentStatus" AS ENUM ('READY', 'MISSING', 'REVIEW');
CREATE TYPE "GapSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "DraftType" AS ENUM ('SUMMARY', 'TECHNICAL', 'TEAM');

CREATE TABLE "companies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "region" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "fileUrl" TEXT,
  "content" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_document_chunks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyDocumentId" UUID NOT NULL,
  "content" TEXT NOT NULL,
  "tokenCount" INTEGER,
  "metadata" JSONB,
  "embedding" vector(1536),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_document_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID,
  "title" TEXT NOT NULL,
  "buyer" TEXT NOT NULL,
  "region" TEXT,
  "deadline" TIMESTAMP(3),
  "value" TEXT,
  "language" TEXT,
  "channel" TEXT,
  "sourceFileName" TEXT,
  "sourceFileUrl" TEXT,
  "sourceFileSize" INTEGER,
  "extractionReview" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "TenderStatus" NOT NULL DEFAULT 'UPLOADED',
  "rawExtraction" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tender_requirements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenderId" UUID NOT NULL,
  "type" "RequirementType" NOT NULL,
  "text" TEXT NOT NULL,
  "source" TEXT,
  "confidence" DOUBLE PRECISION,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tender_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tender_required_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenderId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "status" "DocumentStatus" NOT NULL DEFAULT 'REVIEW',
  "evidence" TEXT,
  "reviewReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tender_required_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tender_scoring_weights" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenderId" UUID NOT NULL,
  "label" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tender_scoring_weights_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tender_gap_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenderId" UUID NOT NULL,
  "documentName" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "status" "DocumentStatus" NOT NULL,
  "severity" "GapSeverity" NOT NULL,
  "reason" TEXT NOT NULL,
  "recommendation" TEXT NOT NULL,
  "evidence" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tender_gap_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bid_drafts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenderId" UUID NOT NULL,
  "type" "DraftType" NOT NULL,
  "content" TEXT NOT NULL,
  "model" TEXT,
  "promptMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bid_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bid_scores" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenderId" UUID NOT NULL,
  "total" INTEGER NOT NULL,
  "explanation" TEXT,
  "factors" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bid_scores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_documents_companyId_idx" ON "company_documents"("companyId");
CREATE INDEX "company_document_chunks_companyDocumentId_idx" ON "company_document_chunks"("companyDocumentId");
CREATE INDEX "tenders_companyId_idx" ON "tenders"("companyId");
CREATE INDEX "tenders_status_idx" ON "tenders"("status");
CREATE INDEX "tenders_deadline_idx" ON "tenders"("deadline");
CREATE INDEX "tender_requirements_tenderId_idx" ON "tender_requirements"("tenderId");
CREATE INDEX "tender_requirements_type_idx" ON "tender_requirements"("type");
CREATE INDEX "tender_required_documents_tenderId_idx" ON "tender_required_documents"("tenderId");
CREATE INDEX "tender_required_documents_status_idx" ON "tender_required_documents"("status");
CREATE INDEX "tender_scoring_weights_tenderId_idx" ON "tender_scoring_weights"("tenderId");
CREATE INDEX "tender_gap_items_tenderId_idx" ON "tender_gap_items"("tenderId");
CREATE INDEX "tender_gap_items_status_idx" ON "tender_gap_items"("status");
CREATE INDEX "tender_gap_items_severity_idx" ON "tender_gap_items"("severity");
CREATE INDEX "bid_drafts_tenderId_idx" ON "bid_drafts"("tenderId");
CREATE INDEX "bid_drafts_type_idx" ON "bid_drafts"("type");
CREATE INDEX "bid_scores_tenderId_idx" ON "bid_scores"("tenderId");

CREATE INDEX "company_document_chunks_embedding_hnsw_idx"
  ON "company_document_chunks"
  USING hnsw ("embedding" vector_cosine_ops);

ALTER TABLE "company_documents"
  ADD CONSTRAINT "company_documents_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_document_chunks"
  ADD CONSTRAINT "company_document_chunks_companyDocumentId_fkey"
  FOREIGN KEY ("companyDocumentId") REFERENCES "company_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenders"
  ADD CONSTRAINT "tenders_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tender_requirements"
  ADD CONSTRAINT "tender_requirements_tenderId_fkey"
  FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tender_required_documents"
  ADD CONSTRAINT "tender_required_documents_tenderId_fkey"
  FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tender_scoring_weights"
  ADD CONSTRAINT "tender_scoring_weights_tenderId_fkey"
  FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tender_gap_items"
  ADD CONSTRAINT "tender_gap_items_tenderId_fkey"
  FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bid_drafts"
  ADD CONSTRAINT "bid_drafts_tenderId_fkey"
  FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bid_scores"
  ADD CONSTRAINT "bid_scores_tenderId_fkey"
  FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
