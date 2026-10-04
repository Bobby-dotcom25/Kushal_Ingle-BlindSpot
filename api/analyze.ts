import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BLIND_SPOT_SYSTEM_PROMPT } from '../src/lib/blindSpotPrompt';
import { BLIND_SPOT_JSON_SCHEMA } from '../src/lib/blindSpotSchema';
import { validateBlindSpotReport } from '../src/lib/validateReport';
import { AnalyzeRequestBody } from '../src/lib/types';

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

  // 1. Validate request body presence
  const body = req.body as Partial<AnalyzeRequestBody>;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Invalid request body. A JSON object is required.' });
  }

  const { decision, options, factors, reasoning } = body;

  // 1a. Validate 'decision'
  if (typeof decision !== 'string' || !decision.trim()) {
    return res.status(400).json({ error: 'Missing or empty "decision" field. Must be a non-empty string.' });
  }
  if (decision.trim().length > 500) {
    return res.status(400).json({ error: '"decision" exceeds maximum allowed length of 500 characters.' });
  }

  // 1b. Validate 'options'
  if (!Array.isArray(options) || options.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid "options" field. Must be a non-empty array of strings.' });
  }
  if (options.length < 2) {
    return res.status(400).json({ error: '"options" array must contain at least 2 distinct options.' });
  }
  if (options.length > 10) {
    return res.status(400).json({ error: '"options" array exceeds maximum allowed length of 10 items.' });
  }
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    if (typeof opt !== 'string' || !opt.trim()) {
      return res.status(400).json({ error: `Option at index ${i} must be a non-empty string.` });
    }
    if (opt.trim().length > 200) {
      return res.status(400).json({ error: `Option at index ${i} exceeds maximum 200 characters.` });
    }
  }

  // 1c. Validate 'factors'
  if (typeof factors !== 'string' || !factors.trim()) {
    return res.status(400).json({ error: 'Missing or empty "factors" field. Must be a non-empty string.' });
  }
  if (factors.trim().length > 1000) {
    return res.status(400).json({ error: '"factors" exceeds maximum allowed length of 1000 characters.' });
  }

  // 1d. Validate 'reasoning'
  if (typeof reasoning !== 'string' || !reasoning.trim()) {
    return res.status(400).json({ error: 'Missing or empty "reasoning" field. Must be a non-empty string.' });
  }
  if (reasoning.trim().length > 3000) {
    return res.status(400).json({ error: '"reasoning" exceeds maximum allowed length of 3000 characters.' });
  }

  // 2. Read API Key
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured on the server. Please add it to your environment variables.'
    });
  }

  const userInput: AnalyzeRequestBody = {
    decision: decision.trim(),
    options: options.map(o => o.trim()),
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
- Do NOT invent unmentioned facts or statistics.
- Do NOT provide verdicts or recommendations.
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
        // Continue to fallback candidate
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
    const validation = validateBlindSpotReport(parsed, userInput);

    if (!validation.isValid) {
      return res.status(422).json({
        error: 'Generated report failed verification against user evidence.',
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
      error: 'Failed to complete reasoning audit.',
      details: message
    });
  }
}
