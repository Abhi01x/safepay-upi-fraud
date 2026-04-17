import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Html5Qrcode } from 'html5-qrcode';

/**
 * Parses a UPI deep-link QR payload.
 * Accepts:
 *   1. upi://pay?pa=name@bank&pn=Name&am=100.00&cu=INR&tn=Note
 *   2. plain UPI IDs like "merchant@okaxis"
 * Returns null if payload is neither.
 */
function parseUpiQR(text) {
  if (!text) return null;
  const trimmed = text.trim();

  if (/^[\w.\-]+@[\w]+$/.test(trimmed)) {
    return { upi: trimmed, name: '', amount: '', note: '' };
  }
  try {
    const url = new URL(trimmed);
    if (!/^upi:?$/i.test(url.protocol.replace(':', ''))) return null;
    const params = url.searchParams;
    return {
      upi: params.get('pa') || '',
      name: params.get('pn') || '',
      amount: params.get('am') || '',
      note: params.get('tn') || '',
      currency: params.get('cu') || 'INR',
    };
  } catch {
    return null;
  }
}

export default function QRScanner({ onScan, onClose }) {
  const scannerId = 'qr-scanner-region';
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Requesting camera…');
  const [mode, setMode] = useState('camera'); // 'camera' | 'image' | 'manual'
  const [manualUpi, setManualUpi] = useState('');

  // Start camera when in camera mode
  useEffect(() => {
    if (mode !== 'camera') return;
    let html5QrCode = null;
    let mounted = true;

    const start = async () => {
      try {
        // Check HTTPS / localhost requirement upfront
        const isSecure = window.isSecureContext || window.location.hostname === 'localhost';
        if (!isSecure) {
          setError('Camera requires HTTPS. Open the site over https:// or use localhost.');
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('This browser does not support camera access.');
          return;
        }

        html5QrCode = new Html5Qrcode(scannerId, { verbose: false });
        scannerRef.current = html5QrCode;

        setStatus('Point camera at UPI QR code');

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (!mounted) return;
            const parsed = parseUpiQR(decodedText);
            if (parsed && parsed.upi) {
              html5QrCode.stop().then(() => {
                html5QrCode.clear();
                onScan(parsed);
              }).catch(() => onScan(parsed));
            } else {
              setStatus('Not a UPI QR — keep scanning…');
            }
          },
          () => { /* per-frame decode fail is normal */ }
        );
      } catch (e) {
        console.error('[QRScanner] start error:', e);
        const msg = String(e?.message || e || '');
        if (/permission|denied|NotAllowed/i.test(msg)) {
          setError('Camera permission denied. Allow camera in your browser and retry.');
        } else if (/NotFound|no camera/i.test(msg)) {
          setError('No camera found on this device.');
        } else if (/NotReadable|in use/i.test(msg)) {
          setError('Camera is in use by another app.');
        } else {
          setError(`Camera failed: ${msg.slice(0, 100) || 'Unknown error'}`);
        }
      }
    };

    start();

    return () => {
      mounted = false;
      const s = scannerRef.current;
      if (s) {
        try {
          s.stop().then(() => s.clear()).catch(() => {});
        } catch {}
      }
    };
  }, [mode, onScan]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const html5QrCode = new Html5Qrcode(scannerId, { verbose: false });
      const decoded = await html5QrCode.scanFile(file, false);
      const parsed = parseUpiQR(decoded);
      if (parsed && parsed.upi) {
        onScan(parsed);
      } else {
        setError('QR decoded but it is not a UPI payment code.');
      }
    } catch (err) {
      setError('Could not decode QR from image. Try a clearer photo.');
    }
  };

  const handleManualSubmit = () => {
    const parsed = parseUpiQR(manualUpi);
    if (parsed && parsed.upi) onScan(parsed);
    else setError('Not a valid UPI ID (format: name@bank)');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-14 pb-4">
        <button
          onClick={onClose}
          className="w-10 h-10 bg-white/10 backdrop-blur rounded-full flex items-center justify-center"
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-white text-sm font-bold">Scan UPI QR</h2>
        <div className="w-10" />
      </div>

      {/* Scanner / Image / Manual region */}
      <div className="flex-1 flex flex-col items-center justify-center relative px-6">
        <div
          id={scannerId}
          className={`w-full max-w-sm aspect-square rounded-3xl overflow-hidden bg-black ${mode !== 'camera' ? 'hidden' : ''}`}
        />

        {mode === 'camera' && !error && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 pointer-events-none">
            <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-primary rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-primary rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-primary rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-primary rounded-br-2xl" />
            <motion.div
              className="absolute left-0 right-0 h-0.5 bg-primary shadow-[0_0_12px_4px_rgba(124,111,255,0.8)]"
              initial={{ top: 0 }}
              animate={{ top: ['0%', '100%', '0%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        )}

        {mode === 'image' && (
          <div className="w-full max-w-sm">
            <label className="block w-full aspect-square border-2 border-dashed border-primary/40 rounded-3xl flex flex-col items-center justify-center cursor-pointer bg-primary/5">
              <svg width="42" height="42" fill="none" viewBox="0 0 24 24" stroke="#7C6FFF" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 0L8 8m4-4l4 4" />
              </svg>
              <p className="text-primary text-sm font-bold mt-3">Upload QR Image</p>
              <p className="text-text-muted text-[11px] mt-1">PNG, JPG, or screenshot</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>
        )}

        {mode === 'manual' && (
          <div className="w-full max-w-sm bg-dark-card border border-dark-border rounded-3xl p-5">
            <label className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-2 block">UPI ID</label>
            <input
              type="text"
              placeholder="name@bank"
              value={manualUpi}
              onChange={(e) => setManualUpi(e.target.value)}
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 outline-none text-sm text-white font-medium focus:border-primary/40"
              autoFocus
            />
            <button
              onClick={handleManualSubmit}
              disabled={!manualUpi.trim()}
              className="w-full mt-4 py-3 bg-gradient-to-r from-primary to-primary-dark text-white text-sm font-bold rounded-xl disabled:opacity-50"
            >
              Use this UPI ID
            </button>
          </div>
        )}
      </div>

      {/* Footer — status / error / mode tabs */}
      <div className="px-6 pb-10 pt-4">
        {error ? (
          <div className="bg-danger/15 border border-danger/30 rounded-2xl px-4 py-3 mb-3">
            <p className="text-danger text-xs font-semibold">{error}</p>
            <p className="text-text-muted text-[10px] mt-1">Try another method below.</p>
          </div>
        ) : (
          mode === 'camera' && (
            <p className="text-white text-sm font-semibold text-center mb-3">{status}</p>
          )
        )}

        {/* Mode tabs */}
        <div className="grid grid-cols-3 gap-2 bg-dark-card border border-dark-border rounded-2xl p-1">
          {[
            { key: 'camera', label: 'Camera' },
            { key: 'image', label: 'Upload' },
            { key: 'manual', label: 'Manual' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setError(''); setMode(t.key); }}
              className={`py-2.5 rounded-xl text-[11px] font-bold transition-colors ${
                mode === t.key
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
