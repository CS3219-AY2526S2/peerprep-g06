import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import { connectRedis } from './config/redis';
import { logger } from './utils/logger';

// load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        // TODO: configure to frontend url when deployed
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

// middleware
app.use(cors());
app.use(express.json());

// basic health check route
app.get('/health', (req, res) => {
    res.status(200).json({ message: 'Matching service is running' });
});

// socket.io connection handler
io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.id}`);
});

// socket.io disconnection handler
io.on('disconnect', (socket) => {
    logger.info(`User disconnected: ${socket.id}`);
});

const PORT = process.env.PORT;

async function startServer() {
    try {
        await connectRedis();
        server.listen(PORT, () => {
            logger.info(`Matching service listening on port ${PORT}`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();