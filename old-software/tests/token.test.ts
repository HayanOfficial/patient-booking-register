import { describe, it, expect, beforeAll } from 'vitest';
import { TokenService } from '../electron/services/token.service';
import { AppDatabase } from '../electron/db/database';
import path from 'path';

describe('TokenService', () => {
  beforeAll(async () => {
    const db = AppDatabase.getInstance();
    const testDbPath = path.join(process.cwd(), 'local-data', 'token_test_db.sqlite');
    await db.initialize(testDbPath);
  });

  it('should format appointment tokens as A-01, A-02', () => {
    const service = new TokenService();
    expect(service.formatToken(1, 'Appointment')).toBe('A-01');
    expect(service.formatToken(12, 'Appointment')).toBe('A-12');
    expect(service.formatToken(105, 'Appointment')).toBe('A-105');
  });

  it('should format walk-in tokens as W-01, W-05', () => {
    const service = new TokenService();
    expect(service.formatToken(1, 'Walk-in')).toBe('W-01');
    expect(service.formatToken(5, 'Walk-in')).toBe('W-05');
    expect(service.formatToken(23, 'Walk-in')).toBe('W-23');
  });
});
