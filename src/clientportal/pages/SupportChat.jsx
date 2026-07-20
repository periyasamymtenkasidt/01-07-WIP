import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Send, Clock } from "lucide-react";

const TOPICS = [
  "General Query",
  "Design Revision Request",
  "Payment Issue",
  "Site Visit Request",
  "Urgent / Escalation",
];

const SupportChat = () => {
  const { messages, handleSendMessage } = useOutletContext();
  const [chatMessage, setChatMessage] = useState("");
  const [topic, setTopic] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    handleSendMessage(chatMessage, topic || null);
    setChatMessage("");
    setTopic("");
  };

  return (
    <div className="p-6 sm:p-8 flex flex-col flex-1 justify-between text-left">
      {/* Header */}
      <div className="border-b border-gray-100 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-purple/10 text-purple rounded-xl flex items-center justify-center font-bold text-xs">
            PR
          </div>
          <div className="text-left leading-none">
            <h4 className="text-xs font-bold text-darkgray">Prakash Raj</h4>
            <span className="text-[9.5px] text-emerald-500 font-bold flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active Designer
            </span>
          </div>
        </div>
        <span className="flex items-center gap-1 text-[10px] text-text-muted font-medium">
          <Clock size={11} /> Responds within 1 business day
        </span>
      </div>

      {/* Message Log */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 scroll-hidden-bar flex flex-col-reverse">
        <div className="space-y-4">
          {messages.map((m, idx) => {
            const isClient = m.sender === "client";
            const topicMatch = m.text.match(/^\[(.+?)\] ([\s\S]*)$/);
            const displayTopic = isClient && topicMatch ? topicMatch[1] : null;
            const displayText = topicMatch ? topicMatch[2] : m.text;

            return (
              <div key={idx} className={`flex ${isClient ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] p-4 rounded-2xl text-xs leading-relaxed ${
                  isClient
                    ? "bg-purple text-white rounded-br-none shadow-sm"
                    : "bg-light-gray border border-bordergray text-darkgray rounded-bl-none"
                }`}>
                  {displayTopic && (
                    <span className="block text-[9px] font-bold uppercase tracking-wider mb-1.5 text-white/70">
                      {displayTopic}
                    </span>
                  )}
                  <p>{displayText}</p>
                  <span className={`text-[8.5px] block mt-1.5 text-right ${isClient ? "text-white/60" : "text-text-subtle"}`}>
                    {m.time}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-bordergray/60 pt-3 shrink-0 space-y-2">
        {/* Topic Dropdown */}
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full text-xs border border-bordergray rounded-xl px-4 py-2.5 bg-light-gray focus:outline-none focus:border-purple text-text-muted"
        >
          <option value="">Select a topic (optional)</option>
          {TOPICS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Message + Send */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            placeholder="Type a message to your design team..."
            className="flex-1 text-xs border border-bordergray rounded-xl px-4 py-3 bg-light-gray focus:outline-none focus:border-purple focus:ring-1 focus:ring-purple/10"
          />
          <button
            type="submit"
            disabled={!chatMessage.trim()}
            className="p-3 bg-purple hover:bg-dark-blue text-white rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default SupportChat;
