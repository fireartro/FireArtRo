[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$LandscapeMaster,

  [Parameter(Mandatory = $true)]
  [string]$PortraitMaster,

  [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$taskScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$taskRepositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $taskScriptRoot '..'))
$taskOutputRoot = if ($OutputDirectory) {
  [System.IO.Path]::GetFullPath($OutputDirectory)
} else {
  Join-Path $taskRepositoryRoot 'frontend\public\media'
}

$taskLandscapeSource = [System.IO.Path]::GetFullPath($LandscapeMaster)
$taskPortraitSource = [System.IO.Path]::GetFullPath($PortraitMaster)

foreach ($taskSource in @($taskLandscapeSource, $taskPortraitSource)) {
  if (-not (Test-Path -LiteralPath $taskSource -PathType Leaf)) {
    throw "Hero master not found: $taskSource"
  }
}

if (-not (Test-Path -LiteralPath $taskOutputRoot -PathType Container)) {
  throw "Output directory not found: $taskOutputRoot"
}

$taskFfmpeg = (Get-Command ffmpeg -ErrorAction Stop).Source
$taskFfprobe = (Get-Command ffprobe -ErrorAction Stop).Source
$taskTemporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('fireart-hero-export-' + [guid]::NewGuid().ToString('N'))
[System.IO.Directory]::CreateDirectory($taskTemporaryRoot) | Out-Null

$taskVariants = @(
  [pscustomobject]@{ Name = 'wide'; Width = 1920; Height = 1200; Source = $taskLandscapeSource; Crf = 27; MaxRate = '2600k'; Buffer = '5200k'; CropX = 'iw-ow'; CropY = '(ih-oh)/2'; SizeLimitMb = 7 },
  [pscustomobject]@{ Name = 'ultrawide'; Width = 1920; Height = 900; Source = $taskLandscapeSource; Crf = 27; MaxRate = '2400k'; Buffer = '4800k'; CropX = '(iw-ow)/2'; CropY = '(ih-oh)/2'; SizeLimitMb = 7 },
  [pscustomobject]@{ Name = 'tablet-landscape'; Width = 1440; Height = 1080; Source = $taskLandscapeSource; Crf = 28; MaxRate = '1800k'; Buffer = '3600k'; CropX = 'iw-ow'; CropY = '(ih-oh)/2'; SizeLimitMb = 5 },
  [pscustomobject]@{ Name = 'tablet-portrait'; Width = 1080; Height = 1440; Source = $taskPortraitSource; Crf = 28; MaxRate = '1700k'; Buffer = '3400k'; CropX = '(iw-ow)/2'; CropY = 'ih-oh'; SizeLimitMb = 5 },
  [pscustomobject]@{ Name = 'mobile'; Width = 900; Height = 1600; Source = $taskPortraitSource; Crf = 29; MaxRate = '1500k'; Buffer = '3000k'; CropX = '(iw-ow)/2'; CropY = '(ih-oh)/2'; SizeLimitMb = 4.5 },
  [pscustomobject]@{ Name = 'mobile-tall'; Width = 900; Height = 1950; Source = $taskPortraitSource; Crf = 29; MaxRate = '1400k'; Buffer = '2800k'; CropX = '(iw-ow)/2'; CropY = '(ih-oh)/2'; SizeLimitMb = 4.5 }
)

function Invoke-TaskNativeCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Executable,

    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,

    [Parameter(Mandatory = $true)]
    [string]$Description
  )

  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE"
  }
}

