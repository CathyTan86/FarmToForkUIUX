import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Home, Activity, ScanLine, DollarSign, User, Bell, Leaf, Camera, Heart,
  Clock, MapPin, CheckCircle2, Circle, TrendingUp, TrendingDown, ChevronLeft, ChevronRight,
  X, ShoppingBag, Car, Zap, Coffee, Sparkles, Info, Wallet, Flame, Award,
  ArrowUpRight, RotateCcw, Plus, CalendarDays, Trophy, Building2, Bus, Plane,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
  AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";

/* =========================================================================
   SIMULATION DATA
   Emission factors below are illustrative approximations modeled on
   widely-cited global-average lifecycle-assessment figures (e.g. Poore &
   Nemecek, Science 2018) and consumption-based (EEIO-style) spend
   intensities. They are for demo/PoC purposes, not certified measurements.
   ========================================================================= */

// Per-item nutrition estimates for the metabolic metrics below:
//  - carbsG / sugarG: grams in the typical portion (portionKg)
//  - gi: glycemic index (0-100), used with carbsG to derive Glycemic Load
//  - pral: Potential Renal Acid Load in mEq for the portion (Remer & Manz
//    style values) — positive = acid-forming (draws on bicarbonate
//    buffering), negative = alkaline-forming (spares it). These are
//    published-average approximations for common preparations, not
//    lab-measured values for a specific item.
//  - priceUsd: illustrative typical retail price for the portion, used to
//    compute kg CO2e PER DOLLAR spent on that specific item — i.e. how
//    carbon-efficient (or expensive) a dollar of that food is, not just its
//    per-kg footprint. Same illustrative-estimate caveat applies.
const FOOD_DB = [
  { id: "beef", name: "Beef", category: "Red Meat", kgPerKg: 60, portionKg: 0.2, plant: false, emoji: "🥩", carbsG: 0, sugarG: 0, gi: 0, pral: 15.6, priceUsd: 3.50 },
  { id: "lamb", name: "Lamb", category: "Red Meat", kgPerKg: 24, portionKg: 0.2, plant: false, emoji: "🍖", carbsG: 0, sugarG: 0, gi: 0, pral: 15.2, priceUsd: 4.50 },
  { id: "cheese", name: "Cheese", category: "Dairy", kgPerKg: 21, portionKg: 0.05, plant: false, emoji: "🧀", carbsG: 1, sugarG: 1, gi: 0, pral: 9.6, priceUsd: 1.20 },
  { id: "pork", name: "Pork", category: "Meat", kgPerKg: 7, portionKg: 0.2, plant: false, emoji: "🥓", carbsG: 0, sugarG: 0, gi: 0, pral: 15.8, priceUsd: 2.20 },
  { id: "chicken", name: "Chicken", category: "Poultry", kgPerKg: 6, portionKg: 0.2, plant: false, emoji: "🍗", carbsG: 0, sugarG: 0, gi: 0, pral: 17.4, priceUsd: 1.80 },
  { id: "salmon", name: "Farmed Salmon", category: "Fish", kgPerKg: 5, portionKg: 0.2, plant: false, emoji: "🐟", carbsG: 0, sugarG: 0, gi: 0, pral: 15.8, priceUsd: 4.00 },
  { id: "eggs", name: "Eggs", category: "Dairy", kgPerKg: 4.5, portionKg: 0.12, plant: false, emoji: "🥚", carbsG: 1, sugarG: 1, gi: 0, pral: 9.8, priceUsd: 0.60 },
  { id: "rice", name: "Rice", category: "Grain", kgPerKg: 4, portionKg: 0.15, plant: true, emoji: "🍚", carbsG: 42, sugarG: 0, gi: 73, pral: 2.6, priceUsd: 0.20 },
  { id: "tofu", name: "Tofu", category: "Plant Protein", kgPerKg: 3, portionKg: 0.15, plant: true, emoji: "🧊", carbsG: 3, sugarG: 1, gi: 15, pral: 0.5, priceUsd: 1.00 },
  { id: "milk", name: "Dairy Milk", category: "Dairy", kgPerKg: 3, portionKg: 0.25, plant: false, emoji: "🥛", carbsG: 12, sugarG: 12, gi: 35, pral: 2.8, priceUsd: 0.35 },
  { id: "oatmilk", name: "Oat Milk", category: "Plant Milk", kgPerKg: 0.9, portionKg: 0.25, plant: true, emoji: "🌾", carbsG: 17, sugarG: 7, gi: 65, pral: -1.0, priceUsd: 0.60 },
  { id: "lentils", name: "Lentils", category: "Legumes", kgPerKg: 2, portionKg: 0.15, plant: true, emoji: "🫘", carbsG: 30, sugarG: 2, gi: 32, pral: 5.3, priceUsd: 0.30 },
  { id: "veg", name: "Mixed Vegetables", category: "Produce", kgPerKg: 2, portionKg: 0.2, plant: true, emoji: "🥦", carbsG: 14, sugarG: 4, gi: 40, pral: -6.0, priceUsd: 1.20 },
  { id: "potato", name: "Potatoes", category: "Produce", kgPerKg: 0.5, portionKg: 0.2, plant: true, emoji: "🥔", carbsG: 34, sugarG: 1, gi: 78, pral: -8.0, priceUsd: 0.50 },
  { id: "fruit", name: "Seasonal Fruit", category: "Produce", kgPerKg: 1.1, portionKg: 0.2, plant: true, emoji: "🍎", carbsG: 26, sugarG: 20, gi: 45, pral: -7.0, priceUsd: 1.00 },
  { id: "nuts", name: "Mixed Nuts", category: "Plant Protein", kgPerKg: 2.3, portionKg: 0.03, plant: true, emoji: "🥜", carbsG: 6, sugarG: 1, gi: 15, pral: 1.8, priceUsd: 0.80 },
];

const BASELINE_MEAL_KG = 3.0; // avg conventional-diet meal, used to score "swaps"

// Each category's total emission multiplier (kg CO2e per $) is decomposed into
// a "direct" component (emissions at the point of sale/use — combustion,
// on-site energy) and an "indirect" component (upstream supply-chain
// emissions embedded in the good/service). This mirrors how a Leontief
// total-requirements matrix (I - A)^-1 splits into the direct-requirements
// matrix A plus the indirect ripple effects captured by the inverse — here
// simplified to two aggregate terms per category rather than a full
// sector-by-sector matrix.
const SPEND_CATEGORIES = [
  { id: "groceries", label: "Groceries", direct: 0.15, indirect: 0.30, icon: ShoppingBag, color: "#0d9488" },
  { id: "dining", label: "Dining Out", direct: 0.20, indirect: 0.35, icon: Coffee, color: "#d97706" },
  { id: "transport", label: "Transport & Fuel", direct: 0.65, indirect: 0.25, icon: Car, color: "#e11d48" },
  { id: "utilities", label: "Utilities", direct: 0.45, indirect: 0.20, icon: Zap, color: "#3b82f6" },
  { id: "shopping", label: "Shopping", direct: 0.10, indirect: 0.30, icon: ShoppingBag, color: "#7c3aed" },
].map((c) => ({ ...c, factor: c.direct + c.indirect }));
const MONTHLY_BUDGET_KG = 220;

const ACTIONS = [
  { id: "plantmeal", label: "Ate a fully plant-based meal", kg: 3.0 },
  { id: "localproduce", label: "Bought from a local market", kg: 0.8 },
  { id: "nowaste", label: "Zero food waste today", kg: 1.2 },
  { id: "reusable", label: "Used reusable containers / bags", kg: 0.3 },
  { id: "walked", label: "Walked or cycled instead of driving", kg: 2.0 },
];

const PLACES = [
  { name: "Vegan Café", tag: "Café", dist: "0.3 km", blurb: "Plant-based menu, compostable packaging.", color: "text-teal-400" },
  { name: "Local Market", tag: "Grocer", dist: "0.6 km", blurb: "Regional produce, low food miles.", color: "text-amber-400" },
  { name: "Farmer's Co-op", tag: "Grocer", dist: "0.9 km", blurb: "Direct-from-farm, seasonal stock.", color: "text-teal-400" },
  { name: "Zero Waste Refillery", tag: "Shop", dist: "1.1 km", blurb: "Bulk goods, bring-your-own container.", color: "text-sky-400" },
];

// CeroEvents: emissions from getting TO an event, since that's usually the
// dominant footprint driver for a one-off event (wedding, conference,
// festival) that ordinary food/spend tracking doesn't capture. Per-km
// factors are illustrative approximations modeled on published transport
// emission-factor tables (e.g. UK DEFRA/BEIS-style kg CO2e per passenger-km).
const TRAVEL_MODES = [
  { id: "car", label: "Car (solo)", factor: 0.17, icon: Car },
  { id: "carpool", label: "Carpool / Rideshare", factor: 0.09, icon: Car },
  { id: "transit", label: "Public Transit", factor: 0.05, icon: Bus },
  { id: "flight_dom", label: "Domestic Flight", factor: 0.15, icon: Plane },
  { id: "flight_intl", label: "Int'l Flight", factor: 0.11, icon: Plane },
  { id: "walk", label: "Walk / Bike", factor: 0, icon: Leaf },
];
const travelModeById = Object.fromEntries(TRAVEL_MODES.map((m) => [m.id, m]));

