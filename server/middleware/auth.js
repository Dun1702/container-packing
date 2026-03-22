const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error();
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      throw new Error();
    }
    
    // Check subscription expiry
    if (user.subscription && user.subscription.endDate && new Date(user.subscription.endDate) < new Date()) {
      user.subscription.plan = 'free';
      user.subscription.features = {
        maxBoxes: 10,
        aiPro: false,
        collaboration: false,
        api: false,
        exportFormats: ['png'],
        maxProjects: 5
      };
      await user.save();
    }
    
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Vui lòng đăng nhập để tiếp tục' 
    });
  }
};

const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Bạn không có quyền thực hiện hành động này' 
      });
    }
    next();
  };
};

const checkSubscription = (requiredPlan) => {
    return (req, res, next) => {
        if (req.user.role === 'admin') {
            return next();
        }
        
        const planLevel = {
            free: 0,
            pro: 1,
            enterprise: 2
        };
        
        const userPlan = req.user.subscription?.plan || 'free';
        
        if (planLevel[userPlan] < planLevel[requiredPlan]) {
            return res.status(403).json({ 
                success: false, 
                message: 'Vui lòng nâng cấp tài khoản để sử dụng tính năng này' 
            });
        }
        next();
    };
};

const checkProjectAccess = async (req, res, next) => {
  try {
    const Project = require('../models/Project');
    const project = await Project.findById(req.params.projectId);
    
    if (!project) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy dự án' 
      });
    }
    
    // Check if user owns the project
    if (project.userId.toString() === req.user._id.toString()) {
      req.project = project;
      return next();
    }
    
    // Check if user is collaborator
    const collaborator = project.collaborators?.find(
      c => c.userId.toString() === req.user._id.toString()
    );
    
    if (collaborator) {
      req.project = project;
      req.collaboratorRole = collaborator.role;
      return next();
    }
    
    // Check if project is shared
    if (project.shared) {
      req.project = project;
      req.isPublicView = true;
      return next();
    }
    
    res.status(403).json({ 
      success: false, 
      message: 'Bạn không có quyền truy cập dự án này' 
    });
  } catch (error) {
    console.error('Check project access error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server' 
    });
  }
};

module.exports = { 
  auth, 
  checkRole, 
  checkSubscription, 
  checkProjectAccess 
};