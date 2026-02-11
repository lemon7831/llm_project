import { BotConfig, FileData, User, DashboardStats } from './types';

export const INITIAL_DEPARTMENTS = ["財務部", "業務部", "IT部", "管理處"];

export const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    name: '王大明 (Admin)',
    email: 'admin@company.com',
    role: 'admin',
    departments: ['管理處'],
  },
  {
    id: 'u2',
    name: '李小美 (User)',
    email: 'may.li@company.com',
    role: 'user',
    departments: ['業務部', '管理處'],
  },
];

export const INITIAL_FILES: FileData[] = [
  {
    id: 'f1',
    name: '2025員工手冊.pdf',
    size: '2.4 MB',
    uploadDate: '2024-12-01',
    permissions: ['public'], // Public
    tags: ['規章', 'HR', '總務'],
  },
  {
    id: 'f2',
    name: 'Q1業務報表.pdf',
    size: '4.1 MB',
    uploadDate: '2025-04-10',
    permissions: ['業務部'],
    tags: ['財報', '績效', '業務'],
  },
  {
    id: 'f3',
    name: '財務審計報告_2024.xlsx',
    size: '1.2 MB',
    uploadDate: '2025-01-15',
    permissions: ['財務部'],
    tags: ['稽核', '財務'],
  }
];

// Updated to include toolMetadata and toolProcessingRules
export const INITIAL_BOT_CONFIG: BotConfig = {
  name: '企業智能助手 Alpha',
  persona: 'professional',
  systemPrompt: '你是一個專業的企業級AI助手，你的回答必須準確、簡潔，並且嚴格遵守企業數據權限。',
  activeTools: ['google-search', 'rag-retrieval'],
  qualityRules: ['check_pii', 'verify_facts'],
  reflectorPrompt: "- 確保所有回答符合公司資安規範，不洩漏機密數據。",
  toolMetadata: {},
  toolProcessingRules: {} // Step 7
};

export const PERSONA_OPTIONS = [
  { 
    value: 'professional', 
    label: '專業嚴謹 (適合財務/法務)', 
    prompt: '你是一個專業的企業級AI助手，語氣正式、客觀。你的回答必須準確、簡潔，並且嚴格遵守企業數據權限。回答時請優先引用數據支持你的論點。' 
  },
  { 
    value: 'friendly', 
    label: '親切活潑 (適合HR/客服)', 
    prompt: '你是一個親切的企業小幫手，語氣溫暖、樂於助人。在回答問題時，請使用口語化的方式，並適度使用表情符號來緩和氣氛。' 
  },
  { 
    value: 'creative', 
    label: '創意發想 (適合行銷/設計)', 
    prompt: '你是一個充滿創意的行銷顧問。請跳脫框架思考，提供多種視角的建議。你的回答應該激發靈感，並具備高度的執行性。' 
  },
];

// Expanded for 6.1 Scenarios
export const AVAILABLE_TOOLS = [
  // General Tools
  { 
    id: 'google-search', 
    name: '網頁搜尋 (Web Search)', 
    description: '允許 AI 搜尋網際網路以獲取最新時事與股價資訊。',
    iconName: 'Globe'
  },
  { 
    id: 'rag-retrieval', 
    name: '企業知識庫 (RAG)', 
    description: '檢索企業內部知識庫 (PDF, Excel, Doc)，回答基於文件的問題。',
    iconName: 'Database'
  },
  { 
    id: 'python-interpreter', 
    name: 'Python 代碼執行', 
    description: '執行 Python 程式碼以進行複雜數據分析與圖表繪製。',
    iconName: 'Terminal'
  },
  { 
    id: 'current-time', 
    name: '系統時間服務', 
    description: '獲取系統當前準確的日期與時間，用於行程安排。',
    iconName: 'Clock'
  },
  // New Atomic Tools for Scenario Demo
  {
    id: 'mcp-audio-transcriber',
    name: '會議錄音轉錄',
    description: '將會議錄音檔轉為逐字稿。',
    iconName: 'Mic'
  },
  {
    id: 'mcp-doc-generator',
    name: '自動文件生成',
    description: '根據內容自動生成 PDF 或 Word 摘要報告。',
    iconName: 'FileText'
  },
  {
    id: 'mcp-mail-sender',
    name: '郵件發送服務',
    description: '自動寄發電子郵件給指定收件人。',
    iconName: 'Mail'
  },
  {
    id: 'mcp-calendar',
    name: '企業行事曆',
    description: '讀取與寫入企業行事曆。',
    iconName: 'Calendar'
  }
];

