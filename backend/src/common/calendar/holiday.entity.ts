import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('holiday')
export class Holiday {
  /** YYYY-MM-DD */
  @PrimaryColumn({ type: 'varchar', length: 10 })
  date: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;
}
