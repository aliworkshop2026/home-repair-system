# Build 15 daily process-record Word documents from template.
# All Chinese text is read from days.json (UTF-8) to avoid encoding issues.
$ErrorActionPreference = 'Stop'
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$cfg = Get-Content -LiteralPath (Join-Path $base 'days.json') -Raw -Encoding UTF8 | ConvertFrom-Json

if (-not (Test-Path -LiteralPath $cfg.outputDir)) {
    New-Item -ItemType Directory -Path $cfg.outputDir | Out-Null
}
$singleDir = Join-Path $cfg.outputDir $cfg.singleDir
if (-not (Test-Path -LiteralPath $singleDir)) {
    New-Item -ItemType Directory -Path $singleDir | Out-Null
}

function To-Cell {
    param([string]$s)
    return ($s -replace "`r`n", "`n" -replace "`n", "`r")
}

# IMPORTANT: assign to variables first; inline "[string]$x.prop" inside a
# command-argument list is parsed incorrectly by PowerShell.
function Fill-Table($tbl, $day, $location) {
    $d   = [string]$day.date
    $t   = [string]$day.today
    $m   = [string]$day.tomorrow
    $loc = [string]$location
    $tbl.Cell(3,2).Range.Text = $d
    $tbl.Cell(3,4).Range.Text = $loc
    $tbl.Cell(4,2).Range.Text = (To-Cell -s $t)
    $tbl.Cell(5,2).Range.Text = (To-Cell -s $m)
}

function Release-Com($obj) {
    try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($obj) | Out-Null } catch {}
}
function Kill-Word {
    Get-Process WINWORD -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# ---------- Part A: 15 single-page files (fresh Word instance each) ----------
Kill-Word
$idx = 0
foreach ($day in $cfg.days) {
    $idx++
    $outFile = Join-Path $singleDir ([string]$day.file)
    if (Test-Path -LiteralPath $outFile) { Remove-Item -LiteralPath $outFile -Force }

    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $doc = $null
    try {
        $doc = $word.Documents.Open([string]$cfg.template)
        Fill-Table $doc.Tables.Item(1) $day $cfg.location
        $doc.SaveAs2($outFile, 16)
        $pg = $doc.ComputeStatistics(2)
        Write-Output ("single " + $idx + "/15 pages=" + $pg)
    } finally {
        if ($doc -ne $null) { try { $doc.Close($false) } catch {} }
        try { $word.Quit() } catch {}
        Release-Com $doc
        Release-Com $word
        Start-Sleep -Milliseconds 400
    }
}

# ---------- Part B: combined 15-page document via InsertFile ----------
Kill-Word
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$doc = $null
try {
    $doc = $word.Documents.Add()
    $sel = $word.Selection
    $i = 0
    foreach ($day in $cfg.days) {
        $path = Join-Path $singleDir ([string]$day.file)
        if ($i -gt 0) { $sel.InsertBreak(7) }   # wdPageBreak
        $sel.InsertFile($path)
        $i++
    }
    $combined = Join-Path $cfg.outputDir ([string]$cfg.combinedFile)
    if (Test-Path -LiteralPath $combined) { Remove-Item -LiteralPath $combined -Force }
    $doc.SaveAs2($combined, 16)
    Write-Output ("COMBINED_PAGES=" + $doc.ComputeStatistics(2))
    Write-Output ("ALL_DONE: " + $combined)
} finally {
    if ($doc -ne $null) { try { $doc.Close($false) } catch {} }
    try { $word.Quit() } catch {}
    Release-Com $doc
    Release-Com $word
}
