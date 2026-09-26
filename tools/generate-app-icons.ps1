# tools/generate-app-icons.ps1
# Genera los iconos de X-STORE para Android a partir de la identidad visual
# de la app: fondo #05060A, degradado de marca #7B5CFF -> #FF2D75, "X" blanca
# y punto lila de "en vivo".
#
# Uso:  powershell -ExecutionPolicy Bypass -File tools/generate-app-icons.ps1
# Sin dependencias externas: solo System.Drawing de Windows.
#
# No toca splash.xml ni ningun recurso que ya exista con ese nombre.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$Root = Split-Path -Parent $PSScriptRoot
$Res = Join-Path $Root 'android\app\src\main\res'

$Dark = [System.Drawing.Color]::FromArgb(255, 5, 6, 10)
$Deep = [System.Drawing.Color]::FromArgb(255, 91, 33, 182)   # #5B21B6
$Brand = [System.Drawing.Color]::FromArgb(255, 123, 92, 255)
$Lilac = [System.Drawing.Color]::FromArgb(255, 217, 70, 239)
$Pink = [System.Drawing.Color]::FromArgb(255, 255, 45, 117)

function New-Bitmap([int]$w, [int]$h) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    [void]$bmp.SetResolution(96, 96)
    return ,$bmp
}

function New-BrandBackground([int]$size) {
    $bmp = New-Bitmap $size $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $Dark, $Deep, 45.0)
    [void]$g.FillRectangle($brush, $rect)
    $brush.Dispose()

    # Resplandor lila en la esquina superior derecha: evoca el "en vivo".
    $halo = New-Object System.Drawing.Drawing2D.GraphicsPath
    [void]$halo.AddEllipse(
        [int]($size * 0.42), [int](-$size * 0.18),
        [int]($size * 0.78), [int]($size * 0.78)
    )
    $hbrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($halo)
    $hbrush.CenterColor = [System.Drawing.Color]::FromArgb(150, 217, 70, 239)
    $hbrush.SurroundColors = [System.Drawing.Color[]]@([System.Drawing.Color]::FromArgb(0, 217, 70, 239))
    [void]$g.FillPath($hbrush, $halo)
    $hbrush.Dispose()
    $halo.Dispose()
    $g.Dispose()
    return ,$bmp
}

# Dibuja la "X" de la marca centrada en (cx, cy) con longitud y grosor dados.
function Draw-Logo($g, [double]$cx, [double]$cy, [double]$len, [double]$bar, $color) {
    $pen = New-Object System.Drawing.Pen($color, [single]$bar)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $off = $len * 0.29
    [void]$g.DrawLine($pen, [single]($cx - $off), [single]($cy - $off), [single]($cx + $off), [single]($cy + $off))
    [void]$g.DrawLine($pen, [single]($cx + $off), [single]($cy - $off), [single]($cx - $off), [single]($cy + $off))
    $pen.Dispose()
}

function Save-Scaled([System.Drawing.Image]$source, [string]$path, [int]$size) {
    $out = New-Bitmap $size $size
    $g = [System.Drawing.Graphics]::FromImage($out)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    [void]$g.DrawImage($source, 0, 0, $size, $size)
    $g.Dispose()
    $out.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $out.Dispose()
}

# ------------------------------------------------------------------
# 1) Lienzo maestro 512: fondo + X + punto lila + marca de texto
# ------------------------------------------------------------------
$Master = 512
$Boot = New-BrandBackground $Master
$g = [System.Drawing.Graphics]::FromImage($Boot)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

Draw-Logo $g 256 244 214 74 ([System.Drawing.Color]::White)

# Subrayado de marca: degradado lila -> rosa bajo el nombre.
$barRect = New-Object System.Drawing.Rectangle(176, 458, 160, 10)
$barBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($barRect, $Lilac, $Pink, 0.0)
$barPath = New-Object System.Drawing.Drawing2D.GraphicsPath
[void]$barPath.AddArc($barRect, 180, 180)
$barPath.Dispose()
[void]$g.FillRectangle($barBrush, $barRect)
$barBrush.Dispose()

