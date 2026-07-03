import { useState } from "react";
import { useLogoutModal } from "../context/logout-modal-context";
import { Modal } from "./modal";

export const LogoutModal = () => {
  const { logoutOpen, closeLogout } = useLogoutModal();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);

    try {
      await window.session.logout();
      closeLogout();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={logoutOpen} onClose={closeLogout}>
      <div className="w-90 p-6 space-y-6 bg-white dark:bg-neutral-900">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Logout from HighTex?
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            You will be signed out of your current session.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={closeLogout}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            Cancel
          </button>

          <button
            onClick={handleLogout}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
          >
            {loading ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </Modal>
  );
};
