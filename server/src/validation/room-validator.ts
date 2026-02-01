import type { ValidationResult } from '../types/index.js';
import { VALIDATION } from '../config/constants.js';

export function validateRoomId(roomId: any): ValidationResult {
  if (!roomId || typeof roomId !== 'string') {
    return { isValid: false, error: 'Room ID must be a non-empty string' };
  }

  const trimmedId = roomId.trim();

  if (trimmedId.length < VALIDATION.MIN_ROOM_ID_LENGTH) {
    return {
      isValid: false,
      error: `Room ID must be at least ${VALIDATION.MIN_ROOM_ID_LENGTH} character(s)`,
    };
  }

  if (trimmedId.length > VALIDATION.MAX_ROOM_ID_LENGTH) {
    return {
      isValid: false,
      error: `Room ID must not exceed ${VALIDATION.MAX_ROOM_ID_LENGTH} characters`,
    };
  }

  const validRoomIdPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validRoomIdPattern.test(trimmedId)) {
    return {
      isValid: false,
      error: 'Room ID can only contain alphanumeric characters, hyphens, and underscores',
    };
  }

  return { isValid: true };
}

export function validateJoinRoomData(data: any): ValidationResult {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'Join room data must be an object' };
  }

  const roomIdValidation = validateRoomId(data.roomId);
  if (!roomIdValidation.isValid) {
    return roomIdValidation;
  }

  // createIfNotExists is optional, but if present must be boolean
  if (data.createIfNotExists !== undefined && typeof data.createIfNotExists !== 'boolean') {
    return { isValid: false, error: 'createIfNotExists must be a boolean if provided' };
  }

  return { isValid: true };
}
