const express = require('express');
const { auth, checkSubscription } = require('../middleware/auth');
const Project = require('../models/Project');
const User = require('../models/User'); // Thêm dòng này
const Container = require('../models/Container');
const router = express.Router();
// AI Optimization algorithms
class AdvancedPackingOptimizer {
  constructor(items, container, constraints = {}) {
    this.items = items;
    this.container = container;
    this.constraints = constraints;
    this.bestSolution = null;
    this.bestFitness = 0;
  }

  // Multi-objective genetic algorithm
  optimizeMultiObjective() {
    const populationSize = 100;
    const generations = 200;
    const mutationRate = 0.1;
    
    let population = this.initializePopulation(populationSize);
    
    for (let gen = 0; gen < generations; gen++) {
      // Evaluate fitness
      population.forEach(ind => {
        ind.fitness = this.calculateMultiObjectiveFitness(ind);
      });
      
      // Sort by Pareto dominance
      population = this.nonDominatedSort(population);
      
      // Select parents
      const parents = this.tournamentSelection(population, 50);
      
      // Create offspring
      const offspring = [];
      while (offspring.length < populationSize - 20) {
        const p1 = parents[Math.floor(Math.random() * parents.length)];
        const p2 = parents[Math.floor(Math.random() * parents.length)];
        const child = this.crossover(p1, p2);
        this.mutate(child, mutationRate);
        offspring.push(child);
      }
      
      // Elitism
      population = [
        ...population.slice(0, 20), // Keep best individuals
        ...offspring
      ];
    }
    
    return this.getParetoFront(population);
  }

  calculateMultiObjectiveFitness(individual) {
    const solution = this.decode(individual);
    
    // Objectives
    const volumeUtilization = solution.usedVolume / this.container.volume;
    const weightUtilization = solution.usedWeight / (this.container.maxLoad || Infinity);
    const stabilityScore = this.calculateStability(solution);
    const balanceScore = this.calculateBalance(solution);
    const priorityScore = this.calculatePriorityScore(solution);
    
    // Weighted sum
    const weights = this.constraints.weights || {
      volume: 0.3,
      weight: 0.2,
      stability: 0.2,
      balance: 0.15,
      priority: 0.15
    };
    
    return {
      volume: volumeUtilization,
      weight: weightUtilization,
      stability: stabilityScore,
      balance: balanceScore,
      priority: priorityScore,
      overall: 
        volumeUtilization * weights.volume +
        weightUtilization * weights.weight +
        stabilityScore * weights.stability +
        balanceScore * weights.balance +
        priorityScore * weights.priority
    };
  }

  calculateStability(solution) {
    if (!solution.boxes || solution.boxes.length === 0) return 1;
    
    let stabilityScore = 1;
    const sortedBoxes = [...solution.boxes].sort((a, b) => a.y - b.y);
    
    // Check each box for support
    for (let i = 1; i < sortedBoxes.length; i++) {
      const box = sortedBoxes[i];
      const boxesBelow = sortedBoxes.filter(b => 
        b.y + b.h <= box.y && // Box is below
        b.x + b.w > box.x && b.x < box.x + box.w && // X overlap
        b.z + b.d > box.z && b.z < box.z + box.d // Z overlap
      );
      
      // Calculate support area ratio
      const supportArea = boxesBelow.reduce((area, b) => {
        const overlapX = Math.min(b.x + b.w, box.x + box.w) - Math.max(b.x, box.x);
        const overlapZ = Math.min(b.z + b.d, box.z + box.d) - Math.max(b.z, box.z);
        return area + (overlapX > 0 && overlapZ > 0 ? overlapX * overlapZ : 0);
      }, 0);
      
      const boxArea = box.w * box.d;
      const supportRatio = supportArea / boxArea;
      
      if (supportRatio < 0.5) {
        stabilityScore *= supportRatio;
      }
    }
    
    return Math.max(0, Math.min(1, stabilityScore));
  }

