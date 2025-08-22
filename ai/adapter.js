/**
 * @typedef {Object} GradingInput
 * @property {string} prompt - The user's answer to grade
 * @property {'cloud'|'local'} [modelHint] - Preferred model type
 * @property {'ko'|'en'|'mix'} [lang] - Language hint
 * @property {Object} [reference] - Reference data for grading
 * @property {string} [reference.answer] - Expected answer
 * @property {string[]} [reference.keywords] - Expected keywords
 */

/**
 * @typedef {Object} GradingOutput
 * @property {number} score - Score between 0 and 1
 * @property {boolean} correct - Whether the answer is considered correct
 * @property {string} [rationale] - Explanation of the grading
 * @property {'cloud'|'local'} used - Which adapter was actually used
 * @property {number} [tokens] - Number of tokens used (if applicable)
 */

/**
 * @typedef {Object} AIAdapter
 * @property {function(GradingInput): Promise<GradingOutput>} grade - Grade an answer
 */

export class CloudAdapter {
  /**
   * @param {GradingInput} input
   * @returns {Promise<GradingOutput>}
  */
  async grade(input) {
    let lastError;
    const config = window.__AI_CONF;
    if (!config || !config.baseUrl || !config.apiKey) {
      throw new Error('AI configuration not found. Set window.__AI_CONF with baseUrl, apiKey, provider, model');
    }
    
    const systemPrompt = "You are a bilingual (KR/EN) grader for essay questions. Return strict JSON only, no prose. Score ∈ [0,1]. correct=true if score≥0.75. Evaluate the overall content quality, accuracy, and completeness rather than just keyword matching. Respond rationale in Korean.";
    
    const isEssayQuestion = input.reference?.question;
    
    let userPrompt;
    if (isEssayQuestion) {
      // For essay questions, focus on content evaluation
      userPrompt = `Original Question: ${input.reference.question}
Expected Answer/Explanation: ${input.reference?.answer || 'N/A'}
Student's Answer: ${input.prompt}

Please evaluate the student's answer based on:
1. Accuracy of content
2. Completeness of explanation  
3. Understanding demonstrated
4. Overall quality

Output format (MUST):
{"score":0.0,"correct":false,"rationale":"한국어로 상세한 평가"}`;
    } else {
      // Fallback for other question types
      userPrompt = `Question: ${input.prompt}
Reference: ${input.reference?.answer || 'N/A'}
Keywords (optional): ${JSON.stringify(input.reference?.keywords || [])}

Output format (MUST):
{"score":0.0,"correct":false,"rationale":"한국어로 간단한 설명"}`;
    }

    const requestBody = this._buildRequestBody(config, systemPrompt, userPrompt);
    
    // Exponential backoff: 250ms, 750ms, 1500ms
    const delays = [250, 750, 1500];
    
    for (let attempt = 0; attempt < delays.length + 1; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, delays[attempt - 1]));
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        // Handle different authentication methods per provider
        let url = config.baseUrl;
        let headers = { 'Content-Type': 'application/json' };
        
        if (config.provider === 'gemini') {
          // Gemini uses API key as query parameter
          url += `?key=${config.apiKey}`;
        } else {
          // OpenAI and Anthropic use Authorization header
          headers['Authorization'] = `Bearer ${config.apiKey}`;
          if (config.provider === 'anthropic') {
            headers['anthropic-version'] = '2023-06-01';
          }
        }
        
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const content = this._extractContent(data, config.provider);
        const result = this._safeParseJSON(content);
        