const EVENT_TYPES = ["Wedding", "Conference", "Concert/Festival", "Sports Game", "Corporate Offsite", "Other"];

const SEED_EVENTS = [
  { uid: "ev1", name: "Sarah & Jon's Wedding", type: "Wedding", modeId: "carpool", distanceKm: 38, daysAgo: 9 },
  { uid: "ev2", name: "TechConf 2026", type: "Conference", modeId: "transit", distanceKm: 12, daysAgo: 6 },
  { uid: "ev3", name: "Summer Music Festival", type: "Concert/Festival", modeId: "flight_dom", distanceKm: 420, daysAgo: 3 },
];

const ECO_VENUES = [
  { name: "GreenHall Conference Center", tag: "Conference", dist: "1.4 km", blurb: "Solar-powered, zero-waste catering.", color: "text-teal-600" },
  { name: "Solar Pavilion", tag: "Wedding", dist: "2.1 km", blurb: "100% renewable energy, compostable decor.", color: "text-amber-600" },
  { name: "EcoDome Festival Grounds", tag: "Festival", dist: "5.6 km", blurb: "On-site recycling, low-emission generators.", color: "text-teal-600" },
  { name: "Community Garden Amphitheater", tag: "Outdoor", dist: "0.9 km", blurb: "Open-air venue, no HVAC emissions.", color: "text-sky-600" },
];

// Simulated for demo purposes — a real build would pull this from friends'
// actual logged events.
const FRIENDS_LEADERBOARD = [
  { name: "Maya", avgKg: 8.2 },
  { name: "Devon", avgKg: 14.5 },
  { name: "Priya", avgKg: 6.1 },
  { name: "Alex", avgKg: 22.3 },
];

// Simulated per-transport-mode average kg CO2e across the friend group —
// lets the radar show WHICH leg of the emissions chain (car vs flight vs
// transit, etc.) is driving footprint, not just one aggregate number.
const GROUP_AVG_BY_MODE = {
  car: 2.4, carpool: 1.1, transit: 0.6, flight_dom: 4.8, flight_intl: 2.2, walk: 0.1,
};

// Seed history so charts/streaks look real on first load. daysAgo: 0 = today.
const SEED_FOOD_LOG = [
  { uid: "s1", foodId: "veg", daysAgo: 5 },
  { uid: "s2", foodId: "chicken", daysAgo: 5 },
  { uid: "s3", foodId: "oatmilk", daysAgo: 4 },
  { uid: "s4", foodId: "beef", daysAgo: 3 },
  { uid: "s5", foodId: "lentils", daysAgo: 3 },
  { uid: "s6", foodId: "tofu", daysAgo: 2 },
  { uid: "s7", foodId: "fruit", daysAgo: 2 },
  { uid: "s8", foodId: "cheese", daysAgo: 1 },
  { uid: "s9", foodId: "rice", daysAgo: 1 },
];
const SEED_CHECKINS = {
  5: ["localproduce", "reusable"],
  4: ["plantmeal", "walked"],
  3: ["nowaste"],
  2: ["plantmeal", "reusable", "walked"],
  1: ["localproduce"],
};
const SEED_TX = [
  { uid: "t1", amount: 42, catId: "groceries", daysAgo: 5 },
  { uid: "t2", amount: 18, catId: "dining", daysAgo: 4 },
  { uid: "t3", amount: 55, catId: "transport", daysAgo: 3 },
  { uid: "t4", amount: 30, catId: "shopping", daysAgo: 1 },
];

const foodById = Object.fromEntries(FOOD_DB.map((f) => [f.id, f]));
const catById = Object.fromEntries(SPEND_CATEGORIES.map((c) => [c.id, c]));
const dayLabel = (d) => (d === 0 ? "Today" : d === 1 ? "Yest." : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][(new Date().getDay() - d + 70) % 7]);
const fmt = (n, p = 1) => Number(n).toFixed(p);

/* =========================================================================
   SMALL UI PRIMITIVES
   ========================================================================= */

