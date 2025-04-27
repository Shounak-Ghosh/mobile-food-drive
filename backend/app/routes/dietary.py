# app/routes/dietary.py

from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.routes.auth import get_current_user  # Import your get_current_user from auth.py

router = APIRouter(
    tags=["user"]
)

@router.post("/update-dietary-tags")
def update_dietary_tags(
    dietaryPreferences: list[str] = Body(...),
    allergies: list[str] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        # Merge dietary and allergy preferences
        merged_preferences = dietaryPreferences + allergies

        # Update the user's dietary_tags field
        current_user.dietary_tags = merged_preferences
        db.commit()
        db.refresh(current_user)

        return {"message": "Dietary preferences updated successfully."}
    
    except Exception as e:
        print(">>> Error updating dietary tags:", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating dietary preferences."
        )
