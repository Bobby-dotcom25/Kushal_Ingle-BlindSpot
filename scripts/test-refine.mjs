import dotenv from 'dotenv';
dotenv.config();
import refineHandler from '../api/refine.ts';

console.log('Testing /api/refine handler directly:');

const originalInput = {
  decision: "Should I take this 6-month internship?",
  options: ["Take it", "Do not take it"],
  factors: "stipend, distance from home, industry experience",
  reasoning: "I lean toward taking it because the stipend is good, it is close to home, and it gives me industry experience. But I also have a heavy college schedule."
};

const reflectionAnswers = [
  {
    question: "How do you define a 'heavy' college schedule in terms of hours or academic requirements?",
    answer: "I take 18 credit units this semester with two lab projects that require at least 15 hours per week of dedicated lab attendance."
  }
];

// Helper to invoke handler with mock req/res
async function callRefine(body) {
  let capturedStatus = 200;
  let capturedData = null;

  const req = {
    method: 'POST',
    body,
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

  await refineHandler(req, res);
  return { status: capturedStatus, data: capturedData };
}

console.log('\n1. Testing input validation (rejection of >2 answers):');
const invalidTooMany = await callRefine({
  originalInput,
  answers: [
    { question: "Q1", answer: "A1" },
    { question: "Q2", answer: "A2" },
    { question: "Q3", answer: "A3" }
  ]
});
console.log('   Status:', invalidTooMany.status, '(Expected: 400)');
console.assert(invalidTooMany.status === 400, 'Should reject more than 2 answers');

console.log('\n2. Testing input validation (rejection of empty answer):');
const invalidEmpty = await callRefine({
  originalInput,
  answers: [{ question: "Q1", answer: "   " }]
});
console.log('   Status:', invalidEmpty.status, '(Expected: 400)');
console.assert(invalidEmpty.status === 400, 'Should reject empty answer');

console.log('\n3. Testing valid /api/refine live Gemini call:');
const validCall = await callRefine({
  originalInput,
  answers: reflectionAnswers
});

console.log('   Status:', validCall.status);
if (validCall.status !== 200) {
  console.error('   Error response:', JSON.stringify(validCall.data, null, 2));
  process.exit(1);
}

console.log('   Refined report received successfully!');
console.log('   - Overlooked items:', validCall.data.overlooked?.length);
console.log('   - Assumptions items:', validCall.data.assumptions?.length);
console.log('   - Conflicts items:', validCall.data.conflicts?.length);
console.log('   - Questions items:', validCall.data.questions?.length);
console.log('   Sample refined question:', validCall.data.questions?.[0]);
console.log('\nAll /api/refine tests PASSED!');
