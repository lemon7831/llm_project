import React, { useState, useRef } from 'react';
import { 
  Settings, Users, Building, Database, Zap, 
  Plus, Trash2, Upload, FileText, Check, ChevronDown, ChevronRight, X, Tag, Loader2, Sparkles,
  Save, AlertCircle, Search, CheckCircle2, Edit2, Globe, Terminal, Clock, Blocks,
  LayoutDashboard, ShieldCheck, BarChart3, TrendingUp, DollarSign, Activity,
  History, Eye, User as UserIcon, MessageSquare, ThumbsDown, Mail, Shield, Lock, Unlock,
  Briefcase, Headphones, Mic, Calendar, Code, RotateCcw, FileJson, AlertTriangle, Layers, Component, ToggleLeft, ToggleRight,
  Filter
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { BotConfig, FileData, User, AdminStep, ChatSession, FeedbackCorrection, ProcessingPipeline } from '../types';
import { INITIAL_DEPARTMENTS, PERSONA_OPTIONS, AVAILABLE_TOOLS, QUALITY_RULES, MOCK_DASHBOARD_DATA, SCENARIOS } from '../constants';

interface AdminPanelProps {
  botConfig: BotConfig;
  setBotConfig: React.Dispatch<React.SetStateAction<BotConfig>>;
  departments: string[];
  setDepartments: React.Dispatch<React.SetStateAction<string[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  files: FileData[];
  setFiles: React.Dispatch<React.SetStateAction<FileData[]>>;
  chatSessions: ChatSession[];
  corrections: FeedbackCorrection[];
}

interface TagReviewState {
  matched: string[];
  newSuggestions: string[];
  manual: string[];
}

// Updated DrawerType to include new drawers
type DrawerType = 'none' | 'scenario' | 'tool_metadata' | 'member_editor' | 'file_editor';

const DEFAULT_METADATA = {
  basic_depth: "normal",
  sensitive_guard: true,
  system_prompt: "",
  output_schema: {},
  api_key: "",
};

const DEFAULT_PIPELINE: ProcessingPipeline = {
  output_nature: 'raw',
  pipeline: {
    code_cleaner: false,
    auto_summarize: false,
    summary_model: 'gemini-3-flash-preview',
    threshold: 2000
  }
};

const AdminPanel: React.FC<AdminPanelProps> = ({
  botConfig, setBotConfig,
  departments, setDepartments,
  users, setUsers,
  files, setFiles,
  chatSessions,
  corrections
}) => {
  const [activeStep, setActiveStep] = useState<AdminStep>('dashboard');
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [skillsViewMode, setSkillsViewMode] = useState<'scenarios' | 'atomic'>('scenarios');
  const [drawerType, setDrawerType] = useState<DrawerType>('none');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [advancedMetadataExpanded, setAdvancedMetadataExpanded] = useState(false);
  
  const [jsonEditorContent, setJsonEditorContent] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [pipelineForm, setPipelineForm] = useState<ProcessingPipeline>(DEFAULT_PIPELINE);

  // Removed isReviewModalOpen, using drawerType instead
  const [pendingFile, setPendingFile] = useState<{name: string, size: string, fileObj: File | null} | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null); 
  const [tagReviewData, setTagReviewData] = useState<TagReviewState>({ matched: [], newSuggestions: [], manual: [] });
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [manualInput, setManualInput] = useState('');
  const [filePermissions, setFilePermissions] = useState<Set<string>>(new Set(['public']));
  const [isDragging, setIsDragging] = useState(false);
  
  const [newDeptName, setNewDeptName] = useState('');
  
  // Removed isMemberModalOpen, using drawerType instead
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState<Partial<User>>({ 
    name: '', email: '', role: 'user', departments: [] 
  });
  
  const [alertModal, setAlertModal] = useState<{isOpen: boolean, title: string, message: string, type: 'error' | 'success'}>({
    isOpen: false, title: '', message: '', type: 'error'
  });
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const closeAlertModal = () => setAlertModal(prev => ({ ...prev, isOpen: false }));
  const showAlert = (title: string, message: string, type: 'error' | 'success' = 'error') => {
    setAlertModal({ isOpen: true, title, message, type });
  };

  const openScenarioDrawer = (scenarioId: string) => {
    setSelectedScenarioId(scenarioId);
    setDrawerType('scenario');
  };

  const openToolMetadataDrawer = (toolId: string) => {
    setSelectedToolId(toolId);
    const existingMeta = botConfig.toolMetadata?.[toolId] || DEFAULT_METADATA;
    setJsonEditorContent(JSON.stringify(existingMeta, null, 2));
    
    // Load existing pipeline rule (Step 7)
    const existingPipeline = botConfig.toolProcessingRules?.[toolId] || DEFAULT_PIPELINE;
    setPipelineForm(existingPipeline);

    setJsonError(null);
    setAdvancedMetadataExpanded(false);
    setDrawerType('tool_metadata');
  };

  const closeDrawer = () => {
    setDrawerType('none');
    setSelectedScenarioId(null);
    setSelectedToolId(null);
    // Reset Member Form
    setEditingMemberId(null);
    setMemberForm({ name: '', email: '', role: 'user', departments: [] });
    // Reset File Form
    setPendingFile(null);
    setEditingFileId(null);
  };

  const toggleAtomicTool = (toolId: string) => {
    setBotConfig(prev => ({
      ...prev,
      activeTools: prev.activeTools.includes(toolId) 
        ? prev.activeTools.filter(id => id !== toolId)
        : [...prev.activeTools, toolId]
    }));
  };

  const toggleScenario = (scenario: typeof SCENARIOS[0]) => {
     const areRequiredToolsActive = scenario.requiredTools.every(tid => botConfig.activeTools.includes(tid));
     let newActiveTools = [...botConfig.activeTools];
     if (areRequiredToolsActive) {
        newActiveTools = newActiveTools.filter(tid => !scenario.requiredTools.includes(tid));
     } else {
        const missing = scenario.requiredTools.filter(tid => !newActiveTools.includes(tid));
        newActiveTools = [...newActiveTools, ...missing];
     }
     setBotConfig(prev => ({ ...prev, activeTools: newActiveTools }));
  };

  const saveToolMetadata = () => {
    if (!selectedToolId) return;
    try {
      const parsed = JSON.parse(jsonEditorContent);
      setBotConfig(prev => ({
        ...prev,
        toolMetadata: {
          ...prev.toolMetadata,
          [selectedToolId]: parsed
        },
        toolProcessingRules: {
          ...prev.toolProcessingRules,
          [selectedToolId]: pipelineForm
        }
      }));
      closeDrawer();
      showAlert('設定已儲存', '工具參數與資料處理策略已更新。', 'success');
    } catch (e) {
      setJsonError("JSON 格式錯誤，請檢查語法。");
    }
  };

  const restoreDefaultMetadata = () => {
     setJsonEditorContent(JSON.stringify(DEFAULT_METADATA, null, 2));
     setPipelineForm(DEFAULT_PIPELINE);
     setJsonError(null);
  };

  const handleAddDepartment = () => {
    const trimmed = newDeptName.trim();
    if (!trimmed) return;
    if (departments.includes(trimmed)) {
      showAlert('無法新增部門', `部門名稱 "${trimmed}" 已經存在。`, 'error');
      return;
    }
    setDepartments([...departments, trimmed]);
    setNewDeptName('');
  };

  const handleDeleteDepartment = (dept: string) => setDepartments(prev => prev.filter(d => d !== dept));

  const openAddMemberDrawer = () => {
    setEditingMemberId(null);
    setMemberForm({ name: '', email: '', role: 'user', departments: [] });
    setDrawerType('member_editor');
  };

  const openEditMemberDrawer = (user: User) => {
    setEditingMemberId(user.id);
    setMemberForm({ ...user }); 
    setDrawerType('member_editor');
  };

  const handleDeleteMember = (userId: string) => setUsers(prev => prev.filter(u => u.id !== userId));

  const toggleMemberDepartment = (dept: string) => {
    const currentDepts = memberForm.departments || [];
    if (currentDepts.includes(dept)) {
      setMemberForm({ ...memberForm, departments: currentDepts.filter(d => d !== dept) });
    } else {
      setMemberForm({ ...memberForm, departments: [...currentDepts, dept] });
    }
  };

  const handleSaveMember = () => {
    if (!memberForm.name?.trim() || !memberForm.email?.trim()) {
      showAlert('資料不完整', '請填寫成員姓名與電子郵件。', 'error');
      return;
    }
    if (editingMemberId) {
      setUsers(prev => prev.map(u => u.id === editingMemberId ? { ...u, name: memberForm.name!, email: memberForm.email!, role: memberForm.role as 'admin'|'user', departments: memberForm.departments || [] } : u));
    } else {
      const newUser: User = { id: Date.now().toString(), name: memberForm.name!, email: memberForm.email!, role: memberForm.role as 'admin' | 'user', departments: memberForm.departments || [] };
      setUsers(prev => [...prev, newUser]);
    }
    closeDrawer();
  };

  const onUploadClick = () => fileInputRef.current?.click();
  const processFile = async (file: File) => {
    const fileSize = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    setPendingFile({ name: file.name, size: fileSize, fileObj: file });
    setAnalyzing(true);
    setEditingFileId(null); 
    setFilePermissions(new Set(['public']));
    const existingTags = Array.from(new Set(files.flatMap(f => f.tags)));
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `You are an expert Document Classifier for an enterprise. Target Filename: "${file.name}" Existing Tag Database: ${JSON.stringify(existingTags)} Task: Analyze, Match, Discover. Output JSON: { "matched": string[], "new": string[] }`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { responseMimeType: 'application/json' } });
      const parsed = JSON.parse(response.text || '{}') as { matched?: string[], new?: string[] };
      setTagReviewData({ matched: parsed.matched || [], newSuggestions: parsed.new || [], manual: [] });
      setSelectedTags(new Set([...(parsed.matched || [])]));
      setDrawerType('file_editor');
    } catch (error) {
      showAlert('AI 分析失敗', '無法連接到 AI 模型，請檢查設定。', 'error');
    } finally {
      setAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; 
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) await processFile(e.target.files[0]);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = async (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files && e.dataTransfer.files[0]) await processFile(e.dataTransfer.files[0]); };

  const handleEditFile = (file: FileData) => {
    setEditingFileId(file.id);
    setPendingFile({ name: file.name, size: file.size, fileObj: null });
    setSelectedTags(new Set(file.tags));
    setFilePermissions(new Set(file.permissions));
    const allSystemTags = Array.from(new Set(files.flatMap(f => f.tags))).sort();
    setTagReviewData({ matched: allSystemTags, newSuggestions: [], manual: [] });
    setDrawerType('file_editor');
  };

  const toggleTagSelection = (tag: string) => {
    const newSet = new Set(selectedTags);
    if (newSet.has(tag)) newSet.delete(tag); else newSet.add(tag);
    setSelectedTags(newSet);
  };

  const addManualTag = () => {
    if (manualInput.trim()) {
      const val = manualInput.trim();
      setTagReviewData(prev => ({ ...prev, manual: [...prev.manual, val] }));
      setSelectedTags(prev => new Set(prev).add(val));
      setManualInput('');
    }
  };

  const setPublicPermission = () => setFilePermissions(new Set(['public']));
  const setPrivatePermission = () => setFilePermissions(new Set<string>([]));
  const toggleDeptPermission = (dept: string) => {
    const newSet = new Set(filePermissions);
    if (newSet.has('public')) newSet.delete('public');
    if (newSet.has(dept)) newSet.delete(dept); else newSet.add(dept);
    setFilePermissions(newSet);
  };

  const confirmAndSaveFile = () => {
    if (!pendingFile) return;
    const finalTags: string[] = Array.from(selectedTags);
    let finalPermissions: string[] = Array.from(filePermissions);
    if (finalPermissions.length === 0) {
        showAlert("請設定權限", "請至少選擇一個部門或設定為全公司公開。", "error");
        return;
    }
    if (editingFileId) {
      setFiles(prev => prev.map(f => f.id === editingFileId ? { ...f, tags: finalTags, permissions: finalPermissions } : f));
    } else {
      const newFile: FileData = { id: Date.now().toString(), name: pendingFile.name, size: pendingFile.size, uploadDate: new Date().toISOString().split('T')[0], permissions: finalPermissions, tags: finalTags };
      setFiles(prev => [...prev, newFile]);
    }
    closeDrawer();
  };

  const handleDeleteFile = (fileId: string) => setFiles(prev => prev.filter(f => f.id !== fileId));
  
  const addTemplateToPrompt = (templateText: string) => {
    const current = botConfig.reflectorPrompt || '';
    // Avoid exact duplicates
    if (current.includes(templateText)) return;
    const newPrompt = current ? `${current}\n${templateText}` : templateText;
    setBotConfig(prev => ({ ...prev, reflectorPrompt: newPrompt }));
  };

  const handlePersonaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    const selectedPersona = PERSONA_OPTIONS.find(p => p.value === selectedValue);
    setBotConfig({ ...botConfig, persona: selectedValue, systemPrompt: selectedPersona ? selectedPersona.prompt : botConfig.systemPrompt });
  }

  const renderSidebarItem = (step: AdminStep, label: string, Icon: React.ElementType) => (
    <button
      onClick={() => setActiveStep(step)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 ${
        activeStep === step 
          ? 'bg-brand-50 text-brand-700 border-r-2 border-brand-600' 
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon size={18} className={activeStep === step ? 'text-brand-600' : 'text-slate-400'} />
      {label}
    </button>
  );

  const getToolIcon = (iconName: string) => {
    switch (iconName) {
      case 'Globe': return Globe;
      case 'Database': return Database;
      case 'Terminal': return Terminal;
      case 'Clock': return Clock;
      case 'Briefcase': return Briefcase;
      case 'Headphones': return Headphones;
      case 'Mic': return Mic;
      case 'FileText': return FileText;
      case 'Mail': return Mail;
      case 'Calendar': return Calendar;
      case 'TrendingUp': return TrendingUp;
      default: return Blocks;
    }
  };

  const getSessionStatus = (session: ChatSession) => {
    const hasDislike = session.messages.some(m => m.feedback === 'dislike');
    const hasLike = session.messages.some(m => m.feedback === 'like');
    if (hasDislike) return { label: '需關注', color: 'text-red-600 bg-red-50 border-red-200', icon: AlertCircle };
    if (hasLike) return { label: '良好', color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle2 };
    return { label: '一般', color: 'text-slate-500 bg-slate-50 border-slate-200', icon: Check };
  };

  const selectedSession = chatSessions.find(s => s.id === selectedSessionId);
  const getActiveToolsCount = (scenario: typeof SCENARIOS[0]) => {
     const allScenarioTools = [...scenario.requiredTools, ...scenario.optionalTools];
     const active = allScenarioTools.filter(tid => botConfig.activeTools.includes(tid));
     return { count: active.length, total: allScenarioTools.length };
  };

  return (
    <div className="flex h-full bg-white overflow-hidden relative">
      <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col overflow-y-auto">
        <div className="p-6">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">後台管理</h2>
          <p className="text-xs text-slate-500 mt-1">控制與監控您的 AI Agent</p>
        </div>
        <nav className="flex-1">
          <div className="px-4 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">營運監控</div>
          {renderSidebarItem('dashboard', '營運儀表板', LayoutDashboard)}
          {renderSidebarItem('audit', '全域對話紀錄', History)}
          <div className="px-4 pb-2 pt-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agent 核心</div>
          {renderSidebarItem('identity', '基本設定', Settings)}
          {renderSidebarItem('departments', '部門架構', Building)}
          {renderSidebarItem('members', '成員管理', Users)}
          <div className="px-4 pb-2 pt-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">能力與品管</div>
          {renderSidebarItem('knowledge', '知識注入', Database)}
          {renderSidebarItem('skills', 'MCP 工具庫', Blocks)}
          {renderSidebarItem('quality', '品管與合規', ShieldCheck)}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-10 relative bg-white">
        {/* ... (Existing Dashboard, Audit, Identity, Depts, Members, Knowledge, MCP Skills sections omitted for brevity) ... */}
        {activeStep === 'dashboard' && (
          <div className="fade-in space-y-8">
            <header>
               <h3 className="text-2xl font-bold text-slate-900">營運儀表板</h3>
               <p className="text-sm text-slate-500 mt-1">系統即時狀態、用量統計與成本趨勢</p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-indigo-600 to-brand-700 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
                 <div className="relative z-10">
                   <p className="text-indigo-100 text-xs font-semibold mb-1 uppercase">目前訂閱方案</p>
                   <h4 className="text-2xl font-bold mb-6">{MOCK_DASHBOARD_DATA.planName}</h4>
                   <p className="text-[10px] text-indigo-100/70">下次續約日期: {MOCK_DASHBOARD_DATA.renewalDate}</p>
                 </div>
                 <Sparkles size={120} className="absolute right-[-20px] top-[-20px] opacity-10 rotate-12" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                 <div>
                   <p className="text-slate-500 text-xs font-semibold mb-2 uppercase">對話輪數額度</p>
                   <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-slate-900">{MOCK_DASHBOARD_DATA.usageRound.toLocaleString()}</span>
                      <span className="text-sm text-slate-400">/ {MOCK_DASHBOARD_DATA.maxRound.toLocaleString()}</span>
                   </div>
                 </div>
                 <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
                   <div className="bg-brand-500 h-full rounded-full transition-all duration-1000" style={{width: `${(MOCK_DASHBOARD_DATA.usageRound / MOCK_DASHBOARD_DATA.maxRound) * 100}%`}}></div>
                 </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-center space-y-4">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><Activity size={20}/></div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">總 Token 消耗</p>
                      <p className="text-lg font-bold text-slate-900">{((MOCK_DASHBOARD_DATA.totalInputTokens + MOCK_DASHBOARD_DATA.totalOutputTokens)/1000000).toFixed(2)}M</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center"><Users size={20}/></div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">活躍使用者</p>
                      <p className="text-lg font-bold text-slate-900">{MOCK_DASHBOARD_DATA.activeUsers}</p>
                    </div>
                 </div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">成本與用量趨勢</h4>
                    <select className="text-xs border-slate-200 bg-slate-50 rounded-lg px-3 py-1.5 text-slate-600 focus:ring-brand-500 transition-all">
                      <option>最近 7 天</option>
                    </select>
                  </div>
                  <div className="h-64 flex items-end justify-between gap-3">
                    {MOCK_DASHBOARD_DATA.costTrend.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col justify-end gap-1 group relative h-full">
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block bg-slate-900 text-white text-[10px] p-2 rounded-lg shadow-xl z-20 whitespace-nowrap">
                           {d.date}: ${d.cost} / {d.chats} 對話
                        </div>
                        <div className="w-full bg-indigo-100 rounded-t-md hover:bg-indigo-200 transition-all duration-300 cursor-pointer" style={{height: `${d.chats / 3}%`}}></div>
                        <div className="w-full bg-brand-500 rounded-t-md hover:bg-brand-600 transition-all duration-300 cursor-pointer" style={{height: `${d.cost * 3}%`}}></div>
                        <p className="text-[10px] font-medium text-center text-slate-400 mt-2">{d.date}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-center gap-6 mt-8 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-brand-500 rounded-sm shadow-sm"></div> 花費金額</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-indigo-100 rounded-sm shadow-sm"></div> 對話次數</div>
                  </div>
               </div>
               <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                  <h4 className="font-bold text-slate-800 mb-8">MCP 工具熱力榜</h4>
                  <div className="space-y-6">
                    {MOCK_DASHBOARD_DATA.toolUsage.map((tool, i) => (
                      <div key={tool.name} className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-slate-700">{i+1}. {tool.name}</span>
                          <span className="text-slate-400 font-mono">{tool.count.toLocaleString()} calls</span>
                        </div>
                        <div className="w-full bg-slate-50 rounded-full h-2 overflow-hidden border border-slate-100">
                          <div className="bg-amber-400 h-full rounded-full transition-all duration-700" style={{width: `${(tool.count / 1500) * 100}%`}}></div>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        )}
        {activeStep === 'audit' && (
          <div className="fade-in space-y-6">
             <header className="flex justify-between items-start">
                <div>
                   <h3 className="text-2xl font-bold text-slate-900">全域對話紀錄</h3>
                   <p className="text-sm text-slate-500 mt-1">稽核所有 Agent 的歷史對話、工具調用與回饋標籤</p>
                </div>
                <div className="flex gap-3">
                   <div className="relative group">
                      <Search size={16} className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                      <input type="text" placeholder="搜尋內容..." className="pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl w-64 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none" />
                   </div>
                   <select className="text-sm border border-slate-200 rounded-xl px-4 py-2 bg-slate-50/50 focus:ring-brand-500 transition-all outline-none">
                     <option>所有部門</option>
                     {departments.map(d => <option key={d} value={d}>{d}</option>)}
                   </select>
                </div>
             </header>
             <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-bold text-slate-600 uppercase tracking-tight text-[11px]">時間</th>
                      <th className="px-6 py-4 font-bold text-slate-600 uppercase tracking-tight text-[11px]">使用者</th>
                      <th className="px-6 py-4 font-bold text-slate-600 uppercase tracking-tight text-[11px]">部門</th>
                      <th className="px-6 py-4 font-bold text-slate-600 uppercase tracking-tight text-[11px]">訊息量</th>
                      <th className="px-6 py-4 font-bold text-slate-600 uppercase tracking-tight text-[11px]">滿意度</th>
                      <th className="px-6 py-4 text-right font-bold text-slate-600 uppercase tracking-tight text-[11px]">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {chatSessions.map(session => {
                      const status = getSessionStatus(session);
                      return (
                        <tr key={session.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                          <td className="px-6 py-4 text-slate-500 tabular-nums whitespace-nowrap">{new Date(session.startTime).toLocaleString('zh-TW', {month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">{session.userName[0]}</div>
                              <span className="font-semibold text-slate-800">{session.userName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4"><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px] font-medium">{session.department}</span></td>
                          <td className="px-6 py-4 text-slate-600 font-medium">{session.messages.length} 則</td>
                          <td className="px-6 py-4">
                             <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border ${status.color}`}>
                                <status.icon size={10} /> {status.label}
                             </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <button onClick={() => setSelectedSessionId(session.id)} className="text-brand-600 hover:bg-brand-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">檢視詳情</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
             </div>
          </div>
        )}
        {activeStep === 'identity' && (
          <div className="max-w-3xl fade-in space-y-8">
             <header>
                <h3 className="text-2xl font-bold text-slate-900">基本設定</h3>
                <p className="text-sm text-slate-500 mt-1">Agent 名稱、人設風格與核心引導提示詞</p>
             </header>
             <div className="grid grid-cols-1 gap-6 bg-white border border-slate-200 p-8 rounded-2xl shadow-sm">
               <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">機器人名稱</label>
                  <input type="text" value={botConfig.name} onChange={(e) => setBotConfig({...botConfig, name: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all" />
               </div>
               <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">預設語氣模板</label>
                  <select value={botConfig.persona} onChange={handlePersonaChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50/50 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all">
                    {PERSONA_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
               </div>
               <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">系統核心提示詞 (System Prompt)</label>
                  <textarea value={botConfig.systemPrompt} onChange={(e) => setBotConfig({...botConfig, systemPrompt: e.target.value})} rows={10} className="w-full px-4 py-4 border border-slate-200 rounded-xl font-mono text-sm leading-relaxed focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all resize-none" />
               </div>
               <div className="pt-4">
                  <button className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2">
                    <Save size={18} /> 儲存變更
                  </button>
               </div>
             </div>
          </div>
        )}
        {activeStep === 'departments' && (
           <div className="max-w-2xl fade-in space-y-8">
              <header>
                 <h3 className="text-2xl font-bold text-slate-900">部門架構</h3>
                 <p className="text-sm text-slate-500 mt-1">管理組織架構，這將決定 Agent 檢索資料時的權限範圍</p>
              </header>
              <div className="flex gap-3">
                <input type="text" placeholder="輸入新部門名稱..." value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddDepartment()} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all" />
                <button onClick={handleAddDepartment} className="px-6 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-bold text-sm shadow-md flex items-center gap-2 transition-all active:scale-95"><Plus size={20} /> 新增</button>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100">
                {departments.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-sm">尚未設定任何部門</div>
                ) : (
                    departments.map((dept) => (
                    <div key={dept} className="flex items-center justify-between p-5 hover:bg-slate-50 transition-colors group">
                        <span className="font-semibold text-slate-700 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-brand-500 transition-all duration-300"></div>
                            {dept}
                        </span>
                        <button onClick={() => handleDeleteDepartment(dept)} className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all"><Trash2 size={18} /></button>
                    </div>
                    ))
                )}
              </div>
           </div>
        )}
        {activeStep === 'members' && (
           <div className="fade-in space-y-6">
              <header className="flex justify-between items-center">
                 <div>
                    <h3 className="text-2xl font-bold text-slate-900">成員管理</h3>
                    <p className="text-sm text-slate-500 mt-1">授權特定成員存取 Agent 並設定其權限角色</p>
                 </div>
                 <button onClick={openAddMemberDrawer} className="px-6 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-bold text-sm shadow-md flex items-center gap-2 transition-all active:scale-95"><Plus size={20}/> 邀請成員</button>
              </header>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                 <table className="w-full text-left text-sm">
                   <thead className="bg-slate-50/50 border-b border-slate-200">
                     <tr>
                       <th className="px-6 py-4 font-bold text-slate-600 text-[11px] uppercase tracking-tight">成員資訊</th>
                       <th className="px-6 py-4 font-bold text-slate-600 text-[11px] uppercase tracking-tight">權限角色</th>
                       <th className="px-6 py-4 font-bold text-slate-600 text-[11px] uppercase tracking-tight">所屬部門</th>
                       <th className="px-6 py-4 text-right font-bold text-slate-600 text-[11px] uppercase tracking-tight">操作</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {users.map(u => (
                       <tr key={u.id} className="hover:bg-slate-50/50 transition-all duration-150 group">
                         <td className="px-6 py-5">
                           <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold border border-slate-200 uppercase">{u.name[0]}</div>
                              <div>
                                <p className="font-bold text-slate-900">{u.name}</p>
                                <p className="text-[11px] text-slate-400 font-medium">{u.email}</p>
                              </div>
                           </div>
                         </td>
                         <td className="px-6 py-5">
                           <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                             {u.role === 'admin' ? '管理者' : '一般使用者'}
                           </span>
                         </td>
                         <td className="px-6 py-5">
                           <div className="flex flex-wrap gap-1.5">
                             {u.departments.length > 0 ? u.departments.map(d => (
                               <span key={d} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100">{d}</span>
                             )) : <span className="text-slate-300 text-[10px] italic">尚未分配</span>}
                           </div>
                         </td>
                         <td className="px-6 py-5 text-right">
                           <div className="flex justify-end gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-200">
                             <button onClick={() => openEditMemberDrawer(u)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all" title="編輯"><Edit2 size={16} /></button>
                             <button onClick={() => handleDeleteMember(u.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="刪除"><Trash2 size={16} /></button>
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
              </div>
           </div>
        )}
        {activeStep === 'knowledge' && (
           <div className="fade-in space-y-8">
             <header>
                <h3 className="text-2xl font-bold text-slate-900">知識注入</h3>
                <p className="text-sm text-slate-500 mt-1">訓練 Agent 識別並檢索企業內部專屬知識與文件</p>
             </header>
             <div onClick={onUploadClick} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`border-2 border-dashed rounded-3xl p-16 text-center cursor-pointer transition-all duration-300 ${isDragging ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-400 hover:bg-slate-50/50'}`}>
                <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-400 group-hover:bg-brand-100 group-hover:text-brand-600 transition-all">
                  {analyzing ? <Loader2 className="animate-spin text-brand-600" size={40} /> : <Upload size={40}/>}
                </div>
                <p className="text-xl font-bold text-slate-900 mb-2">{analyzing ? 'AI 正在進行深度分析...' : '點擊或拖曳檔案至此'}</p>
                <p className="text-sm text-slate-400 max-w-sm mx-auto">支援 PDF, Excel, Word 與 CSV。上傳後 AI 將自動進行 OCR 與嵌入 (Embedding) 索引。</p>
             </div>
             <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
             <div className="space-y-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-tight">已建檔知識 ({files.length})</h4>
               <div className="grid grid-cols-1 gap-4">
               {files.map(f => (
                 <div key={f.id} className="bg-white border border-slate-200 p-5 rounded-2xl flex justify-between items-center hover:shadow-md transition-all group">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors"><FileText size={24} /></div>
                      <div>
                        <p className="font-bold text-slate-800">{f.name}</p>
                        <div className="flex items-center gap-3 mt-1.5 font-medium">
                           <span className="text-[11px] text-slate-400">{f.size} • {f.uploadDate}</span>
                           <div className="flex gap-1.5">
                             {f.permissions.includes('public') ? (
                               <span className="text-[9px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100 font-bold flex items-center gap-1 uppercase"><Globe size={10} /> Public</span>
                             ) : (
                               f.permissions.map(p => (
                                 <span key={p} className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-100 font-bold flex items-center gap-1 uppercase"><Lock size={10} /> {p}</span>
                               ))
                             )}
                           </div>
                        </div>
                      </div>
                   </div>
                   <div className="flex items-center gap-1">
                      <button onClick={() => handleEditFile(f)} className="p-2.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all" title="權限設定"><Settings size={20} /></button>
                      <button onClick={() => handleDeleteFile(f.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="刪除檔案"><Trash2 size={20} /></button>
                   </div>
                 </div>
               ))}
               </div>
             </div>
           </div>
        )}
        {activeStep === 'skills' && (
           <div className="fade-in space-y-8 h-full flex flex-col">
              <header className="flex justify-between items-end">
                 <div>
                   <h3 className="text-2xl font-bold text-slate-900">MCP 工具庫</h3>
                   <p className="text-sm text-slate-500 mt-1">啟用特定場景功能或手動配置原子工具的進階參數</p>
                 </div>
                 <div className="bg-slate-100/80 p-1.5 rounded-2xl flex text-xs font-bold border border-slate-200">
                    <button onClick={() => setSkillsViewMode('scenarios')} className={`px-5 py-2 rounded-xl flex items-center gap-2 transition-all ${skillsViewMode === 'scenarios' ? 'bg-white shadow-md text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}><Layers size={14} /> 場景卡片</button>
                    <button onClick={() => setSkillsViewMode('atomic')} className={`px-5 py-2 rounded-xl flex items-center gap-2 transition-all ${skillsViewMode === 'atomic' ? 'bg-white shadow-md text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}><Component size={14} /> 原子工具</button>
                 </div>
              </header>
              {skillsViewMode === 'scenarios' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   {SCENARIOS.map(scenario => {
                     const Icon = getToolIcon(scenario.iconName);
                     const { count, total } = getActiveToolsCount(scenario);
                     const cardActive = scenario.requiredTools.every(tid => botConfig.activeTools.includes(tid)); 
                     return (
                       <div key={scenario.id} onClick={() => toggleScenario(scenario)} className={`border-2 rounded-3xl p-6 flex flex-col gap-6 transition-all duration-300 cursor-pointer group ${cardActive ? 'bg-brand-50 border-brand-500 shadow-lg ring-4 ring-brand-500/5' : 'bg-white border-slate-100 hover:border-brand-200 hover:bg-slate-50/50'}`}>
                          <div className="flex justify-between items-start">
                             <div className="flex gap-5">
                               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-500 ${cardActive ? 'bg-brand-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}><Icon size={28} /></div>
                               <div>
                                 <h4 className={`font-bold text-xl ${cardActive ? 'text-brand-900' : 'text-slate-700'}`}>{scenario.name}</h4>
                                 <p className="text-sm text-slate-500 mt-2 leading-relaxed">{scenario.description}</p>
                               </div>
                             </div>
                             <button onClick={(e) => { e.stopPropagation(); openScenarioDrawer(scenario.id); }} className={`p-2.5 rounded-xl transition-all ${cardActive ? 'text-brand-600 hover:bg-brand-100' : 'text-slate-300 hover:text-slate-600 hover:bg-slate-200'}`} title="詳細配置"><Settings size={22} /></button>
                          </div>
                          <div className="mt-auto pt-4 border-t border-slate-100">
                             <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest">
                               <span>配置工具 {count}/{total}</span>
                               <span className={count === total ? "text-green-600" : "text-slate-400"}>{count === total ? '完整啟用' : '基礎啟用'}</span>
                             </div>
                             <div className="w-full bg-slate-200/50 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-brand-500 h-full rounded-full transition-all duration-1000" style={{width: `${(count/total)*100}%`}}></div>
                             </div>
                          </div>
                       </div>
                     );
                   })}
                </div>
              )}
              {skillsViewMode === 'atomic' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {AVAILABLE_TOOLS.map(tool => {
                      const Icon = getToolIcon(tool.iconName);
                      const active = botConfig.activeTools.includes(tool.id);
                      return (
                        <div key={tool.id} className={`border p-5 rounded-2xl flex justify-between items-start group transition-all duration-200 ${active ? 'border-brand-500 bg-brand-50 shadow-sm' : 'border-slate-100 bg-white hover:border-brand-200'}`}>
                            <div className="flex gap-4 cursor-pointer flex-1" onClick={() => toggleAtomicTool(tool.id)}>
                               <div className={`mt-0.5 p-2 rounded-lg transition-colors ${active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'}`}><Icon size={18} /></div>
                               <div>
                                  <h4 className={`font-bold text-sm ${active ? 'text-brand-900' : 'text-slate-800'}`}>{tool.name}</h4>
                                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{tool.description}</p>
                                  <span className="text-[9px] text-slate-300 mt-2 block font-mono font-bold uppercase tracking-tight">ID: {tool.id}</span>
                               </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); openToolMetadataDrawer(tool.id); }} className={`p-2 rounded-lg transition-all ${active ? 'text-brand-400 hover:text-brand-700 hover:bg-brand-100' : 'text-slate-200 hover:text-slate-600 hover:bg-slate-100'}`}><Settings size={18} /></button>
                        </div>
                      );
                  })}
                </div>
              )}
           </div>
        )}

        {activeStep === 'quality' && (
           <div className="max-w-4xl fade-in space-y-8">
              <header>
                 <h3 className="text-2xl font-bold text-slate-900">品管規則設定 (Reflection)</h3>
                 <p className="text-sm text-slate-500 mt-1">在此定義 AI 的「反思層 (Reflector)」規則。系統會在 AI 產出回答前，先通過此 Prompt 進行自我審查。</p>
              </header>
              
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
                 <div className="relative group">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">合規與反思提示詞 (Reflector System Prompt)</label>
                    <textarea 
                      value={botConfig.reflectorPrompt} 
                      onChange={(e) => setBotConfig({...botConfig, reflectorPrompt: e.target.value})} 
                      className="w-full h-64 p-5 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-slate-700 text-sm leading-relaxed focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all resize-none shadow-inner" 
                      placeholder="請輸入檢查規則..."
                    />
                    <div className="absolute top-8 right-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">System</div>
                 </div>

                 <div className="pt-4 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">常用規則範本：</label>
                    <div className="flex flex-wrap gap-3">
                       {QUALITY_RULES.map(rule => (
                          <button 
                            key={rule.id} 
                            onClick={() => addTemplateToPrompt(rule.text || '')}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-brand-300 hover:bg-brand-50 text-slate-600 hover:text-brand-700 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 group"
                          >
                             <Plus size={14} className="group-hover:text-brand-500"/> 
                             {rule.label}
                          </button>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        )}

        {/* --- Drawer Container --- */}
        {drawerType !== 'none' && (
           <>
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[60] transition-opacity duration-300" onClick={closeDrawer}></div>
              <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-[0_0_50px_rgba(0,0,0,0.1)] z-[70] transform transition-transform animate-in slide-in-from-right duration-500 flex flex-col border-l border-slate-200">
                 
                 {/* --- Scenario Drawer --- */}
                 {drawerType === 'scenario' && selectedScenarioId && (
                    <>
                       <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                          <div>
                            <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">場景詳細配置</span>
                            <h3 className="text-xl font-bold text-slate-900 mt-0.5">{SCENARIOS.find(s => s.id === selectedScenarioId)?.name}</h3>
                          </div>
                          <button onClick={closeDrawer} className="text-slate-300 hover:text-slate-900 p-2 hover:bg-white rounded-xl transition-all shadow-none"><X size={24}/></button>
                       </div>
                       <div className="flex-1 overflow-y-auto p-8 space-y-8">
                          {(() => {
                             const scenario = SCENARIOS.find(s => s.id === selectedScenarioId)!;
                             return (
                                <>
                                   <div className="bg-brand-50 border border-brand-100 p-5 rounded-2xl flex gap-4 text-brand-900">
                                      <Briefcase size={24} className="flex-shrink-0 mt-0.5 text-brand-600" />
                                      <p className="text-sm font-medium leading-relaxed">{scenario.description}</p>
                                   </div>
                                   <div className="space-y-4">
                                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">原子工具調度清單</h4>
                                      <div className="space-y-3">
                                         {scenario.requiredTools.map(toolId => {
                                            const tool = AVAILABLE_TOOLS.find(t => t.id === toolId);
                                            return (
                                               <div key={toolId} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl opacity-80">
                                                  <div className="flex items-center gap-4">
                                                     <div className="w-5 h-5 bg-slate-400 rounded flex items-center justify-center text-white"><Check size={12} strokeWidth={4} /></div>
                                                     <span className="text-sm font-bold text-slate-400 line-through">{tool?.name}</span>
                                                     <span className="text-[9px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">核心必選</span>
                                                  </div>
                                                  <button onClick={() => openToolMetadataDrawer(toolId)} className="text-slate-400 hover:text-brand-600 p-2"><Settings size={18}/></button>
                                               </div>
                                            )
                                         })}
                                         {scenario.optionalTools.map(toolId => {
                                            const tool = AVAILABLE_TOOLS.find(t => t.id === toolId);
                                            const isChecked = botConfig.activeTools.includes(toolId);
                                            return (
                                               <div key={toolId} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isChecked ? 'bg-white border-brand-500 shadow-md ring-4 ring-brand-500/5' : 'bg-white border-slate-100'}`}>
                                                  <label className="flex items-center gap-4 cursor-pointer select-none group">
                                                     <div onClick={() => toggleAtomicTool(toolId)} className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${isChecked ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-200 group-hover:border-brand-400'}`}>
                                                        {isChecked && <Check size={12} strokeWidth={4} />}
                                                     </div>
                                                     <span className={`text-sm font-bold transition-colors ${isChecked ? 'text-slate-900' : 'text-slate-500'}`}>{tool?.name}</span>
                                                     <span className="text-[9px] bg-slate-50 text-slate-400 border border-slate-100 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">選用工具</span>
                                                  </label>
                                                  <button onClick={() => openToolMetadataDrawer(toolId)} className="text-slate-400 hover:text-brand-600 p-2"><Settings size={18}/></button>
                                               </div>
                                            )
                                         })}
                                      </div>
                                   </div>
                                </>
                             )
                          })()}
                       </div>
                    </>
                 )}

                 {/* --- Tool Metadata Drawer --- */}
                 {drawerType === 'tool_metadata' && selectedToolId && (
                    <>
                       <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                          <div>
                            <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">原子工具進階設定</span>
                            <h3 className="text-xl font-bold text-slate-900 mt-0.5 flex items-center gap-2">{AVAILABLE_TOOLS.find(t => t.id === selectedToolId)?.name} <span className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded font-mono text-slate-400">{selectedToolId}</span></h3>
                          </div>
                          <button onClick={closeDrawer} className="text-slate-300 hover:text-slate-900 p-2 hover:bg-white rounded-xl transition-all shadow-none"><X size={24}/></button>
                       </div>
                       <div className="flex-1 overflow-y-auto p-8 space-y-10">
                          {/* 1. Runtime Control */}
                          <div className="space-y-6">
                             <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-l-4 border-brand-500 pl-3">運行控制參數</h4>
                             <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-1.5">
                                   <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">操作回應深度 (Depth)</label>
                                   <select className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium bg-slate-50/50 outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all">
                                      <option value="shallow">快速輕量 (Shallow)</option>
                                      <option value="normal">標準流程 (Normal)</option>
                                      <option value="deep">深度挖掘 (Deep)</option>
                                   </select>
                                </div>
                                <div className="flex items-center justify-between p-5 border border-slate-200 rounded-2xl bg-white shadow-sm">
                                   <div>
                                      <span className="block text-sm font-bold text-slate-900">個資防護過濾</span>
                                      <span className="block text-xs text-slate-400 mt-1 font-medium">針對此工具之輸入輸出啟動 PII 遮罩</span>
                                   </div>
                                   <div className="relative inline-block w-12 h-6 rounded-full bg-slate-200 transition-colors duration-300">
                                      <input type="checkbox" id="metadata-pii" className="sr-only peer" defaultChecked />
                                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-6 peer-checked:bg-brand-600"></div>
                                   </div>
                                </div>
                             </div>
                          </div>

                          {/* 2. Step 7: Processing Pipeline */}
                          <div className="space-y-6">
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-l-4 border-purple-500 pl-3">資料處理策略 (Step 7)</h4>
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-6">
                               <div className="space-y-3">
                                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">資料屬性 (Output Nature)</label>
                                  <div className="flex gap-4">
                                     <label className={`flex-1 p-3 border-2 rounded-xl cursor-pointer transition-all ${pipelineForm.output_nature === 'raw' ? 'border-purple-500 bg-purple-50 text-purple-900' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                                        <input type="radio" name="output_nature" value="raw" checked={pipelineForm.output_nature === 'raw'} onChange={() => setPipelineForm(p => ({...p, output_nature: 'raw'}))} className="hidden"/>
                                        <div className="text-sm font-bold text-center">Raw Data (需清洗)</div>
                                        <div className="text-[10px] text-center opacity-70 font-medium">API 原始回傳值</div>
                                     </label>
                                     <label className={`flex-1 p-3 border-2 rounded-xl cursor-pointer transition-all ${pipelineForm.output_nature === 'ai' ? 'border-purple-500 bg-purple-50 text-purple-900' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                                        <input type="radio" name="output_nature" value="ai" checked={pipelineForm.output_nature === 'ai'} onChange={() => setPipelineForm(p => ({...p, output_nature: 'ai'}))} className="hidden"/>
                                        <div className="text-sm font-bold text-center">AI Essence (智慧)</div>
                                        <div className="text-[10px] text-center opacity-70 font-medium">模型已處理精華</div>
                                     </label>
                                  </div>
                               </div>

                               {pipelineForm.output_nature === 'raw' && (
                                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                     <div className="flex items-center justify-between p-2">
                                        <div className="flex items-center gap-3">
                                          <Filter size={18} className="text-slate-400" />
                                          <span className="text-sm font-bold text-slate-700">啟用代碼清洗 (Code Cleaner)</span>
                                        </div>
                                        <div className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${pipelineForm.pipeline.code_cleaner ? 'bg-purple-600' : 'bg-slate-300'}`} onClick={() => setPipelineForm(p => ({...p, pipeline: {...p.pipeline, code_cleaner: !p.pipeline.code_cleaner}}))}>
                                           <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${pipelineForm.pipeline.code_cleaner ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                        </div>
                                     </div>
                                     
                                     <div className="border-t border-slate-200 my-2"></div>
                                     
                                     <div className="flex items-center justify-between p-2">
                                        <div className="flex items-center gap-3">
                                          <Sparkles size={18} className="text-slate-400" />
                                          <span className="text-sm font-bold text-slate-700">啟用自動摘要 (Auto Summarize)</span>
                                        </div>
                                        <div className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${pipelineForm.pipeline.auto_summarize ? 'bg-purple-600' : 'bg-slate-300'}`} onClick={() => setPipelineForm(p => ({...p, pipeline: {...p.pipeline, auto_summarize: !p.pipeline.auto_summarize}}))}>
                                           <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${pipelineForm.pipeline.auto_summarize ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                        </div>
                                     </div>

                                     {pipelineForm.pipeline.auto_summarize && (
                                        <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-slate-200">
                                           <div className="space-y-1">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">摘要模型</label>
                                              <select value={pipelineForm.pipeline.summary_model} onChange={e => setPipelineForm(p => ({...p, pipeline: {...p.pipeline, summary_model: e.target.value}}))} className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2.5 outline-none focus:border-purple-500 bg-slate-50">
                                                 <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                                                 <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                                              </select>
                                           </div>
                                           <div className="space-y-1">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Token 觸發門檻</label>
                                              <input type="number" value={pipelineForm.pipeline.threshold} onChange={e => setPipelineForm(p => ({...p, pipeline: {...p.pipeline, threshold: parseInt(e.target.value)}}))} className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2.5 outline-none focus:border-purple-500 bg-slate-50" />
                                           </div>
                                        </div>
                                     )}
                                  </div>
                               )}
                            </div>
                          </div>

                          {/* 3. Advanced JSON Metadata */}
                          <div className="space-y-6">
                             <button onClick={() => setAdvancedMetadataExpanded(!advancedMetadataExpanded)} className="w-full flex items-center justify-between group">
                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-l-4 border-slate-200 group-hover:border-brand-500 pl-3 transition-all">進階 JSON 語義配置</h4>
                                {advancedMetadataExpanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                             </button>
                             {advancedMetadataExpanded && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                                   <div className="bg-amber-50 border border-amber-100 p-5 rounded-2xl flex gap-4 text-amber-800 shadow-inner">
                                      <AlertTriangle size={20} className="flex-shrink-0 mt-0.5 text-amber-600" />
                                      <p className="text-[11px] font-medium leading-relaxed">警告：此處定義之 Metadata 將直接注入工具的 Runtime Context。請確保 JSON 格式正確，否則將導致工具實體化失敗。</p>
                                   </div>
                                   <div className="relative group">
                                      <textarea value={jsonEditorContent} onChange={(e) => setJsonEditorContent(e.target.value)} className="w-full h-80 bg-slate-900 text-emerald-400 font-mono text-[11px] p-6 rounded-2xl border-2 border-slate-800 group-focus-within:border-brand-500 transition-all outline-none leading-relaxed shadow-2xl" spellCheck={false} />
                                      <div className="absolute top-4 right-4 text-[9px] font-bold text-slate-600 uppercase tracking-widest px-2 py-1 bg-slate-800 rounded">JSON Editor</div>
                                   </div>
                                   {jsonError && <p className="text-xs text-red-500 font-bold flex items-center gap-2 px-1 animate-pulse"><AlertCircle size={14} /> {jsonError}</p>}
                                   <div className="flex justify-between items-center px-1">
                                      <button onClick={restoreDefaultMetadata} className="text-[11px] font-bold text-slate-400 hover:text-slate-900 underline flex items-center gap-2 transition-colors"><RotateCcw size={14} /> 重設為出廠值</button>
                                      <button onClick={() => { try { JSON.parse(jsonEditorContent); setJsonError(null); showAlert("語法校驗成功", "此 JSON 格式合法且有效", "success"); } catch (e) { setJsonError("JSON 格式非法，請修正括號或逗號"); } }} className="text-[11px] font-bold px-4 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 border border-slate-200 transition-all">立即驗證語法</button>
                                   </div>
                                </div>
                             )}
                          </div>
                       </div>
                       <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                          <button onClick={closeDrawer} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl transition-all">取消</button>
                          <button onClick={saveToolMetadata} className="px-8 py-2.5 text-sm bg-brand-600 text-white hover:bg-brand-700 rounded-xl shadow-lg font-bold transition-all transform active:scale-95 flex items-center gap-2"><Save size={18}/> 儲存配置</button>
                       </div>
                    </>
                 )}

                 {/* --- Member Editor Drawer --- */}
                 {drawerType === 'member_editor' && (
                    <>
                       <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                          <div>
                            <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">成員管理</span>
                            <h3 className="text-xl font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                                {editingMemberId ? <Edit2 size={20} className="text-brand-600"/> : <Plus size={20} className="text-brand-600"/>}
                                {editingMemberId ? '編輯成員資料' : '邀請新成員加入'}
                            </h3>
                          </div>
                          <button onClick={closeDrawer} className="text-slate-300 hover:text-slate-900 p-2 hover:bg-white rounded-xl transition-all shadow-none"><X size={24}/></button>
                       </div>
                       <div className="flex-1 overflow-y-auto p-8 space-y-8">
                          <div className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">成員姓名</label>
                                <div className="relative group">
                                  <UserIcon size={18} className="absolute left-4 top-3 text-slate-300 group-focus-within:text-brand-600 transition-colors"/>
                                  <input type="text" value={memberForm.name} onChange={e => setMemberForm({...memberForm, name: e.target.value})} className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all" placeholder="請輸入姓名" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">電子郵件</label>
                                <div className="relative group">
                                  <Mail size={18} className="absolute left-4 top-3 text-slate-300 group-focus-within:text-brand-600 transition-colors"/>
                                  <input type="email" value={memberForm.email} onChange={e => setMemberForm({...memberForm, email: e.target.value})} className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all" placeholder="user@company.com" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">系統授權等級</label>
                                <div className="relative group">
                                  <Shield size={18} className="absolute left-4 top-3 text-slate-300 group-focus-within:text-brand-600 transition-colors"/>
                                  <select value={memberForm.role} onChange={e => setMemberForm({...memberForm, role: e.target.value as 'admin'|'user'})} className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50/50 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all">
                                    <option value="user">一般成員 (Standard User)</option>
                                    <option value="admin">系統管理員 (Super Admin)</option>
                                  </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">權限部門分組</label>
                                <div className="grid grid-cols-2 gap-2 p-1">
                                  {departments.map(dept => {
                                    const isChecked = memberForm.departments?.includes(dept);
                                    return (
                                      <div key={dept} onClick={() => toggleMemberDepartment(dept)} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${isChecked ? 'bg-brand-50 border-brand-500 text-brand-900 font-bold' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'}`}>
                                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${isChecked ? 'bg-brand-600 border-brand-600 text-white shadow-sm' : 'border-slate-300 bg-white'}`}>{isChecked && <Check size={10} strokeWidth={4}/>}</div>
                                          <span className="text-xs">{dept}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                            </div>
                          </div>
                       </div>
                       <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                          <button onClick={closeDrawer} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl transition-all">取消</button>
                          <button onClick={handleSaveMember} className="px-8 py-2.5 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-lg transform active:scale-95 transition-all">{editingMemberId ? '確認儲存' : '發送邀請'}</button>
                       </div>
                    </>
                 )}

                 {/* --- File Editor Drawer --- */}
                 {drawerType === 'file_editor' && pendingFile && (
                    <>
                       <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                          <div>
                            <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">知識建檔與權限控制</span>
                            <h3 className="text-xl font-bold text-slate-900 mt-0.5">{editingFileId ? '編輯檔案屬性' : '新檔案檢核'}</h3>
                          </div>
                          <button onClick={closeDrawer} className="text-slate-300 hover:text-slate-900 p-2 hover:bg-white rounded-xl transition-all shadow-none"><X size={24}/></button>
                       </div>
                       <div className="flex-1 overflow-y-auto p-8 space-y-8">
                          <div className="bg-slate-50 p-5 rounded-2xl flex justify-between items-center text-sm border border-slate-100 shadow-inner">
                              <div className="flex items-center gap-4 text-slate-700 font-bold"><FileText size={24} className="text-slate-400"/><span className="truncate max-w-[240px]">{pendingFile.name}</span></div>
                              <span className="text-slate-400 font-mono text-xs">{pendingFile.size}</span>
                          </div>
                          <div className="space-y-4">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Lock size={14} className="text-brand-600"/> 檢索可見性授權</label>
                              <div className="grid grid-cols-1 gap-3">
                                <label className={`flex items-center gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all ${filePermissions.has('public') ? 'bg-brand-50 border-brand-500 shadow-md ring-4 ring-brand-500/5' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                                  <input type="radio" name="perm" checked={filePermissions.has('public')} onChange={setPublicPermission} className="hidden" />
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${filePermissions.has('public') ? 'bg-brand-600 border-brand-600' : 'border-slate-300'}`}><div className="w-1.5 h-1.5 bg-white rounded-full" /></div>
                                  <div>
                                    <span className="block text-sm font-bold text-slate-900">全公司公開 (Public)</span>
                                    <span className="block text-xs text-slate-400 mt-0.5 font-medium">所有具備對話權限的成員皆可從此文件獲取資訊</span>
                                  </div>
                                </label>
                                <label className={`flex items-center gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all ${!filePermissions.has('public') ? 'bg-amber-50 border-amber-500 shadow-md ring-4 ring-amber-500/5' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                                  <input type="radio" name="perm" checked={!filePermissions.has('public')} onChange={setPrivatePermission} className="hidden" />
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${!filePermissions.has('public') ? 'bg-amber-600 border-amber-600' : 'border-slate-300'}`}><div className="w-1.5 h-1.5 bg-white rounded-full" /></div>
                                  <div>
                                    <span className="block text-sm font-bold text-slate-900">部門限定檢索 (Restricted)</span>
                                    <span className="block text-xs text-slate-400 mt-0.5 font-medium">僅限下方選取部門的成員對話時可引用此文件</span>
                                  </div>
                                </label>
                                {!filePermissions.has('public') && (
                                    <div className="ml-9 grid grid-cols-2 gap-2 mt-2 p-5 bg-white rounded-2xl border border-amber-200 animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm">
                                        {departments.map(dept => (
                                            <label key={dept} className="flex items-center gap-3 text-xs font-bold text-slate-600 cursor-pointer select-none group">
                                                <div onClick={() => toggleDeptPermission(dept)} className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${filePermissions.has(dept) ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-200 group-hover:border-amber-400'}`}>{filePermissions.has(dept) && <Check size={10} strokeWidth={4}/>}</div>
                                                {dept}
                                            </label>
                                        ))}
                                    </div>
                                )}
                              </div>
                          </div>
                          <div className="space-y-4">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14} className="text-brand-500"/> AI 識別語義標籤</p>
                            <div className="flex flex-wrap gap-2 p-2 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-inner">
                              {tagReviewData.matched.map(tag => (
                                <button key={tag} onClick={() => toggleTagSelection(tag)} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${selectedTags.has(tag) ? 'bg-brand-600 border-brand-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-brand-300'}`}>{tag}{selectedTags.has(tag) && <Check size={10} className="inline ml-1.5" strokeWidth={4} />}</button>
                              ))}
                              {tagReviewData.newSuggestions.map(tag => (
                                <button key={tag} onClick={() => toggleTagSelection(tag)} className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 border-dashed transition-all ${selectedTags.has(tag) ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-indigo-100 text-indigo-400 hover:border-indigo-300'}`}>{tag} <span className="text-[9px] ml-1 bg-indigo-50/50 px-1.5 rounded font-black opacity-80 uppercase tracking-tighter">New</span></button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-4">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">手動增補標籤</p>
                            <div className="flex gap-3">
                              <input type="text" value={manualInput} onChange={(e) => setManualInput(e.target.value)} placeholder="輸入標籤後點擊新增" className="flex-1 text-sm font-medium border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all" onKeyDown={(e) => e.key === 'Enter' && addManualTag()} />
                              <button onClick={addManualTag} className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all active:scale-95 shadow-none"><Plus size={20} /></button>
                            </div>
                          </div>
                       </div>
                       <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                          <button onClick={closeDrawer} className="px-6 py-2.5 text-sm font-bold text-slate-400 hover:text-slate-900 transition-all">放棄變更</button>
                          <button onClick={confirmAndSaveFile} className="px-10 py-2.5 text-sm bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-bold shadow-lg transform active:scale-95 transition-all flex items-center gap-2"><Save size={18} /> {editingFileId ? '儲存變更' : '確認上傳'}</button>
                       </div>
                    </>
                 )}
              </div>
           </>
        )}

        {/* ... (Existing Modals like Selected Session and Alert Modal stay as modals - they are transient) ... */}
        {selectedSession && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
             <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                   <div>
                      <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3"><History size={24} className="text-brand-600"/> 對話審查詳情</h3>
                      <div className="flex items-center gap-4 text-xs font-bold text-slate-400 mt-2 uppercase tracking-tight">
                         <span>ID: {selectedSession.id}</span>
                         <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                         <span>{selectedSession.userName}</span>
                         <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                         <span>{new Date(selectedSession.startTime).toLocaleString()}</span>
                      </div>
                   </div>
                   <button onClick={() => setSelectedSessionId(null)} className="text-slate-300 hover:text-slate-900 p-2 hover:bg-white rounded-2xl transition-all"><X size={28} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-10 bg-slate-50/30 space-y-8 scroll-smooth">
                   {selectedSession.messages.map((msg, idx) => {
                      const msgCorrection = corrections.find(c => c.messageId === msg.id);
                      return (
                        <div key={idx} className="flex flex-col gap-4">
                           <div className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm ${msg.role === 'assistant' ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{msg.role === 'assistant' ? 'AI' : 'U'}</div>
                              <div className={`max-w-[75%] px-6 py-4 rounded-2xl text-sm leading-relaxed shadow-sm border ${msg.role === 'user' ? 'bg-brand-50 border-brand-100 text-slate-800' : msg.feedback === 'dislike' ? 'bg-red-50 border-red-100 text-slate-900 font-medium' : 'bg-white border-slate-200 text-slate-800'}`}>
                                 <p>{msg.content}</p>
                                 {msg.role === 'assistant' && msg.feedback === 'dislike' && (
                                    <div className="mt-3 pt-3 border-t border-red-200/50 flex items-center gap-2 text-[10px] text-red-600 font-bold uppercase tracking-wider"><ThumbsDown size={14} /> 使用者已給予負向標籤</div>
                                 )}
                              </div>
                           </div>
                           {msgCorrection && (
                              <div className="ml-14 max-w-[70%] bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm relative shadow-sm ring-4 ring-amber-500/5">
                                 <div className="absolute -left-3 top-5 w-3 h-3 bg-amber-50 border-l border-t border-amber-200 rotate-[-45deg]"></div>
                                 <div className="flex items-center gap-3 mb-4">
                                    <span className="bg-amber-600 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest shadow-sm">對策建議 (Fix)</span>
                                    <span className="text-[10px] font-bold text-slate-400 font-mono">{new Date(msgCorrection.timestamp).toLocaleTimeString()}</span>
                                 </div>
                                 <div className="space-y-4">
                                    <div className="flex gap-4">
                                       <span className="text-[10px] font-black text-slate-400 uppercase w-16 flex-shrink-0 mt-0.5 tracking-widest">失效根因</span>
                                       <span className="text-amber-900 font-bold">{msgCorrection.errorReason}</span>
                                    </div>
                                    <div className="flex gap-4">
                                       <span className="text-[10px] font-black text-slate-400 uppercase w-16 flex-shrink-0 mt-1 tracking-widest">修正範本</span>
                                       <div className="text-slate-800 bg-white/60 p-4 rounded-xl border border-amber-200/50 italic font-medium leading-relaxed underline decoration-amber-200 underline-offset-4">{msgCorrection.correction}</div>
                                    </div>
                                 </div>
                              </div>
                           )}
                        </div>
                      );
                   })}
                </div>
             </div>
          </div>
        )}

        {alertModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[200] p-4 fade-in">
             <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] max-w-sm w-full p-8 text-center animate-in zoom-in-90 duration-200">
                <div className={`mx-auto w-16 h-16 rounded-3xl flex items-center justify-center mb-6 shadow-lg ${alertModal.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{alertModal.type === 'error' ? <AlertCircle size={36} /> : <CheckCircle2 size={36} />}</div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{alertModal.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-8">{alertModal.message}</p>
                <button onClick={closeAlertModal} className="w-full py-3.5 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold transition-all shadow-md transform active:scale-95">關閉視窗</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;