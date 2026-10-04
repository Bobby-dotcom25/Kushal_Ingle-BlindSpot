import dotenv from 'dotenv';
dotenv.config();
import analyzeHandler from '../api/analyze.ts';

const testInput = {
  decision: "should i take any internship",
  options: ["yes", "look for other options"],
  factors: "stipend, distance from home, mode, career growth,",
  reasoning: "because i want to gain new skills and experience for my growth"
};

let capturedStatus = 200;
let capturedData = null;

const req = {
  method: 'POST',
  body: testInput,
  headers: {}
};

const res = {
  statusCode: 200,
  setHeader() { return this; },
  status(code) {
    capturedStatus = code;
    this.statusCode = code;
    return this;
  },
  json(data) {
    capturedData = data;
    return this;
  },
  end(data) {
    if (data && !capturedData) {
      try { capturedData = JSON.parse(data); } catch { capturedData = data; }
    }
    return this;
  }
};

console.log('Sending test request to /api/analyze with exact input...');
await analyzeHandler(req, res);

console.log('\nHTTP STATUS:', capturedStatus);
if (capturedStatus !== 200) {
  console.error('Error:', JSON.stringify(capturedData, null, 2));
  process.exit(1);
}

console.log('\n--- RETURNED REPORT ---');
console.log(JSON.stringify(capturedData, null, 2));

console.log('\n--- VERIFICATION AUDIT ---');
// Verify every finding has direct support and conservative interpretation
for (const cat of ['overlooked', 'assumptions', 'conflicts']) {
  console.log(`\nCategory: ${cat} (${capturedData[cat]?.length || 0} findings)`);
  capturedData[cat]?.forEach((item, idx) => {
    console.log(`  [${idx + 1}] Finding: "${item.finding}"`);
    console.log(`      Evidence: "${item.evidence_quote}"`);
  });
}

console.log(`\nCategory: questions (${capturedData.questions?.length || 0} questions)`);
capturedData.questions?.forEach((item, idx) => {
  console.log(`  [${idx + 1}] Question: "${item.question}"`);
  console.log(`      Evidence: "${item.evidence_quote}"`);
});
