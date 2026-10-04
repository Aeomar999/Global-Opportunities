/**
 * Reference data: the dropdown lists the mobile app shows, grouped the way the admin edits them.
 *
 * Seeker lists are seeded from kredibble-app/src/app/(auth)/signup.tsx, hirer lists from the same
 * file, and grants lists from kredibble-app/src/app/grants/filter.tsx. In the app they are hardcoded
 * arrays, so today they can only change with a code deploy; the admin edits an in-memory copy.
 *
 * Every list has an explicit `singular` ("university") used in the add field's placeholder, so the
 * wording never comes from chopping an "s" off the plural ("universitie").
 */
export type ReferenceGroupKey = "seeker" | "hirer" | "grants";

export interface ReferenceList {
  key: string;
  /** Tab and card title: "Universities" */
  label: string;
  /** One item, lower case, for sentences and placeholders: "university" */
  singular: string;
  items: string[];
}

export interface ReferenceGroup {
  key: ReferenceGroupKey;
  /** Top-level control label: "Seekers" */
  label: string;
  /** One line under the page title when this group is open */
  description: string;
  lists: ReferenceList[];
}

export const REFERENCE_GROUPS: ReferenceGroup[] = [
  {
    key: "seeker",
    label: "Seekers",
    description: "Reference lists shown as dropdowns during Seeker signup and profile editing.",
    lists: [
      {
        key: "universities",
        label: "Universities",
        singular: "university",
        items: [
          "Ashesi University", "Cairo University", "Cambridge University", "Columbia University",
          "Harvard University", "Johns Hopkins University", "Kwame Nkrumah University of Science and Technology",
          "London School of Economics", "Makerere University", "MIT", "National University of Singapore",
          "Oxford University", "Princeton University", "Stanford University", "University of Cape Town",
          "University of Ghana", "University of Lagos", "University of Nairobi", "University of Sydney",
          "University of Toronto", "Yale University",
        ],
      },
      {
        key: "programs",
        label: "Programs",
        singular: "program",
        items: [
          "Accounting", "Agriculture", "Architecture", "Business Administration", "Chemical Engineering",
          "Civil Engineering", "Computer Science", "Data Science", "Economics", "Education",
          "Electrical Engineering", "Environmental Science", "Finance", "Information Technology",
          "International Relations", "Law", "Marketing", "Mathematics", "Mechanical Engineering",
          "Medicine", "Nursing", "Pharmacy", "Psychology", "Public Health", "Software Engineering",
        ],
      },
      {
        key: "skills",
        label: "Skills",
        singular: "skill",
        items: [
          "Data Analysis", "Project Management", "Digital Marketing", "Public Speaking", "Content Writing",
          "Graphic Design", "Financial Literacy", "Critical Thinking", "Team Collaboration", "Communication",
          "Leadership", "Problem Solving", "Time Management", "Research & Analysis", "Microsoft Excel",
          "Python Programming", "JavaScript", "SQL", "UI/UX Design", "Video Editing", "Negotiation",
          "Customer Service", "Event Planning", "Fundraising",
        ],
      },
      {
        key: "career-interests",
        label: "Career Interests",
        singular: "career interest",
        items: [
          "Software Engineering", "Investment Banking", "Public Health", "Agribusiness Management",
          "Corporate Law", "Human Resource Management", "Data Science", "Supply Chain Logistics",
          "Renewable Energy Engineering", "Architecture & Urban Planning", "Education & Training",
          "Medical Research", "International Development", "Environmental Engineering", "Entrepreneurship",
          "Digital Marketing", "Finance & Accounting", "Journalism & Media", "Public Policy", "Social Work",
        ],
      },
    ],
  },
  {
    key: "hirer",
    label: "Hirers",
    description: "Reference lists shown as dropdowns during Hirer signup and company profile editing.",
    lists: [
      {
        key: "industries",
        label: "Industries",
        singular: "industry",
        items: [
          "Technology", "Education", "Finance", "Healthcare", "Marketing",
          "Nonprofit/NGO", "Government", "Media", "Agriculture", "Other",
        ],
      },
      {
        key: "company-sizes",
        label: "Company Sizes",
        singular: "company size",
        items: [
          "1–10 employees", "11–50 employees", "51–200 employees",
          "201–500 employees", "500–1,000 employees", "1,000+ employees",
        ],
      },
      {
        key: "position-roles",
        label: "Position Roles",
        singular: "position role",
        items: [
          "HR Manager", "Recruiter", "Talent Acquisition Specialist", "Hiring Manager",
          "Program Coordinator", "Founder/CEO", "Operations Manager",
          "University Representative", "Internship Coordinator", "Other",
        ],
      },
    ],
  },
  {
    key: "grants",
    label: "Grants",
    description: "Reference lists shown as filters and dropdowns in the Grants section of the app.",
    lists: [
      {
        key: "sectors",
        label: "Sectors",
        singular: "sector",
        items: [
          "Administration", "Advocacy", "Agriculture and rural development", "Border management",
          "Civic engineering", "Community development & NGO", "Culture & arts", "Education",
          "Environment", "Health", "Human rights", "Humanitarian aid", "Infrastructure",
          "Legal & governance", "Media & communications", "Peacebuilding", "Water & sanitation",
        ],
      },
      {
        key: "applicant-types",
        label: "Applicant Types",
        singular: "applicant type",
        items: [
          "NGOs / nonprofit organization", "Government / public bodies", "Academic institution",
          "Private sector", "Unrestricted / unspecific", "Individuals", "Others",
        ],
      },
      {
        key: "funding-agencies",
        label: "Funding Agencies",
        singular: "funding agency",
        items: [
          "AF - adaptation fund", "Alliance - alliance for public health",
          "Academic institution", "Others",
        ],
      },
    ],
  },
];

/** A list with more than this many items gets a search box. */
export const SEARCH_THRESHOLD = 12;
