import { useCallback, useEffect, useRef, useState } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'
import { chatSupabase } from '../lib/chatSupabase'
import { Send, Hash, Users } from 'lucide-react'
import { TEAM } from '../data/team'

type Channel = { id: string; name: string; slug: string; description: string }
type Message = { id: string; channel_id: string; sender_name: string; sender_id: string; sender_initial: string; content: string; created_at: string }

export default function Content() {
  useDocumentTitle('Forum - Checkmark Audio')
  const { profile } = useAuth()
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load channels
  useEffect(() => {
    chatSupabase.from('chat_channels').select('*').order('created_at').then(({ data }) => {
      if (data && data.length > 0) {
        setChannels(data)
        setActiveChannel(data[0])
      }
      setLoading(false)
    })
  }, [])

  // Load messages for active channel
  const loadMessages = useCallback(async () => {
    if (!activeChannel) return
    const { data } = await chatSupabase
      .from('chat_messages')
      .select('*')
      .eq('channel_id', activeChannel.id)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }, [activeChannel])

  useEffect(() => { loadMessages() }, [loadMessages])

  // Realtime subscription
  useEffect(() => {
    if (!activeChannel) return
    const sub = chatSupabase
      .channel(`messages-${activeChannel.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${activeChannel.id}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message])
        }
      )
      .subscribe()
    return () => { chatSupabase.removeChannel(sub) }
  }, [activeChannel])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send message
  const sendMessage = async () => {
    if (!input.trim() || !activeChannel) return
    const name = profile?.display_name ?? 'User'
    const id = profile?.id ?? 'dev-user'
    const initial = name.charAt(0).toUpperCase()
    await chatSupabase.from('chat_messages').insert({
      channel_id: activeChannel.id,
      sender_name: name,
      sender_id: id,
      sender_initial: initial,
      content: input.trim(),
    })
    setInput('')
  }

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    } catch { return '' }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-6 w-6 border-2 border-gold/20 border-t-gold" /></div>
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <h1 className="text-[28px] font-extrabold tracking-tight text-text mb-3">Forum</h1>

      <div className="flex h-[500px] bg-surface rounded-2xl border border-border overflow-hidden">
        {/* Sidebar: Channels + Members */}
        <div className="w-[200px] border-r border-border flex flex-col shrink-0">
          {/* Channels */}
          <div className="px-3 pt-4 pb-2">
            <p className="text-[10px] font-semibold text-text-light uppercase tracking-wider mb-2">Channels</p>
            <div className="space-y-0.5">
              {channels.map(ch => (
                <button key={ch.id} onClick={() => setActiveChannel(ch)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${activeChannel?.id === ch.id ? 'bg-gold/10 text-gold' : 'text-text-muted hover:text-text hover:bg-white/[0.03]'}`}>
                  <Hash size={13} className={activeChannel?.id === ch.id ? 'text-gold' : 'text-text-light'} />
                  <span className="text-[13px] font-medium tracking-tight truncate">{ch.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Members */}
          <div className="px-3 pt-3 pb-4 mt-auto border-t border-border/50">
            <p className="text-[10px] font-semibold text-text-light uppercase tracking-wider mb-2 flex items-center gap-1">
              <Users size={10} /> Members
            </p>
            <div className="space-y-1">
              {TEAM.filter(m => m.status === 'Active').map(m => (
                <div key={m.id} className="flex items-center gap-2 py-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-[11px] text-text-muted truncate">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Channel header */}
          <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-[15px] font-bold text-text tracking-tight flex items-center gap-1.5">
                <Hash size={14} className="text-gold" />
                {activeChannel?.name ?? 'Select a channel'}
              </h2>
              {activeChannel?.description && (
                <p className="text-[11px] text-text-light mt-0.5">{activeChannel.description}</p>
              )}
            </div>
            <span className="text-[10px] text-text-light">{messages.length} messages</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
            {messages.length === 0 && (
              <p className="text-[13px] text-text-light text-center py-8">No messages yet. Start the conversation!</p>
            )}
            {messages.map(msg => {
              const isMe = msg.sender_id === (profile?.id ?? 'dev-user')
              return (
                <div key={msg.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-alt border border-border-light text-gold flex items-center justify-center text-[12px] font-bold shrink-0 mt-0.5">
                    {msg.sender_initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-semibold tracking-tight text-gold">{msg.sender_name}</span>
                      <span className="text-[10px] text-text-light">{formatTime(msg.created_at)}</span>
                    </div>
                    <p className="text-[14px] font-normal text-text-muted leading-relaxed mt-0.5">{msg.content}</p>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <div className="px-5 py-3 border-t border-border shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder={`Message #${activeChannel?.name ?? ''}...`}
                className="flex-1 bg-surface-alt border border-border rounded-xl px-4 py-2.5 text-[14px] placeholder:text-text-light focus:border-gold"
              />
              <button onClick={sendMessage} disabled={!input.trim()}
                className={`px-4 py-2.5 rounded-xl transition-all ${input.trim() ? 'bg-gold text-black hover:bg-gold-muted' : 'bg-surface-alt text-text-light border border-border cursor-not-allowed'}`}>
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Troubleshooting / Feedback */}
      <div className="bg-surface rounded-2xl border border-border p-5 mt-4">
        <h2 className="text-[16px] font-bold text-text tracking-tight mb-1">Troubleshooting</h2>
        <p className="text-[11px] text-text-light mb-4">Report issues and propose fixes.</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">Short issue description</label>
            <input type="text" placeholder="Describe the issue..."
              className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2 text-sm placeholder:text-text-light focus:border-gold" />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">What we tried / ideas to fix</label>
            <input type="text" placeholder="Steps taken and potential fixes"
              className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2 text-sm placeholder:text-text-light focus:border-gold" />
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">Severity</label>
              <select className="w-full bg-surface-alt border border-border rounded-xl px-3 py-2 text-sm focus:border-gold">
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Critical</option>
              </select>
            </div>
            <button className="px-5 py-2 rounded-xl bg-gold hover:bg-gold-muted text-black text-sm font-semibold transition-colors shrink-0">
              Submit report
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