  calculateBalance(solution) {
    if (!solution.boxes || solution.boxes.length === 0) return 1;
    
    // Calculate center of gravity
    let totalWeight = 0;
    let cogX = 0, cogY = 0, cogZ = 0;
    
    solution.boxes.forEach(box => {
      const weight = box.weight || 1;
      totalWeight += weight;
      cogX += (box.x + box.w/2) * weight;
      cogY += (box.y + box.h/2) * weight;
      cogZ += (box.z + box.d/2) * weight;
    });
    
    cogX /= totalWeight;
    cogY /= totalWeight;
    cogZ /= totalWeight;
    
    // Ideal COG is at container center
    const idealX = this.container.width / 2;
    const idealY = this.container.height / 2;
    const idealZ = this.container.depth / 2;
    
    // Calculate deviation
    const maxDeviation = Math.sqrt(
      Math.pow(this.container.width/2, 2) +
      Math.pow(this.container.height/2, 2) +
      Math.pow(this.container.depth/2, 2)
    );
    
    const deviation = Math.sqrt(
      Math.pow(cogX - idealX, 2) +
      Math.pow(cogY - idealY, 2) +
      Math.pow(cogZ - idealZ, 2)
    );
    
    return 1 - (deviation / maxDeviation);
  }

  calculatePriorityScore(solution) {
    if (!solution.boxes || solution.boxes.length === 0) return 1;
    
    let totalPriority = 0;
    let packedPriority = 0;
    
    this.items.forEach((item, index) => {
      totalPriority += item.priority || 3;
      if (solution.boxes[index]) {
        packedPriority += item.priority || 3;
      }
    });
    
    return packedPriority / totalPriority;
  }

  nonDominatedSort(population) {
    const fronts = [[]];
    
    population.forEach(ind => {
      ind.dominatedCount = 0;
      ind.dominatedSet = [];
      
      population.forEach(other => {
        if (ind === other) return;
        
        if (this.dominates(ind, other)) {
          ind.dominatedSet.push(other);
        } else if (this.dominates(other, ind)) {
          ind.dominatedCount++;
        }
      });
      
      if (ind.dominatedCount === 0) {
        fronts[0].push(ind);
      }
    });
    
    let i = 0;
    while (fronts[i].length > 0) {
      const nextFront = [];
      
      fronts[i].forEach(ind => {
        ind.dominatedSet.forEach(other => {
          other.dominatedCount--;
          if (other.dominatedCount === 0) {
            nextFront.push(other);
          }
        });
      });
      
      i++;
      fronts[i] = nextFront;
    }
    
    return fronts.flat();
  }

  dominates(ind1, ind2) {
    const f1 = ind1.fitness;
    const f2 = ind2.fitness;
    
    let better = false;
    for (let key in f1) {
      if (key === 'overall') continue;
      if (f1[key] < f2[key]) return false;
      if (f1[key] > f2[key]) better = true;
    }
    
    return better;
  }

  tournamentSelection(population, k) {
    const selected = [];
    for (let i = 0; i < k; i++) {
      const tournament = [];
      for (let j = 0; j < 5; j++) {
        tournament.push(population[Math.floor(Math.random() * population.length)]);
      }
      tournament.sort((a, b) => b.fitness.overall - a.fitness.overall);
      selected.push(tournament[0]);
    }
    return selected;
  }

  getParetoFront(population) {
    return population.filter(ind => ind.dominatedCount === 0);
  }

  initializePopulation(size) {
    const population = [];
    for (let i = 0; i < size; i++) {
      population.push(this.randomIndividual());
    }
    return population;
  }

  randomIndividual() {
    const order = [...Array(this.items.length).keys()];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    
    return {
      order,
      rotations: this.items.map(() => Math.floor(Math.random() * 6)),
      placements: this.items.map(() => ({
        x: Math.random() * this.container.width,
        y: Math.random() * this.container.height,
        z: Math.random() * this.container.depth
      }))
    };
  }

  decode(individual) {
    // Implement 3D bin packing decoding
    const solution = {
      boxes: [],
      usedVolume: 0,
      usedWeight: 0
    };
    
    // Greedy placement
    const placed = [];
    individual.order.forEach((itemIdx, i) => {
      const item = this.items[itemIdx];
      const rot = individual.rotations[itemIdx];
      const dims = this.getRotatedDimensions(item, rot);
      
      // Find best position
      const position = this.findBestPosition(dims, placed, individual.placements[i]);
      
      if (position) {
        const box = {
          ...dims,
          x: position.x,
          y: position.y,
          z: position.z,
          weight: item.weight,
          priority: item.priority
        };
        placed.push(box);
        solution.boxes.push(box);
        solution.usedVolume += dims.w * dims.h * dims.d;
        solution.usedWeight += item.weight || 0;
      }
    });
    
    return solution;
  }

