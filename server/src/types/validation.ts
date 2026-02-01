export interface ValidationResult {
  readonly isValid: boolean;
  readonly error?: string;
}

export interface StateValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
}
