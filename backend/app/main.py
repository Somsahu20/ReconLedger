from fastapi import FastAPI, Depends 
from app.database import get_db, AsyncSession
from sqlalchemy.ext.asyncio import AsyncSession 

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.routers import auth, query, invoice, dashboard, reviews, reconciliation

from utils.lim import limiter
from models.invoices import *
from models.users import *
from models.reviews import * 
from models.validations import *
from models.reconciliation import *
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

#todo Slowapi code
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(auth.router)
app.include_router(query.router)
app.include_router(invoice.router)
app.include_router(dashboard.router)
app.include_router(reviews.router)
app.include_router(reconciliation.router)



origins = [
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def check_health():
    return {"message": "Successfully connected"}

@app.get("/database")
async def check_db(db: AsyncSession = Depends(get_db)):
    return {"message": "Successfully connected"}

from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from pinecone import Pinecone
from app.config import settings
from app.services.vector_store import get_embeddings
from utils.log import logger
from uuid import UUID
from sqlalchemy.sql import update

@app.get("/indexes")
async def migrate(db: AsyncSession = Depends(get_db)):

    pc = Pinecone(api_key=settings.PINECONE_API_KEY)

    try:
        index = pc.Index(settings.INDEX_NAME)
        res = index.query(
            vector=[0.0]*3072, 
            include_metadata=True,
            top_k=100
        )
        
        for query in res.matches:
            id = UUID(query.id)
            stmt = update(Invoice).where(Invoice.id == id).values({"ai_processed": True})
            await db.execute(stmt)

        await db.commit()




    except Exception as err:
        logger.error(f"Error is {err}")
        await db.rollback()

    