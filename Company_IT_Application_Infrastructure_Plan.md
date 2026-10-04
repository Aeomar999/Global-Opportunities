# Company IT Application Infrastructure Plan

## 1. Purpose

The goal is to establish a centralized application infrastructure and DevOps platform that allows the IT department to securely develop, deploy, monitor, maintain, and scale all current and future company software products.

The first applications to run on this platform will be:

- **GOD (Global Opportunity Desk)**
- **BexieMart**
- Future applications and platforms

This is an application/engineering infrastructure plan, not an employee office-IT plan.

---

## 2. Target Architecture

```text
                         COMPANY IT / ENGINEERING
                                  |
                    +-------------+-------------+
                    |                           |
              IT Management              Developer Platform
                    |                           |
          +---------+---------+        +--------+--------+
          |         |         |        |        |        |
       Identity   Security   Access   Git     CI/CD   Monitoring
                                      |
                              +-------+--------+
                              |                |
                             GOD           BexieMart
                              |                |
                  +-----------+---+    +-------+--------+
                  |           |   |    |       |        |
               Next.js      API  DB  Next.js   API      DB
               Dashboard    |    |  Dashboard   |       |
                  |         |    |      |       |       |
             React Native  MongoDB React Native |     Neon
                  |        Atlas      |          |
              WordPress               |       Backend
```

---

## 3. Core Infrastructure Areas

| Area | What IT manages |
|---|---|
| Cloud Accounts | Vercel, Hostinger, MongoDB Atlas, Neon, Cloudflare and other providers |
| Source Control | GitHub/GitLab organization, repositories, permissions and branch policies |
| CI/CD | Automated testing, builds, deployments and rollback procedures |
| Application Hosting | VPSs, Vercel projects, WordPress and APIs |
| Databases | MongoDB, PostgreSQL, backups, access control and migrations |
| Security | MFA, secrets, API keys, firewalls, WAF and access policies |
| Monitoring | Errors, uptime, logs, performance and alerts |
| Documentation | Architecture, deployment procedures, credentials ownership and disaster recovery |

---

## 4. Centralized Company Platform

GOD and BexieMart should not be treated as completely independent infrastructure projects.

The company should establish a reusable platform:

```text
                    COMPANY CLOUD ORGANIZATION
                              |
             +----------------+----------------+
             |                                 |
          PROJECTS                         SHARED SERVICES
             |                                 |
      +------+-------+                 +-------+---------+
      |              |                 |       |         |
     GOD         BexieMart           GitHub Cloudflare Monitoring
      |              |
   MongoDB          Neon
      |              |
    APIs            APIs
      |              |
   Vercel          Vercel
```

This allows IT to create a standard infrastructure pattern for every new application.

---

## 5. Standard Architecture for Future Applications

Every new application should follow a repeatable template:

```text
Project
├── Git repository
├── Development environment
├── Staging environment
├── Production environment
├── Database
├── API/backend
├── Frontend
├── Mobile application (if required)
├── Secrets/configuration
├── Monitoring
├── Backups
└── Documentation
```

This reduces the need to redesign infrastructure whenever a new product is launched.

---

## 6. Environment Strategy

The company should maintain three primary environments:

### Development

Used by developers for active development and experimentation.

### Staging

Used for testing releases before production.

### Production

The live environment used by customers and business operations.

Recommended deployment flow:

```text
Developer
    |
    v
GitHub
    |
    v
Development
    |
    v
Automated Tests
    |
    v
Staging
    |
    v
Approval
    |
    v
Production
```

Developers should not normally make direct changes to production.

---

## 7. Phase 1 — Infrastructure Foundation

### Objectives

Establish the core accounts, ownership, access controls and infrastructure standards.

### Tasks

- Create a company GitHub/GitLab organization
- Establish company ownership of all cloud accounts
- Establish Vercel organization
- Establish Hostinger infrastructure
- Establish Cloudflare organization
- Establish MongoDB Atlas organization
- Establish Neon organization
- Establish domain management
- Enable MFA on all administrative accounts
- Create role-based access
- Establish secrets management
- Document account ownership and recovery procedures

### Key principle

Company infrastructure should not depend on a developer's personal account.

---

## 8. Phase 2 — Deployment Platform

Implement standardized deployment processes.

### Required capabilities

- Development deployments
- Staging deployments
- Production deployments
- Automated tests
- CI/CD pipelines
- Environment variables and secrets
- Deployment approvals
- Rollbacks
- Database migration procedures
- Release documentation

---

## 9. Phase 3 — Operations

The IT department should establish centralized operational visibility.

### Monitoring

Monitor:

- Application uptime
- API availability
- Database availability
- Server resources
- Application errors
- API latency
- Deployment failures
- SSL certificate status
- Domain/DNS status

### Logging

Centralize or standardize:

- Application logs
- API logs
- Authentication/security events
- Deployment logs
- Server logs

### Alerts

Important events should generate alerts for the responsible IT/development personnel.

---

## 10. Phase 4 — Security

Security should be built into the platform rather than added later.

### Minimum controls

- MFA for administrative accounts
- Role-based access control
- Least-privilege permissions
- Separate development/staging/production credentials
- Secure secrets management
- No credentials committed to Git repositories
- HTTPS everywhere
- Cloudflare DNS/WAF where appropriate
- Server firewall
- Regular dependency updates
- Database access restrictions
- Audit logging where available
- Backup and recovery procedures

---

