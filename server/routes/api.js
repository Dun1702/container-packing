const express = require('express');
const { auth, checkSubscription } = require('../middleware/auth');
const Project = require('../models/Project');
const User = require('../models/User'); // Thêm dòng này
const Container = require('../models/Container');
const router = express.Router();
// Optimizer service (multi-container, COG, load-balance)
const optimizerService = require('../services/optimizer');

// API Endpoints

// Optimize packing (single container) with COG & step plan
router.post('/optimize', auth, checkSubscription('pro'), async (req, res) => {
  try {
    const { items = [], container = {}, constraints = {} } = req.body;
    const result = optimizerService.optimizeSingle(items, container, constraints);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Optimize error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi tối ưu hóa' 
    });
  }
});

// Optimize across multiple container types - pick minimal containers / best cost
router.post('/optimize/multi', auth, checkSubscription('pro'), async (req, res) => {
  try {
    const { items = [], containers = [], constraints = {} } = req.body;
    const result = optimizerService.optimizeMulti(items, containers, constraints);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Optimize multi error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tối ưu nhiều container' });
  }
});

// Return step-by-step loading plan only (can feed to animation)
router.post('/optimize/plan', auth, checkSubscription('pro'), async (req, res) => {
  try {
    const { items = [], container = {}, constraints = {} } = req.body;
    const { bestSolution } = optimizerService.optimizeSingle(items, container, constraints);
    res.json({ success: true, data: { stepPlan: bestSolution.stepPlan, stats: bestSolution.stats } });
  } catch (error) {
    console.error('Optimize plan error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tạo lộ trình xếp' });
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

// Bulk import/export - JSON & Excel
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/import', auth, async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    if (format === 'json') {
      const { data } = req.body;
      if (!Array.isArray(data)) {
        return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ' });
      }
      return res.json({
        success: true,
        message: `Đã import ${data.length} thùng hàng`,
        data
      });
    }
    return res.status(400).json({ success: false, message: 'format không hỗ trợ' });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi import dữ liệu' });
  }
});

// Upload Excel -> boxes
router.post('/import/excel', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Chưa gửi file Excel' });
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
    const ws = wb.worksheets[0];
    const boxes = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header
      const [name, width, height, depth, weight, qty, category, stackable, tiltable, rotatable, destination] = row.values.slice(1);
      if (!width || !height || !depth) return;
      boxes.push({
        name: name || `Box ${rowNumber - 1}`,
        width: Number(width),
        height: Number(height),
        depth: Number(depth),
        weight: Number(weight) || 1,
        quantity: Number(qty) || 1,
        category: category || 'normal',
        stackable: stackable !== false,
        tiltable: tiltable !== false,
        rotatable: rotatable !== false,
        destination: destination || ''
      });
    });
    res.json({ success: true, data: boxes, message: `Đã import ${boxes.length} thùng từ Excel` });
  } catch (error) {
    console.error('Import Excel error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi import Excel' });
  }
});

// Download Excel template
router.get('/import/template/excel', auth, async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Boxes');
    ws.addRow(['Tên thùng', 'Rộng (cm)', 'Cao (cm)', 'Dài (cm)', 'Trọng lượng (kg)', 'Số lượng', 'Phân loại', 'Stackable', 'Tiltable', 'Rotatable', 'Destination']);
    ws.addRow(['Pallet 1m', 100, 120, 100, 500, 1, 'normal', true, true, true, 'HCM']);
    ws.addRow(['Hàng dễ vỡ', 50, 40, 60, 20, 2, 'fragile', false, false, true, 'HN']);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=container-packing-template.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Template Excel error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xuất template' });
  }
});

// Share project (stub public link)
router.post('/share/:projectId', auth, async (req, res) => {
  try {
    const publicId = Math.random().toString(36).slice(2, 10);
    res.json({ success: true, data: { publicId } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi tạo link chia sẻ' });
  }
});

// Generate report (stub)
router.post('/generate-report/:projectId', auth, async (req, res) => {
  try {
    const { format = 'pdf' } = req.body;
    const content = `Report placeholder for project ${req.params.projectId} - format ${format}`;
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.send(content);
    } else {
      res.json({ success: true, data: content });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi tạo báo cáo' });
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
