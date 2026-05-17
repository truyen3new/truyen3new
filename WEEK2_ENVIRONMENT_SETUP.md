# Week 2 Environment Setup & Validation Guide

**Purpose**: Prepare production environment for May 24 deployment  
**Timeline**: May 18-22, 2026  
**Owner**: DevOps Lead  
**Status**: READY TO EXECUTE  

---

## Overview

This guide ensures all infrastructure, secrets, and team access are configured before deployment day (May 24). Follow sequentially.

---

## Phase 1: Infrastructure Verification (May 18-19)

### 1.1 Cloudflare Account Access

**Steps**:
```bash
# Verify account access
curl -X GET "https://api.cloudflare.com/client/v4/user" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "result": {
    "id": "<user_id>",
    "email": "<email>",
    "status": "active"
  }
}
```

**Verification Checklist**:
- [ ] HTTP 200 response
- [ ] Account status: "active"
- [ ] User email matches expected admin
- [ ] Token permissions: can manage workers, KV, D1

**Document**:
- [ ] Cloudflare Account ID: _______________
- [ ] Verified by: _______________
- [ ] Date: _______________

### 1.2 Production Workers Deployment Target

**Steps**:
```bash
# List current workers
wrangler deployments list --name api-gateway
```

**Expected**: Shows existing worker deployment history

**Steps**:
```bash
# Verify worker routes configured
curl -s https://comics.example.com/api/health | jq .
```

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-05-18T10:00:00Z"
}
```

**Verification Checklist**:
- [ ] Current worker deployed
- [ ] Health endpoint responding
- [ ] Worker routes configured in Cloudflare dashboard
- [ ] Custom domain pointing to worker

**Document**:
- [ ] Current worker version: _______________
- [ ] Deployment status: _______________
- [ ] Last deployment date: _______________
- [ ] Verified by: _______________

### 1.3 Cloudflare D1 Database Access

**Steps**:
```bash
# List databases
wrangler d1 list
```

**Expected**: Shows production D1 database

**Steps**:
```bash
# Test database connection
wrangler d1 execute production --command "SELECT COUNT(*) as total_profiles FROM profiles;"
```

**Expected Response**:
```
┌────────────────────┐
│ total_profiles     │
├────────────────────┤
│ <number>           │
└────────────────────┘
```

**Verification Checklist**:
- [ ] D1 database listed
- [ ] Database accessible via wrangler
- [ ] SELECT queries returning data
- [ ] 6 core tables present (profiles, comics, chapters, stories, reading_progress, analytics_events)
- [ ] Migration history shows all previous versions

**Document**:
- [ ] Database ID: _______________
- [ ] Profile count: _______________
- [ ] Latest migration: _______________
- [ ] Verified by: _______________

### 1.4 Cloudflare R2 Storage Access

**Steps**:
```bash
# List R2 buckets
wrangler r2 bucket list
```

**Expected**: Shows production buckets (r2-covers, r2-chapters)

**Steps**:
```bash
# Test bucket read access
wrangler r2 object get r2-covers/test-key

# Test bucket write access (create test file)
echo "test" > test.txt
wrangler r2 object put r2-covers/test-deployment-$(date +%s).txt test.txt
rm test.txt
```

**Expected**: Write succeeds, file uploaded

**Verification Checklist**:
- [ ] Both buckets exist and listed
- [ ] Read permissions working
- [ ] Write permissions working
- [ ] Bucket policies configured correctly
- [ ] CORS enabled for frontend domain

**Document**:
- [ ] Covers bucket: _______________
- [ ] Chapters bucket: _______________
- [ ] Write test file path: _______________
- [ ] Verified by: _______________

### 1.5 Supabase Project Connection

**Steps**:
```bash
# Test Supabase project access
curl -s "https://<project-id>.supabase.co/rest/v1/profiles?limit=1" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

**Expected Response**: Returns profiles data or empty array

