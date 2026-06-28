import React from 'react';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-black text-white p-8 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        
        <p className="text-gray-400">Last updated: {new Date().toLocaleDateString()}</p>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">1. Acceptance of Terms</h2>
          <p className="text-gray-300">
            By inviting and using DJ Scratch Discord bot ("the Bot") in your server or accessing our dashboard, you agree to these Terms of Service. If you do not agree to these terms, please do not use the Bot.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">2. Description of Service</h2>
          <p className="text-gray-300">
            The Bot provides music playback, profile management, and related features within the Discord platform. The service is provided "as is" and may be updated, modified, or discontinued at any time without prior notice.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">3. Acceptable Use</h2>
          <p className="text-gray-300">
            You agree not to use the Bot to:
          </p>
          <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
            <li>Violate Discord's Terms of Service or Community Guidelines</li>
            <li>Abuse, spam, or exploit the Bot's commands and infrastructure</li>
            <li>Play content that is illegal, highly offensive, or violates copyright laws</li>
            <li>Attempt to bypass any limitations or restrictions set by the Bot</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">4. Limitation of Liability</h2>
          <p className="text-gray-300">
            The developers of the Bot shall not be held liable for any damages, data loss, or issues arising from the use or inability to use the Bot. We do not guarantee continuous, uninterrupted access to the Bot's features.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">5. Termination</h2>
          <p className="text-gray-300">
            We reserve the right to restrict or terminate your access to the Bot at any time, with or without notice, for any reason, including but not limited to violation of these Terms.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">6. Changes to Terms</h2>
          <p className="text-gray-300">
            We may update these Terms of Service from time to time. Continued use of the Bot after any changes constitutes acceptance of the new terms.
          </p>
        </section>
      </div>
    </div>
  );
}
