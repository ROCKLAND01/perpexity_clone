import React, { useState } from 'react';
import { 
  Plus, 
  MessageSquare, 
  Search, 
  Settings, 
  User, 
  Moon, 
  Sun, 
  Zap, 
  BookOpen, 
  Coffee,
  PanelLeftClose,
  ChevronRight,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/clerk-react';

/**
 * Sidebar Component
 * 
 * Features:
 * - New Chat creation
 * - Chat History list with search
 * - User Profile integration
 * - Mode Toggle (Casual/Helpful/Technical)
 * - Responsive design (Mobile drawer / Desktop sidebar)
 */
const Sidebar = ({ isOpen, onClose, onNewChat, history = [], onLoadChat, isDarkMode, toggleTheme }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [mode, setMode] = useState('helpful'); // casual, helpful, technical
  const { user } = useUser();

  // Filter history based on search term
  const filteredHistory = history.filter(chat => 
    chat.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    chat.firstMessage?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group history by date (logic can be improved with real dates)
  // For now, assume backend sorts by date, and we just listing them.
  // Or simpler: Just showing detailed list for now if date parsing is complex.
  // Let's stick to simple list if no date grouping logic provided, 
  // OR try to group if we have date strings.
  
  // Simplified grouping for demo (everything in "Recent") or implement simple date check
  const groupedHistory = {
    'Recent': filteredHistory
  };

  const modes = [
    { id: 'casual', icon: Coffee, label: 'Casual', color: 'text-orange-400' },
    { id: 'helpful', icon: Zap, label: 'Helpful', color: 'text-blue-400' },
    { id: 'technical', icon: BookOpen, label: 'Technical', color: 'text-purple-400' }
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <motion.div
        className={`fixed md:relative top-0 left-0 h-full bg-[#0a0a0a] border-r border-[#333] z-50 flex flex-col pointer-events-auto transition-colors ${
          isDarkMode ? 'bg-[#0a0a0a] border-[#333]' : 'bg-[#f7f7f8] border-gray-200'
        }`}
        initial={false}
        animate={{
          x: isOpen ? 0 : '-100%',
          opacity: isOpen ? 1 : 0
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        style={{ position: 'fixed', width: '280px' }} // Always fixed with explicit width
      >
        <div className="flex flex-col h-full w-[280px]"> {/* Fixed width container to prevent content squashing during transition */}
          
          {/* Header & New Chat */}
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-lg">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Search className="w-5 h-5 text-white" />
                </div>
                <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>Perplexity</span>
              </div>
              <button 
                onClick={onClose}
                className={`md:hidden p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-600 hover:text-black'}`}
              >
                <PanelLeftClose className="w-5 h-5" />
              </button>
            </div>

            <button 
              onClick={onNewChat}
              className={`w-full rounded-full py-2.5 px-4 flex items-center gap-2 transition-all group border ${
                isDarkMode 
                  ? 'bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/10 text-white' 
                  : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300 text-gray-700 shadow-sm'
              }`}
            >
              <Plus className={`w-5 h-5 group-hover:text-current ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <span className="font-medium text-sm">New Thread</span>
              <div className={`ml-auto text-xs border rounded px-1.5 py-0.5 ${isDarkMode ? 'text-gray-500 border-white/10' : 'text-gray-400 border-gray-200'}`}>⌘K</div>
            </button>
          </div>

          {/* Search History */}
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search threads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 transition-colors border ${
                  isDarkMode 
                    ? 'bg-[#111] border-[#222] text-gray-300 placeholder:text-gray-600' 
                    : 'bg-white border-gray-200 text-gray-700 placeholder:text-gray-400'
                }`}
              />
            </div>
          </div>

          {/* Chat History List */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-6 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
            {Object.entries(groupedHistory).map(([label, items]) => (
              items.length > 0 && (
                <div key={label} className="space-y-1">
                  <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</h3>
                  {items.map((chat, idx) => (
                    <button
                      key={chat.id || idx}
                      onClick={() => onLoadChat && onLoadChat(chat.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg group transition-colors flex items-center gap-3 overflow-hidden ${
                        isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'
                      }`}
                    >
                      <History className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-gray-600 group-hover:text-gray-400' : 'text-gray-400 group-hover:text-gray-600'}`} />
                      <span className={`text-sm truncate ${isDarkMode ? 'text-gray-300 group-hover:text-white' : 'text-gray-600 group-hover:text-gray-900'}`}>
                        {chat.title || "Untitled Conversation"}
                      </span>
                    </button>
                  ))}
                </div>
              )
            ))}
            
            {history.length === 0 && (
              <div className="px-4 py-8 text-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}>
                  <MessageSquare className="w-6 h-6 text-gray-600" />
                </div>
                <p className="text-sm text-gray-500">No chat history yet</p>
              </div>
            )}
          </div>

          {/* Settings & Profile */}
          <div className={`p-4 border-t ${isDarkMode ? 'border-[#222] bg-[#0a0a0a]' : 'border-gray-200 bg-[#f7f7f8]'}`}>
            
            {/* Mode Toggle */}
            <div className={`mb-4 p-1 rounded-lg flex items-center justify-between ${isDarkMode ? 'bg-[#111]' : 'bg-gray-200'}`}>
              {modes.map((m) => {
                const Icon = m.icon;
                const isActive = mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`flex-1 flex items-center justify-center p-1.5 rounded-md transition-all ${
                      isActive 
                        ? (isDarkMode ? 'bg-white/10 text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm') 
                        : (isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')
                    }`}
                    title={m.label}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? m.color : ''}`} />
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-between">
              <SignedIn>
                <div className="flex items-center gap-3 overflow-hidden">
                  <UserButton afterSignOutUrl="/" />
                  <div className="flex flex-col truncate">
                    <span className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {user?.fullName || user?.firstName || 'User'}
                    </span>
                    <span className="text-xs text-gray-500">Pro Member</span>
                  </div>
                </div>
                <button 
                  onClick={toggleTheme}
                  className={`transition-colors p-2 rounded-lg ${isDarkMode ? 'text-gray-500 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-black hover:bg-gray-200'}`}
                  title="Toggle Theme"
                >
                  {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              </SignedIn>
              
              <SignedOut>
                <div className="w-full space-y-2">
                  <SignInButton mode="modal">
                    <button className={`w-full text-sm font-medium py-2 rounded-lg transition-colors ${isDarkMode ? 'bg-[#222] hover:bg-[#333] text-white' : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-900'}`}>
                      Log In
                    </button>
                  </SignInButton>
                </div>
              </SignedOut>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default Sidebar;