  findBestPosition(dims, placed, targetPosition) {
    // Search in grid around target position
    const step = 5; // cm
    let bestPos = null;
    let bestScore = -Infinity;
    
    for (let x = Math.max(0, targetPosition.x - 50); x <= Math.min(this.container.width - dims.w, targetPosition.x + 50); x += step) {
      for (let y = Math.max(0, targetPosition.y - 50); y <= Math.min(this.container.height - dims.h, targetPosition.y + 50); y += step) {
        for (let z = Math.max(0, targetPosition.z - 50); z <= Math.min(this.container.depth - dims.d, targetPosition.z + 50); z += step) {
          
          // Check collision
          let valid = true;
          for (let p of placed) {
            if (this.overlaps({x, y, z, ...dims}, p)) {
              valid = false;
              break;
            }
          }
          
          if (valid) {
            // Calculate score based on distance to target and stability
            const distToTarget = Math.sqrt(
              Math.pow(x - targetPosition.x, 2) +
              Math.pow(y - targetPosition.y, 2) +
              Math.pow(z - targetPosition.z, 2)
            );
            
            const stability = this.calculatePositionStability({x, y, z, ...dims}, placed);
            const score = 1000 / (1 + distToTarget) + stability * 100;
            
            if (score > bestScore) {
              bestScore = score;
              bestPos = {x, y, z};
            }
          }
        }
      }
    }
    
    return bestPos;
  }

  calculatePositionStability(box, placed) {
    if (box.y === 0) return 1; // On floor
    
    // Find supporting boxes
    const supports = placed.filter(p => 
      p.y + p.h <= box.y && // Below
      p.x + p.w > box.x && p.x < box.x + box.w && // X overlap
      p.z + p.d > box.z && p.z < box.z + box.d // Z overlap
    );
    
    if (supports.length === 0) return 0;
    
    // Calculate support area
    let supportArea = 0;
    supports.forEach(s => {
      const overlapX = Math.min(s.x + s.w, box.x + box.w) - Math.max(s.x, box.x);
      const overlapZ = Math.min(s.z + s.d, box.z + box.d) - Math.max(s.z, box.z);
      if (overlapX > 0 && overlapZ > 0) {
        supportArea += overlapX * overlapZ;
      }
    });
    
    return Math.min(1, supportArea / (box.w * box.d));
  }

  getRotatedDimensions(item, rot) {
    const dims = [
      {w: item.width, h: item.height, d: item.depth},
      {w: item.width, h: item.depth, d: item.height},
      {w: item.height, h: item.width, d: item.depth},
      {w: item.height, h: item.depth, d: item.width},
      {w: item.depth, h: item.width, d: item.height},
      {w: item.depth, h: item.height, d: item.width}
    ];
    return dims[rot % 6];
  }

  overlaps(b1, b2) {
    return !(b1.x + b1.w <= b2.x || 
            b1.x >= b2.x + b2.w ||
            b1.y + b1.h <= b2.y ||
            b1.y >= b2.y + b2.h ||
            b1.z + b1.d <= b2.z ||
            b1.z >= b2.z + b2.d);
  }

  crossover(p1, p2) {
    const point = Math.floor(Math.random() * this.items.length);
    const child = {
      order: [...p1.order.slice(0, point), ...p2.order.slice(point)],
      rotations: [...p1.rotations.slice(0, point), ...p2.rotations.slice(point)],
      placements: [...p1.placements.slice(0, point), ...p2.placements.slice(point)]
    };
    
    // Fix duplicates in order
    const seen = new Set();
    const uniqueOrder = [];
    child.order.forEach(idx => {
      if (!seen.has(idx)) {
        seen.add(idx);
        uniqueOrder.push(idx);
      }
    });
    
    this.items.forEach((_, idx) => {
      if (!seen.has(idx)) {
        uniqueOrder.push(idx);
      }
    });
    
    child.order = uniqueOrder;
    return child;
  }

