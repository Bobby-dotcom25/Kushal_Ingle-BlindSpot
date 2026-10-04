import dotenv from 'dotenv';
dotenv.config();

console.log('1. Checking .env file existence:');
import fs from 'fs';
const envExists = fs.existsSync('.env');
console.log('   .env exists:', envExists ? 'YES' : 'NO');

console.log('2. Checking GEMINI_API_KEY availability:');
const keyAvailable = Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);
console.log('   GEMINI_API_KEY configured:', keyAvailable ? 'YES' : 'NO');

if (!keyAvailable) {
  console.error('API key not available. Aborting test.');
  process.exit(1);
}

// Now test calling handler from api/analyze.ts
import handler from '../api/analyze.ts';

const testPayload = {
  decision: "Should I take this 6-month internship?",
  options: ["Take it", "Do not take it"],
  factors: "stipend, distance from home, industry experience",
  reasoning: "I lean toward taking it because the stipend is good, it is close to home, and it gives me industry experience. But I also have a heavy college schedule."
};

let capturedStatus = 200;
let capturedHeaders = {};
let capturedData = null;

const mockReq = {
  method: 'POST',
  body: testPayload,
  headers: {}
};

const mockRes = {
  statusCode: 200,
  setHeader(k, v) {
    capturedHeaders[k] = v;
    return this;
  },
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
      try {
        capturedData = JSON.parse(data);
      } catch {
        capturedData = data;
      }
    }
    return this;
  }
};

console.log('3. Sending POST request to handler with test payload...');
try {
  await handler(mockReq, mockRes);
  console.log('   HTTP STATUS:', capturedStatus);
  console.log('   Response preview (keys):', capturedData && typeof capturedData === 'object' ? Object.keys(capturedData) : typeof capturedData);
  if (capturedStatus !== 200) {
    console.error('   Error details:', JSON.stringify(capturedData, null, 2));
  } else {
    console.log('   Full verified response:');
    console.log(JSON.stringify(capturedData, null, 2));
  }
} catch (err) {
  console.error('   Handler threw exception:', err.message);
}
