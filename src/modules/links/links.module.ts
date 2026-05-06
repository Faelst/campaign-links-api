import { Module } from '@nestjs/common';

import { ProjectsModule } from '../projects/projects.module';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';
import { FinalLinkBuilderService } from './services/final-link-builder.service';

@Module({
  imports: [ProjectsModule],
  controllers: [LinksController],
  providers: [LinksService, FinalLinkBuilderService],
})
export class LinksModule {}
