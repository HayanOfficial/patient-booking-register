import { ReservationType } from '../../src/types';
import { SettingRepository } from '../repositories/other.repositories';

export interface TokenConfig {
  appointment_prefix: string;
  walkin_prefix: string;
  include_device_prefix: boolean;
  device_prefix: string;
}

export class TokenService {
  private settingRepo: SettingRepository;

  constructor() {
    this.settingRepo = new SettingRepository();
  }

  public getTokenConfig(): TokenConfig {
    return this.settingRepo.getSetting<TokenConfig>('token_config', {
      appointment_prefix: 'A',
      walkin_prefix: 'W',
      include_device_prefix: false,
      device_prefix: 'DEV1',
    });
  }

  public formatToken(tokenNumber: number, reservationType: ReservationType): string {
    const config = this.getTokenConfig();
    const typePrefix = reservationType === 'Walk-in' ? config.walkin_prefix : config.appointment_prefix;
    // Standard 2-digit padded sequence for professional hospital queues (e.g. A-01, A-02, A-20, W-01)
    const safeNum = Math.max(1, Math.floor(Number(tokenNumber) || 1));
    const formattedNum = safeNum.toString().padStart(2, '0');
    
    if (config.include_device_prefix && config.device_prefix) {
      return `${config.device_prefix}-${typePrefix}-${formattedNum}`;
    }
    return `${typePrefix}-${formattedNum}`;
  }

  public isValidTokenCode(tokenCode: string): boolean {
    if (!tokenCode || typeof tokenCode !== 'string') return false;
    return /^[A-Z0-9]+-[A-Z0-9]+(-\d+)?$/i.test(tokenCode.trim());
  }
}
