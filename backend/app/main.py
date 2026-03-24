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

    