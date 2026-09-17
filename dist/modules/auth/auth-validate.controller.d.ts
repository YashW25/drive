import { AuthService } from './auth.service';
export declare class AuthValidateController {
    private readonly authService;
    private readonly logger;
    constructor(authService: AuthService);
    validate(apiKey?: string): Promise<{
        valid: boolean;
        role?: string;
    }>;
}
