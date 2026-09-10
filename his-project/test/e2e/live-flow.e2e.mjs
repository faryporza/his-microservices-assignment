import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';

const baseUrls = {
  opd: process.env.OPD_BASE_URL ?? 'http://127.0.0.1:3000',
  emr: process.env.EMR_BASE_URL ?? 'http://127.0.0.1:3001',
  finance: process.env.FINANCE_BASE_URL ?? 'http://127.0.0.1:3002',
  iam: process.env.IAM_BASE_URL ?? 'http://127.0.0.1:3003',
};
const apiPrefix = (process.env.API_PREFIX ?? 'api/v1').replace(/^\/+|\/+$/g, '');
const apiBaseUrls = Object.fromEntries(
  Object.entries(baseUrls).map(([name, url]) => [
    name,
    apiPrefix ? `${url}/${apiPrefix}` : url,
  ]),
);
const stateFile = process.env.FLOW_STATE_FILE ?? '/tmp/his-flow-state.json';

const redisHost = process.env.REDIS_HOST ?? '127.0.0.1';
const redisPort = Number(process.env.REDIS_PORT ?? 6379);
const redisPassword = process.env.REDIS_PASSWORD || undefined;
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET must be set for the live flow');
}

const redis = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  lazyConnect: true,
});

let currentUserId = null;
let currentSessionId = null;

async function getAuthHeaders() {
  currentUserId = `admin-live-${randomUUID().slice(0, 8)}`;
  currentSessionId = `session-live-${randomUUID().slice(0, 8)}`;
  const jti = `jti-live-${randomUUID().slice(0, 8)}`;

  if (redis.status !== 'ready' && redis.status !== 'connecting') {
    await redis.connect();
  }
  const sessionKey = `auth:session:${currentUserId}:${currentSessionId}`;
  const userSessionsKey = `auth:user_sessions:${currentUserId}`;
  const sessionMeta = {
    userId: currentUserId,
    username: 'live_admin',
    role: 'ADMIN',
    refreshTokenJti: `refresh-jti-live-${randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
  await redis.set(sessionKey, JSON.stringify(sessionMeta), 'EX', 86400);
  await redis.sadd(userSessionsKey, currentSessionId);
  await redis.expire(userSessionsKey, 86400);

  const token = jwt.sign(
    {
      sub: currentUserId,
      username: 'live_admin',
      role: 'ADMIN',
      sid: currentSessionId,
      jti,
    },
    jwtSecret,
    { expiresIn: '1d' },
  );

  return {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  };
}

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Keep plain-text health responses as strings.
  }
  if (!response.ok) {
    throw new Error(
      `${options.method ?? 'GET'} ${url} returned ${response.status}: ${text}`,
    );
  }
  return body;
}

async function waitFor(label, operation, timeoutMilliseconds = 90_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await operation();
      if (value !== undefined && value !== null && value !== false) {
        return value;
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw new Error(
    `Timed out waiting for ${label}: ${lastError?.message ?? 'condition not met'}`,
  );
}

async function waitForService(name, baseUrl) {
  await waitFor(`${name} health`, async () => {
    const body = await requestJson(`${baseUrl}/`);
    return body === 'Hello World!';
  });
}

async function createVisit() {
  await waitForService('OPD', baseUrls.opd);
  try {
    const iamBody = await requestJson(`${baseUrls.iam}/`);
    if (iamBody === 'Hello World!') {
      console.log('IAM service health probe verified (port 3003)');
    }
  } catch {
    if (process.env.REQUIRE_IAM === 'true') {
      throw new Error(`IAM service required on ${baseUrls.iam} but unreachable`);
    }
  }
  const authHeaders = await getAuthHeaders();
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const patientRes = await requestJson(`${apiBaseUrls.opd}/patients`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      hn: `HN-LIVE-${suffix}`,
      first_name: 'Live',
      last_name: 'Flow',
      id_card: `LIVE-${suffix}`,
    }),
  });
  const patientId = patientRes.data.id;
  const visitRes = await requestJson(`${apiBaseUrls.opd}/visits`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ patient_id: patientId }),
  });
  const visitId = visitRes.data.id;
  const visitStatus = visitRes.data.attributes.status;
  if (visitStatus !== 'OPEN') {
    throw new Error(`Expected OPEN visit, received ${visitStatus}`);
  }
  await writeFile(stateFile, JSON.stringify({ visitId }, null, 2));
  return visitId;
}

async function completeVisit(visitId) {
  await waitForService('EMR', baseUrls.emr);
  await waitForService('Finance', baseUrls.finance);
  const authHeaders = await getAuthHeaders();

  const recordsRes = await waitFor('EMR waiting record', async () => {
    const value = await requestJson(
      `${apiBaseUrls.emr}/records/visit/${visitId}`,
      { headers: authHeaders },
    );
    const list = Array.isArray(value?.data) ? value.data : undefined;
    return list && list.length > 0 ? list : undefined;
  });
  const record = recordsRes[0];
  const recordId = record.id;
  const completedRes = await requestJson(
    `${apiBaseUrls.emr}/records/${recordId}`,
    {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        doctor_id: 'doctor-live-flow',
        diagnosis: 'Live flow verification',
        treatment_note: 'Automated end-to-end test',
        treatment_cost: 1500,
        status: 'COMPLETED',
      }),
    },
  );
  const completedStatus = completedRes.data.attributes.status;
  if (completedStatus !== 'COMPLETED') {
    throw new Error(`Expected COMPLETED record, received ${completedStatus}`);
  }

  const invoicesRes = await waitFor('Finance pending invoice', async () => {
    const value = await requestJson(
      `${apiBaseUrls.finance}/invoices/${visitId}`,
      { headers: authHeaders },
    );
    const list = Array.isArray(value?.data) ? value.data : undefined;
    return list && list.length > 0 ? list : undefined;
  });
  const invoice = invoicesRes[0];
  const invoiceId = invoice.id;
  const paidRes = await requestJson(
    `${apiBaseUrls.finance}/invoices/${invoiceId}/pay`,
    {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'PAID' }),
    },
  );
  const paidStatus = paidRes.data.attributes.status;
  if (paidStatus !== 'PAID') {
    throw new Error(`Expected PAID invoice, received ${paidStatus}`);
  }

  const closedVisitRes = await waitFor('OPD closed visit', async () => {
    const value = await requestJson(`${apiBaseUrls.opd}/visits/${visitId}`, {
      headers: authHeaders,
    });
    const status = value?.data?.attributes?.status;
    return status === 'CLOSED' ? value : undefined;
  });
  const finalStatus = closedVisitRes.data.attributes.status;
  console.log(
    JSON.stringify({
      visitId,
      recordId,
      invoiceId,
      status: finalStatus,
    }),
  );
}

try {
  const phase = process.argv[2] ?? 'full';
  const visitId =
    phase === 'complete'
      ? JSON.parse(await readFile(stateFile, 'utf8')).visitId
      : await createVisit();

  if (phase !== 'create') {
    await completeVisit(visitId);
  }
} finally {
  try {
    if (currentUserId && currentSessionId) {
      const sessionKey = `auth:session:${currentUserId}:${currentSessionId}`;
      const userSessionsKey = `auth:user_sessions:${currentUserId}`;
      await redis.del(sessionKey);
      await redis.srem(userSessionsKey, currentSessionId);
    }
  } catch {
    // ignore
  }
  try {
    redis.disconnect();
  } catch {
    // ignore
  }
}
