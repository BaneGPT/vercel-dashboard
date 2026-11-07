// vercel-dashboard/lib/kv.js
// Upstash Redis compatibility layer for @vercel/kv API

import { Redis } from '@upstash/redis';

// Create Redis client from environment variables
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Helper to convert KV-style operations to Redis
export const kv = {
  // String operations
  async get(key) {
    return await redis.get(key);
  },
  
  async set(key, value, options = {}) {
    if (options.ex || options.expire) {
      const ttl = options.ex || options.expire;
      await redis.set(key, value, { ex: ttl });
    } else {
      await redis.set(key, value);
    }
    return 'OK';
  },
  
  async del(...keys) {
    if (keys.length === 0) return 0;
    return await redis.del(...keys);
  },
  
  async expire(key, seconds) {
    return await redis.expire(key, seconds);
  },
  
  async incr(key) {
    return await redis.incr(key);
  },

  // Hash operations
  async hget(key, field) {
    return await redis.hget(key, field);
  },
  
  async hset(key, data) {
    if (typeof data === 'object' && !Array.isArray(data)) {
      return await redis.hset(key, data);
    }
    // Handle hset(key, field, value) format
    const args = Array.from(arguments).slice(1);
    if (args.length === 2) {
      return await redis.hset(key, { [args[0]]: args[1] });
    }
    return await redis.hset(key, data);
  },
  
  async hgetall(key) {
    return await redis.hgetall(key);
  },
  
  async hincrby(key, field, amount) {
    return await redis.hincrby(key, field, amount);
  },
  
  async hincrbyfloat(key, field, amount) {
    return await redis.hincrbyfloat(key, field, amount);
  },

  // Set operations
  async sadd(key, ...members) {
    return await redis.sadd(key, ...members);
  },
  
  async srem(key, ...members) {
    return await redis.srem(key, ...members);
  },
  
  async smembers(key) {
    return await redis.smembers(key);
  },
  
  async scard(key) {
    return await redis.scard(key);
  },
  
  async sismember(key, member) {
    return await redis.sismember(key, member);
  },

  // List operations
  async lpush(key, ...values) {
    return await redis.lpush(key, ...values);
  },
  
  async lrange(key, start, stop) {
    return await redis.lrange(key, start, stop);
  },
  
  async ltrim(key, start, stop) {
    return await redis.ltrim(key, start, stop);
  },
  
  async llen(key) {
    return await redis.llen(key);
  },

  // Sorted set operations (if needed)
  async zadd(key, score, member) {
    return await redis.zadd(key, { score, member });
  },
  
  async zrem(key, ...members) {
    return await redis.zrem(key, ...members);
  },
  
  async zrange(key, start, stop, options = {}) {
    return await redis.zrange(key, start, stop, options);
  },
  
  async zrevrange(key, start, stop, options = {}) {
    return await redis.zrevrange(key, start, stop, options);
  },

  // Key operations
  async keys(pattern) {
    return await redis.keys(pattern);
  },
  
  async exists(...keys) {
    return await redis.exists(...keys);
  },
};

export default kv;