import * as fs from 'fs';
import * as path from 'path';

describe('Clean Architecture & Bounded Context Boundaries (R7)', () => {
  const appsDir = path.resolve(__dirname, '../../apps');
  const services = ['opd-bc', 'emr-bc', 'finance-bc', 'iam-bc'];

  function getAllTsFiles(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        if (file !== 'node_modules' && file !== 'dist') {
          results = results.concat(getAllTsFiles(filePath));
        }
      } else if (file.endsWith('.ts') && !file.endsWith('.spec.ts')) {
        results.push(filePath);
      }
    }
    return results;
  }

  services.forEach((service) => {
    it(`verifies ${service} has zero direct imports from other microservice bounded contexts`, () => {
      const serviceDir = path.join(appsDir, service);
      if (!fs.existsSync(serviceDir)) return;

      const otherServices = services.filter((s) => s !== service);
      const files = getAllTsFiles(serviceDir);

      const violations: { file: string; target: string; line: string }[] = [];

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line) => {
          if (/^\s*import\s+.*from\s+['"].*['"]/.test(line)) {
            for (const other of otherServices) {
              if (
                line.includes(`apps/${other}`) ||
                line.includes(`@apps/${other}`)
              ) {
                violations.push({ file, target: other, line });
              }
            }
          }
        });
      }

      expect(violations).toEqual([]);
    });
  });
});
