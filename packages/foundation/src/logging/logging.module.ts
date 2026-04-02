import crypto from 'node:crypto';
import { Module, DynamicModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ClsModule } from 'nestjs-cls';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Metadata } from '@grpc/grpc-js';
import type { LogFormat, LogLevel } from '@email-platform/config';
import { HEADER, CONTEXT_TYPE } from '../constants';
import { GrpcCorrelationInterceptor } from './correlation.interceptor';
import { GrpcLoggingInterceptor } from './grpc-logging.interceptor';
import { AllRpcExceptionsFilter } from '../errors/rpc-exception.filter';
import { resolveTransport } from './log-transport';

@Module({})
export class LoggingModule {
  static forHttp(logLevel: LogLevel, logFormat: LogFormat): DynamicModule {
    return {
      module: LoggingModule,
      imports: [
        ClsModule.forRoot({
          global: true,
          middleware: {
            mount: true,
            generateId: true,
            idGenerator: (req: Request) =>
              (req.headers[HEADER.CORRELATION_ID] as string) || crypto.randomUUID(),
          },
        }),
        PinoLoggerModule.forRoot({
          pinoHttp: {
            level: logLevel,
            genReqId: (req) =>
              ((req as unknown as Request).headers[HEADER.CORRELATION_ID] as string) ||
              crypto.randomUUID(),
            transport: resolveTransport(logFormat),
            serializers: {
              req: (req) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
              res: (res) => ({
                statusCode: res.statusCode,
              }),
            },
          },
        }),
      ],
      exports: [ClsModule, PinoLoggerModule],
    };
  }

  static forGrpc(logLevel: LogLevel, logFormat: LogFormat): DynamicModule {
    return {
      module: LoggingModule,
      imports: [
        ClsModule.forRoot({
          global: true,
          interceptor: {
            mount: true,
            generateId: true,
            idGenerator: (ctx: ExecutionContext) => {
              if (ctx.getType() === CONTEXT_TYPE.RPC) {
                const metadata = ctx.switchToRpc().getContext<Metadata>();
                const id = metadata.get(HEADER.CORRELATION_ID)[0];
                return (id as string) || crypto.randomUUID();
              }
              return crypto.randomUUID();
            },
          },
        }),
        PinoLoggerModule.forRoot({
          pinoHttp: {
            level: logLevel,
            autoLogging: false,
            transport: resolveTransport(logFormat),
          },
        }),
      ],
      providers: [
        GrpcCorrelationInterceptor,
        GrpcLoggingInterceptor,
        { provide: APP_INTERCEPTOR, useClass: GrpcCorrelationInterceptor },
        { provide: APP_INTERCEPTOR, useClass: GrpcLoggingInterceptor },
        { provide: APP_FILTER, useClass: AllRpcExceptionsFilter },
      ],
      exports: [ClsModule, PinoLoggerModule, GrpcCorrelationInterceptor, GrpcLoggingInterceptor],
    };
  }

  static forHttpAsync(): DynamicModule {
    return {
      module: LoggingModule,
      imports: [
        ClsModule.forRoot({
          global: true,
          middleware: {
            mount: true,
            generateId: true,
            idGenerator: (req: Request) =>
              (req.headers[HEADER.CORRELATION_ID] as string) || crypto.randomUUID(),
          },
        }),
        PinoLoggerModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const logLevel = configService.get<string>('LOG_LEVEL') as LogLevel;
            const logFormat = configService.get<string>('LOG_FORMAT') as LogFormat;
            return {
              pinoHttp: {
                level: logLevel,
                genReqId: (req) =>
                  ((req as unknown as Request).headers[HEADER.CORRELATION_ID] as string) ||
                  crypto.randomUUID(),
                transport: resolveTransport(logFormat),
                serializers: {
                  req: (req) => ({
                    id: req.id,
                    method: req.method,
                    url: req.url,
                  }),
                  res: (res) => ({
                    statusCode: res.statusCode,
                  }),
                },
              },
            };
          },
        }),
      ],
      exports: [ClsModule, PinoLoggerModule],
    };
  }

  static forGrpcAsync(): DynamicModule {
    return {
      module: LoggingModule,
      imports: [
        ClsModule.forRoot({
          global: true,
          interceptor: {
            mount: true,
            generateId: true,
            idGenerator: (ctx: ExecutionContext) => {
              if (ctx.getType() === CONTEXT_TYPE.RPC) {
                const metadata = ctx.switchToRpc().getContext<Metadata>();
                const id = metadata.get(HEADER.CORRELATION_ID)[0];
                return (id as string) || crypto.randomUUID();
              }
              return crypto.randomUUID();
            },
          },
        }),
        PinoLoggerModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const logLevel = configService.get<string>('LOG_LEVEL') as LogLevel;
            const logFormat = configService.get<string>('LOG_FORMAT') as LogFormat;
            return {
              pinoHttp: {
                level: logLevel,
                autoLogging: false,
                transport: resolveTransport(logFormat),
              },
            };
          },
        }),
      ],
      providers: [
        GrpcCorrelationInterceptor,
        GrpcLoggingInterceptor,
        { provide: APP_INTERCEPTOR, useClass: GrpcCorrelationInterceptor },
        { provide: APP_INTERCEPTOR, useClass: GrpcLoggingInterceptor },
        { provide: APP_FILTER, useClass: AllRpcExceptionsFilter },
      ],
      exports: [ClsModule, PinoLoggerModule, GrpcCorrelationInterceptor, GrpcLoggingInterceptor],
    };
  }
}
