import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { type DynamicModule, Global, Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuard, RolesGuard } from './auth/auth.guards.js';
import { AllExceptionsFilter } from './common/audit/all-exceptions.filter.js';
import { AuditInterceptor } from './common/audit/audit.interceptor.js';
import { IpGuard } from './common/ip/ip.guard.js';
import { APP_CONFIG, type AppConfig, loadConfig } from './config/app-config.js';
import { ENTITIES } from './database/entities.js';
import {
  AttendanceModule,
  AuthModule,
  BalanceModule,
  CommonModule,
  DashboardModule,
  DatabaseModule,
  DevModule,
  RequestsModule,
  SeedModule,
  SettlementModule,
  UsersModule,
} from './modules.js';

@Global()
@Module({})
class ConfigHolderModule {
  static with(config: AppConfig): DynamicModule {
    return {
      module: ConfigHolderModule,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}

/**
 * 앱 전체 (Observe 제외). 테스트는 CoreModule.forRoot({ databasePath: ':memory:' }) 로 띄운다.
 */
@Module({})
export class CoreModule {
  static forRoot(overrides: Partial<AppConfig> = {}): DynamicModule {
    const config = loadConfig(overrides);
    if (config.databasePath !== ':memory:') {
      mkdirSync(dirname(config.databasePath), { recursive: true });
    }
    return {
      module: CoreModule,
      imports: [
        ConfigHolderModule.with(config),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: config.databasePath,
          entities: ENTITIES,
          // 개발 편의: 스키마 자동 동기화. 운영(PostgreSQL)에서는 마이그레이션으로 바꾼다.
          synchronize: true,
        }),
        DatabaseModule,
        CommonModule,
        AuthModule,
        UsersModule,
        BalanceModule,
        RequestsModule,
        AttendanceModule,
        DashboardModule,
        SettlementModule,
        SeedModule,
        ...(config.enableTimeTravel ? [DevModule] : []),
      ],
      providers: [
        // 가드는 등록 순서대로 실행된다: IP → 로그인 → 역할
        { provide: APP_GUARD, useExisting: IpGuard },
        { provide: APP_GUARD, useExisting: AuthGuard },
        { provide: APP_GUARD, useExisting: RolesGuard },
        { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_PIPE, useValue: new StandardSchemaValidationPipe() },
      ],
    };
  }
}
