import React from "react";
import { ChevronLeft, Headphones, MessageCircle, Phone, Mail, Clock, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AgentSupportPage() {
  const navigate = useNavigate();

  const supportOptions = [
    {
      icon: <MessageCircle className="w-6 h-6" />,
      title: "Live Chat",
      description: "Chat with our support team",
      action: "Start Chat",
      color: "#f97316",
    },
    {
      icon: <Phone className="w-6 h-6" />,
      title: "Phone Support",
      description: "Call us at +92 300 1234567",
      action: "Call Now",
      color: "#f97316",
    },
    {
      icon: <Mail className="w-6 h-6" />,
      title: "Email Support",
      description: "support@winclub.com",
      action: "Send Email",
      color: "#f97316",
    },
  ];

  const faqs = [
    {
      question: "How do I become an agent?",
      answer: "Register and start inviting players. You'll earn commission on their deposits and bets.",
    },
    {
      question: "When are commissions paid?",
      answer: "Commissions are calculated daily and paid automatically to your wallet.",
    },
    {
      question: "What is the minimum withdrawal?",
      answer: "Minimum withdrawal is Rs 500 for EasyPaisa and JazzCash.",
    },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#1a1a1a] min-h-screen text-gray-200">
      {/* Header */}
      <div className="h-12 bg-[#252525] flex items-center px-4 border-b border-white/5 sticky top-0 z-20">
        <button 
          onClick={() => navigate(-1)}
          className="p-1 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white text-base font-black tracking-widest flex-1 text-center uppercase">
          Agent Support
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Support Icon Section */}
        <div className="bg-[#252525] border border-white/5 rounded-3xl p-6 mb-4 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-[#f97316]/20 rounded-full flex items-center justify-center">
            <Headphones className="w-10 h-10 text-[#f97316]" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">Customer Service</h2>
          <p className="text-xs text-gray-400">We're here to help you 24/7</p>
        </div>

        {/* Support Options */}
        <div className="space-y-3 mb-6">
          {supportOptions.map((option, index) => (
            <div
              key={index}
              className="bg-[#252525] border border-white/5 rounded-2xl p-4 flex items-center gap-4"
            >
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${option.color}20` }}
              >
                <div style={{ color: option.color }}>
                  {option.icon}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-white mb-1">{option.title}</h3>
                <p className="text-xs text-gray-400">{option.description}</p>
              </div>
              <button 
                className="shrink-0 px-4 py-2 bg-[#f97316] hover:bg-[#ea580c] text-black text-xs font-black rounded-lg transition-colors"
                style={{ backgroundColor: option.color }}
              >
                {option.action}
              </button>
            </div>
          ))}
        </div>

        {/* Working Hours */}
        <div className="bg-[#252525] border border-white/5 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-5 h-5 text-[#f97316]" />
            <h3 className="text-sm font-black text-white">Working Hours</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Monday - Friday</span>
              <span className="text-white font-bold">24/7</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Saturday - Sunday</span>
              <span className="text-white font-bold">24/7</span>
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div className="bg-[#252525] border border-white/5 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-[#f97316]" />
            <h3 className="text-sm font-black text-white">Frequently Asked Questions</h3>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border-b border-white/5 last:border-b-0 pb-4 last:pb-0">
                <h4 className="text-xs font-black text-white mb-2">{faq.question}</h4>
                <p className="text-xs text-gray-400 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Note */}
        <div className="bg-[#252525] border border-white/5 rounded-2xl p-4">
          <p className="text-xs text-gray-400 text-center">
            For urgent issues, please use Live Chat for immediate assistance.
          </p>
        </div>
      </div>
    </div>
  );
}