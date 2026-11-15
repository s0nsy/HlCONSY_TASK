import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type RequestType = 'ANNUAL' | 'REMOTE' | 'OFF' | 'HOLIDAY_WORK';
/** EXPIRED: 사용일이 될 때까지 승인되지 않아 효력을 잃은 건 (R-9, docs/policy.md D-3) */
export type RequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELED'
  | 'EXPIRED';
export type OffHalf = 'AM' | 'PM';

export const REQUEST_TYPES: RequestType[] = [
  'ANNUAL',
  'REMOTE',
  'OFF',
  'HOLIDAY_WORK',
];
export const ACTIVE_STATUSES: RequestStatus[] = ['PENDING', 'APPROVED'];

@Entity('request')
@Index(['userId', 'targetDate'])
export class WorkRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  userId: number;

  @Column({ type: 'varchar', length: 15 })
  type: RequestType;

  @Column({ type: 'varchar', length: 10 })
  targetDate: string;

  @Column({ type: 'text' })
  reason: string;

  /** REMOTE / HOLIDAY_WORK */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  /** HH:mm */
  @Column({ type: 'varchar', length: 5, nullable: true })
  startTime: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  endTime: string | null;

  /** OFF 표시용 */
  @Column({ type: 'varchar', length: 2, nullable: true })
  offHalf: OffHalf | null;

  @Column({ type: 'varchar', length: 10 })
  status: RequestStatus;

  @Column({ type: 'integer', nullable: true })
  reviewerId: number | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  reviewedAt: string | null;

  @Column({ type: 'text', nullable: true })
  rejectReason: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  canceledAt: string | null;

  /** 서버 시각 */
  @Column({ type: 'varchar', length: 30 })
  createdAt: string;
}
