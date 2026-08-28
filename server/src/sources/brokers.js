/**
 * Data-broker catalog.
 *
 * These sites are prioritized over generic web results because each one has a
 * documented opt-out path — that is what makes a finding actionable instead of
 * merely alarming.
 *
 * Opt-out URLs and steps drift. `checkedOn` records when each entry was last
 * reviewed; see README ("Keeping the broker catalog honest") for the refresh
 * routine. If a link 404s, the worklist item still names the site so the user
 * can find its current privacy page.
 */

const CHECKED_ON = '2026-08-01';

const BROKERS = [
  {
    key: 'whitepages',
    name: 'Whitepages',
    hosts: ['whitepages.com', '411.com'],
    category: 'People search',
    exposes: ['Full name', 'Current and past addresses', 'Phone numbers', 'Relatives'],
    optOutUrl: 'https://www.whitepages.com/suppression-requests',
    steps: [
      'Find your listing on whitepages.com and copy its URL.',
      'Paste the URL into the suppression request form.',
      'Confirm the identity match, then verify by phone call to the number they show.',
    ],
    requires: 'Phone verification',
    typicalTime: '24-72 hours',
    difficulty: 'medium',
  },
  {
    key: 'spokeo',
    name: 'Spokeo',
    hosts: ['spokeo.com'],
    category: 'People search',
    exposes: ['Name', 'Age', 'Address history', 'Relatives', 'Social profiles'],
    optOutUrl: 'https://www.spokeo.com/optout',
    steps: [
      'Search your name on Spokeo and copy the URL of your profile.',
      'Paste the profile URL and an email address into the opt-out form.',
      'Click the confirmation link Spokeo emails you.',
    ],
    requires: 'Email confirmation',
    typicalTime: '1-3 days',
    difficulty: 'easy',
  },
  {
    key: 'beenverified',
    name: 'BeenVerified',
    hosts: ['beenverified.com'],
    category: 'Background report',
    exposes: ['Name', 'Address history', 'Phone numbers', 'Relatives', 'Public records'],
    optOutUrl: 'https://www.beenverified.com/app/optout/search',
    steps: [
      'Search your name in the opt-out tool and select your record.',
      'Enter an email address and submit.',
      'Click the verification link in the email.',
    ],
    requires: 'Email confirmation',
    typicalTime: '24 hours',
    difficulty: 'easy',
  },
  {
    key: 'radaris',
    name: 'Radaris',
    hosts: ['radaris.com'],
    category: 'People search',
    exposes: ['Name', 'Addresses', 'Phone numbers', 'Employment', 'Relatives'],
    optOutUrl: 'https://radaris.com/control/privacy',
    steps: [
      'Locate your profile and copy its URL.',
      'Create the account-level privacy control, or submit the removal form with the profile URL.',
      'Verify by phone or email as prompted.',
    ],
    requires: 'Phone or email verification',
    typicalTime: '1-7 days',
    difficulty: 'hard',
  },
  {
    key: 'truepeoplesearch',
    name: 'TruePeopleSearch',
    hosts: ['truepeoplesearch.com'],
    category: 'People search',
    exposes: ['Name', 'Age', 'Current address', 'Phone numbers', 'Relatives'],
    optOutUrl: 'https://www.truepeoplesearch.com/removal',
    steps: [
      'Find your record and copy its detail-page URL.',
      'Submit the URL with an email address on the removal page.',
      'Click the emailed confirmation link.',
    ],
    requires: 'Email confirmation',
    typicalTime: 'Minutes to 24 hours',
    difficulty: 'easy',
  },
  {
    key: 'fastpeoplesearch',
    name: 'FastPeopleSearch',
    hosts: ['fastpeoplesearch.com'],
    category: 'People search',
    exposes: ['Name', 'Address history', 'Phone numbers', 'Relatives'],
    optOutUrl: 'https://www.fastpeoplesearch.com/removal',
    steps: [
      'Copy the URL of your listing.',
      'Paste it into the removal form along with an email address.',
      'Confirm via the emailed link.',
    ],
    requires: 'Email confirmation',
    typicalTime: '24-48 hours',
    difficulty: 'easy',
  },
  {
    key: 'yellowpages',
    name: 'Yellow Pages',
    hosts: ['yellowpages.com', 'yp.com'],
    category: 'Directory',
    exposes: ['Business or personal listing', 'Address', 'Phone number'],
    optOutUrl: 'https://www.yellowpages.com/about/legal/privacy-policy',
    steps: [
      'Open the privacy policy and use the privacy-request contact it names.',
      'Ask for removal of the specific listing URL, or claim the listing to edit it.',
      'Keep the request in writing; directory listings often need a follow-up.',
    ],
    requires: 'Written request',
    typicalTime: '1-4 weeks',
    difficulty: 'medium',
  },
  {
    key: 'mylife',
    name: 'MyLife',
    hosts: ['mylife.com'],
    category: 'Reputation profile',
    exposes: ['Name', 'Age', 'Addresses', 'Reputation score', 'Relatives'],
    optOutUrl: 'https://www.mylife.com/ccpa/index.pubview',
    steps: [
      'Open the privacy request page and choose deletion of personal information.',
      'Provide the profile URL and a contact email.',
      'Respond to the confirmation email.',
    ],
    requires: 'Email confirmation',
    typicalTime: '1-2 weeks',
    difficulty: 'medium',
  },
  {
    key: 'intelius',
    name: 'Intelius',
    hosts: ['intelius.com'],
    category: 'Background report',
    exposes: ['Name', 'Address history', 'Phone numbers', 'Relatives'],
    optOutUrl: 'https://www.intelius.com/opt-out/submit/',
    steps: [
      'Search for your record in the opt-out tool.',
      'Select it and submit an email address.',
      'Click the emailed confirmation link.',
    ],
    requires: 'Email confirmation',
    typicalTime: '72 hours',
    difficulty: 'easy',
  },
  {
    key: 'peoplefinders',
    name: 'PeopleFinders',
    hosts: ['peoplefinders.com'],
    category: 'People search',
    exposes: ['Name', 'Addresses', 'Phone numbers', 'Relatives'],
    optOutUrl: 'https://www.peoplefinders.com/opt-out',
    steps: ['Find your record in the opt-out search.', 'Submit it with an email address.', 'Confirm via email.'],
    requires: 'Email confirmation',
    typicalTime: '24-72 hours',
    difficulty: 'easy',
  },
  {
    key: 'instantcheckmate',
    name: 'Instant Checkmate',
    hosts: ['instantcheckmate.com'],
    category: 'Background report',
    exposes: ['Name', 'Age', 'Address history', 'Possible relatives'],
    optOutUrl: 'https://www.instantcheckmate.com/opt-out/',
    steps: ['Search your name in the opt-out tool.', 'Select your record and enter an email.', 'Confirm via email.'],
    requires: 'Email confirmation',
    typicalTime: '48 hours',
    difficulty: 'easy',
  },
  {
    key: 'truthfinder',
    name: 'TruthFinder',
    hosts: ['truthfinder.com'],
    category: 'Background report',
    exposes: ['Name', 'Address history', 'Phone numbers', 'Public records'],
    optOutUrl: 'https://www.truthfinder.com/opt-out/',
    steps: ['Search for your record.', 'Submit it with an email address.', 'Click the confirmation link.'],
    requires: 'Email confirmation',
    typicalTime: '48 hours',
    difficulty: 'easy',
  },
  {
    key: 'nuwber',
    name: 'Nuwber',
    hosts: ['nuwber.com'],
    category: 'People search',
    exposes: ['Name', 'Address', 'Phone numbers', 'Relatives'],
    optOutUrl: 'https://nuwber.com/removal/link',
    steps: ['Copy your profile URL.', 'Submit it on the removal page with an email address.', 'Confirm via email.'],
    requires: 'Email confirmation',
    typicalTime: '48 hours',
    difficulty: 'easy',
  },
  {
    key: 'clustrmaps',
    name: 'ClustrMaps',
    hosts: ['clustrmaps.com'],
    category: 'Address records',
    exposes: ['Name', 'Street address', 'Household members'],
    optOutUrl: 'https://clustrmaps.com/bl/opt-out',
    steps: ['Copy the URL of the page listing your address.', 'Submit it on the opt-out page.', 'Confirm via email.'],
    requires: 'Email confirmation',
    typicalTime: '24-48 hours',
    difficulty: 'easy',
  },
  {
    key: 'usphonebook',
    name: 'USPhoneBook',
    hosts: ['usphonebook.com'],
    category: 'Phone directory',
    exposes: ['Name', 'Phone numbers', 'Address'],
    optOutUrl: 'https://www.usphonebook.com/opt-out',
    steps: ['Copy your listing URL.', 'Submit it with an email address.', 'Confirm via email.'],
    requires: 'Email confirmation',
    typicalTime: '24-48 hours',
    difficulty: 'easy',
  },
  {
    key: 'searchpeoplefree',
    name: 'SearchPeopleFree',
    hosts: ['searchpeoplefree.com'],
    category: 'People search',
    exposes: ['Name', 'Address history', 'Phone numbers', 'Relatives'],
    optOutUrl: 'https://www.searchpeoplefree.com/opt-out',
    steps: ['Find your record and copy its URL.', 'Submit the removal form.', 'Confirm via email.'],
    requires: 'Email confirmation',
    typicalTime: '24-72 hours',
    difficulty: 'easy',
  },
  {
    key: 'smartbackgroundchecks',
    name: 'SmartBackgroundChecks',
    hosts: ['smartbackgroundchecks.com'],
    category: 'Background report',
    exposes: ['Name', 'Address history', 'Phone numbers', 'Relatives'],
    optOutUrl: 'https://www.smartbackgroundchecks.com/optoutcheck',
    steps: ['Search for your record.', 'Submit the opt-out with an email address.', 'Confirm via email.'],
    requires: 'Email confirmation',
    typicalTime: '48 hours',
    difficulty: 'easy',
  },
  {
    key: 'cyberbackgroundchecks',
    name: 'CyberBackgroundChecks',
    hosts: ['cyberbackgroundchecks.com'],
    category: 'Background report',
    exposes: ['Name', 'Address history', 'Phone numbers', 'Relatives'],
    optOutUrl: 'https://www.cyberbackgroundchecks.com/removal',
    steps: ['Find your record and copy its URL.', 'Submit it on the removal page.', 'Confirm via email.'],
    requires: 'Email confirmation',
    typicalTime: '24-48 hours',
    difficulty: 'easy',
  },
];

