from fastapi import FastAPI
from app.routes.auth import router as auth_router
from app.routes.transaction import router as transaction_router
from app.routes.markers import router as markers_router
from app.db.session import engine
from app.models.user import Base
from fastapi.middleware.cors import CORSMiddleware

Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS must be added before routes and after app creation
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Match your frontend port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(transaction_router, prefix="/transaction", tags=["transaction"])
app.include_router(markers_router, prefix="/api/markers", tags=["markers"])

# Add a WebSocket endpoint for markers
@app.websocket("/api/ws/markers")
async def websocket_endpoint(websocket):
    await markers_router.websocket_endpoint(websocket)

@app.get("/")
def read_root():
    return {"message": "Mobile Food Drive API"}