**Steps**:
```bash
# Verify RLS policies active
curl -s "https://<project-id>.supabase.co/rest/v1/profiles" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $(echo -n "test_user" | base64)" | head -5
```

**Verification Checklist**:
- [ ] Project URL responding
- [ ] RLS policies enforced (auth required)
- [ ] Public schema accessible
- [ ] All tables present
- [ ] CORS origins configured

**Document**:
- [ ] Project ID: _______________
- [ ] Project URL: _______________
- [ ] RLS status: _______________
- [ ] Verified by: _______________

---

## Phase 2: GitHub Configuration (May 19-20)

### 2.1 Repository Branch Protection

**Steps**:
1. Go to repository Settings → Branches
2. Find branch rule for `main`
3. Verify settings:

**Checklist**:
- [ ] Require pull request reviews before merging (2 approvals)
- [ ] Require status checks to pass before merging
- [ ] Require branches to be up to date before merging
- [ ] Include administrators in restrictions
- [ ] Allow auto-merge: DISABLED (manual only)

**Document**:
- [ ] Branch protection rule verified: ✓
- [ ] Verified by: _______________
- [ ] Date: _______________

### 2.2 GitHub Secrets Configuration

**Critical**: All 6 secrets must be configured before deployment

**Steps**:
1. Go to repository Settings → Secrets and variables → Actions
2. Create each secret below

**Required Secrets**:

| Secret Name | Source | Value Format | Rotation | Status |
|------------|--------|--------------|----------|--------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare Dashboard | Bearer token | 90 days | [ ] ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings | JWT token | 180 days | [ ] ✓ |
| `OPENAI_API_KEY` | OpenAI Platform | sk-... | 90 days | [ ] ✓ |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 API Token | Alphanumeric | 365 days | [ ] ✓ |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 API Token | Base64 | 365 days | [ ] ✓ |
| `SLACK_WEBHOOK` | Slack App Manifest | https://hooks.slack.com/... | 180 days | [ ] ✓ |

**Verification Steps** (for each secret):
```bash
# Retrieve secret metadata (GitHub CLI)
gh secret list -R owner/repo | grep CLOUDFLARE_API_TOKEN

# Expected output:
# CLOUDFLARE_API_TOKEN     Updated 2026-05-19
```

**Checklist**:
- [ ] All 6 secrets visible in GitHub UI
- [ ] Each secret marked "Updated 2026-05-19" or later
- [ ] No typos in secret names
- [ ] No duplicate secrets with different names
- [ ] Secrets not committed to repo (verify with `git log --all -S 'CLOUDFLARE_API_TOKEN'` returns nothing)

**Verification Workflow**:

Create test workflow `.github/workflows/verify-secrets.yml`:
```yaml
name: Verify Secrets
on: workflow_dispatch
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - name: Test Cloudflare API Token
        run: |
          curl -s -X GET "https://api.cloudflare.com/client/v4/user" \
            -H "Authorization: Bearer ${{ secrets.CLOUDFLARE_API_TOKEN }}" \
            -H "Content-Type: application/json" | jq '.success'
      - name: Test Supabase Key
        run: |
          echo "Supabase key length: $(echo -n '${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}' | wc -c)"
```

Run this workflow manually to verify all secrets are accessible.

**Document**:
- [ ] All 6 secrets configured
- [ ] Verification workflow passed
- [ ] No secrets leaked in code
- [ ] Verified by: _______________
- [ ] Date: _______________

### 2.3 GitHub Actions Workflow Validation

**Steps**:
1. Go to repository → Actions tab
2. Find workflow: `.github/workflows/deploy.yml`
3. Verify configuration:

**Checklist**:
- [ ] Workflow file syntax valid (no errors in Actions UI)
- [ ] Triggers configured: `push` to `main`, `pull_request`
- [ ] Jobs defined: `validate`, `deploy`
- [ ] Deploy job conditional on validate success: `needs: validate`
- [ ] All environment variables defined
- [ ] No syntax errors (green checkmark on workflow file)

