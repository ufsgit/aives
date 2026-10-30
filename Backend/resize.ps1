Add-Type -AssemblyName System.Drawing
$imgPath = 'C:\Users\SAPNA\Documents\GitHub\brooks\frontend\src\assets\images\aiveslogo.png'
$outPath = 'C:\Users\SAPNA\Documents\GitHub\brooks\backend\helpers\aiveslogo_small.png'
$img = [System.Drawing.Image]::FromFile($imgPath)
$ratio = 200 / $img.Width
$newHeight = [int]($img.Height * $ratio)
$bmp = New-Object System.Drawing.Bitmap 200, $newHeight
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, 0, 0, 200, $newHeight)
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$img.Dispose()
$g.Dispose()
