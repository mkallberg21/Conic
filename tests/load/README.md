# Load Testing — Conic API

Uses [k6](https://k6.io/) for performance, load, and soak testing.

## Prerequisites

```bash
# macOS
brew install k6

# Docker
docker pull grafana/k6
```

## Test Suites

| File | Purpose | Duration |
|------|---------|----------|
| `api.load.js` | Standard load test with ramp-up, peak, and cool-down | ~8 min |
| `soak.test.js` | 1-hour sustained load to catch memory leaks | ~60 min |

## Running Tests

### Local (requires seed data: `npm run db:seed`)

```bash
# Quick load test
k6 run tests/load/api.load.js

# Against staging
k6 run -e BASE_URL=https://api-staging.conic.io tests/load/api.load.js

# With output to Grafana Cloud k6
k6 run -o cloud tests/load/api.load.js

# Soak test
k6 run tests/load/soak.test.js
```

### Via Docker

```bash
docker run --rm -i \
  -e BASE_URL=http://host.docker.internal:4000 \
  grafana/k6 run - < tests/load/api.load.js
```

## Acceptance Thresholds

| Metric | Target |
|--------|--------|
| p95 response time | < 500 ms |
| p99 response time | < 1,000 ms |
| Error rate | < 1% |
| Login p95 | < 800 ms |
| Analytics p95 | < 600 ms |
