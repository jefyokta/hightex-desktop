import { Modal } from "./modal";
import { useAuthModal } from "./../context/auth-modal-context";
import { useState } from "react";

export const LoginModal = () => {
  const { loginOpen, closeLogin } = useAuthModal();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
    const res = await window.session.login(email, password);

    if (res) {
      closeLogin();
    }
  };

  return (
    <Modal open={loginOpen} onClose={closeLogin}>
      <div className="w-95 p-6 space-y-5">
        <div>
          <div className="text-lg font-semibold">Welcome back</div>
          <div className="text-xs text-gray-400">Sign in to continue</div>
        </div>

        <div className="space-y-3">
          <input
            className="w-full px-3 py-2 rounded-xl bg-gray-50 text-sm"
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="w-full px-3 py-2 rounded-xl bg-gray-50 text-sm"
            placeholder="Password"
            type="password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          onClick={login}
          className="w-full py-2 rounded-xl bg-gray-900 text-white text-sm"
        >
          Sign in
        </button>
      </div>
    </Modal>
  );
};
