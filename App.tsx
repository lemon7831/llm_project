import React, { useState } from 'react';
import { LayoutDashboard, MessageSquareText, Menu, Bot } from 'lucide-react';
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
  const currentUser = users[chatUserIndex] || users[0];

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 lg:px-10 flex-shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
            <Bot size={24} />
          </div>
          <div className="flex flex-col">
            <h1 className="font-black text-slate-900 text-base leading-none tracking-tight">Enterprise AI Platform</h1>
            <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Alpha Release v4.8.1</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200 shadow-inner">
            <button 
              onClick={() => setCurrentView('admin')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${
                currentView === 'admin' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutDashboard size={14} />
              <span className="hidden sm:inline">後台管理</span>
            </button>
            <button 
              onClick={() => setCurrentView('chat')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${
                currentView === 'chat' ? 'bg-white text-brand-600 shadow-md' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <MessageSquareText size={14} />
              <span className="hidden sm:inline">智能對話</span>
            </button>
          </div>

          {currentView === 'chat' && (
            <div className="hidden lg:flex items-center gap-3 text-[10px] bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl text-amber-800 font-bold uppercase tracking-wide shadow-sm">
              <span className="opacity-60">模擬身分切換:</span>
              <select 
                className="bg-transparent border-none outline-none font-black cursor-pointer text-amber-900"
                value={chatUserIndex}
                onChange={(e) => setChatUserIndex(Number(e.target.value))}
              >
                {users.map((u, idx) => (
                  <option key={u.id} value={idx}>{u.name} ({u.departments[0]})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative bg-slate-50">
        {currentView === 'admin' ? (
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