**Run Validation-Only Test**:
```bash
# Create PR to trigger validation without deploying
git checkout -b test/validation-workflow
echo "# Test" > TEST.md
git add TEST.md
git commit -m "test: trigger validation workflow"
git push origin test/validation-workflow
```

Wait for Actions to run validation (lint, build, test, docker). Should pass without deploying.

**Expected**: Validation job passes, deploy job skipped (requires `main` branch)

**Cleanup**:
```bash
# Delete test branch after validation passes
git push origin --delete test/validation-workflow
```

**Document**:
- [ ] Workflow syntax valid
- [ ] Validation test passed
- [ ] Deploy job conditional working
- [ ] Verified by: _______________
- [ ] Date: _______________

---

## Phase 3: Team Readiness (May 20-21)

### 3.1 Stakeholder Sign-Off

**Required Approvals**:

| Role | Name | Email | Slack | Sign-Off Date | Status |
|------|------|-------|-------|---------------|--------|
| Architecture Lead | __________ | __________ | __________ | __________ | [ ] |
| DevOps Lead | __________ | __________ | __________ | __________ | [ ] |
| QA Lead | __________ | __________ | __________ | __________ | [ ] |
| Product Manager | __________ | __________ | __________ | __________ | [ ] |

**Sign-Off Template** (send to each):
```
Subject: Production Deployment Approval Needed - May 24

Hi [Role],

We're scheduling a production deployment for Monday, May 24, 2026 at 9:00 AM UTC.

Scope:
- Frontend Next.js app (multi-stage Docker, 187 MB)
- Backend API Gateway + 5 Cloudflare Workers (156 MB)
- D1 database migrations (zero-downtime)
- 100% test pass rate, 82% code coverage

Breaking Change:
- All API responses now wrapped in ApiResponse<T> envelope
- Frontend already updated to unwrap (apiClient.ts)

Timeline:
- 9:00 AM: Merge to main
- 9:05-9:20 AM: Validation (lint/build/test/docker)
- 9:25-9:45 AM: Deploy + migrations + smoke tests
- 9:45-10:30 AM: Post-deployment validation
- Total: ~1.5 hours

Can you sign off by May 23, 5:00 PM? Reply "APPROVED" or "BLOCKED <reason>"

Critical items:
- GitHub Secrets configured (6 required)
- Infrastructure pre-flight complete
- Team on-call for any issues

Thanks,
Deployment Lead
```

**Checklist**:
- [ ] Architecture Lead approved
- [ ] DevOps Lead approved
- [ ] QA Lead approved
- [ ] Product Manager approved
- [ ] All sign-offs received before May 23, 5:00 PM

**Document**:
- [ ] Architecture approval date: _______________
- [ ] DevOps approval date: _______________
- [ ] QA approval date: _______________
- [ ] Product approval date: _______________

### 3.2 On-Call Assignment

**Steps**:
1. Assign on-call coverage for May 24, 9:00 AM - 12:00 PM (3 hours)
2. Verify each person has:
   - Slack notifications enabled
   - Phone number in contact list
   - Access to production Cloudflare/Supabase/GitHub
   - Rollback procedures documented

**On-Call Team**:

| Role | Primary | Backup | Phone | Slack Handle |
|------|---------|--------|-------|--------------|
| Deployment Lead | __________ | __________ | __________ | __________ |
| Infrastructure | __________ | __________ | __________ | __________ |
| Backend (API) | __________ | __________ | __________ | __________ |
| Frontend | __________ | __________ | __________ | __________ |
| Database (D1) | __________ | __________ | __________ | __________ |

**Confirmation Checklist**:
- [ ] All on-call team confirmed available
- [ ] Contact list updated
- [ ] Slack channel created: #deployment-may24
- [ ] Calendar invites sent
- [ ] Rollback procedures reviewed with team

