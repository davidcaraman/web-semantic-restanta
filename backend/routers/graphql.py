from fastapi import APIRouter, HTTPException
import requests
import asyncio
import aiohttp
from pydantic import BaseModel
from typing import List, Dict, Any
import json

router = APIRouter()

GRAPHQL_SERVER_URL = "http://localhost:3000/graphql"

class GraphQLQuery(BaseModel):
    query: str

class GraphQLBatchOperation(BaseModel):
    query: str
    variables: Dict[str, Any]

async def send_graphql_operations(operations: List[GraphQLBatchOperation]) -> List[Dict]:
    results = []
    timeout = aiohttp.ClientTimeout(total=10)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        for op in operations:
            try:
                async with session.post(
                    GRAPHQL_SERVER_URL,
                    json={"query": op.query, "variables": op.variables},
                    headers={"Content-Type": "application/json"}
                ) as response:
                    response.raise_for_status()
                    result = await response.json()
                    results.append(result)
            except asyncio.TimeoutError:
                results.append({"errors": [{"message": "GraphQL server timeout"}]})
            except aiohttp.ClientConnectionError:
                results.append({"errors": [{"message": "GraphQL server not reachable"}]})
            except Exception as e:
                results.append({"errors": [{"message": str(e)}]})
    
    return results

async def check_graphql_server() -> bool:
    try:
        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                GRAPHQL_SERVER_URL,
                json={"query": "{ __schema { types { name } } }"},
                headers={"Content-Type": "application/json"}
            ) as response:
                return response.status == 200
    except:
        return False

def validate_team_data(team: Dict) -> Dict:
    required_fields = ['name']
    for field in required_fields:
        if field not in team or team[field] is None:
            raise ValueError(f"Team missing required field: {field}")
    
    sanitized = {}
    for key, value in team.items():
        if isinstance(value, str):
            sanitized[key] = value.replace('\\', '\\\\').replace('"', '\\"')
        else:
            sanitized[key] = value
    
    return sanitized

def validate_player_data(player: Dict) -> Dict:
    required_fields = ['name', 'team_id']
    for field in required_fields:
        if field not in player or player[field] is None:
            raise ValueError(f"Player missing required field: {field}")
    
    sanitized = {}
    for key, value in player.items():
        if isinstance(value, str):
            sanitized[key] = value.replace('\\', '\\\\').replace('"', '\\"')
        else:
            sanitized[key] = value
    
    return sanitized

