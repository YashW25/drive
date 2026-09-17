"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const load_cli_env_1 = require("./load-cli-env");
(0, load_cli_env_1.loadCliEnv)();
const dbType = process.env.DATABASE_TYPE || 'sqlite';
const sqliteDataSource = new typeorm_1.DataSource({
    type: 'sqlite',
    database: process.env.DATABASE_NAME || './data/openwa.sqlite',
    entities: [
        __dirname + '/../modules/session/**/*.entity{.ts,.js}',
        __dirname + '/../modules/webhook/**/*.entity{.ts,.js}',
        __dirname + '/../modules/message/**/*.entity{.ts,.js}',
        __dirname + '/../modules/template/**/*.entity{.ts,.js}',
        __dirname + '/../engine/**/*.entity{.ts,.js}',
    ],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: false,
    logging: process.env.DATABASE_LOGGING === 'true',
});
const postgresDataSource = new typeorm_1.DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'openwa',
    entities: [
        __dirname + '/../modules/session/**/*.entity{.ts,.js}',
        __dirname + '/../modules/webhook/**/*.entity{.ts,.js}',
        __dirname + '/../modules/message/**/*.entity{.ts,.js}',
        __dirname + '/../modules/template/**/*.entity{.ts,.js}',
        __dirname + '/../engine/**/*.entity{.ts,.js}',
    ],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: false,
    logging: process.env.DATABASE_LOGGING === 'true',
    ssl: process.env.DATABASE_SSL === 'true'
        ? {
            rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
        }
        : false,
    extra: {
        max: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
        idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT_MS || '30000', 10),
        connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT_MS || '10000', 10),
    },
});
exports.default = dbType === 'postgres' ? postgresDataSource : sqliteDataSource;
//# sourceMappingURL=data-source.js.map