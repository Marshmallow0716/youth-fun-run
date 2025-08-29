// src/FunRunApp.jsx
// Single-file React app Youth Ministry Fun Run
// Features:
// - Event info + FAQs
// - Countdown timer
// - Fundraising tracker (Firestore)
// - Admin-only manual update modal
// - Registration form persisted in Firestore
// - Local QR code generation
// - Post-event feedback link

import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import HeroSection from "./components/HeroSection";


// ----------------------
// 0) EDIT THESE SETTINGS
// ----------------------
const EVENT_TITLE = "Youth Ministry Fun Run";
const EVENT_DATE_LOCAL = "October 04, 2025 05:00"; // Local time
const EVENT_TIMEZONE = "Rizal District";         // For display
const FEEDBACK_FORM_URL = "https://forms.gle/PNAV985iPYEtvG5n6";

// Admin PIN (client-side only)
const ADMIN_PIN = "kumainkanaba?123";

// Firebase Web App Config~ replace these with your Firebase project values
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBdASJ6jOJzzXB5pzs24wxYz7k_CtdqPMw",
  authDomain: "youth-fun-run.firebaseapp.com",
  projectId: "youth-fun-run",
  storageBucket: "youth-fun-run.firebasestorage.app",
  messagingSenderId: "997145617807",
  appId: "1:997145617807:web:f683cb8f8da50b2c4f17fa",
};

// ----------------------------
// 1) Firebase Setup
// ----------------------------
// Firebase initialization
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { getStorage,} from "firebase/storage";

let db;
let storage;

function initFirebaseOnce() {
  if (!getApps().length) {
    const app = initializeApp(FIREBASE_CONFIG);
    db = getFirestore(app);
    storage = getStorage(app);
  }
  return { db, storage };
}

// Firestore document for fundraising totals
const FUND_DOC_PATH = { col: "fundraising", id: "totals" };

// ----------------------------
// 2) Helpers
// ----------------------------
function formatCurrency(num) {
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(Number(num) || 0);
  } catch {
    return `₱${Number(num || 0).toLocaleString()}`;
  }
}

