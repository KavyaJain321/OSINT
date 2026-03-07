// ==============================================================
// ROBIN OSINT — Government of Odisha Client Setup
// Creates: Client → Auth User → DB User → Brief → 70 Sources
//          + 120 precision keywords for media monitoring
// ==============================================================

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fs from 'fs';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

// ─────────────────────────────────────────────────────────────
// 1. CLIENT CONFIGURATION
// ─────────────────────────────────────────────────────────────
const ODISHA_CLIENT = {
    name: 'Government of Odisha',
    industry: 'State Government & Public Administration',
};

const ADMIN_EMAIL = 'admin@odisha.gov.in';
const ADMIN_PASSWORD = 'OdishaGovt@ROBIN2026';
const ANALYST_EMAIL = 'analyst@odisha.gov.in';
const ANALYST_PASS = 'OdishaAnalyst@2026';

// ─────────────────────────────────────────────────────────────
// 2. BRIEF — Deep intelligence monitoring mandate
// ─────────────────────────────────────────────────────────────
const BRIEF = {
    title: 'Odisha State Government — Media Intelligence & Public Sentiment Monitoring',
    problem_statement: `
The Government of Odisha requires a comprehensive, real-time media intelligence system to monitor all news coverage, public discourse, and emerging narratives across Odisha's major media ecosystem.

MONITORING MANDATE:
• Track all news mentions of Odisha government departments, schemes, ministers, and bureaucrats
• Detect early warning signals for public grievances, local area crises, and civic unrest
• Monitor critical beats: mining, tribal rights, coastal disasters, infrastructure, healthcare, education
• Counter-narrative detection: identify misinformation or politically motivated coverage
• Track competitor state government achievements that may influence Odisha public opinion
• Monitor central government (GoI) announcements affecting Odisha — funds, schemes, directives
• Identify key journalists, editors, and opinion leaders who shape Odisha public narrative

STRATEGIC INTELLIGENCE AREAS:
1. Government Scheme Performance — PVTG Mission, Jajati Unnayan Mission, Buxi Jagannath Cess
2. Law & Order — tribal unrest, Maoist activity, communal tensions
3. Natural Disasters — cyclone, flood, drought, coastal erosion alerts
4. Industrial & Mining — POSCO, Arcelor, mining royalty disputes, displacement
5. Political Intelligence — BJP state unit actions, opposition Congress/BJD movements
6. Administrative Intelligence — IAS transfers, corruption FIRs, CAG/ED/CBI reports
7. Judicial Watch — High Court orders affecting government programs
8. Social Media Amplification — which stories go viral, who amplifies them

CLIENT: Government of Odisha | Priority: CRITICAL | Budget: Premium
`.trim(),
};

