# Enterprise AI Agent Platform (v8.1)

這是一個專為企業設計的高階 AI Agent 管理平台與對話系統。本專案採用 React 19 開發，整合 Google Gemini API，並實作了企業級的權限控管 (RBAC)、RAG 知識檢索管理、MCP 工具調度以及自動化品管反思 (Reflector) 機制。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-v8.1-green.svg)
![React](https://img.shields.io/badge/react-v19-blue)

## 🌟 核心亮點

### 1. 雙層視圖架構
- **Admin Console (後台管理)**：專供管理員使用，具備營運儀表板、知識庫管理、成員權限設定、MCP 工具配置與品管規則定義。
- **Chat Interface (智能對話)**：供一般員工使用，採用 Gemini 風格的現代化 UI，支援思維鏈展示與長期記憶管理。

### 2. 企業級 RAG (檢索增強生成)
- **權限隔離**：文件可設定為「全公司公開」或「部門限定 (如：僅財務部可見)」。
- **智能標籤**：上傳文件時，AI 會自動分析內容並建議分類標籤。
- **混合檢索**：結合語義搜尋與關鍵字過濾 (Metadata Filtering)。

### 3. 進階 AI 流程 (The v8.1 Pipeline)
本系統實作了複雜的 Agent 思維流程：
1.  **意圖分析 (Analyzer)**：判斷使用者意圖與任務複雜度。
2.  **路由選擇 (Router)**：動態選擇最佳工具 (Google Search, RAG, Python 等)。
3.  **執行與清洗 (Executor)**：執行工具並清洗敏感數據 (PII Masking)。
4.  **自我反思 (Reflector)**：在回答前進行合規性檢查與事實查核。

### 4. 長期記憶與回饋循環
- **記憶庫**：系統會自動記錄使用者的偏好 (如：喜歡的回答格式、語言習慣)。
- **錯題本 (Feedback Loop)**：使用者可對回答按「倒讚」並提供修正建議，系統將自動學習並優化未來的回答。

---

## 🛠️ 技術棧

- **Frontend Framework**: React 19
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **AI Model**: Google Gemini API (`gemini-3-flash-preview` / `gemini-3-pro`)
- **Architecture**: Atomic Tool Design, Chain of Thought (CoT) UI

---

## 🚀 快速開始

### 前置需求
- Node.js 18+
- Google Gemini API Key

### 安裝與執行

1. **複製專案**
   ```bash
   git clone https://github.com/your-org/enterprise-ai-agent.git
   cd enterprise-ai-agent
   ```

2. **安裝依賴**
   ```bash
   npm install
   ```

3. **設定環境變數**
   在根目錄建立 `.env` 檔案並填入您的 API Key：
   ```env
   API_KEY=AIzaSy...
   ```
   *(注意：本專案使用 `@google/genai` SDK，API Key 將透過 `process.env.API_KEY` 讀取)*

4. **啟動開發伺服器**
   ```bash
   npm start
   ```

---

## 📂 專案結構

```
/
├── components/
│   ├── AdminPanel.tsx      # 後台管理核心組件 (含側邊滑出面板 Drawer)
│   └── ChatInterface.tsx   # 對話介面組件 (含思維鏈展示)
├── constants.ts            # 系統常數、Mock Data (預設使用者、文件)
├── types.ts                # TypeScript 介面定義 (User, FileData, BotConfig)
├── App.tsx                 # 主程式入口 (路由與全域狀態)
├── index.tsx               # React Render Root
└── README.md               # 專案說明文件
```

---

## 🕹️ 功能操作指南

### 切換角色 (模擬測試)
本系統內建模擬帳號切換功能，方便測試不同權限視野：
1. 點擊右上角 **個人頭像**。
2. 在下拉選單中選擇 **切換測試帳號**。
   - **王大明 (Admin)**：可存取後台管理與所有部門資料。
   - **李小美 (User)**：僅能進入對話介面，且受限於「業務部」資料權限。

### 知識庫建檔
1. 進入 **後台管理 > 知識注入**。
2. 拖曳上傳檔案 (模擬)。
3. 在右側滑出面板中設定 **檢索可見性授權** (Public 或 部門限定)。
4. AI 將自動分析並推薦標籤。

### MCP 工具配置
1. 進入 **後台管理 > MCP 工具庫**。
2. 切換 **原子工具** 視圖。
3. 點擊工具旁的設定 (⚙️) 圖示，設定進階參數 (如：資料清洗策略、自動摘要門檻)。

---

## 📊 規格版本資訊

- **Spec Version**: v8.1 (Implementation Standard)
- **Release Version**: Alpha v4.8.1
- **Updated**: 2025-05

> **Note**: 本專案為前端架構展示，後端邏輯 (RAG 向量檢索、資料庫儲存) 目前透過 Mock Data 與前端邏輯模擬，但已預留完整的介面 (Types) 供後端整合。
