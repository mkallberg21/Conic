// DI token for the shared ioredis client. Kept in its own file so cache.service
// and cache.module don't form a circular import (which left the @Inject() token
// undefined at decoration time and broke DI resolution at boot).
export const REDIS_CLIENT = 'REDIS_CLIENT';