function TopBar({ title, onBack, right }) {
  return (
    <div className="flex items-center justify-between px-5 pt-6 pb-4">
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 active:scale-95 transition">
            <ChevronLeft size={18} />
          </button>
        )}
        <h1 className="text-lg font-bold text-slate-900">{title}</h1>
      </div>
      {right}
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white border border-slate-100 rounded-2xl shadow-sm shadow-slate-200/50 ${className}`}>
      {children}
    </div>
  );
}

function StatCard({ label, value, unit, accent, icon: Icon }) {
  return (
    <Card className="flex-1 p-4 border-t-2" style={{ borderTopColor: accent }}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase mb-2">
        {label}
      </div>
      <div className="flex items-end gap-1">
        {Icon && <Icon size={16} style={{ color: accent }} className="mb-1" />}
        <span className="text-2xl font-extrabold text-slate-900 leading-none">{value}</span>
        {unit && <span className="text-xs text-slate-400 mb-0.5">{unit}</span>}
      </div>
    </Card>
  );
}

function Tile({ icon: Icon, label, accent, onClick }) {
  return (
    <button onClick={onClick} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 flex flex-col items-center gap-3 active:scale-95 transition">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: accent + "1a" }}>
        <Icon size={20} style={{ color: accent }} />
      </div>
      <span className="text-[13px] font-semibold text-slate-700 text-center leading-tight">{label}</span>
    </button>
  );
}

function Gauge({ score }) {
  const r = 70, c = 2 * Math.PI * r;
  const color = score >= 70 ? "#0d9488" : score >= 40 ? "#d97706" : "#e11d48";
  return (
    <svg viewBox="0 0 180 180" className="w-44 h-44">
      <circle cx="90" cy="90" r={r} stroke="#e2e8f0" strokeWidth="14" fill="none" />
      <circle
        cx="90" cy="90" r={r} stroke={color} strokeWidth="14" fill="none"
        strokeDasharray={c} strokeDashoffset={c - (score / 100) * c}
        strokeLinecap="round" transform="rotate(-90 90 90)"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text x="90" y="84" textAnchor="middle" fontSize="34" fontWeight="800" fill="#0f172a">{score}</text>
      <text x="90" y="106" textAnchor="middle" fontSize="12" fill="#94a3b8">/ 100</text>
    </svg>
  );
}

function Progress({ value, max, color = "#0d9488" }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color, transition: "width 0.4s ease" }} />
    </div>
  );
}

function LightCard({ children, className = "" }) {
  return <div className={`bg-white border border-slate-100 rounded-2xl shadow-sm shadow-slate-200/50 ${className}`}>{children}</div>;
}

function LightStat({ label, value, unit, accent, icon: Icon }) {
  return (
    <LightCard className="flex-1 p-4">
      <div className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase mb-2">{label}</div>
      <div className="flex items-end gap-1">
        {Icon && <Icon size={16} style={{ color: accent }} className="mb-1" />}
        <span className="text-2xl font-extrabold text-slate-900 leading-none">{value}</span>
        {unit && <span className="text-xs text-slate-400 mb-0.5">{unit}</span>}
      </div>
    </LightCard>
  );
}

function LightProgress({ value, max, color = "#0d9488" }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color, transition: "width 0.4s ease" }} />
    </div>
  );
}

function ScoreRow({ icon: Icon, label, value, sub, tierInfo, link, onLinkClick }) {
  return (
    <LightCard className="p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
            <Icon size={16} className="text-teal-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
            <p className="text-base font-extrabold text-slate-900 leading-tight truncate">{value}</p>
            <p className="text-[11px] text-slate-400 truncate">{sub}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
          {link && (
            <button onClick={onLinkClick} className="text-[10.5px] font-semibold text-teal-600 flex items-center gap-0.5">
              {link} <ChevronRight size={11} />
            </button>
          )}
          <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: tierInfo.color + "1a", color: tierInfo.color }}>
            {tierInfo.text}
          </span>
        </div>
      </div>
    </LightCard>
  );
}

const scoreTier = (score, labels) => {
  if (score >= 75) return { text: labels[0], color: "#059669" };
  if (score >= 45) return { text: labels[1], color: "#d97706" };
  return { text: labels[2], color: "#dc2626" };
};

/* =========================================================================
   MAIN APP
   ========================================================================= */

export default function App() {
  const [screen, setScreen] = useState("home");
  const [points, setPoints] = useState(1240);
  const [foodLog, setFoodLog] = useState(SEED_FOOD_LOG);
  const [checkins, setCheckins] = useState(SEED_CHECKINS);
  const [txs, setTxs] = useState(SEED_TX);
  const [events, setEvents] = useState(SEED_EVENTS);
  const [toast, setToast] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const fire = (msg) => setToast(msg);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  /* ---------- derived / simulated metrics ---------- */

  const enrichedLog = useMemo(
    () => foodLog.map((e) => {
      const f = e.custom || foodById[e.foodId];
      const kg = f.kgPerKg * f.portionKg;
      return { ...e, ...f, kg, saved: Math.max(0, BASELINE_MEAL_KG - kg) };
    }),
    [foodLog]
  );

  const checkinSavedKg = useMemo(
    () => Object.values(checkins).flat().reduce((s, id) => s + (ACTIONS.find((a) => a.id === id)?.kg || 0), 0),
    [checkins]
  );

  const foodSavedKg = useMemo(() => enrichedLog.reduce((s, e) => s + e.saved, 0), [enrichedLog]);
  const carbonSavedKg = foodSavedKg + checkinSavedKg;
  const totalEmittedKg = useMemo(() => enrichedLog.reduce((s, e) => s + e.kg, 0), [enrichedLog]);

  const weeklyChart = useMemo(() => {
    const buckets = Array.from({ length: 7 }, (_, i) => 6 - i).map((d) => ({ day: dayLabel(d), kg: 0, d }));
    enrichedLog.forEach((e) => {
      const b = buckets.find((x) => x.d === e.daysAgo);
      if (b) b.kg += e.kg;
    });
    return buckets;
  }, [enrichedLog]);

  const categoryBreakdown = useMemo(() => {
    const map = {};
    enrichedLog.forEach((e) => { map[e.category] = (map[e.category] || 0) + e.kg; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [enrichedLog]);

  const streak = useMemo(() => {
    let s = 0, d = 0;
    while (checkins[d] && checkins[d].length > 0) { s++; d++; }
    return s;
  }, [checkins]);

  const healthIndex = useMemo(() => {
    const total = enrichedLog.length || 1;
    const plantRatio = enrichedLog.filter((e) => e.plant).length / total;
    const lowCarbonRatio = enrichedLog.filter((e) => e.kg < 3).length / total;
    let consistDays = 0;
    for (let d = 0; d < 7; d++) if (checkins[d] && checkins[d].length > 0) consistDays++;
    const consist = consistDays / 7;
    return Math.round(40 * plantRatio + 30 * lowCarbonRatio + 30 * consist);
  }, [enrichedLog, checkins]);

  const monthKg = useMemo(() => txs.reduce((s, t) => s + t.amount * catById[t.catId].factor, 0), [txs]);

  /* ---------- CeroEvents: travel footprint per event ---------- */
  const enrichedEvents = useMemo(
    () => events.map((e) => {
      const mode = travelModeById[e.modeId];
      return { ...e, mode, kg: mode.factor * e.distanceKm };
    }),
    [events]
  );
  const totalEventKg = useMemo(() => enrichedEvents.reduce((s, e) => s + e.kg, 0), [enrichedEvents]);
  const avgEventKg = enrichedEvents.length ? totalEventKg / enrichedEvents.length : 0;

  // "Emissions chain" breakdown — how much of YOUR event footprint comes
  // through each transport-mode leg, vs. the simulated group average.
  const kgByMode = useMemo(() => {
    const map = Object.fromEntries(TRAVEL_MODES.map((m) => [m.id, 0]));
    enrichedEvents.forEach((e) => { map[e.modeId] += e.kg; });
    return map;
  }, [enrichedEvents]);
  const modeRadarData = useMemo(
    () => TRAVEL_MODES.map((m) => ({ mode: m.label, You: Math.round(kgByMode[m.id] * 10) / 10, Group: GROUP_AVG_BY_MODE[m.id] })),
    [kgByMode]
  );
  const modeRadarMax = Math.max(...modeRadarData.flatMap((d) => [d.You, d.Group]), 1) * 1.2;

  /* ---------- carbon cost per dollar spent on food ---------- */
  // Per-item: kg CO2e ÷ price = how carbon-intensive a dollar of THIS
  // specific food/dish is — distinct from the Carbon Wallet's broad
  // per-category spend factors, this is item-level.
  const foodValueLog = useMemo(
    () => enrichedLog
      .filter((e) => e.priceUsd > 0)
      .map((e) => ({ ...e, kgPerDollar: e.kg / e.priceUsd })),
    [enrichedLog]
  );
  const totalFoodSpend = useMemo(() => foodValueLog.reduce((s, e) => s + e.priceUsd, 0), [foodValueLog]);
  const totalFoodKg = useMemo(() => foodValueLog.reduce((s, e) => s + e.kg, 0), [foodValueLog]);
  const blendedKgPerDollar = totalFoodSpend > 0 ? totalFoodKg / totalFoodSpend : 0;
  const rankedByEfficiency = useMemo(
    () => [...foodValueLog].sort((a, b) => b.kgPerDollar - a.kgPerDollar).slice(0, 8),
    [foodValueLog]
  );

  /* ---------- gamified Carbon Score (radar/hexagon summary) ---------- */
  const clamp = (n) => Math.max(0, Math.min(100, n));
  const SAVINGS_GOAL_KG = 20, FOOD_SPEND_TARGET = 30, EFF_BENCHMARK = 3;

  const dietMixRatio = useMemo(() => (enrichedLog.length ? enrichedLog.filter((e) => e.plant).length / enrichedLog.length : 0), [enrichedLog]);
  const todayEmittedKg = useMemo(() => weeklyChart.find((d) => d.d === 0)?.kg || 0, [weeklyChart]);
  const avgPrevKg = useMemo(() => {
    const prevDays = weeklyChart.filter((d) => d.d !== 0);
    const sum = prevDays.reduce((s, d) => s + d.kg, 0);
    return prevDays.length ? sum / prevDays.length : 0;
  }, [weeklyChart]);

  const savingsScore = clamp((carbonSavedKg / SAVINGS_GOAL_KG) * 100);
  const efficiencyScore = clamp(100 * (1 - blendedKgPerDollar / EFF_BENCHMARK));
  const spendScore = clamp((totalFoodSpend / FOOD_SPEND_TARGET) * 100);
  const dietMixScore = clamp(dietMixRatio * 100);
  const budgetScore = clamp(100 - (monthKg / MONTHLY_BUDGET_KG) * 100);
  const trendDeltaPct = avgPrevKg > 0 ? ((avgPrevKg - todayEmittedKg) / avgPrevKg) * 100 : 0;
  const trendScore = clamp(75 + trendDeltaPct * 0.5);

  const radarData = [
    { metric: "Savings", value: Math.round(savingsScore) },
    { metric: "Efficiency", value: Math.round(efficiencyScore) },
    { metric: "Spend", value: Math.round(spendScore) },
    { metric: "Diet Mix", value: Math.round(dietMixScore) },
    { metric: "Budget", value: Math.round(budgetScore) },
    { metric: "Trend", value: Math.round(trendScore) },
  ];
  const carbonScore = Math.round(radarData.reduce((s, d) => s + d.value, 0) / radarData.length);

  const sortedRadar = [...radarData].sort((a, b) => b.value - a.value);
  const insightText = `Strong ${sortedRadar[0].metric.toLowerCase()} and ${sortedRadar[1].metric.toLowerCase()}. Focus on ${sortedRadar[sortedRadar.length - 1].metric.toLowerCase()} to raise your score further.`;

  const RadarAxisTick = (props) => {
    const { x, y, payload } = props;
    const item = radarData.find((d) => d.metric === payload.value);
    return (
      <g>
        <text x={x} y={y - 6} textAnchor="middle" fontSize={13} fontWeight={800} fill="#0f172a">{item ? item.value : ""}</text>
        <text x={x} y={y + 9} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#0d9488" letterSpacing="0.3">{payload.value.toUpperCase()}</text>
      </g>
    );
  };

  /* ---------- simulated metabolic metrics ---------- */
  // Glycemic Load per item: GL = (GI x carbs) / 100 — standard nutrition-
  // science formula (Foster-Powell et al.). Used here per logged item and
  // averaged, not measured from an actual glucose sensor.
  const glLog = useMemo(
    () => enrichedLog.map((e) => ({ ...e, gl: ((e.gi || 0) * (e.carbsG || 0)) / 100 })),
    [enrichedLog]
  );
  const avgGL = useMemo(() => (glLog.length ? glLog.reduce((s, e) => s + e.gl, 0) / glLog.length : 0), [glLog]);
  const totalSugarG = useMemo(() => enrichedLog.reduce((s, e) => s + (e.sugarG || 0), 0), [enrichedLog]);
  const spikeLevel = avgGL >= 20 ? "High" : avgGL >= 10 ? "Moderate" : "Low";
  const spikeColor = avgGL >= 20 ? "#e11d48" : avgGL >= 10 ? "#d97706" : "#0d9488";

  // Today's net Potential Renal Acid Load — positive means the day's food
  // is net acid-forming (more dietary bicarbonate buffering drawn on),
  // negative means net alkaline-forming (buffering demand eased).
  const todayPRAL = useMemo(() => enrichedLog.filter((e) => e.daysAgo === 0).reduce((s, e) => s + (e.pral || 0), 0), [enrichedLog]);
  const bufferStatus = todayPRAL > 5 ? "Acid-forming" : todayPRAL < -5 ? "Alkaline-forming" : "Balanced";
  const bufferColor = todayPRAL > 5 ? "#e11d48" : todayPRAL < -5 ? "#3b82f6" : "#0d9488";

  // Illustrative postprandial glucose curve for the most recently logged
  // meal — a smooth gamma-shaped rise-and-fall scaled by that meal's
  // Glycemic Load, not a real continuous-glucose-monitor reading.
  const glucoseCurve = useMemo(() => {
    const recent = glLog[0];
    const gl = recent ? recent.gl : 0;
    const baseline = 90; // mg/dL, typical fasting reference
    const peakRise = Math.min(70, gl * 3);
    const tPeak = 45;
    return Array.from({ length: 9 }, (_, i) => i * 15).map((t) => ({
      t,
      glucose: Math.round(baseline + peakRise * (t / tPeak) * Math.exp(1 - t / tPeak)),
    }));
  }, [glLog]);

  /* ---------- actions ---------- */

  /* ---------- real camera scan (Claude vision) ---------- */
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [scanStatus, setScanStatus] = useState("idle"); // idle | analyzing | error
  const [scanError, setScanError] = useState("");

  const logScannedFood = (data) => {
    const kgPerKg = Number(data.kgPerKg) > 0 ? Number(data.kgPerKg) : 2;
    const portionKg = Number(data.portionKg) > 0 ? Number(data.portionKg) : 0.2;
    const kg = kgPerKg * portionKg;
    const carbsG = Number.isFinite(Number(data.carbsG)) ? Number(data.carbsG) : 10;
    const sugarG = Number.isFinite(Number(data.sugarG)) ? Number(data.sugarG) : 2;
    const gi = Number.isFinite(Number(data.glycemicIndex)) ? Number(data.glycemicIndex) : 40;
    const pral = Number.isFinite(Number(data.pral)) ? Number(data.pral) : 0;
    const priceUsd = Number(data.priceUsd) > 0 ? Number(data.priceUsd) : 2.0;
    const custom = {
      name: data.name, category: data.category || "Other",
      kgPerKg, portionKg, plant: !!data.plant, emoji: data.emoji || "🍽️",
      carbsG, sugarG, gi, pral, priceUsd,
    };
    setFoodLog((prev) => [{ uid: "u" + Date.now(), daysAgo: 0, custom }, ...prev]);
    setPoints((p) => p + 20);
    fire(kg < BASELINE_MEAL_KG ? `Scanned ${custom.name} · saved ${fmt(BASELINE_MEAL_KG - kg)} kg CO2e` : `Scanned ${custom.name} · +20 pts`);
  };

  const analyzePhoto = async (dataUrl) => {
    setScanStatus("analyzing");
    setScanError("");
    try {
      const mediaType = dataUrl.substring(5, dataUrl.indexOf(";")) || "image/jpeg";
      const base64 = dataUrl.split(",")[1];
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              {
                type: "text",
                text: 'Identify the single most prominent food item or dish in this photo. Respond with ONLY a raw JSON object, no markdown fences, no prose, in exactly this shape: {"name": string, "category": one of ["Red Meat","Meat","Poultry","Fish","Dairy","Grain","Plant Protein","Plant Milk","Legumes","Produce","Other"], "kgPerKg": number (approximate published lifecycle-average kg CO2e per kg of this food), "portionKg": number (typical single serving weight in kg), "plant": boolean, "emoji": string (one representative emoji), "carbsG": number (estimated grams of carbohydrate in the typical portion), "sugarG": number (estimated grams of sugar in the typical portion), "glycemicIndex": number (0-100, published-average glycemic index for this food, 0 if negligible carbs), "pral": number (estimated Potential Renal Acid Load in mEq for the typical portion, using Remer & Manz style values — positive for acid-forming foods like meat/eggs/cheese, negative for alkaline-forming foods like most fruits/vegetables), "priceUsd": number (estimated typical U.S. retail or restaurant price in dollars for that single portion/dish)}. If no food is visible, set "name" to "No food detected".',
              },
            ],
          }],
        }),
      });
      const data = await res.json();
      const textBlock = (data.content || []).find((b) => b.type === "text");
      if (!textBlock) throw new Error("empty response");
      const parsed = JSON.parse(textBlock.text.replace(/```json|```/g, "").trim());
      if (!parsed.name || /no food/i.test(parsed.name)) {
        setScanStatus("error");
        setScanError("No food recognized in that photo — try another, or pick an item below.");
        return;
      }
      logScannedFood(parsed);
      setScanStatus("idle");
    } catch (err) {
      setScanStatus("error");
      setScanError("Couldn't analyze that photo. Try again, or pick an item below.");
    }
  };

  const handleFileCapture = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setPreviewUrl(null);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result);
      analyzePhoto(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const logFood = (foodId) => {
    setFoodLog((prev) => [{ uid: "u" + Date.now(), foodId, daysAgo: 0 }, ...prev]);
    setPoints((p) => p + 15);
    const f = foodById[foodId];
    const kg = f.kgPerKg * f.portionKg;
    fire(kg < BASELINE_MEAL_KG ? `Logged ${f.name} · saved ${fmt(BASELINE_MEAL_KG - kg)} kg CO2e` : `Logged ${f.name} · +15 pts`);
  };

  const toggleAction = (id) => {
    setCheckins((prev) => {
      const today = prev[0] || [];
      const has = today.includes(id);
      const nextToday = has ? today.filter((x) => x !== id) : [...today, id];
      if (!has) { setPoints((p) => p + 8); fire("Nice — logged sustainable action, +8 pts"); }
      return { ...prev, 0: nextToday };
    });
  };

  const logTx = (amount, catId) => {
    setTxs((prev) => [{ uid: "u" + Date.now(), amount, catId, daysAgo: 0 }, ...prev]);
    setPoints((p) => p + 5);
    fire(`Logged $${amount} · ${fmt(amount * catById[catId].factor)} kg CO2e`);
  };

  const logEvent = (name, type, modeId, distanceKm) => {
    setEvents((prev) => [{ uid: "u" + Date.now(), name, type, modeId, distanceKm, daysAgo: 0 }, ...prev]);
    setPoints((p) => p + 10);
    fire(`Logged ${name} · ${fmt(travelModeById[modeId].factor * distanceKm)} kg CO2e`);
  };

  // total requirements = direct + indirect (Leontief-style decomposition)
  const txBreakdown = (t) => {
    const c = catById[t.catId];
    return { direct: t.amount * c.direct, indirect: t.amount * c.indirect, total: t.amount * c.factor };
  };

  const resetDemo = () => {
    setFoodLog(SEED_FOOD_LOG); setCheckins(SEED_CHECKINS); setTxs(SEED_TX); setEvents(SEED_EVENTS); setPoints(1240);
    fire("Demo data reset");
  };

  const go = (s) => { setScreen(s); setNotifOpen(false); };

  /* ---------- screens ---------- */

  const Home_ = (
    <div className="pb-28">
      <div className="flex items-center justify-between px-5 pt-6">
        <div>
          <p className="text-slate-400 text-sm">{greeting}, Cathy</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-black tracking-tight text-slate-900">CERO</span>
            <span className="w-2 h-2 rounded-full bg-teal-400" />
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setNotifOpen((v) => !v)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:scale-95 transition">
            <Bell size={17} />
          </button>
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-400 border-2 border-slate-50" />
          {notifOpen && (
            <div className="absolute right-0 top-12 w-64 bg-white border border-slate-200 rounded-xl p-3 z-20 shadow-xl">
              <p className="text-xs font-semibold text-slate-500 mb-2">Notifications</p>
              <p className="text-xs text-slate-400 mb-2 leading-snug">🌱 Your weekly footprint report is ready.</p>
              <p className="text-xs text-slate-400 leading-snug">📍 New sustainable spot added near you.</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 px-5 mt-5">
        <StatCard label="Carbon Saved" value={fmt(carbonSavedKg)} unit="kg" accent="#0d9488" icon={Leaf} />
        <StatCard label="Cero Points" value={points.toLocaleString()} accent="#7c3aed" icon={Sparkles} />
        <StatCard label="This Month" value={fmt(monthKg)} unit="kg" accent="#3b82f6" icon={Wallet} />
      </div>

      <div className="px-5 mt-7">
        <h2 className="text-base font-bold text-slate-900 mb-3">Quick Access</h2>
        <div className="grid grid-cols-3 gap-3">
          <Tile icon={ScanLine} label="Food Scanner" accent="#0d9488" onClick={() => go("scanner")} />
          <Tile icon={Activity} label="Footprint Tracker" accent="#3b82f6" onClick={() => go("activity")} />
          <Tile icon={CheckCircle2} label="Daily Check-In" accent="#d97706" onClick={() => go("checkin")} />
          <Tile icon={Heart} label="Health Index" accent="#db2777" onClick={() => go("health")} />
          <Tile icon={MapPin} label="Explore" accent="#0284c7" onClick={() => go("explore")} />
          <Tile icon={Wallet} label="Carbon Wallet" accent="#7c3aed" onClick={() => go("wallet")} />
        </div>
      </div>

      <div className="px-5 mt-7">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-900">Weekly Footprint</h2>
          <button onClick={() => go("activity")} className="text-teal-600 text-xs font-semibold flex items-center gap-1">
            View all <ArrowUpRight size={13} />
          </button>
        </div>
        <Card className="p-4">
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyChart} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "#f1f5f9" }}
                  contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`${fmt(v)} kg`, "CO2e"]}
                />
                <Bar dataKey="kg" radius={[4, 4, 4, 4]}>
                  {weeklyChart.map((e, i) => <Cell key={i} fill={e.d === 0 ? "#0d9488" : "#e2e8f0"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
            <span>Total emitted this week: <b className="text-slate-700">{fmt(weeklyChart.reduce((s, x) => s + x.kg, 0))} kg</b></span>
          </div>
        </Card>
      </div>

      <div className="px-5 mt-7">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-900">CeroExplore</h2>
          <button onClick={() => go("explore")} className="text-teal-600 text-xs font-semibold flex items-center gap-1">
            View map <ArrowUpRight size={13} />
          </button>
        </div>
        <Card className="p-4">
          <p className="text-slate-900 font-bold text-sm mb-1">Discover Nearby</p>
          <p className="text-slate-500 text-xs mb-3">{PLACES.length} sustainable spots within 1.2 km</p>
          <div className="flex gap-2 flex-wrap">
            {PLACES.slice(0, 2).map((p) => (
              <span key={p.name} className="flex items-center gap-1 bg-slate-100 rounded-full px-3 py-1.5 text-xs text-slate-700">
                <MapPin size={12} className={p.color} /> {p.name}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="px-5 mt-7">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-900">CeroEvents</h2>
          <button onClick={() => go("events")} className="text-teal-600 text-xs font-semibold flex items-center gap-1">
            View events <ArrowUpRight size={13} />
          </button>
        </div>
        <Card className="p-4">
          <p className="text-slate-900 font-bold text-sm mb-1">Track your next event</p>
          <p className="text-slate-500 text-xs mb-3">{enrichedEvents.length} events logged · {fmt(totalEventKg)} kg CO2e from travel</p>
          <div className="flex gap-2 flex-wrap">
            {enrichedEvents.slice(0, 2).map((e) => (
              <span key={e.uid} className="flex items-center gap-1 bg-slate-100 rounded-full px-3 py-1.5 text-xs text-slate-700">
                <CalendarDays size={12} className="text-teal-600" /> {e.name}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );

  const Scanner_ = (
    <div className="pb-28">
      <TopBar title="Food Scanner" onBack={() => go("home")} />
      <div className="px-5">
        <div className="rounded-2xl border-2 border-dashed border-teal-500/40 bg-slate-50 p-5 flex flex-col items-center justify-center mb-2 text-center">
          {previewUrl ? (
            <img src={previewUrl} alt="Captured food" className="w-28 h-28 object-cover rounded-xl mb-3 border border-slate-200" />
          ) : (
            <Camera size={28} className="text-teal-400 mb-2" />
          )}
          {scanStatus === "analyzing" ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 py-1.5">
              <span className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
              Identifying food with AI…
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()} className="bg-teal-500 text-white text-xs font-bold rounded-full px-4 py-2 active:scale-95 transition">
              {previewUrl ? "Scan another photo" : "Scan with camera"}
            </button>
          )}
          <p className="text-[11px] text-slate-500 mt-2">Takes a real photo and identifies the food with AI vision</p>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileCapture} className="hidden" />
        </div>
        {scanError && <p className="text-xs text-rose-400 text-center mb-4">{scanError}</p>}
        {!scanError && <div className="mb-5" />}
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Or select an item to simulate</p>
        <div className="grid grid-cols-4 gap-2.5 mb-6">
          {FOOD_DB.map((f) => (
            <button key={f.id} onClick={() => logFood(f.id)} className="bg-white border border-slate-200 rounded-xl py-3 flex flex-col items-center gap-1 active:scale-95 transition">
              <span className="text-xl">{f.emoji}</span>
              <span className="text-[10px] text-slate-600 text-center leading-tight">{f.name}</span>
            </button>
          ))}
        </div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Recent scans</p>
        <div className="space-y-2">
          {enrichedLog.slice(0, 6).map((e) => (
            <Card key={e.uid} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">{e.emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{e.name}</p>
                  <p className="text-[11px] text-slate-500">{e.category} · {dayLabel(e.daysAgo)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">{fmt(e.kg)} kg</p>
                {e.saved > 0 && <p className="text-[11px] text-teal-600">saved {fmt(e.saved)} kg</p>}
                {e.priceUsd > 0 && <p className="text-[10px] text-slate-500">${fmt(e.priceUsd, 2)} · {fmt(e.kg / e.priceUsd)} kg/$ </p>}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  const Activity_ = (
    <div className="min-h-full bg-slate-50 pb-28">
      <div className="flex items-center gap-3 px-5 pt-6 pb-1">
        <button onClick={() => go("home")} className="w-8 h-8 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-500 active:scale-95 transition">
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-base font-bold text-slate-900">Footprint Tracker</h1>
      </div>

      <div className="px-5 text-center pt-3">
        <p className="text-xs font-bold tracking-wide text-teal-600 uppercase mb-1">Carbon Score</p>
        <p className="text-6xl font-black text-slate-900 leading-none">{carbonScore}</p>
        <p className="text-[11px] font-semibold text-slate-400 mt-1 mb-3 tracking-wide">SCORE</p>
        <span
          className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-full"
          style={{ backgroundColor: trendDeltaPct >= 0 ? "#d1fae5" : "#fee2e2", color: trendDeltaPct >= 0 ? "#059669" : "#dc2626" }}
        >
          {trendDeltaPct >= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
          {Math.abs(Math.round(trendDeltaPct))}% {trendDeltaPct >= 0 ? "below" : "above"} weekly avg
        </span>
      </div>

      <div className="h-64 px-1 -mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} outerRadius="68%">
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="metric" tick={<RadarAxisTick />} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="value" stroke="#0d9488" fill="#14b8a6" fillOpacity={0.16} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="px-5">
        <h3 className="text-sm font-bold text-slate-900 mb-3">What affected your score</h3>
        <div className="space-y-2.5 mb-6">
          <ScoreRow
            icon={Leaf} label="Savings" value={`${fmt(carbonSavedKg)} kg`} sub={`/ ${SAVINGS_GOAL_KG} kg weekly goal`}
            tierInfo={scoreTier(savingsScore, ["Above goal", "Building up", "Log more swaps"])}
            link="Savings Log" onLinkClick={() => document.getElementById("detailed-breakdown")?.scrollIntoView({ behavior: "smooth" })}
          />
          <ScoreRow
            icon={Wallet} label="Efficiency" value={`${fmt(blendedKgPerDollar, 2)} kg/$`} sub="avg across logged food"
            tierInfo={scoreTier(efficiencyScore, ["Efficient picks", "Average mix", "Carbon-heavy picks"])}
          />
          <ScoreRow
            icon={DollarSign} label="Spend" value={`$${fmt(totalFoodSpend, 2)}`} sub="logged this week"
            tierInfo={scoreTier(spendScore, ["Well tracked", "Some gaps", "Log more meals"])}
          />
          <ScoreRow
            icon={Sparkles} label="Diet Mix" value={`${Math.round(dietMixScore)}%`} sub="plant-based of logged meals"
            tierInfo={scoreTier(dietMixScore, ["Mostly plant-based", "Balanced mix", "Meat-heavy"])}
          />
          <ScoreRow
            icon={Activity} label="Budget" value={`${fmt(monthKg)} / ${MONTHLY_BUDGET_KG} kg`} sub="monthly carbon budget"
            tierInfo={scoreTier(budgetScore, ["Within budget", "Near limit", "Over budget"])}
          />
          <ScoreRow
            icon={todayEmittedKg <= avgPrevKg ? TrendingDown : TrendingUp} label="Trend" value={`${fmt(todayEmittedKg)} kg`} sub={`today vs ${fmt(avgPrevKg)} kg avg`}
            tierInfo={scoreTier(trendScore, ["Trending down", "Holding steady", "Trending up"])}
          />
        </div>

        <div className="flex items-start gap-2.5 bg-teal-50 border border-teal-100 rounded-2xl p-4 mb-7">
          <Sparkles size={16} className="text-teal-600 mt-0.5 shrink-0" />
          <p className="text-[12.5px] text-teal-800 leading-snug">{insightText}</p>
        </div>

        <div id="detailed-breakdown" className="pt-1">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Detailed breakdown</h3>
          <div className="flex gap-3 mb-5">
            <LightStat label="Emitted" value={fmt(totalEmittedKg)} unit="kg" accent="#e11d48" icon={TrendingUp} />
            <LightStat label="Saved" value={fmt(carbonSavedKg)} unit="kg" accent="#0d9488" icon={TrendingDown} />
          </div>
          <LightCard className="p-4 mb-5">
            <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Last 7 days</p>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyChart} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "#f1f5f9" }}
                    contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`${fmt(v)} kg`, "CO2e"]}
                  />
                  <Bar dataKey="kg" radius={[4, 4, 4, 4]}>
                    {weeklyChart.map((e, i) => <Cell key={i} fill={e.d === 0 ? "#0d9488" : "#e2e8f0"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </LightCard>
          <p className="text-xs font-semibold text-slate-400 uppercase mb-3">By category</p>
          <div className="space-y-2 mb-5">
            {categoryBreakdown.map(([cat, kg]) => (
              <LightCard key={cat} className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-slate-700">{cat}</span>
                  <span className="text-sm font-bold text-slate-900">{fmt(kg)} kg</span>
                </div>
                <LightProgress value={kg} max={Math.max(...categoryBreakdown.map((c) => c[1]))} color="#3b82f6" />
              </LightCard>
            ))}
          </div>

          <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Carbon cost per dollar spent</p>
          <LightCard className="p-4 mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-500">Blended average</span>
              <span className="font-bold text-slate-900">{fmt(blendedKgPerDollar, 2)} kg CO2e / $</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>${fmt(totalFoodSpend, 2)} spent on logged food</span>
              <span>{fmt(totalFoodKg)} kg CO2e</span>
            </div>
          </LightCard>
          <div className="space-y-2 mb-5">
            {rankedByEfficiency.map((e) => (
              <LightCard key={e.uid} className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-slate-700 flex items-center gap-1.5"><span>{e.emoji}</span>{e.name}</span>
                  <span className="text-sm font-bold" style={{ color: e.kgPerDollar > blendedKgPerDollar ? "#dc2626" : "#059669" }}>{fmt(e.kgPerDollar, 2)} kg/$</span>
                </div>
                <LightProgress value={e.kgPerDollar} max={Math.max(...rankedByEfficiency.map((x) => x.kgPerDollar), 0.1)} color={e.kgPerDollar > blendedKgPerDollar ? "#dc2626" : "#059669"} />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>${fmt(e.priceUsd, 2)} spent</span>
                  <span>{fmt(e.kg)} kg CO2e</span>
                </div>
              </LightCard>
            ))}
          </div>
          <div className="flex items-start gap-2 mb-6 bg-slate-100 border border-slate-200 rounded-xl p-3">
            <Info size={14} className="text-slate-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-slate-500 leading-snug">Carbon cost per dollar = item's kg CO2e ÷ its price — a rough "carbon-per-dollar-efficiency" ranking, not a certified figure. Red items emit more CO2e per dollar than your blended average (worth swapping); green items emit less.</p>
          </div>
        </div>

        <button onClick={() => go("wallet")} className="w-full text-white font-bold text-sm rounded-2xl py-3.5 flex items-center justify-center gap-1.5 active:scale-[0.98] transition" style={{ background: "linear-gradient(135deg, #14b8a6, #0d9488)" }}>
          Log Today's Spend <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  const Checkin_ = (
    <div className="pb-28">
      <TopBar title="Daily Check-In" onBack={() => go("home")} />
      <div className="px-5">
        <Card className="p-4 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame size={20} className="text-amber-400" />
            <div>
              <p className="text-sm font-bold text-slate-900">{streak}-day streak</p>
              <p className="text-[11px] text-slate-500">Keep it going!</p>
            </div>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 7 }, (_, i) => 6 - i).map((d) => (
              <div key={d} className={`w-4 h-4 rounded-full ${checkins[d] && checkins[d].length > 0 ? "bg-teal-400" : "bg-slate-100"}`} />
            ))}
          </div>
        </Card>
        <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Today's actions</p>
        <div className="space-y-2 mb-5">
          {ACTIONS.map((a) => {
            const done = (checkins[0] || []).includes(a.id);
            return (
              <button key={a.id} onClick={() => toggleAction(a.id)} className="w-full">
                <Card className={`p-3.5 flex items-center justify-between ${done ? "border-teal-600/50" : ""}`}>
                  <div className="flex items-center gap-2.5 text-left">
                    {done ? <CheckCircle2 size={20} className="text-teal-400 shrink-0" /> : <Circle size={20} className="text-slate-600 shrink-0" />}
                    <span className={`text-sm ${done ? "text-slate-900" : "text-slate-500"}`}>{a.label}</span>
                  </div>
                  <span className="text-xs text-teal-400 font-semibold shrink-0">-{fmt(a.kg)}kg</span>
                </Card>
              </button>
            );
          })}
        </div>
        <Card className="p-4 flex items-center justify-between">
          <span className="text-sm text-slate-500">Saved today</span>
          <span className="text-lg font-extrabold text-teal-600">{fmt((checkins[0] || []).reduce((s, id) => s + ACTIONS.find((a) => a.id === id).kg, 0))} kg</span>
        </Card>
      </div>
    </div>
  );

  const Health_ = (
    <div className="pb-28">
      <TopBar title="Health Index" onBack={() => go("home")} />
      <div className="px-5 flex flex-col items-center">
        <Gauge score={healthIndex} />
        <p className="text-sm text-slate-400 text-center mt-2 mb-6 max-w-xs">
          {healthIndex >= 70 ? "Excellent — your choices are consistently low-impact." : healthIndex >= 40 ? "Good progress — a few swaps could raise your score." : "Room to grow — try more plant-based meals this week."}
        </p>
        <div className="w-full space-y-3">
          {[
            { label: "Plant-based ratio", val: enrichedLog.filter((e) => e.plant).length / (enrichedLog.length || 1), color: "#0d9488" },
            { label: "Low-carbon meals", val: enrichedLog.filter((e) => e.kg < 3).length / (enrichedLog.length || 1), color: "#0284c7" },
            { label: "Check-in consistency", val: Array.from({ length: 7 }, (_, d) => checkins[d]?.length > 0).filter(Boolean).length / 7, color: "#d97706" },
          ].map((row) => (
            <Card key={row.label} className="p-3.5">
              <div className="flex justify-between mb-1.5 text-sm">
                <span className="text-slate-500">{row.label}</span>
                <span className="font-bold text-slate-900">{Math.round(row.val * 100)}%</span>
              </div>
              <Progress value={row.val * 100} max={100} color={row.color} />
            </Card>
          ))}
        </div>
        <div className="flex items-start gap-2 mt-5 bg-slate-50 border border-slate-200 rounded-xl p-3">
          <Info size={14} className="text-slate-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-slate-500 leading-snug">Score blends diet composition and check-in habits from your last 7 days. Illustrative model for this PoC.</p>
        </div>

        <div className="w-full mt-7">
          <h3 className="text-sm font-bold text-slate-900 mb-3 text-left">Metabolic Signals (simulated)</h3>

          <Card className="p-4 mb-3 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700">Estimated Bicarbonate Buffer Load</span>
              <span className="text-xs font-bold" style={{ color: bufferColor }}>{bufferStatus}</span>
            </div>
            <div className="relative h-2.5 rounded-full bg-slate-100 overflow-hidden mb-1.5">
              <div className="absolute inset-y-0 left-1/2 w-px bg-slate-600" />
              <div
                className="absolute inset-y-0 rounded-full"
                style={{
                  backgroundColor: bufferColor,
                  left: todayPRAL >= 0 ? "50%" : `${50 + Math.max(-50, todayPRAL) }%`,
                  width: `${Math.min(50, Math.abs(todayPRAL) * 2)}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mb-2">
              <span>Alkaline-forming</span><span>Balanced</span><span>Acid-forming</span>
            </div>
            <p className="text-lg font-extrabold text-slate-900">{todayPRAL > 0 ? "+" : ""}{fmt(todayPRAL)} <span className="text-xs font-medium text-slate-500">mEq today</span></p>
            <div className="flex items-start gap-2 mt-2">
              <Info size={12} className="text-slate-600 mt-0.5 shrink-0" />
              <p className="text-[10.5px] text-slate-600 leading-snug">Derived from each meal's Potential Renal Acid Load (PRAL) — protein- and phosphorus-rich foods raise it, potassium- and magnesium-rich produce lowers it. This estimates dietary demand on your body's bicarbonate buffering, it does not measure your actual blood bicarbonate — only a blood test (metabolic panel) can do that.</p>
            </div>
          </Card>

          <Card className="p-4 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700">Estimated Glucose & Sugar Spike</span>
              <span className="text-xs font-bold" style={{ color: spikeColor }}>{spikeLevel}</span>
            </div>
            <div className="h-24 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={glucoseCurve} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="glucoseFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={spikeColor} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={spikeColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}m`} />
                  <YAxis hide domain={[70, 180]} />
                  <Tooltip
                    contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 11 }}
                    formatter={(v) => [`${v} mg/dL`, "Est. glucose"]}
                    labelFormatter={(v) => `${v} min after meal`}
                  />
                  <Area type="monotone" dataKey="glucose" stroke={spikeColor} strokeWidth={2} fill="url(#glucoseFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between text-xs mt-2 mb-1">
              <span className="text-slate-400">Avg. glycemic load / meal</span>
              <span className="font-bold text-slate-900">{fmt(avgGL, 0)}</span>
            </div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-400">Total sugar logged</span>
              <span className="font-bold text-slate-900">{fmt(totalSugarG, 0)} g</span>
            </div>
            <div className="flex items-start gap-2">
              <Info size={12} className="text-slate-600 mt-0.5 shrink-0" />
              <p className="text-[10.5px] text-slate-600 leading-snug">Curve models the typical postprandial rise from your most recent meal's Glycemic Load (GI × carbs ÷ 100). It's an illustrative shape, not a continuous-glucose-monitor reading — actual response varies by person and is only known via real testing.</p>
            </div>
          </Card>
        </div>

        <div className="w-full mt-5">
          <Card className="p-4 text-left">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Formulas & validation</h3>

            <div className="mb-3">
              <p className="text-[11px] font-semibold text-slate-500 mb-1">Bicarbonate buffer load — PRAL (proxy)</p>
              <p className="text-[11px] font-mono text-slate-400 bg-slate-100 rounded-lg px-2.5 py-1.5 mb-1.5 overflow-x-auto">PRAL (mEq) = 0.49×protein(g) + 0.037×phosphorus(mg) − 0.021×potassium(mg) − 0.026×magnesium(mg) − 0.013×calcium(mg)</p>
              <p className="text-[10.5px] text-slate-600 leading-snug">This app uses precomputed representative PRAL values per food rather than the full mineral breakdown. Validated by Remer & Manz (1995) against <span className="text-slate-400">measured urinary net acid excretion</span>, not against serum bicarbonate — healthy kidneys/lungs keep blood bicarbonate in a narrow range regardless of a single day's diet.</p>
            </div>

            <div className="mb-3">
              <p className="text-[11px] font-semibold text-slate-500 mb-1">Glucose/sugar spike — Glycemic Load</p>
              <p className="text-[11px] font-mono text-slate-400 bg-slate-100 rounded-lg px-2.5 py-1.5 mb-1.5">GL = (GI × carbs<span className="italic">g</span>) ÷ 100</p>
              <p className="text-[10.5px] text-slate-600 leading-snug">GI values come from real clinical glucose-tolerance testing (Jenkins et al., 1981) and are population averages. Individual glucose response to the same food varies meaningfully person to person — this predicts a typical shape, not your personal curve.</p>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-slate-500 mb-1">What actually governs blood bicarbonate — Henderson-Hasselbalch</p>
              <p className="text-[11px] font-mono text-slate-400 bg-slate-100 rounded-lg px-2.5 py-1.5 mb-1.5">pH = pKa + log₁₀([HCO3⁻] ÷ [dissolved CO2]),  pKa ≈ 6.1</p>
              <p className="text-[10.5px] text-slate-600 leading-snug">This is the real, exact equilibrium equation clinicians use to interpret an actual arterial blood-gas sample — it requires measured HCO3⁻ and dissolved CO2 from a real blood draw. The app does not solve this equation; it's shown here so the PRAL estimate above is never mistaken for it. Only a blood test gives your real bicarbonate.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );

  const Explore_ = (
    <div className="pb-28">
      <TopBar title="Explore" onBack={() => go("home")} />
      <div className="px-5">
        <Card className="h-32 mb-5 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "14px 14px" }} />
          <MapPin size={26} className="text-teal-400 relative" />
          <span className="text-xs text-slate-500 relative ml-2">Map view (mocked)</span>
        </Card>
        <div className="space-y-2.5">
          {PLACES.map((p) => (
            <Card key={p.name} className="p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                  <MapPin size={16} className={p.color} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                  <p className="text-[11px] text-slate-500">{p.tag} · {p.blurb}</p>
                </div>
              </div>
              <span className="text-xs text-slate-400 shrink-0 ml-2">{p.dist}</span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  const WalletScreen_ = () => {
    const [amount, setAmount] = useState("");
    const [cat, setCat] = useState("groceries");
    return (
      <div className="pb-28">
        <TopBar title="Carbon Wallet" onBack={() => go("home")} />
        <div className="px-5">
          <Card className="p-4 mb-5">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">Monthly budget</span>
              <span className="font-bold text-slate-900">{fmt(monthKg)} / {MONTHLY_BUDGET_KG} kg</span>
            </div>
            <Progress value={monthKg} max={MONTHLY_BUDGET_KG} color={monthKg > MONTHLY_BUDGET_KG ? "#e11d48" : "#7c3aed"} />
          </Card>

          <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Log a purchase</p>
          <Card className="p-4 mb-5">
            <div className="flex gap-2 mb-3">
              <div className="flex-1 flex items-center bg-slate-100 rounded-xl px-3">
                <DollarSign size={14} className="text-slate-500" />
                <input
                  value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.00" inputMode="decimal"
                  className="bg-transparent text-slate-900 text-sm py-3 w-full outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {SPEND_CATEGORIES.map((c) => (
                <button key={c.id} onClick={() => setCat(c.id)} className={`rounded-xl py-2 flex flex-col items-center gap-1 border ${cat === c.id ? "border-transparent" : "border-slate-200"}`} style={{ backgroundColor: cat === c.id ? c.color + "22" : "transparent" }}>
                  <c.icon size={15} style={{ color: c.color }} />
                  <span className="text-[10px] text-slate-600 text-center leading-tight">{c.label}</span>
                </button>
              ))}
            </div>
            <button
              disabled={!amount || Number(amount) <= 0}
              onClick={() => { logTx(Number(amount), cat); setAmount(""); }}
              className="w-full bg-teal-500 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-sm rounded-xl py-2.5 flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
            >
              <Plus size={15} /> Log Purchase
            </button>
          </Card>

          <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Recent transactions</p>
          <div className="space-y-2 mb-5">
            {txs.slice(0, 8).map((t) => {
              const c = catById[t.catId];
              const b = txBreakdown(t);
              return (
                <Card key={t.uid} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.color + "1a" }}>
                        <c.icon size={14} style={{ color: c.color }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{c.label}</p>
                        <p className="text-[11px] text-slate-500">{dayLabel(t.daysAgo)} · ${t.amount}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{fmt(b.total)} kg</span>
                  </div>
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100">
                    <div style={{ width: `${(b.direct / b.total) * 100}%`, backgroundColor: c.color }} />
                    <div style={{ width: `${(b.indirect / b.total) * 100}%`, backgroundColor: c.color + "55" }} />
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] text-slate-500">
                    <span>Direct {fmt(b.direct)} kg</span>
                    <span>Supply-chain {fmt(b.indirect)} kg</span>
                  </div>
                </Card>
              );
            })}
          </div>
          <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <Info size={14} className="text-slate-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-slate-500 leading-snug">Each category's multiplier splits into direct emissions (point of sale/use) and indirect emissions (upstream supply chain) — a simplified stand-in for a full Leontief total-requirements decomposition (I − A)⁻¹.</p>
          </div>
        </div>
      </div>
    );
  };

  const Events_ = (
    <div className="pb-28">
      <TopBar title="CeroEvents" onBack={() => go("home")} />
      <div className="px-5">
        <Card className="p-4 mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Total from event travel</p>
          <p className="text-2xl font-extrabold text-slate-900">{fmt(totalEventKg)} kg CO2e</p>
          <p className="text-xs text-slate-400 mt-1">{enrichedEvents.length} events tracked</p>
        </Card>

        <p className="text-xs font-semibold text-slate-400 uppercase text-center mb-1">Emissions Chain</p>
        <div className="flex items-center justify-center gap-4 mb-1">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-700">
            <span className="w-2 h-2 rounded-full bg-teal-500" /> You
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-700">
            <span className="w-2 h-2 rounded-full bg-violet-500" style={{ opacity: 0.7 }} /> Group avg
          </span>
        </div>
        <div className="h-52 px-1 -mb-1">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={modeRadarData} outerRadius="65%">
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="mode" tick={{ fill: "#475569", fontSize: 8.5, fontWeight: 700 }} />
              <PolarRadiusAxis domain={[0, modeRadarMax]} tick={false} axisLine={false} />
              <Radar dataKey="You" stroke="#0d9488" fill="#14b8a6" fillOpacity={0.3} strokeWidth={2} />
              <Radar dataKey="Group" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.1} strokeWidth={2} strokeDasharray="4 3" />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <button onClick={() => go("leaderboard")} className="w-full text-center text-teal-600 text-xs font-semibold mb-5">
          See full breakdown & ranking →
        </button>

        <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Services</p>
        <div className="grid grid-cols-3 gap-3">
          <Tile icon={Car} label="Log Event Travel" accent="#0d9488" onClick={() => go("eventTravel")} />
          <Tile icon={CalendarDays} label="My Events" accent="#3b82f6" onClick={() => go("myEvents")} />
          <Tile icon={Building2} label="Eco Venues" accent="#d97706" onClick={() => go("ecoVenues")} />
          <Tile icon={Trophy} label="Leaderboard" accent="#db2777" onClick={() => go("leaderboard")} />
          <Tile icon={Wallet} label="Offset an Event" accent="#7c3aed" onClick={() => go("wallet")} />
        </div>
        <div className="flex items-start gap-2 mt-5 bg-slate-50 border border-slate-200 rounded-xl p-3">
          <Info size={14} className="text-slate-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-slate-500 leading-snug">Event footprint here is based on travel to the venue — usually the biggest single driver for a one-off event — using published-average kg CO2e per passenger-km by transport mode.</p>
        </div>
      </div>
    </div>
  );

  const EventTravelScreen_ = () => {
    const [name, setName] = useState("");
    const [type, setType] = useState(EVENT_TYPES[0]);
    const [modeId, setModeId] = useState(TRAVEL_MODES[0].id);
    const [distance, setDistance] = useState("");
    const mode = travelModeById[modeId];
    const previewKg = mode.factor * (Number(distance) || 0);
    return (
      <div className="pb-28">
        <TopBar title="Log Event Travel" onBack={() => go("events")} />
        <div className="px-5">
          <Card className="p-4 mb-5">
            <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Event name</p>
            <input
              value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sarah & Jon's Wedding"
              className="w-full bg-slate-100 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 mb-3"
            />
            <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Event type</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {EVENT_TYPES.map((t) => (
                <button key={t} onClick={() => setType(t)} className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border ${type === t ? "bg-teal-50 border-teal-300 text-teal-700" : "border-slate-200 text-slate-500"}`}>
                  {t}
                </button>
              ))}
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Travel mode</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {TRAVEL_MODES.map((m) => (
                <button key={m.id} onClick={() => setModeId(m.id)} className={`rounded-xl py-2 flex flex-col items-center gap-1 border ${modeId === m.id ? "border-teal-300 bg-teal-50" : "border-slate-200"}`}>
                  <m.icon size={15} className="text-teal-600" />
                  <span className="text-[10px] text-slate-600 text-center leading-tight">{m.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Distance (km, one-way)</p>
            <input
              value={distance} onChange={(e) => setDistance(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0"
              className="w-full bg-slate-100 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 mb-3"
            />
            <div className="flex justify-between items-center bg-teal-50 rounded-xl px-3 py-2.5 mb-3">
              <span className="text-xs text-teal-700 font-semibold">Estimated footprint</span>
              <span className="text-sm font-bold text-teal-700">{fmt(previewKg)} kg CO2e</span>
            </div>
            <button
              disabled={!name || !distance}
              onClick={() => { logEvent(name, type, modeId, Number(distance)); setName(""); setDistance(""); }}
              className="w-full bg-teal-500 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-sm rounded-xl py-2.5 flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
            >
              <Plus size={15} /> Log Event
            </button>
          </Card>
          <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Recent events</p>
          <div className="space-y-2">
            {enrichedEvents.slice(0, 6).map((e) => (
              <Card key={e.uid} className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-900">{e.name}</span>
                  <span className="text-sm font-bold text-slate-900">{fmt(e.kg)} kg</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>{e.type} · {e.mode.label}</span>
                  <span>{e.distanceKm} km</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const MyEvents_ = (
    <div className="pb-28">
      <TopBar title="My Events" onBack={() => go("events")} />
      <div className="px-5">
        <div className="flex gap-3 mb-5">
          <StatCard label="Events" value={enrichedEvents.length} accent="#3b82f6" icon={CalendarDays} />
          <StatCard label="Travel Footprint" value={fmt(totalEventKg)} unit="kg" accent="#0d9488" icon={Leaf} />
        </div>
        <p className="text-xs font-semibold text-slate-400 uppercase mb-3">All events</p>
        <div className="space-y-2">
          {enrichedEvents.map((e) => (
            <Card key={e.uid} className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-900">{e.name}</span>
                <span className="text-sm font-bold text-slate-900">{fmt(e.kg)} kg</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>{e.type} · {e.mode.label} · {dayLabel(e.daysAgo)}</span>
                <span>{e.distanceKm} km</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  const EcoVenues_ = (
    <div className="pb-28">
      <TopBar title="Eco Venues" onBack={() => go("events")} />
      <div className="px-5 space-y-2.5">
        {ECO_VENUES.map((v) => (
          <Card key={v.name} className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                <Building2 size={16} className={v.color} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{v.name}</p>
                <p className="text-[11px] text-slate-400">{v.tag} · {v.blurb}</p>
              </div>
            </div>
            <span className="text-xs text-slate-400 shrink-0 ml-2">{v.dist}</span>
          </Card>
        ))}
      </div>
    </div>
  );

  const leaderboardData = useMemo(() => {
    const list = [...FRIENDS_LEADERBOARD, { name: "You", avgKg: avgEventKg, isYou: true }];
    return list.sort((a, b) => a.avgKg - b.avgKg);
  }, [avgEventKg]);

  const Leaderboard_ = (
    <div className="pb-28">
      <TopBar title="Event Leaderboard" onBack={() => go("events")} />

      <div className="px-5 text-center pt-1">
        <p className="text-xs font-bold tracking-wide text-teal-600 uppercase mb-1">Emissions Chain</p>
        <p className="text-sm text-slate-500">You vs. group average, by transport leg</p>
      </div>

      <div className="flex items-center justify-center gap-4 mt-2 mb-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-teal-700">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-500" /> You
        </span>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-violet-700">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-500" style={{ opacity: 0.7 }} /> Group avg
        </span>
      </div>

      <div className="h-60 px-1 -mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={modeRadarData} outerRadius="65%">
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="mode" tick={{ fill: "#475569", fontSize: 9.5, fontWeight: 700 }} />
            <PolarRadiusAxis domain={[0, modeRadarMax]} tick={false} axisLine={false} />
            <Radar name="You" dataKey="You" stroke="#0d9488" fill="#14b8a6" fillOpacity={0.3} strokeWidth={2} />
            <Radar name="Group Avg" dataKey="Group" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.1} strokeWidth={2} strokeDasharray="4 3" />
            <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 11 }} formatter={(v) => [`${fmt(v)} kg`, ""]} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="px-5">
        <h3 className="text-sm font-bold text-slate-900 mb-3">By transport leg</h3>
        <div className="space-y-2 mb-6">
          {TRAVEL_MODES.map((m) => {
            const you = kgByMode[m.id] || 0;
            const group = GROUP_AVG_BY_MODE[m.id] || 0;
            const max = Math.max(you, group, 0.1);
            const better = you <= group;
            return (
              <Card key={m.id} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    <m.icon size={13} className="text-slate-400" /> {m.label}
                  </span>
                  <span className={`text-xs font-bold ${better ? "text-teal-700" : "text-rose-600"}`}>
                    {fmt(you)} vs {fmt(group)} kg
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-semibold text-teal-700 w-9 shrink-0">You</span>
                    <Progress value={you} max={max} color="#0d9488" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-semibold text-violet-700 w-9 shrink-0">Group</span>
                    <Progress value={group} max={max} color="#7c3aed" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <h3 className="text-sm font-bold text-slate-900 mb-3">Overall ranking</h3>
        <div className="flex items-start gap-2 bg-teal-50 border border-teal-100 rounded-2xl p-3 mb-4">
          <Trophy size={14} className="text-teal-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-teal-800 leading-snug">Ranked by average kg CO2e per event traveled to — lower is better. Friends' data is simulated for this demo.</p>
        </div>
        <div className="space-y-2">
          {leaderboardData.map((p, i) => (
            <Card key={p.name} className={`p-3.5 flex items-center justify-between ${p.isYou ? "border-teal-300" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="w-6 text-sm font-bold text-slate-400">#{i + 1}</span>
                <span className={`text-sm font-semibold ${p.isYou ? "text-teal-700" : "text-slate-900"}`}>{p.name}{p.isYou ? " (you)" : ""}</span>
              </div>
              <span className="text-sm font-bold text-slate-900">{fmt(p.avgKg)} kg/event</span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  const Account_ = (
    <div className="pb-28">
      <TopBar title="Account" onBack={null} />
      <div className="px-5">
        <Card className="p-5 mb-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center text-xl font-bold text-teal-600">C</div>
          <div>
            <p className="font-bold text-slate-900">Cathy Nguyen</p>
            <p className="text-xs text-slate-500">Member since Mar 2026</p>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <StatCard label="Lifetime Saved" value={fmt(carbonSavedKg)} unit="kg" accent="#0d9488" icon={Leaf} />
          <StatCard label="Total Scans" value={foodLog.length} accent="#0284c7" icon={ScanLine} />
          <StatCard label="Streak" value={streak} unit="days" accent="#d97706" icon={Flame} />
          <StatCard label="Points" value={points.toLocaleString()} accent="#7c3aed" icon={Award} />
        </div>
        <button onClick={resetDemo} className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 rounded-xl py-3 text-sm text-slate-600 active:scale-[0.98] transition">
          <RotateCcw size={14} /> Reset demo data
        </button>
      </div>
    </div>
  );

  const screens = {
    home: Home_, scanner: Scanner_, activity: Activity_, checkin: Checkin_,
    health: Health_, explore: Explore_, wallet: <WalletScreen_ />, account: Account_,
    events: Events_, eventTravel: <EventTravelScreen_ />, myEvents: MyEvents_,
    ecoVenues: EcoVenues_, leaderboard: Leaderboard_,
  };

  const navItem = (id, Icon, label, isCenter) => {
    const active = screen === id;
    if (isCenter) {
      return (
        <button onClick={() => go(id)} className="flex flex-col items-center -mt-6">
          <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/30 active:scale-95 transition" style={{ background: "linear-gradient(135deg, #14b8a6, #0d9488)" }}>
            <Icon size={22} className="text-white" />
          </div>
          <span className="text-[10px] font-bold text-teal-600 mt-1">SCAN</span>
        </button>
      );
    }
    return (
      <button onClick={() => go(id)} className="flex flex-col items-center gap-1 flex-1">
        <Icon size={20} className={active ? "text-teal-600" : "text-slate-400"} />
        <span className={`text-[10px] ${active ? "text-teal-600 font-semibold" : "text-slate-400"}`}>{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-[820px] bg-slate-200 flex items-center justify-center py-6">
      <div className="w-full max-w-[400px] bg-slate-50 border border-slate-200 rounded-[2rem] shadow-2xl relative overflow-hidden" style={{ minHeight: 800 }}>
        <div className="h-full overflow-y-auto" style={{ maxHeight: 800 }}>
          {screens[screen]}
        </div>

        {toast && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-xl whitespace-nowrap z-30">
            {toast}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-white/95 border-t border-slate-200 backdrop-blur px-4 pt-2 pb-3 flex items-center justify-between">
          {navItem("home", Home, "Home")}
          {navItem("activity", Activity, "Activity")}
          {navItem("scanner", ScanLine, "Scan", true)}
          {navItem("wallet", DollarSign, "Wallet")}
          {navItem("account", User, "Account")}
        </div>
      </div>
    </div>
  );
}