@router.post("/transfer")
async def transfer_to_graphql():
    try:
        if not await check_graphql_server():
            raise HTTPException(
                status_code=503, 
                detail="GraphQL server is not running. Please start json-graphql-server on port 3000."
            )
        
        try:
            clear_query = """
            {
                allTeams { id }
                allPlayers { id }
            }
            """
            timeout = aiohttp.ClientTimeout(total=10)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    GRAPHQL_SERVER_URL,
                    json={"query": clear_query},
                    headers={"Content-Type": "application/json"}
                ) as response:
                    if response.status == 200:
                        current_data = await response.json()
                        
                        if current_data.get("data", {}).get("allPlayers"):
                            for player in current_data["data"]["allPlayers"]:
                                delete_mutation = f"mutation {{ deletePlayer(id: {player['id']}) {{ id }} }}"
                                try:
                                    await session.post(
                                        GRAPHQL_SERVER_URL,
                                        json={"query": delete_mutation},
                                        headers={"Content-Type": "application/json"}
                                    )
                                except Exception as e:
                                    print(f"Failed to delete player {player['id']}: {e}")
                        
                        if current_data.get("data", {}).get("allTeams"):
                            for team in current_data["data"]["allTeams"]:
                                delete_mutation = f"mutation {{ deleteTeam(id: {team['id']}) {{ id }} }}"
                                try:
                                    await session.post(
                                        GRAPHQL_SERVER_URL,
                                        json={"query": delete_mutation},
                                        headers={"Content-Type": "application/json"}
                                    )
                                except Exception as e:
                                    print(f"Failed to delete team {team['id']}: {e}")
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="Timeout while clearing GraphQL data")
        except Exception as e:
            print(f"Warning: Could not clear existing data: {e}")
        
        try:
            rest_response = requests.get("http://localhost:8000/rest/data", timeout=100)
            rest_response.raise_for_status()
            rest_data = rest_response.json()
        except requests.Timeout:
            raise HTTPException(status_code=504, detail="Timeout while fetching data from REST server")
        except requests.RequestException as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch data from REST server: {str(e)}")
        
        teams = rest_data.get("teams", [])
        players = rest_data.get("players", [])
        
        if not teams and not players:
            return {"message": "No data found to transfer"}
        
        validated_teams = []
        validated_players = []
        
        for team in teams:
            try:
                validated_teams.append(validate_team_data(team))
            except ValueError as e:
                print(f"Skipping invalid team: {e}")
        
        for player in players:
            try:
                validated_players.append(validate_player_data(player))
            except ValueError as e:
                print(f"Skipping invalid player: {e}")
        
        operations = []
        
        team_mutation = """
        mutation CreateTeam($name: String!, $url: String!, $description: String!, 
                           $foundingDate: String!, $sport: String!, $location: String!, $coach: String!) {
            createTeam(
                name: $name,
                url: $url,
                description: $description,
                foundingDate: $foundingDate,
                sport: $sport,
                location: $location,
                coach: $coach
            ) {
                id
                name
            }
        }
        """
        
        player_mutation = """
        mutation CreatePlayer($name: String!, $height: String!, $weight: String!, 
                             $nationality: String!, $team_id: Int!) {
            createPlayer(
                name: $name,
                height: $height,
                weight: $weight,
                nationality: $nationality,
                team_id: $team_id
            ) {
                id
                name
            }
        }
        """
        
        for team in validated_teams:
            operations.append(GraphQLBatchOperation(
                query=team_mutation,
                variables={
                    "name": team["name"],
                    "url": team.get("url", ""),
                    "description": team.get("description", ""),
                    "foundingDate": team.get("foundingDate", ""),
                    "sport": team.get("sport", ""),
                    "location": team.get("location", ""),
                    "coach": team.get("coach", "")
                }
            ))
        
        for player in validated_players:
            operations.append(GraphQLBatchOperation(
                query=player_mutation,
                variables={
                    "name": player["name"],
                    "height": player.get("height", ""),
                    "weight": player.get("weight", ""),
                    "nationality": player.get("nationality", ""),
                    "team_id": player["team_id"]
                }
            ))
        
        batch_size = 10
        successful_operations = 0
        failed_operations = 0
        
        for i in range(0, len(operations), batch_size):
            batch = operations[i:i + batch_size]
            try:
                results = await send_graphql_operations(batch)
                
                for result in results:
                    if isinstance(result, dict) and "errors" not in result:
                        successful_operations += 1
                    else:
                        failed_operations += 1
                        print(f"GraphQL operation failed: {result}")
                        
            except Exception as e:
                failed_operations += len(batch)
                print(f"Batch failed: {e}")
        
        return {
            "message": f"Transfer completed. {successful_operations} successful, {failed_operations} failed",
            "successful_operations": successful_operations,
            "failed_operations": failed_operations,
            "total_operations": len(operations)
        }
        
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch data from REST server: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transfer failed: {str(e)}")

@router.post("/query")
async def query_graphql(query: GraphQLQuery):
    try:
        if not await check_graphql_server():
            raise HTTPException(
                status_code=503, 
                detail="GraphQL server is not running. Please start json-graphql-server on port 3000."
            )
        
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                GRAPHQL_SERVER_URL,
                json={"query": query.query},
                headers={"Content-Type": "application/json"}
            ) as response:
                response.raise_for_status()
                return await response.json()
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Timeout while querying GraphQL server")
    except aiohttp.ClientConnectionError:
        raise HTTPException(status_code=503, detail="GraphQL server not reachable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GraphQL query failed: {str(e)}")