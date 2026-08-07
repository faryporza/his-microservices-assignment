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
  const patient = await requestJson(`${baseUrls.opd}/patients`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      hn: `HN-LIVE-${suffix}`,
      first_name: 'Live',
      last_name: 'Flow',
      id_card: `LIVE-${suffix}`,
    }),
  });
  const visit = await requestJson(`${baseUrls.opd}/visits`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ patient_id: patient.id }),
  });
  if (visit.status !== 'OPEN') {
    throw new Error(`Expected OPEN visit, received ${visit.status}`);
  }
  await writeFile(stateFile, JSON.stringify({ visitId: visit.id }, null, 2));
  return visit.id;
}

async function completeVisit(visitId) {
  await waitForService('EMR', baseUrls.emr);
  await waitForService('Finance', baseUrls.finance);

  const records = await waitFor('EMR waiting record', async () => {
    const value = await requestJson(`${baseUrls.emr}/records/visit/${visitId}`);
    return Array.isArray(value) && value.length > 0 ? value : undefined;
  });
  const record = records[0];
  const completed = await requestJson(`${baseUrls.emr}/records/${record.id}`, {
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
  if (completed.status !== 'COMPLETED') {
    throw new Error(`Expected COMPLETED record, received ${completed.status}`);
  }

  const invoices = await waitFor('Finance pending invoice', async () => {
    const value = await requestJson(`${baseUrls.finance}/invoices/${visitId}`);
    return Array.isArray(value) && value.length > 0 ? value : undefined;
  });
  const invoice = invoices[0];
  const paid = await requestJson(
    `${baseUrls.finance}/invoices/${invoice.id}/pay`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' }),
    },
  );
  if (paid.status !== 'PAID') {
    throw new Error(`Expected PAID invoice, received ${paid.status}`);
  }

  const closedVisit = await waitFor('OPD closed visit', async () => {
    const value = await requestJson(`${baseUrls.opd}/visits/${visitId}`);
    return value.status === 'CLOSED' ? value : undefined;
  });
  console.log(
    JSON.stringify({
      visitId,
      recordId: record.id,
      invoiceId: invoice.id,
      status: closedVisit.status,
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
