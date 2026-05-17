# Week 2 Deployment Runbook

**Target Deployment Window**: Week of 2026-05-24  
**Confidence Level**: HIGH 🟢  
**Rollback Plan**: Blue/green via Cloudflare

---

## Pre-Deployment Checklist (Do Before Merging to Main)

### Environment Verification
- [ ] GitHub Secrets configured (CLOUDFLARE_API_TOKEN, SUPABASE_SERVICE_ROLE_KEY, etc.)
- [ ] Production Cloudflare account verified
- [ ] Production Supabase project verified
- [ ] R2 buckets (covers, chapters) verified accessible
- [ ] D1 database (production) verified accessible
- [ ] Slack webhook configured for deployment notifications

### Code Review & Approval
- [ ] Commits reviewed by architecture team
- [ ] Breaking changes documented (API envelope migration)
- [ ] Database schema migration tested on staging
- [ ] Performance impact assessment completed
- [ ] Security audit passed (secrets scan clean)

### Testing Complete
- [ ] npm run lint ✅ (0 errors)
- [ ] npm run build ✅ (success)
- [ ] npm run check ✅ (success)
- [ ] Existing test suite ✅ (all pass)
- [ ] Pre-commit hooks working ✅
- [ ] Docker images validate ✅ (CI builds)

### Documentation Updated
- [ ] SECRETS.md reviewed (rotation policy in place)
- [ ] DATABASE_AUDIT_PROCEDURES.md executable
- [ ] Deployment procedures in this runbook
- [ ] Rollback procedures documented
- [ ] Team trained on new error envelope format

---

## Deployment Steps (Day 1: Main Branch Merge)

### Step 1: Merge to Main (9:00 AM)
```bash
# Create final PR review
# All checks pass
# Merge to main branch
# GitHub Actions automatically triggered on merge
```

**Expected**: GitHub Actions workflow starts validation job

---

### Step 2: Monitor GitHub Actions Validation (9:05-9:20 AM)
```bash
# Watch: https://github.com/Heizdoobert/Light-Story/actions
# Job: "Lint, Build, Test"
# Should complete in ~15 minutes
```

**Expected Stages**:
1. ✅ Setup Node.js 22
2. ✅ Install dependencies (cached)
3. ✅ Validate secrets (should pass - no hardcoded secrets)
4. ✅ npm run lint (0 errors)
5. ✅ npm run build (Next.js success)
6. ✅ npm run test:run (247 tests pass)
7. ✅ Docker builds (frontend + backend)

**If Fails**: See **Troubleshooting** section

---

### Step 3: Monitor GitHub Actions Deployment (9:25-9:45 AM)
```bash
# Job: "Deploy to Cloudflare"
# Requires: Validation job successful
# Runs only on: main branch pushes
```

**Expected Stages**:
1. ✅ Deploy API Gateway Worker
   ```bash
   npx wrangler deploy --config workers/api-gateway/wrangler.jsonc
   ```
   - Time: ~30-60s
   - Output: URL like `https://api.light-story.com`

2. ✅ Deploy 5 Domain Workers (parallel)
   ```bash
   - comics-worker
   - stories-worker
   - analytics-worker
   - admin-worker
   - r2-signed-url
   ```
   - Time: ~5-10s each
   - Total: ~20-30s

3. ✅ Run D1 Migrations (zero-downtime)
   ```bash
   npx wrangler migrations apply --remote
   ```
   - Time: Depends on schema changes (usually <30s)
   - **Critical**: Monitor for failures

4. ✅ Smoke Test (5 retries, 5s between attempts)
   ```bash
   curl -f https://api.light-story.com/health
   ```
   - Expected: HTTP 200 OK
   - Time: 0-30s (depends on retries needed)

5. ✅ Slack Notification
   - Success: ✅ "Deployment to production successful"
   - Failure: ❌ "Deployment to production failed!"

**Total Deployment Time**: ~3-5 minutes

---

## Post-Deployment Validation (9:50-10:30 AM)

