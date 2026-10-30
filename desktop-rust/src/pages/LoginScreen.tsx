export default function LoginScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#09090b]">
      <div className="text-center">
        <h1 className="text-4xl font-black mb-4">DJ Scratch</h1>
        <p className="text-zinc-400 mb-8">Desktop app coming soon. Please use the web app at <a href="https://dj-scratch.is-a-fullstack.dev" className="text-indigo-400 underline">dj-scratch.is-a-fullstack.dev</a></p>
        <button className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold">
          Open Web App
        </button>
      </div>
    </div>
  );
}
