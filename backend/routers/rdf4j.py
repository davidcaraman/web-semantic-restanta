from fastapi import APIRouter
from SPARQLWrapper import SPARQLWrapper, JSON
import openai
import os
from typing import Optional

router = APIRouter()

RDF4J_URL = "http://localhost:8080/rdf4j-server/repositories/grafexamen"

@router.get("/query")
async def query_rdf4j(sparql_query: str):
    sparql = SPARQLWrapper(RDF4J_URL)
    sparql.setQuery(sparql_query)
    sparql.setReturnFormat(JSON)
    results = sparql.query().convert()
    return results

@router.get("/ranking")
async def generate_player_ranking():
    sparql_query = """
        PREFIX schema: <http://schema.org/>
        PREFIX ex: <http://example.org/>

        SELECT ?teamName ?playerName ?playerHeight ?playerWeight ?playerNationality ?playerStats
        WHERE {
            ?team a schema:SportsTeam ;
                  schema:name ?teamName .
            
            ?team schema:member ?player .
            ?player schema:name ?playerName ;
                   schema:nationality ?playerNationality .
            OPTIONAL { ?player schema:height ?playerHeight . }
            OPTIONAL { ?player schema:weight ?playerWeight . }
            OPTIONAL { ?player ex:stats ?playerStats . }
            
            FILTER(?playerNationality = "American")
        }
        ORDER BY ?teamName ?playerName
    """
    
    try:
        sparql = SPARQLWrapper(RDF4J_URL)
        sparql.setQuery(sparql_query)
        sparql.setReturnFormat(JSON)
        results = sparql.query().convert()
        
        players_data = []
        for binding in results.get("results", {}).get("bindings", []):
            player_info = {
                "nume": binding.get("playerName", {}).get("value", "N/A"),
                "echipa": binding.get("teamName", {}).get("value", "N/A"),
                "nationalitate": binding.get("playerNationality", {}).get("value", "N/A"),
                "inaltime": binding.get("playerHeight", {}).get("value", "N/A"),
                "greutate": binding.get("playerWeight", {}).get("value", "N/A"),
                "stats": binding.get("playerStats", {}).get("value", "N/A")
            }
            players_data.append(player_info)
        
        if not players_data:
            return {"error": "Nu s-au găsit date despre jucători pentru 2024"}
        
        openai_ranking = await get_openai_ranking(players_data)
        
        return {
            "original_data": results,
            "players_count": len(players_data),
            "openai_ranking": openai_ranking
        }
        
    except Exception as e:
        return {"error": f"Eroare la generarea ranking-ului: {str(e)}"}

async def get_openai_ranking(players_data):
    try:
        api_key = os.getenv("OPENAI_API_KEY")
        
        print(f"DEBUG: API Key găsit: {'Da' if api_key and api_key != 'your-api-key-here' else 'Nu'}")
        print(f"DEBUG: API Key length: {len(api_key) if api_key else 0}")
        print(f"DEBUG: API Key starts with: {api_key[:10] if api_key else 'None'}...")
        
        if not api_key or api_key == "your-api-key-here" or api_key == "YOUR_ACTUAL_API_KEY":
            return {
                "error": "API key OpenAI nu este configurat corect",
                "suggestion": "Te rog să configurezi OPENAI_API_KEY cu o valoare validă. Vezi instrucțiunile din openai_config.md",
                "debug_info": f"API key găsit: {api_key[:10] if api_key else 'None'}..."
            }
        
        client = openai.OpenAI(api_key=api_key)
        
        players_text = "\n".join([
            f"- {player['nume']} ({player['echipa']}) - Înălțime: {player['inaltime']}, Greutate: {player['greutate']}, Stats: {player['stats']}"
            for player in players_data
        ])
        
        prompt = f"""
        Analizează următorii jucători de sport și creează un ranking bazat pe statisticile lor din 2024.
        
        Jucători:
        {players_text}
        
        Te rog să:
        1. Creezi un ranking de la 1 la {len(players_data)} bazat pe performanțele lor
        2. Să explici criteria folosite pentru ranking
        3. Să dai un scurt comentariu pentru fiecare jucător din top 5
        4. Să returnezi răspunsul în format JSON cu structura:
        {{
            "ranking": [
                {{"pozitie": 1, "nume": "Nume Jucător", "echipa": "Nume Echipă", "scor": 95, "comentariu": "Explicație"}},
                ...
            ],
            "criterii": "Explicația criteriilor folosite",
            "rezumat": "Rezumat general al analizei"
        }}
        """
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Ești un analist sportiv expert care creează ranking-uri obiective bazate pe date."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1500,
            temperature=0.7
        )
        
        return {
            "openai_response": response.choices[0].message.content,
            "model_used": "gpt-3.5-turbo",
            "tokens_used": response.usage.total_tokens if hasattr(response, 'usage') else 0
        }
        
    except Exception as e:
        return {
            "error": f"Eroare la apelul OpenAI: {str(e)}",
            "suggestion": "Verifică dacă OPENAI_API_KEY este setat corect în variabilele de mediu",
            "debug_info": f"API key găsit: {'Da' if os.getenv('OPENAI_API_KEY') else 'Nu'}"
        } 