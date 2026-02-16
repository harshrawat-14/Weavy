import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Zap, GitBranch, Cpu, Play, Image, Video } from 'lucide-react';

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg bg-slate-950/60 border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Weavy
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/sign-in"
              className="text-slate-300 hover:text-white transition-colors px-4 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="btn btn-primary"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm mb-8">
            <Zap className="w-4 h-4" />
            Visual AI Workflow Builder
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Build Powerful AI
            </span>
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Workflows Visually
            </span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
            Connect LLMs, process images and videos, and orchestrate complex AI pipelines
            with an intuitive drag-and-drop interface. Powered by Gemini AI.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="btn btn-primary text-lg px-8 py-3"
            >
              Start Building Free
              <Zap className="w-5 h-5" />
            </Link>
            <Link
              href="#features"
              className="btn btn-secondary text-lg px-8 py-3"
            >
              See Features
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Everything You Need
          </h2>
          <p className="text-slate-400 text-center mb-16 max-w-2xl mx-auto">
            Build sophisticated AI workflows with our comprehensive set of nodes and tools
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature Cards */}
            <FeatureCard
              icon={<GitBranch className="w-6 h-6" />}
              title="DAG Workflows"
              description="Create directed acyclic graphs with automatic cycle detection and parallel execution paths."
              gradient="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              icon={<Cpu className="w-6 h-6" />}
              title="Gemini AI Integration"
              description="Leverage Google's Gemini for powerful text and multimodal AI inference within your workflows."
              gradient="from-purple-500 to-pink-500"
            />
            <FeatureCard
              icon={<Play className="w-6 h-6" />}
              title="Parallel Execution"
              description="Independent branches execute concurrently, with convergence nodes waiting for all inputs."
              gradient="from-green-500 to-emerald-500"
            />
            <FeatureCard
              icon={<Image className="w-6 h-6" />}
              title="Image Processing"
              description="Upload, crop, and manipulate images with FFmpeg-powered processing nodes."
              gradient="from-orange-500 to-red-500"
            />
            <FeatureCard
              icon={<Video className="w-6 h-6" />}
              title="Video Frame Extraction"
              description="Extract frames from videos at any timestamp for use in your AI workflows."
              gradient="from-indigo-500 to-blue-500"
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Real-time Execution"
              description="Watch your workflows execute in real-time with live status updates and logging."
              gradient="from-yellow-500 to-orange-500"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="card bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20 p-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Build?
            </h2>
            <p className="text-slate-400 mb-8 text-lg">
              Start creating AI workflows in minutes. No credit card required.
            </p>
            <Link
              href="/sign-up"
              className="btn btn-primary text-lg px-8 py-3"
            >
              Get Started Now
              <Zap className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 py-8 px-6">
        <div className="max-w-7xl mx-auto text-center text-slate-500 text-sm">
          <p>© 2025 Weavy. Built with Next.js, React Flow, and ❤️</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  gradient
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="card group hover:border-slate-700 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-slate-400">{description}</p>
    </div>
  );
}
