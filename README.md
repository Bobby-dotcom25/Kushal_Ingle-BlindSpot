# THE BLIND SPOT 👁️‍🗨️

> **"Most tools tell you what to decide. Blind Spot shows you what you didn't think about, quoting your own reasoning back at you, and never decides for you."**

THE BLIND SPOT is an AI-powered reasoning-audit tool designed to illuminate cognitive blind spots, hidden assumptions, internal tensions, and unasked questions in human decision-making.

---

## ⚡ Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Vercel Serverless Functions (`api/analyze.ts`)
- **AI Engine**: Google Gemini API (`gemini-1.5-flash` with Structured Outputs)
- **Database / Storage**: None (zero-state, privacy-first)
- **Authentication**: None

---

## 📁 Project Structure

```
the-blind-spot/
├── api/
│   └── analyze.ts            # Vercel Serverless Function & Gemini API Handler
├── src/
│   ├── lib/
│   │   ├── blindSpotPrompt.ts # AI Audit System Prompt & Evidence Rules
│   │   ├── blindSpotSchema.ts # JSON Schema enforcement
│   │   ├── types.ts           # TypeScript Interfaces (Finding, Report, etc.)
│   │   └── validateReport.ts  # Quote Verifier & Schema Validator
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
│   └── favicon.svg
├── .env.example
├── .gitignore
├── package.json
├── vite.config.ts
└── README.md
```

---

## 🚀 Quick Setup & Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and add your Google Gemini API Key:
```env
GEMINI_API_KEY=AIzaSy...
```
*(Get an API key from [Google AI Studio](https://aistudio.google.com/))*

### 3. Start the Development Server
```bash
npm run dev
```
The application and the local `/api/analyze` endpoint will be live at `http://localhost:3000`.

---

## 🧪 Testing `/api/analyze`

You can test the reasoning audit API directly using `curl` or PowerShell:

### cURL Example:
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "Should I take this 6-month internship?",
    "options": ["Take it", "Don'\''t take it"],
    "factors": "stipend, distance from home, industry experience",
    "reasoning": "I lean toward taking it because the stipend is good, it is close to home, and it gives me industry experience. But I also have a heavy college schedule."
  }'
```

### PowerShell Example:
```powershell
$body = @{
  decision = "Should I take this 6-month internship?"
  options = @("Take it", "Don't take it")
  factors = "stipend, distance from home, industry experience"
  reasoning = "I lean toward taking it because the stipend is good, it is close to home, and it gives me industry experience. But I also have a heavy college schedule."
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/analyze" -Method Post -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 5
```

### Sample Output:
```json
{
  "overlooked": [
    {
      "finding": "Impact on academic GPA or graduation timeline is not mentioned despite course load.",
      "evidence_quote": "heavy college schedule"
    },
    {
      "finding": "Long-term career conversion or return offer potential is unaddressed.",
      "evidence_quote": "gives me industry experience"
    }
  ],
  "assumptions": [
    {
      "finding": "Assumes physical proximity eliminates scheduling fatigue.",
      "evidence_quote": "it is close to home"
    },
    {
      "finding": "Assumes compensation outweighs the academic compromise.",
      "evidence_quote": "the stipend is good"
    }
  ],
  "conflicts": [
    {
      "finding": "Direct tension between demanding commitments.",
      "evidence_quote": "gives me industry experience. But I also have a heavy college schedule."
    }
  ],
  "questions": [
    {
      "question": "How many hours per week are required, and how does that map against your heaviest academic days?",
      "evidence_quote": "heavy college schedule"
    },
    {
      "question": "What specific skills or mentorship will this experience provide compared to future opportunities?",
      "evidence_quote": "gives me industry experience"
    },
    {
      "question": "If your grades begin to slip mid-semester, what flexibility exists in the internship arrangement?",
      "evidence_quote": "6-month internship"
    }
  ]
}
```

---

## 🚢 Deploying to Vercel

1. Push your repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: initial Blind Spot reasoning audit engine"
   git remote add origin https://github.com/<your-username>/the-blind-spot.git
   git push -u origin main
   ```
2. Import project into [Vercel](https://vercel.com).
3. Add `GEMINI_API_KEY` under **Project Settings > Environment Variables**.
4. Deploy!
