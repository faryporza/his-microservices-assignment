module.exports = {
  rootDir: __dirname,
  roots: ['<rootDir>/test/unit'],
  testMatch: ['**/*.spec.ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../../tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@apps/finance-bc(|/.*)$': '<rootDir>/src/$1',
    '^@app/common(|/.*)$': '<rootDir>/../../libs/common/src/$1',
    '^@app/contracts(|/.*)$': '<rootDir>/../../libs/contracts/src/$1',
  },
};