// ─────────────────────────────────────────────────────────────
// 3. KEYWORDS — 120 precision monitoring keywords
// ─────────────────────────────────────────────────────────────
const KEYWORDS = [
    // ── Government & Political ──
    { keyword: 'Odisha government', category: 'Government', priority: 10, rationale: 'Primary monitoring term for all state govt coverage' },
    { keyword: 'CM Mohan Majhi', category: 'Government', priority: 10, rationale: 'Chief Minister — all CM mentions must be tracked' },
    { keyword: 'Mohan Majhi', category: 'Government', priority: 10, rationale: 'CM name variant' },
    { keyword: 'BJP Odisha', category: 'Political', priority: 9, rationale: 'Ruling party — political risk tracking' },
    { keyword: 'Odisha BJP', category: 'Political', priority: 9, rationale: 'Ruling party variant' },
    { keyword: 'BJD Odisha', category: 'Political', priority: 8, rationale: 'Main opposition party' },
    { keyword: 'Congress Odisha', category: 'Political', priority: 7, rationale: 'Opposition party' },
    { keyword: 'Odisha minister', category: 'Government', priority: 9, rationale: 'Cabinet level tracking' },
    { keyword: 'Odisha cabinet', category: 'Government', priority: 8, rationale: 'Cabinet decisions & reshuffles' },
    { keyword: 'Odisha assembly', category: 'Government', priority: 8, rationale: 'Legislative assembly proceedings' },
    { keyword: 'Odisha MLA', category: 'Political', priority: 7, rationale: 'Legislator-level coverage' },
    { keyword: 'Odisha MP', category: 'Political', priority: 7, rationale: 'Parliament-level coverage' },
    { keyword: 'Odisha opposition', category: 'Political', priority: 7, rationale: 'Opposition activity tracking' },
    { keyword: 'Odisha election', category: 'Political', priority: 8, rationale: 'Electoral news and by-polls' },

    // ── Administration & IAS ──
    { keyword: 'Odisha IAS', category: 'Administration', priority: 8, rationale: 'IAS officer transfers, actions, controversies' },
    { keyword: 'Odisha Chief Secretary', category: 'Administration', priority: 8, rationale: 'Senior bureaucracy' },
    { keyword: 'Odisha DGP', category: 'Administration', priority: 7, rationale: 'Police top leadership' },
    { keyword: 'Odisha transfer posting', category: 'Administration', priority: 6, rationale: 'Bureaucratic reshuffles' },
    { keyword: 'Odisha collector arrested', category: 'Administration', priority: 9, rationale: 'Critical admin alerts' },
    { keyword: 'Odisha bureaucrat', category: 'Administration', priority: 6, rationale: 'General bureaucracy tracking' },

    // ── Schemes & Programs ──
    { keyword: 'PVTG Mission Odisha', category: 'Welfare Scheme', priority: 9, rationale: 'Flagship tribal mission' },
    { keyword: 'Jajati Unnayan Mission', category: 'Welfare Scheme', priority: 9, rationale: 'Key tribal development scheme' },
    { keyword: 'Subhadra Yojana', category: 'Welfare Scheme', priority: 9, rationale: 'Cash transfer scheme for women' },
    { keyword: 'Odisha scheme', category: 'Welfare Scheme', priority: 7, rationale: 'General scheme monitoring' },
    { keyword: 'Odisha welfare', category: 'Welfare Scheme', priority: 7, rationale: 'Welfare programs' },
    { keyword: 'Mamata scheme Odisha', category: 'Welfare Scheme', priority: 8, rationale: 'Maternity scheme tracking' },
    { keyword: 'Pradhan Mantri Odisha', category: 'Central Govt', priority: 7, rationale: 'Central scheme implementation' },
    { keyword: 'PM Modi Odisha', category: 'Central Govt', priority: 8, rationale: 'PM visits and announcements' },
    { keyword: 'Odisha budget', category: 'Finance', priority: 8, rationale: 'State budget coverage' },
    { keyword: 'Odisha funds', category: 'Finance', priority: 7, rationale: 'Financial allocations' },

    // ── Law & Order / Security ──
    { keyword: 'Odisha Maoist', category: 'Law & Order', priority: 10, rationale: 'High security risk — Maoist activity' },
    { keyword: 'Naxal Odisha', category: 'Law & Order', priority: 10, rationale: 'Naxal activity alerts' },
    { keyword: 'Odisha riot', category: 'Law & Order', priority: 9, rationale: 'Communal unrest detection' },
    { keyword: 'Odisha violence', category: 'Law & Order', priority: 9, rationale: 'Civil unrest detection' },
    { keyword: 'Odisha communal', category: 'Law & Order', priority: 9, rationale: 'Communal tension alert' },
    { keyword: 'Odisha crime', category: 'Law & Order', priority: 7, rationale: 'Crime reporting patterns' },
    { keyword: 'Odisha FIR', category: 'Law & Order', priority: 7, rationale: 'FIR-level tracking' },
    { keyword: 'Odisha arrest', category: 'Law & Order', priority: 7, rationale: 'High-profile arrests' },
    { keyword: 'Odisha police', category: 'Law & Order', priority: 7, rationale: 'Police actions & controversies' },
    { keyword: 'Odisha STF', category: 'Law & Order', priority: 8, rationale: 'Special Task Force operations' },

    // ── Corruption / Judicial ──
    { keyword: 'Odisha corruption', category: 'Corruption & Judiciary', priority: 10, rationale: 'Critical reputation risk' },
    { keyword: 'Odisha scam', category: 'Corruption & Judiciary', priority: 10, rationale: 'Financial misconduct detection' },
    { keyword: 'Odisha ED raid', category: 'Corruption & Judiciary', priority: 9, rationale: 'Enforcement Directorate actions' },
    { keyword: 'Odisha CBI raid', category: 'Corruption & Judiciary', priority: 9, rationale: 'Central investigation agencies' },
    { keyword: 'Odisha High Court', category: 'Corruption & Judiciary', priority: 8, rationale: 'Judicial orders affecting govt' },
    { keyword: 'Odisha CAG report', category: 'Corruption & Judiciary', priority: 8, rationale: 'CAG audit findings' },
    { keyword: 'Odisha bribery', category: 'Corruption & Judiciary', priority: 9, rationale: 'Bribery allegations' },
    { keyword: 'Odisha embezzlement', category: 'Corruption & Judiciary', priority: 8, rationale: 'Fund misappropriation' },
    { keyword: 'RTI Odisha', category: 'Corruption & Judiciary', priority: 7, rationale: 'RTI disclosures that reveal govt issues' },

    // ── Mining & Industry ──
    { keyword: 'Odisha mining', category: 'Industry', priority: 9, rationale: 'Major economic & conflict area' },
    { keyword: 'Odisha iron ore', category: 'Industry', priority: 8, rationale: 'Iron ore mining controversies' },
    { keyword: 'Odisha coal mining', category: 'Industry', priority: 8, rationale: 'Coal mining issues' },
    { keyword: 'Odisha POSCO', category: 'Industry', priority: 8, rationale: 'POSCO steel plant issues' },
    { keyword: 'Odisha Vedanta', category: 'Industry', priority: 8, rationale: 'Vedanta operations and protests' },
    { keyword: 'Odisha Arcelor', category: 'Industry', priority: 7, rationale: 'ArcelorMittal operations' },
    { keyword: 'Odisha mining royalty', category: 'Industry', priority: 8, rationale: 'Revenue and royalty disputes' },
    { keyword: 'Odisha illegal mining', category: 'Industry', priority: 9, rationale: 'Illegal mining — governance risk' },
    { keyword: 'Odisha steel plant', category: 'Industry', priority: 7, rationale: 'Steel industry news' },
    { keyword: 'Odisha industry', category: 'Industry', priority: 6, rationale: 'General industrial news' },

    // ── Tribal & Social Rights ──
    { keyword: 'Odisha tribal', category: 'Social', priority: 9, rationale: 'Tribal welfare and rights issues' },
    { keyword: 'Adivasi Odisha', category: 'Social', priority: 9, rationale: 'Adivasi community issues' },
    { keyword: 'Odisha PVTG', category: 'Social', priority: 9, rationale: 'Particularly Vulnerable Tribal Groups' },
    { keyword: 'Odisha displacement', category: 'Social', priority: 9, rationale: 'Land displacement — high conflict risk' },
    { keyword: 'Odisha land acquisition', category: 'Social', priority: 8, rationale: 'Land acquisition controversies' },
    { keyword: 'Odisha forest rights', category: 'Social', priority: 8, rationale: 'Forest Rights Act issues' },
    { keyword: 'Odisha Dalit', category: 'Social', priority: 8, rationale: 'Dalit issues and atrocities' },
    { keyword: 'Odisha women safety', category: 'Social', priority: 8, rationale: 'Women safety tracking' },
    { keyword: 'Odisha child trafficking', category: 'Social', priority: 9, rationale: 'Child protection alerts' },
    { keyword: 'Odisha malnutrition', category: 'Social', priority: 8, rationale: 'Nutritional crisis signals' },

    // ── Disasters & Environment ──
    { keyword: 'Odisha cyclone', category: 'Disaster', priority: 10, rationale: 'Cyclone — highest disaster risk for Odisha' },
    { keyword: 'Odisha flood', category: 'Disaster', priority: 10, rationale: 'Flood disaster monitoring' },
    { keyword: 'Odisha drought', category: 'Disaster', priority: 9, rationale: 'Drought → farmer distress → political risk' },
    { keyword: 'Odisha earthquake', category: 'Disaster', priority: 8, rationale: 'Seismic events' },
    { keyword: 'Odisha heatwave', category: 'Disaster', priority: 8, rationale: 'Extreme heat events' },
    { keyword: 'Odisha dam breach', category: 'Disaster', priority: 9, rationale: 'Dam failure → catastrophic risk' },
    { keyword: 'Odisha pollution', category: 'Environment', priority: 7, rationale: 'Industrial pollution monitoring' },
    { keyword: 'Odisha coastal erosion', category: 'Environment', priority: 8, rationale: 'Coastal vulnerability' },
    { keyword: 'Odisha deforestation', category: 'Environment', priority: 7, rationale: 'Forest cover reduction' },
    { keyword: 'Mahanadi river', category: 'Environment', priority: 8, rationale: 'Mahanadi water dispute with Chhattisgarh' },

    // ── Healthcare & Education ──
    { keyword: 'Odisha hospital', category: 'Healthcare', priority: 7, rationale: 'Healthcare system coverage' },
    { keyword: 'Odisha health crisis', category: 'Healthcare', priority: 9, rationale: 'Health emergency alerts' },
    { keyword: 'Odisha doctor strike', category: 'Healthcare', priority: 8, rationale: 'Healthcare disruptions' },
    { keyword: 'Odisha COVID', category: 'Healthcare', priority: 7, rationale: 'Pandemic-related tracking' },
    { keyword: 'Odisha school', category: 'Education', priority: 6, rationale: 'Education sector coverage' },
    { keyword: 'Odisha NEET', category: 'Education', priority: 7, rationale: 'Student exam issues' },
    { keyword: 'Odisha midday meal', category: 'Education', priority: 7, rationale: 'School meal programs' },
    { keyword: 'Odisha student protest', category: 'Social', priority: 8, rationale: 'Student unrest detection' },

    // ── Infrastructure ──
    { keyword: 'Odisha road', category: 'Infrastructure', priority: 6, rationale: 'Road infrastructure projects' },
    { keyword: 'Odisha airport', category: 'Infrastructure', priority: 7, rationale: 'Aviation infrastructure' },
    { keyword: 'Odisha railway', category: 'Infrastructure', priority: 7, rationale: 'Railway projects and accidents' },
    { keyword: 'Odisha bridge collapse', category: 'Infrastructure', priority: 9, rationale: 'Critical infrastructure failure' },
    { keyword: 'Odisha smart city', category: 'Infrastructure', priority: 6, rationale: 'Urban development' },
    { keyword: 'Bhubaneswar development', category: 'Infrastructure', priority: 6, rationale: 'Capital city development' },

    // ── Specific Cities & Districts ──
    { keyword: 'Bhubaneswar news', category: 'Geographic', priority: 8, rationale: 'Capital city — all major news' },
    { keyword: 'Cuttack news', category: 'Geographic', priority: 7, rationale: 'Second city — judicial capital' },
    { keyword: 'Puri news', category: 'Geographic', priority: 7, rationale: 'Temple city — high prominence' },
    { keyword: 'Koraput news', category: 'Geographic', priority: 7, rationale: 'Tribal & sensitive district' },
    { keyword: 'Kalahandi news', category: 'Geographic', priority: 8, rationale: 'Historical famine-prone — politically sensitive' },
    { keyword: 'Kandhamal news', category: 'Geographic', priority: 8, rationale: 'Communal violence history' },
    { keyword: 'Rayagada news', category: 'Geographic', priority: 7, rationale: 'Tribal and mining belt' },
    { keyword: 'Sambalpur news', category: 'Geographic', priority: 7, rationale: 'Western Odisha hub' },
    { keyword: 'Balasore news', category: 'Geographic', priority: 7, rationale: 'Northern Odisha — train accident history' },
    { keyword: 'Sundargarh news', category: 'Geographic', priority: 7, rationale: 'Tribal-industrial mix' },

    // ── Media & PR ──
    { keyword: 'Odisha I&PR', category: 'Media Relations', priority: 8, rationale: 'Information & PR department actions' },
    { keyword: 'Odisha press conference', category: 'Media Relations', priority: 7, rationale: 'Official press events' },
    { keyword: 'fake news Odisha', category: 'Media Relations', priority: 8, rationale: 'Misinformation about Odisha govt' },
    { keyword: 'Odisha RTI application', category: 'Transparency', priority: 7, rationale: 'Transparency disclosures' },
    { keyword: 'Odisha journalist arrested', category: 'Media', priority: 9, rationale: 'Press freedom alerts — reputational risk' },
    { keyword: 'Rath Yatra Puri', category: 'Culture', priority: 8, rationale: 'Major event — national & international attention' },
    { keyword: 'Jagannath Temple', category: 'Culture', priority: 8, rationale: 'Temple politics and controversies' },

    // ── Economic / External ──
    { keyword: 'Odisha investment', category: 'Economy', priority: 7, rationale: 'FDI and industrial investment' },
    { keyword: 'Make in Odisha', category: 'Economy', priority: 8, rationale: 'Investment summit' },
    { keyword: 'Odisha GDP', category: 'Economy', priority: 6, rationale: 'Economic performance tracking' },
    { keyword: 'World Bank Odisha', category: 'Economy', priority: 7, rationale: 'Multilateral funding monitoring' },
    { keyword: 'Odisha AIIMS', category: 'Healthcare', priority: 7, rationale: 'AIIMS Bhubaneswar news' },
    { keyword: 'Odisha IIT', category: 'Education', priority: 6, rationale: 'IIT Bhubaneswar news' },
];

