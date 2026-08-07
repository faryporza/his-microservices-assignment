# Finance testing

Run from `his-project/`:

```bash
npm run test:finance
npx jest --config apps/finance-bc/test/jest-e2e.json
```

Unit tests live in `test/unit`, reusable fixtures in `test/mocks`, and HTTP tests in
`test/e2e`. The live flow waits for `treatment.completed`, verifies a `PENDING`
invoice, pays it once, and verifies the OPD visit eventually closes.
