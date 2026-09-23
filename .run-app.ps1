Set-Location 'c:\connect'
$logDir = 'c:\connect\logs\dev'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = "$logDir\run-app.log"
Remove-Item $log -Force -ErrorAction SilentlyContinue

function W($m) { "$m" | Out-File -FilePath $log -Append -Encoding utf8 }

W "=== boot $(Get-Date -Format o) ==="

# 1. Kill stale node servers (port 3000/3111 holders) but never this shell.
Get-Process node -ErrorAction SilentlyContinue |
  Where-Object { $_.Id -ne $PID } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
W "stale servers cleared"

# 2. Start Next.js dev server on the canonical port.
$cmd = Start-Process -FilePath 'cmd.exe' `
  -ArgumentList '/c', 'npm run dev > c:\connect\logs\dev\dev-stdout.log 2>&1' `
  -WorkingDirectory 'c:\connect' -PassThru -WindowStyle Hidden
W "launched cmd pid=$($cmd.Id)"

# 3. Poll for readiness.
$ready = $false
for ($i = 1; $i -le 30; $i++) {
  Start-Sleep -Seconds 4
  try {
    $r = Invoke-WebRequest -Uri 'http://localhost:3000/' -UseBasicParsing -TimeoutSec 6
    W "READY after $($i * 4)s status=$($r.StatusCode)"
    $ready = $true
    break
  } catch {
    W "wait $($i * 4)s : $($_.Exception.Message)"
  }
}

if (-not $ready) {
  W 'NOT READY - dev stdout tail:'
  Get-Content 'c:\connect\logs\dev\dev-stdout.log' -Tail 40 -ErrorAction SilentlyContinue |
    ForEach-Object { W $_ }
  W 'END'
  return
}

# 4. Probe the routing chain over real HTTP.
function Probe($path) {
  try {
    $resp = Invoke-WebRequest -Uri "http://localhost:3000$path" `
      -UseBasicParsing -TimeoutSec 15 -MaximumRedirection 0 -ErrorAction Stop
    $loc = $resp.Headers['Location']
    W "$path -> $($resp.StatusCode) $(if ($loc) { "Location: $loc" })"
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    $loc = $_.Exception.Response.Headers['Location']
    if ($status) { W "$path -> $status $(if ($loc) { "Location: $loc" })" }
    else { W "$path -> ERROR $($_.Exception.Message)" }
  }
}

Probe '/'
Probe '/login'
Probe '/dashboard'
Probe '/dashboard/discover'
W '=== probe complete ==='
