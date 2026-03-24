export type ReconciliationSessionStatus = 'PENDING' | 'COMPLETE' | 'FAILED' | string

export type ReconciliationSummary = {
  total: number
  matched: number
  mismatched: number
  missing: number
  match_rate: number
}

export type ReconciliationUploadAiAnalysis = {
  executive_summary: string
  risk_level: string
  recommendations: string[]
}

export type ReconciliationUploadItem = {
  invoice_number: string
  status: string
  matched_to?: string
  discrepancies: string[]
  ai_confidence?: number
}

export type ReconciliationUploadResponse = {
  session_id: string
  session_name: string
  summary: ReconciliationSummary
  ai_analysis: ReconciliationUploadAiAnalysis
  items: ReconciliationUploadItem[]
}

export type ReconciliationSessionListItem = {
  id: string
  name: string
  status: ReconciliationSessionStatus
  created_at: string
}

export type ReconciliationReportItem = {
  invoice_number: string
  vendor: string
  listing_date: string
  listing_amount: number
  listing_tax: number
  currency?: string
  status: string
  discrepancies: string[]
}

export type ReconciliationReportResponse = {
  session_id: string
  session_name: string
  status: ReconciliationSessionStatus
  created_at: string
  summary: ReconciliationSummary
  items: ReconciliationReportItem[]
}

export type ReconciliationFilteredItem = {
  invoice_number: string
  vendor: string
  listing_amount: number
  currency?: string
  status: string
  discrepancies: string[]
}

export type ReconciliationFilteredItemsResponse = {
  session_id: string
  filter: string
  count: number
  items: ReconciliationFilteredItem[]
}

export type ReconciliationFilterStatus =
  | 'all'
  | 'matched'
  | 'missing'
  | 'amount_mismatch'
  | 'vendor_mismatch'
  | 'date_mismatch'
  | 'tax_mismatch'
  | 'multiple_mismatch'
  | 'ai_match'
  | 'ai_matched_with_discrepancies'
