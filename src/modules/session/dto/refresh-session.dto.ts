import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsNumber, IsIn, Min, Max } from 'class-validator';

export class RefreshAllSessionsDto {
  @ApiPropertyOptional({
    enum: ['sessions', 'service'],
    default: 'sessions',
    description: 'Refresh mode: "sessions" (in-memory clean restart) or "service" (full container/service restart)',
  })
  @IsOptional()
  @IsIn(['sessions', 'service'])
  mode?: 'sessions' | 'service';
}

export class UpdateRefreshConfigDto {
  @ApiPropertyOptional({ description: 'Enable or disable automatic scheduled refreshment' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Interval in hours between auto-refreshes (e.g. 4, 6, 12, 24)',
    minimum: 1,
    maximum: 168,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  intervalHours?: number;

  @ApiPropertyOptional({
    enum: ['sessions', 'service'],
    description: 'Refresh mode: "sessions" or "service"',
  })
  @IsOptional()
  @IsIn(['sessions', 'service'])
  mode?: 'sessions' | 'service';
}

export class AutoRefreshConfigDto {
  @ApiProperty({ description: 'Whether scheduled auto-refresh is active' })
  enabled: boolean;

  @ApiProperty({ description: 'Interval in hours' })
  intervalHours: number;

  @ApiProperty({ enum: ['sessions', 'service'], description: 'Refresh mode' })
  mode: 'sessions' | 'service';

  @ApiProperty({ nullable: true, description: 'ISO timestamp of last successful refresh' })
  lastRefreshAt: string | null;

  @ApiProperty({ nullable: true, description: 'ISO timestamp of next scheduled refresh' })
  nextRefreshAt: string | null;

  @ApiProperty({ description: 'Total number of auto-refreshes performed' })
  totalRefreshesDone: number;
}
