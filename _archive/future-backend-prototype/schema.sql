CREATE TABLE IF NOT EXISTS property (
  id INTEGER PRIMARY KEY,
  name TEXT, fha_section8_no TEXT,
  address_street TEXT, address_city TEXT, address_state TEXT, address_zip TEXT,
  entity_name TEXT, entity_type TEXT,
  signatory_name TEXT, signatory_title TEXT,
  owner_poc_name TEXT, owner_poc_phone TEXT, owner_poc_email TEXT,
  ca_org TEXT, ca_contact_name TEXT, ca_contact_title TEXT, ca_contact_prefix TEXT,
  ca_address_street TEXT, ca_address_city_state_zip TEXT,
  tenant_sender_name TEXT, tenant_sender_title TEXT,
  letterhead_asset TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS unit_type (
  id INTEGER PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES property(id),
  type_label TEXT, num_units INTEGER,
  revenue_producing INTEGER DEFAULT 1, nonrev_use TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS principal (
  id INTEGER PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES property(id),
  name TEXT, title TEXT, sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS partb_item (
  id INTEGER PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES property(id),
  section TEXT NOT NULL,            -- 'equipment' | 'utility' | 'service'
  label TEXT NOT NULL,
  checked INTEGER DEFAULT 0,
  fuel TEXT,                        -- utilities only: E / G / F
  is_writein INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS partE_commercial (
  id INTEGER PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES property(id),
  description TEXT, monthly_rent REAL, sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS submission (
  id INTEGER PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES property(id),
  program_type TEXT, adjustment_type TEXT, hap_reference TEXT,
  submission_date TEXT, date_rents_effective TEXT,
  sign_date TEXT, tenant_date_of_notice TEXT,
  rcs_report_asset TEXT, prior_rs_asset TEXT,
  appraiser_name TEXT, appraiser_firm TEXT,
  appraiser_address_street TEXT, appraiser_address_city_state_zip TEXT,
  appraiser_email TEXT, appraiser_phone TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS unit_cycle_value (
  id INTEGER PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submission(id),
  unit_type_id INTEGER NOT NULL REFERENCES unit_type(id),
  current_contract_rent REAL, proposed_contract_rent REAL,
  ua_from_exec_rs REAL, ua_from_rcs REAL,
  safmr_from_rcs REAL, safmr_from_hud REAL,
  UNIQUE(submission_id, unit_type_id)
);

CREATE TABLE IF NOT EXISTS partC_charge (
  id INTEGER PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submission(id),
  description TEXT, amount REAL, sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS checklist_item (
  id INTEGER PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submission(id),
  idx INTEGER NOT NULL, label TEXT, checked INTEGER DEFAULT 0
);

-- Field-level provenance: one row per stored value, stamped with its source
-- and save date, keeping the prior value so a single-level revert works.
CREATE TABLE IF NOT EXISTS provenance (
  id INTEGER PRIMARY KEY,
  entity_table TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  field_key TEXT NOT NULL,      -- dictionary key, e.g. 'ca.address_street'
  column_name TEXT NOT NULL,    -- physical column stamped
  source TEXT NOT NULL,         -- database | this-cycle | overridden | auto-calculated | new
  saved_at TEXT NOT NULL,       -- yyyy-mm-dd
  prior_value TEXT,             -- previous value (revert target)
  prior_source TEXT,
  UNIQUE(entity_table, entity_id, column_name)
);
