import base64
from typing import List
import pymupdf

"""
! These functions can't be made async because pymupdf is written in C library

"""

def convert_pdf_to_images(pdf_bytes: bytes, dpi: int = 300) -> List[str]:
    """
    Convert PDF to base64-encoded PNG images.
    
    pdf_bytes: Raw PDF file bytes
    
    Returns:
        List of base64-encoded PNG images (one per page)
    """

    try:
            
       # Open PDF from bytes
        pdf_document = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        raise ValueError("Invalid or corrupted PDF")

    if len(pdf_document) == 0:
        pdf_document.close()
        raise ValueError("The PDF file is empty")
    
    images = []

    for page_num in range(len(pdf_document)):
        page = pdf_document[page_num]
        
        # Render page to image at specified DPI
        zoom = dpi / 72
        mat = pymupdf.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        
        # Convert to PNG bytes
        img_bytes = pix.tobytes("png")
        
        # Encode as base64
        img_b64 = base64.b64encode(img_bytes).decode("utf-8")
        images.append(img_b64)
        
    pdf_document.close()
    return images

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extract text from PDF for vector storage.
    """
    
    try:
        pdf_document = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        raise ValueError("Invalid or corrupted PDF")
    
    text_content = []
    for page in pdf_document:
        text_content.append(page.get_text())
    
    pdf_document.close()
    
    return "\n\n".join(text_content)
