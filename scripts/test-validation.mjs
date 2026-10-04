import { validateBlindSpotReport, isQuoteInInput, checkVerdictViolation, buildCombinedInputText } from '../src/lib/validateReport.ts';

const mockInput = {
  decision: "Should I take this 6-month internship?",
  options: ["Take it", "Do not take it"],
  factors: "stipend, distance from home, industry experience",
  reasoning: "I lean toward taking it because the stipend is good, it is close to home, and it gives me industry experience. But I also have a heavy college schedule."
};

console.log('1. Testing combined source text generation:');
const corpus = buildCombinedInputText(mockInput);
console.assert(corpus.includes("Should I take this 6-month internship?"), 'Corpus must include decision');
console.assert(corpus.includes("Take it"), 'Corpus must include options');
console.assert(corpus.includes("stipend, distance from home, industry experience"), 'Corpus must include factors');
console.assert(corpus.includes("I lean toward taking it"), 'Corpus must include reasoning');
console.log('✓ Combined text includes all 4 components.');

console.log('2. Testing VERBATIM quote checking:');
console.assert(isQuoteInInput('stipend is good', corpus) === true, 'Exact substring must match');
console.assert(isQuoteInInput('"heavy college schedule"', corpus) === true, 'Quotation-wrapped quote must match');
console.assert(isQuoteInInput('lower your GPA', corpus) === false, 'Invented/hallucinated phrase must fail');
console.log('✓ Verbatim quote matching verified.');

console.log('3. Testing NO-VERDICT detection:');
console.assert(checkVerdictViolation('You should choose to accept this role') !== null, 'Should detect "you should"');
console.assert(checkVerdictViolation('I recommend taking option A') !== null, 'Should detect "I recommend"');
console.assert(checkVerdictViolation('This is the best option for your career') !== null, 'Should detect "best option"');
console.assert(checkVerdictViolation('How might this affect your schedule?') === null, 'Open question should be allowed');
console.log('✓ Verdict rule violations detected correctly.');

console.log('4. Testing complete report validation:');
const validReport = {
  overlooked: [
    { finding: "The daily study hours required alongside the internship are not specified.", evidence_quote: "heavy college schedule" },
    { finding: "The potential for long-term career progression or return offer is unaddressed.", evidence_quote: "industry experience" }
  ],
  assumptions: [
    { finding: "Assumes commute will not interfere with exam preparation.", evidence_quote: "it is close to home" },
    { finding: "Assumes monetary gain justifies the academic pressure.", evidence_quote: "the stipend is good" }
  ],
  conflicts: [
    { finding: "Tension between acquiring industry experience and managing a rigorous course load.", evidence_quote: "heavy college schedule" }
  ],
  questions: [
    { question: "How might the 6-month internship commitments interact with your examination periods?", evidence_quote: "6-month internship" },
    { question: "What specific projects or responsibilities will you have during the internship?", evidence_quote: "industry experience" },
    { question: "What flexibility exists in your schedule if coursework becomes overwhelming?", evidence_quote: "heavy college schedule" }
  ]
};

const validResult = validateBlindSpotReport(validReport, mockInput);
console.assert(validResult.isValid === true, 'Valid report must pass');
console.log('✓ Valid report passed schema and quote verification.');

console.log('5. Testing rejection of non-verbatim quotes:');
const invalidReportQuote = {
  ...validReport,
  overlooked: [
    { finding: "Invented quote check", evidence_quote: "unmentioned college campus location" }
  ]
};
const invalidResultQuote = validateBlindSpotReport(invalidReportQuote, mockInput);
console.assert(invalidResultQuote.isValid === false, 'Invalid quote must fail');
console.log('✓ Non-verbatim quote correctly rejected with error:', invalidResultQuote.errors[0]);

console.log('6. Testing rejection of verdict in finding:');
const invalidReportVerdict = {
  ...validReport,
  assumptions: [
    { finding: "You should choose the internship because it pays well.", evidence_quote: "the stipend is good" }
  ]
};
const invalidResultVerdict = validateBlindSpotReport(invalidReportVerdict, mockInput);
console.assert(invalidResultVerdict.isValid === false, 'Verdict finding must fail');
console.log('✓ Verdict finding correctly rejected with error:', invalidResultVerdict.errors[0]);

console.log('\nAll hardening verification tests PASSED successfully!');
