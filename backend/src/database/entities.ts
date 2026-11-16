import { Attendance } from '../attendance/attendance.entity.js';
import { BalanceLedger } from '../balance/balance-ledger.entity.js';
import { AuditLog } from '../common/audit/audit-log.entity.js';
import { Holiday } from '../common/calendar/holiday.entity.js';
import { AllowedIp } from '../common/ip/allowed-ip.entity.js';
import { WorkRequest } from '../requests/request.entity.js';
import { RevokedToken } from '../auth/revoked-token.entity.js';
import { User } from '../users/user.entity.js';

export const ENTITIES = [
  User,
  AllowedIp,
  Holiday,
  Attendance,
  WorkRequest,
  BalanceLedger,
  AuditLog,
  RevokedToken,
];
