import { Component, type ErrorInfo, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { Spinner, ToastProvider } from "./components/ui";
import Landing from "./pages/public/Landing";
import InfoPage from "./pages/public/InfoPage";
import { ForgotPassword, Login, SetPassword, Signup } from "./pages/public/Auth";
import Dashboard from "./pages/app/Dashboard";
import WalletPage from "./pages/app/Wallet";
import Deposit from "./pages/app/Deposit";
import Transfer from "./pages/app/Transfer";
import Savings from "./pages/app/Savings";
import SavingsDetail from "./pages/app/SavingsDetail";
import TransactionsPage from "./pages/app/Transactions";
import TransactionDetail from "./pages/app/TransactionDetail";
import Kyc from "./pages/app/Kyc";
import Settings from "./pages/app/Settings";
import Profile from "./pages/app/Profile";
import Notifications from "./pages/app/Notifications";
import Support from "./pages/app/Support";
import Admin from "./pages/admin/Admin";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Allawii crashed:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
          <h1 className="text-lg font-semibold">Something broke on this screen</h1>
          <p className="mt-2 text-[13px] text-[var(--color-ink-soft)]">{this.state.error.message}</p>
          <button onClick={() => window.location.reload()} className="mt-5 rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white">
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Protected({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="grid min-h-screen place-items-center"><Spinner label="Loading your session" /></div>;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { role, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center"><Spinner /></div>;
  if (role === "student") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center"><Spinner /></div>;
  if (session) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const infoPaths = ["/how-it-works", "/fees", "/security", "/help", "/contact", "/terms", "/privacy", "/disclosures"];

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Routes>
              <Route path="/" element={<Landing />} />
              {infoPaths.map((p) => <Route key={p} path={p} element={<InfoPage />} />)}

              <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
              <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
              <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
              <Route path="/set-password" element={<SetPassword />} />

              <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
              <Route path="/wallet" element={<Protected><WalletPage /></Protected>} />
              <Route path="/deposit" element={<Protected><Deposit /></Protected>} />
              <Route path="/transfer" element={<Protected><Transfer /></Protected>} />
              <Route path="/savings" element={<Protected><Savings /></Protected>} />
              <Route path="/savings/:id" element={<Protected><SavingsDetail /></Protected>} />
              <Route path="/transactions" element={<Protected><TransactionsPage /></Protected>} />
              <Route path="/transactions/:id" element={<Protected><TransactionDetail /></Protected>} />
              <Route path="/kyc" element={<Protected><Kyc /></Protected>} />
              <Route path="/settings" element={<Protected><Settings /></Protected>} />
              <Route path="/profile" element={<Protected><Profile /></Protected>} />
              <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
              <Route path="/support" element={<Protected><Support /></Protected>} />
              <Route path="/admin" element={<Protected><AdminOnly><Admin /></AdminOnly></Protected>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
