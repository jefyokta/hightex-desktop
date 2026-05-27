import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../hooks/use-user";
import { useAuthModal } from "../context/auth-modal-context";
import { useOnline } from "../hooks/use-online";
import { motion } from "motion/react";
import { LayoutTextFlip } from "@/components/ui/layout-text-flip";

const Marquee = ({ items }: { items: string[] }) => {
  return (
    <div className="relative w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-white dark:from-neutral-950 to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-white dark:from-neutral-950 to-transparent z-10" />

      <motion.div
        className="flex w-max gap-8 whitespace-nowrap"
        animate={{ x: "-50%" }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <div className="flex gap-8 pr-8">
          {items.map((t, i) => (
            <span
              key={`a-${i}`}
              className="text-sm text-neutral-500 dark:text-neutral-400"
            >
              {t}
            </span>
          ))}
        </div>

        <div className="flex gap-8 pr-8">
          {items.map((t, i) => (
            <span
              key={`b-${i}`}
              className="text-sm text-neutral-500 dark:text-neutral-400"
            >
              {t}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export const Splash: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { openLogin } = useAuthModal();
  const online = useOnline();

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!online) return;

      setLoading(true);

      try {
        window.hightex.onPrefetchProgress?.((data: any) => {
          if (cancelled) return;
          setProgress(data.progress ?? 0);
          setStatus(data.status ?? "");
        });

        await window.hightex.prefetch();

        if (!cancelled) {
          setProgress(100);
          setStatus("done");
          setTimeout(() => setLoading(false), 200);
        }
      } catch (e) {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [online]);

  if (online && loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-black">
        <div className="w-[320px] space-y-4 text-center">
          <div className="text-sm text-neutral-500 dark:text-neutral-400">
            {status || "Preparing HighTex..."}
          </div>

          <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-neutral-900 dark:bg-white transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="text-xs text-neutral-400">
            {Math.round(progress)}%
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center   dark:bg-black text-neutral-900 dark:text-neutral-100 transition-colors">
      <div className="text-center relative space-y-10 w-full max-w-2xl h-screen flex flex-col justify-center px-6 h">
        <h1 className="text-4xl font-semibold tracking-tight">HighTex</h1>

        <div className="py-2">
          <Marquee
            items={[
              "just focus on your ideas",
              "write without formatting distractions",
              "citations handled automatically",
              "structured writing without effort",
              "research first, formatting later",
            ]}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {user ? (
            <div className="space-y-2">
              <div className="text-sm text-neutral-500">
                Hi {user.name.split(" ")[0]}
              </div>

              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="px-5 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black"
                >
                  Start
                </button>

                <button
                  onClick={async () => await window.session.logout()}
                  className="px-5 py-2 rounded-xl bg-neutral-200 dark:bg-neutral-800"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => navigate("/dashboard")}
                className="px-5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700"
              >
                Continue as Guest
              </button>

              <button
                onClick={openLogin}
                className="px-5 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black"
              >
                Login
              </button>
            </>
          )}
        </div>

        <p className="text-xs text-neutral-400">Lightweight • Offline-ready</p>
        <div className="pt-6 self-end w-full border-t flex justify-center border-neutral-200 dark:border-neutral-800">
          <LayoutTextFlip
            text="From Jepi Okta Mipa, Thanks to"
            words={[
              {
                name: "Tengku Khairil Ahsyar",
                role: "Lovely Mentor",
              },
              {
                name: "Bintang Aditiya",
                role: "The First User",
              },
              {
                name: "Rafiki Syahputra",
                role: "Testing Partner",
              },
              {
                name: "Irvandi Kurniawan",
                role: "Best of The Best Friend",
              },
              {
                name: "Lafera Space",
                role: "My Second Home",
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
};
