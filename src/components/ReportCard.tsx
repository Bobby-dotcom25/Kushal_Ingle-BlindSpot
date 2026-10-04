import React from 'react';
import { Finding, Question } from '../lib/types';
import { Quote } from 'lucide-react';

interface ReportCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  badgeText: string;
  badgeColorClass: string;
  borderColorClass: string;
  items: (Finding | Question)[];
  isQuestionCard?: boolean;
}

export default function ReportCard({
  title,
  subtitle,
  icon,
  badgeText,
  badgeColorClass,
  borderColorClass,
  items,
  isQuestionCard = false,
}: ReportCardProps) {
  // Format quote cleanly without double-quotes if already wrapped
  const formatQuote = (quote: string) => {
    if (!quote) return '';
    const trimmed = quote.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith('“') && trimmed.endsWith('”'))
    ) {
      return trimmed;
    }
    return `"${trimmed}"`;
  };

  return (
    <div
      className={`flex flex-col h-full rounded-2xl bg-[#11131a] border ${borderColorClass} p-6 shadow-xl transition-all duration-200 hover:border-opacity-60`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#1a1d27] border border-slate-700/60 text-slate-200">
            {icon}
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              {title}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              {subtitle}
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] font-mono uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md border ${badgeColorClass}`}
        >
          {badgeText}
        </span>
      </div>

      {/* Content list */}
      <div className="flex-1 space-y-4 pt-2">
        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 italic">
            No clear blind spot found from the information provided.
          </div>
        ) : (
          items.map((item, idx) => {
            const text = isQuestionCard
              ? (item as Question).question
              : (item as Finding).finding;
            const quote = item.evidence_quote;

            return (
              <div
                key={idx}
                className="p-4 rounded-xl bg-[#161922] border border-slate-800/80 space-y-3"
              >
                {/* Main Finding or Question */}
                <p className="text-sm font-medium text-slate-200 leading-snug">
                  {text}
                </p>

                {/* Verbatim Evidence Quote Box */}
                {quote && (
                  <div className="pt-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-1">
                      <Quote className="w-3 h-3 text-slate-500" />
                      <span>YOUR WORDS</span>
                    </div>
                    <div className="pl-3 border-l-2 border-indigo-500/50 text-xs italic text-indigo-200/90 bg-indigo-950/20 py-1.5 pr-2 rounded-r-md">
                      {formatQuote(quote)}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
