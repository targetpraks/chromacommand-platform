"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogIn, Eye, EyeOff, AlertCircle } from "lucide-react";
import { trpc, setToken } from "../lib/trpc";
import { Button, Input } from "../components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      setToken(data.token);
      router.replace("/matrix");
    },
    onError: (err) => {
      setError(err.message || "Invalid credentials");
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-navy to-navy/50 border border-gold/20 flex items-center justify-center mb-4">
            <span className="text-gold font-bold text-lg">CC</span>
          </div>
          <h1 className="text-xl font-bold text-on-dark">ChromaCommand</h1>
          <p className="text-xs text-on-dark-secondary mt-1">Papa Pasta Control Hub</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-panel border border-border-medium rounded-xl p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-error bg-error-subtle border border-error/20 rounded-md px-3 py-2 text-xs">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="admin@papapasta.co.za"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full"
          />

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-[30px] text-on-dark-secondary hover:text-on-dark transition"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <Button
            variant="primary"
            size="md"
            className="w-full flex items-center justify-center gap-2 mt-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />
            ) : (
              <LogIn size={16} strokeWidth={2.5} />
            )}
            Sign In
          </Button>
        </form>

        <p className="text-center text-[11px] text-on-dark-secondary mt-6">
          Demo credentials available in development mode.
        </p>
      </motion.div>
    </div>
  );
}
