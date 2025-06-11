@echo off
echo Starting JSON Server (REST API)...
echo Make sure you have json-server installed globally:
echo npm install -g json-server
echo.
cd /d "%~dp0\.."
echo Starting JSON server on port 4000 (without delay for better performance)...
json-server --watch db_rest.json --port 4000
pause 