        return {
          score: Math.max(0, Math.min(1, result.score)),
          correct: result.correct === true,
          rationale: result.rationale || 'No rationale provided',
          used: 'cloud',
          tokens: this._extractTokens(data, config.provider)
        };
        
      } catch (error) {
        lastError = error;
        if (error.name === 'AbortError') {
          lastError = new Error('Request timeout after 10 seconds');
        }
        if (attempt === delays.length) {
          // Fallback to local adapter on final failure
          const localAdapter = new LocalAdapter();
          const localResult = await localAdapter.grade(input);
          return {
            ...localResult,
            used: 'local-fallback',
            rationale: `${localResult.rationale} (cloud-fallback${lastError ? `: ${lastError.message}` : ''})`
          };
        }
      }
    }
  }
  
  _safeParseJSON(text) {
    try {
      const parsed = JSON.parse(text);
      // Handle array responses - take first element if it's an array
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0];
      }
      return parsed;
    } catch (_) {
      // Try to extract array first (for Gemini array responses)
      const arrayMatch = text && text.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        try {
          const parsed = JSON.parse(arrayMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed[0];
          }
        } catch (_) {}
      }
      
      // Fallback to object extraction
      const objMatch = text && text.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try { return JSON.parse(objMatch[0]); } catch (_) {}
      }
      
      throw new Error('Model did not return strict JSON');
    }
  }

  _buildRequestBody(config, systemPrompt, userPrompt) {
    const base = {
      max_tokens: 200,
      temperature: 0.2
    };
    
    switch (config.provider) {
      case 'openai':
        return {
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          ...base
        };
      case 'anthropic':
        return {
          model: config.model,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          ...base
        };
      case 'gemini':
        return {
          contents: [{
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
          }],
          generationConfig: {
            maxOutputTokens: base.max_tokens,
            temperature: base.temperature,
            responseMimeType: 'application/json'
          }
        };
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }
  
  _extractContent(data, provider) {
    switch (provider) {
      case 'openai':
        return data.choices?.[0]?.message?.content || '';
      case 'anthropic':
        return data.content?.[0]?.text || '';
      case 'gemini':
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
  
  _extractTokens(data, provider) {
    switch (provider) {
      case 'openai':
        return data.usage?.total_tokens;
      case 'anthropic':
        return data.usage?.input_tokens + data.usage?.output_tokens;
      case 'gemini':
        return data.usageMetadata?.totalTokenCount;
      default:
        return undefined;
    }
  }

  /**
   * Chat method for conversational responses
   * @param {string} question - The user's question
   * @param {string} context - The learning context
   * @returns {Promise<string>} - The AI response
   */
  async chat(question, context) {
    const config = window.__AI_CONF;
    if (!config || !config.baseUrl || !config.apiKey) {
      throw new Error('AI configuration not found');
    }

    const systemPrompt = "친근한 튜터로서 한국어로 간결하게 답변하세요. 핵심만 설명해주세요.";
    
    const userPrompt = `주제: ${context}\n질문: ${question}\n\n간단명료하게 답변:`;

    const requestBody = this._buildChatRequestBody(config, systemPrompt, userPrompt);
    
    try {
      let url = config.baseUrl;
      let headers = { 'Content-Type': 'application/json' };
      
      if (config.provider === 'gemini') {
        url += `?key=${config.apiKey}`;
      } else {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        if (config.provider === 'anthropic') {
          headers['anthropic-version'] = '2023-06-01';
        }
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return this._extractContent(data, config.provider);
      
    } catch (error) {
      throw new Error(`Chat failed: ${error.message}`);
    }
  }

  _buildChatRequestBody(config, systemPrompt, userPrompt) {
    const base = {
      max_tokens: 150,
      temperature: 0.3
    };
    
    switch (config.provider) {
      case 'openai':
        return {
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          ...base
        };
      case 'anthropic':
        return {
          model: config.model,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          ...base
        };
      case 'gemini':
        return {
          contents: [{
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
          }],
          generationConfig: {
            maxOutputTokens: base.max_tokens,
            temperature: base.temperature
            // Note: no responseMimeType for plain text
          }
        };
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }
}

export class LocalAdapter {
  /**
   * @param {GradingInput} input
   * @returns {Promise<GradingOutput>}
   */
  async grade(input) {
    const { gradeQuestion } = await import('../src/modules/scoring.js');
    
    // Create a question object compatible with scoring.js
    const question = {
      type: input.reference?.keywords?.length ? 'KEYWORD' : 'SHORT',
      answer: input.reference?.answer || '',
      keywords: input.reference?.keywords || [],
      synonyms: []
    };
    
    const feedback = gradeQuestion(question, input.prompt);
    
    let rationale;
    if (question.type === 'KEYWORD' && feedback.hits.length > 0) {
      rationale = `일치 keyword: ${feedback.hits.join(', ')}`;
      if (feedback.misses.length > 0) {
        rationale += ` | 누락: ${feedback.misses.join(', ')}`;
      }
    } else if (feedback.correct) {
      rationale = question.type === 'SHORT' ? '답변이 예상 응답과 일치함' : '정답';
    } else {
      rationale = question.type === 'SHORT' ? '답변이 예상 응답과 일치하지 않음' : '오답';
    }
    
    return {
      score: feedback.score,
      correct: feedback.correct === true,
      rationale: rationale,
      used: 'local',
      tokens: undefined
    };
  }
}
