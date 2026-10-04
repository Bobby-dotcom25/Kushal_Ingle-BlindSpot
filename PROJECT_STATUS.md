# THE BLIND SPOT — Project Status & Technical Briefing

**Generated**: October 4, 2026  
**Application**: THE BLIND SPOT (AI Reasoning-Audit Tool)  
**Hackathon Stage**: Stage 4 Complete (Reflect & Re-analyze Loop Live and Verified)

---

## 1. What Is Happening (Project Overview)

**THE BLIND SPOT** is an AI-powered cognitive reasoning-audit tool designed to help users dissect critical decisions without having an AI decide for them.

### Core Value Proposition (USP)
> *"Most tools tell you what to decide. Blind Spot shows you what you didn't think about, quoting your own reasoning back at you, and never decides for you."*

### Key Guarantees Enforced:
1. **Verbatim Evidence Rule**: Every single finding quotes exact words from the user's input (`decision`, `options`, `factors`, `reasoning`, or reflection answers). No paraphrasing or hallucinated quotes.
2. **Direct Support & Conservative Interpretation Rule**: Quotes must provide direct, explanatory textual support for the finding without over-inferring or extrapolating into unmentioned domains.
3. **Quality > Quantity**: The system returns 0 conflicts (`conflicts: []`) if no explicit tensions exist, rather than manufacturing artificial friction.
4. **No-Verdict Rule**: The system strictly refuses to make recommendations, select options, rank choices, or say *"you should"* / *"I recommend"*. It turns guidance into open-ended questions.
5. **No Invented Facts**: The AI is banned from assuming unmentioned specifics (such as GPA issues, exam dates, graduation delays, or return offers) as established facts.
6. **Two-Pass Reasoning Loop**: Users can reflect on questions and submit answers for an updated audit pass (`/api/refine`), incorporating reflection answers into the evidence corpus.

---

## 2. What Is Currently Running

| Component | Status | Details |
| :--- | :--- | :--- |
| **Vite Dev Server** | 🟢 **ACTIVE** | Running at `http://localhost:3000/` (serving React frontend, `/api/analyze`, and `/api/refine`) |
| **Gemini AI Engine** | 🟢 **CONNECTED** | Live integration via `@google/generative-ai` with structured JSON schema enforcement (`gemini-3.1-flash-lite` primary) |
| **Reflection Engine** | 🟢 **OPERATIONAL** | `/api/refine` endpoint accepts reflections, verifies evidence, and returns refined maps |
| **Browser UI Flow** | 🟢 **VERIFIED** | End-to-end test completed via browser subagent (Example $\rightarrow$ Analyze $\rightarrow$ Reflect $\rightarrow$ Re-analyze $\rightarrow$ Reset) |
| **TypeScript Compiler** | 🟢 **0 ERRORS** | Passes strict typecheck (`npx tsc --noEmit`) |
| **Production Build** | 🟢 **PASSING** | Vite production bundle created (`dist/`) in ~8.1s |

---

## 3. How the Multi-Pass Analysis Pipeline Works

```
[Initial Decision Input]
  ├── Decision, Options, Factors, Reasoning
  ▼
[POST /api/analyze]
  ▼
[Initial Blind Spot Map]
  ├── Overlooked Factors, Hidden Assumptions, Conflicts, Questions
  ▼
[User Reflection on Questions]
  ├── User answers 1–2 audit questions
  ▼
[POST /api/refine]
  ├── Combined Canonical Corpus: Original Input + Reflection Answers
  ├── Gemini Re-analysis with Direct Support & No-Verdict constraints
  ├── Verbatim Quote Verification against combined corpus
  ▼
[Refined Blind Spot Map]
  ├── Labeled with "REFLECTION PASS COMPLETE"
  └── Updated findings quoting both original reasoning and reflection answers
```
