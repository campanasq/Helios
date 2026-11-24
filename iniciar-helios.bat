@echo off
chcp 65001 >nul
title Helios - Servidor y Tunel Publico Gratis

set "ROOT=%~dp0"
set "PHP_EXE=%LOCALAPPDATA%\Programs\php82\php.exe"
set "CF_EXE=%LOCALAPPDATA%\Programs\cloudflared\cloudflared.exe"

if not exist "%PHP_EXE%" set "PHP_EXE=php"

if not exist "%CF_EXE%" (
  echo [ERROR] No se encontro cloudflared en %CF_EXE%
  pause
  exit /b 1
)

if not exist "%ROOT%frontend\dist\frontend\browser\index.html" (
  echo Compilando frontend de produccion por primera vez...
  pushd "%ROOT%frontend"
  call npx ng build --configuration production
  popd
)

echo ==============================================================
echo   HELIOS - Modo Online Gratis (Cloudflare Tunnel)
echo ==============================================================
echo.
echo 1. Iniciando servidor local de Helios en http://127.0.0.1:8000 ...
set "PUBLIC_STORAGE_URL=/storage"
set "APP_DEBUG=false"
start "Helios Backend (no cerrar mientras juegan)" /min cmd /c "cd /d "%ROOT%backend" && set PUBLIC_STORAGE_URL=/storage && set APP_DEBUG=false && "%PHP_EXE%" artisan serve --host=127.0.0.1 --port=8000"

timeout /t 3 /nobreak >nul

echo 2. Abriendo tunel publico HTTPS gratis...
echo    Copia el link https://....trycloudflare.com que aparece abajo
echo    y pasaselo a tus amigos. Mantene esta ventana abierta mientras jueguen.
echo.
"%CF_EXE%" tunnel --url http://127.0.0.1:8000

echo.
echo Tunel cerrado. Recorda cerrar tambien la ventana minimizada de Helios Backend.
pause
