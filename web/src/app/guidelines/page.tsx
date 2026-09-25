import React from 'react';

export default function CommunityStandards() {
  return (
    <div className="min-h-screen bg-[#0e0618] text-white p-8 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-4xl font-display font-extrabold mb-8">Community Standards</h1>

        <p className="text-gray-400">Last updated: 9/25/2026</p>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">1. Be Respectful</h2>
          <p className="text-gray-300">
            DJ Scratch is for everyone. Servers and users must not use the bot
            in spaces built around hate, harassment, or content that demeans
            people for their religion, race, identity, or beliefs. This includes
            server names, icons, and descriptions — if your server promotes
            hateful or offensive content, the bot will leave.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">2. No Abuse or Spam</h2>
          <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
            <li>Don't spam commands to degrade the bot for others</li>
            <li>Don't exploit bugs — report them with <span className="text-white font-semibold">/bug</span> instead</li>
            <li>Don't attempt to bypass rate limits, cooldowns, or restrictions</li>
            <li>Don't use the bot to harass, stalk, or brigade other users</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">3. Keep It Legal</h2>
          <p className="text-gray-300">
            Don't use DJ Scratch for anything illegal, and respect copyright.
            Link your own accounts only — never someone else's.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">4. Enforcement</h2>
          <p className="text-gray-300">
            Violations may result in the bot leaving your server, loss of
            features or badges, or a permanent ban from DJ Scratch — with or
            without notice, depending on severity. The developer&apos;s decision is final.
          </p>
          <p className="text-gray-300">
            DJ Scratch is a free service run by its developer, who may also
            remove the bot from any server at any time for any reason —
            including personal discretion.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">5. Appeals</h2>
          <p className="text-gray-300">
            Think an action was a mistake? Reach out in our{" "}
            <a
              href="https://discord.gg/53sxaVWn92"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline"
            >
              support server
            </a>{" "}
            and we'll take another look.
          </p>
        </section>
      </div>
    </div>
  );
}
