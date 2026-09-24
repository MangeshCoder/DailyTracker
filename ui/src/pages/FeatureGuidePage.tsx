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
    title: 'DailyTracker v2 Feature Guide',
    nativeTitle: 'English Edition',
    filename: 'DailyTracker_v2_Feature_Guide.pdf',
    pdfUrl: '/DailyTracker_v2_Feature_Guide.pdf',
    pages: 40,
    size: '40 KB',
    badge: 'Comprehensive (40 Pages)',
    summary: 'Full feature documentation detailing all modules: attendance clocking, biometric face setup, manager approvals, WFH policies, leave workflows, and security settings.',
    features: [
      'Task Tracking & Kanban Boards',
      'Face Biometric & 2FA Setup',
      'WFH Application & Approval Flow',
      'Leave Management & Public Holidays',
      'Team Directory & Org Hierarchy',
      'Manager EOD Reviews & Ratings'
    ]
  },
  {
    id: 'marathi',
    title: 'DailyTracker v2 वापरकर्ता मार्गदर्शिका',
    nativeTitle: 'मराठी आवृत्ती (Marathi Edition)',
    filename: 'DailyTracker_v2_Feature_Guide_Marathi.pdf',
    pdfUrl: '/DailyTracker_v2_Feature_Guide_Marathi.pdf',
    pages: 15,
    size: '188 KB',
    badge: 'मराठी भाषांतर (१५+ पाने)',
    summary: 'सर्व वैशिष्ट्यांचे संपूर्ण मराठी मार्गदर्शक: उपस्थिती नोंदणी, चेहरा ओळख (बायोमेट्रिक), WFH अर्ज, रजा व्यवस्थापन आणि मॅनेजर मंजुरी प्रक्रिया.',
    features: [
      'दैनंदिन कामे (Tasks) व प्रगती',
      'बायोमेट्रिक चेहरा ओळख व 2FA सुरक्षा',
      'घरून काम (WFH) अर्ज व मंजुरी',
      'रजा व्यवस्थापन आणि सुट्ट्यांची यादी',
      'संघ कॅलेंडर व सहकाऱ्यांची माहिती',
      'दिवसाअखेर अहवाल (EOD) सादर करणे'
    ]
  }
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
      const response = await fetch(`${edition.pdfUrl}?download=true`);
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
      link.href = `${edition.pdfUrl}?download=true`;
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
        ? 'रिअल-टाइम चेक-इन/आउट, सेकंदांसह लाईव्ह टाइमर, जिओफेन्सिंग व ब्रेक ट्रॅकिंग'
        : 'Real-time check-in/out, live timer with seconds, geofencing & break tracking'
    },
    {
      icon: Camera,
      title: selectedEdition === 'marathi' ? 'बायोमेट्रिक फेशियल पडताळणी' : 'Biometric Facial Verification',
      desc: selectedEdition === 'marathi'
        ? 'वेबकॅमद्वारे चेहऱ्याची पडताळणी, १२८-डायमेंशनल एम्बेडिंग्ज व सुरक्षित हजेरी'
        : 'Webcam facial verification, 128D embeddings & anti-spoofing protection'
    },
    {
      icon: Layers,
      title: selectedEdition === 'marathi' ? 'कार्य व्यवस्थापन व कानबान' : 'Task Tracking & Kanban',
      desc: selectedEdition === 'marathi'
        ? 'ड्रॅग-अँड-ड्रॉप कानबान बोर्ड, स्प्रिंट माइलस्टोन्स, टास्क प्राधान्य व वेळ अंदाज'
        : 'Drag-and-drop Kanban board, sprint milestones, task priorities & time logs'
    },
    {
      icon: CalendarCheck,
      title: selectedEdition === 'marathi' ? 'सुट्टी व WFH कार्यप्रवाह' : 'Leave & WFH Workflows',
      desc: selectedEdition === 'marathi'
        ? 'मल्टी-टियर मंजुरी साखळी, सुट्टी शिल्लक ट्रॅकिंग व १-क्लिक सुरक्षित ईमेल टोकन्स'
        : 'Multi-level approval chains, leave balances & 1-click email action tokens'
    },
    {
      icon: CreditCard,
      title: selectedEdition === 'marathi' ? 'पेरोल आणि वेतनपत्रिका' : 'Payroll & Digital Payslips',
      desc: selectedEdition === 'marathi'
        ? 'स्वयंचलित सीटीसी गणना, मूळ वेतन, एचआरए, पीएफ/पीटी कपात व डिजिटल पेस्लिप'
        : 'Automated CTC calculations, allowances, PF/PT deductions & instant downloads'
    },
    {
      icon: ShieldCheck,
      title: selectedEdition === 'marathi' ? 'सुरक्षा आणि 2FA' : 'Security & Two-Factor Auth',
      desc: selectedEdition === 'marathi'
        ? 'TOTP Google/Microsoft Authenticator, रिकव्हरी कीज व रोल-बेस्ड परवानग्या'
        : 'TOTP Authenticator apps, emergency recovery codes & role-based RBAC'
    },
    {
      icon: MessageSquare,
      title: selectedEdition === 'marathi' ? 'रिअल-टाइम चॅट आणि सहयोग' : 'Real-time Team Chat',
      desc: selectedEdition === 'marathi'
        ? 'सार्वजनिक चॅनेल्स, १:१ थेट संदेश, ऑनलाइन उपस्थिती स्थिती व फाइल देवाणघेवाण'
        : 'Public channels, 1:1 direct messages, presence indicators & attachment sharing'
    },
    {
      icon: Sparkles,
      title: selectedEdition === 'marathi' ? 'एआय कोपायलट सहाय्यक' : 'AI Copilot Assistant',
      desc: selectedEdition === 'marathi'
        ? 'नैसर्गिक संभाषणात्मक टास्क निर्मिती, उपस्थिती विश्लेषण व १-क्लिक जलद कृती'
        : 'Conversational task creation, attendance insights & 1-click quick actions'
    }
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
            Official Documentation & User Manuals
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            DailyTracker v2 Feature Guides & Docs Hub
          </h1>
          <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
            Access, view in-app, or download full user guides in both English and Marathi. Learn how to manage attendance, face setup, WFH requests, tasks, and manager approvals.
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
              href={`${activeGuide.pdfUrl}?download=true`}
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
              ? 'दैनिक ट्रॅकर v2 मुख्य घटक व वैशिष्ट्ये'
              : 'DailyTracker v2 Enterprise Architecture & Feature Matrix'}
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