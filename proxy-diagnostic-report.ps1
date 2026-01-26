# Complete Windows Proxy Diagnostic Report
$report = @()

# Header
$report += "=" * 80
$report += "Windows 代理启动诊断报告"
$report += "生成时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$report += "=" * 80
$report += ""

# 1. 代理设置状态
$report += "【1. 当前代理设置】"
$proxySettings = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
$report += "代理启用: $($proxySettings.ProxyEnable)"
$report += "代理服务器: $($proxySettings.ProxyServer)"
$report += ""

# 2. 端口7897监听情况
$report += "【2. 端口7897状态】"
$portInfo = netstat -ano | Select-String "127.0.0.1:7897.*LISTENING"
if ($portInfo) {
    $report += "端口7897正在监听:"
    $report += $portInfo
    if ($portInfo -match "LISTENING\s+(\d+)") {
        $pid = $matches[1]
        try {
            $process = Get-Process -Id $pid -ErrorAction Stop
            $report += "  监听进程: $($process.ProcessName)"
            $report += "  进程路径: $($process.Path)"
        } catch {
            $report += "  PID: $pid (无法获取详细信息)"
        }
    }
} else {
    $report += "端口7897当前未被监听"
    $report += "注意: 代理已启用但服务未运行，说明代理设置是持久化的"
}
$report += ""

# 3. 用户启动项
$report += "【3. 用户启动项】(HKCU\...\Run)"
$userRun = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$hasProxy = $false
$userRun.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object {
    $value = $_.Value
    $isProxy = if ($value -match 'clash|v2ray|proxy|7897') { $true } else { $false }
    if ($isProxy) { $hasProxy = $true }
    $report += "  $($_.Name) = $value$(if ($isProxy) { ' [可能相关]' })"
}
if (-not $hasProxy) {
    $report += "  未发现明显的代理相关启动项"
}
$report += ""

# 4. 系统启动项
$report += "【4. 系统启动项】(HKLM\...\Run)"
$systemRun = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
$hasProxy = $false
$systemRun.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object {
    $value = $_.Value
    $isProxy = if ($value -match 'clash|v2ray|proxy|7897') { $true } else { $false }
    if ($isProxy) { $hasProxy = $true }
    $report += "  $($_.Name) = $value$(if ($isProxy) { ' [可能相关]' })"
}
if (-not $hasProxy) {
    $report += "  未发现明显的代理相关启动项"
}
$report += ""

# 5. 启动文件夹
$report += "【5. 启动文件夹】"
$startupFolder = [Environment]::GetFolderPath('Startup')
$startupItems = Get-ChildItem $startupFolder -ErrorAction SilentlyContinue
if ($startupItems) {
    $report += "用户启动文件夹: $startupFolder"
    $startupItems | ForEach-Object {
        $report += "  - $($_.Name)"
    }
} else {
    $report += "用户启动文件夹为空"
}
$commonStartup = [Environment]::GetFolderPath('CommonStartup')
$commonStartupItems = Get-ChildItem $commonStartup -ErrorAction SilentlyContinue
if ($commonStartupItems) {
    $report += "公共启动文件夹: $commonStartup"
    $commonStartupItems | ForEach-Object {
        $report += "  - $($_.Name)"
    }
} else {
    $report += "公共启动文件夹为空"
}
$report += ""

# 6. 计划任务
$report += "【6. 计划任务】"
$tasks = Get-ScheduledTask | Where-Object { $_.TaskName -match 'clash|v2ray|proxy|vpn' }
if ($tasks) {
    $tasks | ForEach-Object {
        $report += "任务名称: $($_.TaskName)"
        $report += "  状态: $($_.State)"
        $report += "  路径: $($_.TaskPath)"
        if ($_.Actions) {
            $report += "  操作: $($_.Actions.Execute)"
        }
        $report += ""
    }
} else {
    $report += "  未发现代理相关的计划任务（除了系统的Proxy任务）"
}
$report += ""

