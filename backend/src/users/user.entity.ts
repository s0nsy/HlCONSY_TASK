import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type Role = 'MEMBER' | 'LEAD';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  loginId: string;

  @Column({ type: 'varchar', length: 100 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'varchar', length: 10 })
  role: Role;

  /** YYYY-MM-DD */
  @Column({ type: 'varchar', length: 10 })
  joinDate: string;
}
