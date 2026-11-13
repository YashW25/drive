import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsEnum, IsOptional, IsArray, IsNumber, Min, Max } from 'class-validator';
import { AiTriggerType } from '../entities/ai-rule.entity';

export class CreateAiRuleDto {
  @ApiProperty({ description: 'Rule name', example: 'Support Auto-Reply' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Whether rule is enabled', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Session ID to monitor, or * for all', default: '*' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Session name for UI display', default: 'All Sessions' })
  @IsOptional()
  @IsString()
  sessionName?: string;

  @ApiPropertyOptional({ description: 'Trigger type', enum: AiTriggerType, default: AiTriggerType.ALL })
  @IsOptional()
  @IsEnum(AiTriggerType)
  triggerType?: AiTriggerType;

  @ApiPropertyOptional({ description: 'List of phone numbers (when triggerType = specific)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specificNumbers?: string[];

  @ApiPropertyOptional({ description: 'List of keywords (when triggerType = custom_keyword)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customKeywords?: string[];

  @ApiPropertyOptional({ description: 'AI Endpoint', default: 'https://ai.innovaradynamics.in/v1/chat' })
  @IsOptional()
  @IsString()
  aiEndpoint?: string;

  @ApiPropertyOptional({ description: 'AI API Key' })
  @IsOptional()
  @IsString()
  aiApiKey?: string;

  @ApiPropertyOptional({ description: 'Custom system prompt / instructions for the AI' })
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @ApiPropertyOptional({ description: 'Cooldown in seconds per contact', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3600)
  cooldownSeconds?: number;

  @ApiPropertyOptional({ description: 'Max completion tokens', default: 80 })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(512)
  maxTokens?: number;
}

export class UpdateAiRuleDto {
  @ApiPropertyOptional({ description: 'Rule name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Whether rule is enabled' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Session ID to monitor, or * for all' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Session name for UI display' })
  @IsOptional()
  @IsString()
  sessionName?: string;

  @ApiPropertyOptional({ description: 'Trigger type', enum: AiTriggerType })
  @IsOptional()
  @IsEnum(AiTriggerType)
  triggerType?: AiTriggerType;

  @ApiPropertyOptional({ description: 'List of phone numbers', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specificNumbers?: string[];

  @ApiPropertyOptional({ description: 'List of keywords', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customKeywords?: string[];

  @ApiPropertyOptional({ description: 'AI Endpoint' })
  @IsOptional()
  @IsString()
  aiEndpoint?: string;

  @ApiPropertyOptional({ description: 'AI API Key' })
  @IsOptional()
  @IsString()
  aiApiKey?: string;

  @ApiPropertyOptional({ description: 'Custom system prompt / instructions for the AI' })
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @ApiPropertyOptional({ description: 'Cooldown in seconds per contact' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3600)
  cooldownSeconds?: number;

  @ApiPropertyOptional({ description: 'Max completion tokens' })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(512)
  maxTokens?: number;
}

export class TestAiDto {
  @ApiPropertyOptional({ description: 'AI Endpoint URL' })
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiPropertyOptional({ description: 'AI API Key' })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiProperty({ description: 'Message to test with', example: 'Hello, what services do you provide?' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'System prompt override' })
  @IsOptional()
  @IsString()
  systemPrompt?: string;
}

export class ScanUnrepliedDto {
  @ApiPropertyOptional({ description: 'Specific session ID to scan, or * for all' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Max age of chats to scan in hours', default: 48 })
  @IsOptional()
  @IsNumber()
  maxAgeHours?: number;

  @ApiPropertyOptional({ description: 'Whether to only preview without sending replies', default: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