// Scenario Definitions (Groupings of Atomic Tools)
export const SCENARIOS = [
  {
    id: 'meeting-secretary',
    name: '會議小秘書',
    description: '自動化會議記錄、摘要生成與後續跟進信件發送。',
    requiredTools: ['mcp-audio-transcriber'],
    optionalTools: ['mcp-doc-generator', 'mcp-mail-sender', 'mcp-calendar'],
    iconName: 'Briefcase'
  },
  {
    id: 'customer-support',
    name: '智能客服與工單',
    description: '處理客戶常見問題並自動建立 Jira 工單。',
    requiredTools: ['rag-retrieval'],
    optionalTools: ['mcp-mail-sender', 'current-time'],
    iconName: 'Headphones'
  },
  {
    id: 'market-analyst',
    name: '市場趨勢分析師',
    description: '搜尋網路最新趨勢並產生數據分析報告。',
    requiredTools: ['google-search', 'python-interpreter'],
    optionalTools: ['mcp-doc-generator'],
    iconName: 'TrendingUp'
  }
];

// Updated QUALITY_RULES with specific prompt text
export const QUALITY_RULES = [
  { id: 'check_pii', label: '個資遮蔽', description: '移除身分證、電話等敏感個資', text: '- 檢查回答內容，若包含身分證字號、信用卡號或個人手機，請替換為 [REDACTED]。' },
  { id: 'verify_facts', label: '事實查核', description: '若引用外部資訊需確認來源', text: '- 若回答包含外部數據或事實，請再次確認其邏輯一致性，避免 AI 幻覺。' },
  { id: 'tone_politeness', label: '語氣檢查', description: '確保語氣符合企業形象', text: '- 確保語氣專業、客觀且有禮貌，避免使用過於隨意或攻擊性的詞彙。' },
  { id: 'json_format', label: '格式校驗', description: '確保輸出為合法 JSON', text: '- 若使用者要求結構化輸出，請嚴格遵守 JSON 格式規範，不要包含多餘的 Markdown 標記。' },
  { id: 'no_hallucination', label: '禁止幻覺', description: '不確定的資訊請回答不知道', text: '- 如果你不確定答案或資料庫中沒有相關資訊，請直接回答「我沒有相關資訊」，嚴禁編造內容。' },
];

export const ERROR_REASONS = [
  { value: 'fact_incorrect', label: '與事實不符 (Fact Incorrect)' },
  { value: 'logic_error', label: '邏輯錯誤 (Logic Error)' },
  { value: 'outdated', label: '資料過時 (Outdated Data)' },
  { value: 'format_issue', label: '格式錯誤 (Format Issue)' },
  { value: 'hallucination', label: 'AI 幻覺 (Hallucination)' },
  { value: 'other', label: '其他原因 (Other)' },
];

export const MOCK_DASHBOARD_DATA: DashboardStats = {
  planName: '企業專業版 (Enterprise Pro)',
  renewalDate: '2025-12-31',
  usageRound: 2405,
  maxRound: 5000,
  totalInputTokens: 1543000,
  totalOutputTokens: 890200,
  activeUsers: 42,
  toolUsage: [
    { name: '企業知識庫 (RAG)', count: 1250 },
    { name: '網頁搜尋 (Web Search)', count: 850 },
    { name: 'Python 代碼執行', count: 120 },
    { name: '系統時間服務', count: 50 },
  ],
  costTrend: [
    { date: 'Mon', cost: 12.5, chats: 150 },
    { date: 'Tue', cost: 15.2, chats: 180 },
    { date: 'Wed', cost: 11.8, chats: 140 },
    { date: 'Thu', cost: 18.5, chats: 220 },
    { date: 'Fri', cost: 22.1, chats: 260 },
    { date: 'Sat', cost: 5.4, chats: 60 },
    { date: 'Sun', cost: 4.2, chats: 45 },
  ]
};