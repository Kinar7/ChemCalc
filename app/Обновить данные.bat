@echo off
cd /d "%~dp0"
curl -fsSL "https://kinar7.github.io/ChemCalc/data.js" -o data.js.new && move /y data.js.new data.js >nul && echo ok || (del data.js.new 2>nul & echo fail)
pause