## 11. Phase 5 — Backup and Disaster Recovery

Each production application should have a documented recovery strategy.

### Backups

Maintain backups for:

- Production databases
- Important application data
- WordPress data
- Configuration
- Critical infrastructure documentation

### Recovery planning

Document:

- What is backed up
- Backup frequency
- Retention period
- Where backups are stored
- Who can restore them
- Recovery procedures
- Expected recovery time

The IT department should periodically test restoration rather than assuming backups work.

---

## 12. GOD Infrastructure

GOD should initially use:

```text
GOD
|
+-- WordPress website
|      |
|      +-- Hostinger
|
+-- Next.js dashboard
|      |
|      +-- Vercel
|
+-- React Native mobile application
|      |
|      +-- Communicates with GOD API
|
+-- Backend/API
|      |
|      +-- Hostinger VPS
|
+-- Database
|      |
|      +-- MongoDB Atlas
|
+-- DNS/Security
       |
       +-- Cloudflare
```

---

## 13. BexieMart Infrastructure

BexieMart should initially use:

```text
BexieMart
|
+-- Next.js dashboard
|      |
|      +-- Vercel
|
+-- React Native mobile application
|      |
|      +-- Communicates with BexieMart API
|
+-- Backend/API
|      |
|      +-- Hostinger VPS
|
+-- Database
|      |
|      +-- Neon PostgreSQL
|
+-- DNS/Security
       |
       +-- Cloudflare
```

---

## 14. Shared Infrastructure Strategy

Initially, both backend/API services can share a sufficiently sized Hostinger VPS.

```text
                    Hostinger VPS
                         |
             +-----------+-----------+
             |                       |
        GOD Backend            BexieMart Backend
             |                       |
             v                       v
       MongoDB Atlas             Neon PostgreSQL
```

The databases remain separate.

As traffic, security requirements, or operational complexity increases, the applications can be moved to separate infrastructure.

This allows the company to start economically while retaining a path to scale.

---

## 15. Domain Strategy

Domains should be owned and managed centrally by the company.

Each product can have its own primary domain.

Example:

```text
GOD
globalopportunitydesk.com
app.globalopportunitydesk.com
api.globalopportunitydesk.com

BexieMart
bexiemart.com
app.bexiemart.com
api.bexiemart.com
```

The exact domain names should be confirmed before procurement.

Separate domains are not required for every application component.

---

## 16. IT Department Responsibilities

The IT department should own:

- Cloud accounts
- Domain registration
- DNS
- Infrastructure
- Database administration
- Deployment systems
- Access control
- Secrets management
- Monitoring
- Backups
- Disaster recovery
- Security policies
- Infrastructure documentation
- Vendor management
- Incident response

Developers should have the access necessary to build and deploy applications without automatically receiving unrestricted production access.

---

## 17. Recommended Access Model

Use role-based access such as:

### IT Administrator

Full infrastructure administration.

### DevOps / Infrastructure Engineer

Infrastructure, CI/CD, monitoring and deployment administration.

### Backend Developer

Backend development and appropriate deployment permissions.

### Frontend Developer

Frontend development and appropriate deployment permissions.

### Database Administrator

Database administration and backup/recovery responsibilities.

### Management

Reporting and approval access where appropriate.

---

## 18. Recommended 90-Day Rollout

### Days 1–30 — Foundation

- Establish company cloud accounts
- Establish GitHub organization
- Establish Cloudflare
- Establish Vercel
- Establish Hostinger
- Establish MongoDB Atlas
- Establish Neon
- Configure MFA
- Define roles
- Establish domain ownership
- Document infrastructure

### Days 31–60 — Deployment

- Create development environments
- Create staging environments
- Create production environments
- Build CI/CD pipelines
- Establish automated testing
- Configure secrets
- Configure deployment approvals
- Establish rollback procedures

### Days 61–90 — Operations

- Implement monitoring
- Implement logging
- Configure alerts
- Establish backups
- Test database restoration
- Document disaster recovery
- Standardize incident response
- Finalize infrastructure templates for future projects

---

## 19. Long-Term Goal

The goal is to create a reusable **Company Application Platform**.

When the company starts Project #3, Project #4 or Project #5, IT should be able to provision the infrastructure using an established standard rather than designing everything from scratch.

The long-term model should be:

```text
                    COMPANY IT PLATFORM
                           |
        +------------------+------------------+
        |                  |                  |
       GOD            BexieMart          Future App 3
        |                  |                  |
     Standard           Standard           Standard
   Infrastructure     Infrastructure     Infrastructure
        |                  |                  |
        +------------------+------------------+
                           |
                    Shared IT Standards
                           |
        +------------------+------------------+
        |        |        |        |          |
      Git      CI/CD   Security  Monitoring  Backup
```

## 20. Management Summary

The company should not approach this as simply purchasing hosting for GOD and BexieMart.

The recommended strategy is to establish a **centralized, secure and reusable application infrastructure platform** owned by the IT department.

GOD and BexieMart become the first two products deployed on that platform.

This approach provides:

- Centralized ownership
- Consistent security
- Controlled access
- Repeatable deployments
- Easier monitoring
- Reliable backups
- Better disaster recovery
- Lower initial infrastructure costs
- Easier onboarding of future applications
- A clear path from startup-scale infrastructure to larger production infrastructure

The immediate objective is therefore to establish the **platform and standards first**, then deploy GOD and BexieMart using those standards.
