import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const baseUrls = {
  opd: process.env.OPD_BASE_URL ?? 'http://127.0.0.1:3000',
  emr: process.env.EMR_BASE_URL ?? 'http://127.0.0.1:3001',
  finance: process.env.FINANCE_BASE_URL ?? 'http://127.0.0.1:3002',
};
const stateFile = process.env.FLOW_STATE_FILE ?? '/tmp/his-flow-state.json';

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
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const patientRes = await requestJson(`${baseUrls.opd}/patients`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      hn: `HN-LIVE-${suffix}`,
      first_name: 'Live',
      last_name: 'Flow',
      id_card: `LIVE-${suffix}`,
    }),
  });
  const patientId = patientRes.data.id;
  const visitRes = await requestJson(`${baseUrls.opd}/visits`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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

  const recordsRes = await waitFor('EMR waiting record', async () => {
    const value = await requestJson(`${baseUrls.emr}/records/visit/${visitId}`);
    const list = Array.isArray(value?.data) ? value.data : undefined;
    return list && list.length > 0 ? list : undefined;
  });
  const record = recordsRes[0];
  const recordId = record.id;
  const completedRes = await requestJson(`${baseUrls.emr}/records/${recordId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      doctor_id: 'doctor-live-flow',
      diagnosis: 'Live flow verification',
      treatment_note: 'Automated end-to-end test',
      treatment_cost: 1500,
      status: 'COMPLETED',
    }),
  });
  const completedStatus = completedRes.data.attributes.status;
  if (completedStatus !== 'COMPLETED') {
    throw new Error(`Expected COMPLETED record, received ${completedStatus}`);
  }

  const invoicesRes = await waitFor('Finance pending invoice', async () => {
    const value = await requestJson(`${baseUrls.finance}/invoices/${visitId}`);
    const list = Array.isArray(value?.data) ? value.data : undefined;
    return list && list.length > 0 ? list : undefined;
  });
  const invoice = invoicesRes[0];
  const invoiceId = invoice.id;
  const paidRes = await requestJson(
    `${baseUrls.finance}/invoices/${invoiceId}/pay`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' }),
    },
  );
  const paidStatus = paidRes.data.attributes.status;
  if (paidStatus !== 'PAID') {
    throw new Error(`Expected PAID invoice, received ${paidStatus}`);
  }

  const closedVisitRes = await waitFor('OPD closed visit', async () => {
    const value = await requestJson(`${baseUrls.opd}/visits/${visitId}`);
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

const phase = process.argv[2] ?? 'full';
const visitId =
  phase === 'complete'
    ? JSON.parse(await readFile(stateFile, 'utf8')).visitId
    : await createVisit();

if (phase !== 'create') {
  await completeVisit(visitId);
}
