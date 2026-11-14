import { Body, Controller, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { Audit, type AuthUser, CurrentUser, Roles } from '../common/decorators.js';
import { AppException, ErrorCode } from '../common/errors.js';
import { RequestPdfService } from './request-pdf.service.js';
import { RequestsService } from './requests.service.js';

const Type = z.enum(['ANNUAL', 'REMOTE', 'OFF', 'HOLIDAY_WORK']);
const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const CreateSchema = z.object({
  type: Type,
  targetDate: DateStr,
  reason: z.string().trim().min(1).max(500),
  ip: z.string().trim().max(45).nullish(),
  startTime: z.string().nullish(),
  endTime: z.string().nullish(),
  offHalf: z.enum(['AM', 'PM']).nullish(),
});
const PreviewQuery = z.object({ type: Type, date: DateStr });
const StatusQuery = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELED', 'EXPIRED']).optional(),
});
const RejectSchema = z.object({ reason: z.string().trim().min(1).max(500) });
const Id = z.coerce.number().int().positive();

@Controller('requests')
export class RequestsController {
  constructor(
    private readonly requests: RequestsService,
    private readonly pdf: RequestPdfService,
  ) {}

  @Post()
  @HttpCode(200)
  @Audit('REQ_CREATE')
  async create(@CurrentUser() user: AuthUser, @Body({ schema: CreateSchema }) body: z.infer<typeof CreateSchema>) {
    const r = await this.requests.create(user, body);
    return this.requests.view(r);
  }

  @Get('me')
  @Audit('REQ_MY_LIST')
  async mine(@CurrentUser() user: AuthUser) {
    return { items: await this.requests.listMine(user.id) };
  }

  @Get('preview')
  @Audit('REQ_PREVIEW')
  preview(@CurrentUser() user: AuthUser, @Query({ schema: PreviewQuery }) q: z.infer<typeof PreviewQuery>) {
    return this.requests.preview(user, q.type, q.date);
  }

  @Get()
  @Roles('LEAD')
  @Audit('REQ_TEAM_LIST')
  async team(@Query({ schema: StatusQuery }) q: z.infer<typeof StatusQuery>) {
    return { items: await this.requests.listTeam(q.status) };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Audit('REQ_CANCEL')
  async cancel(@CurrentUser() user: AuthUser, @Param('id', { schema: Id }) id: number) {
    return this.requests.view(await this.requests.cancel(user, id));
  }

  @Post(':id/approve')
  @HttpCode(200)
  @Roles('LEAD')
  @Audit('REQ_APPROVE')
  async approve(@CurrentUser() user: AuthUser, @Param('id', { schema: Id }) id: number) {
    return this.requests.view(await this.requests.approve(user, id));
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Roles('LEAD')
  @Audit('REQ_REJECT')
  async reject(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: Id }) id: number,
    @Body({ schema: RejectSchema }) body: z.infer<typeof RejectSchema>,
  ) {
    return this.requests.view(await this.requests.reject(user, id, body.reason));
  }

  /** FN-REQ-03 */
  @Get(':id/pdf')
  @Audit('REQ_PDF')
  async pdfDownload(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: Id }) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.requests.get(id);
    if (r.userId !== user.id && user.role !== 'LEAD') throw new AppException(ErrorCode.FORBIDDEN);
    const buf = await this.pdf.render(r);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="request-${r.id}.pdf"; filename*=UTF-8''${encodeURIComponent(`신청서-${r.id}.pdf`)}`,
    );
    res.end(buf);
  }
}
