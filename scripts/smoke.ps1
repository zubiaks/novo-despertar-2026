# scripts/smoke.ps1
# Smoke test PowerShell: register -> login -> protected -> create article -> list articles -> upload (curl.exe)
# Ajusta variáveis abaixo conforme necessário antes de executar.

$base = "http://localhost:4000"
$email = "smoke+test@local"
$password = "Sm0keTest!23"
$imagePath = "$PSScriptRoot\fixtures\smoke.jpg"  # cria fixtures\smoke.jpg antes de correr
$headers = @{}

Write-Host "1) Register (may return 409 if user exists)"
try {
  $reg = Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType 'application/json' -Body (ConvertTo-Json @{ email=$email; password=$password })
  Write-Host " Registered:" $reg.id
} catch {
  Write-Warning "Register failed or user exists: $($_.Exception.Message)"
}

Write-Host "2) Login"
try {
  $login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' -Body (ConvertTo-Json @{ email=$email; password=$password })
  $token = $login.token
  if (-not $token) { throw "No token returned" }
  Write-Host " Token received"
  $headers = @{ Authorization = "Bearer $token" }
} catch {
  Write-Error "Login failed: $($_.Exception.Message)"
  exit 2
}

Write-Host "3) Protected route"
try {
  $p = Invoke-RestMethod -Method Get -Uri "$base/api/protected" -Headers $headers
  Write-Host " Protected OK:" ($p | ConvertTo-Json -Depth 2)
} catch {
  Write-Error "Protected route failed: $($_.Exception.Message)"
  exit 3
}

Write-Host "4) Create article"
$articleBody = @{
  title = "Smoke Test Article " + (Get-Date -Format "yyyyMMddHHmmss")
  excerpt = "Created by smoke test"
  body = "<p>Smoke test content</p>"
  theme = "test"
}
try {
  $created = Invoke-RestMethod -Method Post -Uri "$base/api/articles" -Headers $headers -ContentType 'application/json' -Body (ConvertTo-Json $articleBody)
  Write-Host " Article created:" $created.id
} catch {
  Write-Error "Create article failed: $($_.Exception.Message)"
  exit 4
}

Write-Host "5) List articles"
try {
  $list = Invoke-RestMethod -Method Get -Uri "$base/api/articles"
  Write-Host " Total articles:" $list.total
} catch {
  Write-Error "List articles failed: $($_.Exception.Message)"
  exit 5
}

Write-Host "6) Upload image (requires curl.exe on PATH)"
if (-Not (Test-Path $imagePath)) {
  Write-Warning "Image fixture not found at $imagePath — skipping upload test"
  exit 0
}
$curlCmd = "curl.exe -s -o /dev/null -w `"%{http_code}`" -X POST `"$base/api/upload`" -H `"Authorization: Bearer $token`" -F `"file=@$imagePath`""
try {
  $code = Invoke-Expression $curlCmd
  if ($code -eq "201") { Write-Host " Upload OK (201)"; exit 0 } else { Write-Warning " Upload returned HTTP $code"; exit 6 }
} catch {
  Write-Warning "Upload test failed: $($_.Exception.Message)"
  exit 6
}
