/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  FileText, 
  Tag, 
  Hash, 
  Copy, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  ChevronRight,
  Sparkles,
  MessageSquareQuote
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { KW_DATABASE, Keyword } from './lib/keywords';
import { generateDescription, getAISuggestions } from './lib/gemini';

// --- Types ---
interface ScoredKeyword extends Keyword {
  finalScore: number;
}

// --- Constants ---
const STOP_WORDS = new Set(["và","của","là","có","được","trong","với","cho","một","này","đó","từ","theo",
  "tôi","bạn","con","ba","mẹ","cha","nhà","vào","ra","lên","xuống","đi","về","để","khi","mà",
  "nhưng","hay","hoặc","vì","thì","sẽ","đã","đang","đây","các","cũng","rất","thế","nào","gì",
  "không","hơn","ở","trên","dưới","sau","trước","còn","vẫn","lại","chỉ","như","nên","nếu",
  "tuy","dù","cả","nhiều","ít","đều","ai","sao","tại","vậy","thật","hãy","cần","muốn","làm",
  "biết","thấy","nói","nghe","hiểu","xem","nhìn","giúp","bắt","phải","luôn","lúc","ngày","giờ",
  "tất","mọi","những","ấy","kia","bên","cạnh","giữa","bị","đến","người","chúng"]);

const TOPIC_PATTERNS = [
  {t:"tuổi teen",p:["teen","tuổi teen","dậy thì","nổi loạn","bướng","10-18","tuổi 1"]},
  {t:"hành vi trẻ",p:["bướng bỉnh","không nghe","nói dối","ăn vạ","khóc","tức giận","nghiện"]},
  {t:"kết nối cha mẹ",p:["kết nối","lắng nghe","trò chuyện","chia sẻ","hiểu con","câu hỏi"]},
  {t:"tâm lý trẻ",p:["tâm lý","cảm xúc","não bộ","lo âu","stress","tổn thương","bất lực"]},
  {t:"kỹ năng cha mẹ",p:["cha mẹ","ba mẹ","phụ huynh","phương pháp","cách dạy","ứng xử"]},
  {t:"học tập",p:["học","trường","điểm","lười học","học kém","kiến thức","động lực"]},
  {t:"công nghệ",p:["điện thoại","phone","mạng xã hội","game","màn hình","tiktok","internet"]},
];

// --- Helpers ---
function extractPhrases(text: string) {
  const lower = text.toLowerCase().replace(/[""''「」\[\](){}<>!?.,;:–—\-]/g,' ').replace(/\s+/g,' ');
  const words = lower.split(' ').filter(w => w.length > 1 && !STOP_WORDS.has(w));
  const freq: Record<string, number> = {};
  words.forEach(w => { freq[w] = (freq[w]||0) + 1; });
  for (let i=0; i<words.length-1; i++) {
    if (!STOP_WORDS.has(words[i]) && !STOP_WORDS.has(words[i+1])) {
      const bi = words[i]+' '+words[i+1];
      freq[bi] = (freq[bi]||0) + 1.5;
    }
  }
  return freq;
}

function detectTopics(text: string) {
  const lower = text.toLowerCase();
  return TOPIC_PATTERNS.filter(tp => tp.p.some(p => lower.includes(p)));
}

