from typing import List, Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from utils.log import logger
from app.config import settings
from app.services.vector_store import search_invoices
from app.services.extractor import MODEL
from fastapi import HTTPException
from starlette import status

QUERY_SYSTEM_PROMPT = """
You are ReconLedger, an expert AI financial assistant. 
Think and respond like a Chartered Accountant — 
precise, structured, and data driven. You will be asked to tell about certain invoices. You have to find the invoice's information from the data which is fed to you.

## RESPONSE RULES
- Answer directly first, then provide supporting data
- ALWAYS cite invoice numbers: 
  "Invoice INV-001 from Acme Corp dated 01-Jan-2025..."
- NEVER make up invoice data not present in the context
- Present all amounts with currency and 2 decimal places: ₹50,000.00
- When calculating totals, show the breakdown explicitly
- Think step by step before answering numerical questions

## OUTPUT FORMAT
- Single invoice query → paragraph
- Multiple invoices → table format:

| Invoice  | Vendor    | Amount     | Status  |
|----------|-----------|------------|---------|
| INV-001  | Acme Corp | ₹50,000.00 | Clean   |

## IF DATA IS MISSING
"I couldn't find sufficient data to answer this accurately. 
Please verify the invoices have been uploaded."

## NEVER
- Hallucinate invoice details
- Give tax or legal compliance advice
- Answer questions unrelated to invoice data
"""

QUERY_TEMPLATE = """Based on the following invoice data, answer this question: {question}

Invoice Data:
{invoice_context}

Provide a clear, accurate answer. Reference specific invoice numbers where applicable.
"""

async def process_query(question: str) -> Dict[str, Any]:
    
    try:
        retrieved_docs = await search_invoices(question, top_k=settings.CHROMA_TOP_K)
        
        if not retrieved_docs:
            return {
                "question": question,
                "answer": "I don't have enough invoice data to answer this question accurately. Please upload some invoices first.",
                "source_invoices": [],
                "num_documents_retrieved": 0
            }
        
        #! For building the context for llm
        invoice_context = []
        source_invoices = []
        
        for doc in retrieved_docs:
            metadata = doc["metadata"]
            invoice_context.append(
                f"Invoice {metadata.get('invoice_number')}: "
                f"Vendor: {metadata.get('vendor_name')}, "
                f"Date: {metadata.get('date')}, "
                f"Total: {metadata.get('currency')} {metadata.get('grand_total')}"
            )
            source_invoices.append(metadata.get('invoice_number'))
        
        context_str = "\n\n".join(invoice_context)
        

        llm = ChatGoogleGenerativeAI(
            model=MODEL,
            google_api_key=settings.QUERY_API,
            temperature=0.2,
        )
        
        prompt = QUERY_TEMPLATE.format(
            question=question,
            invoice_context=context_str
        )

    
    
        response = await llm.ainvoke(QUERY_SYSTEM_PROMPT + prompt)
        
        return {
            "question": question,
            "answer": response.content if isinstance(response.content, str) else next(
    (block["text"] for block in response.content if block["type"] == "text"), ""),
            "source_invoices": source_invoices,
            "num_documents_retrieved": len(retrieved_docs)
        }
    
    except Exception as err:
        logger.error(f"Error in query_engine.process_query. The error is {err}")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Error in query_engine.process_query")
