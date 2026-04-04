export type ReconciliationSessionStatus = 'PENDING' | 'COMPLETE' | 'FAILED' | string

export type ReconciliationSummary = {
  total: number
  matched: number
  mismatched: number
  missing: number
  match_rate: number
  net_difference?: number | null
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
  id?: string
  invoice_number: string
  vendor: string
  listing_date: string
  listing_amount: number
  listing_tax: number
  currency?: string
  status: string
  discrepancies: string[]
  resolved_status?: string | null
  resolution_note?: string | null
  resolution_date?: string | null
  matched_invoice_id?: string | null
  matched_invoice_number?: string | null
  matched_vendor_name?: string | null
  matched_invoice_date?: string | null
  matched_invoice_amount?: number | null
  matched_invoice_tax?: number | null
  matched_invoice_currency?: string | null
}

export type ReconciliationReportResponse = {
  session_id: string
  session_name: string
  status: ReconciliationSessionStatus
  created_at: string
  summary: ReconciliationSummary
  ai_analysis?: ReconciliationUploadAiAnalysis | null
  risk_summary?: string | null
  items: ReconciliationReportItem[]
}

export type ReconciliationFilteredItem = {
  id?: string
  invoice_number: string
  vendor: string
  listing_date?: string
  listing_amount: number
  listing_tax?: number
  currency?: string
  status: string
  discrepancies: string[]
  resolved_status?: string | null
  resolution_note?: string | null
  resolution_date?: string | null
  matched_invoice_id?: string | null
  matched_invoice_number?: string | null
  matched_vendor_name?: string | null
  matched_invoice_date?: string | null
  matched_invoice_amount?: number | null
  matched_invoice_tax?: number | null
  matched_invoice_currency?: string | null
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

export type ReconciliationResolveAction = 'ACCEPT' | 'REJECT' | 'MANUALLY_APPROVED' | 'REJECTED'

export type ResolveReconciliationItemPayload = {
  action: ReconciliationResolveAction
  note?: string
}

export type ResolveReconciliationItemResponse = {
  message: string
}
