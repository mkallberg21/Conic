import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue.module';
import { GraphService } from '../../modules/graph/graph.service';

export interface GraphAnalysisJobData {
  /** 'node' — update a single creator's graph metrics + edges */
  scope: 'node' | 'cluster' | 'global';
  creatorId?: string;
}

@Processor(QUEUE_NAMES.GRAPH_ANALYSIS)
export class GraphAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(GraphAnalysisProcessor.name);

  constructor(private readonly graph: GraphService) {
    super();
  }

  async process(job: Job<GraphAnalysisJobData>): Promise<void> {
    const { scope, creatorId } = job.data;
    this.logger.log(`Graph analysis job scope=${scope} creator=${creatorId ?? 'all'}`);

    switch (scope) {
      case 'node':
        if (!creatorId) {
          this.logger.warn('Graph analysis node job missing creatorId');
          return;
        }
        await this.graph.upsertNode(creatorId);
        await this.graph.buildNicheEdges(creatorId);
        break;

      case 'cluster':
        await this.graph.recomputeClusters();
        break;

      case 'global':
        await this.graph.recomputeClusters();
        break;

      default:
        this.logger.warn(`Unknown graph analysis scope: ${scope}`);
    }
  }
}
