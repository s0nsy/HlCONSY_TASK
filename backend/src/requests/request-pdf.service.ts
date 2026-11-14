import { createRequire } from 'node:module';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClockService } from '../common/clock/clock.service.js';
import { fromIso, labelDate } from '../common/time.js';
import { User } from '../users/user.entity.js';
import { RequestsService } from './requests.service.js';
import type { WorkRequest } from './request.entity.js';

// pdfmake 0.3 은 CommonJS 싱글턴
const require = createRequire(import.meta.url);
const pdfmake = require('pdfmake');

const FONT_DIR = join(import.meta.dirname, '..', '..', 'assets', 'fonts');
pdfmake.setFonts({
  NotoSansKR: {
    normal: join(FONT_DIR, 'NotoSansKR_400Regular.ttf'),
    bold: join(FONT_DIR, 'NotoSansKR_700Bold.ttf'),
    italics: join(FONT_DIR, 'NotoSansKR_400Regular.ttf'),
    bolditalics: join(FONT_DIR, 'NotoSansKR_700Bold.ttf'),
  },
});
// 외부 URL·로컬 파일 접근은 폰트 외에는 막는다
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((p: string) => p.startsWith(FONT_DIR));

const TYPE_LABEL: Record<string, string> = {
  ANNUAL: '연차',
  REMOTE: '재택근무',
  OFF: '반일 OFF 사용',
  HOLIDAY_WORK: '주말/공휴일 근무',
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: '승인 대기',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELED: '취소',
  EXPIRED: '만료(미승인)',
};

/** FN-REQ-03 신청서 PDF (Noto Sans KR 임베드) */
@Injectable()
export class RequestPdfService {
  constructor(
    private readonly clock: ClockService,
    private readonly requests: RequestsService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async render(r: WorkRequest): Promise<Buffer> {
    const user = await this.users.findOneByOrFail({ id: r.userId });
    const reviewer = r.reviewerId ? await this.users.findOneBy({ id: r.reviewerId }) : null;
    const dl = this.requests.deadlineOf(r.targetDate);
    const fmt = (iso: string | null) => (iso ? fromIso(iso).format('YYYY-MM-DD HH:mm:ss') : '-');

    const rows: [string, string][] = [
      ['신청 번호', `#${r.id}`],
      ['신청자', `${user.name} (${user.loginId})`],
      ['신청 종류', TYPE_LABEL[r.type]],
      ['사용일', `${r.targetDate} ${labelDate(r.targetDate).replace(/^[^(]+/, '')}`],
    ];
    if (r.type === 'OFF') rows.push(['반일 구분', r.offHalf === 'AM' ? '오전' : '오후']);
    if (r.type === 'REMOTE' || r.type === 'HOLIDAY_WORK') {
      rows.push(['접속 IP', r.ip ?? '-'], ['근무 시간대', `${r.startTime} ~ ${r.endTime}`]);
    }
    rows.push(
      ['사유', r.reason],
      ['신청 일시', fmt(r.createdAt)],
      ['신청 마감', dl.label],
      ['상태', STATUS_LABEL[r.status]],
      ['처리자', reviewer ? reviewer.name : '-'],
      ['처리 일시', fmt(r.reviewedAt)],
    );
    if (r.rejectReason) rows.push(['반려 사유', r.rejectReason]);

    const doc = {
      pageSize: 'A4',
      pageMargins: [50, 60, 50, 60],
      defaultStyle: { font: 'NotoSansKR', fontSize: 11 },
      info: { title: `근태 신청서 #${r.id}` },
      content: [
        { text: '근태 신청서', fontSize: 22, bold: true, alignment: 'center', margin: [0, 0, 0, 24] },
        {
          table: {
            widths: [110, '*'],
            body: rows.map(([k, v]) => [
              { text: k, bold: true, fillColor: '#f1f3f5' },
              { text: v },
            ]),
          },
          layout: {
            hLineColor: () => '#ced4da',
            vLineColor: () => '#ced4da',
            paddingTop: () => 6,
            paddingBottom: () => 6,
          },
        },
        {
          margin: [0, 36, 0, 0],
          columns: [
            { text: '' },
            {
              width: 220,
              table: {
                widths: ['*', '*'],
                body: [
                  [{ text: '신청자', alignment: 'center', bold: true }, { text: '승인자', alignment: 'center', bold: true }],
                  [
                    { text: user.name, alignment: 'center', margin: [0, 18, 0, 18] },
                    { text: r.status === 'APPROVED' && reviewer ? reviewer.name : '', alignment: 'center', margin: [0, 18, 0, 18] },
                  ],
                ],
              },
            },
          ],
        },
        {
          text: `출력: ${fmt(this.clock.nowIso())} (서버 시각, Asia/Seoul)`,
          fontSize: 8,
          color: '#868e96',
          margin: [0, 30, 0, 0],
        },
      ],
    };
    return pdfmake.createPdf(doc).getBuffer();
  }
}
