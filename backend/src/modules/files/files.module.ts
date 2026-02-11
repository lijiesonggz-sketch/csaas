import { Module } from '@nestjs/common'
import { FilesController } from './controllers/files.controller'
import { FilesService } from './services/files.service'
import { MulterModule } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { TypeOrmModule } from '@nestjs/typeorm'
import { StandardDocument } from '@/database/entities/standard-document.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([StandardDocument]),
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
