// ========== Input Validation Utilities ==========

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateRequired(value) {
  return value && value.trim().length > 0;
}

export function validateMinLength(value, minLength) {
  return value && value.length >= minLength;
}

export function validateMaxLength(value, maxLength) {
  return !value || value.length <= maxLength;
}

export function validateNumber(value) {
  return !isNaN(value) && !isNaN(parseFloat(value));
}

export function validatePositiveNumber(value) {
  return validateNumber(value) && parseFloat(value) > 0;
}

export function validateInteger(value) {
  return validateNumber(value) && Number.isInteger(parseFloat(value));
}

export function validatePositiveInteger(value) {
  return validateInteger(value) && parseFloat(value) > 0;
}

export function validateRange(value, min, max) {
  const num = parseFloat(value);
  return validateNumber(value) && num >= min && num <= max;
}

export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

export function validateQuestionData(data) {
  const errors = [];
  
  if (!validateRequired(data.prompt)) {
    errors.push('문제 내용이 필요합니다');
  }
  
  if (!validateRequired(data.answer)) {
    errors.push('정답이 필요합니다');
  }
  
  if (data.prompt && !validateMaxLength(data.prompt, 1000)) {
    errors.push('문제 내용은 1000자를 초과할 수 없습니다');
  }
  
  if (data.answer && !validateMaxLength(data.answer, 500)) {
    errors.push('정답은 500자를 초과할 수 없습니다');
  }
  
  if (data.explain && !validateMaxLength(data.explain, 1000)) {
    errors.push('설명은 1000자를 초과할 수 없습니다');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateDeckData(data) {
  const errors = [];
  
  if (!validateRequired(data.name)) {
    errors.push('덱 이름이 필요합니다');
  }
  
  if (data.name && !validateMaxLength(data.name, 100)) {
    errors.push('덱 이름은 100자를 초과할 수 없습니다');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateNoteData(data) {
  const errors = [];
  
  if (!validateRequired(data.name)) {
    errors.push('노트 제목이 필요합니다');
  }
  
  if (data.name && !validateMaxLength(data.name, 200)) {
    errors.push('노트 제목은 200자를 초과할 수 없습니다');
  }
  
  if (data.content && !validateMaxLength(data.content, 50000)) {
    errors.push('노트 내용은 50,000자를 초과할 수 없습니다');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}