# 7. 服务
$report += "【7. 系统服务】"
$services = Get-WmiObject Win32_Service | Where-Object {
    $_.State -eq 'Running' -and (
        $_.Name -match 'clash|v2ray|proxy|tun|vpn' -or
        $_.DisplayName -match 'clash|v2ray|proxy|tun|vpn' -or
        $_.PathName -match 'clash|v2ray|proxy'
    )
}
if ($services) {
    $services | ForEach-Object {
        $report += "  $($_.Name) - $($_.DisplayName)"
        $report += "    路径: $($_.PathName)"
    }
} else {
    $report += "  未发现代理相关的运行服务"
}
$report += ""

# 8. 常见代理软件路径
$report += "【8. 常见代理软件安装路径】"
$proxyPaths = @(
    "${env:LOCALAPPDATA}\Clash",
    "${env:LOCALAPPDATA}\V2Ray",
    "${env:LOCALAPPDATA}\Shadowsocks",
    "${env:APPDATA}\Clash",
    "${env:APPDATA}\V2Ray",
    "${env:APPDATA}\Shadowsocks",
    "C:\Program Files\Clash",
    "C:\Program Files\V2Ray",
    "C:\Program Files\Shadowsocks"
)
$foundPaths = @()
foreach ($path in $proxyPaths) {
    if (Test-Path $path) {
        $foundPaths += $path
        $report += "  发现: $path"
    }
}
if ($foundPaths.Count -eq 0) {
    $report += "  未发现常见代理软件安装路径"
}
$report += ""

# 9. 组策略
$report += "【9. 组策略代理设置】"
$policyPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CurrentVersion\Internet Settings"
$policy = Get-ItemProperty -Path $policyPath -ErrorAction SilentlyContinue
if ($policy) {
    $report += "  组策略存在，检查详细设置..."
    $policy.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object {
        $report += "    $($_.Name) = $($_.Value)"
    }
} else {
    $report += "  未设置组策略代理"
}
$report += ""

# 10. 分析结论
$report += "=" * 80
$report += "【诊断结论】"
$report += ""

if ($portInfo) {
    $report += "情况A: 代理服务正在运行"
    $report += "- 代理设置已启用，且端口7897正在监听"
    $report += "- 需要找到监听该端口的进程，并检查其启动方式"
} else {
    $report += "情况B: 代理设置持久化，但服务未运行"
    $report += "- 代理设置已在注册表中启用"
    $report += "- 但当前没有进程监听7897端口"
    $report += "- 这表明有某个程序在启动时设置了代理，但随后退出了"
    $report += ""
    $report += "可能的原因:"
    $report += "1. 某个启动项脚本设置了代理注册表后退出"
    $report += "2. 登录脚本或组策略设置了代理"
    $report += "3. 浏览器扩展或系统托盘程序设置了代理"
    $report += "4. 代理软件的开机自启被禁用，但代理设置未清除"
}

$report += ""
$report += "建议的排查步骤:"
$report += "1. 使用'事件查看器'查看启动时的应用程序日志"
$report += "2. 检查是否有登录脚本(用户配置 -> 登录脚本)"
$report += "3. 检查浏览器扩展(Chrome/Edge的代理扩展)"
$report += "4. 使用Autoruns工具查看所有启动项(包括浏览器插件)"
$report += "5. 临时禁用各个启动项，重启后测试代理是否还会启用"
$report += ""
$report += "临时解决方法:"
$report += "- 运行以下命令禁用代理:"
$report += "  Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -Name ProxyEnable -Value 0"
$report += "=" * 80

# 输出报告
$report | Out-File -FilePath "D:\csaas\proxy-diagnostic-report.txt" -Encoding UTF8
$report | Write-Host

Write-Host ""
Write-Host "报告已保存到: D:\csaas\proxy-diagnostic-report.txt" -ForegroundColor Cyan
