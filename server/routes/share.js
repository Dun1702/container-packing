const crypto = require('crypto');
const express = require('express');
const Project = require('../models/Project');

const router = express.Router();
const SNAPSHOT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const snapshotStore = new Map();

function createPublicId() {
  return crypto.randomBytes(5).toString('hex');
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeText(value, maxLength = 160) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function sanitizePoint(value = {}) {
  return {
    x: toNumber(value.x),
    y: toNumber(value.y),
    z: toNumber(value.z)
  };
}

function sanitizeRuleSet(rules = {}) {
  return {
    priority: {
      respectSeparation: !!rules.priority?.respectSeparation,
      ignoreSeparation: !!rules.priority?.ignoreSeparation,
      noGroupStacking: !!rules.priority?.noGroupStacking,
      splitByWall: !!rules.priority?.splitByWall
    },
    weight: {
      respectLimits: rules.weight?.respectLimits !== false,
      shiftToMassCenter: !!rules.weight?.shiftToMassCenter
    }
  };
}

function sanitizeMetricSet(metrics = {}) {
  return {
    stage: toNumber(metrics.stage),
    plannedQty: toNumber(metrics.plannedQty),
    plannedVolume: toNumber(metrics.plannedVolume),
    plannedWeight: toNumber(metrics.plannedWeight),
    routeStops: Array.isArray(metrics.routeStops) ? metrics.routeStops.map(stop => sanitizeText(stop, 80)) : [],
    routeStopCount: toNumber(metrics.routeStopCount),
    destinationStops: Array.isArray(metrics.destinationStops) ? metrics.destinationStops.map(stop => sanitizeText(stop, 80)) : [],
    groups: Array.isArray(metrics.groups) ? metrics.groups.map(group => sanitizeText(group, 80)) : [],
    avgDensity: toNumber(metrics.avgDensity),
    nearDoorPercent: toNumber(metrics.nearDoorPercent),
    balanceScore: toNumber(metrics.balanceScore),
    doorScore: toNumber(metrics.doorScore),
    placed: {
      boxCount: toNumber(metrics.placed?.boxCount),
      totalVolumeM3: toNumber(metrics.placed?.totalVolumeM3),
      totalWeight: toNumber(metrics.placed?.totalWeight),
      volumePercent: toNumber(metrics.placed?.volumePercent),
      weightPercent: toNumber(metrics.placed?.weightPercent)
    },
    axleHealth: {
      maxRatio: toNumber(metrics.axleHealth?.maxRatio),
      safe: !!metrics.axleHealth?.safe,
      label: sanitizeText(metrics.axleHealth?.label || 'Unknown', 80)
    },
    axleData: {
      loads: Array.isArray(metrics.axleData?.loads) ? metrics.axleData.loads.map(load => toNumber(load)) : [],
      limits: Array.isArray(metrics.axleData?.limits) ? metrics.axleData.limits.map(limit => toNumber(limit)) : []
    }
  };
}

function sanitizeEntry(entry = {}) {
  return {
    name: sanitizeText(entry.name || 'Cargo', 120),
    quantity: toNumber(entry.quantity),
    width: toNumber(entry.width),
    height: toNumber(entry.height),
    depth: toNumber(entry.depth),
    weight: toNumber(entry.weight),
    totalWeight: toNumber(entry.totalWeight),
    totalVolume: toNumber(entry.totalVolume),
    destination: sanitizeText(entry.destination, 80),
    group: sanitizeText(entry.group || entry.destination || 'General', 80),
    priority: toNumber(entry.priority, 3),
    category: sanitizeText(entry.category || 'normal', 40),
    sku: sanitizeText(entry.sku, 80),
    source: sanitizeText(entry.source || 'planned', 40)
  };
}

function sanitizePlacedBox(box = {}, index = 0) {
  return {
    id: sanitizeText(box.id || `box-${index + 1}`, 60),
    name: sanitizeText(box.name || `Box ${index + 1}`, 120),
    width: toNumber(box.width),
    height: toNumber(box.height),
    depth: toNumber(box.depth),
    weight: toNumber(box.weight),
    category: sanitizeText(box.category || 'normal', 40),
    fragile: !!box.fragile,
    hazardous: !!box.hazardous,
    destination: sanitizeText(box.destination, 80),
    group: sanitizeText(box.group || box.destination || 'General', 80),
    priority: toNumber(box.priority, 3),
    sku: sanitizeText(box.sku, 80),
    stackable: box.stackable !== false,
    tiltable: box.tiltable !== false,
    rotatable: box.rotatable !== false,
    orientationIndex: toNumber(box.orientationIndex),
    baseDims: {
      width: toNumber(box.baseDims?.width, toNumber(box.width)),
      height: toNumber(box.baseDims?.height, toNumber(box.height)),
      depth: toNumber(box.baseDims?.depth, toNumber(box.depth))
    },
    position: sanitizePoint(box.position),
    rotation: sanitizePoint(box.rotation)
  };
}

function sanitizeStep(step = {}, index = 0) {
  return {
    id: toNumber(step.id, index + 1),
    name: sanitizeText(step.name || `Buoc ${index + 1}`, 120),
    destination: sanitizeText(step.destination, 80),
    group: sanitizeText(step.group || step.destination || 'General', 80),
    priority: toNumber(step.priority, 3),
    sku: sanitizeText(step.sku, 80),
    weight: toNumber(step.weight),
    width: toNumber(step.width),
    height: toNumber(step.height),
    depth: toNumber(step.depth),
    position: step.position ? sanitizePoint(step.position) : null
  };
}

function sanitizeQueueGroup(group = {}) {
  return {
    queueKey: sanitizeText(group.queueKey || createPublicId(), 120),
    destination: sanitizeText(group.destination, 80),
    group: sanitizeText(group.group || group.destination || 'General', 80),
    priority: toNumber(group.priority, 3),
    totalQty: toNumber(group.totalQty),
    totalWeight: toNumber(group.totalWeight),
    totalVolume: toNumber(group.totalVolume),
    items: Array.isArray(group.items) ? group.items.slice(0, 12).map(item => sanitizeEntry(item)) : []
  };
}

function normalizeSnapshot(payload = {}) {
  const rules = sanitizeRuleSet(payload.rules);
  return {
    version: sanitizeText(payload.version || 'snapshot', 32),
    source: sanitizeText(payload.source || 'snapshot', 40),
    exportedAt: payload.exportedAt || new Date().toISOString(),
    shipment: {
      name: sanitizeText(payload.shipment?.name || 'Untitled shipment', 120),
      ref: sanitizeText(payload.shipment?.ref, 80),
      mode: sanitizeText(payload.shipment?.mode || 'export', 40),
      objective: sanitizeText(payload.shipment?.objective || 'balanced', 40),
      route: sanitizeText(payload.shipment?.route, 180),
      routeStops: Array.isArray(payload.shipment?.routeStops) ? payload.shipment.routeStops.map(stop => sanitizeText(stop, 80)) : [],
      notes: sanitizeText(payload.shipment?.notes, 500)
    },
    container: {
      code: sanitizeText(payload.container?.code, 40),
      type: sanitizeText(payload.container?.type || payload.container?.name || 'Container', 120),
      name: sanitizeText(payload.container?.name || payload.container?.type || 'Container', 120),
      width: toNumber(payload.container?.width),
      height: toNumber(payload.container?.height),
      depth: toNumber(payload.container?.depth),
      maxLoad: toNumber(payload.container?.maxLoad),
      tare: toNumber(payload.container?.tare),
      allowOverhangPercent: toNumber(payload.container?.allowOverhangPercent),
      axlePositions: Array.isArray(payload.container?.axlePositions) ? payload.container.axlePositions.map(val => toNumber(val)) : [],
      axleLimits: Array.isArray(payload.container?.axleLimits) ? payload.container.axleLimits.map(val => toNumber(val)) : [],
      color: toNumber(payload.container?.color, 0x3b82f6)
    },
    rules,
    activeRules: Array.isArray(payload.activeRules) ? payload.activeRules.slice(0, 12).map(rule => sanitizeText(rule, 80)) : [],
    metrics: sanitizeMetricSet(payload.metrics),
    queueGroups: Array.isArray(payload.queueGroups) ? payload.queueGroups.slice(0, 60).map(group => sanitizeQueueGroup(group)) : [],
    plannedEntries: Array.isArray(payload.plannedEntries) ? payload.plannedEntries.slice(0, 500).map(entry => sanitizeEntry(entry)) : [],
    boxes: Array.isArray(payload.boxes) ? payload.boxes.slice(0, 500).map((box, index) => sanitizePlacedBox(box, index)) : [],
    stepPlan: Array.isArray(payload.stepPlan) ? payload.stepPlan.slice(0, 500).map((step, index) => sanitizeStep(step, index)) : []
  };
}

function cleanupSnapshots() {
  const now = Date.now();
  for (const [publicId, record] of snapshotStore.entries()) {
    if ((record.expiresAt || 0) <= now) snapshotStore.delete(publicId);
  }
}

function saveSnapshot(payload = {}) {
  cleanupSnapshots();
  const publicId = createPublicId();
  const now = new Date();
  const snapshot = normalizeSnapshot(payload);
  const record = {
    ...snapshot,
    publicId,
    createdAt: now.toISOString(),
    expiresAt: now.getTime() + SNAPSHOT_TTL_MS
  };
  snapshotStore.set(publicId, record);
  return record;
}

// Create public snapshot from live front-end state
router.post('/public/snapshot', async (req, res) => {
  try {
    if (!req.body?.container) {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu container để chia sẻ' });
    }

    const record = saveSnapshot(req.body);
    res.json({
      success: true,
      data: {
        publicId: record.publicId,
        createdAt: record.createdAt,
        expiresInHours: SNAPSHOT_TTL_MS / (60 * 60 * 1000),
        url: `/p/${record.publicId}`,
        reportUrl: `/p/${record.publicId}?print=1&autoplay=0`
      }
    });
  } catch (error) {
    console.error('Snapshot share error:', error);
    res.status(500).json({ success: false, message: 'Lỗi tạo snapshot chia sẻ' });
  }
});

// Create or return public link for a persisted project
router.post('/:projectId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Không tìm thấy dự án' });
    if (!project.publicId) {
      project.publicId = createPublicId();
      project.shared = true;
      await project.save();
    }
    res.json({ success: true, data: { publicId: project.publicId, url: `/p/${project.publicId}` } });
  } catch (error) {
    console.error('Project share error:', error);
    res.status(500).json({ success: false, message: 'Lỗi tạo link chia sẻ' });
  }
});

// Get snapshot or persisted project for public view-only mode
router.get('/view/:publicId', async (req, res) => {
  try {
    cleanupSnapshots();
    const sharedSnapshot = snapshotStore.get(req.params.publicId);
    if (sharedSnapshot) {
      return res.json({ success: true, data: sharedSnapshot });
    }

    const project = await Project.findOne({ publicId: req.params.publicId }).lean();
    if (!project) return res.status(404).json({ success: false, message: 'Không tìm thấy dự án' });
    return res.json({ success: true, data: project });
  } catch (error) {
    console.error('View share error:', error);
    res.status(500).json({ success: false, message: 'Lỗi tải dữ liệu chia sẻ' });
  }
});

module.exports = router;
