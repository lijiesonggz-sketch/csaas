import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CurrentStateController } from './current-state.controller'
import { CurrentStateService } from './current-state.service'
import { CurrentStateDescription } from '../../database/entities/current-state-description.entity'

/**
 * 现状描述模块
 */
@Module({
  imports: [TypeOrmModule.forFeature([CurrentStateDescription])],
  controllers: [CurrentStateController],
  providers: [CurrentStateService],
  exports: [CurrentStateService],
})
export class CurrentStateModule {}
