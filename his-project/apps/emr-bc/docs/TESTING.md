# EMR testing

Run from `his-project/`:

```bash
npm run test:emr
npx jest --config apps/emr-bc/test/jest-e2e.json
```

Unit tests live in `test/unit`, reusable fixtures in `test/mocks`, and HTTP tests in
`test/e2e`. The live flow waits for the `visit.created` consumer to create a
record, then verifies the `COMPLETED` treatment transition.
