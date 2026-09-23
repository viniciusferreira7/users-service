import { Body, Controller, type INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString, MinLength } from 'class-validator';
import request from 'supertest';
import { configureApp } from '@/app.setup';

class EchoDto {
  @IsString()
  @MinLength(2)
  name: string;
}

@Controller('echo')
class EchoController {
  @Post()
  echo(@Body() body: EchoDto) {
    return { name: body.name, isDto: body instanceof EchoDto };
  }
}

describe('Global ValidationPipe (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EchoController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects properties outside the DTO whitelist', async () => {
    await request(app.getHttpServer())
      .post('/echo')
      .send({ name: 'Ana', role: 'admin' })
      .expect(400);
  });

  it('rejects a payload that fails validation', async () => {
    await request(app.getHttpServer())
      .post('/echo')
      .send({ name: 'A' })
      .expect(400);
  });

  it('accepts a valid payload and transforms it into the DTO', async () => {
    const response = await request(app.getHttpServer())
      .post('/echo')
      .send({ name: 'Ana' })
      .expect(201);

    expect(response.body).toEqual({ name: 'Ana', isDto: true });
  });
});
