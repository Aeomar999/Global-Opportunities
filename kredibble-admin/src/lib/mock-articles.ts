/**
 * Mock data for Career Resources CMS.
 * Mirrors the Article shape hardcoded in
 * kredibble-app/src/app/career-resources/index.tsx — that component bakes
 * 3 articles directly into the source, so publishing a new one today
 * requires a code deploy. This models what an admin-managed version
 * of that same content would look like.
 */

export type ArticleStatus = 'published' | 'draft';

export interface Article {
  id: string;
  category: string;
  title: string;
  duration: string;
  summary: string;
  content: string;
  status: ArticleStatus;
  bannerImage?: string;
}

export const articles: Article[] = [
  {
    id: 'article-1',
    category: 'Resume Writing',
    title: 'How to write a developer resume that gets noticed',
    duration: '5 min read',
    summary:
      'Learn key formatting guidelines, action verbs, and structural details that make your engineering resume stand out to recruiters.',
    content:
      'Writing a great software developer resume is about demonstrating impact, not just listing technologies. Recruiters spend an average of 6 seconds scanning a CV. Here are key strategies to make your resume stand out:\n\n1. Keep it Concise\nLimit your resume to 1-2 pages maximum.\n\n2. Focus on Impact\nUse the Action-Result format and quantify your accomplishments.\n\n3. Match Job Keywords\nTailor your skills section to include language directly from the job description.\n\n4. Link Projects & Portfolios\nEnsure your GitHub and portfolio are updated and hyperlinked.',
    status: 'published',
    bannerImage: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'article-2',
    category: 'Interview Prep',
    title: 'Mastering behavioral interviews: The STAR Method',
    duration: '8 min read',
    summary:
      'A complete walkthrough of the Situation, Task, Action, and Result framework to successfully answer behavioral questions.',
    content:
      'Behavioral interview questions are designed to predict future performance based on past actions. The STAR method is the gold standard for structuring answers: Situation, Task, Action, Result. Practice beforehand by preparing 4-5 core stories that can adapt to different themes.',
    status: 'published',
  },
  {
    id: 'article-3',
    category: 'Career Planning',
    title: 'Top 10 skills for Product Designers in 2026',
    duration: '4 min read',
    summary:
      'Discover the essential soft and technical skills required to remain competitive as a modern UI/UX and product designer.',
    content:
      'The landscape of digital design is evolving rapidly. Focus on mastering: advanced prototyping, design systems governance, business and product strategy, and design tokens/code literacy.',
    status: 'published',
  },
  {
    id: 'article-4',
    category: 'Grants & Funding',
    title: 'A founder\'s guide to writing a winning grant application',
    duration: '6 min read',
    summary:
      'What grant reviewers actually look for, and the most common reasons early-stage applications get rejected.',
    content:
      'Grant reviewers see hundreds of applications. Be specific about the problem, show traction (even informal), and be realistic about your budget request. Avoid vague impact claims without a measurement plan.',
    status: 'draft',
  },
];
