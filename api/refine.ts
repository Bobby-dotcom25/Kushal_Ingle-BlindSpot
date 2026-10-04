import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BLIND_SPOT_SYSTEM_PROMPT } from '../src/lib/blindSpotPrompt';
import { BLIND_SPOT_JSON_SCHEMA } from '../src/lib/blindSpotSchema';
import { validateBlindSpotReport } from '../src/lib/validateReport';
import { RefineRequestBody } from '../src/lib/types';

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

  // 1. Validate request body
  const body = req.body as Partial<RefineRequestBody>;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Invalid request body. JSON object expected.' });
  }

  const { originalInput, answers } = body;

  // Validate originalInput
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

  // Validate answers (1 to 2 reflection answers)
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
    if (item.answer.trim().length > 3000) {
      return res.status(400).json({ error: `answers[${i}].answer exceeds maximum allowed length of 3000 characters.` });
    }
  }

  // 2. Read API Key
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured on the server. Please add it to your environment variables.'
    });
  }

  const cleanAnswers = answers.map(a => ({
    question: a.question.trim(),
    answer: a.answer.trim()
  }));

  const cleanOriginal = {
    decision: decision.trim(),
    options: options.map(o => String(o).trim()),
    factors: factors.trim(),
    reasoning: reasoning.trim()
  };

  try {
    const userPromptContent = `
AUDIT TARGET (INITIAL DECISION):
- Decision: "${cleanOriginal.decision}"
- Options: [${cleanOriginal.options.map(o => `"${o}"`).join(', ')}]
- Factors considered: "${cleanOriginal.factors}"
- Initial reasoning: "${cleanOriginal.reasoning}"

USER'S REFLECTIONS ON BLIND SPOTS:
${cleanAnswers.map((a, i) => `Reflection ${i + 1}:
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

    // 3. Initialize Gemini with active models (gemini-3.1-flash-lite primary)
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
        if (responseText) {
          break;
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!responseText) {
      throw lastError || new Error('Received empty response from Gemini API.');
    }

    // 4. Parse JSON
    let parsed: unknown;
    try {
      const cleaned = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(502).json({
        error: 'Failed to parse Gemini response as JSON.',
        raw: responseText.slice(0, 500)
      });
    }

    // 5. Validate Report & Evidence Quotes & No-Verdict Rule
    const validation = validateBlindSpotReport(parsed, cleanOriginal, cleanAnswers);

    if (!validation.isValid) {
      return res.status(422).json({
        error: 'Generated refined report failed verification against user evidence.',
        details: validation.errors,
        rawReport: parsed
      });
    }

    // 6. Return verified report
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
