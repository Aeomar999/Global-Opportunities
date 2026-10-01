import { connectToDatabase, models } from '../src/lib/mongodb.js';

const collectionNames = {
  User: 'users',
  StaffMember: 'staffmembers',
  SeekerProfile: 'seekerprofiles',
  HirerAccount: 'hireraccounts',
  Candidate: 'candidates',
  Opportunity: 'opportunities',
  Applicant: 'applicants',
  Event: 'events',
  Grant: 'grants',
  GrantApplication: 'grantapplications',
  CompanyVerification: 'companyverifications',
  VerificationDoc: 'verificationdocs',
  Channel: 'channels',
  ChannelPost: 'channelposts',
  CommunityMembership: 'communitymemberships',
  Report: 'reports',
  Article: 'articles',
  Notification: 'notifications',
  Program: 'programs',
  Partner: 'partners',
  Ambassador: 'ambassadors',
  AmbassadorAmplification: 'ambassadoramplifications',
  Beneficiary: 'beneficiaries',
  SocialPost: 'socialposts',
  OpportunityEngagement: 'opportunityengagements',
  MonthlyTarget: 'monthlytargets',
  Testimonial: 'testimonials',
  AdminActivity: 'adminactivities',
};

async function initDatabase() {
  await connectToDatabase();

  for (const [modelName, Model] of Object.entries(models)) {
    await Model.createCollection();
    await Model.syncIndexes();
    console.log(`Ready: ${modelName} -> ${collectionNames[modelName] || Model.collection.name}`);
  }

  console.log('MongoDB Atlas schema initialization complete.');
}

initDatabase()
  .catch((error) => {
    console.error('MongoDB Atlas schema initialization failed:');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const mongoose = await import('mongoose');
    await mongoose.default.disconnect();
  });
