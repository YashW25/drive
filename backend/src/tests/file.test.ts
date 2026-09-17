import crypto from 'crypto';

describe('TeleDrive Core Logic Unit Tests', () => {
  test('SHA-256 Duplicate Hash Detection', () => {
    const buffer1 = Buffer.from('TeleDrive Test Content 2026');
    const buffer2 = Buffer.from('TeleDrive Test Content 2026');
    const buffer3 = Buffer.from('Different File Content');

    const hash1 = crypto.createHash('sha256').update(buffer1).digest('hex');
    const hash2 = crypto.createHash('sha256').update(buffer2).digest('hex');
    const hash3 = crypto.createHash('sha256').update(buffer3).digest('hex');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  test('Public Share Token Generation', () => {
    const token = crypto.randomBytes(16).toString('hex');
    expect(token).toHaveLength(32);
  });
});
