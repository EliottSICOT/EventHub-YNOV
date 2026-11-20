import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/pagination-meta.dto.js';
import { EventSummaryDto } from './event-summary.dto.js';

export class PaginatedEventsDto {
  @ApiProperty({ type: [EventSummaryDto] })
  data: EventSummaryDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
