// vercel-dashboard/api/stats/index.js
// Dashboard stats endpoint - aggregates infection telemetry

import { kv } from '../../lib/kv.js';

export default async function handler(request, response) {
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { infectionId, range = '7d' } = request.query;

    if (infectionId) {
      // Single infection stats
      return await getInfectionStats(response, infectionId);
    } else {
      // Global dashboard stats
      return await getGlobalStats(response, range);
    }
  } catch (error) {
    console.error('Stats error:', error);
    response.status(500).json({ error: 'Internal server error' });
  }
}

async function getInfectionStats(response, infectionId) {
  const statsKey = `infection:${infectionId}:stats`;
  const filesKey = `infection:${infectionId}:files`;
  const extsKey = `infection:${infectionId}:exts`;

  const [stats, fileIds, exts] = await Promise.all([
    kv.hgetall(statsKey),
    kv.smembers(filesKey),
    kv.hgetall(extsKey)
  ]);

  if (!stats || Object.keys(stats).length === 0) {
    return response.status(404).json({ error: 'Infection not found' });
  }

  // Get recent files (last 20)
  const recentFiles = [];
  if (fileIds && fileIds.length > 0) {
    const recentIds = fileIds.slice(-20);
    for (const fileId of recentIds) {
      const meta = await kv.get(`file:${fileId}:meta`);
      if (meta) recentFiles.push(meta);
    }
  }

  response.json({
    infectionId,
    stats: {
      totalFiles: parseInt(stats.totalFiles || '0'),
      totalBytes: parseInt(stats.totalBytes || '0'),
      lastSeen: stats.lastSeen || null,
      firstSeen: stats.firstSeen || null
    },
    extensions: exts || {},
    recentFiles: recentFiles.reverse()
  });
}

async function getGlobalStats(response, range) {
  // Calculate date range
  const days = range === '1d' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 7;
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  // Get daily stats
  const dailyStats = [];
  let totalUploads = 0;
  let totalBytes = 0;
  let totalInfections = new Set();

  for (const date of dates) {
    const dayStats = await kv.hgetall(`global:daily:${date}`);
    const uploads = parseInt(dayStats?.uploads || '0');
    const bytes = parseInt(dayStats?.bytes || '0');
    dailyStats.push({ date, uploads, bytes });
    totalUploads += uploads;
    totalBytes += bytes;
  }

  // Get all infection IDs (scan keys)
  // Note: In production, maintain a global infection index
  // For now, we'll track via a set
  const infectionCount = await kv.scard('global:infections') || 0;

  response.json({
    range,
    summary: {
      totalInfections: infectionCount,
      totalUploads,
      totalBytes,
      avgFilesPerInfection: infectionCount > 0 ? (totalUploads / infectionCount).toFixed(1) : 0
    },
    daily: dailyStats,
    topExtensions: await getTopExtensions(),
    recentInfections: await getRecentInfections(10)
  });
}

async function getTopExtensions(limit = 10) {
  // Aggregate across all infections (simplified)
  // In production, maintain a global extension counter
  const exts = {};
  // This would require scanning all infection keys
  // For now return empty - would need a global index
  return Object.entries(exts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([ext, count]) => ({ ext, count }));
}

async function getRecentInfections(limit = 10) {
  // Would need a global infection index with timestamps
  // For now, return empty
  return [];
}
