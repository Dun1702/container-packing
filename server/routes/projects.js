const express = require('express');
const mongoose = require('mongoose');
const { auth, checkProjectAccess, checkSubscription } = require('../middleware/auth');
const Project = require('../models/Project');
const User = require('../models/User');

const router = express.Router();

// Get all projects
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    
    const query = {
      $or: [
        { userId: req.user._id },
        { 'collaborators.userId': req.user._id }
      ]
    };
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        ...query.$or,
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    const projects = await Project.find(query)
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('userId', 'username fullName avatar')
      .populate('collaborators.userId', 'username fullName avatar');
    
    const total = await Project.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        projects,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total
      }
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Get single project
router.get('/:projectId', auth, checkProjectAccess, async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.project
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Create project
router.post('/', auth, async (req, res) => {
    try {
        const { name, description, container } = req.body;
        
        if (req.user.role !== 'admin' && (!req.user.subscription || req.user.subscription.plan === 'free')) {
            const projectCount = await Project.countDocuments({ userId: req.user._id });
            const maxProjects = req.user.subscription?.features?.maxProjects || 5;
            if (projectCount >= maxProjects) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn đã đạt giới hạn dự án. Vui lòng nâng cấp tài khoản để tạo thêm.'
                });
            }
        }
        
        const project = new Project({
            userId: req.user._id,
            name,
            description,
            container: container || {
                type: '20dc',
                width: 235,
                height: 239,
                depth: 590,
                maxLoad: 28200
            },
            boxes: [],
            status: 'draft'
        });
        
        await project.save();
        
        if (req.user.role !== 'admin') {
            await req.user.updateStats();
        }
        
        if (project.createVersion) {
            await project.createVersion(req.user._id, 'Khởi tạo dự án');
        }
        
        res.status(201).json({
            success: true,
            message: 'Tạo dự án thành công',
            data: project
        });
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Lỗi server' 
        });
    }
});

// Update project
router.put('/:projectId', auth, checkProjectAccess, async (req, res) => {
  try {
    if (req.collaboratorRole === 'viewer') {
      return res.status(403).json({
        success: false,
        message: 'Bạn chỉ có quyền xem dự án này'
      });
    }
    
    const { name, description, container, boxes, status, tags, shipping } = req.body;
    
    if (req.project.createVersion && req.project.boxes && req.project.boxes.length > 0) {
      await req.project.createVersion(req.user._id, 'Tự động lưu trước khi cập nhật');
    }
    
    if (name) req.project.name = name;
    if (description !== undefined) req.project.description = description;
    if (container) req.project.container = { ...req.project.container, ...container };
    if (boxes) req.project.boxes = boxes;
    if (status) req.project.status = status;
    if (tags) req.project.tags = tags;
    if (shipping) req.project.shipping = { ...req.project.shipping, ...shipping };
    
    await req.project.save();
    
    if (req.user.updateStats) {
      await req.user.updateStats();
    }
    
    const io = req.app.get('io');
    if (io) {
      io.to(`project-${req.project._id}`).emit('project-updated', {
        projectId: req.project._id,
        updatedBy: req.user.username,
        timestamp: new Date()
      });
    }
    
    res.json({
      success: true,
      message: 'Cập nhật dự án thành công',
      data: req.project
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Delete project
router.delete('/:projectId', auth, checkProjectAccess, async (req, res) => {
  try {
    if (req.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ chủ sở hữu mới có thể xóa dự án'
      });
    }
    
    await req.project.deleteOne();
    
    if (req.user.updateStats) {
      await req.user.updateStats();
    }
    
    res.json({
      success: true,
      message: 'Xóa dự án thành công'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Clone project
router.post('/:projectId/clone', auth, checkProjectAccess, async (req, res) => {
  try {
    const projectData = req.project.toObject();
    delete projectData._id;
    delete projectData.createdAt;
    delete projectData.updatedAt;
    delete projectData.versions;
    
    const newProject = new Project({
      ...projectData,
      userId: req.user._id,
      name: `${projectData.name} (Copy)`,
      status: 'draft',
      collaborators: []
    });
    
    await newProject.save();
    
    res.status(201).json({
      success: true,
      message: 'Sao chép dự án thành công',
      data: newProject
    });
  } catch (error) {
    console.error('Clone project error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

// Share project
router.post('/:projectId/share', auth, checkProjectAccess, async (req, res) => {
  try {
    const { shared } = req.body;
    
    req.project.shared = shared;
    await req.project.save();
    
    res.json({
      success: true,
      message: shared ? 'Đã chia sẻ dự án' : 'Đã ẩn dự án',
      data: {
        shared: req.project.shared,
        publicId: req.project.publicId
      }
    });
  } catch (error) {
    console.error('Share project error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
});

module.exports = router;