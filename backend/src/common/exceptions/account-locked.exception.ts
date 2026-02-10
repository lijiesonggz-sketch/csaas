import { HttpException, HttpStatus } from '@nestjs/common'

export class AccountLockedException extends HttpException {
  constructor(lockExpiresIn: number) {
    const minutes = Math.ceil(lockExpiresIn / 60)
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        message: `账户已锁定，请 ${minutes} 分钟后重试`,
        error: 'AccountLocked',
        lockExpiresIn,
      },
      HttpStatus.FORBIDDEN,
    )
  }
}
