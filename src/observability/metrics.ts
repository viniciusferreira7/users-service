import { defineMetrics } from '@viniciusferreira7/signals';

export const metrics = defineMetrics(
  {
    auth_operations: {
      kind: 'counter',
      description: 'Register, login and token checks, by operation and outcome',
    },
    auth_operation_duration: {
      kind: 'histogram',
      description: 'Time spent on one authentication operation',
      unit: 'ms',
    },
  },
  'users-service'
);