// ─────────────────────────────────────────────────────────────
// 4. SOURCES — All 70 Odisha media outlets from client's list
//    + extra Google News RSS feeds for each major topic
// ─────────────────────────────────────────────────────────────
const SOURCES = [
    // ── PRINT — Odia Language ──
    { name: 'Sambad', url: 'https://www.sambad.in/', source_type: 'html', rationale: 'Largest Odia daily — 4.5L copies/day, Sambad Group (Kanak TV)' },
    { name: 'Prameya', url: 'https://www.prameyane ws.com/', source_type: 'html', rationale: 'Second-largest Odia daily — 4.1L copies/day, News7 TV' },
    { name: 'Dharitri', url: 'https://www.dharitri.com/', source_type: 'html', rationale: 'Third-largest — strong political editorial stance' },
    { name: 'Samaja', url: 'https://www.thesamaja.in/', source_type: 'html', rationale: 'Oldest Odia daily (1919), Cuttack-based, Lok Sevak Mandal' },
    { name: 'Pragativadi', url: 'https://www.pragativadi.com/', source_type: 'html', rationale: 'Independent Odia daily — strong coastal Odisha presence' },
    { name: 'Odisha Bhaskar', url: 'https://www.odishabhaskar.com/', source_type: 'html', rationale: 'Tilak Raj group — growing circulation 1.81L' },
    { name: 'Pratidin (Odisha Pratidin)', url: 'https://www.odishapratidin.com/', source_type: 'html', rationale: 'Southern Odisha focus — Berhampur-based, 1.65L' },
    { name: 'Dinalipi', url: 'https://www.dinalipi.in/', source_type: 'html', rationale: 'Bhubaneswar regional daily — 90K copies' },
    { name: 'Anupam Bharat', url: 'https://www.anupambharat.com/', source_type: 'html', rationale: 'Berhampur-based, southern Odisha focus — 75K' },
    { name: 'Sarbasadharana', url: 'https://www.sarbasadharana.com/', source_type: 'html', rationale: 'Bhubaneswar regional daily — 65K' },
    { name: 'Matrubhasa', url: 'https://www.matrubhasa.com/', source_type: 'html', rationale: 'Cuttack veteran daily — 55K copies' },
    { name: 'Utkal Mail', url: 'https://www.utkalmail.com/', source_type: 'html', rationale: 'Rourkela-based, western Odisha focus — 75K' },
    { name: 'Kholadwar', url: 'https://www.kholadwar.com/', source_type: 'html', rationale: 'Bhubaneswar regional daily — 50K' },
    { name: 'Kalinga Bharati', url: 'https://www.kalingabharati.com/', source_type: 'html', rationale: 'Balasore-based, northern Odisha — 48K' },
    { name: 'Ajikali', url: 'https://www.ajikali.com/', source_type: 'html', rationale: 'Sambalpur-based, western Odisha — 45K' },
    { name: 'Ama Rajadhani', url: 'https://www.amarajadhani.com/', source_type: 'html', rationale: 'Capital city-focused Bhubaneswar daily — 42K' },
    { name: 'Orissa Express (Odia)', url: 'https://www.orissaexpress.com/', source_type: 'html', rationale: 'Cuttack-based regional Odia daily — 52K' },
    { name: 'Oscar Utkal', url: 'https://www.oscarnews.in/', source_type: 'html', rationale: 'Bhubaneswar regional publication — 40K' },
    { name: 'Utkal Samachar', url: 'https://www.utkalsamachar.com/', source_type: 'html', rationale: 'Sambalpur-based, western Odisha — 46K' },
    { name: 'Orissa Today', url: 'https://www.orissatoday.in/', source_type: 'html', rationale: 'Rourkela industrial belt readership — 44K' },
    { name: 'Orissa Express Weekly', url: 'https://www.orissaexpressweekly.com/', source_type: 'html', rationale: 'Weekly edition — Cuttack, 35K' },
    { name: 'Sanchar (Weekly)', url: 'https://www.sancharodia.com/', source_type: 'html', rationale: 'Bhubaneswar weekly — 28K' },
    { name: 'Manthan (Weekly)', url: 'https://www.manthanodisha.com/', source_type: 'html', rationale: 'Political and social commentary — Cuttack, 32K' },
    { name: 'Chira Sandhan', url: 'https://www.chirasandhan.com/', source_type: 'html', rationale: 'Cultural weekly from Puri — 25K' },
    { name: 'Shramika Malika', url: 'https://www.shramikamalika.com/', source_type: 'html', rationale: 'Labor & social issues focus — 22K' },
    { name: 'Rastradeep', url: 'https://www.rastradeep.com/', source_type: 'html', rationale: 'Political weekly, Balasore — 24K' },
    { name: 'Purbanchal Sambad', url: 'https://www.purbanchalsambad.com/', source_type: 'html', rationale: 'Southern Odisha weekly, Berhampur — 30K' },
    { name: 'Utkal Prasanga', url: 'https://www.utkalprasanga.com/', source_type: 'html', rationale: 'Cultural magazine, Cuttack — 20K' },
    { name: 'Nirbhaya (Weekly)', url: 'https://www.nirbhayaodisha.com/', source_type: 'html', rationale: 'Women-focused publication, Bhubaneswar — 18K' },
    { name: 'Samaya (Weekly)', url: 'https://www.samayaodisha.com/', source_type: 'html', rationale: 'Sambalpur weekly news magazine — 21K' },

    // ── PRINT — English Language ──
    { name: 'Orissa Post', url: 'https://www.orissapost.com/', source_type: 'html', rationale: 'Only Odisha-dedicated English daily — Sambad Group, 1.2L' },
    { name: 'Orissa Times', url: 'https://www.orissatimes.com/', source_type: 'html', rationale: 'Bhubaneswar English daily — 75K' },
    { name: 'Times of India (Odisha)', url: 'https://timesofindia.indiatimes.com/city/bhubaneswar', source_type: 'html', rationale: 'National leading English — 2.5L+ Odisha circulation' },
    { name: 'New Indian Express (Odisha)', url: 'https://www.newindianexpress.com/states/odisha', source_type: 'html', rationale: 'Major English daily, dedicated Odisha edition — 1.8L' },
    { name: 'The Hindu (Odisha)', url: 'https://www.thehindu.com/news/national/odisha/', source_type: 'html', rationale: 'Premium English daily — Odisha bureau, 1.2L' },
    { name: 'The Telegraph (Odisha)', url: 'https://www.telegraphindia.com/states/odisha', source_type: 'html', rationale: 'Eastern India focus — 90K Odisha' },
    { name: 'The Statesman (Odisha)', url: 'https://www.thestatesman.com/tag/odisha', source_type: 'html', rationale: 'National English — Odisha bureau, 65K' },
    { name: 'Hindustan Times (Odisha)', url: 'https://www.hindustantimes.com/india-news/odisha', source_type: 'html', rationale: 'National English — Bhubaneswar bureau, 1.5L' },
    { name: 'Indian Express (Odisha)', url: 'https://indianexpress.com/section/cities/bhubaneswar/', source_type: 'html', rationale: 'Leading English — 1.1L Odisha' },
    { name: 'Business Standard (Odisha)', url: 'https://www.business-standard.com/odisha-news', source_type: 'html', rationale: 'Business-focused English daily — Odisha bureau' },

    // ── TELEVISION ──
    { name: 'OTV (Odisha TV)', url: 'https://www.odishatv.in/', source_type: 'html', rationale: 'Market leader Odia TV news — 5M+ viewers, 24x7 since 2006' },
    { name: 'Kanak News', url: 'https://www.kaborakhabar.com/', source_type: 'html', rationale: 'Major Odia news channel — Sambad Group, 2.5M viewers' },
    { name: 'Prameya News7', url: 'https://www.prameyane ws7.com/', source_type: 'html', rationale: 'News7 TV — Prameya Group, 2M viewers' },
    { name: 'Naxatra News', url: 'https://www.naxatranews.com/', source_type: 'html', rationale: 'Regional Odia news channel — 1.5M viewers' },
    { name: 'MBC TV', url: 'https://www.mbctv.in/', source_type: 'html', rationale: 'Regional news and entertainment — 1.2M viewers' },
    { name: 'Kalinga TV', url: 'https://www.kalingatv.com/', source_type: 'html', rationale: 'Regional Odia news channel — 1.8M viewers' },
    { name: 'News18 Odia', url: 'https://www.news18.com/odisha/', source_type: 'html', rationale: 'Network18/Reliance — 2.2M viewers' },
    { name: 'Zee Odisha', url: 'https://zeenews.india.com/odia', source_type: 'html', rationale: 'Zee Odia news channel — 1.5M viewers' },
    { name: 'DD Odia (Doordarshan)', url: 'https://www.prasar bharati.gov.in/', source_type: 'html', rationale: 'Government broadcaster — 3M viewers, official channel' },
    { name: 'Tarang TV', url: 'https://www.tarangtv.in/', source_type: 'html', rationale: 'OTV Group entertainment — 1M viewers with news segments' },

    // ── DIGITAL / ONLINE PORTALS ──
    { name: 'OmmCom News', url: 'https://www.ommcomnews.com/', source_type: 'html', rationale: 'English digital news portal — 2M monthly visits, I&PR empanelled' },
    { name: 'Odisha Live', url: 'https://www.odishalive.tv/', source_type: 'html', rationale: 'Odia digital news platform — 1.5M monthly' },
    { name: 'Odisha Hot News', url: 'https://www.odishahotnews.com/', source_type: 'html', rationale: 'Odia web news portal — 1.2M monthly' },
    { name: 'Odia Pua', url: 'https://www.odiapua.com/', source_type: 'html', rationale: 'Youth-oriented Odia news — 800K monthly' },
    { name: 'Odisha Reporter', url: 'https://www.odishareporter.in/', source_type: 'html', rationale: 'Kalinga Media digital extension — 1.8M monthly' },
    { name: 'Odia Spot News', url: 'https://www.odiaspotnews.com/', source_type: 'html', rationale: 'Odia digital news — 900K monthly' },
    { name: 'Kanak News Digital', url: 'https://www.kaborakhabar.com/', source_type: 'html', rationale: 'Digital arm of Kanak News TV — 3M monthly' },
    { name: 'Sambad Digital', url: 'https://www.sambad.in/', source_type: 'html', rationale: 'Digital edition of Sambad — 5M monthly' },
    { name: 'Sambad English', url: 'https://www.sambadenglish.com/', source_type: 'html', rationale: 'English digital edition of Sambad — 2.5M monthly' },
    { name: 'Prameya Digital', url: 'https://www.prameyane ws.com/', source_type: 'html', rationale: 'Digital edition of Prameya — 4M monthly' },
    { name: 'Prameya News7 Digital', url: 'https://www.prameyane ws7.com/', source_type: 'html', rationale: 'Digital arm of News7 TV — 2.5M monthly' },
    { name: 'Orissa Post Digital', url: 'https://www.orissapost.com/', source_type: 'html', rationale: 'Digital edition of Orissa Post — 2M monthly' },
    { name: 'Samaja Live', url: 'https://www.thesamaja.in/', source_type: 'html', rationale: 'Digital portal of Samaja — 1.5M monthly' },
    { name: 'The Samikhsya', url: 'https://www.thesamikhsya.com/', source_type: 'html', rationale: 'Independent English/Odia portal — 1.5M monthly' },
    { name: 'Odisha Sun Times', url: 'https://www.odishasuntimes.com/', source_type: 'html', rationale: 'English news portal — 600K monthly' },
    { name: 'News18.com Odisha', url: 'https://www.news18.com/odisha/', source_type: 'html', rationale: 'National portal — 10M+ Odisha segment' },
    { name: 'Daily Hunt (Odia)', url: 'https://m.dailyhunt.in/news/india/odia', source_type: 'html', rationale: 'News aggregator — 15M Odisha segment' },
    { name: 'Hindustan Times Digital (Odisha)', url: 'https://www.hindustantimes.com/india-news/odisha', source_type: 'html', rationale: 'National English — 8M Odisha segment' },
    { name: 'Times of India Digital (Odisha)', url: 'https://timesofindia.indiatimes.com/city/bhubaneswar', source_type: 'html', rationale: 'TOI digital — 12M Odisha segment' },
    { name: 'Indian Express Digital (Odisha)', url: 'https://indianexpress.com/section/cities/bhubaneswar/', source_type: 'html', rationale: 'IE digital — 7M Odisha segment' },

    // ── RSS FEEDS — Google News precision monitoring ──
    { name: 'Google News: Odisha Government', url: 'https://news.google.com/rss/search?q=Odisha+government&hl=en-IN&gl=IN&ceid=IN:en', source_type: 'rss', rationale: 'Real-time Google News RSS for Odisha govt coverage' },
    { name: 'Google News: CM Mohan Majhi', url: 'https://news.google.com/rss/search?q=Mohan+Majhi&hl=en-IN&gl=IN&ceid=IN:en', source_type: 'rss', rationale: 'CM-level real-time monitoring' },
    { name: 'Google News: Odisha BJP', url: 'https://news.google.com/rss/search?q=BJP+Odisha&hl=en-IN&gl=IN&ceid=IN:en', source_type: 'rss', rationale: 'Ruling party news monitoring' },
    { name: 'Google News: Odisha Mining', url: 'https://news.google.com/rss/search?q=Odisha+mining&hl=en-IN&gl=IN&ceid=IN:en', source_type: 'rss', rationale: 'Mining sector real-time alerts' },
    { name: 'Google News: Odisha Corruption', url: 'https://news.google.com/rss/search?q=Odisha+corruption+scam&hl=en-IN&gl=IN&ceid=IN:en', source_type: 'rss', rationale: 'Corruption alert feed' },
    { name: 'Google News: Odisha Cyclone Flood', url: 'https://news.google.com/rss/search?q=Odisha+cyclone+flood+disaster&hl=en-IN&gl=IN&ceid=IN:en', source_type: 'rss', rationale: 'Disaster early warning monitoring' },
    { name: 'Google News: Odisha Tribal', url: 'https://news.google.com/rss/search?q=Odisha+tribal+adivasi&hl=en-IN&gl=IN&ceid=IN:en', source_type: 'rss', rationale: 'Tribal welfare and rights monitoring' },
    { name: 'Google News: Bhubaneswar Local', url: 'https://news.google.com/rss/search?q=Bhubaneswar&hl=en-IN&gl=IN&ceid=IN:en', source_type: 'rss', rationale: 'Capital city real-time news' },
];

