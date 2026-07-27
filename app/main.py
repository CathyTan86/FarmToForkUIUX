from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.exceptions import BusinessLogicException, business_logic_exception_handler
from app.api.v1.scan_routes import router as scan_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Computes Leontief supply-chain carbon footprints and RUSLE soil erosion risk from farm geometry."
)

# Intercept oversized payloads before they reach route handlers (max 12MB covers 1024px JPEGs safely)
MAX_UPLOAD_BYTES = 12 * 1024 * 1024

@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_UPLOAD_BYTES:
        return JSONResponse(
            status_code=413,
            content={
                "detail": f"Request body exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)}MB limit. Please compress your image."
            }
        )
    return await call_next(request)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(BusinessLogicException, business_logic_exception_handler)

# Include routers
app.include_router(scan_router)

@app.get("/")
def health_check():
    return {"status": "CERO Math & ML Engines Online and Ready"}

@app.get("/health")
async def health():
    return {
        "status": "online",
        "version": "1.0.0",
        "database": "connected" if os.path.exists(settings.DATABASE_PATH) else "not_found"
    }

import os
