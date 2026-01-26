# Windows 代理启动问题诊断报告

## 问题概述
系统每次重启后，代理服务器（127.0.0.1:7897）都会被自动启用，但端口7897并未被任何服务监听。

## 诊断结果

### ✓ 关键发现
**Chrome浏览器扩展 - Ghelper** 是导致问题的根本原因！

扩展ID: `nmmhkkegccagdldgiimedpiccmgmieda`
扩展名称: Ghelper（代理管理扩展）
安装路径: `C:\Users\27937\AppData\Local\Google\Chrome\User Data\Default\Extensions\nmmhkkegccagdldgiimedpiccmgmieda\1.0.0.6_0`

### 问题原因
Ghelper是一个代理管理扩展，当Chrome浏览器启动时，该扩展会自动修改系统代理设置。但代理服务器程序本身可能：
1. 已经被卸载，但扩展仍在运行
2. 开机自启被禁用
3. 配置指向了不存在的代理服务器（127.0.0.1:7897）

## 完整检查结果

### 1. 当前代理状态
- **状态**: 已启用
- **代理服务器**: 127.0.0.1:7897
- **端口监听**: 否（端口7897未被任何进程监听）

### 2. 启动项检查
✓ 用户启动项：未发现代理相关程序
✓ 系统启动项：仅SecurityHealth（系统安全中心）
✓ 启动文件夹：空
✓ 计划任务：仅系统自带的Proxy任务（自动检查，非代理设置）
✓ 系统服务：未发现代理相关服务

### 3. 浏览器扩展
发现以下Chrome扩展：
- **nmmhkkegccagdldgiimedpiccmgmieda** → Ghelper ⚠️ **（代理扩展）**
- ghbmnnjooekpmoecnnnilnnbdlolhkhi
- jmjflgjpcpepeafmmgdpfkogkghcpiha
- kfbdpdaobnofkbopebjglnaadopfikhh

### 4. 其他检查
✓ WMI事件订阅：正常
✓ 组策略：未设置代理
✓ 登录脚本：未配置
✓ 常见代理软件路径：未发现Clash/V2Ray等安装

## 解决方案

### 方案1：禁用/删除Ghelper扩展（推荐）
1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 找到"Ghelper"扩展
4. 禁用或删除该扩展
5. 重启系统测试

### 方案2：修改Ghelper设置
如果需要继续使用Ghelper：
1. 打开Chrome扩展管理页面
2. 点击Ghelper的"选项"
3. 检查代理服务器配置
4. 确保127.0.0.1:7897是有效的代理地址
5. 或配置为正确的代理服务器地址

### 方案3：临时禁用代理
如果立即需要解除代理：
```powershell
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" -Name ProxyEnable -Value 0
```

### 方案4：禁止Chrome修改代理设置
如果Chrome通过其他方式修改代理，可以：
1. 创建注册表备份
2. 设置代理注册表项为只读
3. 或使用组策略锁定代理设置

## 验证步骤
1. 执行上述解决方案
2. 重启系统
3. 检查代理状态：
   ```powershell
   Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" | Select-Object ProxyEnable, ProxyServer
   ```
4. 确认ProxyEnable为0（已禁用）

## 总结
- **问题根源**: Chrome扩展"Ghelper"在浏览器启动时自动设置了系统代理
- **为什么端口不通**: 实际的代理服务器程序未运行，只有设置被修改
- **为什么每次重启都出现**: Chrome设置为开机自启，每次启动都会触发Ghelper扩展

---
生成时间: 2026-01-14
诊断工具: PowerShell + 系统注册表检查
