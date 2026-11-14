import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** 연구실 IP (상시 허용) */
@Entity('allowed_ip')
export class AllowedIp {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 45, unique: true })
  ip: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  label: string;

  /** ISO (서버 시각) */
  @Column({ type: 'varchar', length: 30 })
  createdAt: string;
}
