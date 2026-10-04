export const BLIND_SPOT_JSON_SCHEMA = {
  type: "object",
  properties: {
    overlooked: {
      type: "array",
      description: "Meaningful factors absent or underexplored in the user's reasoning (max 4).",
      items: {
        type: "object",
        properties: {
          finding: {
            type: "string",
            description: "The overlooked factor identified."
          },
          evidence_quote: {
            type: "string",
            description: "Exact verbatim substring from user's input demonstrating context."
          }
        },
        required: ["finding", "evidence_quote"]
      }
    },
    assumptions: {
      type: "array",
      description: "Beliefs taken for granted in the user's reasoning (max 4).",
      items: {
        type: "object",
        properties: {
          finding: {
            type: "string",
            description: "The hidden assumption identified."
          },
          evidence_quote: {
            type: "string",
            description: "Exact verbatim substring from user's input."
          }
        },
        required: ["finding", "evidence_quote"]
      }
    },
    conflicts: {
      type: "array",
      description: "Tensions, inconsistencies, or trade-offs within the reasoning (max 4).",
      items: {
        type: "object",
        properties: {
          finding: {
            type: "string",
            description: "The conflict or tension identified."
          },
          evidence_quote: {
            type: "string",
            description: "Exact verbatim substring from user's input."
          }
        },
        required: ["finding", "evidence_quote"]
      }
    },
    questions: {
      type: "array",
      description: "3 to 5 open-ended questions that do not lead to a verdict.",
      items: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "An open-ended question to investigate the blind spot."
          },
          evidence_quote: {
            type: "string",
            description: "Exact verbatim substring from user's input."
          }
        },
        required: ["question", "evidence_quote"]
      }
    }
  },
  required: ["overlooked", "assumptions", "conflicts", "questions"]
} as const;
