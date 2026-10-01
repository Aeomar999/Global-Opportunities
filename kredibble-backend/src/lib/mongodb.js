import mongoose from 'mongoose';
import { env } from '../config/env.js';

const uri = env.databaseUrl;

const maskMongoUri = (value) => value.replace(/(mongodb(?:\+srv)?:\/\/[^:\s]+:)[^@\s]+@/i, '$1***@');

const getConnectionErrorHint = (error) => {
  if (error?.message?.includes('queryTxt ETIMEOUT')) {
    return 'Atlas SRV DNS TXT lookup timed out. Use the Atlas standard mongodb:// connection string, or try another DNS/network.';
  }

  if (error?.message?.includes('bad auth') || error?.message?.includes('Authentication failed')) {
    return 'Check the Atlas database username and password in your MongoDB connection string.';
  }

  if (error?.message?.includes('IP') || error?.message?.includes('whitelist')) {
    return 'Check that your current IP address is allowed in Atlas Network Access.';
  }

  return null;
};

export async function connectToDatabase() {
  if (mongoose.connection.readyState >= 1) return mongoose.connection;
  if (!uri) {
    throw new Error('Missing MongoDB connection string. Set DATABASE_URL, MONGODB_URI, or MONGO_URI in kredibble-backend/.env.');
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      dbName: 'kredibble',
    });
    console.log(`Successfully connected to MongoDB via Mongoose: ${maskMongoUri(uri)}`);
    return mongoose.connection;
  } catch (err) {
    const hint = getConnectionErrorHint(err);
    console.error('Mongoose connection error:', hint ? `${err.message}. ${hint}` : err.message);
    throw err;
  }
}

export const getDb = () => mongoose.connection.db;

// Re-exporting all models
import { User, StaffMember } from '../models/User.js';
import { SeekerProfile, HirerAccount, Candidate } from '../models/Profiles.js';
import {
  Opportunity, Applicant, Event, Grant,
  GrantApplication, CompanyVerification, VerificationDoc
} from '../models/Platform.js';
import { Channel, ChannelPost, CommunityMembership, Report } from '../models/Community.js';
import { Article, Notification } from '../models/Content.js';
import { Program, Partner, Ambassador, AmbassadorAmplification, Beneficiary, SocialPost, OpportunityEngagement, MonthlyTarget, Testimonial, AdminActivity } from '../models/AdminPortal.js';

export const models = {
  User,
  StaffMember,
  SeekerProfile,
  HirerAccount,
  Candidate,
  Opportunity,
  Applicant,
  Event,
  Grant,
  GrantApplication,
  CompanyVerification,
  VerificationDoc,
  Channel,
  ChannelPost,
  Report,
  Article,
  Notification,
  CommunityMembership,
  Program,
  Partner,
  Ambassador,
  AmbassadorAmplification,
  Beneficiary,
  SocialPost,
  OpportunityEngagement,
  MonthlyTarget,
  Testimonial,
  AdminActivity,
};
