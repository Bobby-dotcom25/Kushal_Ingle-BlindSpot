export interface Finding {
  finding: string;
  evidence_quote: string;
}

export interface Question {
  question: string;
  evidence_quote: string;
}

export interface BlindSpotReport {
  overlooked: Finding[];
  assumptions: Finding[];
  conflicts: Finding[];
  questions: Question[];
}

export interface AnalyzeRequestBody {
  decision: string;
  options: string[];
  factors: string;
  reasoning: string;
}

export interface ReflectionAnswer {
  question: string;
  answer: string;
}

export interface RefineRequestBody {
  originalInput: AnalyzeRequestBody;
  answers: ReflectionAnswer[];
}

export interface AnalyzeResponse {
  success: boolean;
  report?: BlindSpotReport;
  error?: string;
}