const BY_HOST = new Map();
for (const broker of BROKERS) {
  for (const host of broker.hosts) BY_HOST.set(host, { ...broker, checkedOn: CHECKED_ON });
}

/** Match a hostname, including subdomains (`www.` is stripped by the caller). */
export function lookupBroker(hostname) {
  if (!hostname) return null;
  const host = hostname.toLowerCase().replace(/^www\./, '');
  if (BY_HOST.has(host)) return BY_HOST.get(host);
  for (const [known, broker] of BY_HOST) {
    if (host.endsWith(`.${known}`)) return broker;
  }
  return null;
}

export function brokerHosts() {
  return [...BY_HOST.keys()];
}

/**
 * Fallback guidance for a page that is not a known broker. There is no opt-out
 * form, so the honest answer is "ask the site, then ask Google to de-index".
 */
export const GENERIC_REMEDIATION = {
  steps: [
    'Open the page and confirm the information is actually about you.',
    'Contact the site owner (privacy page, contact form, or WHOIS) and ask for removal of the specific URL.',
    'If the page contains contact details or other personal information, ask Google to remove it from results with the "Results about you" tool.',
  ],
  referenceUrl: 'https://support.google.com/websearch/troubleshooter/9685456',
  requires: 'Written request',
  typicalTime: 'Varies',
  difficulty: 'medium',
};