**Document**:
- [ ] On-call team assigned: ✓
- [ ] Team briefing completed: [ ] (May 23, 3:00 PM)
- [ ] Verified by: _______________

### 3.3 Communication Plan

**Pre-Deployment (May 23)**:
- [ ] Send Slack announcement: "Deployment scheduled for May 24, 9:00 AM"
- [ ] Pin deployment runbook in #deployments channel
- [ ] Send email to team: "Please avoid merging to main May 24, 9:00-10:30 AM"
- [ ] Post in standups: "Deployment happening tomorrow"

**During Deployment (May 24, 9:00 AM)**:
- [ ] Post Slack message: "Deployment starting now"
- [ ] Update Slack status: "🚀 Deploying to production"
- [ ] Real-time updates every 5 minutes
- [ ] Post each milestone (validation, workers, migrations, tests)

**Post-Deployment (May 24, 10:30 AM)**:
- [ ] Post: "Deployment complete ✅"
- [ ] Include: Success metrics, deployment time, commits deployed
- [ ] Send email: "Production deployment successful - all systems nominal"
- [ ] Create incident ticket: "Deployment - May 24" (for historical tracking)

**If Issues**:
- [ ] Immediate Slack alert: "🔴 Deployment issue detected"
- [ ] PagerDuty incident: Create immediately
- [ ] Page oncall team
- [ ] Real-time updates to #incidents

