import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { Audit, type AuthUser, CurrentUser } from '../decorators.js';
import { AuditService } from './audit.service.js';

const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const SearchQuery = z.object({
  userId: z.coerce.number().int().positive().optional(),
  action: z.string().max(50).optional(),
  from: DateStr.optional(),
  to: DateStr.optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(200).default(50),
});

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** 리드: 전체 (사용자·기간·액션 필터) / 팀원: 본인만 */
  @Get()
  @Audit('AUDIT_LIST')
  list(@CurrentUser() user: AuthUser, @Query({ schema: SearchQuery }) q: z.infer<typeof SearchQuery>) {
    const userId = user.role === 'LEAD' ? q.userId : user.id;
    return this.audit.search({ ...q, userId });
  }

  @Get('actions')
  @Audit('AUDIT_ACTIONS')
  async actions() {
    return { items: await this.audit.actions() };
  }
}
