import React, { useState, useRef, useEffect } from 'react';

export default function App() {
  const [sessionId, setSessionId] = useState(() => {
    let sid = localStorage.getItem('chat_session_id');
    if (!sid) {
      sid = 'session_' + Date.now();
      localStorage.setItem('chat_session_id', sid);
    }
    return sid;
  });

  const [messages, setMessages] = useState([]);
  const [sessionsList, setSessionsList] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);
  const [activeBotMsg, setActiveBotMsg] = useState(null);

  const welcomeMsg = { id: 'welcome', sender: 'bot', viContent: 'Xin chào! Tôi là trợ lý Y Khoa. Hãy đặt câu hỏi cho tôi về bệnh lý...', activeLang: 'vi' };

  // --- HÀM ĐỔI NGÔN NGỮ CHO TIN NHẮN CŨ ---
  const toggleHistoryLang = (id, lang) => {
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, activeLang: lang } : msg
    ));
  };

  // --- HÀM XÓA CUỘC TRÒ CHUYỆN ---
  const deleteSession = async (e, id) => {
    e.stopPropagation(); 
    if (!window.confirm("Bạn có chắc chắn muốn xóa vĩnh viễn cuộc trò chuyện này?")) return;

    try {
      const response = await fetch(`http://localhost:8000/delete-session/${id}`, { method: 'DELETE' });
      if (response.ok) {
        if (id === sessionId) {
          handleNewChat();
        } else {
          fetchSessions();
        }
      }
    } catch (error) { console.error("Lỗi xóa hội thoại:", error); }
  };

  // --- LẤY DANH SÁCH SIDEBAR ---
  const fetchSessions = async () => {
    try {
      const response = await fetch(`http://localhost:8000/all-sessions`);
      if (response.ok) {
        const data = await response.json();
        setSessionsList(data);
      }
    } catch (e) { console.error(e); }
  };

  // --- LẤY NỘI DUNG CHAT CỦA SESSION ĐƯỢC CHỌN ---
  const fetchHistory = async (id) => {
    try {
      const response = await fetch(`http://localhost:8000/history/${id}`);
      if (response.ok) {
        const historyData = await response.json();
        setMessages([welcomeMsg, ...historyData]);
      } else { setMessages([welcomeMsg]); }
    } catch (error) { setMessages([welcomeMsg]); }
  };

  useEffect(() => { fetchSessions(); fetchHistory(sessionId); }, [sessionId]);

  // Tự động cuộn
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeBotMsg]);

  // --- GỬI TIN NHẮN VÀ STREAMING ---
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput('');
    setIsLoading(true);
    setMessages(prev => [...prev, { id: Date.now() + 'u', sender: 'user', text: userMsg }]);
    
    let currentBotState = { enContent: '', viContent: '', status: 'Đang phân tích tài liệu y khoa...', references: '', activeLang: 'en', error: '' };
    setActiveBotMsg(currentBotState);

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, language: 'all', session_id: sessionId })
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let lines = buffer.split('\n\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') break;
            try {
              const data = JSON.parse(dataStr);
              currentBotState = { ...currentBotState, status: '' };
              if (data.chunk) currentBotState.enContent += data.chunk;
              else if (data.status) currentBotState.status = data.status;
              else if (data.final_vi) { 
                currentBotState.viContent = data.final_vi; 
                currentBotState.activeLang = 'vi'; 
              }
              if (data.references) currentBotState.references = data.references;
              setActiveBotMsg({ ...currentBotState });
            } catch (e) {}
          }
        }
      }
      setMessages(prev => [...prev, { id: Date.now() + 'b', sender: 'bot', ...currentBotState, status: '' }]);
      setActiveBotMsg(null);
      fetchSessions(); // Cập nhật Sidebar ngay lập tức
    } catch (e) { 
      setActiveBotMsg(prev => ({ ...prev, error: 'Lỗi kết nối đến Server FastAPI.', status: '' }));
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleNewChat = () => {
    const newSid = 'session_' + Date.now();
    localStorage.setItem('chat_session_id', newSid);
    setSessionId(newSid);
    setMessages([welcomeMsg]);
  };

  // --- RENDER GIAO DIỆN BOT XỊN SÒ (CÓ NÚT VN/EN) ---
  const renderBotContent = (msg, isHistory) => (
    <div className="flex-1 w-full relative">
      {msg.id !== 'welcome' && (
        <div className="flex justify-end mb-2 absolute right-0 top-0 z-10">
          <div className="flex items-center bg-gray-800 rounded-lg p-0.5 border border-gray-600 text-xs shadow-sm">
            <button 
              onClick={() => isHistory ? toggleHistoryLang(msg.id, 'vi') : setActiveBotMsg(prev => ({...prev, activeLang: 'vi'}))} 
              className={`px-3 py-1 font-medium rounded-md transition-colors ${msg.activeLang === 'vi' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              VN
            </button>
            <button 
              onClick={() => isHistory ? toggleHistoryLang(msg.id, 'en') : setActiveBotMsg(prev => ({...prev, activeLang: 'en'}))} 
              className={`px-3 py-1 font-medium rounded-md transition-colors ${msg.activeLang === 'en' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              EN
            </button>
          </div>
        </div>
      )}

      <div className={`leading-relaxed whitespace-pre-wrap ${msg.id !== 'welcome' ? 'mt-8' : ''}`}>
        {msg.status && (
          <span className="text-green-400 italic block mb-2">
            <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>{msg.status}
          </span>
        )}
        
        {msg.activeLang === 'en' 
          ? (msg.enContent || <span className="text-gray-500 italic">Đang phân tích dữ liệu tiếng Anh...</span>)
          : (msg.viContent || (msg.status ? '' : <span className="text-gray-400 italic">Đang chờ dịch sang Tiếng Việt...</span>))
        }

        {msg.error && (
          <span className="text-red-400 mt-2 block">
            <i className="fa-solid fa-triangle-exclamation"></i> {msg.error}
          </span>
        )}
        
        {msg.references && (
          <div className="mt-4 pt-2 border-t border-gray-600 text-sm text-gray-400">
            <strong className="text-gray-300">📚 Tài liệu tham khảo:</strong><br />
            <span dangerouslySetInnerHTML={{ __html: msg.references.replace(/\n/g, '<br>') }} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-screen flex bg-[#343541] text-[#ececf1] overflow-hidden font-sans">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
      
      {/* SIDEBAR VỚI NÚT XÓA */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-[#202123] border-r border-gray-700 flex flex-col transition-all duration-300 overflow-hidden shrink-0`}>
        <div className="p-3">
          <button onClick={handleNewChat} className="w-full flex items-center gap-3 border border-gray-600 rounded-md p-3 hover:bg-gray-700 text-sm transition-colors">
            <i className="fa-solid fa-plus"></i> Cuộc trò chuyện mới
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 space-y-2">
          {sessionsList.map(s => (
            <div key={s.id} className="group relative">
              <button 
                onClick={() => setSessionId(s.id)}
                className={`w-full text-left p-3 rounded-md text-sm truncate flex items-center gap-3 pr-10 transition-colors ${s.id === sessionId ? 'bg-[#343541]' : 'hover:bg-[#2A2B32] text-gray-400'}`}
              >
                <i className="fa-regular fa-message"></i>
                <span className="truncate">{s.title}</span>
              </button>
              <button 
                onClick={(e) => deleteSession(e, s.id)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Xóa cuộc trò chuyện"
              >
                <i className="fa-solid fa-trash-can text-xs"></i>
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* KHU VỰC CHAT CHÍNH */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="p-4 border-b border-gray-700 bg-gray-800 flex items-center gap-4 z-10 shadow-sm">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-400 hover:text-white p-2">
            <i className="fa-solid fa-bars text-xl"></i>
          </button>
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-stethoscope text-green-400 text-xl"></i>
            <h1 className="font-semibold text-gray-100">Medical AI Assistant</h1>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-40">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 p-5 rounded-xl max-w-4xl mx-auto w-full transition-colors ${msg.sender === 'user' ? 'bg-transparent' : 'bg-[#444654] border border-gray-700/50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.sender === 'user' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                <i className={`fa-solid ${msg.sender === 'user' ? 'fa-user' : 'fa-robot'} text-white text-xs`}></i>
              </div>
              {msg.sender === 'user' 
                ? <div className="leading-relaxed whitespace-pre-wrap pt-1 text-gray-200">{msg.text}</div> 
                : renderBotContent(msg, true)
              }
            </div>
          ))}

          {/* HIỆN CHỮ ĐANG GÕ (STREAMING) */}
          {activeBotMsg && (
            <div className="flex gap-4 p-5 rounded-xl bg-[#444654] border border-gray-700/50 w-full max-w-4xl mx-auto">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
                <i className="fa-solid fa-robot text-white text-xs"></i>
              </div>
              {renderBotContent(activeBotMsg, false)}
            </div>
          )}
          <div ref={messagesEndRef} />
        </main>

        <footer className="p-4 bg-gradient-to-t from-[#343541] via-[#343541] to-transparent flex justify-center absolute bottom-0 left-0 right-0 pointer-events-none">
           <div className="w-full max-w-4xl relative pointer-events-auto pb-4">
              <textarea 
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                className="w-full bg-gray-700 p-4 pl-5 pr-14 rounded-xl focus:outline-none border border-gray-600 text-white shadow-xl resize-none" 
                placeholder="Hỏi về triệu chứng, bệnh lý..."
                rows="1"
              />
              <button 
                onClick={handleSend} 
                disabled={isLoading || !input.trim()}
                className="absolute right-3 bottom-7 p-2.5 bg-green-600 rounded-lg text-white hover:bg-green-500 disabled:bg-gray-600 disabled:opacity-50 transition-all"
              >
                {isLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
              </button>
           </div>
        </footer>
      </div>
    </div>
  );
}