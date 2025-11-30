import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // not needed now but let it be for future
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,       // strips unknown properties (not defined in DTOs)
    transform: true,       // automatically transform payloads to DTO classes
  }));

  await app.listen(process.env.SERVER_PORT || 8000);
}

bootstrap();
