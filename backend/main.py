from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.session import engine
from app.db.base_class import Base

from app.routes.auth import router as auth_router
from app.routes.transaction import router as transaction_router
from app.routes.marker import router as markers_router

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.tasks import auto_unreserve, expire_24h_markers

# Create tables for all models (users, markers, transactions, etc.)
Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS configuration to allow your React front-end
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # your front‐end origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Mount routers
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(transaction_router, prefix="/transactions", tags=["transactions"])
app.include_router(markers_router, prefix="/markers", tags=["markers"])

@app.on_event("startup")
async def startup_scheduler():
    """
    Schedule background tasks:
     - auto_unreserve: runs every minute to unreserve expired holds
     - expire_24h_markers: runs hourly to clean up old markers
    """
    sched = AsyncIOScheduler()
    sched.add_job(auto_unreserve,    'interval', minutes=1)
    sched.add_job(expire_24h_markers, 'interval', hours=1)
    sched.start()

@app.get("/")
async def read_root():
    return {"message": "Mobile Food Drive API"}
