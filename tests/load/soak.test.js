/**
 * k6 Soak Test — Conic API
 *
 * Runs a sustained low-to-medium load for 1 hour to catch memory leaks,
 * connection pool exhaustion, and slow degradation over time.
 *
 * Run:
 *   k6 run tests/load/soak.test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const errorRate = new Rate('error_rate');

export const options = {
  stages: [
    { duration: '5m',  target: 20 }, // Warm-up
    { duration: '50m', target: 20 }, // Sustained soak
    { duration: '5m',  target: 0  }, // Cool-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<600'],
    http_req_failed:   ['rate<0.005'],
    error_rate:        ['rate<0.005'],
  },
};

export default function () {
  let token = null;

  group('login', () => {
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: 'brand@demo.conic.io', password: 'Demo@Conic2025!' }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    const ok = check(res, { 'authenticated': (r) => r.status === 200 });
    if (!ok) { errorRate.add(1); return; }
    token = res.json('accessToken');
  });

  if (!token) return;

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const endpoints = ['/contracts', '/deliverables', '/campaigns', '/analytics/dashboard'];
  for (const ep of endpoints) {
    group(ep, () => {
      const res = http.get(`${BASE_URL}${ep}`, { headers });
      const ok = check(res, { [`${ep} — 200`]: (r) => r.status === 200 });
      if (!ok) errorRate.add(1);
    });
    sleep(0.5);
  }

  sleep(2);
}
