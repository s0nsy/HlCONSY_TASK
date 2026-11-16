import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * 로그아웃한 토큰(jti) 차단 목록. 토큰이 원래 만료되는 시각이 지나면 필요 없으므로 지운다.
 * 사용자 단위가 아니라 토큰 단위라, 같은 계정의 다른 기기·탭 세션은 그대로 둔다.
 */
@Entity('revoked_token')
export class RevokedToken {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  jti: string;

  /** 토큰의 exp (epoch 초, 실제 시각 기준) */
  @Column({ type: 'integer' })
  expiresAt: number;
}
