import { useState } from 'react';
import { BlindSpotReport as ReportType, AnalyzeRequestBody, ReflectionAnswer } from './lib/types';
import DecisionForm from './components/DecisionForm';
import BlindSpotReport from './components/BlindSpotReport';
import LoadingState from './components/LoadingState';
import { AlertCircle, RotateCcw, ShieldCheck } from 'lucide-react';

export default function App() {
  const [formData, setFormData] = useState<AnalyzeRequestBody | undefined>(undefined);
  const [report, setReport] = useState<ReportType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refine pass states
  const [isRefining, setIsRefining] = useState(false);
  const [isRefinedPass, setIsRefinedPass] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);

  const handleSubmit = async (data: AnalyzeRequestBody) => {
    setFormData(data);
    setIsLoading(true);
    setErrorMessage(null);
    setReport(null);
    setIsRefinedPass(false);
    setRefineError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('The AI service is temporarily busy. Please try again in a moment.');
        }
        let serverMsg = '';
        try {
          const errJson = await response.json();
          serverMsg = errJson?.error || errJson?.message || '';
        } catch {
          // fallback
        }
        throw new Error(serverMsg || 'Something went wrong. Your reasoning wasn\'t lost. Please try again.');
      }

      const result = await response.json();
      setReport(result);

      // Scroll smoothly to report view
      window.scrollTo({ top: 350, behavior: 'smooth' });
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Something went wrong. Your reasoning wasn\'t lost. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefine = async (answers: ReflectionAnswer[]) => {
    if (!formData) return;

    setIsRefining(true);
    setRefineError(null);

    try {
      const response = await fetch('/api/refine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalInput: formData,
          answers,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('The AI service is temporarily busy. Please try again in a moment.');
        }
        let serverMsg = '';
        try {
          const errJson = await response.json();
          serverMsg = errJson?.error || errJson?.message || '';
        } catch {
          // fallback
        }
        throw new Error(serverMsg || 'Reflection analysis couldn\'t be completed. Your original analysis is still available.');
      }

      const refinedResult = await response.json();
      setReport(refinedResult);
      setIsRefinedPass(true);

      // Scroll to top of report smoothly
      window.scrollTo({ top: 350, behavior: 'smooth' });
    } catch (err: any) {
      setRefineError(
        err?.message || 'Reflection analysis couldn\'t be completed. Your original analysis is still available.'
      );
    } finally {
      setIsRefining(false);
    }
  };

  const handleReset = () => {
    setReport(null);
    setErrorMessage(null);
    setIsRefinedPass(false);
    setRefineError(null);
    setFormData(undefined);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRetry = () => {
    if (formData) {
      handleSubmit(formData);
    } else {
      setErrorMessage(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-[#090a0f]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold font-mono text-sm">
              👁️
            </div>
            <span className="font-extrabold tracking-tight text-white text-base sm:text-lg">
              THE BLIND SPOT
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>AI REASONING AUDIT</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-12">
        {/* SECTION 1 — HEADER / HERO */}
        <section className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-block px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-medium tracking-wide">
            Zero recommendations • Exact verbatim quotes • No verdicts
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white">
            See what you{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-300 bg-clip-text text-transparent">
              didn't think about.
            </span>
          </h1>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
            An AI reasoning audit that surfaces overlooked factors, hidden assumptions, conflicts, and better questions — without making the decision for you.
          </p>
        </section>

        {/* SECTION 2 — DECISION FORM & INTERACTIONS */}
        {!report && !isLoading && (
          <section className="animate-in fade-in duration-300">
            <DecisionForm
              onSubmit={handleSubmit}
              isLoading={isLoading}
              initialData={formData}
            />
          </section>
        )}

        {/* ERROR STATE CARD */}
        {errorMessage && (
          <section className="max-w-xl mx-auto p-6 rounded-2xl bg-rose-950/20 border border-rose-500/30 text-center space-y-4 animate-in fade-in duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Something went wrong</h3>
              <p className="text-sm text-slate-300 mt-1">{errorMessage}</p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleRetry}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs tracking-wide transition-all shadow-lg shadow-rose-600/20 flex items-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Try again</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl bg-[#1a1d27] border border-slate-700 text-slate-300 text-xs font-medium hover:text-white transition-all"
              >
                Edit inputs
              </button>
            </div>
          </section>
        )}

        {/* LOADING STATE */}
        {isLoading && (
          <section>
            <LoadingState />
          </section>
        )}

        {/* SECTION 3 — BLIND SPOT REPORT */}
        {report && !isLoading && (
          <section>
            <BlindSpotReport
              report={report}
              onReset={handleReset}
              onRefine={handleRefine}
              isRefining={isRefining}
              isRefinedPass={isRefinedPass}
              refineError={refineError}
              onClearRefineError={() => setRefineError(null)}
            />
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#090a0f] py-8 text-center text-xs text-slate-500 space-y-2">
        <p className="font-mono">
          THE BLIND SPOT — AI Reasoning Audit Tool
        </p>
        <p className="text-slate-600">
          "Most tools tell you what to decide. Blind Spot shows you what you didn't think about, quoting your own reasoning back at you, and never decides for you."
        </p>
      </footer>
    </div>
  );
}
