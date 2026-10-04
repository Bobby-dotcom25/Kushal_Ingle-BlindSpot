import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ==========================================
// 1. SYSTEM PROMPT (Self-contained for Vercel)
// ==========================================
const BLIND_SPOT_SYSTEM_PROMPT = `You are "Blind Spot", an AI reasoning-audit assistant.

Your purpose is to help a person examine blind spots in their reasoning about a decision.

You DO NOT make the decision for them.

Separate the user's reasoning into:

1. What they explicitly said
2. What they may be assuming
3. What they may have overlooked
4. Where their reasoning may contain tensions or conflicts
5. What questions they should ask themselves

==================================================
EVIDENCE RULE — ABSOLUTE & CRITICAL
==================================================

Every finding MUST contain an evidence_quote taken EXACTLY and VERBATIM from the user's input.

DIRECT SUPPORT & CONSERVATIVE INTERPRETATION RULE:
- If you cannot identify a specific phrase from the user's words that directly supports a finding, DO NOT generate that finding.
- Evidence must be explanatory, not merely present.
- The finding must be a conservative interpretation of the evidence quote.
- Do NOT infer more than the quote supports.
- DO NOT invent or infer unmentioned domains (such as "academic commitments", "personal schedule", "work-life balance", "financial hardship") when the user's words do not mention or directly imply them.
- MUST be an exact character-for-character substring of the user's input text (decision, options, factors, reasoning, or reflection answers).
- MUST NOT paraphrase, reorder, summarize, or alter words.
- MUST be concise, meaningful, and specific.
- MUST NOT invent words or information.

==================================================
CATEGORY-SPECIFIC RULES
==================================================

A. OVERLOOKED FACTORS (Max 4 findings)
Only identify something genuinely absent or underexplored if the user's input provides enough context to justify that observation.
- If there is insufficient evidence, return fewer findings (even just 1).
- Do NOT fill the card just to reach a target number.
- Point out meaningful considerations that are absent from the trade-off.

B. HIDDEN ASSUMPTIONS (Max 4 findings)
Only identify an assumption when the user's wording reasonably implies it.
- An assumption must be something the user's wording actually takes for granted.
- Do NOT invent assumptions about money, family, GPA, exams, health, career, mentors, or job offers unless directly supported by the user's input.
- Phrase neutrally as assumptions to scrutinize, not as confirmed truths.

C. CONFLICTS IN REASONING (Max 4 findings)
A conflict MUST involve two competing considerations explicitly present in the user's input.
- The evidence_quote should contain the relevant wording that demonstrates the tension.
- If the user's input contains no competing priorities or trade-offs, return ZERO conflicts (an empty array []).

D. QUESTIONS TO ASK YOURSELF (3 to 5 questions)
Questions can explore things not mentioned by the user, because questions are meant to expose areas for reflection.
- However, questions must still be grounded in something the user actually said.
- Ground each question with an exact evidence quote demonstrating what sparked the question.
- Questions must never lead the user toward a particular outcome or verdict.

==================================================
MOST IMPORTANT RULE: QUALITY > QUANTITY
==================================================

QUALITY > QUANTITY.
It is completely acceptable to return:
- 1 overlooked factor
- 1 assumption
- 0 conflicts
if the user's input does not provide enough evidence.

NEVER manufacture or force findings just to fill a card.

==================================================
NO-VERDICT RULE — ABSOLUTE & STRICT
==================================================

You must NEVER tell the user what decision to make.
You must NEVER:
- recommend an option
- choose or select an option
- rank options
- approve or validate an option
- reject or discourage an option
- say which option is better or best ("better option", "best option", "optimal choice", "the right choice")
- say "you should", "you should choose", "you ought to", "you must"
- say "I recommend", "we recommend", "my advice is"
- say "take option A", "reject option B"

Turn ANY implicit advice into a neutral, reflective OPEN QUESTION.

==================================================
SELF-CHECK BEFORE OUTPUT
==================================================

1. Verify every single evidence_quote appears VERBATIM in the user's input text.
2. Verify every evidence_quote directly supports its finding (conservative interpretation, zero invented domains).
3. If no competing priorities are stated, verify conflicts is an empty array [].
4. Verify there is zero recommendation, advice, ranking, or verdict ("you should", "best option", etc.).
5. Verify output is strictly valid JSON matching the schema.`;

// ==========================================
// 2. JSON SCHEMA (Self-contained for Vercel)
// ==========================================
const BLIND_SPOT_JSON_SCHEMA = {
  type: "object",
  properties: {
    overlooked: {
      type: "array",
      items: {
        type: "object",
        properties: {
          finding: { type: "string" },
          evidence_quote: { type: "string" }
        },
        required: ["finding", "evidence_quote"]
      }
    },
    assumptions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          finding: { type: "string" },
          evidence_quote: { type: "string" }
        },
        required: ["finding", "evidence_quote"]
      }
    },
    conflicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          finding: { type: "string" },
          evidence_quote: { type: "string" }
        },
        required: ["finding", "evidence_quote"]
      }
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          evidence_quote: { type: "string" }
        },
        required: ["question", "evidence_quote"]
      }
    }
  },
  required: ["overlooked", "assumptions", "conflicts", "questions"]
};

