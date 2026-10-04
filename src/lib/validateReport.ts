import { BlindSpotReport, Finding, Question, AnalyzeRequestBody, ReflectionAnswer } from './types';

export interface ValidationResult {
  isValid: boolean;
  report?: BlindSpotReport;
  errors: string[];
}

/**
 * Builds the canonical, single combined source text from the complete user input
 * including optional reflection questions and answers.
 */
export function buildCombinedInputText(
  input: AnalyzeRequestBody,
  reflectionAnswers?: ReflectionAnswer[]
): string {
  const optionsText = Array.isArray(input.options) ? input.options.join('\n') : String(input.options || '');
  const parts: string[] = [
    input.decision || '',
    optionsText,
    input.factors || '',
    input.reasoning || ''
  ];

  if (reflectionAnswers && Array.isArray(reflectionAnswers)) {
    for (const item of reflectionAnswers) {
      if (item && typeof item === 'object') {
        if (typeof item.question === 'string' && item.question.trim()) {
          parts.push(item.question.trim());
        }
        if (typeof item.answer === 'string' && item.answer.trim()) {
          parts.push(item.answer.trim());
        }
      }
    }
  }

  return parts.join('\n');
}

/**
 * Checks if a given evidence quote exists VERBATIM inside the combined source text
 * and satisfies lightweight meaningfulness requirements.
 */
export function isQuoteInInput(quote: string, inputCorpus: string): boolean {
  if (!quote || !inputCorpus) return false;
  
  // Exact verbatim match as-is
  if (inputCorpus.includes(quote)) {
    return true;
  }

  // Exact verbatim match after stripping wrapping quotes added by LLM formatting
  const cleanQuote = quote.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  if (cleanQuote.length >= 2 && inputCorpus.includes(cleanQuote)) {
    return true;
  }

  return false;
}

/**
 * Checks whether an evidence quote is reasonably meaningful (not just whitespace or single punctuation).
 */
