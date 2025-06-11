@echo off
echo Starting JSON GraphQL Server...
echo Make sure you have json-graphql-server installed globally:
echo npm install -g json-graphql-server
echo.
cd /d "%~dp0\.."
echo Starting GraphQL server on port 3000...
json-graphql-server db_graphql.json --port 3000
pause 