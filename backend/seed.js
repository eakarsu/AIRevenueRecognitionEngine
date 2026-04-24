const pool = require('./db');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();

  try {
    console.log('Dropping existing tables...');
    await client.query(`
      DROP TABLE IF EXISTS audit_trail CASCADE;
      DROP TABLE IF EXISTS journal_entries CASCADE;
      DROP TABLE IF EXISTS invoices CASCADE;
      DROP TABLE IF EXISTS revenue_schedules CASCADE;
      DROP TABLE IF EXISTS performance_obligations CASCADE;
      DROP TABLE IF EXISTS contracts CASCADE;
      DROP TABLE IF EXISTS customers CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    console.log('Creating tables...');

    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        industry VARCHAR(100),
        contact_email VARCHAR(255),
        contact_phone VARCHAR(50),
        address TEXT,
        credit_rating VARCHAR(10),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE contracts (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        contract_number VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        start_date DATE,
        end_date DATE,
        total_value DECIMAL(15,2),
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','active','completed','terminated')),
        payment_terms TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE performance_obligations (
        id SERIAL PRIMARY KEY,
        contract_id INTEGER REFERENCES contracts(id),
        description TEXT NOT NULL,
        standalone_selling_price DECIMAL(15,2),
        allocated_price DECIMAL(15,2),
        satisfaction_method VARCHAR(20) DEFAULT 'over_time' CHECK (satisfaction_method IN ('over_time','point_in_time')),
        satisfaction_progress DECIMAL(5,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','satisfied')),
        start_date DATE,
        end_date DATE
      );

      CREATE TABLE revenue_schedules (
        id SERIAL PRIMARY KEY,
        contract_id INTEGER REFERENCES contracts(id),
        period_start DATE,
        period_end DATE,
        recognized_amount DECIMAL(15,2),
        deferred_amount DECIMAL(15,2),
        status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled','recognized','deferred','adjusted')),
        notes TEXT
      );

      CREATE TABLE journal_entries (
        id SERIAL PRIMARY KEY,
        entry_date DATE NOT NULL,
        description TEXT,
        debit_account VARCHAR(100),
        credit_account VARCHAR(100),
        amount DECIMAL(15,2),
        contract_id INTEGER REFERENCES contracts(id),
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','posted','reversed')),
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE invoices (
        id SERIAL PRIMARY KEY,
        contract_id INTEGER REFERENCES contracts(id),
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        issue_date DATE,
        due_date DATE,
        amount DECIMAL(15,2),
        paid_amount DECIMAL(15,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE audit_trail (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(50),
        entity_id INTEGER,
        action VARCHAR(50),
        changes JSONB,
        user_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('Tables created successfully.');

    // Seed default user
    console.log('Seeding users...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);
    await client.query(
      `INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)`,
      ['admin@revrec.com', passwordHash, 'Admin User', 'admin']
    );

    // Seed 15 customers
    console.log('Seeding customers...');
    const customers = [
      ['Vertex Cloud Solutions', 'Technology', 'contracts@vertexcloud.com', '(415) 555-0101', '100 Market St, San Francisco, CA 94105', 'AA'],
      ['MedCore Health Systems', 'Healthcare', 'billing@medcore.com', '(312) 555-0202', '200 N Michigan Ave, Chicago, IL 60601', 'A'],
      ['Pinnacle Financial Group', 'Finance', 'accounts@pinnaclefg.com', '(212) 555-0303', '1 Wall St, New York, NY 10005', 'AAA'],
      ['Atlas Manufacturing Inc', 'Manufacturing', 'procurement@atlasmfg.com', '(313) 555-0404', '500 Industrial Blvd, Detroit, MI 48201', 'BBB'],
      ['Horizon Energy Partners', 'Energy', 'contracts@horizonenergy.com', '(713) 555-0505', '800 Travis St, Houston, TX 77002', 'AA'],
      ['NovaTech Dynamics', 'Technology', 'legal@novatech.com', '(650) 555-0606', '2000 El Camino Real, Palo Alto, CA 94306', 'A'],
      ['BlueCross Medical Group', 'Healthcare', 'finance@bluecrossmed.com', '(617) 555-0707', '100 Longwood Ave, Boston, MA 02115', 'AA'],
      ['Ironclad Defense Systems', 'Defense', 'contracts@ironcladdef.com', '(703) 555-0808', '1500 Pentagon Dr, Arlington, VA 22202', 'AAA'],
      ['GreenLeaf Pharmaceuticals', 'Pharmaceuticals', 'ap@greenleafpharma.com', '(858) 555-0909', '3000 Science Park Rd, San Diego, CA 92121', 'A'],
      ['Pacific Retail Holdings', 'Retail', 'vendor@pacificretail.com', '(206) 555-1010', '400 Pine St, Seattle, WA 98101', 'BBB'],
      ['Summit Consulting Partners', 'Consulting', 'finance@summitcp.com', '(202) 555-1111', '1200 K St NW, Washington, DC 20005', 'A'],
      ['Quantum Data Analytics', 'Technology', 'billing@quantumdata.com', '(512) 555-1212', '600 Congress Ave, Austin, TX 78701', 'BB'],
      ['Coastal Insurance Corp', 'Insurance', 'accounts@coastalins.com', '(305) 555-1313', '100 Biscayne Blvd, Miami, FL 33131', 'AA'],
      ['Redwood Logistics Group', 'Logistics', 'ap@redwoodlog.com', '(404) 555-1414', '250 Peachtree St, Atlanta, GA 30303', 'BBB'],
      ['Sterling Aerospace Inc', 'Aerospace', 'contracts@sterlingaero.com', '(310) 555-1515', '1 Space Park Dr, Redondo Beach, CA 90278', 'AAA'],
    ];

    for (const c of customers) {
      await client.query(
        `INSERT INTO customers (name, industry, contact_email, contact_phone, address, credit_rating)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        c
      );
    }

    // Seed 20 contracts
    console.log('Seeding contracts...');
    const contracts = [
      [1, 'CTR-2025-001', 'Enterprise Cloud Platform License', 'Annual license for cloud platform with premium support and data migration services', '2025-01-01', '2025-12-31', 2500000.00, 'active', 'Net 30'],
      [1, 'CTR-2025-002', 'Cloud Infrastructure Upgrade', 'Infrastructure modernization and migration project', '2025-03-01', '2025-09-30', 875000.00, 'active', 'Net 45'],
      [2, 'CTR-2025-003', 'EHR System Implementation', 'Electronic health record system implementation with training', '2025-02-01', '2026-01-31', 3200000.00, 'active', 'Net 60'],
      [3, 'CTR-2025-004', 'Risk Analytics Platform', 'Financial risk analytics software subscription', '2025-01-15', '2026-01-14', 1800000.00, 'active', 'Net 30'],
      [4, 'CTR-2025-005', 'IoT Sensor Network Deployment', 'Manufacturing floor IoT sensor network installation', '2025-04-01', '2025-10-31', 650000.00, 'draft', 'Net 30'],
      [5, 'CTR-2025-006', 'Energy Management System', 'Smart grid energy management platform', '2024-07-01', '2025-06-30', 4100000.00, 'active', 'Net 45'],
      [6, 'CTR-2025-007', 'AI/ML Development Platform', 'Machine learning platform license with professional services', '2025-01-01', '2027-12-31', 5000000.00, 'active', 'Net 30'],
      [7, 'CTR-2025-008', 'Telemedicine Platform Rollout', 'Telemedicine infrastructure for 50 clinics', '2025-05-01', '2026-04-30', 1250000.00, 'draft', 'Net 60'],
      [8, 'CTR-2025-009', 'Secure Communications System', 'Encrypted communications platform for defense operations', '2024-10-01', '2026-09-30', 4750000.00, 'active', 'Net 30'],
      [9, 'CTR-2025-010', 'Clinical Trial Data Platform', 'Data management platform for Phase III clinical trials', '2025-02-15', '2026-08-15', 2100000.00, 'active', 'Net 45'],
      [10, 'CTR-2025-011', 'POS System Modernization', 'Point-of-sale system upgrade across 200 retail locations', '2025-03-01', '2025-12-31', 980000.00, 'active', 'Net 30'],
      [11, 'CTR-2025-012', 'Digital Transformation Advisory', 'Strategic consulting for digital transformation initiative', '2025-01-01', '2025-06-30', 450000.00, 'completed', 'Net 30'],
      [12, 'CTR-2025-013', 'Real-Time Analytics Engine', 'Custom analytics engine with dashboard development', '2025-04-01', '2025-11-30', 720000.00, 'draft', 'Net 45'],
      [13, 'CTR-2025-014', 'Claims Processing Automation', 'AI-driven insurance claims automation platform', '2024-11-01', '2025-10-31', 1650000.00, 'active', 'Net 30'],
      [14, 'CTR-2025-015', 'Supply Chain Visibility Platform', 'End-to-end supply chain tracking and optimization', '2025-02-01', '2026-01-31', 1100000.00, 'active', 'Net 45'],
      [15, 'CTR-2025-016', 'Avionics Software Suite', 'Next-gen avionics software development and certification', '2024-06-01', '2026-05-31', 3800000.00, 'active', 'Net 60'],
      [3, 'CTR-2025-017', 'Compliance Monitoring Dashboard', 'Regulatory compliance monitoring and reporting tool', '2025-03-15', '2025-09-15', 320000.00, 'active', 'Net 30'],
      [5, 'CTR-2025-018', 'Renewable Integration Module', 'Solar and wind energy integration with existing grid', '2025-06-01', '2026-05-31', 2200000.00, 'draft', 'Net 45'],
      [8, 'CTR-2025-019', 'Cybersecurity Assessment Suite', 'Comprehensive cybersecurity evaluation and remediation', '2024-12-01', '2025-05-31', 580000.00, 'completed', 'Net 30'],
      [2, 'CTR-2025-020', 'Patient Portal Enhancement', 'Patient-facing portal with mobile app development', '2025-04-15', '2025-12-15', 890000.00, 'active', 'Net 30'],
    ];

    for (const c of contracts) {
      await client.query(
        `INSERT INTO contracts (customer_id, contract_number, title, description, start_date, end_date, total_value, status, payment_terms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        c
      );
    }

    // Seed 30 performance obligations
    console.log('Seeding performance obligations...');
    const obligations = [
      [1, 'Software License - Enterprise Cloud Platform', 1500000.00, 1400000.00, 'point_in_time', 100.00, 'satisfied', '2025-01-01', '2025-12-31'],
      [1, 'Premium Support Services (12 months)', 600000.00, 650000.00, 'over_time', 75.00, 'in_progress', '2025-01-01', '2025-12-31'],
      [1, 'Data Migration Services', 400000.00, 450000.00, 'over_time', 90.00, 'in_progress', '2025-01-15', '2025-04-30'],
      [2, 'Infrastructure Assessment & Planning', 175000.00, 175000.00, 'point_in_time', 100.00, 'satisfied', '2025-03-01', '2025-04-15'],
      [2, 'Cloud Migration Execution', 500000.00, 500000.00, 'over_time', 60.00, 'in_progress', '2025-04-16', '2025-08-31'],
      [2, 'Post-Migration Support (3 months)', 200000.00, 200000.00, 'over_time', 0.00, 'pending', '2025-09-01', '2025-09-30'],
      [3, 'EHR Software License', 1200000.00, 1150000.00, 'point_in_time', 100.00, 'satisfied', '2025-02-01', '2026-01-31'],
      [3, 'Implementation & Configuration', 1400000.00, 1450000.00, 'over_time', 45.00, 'in_progress', '2025-02-01', '2025-11-30'],
      [3, 'Staff Training Program', 600000.00, 600000.00, 'over_time', 20.00, 'in_progress', '2025-08-01', '2026-01-31'],
      [4, 'Risk Analytics Software Subscription', 1200000.00, 1200000.00, 'over_time', 65.00, 'in_progress', '2025-01-15', '2026-01-14'],
      [4, 'Custom Report Development', 350000.00, 350000.00, 'point_in_time', 100.00, 'satisfied', '2025-01-15', '2025-03-31'],
      [4, 'Dedicated Support & Maintenance', 250000.00, 250000.00, 'over_time', 65.00, 'in_progress', '2025-01-15', '2026-01-14'],
      [6, 'Smart Grid Platform License', 2000000.00, 2000000.00, 'point_in_time', 100.00, 'satisfied', '2024-07-01', '2025-06-30'],
      [6, 'Grid Integration Services', 1500000.00, 1500000.00, 'over_time', 85.00, 'in_progress', '2024-07-01', '2025-03-31'],
      [6, 'Monitoring & Optimization (12 months)', 600000.00, 600000.00, 'over_time', 80.00, 'in_progress', '2024-07-01', '2025-06-30'],
      [7, 'ML Platform Core License (3 years)', 2500000.00, 2400000.00, 'over_time', 33.00, 'in_progress', '2025-01-01', '2027-12-31'],
      [7, 'Professional Services - Model Development', 1500000.00, 1500000.00, 'over_time', 25.00, 'in_progress', '2025-01-01', '2025-12-31'],
      [7, 'Training & Enablement', 500000.00, 550000.00, 'point_in_time', 0.00, 'pending', '2025-06-01', '2025-09-30'],
      [7, 'Annual Platform Updates', 500000.00, 550000.00, 'over_time', 10.00, 'in_progress', '2025-01-01', '2027-12-31'],
      [9, 'Encrypted Comm Platform License', 2000000.00, 2000000.00, 'point_in_time', 100.00, 'satisfied', '2024-10-01', '2026-09-30'],
      [9, 'Custom Security Integration', 1500000.00, 1500000.00, 'over_time', 55.00, 'in_progress', '2024-10-01', '2025-09-30'],
      [9, 'Ongoing Security Maintenance', 1250000.00, 1250000.00, 'over_time', 30.00, 'in_progress', '2025-01-01', '2026-09-30'],
      [10, 'Clinical Data Platform License', 1200000.00, 1200000.00, 'point_in_time', 100.00, 'satisfied', '2025-02-15', '2026-08-15'],
      [10, 'Data Integration & Validation', 600000.00, 600000.00, 'over_time', 40.00, 'in_progress', '2025-02-15', '2025-08-15'],
      [10, 'Regulatory Compliance Module', 300000.00, 300000.00, 'over_time', 35.00, 'in_progress', '2025-03-01', '2026-08-15'],
      [11, 'POS Hardware & Software Package', 580000.00, 580000.00, 'point_in_time', 50.00, 'in_progress', '2025-03-01', '2025-09-30'],
      [11, 'Installation & Configuration (200 sites)', 300000.00, 300000.00, 'over_time', 30.00, 'in_progress', '2025-04-01', '2025-11-30'],
      [11, 'Staff Training (200 sites)', 100000.00, 100000.00, 'over_time', 10.00, 'pending', '2025-09-01', '2025-12-31'],
      [14, 'Claims Automation Platform', 1000000.00, 1000000.00, 'over_time', 70.00, 'in_progress', '2024-11-01', '2025-10-31'],
      [14, 'AI Model Training & Deployment', 650000.00, 650000.00, 'over_time', 55.00, 'in_progress', '2024-12-01', '2025-06-30'],
    ];

    for (const o of obligations) {
      await client.query(
        `INSERT INTO performance_obligations (contract_id, description, standalone_selling_price, allocated_price, satisfaction_method, satisfaction_progress, status, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        o
      );
    }

    // Seed 25 revenue schedule entries
    console.log('Seeding revenue schedules...');
    const revenueSchedules = [
      [1, '2025-01-01', '2025-03-31', 625000.00, 1875000.00, 'recognized', 'Q1 2025 recognized - license and partial support/migration'],
      [1, '2025-04-01', '2025-06-30', 625000.00, 1250000.00, 'recognized', 'Q2 2025 recognized - ongoing support services'],
      [1, '2025-07-01', '2025-09-30', 625000.00, 625000.00, 'scheduled', 'Q3 2025 scheduled - support services'],
      [1, '2025-10-01', '2025-12-31', 625000.00, 0.00, 'scheduled', 'Q4 2025 scheduled - final support period'],
      [3, '2025-02-01', '2025-04-30', 800000.00, 2400000.00, 'recognized', 'Q1 2025 - EHR license delivery and initial implementation'],
      [3, '2025-05-01', '2025-07-31', 533333.33, 1866666.67, 'recognized', 'Q2 2025 - ongoing implementation work'],
      [3, '2025-08-01', '2025-10-31', 533333.33, 1333333.34, 'scheduled', 'Q3 2025 - implementation and training begin'],
      [3, '2025-11-01', '2026-01-31', 533333.34, 800000.00, 'scheduled', 'Q4 2025 - implementation completion and training'],
      [4, '2025-01-15', '2025-04-14', 450000.00, 1350000.00, 'recognized', 'Period 1 - subscription and custom reports delivered'],
      [4, '2025-04-15', '2025-07-14', 450000.00, 900000.00, 'recognized', 'Period 2 - ongoing subscription and support'],
      [4, '2025-07-15', '2025-10-14', 450000.00, 450000.00, 'scheduled', 'Period 3 - subscription and support'],
      [4, '2025-10-15', '2026-01-14', 450000.00, 0.00, 'scheduled', 'Period 4 - final subscription period'],
      [6, '2024-07-01', '2024-09-30', 1025000.00, 3075000.00, 'recognized', 'Q3 2024 - platform license and initial integration'],
      [6, '2024-10-01', '2024-12-31', 1025000.00, 2050000.00, 'recognized', 'Q4 2024 - integration and monitoring services'],
      [6, '2025-01-01', '2025-03-31', 1025000.00, 1025000.00, 'recognized', 'Q1 2025 - integration completion and monitoring'],
      [6, '2025-04-01', '2025-06-30', 1025000.00, 0.00, 'scheduled', 'Q2 2025 - final monitoring period'],
      [7, '2025-01-01', '2025-06-30', 833333.33, 4166666.67, 'recognized', 'H1 2025 - platform license and professional services'],
      [7, '2025-07-01', '2025-12-31', 833333.33, 3333333.34, 'scheduled', 'H2 2025 - training, services, and updates'],
      [9, '2024-10-01', '2025-03-31', 1187500.00, 3562500.00, 'recognized', 'H1 - platform license and integration work'],
      [9, '2025-04-01', '2025-09-30', 1187500.00, 2375000.00, 'scheduled', 'H2 - integration and maintenance'],
      [10, '2025-02-15', '2025-08-14', 1050000.00, 1050000.00, 'recognized', 'Period 1 - license, integration, compliance module'],
      [10, '2025-08-15', '2026-08-15', 1050000.00, 0.00, 'scheduled', 'Period 2 - remaining obligations'],
      [11, '2025-03-01', '2025-06-30', 245000.00, 735000.00, 'recognized', 'Q1-Q2 - initial hardware/software rollout'],
      [11, '2025-07-01', '2025-09-30', 245000.00, 490000.00, 'scheduled', 'Q3 - continued rollout and installation'],
      [11, '2025-10-01', '2025-12-31', 490000.00, 0.00, 'scheduled', 'Q4 - final installation and training'],
    ];

    for (const rs of revenueSchedules) {
      await client.query(
        `INSERT INTO revenue_schedules (contract_id, period_start, period_end, recognized_amount, deferred_amount, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        rs
      );
    }

    // Seed 20 journal entries
    console.log('Seeding journal entries...');
    const journalEntries = [
      ['2025-01-01', 'Revenue recognition - Vertex Cloud Platform License (point in time)', 'Accounts Receivable', 'Revenue - Software License', 1400000.00, 1, 'posted', 'Admin User'],
      ['2025-01-01', 'Deferred revenue setup - Vertex Cloud Support Services', 'Accounts Receivable', 'Deferred Revenue', 650000.00, 1, 'posted', 'Admin User'],
      ['2025-01-15', 'Deferred revenue setup - Vertex Data Migration', 'Accounts Receivable', 'Deferred Revenue', 450000.00, 1, 'posted', 'Admin User'],
      ['2025-01-31', 'Monthly support revenue recognition - January', 'Deferred Revenue', 'Revenue - Support Services', 54166.67, 1, 'posted', 'Admin User'],
      ['2025-02-01', 'Revenue recognition - MedCore EHR License', 'Accounts Receivable', 'Revenue - Software License', 1150000.00, 3, 'posted', 'Admin User'],
      ['2025-02-01', 'Deferred revenue - MedCore Implementation', 'Accounts Receivable', 'Deferred Revenue', 2050000.00, 3, 'posted', 'Admin User'],
      ['2025-02-15', 'Revenue recognition - Pinnacle Risk Analytics custom reports', 'Accounts Receivable', 'Revenue - Professional Services', 350000.00, 4, 'posted', 'Admin User'],
      ['2025-02-28', 'Monthly support revenue recognition - February', 'Deferred Revenue', 'Revenue - Support Services', 54166.67, 1, 'posted', 'Admin User'],
      ['2025-03-01', 'Infrastructure assessment completed - Vertex Cloud', 'Accounts Receivable', 'Revenue - Professional Services', 175000.00, 2, 'posted', 'Admin User'],
      ['2025-03-15', 'Quarterly subscription recognition - Pinnacle', 'Deferred Revenue', 'Revenue - Subscription', 300000.00, 4, 'posted', 'Admin User'],
      ['2025-03-31', 'Monthly data migration revenue - March', 'Deferred Revenue', 'Revenue - Professional Services', 150000.00, 1, 'posted', 'Admin User'],
      ['2025-03-31', 'Q1 implementation revenue - MedCore EHR', 'Deferred Revenue', 'Revenue - Implementation Services', 362500.00, 3, 'posted', 'Admin User'],
      ['2025-04-01', 'Payment received - Vertex Cloud Q1 invoice', 'Cash', 'Accounts Receivable', 625000.00, 1, 'posted', 'Admin User'],
      ['2025-04-15', 'Monthly cloud migration revenue - April', 'Deferred Revenue', 'Revenue - Professional Services', 100000.00, 2, 'posted', 'Admin User'],
      ['2025-04-30', 'Monthly support revenue recognition - April', 'Deferred Revenue', 'Revenue - Support Services', 54166.67, 1, 'posted', 'Admin User'],
      ['2025-05-15', 'Payment received - MedCore EHR Q1 invoice', 'Cash', 'Accounts Receivable', 800000.00, 3, 'posted', 'Admin User'],
      ['2025-05-31', 'Monthly cloud migration revenue - May', 'Deferred Revenue', 'Revenue - Professional Services', 100000.00, 2, 'draft', 'Admin User'],
      ['2025-06-15', 'Quarterly subscription recognition - Pinnacle Q2', 'Deferred Revenue', 'Revenue - Subscription', 300000.00, 4, 'draft', 'Admin User'],
      ['2025-06-30', 'H1 platform revenue - NovaTech ML Platform', 'Deferred Revenue', 'Revenue - Software License', 400000.00, 7, 'draft', 'Admin User'],
      ['2025-06-30', 'Accrued revenue - NovaTech Professional Services', 'Contract Asset', 'Revenue - Professional Services', 375000.00, 7, 'draft', 'Admin User'],
    ];

    for (const je of journalEntries) {
      await client.query(
        `INSERT INTO journal_entries (entry_date, description, debit_account, credit_account, amount, contract_id, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        je
      );
    }

    // Seed 18 invoices
    console.log('Seeding invoices...');
    const invoices = [
      [1, 'INV-2025-001', '2025-01-01', '2025-01-31', 625000.00, 625000.00, 'paid'],
      [1, 'INV-2025-002', '2025-04-01', '2025-05-01', 625000.00, 625000.00, 'paid'],
      [1, 'INV-2025-003', '2025-07-01', '2025-07-31', 625000.00, 0.00, 'sent'],
      [1, 'INV-2025-004', '2025-10-01', '2025-10-31', 625000.00, 0.00, 'draft'],
      [3, 'INV-2025-005', '2025-02-01', '2025-04-02', 800000.00, 800000.00, 'paid'],
      [3, 'INV-2025-006', '2025-05-01', '2025-06-30', 800000.00, 400000.00, 'sent'],
      [3, 'INV-2025-007', '2025-08-01', '2025-09-30', 800000.00, 0.00, 'draft'],
      [4, 'INV-2025-008', '2025-01-15', '2025-02-14', 450000.00, 450000.00, 'paid'],
      [4, 'INV-2025-009', '2025-04-15', '2025-05-15', 450000.00, 450000.00, 'paid'],
      [4, 'INV-2025-010', '2025-07-15', '2025-08-14', 450000.00, 0.00, 'sent'],
      [6, 'INV-2025-011', '2024-07-01', '2024-07-31', 1025000.00, 1025000.00, 'paid'],
      [6, 'INV-2025-012', '2024-10-01', '2024-10-31', 1025000.00, 1025000.00, 'paid'],
      [6, 'INV-2025-013', '2025-01-01', '2025-01-31', 1025000.00, 1025000.00, 'paid'],
      [6, 'INV-2025-014', '2025-04-01', '2025-04-30', 1025000.00, 0.00, 'overdue'],
      [9, 'INV-2025-015', '2024-10-01', '2024-10-31', 1187500.00, 1187500.00, 'paid'],
      [9, 'INV-2025-016', '2025-04-01', '2025-04-30', 1187500.00, 500000.00, 'sent'],
      [7, 'INV-2025-017', '2025-01-01', '2025-01-31', 833333.33, 833333.33, 'paid'],
      [7, 'INV-2025-018', '2025-07-01', '2025-07-31', 833333.33, 0.00, 'draft'],
    ];

    for (const inv of invoices) {
      await client.query(
        `INSERT INTO invoices (contract_id, invoice_number, issue_date, due_date, amount, paid_amount, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        inv
      );
    }

    // Seed 15 audit trail entries
    console.log('Seeding audit trail...');
    const auditEntries = [
      ['contract', 1, 'created', { title: 'Enterprise Cloud Platform License', total_value: 2500000 }, 1],
      ['contract', 1, 'status_changed', { old_status: 'draft', new_status: 'active' }, 1],
      ['contract', 3, 'created', { title: 'EHR System Implementation', total_value: 3200000 }, 1],
      ['performance_obligation', 1, 'satisfied', { description: 'Software License - Enterprise Cloud Platform', progress: 100 }, 1],
      ['invoice', 1, 'payment_received', { invoice_number: 'INV-2025-001', amount: 625000, payment_amount: 625000 }, 1],
      ['journal_entry', 1, 'posted', { description: 'Revenue recognition - Vertex Cloud Platform License', amount: 1400000 }, 1],
      ['contract', 6, 'created', { title: 'Energy Management System', total_value: 4100000 }, 1],
      ['performance_obligation', 7, 'satisfied', { description: 'EHR Software License', progress: 100 }, 1],
      ['invoice', 5, 'payment_received', { invoice_number: 'INV-2025-005', amount: 800000, payment_amount: 800000 }, 1],
      ['contract', 7, 'created', { title: 'AI/ML Development Platform', total_value: 5000000 }, 1],
      ['revenue_schedule', 1, 'recognized', { period: 'Q1 2025', amount: 625000 }, 1],
      ['contract', 12, 'status_changed', { old_status: 'active', new_status: 'completed' }, 1],
      ['invoice', 14, 'status_changed', { old_status: 'sent', new_status: 'overdue', invoice_number: 'INV-2025-014' }, 1],
      ['performance_obligation', 4, 'satisfied', { description: 'Infrastructure Assessment & Planning', progress: 100 }, 1],
      ['contract', 9, 'created', { title: 'Secure Communications System', total_value: 4750000 }, 1],
    ];

    for (const ae of auditEntries) {
      await client.query(
        `INSERT INTO audit_trail (entity_type, entity_id, action, changes, user_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [ae[0], ae[1], ae[2], JSON.stringify(ae[3]), ae[4]]
      );
    }

    console.log('Seed completed successfully!');
    console.log('Default login: admin@revrec.com / password123');

  } catch (err) {
    console.error('Seed error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
