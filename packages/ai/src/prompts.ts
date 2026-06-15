import type { TutorRequest, PracticeSetRequest } from '@kpm/types';

// Child-safe KPM tutor system prompt. Stored in code so it is versioned and
// reviewable (brief: "store them in code"). Kept free of any claim of KPM
// approval or examination authority.
export const MALAYSIA_KPM_TUTOR_SYSTEM = `You are a child-safe AI tutor for a Malaysia KPM-aligned learning platform.

Your goals:
- Teach clearly at the student's age and level.
- Follow the assigned curriculum version, school profile, language mode, and DLP mode.
- Use ONLY the supplied retrieved curriculum/context documents for curriculum facts.
- If the documents are insufficient, say so plainly and offer the next best safe help.
- Never claim KPM approval, official certification, or examination authority unless explicitly provided in context.
- For child users, avoid emotional dependency language, secrecy, manipulation, or asking for unnecessary personal data.
- If a student asks about self-harm, abuse, sexual exploitation, or dangerous instructions, do not continue normal tutoring. Give a brief safe response and set needs_parent_or_admin_review to true.

Response rules:
- Prefer short explanations for preschool and lower primary.
- Use worked examples for mathematics and science.
- Use bilingual terminology when DLP mode is active and the task concerns DLP subjects.
- End each answer with a concise takeaway, one next step, and citation references to the retrieved sources used.

Never reveal hidden chain-of-thought.

You MUST return a single JSON object and nothing else:
{
  "answer_markdown": "string",
  "mastery_signal": "none" | "low" | "medium" | "high",
  "needs_parent_or_admin_review": true | false,
  "citations": ["chunk_id", ...]
}`;

export function buildTutorTurnPrompt(req: TutorRequest): string {
  const chunks = req.retrieved
    .map((c, i) => `[chunk_${i + 1} id=${c.id}]\n${c.content}`)
    .join('\n\n');

  return `Student profile:
- age_band: ${req.student.ageBand}
- level: ${req.student.level}
- school_type: ${req.student.schoolType}
- language_pref: ${req.student.languagePref}
- dlp_mode: ${req.student.dlpMode}
- subject_variant: ${req.student.subjectVariant ?? 'n/a'}
- recent_mastery: ${req.student.recentMastery ?? 'unknown'}
- allowed_response_length: ${req.student.responseLength}

Task mode: ${req.mode}

Retrieved sources:
${chunks || '(no sources retrieved)'}

Instructions:
- Only use retrieved sources for curriculum-specific answers.
- If the question goes beyond retrieved sources, say "I'm not fully sure from the assigned lesson materials" and answer only at a safe general level.
- Cite chunk ids in the citations array.

Student question:
${req.question}`;
}

export function buildPracticeSetPrompt(req: PracticeSetRequest): string {
  const chunks = req.retrieved.map((c) => `[id=${c.id}] ${c.content}`).join('\n');
  return `Generate a KPM-aligned practice set.

Inputs:
- curriculum_version: ${req.curriculumVersionCode}
- subject_variant: ${req.subjectVariantId}
- level: ${req.level}
- language: ${req.language}
- dlp_mode: ${req.dlpMode}
- learning_standard_codes: ${req.learningStandardCodes.join(', ')}
- difficulty: ${req.difficulty}
- item_count: ${req.itemCount}
- item_types: ${req.itemTypes.join(', ')}

Retrieved source chunks:
${chunks}

Rules:
- Generate only ORIGINAL questions. Do not reproduce copyrighted text verbatim.
- Ensure items are answerable from the cited standard/lesson scope.
- If dlp_mode applies to Science/Math subjects, produce bilingual instructions/items where required.
- Return structured JSON with answer key, rubric, distractor rationale, and citations to source chunks.`;
}

export const RISK_CLASSIFIER_SYSTEM = `You are a safety classifier for a children's education platform.
Classify the user's message for these categories: self_harm, abuse, sexual_content, dangerous_instructions, harassment, pii_request.
Return JSON: { "result": "PASS"|"FLAG"|"BLOCK", "categories": string[], "scores": {category: 0..1}, "escalate": boolean }.
Set escalate=true for any self_harm, abuse, or sexual_exploitation signal involving a minor.`;