### Step 1: Health Check
```bash
# Test API Gateway
curl -H "Authorization: Bearer test" https://api.light-story.com/health

# Expected Response:
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-05-24T09:50:00Z"
  },
  "timestamp": "2026-05-24T09:50:00Z"
}
```

### Step 2: Verify Workers are Responding
```bash
# Comics endpoint
curl https://api.light-story.com/api/comics

# Expected: ApiResponse<ComicsList> envelope
```

### Step 3: Database Audit
Execute `DATABASE_AUDIT_PROCEDURES.md`:
```bash
# Set environment variables
export SUPABASE_PROJECT_ID="..."
export SUPABASE_SERVICE_ROLE_KEY="..."
# ... (other vars)

# Run Supabase schema check
# Run D1 sync verification
# Run R2 alignment check
```

### Step 4: Frontend Verification
1. Open https://light-story.com
2. Verify homepage loads
3. Try authentication flow
4. Test comic reading interface
5. Check browser console (no errors)
6. Check network tab (ApiResponse<T> envelope in responses)

### Step 5: Monitor Error Logs
```bash
# Watch Cloudflare Dashboard
# - Worker logs
# - Error rates
# - Performance metrics

# Expected:
# - Error rate: <0.1%
# - Response time: <500ms median
# - No critical errors
```

---

## Rollback Plan (If Issues Detected)

### Automatic Rollback Triggers
**Deploy rollback if**:
- Smoke test fails after 5 retries
- API Gateway worker fails to deploy
- D1 migration fails
- Error rate > 5% for 2 minutes

### Manual Rollback Process
```bash
# Step 1: Stop traffic (Cloudflare)
# - Update DNS to point to previous workers
# - Or: Use route rules to disable new workers

# Step 2: Revert Workers
# - Deploy previous worker version tag
# - Or: `wrangler rollback`

# Step 3: Verify
# - Health check endpoint
# - Error rates drop

# Step 4: Investigate
# - Review error logs
# - Check D1 migration status
# - Review recent code changes
```

**Rollback Time**: ~5-10 minutes

---

## Troubleshooting Guide

### Issue: Validation Job Fails (npm run lint)

**Symptoms**: 
- GitHub Actions shows "Lint failed" 
- Error in TypeScript validation

**Resolution**:
```bash
# 1. Check error in Actions log
# 2. Identify file with error
# 3. Fix locally: npm run lint
# 4. Commit and push
# 5. GitHub Actions retriggers
```

**Prevention**: Ensure pre-commit hooks working locally

---

### Issue: Docker Build Fails

**Symptoms**:
- "Docker build failed" in Actions
- Multi-stage build errors

**Resolution**:
```bash
# 1. Check Dockerfile syntax
# 2. Verify base images available (node:22-alpine)
# 3. Check npm install in build stage
# 4. Review .dockerignore
```

**Prevention**: Review Dockerfile.frontend/backend before committing

---

### Issue: D1 Migration Fails

**Symptoms**:
- "D1 migration failed" in Actions logs
- API Gateway still works but data inconsistent

**Resolution**:
```bash
# 1. Check D1 migration status
npx wrangler d1 execute $DB_ID --remote "SELECT * FROM migrations;"

# 2. Manually apply migration if needed
npx wrangler d1 execute $DB_ID --remote < migration.sql

# 3. Verify schema integrity
npx wrangler d1 execute $DB_ID --remote ".schema"

# 4. Re-trigger deployment or rollback
```

**Prevention**: Test migrations on staging first

---

### Issue: Smoke Test Fails After Deployment

**Symptoms**:
- "Smoke test failed" after 5 retries
- API endpoint returns 404 or 500

**Resolution**:
```bash
# 1. Check API Gateway worker logs
# - Cloudflare Dashboard > Workers > API Gateway > Logs

# 2. Test manually
curl -v https://api.light-story.com/health

# 3. Check worker dependencies
# - Verify supabase-js client initialized
# - Verify D1 binding configured
# - Verify JWT validation passing

# 4. If healthy, retry deployment
# If not, trigger rollback
```

