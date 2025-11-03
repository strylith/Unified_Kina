# Restart server script with package verification
Write-Host "🔄 Restarting Kina Resort Guest Backend Server..." -ForegroundColor Cyan

# Get Guest System port from environment or use default 3001
$envPort = $env:GUEST_PORT
if ([string]::IsNullOrEmpty($envPort)) {
    # Try to read from .env file
    if (Test-Path ".env") {
        $envContent = Get-Content ".env" -Raw
        if ($envContent -match "GUEST_PORT=(\d+)") {
            $envPort = $matches[1]
        } elseif ($envContent -match "PORT=(\d+)") {
            $envPort = $matches[1]
        }
    }
}
$GUEST_PORT = if ($envPort) { [int]$envPort } else { 3001 }

Write-Host "🛑 Stopping Guest System server on port $GUEST_PORT..." -ForegroundColor Yellow

# Find process using GUEST_PORT (Guest System specific port - 3001)
$connections = Get-NetTCPConnection -LocalPort $GUEST_PORT -State Listen -ErrorAction SilentlyContinue

if ($connections) {
    $processIds = $connections | Select-Object -Unique -ExpandProperty OwningProcess
    $killed = $false
    
    foreach ($processId in $processIds) {
        try {
            $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($process -and $process.ProcessName -eq "node") {
                # Verify it's actually the Guest System by checking working directory or command line
                $processPath = (Get-WmiObject Win32_Process -Filter "ProcessId=$processId").CommandLine
                if ($processPath -like "*Kina_Resort_Guest*" -or $processPath -like "*Guest*server*") {
                    Write-Host "  Found Guest System process (PID: $processId) on port $GUEST_PORT" -ForegroundColor Yellow
                    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                    Write-Host "  Stopped Guest System process on port $GUEST_PORT" -ForegroundColor Green
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
        Write-Host "  No Guest System process found on port $GUEST_PORT" -ForegroundColor Gray
    }
} else {
    Write-Host "  No process found using port $GUEST_PORT" -ForegroundColor Gray
}

# Set environment variables
$env:USE_MOCK_DB = "false"
$env:NODE_ENV = "development"

Write-Host "`n🚀 Starting Guest System server on port $GUEST_PORT..." -ForegroundColor Green
Write-Host "   Connected to kina_v2 schema" -ForegroundColor Gray
Write-Host "   Server will be available at: http://localhost:$GUEST_PORT" -ForegroundColor White
Write-Host ""

# Start the server
npm start


