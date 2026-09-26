# tools/preview-app-icon.ps1
# Compone el icono adaptativo tal y como lo hara el launcher: capa de fondo
# (degradado) + capa de primer plano (PNG) recortadas con la mascara del
# launcher. Sirve para revisar el icono sin arrancar un emulador.
#
# Uso:  powershell -ExecutionPolicy Bypass -File tools/preview-app-icon.ps1
# Salida: icons/preview-adaptive.png  (y preview-legacy.png)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$Root = Split-Path -Parent $PSScriptRoot
$Res = Join-Path $Root 'android\app\src\main\res'

$Canvas = 432      # 108dp x 4 (xxxhdpi)
$Output = 192      # tamano de vista previa

$Deep = [System.Drawing.Color]::FromArgb(255, 5, 6, 10)
$PinkC = [System.Drawing.Color]::FromArgb(255, 255, 45, 117)
$BrandC = [System.Drawing.Color]::FromArgb(255, 123, 92, 255)

function New-Canvas([int]$w, [int]$h) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    [void]$bmp.SetResolution(96, 96)
    return ,$bmp
}

# ---- Capa 1: fondo (mismo degradado que drawable/ic_launcher_background.xml) ----
$Bg = New-Canvas $Canvas $Canvas
$bgG = [System.Drawing.Graphics]::FromImage($Bg)
$rect = New-Object System.Drawing.Rectangle(0, 0, $Canvas, $Canvas)
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $PinkC, $Deep, 45.0)
$mid = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $BrandC, $Deep, 45.0)
$bgG.FillRectangle($grad, $rect)
$grad.Dispose()
$mid.Dispose()
$bgG.Dispose()

# ---- Capa 2: primer plano generado por generate-app-icons.ps1 ----
$FgPath = Join-Path $Res 'mipmap-xxxhdpi\ic_launcher_foreground.png'
$Fg = [System.Drawing.Image]::FromFile($FgPath)

$Stack = New-Canvas $Canvas $Canvas
$sg = [System.Drawing.Graphics]::FromImage($Stack)
$sg.DrawImage($Bg, 0, 0, $Canvas, $Canvas)
$sg.DrawImage($Fg, 0, 0, $Canvas, $Canvas)
$sg.Dispose()
$Fg.Dispose()
$Bg.Dispose()

# ---- Mascara del launcher: circulo y squircle (adaptive) ----
function Save-Masked($source, [string]$path, [string]$shape) {
    $out = New-Canvas $Output $Output
    $g = [System.Drawing.Graphics]::FromImage($out)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $clip = New-Object System.Drawing.Drawing2D.GraphicsPath
    if ($shape -eq 'circle') {
        [void]$clip.AddEllipse(0, 0, $Output, $Output)
    } else {
        # squircle aproximado: rectangulo con esquinas muy redondeadas
        [void]$clip.AddArc(0, 0, $Output, $Output, 180, 90)
        [void]$clip.AddArc($Output - 1, 0, $Output, $Output, 270, 90)
        [void]$clip.AddArc($Output - 1, $Output - 1, $Output, $Output, 0, 90)
        [void]$clip.AddArc(0, $Output - 1, $Output, $Output, 90, 90)
        [void]$clip.CloseFigure()
    }
    $g.SetClip($clip)
    $g.DrawImage($source, 0, 0, $Output, $Output)
    $clip.Dispose()
    $g.Dispose()
    $out.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $out.Dispose()
}

$iconsDir = Join-Path $Root 'icons'
Save-Masked $Stack (Join-Path $iconsDir 'preview-adaptive.png') 'squircle'
$Stack.Dispose()

Write-Host 'Previsualizacion generada en icons/preview-adaptive.png' -ForegroundColor Green
