@echo off
cd /d "%~dp0"
echo Starting the account and OTP server on port 8000...
echo Keep this window open while registering or verifying OTP.
py -3.12 -m uvicorn main:app --host 0.0.0.0 --port 8000
echo.
echo The account server has stopped. Check the message above.
pause
