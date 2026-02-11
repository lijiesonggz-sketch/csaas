import { Module } from '@nestjs/common'
import { FilesController } from './controllers/files.controller'
import { FilesService } from './services/files.service'
import { MulterModule } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { TypeOrmModule } from '@nestjs/typeorm'
import { StandardDocument } from '@/database/entities/standard-document.entity'
import { Project } from '@/database/entities/project.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([StandardDocument, Project]),
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        // 处理中文文件名编码问题（Windows 系统上文件名可能使用 Latin1 编码）
        if (file.originalname) {
          try {
            // 尝试修复可能的编码问题
            const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8')
            // 验证解码是否成功（如果解码后包含乱码特征，则保留原样）
            if (decodedName.includes('�') || /[\u0000-\u0019]/.test(decodedName)) {
              // 解码失败，保留原始文件名
              file.originalname = file.originalname
            } else {
              file.originalname = decodedName
            }
          } catch {
            // 解码失败，保留原始文件名
          }
        }
        cb(null, true)
      },
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
