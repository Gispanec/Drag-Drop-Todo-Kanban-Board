@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
title Flow - запуск
where node.exe >nul 2>nul
if errorlevel 1 goto missing_node
pushd "%~dp0"
if errorlevel 1 goto missing_folder
node "%~dp0scripts\flow.mjs" start
set "FLOW_EXIT_CODE=%errorlevel%"
popd
echo.
echo Нажмите любую клавишу, чтобы закрыть окно.
pause >nul
exit /b %FLOW_EXIT_CODE%

:missing_node
echo Flow: Node.js не найден в PATH.
echo Установите Node.js 24 LTS с https://nodejs.org и снова откройте этот файл.
echo После установки может потребоваться перезапустить Проводник или выйти из Windows.
echo Нажмите любую клавишу, чтобы закрыть окно.
pause >nul
exit /b 1

:missing_folder
echo Flow: не удалось открыть папку проекта.
echo Нажмите любую клавишу, чтобы закрыть окно.
pause >nul
exit /b 1
