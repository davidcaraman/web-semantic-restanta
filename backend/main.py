from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import rdf4j, rest, graphql
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rdf4j.router, prefix="/rdf4j", tags=["rdf4j"])
app.include_router(rest.router, prefix="/rest", tags=["rest"])
app.include_router(graphql.router, prefix="/graphql", tags=["graphql"])

@app.get("/")
def read_root():
    return {"message": "Backend is running"} 