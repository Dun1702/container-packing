const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  container: {
    type: {
      type: String,
      enum: ['20dc', '40dc', '40hc', '45hc', 'custom'],
      default: '20dc'
    },
    width: Number,
    height: Number,
    depth: Number,
    maxLoad: Number,
    tareWeight: Number
  },
  boxes: [{
    id: Number,
    name: String,
    width: Number,
    height: Number,
    depth: Number,
    weight: Number,
    quantity: Number,
    position: {
      x: Number,
      y: Number,
      z: Number
    },
    rotation: {
      x: Number,
      y: Number,
      z: Number
    },
    color: String,
    category: String,
    stackable: {
      type: Boolean,
      default: true
    },
    fragile: {
      type: Boolean,
      default: false
    },
    orientationFixed: {
      type: Boolean,
      default: false
    },
    priority: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    },
    notes: String
  }],
  optimization: {
    algorithm: {
      type: String,
      enum: ['basic', 'genetic', 'heuristic', 'ml'],
      default: 'basic'
    },
    objective: {
      type: String,
      enum: ['maxVolume', 'maxWeight', 'balance', 'priority', 'custom'],
      default: 'maxVolume'
    },
    constraints: {
      maxWeight: Number,
      stackLimit: Number,
      centerOfGravity: {
        enabled: { type: Boolean, default: false },
        maxDeviation: Number
      },
      loadBalance: { type: Boolean, default: false },
      grouping: { type: Boolean, default: false }
    },
    result: {
      packedBoxes: Number,
      totalVolume: Number,
      volumeUtilization: Number,
      totalWeight: Number,
      weightUtilization: Number,
      cog: {
        x: Number,
        y: Number,
        z: Number
      },
      stabilityScore: Number,
      executionTime: Number,
      iterations: Number
    }
  },
  status: {
    type: String,
    enum: ['draft', 'optimized', 'validated', 'shipped', 'archived'],
    default: 'draft'
  },
  tags: [String],
  collaborators: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['viewer', 'editor', 'admin'],
      default: 'viewer'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  versions: [{
    version: Number,
    data: mongoose.Schema.Types.Mixed,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    comment: String
  }],
  reports: [{
    type: {
      type: String,
      enum: ['pdf', 'excel', 'csv', 'image']
    },
    url: String,
    generatedAt: Date,
    size: Number
  }],
  shipping: {
    customerName: String,
    customerAddress: String,
    customerPhone: String,
    shippingDate: Date,
    estimatedDelivery: Date,
    carrier: String,
    trackingNumber: String,
    shippingNotes: String
  },
  shared: {
    type: Boolean,
    default: false
  },
  publicId: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp before saving
projectSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create version
projectSchema.methods.createVersion = async function(userId, comment) {
  const lastVersion = this.versions.length > 0 
    ? this.versions[this.versions.length - 1].version 
    : 0;
  
  this.versions.push({
    version: lastVersion + 1,
    data: {
      boxes: this.boxes,
      container: this.container,
      optimization: this.optimization
    },
    createdBy: userId,
    comment: comment
  });
  
  await this.save();
  return this;
};

// Calculate statistics
projectSchema.methods.calculateStats = function() {
  let totalVolume = 0;
  let totalWeight = 0;
  let totalBoxes = 0;
  
  this.boxes.forEach(box => {
    totalVolume += (box.width * box.height * box.depth) * (box.quantity || 1);
    totalWeight += (box.weight || 0) * (box.quantity || 1);
    totalBoxes += box.quantity || 1;
  });
  
  const containerVolume = this.container.width * this.container.height * this.container.depth;
  const volumeUtilization = containerVolume > 0 ? (totalVolume / containerVolume) * 100 : 0;
  const weightUtilization = this.container.maxLoad > 0 ? (totalWeight / this.container.maxLoad) * 100 : 0;
  
  return {
    totalBoxes,
    totalVolume,
    totalWeight,
    volumeUtilization,
    weightUtilization
  };
};

// Generate public ID for sharing
projectSchema.pre('save', function(next) {
  if (this.shared && !this.publicId) {
    this.publicId = Math.random().toString(36).substring(2, 15) + 
                    Math.random().toString(36).substring(2, 15);
  }
  next();
});

module.exports = mongoose.model('Project', projectSchema);