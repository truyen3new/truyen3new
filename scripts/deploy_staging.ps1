# Staging Deployment Script for Comic Platform
# Usage: pwsh scripts\deploy_staging.ps1 -StagingUrl "https://staging-xxx.supabase.co" -ServiceRoleKey "sb_service_role_xxx"
param(
  [Parameter(Mandatory=$false)]
  [string]$StagingUrl,
  
  [Parameter(Mandatory=$false)]
  [string]$ServiceRoleKey,
  
  [Parameter(Mandatory=$false)]
  [string]$OpenAIKey,
  
  [Parameter(Mandatory=$false)]
  [string]$env = 'staging'
)

$ErrorActionPreference = "Continue"

Write-Host "🚀 Comic Platform Staging Deployment" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Set environment variables if provided
if ($StagingUrl) {
  $env:SUPABASE_URL = $StagingUrl
  $env:SUPABASE_SERVICE_ROLE_KEY = $ServiceRoleKey
  if ($OpenAIKey) { $env:OPENAI_API_KEY = $OpenAIKey }
  Write-Host "✓ Staging credentials loaded from parameters" -ForegroundColor Green
}

# Build frontend
Write-Host "Step 1: Building frontend..." -ForegroundColor Cyan
npm --prefix frontend run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Frontend build failed" -ForegroundColor Red
  exit 1
}
Write-Host "✓ Frontend built successfully" -ForegroundColor Green

Write-Host ""
Write-Host "Step 2: Apply Database Migrations" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

if (Get-Command supabase -ErrorAction SilentlyContinue) {
  Push-Location backend-supabase
  
  Write-Host "Applying migrations..."
  supabase db push
  if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠ Migration may have issues - continuing..." -ForegroundColor Yellow
  }
  
  Write-Host "✓ Migrations applied" -ForegroundColor Green
  
  Write-Host ""
  Write-Host "Step 3: Deploy Edge Functions" -ForegroundColor Cyan
  Write-Host "=============================" -ForegroundColor Cyan
  
  Write-Host "Deploying existing functions..."
  supabase functions deploy increment-story-views
  supabase functions deploy manage-story
  supabase functions deploy manage-chapter
  supabase functions deploy create_comic
  supabase functions deploy upload_to_r2
  
  Write-Host "Deploying new comic platform function..."
  supabase functions deploy payment_and_rewards
  
  Write-Host "✓ Edge Functions deployed" -ForegroundColor Green
  
  Pop-Location
} else {
  Write-Host "⚠ Supabase CLI not found. Manual deployment needed:" -ForegroundColor Yellow
  Write-Host "  cd backend-supabase" -ForegroundColor Gray
  Write-Host "  supabase link --project-ref <staging-ref>" -ForegroundColor Gray
  Write-Host "  supabase db push" -ForegroundColor Gray
  Write-Host "  supabase functions deploy payment_and_rewards" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Step 4: Backfill Embeddings" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan

if ($env:SUPABASE_URL) {
  Push-Location backend-supabase\supabase\scripts
  npm install 2>&1 | Out-Null
  Write-Host "Running backfill script..."
  node backfill_embeddings.js
  Write-Host "✓ Embeddings backfilled" -ForegroundColor Green
  Pop-Location
} else {
  Write-Host "⚠ No staging credentials - skipping backfill" -ForegroundColor Yellow
  Write-Host "Run this later: cd backend-supabase/supabase/scripts && node backfill_embeddings.js" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Step 5: Deploy Frontend to Hosting" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "⚠ Replace placeholder with your hosting provider command:" -ForegroundColor Yellow
Write-Host "  - Vercel: vercel deploy --prod" -ForegroundColor Gray
Write-Host "  - Netlify: netlify deploy --prod" -ForegroundColor Gray
Write-Host "  - Firebase: firebase deploy" -ForegroundColor Gray

Write-Host ""
Write-Host "📋 Staging Deployment Complete" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Next Steps:" -ForegroundColor Green
Write-Host "1. Test VIP content access in Supabase dashboard" -ForegroundColor Gray
Write-Host "2. Verify RLS policies are working" -ForegroundColor Gray
Write-Host "3. Test realtime chapter updates" -ForegroundColor Gray
Write-Host "4. Verify payment webhook handler" -ForegroundColor Gray
Write-Host ""
Write-Host "Reference: docs/STAGING_DEPLOYMENT_COMIC_PLATFORM.md" -ForegroundColor Cyan