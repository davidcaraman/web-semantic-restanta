from fastapi import APIRouter
import requests
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

JSON_SERVER_URL = "http://localhost:4000"

class Team(BaseModel):
    id: int
    name: str
    url: Optional[str] = None
    description: Optional[str] = None
    foundingDate: Optional[str] = None
    sport: Optional[str] = None
    location: Optional[str] = None
    coach: Optional[str] = None

class Player(BaseModel):
    id: int
    name: str
    height: Optional[str] = None
    weight: Optional[str] = None
    nationality: Optional[str] = None
    team_id: int

@router.post("/teams")
async def create_teams(teams: List[Team]):
    for team in teams:
        response = requests.post(f"{JSON_SERVER_URL}/teams", json=team.dict(exclude_none=True), timeout=10)
        response.raise_for_status()
    return {"message": "Teams created successfully"}

@router.post("/players")
async def create_players(players: List[Player]):
    for player in players:
        response = requests.post(f"{JSON_SERVER_URL}/players", json=player.dict(exclude_none=True), timeout=10)
        response.raise_for_status()
    return {"message": "Players created successfully"}

@router.get("/data")
async def get_data():
    try:
        teams_response = requests.get(f"{JSON_SERVER_URL}/teams", timeout=10)
        teams_response.raise_for_status()
        players_response = requests.get(f"{JSON_SERVER_URL}/players", timeout=10)
        players_response.raise_for_status()
        return {
            "teams": teams_response.json(),
            "players": players_response.json()
        }
    except requests.Timeout:
        from fastapi import HTTPException
        raise HTTPException(status_code=504, detail="Timeout while fetching data from JSON server (port 4000)")
    except requests.RequestException as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Failed to fetch data from JSON server: {str(e)}") 