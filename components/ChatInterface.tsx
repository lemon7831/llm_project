import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Bot, User as UserIcon, Loader2, ChevronDown, ChevronRight, CheckCircle2, Search, ShieldAlert, BrainCircuit, RefreshCw, ThumbsUp, ThumbsDown, Edit, Pin, Save, X, Lightbulb, Settings, Trash2, Plus, MessageSquareText, CircleHelp
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { BotConfig, ChatMessage, ThoughtStep, User, FileData, UserMemory, FeedbackCorrection, ChatSession } from '../types';
import { QUALITY_RULES, ERROR_REASONS } from '../constants';

interface ChatInterfaceProps {
  currentUser: User;
  botConfig: BotConfig;
  files: FileData[];
  memories: UserMemory[];
  setMemories: React.Dispatch<React.SetStateAction<UserMemory[]>>;
  setCorrections: React.Dispatch<React.SetStateAction<FeedbackCorrection[]>>;
  setChatSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  currentUser, botConfig, files, memories, setMemories, setCorrections, setChatSessions 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sessionId, setSessionId] = useState(() => Date.now().toString());
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [activeFeedbackMsg, setActiveFeedbackMsg] = useState<ChatMessage | null>(null);
  const [feedbackReason, setFeedbackReason] = useState(ERROR_REASONS[0].value);
  const [feedbackCorrection, setFeedbackCorrection] = useState('');
  const [addToMemory, setAddToMemory] = useState(true);
  const [memoryModalOpen, setMemoryModalOpen] = useState(false);

  useEffect(() => {
    const welcomeMsg: ChatMessage = {
      id: 'welcome',
      role: 'assistant',
      content: `你好，我是${botConfig.name}。我有權限存取 [${currentUser.departments.join(', ')}] 的相關資料。請問今天有什麼我可以幫你的？`,
      timestamp: new Date()
    };
    setMessages([welcomeMsg]);
    updateGlobalSession([welcomeMsg]);
  }, [currentUser.id, sessionId]);

  const updateGlobalSession = (msgs: ChatMessage[]) => {
    setChatSessions(prev => {
      const existingIndex = prev.findIndex(s => s.id === sessionId);
      const newSession: ChatSession = { id: sessionId, userId: currentUser.id, userName: currentUser.name, department: currentUser.departments[0] || 'Unknown', startTime: existingIndex >= 0 ? prev[existingIndex].startTime : new Date().toISOString(), lastMessageAt: new Date().toISOString(), messages: msgs };
      if (existingIndex >= 0) { const newSessions = [...prev]; newSessions[existingIndex] = newSession; return newSessions; } else { return [newSession, ...prev]; }
    });
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    updateGlobalSession(newMessages);
    const userText = input;
    setInput('');
    setIsTyping(true);
    const aiMsgId = (Date.now() + 1).toString();
    const initialAiMsg: ChatMessage = { id: aiMsgId, role: 'assistant', content: '', timestamp: new Date(), isThinking: true, thoughtProcess: [] };
    const messagesWithAi = [...newMessages, initialAiMsg];
    setMessages(messagesWithAi);
    updateGlobalSession(messagesWithAi);

    const updateThoughts = (newStep: ThoughtStep) => {
      setMessages(prev => {
        const updated = prev.map(m => { if (m.id === aiMsgId) { return { ...m, thoughtProcess: [...(m.thoughtProcess || []), newStep] }; } return m; });
        updateGlobalSession(updated); return updated;
      });
      scrollToBottom();
    };

    try {
      const isRagEnabled = botConfig.activeTools.includes('rag-retrieval');
      const isWebSearchEnabled = botConfig.activeTools.includes('google-search');
      await new Promise(r => setTimeout(r, 600));
      updateThoughts({ id: 1, name: '意圖分析 (Analyzer)', status: 'done', message: `分析使用者輸入: "${userText}"...` });
      const userMemories = memories.filter(m => m.userId === currentUser.id);
      if (userMemories.length > 0) { await new Promise(r => setTimeout(r, 400)); updateThoughts({ id: 1.5, name: '長期記憶檢索 (Memory)', status: 'done', message: `檢索到 ${userMemories.length} 條相關偏好，將注入 System Prompt。` }); }
      await new Promise(r => setTimeout(r, 600));
      updateThoughts({ id: 2, name: '路由選擇 (Router)', status: 'done', message: `根據配置與意圖，已啟用工具：${isRagEnabled ? '[RAG]' : ''} ${isWebSearchEnabled ? '[Web Search]' : ''}` });
      let fileContext = "RAG 功能未啟用。";
      if (isRagEnabled) {
        const accessibleFiles = files.filter(f => f.permissions.includes('public') || f.permissions.some(p => currentUser.departments.includes(p)));
        fileContext = accessibleFiles.length > 0 ? accessibleFiles.map(f => `- 檔名: ${f.name} (權限: ${f.permissions.join(',')})`).join('\n') : "目前無權限存取任何文件，或資料庫為空。";
        await new Promise(r => setTimeout(r, 600));
        updateThoughts({ id: 3, name: '權限過濾 (Filter)', status: 'done', message: `已載入 ${accessibleFiles.length} 份授權文件。` });
      }
      const memoryContext = userMemories.map(m => `[使用者偏好]: ${m.content}`).join('\n');
      const systemInstruction = `${botConfig.systemPrompt}\n\n[RAG Context]:\n${fileContext}\n\n[Long-term Memory / User Preferences]:\n${memoryContext}\n\nCurrent User: ${currentUser.name} (${currentUser.departments.join(', ')})`;
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: userText, config: { systemInstruction: systemInstruction, tools: isWebSearchEnabled ? [{ googleSearch: {} }] : [] } });
      const responseText = response.text || "抱歉，我現在無法產生回應，請稍後再試。";
      updateThoughts({ id: 4, name: '自我反思 (Reflector)', status: 'done', message: `檢查通過。` });
      setMessages(prev => { const updated = prev.map(m => { if (m.id === aiMsgId) { return { ...m, content: responseText, isThinking: false }; } return m; }); updateGlobalSession(updated); return updated; });
    } catch (error) {
      setMessages(prev => { const updated = prev.map(m => { if (m.id === aiMsgId) { return { ...m, content: "系統發生錯誤，無法連接至 AI 模型。", isThinking: false, thoughtProcess: [...(m.thoughtProcess || []), { id: 99, name: '錯誤', status: 'done' as const, message: '連線失敗' }] }; } return m; }); updateGlobalSession(updated); return updated; });
    } finally { setIsTyping(false); }
  };

  const handleFeedback = (msg: ChatMessage, type: 'like' | 'dislike') => {
    if (type === 'dislike') { setActiveFeedbackMsg(msg); setFeedbackReason(ERROR_REASONS[0].value); setFeedbackCorrection(''); setAddToMemory(true); setFeedbackModalOpen(true); } 
    setMessages(prev => { const updated = prev.map(m => { if (m.id === msg.id) { const newVal = m.feedback === type ? null : type; return { ...m, feedback: newVal }; } return m; }); updateGlobalSession(updated); return updated; });
  };

  const handlePin = (msgId: string) => {
    setMessages(prev => { const updated = prev.map(m => { if (m.id === msgId) { return { ...m, isPinned: !m.isPinned }; } return m; }); updateGlobalSession(updated); return updated; });
  };

  const submitCorrection = () => {
    if (!activeFeedbackMsg) return;
    const newCorrection: FeedbackCorrection = { id: Date.now().toString(), messageId: activeFeedbackMsg.id, originalQuery: "N/A (Context)", badAnswer: activeFeedbackMsg.content, errorReason: feedbackReason, correction: feedbackCorrection, timestamp: new Date().toISOString() };
    setCorrections(prev => [...prev, newCorrection]);
    if (addToMemory && feedbackCorrection) { const newMemory: UserMemory = { id: Date.now().toString(), userId: currentUser.id, content: feedbackCorrection, createdAt: new Date().toISOString() }; setMemories(prev => [...prev, newMemory]); }
    setFeedbackModalOpen(false); setActiveFeedbackMsg(null);
  };

  const deleteMemory = (memoryId: string) => setMemories(prev => prev.filter(m => m.id !== memoryId));
  const startNewSession = () => setSessionId(Date.now().toString());

  return (
    <div className="flex h-full bg-white overflow-hidden relative">
      <div className="w-64 bg-slate-50 border-r border-slate-200 hidden md:flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <button onClick={startNewSession} className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 py-2.5 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100 transition-all shadow-sm active:scale-95"><Plus size={18} /> 新增對話</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          <div className="px-4 py-3 bg-brand-50 text-brand-700 rounded-xl text-sm font-bold cursor-pointer truncate border border-brand-100 ring-4 ring-brand-500/5">目前對話 (Session {sessionId.slice(-4)})</div>
          <div className="px-4 py-3 text-slate-500 hover:bg-slate-100 rounded-xl text-sm font-medium cursor-pointer truncate transition-all opacity-60">查詢業務報表 (昨天)</div>
        </div>
        <div className="p-3 border-t border-slate-200 bg-slate-50/50">
           <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200/50 transition-all text-left">
              <CircleHelp size={18} className="text-slate-400" />
              <span>說明</span>
           </button>
           <button onClick={() => setMemoryModalOpen(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200/50 transition-all text-left">
              <Settings size={18} className="text-slate-400" />
              <span>設定</span>
           </button>
           <div className="mt-2 px-3 pb-2 text-[10px] text-slate-400 font-bold flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              台北, 台灣
           </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative bg-white">
        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 scroll-smooth custom-scrollbar">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-5 ${msg.role === 'user' ? 'flex-row-reverse' : ''} fade-in`}>
              <div className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-sm ${msg.role === 'assistant' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{msg.role === 'assistant' ? <Bot size={22} /> : <UserIcon size={22} />}</div>
              <div className={`flex flex-col max-w-[85%] md:max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] font-bold text-slate-400 mb-2 px-1 uppercase tracking-widest">{msg.role === 'assistant' ? botConfig.name : '使用者本人'} • {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                {msg.role === 'assistant' && msg.thoughtProcess && msg.thoughtProcess.length > 0 && <ThoughtProcessDisplay steps={msg.thoughtProcess} isThinking={msg.isThinking} />}
                {(!msg.isThinking || msg.content) && (
                  <div className={`px-6 py-4 rounded-3xl shadow-sm text-sm md:text-base leading-relaxed whitespace-pre-wrap group relative transition-all duration-300 ${msg.role === 'user' ? 'bg-brand-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'}`}>
                    {msg.content}
                    {msg.role === 'assistant' && !msg.isThinking && (
                      <div className="absolute -bottom-8 left-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-all bg-white shadow-xl rounded-xl p-1 border border-slate-100 z-10 scale-95 group-hover:scale-100">
                         <button onClick={() => handleFeedback(msg, 'like')} className={`p-2 rounded-lg hover:bg-slate-50 transition-all ${msg.feedback === 'like' ? 'text-green-600' : 'text-slate-300'}`} title="答對了"><ThumbsUp size={14} /></button>
                         <div className="w-px bg-slate-100 my-1"></div>
                         <button onClick={() => handleFeedback(msg, 'dislike')} className={`p-2 rounded-lg hover:bg-slate-50 transition-all ${msg.feedback === 'dislike' ? 'text-red-500' : 'text-slate-300'}`} title="有錯誤"><ThumbsDown size={14} /></button>
                         <div className="w-px bg-slate-100 my-1"></div>
                         <button onClick={() => handlePin(msg.id)} className={`p-2 rounded-lg hover:bg-slate-50 transition-all ${msg.isPinned ? 'text-brand-600' : 'text-slate-300'}`} title="存入記憶"><Pin size={14} className={msg.isPinned ? "fill-brand-600" : ""} /></button>
                      </div>
                    )}
                  </div>
                )}
                {msg.isThinking && !msg.content && <div className="flex items-center gap-3 text-brand-600 font-bold text-xs mt-3 bg-brand-50 px-4 py-2 rounded-full border border-brand-100 animate-pulse"><Loader2 size={16} className="animate-spin" /> 正在編譯思維鏈與執行操作...</div>}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-6 bg-white border-t border-slate-100">
          <div className="max-w-4xl mx-auto relative flex items-center group">
            <div className="absolute left-4 text-slate-300 group-focus-within:text-brand-600 transition-colors pointer-events-none"><MessageSquareText size={20} /></div>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !isTyping && handleSend()} placeholder={isTyping ? "Agent 正在回應中，請稍候..." : "輸入訊息... (試著問：幫我整理本週會議紀錄)"} disabled={isTyping} className="w-full pl-12 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-base focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all outline-none font-medium shadow-inner" />
            <button onClick={handleSend} disabled={!input.trim() || isTyping} className="absolute right-3 p-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:bg-slate-200 disabled:cursor-not-allowed transition-all shadow-md active:scale-90"><Send size={20} /></button>
          </div>
          <p className="text-center text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-widest flex items-center justify-center gap-4"><span className="w-12 h-px bg-slate-100"></span> 企業級安全加密傳輸與隱私防護實例已啟動 <span className="w-12 h-px bg-slate-100"></span></p>
        </div>
      </div>

      {memoryModalOpen && (
         <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl h-[70vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
               <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-bold text-slate-900 flex items-center gap-3"><BrainCircuit size={24} className="text-brand-600"/> 個人長期記憶配置庫</h3>
                  <button onClick={() => setMemoryModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-2"><X size={24}/></button>
               </div>
               <div className="flex-1 overflow-y-auto p-8 space-y-6">
                  <p className="text-sm text-slate-500 leading-relaxed font-medium">以下是 Agent 基於過去對話為您建立的個性化偏好。Agent 在生成回答時將優先考慮這些規則。</p>
                  {memories.filter(m => m.userId === currentUser.id).length === 0 ? (
                     <div className="text-center py-16 text-slate-300 italic bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">目前記憶庫為空，請在對話中標註重點來新增。</div>
                  ) : (
                     memories.filter(m => m.userId === currentUser.id).map(memory => (
                        <div key={memory.id} className="flex gap-4 bg-white border border-slate-100 p-5 rounded-2xl group hover:border-brand-200 hover:shadow-md transition-all">
                           <div className="mt-1"><Lightbulb size={20} className="text-amber-500" /></div>
                           <div className="flex-1">
                              <p className="text-slate-800 text-sm font-medium leading-relaxed">{memory.content}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">{new Date(memory.createdAt).toLocaleDateString()}</p>
                           </div>
                           <button onClick={() => deleteMemory(memory.id)} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all self-start p-2 hover:bg-red-50 rounded-lg" title="永久刪除此項記憶"><Trash2 size={18} /></button>
                        </div>
                     ))
                  )}
               </div>
            </div>
         </div>
      )}

      {feedbackModalOpen && activeFeedbackMsg && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
              <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-6 flex justify-between items-center">
                <h3 className="font-bold text-slate-900 flex items-center gap-3"><ShieldAlert size={22} className="text-red-500" /> 內容校正與規則回饋</h3>
                <button onClick={() => setFeedbackModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-2 transition-all"><X size={24} /></button>
              </div>
              <div className="p-8 space-y-6">
                <div className="bg-red-50/50 border border-red-100 rounded-2xl p-5 text-sm">
                   <p className="font-bold text-[10px] text-red-500 uppercase tracking-widest mb-2 opacity-70">當前回應摘要</p>
                   <p className="text-red-900 line-clamp-3 leading-relaxed font-medium italic">"{activeFeedbackMsg.content}"</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">識別失效類型</label>
                  <select value={feedbackReason} onChange={(e) => setFeedbackReason(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold bg-slate-50/50 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all">
                    {ERROR_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">預期的正確回答或校正規則</label>
                   <textarea value={feedbackCorrection} onChange={(e) => setFeedbackCorrection(e.target.value)} placeholder="例如：下次請用繁體中文回應，並優先參考員工手冊第三章。" className="w-full border border-slate-200 rounded-xl px-4 py-4 text-sm font-medium h-32 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all resize-none shadow-inner" />
                </div>
                <div className="flex items-center gap-3 p-4 bg-brand-50 rounded-2xl border border-brand-100">
                  <input type="checkbox" id="addMemory" checked={addToMemory} onChange={(e) => setAddToMemory(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" />
                  <label htmlFor="addMemory" className="text-sm font-bold text-brand-900 flex items-center gap-2 cursor-pointer select-none"><Lightbulb size={16} className="text-amber-500" /> 將此修正同步至我的長期記憶庫</label>
                </div>
              </div>
              <div className="bg-slate-50 border-t border-slate-200 px-8 py-5 flex justify-end gap-3">
                 <button onClick={() => setFeedbackModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-900 transition-all">放棄</button>
                 <button onClick={submitCorrection} disabled={!feedbackCorrection.trim()} className="px-10 py-2.5 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-lg disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 transition-all transform active:scale-95"><Save size={18} /> 提交校正並優化系統</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const ThoughtProcessDisplay: React.FC<{steps: ThoughtStep[], isThinking?: boolean}> = ({ steps, isThinking }) => {
  const [isOpen, setIsOpen] = useState(true);
  useEffect(() => { if (!isThinking && steps.length > 0) { const timer = setTimeout(() => { setIsOpen(false); }, 2500); return () => clearTimeout(timer); } }, [isThinking, steps.length]);
  return (
    <div className="w-full mb-3 fade-in">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2.5 text-[10px] font-black text-slate-400 hover:text-brand-600 transition-all mb-3 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100 uppercase tracking-widest">
        <BrainCircuit size={14} className={isThinking ? "animate-pulse" : ""} />
        思維導圖與執行鏈 ({steps.length})
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {isOpen && (
        <div className="bg-slate-50/50 rounded-3xl border border-slate-100 p-6 space-y-5 text-xs mb-4 shadow-inner">
          {steps.map((step) => (
            <div key={step.id} className="flex gap-4 fade-in">
              <div className="mt-0.5 flex-shrink-0">
                {step.name.includes('意圖') && <Search size={16} className="text-purple-500" />}
                {step.name.includes('記憶') && <BrainCircuit size={16} className="text-pink-500" />}
                {step.name.includes('路由') && <RefreshCw size={16} className="text-blue-500" />}
                {step.name.includes('過濾') && <ShieldAlert size={16} className="text-amber-500" />}
                {step.name.includes('反思') && <CheckCircle2 size={16} className="text-green-500" />}
                {step.name.includes('錯誤') && <ShieldAlert size={16} className="text-red-500" />}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between"><span className="font-black text-slate-700 uppercase tracking-tight">{step.name}</span>{step.status === 'processing' && <Loader2 size={14} className="animate-spin text-brand-400" />}</div>
                <p className="text-slate-500 font-medium leading-relaxed">{step.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatInterface;