module.exports = {
  rootDir: __dirname,
  roots: [
    '<rootDir>/apps/opd-bc/test/unit',
    '<rootDir>/apps/emr-bc/test/unit',
    '<rootDir>/apps/finance-bc/test/unit',
    '<rootDir>/libs',
  ],
  testMatch: ['**/*.spec.ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@apps/opd-bc(|/.*)$': '<rootDir>/apps/opd-bc/src/$1',
    '^@apps/finance-bc(|/.*)$': '<rootDir>/apps/finance-bc/src/$1',
    '^@apps/emr-bc(|/.*)$': '<rootDir>/apps/emr-bc/src/$1',
    '^@app/common(|/.*)$': '<rootDir>/libs/common/src/$1',
    '^@app/contracts(|/.*)$': '<rootDir>/libs/contracts/src/$1',
  },
  collectCoverageFrom: [
    'apps/**/src/**/*.ts',
    'libs/**/src/**/*.ts',
    '!**/*.module.ts',
    '!**/main.ts',
    '!**/health-checks.controller.ts',
    '!**/health-checks.service.ts',
    '!**/*.entity.ts',
    '!**/dto/**',
    '!**/index.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
  },
};
