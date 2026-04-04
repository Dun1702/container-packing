// Reset database and seed demo data
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: __dirname + '/.env' });

const User = require('./models/User');
const Project = require('./models/Project');

async function seed() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/container-packing-pro';
  await mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('✅ Connected to MongoDB:', mongoURI);

  await mongoose.connection.db.dropDatabase();
  console.log('🧹 Dropped existing database');

  const adminPass = await bcrypt.hash('123456', 10);
  const admin = await User.create({
    username: 'admin',
    email: 'admin@containerpacking.com',
    password: adminPass,
    fullName: 'Administrator',
    role: 'admin',
    subscription: {
      plan: 'enterprise',
      features: {
        maxBoxes: 10000,
        aiPro: true,
        collaboration: true,
        api: true,
        exportFormats: ['png', 'pdf', 'excel', 'csv', 'json'],
        maxProjects: 1000
      }
    },
    emailVerified: true
  });
  console.log('👤 Seeded admin user (admin / 123456)');

  const sampleProject = await Project.create({
    userId: admin._id,
    name: 'Demo 40HC - Nội thất',
    description: 'Mẫu dự án để thử tính năng AI Pro & báo cáo',
    container: { type: '40hc', width: 235, height: 269, depth: 1203, maxLoad: 29500 },
    boxes: [
      { id: 1, name: 'Sofa A', width: 220, height: 80, depth: 100, weight: 120, quantity: 1, category: 'normal' },
      { id: 2, name: 'Bàn gỗ', width: 160, height: 75, depth: 90, weight: 70, quantity: 2, category: 'heavy' },
      { id: 3, name: 'TV 75\"', width: 180, height: 25, depth: 120, weight: 30, quantity: 2, fragile: true, category: 'fragile' },
      { id: 4, name: 'Thùng carton', width: 60, height: 50, depth: 80, weight: 20, quantity: 10, category: 'normal' }
    ],
    status: 'draft'
  });
  console.log('📦 Seeded sample project:', sampleProject.name);

  await mongoose.connection.close();
  console.log('✅ Done.');
}

seed().catch((err) => {
  console.error('❌ Seed error', err);
  process.exit(1);
});
