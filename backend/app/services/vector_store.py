import os
from typing import List
import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from fastapi import HTTPException
from app.config import settings
from models.invoices import Invoice
from utils.log import logger
from starlette import status
from utils.log import logger
from pinecone import Pinecone
from pinecone.models import ServerlessSpec

# Global vector store instance
_vector_store = None
_collection = None

def get_embeddings():
    return GoogleGenerativeAIEmbeddings(
        model="gemini-embedding-001",
        google_api_key=settings.EMBEDDINGS_API
    )

def init_vector_store():

    global _vector_store, _collection
    
    pc = Pinecone(api_key=settings.PINECONE_API_KEY)
    index_name = settings.INDEX_NAME
    if not pc.has_index(index_name):
        pc.create_index(
            name=settings.INDEX_NAME,
            dimension=3072,              
            metric="cosine",            
            spec=ServerlessSpec(
                cloud=settings.PINECONE_CLOUD,
                region=settings.PINECONE_LOC
            )
        )
    else:
        logger.info(f"Index {settings.INDEX_NAME} already exists")

    _collection = pc.Index(settings.INDEX_NAME)

    return _collection


    

def get_collection():
    global _collection
    if _collection is None:
        _collection = init_vector_store()
    return _collection

async def index_invoice(invoice: Invoice):
    
    #todo Index an invoice in ChromaDB for semantic search.
    
    collection = get_collection()
    
    #? Text Summary
    text_summary = generate_invoice_summary(invoice)
    
    #? Generate embedding

    try:

        embeddings = get_embeddings()
        embedding = await embeddings.aembed_query(text_summary)
        
        #? Store in ChromaDB
        doc_id = str(invoice.id)
        
        metadata = {
            "invoice_number": invoice.invoice_number,
            "vendor_name": invoice.vendor_name,
            "date": str(invoice.date),
            "grand_total": float(invoice.grand_total),
            "currency": invoice.currency,
            "status": invoice.status.value,
        }
        
        #todo create or update records by ID
        collection.upsert(
            vectors = [{
                "id": doc_id,
                "values": embedding,
                "metadata": {**metadata, "document": text_summary}
            }]
        )
    
    except Exception as err:
        logger.error(f"Error in indexing errors. The exact error is {err}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error in indexing invoices")

def generate_invoice_summary(invoice: Invoice) -> str:
    line_items_text = []
    for item in invoice.line_items:
        line_items_text.append(
            f"{item.description}: {item.quantity} x {item.unit_price} = {item.line_total}"
        )
    
    summary = f"""
    Invoice {invoice.invoice_number} from {invoice.vendor_name}.
    Date: {invoice.date}, Due: {invoice.due_date or 'Not specified'}.
    Currency: {invoice.currency}.
    Line items: {'; '.join(line_items_text)}.
    Subtotal: {invoice.subtotal}, Tax Rate: {invoice.tax_rate}%, Tax: {invoice.tax_amount}.
    Grand Total: {invoice.grand_total}.
    Status: {invoice.status.value}.
    """
    
    return summary

async def delete_invoice_from_index(invoice_id: str):
    collection = get_collection()
    collection.delete(ids=[invoice_id])

async def search_invoices(query: str, top_k: int = settings.CHROMA_TOP_K) -> List[dict]:    
    collection = get_collection()
    
    try:
    #todo query embedding
        embeddings = get_embeddings()
        query_embedding = await embeddings.aembed_query(query)
        
        
        results = collection.query(
            vector=query_embedding,
            top_k=top_k,
            include_values=False,      
            include_metadata=True  
        )

        logger.info(results)
        

        documents = []
        if results.matches and len(results.matches) > 0:
            for i in range(len(results.matches)):
                documents.append({
                    "id": results.matches[i].id,
                    "document": results.matches[i].metadata.get("document"),
                    "metadata": results.matches[i].metadata,
                    "distance": results.matches[i].score 
                })
        
        return documents

    except Exception as err:
        logger.error(f"Error in searching in invoices. The exact error is {err}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error in searching errors")

        