// ─────────────────────────────────────────────────────────────
// MAIN SETUP — Run everything
// ─────────────────────────────────────────────────────────────
async function main() {
    const results = {
        client_id: null,
        brief_id: null,
        admin_user: null,
        analyst_user: null,
        sources_added: 0,
        keywords_added: 0,
        errors: [],
    };

    // ── Step 1: Create Client ──────────────────────────────────
    log('STEP 1: Creating Government of Odisha client...');
    const { data: client, error: clientErr } = await supabase
        .from('clients')
        .insert(ODISHA_CLIENT)
        .select()
        .single();

    if (clientErr) {
        log(`ERROR creating client: ${clientErr.message}`);
        results.errors.push({ step: 'create_client', error: clientErr.message });
        fs.writeFileSync('odisha-setup-results.json', JSON.stringify(results, null, 2));
        return;
    }

    results.client_id = client.id;
    log(`✅ Client created: ${client.name} (ID: ${client.id})`);

    // ── Step 2: Create Admin Auth User ────────────────────────
    log('STEP 2: Creating admin auth user...');
    const { data: adminAuth, error: adminAuthErr } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
            client_id: client.id,
            role: 'ADMIN',
            full_name: 'Odisha Govt Admin',
        },
    });

    if (adminAuthErr) {
        log(`ERROR creating admin auth: ${adminAuthErr.message}`);
        results.errors.push({ step: 'create_admin_auth', error: adminAuthErr.message });
    } else {
        const adminAuthId = adminAuth.user.id;
        // Insert into users table
        const { data: adminUser, error: adminUserErr } = await supabase.from('users').insert({
            id: adminAuthId,
            email: ADMIN_EMAIL,
            full_name: 'Odisha Govt Admin',
            role: 'ADMIN',
            client_id: client.id,
        }).select().single();

        if (adminUserErr) {
            log(`WARN: admin users row: ${adminUserErr.message}`);
            results.errors.push({ step: 'admin_users_row', error: adminUserErr.message });
        }

        results.admin_user = { id: adminAuthId, email: ADMIN_EMAIL, password: ADMIN_PASSWORD };
        log(`✅ Admin user created: ${ADMIN_EMAIL} (ID: ${adminAuthId})`);
    }

    // ── Step 3: Create Analyst Auth User ──────────────────────
    log('STEP 3: Creating analyst auth user...');
    const { data: analystAuth, error: analystAuthErr } = await supabase.auth.admin.createUser({
        email: ANALYST_EMAIL,
        password: ANALYST_PASS,
        email_confirm: true,
        user_metadata: {
            client_id: client.id,
            role: 'ANALYST',
            full_name: 'Odisha Media Analyst',
        },
    });

    if (analystAuthErr) {
        log(`ERROR creating analyst auth: ${analystAuthErr.message}`);
        results.errors.push({ step: 'create_analyst_auth', error: analystAuthErr.message });
    } else {
        const analystAuthId = analystAuth.user.id;
        const { error: analystUserErr } = await supabase.from('users').insert({
            id: analystAuthId,
            email: ANALYST_EMAIL,
            full_name: 'Odisha Media Analyst',
            role: 'ANALYST',
            client_id: client.id,
        });
        if (analystUserErr) {
            log(`WARN: analyst users row: ${analystUserErr.message}`);
            results.errors.push({ step: 'analyst_users_row', error: analystUserErr.message });
        }
        results.analyst_user = { id: analystAuthId, email: ANALYST_EMAIL, password: ANALYST_PASS };
        log(`✅ Analyst user created: ${ANALYST_EMAIL} (ID: ${analystAuthId})`);
    }

    // ── Step 4: Create Brief ────────────────────────────────────
    log('STEP 4: Creating intelligence brief...');
    const createdById = results.admin_user?.id || results.analyst_user?.id;
    const { data: brief, error: briefErr } = await supabase
        .from('client_briefs')
        .insert({
            client_id: client.id,
            title: BRIEF.title,
            problem_statement: BRIEF.problem_statement,
            status: 'active',
            industry: 'State Government & Public Administration',
            risk_domains: ['Governance', 'Disaster', 'Law & Order', 'Mining', 'Tribal Rights', 'Corruption', 'Political'],
            entities_of_interest: ['CM Mohan Majhi', 'BJP Odisha', 'BJD Odisha', 'Odisha Cabinet', 'Odisha High Court'],
            geographic_focus: ['Odisha', 'Bhubaneswar', 'Cuttack', 'Puri', 'Koraput', 'Kalahandi', 'Sambalpur'],
            ...(createdById ? { created_by: createdById } : {}),
        })
        .select()
        .single();

    if (briefErr) {
        log(`ERROR creating brief: ${briefErr.message}`);
        results.errors.push({ step: 'create_brief', error: briefErr.message });
        fs.writeFileSync('odisha-setup-results.json', JSON.stringify(results, null, 2));
        return;
    }

    results.brief_id = brief.id;
    log(`✅ Brief created: "${brief.title}" (ID: ${brief.id})`);

    // ── Step 5: Insert Keywords ──────────────────────────────────
    log(`STEP 5: Inserting ${KEYWORDS.length} precision keywords...`);
    const kwRows = KEYWORDS.map(kw => ({
        brief_id: brief.id,
        keyword: kw.keyword,
        category: kw.category,
        priority: kw.priority,
        rationale: kw.rationale,
        approved: true,
    }));

    const { data: kwData, error: kwErr } = await supabase.from('brief_generated_keywords').insert(kwRows).select();
    if (kwErr) {
        log(`ERROR inserting keywords: ${kwErr.message}`);
        results.errors.push({ step: 'insert_keywords', error: kwErr.message });
    } else {
        results.keywords_added = kwData.length;
        log(`✅ ${kwData.length} keywords inserted & approved`);
    }

    // ── Step 6: Insert Recommended Sources ───────────────────────
    log(`STEP 6: Inserting ${SOURCES.length} Odisha media sources into brief_recommended_sources...`);
    const recSrcRows = SOURCES.map(s => ({
        brief_id: brief.id,
        name: s.name,
        url: s.url.replace(/\s+/g, ''), // clean any spacing errors
        source_type: s.source_type,
        expected_hit_rate: 'high',
        rationale: s.rationale,
        approved: true,
    }));

    const { data: recData, error: recErr } = await supabase.from('brief_recommended_sources').insert(recSrcRows).select();
    if (recErr) {
        log(`ERROR inserting recommended sources: ${recErr.message}`);
        results.errors.push({ step: 'insert_recommended_sources', error: recErr.message });
    } else {
        log(`✅ ${recData.length} sources inserted into brief_recommended_sources`);
    }

    // ── Step 7: Insert Active Sources (for scraping engine) ──────
    log(`STEP 7: Inserting ${SOURCES.length} active sources into sources table (for scraper)...`);
    let srcAdded = 0;
    for (const s of SOURCES) {
        const cleanUrl = s.url.replace(/\s+/g, '');
        const { error: srcErr } = await supabase.from('sources').insert({
            client_id: client.id,
            name: s.name,
            url: cleanUrl,
            source_type: s.source_type,
            is_active: true,
        });
        if (srcErr) {
            if (!srcErr.message.includes('duplicate') && !srcErr.message.includes('unique')) {
                results.errors.push({ step: 'insert_source', url: cleanUrl, error: srcErr.message });
            }
        } else {
            srcAdded++;
        }
    }
    results.sources_added = srcAdded;
    log(`✅ ${srcAdded}/${SOURCES.length} active sources added to scraper`);

    // ── Step 8: Write summary ──────────────────────────────────────
    log('\n========================================');
    log('  GOVERNMENT OF ODISHA — SETUP COMPLETE');
    log('========================================');
    log(`  Client ID  : ${results.client_id}`);
    log(`  Brief ID   : ${results.brief_id}`);
    log(`  Admin Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    log(`  Analyst    : ${ANALYST_EMAIL} / ${ANALYST_PASS}`);
    log(`  Keywords   : ${results.keywords_added}`);
    log(`  Sources    : ${results.sources_added}`);
    log(`  Errors     : ${results.errors.length}`);
    if (results.errors.length > 0) {
        log('\n  ERRORS:');
        results.errors.forEach(e => log(`    - [${e.step}] ${e.error}`));
    }

    fs.writeFileSync('odisha-setup-results.json', JSON.stringify(results, null, 2));
    log('\n  Full results saved to: odisha-setup-results.json');
}

main().catch(e => {
    console.error('FATAL:', e.message);
    process.exit(1);
});
