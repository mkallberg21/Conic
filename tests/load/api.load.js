/**
 * k6 Load Test — Conic API
 *
 * Tests the critical path: Auth → Contracts → Deliverables → Analytics
 *
 * Run:
 *   k6 run tests/load/api.load.js
 *   k6 run --vus 50 --duration 5m tests/load/api.load.js
 *
 * Thresholds:
 *   - p95 response time < 500ms
 *   - p99 response time < 1000ms
 *   - Error rate < 1%
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// ── Custom metrics ─────────────────────────────────────────────────────────
const loginDuration      = new Trend('login_duration');
const contractsDuration  = new Trend('contracts_duration');
const analyticsDuration  = new Trend('analytics_duration');
const errorRate          = new Rate('error_rate');
const authErrors         = new Counter('auth_errors');

// ── Config ─────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

const DEMO_CREDENTIALS = [
  { email: 'brand@demo.conic.io',    password: 'Demo@Conic2025!' },
  { email: 'creator1@demo.conic.io', password: 'Demo@Conic2025!' },
];

// ── Load profile ───────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '1m',  target: 10  }, // Ramp-up
    { duration: '3m',  target: 50  }, // Sustained load
    { duration: '1m',  target: 100 }, // Stress peak
    { duration: '2m',  target: 50  }, // Scale down
    { duration: '1m',  target: 0   }, // Cool-down
  ],
  thresholds: {
    http_req_duration:       ['p(95)<500', 'p(99)<1000'],
    http_req_failed:         ['rate<0.01'],
    error_rate:              ['rate<0.01'],
    login_duration:          ['p(95)<800'],
    contracts_duration:      ['p(95)<400'],
    analytics_duration:      ['p(95)<600'],
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function getHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${token}`,
  };
}

function assertOk(res, tag) {
  const ok = check(res, {
    [`${tag} — status 200`]: (r) => r.status === 200 || r.status === 201,
  });
  if (!ok) errorRate.add(1);
  return ok;
}

// ── Main virtual user scenario ─────────────────────────────────────────────
export default function () {
  const creds = DEMO_CREDENTIALS[Math.floor(Math.random() * DEMO_CREDENTIALS.length)];

  let accessToken = null;

  // ── Auth ─────────────────────────────────────────────────────────────────
  group('auth', () => {
    const start = new Date();
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: creds.email, password: creds.password }),
      { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } },
    );
    loginDuration.add(new Date() - start);

    const ok = check(res, {
      'login — status 200':    (r) => r.status === 200,
      'login — has token':     (r) => r.json('accessToken') !== undefined,
    });

    if (!ok) {
      authErrors.add(1);
      errorRate.add(1);
      return;
    }

    accessToken = res.json('accessToken');
  });

  if (!accessToken) return;

  sleep(0.5);

  // ── Contracts ─────────────────────────────────────────────────────────────
  group('contracts', () => {
    const start = new Date();
    const res = http.get(`${BASE_URL}/contracts`, {
      headers: getHeaders(accessToken),
      tags: { name: 'list-contracts' },
    });
    contractsDuration.add(new Date() - start);
    assertOk(res, 'list contracts');
  });

  sleep(0.3);

  // ── Deliverables ──────────────────────────────────────────────────────────
  group('deliverables', () => {
    const res = http.get(`${BASE_URL}/deliverables`, {
      headers: getHeaders(accessToken),
      tags: { name: 'list-deliverables' },
    });
    assertOk(res, 'list deliverables');
  });

  sleep(0.3);

  // ── Campaigns ─────────────────────────────────────────────────────────────
  group('campaigns', () => {
    const res = http.get(`${BASE_URL}/campaigns`, {
      headers: getHeaders(accessToken),
      tags: { name: 'list-campaigns' },
    });
    assertOk(res, 'list campaigns');
  });

  sleep(0.3);

  // ── Analytics ─────────────────────────────────────────────────────────────
  group('analytics', () => {
    const start = new Date();
    const res = http.get(`${BASE_URL}/analytics/dashboard`, {
      headers: getHeaders(accessToken),
      tags: { name: 'analytics-dashboard' },
    });
    analyticsDuration.add(new Date() - start);
    assertOk(res, 'analytics dashboard');
  });

  sleep(1);
}
