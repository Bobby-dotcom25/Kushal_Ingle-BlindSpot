import { useState } from 'react';
import { BlindSpotReport as ReportType, ReflectionAnswer } from '../lib/types';
import ReportCard from './ReportCard';
import {
  Search,
  Brain,
  Zap,
  HelpCircle,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';

interface BlindSpotReportProps {
  report: ReportType;
  onReset: () => void;
  onRefine: (answers: ReflectionAnswer[]) => void;
  isRefining: boolean;
  isRefinedPass?: boolean;
  refineError?: string | null;
  onClearRefineError?: () => void;
}

export default function BlindSpotReport({
  report,
  onReset,
  onRefine,
  isRefining,
  isRefinedPass = false,
  refineError,
  onClearRefineError,
}: BlindSpotReportProps) {
  const [isReflecting, setIsReflecting] = useState(false);
  const [reflectionInputs, setReflectionInputs] = useState<Record<number, string>>({});
  const [reflectionValidationMessage, setReflectionValidationMessage] = useState<string | null>(null);

  // Calculate answered questions
  const answeredEntries = Object.entries(reflectionInputs).filter(
    ([_, text]) => text && text.trim().length > 0
  );
  const answeredCount = answeredEntries.length;

  const handleInputChange = (idx: number, val: string) => {
    // If not already answered and trying to answer a 3rd question, block it
    if (answeredCount >= 2 && (!reflectionInputs[idx] || !reflectionInputs[idx].trim()) && val.trim().length > 0) {
      setReflectionValidationMessage('You can answer at most 2 reflection questions.');
      return;
    }

    setReflectionValidationMessage(null);
    setReflectionInputs(prev => ({
      ...prev,
      [idx]: val,
    }));
  };

  const handleStartReflect = () => {
    setIsReflecting(true);
    setReflectionValidationMessage(null);
    // Smooth scroll down to reflection area
    setTimeout(() => {
      const el = document.getElementById('reflection-panel');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handleSubmitReflections = (e: React.FormEvent) => {
    e.preventDefault();
    if (onClearRefineError) onClearRefineError();

    const activeAnswers: ReflectionAnswer[] = [];
    for (const [idxStr, text] of Object.entries(reflectionInputs)) {
      const idx = Number(idxStr);
      if (text && text.trim() && report.questions[idx]) {
        activeAnswers.push({
          question: report.questions[idx].question,
          answer: text.trim(),
        });
      }
    }

    if (activeAnswers.length === 0) {
      setReflectionValidationMessage('Please provide your reflection for at least 1 question.');
      return;
    }

    if (activeAnswers.length > 2) {
      setReflectionValidationMessage('Please answer at most 2 questions.');
      return;
    }

    onRefine(activeAnswers);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Report Header */}
      <div className="text-center space-y-3">
        {isRefinedPass ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold tracking-wider uppercase animate-in zoom-in-95">
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>REFLECTION PASS COMPLETE</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Audit Complete • Verbatim Evidence Verified</span>
          </div>
        )}

        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Your Blind Spot Map
        </h2>
        <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
          These aren't answers. They're areas worth examining.
        </p>
      </div>

      {/* 4 Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARD 1: OVERLOOKED FACTORS */}
        <ReportCard
          title="Overlooked Factors"
          subtitle="What isn't fully visible in your reasoning?"
          icon={<Search className="w-5 h-5 text-cyan-400" />}
          badgeText="Omission"
          badgeColorClass="bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
          borderColorClass="border-cyan-500/20"
          items={report.overlooked}
        />

        {/* CARD 2: HIDDEN ASSUMPTIONS */}
        <ReportCard
          title="Hidden Assumptions"
          subtitle="What are you taking for granted?"
          icon={<Brain className="w-5 h-5 text-indigo-400" />}
          badgeText="Premise"
          badgeColorClass="bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
          borderColorClass="border-indigo-500/20"
          items={report.assumptions}
        />

        {/* CARD 3: CONFLICTS IN REASONING */}
        <ReportCard
          title="Conflicts in Reasoning"
          subtitle="Where do your priorities pull in different directions?"
          icon={<Zap className="w-5 h-5 text-amber-400" />}
          badgeText="Tension"
          badgeColorClass="bg-amber-500/10 border-amber-500/30 text-amber-300"
          borderColorClass="border-amber-500/20"
          items={report.conflicts}
        />

        {/* CARD 4: QUESTIONS TO ASK YOURSELF */}
        <ReportCard
          title="Questions to Ask Yourself"
          subtitle="Questions worth exploring before deciding."
          icon={<HelpCircle className="w-5 h-5 text-emerald-400" />}
          badgeText="Inquiry"
          badgeColorClass="bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          borderColorClass="border-emerald-500/20"
          items={report.questions}
          isQuestionCard
        />
      </div>

      {/* NO-VERDICT VISUAL MESSAGE */}
      <div className="rounded-2xl p-6 bg-gradient-to-b from-[#11131a] to-[#161822] border border-slate-800 text-center space-y-2 shadow-lg">
        <p className="text-base sm:text-lg font-semibold text-white">
          Blind Spot doesn't tell you what to choose.
        </p>
        <p className="text-sm font-medium text-indigo-400">
          It shows you what to examine.
        </p>
        <p className="text-xs text-slate-500 pt-1">
          Zero recommendations. Zero rankings. Every finding is anchored directly in your own words.
        </p>
      </div>

      {/* REFINE ERROR CARD (Preserves original report) */}
      {refineError && (
        <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/30 text-center space-y-3 animate-in fade-in">
          <div className="flex items-center justify-center gap-2 text-rose-400 font-semibold text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Reflection analysis couldn't be completed.</span>
          </div>
          <p className="text-xs text-slate-300">
            Your original analysis is still available. You can try submitting your reflections again.
          </p>
          <button
            type="button"
            onClick={handleSubmitReflections}
            className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-all inline-flex items-center gap-1.5"
          >
            <span>Try again</span>
          </button>
        </div>
      )}

      {/* REFLECTION CTA & PANEL */}
      <div
        id="reflection-panel"
        className="rounded-2xl p-6 sm:p-8 bg-[#11131a] border border-indigo-500/20 space-y-6 transition-all"
      >
        {!isReflecting ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="text-base font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Want to look deeper?</span>
              </h4>
              <p className="text-xs sm:text-sm text-slate-400 max-w-lg">
                Pick a question that challenged your thinking. We'll use your reflection in the next analysis pass.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleStartReflect}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs tracking-wide shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
              >
                <span>Reflect &amp; Re-analyze</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onReset}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#1c202d] hover:bg-[#252a3b] border border-slate-700 text-slate-300 hover:text-white font-medium text-xs tracking-wide transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Analyze another decision</span>
              </button>
            </div>
          </div>
        ) : (
          /* EXPANDED REFLECTION WORKFLOW */
          <form onSubmit={handleSubmitReflections} className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Reflect on your blind spots</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Answer 1 or 2 questions below. Your answers become evidence for a refined audit pass.
                </p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-[#1a1d27] border border-slate-700 text-slate-300">
                {answeredCount} / 2 answered
              </span>
            </div>

            {/* Questions to Answer */}
            <div className="space-y-4">
              {report.questions.map((q, idx) => {
                const isAnswered = Boolean(reflectionInputs[idx]?.trim());
                const isLimitReached = answeredCount >= 2 && !isAnswered;

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border transition-all ${
                      isAnswered
                        ? 'bg-[#151824] border-indigo-500/40'
                        : isLimitReached
                        ? 'bg-[#0f1118]/50 border-slate-800 opacity-60'
                        : 'bg-[#131620] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <p className="text-sm font-semibold text-white mb-2 flex items-start gap-2">
                      <span className="text-xs font-mono text-indigo-400 mt-0.5">Q{idx + 1}.</span>
                      <span>{q.question}</span>
                    </p>

                    <textarea
                      rows={2}
                      disabled={isRefining || isLimitReached}
                      value={reflectionInputs[idx] || ''}
                      onChange={(e) => handleInputChange(idx, e.target.value)}
                      placeholder={
                        isLimitReached
                          ? 'Maximum 2 reflection answers selected.'
                          : 'Your reflection on this question...'
                      }
                      className="w-full px-3.5 py-2 rounded-lg bg-[#0c0d14] border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-y disabled:cursor-not-allowed"
                    />
                  </div>
                );
              })}
            </div>

            {/* Validation Message */}
            {reflectionValidationMessage && (
              <p className="text-xs text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{reflectionValidationMessage}</span>
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <button
                type="submit"
                disabled={isRefining || answeredCount === 0}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/40 disabled:cursor-not-allowed text-white font-semibold text-xs tracking-wide shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2"
              >
                {isRefining ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Re-examining your reasoning...</span>
                  </>
                ) : (
                  <>
                    <span>Re-analyze My Reasoning</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsReflecting(false)}
                  disabled={isRefining}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={onReset}
                  disabled={isRefining}
                  className="px-4 py-2 rounded-xl bg-[#1c202d] hover:bg-[#252a3b] border border-slate-700 text-slate-300 text-xs font-medium transition-all flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Analyze another decision</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
