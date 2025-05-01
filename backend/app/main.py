from fastapi import FastAPI, HTTPException, Depends, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import os

# Import route modules
from app.routes import auth, marker, notification, transaction
# Import database session
from app.db.session import engine
# Import models for database table creation
from app.models import base

# Create database tables
base.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Mobile Food Drive API")

# Custom middleware to handle HEAD requests at the root endpoint
class HeadMethodMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # If this is a HEAD request to the root, return a 200 OK response
        if request.method == "HEAD" and request.url.path == "/":
            return JSONResponse(content={"status": "ok"}, status_code=200)
        return await call_next(request)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Add our custom HEAD middleware
app.add_middleware(HeadMethodMiddleware)

# Register routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(marker.router, prefix="/markers", tags=["markers"])
app.include_router(notification.router, prefix="/notifications", tags=["notifications"])
app.include_router(transaction.router, prefix="/transactions", tags=["transactions"])

@app.get("/")
async def read_root():
    """
    Root endpoint for health checks.
    """
    return {"status": "ok"} 