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
EXAMPLES OF GROUNDING (STUDY CAREFULLY)
==================================================

BAD:
Finding: "The potential impact of the internship on your academic or personal commitments is not addressed."
Evidence: "should i take any internship" (or "career growth", "mode")
Reason: The evidence does not support the claim. The user never mentioned or implied academic or personal commitments. This is an ungrounded inference.

BAD:
Finding: "The internship may negatively affect your academic schedule."
Evidence: "career growth"
Reason: The evidence does not support the claim.

BAD:
Finding: "The internship will improve your career."
Evidence: "gain new skills"
Reason: This treats an intended outcome as an established fact.

BAD:
Finding: "The internship may create financial pressure."
Evidence: "stipend"
Reason: No financial pressure was stated in the input.

BAD:
Finding: "There is tension between logistical constraints and career growth."
Evidence: "stipend, distance from home, mode, career growth,"
Reason: Simply listing factors does not establish a conflict unless the user's reasoning expresses friction between them.

GOOD:
Finding: "Your reasoning connects taking an internship with gaining new skills and experience, but does not explore what specific skills or experience would make the opportunity valuable."
Evidence: "because i want to gain new skills and experience for my growth"

GOOD:
Finding: "Distance and travel mode are factors in how you are evaluating the internship, but their importance relative to career growth is not explored."
Evidence: "distance from home, mode, career growth"

GOOD:
Finding: "The decision considers taking 'any' internship, which leaves undefined what minimum standards or criteria a role must meet to justify accepting it."
Evidence: "should i take any internship"

==================================================
CATEGORY-SPECIFIC RULES
==================================================

A. OVERLOOKED FACTORS (Max 4 findings)
Only identify something genuinely absent or underexplored if the user's input provides enough context to justify that observation.
- If there is insufficient evidence, return fewer findings (even just 1).
- Do NOT fill the card just to reach a target number.
- Point out meaningful considerations that are absent from the trade-off.
- DO NOT bring up external topics (like academics, health, family) unless the user mentioned them.

B. HIDDEN ASSUMPTIONS (Max 4 findings)
Only identify an assumption when the user's wording reasonably implies it.
- An assumption must be something the user's wording actually takes for granted.
- Do NOT invent assumptions about money, family, GPA, exams, health, career, mentors, or job offers unless directly supported by the user's input.
- Phrase neutrally as assumptions to scrutinize, not as confirmed truths.

C. CONFLICTS IN REASONING (Max 4 findings)
A conflict MUST involve two competing considerations explicitly present in the user's input.
- The evidence_quote should contain the relevant wording that demonstrates the tension.
- If the user's input contains no competing priorities or trade-offs, return ZERO conflicts (an empty array []).
- Do NOT fabricate a conflict from a simple list of factors or an isolated keyword.

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

function validateBlindSpotReport(data: any, userInput: any) {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Report output must be a valid JSON object.'] };
  }

  const optionsText = Array.isArray(userInput.options) ? userInput.options.join('\n') : String(userInput.options || '');
  const combinedCorpus = [
    userInput.decision || '',
    optionsText,
    userInput.factors || '',
    userInput.reasoning || ''
  ].join('\n');

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
    return res.status(400).json({ error: 'Invalid request body. A JSON object is required.' });
  }

  const { decision, options, factors, reasoning } = body;

  if (typeof decision !== 'string' || !decision.trim()) {
    return res.status(400).json({ error: 'Missing or empty "decision" field. Must be a non-empty string.' });
  }
  if (!Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: '"options" array must contain at least 2 distinct options.' });
  }
  if (typeof factors !== 'string' || !factors.trim()) {
    return res.status(400).json({ error: 'Missing or empty "factors" field. Must be a non-empty string.' });
  }
  if (typeof reasoning !== 'string' || !reasoning.trim()) {
    return res.status(400).json({ error: 'Missing or empty "reasoning" field. Must be a non-empty string.' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured on the server. Please add it to your Vercel Environment Variables.'
    });
  }

  const userInput = {
    decision: decision.trim(),
    options: options.map(o => String(o).trim()),
    factors: factors.trim(),
    reasoning: reasoning.trim(),
  };

  try {
    const userPromptContent = `
AUDIT TARGET:
- Decision: "${userInput.decision}"
- Options: [${userInput.options.map(o => `"${o}"`).join(', ')}]
- Factors considered: "${userInput.factors}"
- User's reasoning: "${userInput.reasoning}"

Perform the Blind Spot reasoning audit according to the system prompt and return ONLY valid JSON matching the schema.
Remember:
- Every evidence_quote must exist VERBATIM in the text above.
- An evidence quote must directly support the finding.
- Do NOT invent unmentioned facts or statistics.
- Do NOT provide verdicts or recommendations.
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

    const validation = validateBlindSpotReport(parsed, userInput);
    if (!validation.isValid) {
      return res.status(422).json({
        error: 'Generated report failed verification against user evidence.',
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
      error: 'Failed to complete reasoning audit.',
      details: message
    });
  }
}
