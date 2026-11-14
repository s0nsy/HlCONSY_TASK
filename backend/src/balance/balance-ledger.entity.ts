import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type BalanceKind = 'ANNUAL' | 'REMOTE' | 'OFF';

/**
 * 잔여 원장. 잔여는 저장하지 않고 이 행들의 합으로 매번 계산한다 (L-9).
 *  - ANNUAL: 사용 예약 -1 / 반환 +1  (적립은 순수 함수로 계산해 화면에 합쳐 보여준다)
 *  - REMOTE: 사용 예약 -1 / 반환 +1  (effectiveDate 가 속한 달 한도에서 차감)
 *  - OFF   : 지급 +1 / 사용 예약 -1 / 반환 +1  (사용·반환은 grantLedgerId 로 지급 행에 연결)
 */
@Entity('balance_ledger')
@Index(['userId', 'kind'])
export class BalanceLedger {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  userId: number;

  @Column({ type: 'varchar', length: 10 })
  kind: BalanceKind;

  @Column({ type: 'integer' })
  delta: number;

  @Column({ type: 'varchar', length: 200 })
  reason: string;

  @Column({ type: 'integer', nullable: true })
  requestId: number | null;

  @Column({ type: 'integer', nullable: true })
  attendanceId: number | null;

  /** OFF 사용/반환 행이 가리키는 지급 행 */
  @Column({ type: 'integer', nullable: true })
  grantLedgerId: number | null;

  /** 효력 날짜: OFF 지급 = 근무일, 사용 = 사용일 (YYYY-MM-DD) */
  @Column({ type: 'varchar', length: 10 })
  effectiveDate: string;

  /** 기록 시각 (서버 시각, ISO) */
  @Column({ type: 'varchar', length: 30 })
  occurredAt: string;

  /** OFF 지급 행만: 만료 순간 ISO */
  @Column({ type: 'varchar', length: 30, nullable: true })
  expiresAt: string | null;
}
