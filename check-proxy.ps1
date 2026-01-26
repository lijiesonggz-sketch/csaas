# Windows 代理启动诊断脚本
Write-Host "=== Windows 代理启动诊断报告 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 检查当前代理设置
Write-Host "1. 当前代理设置:" -ForegroundColor Yellow
$proxySettings = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
Write-Host "   代理启用: $($proxySettings.ProxyEnable)" -ForegroundColor $(if ($proxySettings.ProxyEnable) { "Red" } else { "Green" })
Write-Host "   代理地址: $($proxySettings.ProxyServer)"
Write-Host ""

# 2. 检查端口7897是否被占用
Write-Host "2. 端口7897监听情况:" -ForegroundColor Yellow
$port7897 = netstat -ano | Select-String "127.0.0.1:7897" | Select-String "LISTENING"
if ($port7897) {
    Write-Host "   端口7897正在被监听:" -ForegroundColor Red
    $port7897 | ForEach-Object {
        $parts = $_ -split '\s+'
        $pid = $parts[-1]
        Write-Host "   PID: $pid"
        try {
            $process = Get-Process -Id $pid -ErrorAction Stop
            Write-Host "   进程名: $($process.ProcessName)"
            Write-Host "   路径: $($process.Path)"
        } catch {
            Write-Host "   (无法获取进程详情)"
        }
    }
} else {
    Write-Host "   端口7897未被监听" -ForegroundColor Green
}
Write-Host ""

# 3. 检查代理相关进程
Write-Host "3. 代理相关进程:" -ForegroundColor Yellow
$proxyKeywords = @('clash', 'v2ray', 'shadowsocks', 'ssr', 'privoxy', 'polipo', 'mitmproxy')
$found = $false
foreach ($keyword in $proxyKeywords) {
    $processes = Get-Process -Name "*$keyword*" -ErrorAction SilentlyContinue
    if ($processes) {
        $found = $true
        Write-Host "   发现包含 '$keyword' 的进程:" -ForegroundColor Red
        $processes | ForEach-Object {
            Write-Host "   - $($_.ProcessName) (PID: $($_.Id))"
        }
    }
}
if (-not $found) {
    Write-Host "   未发现常见代理进程" -ForegroundColor Green
}
Write-Host ""

# 4. 检查启动注册表项
Write-Host "4. 用户启动注册表项:" -ForegroundColor Yellow
$userRun = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$userRun.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object {
    $value = $_.Value
    $highlight = if ($value -match 'clash|v2ray|proxy|7897') { "Red" } else { "White" }
    Write-Host "   $($_.Name): $value" -ForegroundColor $highlight
}
Write-Host ""

# 5. 检查系统启动注册表项
Write-Host "5. 系统启动注册表项:" -ForegroundColor Yellow
$systemRun = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
$systemRun.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object {
    $value = $_.Value
    $highlight = if ($value -match 'clash|v2ray|proxy|7897') { "Red" } else { "White" }
    Write-Host "   $($_.Name): $value" -ForegroundColor $highlight
}
Write-Host ""

# 6. 检查Winlogon启动项
Write-Host "6. Winlogon启动项:" -ForegroundColor Yellow
try {
    $winlogon = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Winlogon" -ErrorAction Stop
    if ($winlogon.shell) {
        Write-Host "   Shell: $($winlogon.shell)" -ForegroundColor $(if ($winlogon.shell -match 'clash|v2ray|proxy') { "Red" } else { "Green" })
    }
} catch {
    Write-Host "   无异常Winlogon启动项" -ForegroundColor Green
}
Write-Host ""

# 7. 检查用户init启动项
Write-Host "7. 用户初始化启动项:" -ForegroundColor Yellow
try {
    $userInit = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Windows" -ErrorAction Stop
    if ($userInit.load) {
        Write-Host "   Load: $($userInit.load)" -ForegroundColor $(if ($userInit.load -match 'clash|v2ray|proxy') { "Red" } else { "Green" })
    }
    if ($userInit.run) {
        Write-Host "   Run: $($userInit.run)" -ForegroundColor $(if ($userInit.run -match 'clash|v2ray|proxy') { "Red" } else { "Green" })
    }
} catch {
    Write-Host "   无异常init启动项" -ForegroundColor Green
}
Write-Host ""

# 8. 检查常见代理软件的安装路径
Write-Host "8. 常见代理软件安装检测:" -ForegroundColor Yellow
$commonPaths = @(
    "C:\Program Files\Clash*",
    "C:\Program Files\V2Ray*",
    "C:\Program Files\Shadowsocks*",
    "${env:LOCALAPPDATA}\Clash*",
    "${env:LOCALAPPDATA}\V2Ray*",
    "${env:APPDATA}\Clash*",
    "${env:APPDATA}\V2Ray*"
)
foreach ($path in $commonPaths) {
    if (Test-Path $path) {
        Write-Host "   发现: $path" -ForegroundColor Red
        Get-ChildItem $path -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "     - $($_.FullName)"
        }
    }
}
Write-Host ""

# 9. 检查计划任务
Write-Host "9. 代理相关计划任务:" -ForegroundColor Yellow
$tasks = Get-ScheduledTask | Where-Object { $_.TaskName -match 'clash|v2ray|proxy|vpn' }
if ($tasks) {
    $tasks | ForEach-Object {
        Write-Host "   任务名: $($_.TaskName)" -ForegroundColor Red
        Write-Host "   状态: $($_.State)"
        Write-Host "   路径: $($_.TaskPath)"
        Write-Host "   命令: $($_.Actions.Execute)"
        Write-Host ""
    }
} else {
    Write-Host "   未发现代理相关计划任务" -ForegroundColor Green
}
Write-Host ""

Write-Host "=== 诊断完成 ===" -ForegroundColor Cyan
