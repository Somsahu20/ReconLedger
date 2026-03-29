from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


engine = create_async_engine(
    url=settings.ASYNC_DATABASE_URL,
    echo=True, #! MAKE IT FALSE IN PROD
    future=True,
    connect_args={
        "ssl": "require"
    },

    pool_size=5,
    max_overflow=2,
    pool_recycle=300,
    pool_pre_ping=True,
    pool_timeout=30

)


AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autoflush=False,
    expire_on_commit=False,
)

async def get_db():
    db = AsyncSessionLocal()
    try:
        yield db
    finally:
        await db.close()

class Base(DeclarativeBase):
    pass



