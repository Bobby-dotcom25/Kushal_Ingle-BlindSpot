import { useState, useEffect } from 'react';
import { Loader2, Search, Brain, Zap, HelpCircle } from 'lucide-react';

const AUDIT_STEPS = [
  { text: 'Checking overlooked factors...', icon: Search, color: 'text-cyan-400' },
  { text: 'Examining assumptions...', icon: Brain, color: 'text-indigo-400' },
  { text: 'Looking for tensions...', icon: Zap, color: 'text-amber-400' },
  { text: 'Finding better questions...', icon: HelpCircle, color: 'text-emerald-400' },
];

export default function LoadingState() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1) % AUDIT_STEPS.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const currentStep = AUDIT_STEPS[currentStepIndex];
  const StepIcon = currentStep.icon;

  return (
    <div className="w-full max-w-2xl mx-auto my-12 p-8 rounded-2xl bg-[#11131a] border border-indigo-500/20 shadow-2xl flex flex-col items-center justify-center text-center transition-all animate-in fade-in duration-300">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-full border-2 border-indigo-500/30 flex items-center justify-center bg-indigo-950/40">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
        <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#1a1d27] border border-slate-700">
          <StepIcon className={`w-4 h-4 ${currentStep.color} animate-pulse`} />
        </div>
      </div>

      <h3 className="text-xl font-semibold text-white tracking-tight mb-2">
        Auditing your reasoning...
      </h3>

      <div className="h-8 flex items-center justify-center">
        <p className={`text-sm font-medium ${currentStep.color} transition-all duration-300 flex items-center gap-2`}>
          <span>{currentStep.text}</span>
        </p>
      </div>

      <div className="w-48 h-1 bg-slate-800 rounded-full mt-6 overflow-hidden">
        <div className="w-full h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-500 rounded-full animate-pulse" />
      </div>

      <p className="text-xs text-slate-500 mt-4">
        Extracting verbatim evidence without generating verdicts
      </p>
    </div>
  );
}
