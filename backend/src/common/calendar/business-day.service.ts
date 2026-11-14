import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException, ErrorCode } from '../errors.js';
import {
  isBusinessDay,
  isWeekend,
  prevBusinessDay,
} from './business-day.policy.js';
import { Holiday } from './holiday.entity.js';

/** 공휴일 테이블을 메모리에 캐시하고 영업일 판정을 제공한다. */
@Injectable()
export class BusinessDayService {
  private cache: Map<string, string> | null = null;

  constructor(
    @InjectRepository(Holiday) private readonly holidays: Repository<Holiday>,
  ) {}

  async load(): Promise<void> {
    const rows = await this.holidays.find();
    this.cache = new Map(rows.map((h) => [h.date, h.name]));
  }

  private get map(): Map<string, string> {
    if (!this.cache) throw new Error('BusinessDayService not loaded');
    return this.cache;
  }

  /** 동기 판정용 조회 함수 (순수 정책 함수에 넘긴다) */
  readonly isHoliday = (date: string): boolean => this.map.has(date);

  holidayName(date: string): string | null {
    return this.map.get(date) ?? null;
  }

  isBusinessDay(date: string): boolean {
    return isBusinessDay(date, this.isHoliday);
  }

  isWeekend(date: string): boolean {
    return isWeekend(date);
  }

  prevBusinessDay(date: string): string {
    return prevBusinessDay(date, this.isHoliday);
  }

  async list(year?: string): Promise<Holiday[]> {
    const all = await this.holidays.find({ order: { date: 'ASC' } });
    return year ? all.filter((h) => h.date.startsWith(year)) : all;
  }

  async add(date: string, name: string): Promise<Holiday> {
    if (await this.holidays.findOneBy({ date })) {
      throw new AppException(ErrorCode.HOLIDAY_EXISTS);
    }
    const h = await this.holidays.save(this.holidays.create({ date, name }));
    await this.load();
    return h;
  }

  async remove(date: string): Promise<void> {
    const res = await this.holidays.delete({ date });
    if (!res.affected) throw new AppException(ErrorCode.NOT_FOUND);
    await this.load();
  }
}
