import Image from 'next/image';
import { GraduationCap, ShieldCheck, School, ArrowDown, ExternalLink } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#f0f7ff] via-white to-slate-50/90 border-b border-slate-200/80">
      {/* Subtle decorative background ambient accents */}
      <div 
        className="absolute top-0 left-1/4 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl pointer-events-none -z-10"
        aria-hidden="true" 
      />
      <div 
        className="absolute bottom-0 right-1/3 w-[500px] h-[300px] bg-amber-50/40 rounded-full blur-3xl pointer-events-none -z-10"
        aria-hidden="true" 
      />

      {/* Main hero container */}
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 items-center md:items-end min-h-[520px] md:min-h-[560px] lg:min-h-[600px] xl:min-h-[640px] gap-6 md:gap-4 lg:gap-6">
          
          {/* Left Column: Semantic Content */}
          <div className="md:col-span-7 lg:col-span-7 xl:col-span-7 flex flex-col justify-center py-6 sm:py-8 md:py-8 lg:py-10 z-10 max-w-[650px]">
            
            {/* Hero Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-amber-50 border border-amber-200/90 text-amber-900 text-xs sm:text-sm font-semibold shadow-xs mb-3 sm:mb-4 w-fit">
              <GraduationCap className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Student Anonymous Evaluation System</span>
            </div>

            {/* Main Heading - Compact, crisp & authoritative */}
            <h2 className="tracking-tight">
              <span className="block text-2xl sm:text-3xl md:text-[32px] lg:text-[40px] xl:text-[46px] font-extrabold text-bce-navy leading-[1.12]">
                BCE Faculty Feedback Portal
              </span>
              <span className="block text-lg sm:text-xl md:text-[20px] lg:text-[25px] xl:text-[29px] font-bold text-bce-cobalt mt-1 sm:mt-1.5 leading-tight">
                Bhagalpur College of Engineering
              </span>
            </h2>

            {/* Supporting Text */}
            <p className="text-slate-600 text-[13.5px] sm:text-[15px] lg:text-[16.5px] leading-relaxed mt-3 sm:mt-3.5 max-w-xl">
              Official BCE faculty feedback portal. Students can anonymously select their academic session, branch and semester to access published feedback forms.
            </p>

            {/* Benefit Cards: 3 horizontal on desktop, compact on tablet/mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-2.5 lg:gap-3 mt-5 sm:mt-6 w-full">
              {/* Card 1: 100% Anonymous */}
              <div className="p-2.5 sm:p-3 bg-white/95 backdrop-blur-xs rounded-xl border border-slate-200/90 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all flex items-start gap-2.5 group">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-100 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-[12.5px] font-bold text-slate-900 leading-snug">
                    100% Anonymous
                  </p>
                  <p className="text-[10.5px] sm:text-[11.5px] text-slate-500 leading-tight mt-0.5">
                    No student credentials required
                  </p>
                </div>
              </div>

              {/* Card 2: Direct Impact */}
              <div className="p-2.5 sm:p-3 bg-white/95 backdrop-blur-xs rounded-xl border border-slate-200/90 shadow-xs hover:border-blue-300 hover:shadow-sm transition-all flex items-start gap-2.5 group">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 text-bce-cobalt flex items-center justify-center shrink-0 mt-0.5 border border-blue-100 group-hover:scale-105 transition-transform">
                  <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-[12.5px] font-bold text-slate-900 leading-snug">
                    Direct Impact
                  </p>
                  <p className="text-[10.5px] sm:text-[11.5px] text-slate-500 leading-tight mt-0.5">
                    Improve teaching and learning
                  </p>
                </div>
              </div>

              {/* Card 3: All Departments */}
              <div className="p-2.5 sm:p-3 bg-white/95 backdrop-blur-xs rounded-xl border border-slate-200/90 shadow-xs hover:border-amber-300 hover:shadow-sm transition-all flex items-start gap-2.5 group">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5 border border-amber-100 group-hover:scale-105 transition-transform">
                  <School className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-[12.5px] font-bold text-slate-900 leading-snug">
                    All Departments
                  </p>
                  <p className="text-[10.5px] sm:text-[11.5px] text-slate-500 leading-tight mt-0.5">
                    CSE, CE, ME, EE, ECE
                  </p>
                </div>
              </div>
            </div>

            {/* Discovery Link / Pathway CTA */}
            <div className="mt-5 sm:mt-6">
              <a
                href="#discovery-section"
                className="inline-flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-[13.5px] font-semibold text-bce-cobalt hover:text-bce-navy group transition-colors focus:outline-hidden focus:ring-2 focus:ring-bce-cobalt/40 rounded-lg py-1 px-1.5 -mx-1.5"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-bce-cobalt group-hover:scale-125 transition-transform shrink-0" />
                <span className="font-bold text-slate-900">Find Your Feedback Form</span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <span className="text-slate-500 font-medium text-xs sm:text-[12.5px] flex items-center gap-1">
                  <span>Year</span>
                  <span className="text-slate-300">→</span>
                  <span>Branch</span>
                  <span className="text-slate-300">→</span>
                  <span>Semester</span>
                  <span className="text-slate-300">→</span>
                  <span>Faculty & Subject</span>
                </span>
                <ArrowDown className="w-3.5 h-3.5 text-bce-cobalt group-hover:translate-y-0.5 transition-transform shrink-0 ml-0.5" />
              </a>
            </div>
          </div>

          {/* Right Column: Visual Composite (Campus + Aditya Portrait) */}
          <div className="md:col-span-5 lg:col-span-5 xl:col-span-5 relative w-full flex items-end justify-center md:justify-end">
            {/* Soft subtle left edge blend overlay on medium/large screens */}
            <div 
              className="hidden md:block absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white/90 via-white/40 to-transparent pointer-events-none z-10" 
              aria-hidden="true" 
            />

            <div className="relative w-full flex flex-col items-center md:items-end justify-end">
              <Image
                src="/bce-hero-portrait.png"
                alt="Aditya Kumar Sah at Bhagalpur College of Engineering Campus - Developed by Aditya Kumar Sah"
                width={952}
                height={818}
                priority
                sizes="(min-width: 1280px) 520px, (min-width: 1024px) 440px, (min-width: 768px) 340px, 100vw"
                className="w-auto h-auto max-h-[300px] sm:max-h-[360px] md:max-h-[460px] lg:max-h-[540px] xl:max-h-[600px] object-contain object-bottom select-none pointer-events-none drop-shadow-xs"
              />
              <a
                href="https://portfolio-two-ashen-zseywond41.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 hover:bg-white text-slate-800 hover:text-bce-cobalt text-xs font-semibold backdrop-blur-md border border-slate-200 shadow-md transition-all hover:scale-105"
                title="Developed by Aditya Kumar Sah - View Portfolio"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Aditya Kumar Sah</span>
                <span className="text-[11px] text-slate-500 font-normal hidden sm:inline">• Developer</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
