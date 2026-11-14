import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { BusinessDayService } from '../common/calendar/business-day.service.js';
import { Holiday } from '../common/calendar/holiday.entity.js';
import { ClockService } from '../common/clock/clock.service.js';
import { AllowedIp } from '../common/ip/allowed-ip.entity.js';
import { normalizeIp } from '../common/ip/ip.util.js';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { User } from '../users/user.entity.js';
import { SEED_HOLIDAYS, SEED_USERS } from './seed-data.js';

/** 최초 실행 시 계정·공휴일·연구실 IP 를 넣는다. */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Seed');

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly clock: ClockService,
    private readonly calendar: BusinessDayService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Holiday) private readonly holidays: Repository<Holiday>,
    @InjectRepository(AllowedIp) private readonly ips: Repository<AllowedIp>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.run();
  }

  async run(): Promise<void> {
    if ((await this.users.count()) === 0) {
      for (const u of SEED_USERS) {
        await this.users.insert({
          loginId: u.loginId,
          name: u.name,
          role: u.role,
          joinDate: u.joinDate,
          passwordHash: await bcrypt.hash(u.password, 10),
        });
      }
      this.logger.log(`users seeded: ${SEED_USERS.map((u) => u.loginId).join(', ')}`);
    }
    if ((await this.holidays.count()) === 0) {
      await this.holidays.insert(SEED_HOLIDAYS);
      this.logger.log(`holidays seeded: ${SEED_HOLIDAYS.length}`);
    }
    // LAB_IPS 는 매 부팅마다 없는 것만 추가
    for (const raw of this.config.labIps) {
      const ip = normalizeIp(raw);
      if (!(await this.ips.findOneBy({ ip }))) {
        await this.ips.insert({ ip, label: '연구실', createdAt: this.clock.nowIso() });
        this.logger.log(`lab ip added: ${ip}`);
      }
    }
    await this.calendar.load();
  }
}
