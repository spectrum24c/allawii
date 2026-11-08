import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { PublicLayout } from "../../components/layout/PublicLayout";
import { Button, Card } from "../../components/ui";

type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

type Page = { eyebrow: string; title: string; lede: string; blocks: Block[] };

const pages: Record<string, Page> = {
  "/how-it-works": {
    eyebrow: "How Allawii works",
    title: "One wallet. Goals that hold. Transfers that check first.",
    lede: "Allawii is a student wallet, not a bank. Here is exactly what happens at each step.",
    blocks: [
      { kind: "h", text: "1. Create your account" },
      { kind: "p", text: "Sign up with your name, email, phone number and date of birth. Confirm your email, then complete a short identity check with your BVN or NIN. Only the last four digits of either identifier are ever shown back to you." },
      { kind: "h", text: "2. Fund your wallet" },
      { kind: "p", text: "Once verified you can request a dedicated funding account, or pay with card through our payments partner. Both routes credit the same Allawii wallet, and every credit gets a reference you can point to." },
      { kind: "h", text: "3. Move money out" },
      { kind: "p", text: "Add a beneficiary, we run a name enquiry with the bank, you confirm the name that comes back, then authorise with your 4-digit transaction PIN. The amount is held the moment you confirm, so it cannot be spent twice while the bank responds." },
      { kind: "h", text: "4. Save on purpose" },
      { kind: "p", text: "A savings goal is money set aside inside your own wallet. It is not an investment account and it earns no interest. Goals can be flexible, released on a target date, or fully locked." },
      { kind: "h", text: "5. Check in from WhatsApp" },
      { kind: "p", text: "Link your number from Settings, then send BALANCE, TRANSACTIONS, SAVINGS or KYC. Transfers are never executed from chat: you will always be sent to the app so your PIN and limits are enforced." },
    ],
  },
  "/fees": {
    eyebrow: "Fees and limits",
    title: "Plain numbers, no surprises.",
    lede: "Allawii does not charge a monthly fee. The demo build has no transfer fee; production fees will be published here before any real money moves.",
    blocks: [
      { kind: "table", head: ["Item", "Amount"], rows: [
        ["Account opening", "Free"],
        ["Monthly maintenance", "None"],
        ["Wallet funding", "Free"],
        ["Transfers (demo build)", "₦0"],
        ["Transfer fee (production plan)", "Shown before you confirm, never hidden"],
        ["Savings goals", "Free, no interest paid"],
      ]},
      { kind: "h", text: "Demo limits" },
      { kind: "table", head: ["Limit", "Value"], rows: [
        ["Minimum deposit", "₦100"],
        ["Minimum transfer", "₦100"],
        ["Maximum transfer per transaction", "₦500,000"],
        ["Daily transfer total", "₦1,000,000"],
      ]},
      { kind: "p", text: "Limits are enforced by the backend on every request, not just in the interface. Your own account may have tighter limits if your identity check is still pending or if support has applied a restriction." },
    ],
  },
  "/security": {
    eyebrow: "Security and privacy",
    title: "Money is data. We treat it that way.",
    lede: "The controls below are implemented in the database and server, not only in the interface.",
    blocks: [
      { kind: "list", items: [
        "Row-level security: a student can only read rows that belong to them.",
        "Sensitive columns (BVN, NIN, raw account numbers) are excluded from client grants entirely.",
        "Every money movement is a ledger entry with an immutable reference and a status trail.",
        "Balances are projected from the ledger, so a balance can always be explained line by line.",
        "Transfers take a row lock and place a hold before the provider call, preventing double spending.",
        "Payment webhooks are signature-checked and deduplicated by event ID before any credit posts.",
        "Transfers require a 4-digit PIN. Five wrong attempts lock it for 15 minutes.",
        "Administrators cannot edit a balance. Corrections are ledger entries with a reason and an audit record.",
        "Provider secret keys exist only in server-side environment variables, never in the browser.",
      ]},
      { kind: "h", text: "What we collect" },
      { kind: "p", text: "Only what the service needs: your name, email, phone, date of birth, and the result of your identity check. We keep a hash and the last four digits of your BVN or NIN." },
      { kind: "h", text: "What we do not do" },
      { kind: "p", text: "We do not sell data, do not promise interest, and do not extend credit." },
    ],
  },
  "/help": {
    eyebrow: "Help centre",
    title: "Answers before you have to ask.",
    lede: "Signed-in students can raise a ticket from the Support tab and see replies in the same thread.",
    blocks: [
      { kind: "h", text: "Why can't I add money yet?" },
      { kind: "p", text: "Deposits unlock after your identity check is verified. If your status says REVIEW, support is taking a second look and you will get a notification." },
      { kind: "h", text: "A transfer left my balance but has not landed" },
      { kind: "p", text: "That is the hold. While the bank is still confirming, the amount sits in pending. If the bank fails the transfer, the hold is released automatically and you get a notification." },
      { kind: "h", text: "I forgot my transaction PIN" },
      { kind: "p", text: "Open Settings, confirm your account password, then set a new PIN. Your PIN is never recoverable, only replaceable." },
      { kind: "h", text: "Can I withdraw from a locked goal?" },
      { kind: "p", text: "Not until its unlock date. Flexible goals release instantly back to your available balance." },
      { kind: "h", text: "Does Allawii pay interest?" },
      { kind: "p", text: "No. Allawii is a wallet and a budgeting tool. Any future interest product would require a regulated partner and separate terms." },
    ],
  },
  "/contact": {
    eyebrow: "Contact",
    title: "Talk to a person.",
    lede: "For account-specific issues, the in-app Support tab is the fastest route because it carries your account context with the message.",
    blocks: [
      { kind: "list", items: [
        "In-app: Support tab inside your dashboard",
        "Email: support@allawii.app",
        "Hours: Monday to Saturday, 8:00 to 20:00 WAT",
        "Urgent account security: support@allawii.app with 'SECURITY' in the subject",
      ]},
      { kind: "p", text: "Never send your BVN, card details or PIN in an email or WhatsApp message. Nobody at Allawii will ask for them." },
    ],
  },
  "/terms": {
    eyebrow: "Terms of service",
    title: "The agreement, in plain language.",
    lede: "Demo terms for an evaluation build. Production terms will be issued with the licensed partner before live money movement.",
    blocks: [
      { kind: "h", text: "1. What Allawii is" },
      { kind: "p", text: "Allawii provides a digital wallet interface and budgeting tools. Allawii is not a bank, does not accept deposits as a bank, pays no interest, and does not lend." },
      { kind: "h", text: "2. Eligibility" },
      { kind: "p", text: "You must provide accurate identity information and be old enough to hold an account under Nigerian law, or have verifiable guardian consent where a minor account is offered." },
      { kind: "h", text: "3. Your responsibilities" },
      { kind: "p", text: "Keep your password and PIN private, use an email you control, and tell us immediately if you suspect unauthorised access." },
      { kind: "h", text: "4. Payments and reversals" },
      { kind: "p", text: "Transfers depend on external banking partners. A transfer that fails is released back to your wallet; a transfer that succeeds cannot be recalled unilaterally." },
      { kind: "h", text: "5. Suspension" },
      { kind: "p", text: "Accounts may be frozen where there is suspected fraud, a legal requirement, or a failed identity check. You can always contact support to appeal." },
      { kind: "h", text: "6. Demo disclaimer" },
      { kind: "p", text: "In this build, payments may run in a labelled simulation mode. Simulated money is not real money and is never presented as a settled bank transaction." },
    ],
  },
  "/privacy": {
    eyebrow: "Privacy policy",
    title: "What we hold, and for how long.",
    lede: "A summary of how Allawii handles personal data in this build.",
    blocks: [
      { kind: "h", text: "Data we process" },
      { kind: "p", text: "Account details (name, email, phone, date of birth), identity check results, wallet and transaction records, and support conversations." },
      { kind: "h", text: "How identity data is stored" },
      { kind: "p", text: "Your BVN or NIN is verified once. We keep a cryptographic hash, the last four digits, the provider reference and the decision. Full values are not stored in our application tables." },
      { kind: "h", text: "Sharing" },
      { kind: "p", text: "Identity, payment and bank-transfer data is shared with our payment and verification partner only as required to perform those operations. We do not sell personal data." },
      { kind: "h", text: "Retention" },
      { kind: "p", text: "Transaction and audit records are retained for the period required by financial record-keeping rules. Marketing data is deleted when you ask." },
      { kind: "h", text: "Your choices" },
      { kind: "p", text: "You can request a copy of your data or ask for account closure from the Support tab." },
    ],
  },
  "/disclosures": {
    eyebrow: "KYC and financial services",
    title: "Why identity checks are not optional.",
    lede: "Anything that can move money has to know who is moving it.",
    blocks: [
      { kind: "p", text: "Nigerian financial regulation requires customer identification before wallet funding, transfers or dedicated accounts are enabled. Allawii therefore verifies your BVN or NIN against a licensed verification provider before unlocking those features." },
      { kind: "h", text: "What happens to your data" },
      { kind: "list", items: [
        "You give explicit consent at submission.",
        "Only a hash and the last four digits remain in the application database.",
        "The decision and provider reference are recorded for audit.",
        "Rejected checks can be retried, and support can review an appeal.",
      ]},
      { kind: "h", text: "Not a bank" },
      { kind: "p", text: "Allawii does not accept deposits as a deposit-taking institution and does not pay interest. Balances displayed are wallet balances held with our infrastructure partners under their terms." },
    ],
  },
};

