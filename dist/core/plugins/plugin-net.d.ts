import { withSafeFetch } from '../../common/security/ssrf-guard';
export interface PluginNetRequestInit {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
}
export interface PluginNetResponse {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
}
export declare function isNetHostAllowed(allow: string[] | undefined, url: string): boolean;
export declare function performPluginFetch(url: string, init?: PluginNetRequestInit, deps?: {
    fetch?: typeof withSafeFetch;
}): Promise<PluginNetResponse>;
