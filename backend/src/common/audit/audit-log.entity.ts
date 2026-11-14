import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_log')
@Index(['userId', 'serverTime'])
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer', nullable: true })
  userId: number | null;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ type: 'varchar', length: 10 })
  method: string;

  @Column({ type: 'varchar', length: 300 })
  path: string;

  @Column({ type: 'varchar', length: 45 })
  ip: string;

  /** 민감정보 마스킹된 JSON */
  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'varchar', length: 10 })
  result: 'SUCCESS' | 'FAIL';

  @Column({ type: 'integer' })
  statusCode: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  errorCode: string | null;

  /** ClockService 기준 */
  @Column({ type: 'varchar', length: 30 })
  serverTime: string;

  /** 실제 시각 */
  @Column({ type: 'varchar', length: 30 })
  realTime: string;
}
