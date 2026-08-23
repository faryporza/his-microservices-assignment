import { IsNotEmpty, IsString } from 'class-validator';
import { createStrictValidationPipe } from './strict-validation.pipe';
import { ValidationException } from '../exceptions/validation.exception';
import { ArgumentMetadata } from '@nestjs/common';

class TestDTO {
  @IsString()
  @IsNotEmpty()
  first_name!: string;
}

describe('createStrictValidationPipe', () => {
  const pipe = createStrictValidationPipe();
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: TestDTO,
  };

  it('transforms and validates valid DTO', async () => {
    const input = { first_name: 'Ada' };
    const result = (await pipe.transform(input, metadata)) as TestDTO;
    expect(result).toBeInstanceOf(TestDTO);
    expect(result.first_name).toBe('Ada');
  });

  it('throws ValidationException with /data/attributes/ pointer on failure', async () => {
    const input = { first_name: '' };

    try {
      await pipe.transform(input, metadata);
      fail('Should have thrown ValidationException');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationException);
      const valError = error as ValidationException;
      expect(valError.businessCode).toBe(400001);
      expect(valError.errors.length).toBeGreaterThan(0);
      expect(valError.errors[0].source?.pointer).toBe(
        '/data/attributes/first_name',
      );
    }
  });

  it('rejects non-whitelisted properties', async () => {
    const input = { first_name: 'Ada', unexpectedField: true };

    try {
      await pipe.transform(input, metadata);
      fail('Should have thrown ValidationException');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationException);
      const valError = error as ValidationException;
      expect(
        valError.errors.some((e) =>
          e.detail?.includes('property unexpectedField should not exist'),
        ),
      ).toBe(true);
    }
  });
});