function Test-TaskHeroMedia {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [Parameter(Mandatory = $true)]
    [pscustomobject]$Variant
  )

  $taskProbeJson = & $taskFfprobe -v error -select_streams 'v:0' -show_entries 'stream=codec_name,width,height,r_frame_rate' -show_entries 'format=duration,size' -of json -- $Path
  if ($LASTEXITCODE -ne 0) {
    throw "FFprobe failed for $Path"
  }

  $taskProbe = $taskProbeJson | ConvertFrom-Json
  $taskStream = $taskProbe.streams[0]
  $taskFormat = $taskProbe.format
  $taskDuration = [double]::Parse([string]$taskFormat.duration, [System.Globalization.CultureInfo]::InvariantCulture)
  $taskSizeMb = [double]$taskFormat.size / 1MB

  if ($taskStream.codec_name -ne 'h264') {
    throw "$($Variant.Name): expected h264, received $($taskStream.codec_name)"
  }
  if ([int]$taskStream.width -ne $Variant.Width -or [int]$taskStream.height -ne $Variant.Height) {
    throw "$($Variant.Name): expected $($Variant.Width)x$($Variant.Height), received $($taskStream.width)x$($taskStream.height)"
  }
  if ($taskStream.r_frame_rate -ne '30/1') {
    throw "$($Variant.Name): expected 30/1 fps, received $($taskStream.r_frame_rate)"
  }
  if ($taskDuration -lt 19.9 -or $taskDuration -gt 20.1) {
    throw "$($Variant.Name): expected a 20 second duration, received $taskDuration"
  }
  if ($taskSizeMb -gt $Variant.SizeLimitMb) {
    throw ('{0}: {1:N2} MB exceeds the {2} MB limit' -f $Variant.Name, $taskSizeMb, $Variant.SizeLimitMb)
  }

  [pscustomobject]@{
    Name = $Variant.Name
    Width = [int]$taskStream.width
    Height = [int]$taskStream.height
    Duration = [math]::Round($taskDuration, 2)
    SizeMb = [math]::Round($taskSizeMb, 2)
  }
}

$taskResults = @()
$taskDeliveries = @()

try {
  foreach ($taskVariant in $taskVariants) {
    $taskTemporaryMp4 = Join-Path $taskTemporaryRoot ("fireart-hero-$($taskVariant.Name).mp4")
    $taskTemporaryPoster = Join-Path $taskTemporaryRoot ("fireart-hero-$($taskVariant.Name).webp")
    $taskVideoFilter = "scale=$($taskVariant.Width):$($taskVariant.Height):force_original_aspect_ratio=increase:flags=lanczos,crop=$($taskVariant.Width):$($taskVariant.Height):$($taskVariant.CropX):$($taskVariant.CropY),setsar=1"

    Write-Host "Rendering $($taskVariant.Name) ($($taskVariant.Width)x$($taskVariant.Height))"
    Invoke-TaskNativeCommand -Executable $taskFfmpeg -Description "MP4 export for $($taskVariant.Name)" -Arguments @(
      '-y',
      '-hide_banner',
      '-loglevel', 'warning',
      '-i', $taskVariant.Source,
      '-map', '0:v:0',
      '-vf', $taskVideoFilter,
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', [string]$taskVariant.Crf,
      '-maxrate', $taskVariant.MaxRate,
      '-bufsize', $taskVariant.Buffer,
      '-profile:v', 'high',
      '-level:v', '5.0',
      '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-an',
      '-movflags', '+faststart',
      '-map_metadata', '-1',
      $taskTemporaryMp4
    )

    Invoke-TaskNativeCommand -Executable $taskFfmpeg -Description "WebP poster export for $($taskVariant.Name)" -Arguments @(
      '-y',
      '-hide_banner',
      '-loglevel', 'warning',
      '-ss', '0.70',
      '-i', $taskTemporaryMp4,
      '-frames:v', '1',
      '-c:v', 'libwebp',
      '-q:v', '82',
      '-compression_level', '6',
      $taskTemporaryPoster
    )

    $taskResults += Test-TaskHeroMedia -Path $taskTemporaryMp4 -Variant $taskVariant
    $taskDeliveries += [pscustomobject]@{
      Mp4Source = $taskTemporaryMp4
      Mp4Destination = Join-Path $taskOutputRoot ("fireart-hero-$($taskVariant.Name).mp4")
      PosterSource = $taskTemporaryPoster
      PosterDestination = Join-Path $taskOutputRoot ("fireart-hero-$($taskVariant.Name).webp")
    }
  }

  foreach ($taskDelivery in $taskDeliveries) {
    Move-Item -LiteralPath $taskDelivery.Mp4Source -Destination $taskDelivery.Mp4Destination -Force
    Move-Item -LiteralPath $taskDelivery.PosterSource -Destination $taskDelivery.PosterDestination -Force
  }
} finally {
  if (Test-Path -LiteralPath $taskTemporaryRoot -PathType Container) {
    Get-ChildItem -LiteralPath $taskTemporaryRoot -File | ForEach-Object {
      [System.IO.File]::Delete($_.FullName)
    }
    [System.IO.Directory]::Delete($taskTemporaryRoot, $false)
  }
}

$taskResults | Format-Table -AutoSize
