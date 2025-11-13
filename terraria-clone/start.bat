@echo off
echo =========================================
echo    TerraQuest - Starting Game Server
echo =========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Starting server...
echo.
echo Server will run on: http://localhost:3000
echo.
echo For multiplayer, share this address with friends on the same WiFi:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    echo    http:%%a:3000
    goto :done
)
:done
echo.
echo =========================================
echo.

npm start
