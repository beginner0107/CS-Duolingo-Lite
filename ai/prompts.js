export const SYSTEM_PROMPT = "You are a KR/EN short-answer grader. Return ONLY strict JSON: {\"score\":0..1,\"correct\":bool,\"rationale\":\"...\"}. Consider meaning, synonyms, brevity. No extra text.";

export const USER_TEMPLATE = ({question, reference, keywords, student}) => 
  `Q: ${question || 'N/A'}\nExpected: ${reference || 'N/A'}\nKeywords: ${JSON.stringify(keywords || [])}\nStudent: ${student || 'N/A'}`;