'use client';

import { useState, useEffect } from 'react';
import { 
  Ticket, 
  MessageSquare, 
  Plus, 
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Send,
  Paperclip,
  Eye,
  MoreVertical,
  Loader2,
  Trash2,
  Edit2,
  Flag,
  Star
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { formatDate, formatRelativeTime, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Ticket {
  id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'waiting' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'technical' | 'billing' | 'payout' | 'campaign' | 'general';
  createdAt: string;
  updatedAt: string;
  lastReplyAt: string;
  replies: TicketReply[];
  unreadCount: number;
}

interface TicketReply {
  id: string;
  author: 'affiliate' | 'support';
  authorName: string;
  message: string;
  attachments: Array<{ name: string; url: string; size: number }>;
  createdAt: string;
  internal: boolean;
}

interface TicketsResponse {
  tickets: Ticket[];
  total: number;
  page: number;
  pageSize: number;
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'waiting' | 'closed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'urgent'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newTicket, setNewTicket] = useState({ subject: '', message: '', priority: 'medium', category: 'technical' });
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    fetchTickets();
  }, [page, statusFilter, priorityFilter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const data = await api.getTickets({ 
        status: statusFilter === 'all' ? undefined : statusFilter,
        page, 
        limit: pageSize 
      });
      setTickets(data.tickets || []);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.subject || !newTicket.message) return;

    try {
      setCreatingTicket(true);
      const ticket = await api.createTicket(newTicket);
      setTickets([ticket, ...tickets]);
      setShowCreateModal(false);
      setNewTicket({ subject: '', message: '', priority: 'medium', category: 'technical' });
      toast.success('Ticket created successfully');
    } catch (error) {
      console.error('Failed to create ticket:', error);
      toast.error('Failed to create ticket');
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedTicket) return;

    try {
      setSendingReply(true);
      const updated = await api.replyTicket(selectedTicket.id, replyMessage);
      setSelectedTicket(updated);
      setReplyMessage('');
      toast.success('Reply sent');
    } catch (error) {
      console.error('Failed to send reply:', error);
      toast.error('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const openTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
  };

  const closeTicketView = () => {
    setSelectedTicket(null);
    setReplyMessage('');
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.subject.toLowerCase().includes(search.toLowerCase()) ||
                          t.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const statusConfig = {
    open: { label: 'Open', className: 'badge-info', icon: Clock },
    in_progress: { label: 'In Progress', className: 'badge-warning', icon: Loader2 },
    waiting: { label: 'Waiting', className: 'badge-violet', icon: Clock },
    closed: { label: 'Closed', className: 'badge-neutral', icon: CheckCircle },
  };

  const priorityConfig = {
    low: { label: 'Low', className: 'badge-success', icon: Flag },
    medium: { label: 'Medium', className: 'badge-warning', icon: Flag },
    high: { label: 'High', className: 'badge-rose', icon: AlertTriangle },
    urgent: { label: 'Urgent', className: 'badge-danger', icon: AlertTriangle },
  };

  if (loading && tickets.length === 0) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-chaos-border/20 rounded" />
          <div className="h-10 w-32 bg-chaos-border/20 rounded" />
        </div>
        <div className="card h-96 bg-chaos-border/20" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Support Tickets</h1>
          <p className="text-gray-400 mt-1">Get help with campaigns, payouts, and technical issues</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Ticket
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          className="input-field w-auto"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="waiting">Waiting</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value as any)}
          className="input-field w-auto"
        >
          <option value="all">All Priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      {/* Tickets Grid + Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket List */}
        <div className="lg:col-span-1">
          <div className="card flex flex-col h-full">
            <div className="p-4 border-b border-chaos-border/30">
              <h3 className="font-semibold">Tickets ({filteredTickets.length})</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredTickets.length === 0 ? (
                <div className="p-8 text-center">
                  <Ticket className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No tickets found</p>
                  <p className="text-sm text-gray-500 mt-1">Create a new ticket to get started</p>
                </div>
              ) : (
                <div className="divide-y divide-chaos-border/30">
                  {filteredTickets.map((ticket) => {
                    const sConfig = statusConfig[ticket.status];
                    const pConfig = priorityConfig[ticket.priority];
                    const SIcon = sConfig.icon;
                    const PIcon = pConfig.icon;
                    const isSelected = selectedTicket?.id === ticket.id;

                    return (
                      <button
                        key={ticket.id}
                        onClick={() => openTicket(ticket)}
                        className={cn(
                          'w-full p-4 text-left transition-all',
                          isSelected ? 'bg-chaos-gold/10 border-l-2 border-chaos-gold' : 'hover:bg-chaos-border/20'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs text-gray-400">{ticket.id.substring(0, 12)}...</span>
                              <span className={cn('badge text-xs', sConfig.className)}>
                                <SIcon className="w-3 h-3 mr-1" />
                                {sConfig.label}
                              </span>
                              <span className={cn('badge text-xs', pConfig.className)}>
                                <PIcon className="w-3 h-3 mr-1" />
                                {pConfig.label}
                              </span>
                            </div>
                            <p className="font-medium truncate">{ticket.subject}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              Updated {formatRelativeTime(ticket.updatedAt)}
                              {ticket.unreadCount > 0 && (
                                <span className="ml-2 badge badge-info text-xs">{ticket.unreadCount} new</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              <div className="p-4 border-t border-chaos-border/30 flex items-center justify-between">
                <span className="text-sm text-gray-400">Page {page}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary text-sm px-3"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={filteredTickets.length < pageSize}
                    className="btn-secondary text-sm px-3"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ticket Detail */}
        <div className="lg:col-span-2">
          {selectedTicket ? (
            <TicketDetail
              ticket={selectedTicket}
              replyMessage={replyMessage}
              setReplyMessage={setReplyMessage}
              onReply={handleReply}
              sendingReply={sendingReply}
              onClose={closeTicketView}
            />
          ) : (
            <div className="card h-full flex items-center justify-center">
              <div className="text-center">
                <Ticket className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">Select a Ticket</h3>
                <p className="text-gray-400 mt-1">Click on a ticket from the list to view details and reply</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-2xl mx-4 animate-in max-h-[90vh] overflow-auto">
            <CardHeader>
              <CardTitle>Create New Ticket</CardTitle>
            </CardHeader>
            <form onSubmit={handleCreateTicket}>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select
                    value={newTicket.category}
                    onChange={e => setNewTicket({...newTicket, category: e.target.value})}
                    className="input-field"
                  >
                    <option value="technical">Technical Issue</option>
                    <option value="billing">Billing / Payments</option>
                    <option value="payout">Payout Request</option>
                    <option value="campaign">Campaign Management</option>
                    <option value="general">General Inquiry</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Priority</label>
                  <select
                    value={newTicket.priority}
                    onChange={e => setNewTicket({...newTicket, priority: e.target.value})}
                    className="input-field"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Subject</label>
                  <input
                    type="text"
                    value={newTicket.subject}
                    onChange={e => setNewTicket({...newTicket, subject: e.target.value})}
                    className="input-field"
                    placeholder="Brief description of the issue"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Message</label>
                  <textarea
                    value={newTicket.message}
                    onChange={e => setNewTicket({...newTicket, message: e.target.value})}
                    className="input-field"
                    rows={6}
                    placeholder="Describe your issue in detail..."
                    required
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" disabled={creatingTicket} className="btn-primary flex-1">
                    {creatingTicket ? 'Creating...' : 'Submit Ticket'}
                  </button>
                </div>
              </CardContent>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TicketDetail({ ticket, replyMessage, setReplyMessage, onReply, sendingReply, onClose }: { 
  ticket: Ticket; 
  replyMessage: string;
  setReplyMessage: (msg: string) => void;
  onReply: (e: React.FormEvent) => void;
  sendingReply: boolean;
  onClose: () => void;
}) {
  const statusConfig = {
    open: { label: 'Open', className: 'badge-info', icon: Clock },
    in_progress: { label: 'In Progress', className: 'badge-warning', icon: Loader2 },
    waiting: { label: 'Waiting', className: 'badge-violet', icon: Clock },
    closed: { label: 'Closed', className: 'badge-neutral', icon: CheckCircle },
  };

  const priorityConfig = {
    low: { label: 'Low', className: 'badge-success' },
    medium: { label: 'Medium', className: 'badge-warning' },
    high: { label: 'High', className: 'badge-rose' },
    urgent: { label: 'Urgent', className: 'badge-danger' },
  };

  const sConfig = statusConfig[ticket.status];
  const pConfig = priorityConfig[ticket.priority];
  const SIcon = sConfig.icon;

  return (
    <div className="card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-chaos-border/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-gray-400">{ticket.id}</span>
              <span className={cn('badge', sConfig.className)}>
                <SIcon className="w-3 h-3 mr-1" />
                {sConfig.label}
              </span>
              <span className={cn('badge', pConfig.className)}>{pConfig.label}</span>
            </div>
            <h3 className="text-lg font-semibold">{ticket.subject}</h3>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>Created: {formatDate(ticket.createdAt)}</span>
          <span>•</span>
          <span>Updated: {formatRelativeTime(ticket.updatedAt)}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {ticket.replies.map((reply, i) => (
          <div 
            key={reply.id} 
            className={cn('flex gap-4 animate-in', reply.author === 'affiliate' ? 'flex-row-reverse' : '')}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', 
              reply.author === 'affiliate' ? 'bg-chaos-gold/20' : 'bg-chaos-sky/20')}>
              <span className={cn('font-bold text-sm', reply.author === 'affiliate' ? 'text-chaos-gold' : 'text-chaos-sky')}>
                {reply.authorName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className={cn('flex-1 glass rounded-xl p-4', reply.author === 'affiliate' ? 'border-r-2 border-chaos-gold' : 'border-l-2 border-chaos-sky')}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{reply.authorName}</span>
                <span className="text-xs text-gray-400">{formatRelativeTime(reply.createdAt)}</span>
              </div>
              <p className="text-gray-300 whitespace-pre-wrap">{reply.message}</p>
              {reply.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {reply.attachments.map((att, j) => (
                    <a key={j} href={att.url} target="_blank" rel="noopener noreferrer" className="badge badge-info text-xs flex items-center gap-1">
                      <Paperclip className="w-3 h-3" />
                      {att.name} ({(att.size / 1024).toFixed(1)} KB)
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Reply Form */}
      {ticket.status !== 'closed' && (
        <form onSubmit={onReply} className="p-4 border-t border-chaos-border/30">
          <div className="flex gap-3">
            <textarea
              value={replyMessage}
              onChange={e => setReplyMessage(e.target.value)}
              placeholder="Type your reply..."
              className="input-field flex-1 min-h-[100px] resize-none"
              rows={4}
            />
            <button 
              type="submit" 
              disabled={sendingReply || !replyMessage.trim()}
              className="btn-primary self-end px-6"
            >
              {sendingReply ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>
      )}

      {ticket.status === 'closed' && (
        <div className="p-4 border-t border-chaos-border/30 text-center text-gray-400">
          This ticket is closed. No further replies can be added.
        </div>
      )}
    </div>
  );
}