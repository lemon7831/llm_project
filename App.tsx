import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, MessageSquareText, Bot, ChevronDown, LogOut, User as UserIcon, Check, Settings } from 'lucide-react';
import AdminPanel from './components/AdminPanel';
import ChatInterface from './components/ChatInterface';
import { ViewMode, User, BotConfig, FileData, UserMemory, FeedbackCorrection, ChatSession } from './types';
import { INITIAL_DEPARTMENTS, INITIAL_USERS, INITIAL_FILES, INITIAL_BOT_CONFIG } from './constants';

function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('admin');
  const [departments, setDepartments] = useState<string[]>(INITIAL_DEPARTMENTS);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [files, setFiles] = useState<FileData[]>(INITIAL_FILES);
  const [botConfig, setBotConfig] = useState<BotConfig>(INITIAL_BOT_CONFIG);
  const [memories, setMemories] = useState<UserMemory[]>([
    { id: 'm1', userId: 'u2', content: '我喜歡簡短的回答，不要超過 3 句話。', createdAt: '2025-05-10T10:00:00Z' }
  ]);
  const [corrections, setCorrections] = useState<FeedbackCorrection[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([
    { id: 's1', userId: 'u2', userName: '李小美', department: '業務部', startTime: new Date(Date.now() - 86400000).toISOString(), lastMessageAt: new Date(Date.now() - 86000000).toISOString(), messages: [{ id: 'msg1', role: 'user', content: 'Q1 的業績達成率是多少？', timestamp: new Date(Date.now() - 86400000) }, { id: 'msg2', role: 'assistant', content: '根據業務報表，Q1 達成率為 85%。', timestamp: new Date(Date.now() - 86390000), feedback: 'like' }] },
    { id: 's2', userId: 'u1', userName: '王大明', department: '管理處', startTime: new Date(Date.now() - 4000000).toISOString(), lastMessageAt: new Date(Date.now() - 3900000).toISOString(), messages: [{ id: 'msg3', role: 'user', content: '幫我寫一封裁員信。', timestamp: new Date(Date.now() - 4000000) }, { id: 'msg4', role: 'assistant', content: '好的，這是您的草稿...', timestamp: new Date(Date.now() - 3990000), feedback: 'dislike' }] }
  ]);

  const [chatUserIndex, setChatUserIndex] = useState(0); 
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const currentUser = users[chatUserIndex] || users[0];

  // Effect to handle role-based redirection
  useEffect(() => {
    if (currentUser.role === 'user') {
      setCurrentView('chat');
    }
  }, [currentUser.role]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileRef]);

  const handleSwitchUser = (index: number) => {
    setChatUserIndex(index);
    setIsProfileOpen(false);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 lg:px-10 flex-shrink-0 z-50 relative">
        {/* Left: Branding */}
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
            <Bot size={20} />
          </div>
          <div className="flex flex-col">
            <h1 className="font-black text-slate-900 text-sm md:text-base leading-none tracking-tight">Enterprise AI Platform</h1>
            <span className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Alpha Release v4.8.1</span>
          </div>
        </div>

        {/* Center: Navigation (Visible only to Admin) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2">
          {currentUser.role === 'admin' && (
            <div className="bg-slate-100/80 p-1 rounded-xl flex gap-1 border border-slate-200 shadow-inner">
              <button 
                onClick={() => setCurrentView('admin')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                  currentView === 'admin' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <LayoutDashboard size={14} />
                <span className="hidden sm:inline">後台管理</span>
              </button>
              <button 
                onClick={() => setCurrentView('chat')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                  currentView === 'chat' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-brand-500/10' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <MessageSquareText size={14} />
                <span className="hidden sm:inline">智能對話</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: User Profile Menu */}
        <div className="flex items-center gap-4" ref={profileRef}>
          <div className="relative">
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer group"
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${currentUser.role === 'admin' ? 'bg-slate-800' : 'bg-brand-600'}`}>
                {currentUser.name[0]}
              </div>
              <ChevronDown size={14} className={`text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Profile Dropdown */}
            {isProfileOpen && (
              <div className="absolute right-0 top-full mt-3 w-72 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[60]">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base font-bold text-white shadow-md ${currentUser.role === 'admin' ? 'bg-slate-800' : 'bg-brand-600'}`}>
                      {currentUser.name[0]}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-slate-900 truncate text-sm">{currentUser.name}</p>
                      <p className="text-xs text-slate-500 truncate font-medium">{currentUser.email}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border ${currentUser.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                      {currentUser.role === 'admin' ? '系統管理員' : '一般使用者'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-slate-100 text-slate-500 border border-slate-200">
                      {currentUser.departments[0]}
                    </span>
                  </div>
                </div>

                <div className="p-2">
                  <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">切換測試帳號 (Switch Account)</div>
                  {users.map((u, idx) => (
                    <button 
                      key={u.id}
                      onClick={() => handleSwitchUser(idx)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all ${idx === chatUserIndex ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold border ${idx === chatUserIndex ? 'bg-white border-brand-200 text-brand-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                          {u.name[0]}
                        </div>
                        <span>{u.name}</span>
                      </div>
                      {idx === chatUserIndex && <Check size={14} />}
                    </button>
                  ))}
                </div>

                <div className="p-2 border-t border-slate-100">
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all">
                    <LogOut size={16} />
                    登出系統
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative bg-slate-50">
        {currentView === 'admin' && currentUser.role === 'admin' ? (
          <AdminPanel 
            botConfig={botConfig} setBotConfig={setBotConfig}
            departments={departments} setDepartments={setDepartments}
            users={users} setUsers={setUsers}
            files={files} setFiles={setFiles}
            chatSessions={chatSessions}
            corrections={corrections}
          />
        ) : (
          <ChatInterface 
            currentUser={currentUser}
            botConfig={botConfig}
            files={files}
            memories={memories}
            setMemories={setMemories}
            setCorrections={setCorrections}
            setChatSessions={setChatSessions}
          />
        )}
      </main>
    </div>
  );
}

export default App;