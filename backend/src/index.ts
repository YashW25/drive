import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import folderRoutes from './routes/folder.routes.js';
import fileRoutes from './routes/file.routes.js';
import shareRoutes from './routes/share.routes.js';
import aiRoutes from './routes/ai.routes.js';
import googleRoutes from './routes/google.routes.js';

dotenv.config();

// Patch BigInt serialization for JSON (Prisma uses BigInt for sizes)
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Body Parsers
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static storage files if running local storage provider
app.use('/storage', express.static(path.resolve(process.env.LOCAL_STORAGE_DIR || './storage_data')));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    appName: process.env.APP_NAME || 'Zentro Drive',
    timestamp: new Date().toISOString(),
  });
});

// Routes Registration
app.use('/api/auth', authRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/google', googleRoutes);

// Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 [Zentro Drive API Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
