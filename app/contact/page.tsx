import Link from 'next/link';
import {
  ArrowLeft,
  Github,
  Instagram,
  Mail,
  Phone,
  Twitter,
  User,
} from 'lucide-react';

const developer = {
  name: 'Danish Shanil',
  handle: 'danish_shanil',
  phone: '9123707332',
  email: 'shanildanshah@gmail.com',
  github: 'https://github.com/DanishShah619',
  twitter: 'https://x.com/shanil46013',
  instagram: 'https://www.instagram.com/danish_shanil',
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] px-5 py-8 text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-neutral-200 transition-colors hover:bg-white/[0.1]"
        >
          <ArrowLeft size={16} />
          Back
        </Link>

        <section className="rounded-lg border border-white/10 bg-[#11111b]/80 p-6 shadow-2xl shadow-black/30">
          <div className="mb-7 flex flex-col gap-3 border-b border-white/10 pb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-300">
              Contact
            </p>
            <h1 className="text-3xl font-bold tracking-tight">{developer.name}</h1>
            <p className="text-sm text-neutral-400">
              Developer profile: <span className="font-semibold text-neutral-200">{developer.handle}</span>
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href={`tel:${developer.phone.replace(/\s+/g, '')}`}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 text-neutral-200 transition-colors hover:bg-white/[0.08]"
            >
              <Phone size={18} className="text-emerald-300" />
              <span>
                <span className="block text-xs text-neutral-500">Phone</span>
                <span className="block text-sm font-semibold">{developer.phone}</span>
              </span>
            </a>

            <a
              href={`mailto:${developer.email}`}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 text-neutral-200 transition-colors hover:bg-white/[0.08]"
            >
              <Mail size={18} className="text-sky-300" />
              <span>
                <span className="block text-xs text-neutral-500">Email</span>
                <span className="block text-sm font-semibold">{developer.email}</span>
              </span>
            </a>

            <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 text-neutral-200 sm:col-span-2">
              <User size={18} className="text-indigo-300" />
              <span>
                <span className="block text-xs text-neutral-500">Name</span>
                <span className="block text-sm font-semibold">{developer.name}</span>
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={developer.github}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-neutral-200 transition-colors hover:bg-white/[0.1]"
            >
              <Github size={19} />
            </a>
            <a
              href={developer.twitter}
              target="_blank"
              rel="noreferrer"
              aria-label="Twitter"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-neutral-200 transition-colors hover:bg-white/[0.1]"
            >
              <Twitter size={19} />
            </a>
            <a
              href={developer.instagram}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-neutral-200 transition-colors hover:bg-white/[0.1]"
            >
              <Instagram size={19} />
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
