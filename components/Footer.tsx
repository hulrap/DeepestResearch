import Link from "next/link";

interface FooterProps {
  tFooter: (key: string) => string;
}

export function Footer({ tFooter }: FooterProps) {
  return (
    <footer className="w-full flex justify-center items-center p-4 sm:p-6 text-sm text-purple-400 mt-auto bg-slate-900/50 backdrop-blur-sm border-t border-slate-800/50 footer-mobile-safe touch-manipulation">
      <div className="flex flex-col md:flex-row items-center gap-3 sm:gap-4 md:gap-8 text-center max-w-4xl w-full">
        <span className="order-2 md:order-1 text-xs sm:text-sm">{tFooter('copyright')}</span>
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4 md:gap-6 order-1 md:order-2">
          <Link href="/imprint" className="hover:text-purple-300 transition-colors whitespace-nowrap text-xs sm:text-sm touch-manipulation">{tFooter('imprint')}</Link>
          <Link href="/cookie-policy" className="hover:text-purple-300 transition-colors whitespace-nowrap text-xs sm:text-sm touch-manipulation">{tFooter('cookiePolicy')}</Link>
          <Link href="/privacy-policy" className="hover:text-purple-300 transition-colors whitespace-nowrap text-xs sm:text-sm touch-manipulation">{tFooter('privacyPolicy')}</Link>
          <Link href="/contact" className="hover:text-purple-300 transition-colors whitespace-nowrap text-xs sm:text-sm touch-manipulation">{tFooter('contact')}</Link>
          <Link href="/partners" className="hover:text-purple-300 transition-colors whitespace-nowrap text-xs sm:text-sm touch-manipulation">{tFooter('partners')}</Link>
        </div>
      </div>
    </footer>
  );
} 