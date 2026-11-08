import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://your-project.vercel.app';

class AffiliateApiClient {
  private client: AxiosInstance;
  private apiKey: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      if (this.apiKey) {
        config.headers.Authorization = `Bearer ${this.apiKey}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Clear auth on unauthorized
          this.apiKey = null;
          if (typeof window !== 'undefined') {
            localStorage.removeItem('chaos-affiliate-storage');
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  clearApiKey() {
    this.apiKey = null;
  }

  // Auth
  async login(apiKey: string) {
    const response = await this.client.post('/api/auth/verify', { apiKey });
    return response.data;
  }

  // Affiliate profile
  async getProfile() {
    const response = await this.client.get('/api/affiliate/profile');
    return response.data;
  }

  async updateProfile(data: Partial<{ email: string; walletAddress: string }>) {
    const response = await this.client.put('/api/affiliate/profile', data);
    return response.data;
  }

  // Campaigns
  async getCampaigns(params?: { status?: string; page?: number; limit?: number }) {
    const response = await this.client.get('/api/affiliate/campaigns', { params });
    return response.data;
  }

  async getCampaign(id: string) {
    const response = await this.client.get(`/api/affiliate/campaigns/${id}`);
    return response.data;
  }

  async createCampaign(data: { name: string; description?: string; rsaKeySize?: number }) {
    const response = await this.client.post('/api/affiliate/campaigns', data);
    return response.data;
  }

  // Stats
  async getOverviewStats(range?: string) {
    const response = await this.client.get('/api/affiliate/stats/overview', { params: { range } });
    return response.data;
  }

  async getEarningsStats(range?: string) {
    const response = await this.client.get('/api/affiliate/stats/earnings', { params: { range } });
    return response.data;
  }

  async getConversionFunnel() {
    const response = await this.client.get('/api/affiliate/stats/funnel');
    return response.data;
  }

  // Earnings / Payouts
  async getPayouts(params?: { status?: string; page?: number; limit?: number }) {
    const response = await this.client.get('/api/affiliate/payouts', { params });
    return response.data;
  }

  async requestPayout(amount: number, walletAddress: string) {
    const response = await this.client.post('/api/affiliate/payouts', { amount, walletAddress });
    return response.data;
  }

  // Referral
  async getReferralStats() {
    const response = await this.client.get('/api/affiliate/referral/stats');
    return response.data;
  }

  async getReferrals(params?: { page?: number; limit?: number }) {
    const response = await this.client.get('/api/affiliate/referral/list', { params });
    return response.data;
  }

  // Tickets
  async getTickets(params?: { status?: string; page?: number; limit?: number }) {
    const response = await this.client.get('/api/affiliate/tickets', { params });
    return response.data;
  }

  async createTicket(data: { subject: string; message: string; priority?: 'low' | 'medium' | 'high' }) {
    const response = await this.client.post('/api/affiliate/tickets', data);
    return response.data;
  }

  async getTicket(id: string) {
    const response = await this.client.get(`/api/affiliate/tickets/${id}`);
    return response.data;
  }

  async replyTicket(id: string, message: string) {
    const response = await this.client.post(`/api/affiliate/tickets/${id}/reply`, { message });
    return response.data;
  }

  // Payload Builder
  async buildPayload(config: Record<string, any>) {
    const response = await this.client.post('/api/affiliate/builder', config, {
      responseType: 'blob',
      timeout: 120000,
    });
    return response.data;
  }

  async getBuilderTemplates() {
    const response = await this.client.get('/api/affiliate/builder/templates');
    return response.data;
  }

  // Real-time
  async getRealtimeEvents(since?: number) {
    const response = await this.client.get('/api/realtime/events', { params: { since } });
    return response.data;
  }
}

export const api = new AffiliateApiClient();