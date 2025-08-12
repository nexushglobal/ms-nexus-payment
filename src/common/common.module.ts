import { Module } from '@nestjs/common';
import { PointsService } from './services/points.service';

@Module({
  providers: [PointsService],
  exports: [PointsService],
})
export class CommonModule {}
