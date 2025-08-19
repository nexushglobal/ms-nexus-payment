import { Module } from '@nestjs/common';
import { FilesService } from './services/files.service';
import { PointsService } from './services/points.service';

@Module({
  providers: [PointsService, FilesService],
  exports: [PointsService, FilesService],
})
export class CommonModule {}
