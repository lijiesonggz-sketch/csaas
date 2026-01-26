# Windows Proxy Diagnostic Script
Write-Host "=== Windows Proxy Startup Diagnostic ==="
Write-Host ""

# 1. Current proxy settings
Write-Host "1. Current Proxy Settings:"
$proxySettings = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
Write-Host "   ProxyEnable: $($proxySettings.ProxyEnable)"
Write-Host "   ProxyServer: $($proxySettings.ProxyServer)"
Write-Host ""

# 2. Port 7897 status
Write-Host "2. Port 7897 Status:"
$portInfo = netstat -ano | Select-String "127.0.0.1:7897"
if ($portInfo) {
    Write-Host $portInfo
    $portInfo | ForEach-Object {
        if ($_ -match "LISTENING\s+(\d+)") {
            $pid = $matches[1]
            try {
                $process = Get-Process -Id $pid -ErrorAction Stop
                Write-Host "   Process: $($process.ProcessName)"
                Write-Host "   Path: $($process.Path)"
            } catch {
                Write-Host "   PID: $pid (Process details unavailable)"
            }
        }
    }
} else {
    Write-Host "   Port 7897 is NOT listening"
}
Write-Host ""

# 3. User startup registry
Write-Host "3. User Startup Registry Items:"
$userRun = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$userRun.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object {
    Write-Host "   $($_.Name): $($_.Value)"
}
Write-Host ""

# 4. System startup registry
Write-Host "4. System Startup Registry Items:"
$systemRun = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
$systemRun.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object {
    Write-Host "   $($_.Name): $($_.Value)"
}
Write-Host ""

# 5. Check for common proxy software paths
Write-Host "5. Common Proxy Software Paths:"
$paths = @(
    "${env:LOCALAPPDATA}\Clash",
    "${env:LOCALAPPDATA}\V2Ray",
    "${env:APPDATA}\Clash",
    "${env:APPDATA}\V2Ray",
    "C:\Program Files\Clash",
    "C:\Program Files\V2Ray"
)
foreach ($path in $paths) {
    if (Test-Path $path) {
        Write-Host "   Found: $path"
    }
}
Write-Host ""

# 6. Scheduled tasks
Write-Host "6. Proxy-Related Scheduled Tasks:"
$tasks = Get-ScheduledTask | Where-Object { $_.TaskName -match 'clash|v2ray|proxy' }
if ($tasks) {
    $tasks | ForEach-Object {
        Write-Host "   Task: $($_.TaskName)"
        Write-Host "   State: $($_.State)"
    }
} else {
    Write-Host "   No proxy-related tasks found"
}
Write-Host ""

# 7. Services
Write-Host "7. Running Services (proxy-related):"
$services = Get-Service | Where-Object { $_.Status -eq 'Running' -and ($_.Name -match 'clash|v2ray|proxy' -or $_.DisplayName -match 'clash|v2ray|proxy') }
if ($services) {
    $services | ForEach-Object {
        Write-Host "   $($_.Name) - $($_.DisplayName)"
    }
} else {
    Write-Host "   No proxy-related services found"
}
Write-Host ""

Write-Host "=== Diagnostic Complete ==="
