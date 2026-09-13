import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BCE Faculty Feedback Portal | Bhagalpur College of Engineering',
  description: 'Official Faculty Feedback & Evaluation Management System for Bhagalpur College of Engineering (BCE BGP), Government of Bihar.',
  keywords: ['BCE', 'BCE Bhagalpur', 'Faculty Feedback', 'Student Evaluation', 'Engineering College Bihar'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen flex flex-col antialiased bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
