from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.models.user import User
from app.routes.auth import get_current_user

router = APIRouter()

class DietaryPreferencesUpdate:
    def __init__(self, dietaryPreferences: List[str]):
        self.dietaryPreferences = dietaryPreferences

@router.post("/preferences")
async def update_dietary_preferences(
    preferences: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a user's dietary preferences
    """
    try:
        dietary_preferences = preferences.get("dietaryPreferences", [])
        
        # Update user in database
        current_user.dietary_tags = dietary_preferences
        db.commit()
        
        return {"status": "success", "message": "Dietary preferences updated successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update preferences: {str(e)}"
        ) 