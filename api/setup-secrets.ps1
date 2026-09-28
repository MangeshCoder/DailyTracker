# -----------------------------------------------------------------------------
#  DailyTracker API - one-time secrets setup
#
#  Stores secrets in .NET User Secrets on THIS PC (outside the repository):
#    %APPDATA%\Microsoft\UserSecrets\c02bc512-40bf-40c1-9caf-a2b8518fe876\secrets.json
#  They are loaded automatically when the API runs in Development.
#
#  Run from the api folder:
#    powershell -ExecutionPolicy Bypass -File .\setup-secrets.ps1
#
#  Safe to run again: it always creates a NEW JWT key (everyone signs in again)
#  and only changes the database / email / Gemini values you type (Enter = keep current).
#
#  (Only for YOUR PC. The hosted site's secrets are typed into Render instead.)
# -----------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Set-Secret([string]$name, [string]$value) {
    dotnet user-secrets set $name $value | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not save $name (is the .NET SDK installed?)" }
    Write-Host "  [saved] $name" -ForegroundColor Green
}

function Read-Hidden([string]$prompt) {
    $secure = Read-Host $prompt -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

Write-Host ''
Write-Host 'DailyTracker API - secrets setup' -ForegroundColor Cyan
Write-Host 'Values are stored in .NET User Secrets on this PC, never in git.'
Write-Host ''

# 1. JWT signing key - always a fresh random 64-byte key
$bytes = New-Object byte[] 64
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
Set-Secret 'Jwt:Key' ([Convert]::ToBase64String($bytes))

# 2. Local PostgreSQL database (installed on this PC - see docs/HOSTING.md, part A)
Write-Host ''
Write-Host 'Local PostgreSQL (the password you chose when installing PostgreSQL)'
$pgPassword = Read-Hidden '  postgres user password (input hidden, Enter = keep current)'
if ($pgPassword) {
    Set-Secret 'ConnectionStrings:DefaultConnection' ("Host=localhost;Port=5432;Database=dailytracker;Username=postgres;Password=" + $pgPassword)
}

# 3. Gmail used to send OTP / reset / approval emails
Write-Host ''
Write-Host 'Gmail sender (create a NEW app password at https://myaccount.google.com/apppasswords)'
$email = Read-Host '  Gmail address (Enter = keep current)'
if ($email) {
    Set-Secret 'Email:Username' $email.Trim()
    $appPassword = (Read-Hidden '  NEW Gmail app password (input hidden)') -replace '\s', ''
    if ($appPassword) { Set-Secret 'Email:Password' $appPassword }
}

# 4. Gemini API key for the AI assistant
Write-Host ''
Write-Host 'Gemini API key (create a NEW key at https://aistudio.google.com/apikey)'
$gemini = (Read-Hidden '  NEW Gemini API key (input hidden, Enter = keep current)').Trim()
if ($gemini) { Set-Secret 'Gemini:ApiKey' $gemini }

Write-Host ''
Write-Host 'Done. Secrets now configured on this PC:' -ForegroundColor Cyan
dotnet user-secrets list | ForEach-Object { '  ' + ($_ -replace '=.*$', '= ********') }
Write-Host ''
Write-Host 'Start the API as usual (dotnet run / Visual Studio). Everyone must sign in again once.'
