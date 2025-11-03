# Kina Dashboard - Restart Server Script (PowerShell)
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Kina Dashboard - Restarting Server" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check for .env file
if (-not (Test-Path ".env")) {
    Write-Host "[WARNING] .env file not found!" -ForegroundColor Yellow
    Write-Host "Please copy env.example.txt to .env and configure it." -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

# Check if node_modules exists and has content
$nodeModulesExists = Test-Path "node_modules"
$nodeModulesEmpty = if ($nodeModulesExists) { (Get-ChildItem "node_modules" | Measure-Object).Count -eq 0 } else { $true }

if (-not $nodeModulesExists -or $nodeModulesEmpty) {
    Write-Host "[INFO] Installing/updating dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

# Get Admin Dashboard port from environment or use default 3000
$envPort = $env:ADMIN_PORT
if ([string]::IsNullOrEmpty($envPort)) {
    # Try to read from .env file
    if (Test-Path ".env") {
        $envContent = Get-Content ".env" -Raw
        if ($envContent -match "ADMIN_PORT=(\d+)") {
            $envPort = $matches[1]
        } elseif ($envContent -match "PORT=(\d+)") {
            $envPort = $matches[1]
        }
    }
}
$ADMIN_PORT = if ($envPort) { [int]$envPort } else { 3000 }

Write-Host "Stopping Admin Dashboard server on port $ADMIN_PORT..." -ForegroundColor Yellow

# Find process using ADMIN_PORT (Admin Dashboard specific port)
$connections = Get-NetTCPConnection -LocalPort $ADMIN_PORT -State Listen -ErrorAction SilentlyContinue

if ($connections) {
    $processIds = $connections | Select-Object -Unique -ExpandProperty OwningProcess
    $killed = $false
    
    foreach ($processId in $processIds) {
        try {
            $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($process -and $process.ProcessName -eq "node") {
                # Verify it's actually the Admin Dashboard by checking working directory or command line
                $processPath = (Get-WmiObject Win32_Process -Filter "ProcessId=$processId").CommandLine
                if ($processPath -like "*Kina-Dashboard*" -or $processPath -like "*server.js*") {
                    Write-Host "Found Admin Dashboard process (PID: $processId) on port $ADMIN_PORT" -ForegroundColor Yellow
                    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                    Write-Host "Stopped Admin Dashboard process on port $ADMIN_PORT" -ForegroundColor Green
                    $killed = $true
                }
            }
        } catch {
            # Process might have already stopped
        }
    }
    
    if ($killed) {
        Start-Sleep -Seconds 2
    } else {
        Write-Host "No Admin Dashboard process found on port $ADMIN_PORT" -ForegroundColor Gray
    }
} else {
    Write-Host "No process found using port $ADMIN_PORT" -ForegroundColor Gray
}

Write-Host ""
Write-Host ".env file found!" -ForegroundColor Green
Write-Host "Starting Admin Dashboard server on port $ADMIN_PORT..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Server will be available at:" -ForegroundColor Green
Write-Host "  - Local: http://localhost:$ADMIN_PORT" -ForegroundColor White
Write-Host "  - Network: http://$($env:COMPUTERNAME):$ADMIN_PORT" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

npm start


