import { ContractModule } from './contract.module';

describe('ContractModule naming', () => {
  it('uses a singular module name', () => {
    expect(ContractModule.name).toBe('ContractModule');
  });
});
