@echo off
REM Cross-platform Python launcher for AI log hooks (Windows cmd.exe).
REM Tries py -3 -> python -> python3 in order, runs the given script with all args.
REM Exits 0 silently if no Python is found - hooks must never block the AI tool.

where py >nul 2>nul
if %ERRORLEVEL%==0 (
  py -3 %*
  exit /b 0
)

where python >nul 2>nul
if %ERRORLEVEL%==0 (
  python %*
  exit /b 0
)

where python3 >nul 2>nul
if %ERRORLEVEL%==0 (
  python3 %*
  exit /b 0
)

for /d %%P in ("%LOCALAPPDATA%\Programs\Python\Python*") do (
  if exist "%%~fP\python.exe" (
    "%%~fP\python.exe" %*
    exit /b 0
  )
)

exit /b 0
