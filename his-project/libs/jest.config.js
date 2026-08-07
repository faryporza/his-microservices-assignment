module.exports = {
  rootDir: __dirname,
  roots: ['<rootDir>'],
  testMatch: ['**/*.spec.ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@app/common(|/.*)$': '<rootDir>/common/src/$1',
    '^@app/contracts(|/.*)$': '<rootDir>/contracts/src/$1',
    '^@apps/opd-bc(|/.*)$': '<rootDir>/../apps/opd-bc/src/$1',
    '^@apps/finance-bc(|/.*)$': '<rootDir>/../apps/finance-bc/src/$1',
    '^@apps/emr-bc(|/.*)$': '<rootDir>/../apps/emr-bc/src/$1',
  },
};
