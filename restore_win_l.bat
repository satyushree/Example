@echo off
echo ==============================================================
echo Restoring Windows + L Locking Functionality
echo ==============================================================
echo.
echo Deleting lock restriction from registry...
reg delete "HKEY_USERS\S-1-5-21-2343733815-3360885794-435248370-1002\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableLockWorkstation /f
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableLockWorkstation /f
echo.
echo ==============================================================
echo Done! Please try pressing Windows + L to verify it works.
echo ==============================================================
pause
