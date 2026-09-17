"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginCapabilityError = exports.PluginCapabilityPermission = exports.PluginStatus = exports.PluginType = void 0;
var PluginType;
(function (PluginType) {
    PluginType["ENGINE"] = "engine";
    PluginType["STORAGE"] = "storage";
    PluginType["QUEUE"] = "queue";
    PluginType["AUTH"] = "auth";
    PluginType["EXTENSION"] = "extension";
})(PluginType || (exports.PluginType = PluginType = {}));
var PluginStatus;
(function (PluginStatus) {
    PluginStatus["INSTALLED"] = "installed";
    PluginStatus["ENABLED"] = "enabled";
    PluginStatus["DISABLED"] = "disabled";
    PluginStatus["ERROR"] = "error";
})(PluginStatus || (exports.PluginStatus = PluginStatus = {}));
exports.PluginCapabilityPermission = {
    MESSAGES_SEND: 'messages:send',
    ENGINE_READ: 'engine:read',
    NET_FETCH: 'net:fetch',
};
class PluginCapabilityError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PluginCapabilityError';
    }
}
exports.PluginCapabilityError = PluginCapabilityError;
//# sourceMappingURL=plugin.interfaces.js.map