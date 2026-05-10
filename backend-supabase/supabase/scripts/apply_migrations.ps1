Param(
  [string]$MigrationsFolder = "./migrations",
  [string]$SupabaseUrl = $env:SUPABASE_URL,
  [string]$ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY
)

if (-not $SupabaseUrl -or -not $ServiceRoleKey) {
  Write-Error "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables before running."
  exit 1
}

Write-Output "Applying SQL migrations from $MigrationsFolder"

Get-ChildItem -Path $MigrationsFolder -Filter *.sql | Sort-Object Name | ForEach-Object {
  $file = $_.FullName
  Write-Output "Applying $file"
  $sql = Get-Content $file -Raw
  $resp = Invoke-RestMethod -Method Post -Uri "$SupabaseUrl/rest/v1/rpc/sql" -Headers @{ "apikey" = $ServiceRoleKey; "Authorization" = "Bearer $ServiceRoleKey" } -Body @{ q = $sql } -ContentType 'application/json'
  Write-Output "Result: $($resp | ConvertTo-Json -Depth 2)"
}

Write-Output "Done. Verify migration results in your Supabase dashboard or via psql."
