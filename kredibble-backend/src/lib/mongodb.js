import mongoose from 'mongoose';
import { env } from '../config/env.js';
import logger from './logger.js';

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
    logger.info({ uri: maskMongoUri(uri) }, 'Successfully connected to MongoDB via Mongoose');
    return mongoose.connection;
  } catch (err) {
    const hint = getConnectionErrorHint(err);
    logger.error({ error: err.message, hint }, 'Mongoose connection error');
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
import { Channel, ChannelPost, Report } from '../models/Community.js';
import { Article, Notification } from '../models/Content.js';

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
  Notification
};