  mutate(individual, rate) {
    if (Math.random() < rate) {
      // Swap two items in order
      const i = Math.floor(Math.random() * this.items.length);
      const j = Math.floor(Math.random() * this.items.length);
      [individual.order[i], individual.order[j]] = [individual.order[j], individual.order[i]];
    }
    
    if (Math.random() < rate) {
      // Mutate rotation
      const i = Math.floor(Math.random() * this.items.length);
      individual.rotations[i] = Math.floor(Math.random() * 6);
    }
    
    if (Math.random() < rate) {
      // Mutate placement
      const i = Math.floor(Math.random() * this.items.length);
      individual.placements[i] = {
        x: Math.random() * this.container.width,
        y: Math.random() * this.container.height,
        z: Math.random() * this.container.depth
      };
    }
  }
}

// API Endpoints

// Optimize packing
router.post('/optimize', auth, checkSubscription('pro'), async (req, res) => {
  try {
    const { items, container, constraints } = req.body;
    
    const optimizer = new AdvancedPackingOptimizer(items, container, constraints);
    const paretoFront = optimizer.optimizeMultiObjective();
    
    // Decode best solutions
    const solutions = paretoFront.map(ind => ({
      fitness: ind.fitness,
      boxes: optimizer.decode(ind).boxes
    }));
    
    res.json({
      success: true,
      data: {
        solutions,
        paretoFront: paretoFront.map(ind => ind.fitness),
        stats: {
          iterations: 200,
          populationSize: 100,
          executionTime: Date.now() - req.startTime
        }
      }
    });
  } catch (error) {
    console.error('Optimize error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi tối ưu hóa' 
    });
  }
});

