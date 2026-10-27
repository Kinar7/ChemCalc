@echo off
cd /d "%~dp0"
python build_data.py %*
pause
