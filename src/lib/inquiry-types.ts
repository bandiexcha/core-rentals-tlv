export interface InquiryPayload {
  name: string;
  email: string;
  phone?: string;
  apartment?: string;
  checkin?: string;
  checkout?: string;
  guests?: string;
  notes?: string;
}

export interface StoredInquiry extends InquiryPayload {
  id: string;
  createdAt: string;
  emailSent: boolean;
}
