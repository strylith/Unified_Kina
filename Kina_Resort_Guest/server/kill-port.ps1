# Kill any process listening on a TCP port and verify it is freed
param(
  [int]$Port = 3001
)

Write-Host "🔧 Checking listeners on port $Port..." -ForegroundColor Cyan

try {
  $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
} catch {
  Write-Host "⚠️  Unable to query connections. Try running PowerShell as Administrator." -ForegroundColor Yellow
  exit 1
}

if (-not $conns) {
  Write-Host "✅ No listeners on port $Port" -ForegroundColor Green
  exit 0
}

$pids = $conns | Select-Object -Unique -ExpandProperty OwningProcess

foreach ($pid in $pids) {
  try {
    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($null -ne $proc) {
      Write-Host ("🛑 Stopping PID {0} ({1}) on port {2}..." -f $pid, $proc.ProcessName, $Port) -ForegroundColor Yellow
      Stop-Process -Id $pid -Force -ErrorAction Stop
      Write-Host ("✔️  Stopped PID {0}" -f $pid) -ForegroundColor Green
    }
  } catch {
    Write-Host ("❌ Failed to stop PID {0}: {1}" -f $pid, $_.Exception.Message) -ForegroundColor Red
  }
}

Start-Sleep -Seconds 1

Write-Host "🔍 Verifying port status..." -ForegroundColor Cyan
$left = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($left) {
  Write-Host "❗ Still listening on port $Port. Some processes could not be terminated." -ForegroundColor Red
  $left | Select-Object -Property OwningProcess, State, LocalAddress, LocalPort | Format-Table -AutoSize
  exit 2
} else {
  Write-Host "✅ Port $Port is free." -ForegroundColor Green
  exit 0
}







