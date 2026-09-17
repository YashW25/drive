import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

// Import all entities
import { Session } from './src/modules/session/entities/session.entity';
import { Webhook } from './src/modules/webhook/entities/webhook.entity';
import { Message } from './src/modules/message/entities/message.entity';
import { Template } from './src/modules/template/entities/template.entity';
import { BaileysStoredMessage } from './src/engine/adapters/baileys-stored-message.entity';
import { LidMapping } from './src/engine/identity/lid-mapping.entity';
import { MessageBatch } from './src/modules/message/entities/message-batch.entity';

// Main entities
import { ApiKey } from './src/modules/auth/entities/api-key.entity';
import { AuditLog } from './src/modules/audit/entities/audit-log.entity';
import { User } from './src/modules/auth/entities/user.entity';

async function generateSchema() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'password',
    database: 'openwa',
    entities: [
      Session, Webhook, Message, Template, BaileysStoredMessage, LidMapping, MessageBatch,
      ApiKey, AuditLog, User
    ],
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();
  
  // Get all SQL queries to create the schema
  const queries = await dataSource.driver.createSchemaBuilder().log();
  
  let sql = '-- OpenWA Postgres Schema\n\n';
  for (const query of queries.upQueries) {
    sql += query.query + ';\n\n';
  }

  fs.writeFileSync('schema-dump.sql', sql);
  console.log('Schema dumped to schema-dump.sql');
  
  await dataSource.destroy();
}

generateSchema().catch(console.error);
