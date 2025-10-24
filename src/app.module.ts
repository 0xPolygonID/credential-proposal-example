import { Module } from '@nestjs/common';
import { AgentModule } from './agent/agent.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AgentModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'static'),
      exclude: ['/agent'],
    }),
  ],
})
export class AppModule {}
