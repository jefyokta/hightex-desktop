import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../hooks/use-user";
import { useAuthModal } from "../context/auth-modal-context";
import { useOnline } from "../hooks/use-online";

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
          console.log(data);
          if (cancelled) return;
          setProgress(data.progress ?? 0);
          setStatus(data.status ?? "");
        });

        await window.hightex.prefetch();

        if (!cancelled) {
          setProgress(100);
          setStatus("done");

          setTimeout(() => {
            setLoading(false);
          }, 200);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [online]);

  if (!online || !loading) {
    return renderApp();
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
      <div className="w-[320px] space-y-4 text-center">
        <div className="text-sm text-slate-500">
          {status || "Preparing HighTex..."}
        </div>

        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-slate-900 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="text-xs text-slate-400">{Math.round(progress)}%</div>
      </div>
    </div>
  );

  function renderApp() {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 text-slate-900">
        <div className="text-center space-y-8">
          <h1 className="text-4xl font-bold">HighTex</h1>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {user ? (
              <div className="space-y-2">
                <div className="text-sm text-gray-400">
                  Hi {user.name.split(" ")[0]}!
                </div>

                <div className="flex gap-2">
                  <div
                    onClick={() => navigate("/dashboard")}
                    className="px-5 py-2 rounded-xl bg-slate-900 text-white cursor-pointer"
                  >
                    Start
                  </div>

                  <div
                    onClick={async () => await window.session.logout()}
                    className="px-5 py-2 rounded-xl bg-gray-200 cursor-pointer"
                  >
                    Logout
                  </div>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="px-5 py-2 rounded-xl border"
                >
                  Continue as Guest
                </button>

                <button
                  onClick={openLogin}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white"
                >
                  Login
                </button>
              </>
            )}
          </div>

          <p className="text-xs text-slate-400">Lightweight • Offline-ready</p>
        </div>
      </div>
    );
  }
};
