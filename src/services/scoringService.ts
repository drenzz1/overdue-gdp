import type { ScoreFactor, TenderProfile } from "../types.js";

const categoryKeywords: Array<{ keys: string[]; patterns: string[] }> = [
  {
    keys: ["technical", "methodology"],
    patterns: ["methodology", "implementation", "timeline", "plan", "technical", "approach"]
  },
  {
    keys: ["experience", "reference"],
    patterns: ["reference", "experience", "comparable"]
  },
  {
    keys: ["team", "qualification"],
    patterns: ["cv", "curriculum", "manager", "architect", "lead", "qualification"]
  },
  {
    keys: ["price", "cost", "financial"],
    patterns: ["price", "financial", "offer", "cost", "budget", "pricing"]
  },
  {
    keys: ["support"],
    patterns: ["support", "maintenance", "service"]
  }
];

function patternsForLabel(label: string): string[] {
  const lower = label.toLowerCase();
  for (const { keys, patterns } of categoryKeywords) {
    if (keys.some((k) => lower.includes(k))) return patterns;
  }
  return [];
}

export function buildScoreFactors(tender: TenderProfile): ScoreFactor[] {
  return tender.weights.map(({ label, value }) => {
    const patterns = patternsForLabel(label);
    const relevant = tender.documents.filter((doc) =>
      patterns.some((p) => doc.name.toLowerCase().includes(p))
    );

    if (relevant.length === 0) {
      return {
        label,
        weight: value,
        earned: Math.round(value * 0.6),
        reason: "No specific documents mapped to this category; estimated at 60% readiness."
      };
    }

    const ready = relevant.filter((doc) => doc.ready).length;
    const earned = Math.round((ready / relevant.length) * value);
    const notReady = relevant.filter((doc) => !doc.ready).map((d) => d.name);

    const reason =
      ready === relevant.length
        ? `All ${relevant.length} required document(s) ready.`
        : `${ready} of ${relevant.length} document(s) ready. Missing: ${notReady.join(", ")}.`;

    return { label, weight: value, earned, reason };
  });
}

export function computeScore(factors: ScoreFactor[]): number {
  return Math.min(100, factors.reduce((sum, f) => sum + f.earned, 0));
}

export function buildScoreExplanation(score: number, factors: ScoreFactor[]): string {
  const strong = factors.filter((f) => f.earned >= Math.round(f.weight * 0.8)).map((f) => f.label);
  const weak = factors.filter((f) => f.earned < Math.round(f.weight * 0.5)).map((f) => f.label);

  let explanation = `Based on the tender criteria, your bid scores approximately ${score}/100.`;

  if (strong.length > 0) {
    explanation += ` Strong areas: ${strong.join(", ")}.`;
  }
  if (weak.length > 0) {
    explanation += ` Needs improvement: ${weak.join(", ")}.`;
  }

  return explanation;
}
