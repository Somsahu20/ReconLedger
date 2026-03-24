from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR / ".env"

class Settings(BaseSettings):

    DATABASE_URL: str

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str
    ACCESS_TOKEN: int = 30
    REFRESH_TOKEN: int = 7

    GOOGLE_API_KEY: str
    PDF_READER: str
    AUDIT_PDF: str
    QUERY_API: str
    EMBEDDINGS_API: str
    RECONCILIATION_API: str

    CHROMA_PERSIST_DIR: str
    CHROMA_TOP_K: int = 5

    AMOUNT_TOLERANCE: float = 2.00
    TAX_TOLERANCE: float = 1.00
    DATE_TOLERANCE_DAYS: int = 3
    AI_CONFIDENCE_THRESHOLD: float = 0.65


    FRONTEND_URL: str


    TOLERANCE: float


    MAX_FILE_SIZE_MB:int

    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()

    
