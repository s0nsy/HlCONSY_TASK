import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Audit } from '../common/decorators.js';
import { User } from './user.entity.js';

@Controller('users')
export class UsersController {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  /** 필터·팀원 선택용 (비밀번호 해시 제외) */
  @Get()
  @Audit('USER_LIST')
  async list() {
    const rows = await this.users.find({ order: { id: 'ASC' } });
    return { items: rows.map((u) => ({ id: u.id, loginId: u.loginId, name: u.name, role: u.role, joinDate: u.joinDate })) };
  }
}
