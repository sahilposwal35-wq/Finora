from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models import models  # noqa: F401 - ensure all models are registered
from app.services.category_service import seed_system_categories
from app.api.routes import (
    auth,
    categories,
    records,
    budgets,
    recurring,
    goals,
    dashboard,
    whatif,
    reports,
    insights,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_system_categories(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
allowed_origins = list({
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
})
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Consistent JSON error handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "status_code": exc.status_code},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": jsonable_encoder(exc.errors()), "status_code": 422},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error", "status_code": 500},
    )


# Register routers under /api prefix
app.include_router(auth.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(records.router, prefix="/api")
app.include_router(budgets.router, prefix="/api")
app.include_router(recurring.router, prefix="/api")
app.include_router(goals.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(whatif.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(insights.router, prefix="/api")


@app.get("/health")
def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
