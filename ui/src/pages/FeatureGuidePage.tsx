import React, { useState } from 'react';
import {
  BookOpen,
  Download,
  FileText,
  CheckCircle2,
  Globe,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Eye,
  FileDown,
  Layers,
  Clock,
  Camera,
  CalendarCheck,
  CreditCard,
  MessageSquare
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { GUIDE_VERSION } from '../utils/guide';

interface GuideEdition {
  id: 'english' | 'marathi';
  title: string;
  nativeTitle: string;
  filename: string;
  pdfUrl: string;
  pages: number;
  size: string;
  badge: string;
  summary: string;
  features: string[];
}


const EDITIONS: GuideEdition[] = [
  {
    id: 'english',
    title: 'DailyTracker v2 User Guide',
    nativeTitle: 'English Edition',
    filename: 'DailyTracker_v2_Feature_Guide.pdf',
    pdfUrl: `/DailyTracker_v2_Feature_Guide.pdf?v=${GUIDE_VERSION}`,
    pages: 18,
    size: '210 KB',
    badge: '18 pages · updated 1 Oct 2026',
    summary: 'Every feature explained in plain words with exact steps — your working day, leave and comp-off, WFH, expenses, payroll, chat, AI Help — plus a section for team leads and managers.',
    features: [
      "What's new: comp-off, expenses, Excel",
      'Check-in, breaks & forgotten check-out',
      'Leave, comp-off & WFH requests',
      'Expense claims & your payslip',
      'Chat, meetings & AI Help',
      'Approvals, hand-over & onboarding (managers)',
    ],
  },
  {
    id: 'marathi',
    title: 'DailyTracker v2 वापरकर्ता मार्गदर्शिका',
    nativeTitle: 'मराठी आवृत्ती (Marathi Edition)',
    filename: 'DailyTracker_v2_Feature_Guide_Marathi.pdf',
    pdfUrl: `/DailyTracker_v2_Feature_Guide_Marathi.pdf?v=${GUIDE_VERSION}`,
    pages: 18,
    size: '331 KB',
    badge: '१८ पाने · १ ऑक्टोबर २०२६',
    summary: 'प्रत्येक सुविधा सोप्या शब्दांत, नेमक्या पायऱ्यांसह — कामाचा दिवस, रजा व कॉम्प-ऑफ, WFH, खर्च, पगार, चॅट, AI Help — आणि टीम लीड व मॅनेजरसाठी स्वतंत्र भाग.',
    features: [
      'नवीन: कॉम्प-ऑफ, खर्च, Excel',
      'चेक-इन, ब्रेक आणि चेक-आउट विसरल्यास',
      'रजा, कॉम्प-ऑफ आणि WFH अर्ज',
      'खर्चाचे दावे आणि पे-स्लिप',
      'चॅट, मीटिंग आणि AI Help',
      'मंजुरी, सोपवणे आणि ऑनबोर्डिंग (मॅनेजर)',
    ],
  },
];

export const FeatureGuidePage: React.FC = () => {
  const { isDark } = useTheme();
  const { toast } = useToast();
  const [selectedEdition, setSelectedEdition] = useState<'english' | 'marathi'>('english');
  const [downloading, setDownloading] = useState<string | null>(null);

  const activeGuide = EDITIONS.find(e => e.id === selectedEdition) || EDITIONS[0];

  const handleDownload = async (edition: GuideEdition) => {
    setDownloading(edition.id);
    toast.info(
      edition.id === 'marathi'
        ? 'मराठी मार्गदर्शिका डाऊनलोड होत आहे...'
        : `Downloading ${edition.filename}...`
    );

    try {
      const response = await fetch(`${edition.pdfUrl}&download=true`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error('Server returned HTML instead of PDF.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = edition.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => window.URL.revokeObjectURL(url), 2000);

      toast.success(
        edition.id === 'marathi'
          ? 'मराठी मार्गदर्शिका यशस्वीरीत्या डाऊनलोड झाली!'
          : `${edition.title} downloaded successfully!`
      );
    } catch (err: any) {
      console.error('Download error:', err);
      const link = document.createElement('a');
      link.href = `${edition.pdfUrl}&download=true`;
      link.download = edition.filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.info('Initiated PDF download via browser fallback');
    } finally {
      setDownloading(null);
    }
  };

  const coreModules = [
    {
      icon: Clock,
      title: selectedEdition === 'marathi' ? 'वेळ व उपस्थिती' : 'Time & Attendance',
      desc: selectedEdition === 'marathi'
        ? 'ऑफिसजवळ चेक-इन, ब्रेक, चेक-आउट; विसरल्यास ॲप दिवस बंद करते व सकाळी तुम्ही वेळ पक्की करता'
        : "Check-in at the office, breaks and check-out; a forgotten check-out is closed for you and confirmed next morning",
    },
    {
      icon: Camera,
      title: selectedEdition === 'marathi' ? 'चेहरा ओळख' : 'Face Check-in',
      desc: selectedEdition === 'marathi'
        ? 'एकदा चेहरा नोंदवा; चेक-इनला कॅमेऱ्याद्वारे पडताळणी — दुसऱ्याच्या नावाने हजेरी टळते'
        : "Register your face once; the camera confirms it's you at check-in, so nobody can check in for you",
    },
    {
      icon: Layers,
      title: selectedEdition === 'marathi' ? 'कामे व EOD' : 'Tasks & EOD Report',
      desc: selectedEdition === 'marathi'
        ? 'प्राधान्य, टायमर, टेम्पलेट, Kanban बोर्ड आणि AI च्या मदतीने दिवसअखेरचा अहवाल'
        : "Tasks with priorities, timers, templates and a Kanban board; an AI-drafted end-of-day report",
    },
    {
      icon: CalendarCheck,
      title: selectedEdition === 'marathi' ? 'रजा, कॉम्प-ऑफ व WFH' : 'Leave, Comp-off & WFH',
      desc: selectedEdition === 'marathi'
        ? 'रजेची शिल्लक, सुट्टीला काम केल्याबद्दल कॉम्प-ऑफ, WFH / अर्धा दिवस आणि ई-मेलवरून मंजुरी'
        : "Leave balances, comp-off for weekend work, WFH / half days and one-click email approval",
    },
    {
      icon: CreditCard,
      title: selectedEdition === 'marathi' ? 'खर्च व पगार' : 'Expenses & Payroll',
      desc: selectedEdition === 'marathi'
        ? 'बिल जोडून खर्चाचा दावा; मंजूर रक्कम पगारासोबत; स्पष्ट पे-स्लिप आणि Excel'
        : "Claim expenses with the bill; approved amounts are paid with your salary; a clear payslip and Excel files",
    },
    {
      icon: ShieldCheck,
      title: selectedEdition === 'marathi' ? 'सुरक्षा' : 'Security',
      desc: selectedEdition === 'marathi'
        ? '2FA (Authenticator / ई-मेल कोड), ब्राउझर बंद केल्यावर व ३० मिनिटे निष्क्रिय राहिल्यावर लॉग-आउट'
        : "Two-step sign-in (authenticator or email codes); signed out when the browser closes or after 30 idle minutes",
    },
    {
      icon: MessageSquare,
      title: selectedEdition === 'marathi' ? 'चॅट व AI Help' : 'Chat & AI Help',
      desc: selectedEdition === 'marathi'
        ? 'फाइल, पोल, @mention, पिन व शोधासह चॅट; प्रश्न विचारा किंवा AI कडून कामे करून घ्या'
        : "Chat with files, polls, @mentions, pins and search; ask AI Help questions or let it do things for you",
    },
    {
      icon: Sparkles,
      title: selectedEdition === 'marathi' ? 'मॅनेजरसाठी' : 'For Managers',
      desc: selectedEdition === 'marathi'
        ? 'सर्व विनंत्या एकाच ठिकाणी, रजेवर जाताना मंजुरी सोपवणे, नवीन कर्मचाऱ्यांचे ऑनबोर्डिंग'
        : "One queue for every request, hand over approvals when away, and onboarding checklists for new joiners",
    },
  ];

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 ${isDark ? 'text-white' : 'text-slate-900'}`}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 opacity-10 pointer-events-none">
          <BookOpen className="w-64 h-64 text-white" />
        </div>
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider text-blue-100 border border-white/20">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            User Guides · updated 1 October 2026
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            DailyTracker v2 User Guides
          </h1>
          <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
            Read in the app or download the guide in English or Marathi — how to use every feature, step by step, including what's new: comp-off, expense claims, Excel downloads, onboarding and approval hand-over.
          </p>
        </div>
      </div>

      {/* Language Switcher & Download Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {EDITIONS.map((edition) => {
          const isSelected = selectedEdition === edition.id;
          return (
            <div
              key={edition.id}
              className={`rounded-2xl p-6 transition-all border-2 flex flex-col justify-between ${
                isDark
                  ? isSelected
                    ? 'bg-slate-800/90 border-blue-500 ring-2 ring-blue-500/20 shadow-lg'
                    : 'bg-slate-800/50 border-slate-700 hover:border-slate-600 shadow-sm'
                  : isSelected
                  ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                      isDark
                        ? 'bg-blue-950/60 text-blue-400 border-blue-800'
                        : 'bg-blue-50 text-blue-600 border-blue-200'
                    }`}>
                      <Globe className="w-3 h-3" />
                      {edition.nativeTitle}
                    </span>
                    <h2 className="text-lg font-bold">
                      {edition.title}
                    </h2>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-lg shrink-0 ${
                    isDark ? 'text-slate-300 bg-slate-700/70' : 'text-slate-600 bg-slate-100'
                  }`}>
                    {edition.badge}
                  </span>
                </div>

                <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {edition.summary}
                </p>

                <div className={`space-y-1.5 pt-3 border-t ${isDark ? 'border-slate-700/60' : 'border-slate-100'}`}>
                  <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Key Topics Covered:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {edition.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className={`truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`mt-6 pt-4 border-t flex items-center gap-3 ${isDark ? 'border-slate-700/60' : 'border-slate-100'}`}>
                <button
                  type="button"
                  onClick={() => setSelectedEdition(edition.id)}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all inline-flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-500'
                      : isDark
                      ? 'bg-slate-700/80 text-slate-200 hover:bg-slate-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{isSelected ? 'Viewing in Reader' : 'View in Reader'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload(edition)}
                  disabled={downloading === edition.id}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all disabled:opacity-50 shrink-0"
                  title={`Download ${edition.filename}`}
                >
                  {downloading === edition.id ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{downloading === edition.id ? 'Saving...' : 'Download PDF'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive PDF Reader Container */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${
        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
      }`}>
        <div className={`px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4 ${
          isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-500" />
            <div>
              <h3 className="text-sm font-bold">
                Interactive Viewer: {activeGuide.title}
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {activeGuide.nativeTitle} • {activeGuide.pages} Pages • Direct in-browser viewing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`${activeGuide.pdfUrl}&download=true`}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition-colors ${
                isDark
                  ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300'
                  : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in New Tab</span>
            </a>

            <button
              type="button"
              onClick={() => handleDownload(activeGuide)}
              disabled={downloading === activeGuide.id}
              className="inline-flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{downloading === activeGuide.id ? 'Downloading...' : 'Download'}</span>
            </button>
          </div>
        </div>

        <div className="w-full bg-slate-950 flex flex-col items-center min-h-[750px] relative">
          <iframe
            key={activeGuide.pdfUrl}
            src={`${activeGuide.pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
            title={activeGuide.title}
            className="w-full h-[80vh] border-0"
          >
            <div className="p-8 text-center text-slate-300 space-y-4">
              <p className="text-sm">
                Your browser does not support embedded PDF preview.
              </p>
              <a
                href={activeGuide.pdfUrl}
                download={activeGuide.filename}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-500"
              >
                <Download className="w-4 h-4" />
                Download {activeGuide.filename}
              </a>
            </div>
          </iframe>
        </div>
      </div>

      {/* Core Enterprise Modules Grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <h2 className="text-base font-bold">
            {selectedEdition === 'marathi'
              ? 'DailyTracker v2 मधील मुख्य सुविधा'
              : 'What DailyTracker v2 does'}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {coreModules.map((mod, idx) => {
            const Icon = mod.icon;
            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border transition-all ${
                  isDark
                    ? 'bg-slate-800/50 border-slate-700/80 hover:border-slate-600'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm mb-1">{mod.title}</h3>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {mod.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};