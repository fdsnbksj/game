import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Page } from '../components/Page';
import { reloadFresh } from '../reload';
import { accountError, createAccount, resetPassword, signIn, signOut } from '../services/account';
import { renamePlayer } from '../services/players';
import { useGameStore } from '../store';

export function Account() {
  const uid = useGameStore((s) => s.uid);
  const player = useGameStore((s) => s.player);
  const email = useGameStore((s) => s.email);
  const [signingIn, setSigningIn] = useState(false);

  return (
    <Page title="Account" back={null}>
      {!uid || !player ? (
        <p className="note">Connecting… Accounts need a connection. The games don't.</p>
      ) : email ? (
        <>
          <div className="group">
            <div className="row">
              <span>Signed in</span>
              <span className="row-detail">{email}</span>
            </div>
          </div>
          <p className="group-title">Your name</p>
          <div className="group card-pad">
            <NameEditor name={player.displayName} />
          </div>
          <button className="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <p className="group-title">Your name</p>
          <div className="group card-pad">
            <NameEditor name={player.displayName} />
          </div>
          <p className="note">You're playing as a guest. An account keeps your progress and name on any phone.</p>
          {signingIn ? (
            <EmailForm />
          ) : (
            <button className="button primary" onClick={() => setSigningIn(true)}>
              Sign in or create account
            </button>
          )}
        </>
      )}

      <div className="group">
        <Link className="row" to="/settings">
          <span>Settings</span>
          <svg className="chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
      <button className="button ghost" onClick={() => void reloadFresh()}>
        Reload the latest version
      </button>
    </Page>
  );
}

/** Create an account from this guest, or sign in to an existing one. */
function EmailForm() {
  const [mode, setMode] = useState<'create' | 'signin'>('create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'create') await createAccount(email, password);
      else await signIn(email, password);
    } catch (error) {
      setMessage({ text: accountError(error), error: true });
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) return setMessage({ text: 'Type your email first, then tap this again.', error: true });
    try {
      await resetPassword(email);
      setMessage({ text: `A reset link is on its way to ${email.trim()}.`, error: false });
    } catch (error) {
      setMessage({ text: accountError(error), error: true });
    }
  };

  return (
    <form className="group card-pad form" onSubmit={(event) => void submit(event)}>
      <div className="segmented" role="radiogroup" aria-label="Account">
        <button type="button" role="radio" aria-checked={mode === 'create'} onClick={() => setMode('create')}>
          Create account
        </button>
        <button type="button" role="radio" aria-checked={mode === 'signin'} onClick={() => setMode('signin')}>
          Sign in
        </button>
      </div>
      <input className="field" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input
        className="field"
        type="password"
        autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
        placeholder={mode === 'create' ? 'Password (6+ characters)' : 'Password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {mode === 'signin' && (
        <p className="note">Signing in switches to that account. This guest's progress stays behind.</p>
      )}
      {message && <p className={message.error ? 'error' : 'note'}>{message.text}</p>}
      <button className="button primary" disabled={busy || !email.trim() || !password}>
        {mode === 'create' ? 'Create account' : 'Sign in'}
      </button>
      {mode === 'signin' && (
        <button type="button" className="button ghost" onClick={() => void forgot()}>
          Forgot password?
        </button>
      )}
    </form>
  );
}

function NameEditor({ name }: { name: string }) {
  const [draft, setDraft] = useState(name);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const trimmed = draft.trim();
  const canSave = trimmed.length > 0 && trimmed !== name && status !== 'saving';

  async function save() {
    setStatus('saving');
    try {
      await renamePlayer(trimmed);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <form
      className="name-editor"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <input aria-label="Name" value={draft} maxLength={20} onChange={(e) => setDraft(e.target.value)} />
      <button className="button" disabled={!canSave}>
        {status === 'saved' && trimmed === name ? 'Saved' : 'Save'}
      </button>
      {status === 'error' && <span className="error">Couldn't save</span>}
    </form>
  );
}
