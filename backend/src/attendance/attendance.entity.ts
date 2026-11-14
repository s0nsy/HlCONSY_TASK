import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type DayType = 'WEEKDAY' | 'REMOTE' | 'HOLIDAY_WORK';
export type CheckOutSource = 'BUTTON' | 'MANUAL';

@Entity('attendance')
@Index(['userId', 'workDate'], { unique: true })
export class Attendance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  userId: number;

  /** 출근한 날짜 (C-4) YYYY-MM-DD */
  @Column({ type: 'varchar', length: 10 })
  workDate: string;

  /** ISO UTC, 초 단위 */
  @Column({ type: 'varchar', length: 30 })
  checkInAt: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  checkOutAt: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  checkOutSource: CheckOutSource | null;

  /** 직접 입력한 시점 (서버 시각) */
  @Column({ type: 'varchar', length: 30, nullable: true })
  manualEnteredAt: string | null;

  @Column({ type: 'integer', nullable: true })
  workMinutes: number | null;

  @Column({ type: 'integer', nullable: true })
  lunchMinutes: number | null;

  @Column({ type: 'boolean', default: false })
  isLate: boolean;

  @Column({ type: 'boolean', default: false })
  isEarlyLeave: boolean;

  @Column({ type: 'varchar', length: 15 })
  dayType: DayType;

  /** 반일 OFF 사용일이면 그 OFF 신청 ID */
  @Column({ type: 'integer', nullable: true })
  usedOffRequestId: number | null;

  /** 재택/주말 근무일이면 근거 신청 ID */
  @Column({ type: 'integer', nullable: true })
  workRequestId: number | null;

  @Column({ type: 'varchar', length: 45 })
  checkInIp: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  checkOutIp: string | null;
}
