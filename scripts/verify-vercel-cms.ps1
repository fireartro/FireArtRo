param(
  [ValidateSet('development', 'preview', 'production')]
  [string]$Environment = 'preview'
)

# This reads only variable names from a project that the operator has already
# linked. It never pulls, prints, or writes secret values.
$required = @(
  'DB_NAME',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD_HASH',
  'ADMIN_SESSION_SECRET',
  'BLOB_READ_WRITE_TOKEN',
  'VERCEL_BLOB_MEDIA_ORIGIN'
)

$listing = & npx.cmd vercel@latest env ls $Environment 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
  Write-Error 'Nu s-a putut citi lista de nume Vercel. Verifică autentificarea și legătura proiectului.'
  exit 1
}

$missing = @($required | Where-Object { $listing -notmatch [regex]::Escape($_) })
$mongoNames = @('MONGODB_URI', 'MONGO_MONGODB_URI', 'MONGO_URL')
if (-not ($mongoNames | Where-Object { $listing -match [regex]::Escape($_) })) {
  $missing = @('MONGODB_URI (sau variabila Atlas furnizată de Vercel)') + $missing
}
if ($missing.Count -gt 0) {
  Write-Error ('Lipsesc variabile Vercel: ' + ($missing -join ', '))
  exit 1
}

Write-Output "Numele variabilelor CMS sunt prezente pentru mediul $Environment."