**Prevention**: Test API Gateway before deployment

---

### Issue: Frontend Not Loading (CORS)

**Symptoms**:
- Homepage loads but API calls fail (CORS error)
- Console shows "Access-Denied-by-Policy"

**Resolution**:
```bash
# 1. Check CORS headers in API Gateway
# - headers.set('Access-Control-Allow-Origin', '*')
# - headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE')

# 2. Check preflight handling
# - OPTIONS requests must return 200 + CORS headers

# 3. Update API Gateway if needed
# - Edit workers/api-gateway/src/index.ts
# - Add CORS middleware
# - Commit and redeploy
```

**Prevention**: CORS configured in deploy.yml validation

---

### Issue: ApiResponse Envelope Breaking Frontend

**Symptoms**:
- Frontend shows "Cannot read property 'data' of undefined"
- API calls fail despite valid responses

**Resolution**:
```bash
# 1. Check apiClient.ts unwrapping logic
// Should extract body.data correctly

# 2. Verify API returning ApiResponse format
// POST to /api/test should return:
// {
//   "success": true,
//   "data": { ... },
//   "timestamp": "..."
// }

# 3. Check compatibility layer if not updated
// Older endpoints may not use envelope yet

# 4. Update frontend error handling
// New envelope has error.details vs just message
```

**Prevention**: API client already updated in Week 1

---

## Success Criteria

Deployment is successful if ALL of the following are true:

- ✅ GitHub Actions validation job completes (green)
- ✅ GitHub Actions deployment job completes (green)
- ✅ Smoke test passes (200 OK)
- ✅ API Gateway responds to requests
- ✅ All 5 domain workers responding
- ✅ D1 migrations applied successfully
- ✅ Frontend homepage loads
- ✅ User can authenticate
- ✅ Comic reading interface works
- ✅ Error rates < 0.5%
- ✅ No console errors on frontend
- ✅ Slack notification: "Deployment successful"

---

## Communication Plan

### Before Deployment
- [ ] Email team: "Deployment scheduled for 9:00 AM"
- [ ] Slack: "#engineering: Deployment in progress"

### During Deployment
- [ ] Monitor GitHub Actions in #deployments Slack channel
- [ ] Post updates every 5 minutes if running longer than expected

### After Deployment
- [ ] Slack: "Deployment complete ✅"
- [ ] Post dashboard links to monitoring
- [ ] Schedule post-mortems if issues occur

### For Incidents
- [ ] Escalate to on-call engineer
- [ ] Trigger rollback if needed
- [ ] Post incident summary to #incidents

---

## Timeline Summary

| Time | Task | Duration | Owner |
|------|------|----------|-------|
| 9:00 | Merge to main | 1 min | DevOps |
| 9:01 | GitHub Actions validation starts | 15 min | CI/CD |
| 9:20 | Validation completes | - | - |
| 9:21 | Deployment job starts | 5 min | CI/CD |
| 9:25 | Deploy workers + migrate D1 | 2 min | - |
| 9:27 | Smoke test | 1 min | - |
| 9:28 | Deployment complete ✅ | - | - |
| 9:30-10:30 | Post-deployment validation | 60 min | QA/DevOps |

---

## Contacts & Escalation

| Role | Contact | Phone | Slack |
|------|---------|-------|-------|
| DevOps Lead | [Name] | [Phone] | @devops-lead |
| Architecture | [Name] | [Phone] | @tech-lead |
| On-Call | [Name] | [Phone] | @on-call |
| SRE | [Name] | [Phone] | @sre-team |

---

## Sign-Off

- [ ] DevOps: Reviewed and approved runbook
- [ ] Architecture: Approved deployment plan
- [ ] QA: Approved validation procedures
- [ ] Product: Notified of deployment

---

**Version**: 1.0  
**Last Updated**: 2026-05-17  
**Status**: READY FOR DEPLOYMENT  

