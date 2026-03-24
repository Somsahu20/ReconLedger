export type ReviewerInfo = {
  id: string
  full_name: string
}

export type FlaggedInvoiceItem = {
  id: string
  invoice_number: string
  vendor_name: string
  grand_total: number | string
  currency: string
  status: 'FLAGGED' | string
  processed_at: string | null
  audit_report: string | null
}

export type ResolveReviewPayload = {
  note: string | null
}

export type ResolveReviewResponse = {
  invoice_id: string
  invoice_number: string
  status: 'REVIEWED' | string
  reviewed_by: ReviewerInfo
  review_note: string | null
  reviewed_at: string
}

export type ReviewHistoryItem = {
  id: string
  invoice_id: string
  reviewed_by: string | ReviewerInfo
  review_note: string | null
  reviewed_at: string
}
