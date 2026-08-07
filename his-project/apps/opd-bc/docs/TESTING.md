# OPD testing

Run from `his-project/`:

```bash
npm run test:opd
npx jest --config apps/opd-bc/test/jest-e2e.json
```

Unit tests live in `test/unit`, reusable fixtures in `test/mocks`, and HTTP tests in
`test/e2e`. The live flow creates unique patient identifiers and verifies
`OPEN` followed by `CLOSED` after payment.
