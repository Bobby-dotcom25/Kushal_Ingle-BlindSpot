import React, { useState } from 'react';
import { AnalyzeRequestBody } from '../lib/types';
import { Plus, Trash2, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';

interface DecisionFormProps {
  onSubmit: (data: AnalyzeRequestBody) => void;
  isLoading: boolean;
  initialData?: AnalyzeRequestBody;
}

export default function DecisionForm({
  onSubmit,
  isLoading,
  initialData,
}: DecisionFormProps) {
  const [decision, setDecision] = useState(initialData?.decision || '');
  const [options, setOptions] = useState<string[]>(
    initialData?.options && initialData.options.length >= 2
      ? initialData.options
      : ['', '']
  );
  const [factors, setFactors] = useState(initialData?.factors || '');
  const [reasoning, setReasoning] = useState(initialData?.reasoning || '');
  const [touched, setTouched] = useState(false);

  // Quick preset loader for hackathon demos
  const loadExample = () => {
    setDecision('Should I take this 6-month internship?');
    setOptions(['Take it', 'Do not take it']);
    setFactors('stipend, distance from home, industry experience');
    setReasoning(
      'I lean toward taking it because the stipend is good, it is close to home, and it gives me industry experience. But I also have a heavy college schedule.'
    );
    setTouched(false);
  };

  const handleAddOption = () => {
    if (options.length < 4) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  // Validation logic
  const isDecisionValid = decision.trim().length > 0;
  const areOptionsValid =
    options.length >= 2 && options.every((opt) => opt.trim().length > 0);
  const isFactorsValid = factors.trim().length > 0;
  const isReasoningValid = reasoning.trim().length > 0;
  const isFormValid =
    isDecisionValid && areOptionsValid && isFactorsValid && isReasoningValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isFormValid || isLoading) return;

    onSubmit({
      decision: decision.trim(),
      options: options.map((opt) => opt.trim()),
      factors: factors.trim(),
      reasoning: reasoning.trim(),
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto rounded-2xl bg-[#11131a] border border-slate-800 p-6 sm:p-8 shadow-2xl">
      {/* Form Header */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800/80">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Audit your decision
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Provide your raw thoughts. Blind Spot will surface what's unexamined.
          </p>
        </div>

        <button
          type="button"
          onClick={loadExample}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-medium border border-indigo-500/30 transition-all"
          title="Pre-fill with internship dilemma"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Load</span> Example
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. DECISION */}
        <div className="space-y-2">
          <label
            htmlFor="decision"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
          >
            What are you deciding? <span className="text-indigo-400">*</span>
          </label>
          <input
            id="decision"
            type="text"
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            placeholder="Should I take this 6-month internship?"
            className="w-full px-4 py-3 rounded-xl bg-[#171a24] border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          {touched && !isDecisionValid && (
            <p className="text-xs text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Please specify the decision you are considering.
            </p>
          )}
        </div>

        {/* 2. OPTIONS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Options considered (2–4) <span className="text-indigo-400">*</span>
            </label>
            {options.length < 4 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add option</span>
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500 w-5 text-right">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#171a24] border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    className="p-2 text-slate-500 hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-500/10"
                    title="Remove option"
                    aria-label={`Remove option ${idx + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {touched && !areOptionsValid && (
            <p className="text-xs text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Please provide at least 2 non-empty options.
            </p>
          )}
        </div>

        {/* 3. FACTORS */}
        <div className="space-y-2">
          <label
            htmlFor="factors"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
          >
            What factors are you considering? <span className="text-indigo-400">*</span>
          </label>
          <input
            id="factors"
            type="text"
            value={factors}
            onChange={(e) => setFactors(e.target.value)}
            placeholder="stipend, distance from home, learning, career growth..."
            className="w-full px-4 py-3 rounded-xl bg-[#171a24] border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          {touched && !isFactorsValid && (
            <p className="text-xs text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Please specify the factors you are evaluating.
            </p>
          )}
        </div>

        {/* 4. REASONING */}
        <div className="space-y-2">
          <label
            htmlFor="reasoning"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
          >
            Why are you leaning this way? <span className="text-indigo-400">*</span>
          </label>
          <textarea
            id="reasoning"
            rows={4}
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
            placeholder={`I lean toward taking it because...\nBut I'm also concerned about...`}
            className="w-full px-4 py-3 rounded-xl bg-[#171a24] border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-y min-h-[100px]"
          />
          {touched && !isReasoningValid && (
            <p className="text-xs text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Please explain your current reasoning.
            </p>
          )}
        </div>

        {/* SUBMIT BUTTON */}
        <div className="pt-2 text-center space-y-3">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/60 disabled:cursor-not-allowed text-white font-semibold text-sm tracking-wide shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2"
          >
            <span>Find My Blind Spots</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-xs text-slate-400 font-medium">
            Your reasoning is analyzed. Your decision remains yours.
          </p>
        </div>
      </form>
    </div>
  );
}
