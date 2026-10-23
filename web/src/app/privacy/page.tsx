import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#0e0618] text-white p-8 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-4xl font-display font-extrabold mb-8">Privacy Policy</h1>
        
        <p className="text-gray-400">Last updated: 10/23/2026</p>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">1. Information We Collect</h2>
          <p className="text-gray-300">
            When you use DJ Scratch, we may collect the following information:
          </p>
          <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
            <li>Your Discord User ID and Username</li>
            <li>Server (Guild) IDs where the bot is installed</li>
            <li>Voice channel state (when the bot is actively playing music)</li>
            <li>Command usage data (for analytics and debugging)</li>
            <li>Spotify/SoundCloud or other platform links provided to the bot</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">2. How We Use Your Information</h2>
          <p className="text-gray-300">
            We use the collected information solely to:
          </p>
          <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
            <li>Provide the core functionality of the bot (playing music, displaying profiles)</li>
            <li>Maintain and improve the bot's performance and stability</li>
            <li>Respond to your requests or support inquiries</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">3. Data Storage and Security</h2>
          <p className="text-gray-300">
            We are committed to keeping your data secure. All data is stored securely and is only accessible to the development team. We do not sell your personal data. We share it only with service providers that help us operate the service (such as hosting, authentication and music-data providers), with advertising partners as described in Section 6, or when required by law.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">4. Data Retention and Deletion</h2>
          <p className="text-gray-300">
            We retain your data only for as long as necessary to provide you with the bot's services. If you wish to have your data removed, you can kick the bot from your server or contact support. Upon request, we will delete all data associated with your Discord account or server.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">5. Cookies and Similar Technologies</h2>
          <p className="text-gray-300">
            DJ Scratch uses cookies and similar technologies to keep you signed in, remember your preferences, measure site usage, and — where advertising is enabled — serve and measure ads. You can block or delete cookies through your browser settings, though some parts of the service may stop working correctly.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">6. Advertising</h2>
          <p className="text-gray-300">
            We use Google AdSense to display advertisements. Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this website or other websites. Google&apos;s use of advertising cookies enables it and its partners to serve ads to you based on your visit to this site and/or other sites on the Internet.
          </p>
          <p className="text-gray-300">
            You may opt out of personalized advertising by visiting{' '}
            <a
              href="https://www.google.com/settings/ads"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-300 hover:text-indigo-200 underline"
            >
              Google Ads Settings
            </a>{' '}
            or{' '}
            <a
              href="https://www.aboutads.info"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-300 hover:text-indigo-200 underline"
            >
              www.aboutads.info
            </a>
            . For more information about how Google uses data from partner sites, see{' '}
            <a
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-300 hover:text-indigo-200 underline"
            >
              Google&apos;s Privacy &amp; Terms
            </a>
            . Where required by law, we use a consent management platform to request consent before setting advertising cookies.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">7. Contact Us</h2>
          <p className="text-gray-300">
            If you have any questions or concerns about this Privacy Policy, please contact the developer or join our support server.
          </p>
        </section>
      </div>
    </div>
  );
}
