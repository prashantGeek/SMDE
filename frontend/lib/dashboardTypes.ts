export type SessionSummary = {
  id: string;
  candidateName: string;
  role: string;
  createdAt: string;
};

export type UploadErrorResponse = {
  error?: string;
};

export type ValidationCheck = {
  field?: string;
  isConsistent?: boolean;
  status?: string;
  description?: string;
  message?: string;
};

export type ValidationReport = {
  overallStatus?: string;
  recommendations?: string[];
  consistencyChecks?: ValidationCheck[];
  missingDocuments?: string[];
  expiringDocuments?: { documentType?: string; isExpired?: boolean }[];
};

export type DocumentFlag = {
  severity?: string;
  message?: string;
};

export type DocumentValidity = {
  isExpired?: boolean;
  daysUntilExpiry?: number | null;
  dateOfIssue?: string | null;
  dateOfExpiry?: string | null;
  revalidationRequired?: boolean | null;
};

export type DocumentRecord = {
  holderName?: string;
  dateOfBirth?: string;
  nationality?: string;
  sirbNumber?: string;
  applicableRole?: string;
  documentType?: string;
  isExpired?: boolean;
  validity?: DocumentValidity;
  flags?: DocumentFlag[];
};

export type UploadMode = "sync" | "async";

export type SessionDetailsResponse = {
  documents?: DocumentRecord[];
  detectedRole?: string;
  validationResult?: ValidationReport | null;
};
