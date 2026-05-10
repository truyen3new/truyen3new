# Cloudflare Analytics Aggregator Worker

## Overview

This Cloudflare Worker aggregates infrastructure metrics from:
- **D1**: Database query counts and latency
- **R2**: Storage usage, object count, egress
- **Cloudflare Analytics Engine**: Page views, bandwidth, cache hit ratio, device distribution

The worker is called by the Light Story analytics dashboard to fetch real-time infrastructure metrics.

## Deployment

### Prerequisites

1. Cloudflare account with:
   - D1 database access
   - R2 bucket access
   - Analytics API access
   - API token with read permissions

2. `wrangler` CLI installed globally:
   ```bash
   npm install -g wrangler
   ```

### Step 1: Configure Credentials

Set your Cloudflare credentials in the environment:

```bash
export CLOUDFLARE_API_TOKEN="your_token_here"
export CF_ACCOUNT_ID="your_account_id"
```

### Step 2: Deploy the Worker

From `backend-supabase/`:

```bash
# Development deployment
wrangler deploy --env development -c wrangler-analytics.toml

# Production deployment
wrangler deploy --env production -c wrangler-analytics.toml
```

### Step 3: Get Worker URL

After deployment, Wrangler will output the worker URL:
```
✓ Uploaded analytics-aggregator (0.45 ms)
✓ Published analytics-aggregator
  https://analytics-aggregator.<account>.workers.dev
```

### Step 4: Configure Environment Variable

Set the worker URL in your frontend `.env.local`:

```env
CLOUDFLARE_ANALYTICS_WORKER_URL=https://analytics-aggregator.<account>.workers.dev
```

## API Endpoint

### Request

```
GET /api/analytics?range=7d&role=admin
```

**Query Parameters:**
- `range`: Time range filter ('24h', '7d', '30d') - currently not used by worker
- `role`: User role ('admin', 'superadmin' for full metrics, others get empty data)

### Response (Success)

```json
{
  "infrastructure": {
    "r2_usage_gb": 12.5,
    "r2_allocated_gb": 100,
    "r2_object_count": 250,
    "r2_egress_gb": 5.2,
    "d1_queries_count": 15000,
    "d1_avg_latency_ms": 45.3,
    "page_views": 45000,
    "bandwidth_gb": 8.3,
    "cache_hit_ratio_pct": 78.5,
    "storage_efficiency_pct": 12.5,
    "device_mobile": 22500,
    "device_desktop": 20250,
    "device_tablet": 2250,
    "top_zones": [
      { "zone": "example.com", "requests": 30000 }
    ]
  },
  "source_health": {
    "d1_api": "ready",
    "r2_api": "ready",
    "analytics_engine": "ready",
    "page_analytics": "ready"
  }
}
```

### Response (Restricted Role)

Non-admin users receive empty infrastructure metrics:

```json
{
  "infrastructure": {
    "r2_usage_gb": 0,
    "r2_allocated_gb": 0,
    "r2_object_count": 0,
    "r2_egress_gb": 0,
    "d1_queries_count": 0,
    "d1_avg_latency_ms": 0,
    "page_views": 0,
    "bandwidth_gb": 0,
    "cache_hit_ratio_pct": 0,
    "storage_efficiency_pct": 0,
    "device_mobile": 0,
    "device_desktop": 0,
    "device_tablet": 0,
    "top_zones": []
  },
  "source_health": {
    "d1_api": "unavailable",
    "r2_api": "unavailable",
    "analytics_engine": "unavailable",
    "page_analytics": "unavailable"
  }
}
```

## Metrics Explained

### R2 Metrics
- **r2_usage_gb**: Current storage used (sum of all buckets)
- **r2_allocated_gb**: Total allocated storage (default 100 GB)
- **r2_object_count**: Total number of objects stored
- **r2_egress_gb**: Data transferred out of R2

### D1 Metrics
- **d1_queries_count**: Total queries executed across all databases
- **d1_avg_latency_ms**: Average query latency in milliseconds

### Page Analytics Metrics
- **page_views**: Total HTTP requests (page views)
- **bandwidth_gb**: Total bandwidth served (in GB)
- **cache_hit_ratio_pct**: Percentage of requests served from cache
- **device_mobile**: Estimated mobile device requests
- **device_desktop**: Estimated desktop requests
- **device_tablet**: Estimated tablet requests

### Derived Metrics
- **storage_efficiency_pct**: `(r2_usage_gb / r2_allocated_gb) * 100`

## Caching

The worker response is cached for 5 minutes (300 seconds) at the Cloudflare edge:

```
Cache-Control: public, max-age=300
```

This reduces API calls to Cloudflare's backend services.

## Error Handling

If any API call fails, the worker returns that metric with a `0` or `null` value and marks the source as `degraded` or `unavailable` in `source_health`.

The dashboard will display degraded data gracefully without blocking the UI.

## Testing Locally

```bash
wrangler dev --env development -c wrangler-analytics.toml
```

Then visit:
```
http://localhost:8787/?range=7d&role=admin
```

## Security Notes

1. **API Token**: Should never be exposed to the client. Keep it in Cloudflare environment variables.
2. **Role-based Access**: Worker checks the `role` parameter and restricts infrastructure data to admin/superadmin.
3. **CORS**: Worker allows cross-origin requests from any origin (adjust as needed).

## Troubleshooting

### Worker not responding

1. Check deployment status: `wrangler deployments list`
2. Check logs: `wrangler tail`
3. Verify API token has correct permissions

### Metrics showing as 0

1. Ensure D1 databases exist and have queries
2. Ensure R2 buckets are created and have content
3. Check Analytics API access in Cloudflare dashboard

### High latency

1. Worker fetches all APIs sequentially - this is by design for simplicity
2. In production, consider parallel fetching or caching at the edge
3. Adjust cache TTL in `Cache-Control` header if needed

## Next Steps

1. Deploy worker to production
2. Set `CLOUDFLARE_ANALYTICS_WORKER_URL` env in frontend
3. Dashboard will automatically use the worker for infrastructure metrics
4. Monitor worker logs for errors in Cloudflare dashboard

## Sprint 1 Completion Checklist

- [x] Create RPC functions for user engagement metrics
- [x] Create RPC functions for content performance metrics  
- [x] Implement React Query hook for dashboard data
- [x] Create Cloudflare Worker aggregator for infrastructure metrics
- [x] Wire analytics service to fetch from Worker
- [x] Fix frontend build issues

**Sprint 1 Status**: ✅ Complete
**Ready for**: Sprint 2 (Frontend Dashboard UI Components)
