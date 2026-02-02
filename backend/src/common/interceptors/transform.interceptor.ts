import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export interface Response<T> {
  success: boolean
  data?: T
  message?: string
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T> | T> {
    const response = context.switchToHttp().getResponse()
    const statusCode = response.statusCode

    // Don't transform 204 responses (DELETE operations)
    if (statusCode === HttpStatus.NO_CONTENT) {
      return next.handle()
    }

    return next.handle().pipe(
      map((data) => {
        // If data already has success property, assume it's already formatted
        if (data && typeof data === 'object' && 'success' in data) {
          return data
        }

        // Don't wrap void/null responses
        if (data === null || data === undefined) {
          return data
        }

        // Transform to standard format
        return {
          success: true,
          data,
        }
      }),
    )
  }
}
