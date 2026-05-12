export const QUEUE_NAMES = {
  AI_VERIFICATION: 'ai-verification',
  CREATOR_SCORING: 'creator-scoring',
  WEBHOOK_DELIVERY: 'webhook-delivery',
  CAMPAIGN_SUMMARY: 'campaign-summary',
  DATA_FLYWHEEL: 'data-flywheel',
  EMBEDDING: 'embedding',
  GRAPH_ANALYSIS: 'graph-analysis',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
