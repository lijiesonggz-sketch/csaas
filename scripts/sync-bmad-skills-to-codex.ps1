param(
    [switch]$ForceReplace,
    [switch]$PruneStale,
    [ValidateSet('Auto','Junction','Copy')]
    [string]$Mode = 'Auto'
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $projectRoot '.agents\skills'
$targetRoot = Join-Path $projectRoot '.codex\skills'

if (-not (Test-Path -LiteralPath $sourceRoot)) {
    throw "BMAD source folder not found: $sourceRoot"
}

New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null

$skills = Get-ChildItem -LiteralPath $sourceRoot -Directory |
    Where-Object { $_.Name -like 'bmad*' } |
    Sort-Object Name

if ($skills.Count -eq 0) {
    throw "No BMAD skills found under $sourceRoot"
}

function Add-SkillMapping {
    param(
        [string]$SourcePath,
        [string]$TargetPath,
        [string]$SelectedMode
    )

    if ($SelectedMode -eq 'Copy') {
        Copy-Item -LiteralPath $SourcePath -Destination $TargetPath -Recurse
        return 'copy'
    }

    if ($SelectedMode -eq 'Junction') {
        New-Item -ItemType Junction -Path $TargetPath -Target $SourcePath | Out-Null
        return 'junction'
    }

    try {
        New-Item -ItemType Junction -Path $TargetPath -Target $SourcePath | Out-Null
        return 'junction'
    } catch {
        Copy-Item -LiteralPath $SourcePath -Destination $TargetPath -Recurse
        return 'copy'
    }
}

if ($PruneStale) {
    $expected = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)

    foreach ($skill in $skills) {
        [void]$expected.Add($skill.Name)
    }

    Get-ChildItem -LiteralPath $targetRoot -Directory |
        Where-Object { $_.Name -like 'bmad*' } |
        ForEach-Object {
            if (-not $expected.Contains($_.Name)) {
                Remove-Item -LiteralPath $_.FullName -Recurse -Force
                Write-Host "Pruned stale entry: $($_.Name)"
            }
        }
}

$created = New-Object System.Collections.Generic.List[string]
$skipped = New-Object System.Collections.Generic.List[string]
$replaced = New-Object System.Collections.Generic.List[string]
$createdByCopy = 0
$createdByJunction = 0

foreach ($skill in $skills) {
    $targetPath = Join-Path $targetRoot $skill.Name

    if (Test-Path -LiteralPath $targetPath) {
        if (-not $ForceReplace) {
            $skipped.Add($skill.Name) | Out-Null
            continue
        }

        Remove-Item -LiteralPath $targetPath -Recurse -Force
        $replaced.Add($skill.Name) | Out-Null
    }

    $result = Add-SkillMapping -SourcePath $skill.FullName -TargetPath $targetPath -SelectedMode $Mode

    if ($result -eq 'copy') {
        $createdByCopy++
    } else {
        $createdByJunction++
    }

    $created.Add($skill.Name) | Out-Null
}

Write-Host "BMAD skills discovered: $($skills.Count)"
Write-Host "Entries created: $($created.Count)"
Write-Host "Created by junction: $createdByJunction"
Write-Host "Created by copy: $createdByCopy"
Write-Host "Existing entries skipped: $($skipped.Count)"
Write-Host "Existing entries replaced: $($replaced.Count)"

if ($created.Count -gt 0) {
    Write-Host "Sample created skills:"
    $created | Select-Object -First 10 | ForEach-Object { Write-Host " - $_" }
}