// Generate report
router.post('/generate-report/:projectId', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
      .populate('userId', 'fullName company');
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy dự án'
      });
    }
    
    const { format = 'pdf' } = req.body;
    
    // Calculate stats
    const stats = project.calculateStats();
    const container = project.container;
    
    // Prepare report data
    const reportData = {
      project: {
        name: project.name,
        description: project.description,
        createdAt: project.createdAt,
        status: project.status
      },
      company: project.userId?.company || {},
      container: {
        type: container.type,
        dimensions: `${container.width} x ${container.height} x ${container.depth} cm`,
        volume: (container.width * container.height * container.depth / 1000000).toFixed(2) + ' m³',
        maxLoad: container.maxLoad + ' kg'
      },
      boxes: project.boxes.map((box, index) => ({
        no: index + 1,
        name: box.name || `Thùng ${index + 1}`,
        dimensions: `${box.width} x ${box.height} x ${box.depth} cm`,
        volume: (box.width * box.height * box.depth / 1000000).toFixed(3) + ' m³',
        weight: box.weight + ' kg',
        quantity: box.quantity || 1,
        position: box.position ? 
          `(${box.position.x.toFixed(0)}, ${box.position.y.toFixed(0)}, ${box.position.z.toFixed(0)})` : 'Chưa xếp',
        rotation: box.rotation ? 
          `(${box.rotation.x.toFixed(0)}°, ${box.rotation.y.toFixed(0)}°, ${box.rotation.z.toFixed(0)}°)` : '0°',
        category: box.category || 'Hàng hóa'
      })),
      stats: {
        totalBoxes: stats.totalBoxes,
        totalVolume: (stats.totalVolume / 1000000).toFixed(2) + ' m³',
        totalWeight: stats.totalWeight + ' kg',
        volumeUtilization: stats.volumeUtilization.toFixed(1) + '%',
        weightUtilization: stats.weightUtilization.toFixed(1) + '%'
      },
      optimization: project.optimization?.result || {},
      generatedAt: new Date(),
      generatedBy: req.user.fullName
    };
    
    // Generate different formats
    if (format === 'pdf') {
      // PDF generation logic here
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument();
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=report-${project.name}.pdf`);
      
      doc.pipe(res);
      
      // Generate PDF content
      doc.fontSize(20).text('BÁO CÁO XẾP HÀNG CONTAINER', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Dự án: ${reportData.project.name}`);
      doc.text(`Ngày tạo: ${new Date(reportData.generatedAt).toLocaleString('vi-VN')}`);
      doc.text(`Người tạo: ${reportData.generatedBy}`);
      doc.moveDown();
      
      // Company info
      if (reportData.company.name) {
        doc.fontSize(14).text('THÔNG TIN DOANH NGHIỆP');
        doc.fontSize(12).text(`Tên công ty: ${reportData.company.name}`);
        if (reportData.company.taxCode) doc.text(`Mã số thuế: ${reportData.company.taxCode}`);
        doc.moveDown();
      }
      
      // Container info
      doc.fontSize(14).text('THÔNG TIN CONTAINER');
      doc.fontSize(12).text(`Loại: ${reportData.container.type}`);
      doc.text(`Kích thước: ${reportData.container.dimensions}`);
      doc.text(`Thể tích: ${reportData.container.volume}`);
      doc.text(`Tải trọng tối đa: ${reportData.container.maxLoad}`);
      doc.moveDown();
      
      // Stats
      doc.fontSize(14).text('THỐNG KÊ');
      doc.fontSize(12).text(`Tổng số thùng: ${reportData.stats.totalBoxes}`);
      doc.text(`Tổng thể tích: ${reportData.stats.totalVolume}`);
      doc.text(`Tổng trọng lượng: ${reportData.stats.totalWeight}`);
      doc.text(`Hiệu suất thể tích: ${reportData.stats.volumeUtilization}`);
      doc.text(`Hiệu suất tải trọng: ${reportData.stats.weightUtilization}`);
      doc.moveDown();
      
      // Boxes table
      doc.fontSize(14).text('DANH SÁCH THÙNG HÀNG');
      doc.moveDown();
      
      const tableTop = doc.y;
      const itemHeight = 20;
      
      // Headers
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('STT', 50, tableTop);
      doc.text('Kích thước', 100, tableTop);
      doc.text('Trọng lượng', 250, tableTop);
      doc.text('Số lượng', 350, tableTop);
      doc.text('Vị trí', 400, tableTop);
      
      doc.font('Helvetica');
      
      // Rows
      reportData.boxes.forEach((box, i) => {
        const y = tableTop + (i + 1) * itemHeight;
        doc.text(box.no.toString(), 50, y);
        doc.text(box.dimensions, 100, y);
        doc.text(box.weight, 250, y);
        doc.text(box.quantity.toString(), 350, y);
        doc.text(box.position, 400, y);
      });
      
      doc.end();
      
    } else if (format === 'excel') {
      // Excel generation logic here
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Báo cáo');
      
      // Add data to worksheet
      worksheet.columns = [
        { header: 'STT', key: 'no', width: 10 },
        { header: 'Tên thùng', key: 'name', width: 20 },
        { header: 'Kích thước (cm)', key: 'dimensions', width: 20 },
        { header: 'Thể tích (m³)', key: 'volume', width: 15 },
        { header: 'Trọng lượng (kg)', key: 'weight', width: 15 },
        { header: 'Số lượng', key: 'quantity', width: 10 },
        { header: 'Vị trí', key: 'position', width: 30 },
        { header: 'Phân loại', key: 'category', width: 15 }
      ];
      
      worksheet.addRows(reportData.boxes);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=report-${project.name}.xlsx`);
      
      await workbook.xlsx.write(res);
      res.end();
      
    } else if (format === 'csv') {
      // CSV generation
      const csv = require('csv-stringify');
      const columns = ['STT', 'Kích thước', 'Trọng lượng', 'Số lượng', 'Vị trí', 'Phân loại'];
      
      csv.stringify(reportData.boxes.map(b => 
        [b.no, b.dimensions, b.weight, b.quantity, b.position, b.category]
      ), {
        header: true,
        columns: columns
      }, (err, output) => {
        if (err) throw err;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=report-${project.name}.csv`);
        res.send(output);
      });
    }
    
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi tạo báo cáo' 
    });
  }
});

// Bulk import/export
router.post('/import', auth, async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    
    if (format === 'json') {
      const { data } = req.body;
      
      if (!Array.isArray(data)) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ'
        });
      }
      
      res.json({
        success: true,
        message: `Đã import ${data.length} thùng hàng`,
        data: data
      });
    }
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi import dữ liệu' 
    });
  }
});

