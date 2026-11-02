@echo off
rem Starts the Mind Atlas server in its own window, then opens the app in the browser.
cd /d "%~dp0"
start "Mind Atlas server" /min node server.mjs
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:5173/"
