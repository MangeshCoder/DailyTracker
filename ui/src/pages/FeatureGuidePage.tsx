import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';

export const FeatureGuidePage: React.FC = () => {
  const { isDark } = useTheme();
  const [selectedLang, setSelectedLang] = useState<'mr' | 'en'>('mr');

  const englishPdfUrl = '/DailyTracker_v2_Feature_Guide.pdf';
  const marathiPdfUrl = '/DailyTracker_v2_Feature_Guide_Marathi.pdf';
  const activePdfUrl = selectedLang === 'mr' ? marathiPdfUrl : englishPdfUrl;
  const activeFileName = selectedLang === 'mr' 
    ? 'DailyTracker_v2_Feature_Guide_Marathi.pdf' 
    : 'DailyTracker_v2_Feature_Guide.pdf';

  const marathiFeatures = [
    { title: 'वेळ आणि उपस्थिती', desc: 'रिअल-टाइम चेक-इन/आउट, सेकंदांसह लाईव्ह टाइमर, जिओफेन्सिंग व ब्रेक ट्रॅकिंग', icon: '⏱️' },
    { title: 'बायोमेट्रिक फेशियल रेकग्निशन', desc: 'वेबकॅमद्वारे चेहऱ्याची पडताळणी, १२८-डायमेंशनल एम्बेडिंग्ज व बनावट हजेरी प्रतिबंध', icon: '📷' },
    { title: 'कार्य व्यवस्थापन व कानबान', desc: 'ड्रॅग-अँड-ड्रॉप कानबान बोर्ड, स्प्रिंट माइलस्टोन्स, टास्क प्राधान्य व वेळ अंदाज', icon: '📋' },
    { title: 'एआय कोपायलट सहाय्यक', desc: 'Gemini 2.0 Flash द्वारे संभाषणात्मक टास्क निर्मिती, उपस्थिती विश्लेषण व १-क्लिक कृती', icon: '🤖' },
    { title: 'रिअल-टाइम चॅट आणि सहयोग', desc: 'SignalR वेबसॉकेट्स, सार्वजनिक चॅनेल्स, १:१ थेट संदेश व फाइल देवाणघेवाण', icon: '💬' },
    { title: 'सुट्टी व WFH कार्यप्रवाह', desc: 'मल्टी-टियर मंजुरी साखळी, सुट्टी शिल्लक ट्रॅकिंग व १-क्लिक सुरक्षित ईमेल टोकन्स', icon: '🏡' },
    { title: 'पेरोल आणि वेतनपत्रिका', desc: 'स्वयंचलित सीटीसी गणना, मूळ वेतन, एचआरए, पीएफ/पीटी कपात व डिजिटल पेस्लिप', icon: '💰' },
    { title: 'सुरक्षा आणि २-फॅक्टर ऑथेंटिकेशन', desc: 'TOTP Google/Microsoft Authenticator, रिकव्हरी कीज व रोल-बेस्ड परवानग्या', icon: '🔐' },
  ];

  const englishFeatures = [
    { title: 'Time & Attendance', desc: 'Real-time check-in/out, live timer with seconds, geofencing & break tracking', icon: '⏱️' },
    { title: 'Biometric Face Recognition', desc: 'Webcam facial verification, 128D embeddings & anti-spoofing protection', icon: '📷' },
    { title: 'Task Management & Kanban', desc: 'Interactive Kanban board, sprint milestones, task priorities & time logs', icon: '📋' },
    { title: 'AI Copilot Assistant', desc: 'Gemini 2.0 Flash assistant for conversational task creation, queries & shortcuts', icon: '🤖' },
    { title: 'Team Chat & Collaboration', desc: 'SignalR real-time messaging, public channels, direct chats & attachments', icon: '💬' },
    { title: 'Leave & WFH Workflows', desc: 'Multi-level approval chains, leave balances & 1-click email action tokens', icon: '🏡' },
    { title: 'Payroll & Digital Payslips', desc: 'Automated CTC calculations, allowances, PF/PT deductions & instant downloads', icon: '💰' },
    { title: 'Security & 2-Factor Auth', desc: 'TOTP Authenticator apps, emergency recovery codes & role-based RBAC', icon: '🔐' },
  ];

  const features = selectedLang === 'mr' ? marathiFeatures : englishFeatures;

  return (
    <div className={`p-4 md:p-6 max-w-7xl mx-auto space-y-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
      {/* Language Switcher Bar */}
      <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-500 flex items-center justify-center text-lg font-bold">
            🌐
          </div>
          <div>
            <h1 className="text-base font-bold">
              {selectedLang === 'mr' ? 'DailyTracker v2.0 - संपूर्ण कार्यप्रणाली मार्गदर्शिका' : 'DailyTracker v2.0 - Enterprise Feature Manual'}
            </h1>
            <p className="text-xs text-slate-400">
              {selectedLang === 'mr' ? '४० पृष्ठांचे सर्वसमावेशक मॅन्युअल (मराठी व इंग्रजी)' : '40-page comprehensive manual available in English & Marathi'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedLang('mr')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              selectedLang === 'mr'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🇮🇳 मराठी (Marathi)
          </button>
          <button
            onClick={() => setSelectedLang('en')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              selectedLang === 'en'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🇬🇧 English
          </button>
          <a
            href={activePdfUrl}
            download={activeFileName}
            className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-md shadow-emerald-500/20"
          >
            <span>📥 Download PDF</span>
          </a>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {features.map((f, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-2xl border transition-all ${
              isDark ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:shadow-md'
            }`}
          >
            <div className="text-2xl mb-2">{f.icon}</div>
            <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* PDF Preview Frame */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="p-3 border-b flex items-center justify-between border-inherit">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>📄</span>
            <span>{activeFileName}</span>
          </div>
          <a
            href={activePdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline"
          >
            Open in new tab ↗
          </a>
        </div>
        <iframe
          src={activePdfUrl}
          title="DailyTracker User Guide"
          className="w-full h-[650px] border-none"
        />
      </div>
    </div>
  );
};