# Texto de marca centrado sobre el subrayado.
$font = New-Object System.Drawing.Font('Arial', 27, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(240, 255, 255, 255))
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = [System.Drawing.StringAlignment]::Center
$fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
$fmt.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap
[void]$g.DrawString('X-STORE', $font, $textBrush, (New-Object System.Drawing.RectangleF(0, 392, [single]$Master, 50)), $fmt)
$font.Dispose()
$textBrush.Dispose()
$fmt.Dispose()
$g.Dispose()

# ------------------------------------------------------------------
# 2) Foreground adaptativo: lienzo 108dp con la marca en la zona segura 66%
# ------------------------------------------------------------------
$Adaptive = 432   # 108dp x 4
$Safe = 288       # 72dp x 4
$offset = [int](($Adaptive - $Safe) / 2)

# Ojo: en PowerShell los nombres de variable NO distinguen mayusculas, asi que
# el lienzo del foreground y su contexto de graficos usan nombres distintos.
$Foreground = New-Bitmap $Adaptive $Adaptive
$fgCanvas = [System.Drawing.Graphics]::FromImage($Foreground)
$fgCanvas.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$fgCanvas.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$fgBg = New-BrandBackground $Safe
$clip = New-Object System.Drawing.Drawing2D.GraphicsPath
[void]$clip.AddEllipse($offset, $offset, $Safe, $Safe)
$fgCanvas.SetClip($clip)
[void]$fgCanvas.DrawImage($fgBg, $offset, $offset, $Safe, $Safe)
$fgCanvas.ResetClip()
$fgBg.Dispose()
$clip.Dispose()

Draw-Logo $fgCanvas ($Adaptive / 2) ($Adaptive / 2) 186 66 ([System.Drawing.Color]::White)

$fgCanvas.Dispose()

# ------------------------------------------------------------------
# 3) Escritura de todas las densities
# ------------------------------------------------------------------
$sizes = [ordered]@{
    'mdpi'    = 48
    'hdpi'    = 72
    'xhdpi'   = 96
    'xxhdpi'  = 144
    'xxxhdpi' = 192
}

foreach ($density in $sizes.Keys) {
    $dir = Join-Path $Res "mipmap-$density"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $px = $sizes[$density]

    # Icono legado (Android 7 y anterior): diseño completo.
    Save-Scaled $Boot (Join-Path $dir 'ic_launcher.png') $px

    # Icono redondo: mismo diseño recortado en circulo.
    $round = New-Bitmap $px $px
    $rg = [System.Drawing.Graphics]::FromImage($round)
    $rg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $rg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $rclip = New-Object System.Drawing.Drawing2D.GraphicsPath
    [void]$rclip.AddEllipse(0, 0, $px, $px)
    $rg.SetClip($rclip)
    [void]$rg.DrawImage($Boot, 0, 0, $px, $px)
    $rclip.Dispose()
    $rg.Dispose()
    $round.Save((Join-Path $dir 'ic_launcher_round.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $round.Dispose()

    # Foreground adaptativo: 108dp = 2.25x el tamano visible del icono.
    $adaptivePx = [int]($px * 108 / 48)
    Save-Scaled $Foreground (Join-Path $dir 'ic_launcher_foreground.png') $adaptivePx
}

# Iconos web reutilizables (PWA / web).
$iconsDir = Join-Path $Root 'icons'
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null
Save-Scaled $Boot (Join-Path $iconsDir 'app-icon-512.png') 512
Save-Scaled $Boot (Join-Path $iconsDir 'app-icon-192.png') 192

$Foreground.Dispose()
$Boot.Dispose()
Write-Host 'Iconos de X-STORE generados en android/app/src/main/res/mipmap-*' -ForegroundColor Green
