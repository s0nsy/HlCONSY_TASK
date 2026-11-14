import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { Audit, Roles } from '../decorators.js';
import { BusinessDayService } from './business-day.service.js';

const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const CreateSchema = z.object({ date: DateStr, name: z.string().trim().min(1).max(100) });
const YearQuery = z.object({ year: z.string().regex(/^\d{4}$/).optional() });

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly calendar: BusinessDayService) {}

  @Get()
  @Audit('HOLIDAY_LIST')
  async list(@Query({ schema: YearQuery }) q: z.infer<typeof YearQuery>) {
    return { items: await this.calendar.list(q.year) };
  }

  @Post()
  @Roles('LEAD')
  @Audit('HOLIDAY_ADD')
  add(@Body({ schema: CreateSchema }) body: z.infer<typeof CreateSchema>) {
    return this.calendar.add(body.date, body.name);
  }

  @Delete(':date')
  @Roles('LEAD')
  @Audit('HOLIDAY_DELETE')
  async remove(@Param('date', { schema: DateStr }) date: string) {
    await this.calendar.remove(date);
    return { ok: true };
  }
}