export default function InfoPage() {
  const { pathname } = useLocation();
  const page = pages[pathname] ?? pages["/how-it-works"];

  return (
    <PublicLayout>
      <section className="mx-auto max-w-3xl px-5 pb-8 pt-14">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-[var(--color-brand)]">{page.eyebrow}</p>
        <h1 className="mt-3 text-[2.1rem] leading-[1.1] tracking-[-0.03em] sm:text-[2.6rem]">{page.title}</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">{page.lede}</p>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-16">
        <Card className="p-6 sm:p-8">
          <div className="space-y-6">
            {page.blocks.map((b, i) => {
              if (b.kind === "h") return <h2 key={i} className="text-[15.5px] font-semibold tracking-[-0.01em]">{b.text}</h2>;
              if (b.kind === "p") return <p key={i} className="text-[14px] leading-[1.75] text-[var(--color-ink-soft)]">{b.text}</p>;
              if (b.kind === "list") return (
                <ul key={i} className="space-y-2.5">
                  {b.items.map((it) => (
                    <li key={it} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
                      <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--color-brand)]" /> {it}
                    </li>
                  ))}
                </ul>
              );
              return (
                <div key={i} className="overflow-hidden rounded-xl border border-[var(--color-line)]">
                  <table className="w-full text-left text-[13.5px]">
                    <thead className="bg-[var(--color-paper)] text-[11.5px] uppercase tracking-wide text-[var(--color-ink-soft)]">
                      <tr>{b.head.map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {b.rows.map((r) => (
                        <tr key={r[0]} className="border-t border-[var(--color-line)]">
                          {r.map((c, ci) => <td key={ci} className={ci === 0 ? "px-4 py-2.5 text-[var(--color-ink-soft)]" : "px-4 py-2.5 font-medium"}>{c}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5">
          <p className="text-[13.5px] text-[var(--color-ink-soft)]">Ready to try it with your own numbers?</p>
          <Link to="/signup"><Button size="sm">Create account <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
        </div>
      </section>
    </PublicLayout>
  );
}
