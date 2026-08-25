@echo off
setlocal
cd /d "%~dp0"
title ShowScore - Relais reseau local

where node.exe >nul 2>&1
if errorlevel 1 (
  echo.
  echo Node.js n'est pas installe sur cet ordinateur.
  echo Installe Node.js 22 LTS depuis https://nodejs.org puis relance ce fichier.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\ws\package.json" goto install_dependencies
goto dependencies_ready

:install_dependencies
  echo Installation initiale du relais ShowScore...
  if exist "package-lock.json" (
    call npm.cmd ci --omit=dev
  ) else (
    echo Le fichier package-lock.json est absent; installation de secours...
    call npm.cmd install --omit=dev
  )
  if errorlevel 1 (
    echo.
    echo L'installation a echoue. Verifie la connexion Internet puis reessaie.
    pause
    exit /b 1
  )

:dependencies_ready

set "SHOWSCORE_RELAY_LAN_IP="
for /f "usebackq delims=" %%I in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Trouver-Adresse-Relais.ps1"`) do set "SHOWSCORE_RELAY_LAN_IP=%%I"

if not defined SHOWSCORE_RELAY_LAN_IP (
  echo.
  echo Impossible de trouver automatiquement l'adresse reseau du PC.
  echo Verifie que le Wi-Fi ou le cable Ethernet est connecte, puis relance.
  echo.
  pause
  exit /b 1
)

echo.
echo Le relais ShowScore demarre sur le port 9875.
echo Si le pare-feu Windows pose une question, autorise les reseaux prives.
echo Garde cette fenetre ouverte pendant le show.
echo.
echo Adresse du tableau : http://%SHOWSCORE_RELAY_LAN_IP%:9875
echo Adresse a entrer dans ShowScore : ws://%SHOWSCORE_RELAY_LAN_IP%:9875/ws/producer
echo.
set "SHOWSCORE_RELAY_PORT=9875"
set "SHOWSCORE_RELAY_PUBLIC_HOST=%SHOWSCORE_RELAY_LAN_IP%"
node.exe src\server.mjs

echo.
echo Le relais ShowScore s'est arrete.
pause
