export interface WorkExperience {
  role: string;
  company: string;
  location: string;
  duration: string;
  bullets: string[];
}

export interface Education {
  degree: string;
  institution: string;
  duration: string;
}

export interface Project {
  name: string;
  bullets: string[];
}

export interface Expert {
  id: string;
  name: string;
  profession: string;
  verified: boolean;
  website: string;
  location: string;
  country: string;
  city: string;
  email: string;
  phone: string;
  rating: number;
  image: string;
  bio: string;
  professionalSummary: string;
  technicalSkills: string[];
  softSkills: string[];
  workExperience: WorkExperience[];
  education: Education[];
  projects: Project[];
  certifications: string[];
  tools: string[];
  experienceLevel: 'Beginner' | 'Entry Level' | 'Intermediate' | 'Senior';
  resumeUrl?: string;
}

export const mockExperts: Expert[] = [
  {
    id: '1',
    name: 'Enoch Mensah',
    profession: 'Software Developer',
    verified: true,
    website: 'EnochMensah.com',
    location: 'Accra, Ghana',
    country: 'Ghana',
    city: 'Accra',
    email: 'Enochmensah@',
    phone: '+23350728334',
    rating: 5.0,
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400',
    bio: 'Experienced software developer specializing in user-friendly mobile and web experiences.',
    professionalSummary: 'i am a curious and detail-oriented Software Developer with strong visual design skills, user-centered approach to building digital products. Passionate about creating intuitive, responsive, and visually engaging web and mobile experiences that solve real-world problems. Skilled in UI/UX design, front-end development, wireframing, prototyping, and collaborating with cross-functional teams to deliver high-quality solutions.',
    technicalSkills: ['HTML5', 'CSS3', 'JavaScript', 'React', 'Bootstrap', 'Figma'],
    softSkills: ['Problem Solving', 'Team Collaboration', 'Communication', 'Creativity', 'Attention to Detail', 'Time Management', 'Critical Thinking'],
    workExperience: [
      {
        role: 'UI/UX Designer',
        company: 'Ogabassey',
        location: 'Accra, Ghana',
        duration: '2022 – Present',
        bullets: [
          'Designed the company\'s e-commerce website and mobile application.',
          'Improved user engagement through optimized call-to-action placement, increasing customer satisfaction by 30%.',
          'Developed interactive prototypes and wireframes based on user feedback, reducing bounce rates by 15%.',
          'Collaborated with developers to implement responsive and user-friendly interfaces across platforms.',
          'Improved mobile responsiveness, increasing mobile traffic and user retention.'
        ]
      }
    ],
    education: [
      {
        degree: 'Bachelor of Science in Computer Science',
        institution: 'University of Ghana',
        duration: '2022 – 2024'
      }
    ],
    projects: [
      {
        name: 'Blockchain Digital Inheritance System',
        bullets: [
          'Designed a modern Web3 platform for securely transferring digital assets to heirs.',
          'Created user flows, wireframes, and high-fidelity UI designs in Figma.',
          'Focused on wallet integration and secure user experience.'
        ]
      }
    ],
    certifications: [
      'Google UX Design Certificate',
      'Meta Front-End Developer Certificate',
      'Coursera/Udemy certifications'
    ],
    tools: ['Figma', 'VS Code', 'GitHub', 'Notion'],
    experienceLevel: 'Senior'
  },
  {
    id: '2',
    name: 'Kwame Boateng',
    profession: 'Frontend Developer',
    verified: true,
    website: 'kboateng.dev',
    location: 'Luanda, Angola',
    country: 'Angola',
    city: 'Luanda',
    email: 'kboateng@',
    phone: '+24491234567',
    rating: 4.0,
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400',
    bio: 'Passionate frontend developer crafting responsive user interfaces and smooth user interactions.',
    professionalSummary: 'Highly skilled Frontend Developer with a focus on building scalable web interfaces using React and modern CSS. Dedicated to clean code and delivering robust designs that delight users.',
    technicalSkills: ['HTML5', 'CSS3', 'TypeScript', 'React', 'Tailwind', 'Next.js'],
    softSkills: ['Teamwork', 'Detail-oriented', 'Agile Methodologies', 'Effective Communication'],
    workExperience: [
      {
        role: 'Junior Frontend Developer',
        company: 'AngolaTech',
        location: 'Luanda, Angola',
        duration: '2023 – Present',
        bullets: [
          'Developed responsive layout designs for major regional clients.',
          'Optimized app components resulting in a 20% performance boost.'
        ]
      }
    ],
    education: [
      {
        degree: 'Diploma in Web Development',
        institution: 'Luanda Institute of Technology',
        duration: '2021 – 2023'
      }
    ],
    projects: [
      {
        name: 'Local Marketplace App',
        bullets: [
          'Created a responsive frontend for localized trading products.',
          'Integrated secure map API for locating nearest vendors.'
        ]
      }
    ],
    certifications: [
      'freeCodeCamp Responsive Web Design',
      'Scrimba React Developer Certification'
    ],
    tools: ['VS Code', 'GitHub', 'Figma'],
    experienceLevel: 'Entry Level'
  },
  {
    id: '3',
    name: 'Ama Osei',
    profession: 'Backend Developer',
    verified: false,
    website: 'amaosei.io',
    location: 'Cotonou, Benin',
    country: 'Benin',
    city: 'Cotonou',
    email: 'amaosei@',
    phone: '+22998765432',
    rating: 3.0,
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=400',
    bio: 'Backend developer focused on database optimization, secure REST APIs, and microservices.',
    professionalSummary: 'Reliable backend developer with strong foundations in Node.js, Express, and databases. Specialized in scaling database queries and optimizing server response times.',
    technicalSkills: ['Node.js', 'Express', 'MongoDB', 'PostgreSQL', 'Docker', 'AWS'],
    softSkills: ['Analytical Thinking', 'Problem Solving', 'Self-motivation', 'Time Management'],
    workExperience: [
      {
        role: 'Backend Assistant',
        company: 'Benin Cloud Services',
        location: 'Cotonou, Benin',
        duration: '2023 – Present',
        bullets: [
          'Designed databases and configured API endpoints for secure web applications.',
          'Reduced API latency by 12% through indexing and query optimizations.'
        ]
      }
    ],
    education: [
      {
        degree: 'B.Sc. in Computer Science',
        institution: 'National University of Benin',
        duration: '2020 – 2023'
      }
    ],
    projects: [
      {
        name: 'Logistics Tracker REST API',
        bullets: [
          'Built microservices to monitor cargo statuses in real-time.',
          'Configured automatic server scaling via Docker.'
        ]
      }
    ],
    certifications: [
      'AWS Certified Developer Associate'
    ],
    tools: ['Postman', 'VS Code', 'GitHub', 'Slack'],
    experienceLevel: 'Intermediate'
  },
  {
    id: '4',
    name: 'Sarah Connor',
    profession: 'Ui ux dsigner',
    verified: true,
    website: 'sarahdesigns.com',
    location: 'Brazzaville, Congo',
    country: 'Congo',
    city: 'Brazzaville',
    email: 'sarahconnor@',
    phone: '+24205123456',
    rating: 5.0,
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=400',
    bio: 'Creative designer making modern user experiences and interactive high-fidelity prototypes.',
    professionalSummary: 'Passionate UI/UX Designer aiming to construct aesthetically pleasing and high-fidelity interface layouts. Highly experienced with Figma, wireframing, and user research methodologies.',
    technicalSkills: ['Figma', 'Adobe XD', 'Illustrator', 'Wireframing', 'Prototyping', 'User Research'],
    softSkills: ['Creativity', 'Attention to Detail', 'User Empathy', 'Storytelling'],
    workExperience: [
      {
        role: 'Lead UI/UX Designer',
        company: 'Congo Tech Hub',
        location: 'Brazzaville, Congo',
        duration: '2021 – Present',
        bullets: [
          'Led user research and created complete application prototypes for major utility clients.',
          'Standardized design system UI tokens across web and mobile platforms.'
        ]
      }
    ],
    education: [
      {
        degree: 'B.A. in Graphic Design & UX',
        institution: 'Academy of Fine Arts Brazzaville',
        duration: '2017 – 2021'
      }
    ],
    projects: [
      {
        name: 'Fintech App Redesign',
        bullets: [
          'Redesigned digital wallet client onboarding flows to increase conversion rates by 40%.',
          'Conducted remote user testing with 50+ participants.'
        ]
      }
    ],
    certifications: [
      'Google UX Design Professional Certificate'
    ],
    tools: ['Figma', 'Adobe Creative Cloud', 'Miro', 'Jira'],
    experienceLevel: 'Senior'
  },
  {
    id: '5',
    name: 'Michael Mensah',
    profession: 'Cybersecurity specialist',
    verified: true,
    website: 'mensahsec.io',
    location: 'Algiers, Algeria',
    country: 'Algeria',
    city: 'Algiers',
    email: 'mmensah@',
    phone: '+21377012345',
    rating: 4.0,
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400',
    bio: 'Dedicated cybersecurity specialist focusing on threat detection, network defense, and compliance.',
    professionalSummary: 'Experienced Security Analyst safeguarding system architectures against remote vulnerabilities. Proven records in configuring active firewalls and performing penetration testing.',
    technicalSkills: ['Network Security', 'Firewalls', 'Penetration Testing', 'Linux', 'Python', 'Cryptography'],
    softSkills: ['Critical Thinking', 'Patience', 'Observation', 'Risk Management'],
    workExperience: [
      {
        role: 'Security Analyst',
        company: 'Algeria DefSec',
        location: 'Algiers, Algeria',
        duration: '2022 – Present',
        bullets: [
          'Conducted network penetration tests and identified key critical vulnerabilities.',
          'Authored threat incident response guidelines used by 100+ engineers.'
        ]
      }
    ],
    education: [
      {
        degree: 'B.Sc. in Network Security & Cybersecurity',
        institution: 'Algiers Technical University',
        duration: '2019 – 2022'
      }
    ],
    projects: [
      {
        name: 'Automated Log Analyzer',
        bullets: [
          'Developed a Python utility to parse system logs and flag anomalous requests automatically.',
          'Integrated with Slack API to push instant alerts on brute force detections.'
        ]
      }
    ],
    certifications: [
      'CompTIA Security+',
      'Certified Ethical Hacker (CEH)'
    ],
    tools: ['Wireshark', 'Metasploit', 'Nmap', 'Burp Suite', 'VS Code'],
    experienceLevel: 'Intermediate'
  }
];

export const professions = [
  'Software developer',
  'Frontend developer',
  'Backend developer',
  'Ui ux dsigner', // preserved design typo
  'Graphic designer',
  'Cybersecurity specialist',
  'Ethical hacker'
];

export const experienceLevels = [
  { label: 'Beginner', icon: 'Sprout' },
  { label: 'Entry Level', icon: 'Lightbulb' },
  { label: 'Intermediate', icon: 'Leaf' },
  { label: 'Senior', icon: 'Crown' }
];

export const ratingOptions = [
  { label: '1.0', value: 1.0 },
  { label: '2.0', value: 2.0 },
  { label: '3.0', value: 3.0 },
  { label: '4.0', value: 4.0 },
  { label: '5.0', value: 5.0 }
];

export const countries = [
  'Algeria',
  'Angola',
  'Benin',
  'Congo',
  'Ghana'
];
