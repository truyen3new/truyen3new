# Monitoring & Post-Deployment Checks

This document lists monitoring checks to verify after staging or production deploy.

1. Error Tracking
- Install Sentry (or preferred) and configure DSN in staging env.
- Verify that uncaught exceptions are captured by `useGlobalErrorHandler`.

2. Performance Metrics
- Track Core Web Vitals via RUM (CLS, LCP, FID/INP)
- Verify average First Contentful Paint and Time to Interactive for reader pages

3. Custom Health Checks
- Endpoint: `/health` returns 200 with DB connectivity status
- RPC health check: call `increment_story_views` in a dry-run mode (test request id) and verify idempotency

4. Alerts
- Error rate spike > 5% over baseline in 5 minutes → Pager on-call
- LCP regression > 20% over baseline → Notify frontend

5. Post-deploy Validation
- Run `docs/AUDIT_VALIDATION.md` after deploy and archive results in CI artifacts
