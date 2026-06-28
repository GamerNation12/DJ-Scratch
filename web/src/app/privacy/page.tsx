import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-black text-white p-8 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        
        <p className="text-gray-400">Last updated: {new Date().toLocaleDateString()}</p>

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
            We are committed to keeping your data secure. All data is stored securely and is only accessible to the development team. We do not sell or share your personal data with third parties.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">4. Data Retention and Deletion</h2>
          <p className="text-gray-300">
            We retain your data only for as long as necessary to provide you with the bot's services. If you wish to have your data removed, you can kick the bot from your server or contact support. Upon request, we will delete all data associated with your Discord account or server.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">5. Contact Us</h2>
          <p className="text-gray-300">
            If you have any questions or concerns about this Privacy Policy, please contact the developer or join our support server.
          </p>
        </section>
      </div>
    </div>
  );
}
