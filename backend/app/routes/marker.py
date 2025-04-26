from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.models.marker import Marker
from app.schemas.marker import MarkerCreate, MarkerUpdate, MarkerResponse
from app.routes.auth import get_current_user
from app.models.user import User
from geoalchemy2.functions import ST_MakePoint, ST_SetSRID
from sqlalchemy import and_, func

router = APIRouter()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)

manager = ConnectionManager()

@router.post("/", response_model=MarkerResponse)
async def create_marker(
    marker_data: MarkerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Create a PostGIS point from latitude and longitude
    point = func.ST_SetSRID(
        func.ST_MakePoint(marker_data.longitude, marker_data.latitude),
        4326
    )
    
    # Create new marker
    new_marker = Marker(
        donator_user_id=current_user.user_id,
        geographic_location=point,
        food_type=marker_data.food_type,
        quantity=marker_data.quantity,
        description=marker_data.description,
        dietary_tags=marker_data.dietary_tags,
        creation_date=func.now(),
        receiver_user_id=None
    )
    
    db.add(new_marker)
    db.commit()
    db.refresh(new_marker)
    
    # Extract coordinates for the response
    coords = db.query(
        func.ST_X(new_marker.geographic_location).label('longitude'),
        func.ST_Y(new_marker.geographic_location).label('latitude')
    ).first()
    
    print("coords:", coords)
    # Prepare response with donator name
    response_data = MarkerResponse(
        marker_id=new_marker.marker_id,
        donator_user_id=new_marker.donator_user_id,
        donator_name=current_user.name,
        latitude=coords.latitude,
        longitude=coords.longitude,
        creation_date=new_marker.creation_date,
        food_type=new_marker.food_type,
        quantity=new_marker.quantity,
        description=new_marker.description,
        dietary_tags=new_marker.dietary_tags,
        receiver_user_id=new_marker.receiver_user_id
    )
    
    # Broadcast new marker to all connected clients
    await manager.broadcast({
        "type": "marker_update",
        "marker": response_data.dict()
    })
    
    return response_data

@router.get("/", response_model=List[MarkerResponse])
async def get_markers_in_bounds(
    north: float,
    south: float,
    east: float,
    west: float,
    tags: Optional[str] = None,
    db: Session = Depends(get_db)
):
    # Build query for markers within bounds using PostGIS
    query = db.query(
        Marker,
        User.name.label("donator_name"),
        func.ST_X(Marker.geographic_location).label('longitude'),
        func.ST_Y(Marker.geographic_location).label('latitude')
    ).join(
        User, Marker.donator_user_id == User.user_id
    ).filter(
        func.ST_Within(
            Marker.geographic_location,
            func.ST_MakeEnvelope(west, south, east, north, 4326)
        )
    )
    
    # Execute query
    results = query.all()
    
    # Convert tags string to list if provided
    tag_list = [tag.strip() for tag in tags.split(",")] if tags else []
    
    # Format response and filter by tags if provided
    markers = []
    for marker, donator_name, longitude, latitude in results:
        # If tags are provided, only include markers that have ALL the specified tags
        if tag_list and not all(tag in marker.dietary_tags for tag in tag_list):
            continue
            
        markers.append(
            MarkerResponse(
                marker_id=marker.marker_id,
                donator_user_id=marker.donator_user_id,
                donator_name=donator_name,
                latitude=latitude,
                longitude=longitude,
                creation_date=marker.creation_date,
                food_type=marker.food_type,
                quantity=marker.quantity,
                description=marker.description,
                dietary_tags=marker.dietary_tags,
                receiver_user_id=marker.receiver_user_id
            )
        )
    
    return markers

@router.get("/{marker_id}", response_model=MarkerResponse)
async def get_marker(
    marker_id: int,
    db: Session = Depends(get_db)
):
    # Query for marker with donator name
    result = db.query(
        Marker,
        User.name.label("donator_name"),
        func.ST_X(Marker.geographic_location).label('longitude'),
        func.ST_Y(Marker.geographic_location).label('latitude')
    ).join(
        User, Marker.donator_user_id == User.user_id
    ).filter(Marker.marker_id == marker_id).first()
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Marker not found"
        )
    
    marker, donator_name, longitude, latitude = result
    
    # Format response
    return MarkerResponse(
        marker_id=marker.marker_id,
        donator_user_id=marker.donator_user_id,
        donator_name=donator_name,
        latitude=latitude,
        longitude=longitude,
        creation_date=marker.creation_date,
        food_type=marker.food_type,
        quantity=marker.quantity,
        description=marker.description,
        dietary_tags=marker.dietary_tags,
        receiver_user_id=marker.receiver_user_id
    )

@router.patch("/{marker_id}", response_model=MarkerResponse)
async def update_marker_status(
    marker_id: int,
    update_data: MarkerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get marker
    marker = db.query(Marker).filter(Marker.marker_id == marker_id).first()
    
    if not marker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Marker not found"
        )
    
    # Update receiver_user_id
    if update_data.receiver_user_id is not None:
        # Only allow reserving if not already reserved
        if marker.receiver_user_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Marker already reserved"
            )
        marker.receiver_user_id = update_data.receiver_user_id
    else:
        # If setting to null, only allow if user is the donator or current receiver
        if current_user.user_id not in [marker.donator_user_id, marker.receiver_user_id]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the donator or receiver can unreserve a marker"
            )
        marker.receiver_user_id = None
    
    db.commit()
    db.refresh(marker)
    
    # Extract coordinates for the response
    coords = db.query(
        func.ST_X(marker.geographic_location).label('longitude'),
        func.ST_Y(marker.geographic_location).label('latitude')
    ).first()
    
    # Get donator name
    donator = db.query(User).filter(User.user_id == marker.donator_user_id).first()
    
    # Prepare response
    response_data = MarkerResponse(
        marker_id=marker.marker_id,
        donator_user_id=marker.donator_user_id,
        donator_name=donator.name,
        latitude=coords.latitude,
        longitude=coords.longitude,
        creation_date=marker.creation_date,
        food_type=marker.food_type,
        quantity=marker.quantity,
        description=marker.description,
        dietary_tags=marker.dietary_tags,
        receiver_user_id=marker.receiver_user_id
    )
    
    # Broadcast marker update to all connected clients
    await manager.broadcast({
        "type": "marker_update",
        "marker": response_data.dict()
    })
    
    return response_data

@router.delete("/{marker_id}")
async def delete_marker(
    marker_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get marker
    marker = db.query(Marker).filter(Marker.marker_id == marker_id).first()
    
    if not marker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Marker not found"
        )
    
    # Check if user is the donator
    if marker.donator_user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the donator can delete a marker"
        )
    
    # Delete marker
    db.delete(marker)
    db.commit()
    
    # Broadcast deletion to all connected clients
    await manager.broadcast({
        "type": "marker_delete",
        "marker_id": marker_id
    })
    
    return {"detail": "Marker deleted successfully"}

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Wait for messages from the client
            data = await websocket.receive_json()
            # Process client messages if needed
    except WebSocketDisconnect:
        manager.disconnect(websocket)