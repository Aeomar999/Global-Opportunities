import { useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

// Sample editorial content until a news API exists.
export type NewsCategory = 'Careers' | 'Scholarships' | 'Events' | 'Tech';

export interface NewsArticle {
  id: string;
  category: NewsCategory;
  title: string;
  summary: string;
  author: string;
  date: string;
  readMinutes: number;
  body: string[];
}

export const NEWS_CATEGORIES: NewsCategory[] = ['Careers', 'Scholarships', 'Events', 'Tech'];

export const NEWS: NewsArticle[] = [
  {
    id: 'n1',
    category: 'Careers',
    title: 'How to write a CV that gets past automated screening',
    summary: 'Recruiters now use software to shortlist applicants. Here is how to make sure your CV is read by a person.',
    author: 'Ama Boateng',
    date: 'Oct 8, 2026',
    readMinutes: 5,
    body: [
      'Many employers now use applicant tracking software to sort applications before a person ever opens them. The good news is that a clear, honest CV is also the easiest for these tools to read.',
      'Start with a simple layout. Use standard headings such as Experience, Education and Skills, avoid text boxes and tables, and save the file as a PDF unless the posting asks for something else.',
      'Mirror the language of the job description. If the role asks for "stakeholder reporting" and you have done that work, use those words instead of a different phrase for the same thing.',
      'Lead each bullet with an action and finish with a result. "Cut onboarding time from ten days to six" says far more than "responsible for onboarding".',
      'Finally, keep it to one or two pages and read it aloud before you send it. Typos are still the quickest way to lose a shortlist spot.',
    ],
  },
  {
    id: 'n2',
    category: 'Scholarships',
    title: 'Five things to prepare before a scholarship deadline',
    summary: 'Referees, transcripts and essays take longer than you expect. Start with this checklist.',
    author: 'Kojo Mensah',
    date: 'Oct 8, 2026',
    readMinutes: 4,
    body: [
      'Most scholarship applications are decided by the quality of the supporting documents, not the form itself. Starting early gives your referees and your school time to respond.',
      'Ask your referees at least three weeks ahead, and give them your CV, the scholarship description and the date it is due.',
      'Request official transcripts as soon as you decide to apply, since some institutions take several working days to issue them.',
      'Draft your personal statement around one clear story. Panels read hundreds of essays, and a specific example is remembered long after a list of achievements.',
      'Submit a day early. Portals slow down in the final hours, and a missed upload is the most avoidable way to lose an application.',
    ],
  },
  {
    id: 'n3',
    category: 'Events',
    title: 'Networking at a career fair when you are new to it',
    summary: 'A short plan for introductions, follow-ups and making the most of a busy room.',
    author: 'Efua Asante',
    date: 'Oct 7, 2026',
    readMinutes: 3,
    body: [
      'Career fairs can feel loud and rushed, but a little preparation changes the day. Pick five organisations you really want to speak to and read about them first.',
      'Prepare a ten-second introduction: your name, what you study or do, and the kind of role you are looking for.',
      'Ask one specific question at each stand, for example which skills the team is hiring for right now. It leads to a better conversation than asking whether they are hiring.',
      'Write down names and one detail from each conversation straight afterwards, and send a short thank-you message within two days.',
    ],
  },
  {
    id: 'n4',
    category: 'Tech',
    title: 'Learning to code while working full time',
    summary: 'Small daily sessions beat weekend marathons. A realistic routine for busy people.',
    author: 'Yaw Owusu',
    date: 'Oct 7, 2026',
    readMinutes: 6,
    body: [
      'You do not need a free year to start a technical career. Thirty focused minutes a day, kept up for six months, adds up to more than most bootcamps cover in class time.',
      'Pick one language and one small project. A budget tracker or a personal website is enough, as long as you finish it and put it somewhere others can see.',
      'Learn in public. Share what you built and what went wrong, because hiring managers value evidence of progress more than certificates.',
      'Find a study partner or an online community so that a bad week does not turn into a quit.',
    ],
  },
  {
    id: 'n5',
    category: 'Careers',
    title: 'Negotiating your first salary offer with confidence',
    summary: 'Research the range, know your priorities and ask for time. A calm approach works best.',
    author: 'Ama Boateng',
    date: 'Oct 6, 2026',
    readMinutes: 4,
    body: [
      'Your first offer is rarely the final one, and most employers expect a polite conversation about it.',
      'Research the typical range for the role and location using several sources, and decide beforehand the lowest package you would accept.',
      'Thank them, ask for a day or two to review, and reply with a specific figure and a reason, such as your skills or the scope of the role.',
      'If the salary cannot move, consider asking about learning budget, flexible hours or a review after six months.',
    ],
  },
  {
    id: 'n6',
    category: 'Scholarships',
    title: 'Writing a personal statement that sounds like you',
    summary: 'Panels remember honest, specific writing. Here is how to avoid the usual clichés.',
    author: 'Kojo Mensah',
    date: 'Oct 5, 2026',
    readMinutes: 5,
    body: [
      'The strongest personal statements read like a conversation with one thoughtful person, not a speech to a room.',
      'Open with a moment, not a mission statement. A short scene from your own experience tells the reader who you are faster than a list of adjectives.',
      'Connect that moment to what you plan to do next, and to why this particular programme is the right place to do it.',
      "Cut every sentence that could appear in anyone else's essay, then ask a friend to read it and tell you which line sounds least like you.",
    ],
  },
];

export const getArticle = (id: string) => NEWS.find(n => n.id === id);

// Bookmarks are kept on the device (article ids only).
const STORE_KEY = 'savedNewsIds';
const saved = new Set<string>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

SecureStore.getItemAsync(STORE_KEY)
  .then(raw => {
    if (!raw) return;
    const ids = JSON.parse(raw);
    if (Array.isArray(ids)) { ids.forEach(i => saved.add(String(i))); notify(); }
  })
  .catch(() => {});

const persist = () => { SecureStore.setItemAsync(STORE_KEY, JSON.stringify([...saved])).catch(() => {}); };

export function useSavedArticles() {
  const [, bump] = useState(0);
  useEffect(() => {
    const sync = () => bump(n => n + 1);
    listeners.add(sync);
    return () => { listeners.delete(sync); };
  }, []);
  return NEWS.filter(n => saved.has(n.id));
}

export function useNewsSaved(id: string | undefined) {
  const [isSaved, setIsSaved] = useState(id ? saved.has(id) : false);

  useEffect(() => {
    if (!id) return;
    const sync = () => setIsSaved(saved.has(id));
    listeners.add(sync);
    return () => { listeners.delete(sync); };
  }, [id]);

  const toggle = useCallback(() => {
    if (!id) return false;
    if (saved.has(id)) saved.delete(id); else saved.add(id);
    persist();
    notify();
    return saved.has(id);
  }, [id]);

  return [isSaved, toggle] as const;
}

export const initialsOf = (name: string) =>
  name.split(' ').map(p => p.charAt(0)).join('').slice(0, 2).toUpperCase();
