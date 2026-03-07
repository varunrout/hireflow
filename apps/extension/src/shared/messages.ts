/**
 * Typed message contracts for extension-background-content communication.
 * All messages must use these types for type safety.
 */

export type MessageType =
  | "GET_PROFILE"
  | "GET_AUTOFILL_SUGGESTIONS"
  | "APPLY_AUTOFILL"
  | "CREATE_APPLICATION"
  | "GET_JOB_MATCH"
  | "AUTH_CHECK"
  | "AUTH_LOGOUT";

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
  requestId?: string;
}

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  requestId?: string;
}

export interface AutofillSuggestion {
  fieldId: string;
  fieldType: "text" | "textarea" | "select" | "date" | "email" | "phone";
  suggestedValue: string;
  confidence: number;
  source: "profile" | "resume" | "question_bank";
}

export interface AutofillRequest {
  jobUrl: string;
  formFields: DetectedField[];
  profileId?: string;
}

export interface DetectedField {
  id: string;
  name: string;
  label: string;
  type: string;
  placeholder?: string;
  required: boolean;
  currentValue?: string;
}

export interface JobDetectionResult {
  detected: boolean;
  jobTitle?: string;
  company?: string;
  jobUrl: string;
  platform?: string;
  applicationFormDetected: boolean;
}