export function isMeaningfulQuote(quote: string): boolean {
  if (!quote) return false;
  const clean = quote.replace(/^["'“”‘’\s.,;:!?()-]+|["'“”‘’\s.,;:!?()-]+$/g, '').trim();
  return clean.length >= 2;
}

/**
 * Forbidden phrases that violate the NO-VERDICT rule.
 * Blind Spot must NEVER tell the user what to decide, recommend, rank, or select options.
 */
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

/**
 * Checks if any text contains forbidden recommendation or verdict language.
 */
export function checkVerdictViolation(text: string): string | null {
  for (const pattern of FORBIDDEN_VERDICT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

/**
 * Validates that an object conforms strictly to the BlindSpotReport schema,
 * that every single evidence_quote is meaningful and exists VERBATIM in the source text,
 * and that no verdict or recommendation language is present.
 */
export function validateBlindSpotReport(
  data: unknown,
  inputOrCorpus: AnalyzeRequestBody | string,
  reflectionAnswers?: ReflectionAnswer[]
): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Report output must be a valid JSON object.'] };
  }

  const raw = data as Record<string, unknown>;

  // Build the complete combined source text
  const combinedCorpus = typeof inputOrCorpus === 'string'
    ? inputOrCorpus
    : buildCombinedInputText(inputOrCorpus, reflectionAnswers);

  // Validate Overlooked (max 4)
  const overlooked: Finding[] = [];
  if (!Array.isArray(raw.overlooked)) {
    errors.push('Missing or invalid "overlooked" array.');
  } else {
    if (raw.overlooked.length > 4) {
      errors.push(`"overlooked" exceeds maximum 4 items (received ${raw.overlooked.length}).`);
    }
    for (let i = 0; i < raw.overlooked.length; i++) {
      const item = raw.overlooked[i];
      if (!item || typeof item !== 'object') {
        errors.push(`overlooked[${i}] must be an object.`);
        continue;
      }
      const finding = typeof item.finding === 'string' ? item.finding.trim() : '';
      const evidence_quote = typeof item.evidence_quote === 'string' ? item.evidence_quote.trim() : '';

      if (!finding) {
        errors.push(`overlooked[${i}].finding must be a non-empty string.`);
      } else {
        const verdictMatch = checkVerdictViolation(finding);
        if (verdictMatch) {
          errors.push(`overlooked[${i}].finding violates NO-VERDICT rule by using recommendation language: "${verdictMatch}".`);
        }
      }

      if (!evidence_quote) {
        errors.push(`overlooked[${i}].evidence_quote must be a non-empty string.`);
      } else if (!isMeaningfulQuote(evidence_quote)) {
        errors.push(`overlooked[${i}].evidence_quote "${evidence_quote}" is not a meaningful quote.`);
      } else if (!isQuoteInInput(evidence_quote, combinedCorpus)) {
        errors.push(`overlooked[${i}].evidence_quote "${evidence_quote}" does not exist VERBATIM inside the user input.`);
      }

      overlooked.push({ finding, evidence_quote });
    }
  }

  // Validate Assumptions (max 4)
  const assumptions: Finding[] = [];
  if (!Array.isArray(raw.assumptions)) {
    errors.push('Missing or invalid "assumptions" array.');
  } else {
    if (raw.assumptions.length > 4) {
      errors.push(`"assumptions" exceeds maximum 4 items (received ${raw.assumptions.length}).`);
    }
    for (let i = 0; i < raw.assumptions.length; i++) {
      const item = raw.assumptions[i];
      if (!item || typeof item !== 'object') {
        errors.push(`assumptions[${i}] must be an object.`);
        continue;
      }
      const finding = typeof item.finding === 'string' ? item.finding.trim() : '';
      const evidence_quote = typeof item.evidence_quote === 'string' ? item.evidence_quote.trim() : '';

      if (!finding) {
        errors.push(`assumptions[${i}].finding must be a non-empty string.`);
      } else {
        const verdictMatch = checkVerdictViolation(finding);
        if (verdictMatch) {
          errors.push(`assumptions[${i}].finding violates NO-VERDICT rule by using recommendation language: "${verdictMatch}".`);
        }
      }

      if (!evidence_quote) {
        errors.push(`assumptions[${i}].evidence_quote must be a non-empty string.`);
      } else if (!isMeaningfulQuote(evidence_quote)) {
        errors.push(`assumptions[${i}].evidence_quote "${evidence_quote}" is not a meaningful quote.`);
      } else if (!isQuoteInInput(evidence_quote, combinedCorpus)) {
        errors.push(`assumptions[${i}].evidence_quote "${evidence_quote}" does not exist VERBATIM inside the user input.`);
      }

      assumptions.push({ finding, evidence_quote });
    }
  }

  // Validate Conflicts (max 4)
  const conflicts: Finding[] = [];
  if (!Array.isArray(raw.conflicts)) {
    errors.push('Missing or invalid "conflicts" array.');
  } else {
    if (raw.conflicts.length > 4) {
      errors.push(`"conflicts" exceeds maximum 4 items (received ${raw.conflicts.length}).`);
    }
    for (let i = 0; i < raw.conflicts.length; i++) {
      const item = raw.conflicts[i];
      if (!item || typeof item !== 'object') {
        errors.push(`conflicts[${i}] must be an object.`);
        continue;
      }
      const finding = typeof item.finding === 'string' ? item.finding.trim() : '';
      const evidence_quote = typeof item.evidence_quote === 'string' ? item.evidence_quote.trim() : '';

      if (!finding) {
        errors.push(`conflicts[${i}].finding must be a non-empty string.`);
      } else {
        const verdictMatch = checkVerdictViolation(finding);
        if (verdictMatch) {
          errors.push(`conflicts[${i}].finding violates NO-VERDICT rule by using recommendation language: "${verdictMatch}".`);
        }
      }

      if (!evidence_quote) {
        errors.push(`conflicts[${i}].evidence_quote must be a non-empty string.`);
      } else if (!isMeaningfulQuote(evidence_quote)) {
        errors.push(`conflicts[${i}].evidence_quote "${evidence_quote}" is not a meaningful quote.`);
      } else if (!isQuoteInInput(evidence_quote, combinedCorpus)) {
        errors.push(`conflicts[${i}].evidence_quote "${evidence_quote}" does not exist VERBATIM inside the user input.`);
      }

      conflicts.push({ finding, evidence_quote });
    }
  }

  // Validate Questions (3-5 items)
  const questions: Question[] = [];
  if (!Array.isArray(raw.questions)) {
    errors.push('Missing or invalid "questions" array.');
  } else {
    if (raw.questions.length < 3 || raw.questions.length > 5) {
      errors.push(`"questions" must contain between 3 and 5 items (received ${raw.questions.length}).`);
    }
    for (let i = 0; i < raw.questions.length; i++) {
      const item = raw.questions[i];
      if (!item || typeof item !== 'object') {
        errors.push(`questions[${i}] must be an object.`);
        continue;
      }
      const question = typeof item.question === 'string' ? item.question.trim() : '';
      const evidence_quote = typeof item.evidence_quote === 'string' ? item.evidence_quote.trim() : '';

      if (!question) {
        errors.push(`questions[${i}].question must be a non-empty string.`);
      } else {
        const verdictMatch = checkVerdictViolation(question);
        if (verdictMatch) {
          errors.push(`questions[${i}].question violates NO-VERDICT rule by using recommendation language: "${verdictMatch}".`);
        }
      }

      if (!evidence_quote) {
        errors.push(`questions[${i}].evidence_quote must be a non-empty string.`);
      } else if (!isMeaningfulQuote(evidence_quote)) {
        errors.push(`questions[${i}].evidence_quote "${evidence_quote}" is not a meaningful quote.`);
      } else if (!isQuoteInInput(evidence_quote, combinedCorpus)) {
        errors.push(`questions[${i}].evidence_quote "${evidence_quote}" does not exist VERBATIM inside the user input.`);
      }

      questions.push({ question, evidence_quote });
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    report: {
      overlooked,
      assumptions,
      conflicts,
      questions,
    },
    errors: []
  };
}
