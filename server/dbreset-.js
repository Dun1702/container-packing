const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');

async function resetDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/container-packing-pro');
        console.log('Connected to MongoDB');
        
        // Xóa tất cả users
        await User.deleteMany({});
        console.log('Deleted all users');
        
        // Tạo admin
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
            }
        });
        
        await admin.save();
        console.log('Admin created: admin / 123456');
        
        await mongoose.disconnect();
        console.log('Done!');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

resetDatabase();