import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PinoLoggerService } from '@viniciusferreira7/signals/nest';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { EnvService } from './env/env.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const envService = app.get(EnvService);
  const port = envService.get('PORT');

  app.useLogger(app.get(PinoLoggerService));

  configureApp(app);

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀  Users service running on port ${port}`);
}

bootstrap();
