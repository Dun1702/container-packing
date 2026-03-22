const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email không hợp lệ']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  avatar: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['user', 'premium', 'admin', 'enterprise'],
    default: 'user'
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free'
    },
    startDate: Date,
    endDate: Date,
    autoRenew: {
      type: Boolean,
      default: true
    },
    features: {
      maxBoxes: { type: Number, default: 10 },
      aiPro: { type: Boolean, default: false },
      collaboration: { type: Boolean, default: false },
      api: { type: Boolean, default: false },
      exportFormats: { type: [String], default: ['png'] },
      maxProjects: { type: Number, default: 5 }
    }
  },
  company: {
    name: String,
    taxCode: String,
    address: String,
    phone: String
  },
  settings: {
    theme: { type: String, default: 'light' },
    language: { type: String, default: 'vi' },
    defaultContainer: { type: String, default: '20dc' },
    snapToGrid: { type: Boolean, default: true },
    showLabels: { type: Boolean, default: true },
    showCOG: { type: Boolean, default: true }
  },
  stats: {
    totalProjects: { type: Number, default: 0 },
    totalBoxes: { type: Number, default: 0 },
    totalWeight: { type: Number, default: 0 },
    savedOptimizations: { type: Number, default: 0 },
    lastActive: Date
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  loginHistory: [{
    ip: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.updatedAt = Date.now();
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update stats method
userSchema.methods.updateStats = async function() {
  try {
    const Project = mongoose.model('Project');
    const projects = await Project.find({ userId: this._id });
    
    let totalBoxes = 0;
    let totalWeight = 0;
    
    projects.forEach(project => {
      if (project.boxes && project.boxes.length) {
        totalBoxes += project.boxes.length;
        project.boxes.forEach(box => {
          totalWeight += (box.weight || 0) * (box.quantity || 1);
        });
      }
    });
    
    this.stats.totalProjects = projects.length;
    this.stats.totalBoxes = totalBoxes;
    this.stats.totalWeight = totalWeight;
    this.stats.lastActive = new Date();
    
    await this.save();
  } catch (error) {
    console.error('Update stats error:', error);
  }
};

module.exports = mongoose.model('User', userSchema);