// Container templates
router.get('/templates', async (req, res) => {
  try {
    const templates = [
      {
        id: '20dc',
        name: '20\' Dry Container',
        dimensions: { width: 235, height: 239, depth: 590 },
        specs: {
          maxLoad: 28200,
          tareWeight: 2200,
          internalVolume: 33.2,
          doorOpening: { width: 234, height: 228 }
        },
        image: '/images/20dc.png'
      },
      {
        id: '40dc',
        name: '40\' Dry Container',
        dimensions: { width: 235, height: 239, depth: 1203 },
        specs: {
          maxLoad: 28700,
          tareWeight: 3800,
          internalVolume: 67.6,
          doorOpening: { width: 234, height: 228 }
        },
        image: '/images/40dc.png'
      },
      {
        id: '40hc',
        name: '40\' High Cube Container',
        dimensions: { width: 235, height: 269, depth: 1203 },
        specs: {
          maxLoad: 29500,
          tareWeight: 3900,
          internalVolume: 76.4,
          doorOpening: { width: 234, height: 258 }
        },
        image: '/images/40hc.png'
      },
      {
        id: '45hc',
        name: '45\' High Cube Container',
        dimensions: { width: 235, height: 269, depth: 1350 },
        specs: {
          maxLoad: 30000,
          tareWeight: 4800,
          internalVolume: 86.0,
          doorOpening: { width: 234, height: 258 }
        },
        image: '/images/45hc.png'
      },
      {
        id: '20rf',
        name: '20\' Reefer Container',
        dimensions: { width: 229, height: 227, depth: 544 },
        specs: {
          maxLoad: 28000,
          tareWeight: 2800,
          internalVolume: 28.3,
          doorOpening: { width: 229, height: 217 },
          temperature: { min: -30, max: 30 }
        },
        image: '/images/20rf.png'
      },
      {
        id: '40rf',
        name: '40\' Reefer Container',
        dimensions: { width: 229, height: 227, depth: 1158 },
        specs: {
          maxLoad: 29000,
          tareWeight: 4400,
          internalVolume: 60.0,
          doorOpening: { width: 229, height: 217 },
          temperature: { min: -30, max: 30 }
        },
        image: '/images/40rf.png'
      },
      {
        id: '20ot',
        name: '20\' Open Top Container',
        dimensions: { width: 235, height: 236, depth: 590 },
        specs: {
          maxLoad: 28000,
          tareWeight: 2300,
          internalVolume: 32.7,
          doorOpening: { width: 234, height: 225 }
        },
        image: '/images/20ot.png'
      },
      {
        id: '40ot',
        name: '40\' Open Top Container',
        dimensions: { width: 235, height: 236, depth: 1203 },
        specs: {
          maxLoad: 28500,
          tareWeight: 4000,
          internalVolume: 66.7,
          doorOpening: { width: 234, height: 225 }
        },
        image: '/images/40ot.png'
      },
      {
        id: '20fl',
        name: '20\' Flat Rack Container',
        dimensions: { width: 235, height: 239, depth: 566 },
        specs: {
          maxLoad: 30000,
          tareWeight: 2500,
          internalVolume: 31.8,
          doorOpening: { width: 234, height: 228 }
        },
        image: '/images/20fl.png'
      },
      {
        id: '40fl',
        name: '40\' Flat Rack Container',
        dimensions: { width: 235, height: 239, depth: 1158 },
        specs: {
          maxLoad: 40000,
          tareWeight: 5000,
          internalVolume: 65.0,
          doorOpening: { width: 234, height: 228 }
        },
        image: '/images/40fl.png'
      }
    ];
    
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi lấy danh sách template' 
    });
  }
});

// Get system stats (admin only)
router.get('/admin/stats', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền truy cập'
      });
    }
    
    const stats = {
      users: {
        total: await User.countDocuments(),
        active: await User.countDocuments({ 'stats.lastActive': { $gt: new Date(Date.now() - 7*24*60*60*1000) } }),
        premium: await User.countDocuments({ 'subscription.plan': { $in: ['pro', 'enterprise'] } }),
        verified: await User.countDocuments({ emailVerified: true })
      },
      projects: {
        total: await Project.countDocuments(),
        optimized: await Project.countDocuments({ status: 'optimized' }),
        shipped: await Project.countDocuments({ status: 'shipped' }),
        shared: await Project.countDocuments({ shared: true })
      },
      boxes: {
        total: (await Project.aggregate([
          { $unwind: '$boxes' },
          { $group: { _id: null, total: { $sum: '$boxes.quantity' } } }
        ]))[0]?.total || 0
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '2.0.0'
      }
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

module.exports = router;