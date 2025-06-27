'use client'

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Bot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function Footer() {
  const t = useTranslations('footer');

  const productLinks = [
    { href: '/#features', label: t('features') },
    { href: '/#pricing', 'label': t('pricing') },
    { href: '/dashboard', 'label': t('dashboard') },
    { href: '/docs', 'label': t('documentation') },
  ];

  const companyLinks = [
    { href: '/about', label: t('about') },
    { href: '/blog', label: t('blog') },
    { href: '/contact', label: t('contact') },
    { href: '/partners', label: t('partners') },
  ];

  const legalLinks = [
    { href: '/privacy-policy', label: t('privacyPolicy') },
    { href: '/cookie-policy', label: t('cookiePolicy') },
    { href: '/imprint', label: t('imprint') },
  ];
  
  const socialLinks = [
    { href: '#', label: 'Twitter' },
    { href: '#', label: 'LinkedIn' },
    { href: '#', label: 'GitHub' },
  ];

  return (
    <footer className="border-t bg-background/80 backdrop-blur">
      <div className="container max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo and mission */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center space-x-2">
              <Bot className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">DeepResearch</span>
            </Link>
            <p className="text-muted-foreground text-sm">{t('mission')}</p>
          </div>

          {/* Links */}
          <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div>
              <h3 className="text-sm font-semibold tracking-wider uppercase">{t('product')}</h3>
              <ul className="mt-4 space-y-2">
                {productLinks.map(link => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-wider uppercase">{t('company')}</h3>
              <ul className="mt-4 space-y-2">
                {companyLinks.map(link => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-wider uppercase">{t('legal')}</h3>
              <ul className="mt-4 space-y-2">
                {legalLinks.map(link => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Newsletter */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold tracking-wider uppercase">{t('stayUpdated')}</h3>
            <p className="text-muted-foreground text-sm">{t('newsletterPrompt')}</p>
            <form className="flex space-x-2">
              <Input type="email" placeholder={t('emailPlaceholder')} className="flex-1" />
              <Button type="submit">{t('subscribe')}</Button>
            </form>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t flex flex-col sm:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} DeepResearch, Inc. {t('copyright')}</p>
          <div className="flex space-x-4 mt-4 sm:mt-0">
            {socialLinks.map(link => (
              <Link key={link.label} href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
} 