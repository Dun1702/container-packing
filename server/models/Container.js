const mongoose = require('mongoose');

const containerSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['20dc', '40dc', '40hc', '45hc', 'custom'],
    required: true
  },
  dimensions: {
    width: Number,
    height: Number,
    depth: Number
  },
  specifications: {
    maxLoad: Number,
    tareWeight: Number,
    internalVolume: Number,
    doorOpening: {
      width: Number,
      height: Number
    },
    material: String,
    manufacturer: String,
    year: Number
  },
  layout: {
    layers: [{
      level: Number,
      height: Number,
      boxes: [{
        boxId: Number,
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
        dimensions: {
          width: Number,
          height: Number,
          depth: Number
        },
        weight: Number
      }]
    }],
    stats: {
      usedVolume: Number,
      usedWeight: Number,
      volumeUtilization: Number,
      weightUtilization: Number,
      totalBoxes: Number,
      centerOfGravity: {
        x: Number,
        y: Number,
        z: Number
      },
      stabilityScore: Number
    }
  },
  status: {
    type: String,
    enum: ['loading', 'loaded', 'sealed', 'shipped', 'delivered'],
    default: 'loading'
  },
  sealNumber: String,
  temperature: {
    required: Boolean,
    min: Number,
    max: Number,
    current: Number
  },
  hazardous: {
    type: Boolean,
    default: false
  },
  customs: {
    declaration: String,
    documents: [String],
    inspected: Boolean,
    inspectionDate: Date
  },
  timeline: [{
    status: String,
    timestamp: Date,
    location: String,
    notes: String
  }],
  metadata: {
    createdBy: String,
    createdAt: Date,
    updatedBy: String,
    updatedAt: Date,
    version: Number
  }
});

// Add index for faster queries
containerSchema.index({ projectId: 1, userId: 1 });
containerSchema.index({ 'status': 1 });
containerSchema.index({ 'timeline.timestamp': -1 });

// Calculate center of gravity
containerSchema.methods.calculateCOG = function() {
  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;
  let weightedZ = 0;
  
  this.layout.layers.forEach(layer => {
    layer.boxes.forEach(box => {
      const weight = box.weight || 0;
      totalWeight += weight;
      weightedX += (box.position.x + box.dimensions.width/2) * weight;
      weightedY += (box.position.y + box.dimensions.height/2) * weight;
      weightedZ += (box.position.z + box.dimensions.depth/2) * weight;
    });
  });
  
  if (totalWeight > 0) {
    this.layout.stats.centerOfGravity = {
      x: weightedX / totalWeight,
      y: weightedY / totalWeight,
      z: weightedZ / totalWeight
    };
  }
  
  return this.layout.stats.centerOfGravity;
};

// Calculate stability score
containerSchema.methods.calculateStability = function() {
  if (!this.layout.stats.centerOfGravity) {
    this.calculateCOG();
  }
  
  const cog = this.layout.stats.centerOfGravity;
  const dims = this.dimensions;
  
  // Calculate stability based on COG position
  const xBalance = 1 - Math.abs(cog.x - dims.width/2) / (dims.width/2);
  const yBalance = 1 - Math.abs(cog.y - dims.height/2) / (dims.height/2);
  const zBalance = 1 - Math.abs(cog.z - dims.depth/2) / (dims.depth/2);
  
  const stabilityScore = (xBalance + yBalance + zBalance) / 3 * 100;
  
  this.layout.stats.stabilityScore = Math.round(stabilityScore * 100) / 100;
  return this.layout.stats.stabilityScore;
};

// Validate weight distribution
containerSchema.methods.validateWeightDistribution = function() {
  const quadrants = {
    front: { weight: 0, count: 0 },
    back: { weight: 0, count: 0 },
    left: { weight: 0, count: 0 },
    right: { weight: 0, count: 0 },
    top: { weight: 0, count: 0 },
    bottom: { weight: 0, count: 0 }
  };
  
  this.layout.layers.forEach(layer => {
    layer.boxes.forEach(box => {
      const weight = box.weight || 0;
      
      // Front/Back (Z axis)
      if (box.position.z + box.dimensions.depth/2 < this.dimensions.depth/2) {
        quadrants.front.weight += weight;
        quadrants.front.count++;
      } else {
        quadrants.back.weight += weight;
        quadrants.back.count++;
      }
      
      // Left/Right (X axis)
      if (box.position.x + box.dimensions.width/2 < this.dimensions.width/2) {
        quadrants.left.weight += weight;
        quadrants.left.count++;
      } else {
        quadrants.right.weight += weight;
        quadrants.right.count++;
      }
      
      // Top/Bottom (Y axis)
      if (box.position.y + box.dimensions.height/2 < this.dimensions.height/2) {
        quadrants.bottom.weight += weight;
        quadrants.bottom.count++;
      } else {
        quadrants.top.weight += weight;
        quadrants.top.count++;
      }
    });
  });
  
  const totalWeight = this.layout.stats.usedWeight || 0;
  const balance = {
    frontBack: totalWeight > 0 ? 
      Math.abs(quadrants.front.weight - quadrants.back.weight) / totalWeight * 100 : 0,
    leftRight: totalWeight > 0 ? 
      Math.abs(quadrants.left.weight - quadrants.right.weight) / totalWeight * 100 : 0,
    topBottom: totalWeight > 0 ? 
      Math.abs(quadrants.top.weight - quadrants.bottom.weight) / totalWeight * 100 : 0
  };
  
  return {
    quadrants,
    balance,
    isBalanced: balance.frontBack < 20 && balance.leftRight < 20 && balance.topBottom < 30
  };
};

module.exports = mongoose.model('Container', containerSchema);