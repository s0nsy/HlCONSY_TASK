/**
 * 기능 모듈 정의. (파일 수를 줄이려고 한 파일에 모았다)
 */
import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceController } from './attendance/attendance.controller.js';
import { AttendanceService } from './attendance/attendance.service.js';
import { AuthController } from './auth/auth.controller.js';
import { minutes, ThrottlerModule } from '@nestjs/throttler';
import { AuthGuard, LoginThrottlerGuard, RolesGuard } from './auth/auth.guards.js';
import { AuthService } from './auth/auth.service.js';
import { BalanceController } from './balance/balance.controller.js';
import { BalanceService } from './balance/balance.service.js';
import { AuditController } from './common/audit/audit.controller.js';
import { AuditService } from './common/audit/audit.service.js';
import { BusinessDayService } from './common/calendar/business-day.service.js';
import { HolidaysController } from './common/calendar/holidays.controller.js';
import { ClockController } from './common/clock/clock.controller.js';
import { ClockService } from './common/clock/clock.service.js';
import { IpGuard } from './common/ip/ip.guard.js';
import { APP_CONFIG, type AppConfig } from './config/app-config.js';
import { DashboardController } from './dashboard/dashboard.controller.js';
import { DashboardService } from './dashboard/dashboard.service.js';
import { ENTITIES } from './database/entities.js';
import { DevController } from './dev/dev.controller.js';
import { ScenarioService } from './dev/scenario.service.js';
import { RequestPdfService } from './requests/request-pdf.service.js';
import { RequestsController } from './requests/requests.controller.js';
import { RequestsService } from './requests/requests.service.js';
import { SeedService } from './seed/seed.service.js';
import { SettlementController } from './settlement/settlement.controller.js';
import { SettlementService } from './settlement/settlement.service.js';
import { UsersController } from './users/users.controller.js';

/** 모든 엔티티 리포지토리를 전역으로 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES)],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

/** common/: Clock · Calendar · Audit (전역) */
@Global()
@Module({
  controllers: [ClockController, HolidaysController, AuditController],
  providers: [ClockService, BusinessDayService, AuditService],
  exports: [ClockService, BusinessDayService, AuditService],
})
export class CommonModule {}

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (c: AppConfig) => ({ secret: c.jwtSecret, signOptions: { expiresIn: '12h' } }),
    }),
    // 로그인 시도 제한 (LoginThrottlerGuard 가 로그인 라우트에만 적용)
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: minutes(1), limit: 10, blockDuration: minutes(5) }],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, IpGuard, AuthGuard, RolesGuard, LoginThrottlerGuard],
  exports: [AuthService, IpGuard, AuthGuard, RolesGuard],
})
export class AuthModule {}

@Module({ controllers: [UsersController] })
export class UsersModule {}

@Module({ providers: [BalanceService], exports: [BalanceService] })
export class BalanceModule {}

/** 신청 + 잔여 API (잔여 조회 전에 미승인 만료 처리를 해야 해서 BalanceController 도 여기 둔다) */
@Module({
  imports: [BalanceModule],
  controllers: [RequestsController, BalanceController],
  providers: [RequestsService, RequestPdfService],
  exports: [RequestsService],
})
export class RequestsModule {}

@Module({
  imports: [BalanceModule, RequestsModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}

@Module({
  imports: [BalanceModule, RequestsModule, AttendanceModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

@Module({
  imports: [BalanceModule, RequestsModule],
  controllers: [SettlementController],
  providers: [SettlementService],
})
export class SettlementModule {}

/** ENABLE_TIME_TRAVEL=true 일 때만 import 된다 */
@Module({
  imports: [RequestsModule, AttendanceModule],
  controllers: [DevController],
  providers: [ScenarioService],
})
export class DevModule {}

@Module({ providers: [SeedService], exports: [SeedService] })
export class SeedModule {}
