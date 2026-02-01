import type { ValidationResult } from '../types/index.js';
import { VALIDATION } from '../config/constants.js';

export function validateDrawingEventData(data: any): ValidationResult {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'Event data must be an object' };
  }

  if (!data.id || typeof data.id !== 'string' || data.id.trim().length === 0) {
    return { isValid: false, error: 'Event ID must be a non-empty string' };
  }

  if (!data.type || !VALIDATION.VALID_EVENT_TYPES.includes(data.type)) {
    return {
      isValid: false,
      error: `Event type must be one of: ${VALIDATION.VALID_EVENT_TYPES.join(', ')}`,
    };
  }

  if (!Array.isArray(data.points) || data.points.length === 0) {
    return { isValid: false, error: 'Points must be a non-empty array' };
  }

  if (data.points.length > VALIDATION.MAX_POINTS_PER_EVENT) {
    return {
      isValid: false,
      error: `Points array exceeds maximum length of ${VALIDATION.MAX_POINTS_PER_EVENT}`,
    };
  }

  for (let i = 0; i < data.points.length; i++) {
    const point = data.points[i];
    if (!point || typeof point !== 'object') {
      return { isValid: false, error: `Point ${i} must be an object` };
    }

    if (
      typeof point.x !== 'number' ||
      typeof point.y !== 'number' ||
      typeof point.timestamp !== 'number'
    ) {
      return { isValid: false, error: `Point ${i} must have numeric x, y, and timestamp` };
    }

    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      !Number.isFinite(point.timestamp)
    ) {
      return { isValid: false, error: `Point ${i} coordinates must be finite numbers` };
    }
  }

  if (!data.style || typeof data.style !== 'object') {
    return { isValid: false, error: 'Style must be an object' };
  }

  const style = data.style;

  if (typeof style.color !== 'string' || style.color.trim().length === 0) {
    return { isValid: false, error: 'Style color must be a non-empty string' };
  }

  if (
    typeof style.lineWidth !== 'number' ||
    !Number.isFinite(style.lineWidth) ||
    style.lineWidth <= VALIDATION.MIN_LINE_WIDTH ||
    style.lineWidth > VALIDATION.MAX_LINE_WIDTH
  ) {
    return {
      isValid: false,
      error: `Style lineWidth must be a finite number between ${VALIDATION.MIN_LINE_WIDTH} and ${VALIDATION.MAX_LINE_WIDTH}`,
    };
  }

  if (!VALIDATION.VALID_LINE_CAPS.includes(style.lineCap)) {
    return {
      isValid: false,
      error: `Style lineCap must be one of: ${VALIDATION.VALID_LINE_CAPS.join(', ')}`,
    };
  }

  if (!VALIDATION.VALID_LINE_JOINS.includes(style.lineJoin)) {
    return {
      isValid: false,
      error: `Style lineJoin must be one of: ${VALIDATION.VALID_LINE_JOINS.join(', ')}`,
    };
  }

  if (
    typeof data.timestamp !== 'number' ||
    !Number.isFinite(data.timestamp) ||
    data.timestamp <= 0
  ) {
    return { isValid: false, error: 'Timestamp must be a positive finite number' };
  }

  return { isValid: true };
}
