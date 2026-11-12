import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { CreateAiRuleDto, UpdateAiRuleDto, TestAiDto } from './dto/ai-rule.dto';
import { AiAutoReplyRule } from './entities/ai-rule.entity';
import { RequireRole, CurrentUser } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('rules')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'List all AI auto-reply rules' })
  @ApiResponse({ status: 200, description: 'List of AI rules' })
  async listRules(@CurrentUser() user?: { supabaseId?: string }): Promise<AiAutoReplyRule[]> {
    return this.aiService.findAll(user?.supabaseId);
  }

  @Post('rules')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Create an AI auto-reply rule' })
  @ApiResponse({ status: 201, description: 'Created AI rule' })
  async createRule(
    @Body() dto: CreateAiRuleDto,
    @CurrentUser() user?: { supabaseId?: string },
  ): Promise<AiAutoReplyRule> {
    return this.aiService.create(dto, user?.supabaseId);
  }

  @Get('rules/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Get a specific AI auto-reply rule' })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  async getRule(@Param('id') id: string): Promise<AiAutoReplyRule> {
    return this.aiService.findOne(id);
  }

  @Put('rules/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Update an AI auto-reply rule' })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  async updateRule(@Param('id') id: string, @Body() dto: UpdateAiRuleDto): Promise<AiAutoReplyRule> {
    return this.aiService.update(id, dto);
  }

  @Delete('rules/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an AI auto-reply rule' })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  async deleteRule(@Param('id') id: string): Promise<void> {
    return this.aiService.delete(id);
  }

  @Post('test')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Test AI Assistant completion from dashboard' })
  async testAi(@Body() dto: TestAiDto) {
    return this.aiService.testAi(dto);
  }
}