function timeLeft(targetDate) {
  const now = new Date().getTime();
  const diff = new Date(targetDate).getTime() - now;
  if (diff <= 0) return null;
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const m = Math.floor((diff / (1000 * 60)) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return { d, h, m, s };
}

// Tailwind class concatenation
function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

// ----------------------------
// 3) Main Component
// ----------------------------
export default function FunRunApp() {
  const { db } = useMemo(initFirebaseOnce, []);
  const eventDate = useMemo(() => new Date(EVENT_DATE_LOCAL), []);

  // ----------------------------
  // Fundraising state
  // ----------------------------
  const [currentAmount, setCurrentAmount] = useState(0);
  const [goalAmount, setGoalAmount] = useState(100000);
  const [loaded, setLoaded] = useState(false);

  // Countdown state
  const [left, setLeft] = useState(timeLeft(eventDate));

  // Admin modal
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const pinInputRef = useRef(null);
  const [newTotal, setNewTotal] = useState("");
  
  // Registration / QR
  const [view, setView] = useState("home"); // "home" | "qr"
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    age: "",
    ministry: "",
    phone: "",
    shirtSize: "M",
    emergencyContact: "",
    referenceNumber: "",
  });
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false); // <-- new state for button loading


  // ----------------------------
  // Firestore live subscription for fundraising
  // ----------------------------
  useEffect(() => {
    const ref = doc(db, FUND_DOC_PATH.col, FUND_DOC_PATH.id);

    // Ensure document exists with defaults
    (async () => {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          currentAmount: 0,
          goalAmount: 100000,
          updatedAt: new Date().toISOString(),
        });
      }
    })();

    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCurrentAmount(Number(data.currentAmount) || 0);
        setGoalAmount(Number(data.goalAmount) || 0);
        setLoaded(true);
      }
    });

    return () => unsub();
  }, [db]);

  // ----------------------------
  // Countdown interval
  // ----------------------------
  useEffect(() => {
    const id = setInterval(() => setLeft(timeLeft(eventDate)), 1000);
    return () => clearInterval(id);
  }, [eventDate]);

  const percent = Math.max(
    0,
    Math.min(100, goalAmount ? Math.round((currentAmount / goalAmount) * 100) : 0)
  );

  const eventStarted = !left;

  // ----------------------------
  // Admin actions
  // ----------------------------
  function openAdmin() {
    setAdminOpen(true);
    setTimeout(() => pinInputRef.current?.focus(), 50);
  }
  function closeAdmin() {
    setAdminOpen(false);
    setAdminAuthed(false);
    setNewTotal("");
  }
  function checkPin(pin) {
    if (pin === ADMIN_PIN) {
      setAdminAuthed(true);
    } else {
      alert("Incorrect PIN");
    }
  }
  async function saveNewTotal() {
    const number = Number(newTotal);
    if (Number.isNaN(number) || number < 0) {
      alert("Enter a valid non-negative number.");
      return;
    }
    try {
      const ref = doc(db, FUND_DOC_PATH.col, FUND_DOC_PATH.id);
      await setDoc(
        ref,
        { currentAmount: number, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      closeAdmin();
    } catch (e) {
      console.error(e);
      alert("Failed to update amount.");
    }
  }

// ----------------------------
// Registration / QR generation + Firestore + Google Sheets
// ----------------------------
async function handleRegister(e) {
  e.preventDefault();

  if (isGenerating) return;
  setIsGenerating(true);

  try {
    if (!db) {
      alert("Firebase not initialized. Try refreshing the page.");
      return;
    }

    // Required fields check
    const requiredFields = ["fullName", "email", "age", "ministry", "referenceNumber"];
    for (const field of requiredFields) {
      if (!form[field]) {
        alert(`Please fill in ${field.replace(/([A-Z])/g, " $1")}.`);
        setIsGenerating(false);
        return;
      }
    }

    // 1️⃣ Generate a unique ID for this registration
    const regId = `${Date.now()}-${form.fullName.replace(/\s+/g, "-")}`;

    // 2️⃣ Build payload
    const payload = {
      regId,  // <-- unique string to also be QR content
      fullName: form.fullName,
      email: form.email,
      age: Number(form.age) || form.age,
      ministry: form.ministry,
      phone: form.phone || "",
      emergencyContact: form.emergencyContact || "",
      shirtSize: form.shirtSize || "",
      referenceNumber: form.referenceNumber,
      submittedAt: new Date().toISOString(),
      event: EVENT_TITLE,
    };

    // 3️⃣ Save to Firestore
    const regRef = doc(db, "registrations", regId);
    await setDoc(regRef, payload);

    // 4️⃣ Send to Google Sheets (as JSON)
    try {
      const response = await fetch(
        "https://script.google.com/macros/s/AKfycbyWwl6Alab4FfC7ERLmIlNFyQNNfcI3c_jhrsz1viLho09Su6HV7IW8SDFL_nuwLvqA/exec",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();
      console.log("Google Sheets response:", result);
      if (result.status !== "success") console.warn("Google Sheets error:", result.message);
    } catch (err) {
      console.error("Failed to send to Google Sheet", err);
    }

    // 5️⃣ Generate QR code (just from regId)
    const dataUrl = await QRCode.toDataURL(regId, { margin: 1, width: 256 });
    setQrDataUrl(dataUrl);
    setView("qr");

  } catch (err) {
    console.error(err);
    alert("Failed to register and generate QR code.");
  } finally {
    setIsGenerating(false);
  }
}

  // ----------------------------
  // UI Sections
  // ----------------------------
  return (
<div className="min-h-screen text-gray-800">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white/10 backdrop-blur-md border-b border-white/20 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
          {/* Logo + Title */}
          <div className="flex items-center gap-3">
            {/* Logo image */}
            <img src="/youth-home-rizal-logo-white.png" alt="Youth Fun Run Logo" className="w-16 h-16 rounded-xl" />
            
            <div>
              <h1 className="font-bold text-lg leading-5">{EVENT_TITLE}</h1>
              <p className="text-xs text-gray-500">{eventDate.toLocaleDateString()} • {EVENT_TIMEZONE}</p>
            </div>
          </div>

          {/* Admin button */}
          <button className="text-xs text-gray-600 hover:text-gray-700" onClick={openAdmin} aria-label="Admin" title="Admin">
            Admin
          </button>
        </div>
      </header>

      {/* Hero Section (imported) */}
      <HeroSection eventStarted={eventStarted} />
<div className="bg-gradient-to-b from-[#1E223D] to-[#1B3C6A]">

      {/* Fundraising Tracker (keep this part after Hero) */}
      <section className="max-w-6xl mx-auto px-4 pt-10 pb-6">
        <div className="bg-white border rounded-2xl shadow p-6">
          <h3 className="font-bold text-lg text-blue-400">#TakboParaSaYouth </h3>
          <h3 className="font-bold text-lg">Fundraising Progress</h3>

          <p className="text-sm text-gray-500">Live total updates. Thank YouTh po!</p>

          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold">{formatCurrency(currentAmount)}</span>
              <span className="text-sm text-gray-500">Goal: {formatCurrency(goalAmount)}</span>
            </div>

            <div className="mt-3 h-3 rounded-full bg-gray-100 border overflow-hidden">
              <div
                className={cx("h-full transition-all", percent >= 100 ? "bg-[#F59124]" : "bg-[#F59124]")}
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="mt-2 text-right text-xs text-gray-500">
              {loaded ? `${percent}%` : "Loading…"}
            </div>
          </div>
        </div>
      </section>

      {/* Registration + FAQs */}
      {view === "home" && (
        <main className="max-w-6xl mx-auto px-4 pb-16 grid md:grid-cols-3 gap-8">
          <section className="md:col-span-2">
            <div className="bg-white border rounded-2xl shadow p-6">
              <h3 className="text-xl font-bold">Register</h3>
              <p className="text-sm text-gray-500">Fill this out and we’ll generate your check-in QR code instantly.</p>
              <section id="registration-form">
              <form className="mt-6 grid gap-4" onSubmit={handleRegister}>
                <Input label="Full Name" required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
                <Input label="Email Address" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Age" type="number" required value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))} />
                  <Input label="Ministry" placeholder="e.g., Youth, Music, Kids" required value={form.ministry} onChange={(e) => setForm((f) => ({ ...f, ministry: e.target.value }))} />
                </div>
                <Input label="Mobile Number" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                <div>
                  <label className="block text-sm font-medium text-gray-700">Shirt Size</label>
                  <select className="mt-1 w-full rounded-lg border-gray-300 focus:border-red-500 focus:ring-red-500" value={form.shirtSize} onChange={(e) => setForm((f) => ({ ...f, shirtSize: e.target.value }))}>
                    {["XS", "S", "M", "L", "XL", "2XL"].map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </div>
                <Input label="Emergency Contact (Name & Phone)" value={form.emergencyContact} onChange={(e) => setForm((f) => ({ ...f, emergencyContact: e.target.value }))} />

                {/* Reference Number */}
                <Input
                  label="Reference Number (Proof of Payment)"
                  required
                  value={form.referenceNumber}
                  onChange={(e) => setForm((f) => ({ ...f, referenceNumber: e.target.value }))}
                />

                {/* Payment Instructions */}
                <div className="mt-2 p-3 bg-gray-50 border rounded-lg flex items-center gap-4">
                  {/* Placeholder QR code */}
                  <img
                    src="/magic-gcash-qr.png"
                    alt="GCash/Maya QR Code"
                    className="w-[140px] h-[140px] object-contain"
                  />

                  {/* Payment number */}
                  <div className="text-sm text-gray-700">
                    <p className="font-semibold">Send your payment to:</p>
                    <p>+639696392759 (GCash / Maya)</p>
                  </div>
                </div>
                  <button
                    type="submit"
                    className="mt-2 inline-flex items-center justify-center rounded-xl bg-[#F59124] px-5 py-3 font-semibold text-white shadow hover:bg-[#b16616] disabled:opacity-60"
                    disabled={isGenerating}
                  >
                    {isGenerating ? "Generating QR..." : "Generate my QR code"}
                  </button>
              </form>
              </section>
            </div>
          </section>

          <aside>
            <div className="bg-white border rounded-2xl shadow p-6">
              <h3 className="text-xl font-bold mb-4">FAQs</h3>
              <Faq q="Where and when is the run?" a={`The run starts at 5:00 AM on ${eventDate.toLocaleDateString()} Marikina Heights. Check-in opens at 4:00 AM.`} />
              <Faq q="How long are the routes?" a="We have a 3K and a 5K route. Maps will be posted here before the event. Walkers are welcome!" />
              <Faq q="Is there a registration fee?" a="Registration is Php 500. Donations are welcome through church channels. You may register through this website." />
              <Faq q="What do I get when I register?" a="All runners get medals, race kits, snacks, a FUN run, and more!" />
              <Faq q="Who can join the fun run?" a="All are welcome!" />
              <Faq q="What should I bring?" a="Comfortable running shoes, water bottle, and your phone with the QR code for fast check-in." />
              <Faq q="Can I register on the day of event?" a="To ensure we have enough kits and medals, please register before the event via online or your local Rizal District Feast near you." />
              <Faq q="What if I can't run the full distance?" a="No worries! You can walk, jog, or run at your own pace. The event is all about fun and community!" />
              <Faq q="Is there a cut-off time?" a="The event officially ends at 9:00 AM, but you can finish your run at your own pace." />
              <Faq q="Pwede pa mag dagdag ng tanong" a="inform niyo lang po ako if may ipapalagay kayo na tanong, nilagay ko lang muna usual na FAQs ng mga nasasalihan kong marathon" />
              <Faq q="Kumain na ba'ko?" a="hahahaha" />
              <Faq q="La na ko maisip na tanong" a="I surrender." />
              <Faq q="Gcash ko talaga yan ha :>" a="wag kalimutan palitan haha -marshall" />
            </div>
          </aside>
        </main>
      )}

      {/* QR View */}
      {view === "qr" && (
        <section className="max-w-xl mx-auto px-4 pb-20">
          <div className="bg-white border rounded-2xl shadow p-8 text-center">
            <h3 className="text-2xl font-bold">Your Registration QR</h3>
            <p className="text-gray-600 mt-1">We're verifying your proof of payment.<br></br>Save this image or keep this page open for event check-in.</p>

            <div className="mt-6 flex justify-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Registration QR code" className="w-52 h-52 border rounded-xl shadow" />
              ) : (
                <div className="w-52 h-52 grid place-content-center border rounded-xl">Generating…</div>
              )}
            </div>

            <div className="mt-6 text-left bg-gray-50 rounded-xl p-4 text-sm text-gray-700">
              <p className="font-semibold">What’s next?</p>
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>Screenshot or save the QR image. You’ll show it at check-in.</li>
                <li>Watch this page for updates, route maps, and day-of reminders.</li>
                <li>After the event, please share feedback: <a className="text-red-600 underline" href={FEEDBACK_FORM_URL} target="_blank" rel="noreferrer">Go to Feedback Survey</a></li>
              </ul>
            </div>

            <button className="mt-6 inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm hover:bg-gray-50" onClick={() => setView("home")}>Back to Home</button>
          </div>
        </section>
      )}
</div>

      {/* Footer */}
<footer className="border-t border-gray-700/40 bg-[#141830]/95 text-gray-300">
  <div className="max-w-6xl mx-auto px-4 py-7 text-center text-sm text-gray-500">
    <div className="flex justify-center gap-4 mb-3">
      <a href="https://www.facebook.com/youthhomerizal" target="_blank" rel="noreferrer">
        <img src="/icons/facebook.png" alt="Facebook" className="w-6 h-6"/>
      </a>
      <a href="https://www.instagram.com/youthhomerizal/" target="_blank" rel="noreferrer">
        <img src="/icons/instagram.png" alt="Instagram" className="w-6 h-6"/>
      </a>
      <a href="https://tiktok.com/@youthhomerizal" target="_blank" rel="noreferrer">
        <img src="/icons/tiktok.png" alt="TikTok" className="w-6 h-6"/>
      </a>
    </div>
    {EVENT_TITLE} | by Feast Youth - Rizal District.<br />
    © {new Date().getFullYear()} Marshnandez. All Rights Reserved.
  </div>
</footer>

      {/* Admin Modal */}
      {adminOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4" onClick={closeAdmin}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold">Admin Panel</h4>
              <button onClick={closeAdmin} className="rounded-full p-2 hover:bg-gray-100">✕</button>
            </div>

            {!adminAuthed ? (
              <div className="mt-4">
                <p className="text-sm text-gray-600">Enter admin PIN to access admin features.</p>
                <input ref={pinInputRef} type="password" className="mt-3 w-full rounded-lg border-gray-300 focus:border-red-500 focus:ring-red-500" placeholder="PIN" onKeyDown={(e) => { if (e.key === "Enter") checkPin(e.currentTarget.value); }} />
                <div className="text-xs text-gray-400 mt-2">(Client-side only; for lightweight use.)</div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm text-gray-600">Current Total</div>
                  <div className="text-2xl font-bold">{formatCurrency(currentAmount)}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">New Total Amount (PHP)</label>
                  <input type="number" min="0" className="mt-1 w-full rounded-lg border-gray-300 focus:border-red-500 focus:ring-red-500" value={newTotal} onChange={(e) => setNewTotal(e.target.value)} placeholder="e.g., 75000" />
                </div>

                <div className="flex justify-end gap-3">
                  <button className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50" onClick={closeAdmin}>Cancel</button>
                  <button className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700" onClick={saveNewTotal}>Save Total</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------
// Reusable UI components
// ----------------------------
function Input({ label, required, className, ...props }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        {...props}
        required={required}
        className={cx(
          "mt-1 w-full rounded-lg border-gray-400 bg-gray-50",
          "focus:border-red-500 focus:ring-red-500 focus:shadow-md transition duration-200",
          className
        )}
      />
    </div>
  );
}


function Faq({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg mb-3 overflow-hidden">
      <button className="w-full text-left px-4 py-3 font-medium hover:bg-gray-50 flex items-center justify-between" onClick={() => setOpen((o) => !o)}>
        <span>{q}</span>
        <span className="text-gray-400">{open ? "–" : "+"}</span>
      </button>
      {open && <div className="px-4 pb-4 text-gray-600">{a}</div>}
    </div>
  );
}

// ----------------------------
// To update and push online, type niyo lang to sa terminal :))
//git add .
//git commit -m "Update message here"
//git push origin main
// ----------------------------


//to add+ SNAP ON SCROLL effect on Gallery Section.
//to add+ Parallax effect on Youth Rizal people Picture above Footer.
//to add+ Lazy loading sa mga images ng Gallery Section.
//to add+ frost/glass and glow effect sa mga buttons and cards. test lang kung maganda.
//to add+ link to developer website on Marshnandez footer text.
//to add+ hover effect sa mga images ng Gallery Section.
//to add+ maps route section after FAQs. para sa route ng 3k at 5k.
//to add+ QR Code to verify claimable lootbags sa event.
//to add+ auto email send to registrant with QR code attachment. (need backend for this)
// ----------------------------
// SYSTEM FLOW
// 1) User visits site, sees event info, countdown, fundraising tracker, FAQs.
// 2) User fills out registration form, submits.
// 3) Form data saved to Firestore and Google Sheets.
// 4) QR code generated locally and displayed to user.
// 5) User shows QR code at event for check-in.
// 6) Admin can update fundraising total via PIN-protected modal.
// ----------------------------
// END OF FILE