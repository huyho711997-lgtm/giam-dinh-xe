param([string]$ScratchDirectory = (Join-Path $env:TEMP 'tasco-shared-form-previews'))

$ErrorActionPreference = 'Stop'
$repository = Split-Path $PSScriptRoot -Parent
$catalog = Get-Content (Join-Path $repository 'js/data/shared-forms-drive.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$outputDirectory = Join-Path $repository 'assets/shared-form-previews'
New-Item -ItemType Directory -Force -Path $ScratchDirectory, $outputDirectory | Out-Null
$jobs = @()
foreach ($file in $catalog.folders.($catalog.rootFolderId).files) {
    if ($file.name -notmatch '\.docx?$') { continue }
    if ($file.id -notmatch '^[A-Za-z0-9_-]{8,}$') { throw 'Invalid Drive file ID.' }
    $sourcePath = Join-Path $ScratchDirectory ($file.id + [IO.Path]::GetExtension($file.name))
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 60 -Uri ('https://drive.usercontent.google.com/download?id=' + $file.id + '&export=download') -OutFile $sourcePath
    $jobs += [pscustomobject]@{id=$file.id; source='drive'; path=$sourcePath; name=$file.name; modifiedTime=$file.modifiedTime; sourceUrl=$null}
}
foreach ($template in @(@{id='builtin_tnds'; filename='tnds-advance.docx'}, @{id='builtin_collection'; filename='collection-guide.docx'})) {
    $url = 'assets/templates/' + $template.filename
    $jobs += [pscustomobject]@{id=$template.id; source='builtin'; path=(Join-Path $repository $url); name=$template.filename; modifiedTime=$null; sourceUrl=$url}
}
$word = $null
$previousOptions = $null
$entries = [ordered]@{}
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.AutomationSecurity = 3
    $previousOptions = @{UpdateLinksAtOpen=$word.Options.UpdateLinksAtOpen; UpdateFieldsAtPrint=$word.Options.UpdateFieldsAtPrint; UpdateLinksAtPrint=$word.Options.UpdateLinksAtPrint}
    $word.Options.UpdateLinksAtOpen = $false
    $word.Options.UpdateFieldsAtPrint = $false
    $word.Options.UpdateLinksAtPrint = $false
    foreach ($job in $jobs) {
        $sourceBytes = [IO.File]::ReadAllBytes($job.path)
        if ($sourceBytes.Length -gt 20MB) { throw ('Document exceeds 20 MB: ' + $job.name) }
        $signature = [BitConverter]::ToString($sourceBytes, 0, [Math]::Min(8, $sourceBytes.Length))
        if (-not ($signature.StartsWith('50-4B-03-04') -or $signature.StartsWith('D0-CF-11-E0-A1-B1-1A-E1'))) { throw ('Not a Word document: ' + $job.name) }
        $document = $null
        try {
            $document = $word.Documents.Open($job.path, $false, $true, $false)
            $document.Repaginate()
            $pages = $document.ComputeStatistics(2)
            $pdfPath = Join-Path $outputDirectory ($job.id + '.pdf')
            $document.ExportAsFixedFormat($pdfPath, 17)
            $entries[$job.id] = [ordered]@{source=$job.source; sourceUrl=$job.sourceUrl; sourceModifiedTime=$job.modifiedTime; sourceSha256=(Get-FileHash -LiteralPath $job.path -Algorithm SHA256).Hash.ToLowerInvariant(); url=('assets/shared-form-previews/' + $job.id + '.pdf'); size=(Get-Item -LiteralPath $pdfPath).Length; pages=$pages}
            Write-Output ($job.id + ': ' + $pages + ' pages')
        } finally {
            if ($document) { $document.Close(0); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document) }
        }
    }
} finally {
    if ($word) {
        if ($previousOptions) {
            $word.Options.UpdateLinksAtOpen = $previousOptions.UpdateLinksAtOpen
            $word.Options.UpdateFieldsAtPrint = $previousOptions.UpdateFieldsAtPrint
            $word.Options.UpdateLinksAtPrint = $previousOptions.UpdateLinksAtPrint
        }
        $word.Quit()
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word)
    }
}
$manifest = [ordered]@{version=1; engine='Microsoft Word'; generatedAt=[DateTime]::UtcNow.ToString('o'); catalogAt=$catalog.syncedAt; rootFolderId=$catalog.rootFolderId; files=$entries}
$json = ConvertTo-Json -InputObject $manifest -Depth 8
[IO.File]::WriteAllText((Join-Path $repository 'js/data/shared-forms-print.json'), $json + "`n", (New-Object Text.UTF8Encoding($false)))
Write-Output ('Built ' + $entries.Count + ' Word print previews. Original files are unchanged.')
