import { PluginContext } from '../plugin.interfaces';
export type CapabilityContext = Pick<PluginContext, 'messages' | 'engine' | 'storage' | 'net'>;
export declare function dispatchCapabilityVerb(context: CapabilityContext, verb: string, args: unknown[]): Promise<unknown>;
