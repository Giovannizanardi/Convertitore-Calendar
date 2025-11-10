export interface EventObject {
  id: number;
  subject: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  description: string;
  location: string;
}

export interface ValidationErrors {
  subject?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
}

export interface ValidatedEvent extends EventObject {
  errors: ValidationErrors;
  isValid: boolean;
}