**Checklist**:
- [ ] Communication template prepared
- [ ] Slack channels ready (#deployments, #incidents)
- [ ] Email template drafted
- [ ] Team notified of communication plan

---

## Phase 4: Final Pre-Deployment Checklist (May 23, 5:00 PM)

### 4.1 Code Readiness
- [ ] All commits in feature branch
- [ ] Code review approved (2+ approvals)
- [ ] No merge conflicts with main
- [ ] npm run lint: 0 errors
- [ ] npm run build: Success
- [ ] npm run test: All pass
- [ ] No hardcoded secrets in code
- [ ] Breaking changes documented

**Owner**: Architecture Lead  
**Sign-off**: _______________

### 4.2 Infrastructure Readiness
- [ ] Cloudflare account active & accessible
- [ ] Production Supabase project ready
- [ ] D1 database accessible
- [ ] R2 buckets ready
- [ ] Worker routes configured
- [ ] CORS enabled
- [ ] Rate limiting configured
- [ ] Monitoring dashboards open

**Owner**: DevOps Lead  
**Sign-off**: _______________

### 4.3 GitHub & Secrets Readiness
- [ ] All 6 GitHub Secrets configured
- [ ] Secret values verified (curl tests passed)
- [ ] Branch protection rules enforced
- [ ] Workflow file syntax valid
- [ ] Validation workflow passed (PR test)
- [ ] Main branch is clean (no uncommitted changes)

**Owner**: DevOps Lead  
**Sign-off**: _______________

### 4.4 Team Readiness
- [ ] Architecture sign-off: APPROVED
- [ ] DevOps sign-off: APPROVED
- [ ] QA sign-off: APPROVED
- [ ] Product sign-off: APPROVED
- [ ] On-call team assigned & confirmed
- [ ] Communication plan distributed
- [ ] Runbook reviewed with team

**Owner**: Deployment Lead  
**Sign-off**: _______________

### 4.5 Documentation Readiness
- [ ] Deployment Runbook: Ready
- [ ] Critical Path Checklist: Ready
- [ ] Rollback Procedures: Reviewed
- [ ] Incident Response: Reviewed
- [ ] Post-Deployment Validation: Ready
- [ ] Status Dashboard: Updated

**Owner**: Deployment Lead  
**Sign-off**: _______________

---

## GO/NO-GO Decision (May 23, 6:00 PM)

**Decision Criteria**:
- All Phase 1-4 items: ✓ COMPLETE
- All 4 team approvals: ✓ RECEIVED
- All GitHub Secrets: ✓ CONFIGURED
- Monitoring dashboards: ✓ OPEN
- On-call team: ✓ CONFIRMED
- Communication plan: ✓ DISTRIBUTED

**Decision Options**:

### GO ✅
- [ ] All criteria met
- [ ] Decision: APPROVE DEPLOYMENT
- [ ] Action: Schedule merge for May 24, 9:00 AM
- [ ] Notify team: "DEPLOYMENT GREEN - GO FOR LAUNCH"

### CONDITIONAL GO 🟡
- [ ] Minor issues identified, but containable
- [ ] Decision: APPROVE with conditions
- [ ] Actions: Define remediation plan, schedule follow-up
- [ ] Example: "GitHub Secrets need 2 more added - will do May 24, 8:30 AM"

### NO-GO 🔴
- [ ] Blocking issues found
- [ ] Decision: RESCHEDULE DEPLOYMENT
- [ ] Action: Move to fallback date (May 25 or May 26)
- [ ] Root cause: _______________
- [ ] Resolution: _______________
- [ ] New deployment date: _______________

**Final Decision**:

```
DATE: _______________
DECISION: [ ] GO  [ ] CONDITIONAL GO  [ ] NO-GO
APPROVED BY: _______________ (Deployment Lead)
WITNESSED BY: _______________ (Architecture), _______________ (DevOps)
TIMESTAMP: _______________
```

---

## Deployment Day (May 24, 8:00 AM)

### 30 Minutes Before (8:30 AM)

**Final Checks**:
- [ ] Team members online and available
- [ ] Monitoring dashboards open
- [ ] Slack channels active
- [ ] On-call contact list verified
- [ ] GitHub ready to merge

**Team Sync** (Brief standup):
- Deployment Lead: "Everyone ready?"
- Architecture: "Ready ✓"
- DevOps: "Ready ✓"
- QA: "Ready ✓"
- Product: "Ready ✓"

**Decision**: "Proceeding with deployment at 9:00 AM"

### Deployment Window (9:00 AM)

See: **WEEK2_CRITICAL_PATH_CHECKLIST.md** for step-by-step execution

---

## Post-Deployment (May 24, 10:30 AM+)

### Immediate (10:30-11:00 AM)
- [ ] All validation criteria passed
- [ ] Team sign-off obtained
- [ ] Production monitoring clean
- [ ] Slack notification sent: "Deployment successful ✅"

### Same Day (11:00 AM - 5:00 PM)
- [ ] Error monitoring (< 0.5%)
- [ ] User feedback collection
- [ ] Database audit (optional)
- [ ] Team retrospective (brief)

### Week-Long Monitoring (May 24-31)
- [ ] Daily check-in: "All systems nominal"
- [ ] Weekly metrics review
- [ ] No-regress validation
- [ ] User acceptance testing

---

## Sign-Off Sheet

```
DEPLOYMENT: May 24, 2026, 9:00 AM UTC
PROJECT: Light-Story (Master System Audit + Week 1 Implementation)
VERSION: 1.0 (Production Release)

INFRASTRUCTURE VERIFIED:
  [ ] Cloudflare Account: _________________ (Date)
  [ ] D1 Database: _________________ (Date)
  [ ] R2 Buckets: _________________ (Date)
  [ ] Supabase Project: _________________ (Date)

GITHUB CONFIGURED:
  [ ] All 6 Secrets: _________________ (Date)
  [ ] Workflow Valid: _________________ (Date)
  [ ] Branch Protection: _________________ (Date)

TEAM APPROVED:
  [ ] Architecture Lead: _________________ (Date)
  [ ] DevOps Lead: _________________ (Date)
  [ ] QA Lead: _________________ (Date)
  [ ] Product Manager: _________________ (Date)

READY FOR DEPLOYMENT: [ ] YES

Final Approval Signature: _________________
Title: _________________
Date: _________________
Time: _________________
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-17  
**Status**: READY FOR PHASE 1 EXECUTION  
**Next**: Begin Phase 1 (May 18)

