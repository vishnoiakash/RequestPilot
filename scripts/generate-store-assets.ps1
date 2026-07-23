Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $projectRoot 'assets\logo\request_pilot_logo.png'
$outputDir = Join-Path $projectRoot 'store-assets'
[System.IO.Directory]::CreateDirectory($outputDir) | Out-Null

function New-Canvas([int]$width, [int]$height) {
  $bitmap = [System.Drawing.Bitmap]::new($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Save-Png($canvas, [string]$path) {
  $canvas.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Graphics.Dispose()
  $canvas.Bitmap.Dispose()
}

$source = [System.Drawing.Image]::FromFile($sourcePath)
try {
  $logo = New-Canvas 300 300
  $logo.Graphics.DrawImage($source, 0, 0, 300, 300)
  Save-Png $logo (Join-Path $outputDir 'requestpilot-logo-300.png')

  $small = New-Canvas 440 280
  $small.Graphics.Clear([System.Drawing.Color]::FromArgb(4, 17, 48))
  $small.Graphics.DrawImage($source, 24, 40, 200, 200)
  $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $blue = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(40, 170, 255))
  $titleFont = [System.Drawing.Font]::new('Segoe UI', 23, [System.Drawing.FontStyle]::Bold)
  $tagFont = [System.Drawing.Font]::new('Segoe UI', 11, [System.Drawing.FontStyle]::Regular)
  try {
    $small.Graphics.DrawString('RequestPilot', $titleFont, $white, 222, 92)
    $small.Graphics.DrawString('Test APIs faster', $tagFont, $blue, 225, 137)
  } finally {
    $white.Dispose()
    $blue.Dispose()
    $titleFont.Dispose()
    $tagFont.Dispose()
  }
  Save-Png $small (Join-Path $outputDir 'requestpilot-small-tile-440x280.png')

  $large = New-Canvas 1400 560
  $large.Graphics.Clear([System.Drawing.Color]::FromArgb(4, 17, 48))
  $large.Graphics.DrawImage($source, 80, 80, 400, 400)
  $largeWhite = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $largeBlue = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(40, 170, 255))
  $largeTitle = [System.Drawing.Font]::new('Segoe UI', 52, [System.Drawing.FontStyle]::Bold)
  $largeTag = [System.Drawing.Font]::new('Segoe UI', 25, [System.Drawing.FontStyle]::Regular)
  try {
    $large.Graphics.DrawString('RequestPilot', $largeTitle, $largeWhite, 535, 165)
    $large.Graphics.DrawString('Test APIs faster. Ship with confidence.', $largeTag, $largeBlue, 540, 270)
  } finally {
    $largeWhite.Dispose()
    $largeBlue.Dispose()
    $largeTitle.Dispose()
    $largeTag.Dispose()
  }
  Save-Png $large (Join-Path $outputDir 'requestpilot-large-tile-1400x560.png')
} finally {
  $source.Dispose()
}

Write-Host "Store assets generated in $outputDir"
