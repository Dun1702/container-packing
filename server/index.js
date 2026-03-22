const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);

// Socket.io setup
let io;
try {
    io = socketIO(server, {
        cors: {
            origin: process.env.CLIENT_URL || '*',
            credentials: true
        },
        transports: ['websocket', 'polling']
    });
    console.log('✅ Socket.IO initialized');
} catch (error) {
    console.error('❌ Socket.IO error:', error);
    io = null;
}

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(compression());
app.use(cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    skip: () => process.env.NODE_ENV === 'development'
});
app.use('/api/', limiter);

// Static files
const publicPath = path.join(__dirname, '../');
app.use(express.static(path.join(__dirname, '../public')));
console.log('📁 Serving static files from:', publicPath);

// Database connection
const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/container-packing-pro';
        console.log('🔌 Connecting to MongoDB:', mongoURI);
        
        const conn = await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000
        });
        
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        console.log('⚠️ Server will continue without database');
        return null;
    }
};

// Socket.io events
if (io) {
    io.on('connection', (socket) => {
        console.log('🔌 New client connected:', socket.id);
        
        socket.on('join-project', (projectId) => {
            socket.join(`project-${projectId}`);
            console.log(`👥 User joined project: ${projectId}`);
        });
        
        socket.on('leave-project', (projectId) => {
            socket.leave(`project-${projectId}`);
            console.log(`👋 User left project: ${projectId}`);
        });
        
        socket.on('box-update', (data) => {
            socket.to(`project-${data.projectId}`).emit('box-changed', data);
        });
        
        socket.on('disconnect', () => {
            console.log('🔌 Client disconnected:', socket.id);
        });
    });
    app.set('io', io);
}

// Routes
console.log('📂 Loading routes...');

try {
    app.use('/api/auth', authRoutes);
    console.log('  ✅ /api/auth loaded');
    app.use('/api/projects', projectRoutes);
    console.log('  ✅ /api/projects loaded');
    app.use('/api', apiRoutes);
    console.log('  ✅ /api loaded');
} catch (error) {
    console.error('❌ Error loading routes:', error);
}

// Admin initialization
const DEFAULT_ADMIN = {
    username: 'admin',
    email: 'admin@containerpacking.com',
    password: '$2a$10$rQ8H5zXqZqZqZqZqZqZqZu',
    fullName: 'Administrator',
    role: 'admin',
    subscription: {
        plan: 'enterprise',
        features: {
            maxBoxes: Infinity,
            aiPro: true,
            collaboration: true,
            api: true,
            exportFormats: ['png', 'pdf', 'excel', 'csv', 'json'],
            maxProjects: Infinity
        }
    },
    emailVerified: true
};

const initAdminUser = async () => {
    try {
        const User = require('./models/User');
        const bcrypt = require('bcryptjs');
        
        const existingAdmin = await User.findOne({ username: 'admin' });
        if (existingAdmin) {
            console.log('✅ Admin user already exists');
            return;
        }
        
        const hashedPassword = await bcrypt.hash('123456', 10);
        
        const admin = new User({
            username: 'admin',
            email: 'admin@containerpacking.com',
            password: hashedPassword,
            fullName: 'Administrator',
            role: 'admin',
            subscription: {
                plan: 'enterprise',
                startDate: new Date(),
                endDate: new Date('2030-12-31'),
                autoRenew: true,
                features: {
                    maxBoxes: 10000,
                    aiPro: true,
                    collaboration: true,
                    api: true,
                    exportFormats: ['png', 'pdf', 'excel', 'csv', 'json'],
                    maxProjects: 1000
                }
            },
            emailVerified: true,
            settings: {
                theme: 'light',
                language: 'vi',
                defaultContainer: '40hc',
                snapToGrid: true,
                showLabels: true,
                showCOG: true
            },
            stats: {
                totalProjects: 0,
                totalBoxes: 0,
                totalWeight: 0,
                savedOptimizations: 0,
                lastActive: new Date()
            }
        });
        
        await admin.save();
        console.log('✅ Admin user created:');
        console.log('   Username: admin');
        console.log('   Password: 123456');
        console.log('   Role: admin (full access)');
        
    } catch (error) {
        console.error('❌ Admin init error:', error.message);
    }
};

// Web login route
app.post('/api/web/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const User = require('./models/User');
        const bcrypt = require('bcryptjs');
        const jwt = require('jsonwebtoken');
        
        console.log('Login attempt:', username);
        
        const user = await User.findOne({ 
            $or: [{ username }, { email: username }] 
        });
        
        if (!user) {
            console.log('User not found');
            return res.status(401).json({ 
                success: false, 
                message: 'Tên đăng nhập hoặc mật khẩu không đúng' 
            });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            console.log('Password incorrect');
            return res.status(401).json({ 
                success: false, 
                message: 'Tên đăng nhập hoặc mật khẩu không đúng' 
            });
        }
        
        console.log('Login successful for:', username, 'Role:', user.role);
        
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    fullName: user.fullName,
                    role: user.role,
                    subscription: user.subscription
                }
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// Verify token route
app.get('/api/web/verify-token', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.json({ success: false, message: 'No token' });
        }
        
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const User = require('./models/User');
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }
        
        res.json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    fullName: user.fullName,
                    role: user.role,
                    subscription: user.subscription
                }
            }
        });
    } catch (error) {
        res.json({ success: false, message: 'Invalid token' });
    }
});

// Serve frontend
app.get('*', (req, res) => {
    try {
        const indexPath = path.join(__dirname, '../index.html');
        console.log('📄 Serving:', indexPath);
        res.sendFile(indexPath);
    } catch (error) {
        console.error('Error serving index.html:', error);
        res.status(500).send('Server error');
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('🔥 Error:', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.stack : {}
    });
});

// Start server
const PORT = process.env.PORT || 3000;

const startServer = () => {
    server.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════════╗
║     CONTAINER PACKING PRO SERVER v2.0         ║
╠═══════════════════════════════════════════════╣
║  🚀 Server running on: http://localhost:${PORT}    ║
║  📊 MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Not connected'}                        ║
║  🔌 WebSocket: ${io ? 'Enabled' : 'Disabled'}                        ║
║  ⚡ Environment: ${process.env.NODE_ENV || 'development'}            ║
╚═══════════════════════════════════════════════╝
        `);
    });
};

// Connect DB then init admin then start server
connectDB().then(() => {
    initAdminUser();
    startServer();
}).catch(err => {
    console.error('Failed to connect to database:', err);
    startServer(); // Start server anyway
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, closing server...');
    server.close(() => {
        mongoose.connection.close();
        console.log('👋 Server closed');
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});