import { AuthService } from './auth.service';
import { CreateApiKeyDto, UpdateApiKeyDto, ApiKeyResponseDto, ApiKeyCreatedResponseDto } from './dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    create(dto: CreateApiKeyDto): Promise<ApiKeyCreatedResponseDto>;
    findAll(): Promise<ApiKeyResponseDto[]>;
    findOne(id: string): Promise<ApiKeyResponseDto>;
    update(id: string, dto: UpdateApiKeyDto): Promise<ApiKeyResponseDto>;
    delete(id: string): Promise<void>;
    revoke(id: string): Promise<ApiKeyResponseDto>;
}
