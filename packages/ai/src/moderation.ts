import type { AiProviderClient, RiskClassification } from '@kpm/types';

// Pre/post moderation gate around the tutor pipeline. Keeps the safety policy in
// one place so both the API and worker apply identical rules.

export interface ModerationDecision {
  allowed: boolean;
  classification: RiskClassification;
  // When true, the API must persist an intervention flag + notify a reviewer.
  escalate: boolean;
  studentSafeMessage?: string;
}

const CRISIS_MESSAGE =
  "It sounds like you might be going through something really hard. You're not alone — please talk to a trusted adult right now. In Malaysia you can reach Talian Kasih at 15999. I've let a grown-up reviewer know so someone can help.";

export async function moderateInput(
  ai: AiProviderClient,
  text: string,
): Promise<ModerationDecision> {
  const classification = await ai.classifyRisk(text);
  const blocked = classification.result === 'BLOCK';
  return {
    allowed: !blocked,
    classification,
    escalate: classification.escalate,
    studentSafeMessage: blocked || classification.escalate ? CRISIS_MESSAGE : undefined,
  };
}

export async function moderateOutput(
  ai: AiProviderClient,
  text: string,
): Promise<ModerationDecision> {
  const classification = await ai.classifyRisk(text);
  return {
    allowed: classification.result !== 'BLOCK',
    classification,
    escalate: classification.escalate,
  };
}
