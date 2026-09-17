import { OpenAPIObject } from '@nestjs/swagger';
export declare const API_KEY_SECURITY_SCHEME = "X-API-Key";
export declare function createSwaggerConfig(): Omit<OpenAPIObject, 'paths'>;