// ==========================================
// 3. VALIDATION LOGIC (Self-contained for Vercel)
// ==========================================
function isQuoteInInput(quote: string, inputCorpus: string): boolean {
  if (!quote || !inputCorpus) return false;
  if (inputCorpus.includes(quote)) return true;
  const cleanQuote = quote.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  return cleanQuote.length >= 2 && inputCorpus.includes(cleanQuote);
}

function isMeaningfulQuote(quote: string): boolean {
  if (!quote) return false;
  const clean = quote.replace(/^["'“”‘’\s.,;:!?()-]+|["'“”‘’\s.,;:!?()-]+$/g, '').trim();
  return clean.length >= 2;
}

const FORBIDDEN_VERDICT_PATTERNS = [
  /\byou should\b/i,
  /\bi recommend\b/i,
  /\bwe recommend\b/i,
  /\bbest option\b/i,
  /\bbetter option\b/i,
  /\byou ought to\b/i,
  /\byou must choose\b/i,
  /\byou should choose\b/i,
  /\byou should accept\b/i,
  /\byou should reject\b/i,
  /\btake option\b/i,
  /\breject option\b/i,
  /\boptimal choice\b/i,
  /\bthe right choice\b/i,
  /\bi suggest choosing\b/i,
];

function checkVerdictViolation(text: string): string | null {
  for (const pattern of FORBIDDEN_VERDICT_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

function validateRefinedReport(data: any, originalInput: any, answers: any[]) {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Report output must be a valid JSON object.'] };
  }

  const optionsText = Array.isArray(originalInput.options) ? originalInput.options.join('\n') : String(originalInput.options || '');
  const corpusParts = [
    originalInput.decision || '',
    optionsText,
    originalInput.factors || '',
    originalInput.reasoning || ''
  ];

  if (Array.isArray(answers)) {
    for (const item of answers) {
      if (item && typeof item === 'object') {
        if (item.question) corpusParts.push(String(item.question).trim());
        if (item.answer) corpusParts.push(String(item.answer).trim());
      }
    }
  }

  const combinedCorpus = corpusParts.join('\n');

  const overlooked: any[] = [];
  if (Array.isArray(data.overlooked)) {
    for (const item of data.overlooked.slice(0, 4)) {
      if (item && typeof item === 'object') {
        const finding = typeof item.finding === 'string' ? item.finding.trim() : '';
        const evidence_quote = typeof item.evidence_quote === 'string' ? item.evidence_quote.trim() : '';
        if (finding && evidence_quote && isMeaningfulQuote(evidence_quote) && isQuoteInInput(evidence_quote, combinedCorpus)) {
          if (!checkVerdictViolation(finding)) {
            overlooked.push({ finding, evidence_quote });
          }
        }
      }
    }
  }

  const assumptions: any[] = [];
  if (Array.isArray(data.assumptions)) {
    for (const item of data.assumptions.slice(0, 4)) {
      if (item && typeof item === 'object') {
        const finding = typeof item.finding === 'string' ? item.finding.trim() : '';
        const evidence_quote = typeof item.evidence_quote === 'string' ? item.evidence_quote.trim() : '';
        if (finding && evidence_quote && isMeaningfulQuote(evidence_quote) && isQuoteInInput(evidence_quote, combinedCorpus)) {
          if (!checkVerdictViolation(finding)) {
            assumptions.push({ finding, evidence_quote });
          }
        }
      }
    }
  }

  const conflicts: any[] = [];
  if (Array.isArray(data.conflicts)) {
    for (const item of data.conflicts.slice(0, 4)) {
      if (item && typeof item === 'object') {
        const finding = typeof item.finding === 'string' ? item.finding.trim() : '';
        const evidence_quote = typeof item.evidence_quote === 'string' ? item.evidence_quote.trim() : '';
        if (finding && evidence_quote && isMeaningfulQuote(evidence_quote) && isQuoteInInput(evidence_quote, combinedCorpus)) {
          if (!checkVerdictViolation(finding)) {
            conflicts.push({ finding, evidence_quote });
          }
        }
      }
    }
  }

  const questions: any[] = [];
  if (Array.isArray(data.questions)) {
    for (const item of data.questions.slice(0, 5)) {
      if (item && typeof item === 'object') {
        const question = typeof item.question === 'string' ? item.question.trim() : '';
        const evidence_quote = typeof item.evidence_quote === 'string' ? item.evidence_quote.trim() : '';
        if (question && evidence_quote && isMeaningfulQuote(evidence_quote) && isQuoteInInput(evidence_quote, combinedCorpus)) {
          if (!checkVerdictViolation(question)) {
            questions.push({ question, evidence_quote });
          }
        }
      }
    }
  }

  if (questions.length < 1) {
    errors.push('No valid questions with matching evidence found.');
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    report: { overlooked, assumptions, conflicts, questions },
    errors: []
  };
}

// ==========================================
// 4. MAIN HANDLER
// ==========================================
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // Handle body whether parsed as object or passed as raw string
  let body: any = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON in request body.' });
    }
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Invalid request body. JSON object expected.' });
  }

  const { originalInput, answers } = body;

  if (!originalInput || typeof originalInput !== 'object') {
    return res.status(400).json({ error: 'Missing or invalid "originalInput" object.' });
  }

  const { decision, options, factors, reasoning } = originalInput;

  if (typeof decision !== 'string' || !decision.trim()) {
    return res.status(400).json({ error: 'Missing or empty "originalInput.decision" field.' });
  }
  if (!Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: '"originalInput.options" must contain at least 2 options.' });
  }
  if (typeof factors !== 'string' || !factors.trim()) {
    return res.status(400).json({ error: 'Missing or empty "originalInput.factors" field.' });
  }
  if (typeof reasoning !== 'string' || !reasoning.trim()) {
    return res.status(400).json({ error: 'Missing or empty "originalInput.reasoning" field.' });
  }

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: '"answers" must be a non-empty array with 1 to 2 reflection answers.' });
  }
  if (answers.length > 2) {
    return res.status(400).json({ error: '"answers" exceeds maximum limit of 2 reflection answers.' });
  }

  for (let i = 0; i < answers.length; i++) {
    const item = answers[i];
    if (!item || typeof item !== 'object') {
      return res.status(400).json({ error: `answers[${i}] must be a valid object.` });
    }
    if (typeof item.question !== 'string' || !item.question.trim()) {
      return res.status(400).json({ error: `answers[${i}].question must be a non-empty string.` });
    }
    if (typeof item.answer !== 'string' || !item.answer.trim()) {
      return res.status(400).json({ error: `answers[${i}].answer must be a non-empty string.` });
    }
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured on the server. Please add it to your Vercel Environment Variables.'
    });
  }

  const cleanAnswers = answers.map((a: any) => ({
    question: a.question.trim(),
    answer: a.answer.trim()
  }));

  const cleanOriginal = {
    decision: decision.trim(),
    options: options.map((o: any) => String(o).trim()),
    factors: factors.trim(),
    reasoning: reasoning.trim()
  };

  try {
    const userPromptContent = `
AUDIT TARGET (INITIAL DECISION):
- Decision: "${cleanOriginal.decision}"
- Options: [${cleanOriginal.options.map((o: any) => `"${o}"`).join(', ')}]
- Factors considered: "${cleanOriginal.factors}"
- Initial reasoning: "${cleanOriginal.reasoning}"

USER'S REFLECTIONS ON BLIND SPOTS:
${cleanAnswers.map((a: any, i: number) => `Reflection ${i + 1}:
- Question: "${a.question}"
- User's Answer: "${a.answer}"`).join('\n\n')}

INSTRUCTION:
Re-analyze the user's reasoning after considering these reflections.
Surface updated overlooked factors, deeper hidden assumptions, remaining or newly revealed conflicts, and deeper investigative questions.
Remember:
- Every evidence_quote must exist VERBATIM either in the initial decision information OR in the reflection answers above.
- An evidence quote must directly support the finding.
- Do NOT invent unmentioned facts or statistics.
- Do NOT provide verdicts, rankings, or recommendations.
`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];

    let responseText = '';
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: BLIND_SPOT_SYSTEM_PROMPT,
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: BLIND_SPOT_JSON_SCHEMA as any,
            temperature: 0.2,
          },
        });

        const result = await model.generateContent(userPromptContent);
        responseText = result.response.text();
        if (responseText) break;
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!responseText) {
      throw lastError || new Error('Received empty response from Gemini API.');
    }

    let parsed: any;
    try {
      const cleaned = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(502).json({
        error: 'Failed to parse Gemini response as JSON.',
        raw: responseText.slice(0, 500)
      });
    }

    const validation = validateRefinedReport(parsed, cleanOriginal, cleanAnswers);
    if (!validation.isValid) {
      return res.status(422).json({
        error: 'Generated refined report failed verification against user evidence.',
        details: validation.errors,
        rawReport: parsed
      });
    }

    return res.status(200).json(validation.report);

  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || 'Internal Server Error';

    if (status === 429 || message.toLowerCase().includes('quota') || message.toLowerCase().includes('rate limit')) {
      return res.status(429).json({ error: 'Gemini API rate limit exceeded. Please try again in a moment.' });
    }

    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: 'Failed to complete refined reasoning audit.',
      details: message
    });
  }
}
