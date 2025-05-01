from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.session import engine
from app.db.base_class import Base

from app.routes.auth import router as auth_router
from app.routes.transaction import router as transaction_router
from app.routes.marker import router as markers_router
from app.routes.notification import router as notifications_router
from app.routes.users import router as users_router

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.tasks import auto_unreserve, expire_old_markers, notify_unclaimed_donations

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
app.include_router(notifications_router, prefix="/notifications", tags=["notifications"])
app.include_router(users_router, prefix="/users", tags=["users"])

@app.on_event("startup")
async def startup_scheduler():
    """
    Schedule background tasks:
     - auto_unreserve: runs every minute to check for reservation expirations and send notifications
     - expire_old_markers: runs every 10 minutes to check and expire old markers (24+ hours)
     - notify_unclaimed_donations: runs hourly to check for unclaimed donations after 24 hours
    """
    sched = AsyncIOScheduler()
    sched.add_job(auto_unreserve, 'interval', minutes=1)
    sched.add_job(expire_old_markers, 'interval', minutes=10)  # Run more frequently to ensure timely expiration
    sched.add_job(notify_unclaimed_donations, 'interval', hours=1)
    sched.start()

@app.get("/")
async def read_root():
    return {"message": "Mobile Food Drive API"}