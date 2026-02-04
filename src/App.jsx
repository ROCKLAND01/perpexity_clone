import React, { useState, useRef, useEffect } from 'react';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/clerk-react';
import { Search, Globe, FileText, ChevronRight, Share2, Plus, Menu, Sun, Moon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';

const App = () => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [sources, setSources] = useState([]);
  const [answer, setAnswer] = useState('');
  const [history, setHistory] = useState([]); // This is messages history
  const [chats, setChats] = useState([]); // This is list of chats for sidebar
  const [currentChatId, setCurrentChatId] = useState(null);
  const [error, setError] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [relatedQuestions, setRelatedQuestions] = useState([]);

  
  const { user, isLoaded, isSignedIn } = useUser();
  const answerEndRef = useRef(null);

  // Responsive sidebar check
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch chat history on load
  const fetchChats = async () => {
    if (!isSignedIn || !user) return;
    try {
      console.log(`Fetching history for: ${user.id}`);
      const res = await fetch(`${import.meta.env.VITE_API_URI}/api/chats/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`Received ${data.length} chats`);
        setChats(data);
      } else {
        console.error("Fetch failed:", await res.text());
      }
    } catch (err) {
      console.error("Failed to fetch chats:", err);
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchChats();
    }
  }, [isLoaded, isSignedIn]);

  const scrollToBottom = () => {
    answerEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [answer, history]);

  // Load a specific chat
  const handleLoadChat = async (chatId) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URI}/api/chats/${user.id}/${chatId}`);
      if (res.ok) {
        const chat = await res.json();
        setHistory(chat.messages || []);
        setSources([]); // Ideally we should store sources too in the DB per message or per chat
        setAnswer('');
        setCurrentChatId(chatId);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
      }
    } catch (err) {
      console.error("Error loading chat:", err);
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setSources([]);
    setAnswer('');
    setRelatedQuestions([]);
    setError(null);

    
    const newContextMessage = { role: 'user', content: query };
    const tempHistory = [...history, newContextMessage];

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URI}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, history: tempHistory }),
      });

      if (!response.ok) throw new Error('Failed to fetch answer');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let isFirstChunk = true;
      let finalAnswer = '';
      let fetchedSources = [];
      let isRelatedPhase = false;
      let relatedBuffer = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        
        if (isFirstChunk && (buffer + chunk).includes('__JSON_END__')) {
          buffer += chunk;
          const parts = buffer.split('__JSON_END__');
          try {
            const sourcesData = JSON.parse(parts[0]);
            if (sourcesData.type === 'sources') {
              setSources(sourcesData.data);
              fetchedSources = sourcesData.data;
            }
          } catch (e) {
            console.error("Error parsing sources:", e);
          }
          const textChunk = parts[1] || '';
          setAnswer(textChunk);
          finalAnswer += textChunk;
          isFirstChunk = false;
          buffer = ''; // clear buffer after first chunk handled
        } else if (!isFirstChunk) {
          if (chunk.includes('__RELATED_QUESTIONS__')) {
            isRelatedPhase = true;
            const parts = chunk.split('__RELATED_QUESTIONS__');
            setAnswer(prev => prev + parts[0]);
            finalAnswer += parts[0];
            relatedBuffer += parts[1] || '';
          } else if (isRelatedPhase) {
            relatedBuffer += chunk;
          } else {
            setAnswer(prev => prev + chunk);
            finalAnswer += chunk;
          }
        } else {
          buffer += chunk;
        }
      }

      // Try to parse related questions
      if (relatedBuffer) {
        try {
          // LLM might wrap in markdown backticks
          const cleanJSON = relatedBuffer.replace(/```json|```/g, '').trim();
          const related = JSON.parse(cleanJSON);
          setRelatedQuestions(related);
        } catch (e) {
          console.error("Error parsing related questions:", e);
        }
      }

      // Update local history
      const assistantMessage = { role: 'assistant', content: finalAnswer };
      const updatedHistory = [...tempHistory, assistantMessage];
      setHistory(updatedHistory);

      // Save to DB
      if (isSignedIn && user) {
        try {
          const saveRes = await fetch(`${import.meta.env.VITE_API_URI}/api/chats/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              chatId: currentChatId, // if null, backend creates new
              messages: updatedHistory,
              title: currentChatId ? undefined : query.slice(0, 50) // Only set title for new chat
            })
          });
          
          if (saveRes.ok) {
            const saveData = await saveRes.json();
            if (!currentChatId && saveData.chatId) {
              setCurrentChatId(saveData.chatId);
            }
            // Always refresh chats to update "Last Modified" order
            fetchChats();
          } else {
            console.error("Failed to save chat:", await saveRes.text());
          }
        } catch (saveErr) {
          console.error("Error saving chat:", saveErr);
        }
      }
      
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsSearching(false);
      setQuery(''); // Clear input after search
    }
  };

  const handleNewChat = () => {
    setQuery('');
    setAnswer('');
    setSources([]);
    setRelatedQuestions([]);
    setHistory([]);

    setCurrentChatId(null);
    setError(null);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const [isDarkMode, setIsDarkMode] = useState(true);

  // Toggle theme
  const toggleTheme = () => setIsDarkMode(prev => !prev);

  return (
    <div className={`min-h-screen transition-colors duration-300 overflow-hidden ${isDarkMode ? 'bg-[#0a0a0a] text-[#ededed] selection:bg-blue-500/30' : 'bg-[#f7f7f8] text-gray-900 selection:bg-blue-200'}`}>
      <SignedOut>
        <div className="flex flex-col h-screen">
          <header className={`fixed top-0 w-full z-50 border-b ${isDarkMode ? 'border-white/5 bg-[#0a0a0a]/80' : 'border-gray-200 bg-white/80'} backdrop-blur-md px-4 md:px-6 py-3 flex items-center justify-between transition-colors`}>
             <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Search className="w-5 h-5 text-white" />
              </div>
              <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>Perplexity <span className="text-blue-500 text-sm align-super">Clone</span></span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <button 
                onClick={toggleTheme}
                className={`transition-colors p-2 rounded-lg mr-2 ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-black hover:bg-gray-200'}`}
                title="Toggle Theme"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <SignInButton mode="modal">
                <button className={`text-sm font-medium px-3 py-2 active:scale-95 rounded-lg transition-colors ${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-black'}`}>Sign In</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className={`text-sm font-semibold px-4 py-2 rounded-full transition-all active:scale-95 shadow-sm hover:shadow-md ${isDarkMode ? 'bg-white text-black hover:bg-gray-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Sign Up</button>
              </SignUpButton>
            </div>
          </header>
          
          <main className="flex-1 flex flex-col items-center justify-center p-4 text-center mt-16">
            <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
               <h1 className={`text-5xl md:text-7xl font-bold bg-clip-text text-transparent tracking-tight ${isDarkMode ? 'bg-gradient-to-r from-white via-gray-200 to-gray-500' : 'bg-gradient-to-r from-gray-900 via-gray-700 to-gray-500'}`}>
                Where knowledge begins
              </h1>
              <p className={`text-xl max-w-lg mx-auto leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Discover answers, ask follow-ups, and find inspiration with our AI-powered search engine.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                 <SignUpButton mode="modal">
                  <button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white text-lg font-semibold px-8 py-4 rounded-full transition-all shadow-lg hover:shadow-blue-500/25 flex items-center justify-center gap-2">
                    Get Started <ChevronRight className="w-5 h-5" />
                  </button>
                </SignUpButton>
              </div>

              {/* Decorative elements */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 text-left opacity-90">
                <div className={`p-6 rounded-2xl border transition-colors ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <Globe className="w-8 h-8 text-blue-400 mb-4" />
                  <h3 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Real-time Search</h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Up-to-the-minute information from across the web.</p>
                </div>
                <div className={`p-6 rounded-2xl border transition-colors ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <FileText className="w-8 h-8 text-purple-400 mb-4" />
                  <h3 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Detailed Answers</h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Comprehensive responses with cited sources.</p>
                </div>
                <div className={`p-6 rounded-2xl border transition-colors ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <Share2 className="w-8 h-8 text-green-400 mb-4" />
                  <h3 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Share & Collaborate</h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Share your threads and findings instantly.</p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <Sidebar 
            isOpen={isSidebarOpen} 
            onClose={() => setIsSidebarOpen(false)}
            onNewChat={handleNewChat}
            history={chats}
            onLoadChat={handleLoadChat}
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
          />

          {/* Main Content Area */}
          <div 
            className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 ${
              isSidebarOpen ? 'md:ml-[280px]' : ''
            }`}
          >
            {/* Header */}
            <header className={`sticky top-0 w-full z-40 border-b ${isDarkMode ? 'border-white/5 bg-[#0a0a0a]/80' : 'border-gray-200 bg-white/80'} backdrop-blur-md px-4 md:px-6 py-3 flex items-center justify-between transition-colors`}>
              <div className="flex items-center gap-3">
                {!isSidebarOpen && (
                  <button 
                    onClick={() => setIsSidebarOpen(true)}
                    className={`p-2 -ml-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-600 hover:text-black'}`}
                    aria-label="Open sidebar"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                )}
                <div className={`flex items-center gap-2 font-bold text-xl tracking-tight ${isSidebarOpen ? 'md:hidden' : ''}`}>
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Search className="w-5 h-5 text-white" />
                  </div>
                  <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>Perplexity <span className="text-blue-500 text-sm align-super">Clone</span></span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <UserButton afterSignOutUrl="/" />
              </div>
            </header>

                    <main className="flex-1 overflow-y-auto pt-8 pb-32 px-4 w-full max-w-3xl mx-auto scrollbar-hide">
              {/* Hero / Initial Search State */}
              {history.length === 0 && !answer && !isSearching && (
                <div className="mt-12 md:mt-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
                  <h1 className={`text-4xl md:text-5xl font-bold mb-8 bg-clip-text text-transparent leading-tight ${isDarkMode ? 'bg-gradient-to-r from-white to-gray-500' : 'bg-gradient-to-r from-gray-900 to-gray-600'}`}>
                    Where knowledge begins
                  </h1>
                </div>
              )}

              {/* Chat History Rendering */}
              <div className="space-y-12">
                {history.map((msg, idx) => (
                  <div key={idx} className="space-y-4 animate-in fade-in duration-500">
                    {msg.role === 'user' ? (
                      <h2 className={`text-2xl md:text-3xl font-semibold tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {msg.content}
                      </h2>
                    ) : (
                      <div className="space-y-6">
                        {/* Only show sources for assistant messages if possible, 
                            but we don't store sources currently. 
                            If it's the very last message and we are NOT searching, 
                            we could show them if we still have them in state. 
                            However, for past messages, sources are lost unless saved. */}
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-400">
                          <FileText className="w-4 h-4" />
                          Answer
                        </div>
                        <div className={`markdown-content text-[17px] tracking-tight leading-7 ${isDarkMode ? 'text-[#ededed]' : 'text-gray-800'}`}>
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Current Search Results / Streaming Answer */}
                {(isSearching || answer) && (
                  <div className="space-y-8 pt-4 border-t border-white/5">
                    {/* Sources (for current search only) */}
                    <AnimatePresence>
                      {sources.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-4"
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold text-gray-400">
                            <Globe className="w-4 h-4" />
                            Sources
                          </div>
                          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent -mx-4 px-4 md:mx-0 md:px-0">
                            {sources.map((source, idx) => (
                              <a 
                                key={idx}
                                href={source.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className={`flex-shrink-0 w-48 p-3 space-y-2 group rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-gray-200 hover:border-blue-200 shadow-sm'}`}
                              >
                                <div className="text-xs font-medium text-gray-400 truncate flex items-center gap-1">
                                  <img 
                                    src={`https://www.google.com/s2/favicons?domain=${new URL(source.url).hostname}&sz=32`} 
                                    alt="" 
                                    className="w-3 h-3 rounded-sm"
                                  />
                                  {new URL(source.url).hostname}
                                </div>
                                <h3 className={`text-xs font-bold line-clamp-2 transition-colors ${isDarkMode ? 'text-gray-200 group-hover:text-blue-400' : 'text-gray-800 group-hover:text-blue-600'}`}>
                                  {source.title}
                                </h3>
                                <div className="text-[10px] text-gray-500 flex items-center justify-between">
                                  <span>{idx + 1}</span>
                                  <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </a>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Streaming Answer */}
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-400">
                        <FileText className="w-4 h-4" />
                        Answer
                      </div>
                      <div className={`markdown-content text-[17px] tracking-tight leading-7 ${isDarkMode ? 'text-[#ededed]' : 'text-gray-800'}`}>
                        {answer ? (
                          <ReactMarkdown>{answer}</ReactMarkdown>
                        ) : (
                          <div className="space-y-3">
                            <div className={`h-4 w-full rounded-full animate-pulse ${isDarkMode ? 'bg-white/5' : 'bg-gray-200'}`} />
                            <div className={`h-4 w-5/6 rounded-full animate-pulse ${isDarkMode ? 'bg-white/5' : 'bg-gray-200'}`} />
                            <div className={`h-4 w-4/6 rounded-full animate-pulse ${isDarkMode ? 'bg-white/5' : 'bg-gray-200'}`} />
                          </div>
                        )}
                      </div>
                      
                      {/* Actions */}
                      {answer && !isSearching && (
                        <div className={`flex items-center gap-4 pt-6 mt-6 border-t ${isDarkMode ? 'border-white/5' : 'border-gray-200'}`}>
                          <button className="flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors">
                            <Share2 className="w-3.5 h-3.5" /> Share
                          </button>
                          <button className="flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors">
                            <Plus className="w-3.5 h-3.5" /> Follow-up
                          </button>
                        </div>
                      )}

                      {/* Related Questions UI */}
                      {relatedQuestions.length > 0 && !isSearching && (
                        <div className="pt-8 animate-in mt-4 fade-in slide-in-from-bottom-4 duration-700">
                           <div className="flex items-center gap-2 text-sm font-semibold text-gray-400 mb-4">
                            <Plus className="w-4 h-4" />
                            Related
                          </div>
                          <div className="flex flex-col gap-2">
                            {relatedQuestions.map((q, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  setQuery(q);
                                  // Trigger search using the query
                                  const fakeEvent = { preventDefault: () => {} };
                                  handleSearch(fakeEvent);
                                }}
                                className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20' : 'bg-white border-gray-200 hover:border-blue-200 hover:bg-blue-50/30 shadow-sm'}`}
                              >
                                <span className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{q}</span>
                                <Plus className="w-4 h-4 text-blue-500" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </div>
                )}
                
                <div ref={answerEndRef} className="h-4" />

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                    {error}
                  </div>
                )}
              </div>
            </main>


            {/* Fixed Search Input */}
            <div className={`fixed bottom-0 right-0 w-full transition-all duration-300 ${isSidebarOpen ? 'md:w-[calc(100%-280px)]' : 'md:w-full'} p-4 md:p-8 z-30 ${isDarkMode ? 'bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent' : 'bg-gradient-to-t from-[#f7f7f8] via-[#f7f7f8] to-transparent'}`}>
              <div className="max-w-3xl mx-auto">
                <form 
                  onSubmit={handleSearch}
                  className={`relative group transition-all duration-300 ${isSearching ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSearch();
                      }
                    }}
                    placeholder="Ask anything..."
                    className={`w-full rounded-2xl px-5 py-4 pr-16 outline-none resize-none transition-all shadow-2xl min-h-[64px] max-h-32 text-lg border ${
                      isDarkMode 
                        ? 'bg-[#1a1a1a]/80 backdrop-blur-xl border-[#333] hover:border-[#444] focus:border-blue-500/50 placeholder:text-gray-600' 
                        : 'bg-white border-gray-200 hover:border-gray-300 focus:border-blue-500/50 text-gray-900 placeholder:text-gray-400'
                    }`}
                    rows={1}
                  />
                  <div className="absolute right-3 bottom-3 flex items-center gap-2">
                    <button 
                      type="submit"
                      disabled={!query.trim() || isSearching}
                      className="w-10 h-10 bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl flex items-center justify-center hover:bg-blue-500 transition-colors shadow-lg"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </form>
                <div className={`mt-3 flex flex-col items-center justify-center gap-2 text-[11px] font-medium tracking-wider uppercase ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
              <div className="flex gap-6">
                <span>Powered by Samson Mwag'onda</span>
                <span>Web Search via SerpAPI</span>
              </div>
              <div className="opacity-75">
                &copy; {new Date().getFullYear()} All rights reserved.
              </div>
            </div>
              </div>
            </div>
          </div>
        </div>
      </SignedIn>
    </div>
  );
};

export default App;