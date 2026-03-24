export type QueryRequest = {
  question: string
}

export type QueryResponse = {
  question: string
  answer: string
  source_invoices: string[]
  num_documents_retrieved: number
}

export type ChatRole = 'user' | 'assistant'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  sources?: string[]
  numDocumentsRetrieved?: number
  createdAt: string
}
