import { useState, useEffect } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';import { auth } from '../../config/firebase';
import { Smartphone, Check, Loader2 } from 'lucide-react';

declare global {
  interface Window { recaptchaVerifier: RecaptchaVerifier; }
}

export const LoginScreen = () => {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [confirmObj, setConfirmObj] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible'
      });
    }
  }, []);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const confirmation = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      setConfirmObj(confirmation);
      setStep('code');
    } catch (err: any) {
      setError(err.message || "Failed to send code.");
      console.error(err);
    }
    setLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (confirmObj) await confirmObj.confirm(code);
    } catch (err) {
      setError("Invalid code.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-blue-500/10 rounded-full text-blue-400">
            <Smartphone size={32} />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-white mb-2">Welcome Back</h2>
        <p className="text-slate-400 text-center mb-8 text-sm">Sign in to access your second brain.</p>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">{error}</div>}

        {step === 'phone' ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Phone Number</label>
              <input 
                type="tel" 
                placeholder="+1 555 123 4567"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-blue-500 focus:outline-none mt-1"
              />
            </div>
            <div id="recaptcha-container"></div>
            <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all flex justify-center">
              {loading ? <Loader2 className="animate-spin" /> : "Send Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
             <div>
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Verification Code</label>
              <input 
                type="text" 
                placeholder="123456"
                value={code}
                onChange={e => setCode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-emerald-500 focus:outline-none mt-1 text-center text-xl tracking-widest"
              />
            </div>
            <button disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all flex justify-center">
              {loading ? <Loader2 className="animate-spin" /> : <span className="flex items-center gap-2"><Check size={18} /> Verify</span>}
            </button>
            <button type="button" onClick={() => setStep('phone')} className="w-full text-xs text-slate-500 hover:text-white py-2">Wrong number?</button>
          </form>
        )}
      </div>
    </div>
  );
};
