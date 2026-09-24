import fs from 'fs';
import m2s from 'mongoose-to-swagger';
import Converter from 'openapi-to-postmanv2';

import { User, StaffMember, SavedItem } from '../src/models/User.js';
import { SeekerProfile, HirerAccount, Candidate } from '../src/models/Profiles.js';
import { Opportunity, Applicant, Event, Grant, GrantApplication, CompanyVerification, VerificationDoc, EventAttendee } from '../src/models/Platform.js';
import { Channel, ChannelPost, Report } from '../src/models/Community.js';
import { Article, Notification } from '../src/models/Content.js';

const models = [
  { name: 'User', model: User, path: 'users' },
  { name: 'StaffMember', model: StaffMember, path: 'staff' },
  { name: 'SeekerProfile', model: SeekerProfile, path: 'seekers' },
  { name: 'HirerAccount', model: HirerAccount, path: 'hirers' },
  { name: 'Opportunity', model: Opportunity, path: 'opportunities' },
  { name: 'Applicant', model: Applicant, path: 'applicants' },
  { name: 'Event', model: Event, path: 'events' },
  { name: 'Grant', model: Grant, path: 'grants' },
  { name: 'GrantApplication', model: GrantApplication, path: 'grant-applications' },
  { name: 'CompanyVerification', model: CompanyVerification, path: 'verification/companies' },
  { name: 'VerificationDoc', model: VerificationDoc, path: 'verification/documents' },
  { name: 'Channel', model: Channel, path: 'community/channels' },
  { name: 'ChannelPost', model: ChannelPost, path: 'community/posts' },
  { name: 'Report', model: Report, path: 'reports' },
  { name: 'Article', model: Article, path: 'articles' },
  { name: 'Notification', model: Notification, path: 'notifications' },
  { name: 'SavedItem', model: SavedItem, path: 'saved' }
];

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Kredibble API',
    version: '1.0.0',
    description: 'Auto-generated API documentation for Kredibble backend'
  },
  servers: [{ url: 'http://localhost:4000/api' }],
  components: {
    schemas: {},
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  security: [{ bearerAuth: [] }],
  paths: {}
};

for (const { name, model, path } of models) {
  const schema = m2s(model);
  swaggerSpec.components.schemas[name] = schema;

  // Add paths for collection routes
  swaggerSpec.paths[`/${path}`] = {
    get: {
      summary: `List ${name}s`,
      tags: [name],
      responses: {
        200: {
          description: 'A list of records',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: `#/components/schemas/${name}` } }
            }
          }
        }
      }
    },
    post: {
      summary: `Create a ${name}`,
      tags: [name],
      requestBody: {
        content: { 'application/json': { schema: { $ref: `#/components/schemas/${name}` } } }
      },
      responses: {
        201: { description: 'Created' }
      }
    }
  };

  swaggerSpec.paths[`/${path}/{id}`] = {
    get: {
      summary: `Get a ${name}`,
      tags: [name],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Record found' } }
    },
    patch: {
      summary: `Update a ${name}`,
      tags: [name],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        content: { 'application/json': { schema: { $ref: `#/components/schemas/${name}` } } }
      },
      responses: { 200: { description: 'Updated' } }
    },
    delete: {
      summary: `Delete a ${name}`,
      tags: [name],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Deleted' } }
    }
  };
}

fs.writeFileSync('src/swagger.json', JSON.stringify(swaggerSpec, null, 2));
console.log('Generated src/swagger.json');

Converter.convert({ type: 'json', data: swaggerSpec }, {}, (err, conversionResult) => {
  if (err) {
    console.error(err);
  } else if (!conversionResult.result) {
    console.error('Could not convert', conversionResult.reason);
  } else {
    fs.writeFileSync('kredibble-postman-collection.json', JSON.stringify(conversionResult.output[0].data, null, 2));
    console.log('Generated kredibble-postman-collection.json');
  }
});
