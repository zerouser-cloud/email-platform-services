import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadGlobalConfig } from './config-loader';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadGlobalConfig],
      ignoreEnvFile: true,
      cache: true,
    }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}
