import { InterceptingCall, type Interceptor } from '@grpc/grpc-js';

export function createDeadlineInterceptor(defaultDeadlineMs: number): Interceptor {
  return (options, nextCall) => {
    if (!options.deadline) {
      options.deadline = new Date(Date.now() + defaultDeadlineMs);
    }
    return new InterceptingCall(nextCall(options));
  };
}