function scoreKeywords(text: string, apiSuggestions: string[] = []): ScoredKeyword[] {
  const phrases = extractPhrases(text);
  const topics = detectTopics(text);
  const lower = text.toLowerCase();
  const topicNames = topics.map(t => t.t);

  const pinned = KW_DATABASE.filter(k => k.pinned).map(k => ({ ...k, finalScore: 999 }));
  const candidates = KW_DATABASE.filter(k => !k.pinned);

  const scored = candidates.map(item => {
    let s = item.score;
    const kwl = item.kw.toLowerCase();
    if (lower.includes(kwl)) s += 40;
    const tagHits = item.tags.filter(t => lower.includes(t.toLowerCase())).length;
    s += tagHits * 15;
    const catl = item.cat.toLowerCase();
    if (topicNames.some(t => catl.includes(t) || t.includes(catl))) s += 20;
    const pScore = Object.entries(phrases)
      .filter(([ph]) => kwl.includes(ph) || ph.includes(kwl))
      .reduce((acc, [, f]) => acc + f, 0);
    s += pScore * 8;
    if (apiSuggestions.some(a => a.toLowerCase().includes(kwl) || kwl.includes(a.toLowerCase()))) s += 30;
    return { ...item, finalScore: s };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);
  return [...pinned, ...scored];
}

// --- Components ---
export default function App() {
  const [content, setContent] = useState('');
  const [kwCount, setKwCount] = useState(50);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<ScoredKeyword[] | null>(null);
  const [aiDescription, setAiDescription] = useState<string | null>(null);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [activeTab, setActiveTab] = useState<'table' | 'cat'>('table');
  const [toast, setToast] = useState<{ message: string; type: 'ok' | 'warn' } | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);

  const showToast = (message: string, type: 'ok' | 'warn' = 'ok') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAnalyze = async () => {
    if (!content || content.trim().length < 50) {
      showToast('Vui lòng nhập bài viết ít nhất 50 ký tự!', 'warn');
      return;
    }

    setIsAnalyzing(true);
    setResults(null);
    setAiDescription(null);
    setAnalysisStep(1);

    // Simulate steps for UI feel
    await new Promise(r => setTimeout(r, 600));
    setAnalysisStep(2);
    await new Promise(r => setTimeout(r, 800));
    setAnalysisStep(3);
    
    // Real AI call for suggestions
    const aiSuggs = await getAISuggestions(content);
    setAnalysisStep(4);
    await new Promise(r => setTimeout(r, 600));
    setAnalysisStep(5);

    const scored = scoreKeywords(content, aiSuggs);
    const finalResults = scored.slice(0, kwCount);
    setResults(finalResults);
    
    // Automatically generate description using AI suggestions directly
    // This ensures keywords are highly relevant to the content and represent high search volume
    setIsGeneratingDesc(true);
    const desc = await generateDescription(content, aiSuggs);
    setAiDescription(desc);
    setIsGeneratingDesc(false);

    setIsAnalyzing(false);
    setAnalysisStep(0);
  };

  const handleGenerateDescription = async () => {
    if (!content || !results) return;
    setIsGeneratingDesc(true);
    const desc = await generateDescription(content, results.map(r => r.kw));
    setAiDescription(desc);
    setIsGeneratingDesc(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`Đã sao chép ${label}!`);
    });
  };

  const exportCSV = () => {
    if (!results) return;
    const rows = results.map((k, i) =>
      `${i + 1},"${k.kw}","#${k.kw.replace(/\s+/g, '')}","${k.kw}","${k.monthly || 'N/A'} (ước tính)","${k.cat}"`
    ).join('\n');
    const blob = new Blob(['\uFEFF' + 'STT,Thẻ từ khóa,Từ khóa tiêu đề (#),Từ khóa mô tả,Lượt tìm ước tính,Danh mục\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tu-khoa-youtube.csv';
    a.click();
    showToast('Đã tải file CSV!');
  };

  const tagsText = useMemo(() => results?.map(k => k.kw).join(', ') || '', [results]);
  const titleText = useMemo(() => results?.map(k => '#' + k.kw.replace(/\s+/g, '')).join(' ') || '', [results]);

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[40%] bg-pink-500/10 blur-[100px] rounded-full" />
        <div className="absolute top-[40%] left-[30%] w-[40%] h-[30%] bg-emerald-500/5 blur-[80px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 md:px-6 lg:px-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Search className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-transparent">
                KeywordAI
              </h1>
              <p className="text-sm text-slate-500 font-bold tracking-widest uppercase">
                YouTube SEO Research • Parenting Edition
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-base font-semibold">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Miễn phí • Tích hợp Gemini AI
          </div>
        </header>

        {/* Disclaimer */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 mb-8 flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-base leading-relaxed text-amber-200/80">
            <strong className="text-amber-500">Lưu ý:</strong> Lượng tìm kiếm hiển thị là ước tính tương đối dựa trên database nội bộ và xu hướng tìm kiếm — không phải số liệu chính xác tuyệt đối từ Google. Công cụ giúp bạn ưu tiên từ khóa phù hợp nhất với nội dung.
          </p>
        </div>

        <main className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8 items-start">
          {/* Left Column: Input */}
          <section className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-xl">
              <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <FileText className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Nhập Bài Viết</h2>
                  <p className="text-base text-slate-500">Dán nội dung để AI phân tích</p>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-base font-bold text-slate-400 flex justify-between">
                    <span>Nội dung bài viết</span>
                    <span className="text-base font-normal">{content.length.toLocaleString('vi')} ký tự</span>
                  </label>
                  <textarea
                    className="w-full h-64 bg-white/5 border border-white/10 rounded-2xl p-4 text-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none placeholder:text-slate-600"
                    placeholder="Dán nội dung bài viết vào đây... Bài càng chi tiết, từ khóa càng chính xác!"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-base font-bold text-slate-400">Từ khóa cố định</label>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-base font-bold text-indigo-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3" /> tư vấn tâm lý
                    </span>
                    <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-base font-bold text-indigo-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3" /> kỹ năng sống
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-base font-bold text-slate-400">Số từ khóa muốn lấy</label>
                    <span className="text-base font-bold text-indigo-400">{kwCount}</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={kwCount}
                    onChange={(e) => setKwCount(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="w-full py-4 bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-bold text-lg shadow-xl shadow-indigo-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isAnalyzing ? 'Đang phân tích...' : 'Phân Tích & Tìm Từ Khóa'}
                </button>
              </div>
            </div>

            <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-bold text-indigo-400 flex items-center gap-2">
                <Info className="w-4 h-4" /> Mẹo sử dụng
              </h3>
              <ul className="space-y-3">
                {[
                  'Dán vào ô THẺ: Không có #, cách nhau bằng dấu phẩy.',
                  'Dán vào TIÊU ĐỀ: Có dấu #, không khoảng cách.',
                  'Dán vào MÔ TẢ: Không có #, cách nhau bằng dấu phẩy.',
                  'Bài viết càng dài (>300 chữ), kết quả càng chính xác.'
                ].map((tip, i) => (
                  <li key={i} className="text-base text-slate-400 flex gap-2 leading-relaxed">
                    <div className="w-1 h-1 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Right Column: Results */}
          <section className="space-y-6 lg:sticky lg:top-8">
            <div className="bg-white/5 border border-white/10 rounded-3xl min-h-[600px] overflow-hidden backdrop-blur-xl flex flex-col">
              <AnimatePresence mode="wait">
                {!results && !isAnalyzing && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4"
                  >
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center animate-bounce">
                      <Search className="w-10 h-10 text-slate-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-300">Sẵn sàng phân tích</h3>
                    <p className="text-base text-slate-500 max-w-xs mx-auto">
                      Nhập bài viết và nhấn "Phân Tích" để nhận ngay bộ từ khóa YouTube tối ưu.
                    </p>
                  </motion.div>
                )}

                {isAnalyzing && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col items-center justify-center p-12 space-y-8"
                  >
                    <div className="relative w-20 h-20">
                      <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full" />
                      <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <div className="w-full max-w-xs space-y-4">
                      <h3 className="text-center font-bold text-indigo-400">Đang xử lý dữ liệu...</h3>
                      <div className="space-y-2">
                        {[
                          'Đọc & phân tích nội dung bài viết',
                          'Trích xuất cụm từ khóa quan trọng',
                          'Đối chiếu với database từ khóa',
                          'Tra cứu gợi ý YouTube & Google',
                          'Chấm điểm & tạo định dạng xuất'
                        ].map((step, i) => (
                          <div key={i} className={`flex items-center gap-3 text-base transition-all duration-300 ${analysisStep > i ? 'text-emerald-400' : analysisStep === i + 1 ? 'text-indigo-400' : 'text-slate-600'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${analysisStep > i ? 'bg-emerald-400' : analysisStep === i + 1 ? 'bg-indigo-400 animate-pulse' : 'bg-slate-700'}`} />
                            {step}
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {results && !isAnalyzing && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-6 space-y-8"
                  >
                    {/* Results Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-3xl font-bold">Kết Quả Phân Tích</h2>
                        <p className="text-base text-slate-500">Dữ liệu volume là ước tính tương đối</p>
                      </div>
                      <button 
                        onClick={handleAnalyze}
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Từ khóa', value: results.length },
                        { label: 'Volume cao', value: results.filter(k => k.finalScore >= 80).length },
                        { label: 'Chủ đề', value: new Set(results.map(k => k.cat)).size }
                      ].map((stat, i) => (
                        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                          <div className="text-2xl font-black bg-gradient-to-br from-indigo-400 to-pink-400 bg-clip-text text-transparent">
                            {stat.value}
                          </div>
                          <div className="text-base text-slate-500 font-bold uppercase tracking-wider mt-1">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Output Sections */}
                    <div className="space-y-4">
                      {/* Description Generator Feature */}
                      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-indigo-500/20 flex items-center justify-between bg-indigo-500/5">
                          <div className="flex items-center gap-2">
                            <MessageSquareQuote className="w-4 h-4 text-indigo-400" />
                            <span className="text-base font-bold">Mô tả video AI (Mới)</span>
                          </div>
                          {!aiDescription && (
                            <button 
                              onClick={handleGenerateDescription}
                              disabled={isGeneratingDesc}
                              className="px-3 py-1 bg-indigo-500 text-white text-base font-bold rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {isGeneratingDesc ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                              Viết mô tả
                            </button>
                          )}
                        </div>
                        <div className="p-4">
                          {isGeneratingDesc ? (
                            <div className="py-8 flex flex-col items-center gap-3">
                              <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
                              <p className="text-base text-indigo-300 animate-pulse">Đang sáng tạo nội dung chạm đến nỗi đau...</p>
                            </div>
                          ) : aiDescription ? (
                            <div className="space-y-3">
                              <div className="text-lg text-slate-300 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                {aiDescription}
                              </div>
                              <div className="flex justify-end gap-2">
                                <button 
                                  onClick={() => setAiDescription(null)}
                                  className="text-base text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                  Viết lại
                                </button>
                                <button 
                                  onClick={() => copyToClipboard(aiDescription, 'Mô tả AI')}
                                  className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-base font-bold transition-colors"
                                >
                                  <Copy className="w-3 h-3" /> Sao chép mô tả
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-base text-slate-500 italic text-center py-4">
                              Nhấn nút "Viết mô tả" để AI tạo đoạn văn thấu cảm, bao gồm từ khóa và CTA.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="bg-black/20 border border-white/5 rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-emerald-400" />
                            <span className="text-base font-bold">Thẻ từ khóa</span>
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-base font-bold rounded-full uppercase">Dán vào ô THẺ</span>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={exportCSV} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 transition-colors">
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => copyToClipboard(tagsText, 'Thẻ từ khóa')} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 transition-colors">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="p-4">
                          <p className="text-lg text-slate-400 leading-relaxed line-clamp-3">{tagsText}</p>
                        </div>
                      </div>

                      {/* Title Hashtags */}
                      <div className="bg-black/20 border border-white/5 rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Hash className="w-4 h-4 text-indigo-400" />
                            <span className="text-base font-bold">Từ khóa tiêu đề</span>
                            <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-base font-bold rounded-full uppercase">Dán vào TIÊU ĐỀ</span>
                          </div>
                          <button onClick={() => copyToClipboard(titleText, 'Hashtags tiêu đề')} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 transition-colors">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="p-4">
                          <p className="text-lg text-slate-400 leading-relaxed line-clamp-3">{titleText}</p>
                        </div>
                      </div>
                    </div>

                    {/* Tabs & Table */}
                    <div className="space-y-4">
                      <div className="flex p-1 bg-white/5 rounded-xl">
                        <button 
                          onClick={() => setActiveTab('table')}
                          className={`flex-1 py-2 text-base font-bold rounded-lg transition-all ${activeTab === 'table' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          Bảng chi tiết
                        </button>
                        <button 
                          onClick={() => setActiveTab('cat')}
                          className={`flex-1 py-2 text-base font-bold rounded-lg transition-all ${activeTab === 'cat' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          Theo danh mục
                        </button>
                      </div>

                      {activeTab === 'table' ? (
                        <div className="border border-white/5 rounded-2xl overflow-hidden">
                          <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-lg text-left">
                              <thead className="bg-white/5 text-slate-500 uppercase font-bold">
                                <tr>
                                  <th className="px-4 py-3 w-10">#</th>
                                  <th className="px-4 py-3">Từ khóa</th>
                                  <th className="px-4 py-3">Lượt tìm/tháng</th>
                                  <th className="px-4 py-3">Danh mục</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {results.map((kw, i) => (
                                  <tr key={i} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-4 py-3 text-slate-600 font-bold">{i + 1}</td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <span className={`font-bold ${kw.pinned ? 'text-indigo-400' : 'text-slate-300'}`}>{kw.kw}</span>
                                        {kw.pinned && <span className="text-base bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded-full uppercase">Cố định</span>}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-3">
                                        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden min-w-[60px]">
                                          <div 
                                            className={`h-full rounded-full ${kw.finalScore >= 80 ? 'bg-emerald-500' : kw.finalScore >= 40 ? 'bg-amber-500' : 'bg-slate-600'}`}
                                            style={{ width: `${Math.min(kw.finalScore, 100)}%` }}
                                          />
                                        </div>
                                        <span className={`font-bold whitespace-nowrap ${kw.finalScore >= 80 ? 'text-emerald-400' : kw.finalScore >= 40 ? 'text-amber-400' : 'text-slate-500'}`}>
                                          {kw.monthly}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="px-2 py-0.5 bg-white/5 rounded-md text-slate-500">{kw.cat}</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Array.from(new Set(results.map(r => r.cat))).map(cat => (
                            <div key={cat} className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-3">
                              <h4 className="text-base font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                                {cat}
                                <span className="text-indigo-400">{results.filter(r => r.cat === cat).length}</span>
                              </h4>
                              <div className="flex flex-wrap gap-1.5">
                                {results.filter(r => r.cat === cat).map((kw, i) => (
                                  <span key={i} className={`px-2 py-1 rounded-lg text-base font-bold ${kw.pinned ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-white/5 text-slate-400 border border-white/5'}`}>
                                    {kw.kw}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </main>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={`fixed bottom-8 left-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center gap-3 ${
              toast.type === 'warn' 
                ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' 
                : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
            }`}
          >
            {toast.type === 'warn' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span className="text-sm font-bold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
