import { NestFactory } from '@nestjs/core'
import { AppModule } from '../src/app.module'
import type { INestApplicationContext } from '@nestjs/common'

async function main(): Promise<void> {
  console.log('[app:bootstrap:check] bootstrapping AppModule via createApplicationContext')
  let app: INestApplicationContext | null = null

  try {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'],
    })
    console.log('[app:bootstrap:check] AppModule bootstrap succeeded')
  } finally {
    if (app) {
      await app.close()
    }
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('[app:bootstrap:check] failed')
    console.error(error)
    process.exit(1)
  })
