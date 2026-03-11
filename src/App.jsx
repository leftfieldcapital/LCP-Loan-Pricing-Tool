import { useState, useMemo, useCallback } from "react";

const BRAND = "#00BFCE";
const BRAND_DARK = "#007A8A";
const BRAND_LIGHT = "#E0F8FB";
const NAVY = "#0A1628";
const GST = 0.10;

const fmt = (n) =>
  n === "" || n === null || n === undefined || isNaN(n)
    ? "-"
    : "$" + Number(n).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtPct = (n, dec = 2) =>
  isNaN(n) || n === "" || n === null ? "-" : Number(n).toFixed(dec) + "%";

const inp = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00BFCE] focus:border-transparent transition";
const lbl = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1";

// Month options 1–24
const MONTH_OPTS = Array.from({ length: 24 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} month${i > 0 ? "s" : ""}` }));

function Field({ label, children, span2 }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <label className={lbl}>{label}</label>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-px flex-1 bg-gray-100" />
      <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{children}</span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

function NumInput({ value, onChange, prefix = "$", placeholder = "0", step }) {
  const [focused, setFocused] = useState(false);

  // Format number with commas for display when not focused
  const displayValue = () => {
    if (focused || prefix === "%") return value;
    if (value === "" || value === null) return "";
    const n = parseFloat(value);
    if (isNaN(n)) return value;
    return n.toLocaleString("en-AU");
  };

  return (
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>}
      <input
        type={focused || prefix === "%" ? "number" : "text"}
        className={inp + (prefix ? " pl-7" : "")}
        value={focused ? value : displayValue()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/,/g, ""))}
        placeholder={placeholder}
        min={0}
        step={step || "any"}
      />
    </div>
  );
}

function Sel({ value, onChange, options }) {
  return (
    <select className={inp} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function TRow({ label, sublabel, value, highlight, bold, indent, separator, tag }) {
  if (separator) return <tr><td colSpan={2}><div className="h-px bg-gray-100 mx-4" /></td></tr>;
  return (
    <tr className={highlight ? "bg-[#E0F8FB]" : ""}>
      <td className={`py-2.5 px-4 text-sm ${bold ? "font-bold text-gray-900" : "text-gray-600"} ${indent ? "pl-7" : ""}`}>
        <div className="flex items-center gap-2">
          {label}
          {tag && (
            <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, letterSpacing: 0.3 }}>
              {tag}
            </span>
          )}
        </div>
        {sublabel && <div className="text-xs text-gray-400 mt-0.5">{sublabel}</div>}
      </td>
      <td className={`py-2.5 px-4 text-sm text-right ${bold ? "font-bold" : "font-semibold"} ${highlight ? "text-[#007A8A]" : "text-gray-800"}`}>
        {value}
      </td>
    </tr>
  );
}

function InfoBox({ children }) {
  return (
    <div style={{ background: "#FEF9EC", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 14px" }}>
      <div className="text-xs text-amber-700">{children}</div>
    </div>
  );
}

function sCurveWeights(n) {
  if (n <= 1) return [1];
  const raw = Array.from({ length: n }, (_, i) => 1 / (1 + Math.exp(-((i / (n - 1)) * 10 - 5))));
  const diffs = raw.map((v, i) => (i === 0 ? v : v - raw[i - 1]));
  const sum = diffs.reduce((a, b) => a + b, 0);
  return diffs.map((d) => d / sum);
}

export default function App() {
  const [loanType, setLoanType] = useState("construction");
  const [tab, setTab] = useState("inputs");

  // Shared fields
  const [landValue, setLandValue] = useState("");
  const [grv, setGrv] = useState("");
  const [targetLVR, setTargetLVR] = useState("65");
  const [interestRate, setInterestRate] = useState("9.25");
  const [appFeePct, setAppFeePct] = useState("1.75");
  const [brokerFeePct, setBrokerFeePct] = useState("0");

  // Construction-specific
  const [buildCost, setBuildCost] = useState("");
  const [contingencyPct, setContingencyPct] = useState("5");
  const [profFees, setProfFees] = useState("");
  const [statFees, setStatFees] = useState("");
  const [marketing, setMarketing] = useState("");
  const [otherCosts, setOtherCosts] = useState("");
  const [lineFeeRate, setLineFeeRate] = useState("1.95");
  const [facilityTerm, setFacilityTerm] = useState("18");
  const [constructionPeriod, setConstructionPeriod] = useState("12");
  const [drawSchedule, setDrawSchedule] = useState("scurve");

  // Term loan-specific
  const [termMonths, setTermMonths] = useState("12");
  const [termLVR, setTermLVR] = useState("");
  // prepayOption: "full" = prepay entire term, "partial" = prepay N months, rest serviced quarterly
  const [prepayOption, setPrepayOption] = useState("full");
  const [prepayMonths, setPrepayMonths] = useState("6");

  // Construction settlement override (balancing item)
  const [settlementOverride, setSettlementOverride] = useState("");

  const isConstruction = loanType === "construction";

  // Legals provision: fixed defaults, editable
  const [legalsVals, setLegalsVals] = useState(isConstruction ? "20000" : "15000");
  // When loan type changes, reset legals default
  const handleLoanTypeChange = (t) => {
    setLoanType(t);
    setTab("inputs");
    setLegalsVals(t === "construction" ? "20000" : "15000");
    setSettlementOverride("");
  };

  const c = useMemo(() => {
    const land = parseFloat(landValue) || 0;
    const leg = parseFloat(legalsVals) || 0;
    const grvVal = parseFloat(grv) || 0;
    const lvrPct = (parseFloat(targetLVR) || 0) / 100;
    const ir = (parseFloat(interestRate) || 0) / 100;
    const afPctExGST = (parseFloat(appFeePct) || 0) / 100;
    const afPctIncGST = afPctExGST * (1 + GST);
    const brokerPctExGST = (parseFloat(brokerFeePct) || 0) / 100;
    const brokerPctIncGST = brokerPctExGST * (1 + GST);

    // Facility is always LVR-driven: Facility = GRV × Target LVR
    // If GRV or LVR not entered yet, facility = 0
    const facility = grvVal > 0 && lvrPct > 0 ? grvVal * lvrPct : 0;

    // Fees on facility
    const appFeeExGST = facility * afPctExGST;
    const appFeeGST = appFeeExGST * GST;
    const appFeeIncGST = appFeeExGST + appFeeGST;
    const brokerFeeExGST = facility * brokerPctExGST;
    const brokerFeeGST = brokerFeeExGST * GST;
    const brokerFeeIncGST = brokerFeeExGST + brokerFeeGST;

    if (!isConstruction) {
      const months = parseInt(termMonths) || 12;
      const pMonths = parseInt(prepayMonths) || 0;
      const servicedMonths = prepayOption === "full" ? 0 : Math.max(0, months - pMonths);
      const prepaidMonths = prepayOption === "full" ? months : pMonths;
      const tLVRpct = (parseFloat(termLVR) || 0) / 100;
      const land = parseFloat(landValue) || 0;
      const leg = parseFloat(legalsVals) || 0;

      // Facility = Land × LVR (simple, LVR-driven just like construction)
      const facility = land > 0 && tLVRpct > 0 ? land * tLVRpct : 0;

      // Fees on facility
      const appFeeExGSTt = facility * afPctExGST;
      const appFeeGSTt = appFeeExGSTt * GST;
      const appFeeIncGSTt = appFeeExGSTt + appFeeGSTt;
      const brokerFeeExGSTt = facility * brokerPctExGST;
      const brokerFeeGSTt = brokerFeeExGSTt * GST;
      const brokerFeeIncGSTt = brokerFeeExGSTt + brokerFeeGSTt;

      // Net cashout = facility - app fee - broker fee - legals - prepaid interest
      // Interest is on net cashout: interest = cashAdv × ir × (prepaidMonths/12)
      // cashAdv = facility - fees - leg - interest
      // cashAdv × (1 + ir × prepaidMonths/12) = facility - fees - leg
      const feesTotal = appFeeIncGSTt + brokerFeeIncGSTt + leg;
      const interestFactor = 1 + ir * (prepaidMonths / 12);
      const cashAdvance = facility > 0 && interestFactor > 0 ? (facility - feesTotal) / interestFactor : 0;
      const interestPrepaid = cashAdvance > 0 ? cashAdvance * ir * (prepaidMonths / 12) : 0;
      const interestServiced = cashAdvance > 0 ? cashAdvance * ir * (servicedMonths / 12) : 0;

      return {
        land, leg, grvVal: 0, facility, cashAdvance,
        totalDevCost: cashAdvance,
        interestPrepaid, interestServiced,
        interestTotal: interestPrepaid,
        lineFeeTotal: 0,
        appFeeExGST: appFeeExGSTt, appFeeGST: appFeeGSTt, appFeeIncGST: appFeeIncGSTt,
        brokerFeeExGST: brokerFeeExGSTt, brokerFeeGST: brokerFeeGSTt, brokerFeeIncGST: brokerFeeIncGSTt,
        hasBroker: brokerPctExGST > 0,
        lvr: tLVRpct > 0 ? tLVRpct * 100 : null, lvrNet: null, ltc: null,
        months, prepaidMonths, servicedMonths,
        tailMonths: 0, constructionMonths: months, breakdown: [],
        build: 0, cont: 0, prof: 0, stat: 0, mkt: 0, other: 0,
      };
    }

    // ── Construction ──
    const build = parseFloat(buildCost) || 0;
    const cont = build * ((parseFloat(contingencyPct) || 0) / 100);
    const prof = parseFloat(profFees) || 0;
    const stat = parseFloat(statFees) || 0;
    const mkt = parseFloat(marketing) || 0;
    const other = parseFloat(otherCosts) || 0;

    const lf = (parseFloat(lineFeeRate) || 0) / 100;
    const facMonths = parseInt(facilityTerm) || 18;
    const conMonths = Math.min(parseInt(constructionPeriod) || 12, facMonths);
    const tailMonths = facMonths - conMonths;

    // Facility = GRV × LVR (already computed above)
    // Cash advance = facility - appFeeIncGST - brokerFeeIncGST - capInt - capLine
    // We compute capInt and capLine using the facility-sized line fee and iterating on the draw base
    // drawBase = cashAdvance = facility - fees - capInt - capLine
    // Solve iteratively

    const settlementIsOverridden = settlementOverride !== "" && parseFloat(settlementOverride) > 0;
    const settlementOverrideVal = parseFloat(settlementOverride) || 0;
    const knownUpfront = appFeeIncGST + brokerFeeIncGST + leg;

    let capInt = 0, capLine = 0, breakdown = [];
    let cashAdvance = facility > 0 ? facility * 0.85 : 0;

    for (let iter = 0; iter < 25; iter++) {
      const weights = drawSchedule === "scurve" ? sCurveWeights(conMonths) : Array(conMonths).fill(1 / conMonths);
      const monthlyIR = ir / 12;
      const monthlyLF = lf / 12;

      // Day 0: settlement + fees. When settlement is overridden, use that fixed value.
      // When auto-balancing, settlement = facility - fees - capInt - capLine - cashAdvance
      const settlementEst = settlementIsOverridden
        ? settlementOverrideVal
        : facility - knownUpfront - capInt - capLine - cashAdvance;
      const day0Draw = Math.max(0, settlementEst) + knownUpfront;

      let capitalised = 0;
      let drawnBal = day0Draw;
      const rows = [];

      for (let m = 1; m <= facMonths; m++) {
        const conDraw = m <= conMonths ? weights[m - 1] * cashAdvance : 0;
        drawnBal += conDraw;
        const intCharge = (drawnBal + capitalised) * monthlyIR;
        const lfCharge = facility * monthlyLF;
        capitalised += intCharge + lfCharge;
        rows.push({
          month: m,
          phase: m <= conMonths ? "Construction" : "Tail",
          newDraw: conDraw,
          drawnBal, interest: intCharge, lineFeeChg: lfCharge, capitalised
        });
      }

      const newCapInt = rows.reduce((s, r) => s + r.interest, 0);
      const newCapLine = rows.reduce((s, r) => s + r.lineFeeChg, 0);

      if (settlementIsOverridden) {
        // When settlement is fixed, cashAdvance = facility - fees - capInt - capLine (unchanged from facility)
        // Just iterate to converge cap interest/line fee with the fixed day0 balance
        const newCashAdv = facility - appFeeIncGST - brokerFeeIncGST - newCapInt - newCapLine;
        if (Math.abs(newCapInt - capInt) < 0.50) {
          capInt = newCapInt;
          capLine = newCapLine;
          cashAdvance = newCashAdv;
          breakdown = rows;
          break;
        }
        capInt = newCapInt;
        capLine = newCapLine;
        cashAdvance = newCashAdv;
      } else {
        const newCashAdv = facility - appFeeIncGST - brokerFeeIncGST - newCapInt - newCapLine;
        if (Math.abs(newCashAdv - cashAdvance) < 0.50) {
          capInt = newCapInt;
          capLine = newCapLine;
          cashAdvance = newCashAdv;
          breakdown = rows;
          break;
        }
        cashAdvance = newCashAdv;
        capInt = newCapInt;
        capLine = newCapLine;
      }
    }

    // Settlement: balancing item = Facility - all other known costs - cap interest - cap line fee
    // If user has manually entered a settlement override, use that and compute actual LVR
    const knownCosts = appFeeIncGST + brokerFeeIncGST + leg + build + cont + prof + stat + mkt + other;
    const settlementBalancing = facility - knownCosts - capInt - capLine;
    const settlementVal = settlementOverride !== "" ? (parseFloat(settlementOverride) || 0) : settlementBalancing;

    // Actual funding table total (using settlement value)
    const fundingTotal = settlementVal + knownCosts + capInt + capLine;
    const actualLVR = grvVal > 0 ? (fundingTotal / grvVal) * 100 : null;
    const targetLVRpct = lvrPct * 100;
    const lvrDiff = actualLVR !== null ? actualLVR - targetLVRpct : null; // positive = over

    // Sub-total = settlement + fees + dev costs (excl cap interest/line fee)
    const subTotal = settlementVal + appFeeIncGST + leg + build + cont + prof + stat + mkt + (brokerPctExGST > 0 ? brokerFeeIncGST : 0) + other;

    // Development cost breakdown (for reference)
    const totalDevCost = land + build + cont + prof + stat + mkt + leg + other;
    const lvr = grvVal > 0 && facility > 0 ? lvrPct * 100 : null;
    const lvrNet = grvVal > 0 && totalDevCost > 0 ? (totalDevCost / grvVal) * 100 : null;
    const ltc = totalDevCost > 0 && facility > 0 ? (facility / totalDevCost) * 100 : null;

    // Day 0 draw total (settlement + fees drawn at settlement before month 1)
    const day0Total = settlementVal + appFeeIncGST + brokerFeeIncGST + leg;

    return {
      land, build, cont, prof, stat, mkt, leg, other, totalDevCost, grvVal,
      facility, cashAdvance, subTotal, day0Total,
      settlementVal, settlementBalancing, fundingTotal, actualLVR, targetLVRpct, lvrDiff,
      appFeeExGST, appFeeGST, appFeeIncGST,
      brokerFeeExGST, brokerFeeGST, brokerFeeIncGST,
      hasBroker: brokerPctExGST > 0,
      interestTotal: capInt, lineFeeTotal: capLine,
      lvr, lvrNet, ltc,
      months: facMonths, constructionMonths: conMonths, tailMonths,
      breakdown,
      interestPrepaid: 0, interestServiced: 0, prepaidMonths: 0, servicedMonths: 0,
    };
  }, [
    isConstruction, landValue, legalsVals, grv, targetLVR, interestRate, appFeePct, brokerFeePct,
    buildCost, contingencyPct, profFees, statFees, marketing, otherCosts,
    lineFeeRate, facilityTerm, constructionPeriod, drawSchedule,
    termMonths, termLVR, prepayOption, prepayMonths, settlementOverride,
  ]);

  const tabs = isConstruction ? ["inputs", "costs", "breakdown", "summary"] : ["inputs", "summary"];
  const tailN = Math.max(0, parseInt(facilityTerm) - parseInt(constructionPeriod));
  const prepaidN = parseInt(prepayMonths) || 0;
  const servicedN = Math.max(0, (parseInt(termMonths) || 0) - prepaidN);

  // ── PDF Generation ──────────────────────────────────────────────────────────
  const generatePDF = useCallback(async (c, isConst) => {
    const loadJsPDF = () => new Promise((resolve, reject) => {
      if (window.jspdf) return resolve(window.jspdf.jsPDF);
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = () => resolve(window.jspdf.jsPDF);
      s.onerror = reject;
      document.head.appendChild(s);
    });

    const jsPDF = await loadJsPDF();
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210, H = 297;
    const ML = 15, MR = 15, PW = W - ML - MR;
    const BRAND_C = [0, 191, 206], NAVY_C = [10, 22, 40], GREY = [107, 114, 128];
    const WHITE_C = [255, 255, 255];
    const fmtN = (n) => n == null || isNaN(n) ? "—" : "$" + Number(n).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const fmtP = (n, d = 2) => (n == null || isNaN(n)) ? "—" : Number(n).toFixed(d) + "%";
    const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

    let y = 14;

    // ── Logo ──────────────────────────────────────────────────────────────────
    const logoBase64 = document.querySelector("img[alt='Leftfield Capital Partners']")?.src;
    if (logoBase64) {
      try { doc.addImage(logoBase64, "PNG", ML, y - 3, 52, 19); } catch(e) {}
    }

    // Header right-aligned text
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...NAVY_C);
    doc.text(isConst ? "Construction Loan — Indicative Term Sheet" : "Term Loan — Indicative Term Sheet", W - MR, y + 5, { align: "right" });
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GREY);
    doc.text(`Prepared: ${today}`, W - MR, y + 11, { align: "right" });
    y += 22;

    // Teal divider
    doc.setDrawColor(...BRAND_C).setLineWidth(1.2).line(ML, y, W - MR, y);
    y += 8;

    // ── Hero card ─────────────────────────────────────────────────────────────
    doc.setFillColor(...NAVY_C).roundedRect(ML, y, PW, 28, 4, 4, "F");
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...BRAND_C);
    doc.text("TOTAL FACILITY LIMIT", ML + 6, y + 7);
    doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(...BRAND_C);
    doc.text(fmtN(isConst ? c.facility : c.facility), ML + 6, y + 18);
    if (isConst) {
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor([94, 122, 144]);
      doc.text(`GRV  ${fmtN(c.grvVal)}  ·  Net LVR  ${fmtP(c.lvrNet)}  ·  LTC  ${fmtP(c.ltc)}`, ML + 6, y + 25);
      doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...BRAND_C);
      doc.text(`${fmtP(parseFloat(targetLVR), 0)} of GRV`, W - MR - 6, y + 7, { align: "right" });
    } else {
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor([94, 122, 144]);
      doc.text(`Net Cashout  ${fmtN(c.cashAdvance)}  ·  ${termMonths} month term  ·  LVR ${fmtP(c.lvr)}`, ML + 6, y + 25);
    }
    y += 34;

    // ── Two-column section ────────────────────────────────────────────────────
    const COL = (PW - 6) / 2;
    const sectionHdr = (label, x, w, yPos) => {
      doc.setFillColor(...NAVY_C).rect(x, yPos, w, 8, "F");
      doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...BRAND_C);
      doc.text(label.toUpperCase(), x + 4, yPos + 5.5);
      return yPos + 8;
    };
    const miniRow = (lbl, val, sub, x, w, yPos, bold) => {
      doc.setFillColor(bold ? [248, 250, 252] : WHITE_C).rect(x, yPos, w, sub ? 10 : 7, "F");
      doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(8).setTextColor(bold ? [17, 24, 39] : [...GREY]);
      doc.text(lbl, x + 4, yPos + 5);
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor([17, 24, 39]);
      doc.text(val, x + w - 4, yPos + 5, { align: "right" });
      if (sub) {
        doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...GREY);
        doc.text(sub, x + 4, yPos + 9);
      }
      doc.setDrawColor(229, 231, 235).setLineWidth(0.2).line(x, yPos + (sub ? 10 : 7), x + w, yPos + (sub ? 10 : 7));
      return yPos + (sub ? 10 : 7);
    };

    const x1 = ML, x2 = ML + COL + 6;
    let y1 = sectionHdr("Pricing Summary", x1, COL, y);
    let y2 = sectionHdr(isConst ? "Project Details" : "Security Details", x2, COL, y);

    if (isConst) {
      y1 = miniRow("Interest Rate", fmtP(parseFloat(interestRate)), "p.a. on drawn balance — capitalised", x1, COL, y1);
      y1 = miniRow("Line Fee", fmtP(parseFloat(lineFeeRate)), "p.a. on full facility — capitalised", x1, COL, y1);
      y1 = miniRow("Application Fee", `${appFeePct}% + GST`, `${fmtN(c.appFeeExGST)} + ${fmtN(c.appFeeGST)} GST`, x1, COL, y1);
      if (c.hasBroker) y1 = miniRow("Broker Fee", `${brokerFeePct}% + GST`, `${fmtN(c.brokerFeeExGST)} + ${fmtN(c.brokerFeeGST)} GST`, x1, COL, y1);
      y1 = miniRow("Construction Period", `${constructionPeriod} months`, null, x1, COL, y1);
      y1 = miniRow("Tail / Sell-down", `${tailN} months`, null, x1, COL, y1);
      y1 = miniRow("Facility Term", `${facilityTerm} months`, null, x1, COL, y1, true);

      y2 = miniRow("Land Value", fmtN(parseFloat(landValue)), null, x2, COL, y2);
      y2 = miniRow("GRV (Net)", fmtN(c.grvVal), null, x2, COL, y2);
      y2 = miniRow("Build Cost", fmtN(c.build), null, x2, COL, y2);
      if (c.cont > 0) y2 = miniRow(`Contingency (${contingencyPct}%)`, fmtN(c.cont), null, x2, COL, y2);
      if (c.prof > 0) y2 = miniRow("Professional Fees", fmtN(c.prof), null, x2, COL, y2);
      if (c.stat > 0) y2 = miniRow("Statutory Fees", fmtN(c.stat), null, x2, COL, y2);
      if (c.mkt > 0) y2 = miniRow("Marketing", fmtN(c.mkt), null, x2, COL, y2);
      y2 = miniRow("Legals & Vals", fmtN(c.leg), null, x2, COL, y2);
    } else {
      y1 = miniRow("Interest Rate", fmtP(parseFloat(interestRate)), `p.a. — ${prepayMonths} months pre-paid`, x1, COL, y1);
      y1 = miniRow("Application Fee", `${appFeePct}% + GST`, `${fmtN(c.appFeeExGST)} + ${fmtN(c.appFeeGST)} GST`, x1, COL, y1);
      if (c.hasBroker) y1 = miniRow("Broker Fee", `${brokerFeePct}% + GST`, `${fmtN(c.brokerFeeExGST)} + ${fmtN(c.brokerFeeGST)} GST`, x1, COL, y1);
      y1 = miniRow("Loan Term", `${termMonths} months`, null, x1, COL, y1);
      y1 = miniRow("LVR", fmtP(c.lvr), null, x1, COL, y1, true);

      y2 = miniRow("Security Value (Land)", fmtN(parseFloat(landValue)), null, x2, COL, y2);
      y2 = miniRow("Facility Limit", fmtN(c.facility), null, x2, COL, y2);
      y2 = miniRow("LVR", fmtP(c.lvr), null, x2, COL, y2);
      y2 = miniRow("Interest Pre-paid", fmtN(c.interestTotal), null, x2, COL, y2);
      y2 = miniRow("Net Cashout", fmtN(c.cashAdvance), null, x2, COL, y2, true);
    }

    y = Math.max(y1, y2) + 8;

    // ── Funding Table ─────────────────────────────────────────────────────────
    const trow = (lbl, sub, val, opts = {}) => {
      const h = sub ? 11 : 8;
      const bg = opts.highlight ? [224, 248, 251] : opts.bold ? [248, 250, 252] : WHITE_C;
      doc.setFillColor(...bg).rect(ML, y, PW, h, "F");
      const indent = opts.indent ? 6 : 0;
      doc.setFont("helvetica", opts.bold ? "bold" : "normal").setFontSize(8).setTextColor(17, 24, 39);
      doc.text(lbl, ML + 4 + indent, y + 5.5);
      if (sub) { doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...GREY); doc.text(sub, ML + 4 + indent, y + 9.5); }
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(opts.highlight ? 0 : 17, opts.highlight ? 96 : 24, opts.highlight ? 70 : 39);
      doc.text(val, W - MR - 4, y + 5.5, { align: "right" });
      doc.setDrawColor(229, 231, 235).setLineWidth(0.2).line(ML, y + h, W - MR, y + h);
      y += h;
    };
    const tsep = () => { doc.setDrawColor(...BRAND_C).setLineWidth(0.5).line(ML, y, W - MR, y); y += 3; };

    y = sectionHdr("Funding Table", ML, PW, y) + 2;

    if (isConst) {
      const settVal = c.settlementOverride !== "" ? parseFloat(settlementOverride) : c.settlementBalancing;
      trow("Settlement (Land Purchase / Refi)", settlementOverride !== "" ? "Manual override" : "Auto-calculated balancing item", fmtN(settVal), { indent: true });
      trow(`Application Fee (${appFeePct}% + GST)`, `${fmtN(c.appFeeExGST)} + ${fmtN(c.appFeeGST)} GST`, fmtN(c.appFeeIncGST), { indent: true });
      trow("Legals & Valuations (inc. GST)", null, fmtN(c.leg), { indent: true });
      trow("Construction Drawdowns", null, fmtN(c.build), { indent: true });
      if (c.cont > 0) trow(`Contingency (${contingencyPct}%)`, null, fmtN(c.cont), { indent: true });
      if (c.prof > 0) trow("Professional Fees", null, fmtN(c.prof), { indent: true });
      if (c.stat > 0) trow("Statutory Fees & Contributions", null, fmtN(c.stat), { indent: true });
      if (c.mkt > 0) trow("Marketing Costs", null, fmtN(c.mkt), { indent: true });
      if (c.hasBroker) trow(`Brokerage (${brokerFeePct}% + GST)`, `${fmtN(c.brokerFeeExGST)} + ${fmtN(c.brokerFeeGST)} GST`, fmtN(c.brokerFeeIncGST), { indent: true });
      if (c.other > 0) trow("Other Costs", null, fmtN(c.other), { indent: true });
      tsep();
      trow("Sub-Total", null, fmtN(c.subTotal), { bold: true });
      tsep();
      trow("Capitalised Interest", `${fmtP(parseFloat(interestRate))} p.a. on progressive drawn balance`, fmtN(c.interestTotal), { indent: true });
      trow("Capitalised Line Fee", `${fmtP(parseFloat(lineFeeRate))} p.a. on full facility × ${facilityTerm} months`, fmtN(c.lineFeeTotal), { indent: true });
      tsep();
      trow("TOTAL FACILITY LIMIT", null, fmtN(c.fundingTotal), { bold: true, highlight: true });
    } else {
      trow(`Application Fee (${appFeePct}% + GST)`, `${fmtN(c.appFeeExGST)} + ${fmtN(c.appFeeGST)} GST`, fmtN(c.appFeeIncGST));
      if (c.hasBroker) trow(`Broker Fee (${brokerFeePct}% + GST)`, `${fmtN(c.brokerFeeExGST)} + ${fmtN(c.brokerFeeGST)} GST`, fmtN(c.brokerFeeIncGST));
      trow("Legals & Valuations (inc. GST)", "Editable estimate", fmtN(c.leg));
      trow(prepayOption === "full" ? `Interest Pre-paid (${termMonths} months)` : `Interest Pre-paid (${prepayMonths} months)`, `${fmtP(parseFloat(interestRate))} p.a. × ${prepayOption === "full" ? termMonths : prepayMonths} months`, fmtN(c.interestTotal));
      tsep();
      trow("Net Cashout to Borrower", null, fmtN(c.cashAdvance), { bold: true });
      tsep();
      trow("TOTAL FACILITY LIMIT", null, fmtN(c.facility), { bold: true, highlight: true });
    }
    y += 6;

    // ── LVR Analysis (construction only) ─────────────────────────────────────
    if (isConst && c.grvVal > 0) {
      y = sectionHdr("LVR Analysis", ML, PW, y) + 2;
      trow("Target LVR", `${fmtN(c.grvVal)} GRV × ${fmtP(c.targetLVRpct, 0)} = ${fmtN(c.facility)}`, fmtP(c.targetLVRpct), { bold: true });
      trow("Actual LVR", `Funding total ${fmtN(c.fundingTotal)} ÷ GRV ${fmtN(c.grvVal)}`, fmtP(c.actualLVR), { bold: true });
      const diff = c.lvrDiff;
      const onTgt = Math.abs(diff) < 0.05;
      const over = diff > 0.05;
      const posLabel = onTgt ? "✓ On target" : over ? `▲ Over by ${fmtP(Math.abs(diff))}` : `▼ Under by ${fmtP(Math.abs(diff))}`;
      const posBg = onTgt || !over ? [209, 250, 229] : [254, 226, 226];
      const posFg = onTgt || !over ? [6, 95, 70] : [153, 27, 27];
      doc.setFillColor(...posBg).roundedRect(ML, y, PW, 10, 2, 2, "F");
      doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...posFg);
      doc.text("Position vs Target", ML + 6, y + 6.5);
      doc.text(posLabel, W - MR - 6, y + 6.5, { align: "right" });
      y += 16;
    }

    // ── Disclaimer ────────────────────────────────────────────────────────────
    doc.setDrawColor(229, 231, 235).setLineWidth(0.5).line(ML, y, W - MR, y);
    y += 5;
    const disclaimer = "Important Notice — Indicative Pricing Only. This summary has been prepared by Leftfield Capital Partners for indicative purposes only. All pricing, fees, rates and terms are indicative and subject to formal credit assessment, satisfactory due diligence, and credit committee approval. This document does not constitute an offer, commitment or guarantee of finance. Leftfield Capital Partners reserves the right to vary or withdraw indicative terms at any time without notice. Applicants should seek independent legal and financial advice before proceeding.";
    doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...GREY);
    const lines = doc.splitTextToSize(disclaimer, PW);
    doc.text(lines, ML, y);

    doc.save(`LCP_${isConst ? "Construction" : "Term"}_Loan_Summary_${today.replace(/ /g, "_")}.pdf`);
  }, [isConstruction, appFeePct, brokerFeePct, lineFeeRate, constructionPeriod, facilityTerm, tailN, contingencyPct, termMonths, prepayMonths, prepayOption, targetLVR, interestRate, settlementOverride, landValue]);

  return (
    <div style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif", background: "#F0F2F5", minHeight: "100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: NAVY }}>
        <div className="max-w-lg mx-auto px-5 pt-7 pb-0">
          <div className="flex items-center gap-3 mb-3">
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAooAAADtCAYAAAA4GlRHAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAEAAElEQVR4nOz9+69tWXbfh33GnGutvc8591Z1F9lsskk1KZG0qGecWJRswbRlJL84CYL8ENtxENsBggD5JT84QQL/CYF/MIwkTpAAdhApjg0/4gBGYDuRFMqSJZmSKVkvkuarKTab7OruqrqPc/Zea805Rn4Yc6619j7nVvc9p1inbt35Ldza++zH2nPNx5jf8ZhjQENDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0PDd4E8dgM+C6idYPWP7Qt2xwfZvH72mhAIm5cygOjmM9t3AZQHYWlrva6+4vVNOwzg7HUr3/m0HytKm+pbFbHcTz673eUr5T6k3Ludf+j0w3fjvu2/E+FsvE/b/Yppc9oWYZ0WrxrfT6L9n+T4lTaejMPJLYTNa3rHd++4p+X17Zr5BO8fiKzXr1demnLHOK4I67q5C2cDfue8lbN7sbv6atuy29cX21zzu8mn7evn13qM+XPH/ZzKR/2uzY+buXEyfnf07en9fsx6+hQhm/bbK9bF3X1Q5d6r23931wcMXR7vmjOvFp+1rWEzXsrD+vB0HO68V9n8s80bHyfT7/H7Uv7SzaXlrH2vXGefc3SP3YDHRp0cEZgBi+WFOhHz9tNheU+sTJzAurFbIBKIQETI+JZ5stdpAJOzfeSeC+1k8cTNGxsBYHEVCrAIUCkNt0ed6bppfygkW9BFmBl9+VxdvLW7DcrnYvleJZR6W7DobaKxdI/AKRF5fZzse1KF6DqmYpT7gKl82O/D73PZ4Opk3E6O+lzCRjjqJ9r++2M7zwKUuQ9KKv0vWlsXl3EF/I2T7+rp/S4IZ5tp+d2KB9y/4AKwXl+BXNYtUnZoW+foOs5hHWdTTtfy3QpbsPN5Wz53RmhC6ce8uWol31DHe/2dZd7X+X7XTdbHzSYrt8joI0A2fRTwebDIx9qb63p1cbwSbDHoCMimhzK2imw5mycnZLH0v9VvfvpwuVXlV2ZG1/0EvD+ynogE8C3Jijzw7Wptv5Z54fNsJT7rY1geM0DQE8VUlmvW653NWYnUVYMY2Mj9+y+wXbvCeq+1vUkoDQre1ioDtXYEPEj+Sdk3zfuxK5ecSvtCMV4EfG9x2cBt0vo5x1tPFCuqJTBbWLUk9bXgkyScbdawbG7LRZTTlf5xqEvhk0JdLPlkIq+TnFf8nt6e8J/WY0UhVmZh1eakPFaLybmlDcpmGxa5sV6LU2ELUCjorTVtdzx/nfaLt7v+xoqPGV8BtVCE9uY7dd6VOSa2JR/1hs6u+5D2f1LjdxfKeJmAWhW5nRP5OmJ3WZa23y/vhc0L9dvL2w8cv0zdaP3/d46YnU4rq8/sdCxu3c7mhe33Q91wjNM3T75SiWh+Vas4sb6d/PC5XGKVW3ZqxTr57iM8RjjtizPZWe/8Lipg1PFbP7vKgVdYFO9URh4HlYC9WlKsJPlO+6eA2W1L+NYill/xuF7n9q9v5Wl9bpVumoIksA5IH3+DD8QyJSywKhHq/04MOA8hqus1TnSt8kRtNcF8RqbNo+BtvneqRiMIQyEc0+JS8uWxo/ITcYujAFghkGljJahX3G5rZxYuyou21aQeZrpfL1tsVjKfqGRROyKCkqmuBsUFTP3+I9qjTnl1faGaegxIpW+KEsvs7iYfnQBSNdvSj+czWsOZoN24p+1h9+8a+eaFV4QVVGVDqYS38yebeVBtIkZG0MUC6Zp8tbL6r8pmzjzW2G2hZ6ROKfsILLu5sGPVSydg3ljHWFyowPq6rQpcJTdugdVP5L6X8TtheGVTWtzKuoxffb+OiWP29pf3Vr5zalE+b2/d5+ompEUxirZRSqtFczOPVtQFsVqQKuLiRluJ9ccRkfAA+fMQVGORy11vydojVZnQ9c+z71r9yvn4nd3PatVmlRvL73wMEf9dR3BLGYDqmZXdH6LdeqnMnTJHtvvHuZK8xXn/VDl7S9nYWmE31637hZ2O0sytoXkNbOXf6T64ymif51UOxOWzhpEePHpbXW07lfLGA7iustWzdWtQPudoFkVWZdv5nC4kKiLEsiVYES+V+FlxPW/Fmk/aszi58wl1vhgfSBK34m753ZNdyTXBWNqlxsmKCHa3XPk0EHD5uMiqZWPc/H3ynn+rCg1ftBsd+YSM+589py8Lm77i1Fb3uliatDzxm1ltf3fRmbAyoZMNTgllg49sp4+UdnsQg88vv9dKHB5T2wusls/MxgUqpx8y1c1wlljU0v7tCrhlJXwFqjsNHnj/291BKRYLNkrE1nkH3BrTU6K22D3PxqYqCWJl+O20m4J53+ViXV9/5pQorf0nG2vPijp3qlxY+6ha0/XkO9u59mmjdr0AA1V+boJh7gjj2Cp3t4i+ls/a6efgbKl9JtQrCoM98w4UYlJjs7cEt97DiTX9fL1tB/OudbTI140b96SXysyRslEUC96WSN3i5g/ErSZvJ0YR1gPbuRpIi7r4MJK/KGpsFflNo0SL1faM1BZvwlvCE99yoiirFlNNzD1lw1tcUXoS/bdlFnqHIndroi+L8cxq8glpsVUj943aTn+3tF/w2ElB3ZBV22ig+VWE5ncf1XKm6rEoUgRCtmJI3PZfed5RJ63HV2ZTsm2E1oYgBkKxzK36YHVVzZvv2L3vXxcJXjXtbczbaifcWJBsu7lXK6hhlhZDah3TdYbo8v9FkBUZrvq44wfb0IZQ5v4Z2V92AidcpwRssx+czV0slHkdbm8m5TveV/e7f0HXfdNW600sa6b+lhEWebAu4a2qscWpvDjffGwjA7bkb/GkLfJFz1jB+oElTAYwZmrIy/q7r97AVE77+THnT13iW/KRURLhbgK0laUUt3Ve31vH75R86Oaf3SL+j4w6xoBYoCcsMqCS+rx+pHy8hq1Aqlr2rQG/Ta7htmIcioU+U+Nmy7slTrRnDZCpfZgF8i0Lxf0gy0rzlix8bPH3KqRAtswai2pM1TBg2/F8vUcpivkJX96y4A0RN1vXmJQPuox+O8jiZ2S1PCLK5NjIIEf0OZgIJM6sJQUmMNJxpCfRFZdRefNMTT8liZ+cFl8JxQntVJBcLT0diZ5M7+2zzZeMZbLzCI+2rMywmBU7cHd/8SksrhfbtnelTrvy+Qjroj7tiiIK9fTWy+5UrcD3aX+VZ7EoGfXfqnv6b81UIuQtiGSEGWSGMIOkZQ7W76XyPZ97YSVSFZubfLzxWyH0UP9JqNrWxrNXP60nJHgl/pyRgq1ociuqbYVyGes6vvdpP9y2yq6/us4Xvw3FRH2sSMTyb9uWaneoZGU5FHCyC3VgHVhftvt6iQBW+7Bz31ftO9vKj7BZAwZRF3Je/0v4oalJqpP/ZMk7PgPzJxMY6RnpsRNlYEtySr+dEceqHEi1Hp5YXLf35t2YqATZe66O38edGv40sLFV+PwqWEgZ67hVA8bqubol+Tff5pZldSujus0/f02BtG4cG8uucRqcsDz/hBjSnSNQF5+pW/WWOzZm1Od9LGSRjlVNf/1HWZ53LIecMsS8aceCzUG0twiP6bV6fGzVT5+PRCsnrYYisCeKuT4vGzoGoh1GhKHECqUMWihl0POgmNM0FpxqiJ8M+vJDbpnqi+UqcYVTKUVIwFh+s27PY3nv1IDxaTxWWmhEF1CWeIeZiHKgCHcKQa87sBZSKYAm3i1vPa9abv2Bssjv5FZbjbVI4vu0f7Ugno5rtYItlpEIdOrzaPanaWt1rl/McKk+bkcBQg/alYuXuVVi587v6zHGz89sRoQBo1/je2Wm0wNdoQRaxtpOTj77OF+We3gpG25om3+vklD1dT3t99d6PLdanf82nFoZyu+Jwq68fxRAOn/DlGhsLEKBRGQmYHQg603WzVlKjKP3X1faM9PpxMC8GGx0eew28zjdjj2pEzOUmVkHYCHr/sdnYf6YdNDt/YU0l/utJ0s36paUThc267rEg24DELfjV1HHdzO3Yl7Hb+TsXMSniEiVzHCssit35f5cCTlZE8AS02ibib99/xxl7zl3G2/JI6xKac1WsPzbaBd3xdqeKB+vjcCaD6LQ+RNlkQ3RrV6hqndVoR3u3wALDMX3NBGLrFawzD6PDCgTi+Qtykz1NLyKpH8+8Xa7nsHHumqpUs5x9R3sLyDunAiqb36EtExOS9E3iAGwBIe5zCjjxCddJvsyl8vJ6aqjPWih3cmC/LkCKXSw20O8KG0wnPkq2LBs6pA22uOn+dhBvigSa4I08/wmsGcmbdq07G/LLqOLIJutdPuAj1XoQfolGnntdy1/6GbjCMsmep/2ZyCfxB+U60nwf4t5SSEmSDPovH6nNAdYFJZqDeLiAroL3MoEC222BIT1pLUstqXXbv9DHzOBrBGsAy2WxD5DPpKOCrqmzrDtQitjkIEXBIgBdhG6QrEsrAFoNYarWltqf1XNvwzefe9jDdgvOxJS1uzWklWIimZIMzYn0lw22TqnNptG3VQykSwDdD30EWKxWqi7TLOpyxQAHZxIdgZ6JB2UYPNyzVD6e8F5jsd6Q7F3+TX0Lp/qKZl6YlT8C84zdLm/R1n/Eny95gyHzJzr6+sHBfG5HtY1D/hrXfR77eQV48c6fnXtpJk8K2n+bGx+GRgDsOuh24HtvKmSXTYv876ss0oUJZ3e54KNMEPLn0a2zXuVZGqZiFsZdv5viW0KmEHWWCyS/rupkPv7Y/Nd2ZBaK+soBCxGcuygC7eZ6pLP7h6wwJQE6HxtRgHJME8cbyByWJbWur2WyfmKQ1afV3wW1sqjQQyiBYJE5jBjQ++mnh/6Kj/5P/uf2jc00MkAQOpGsigpglhgmHd0CmIv+AEzvvmzf5lnf+kvSyQQM6hkUl7PRtqy6awxJf7eJ6CVFGEhgFkhvAHY7/nxf/F/Yd/eX5FCJAtYmBFTovqmvLp/P32IQRAjpRELR34kBn7l//Kn5fj13yyrM7kLAKiacUSXlBCJjpt45QTjZ/5h+/E/9Y/zraykuCNqRwiBJIaJ+j2bczaAOYLKw+5b8b6ucV9iqyewHmrpTMjpSJCRHwmRv/d//tPY139TKona05FIJJuLAXuAbuCH/8f/gqWv/DBzuCQFyCFjUtNRBERdEz5xR3/KUElMMjIE4UL3zOOMRuUHUX7t3/i/Svqtvw/5WFhltWIVyWrqZObiPf7o/+p/bV/LB8bdBRZ7Qo7scyClhA2BLO72FZROA8ECSQIqq8J1H4hR8omCBl0OkkQL7hSwQM6ZGJQO5TJN/BDKX/tX/lVJTKR5IjKDpWUu5MUiEpzE7Hb89P/yX7Sv5Zmb/Z65HzATdiqkNJEGJYTAcOjoJTDZka8E+OV/+X8r0zFBnk/2pU3ve1fOdT/vSfECuo7f98/+Mzb+yA/wvOuQsKc6xNf2mYd0GBjRc/I9AnqdeTIdiL/9W/z9P/NnxKRYpDNgSk9HhzCTXZ7Bmk9HhPDjP2U/9j/4H/H+xdXZ+EHQYoNSQ2ymN+WJzYy/8Rv89r/378ukI1OecVva41iGsnTkMMBuzx/+3/xL9psmEJ8wG4Q+kW1CQiJYYDf3BOuYgpCDOVEE+hzKHF7vYY0dVqbjyPWL56SPnsN0hOsDfPABvP8+vPxImF/CfHSPGAazz2ffSNgou+YuG3U/Sk9EyQ8+d1zzZdpJ+731Rg+7gd0f/4fsKz/zJ/jOEMhXl6gJMRuSBOGikMXXh0rG5ABDxzF3SAh0lvi+Fy/5rX/lfy/XN/OqyG0YYwC07LNvC95qolhdZ1hRsiy4Neq9L1n8sZ8g7PZIuHQiEEcsJDcWaYekC0JWgn2AHK+Rv/3LID2q5sQm2+ZE1cZ/VSaXmAcJP9jtsXERBGriAIAe4sDF7//9hKt3sNj7GpcZTP0eNJKl47FiLkwUkUDIR5QX6HSE73/P+PZ3XICpgPpGWT0zJ54WKffZX8GXvgK/7yeIccB2V1gOZAmkuBJF0RJ3AkgIS1zg/dvvZDMH0LqT5+rl89HoLBDTSNBr4nGGL3w/fPM7oEa0DCpEOpLUkPUAwyX5h34Y+ck/QBieYl3AwlximBSxDtEdWMRCfjSlVkNCuxuSCJYu6MaEhYl4uIH3vt/41reE41Qs8oCdxRiGDt75AvZ7fxzpDbu4xNhhOSC5Y7DM1IOFhIn6CX0NvlmFgIhgD1lBFgjqqzRHRYObrg3ocnDiL0K0hOSReHPj99ZfgA0wPwfm295xAYJAjPDkCd2PfpW+j4QnV1jsMfVxFjKpz3ShQ46++ab5OTJeu0fDsnsqSqe5xCj+17IYJEOkI9TYx7hDv//LhN/34/RPnpDCHk8q7K7aSsZEnSiqPF7MVcgj8eZDsNktavngb0i9PSMSMdQPt52Fa2i/Z/j9fxSevEMOd49fQAg6E/RIOF4j4wxX70J6CfkF6+GGx4DAcAm7J8hXf4JwcQn79zCM1M0kuyaI0imEcUfQHumqddWtjTl3nqR9k4Tc+Z2HfVzEQD/PhJwZuo4uBDRn0jjRTQd79uu/wLO/+fPwC78AH3xHkNE9HzYRhoiOUyFIZZMMPX3sSTOkB9oSa4Jt0EXB8p0yIPQkdhCfEL/yY1z+136aZ5cdNyGSpsyQhb3sMR5gUZQZDTdoMCRcAgHJI/37H8DFEzgenTSfhzagtw/efc7xVhNFXR6LmkByd03fk59cka/eYTqWqRwDkDCBYAPRLtCo5CfCzaFj3l1A6DAbEaTkLrRFKcsngTJlUS/vPQCnl3SF2wKWPWBe4wVTf8UsfdkkZjqFWDZIDRkNjyQobSDJAHHAJGL6AuYAx+KD0jVNuBSBbhSrSAeQIB0h9xASthdyH5mHjpw8yseiLHGlsyq77JaiKbg1Lpqe5af73lErK4C7SFyArG008Uyb0QJCx1EmkBvfoMI1WV03t+pire5rMuNuR//0XQ7s3HoWOo96NBAdiLZ3C1EYsTC/upG/i7DQQbgiK5AvCJJhuKCbA4w93Nji8oyUKboJGyAoHA8EzfT9wLwfmLInpAoSPS4pzhADJoqaEyNC8Pki+M543+2qrJMcnCimmBfhn4pFSkToiHTZq6WoKr6ZHhCO1Dl566BRdfceFNOB0F/R9U9AnMB01tMF42DXqAwE27tFI4pbSUeB64Qoy8l9rfaXTXCZCeSUyjxMEC+YLwf0naekd77AYQSsW9Z7VSdj2fAec/3PMTL37zJd7jl38HWyIXrbL9V+DhFiJHcdqeuYu+REsYyfaljWdTSPhUshkocMdg3pBR2jH1L6NG72LpjB4Rq6gHVKvuiZ95GDqrvTDYgw50BHIGjg2AVS0ZUQNtl1zveWQDAwyxD9bLGvLI+hD31PkJ747j/El//QH+Fymph+6+v2W//5X4W/8deFb30bHUckR/YGNQ/vcNnx8vDS3bR9B6M+iCwtaZsWAwq46twzsoN5z3G+5Fm+4hmX5O4CYkCmAUE56g0a7reDRvMjeJYzMb5TUsftuBgMXihDUfqTre0zzvLnviVk8a0mipWCaMhF+GbPy5ImXswzN+MM7MtHyy5loJrpctkH5oTMyiEb26MNKoKVXBi/qxbqk4nqTxbyaYGjCgcTlEg96uu5XT1t9STGo9mkTDETJHRY15HrmbyyGmPsyGnafKHoyVttToobRjLJEkfLTJo8pkdKXJb5BdVgVoBMMqfwWe3eRBGMYLXWiPsHs7ISGIFs5q6iAFMERKgVDWIPNmX/bt38s7uAjqocdWaUvYvScg/BAlEVVXclJrFH2+qc+EUsC9MsHhfaeUiAx8eFxRp8C5UUm2I5k8Q4mqJmoMakhpgyijGHenwaTIVgRhIjBxA7JRivg2AZ04BqKBbdQhRRVL2IJGbMokQxdtHIPS4ngkchLv1Q7mmpplM9FCWOc6bjYB1z0SKSBSedfY/OkcNsEAKzuJUfBFTvyHMYNu1kNYhpOa0qymiZY554OR8APyySzBANmBiCuQFKMkkfb/1nM8yMrJvwl6LUVayqNqcdIS7Lcs7knFEpQmMh+room3NZf/tYQnJIIKk4Tx8TSnV9qxijGVMqcYMhFSXI5cPRjGj+GbNVHujii7/DMipA3xVRpMxqoIqKECUQQsdw9QXGOTPlkat33uUP/OiPov/YP2q/+Zf/Cjf/6X8q9tEzDqrsVTGbuL55UWMdPCziE0Z1RC87Wd8To4fZ6FxuMwXyQRl1IlxJySbx+hCEaJGUhZQ6sipJIqHfQxYuCBzZZAA6jwdtrue3B5mMVVkUcDdIMCTk8lgsRQFqdmrLvrBNBCQSpKeTzqsLBCErJPcFlxP8SiR48Drg0+4TKn+kp5PX7Sub4PpdV05m18ot5l6E6LnhqPf1CBDt6XUHoqRwIIbgLjsRJ3h5tcPWiRpwsmflbEe0VdhbCSXoZFdcVpFpSWkSCMHPFGAB7QSVUGp231PQmBA0lMOsbu8ZyntziKiUSqEykwNucWNHYIfqWHLq6Sn5RSEYsXMiFDuPbbVYfIVmkI3cuZprsZymfQSIgPUBInTsSfPM1M0cg/g4dhFSyXe47WIL7o5WP8zQdR0Wvb+Ivc/XFLGcYZASxB6KXteBRTSUnpaJexPFLOzMrxME5iBrrGklIl1EbcIwNA4kiX7joYaUnMZXrfdY/sUe6Tty3zHG4Ad3ukCeg5Piy0s/UzINWHSiOGUpgfXuWF+Xp9vXrPZf4QY+E1Kx1mZiBOlkzdukslie3HpoWFIEccvcI214oh06CzEMIANLkleDZEpPjy5OVDbKIVQ/9EXouAyBQ4AUZPlYjyuKc1RUEhYTGnpmkWW9PL4hqGSbEENEiNKxZ8dBlBgCuY9gN0CgizuiDHRRSMEQMZCAMbCaIzZ3VMd0njEJfsIckCCEWPtZuP7oQOw6Dl3PhyR2l1d830/9FF/54a+gf/yn7df+k/8P/Nxfk+M40g0X2PUzQNn3HcfDw/ewE3pbYmjVPFcAjJBfEvQF78jI3Pdc20jOR57SMfSBZ9MNEu/XjmBGiIH9fk+OAzkpZhkdfK9cimmcxDwFBCt5Fe99228c3nqiCCyVEpa4XA105VCBjZSdo2TDE7eCjcyIBuLQMRA41o3BMom0ZKvR4jqqia8rOYBK6h6IRYauFNFKPBiSSDqjOnv8kgAyY2YcZRXKj6ZWayaYojaRbWTSCeo/yUsVnGyrrVZKpFZeFql6HCPJXYhS+jht4teC36iaklNxY2oAMd+s7Z6jYIFcf8PUrSPZCaSFEhMWBDUnFrOn4PNDhlKMTlu7Ri5G62REDahGmK3oAv6mLXFBGSx659w+6fDpQCh97zWcs0AKxqEmUNTZfWNuJHRU36kFj0HNiqoy520AfUBDRHMuVpCi0xtMagTzsUTAaszePZA0cCzpaUbK75cToCEXC7wIpl6yb1ZlUt+gSYpRUwCfHSaw1SaCKrMpB03rfIzRLZYpwziC9KgFTAbmaBxFi8KqVS/Y/E7wdpU5dBK4m9RJobm1iNDDZGAZyxEtyUmNzBElWEB141f7lJHM6KwjaOf+vbSan12a+c0prPGJ9c3yx2QzB2Ymyjouh5C0JB4NsUNVySZMuZzZKJPxsSITt/C445lRfP1EC8RZfd3MY8lzpiQ1LCuzdD6eshXeZ+Mnm8euZ0nLpAkrp5fJSk4zV+++y2E8ulft6pJRjG9a5ukXB57sLvnJ7/t+fuUHf9Dsz/5ZSS+ew5NLuH5Juk68sxNejPYgvqRsVm+ZywaYjS7Xuo78za/x4c//FZ7tesLFUyQJTB6D3g92b0PHHIUPL694+tXfS5a0eKCO5kai5LOKxVqhFBf+xnP0lpDFt5wouq3KDTVTyXeyg7EjTj2MPZ3uQBI57FyLEAEJaOjpMoRxopuyL26UJQarCrxq+SpiKW2I4oNhq0yoQcFrkK2L2oCBGGLVcprK5l02a4vUE7p1y/i0HhFxDS4CQ9mjB/PkYknXDytMCSJrsmH/f3ASNQhc9Ggf0RiwIB5bpm61ycRCptzSpSJ+0AAoJ5Xudx/VCr3k9BKv8JMjJu5GNw0uyLod1mXPGxf3EA4gGZ32hfgewGCgYxx7wtghU6TvPRZntr64tw0kFgtbvS97lPHzUnUl31vNHzoUH98Q/F/SyvHK0vAdP4C7HBV6CXRd52NiviZD7jCZi/UuLlYgESmWsM1ueM/x0wCjH5Etpv9iJcjBXdwIIsH7Wzpit6frJle6QkcobkGW+bjuWYtTWhSJgdgH6KVsOq5smhZCKIGuyowOrJdSWmgl2fW6ta5N9ay6o8CD/2EHaUeYe+IcYRTEBoIOpYY0RfkSCFb4kjza+u9MkSkTJ/P8ouAbcACJActSEkyHlShWflTI3s3OmC50XYMZNAuozxMJHZIzIkrXDVi/5yb2QGQQ42CfkGfnPhD8pvdC2kW06+ito8PTF2UxH6soaCgTJEaXAX53hOK217IcbvGWORdZJ85sTJAYkShoF7mxl5jeuFJhA8zuyv8oRl70e774Qz/MH/3n/3n+9vd/0fTf/XeFFx8hl0/YXb+E0Wpk7L1glFyzQD3FvRAyg2gz+frbpJ/7WfntX/p5mGZP95aEm+tpUSrvredc7OCf++dMfuiHoZ/9ANkUigvEnf4nOXypUekdgdkz4fF2cMW3mii6Pma+zRoQBkCQrmwQ23pbFsD6wma820wAFTqLxJqDqZc1Q2eBU5rNj8rCfx6EsmVQV5fWF5df9fZLJadbDWj5XO2FKmnuLpfme0qNhrMNSa0r6Z7IyYlSjh5wb4Cm1VJS+0uqFbFaVYpLtlqB5pkxJY89LOnjYi+opFUIiZ+VMSnWh+0N3he1nZVkWHGhlt4xLeOgxfpkGXKNPzIyCbeKgkgHDBAGL50lwkGyxxSpu49U1N1IQkkO6wqK30ZJQkyJyxSwklDWSwTq0uRKPMQ8tHBJkWJKXK4i5fX1utXNGkr8If0lqspEItkEqRwwIvm9VjcpZb2gSCmFlVVBM15Kq+ZPVNCJSZWUlSXO1H29hJo3TUo8mj5gFYmupXUWEhIWsqpEP6ij5j9pIFrcDjmvFsI6iWxd666rqfeB5JXYZoVspCRoSnAxECSiYSaZz+M0zX7ytFzTZLXIhmWk3dJYTmzVlQ5iDNIz2g5yTxBXhJdeWtZQsWerj4mWeWybz63hAmE5lboul5ru6AFrHwidIMUlL3QMcWJS77tMIhCc3FaCeHIf3F1bXJQcYjnZ7TF9ang8tJpnlTZhuq8n4ZNGzoyzMveJGEYsZGIUQujQ7PGHJoG5Tqwl3ZdbIZduOfcslLEOISISybNCMky1hKwEbDrCrqPvL0gqWIgwRCdKxxu+ozPHw8yP/ON/ivcvL+z4b//bYr/zPiI7oo1LhGTVOW7/vrdhhZ49v5vobdON5Unh+TO3shxuIBmSoCcsVYfWOf0aj5bgww/psLKugayklCBmT/5T21ZDNzYy8L789E3EW00Ul43P8IzN2aCbMK7R6Ja3XCqXmAioW3ewgEkihwDSkUJgDhOEo2+U1f9rtiQOTVAWeFc2lE/uCIJWSyJsBGqxcFLSX5SAX9GuWB3rSiwbXzIk7n1HslACpikamy6WKwqxsbp52wCbe3mdRwEu93tunr3gvcunXB4y5M7dJXkupIHFzWbU05oRxfvRSSagPYPt6c3jyKaQnA2F7LNcFeYJu7hyEvXBh+y/8EUm1aKtPwC1co8FRHrEohvAlmS5iWEy3iXydTnAMLulLRr0o2/KCQKRUS6gj6iNYNdMnZBCpMtCpx47M8WA9dnvTTIcDzBcFNJkHog5XztbDns8sXklLZ5mJlpY8lgigVTcPJImek3FEhsgXrlFrY6cZPeCG56LMwdsEKbdDKpIumGfjv6BrodjT2T0/OfVyq7JY+bM85SZGZaLdRuATOoiOXQ+drPHmF7tLrh+fvDzZRcJxhsIl6yT/zUhsiGIEXJHlwNRO0R7D2OYM907T0g338HyTN8Faqmzrg+keSw3FZY5WmzdZDOQhFnGMp6HroQLSDCkH8phGiV3mRwyaORJvOQDj6OguuO99+cawOJbleEsX5SplvyRDmMGxF3cpiW+tWxupZJF3Yj3EphTInfqe2jJoRe7HWGycie6Wm6KQmRFttWyc/dZ/zkYx3BE4lSqFu6RFN1aUwxoc/YsEotlvvrhi4LQ5c77NcMSsGmQQ7HmWkI6IZvLuV1Wn0+yBnE8KhRIHVfxCuhJMpH7zMREIMB15p2n73IQJU8HT80UIzy/oRs6UmclDrWs/UUB9HWuBjJ7LXm/3WK2TuIKazbeubjk+aFk/IjRX+8C2EwUDwN50fd86Y/9w3zjZrL8//i35KVeczm53FvSvG0J+zLQ1e1yetOrzSIVZfLsE3bycRjLvaXFVMF8aw/V13z0p/vQ8ZHOMI0gA2G+Bjv6nu12FCj7tjF6CcGz2/y84y0niiwbhVignlwlzB70LYnTCAwpbsUil0RR81gJEy0bt38yaIcUYrVovYtVICzxdw+ZaSdfXTSfuijrZC4LVYpPB/F7LdYdQuc7xpQQnYlJ6BC6EMsGvubvU9HF+VsJ82qheH1Eg5CueWLG07xnN3qOR7KTDkQglcQqsi5yLbnVlts2QCPBZEmg7GYddVc7xSQTo183Jbq+Y38c6ZXFbXMfeD8mCKNbypIgFj3tiChkZSeRXpXuxXOfIzaV+8Qr+6hrxwYURsHeRq52xqQvmBjYp8hQkuuOMfMSJUflAkhzYpDJCy2oEmcjzC9I3QVjDzXJu8lWC/b5F0IkxkiyDHmmm0b2mso5lMDN3DGHnqgKkgky0insp55OO69KOBt5PxG7xHsB3tPM19Poc4pAR+eW07N1sBXYQavb2WOuzLNhO8GNHcwTOs70Q4+g7CPoENCbgytf9xy7VE55BINenXiIuTU0SSAEQ66PXJHZH4/E8Ro/YazMaTy7Yj3cUvu5ztuN9TrHoljU/J4dZokcJqTEkkUtrlMLnt5k6TM97zXc7WwloUFRHJbfK3Jpcyo0lD9T4eTHcaTvAnsRQixkcM7sUsLmma7It0k9LYsTTGVQLUQxoPde/4l3+sh1nphsQjWTCQT6EjOWS/+VRM9ad+3awcX7kb0PavhNTYDvfVCZk49Dn2Ebk/yoG33Zbrycsc9h9xhUL0jHRdiTbpJnTrjcO887vuRJ1/Hubs+3xwnNfihPKLlGsU3YnrgLlc7TkEUp+V8FoecyPuX6+hq0d0tiUj9whcEwwGGi6/d8NB7g4gnv/YP/IN/6lV8z/txflIkL4IaTetnnRPHkDVc82Mhu/5je+vytr9/B6R9GEtc1WT1zioJGN0aEjTXROpaAxOpVe1sYYkEjim8zLMDLBF3PkANPQmBvCX35gneGng5DpxGwIsA4FcKA6HRv55OKEnqFXggpozffRPbmVetKXoKIlKToujjTTWZqKauU42mg+3Jv5bWkfvpWDXpPFdIT+dLVF7n+xm/zffsd3UPcl+DJsIOThpBnr+gR3PIaDfo4wGzIB+/zZLfj5a4vO8S8WkyxQhUzRGX/8gXDt9/nS1cXJOnZp1CIoqf4uJkAlKtsyJzYDZdkgzG7wpL1hvRkxzc0M3blR8R/JReLshiM4wjWQ+fhE+9JpL9+xrt9JBB5mRNZOqIpiN9nUBjSji5HIpExZJ6mCWTmcj5y8fy5bwcCPerxucUqXCdLgmKlqgmfq8vXCaLzRHcbhl7QeeagiYvukn48cvEb32JvM/3wlFck4Pnu4yaKiZVk6X6+Npi71V1xjNBHxpuRd672yHRgd30DT564C+yBit5jwwLky57L0GEffMjlnBlEiZbpQnRLeNkikgg5+GElQRlytQrdfwvpVNkdr9l/+IwPg0KY1thL9bWxVJATXOHJa7LxE1f55wSLbC3G5NB3zMcJ7cvBnOzMcsB49rWv8cNX77rCbS5P3e3uZCYFyDEyiZC7nlkmbmYj5+Rxv8PA8+xhOVdX75K143hzA5eD//hkCD3ZIqaRcei5+j0/zHs/84/ywd/+JUu/9Q3xggHbG/ge77Pc4+duAD+naETxrUaAiys6hW6+wa6v+dav/SrzX/pP+Z2XH3lpJ2HVwAWgpmNZY9ruvdpDAj2U9CeXfq1f/SVhGp3XhIjkbtFYV10UNvk+lrbV92oWGfeqRvrYM04jMmdsnpmPI4cw8uwv/UWe/eLf9dOF94K4tikJ4tHJX3EPE0qd1hRg2Hm97Zcv4Jf+nnBzswbfi9+Un6tVL0R/fc2v/Oz/D37+rxbrVUkAV4OBilsO8JJbSWG4Kn6m4NfuM/zgV/j+f+Z/TpbohqzSZEzI4ml9hguvPJQ0wfWB93/pF9G/8Of5zecfeRhFvFx7XmaIpa/m3eoq7gJcCtgR5skb94u/IIwzXXEzeSJ4lqniSWudKObtfKrDi7sN0/GAhh52Rt91yHEi3jznm//WvwMvnnkbH4I6BqFYsGpofs3t1+3h5gb2g59QziO8/y0Yp8q93+C9zq33Lz+6xv7cX+blr/+mz1EmPyCGwZjWOSe4extdT51Ukn+vn1cIPcPNc7h54WEIuBjo8HDvemBAb2mCDzjE8FlHJcGiHqMYQcS8cpXBxW5PeHHNi//oP+LF73xQXOkAtsqVOixf/T0uQ959Sv9jP8oP/MhXGZ5ckTCOKfPMlHjxlHk8EmRHv9szz3mx5ofuguM0we6SkcA3xmt+5B/4cfgn/hQf/Dv/DowdWtz639tC+Ay4+xteG40ovtVQ0Ik0Jy5l4t1dRqePePbLPy989G3Q5HEbVc23rsSrDawBZzNLgfq6a37Pj+aEqotgF/7i4UNPESOUgyDrJlTl3+nmrBvBumrkAZeZOSkSlE4FMUOkpx8iw5Tgl34R/vbPCePz+3WfDZCeOCHsbhZ3kTO/mhomggwQepeRh2sGVeLFwGGaCDMMKvR4NZ8dyvOcSH/n7wi9ePUDcKK48WJ6t6i7qg0Iu3Jar3fzwoVAMrtKR172vR8OCKUXJSxhA3nObjmKke8LHen6wLf+zi8IH37bf8QLhOPu9dnTRIl6dgArYQuREh9X2kOE48hFiIi6vTAS/PAKNZaPQhTdaajVohh80xFVgrkbLOUDxMQsik6JHxoiH/71vyncPAd76a78e41fB7rz513yewul9m/G26P1KLIfuGAa6U25yEoHvATu+eufASgXV4HL50e+8wu/CP/F3xGmI3CEobh91TZzztaQjuV4clmR91n/FiBFJvP0VnFgcffVtKHFxuzYJjz+nJLEk5x9AkkzIUZCULJ6/OgeoZ9n+Ln/QvjwGg5lBtYwg3qNCPz1v+XzdhiYg/DbEuDLX7Yf+Ok/xo//I3+c97/8RY5D5He++T5cfpF3v/CDPHv+kX9/uCBn0NATux15niELH+0v+fKf+Gk++LP/CXz7Zl1+rySKHlnLd/tYw2cWjSi+7QgAmWiZPZmdHuDFBzDfwHSA2c+7OC2cUAKZCSjpWpigFCh83b0CvK5AEkrwtNElz45zAPpdTxo9XHrb3FBC17YC9ZXISh4zsSSc3Q07dgYXTG52zJsTpq8LxV1k4GQl5BJbaX46RfDEyXkqj4Ykrw08FouU520NpMUBq3TMxBDcjVzj4JTFori93TXZ84gv57j669JEn0uuyldUL7DYoaXE3g4h5gTPP4LJD2ZFukLQE5m5HBLAlQgTuos9Kc2+w2kqVs0OckZLoHsdKieLrNaOwvxVwllSW8ppfuPqcs/zNGNkSErOmV28KBWUAJ2Ae46fZQp7xg9xjKteovhYqvrYpYRYDymxIyynPd9sKPPhhp0lt84ej3R24ALjRTo6WxsT0db6H3nTP+tw3S+9DkQGrohdZEzFUbHUeqR8ooQm3BW09lj5Qz8NlPWQBTDPzdH1PXmema+vec9w2TXdsLNSI7t4fmpX5RlC3DGPqYRKiMekP38u7//m13n/L/4F6/97/yRf+cd+hi984SnPZuXm8AKvU+4xoUkz/f4SHX298857PL/+kIv33oV/5KeN/+j/LZ5KghK3ztqGjaDa2pwVuO/5s4bHQSOKbzPEY8diUGJSJCd2sXNLTyynj9NMlG0GkVAWvQdJaxA3ThXp/zqPQkCy0oU9KfhvdaxkcBwr+VmDn+ujKN9TwtPd5QVpnAh9ZBwnVCdubg7MSeHiKfRX3DvFig1uCRWF6ISZWlM3jk4Y8fg/4g52e2wemVIqlj8/DTt1HeM4c0MmlDN1Nh1gc1K4GgKD+f5duaDGspmoojrThQtmLZagkLFQYpYqOSuRAoJ6xYZoEDsmyxw00e+AnUFyN3hIYyF5iQxM4rGHIolIQA4vGGBNUxG8VnEdmrxhXlU5WGLaS/iAxwrWjd8bWM+yXB9uSl7BHRjsLyPP338J+wtjPArdU+5t07MAufcf6qNvjtGtW54zKACDWx6j+j487HmZZjqNPNn15PF4v9/+jEBEuLi4cMt1F9BZ/AS8JSf+fSBnt2ZbJXJlcE+yh91j/UNgzAlS9pzQJWoBIMTo8YgEZDGR1UbDW+HCFEXF6zybeRnJAIRp5CqKh0vsZkbqyXvKYZYSqmOQ8kjtQyMUxbM8Ttcy/wf/Ib9xHO2r/+3/DuM+crh5Qf/OF0nziKnnYEwY3WT0sSNpIPV7vn0x8fRP/jQv/r//iRPLmkueIpc4nR933x9Luxs+22hE8W2G+WlojR3HkPgwGzehg+GSJYL8omPSehihMpdiuQrmruh7avZmeOUNIsgeQmCeRjqdCQupWROxGm5JDFDat3nDVnKxhWKkNBH3e6TvCN2AaubJsOejP/JH4Mvv2T4d7tV+JZJlwCQhckOvSp97t3iG2YPL48BswqzCk2ni5V/9K2K//fViRi1uWHEN3lBy7IhBPXeYM62TjblWpFmIWF7ddX7F7JYFVcjJ809uffawpM7wQy3FpTonXs4jV1ZPm85MOS2jXbtbbelugik78deGEk82q7HU55XeT1OzWhRuhQ2U2MyTk8HFKKsCCfHA++MM00y8/BJ5l+G/+U/wZBoth7ykaHldiAU69RaN3USKGSuHkIIGogVsFvrYeyoZhIvxyNd/9s9JennNR9MnX+v200VgzvBydwW7HVwO6Kgc4gTdJezE498Ucp1E24EEtieIXxvauaajCWEm5kRSwELxNRgdsqGIuvl9/R6YyBuEj5nDoeuwNDHPmR2BPggXFtxkSImNLgR8WwFJDTrBw04ML7oAdN1A1hlLCu+/D//+/0u++dWv2uUf/sMch4Guh/n5NfGdp+Qo2HgkWmBnPcdnL4nfd0UOM+/+3h/lRVc0WLESmeD3sdzNkm2D03XeLIpvFBpRfJsRAoQOQ3kZBkbpCT/2+wn/4r9k/eEle4yg8yLEstR/ngBWzEPT7l0qWhQJCZuUkHd8NQh/61//P8jLr//mhk0UwVI9hAb5PDdX/ewZSzSBWTNc7N1yEYRsCdn1PJsnvvQn/yTRtNR7fn3kAHMIaMgMdmDIcDHunGBIKifFwyIof+B45K/80teMb34kLuRLLGNKq+DU5IaUk1guVqJXwue0XNPTMvlnJIoni930SZaSCmURzLZyRil+4KL+D8PgOSW1JkosRNRWj+AaJuZVFY7mtRXENmSyuAu9trnfRFy+tTnUYkrJGH1iTaw/YQj05YR42MHugvEAx/6S3/ff/SfpLHOIvddfvgcC0Km3OEW3vNaOExOwjmzQx46QJi6nA9+XJr7+l/4z2Ju752e9v0X6sRE7uHiPb764gf/Jv8DwnQ9sd/OSwMjUGxqUGGMh1MFL45VT86nEKnaq917/vSpPxkT3ja/zq//mvyGmwdMFqTFiRDwVktQUQMs6p7gk3nz387kL1lMO1TcDhLKOgvcB5od85sOBbW3sVXH2xyoK0x2u4JSnRZb4HO4Z/5//AT/44z+OPtnz4ngN+85zT6pBDPQhQE7E3Y58OIDARIA//EeMv/qfCyEgSRF16+YQPfWhyzEnsuu6runlNm1u+EyjEcW3HUv1C0F3T5AvDHT7d90yFQM56mKVykHRsA04D4QcSvJkWaXc9/ioMZN6hZTZHwNyOMJ7329853eEeXYhMuez9Ddbq6YWF+rqapHlM9lT+VC/WzVft9zNAXLfMYVICq8XW7U8BtwaJwk00iW4DFdEDeSwpqnwDdXozdwNLQBGT2JeucmJ4JTiRtq+7d8rVYFqh1TznlU2ufUHFiuQbXzOdeMQr5DiB4YiqOcRvBXKKG6xXRLEL5uRn+5ObvPbeLXLAYeTZNY1T7Kuh5E2FwuL/UGXeHxwhWQZuxzcxGg9N13H2E+oKEn2JLlfCT9gqUxiwaM9w9JvnRNeM0IX6dKBJzGwG4GuBEi86ZucRuACLnfwlSvil36AzmaCKIhbahMln2OupT5DXUYlq1Ot0f36619sRg8vGEOC4RKbDgTrqPlsc4mNdHoqXoobPr8uy6qFGWwVYd3IhbpWQrG8s+pXr74snFrwqiffEpIS9lLg/W/L4Zd/3XZ/8JKbHViQooQ6ycvB5YUuFajc4v70Kz/Mi90AN0eS5kUhTAtJ/Pi2NbwZaETxbYYqYpGgSmeutwcGZDcQQsB6YUx+gCHVTL21lrUoql75spZ5Y9lqv7fHOSppp7BzHnBjL/CTxCwuyMVicCJwOoRYoiWnk7Qrpwhrm8ufi1YtQhAjRbfI3SvGaktgBbJ0JPGKInNUpqge3GmK2MxNUo+BiwdiOpaz4wGzsCFh3j+r9l2yK2ooYUCx/FxYKLMoTGSCeip3KId9tJweBayQRSk1wF3wK8MciSiWYZ8pFRtCIWYZTxNTf0395LJ5uTUQDMVC3pRXZCWJAtv6cbY+LS8ItQSh2KnVQSWsVgcAVbrcYQyMUd1VGuYyV/SeMXKQwoZIb+qfKx1WqhJpgDm4CabP6imJphGmiTc6Vi4DH82+liRCtyfLjoyilshWTqSLEOmKFVsWi6KJIVqS799j/WdG8kVkfnJJKXK9RNP5oRllytAVbWN7WOJzAdn8gyV0ZpEF1RtR5KtKvl0coBY9sPWSJ2+f/BXO3i1zV0d4/wOe/fzf5cu/7yfphwGNUsqL+kVTCGsCBIEhwS7B8KUf4EVf4tqzEuiwzfdOlF9OH5v7+c1BI4pvMwyGsklbVkyFTMBMyOp+5hSNpRCsVHZUXIoGo4q76YDbouDjH83EK1UgqAXMej+V53Xb/OE89YJ5Ab+a5nVxVH6s0DkTkMLmIIydXPu1H0tZvOpGVfEqGVNU6KyYrBJmibmbvWRf9JJ2qpycCl6Fetj8RI3vWWO1fF9wId8Vt5yLZj3tiuUiYdkTgunidvbTqkq0WGKYyhAvR5DD5lELfa0W6GqpCLfNkDVFR23Dxj1YSlD7hqh1EyxVempZOMpZks3NRA1EdXe3+4xD2ZxYA7Ned/wAz51Ym63FwlhIcbWIFAtbsERvE+gR0siO+bys+xsFAXYhEEqca8qZo3jYQS3hKRKQ4naWUuklU4m2kuDe6x+BmxpqWNLs9GVF5FoyNCi55L2K2zjWYms8SZnzJqLOr4JACSs5V37F3/UI4G3YjX/2XPyFzTO3/JaPL/9zJUg6vBzrmBl/6WsMGa/IZeaKYnSS6mEZocSgBLrscyL3fQlVCUjXQZqLYotnUSsx1lLmS+OGbyYaUXybIcpkmRgUwZDgFkKobk9jiF2pyOK7psejCdG8QOHcUypbvL5FwdlRT6fCkyRcagf0fnjBK9ltrD0UgVhKVS2VWvXjSWIVtlsmVuociyldydl4v/4zVL3cVmAkWgcyucsmpsJ+ShyezeQw+uno3iB7LmOpNWqX/1eSGE7bvDxZK1NkXQmkokgQTNeEOZXYBwvLIZiooMF8Yw4eR5RL+pzRPa5lDy5ErLhYcyV8ESBhqWzUdWy2sWLLJndmbavecivpZaoFj0Asrm8zN2rW0nreMUpXjLNpIaAlNlADMd9vAFXMD6+IE8RoTryxGRG/P7dWG72NREYCI9gMNr/xKXJMMtbNWDC36Aa3DhPF1yARmd3FKOplFXO0paTneiG4z/oXBMlGCJE5utyJGMLsBzVK/WlDILm8iVrmYqw5XT8/8CTzngjfytqQxcotmAiGkSWUsIxwS/atOSlWsnj3Ju+KkFdIwtMW/M53iupYiCKRGr/jD0twhlv8RRjeufLLiYcG5C0ZrIrWhiQG1nY1vDloRPFtRvH8pRAIQZagdK85a6gqatOikXqRed/Ua1hM7tLHE7Xv0gDBkLkUGEkT6LykxaCUCQtFuYXqeM3UirbbWtw1JrFapZaTvaX9NTgc9dJ60ZwknhSgf004OXQrmxZJmJdAu2ppVMgwLC5dFotcjT864YRbl5RBSbZYRDjrLmBlQ6GkKIq2npIuxkDd3j+hxD5uiHpY44n0Ls69kL5yP8vvzx7jZubtE1hIe7VM1q+e3I9vFQJ4MnLfNoIFggpZCtEN5b4VMCvpmRJC8tdzmQHKLYPm9wrP6uFE2CuIr/cghIU8Sbn3WsLSN+hIruPxpkJgTF59acdZP5qBZVQNyQbkcnq+xIVYSbJfHMP3gVniIkPIylxqnBuK1JP7J+ELTlwi2U/em8cpm7zhNqrF9VzURDs78LV8zi33KrIWFti4rSsnc7v/KRUzztf1Svjqb3QI6XCQFMRyjKzxzau732uP+/M5CGMMfPkrP+RVi47JBQiBTmDcfK/hzUcjim81AsQI0Z25mmbQktMMd7dV1wNUl4iQQ9F0Aa9Gck+IYWFiDiAhetrkXYBdB8eJIIHBSnSc6cJZZmrevRrDc+elEZwMekqXUCUp6HpaO4VNEuHXRgTrMHooCb0JAwsD0wTmZQgvU+LJMcHxCo5PkPnIQGZiSSYDbCxUJxY6ZWA9qpJ1KTSHp7WWUvOMdVcIeO4/QH1Ay54bCrksxK9uNuXnYuWDGUhaam0XkmowFT+5qNdGXk5DWz3c4GQ+Lu3zTc+K66wenFptC24fjiUdTa4B9KEMnELUakWmzDevb+3mWCWHe9Z6Jnqnlfk+BT+y49b0WE72ggVhlp5JdhyiQnwCXWDMBzw1/BsKAXY9mNAlVxSTKVpOurpiEemLtiExk0TcZVkq7uQtW3lN7FS4OMyEw8x1Lvkr8fTzg5Sok7owypQNeFxvqqVE33TXM7C1zi5RG4UNhm2ZRMmurCBe9nIJi/DvVhJXfS3bUbnN2TZr36rCpByDkGJPmNzDpEVrC8ULk7LL0dzB9RBI/cayGQTNeA7MmgngjunxhlP7txKNKH4CCOYnA1GhlrszSX5iktXCBb4hLWRg6xa9C2er+2ThlwX+sFD6umn3LHGHuMYawiaiZJMLqwqtJU6m5GJ8zQOPaxoI880hx4SGGXLy3G1mmFWLjZZN6fwwxNndmxTBmfwp9R5sJV7FkthpvVq4v1XCKI5f3768+4QlM3YRvr3CRfJ/5B7yjp5Ax0TieOK+dEIWNm6b03tcfs1WPpdPzHdr27Bi5dyYLDWsVky2v1OvX9m4nsr4msS3Eu8t6tjctWXX907aBSyMvTrai8V6+f3N5/vsVmyjxMzKRM+IaCbRkx/kgixrwFbriVJzTLL0W6BaPTtgcJIakh8EeGMPtKwOylm9bKJqCS8IEUJHsHVAwvnY8Prrffvoec6FIAHMo227Yr/NVWFZ1gHlFDZrPG5lRsXClm0zlZe2usu2WrLnJWH4Wm3mYYavSuTqHFhJ2mJNfxU2boRqrV5jc829LUWCVfKXBUyMWGJIT62Op5f/riE1m/ltotAZSkKCeoJvlWK5XV3gYqUro8eRfvCtb8N4dPN87LCcmFJanQdb70lp7iIPPgvLRkJp26qq+6GpgUWDNy/NeuLRsZPh+9yjEcUHoi7GTiPkgGgpSxfW1eHxWOWzXXEj5tPvOzbWMePEqlTrni6ltODhM9UAujVRHp4KRNLE0AtzVlKoDVKwjpjF68UX4SxFYLvVj9d69FijC7h5TtfBLiS4mV1d5YAJjBQ3MSsxAtgV4jpR9gsr8ZMkTDKK53okBmy8gd1Av+uZDxnJEzEfGHY9R5T7LgMhEwu5WMIpY81BWImQE+BoR8RGz4B7cQHXLjL99HBaZGYlxuebwMxKxKrlzsQ3TYFijIneucsG4FVSTNKymU7VClGltgYX8hTX/UIsvf2p/GpH8LD4snH7xlyP4txGbfpCBQ22bqwMEDIe35lKnCtIsaJocTuHMXPRXSJZmbpSnjAkpvEZF33AazXfV4z5+GCBmEssXom9TXHTD2niEthNM++GrpQODN7fJyThDUNZN0wzUwwQjdgFckow3dAPFxiGBp8DuRqiCZh0HuVgIPdc/ybK1InPvzkylBo/iY7cCWgmKuUcrWGdkTrw/h7BJpYT18Elg5V51vkAlphWn7BGYKzmbrMlkfw9Q1zLgu9Z5oDkZX4vCtJW27J1/ZyMgToJMwl+mhwW2R/rif6gpTqQbyq9qpexzOF2mMf57273lJP2U6RPgGGGL/XsdzN2+IDd7gvYCE90x/VhgssBdgHLR1eO8kQfMry8WW80J0wiZsoO0GRFkS3/bvXfHW36tLEbeH480n/fu4zZ68sPIqAXxO4JyV5CgC6lda7IWqDo4YrGm4FGFD8JWCBoAO3cawYnJK7GjKRqHZIlhMzjwxb1a2OT2VpeZPna5tFJpdkDT5JpdukqQhB4mpTxw494p++JnZE6QcWIKnQ6MyRPi5LET8JFM3cHFsvi6zyqgIZIypmLkLm6fs4QPH9eJhL3Rh496FqLUKle03p6NiwW2i2N0rI3RGI3eJqH+cicJxi9ZNl7lx3X3/wtvjJc3Lvrarkstxh7cHcKLuxrQmKdD3xf3/FFm7i4/g7IAfQlmZEv7i44ju66vCVs7PafdwraStgVggSy+lhSFRVYFQ4p7xVrTlBZrIvOGfT02rBMupPUNgZLTkqDu4jSnW1l/eyyGYpXQqkWFXetsRi7+t0OzYFpmslmcHnB03feRb7+a3yZnnR8gdd+e30Y7pYPBl05VS0WMIQpeuqkUY/sO7jMM5fHlwzPruEqwvNrsJE1COANhBlRld2uJ794zh7jnV3EjiNmhhxHLHj+xLBYp7WktPRxrIeM7rP+hQT5yJxnP5yCMZJJJFcWLdLjm1RmXgmdUDw3tv62yeKeFivxx+DztAgOFdByiAs20vbBO32ROYuB02VyJJxZz8LJ5+qt2BLGUxU1Xa6z2Lo2AaRCSXK+cbvb9sk5MSyveREt8dACoAude2+GnZ9Q/snfY7PNxNhDDExz4jIGhjBwozM2mSvCXQTp6EbxdFG5qIOC/4hlZFu8s8rtqmh8FgjiAqPrPF9qDoEuTU7oEVIy1wMKZPmfj+Mtb8nnGI0ofgJwl0EAEVTCkhMOIJYEJn5ejZKHrr4OlNivag+rG7K/Vz5huqwxX5Jl1dnqErxny4kxkseRwWA3HeH9b3P8uZ/jOE0MUZjmG8AYMnRZ6Ir2O8WABiXYXDb7aln53h9VAskC2hlhLzy7ecH09d+SOB0BW/qqEpmFXQeYTL8ngZNfvoTLDvpI3++ZTUnjxDff/xYv/t1/G/7qXxbG8UF9CKUddcOibEZBoYfvaDkp2wGHEcyzAn17OryptqhPBmVDK5mYSBJIIa9BjgLj4Ya5v+Ti6Z5d32PjxM3f+Rr5X/6Xef7sW8Jk9+dqArXe9JLQW8v2FkMZP3NrlU74D0V4cYOoT6tjenM3CyHRpSNPR+Wbf/EvM37zfQ4C+XBD3HdkS6g4SYy6uo1rMnmAIYVyCO4+61+ZOyF+50PIL8lMJBLdIE5g6DzcgDN3ZY1NNuiy/0sbchRt5VWru1AJuvlccB25Err7QpmXZ/Uqfk0wtEQihcUCtYUrKndc9ExJu/2epyCvxMykK69XWbTZfySU/cOLI1jZiwToNbr1PBlcDux/6g9xrRGNV8z00GdeMtNdBEwn0ESIA8ECKffEEaYXN6tpDaXmYFjuD1av2VZeLyT3ESWgGNhET2K6eUaIHTJPdDLDIEjYYdP18vEAJ0T8bZLdjSg+BIuGXZMru3aYjMX3UJfOgjNisxWfLlpkOQhgmxiifOe0fPhUDVHJluhVuUhHbr7xdfjZPw8ffiiTZreamDGpMhkl7yFenUKUNY8gqxX1e30keDBkMHQHz/IMz48IGQnBFbuT/tr8Tq0+X3cQeUVvxIhIwOaEBS2nCoWnF3tefOubcH0Nh5f367zqxi0PvYvjMvRCxqDvSWHyXSmwHjqBpYrfZ0e7fhy4NTYsXG1ZMEHhyQ5NyvV0YMgTvcKPXH2R/+qZCocA1x+VE9D3gOgqAfM6hv5nsQZdRMjjqZXGPIPMm0oQVyihM/Zphr/5X8Lf/LsyzRnSgXwZfe2rp0/KeSOpgi4Ee9KVtL32+i+HIFIwSNfMkjwjy97Jv5iSiTWKwr+oRbgG1xoFJ4a5ehnOrHW1uhHm0nTNkyll2VXC8vpE18nh3TK4zo1qDJDN79QEVjWEBFkJ4zaefR0lFtZVYwX91LOcupkWcryee+6lA1sDRGzpNd9TOnbu+r+84t3f+5O8iJcYO+yoMOxJhxvsYnDiLkIvhk5Kp5E+d3zwjd9xi2I5eGZW781ercd/VuRdVobjyJemmS/IQNztmeeRy5trmEbseL0eEDz/KjWR0NuBRhQfBIVgpJgZ++zWh20VECCpFcKnTvbK63PWReuESgS9NkqdfLn+Rt08l01UWVKHPASiJHWtquuEJ50QZebl8+8I0w3MIzA5GVwseKEEDJbDG6lMoXsRxRJnE80fTSFGokRPAzG7UItVKBd31Un+L06e3EIYBtCEpUQKM0E7ghrvXj3lG5dXpU/vudGFdTyNwKzuwVEqlxWmOUHovJLIPLGUTFH8wMDngG48CCWt0JLyA07Js/qcYO9WlP6gfMEEProhjjclPOq+RKX+GIvbT8shh2oBSgd1UtLF4s53i2cy24SN/K720O8aTAIH1JMmv5zhxmAqKk4eQYomo1oCFLdEkXLv4f79bxQL7gxdWoKwK+/vCg3LCDUhN7ZZL1Ius5k7JpSKgs6sxALRvILMkEu8nwY8W0HyGLNF0X3NR9bcgEu50NKuBecyusqb5W9d2n06OGfXKa/V38si6xgs7anvr+0yTYUYyrKsum7ATJhyZkLg4in8yX/Uuh/+PeThKchFOaACBCUHP7jVdRFJGZ2Ui+GCKxn4rV//mmu8Z4fBth6wU1RPmM+nR106Wen//m9hP/+3mOgJ+z1zGrmZjmCZoHqWlo0TQ4Xp7VCCzysaUXwIDMQSnRWBGtOax668vz5ZNyR3peqthRRKTMpKFquLWYv2reu1y5mJwMP4ohUrl4piNjMEQGf/FxRJM10VUEU4TgYnOmrV0mt+vu/xMaqyIxFMeJmLKp0zk2Uvn7bY52pf6EIaU+3LE9wmjDp7Qmz6gV3nZ43nmxe8HI/w7MW6YXHPxxpzVf/ciEmXKR7/wjEDEekuwQzTmnfsbnH61uBMyMbqHkwUi99QDlsZaZo5JCWnI6TMU4SXlDjf7bVea/w4mUcrDfExuep3HOcZmwU1A+nK54MfTNLj/e/9sSEARtIEmiAZlyR6EteWSeYhGbEcTggEEl6uUdUr+xiGSTnz/prrPyjsTTGUJH5gawn8Mm+bImvOQM7i/oIfOpoXwuQv58AmX6gS1TxXvHmFn3LqjEzE6tWWON7XeLRNNIxxGkNZ5PxC7CgyfCujRDcM90x2iSvGS1qp0gmhsOJUE+KvBe79MsWiV9tVOyqWsVLcSKGmEHrod/CTP2nv/cw/xvHJFaN2hDCgQWFW9xxZ9vlBYCrp0y5Dj748wG99Q7apcMw8m4Sycsdza3xtX93x7LHkX85c/9Wfk1/4xV9zRSkIBOPrTy/gcMNA5liadiuvQo113RRM+DyjEcUHIJpxmRJPp8TzlBj1zNKXvYO30Rib8yx3XxPX/RJhMzmDx+vVDyjsza3iD07OEYChJ+XEYU7uIq3xL+NMzcJQz3dCCdlaCGu6d8JjT5nrNxCSX3O5likhRMi+IW08zP68mnwWIXS3VVFCicuRwDxO7GPHrh+4MIUvfBGwEgn1+kaRrFL6JxJMF2+4FZKYZSMEJRDiHp0zHUJHJDJwJL8irOAtQNk4lkTvWuPh1JOwA3mc8J1pgOD1Zw+TQpeY8rgUcrzX+FnZ4+o8iv5eguLmg+PsvyGW6BjIZqU2d0CnchLy0+ir3xUosu9hOuBpGEaUA4kDSedF1tRD8loi8rSMWcBJ3n1nr++zHYZ6SOJQ3jB37duSb3N9FGZXvkpS+zGCdVsLp/9LVt3M5XrmhlApJBEZyrob720RcsvzRrG3sPKGCDX/acQP3KXiAvYDYGHtBE5dz6XJp5tEeUHU4+BTCB5HG2U13xWdU4vFzrtkJYhBeuYlUXqAd96B3/8H7fJnfob4o1/l2wAmSEp0IWCmqAmiAVUp3uXEbtgR5wO/+Yt/D15er7mMdJXSVQaeusYrSadYOR/ZFKcK0wzvfwuvCBZ80tw8oyN5r9npNrP0XX3lM3AbnwYaUXwAxMqpPy2HWcLgp8JiTWYSPUGpaVnQJU6NgOVY3GarmM1m5KqW1hJNy4m48kMxe67BfDaB74Xgfh4LSOjJ0hGGvbvZdlfFTRpImv3Edl0kIbqQEiDkosW+fozPpDBrhwVxN1cHlme6GEhZUZ2LBcEWYZitWlt1vYe7UFxiVmIDu65jPt64W8Uy4/HG3Suqi1XhdQ1SQt149EReWNmCDNa8PgRCUIyElEJl+iafmP0EIeVIZM0NGjbrSruOg9UkQIkcMy85wCBMo29QlYy/7vgVz9pC6qsBHyiuJV8CF0NHGr0qTCxbcMaTc9ejDG8qbJyYrkd371/uOL48Qtf7CZGgkD0qJDnTKIm41wiKVQC9/vpPJqTuAqYbl2/VkpghyIBnEqwuZ1gPSRT2Kl56chGEJy7dallcVmJJPxPdSl3rRQKuGrx++7NB1mLtq0mnBe+3aJCVrAnPE6Fr4npCmT2cxiSWUqhLwgIpXSy4u1xK9loLzCX1F2GArrh+vXi8l8GsYxJLyqwgHv6SZydE77wLP/EP2B/47/8PsZ/8CX69K3JcjHw8EE2IMWIqSBCQ6GUtQ2IvRvjwA8a/9TcgzwQRTOuEAEJENZ9a6zeK/MP2rE8OghY1ZSpKT+cn7i0Rg/gcl800ofDCt4AYnqMRxQfAECwOjHFH6i9gfwmjQFf9EIM/ikKY3WwWcKGSi40u6KpGqpa8KjgZq9pvX7T+TkFGGAaOv/OsaKoPsGcYoANoZp5HrLvk2STwzpeMD78jXDxxS0Mt01ZP9UoHXRGMuZxJvFe27eAJXYMAYxGu16Q8Ezu/tNZNIeC/n11LJodVk34VWdwgTzPDMKBTYtf1xOrKD/qAPGqwjVPaKs91O7GaidqUNHtOrrnmithsfm8tygaSy8Zu+DQYzC2MMRlJhHlOS51pLjoIyZNv6/37Lxrs8eEZrVSd2boxyyC+nJPnRl2ySs4o4UHWtM8ELHARr8CO8PQLTirevcJlTufrtB64onOC0ZWOmdm4R15z3S/rH+/nqy/Csw8RnYniaUkShhSKtezMC4FSl0uFLC5xYltiUj26IkyqWIAbNZ4J8IV3jaxCJyAD903vBYBWn1Eli0WexwnmmRQgji+Lsc/7y62Qslj6tgj1Pkv7k2aG3Q4OE7vdJfOLG+Juz83xGVw9MW5G8TjPMlllc6Hqmo7B5fWTS/jqjxg/9ZP8wE/9FO985cf4tr7DdYax8wpdpOzpYqCUqIz0XUfOmXwzEi8i8wffZvfRS/gbf01ICcun6lLWvJLfE7K4mXqfATOcCczBU2tlnU88C+PW06BuNK29nE3xHKq8FdZEaETxQcgSeDZnuounvPvH/gTjV75sX+p7LkQYb2Zi3BWfgqJhZo6pbIaBqBHFU8xoCbzuFPbZLSxTELAOxkwXIuN8ZP+kZ5Ijl9cv+Y3/4D/m+je+LpJvuDfZsABjhhixsCNe7fnyH/hDfOOf+mf50hCtt4lkMyY15YQnQ84SGGOHAoMmTzp9z/7L0tN1Qhhf0n/4Pn//z/8s6Vd/SfIm7mWN+fE0DwIkLer2snvgMT0nZiFuq6+it9+/L1Es7hQzF6pbwiisudxqlp91E1PW+si8NcLmFsrmHigkMdTEvH6AqbrzBU4j5KEoWHr/sSu/H/EDZB1aTvdyGpBUNrpc+E1eXvb5+VmxjtwLFji8nPjCkx/gnT/136L/r/8xe+fpwCFfo4NBmrmaPBF5ksgxBo5dhxg8mVxvzUFP82++FpScRm5+/Vf46D/8j4XDNeRMT2Am4Dn5irXePGerwqbTdc1rf9dACDBNWAzkPiAXl/zAH/wD/PY//U/xQ120fU7Mpqg4n3r9R5+0tvH8CGCSyHHki+PIL/3f/z0Zv35ThIG6bhooibPv9lzWaa4C0kXUBHIizUqMPYd54uLpE/in/2m+osH2efVMGL6WssAcIfc9djkgT6+Qq0vy5Z7cR15I4AMGEpfUtNue/9DHM1fr7JgYcyL0Pf0uYNff4fdc7vilP/fvw81z0PkktKq24bbb/I4bZWOFfCxsbQzbvQZW5cNYPER1y3nb0IjiQxAC9vQLfBtl99Uf5eJHfogQheM4k0bFur1bHcXIcSKHqmkF1HZ43eTsOcnEa6x2ybXVKXoE36XsCWqE8QYuhK6b6D76kPk/+1vw9fcxHYt75X6QfqDrBub5wHfSzDuXT9n/oZ9i//QJcz4yxWpx8zKFUZ0oztFpkeaScPceyAKTGUNQvhhmnr7/O6Sf/y8h9KAJ2R4K3pCKWIhExmuaZDhxbWyD3yv0LolsAawHu68DsVDDItnNlFycyvXkYaSQbFbDiI9WLR319qRYuBO2cRtHfExC5oDngOtLHOgSDJhhyJSUHGE1vdwDipAZCi9UIl7CztQ4P9m6NLfuLIW9vtluqAjdE8ard+n+4B9msJnjTjiml8ShRw8jWQfMAlOIzLFj7v1ASJp8vs9R784F+D2gs5l3+oT2AXZ/kXiYGZgIRGZkOZjhY1AI44niCIMqXeFJFnBLb5FXCLAboAvkaeTbOfH0as/VH/xJrq6ekOdU3NHdvYiiW8F1UU6jQTB1mhsO7G4O2A980fj2NwV96cbR5E6jk1j1rWvzbD5ZTuQed5cDu90F0/XIi6z80B//Y8yzUqmae+E3e4GAZfN2xsgc/BCMiji5lR7YsZ5Y9kpJOQChWEq7CzhOdGZcpJmnauRf/1X42T8rWI1p/17o3voJ44xUPibqWSa7Pbe83inL/mpUceMWxbu2lM8rGlF8EALEAaYDY4iMoeOjlBAC/eUTun7PNGdUFI2duzgEtxRqv7oqQnGjqPK8WLxSLEXv88AuBq/QZjOqR76/G6DbOaH6HtyuHwcTSOIn1VIIPA8GT97hg33P9azMtX6ehbJwis2sutDrCY77QPBTd+M1cwz0V+963xSz/tboVpFKjM+Jh+m7/X4JBPJqEtFPeG8l8qIC22s+4pYtqsuJYuAMS91Z/6SejJI7id5op+UnjNPNzdeFxwiJbLzLhb91CqifmtWTL77++I1swgTYxL9aOJt7a+Lmk5974xH5aJrQLjg50KO7Knd7oOd6DmCRqasxcR4f8Fw8J6mG+1t1xYxn+eBlQjViJQJ0MREWLwJl/dwl6bwKS7H3lAiYHMp4Lu0SMHd2vgwRefKUb+8GRgkcZXDL4H3mj5c3WjwLziRKrtYw03V42BC6TjLWPyOUAyKndya17FRtOgbDQJ4yuYduf8HLwzUHesZhXyyvUL0rtY42QN9HT92jYOIppmzRysS/iy+kyCreq/IrAiEY/ThxNV7zo13gL/3v/lWBDIdnyFmOxtrmE5ysk0q6th3ySDDAAhH1co7mJWFXk27wWE0ClFRK9d68bOWacujzjkYUH4ppcq1k2DtxkxHrI8QnjAnyUHY3r5/k37GuaHOVYGzIYnGF0BeNblLGrqO/fErmAFpyjmV5+DoTBZswoueAHDrS7Ga7Fybk7oIaJlRjAQPu4k1Svh+dZN7v96OXjxpHkioxDjALXuvZLX0nizC4Np7qyXKrqWPv2EK2TLL8u7WgS8LwSLoXzTBYAp6X39oEKxrlQOD2h23z2fP33lLUkmsn7uUABPEQA5Ey1kKXQyGKHusVsHuNm+AB/ynm9TeXf2Uz246NnD1un7+pYygGNqNpgkFgiEVJi9BHSEoK0Tf1IOuBPPXv1vKh9zXqigkzARvcWqYIVuOuY+ex3lM54WKbJi+KnZ9+NrG1EkshSR5LFkrupBJPMOxKWpjARxi2q3JmE+P3Oo+inhJN8FhFAz8cF9GgSJzKJFuai2TPVuE0LTJV4lT1zq3+KsDF3pNdhx505nA8cHW1J8YrZhIeZbtWZqlrydMDgSUliBCIiJQsDWbknJnFPH2GZDp1uqq1ykupUGTjDbuUuTpc8yMB/tL/8V+D5y/g+hmxnuJeBvRsgO32y+tn9eyFTx+RQE8s1bpdEaxZgTKBSGRXSGJic+AN3jofdCOKD4EpWCq7XMk1VU5oTtPoQm7oCxFMywbkoRk1EKoSRQUSOekqtyRAP4AqmZLHLUIfBabRT3s8wO0M+O9aFabBk2xrIKcMQ+dJ7aS2WUtp6KJFb4PK7wMx0AMYjBiTGp6kMUIY6KKRSzH2RUYvv6trYNsrr3/6p+L73Uly541r8T6P1SpwUqbqro3zVa83rDnvtrtOqMH5oYx5nYRsNvZAScfs13nNRx/A1RJ88vsfRxK3G6C92dtF6EIhT9UcHlweXCcYM9rFlZ1pWXdmkNOa5uWe81otcTEMpL7zWGg8dMMtuvNCSLcd7AQQV7bxuupTPCVH9RSyuxOD+4rVvI73ODvJzdlzBC6nde9BFFHXFKW4bkvWbRPFgpJmSqBhKNY5QcQ2ZVrvmjlVHlUyKpAm2A10l1eklyOH8YjsPFiCKW0UTic7Na+omNL3PZbVa8AbTn9iZBh69oPwYr6mOOyXqi9L9nAzLkPki9H4osB//mf+b/DXfl5IR8ieT9E+Tt6x6s4Vi1XuTvb46aOmXqtVVtamlHACAtAxMZ9YWn2cHubNe5PQiOJDYErMRywnNB+KVdArlkjokK736bf4AsyLGkhJ/GBljxJjDr5YdzGTQmCMxRIZBG6OfnrWrkEORA7A0YXpQ1aZKWGeiZ0wAzFlcjae7vfuju47Dlby8JRUGX1xlORgXh1gWzX9dX9egp+i3A2QJ/KxSo8OVMgl+CmWFZyN9aDBYvn5HohiFUx3dZWEh5wbX+iK1v1s0ca9wvfWk0MJxjdKwttXNOmtQlEyhgx92fOqbmJbS4+A4TFWqfjt5jKm9+bfVT8qHFR0e46lxpBWV50TCrGaP2/9+hubR9EE01hCSoopRQZCiEQVwtChahvnhYElgqmXOhSYQ8DkfiPQWUCPzyHN3vlDJE9pyY1ZlSsTb95ysKkSmhAYO6AvJQYNRGWxygUDzV7PXk3oc2DMgeHJE6Y0E7oOnQ7IiZbwOo8sqZ38VLgQzOV27gZi3zmTEs9wYZKw4LpwmdK3EzmfY55WQtv3xN1Ang+e1kwn6J5uYtStDOsqW6Z0A11AYrUoKpY9YT3TDBc9GF7Tmwjmh5V6hV4TcnzBVSf8nX/zT8Nf/2vCYSTmA7KDlNiQ1Nty2OWenutX65uPLPy8TGdYm7MYIgATco6lVJ9/dg0zWOV+lQGfdzSiCGXwM4ufVUqBxyWOrWz86gYIq95RlC54koPJQGJH1++Yxxmbp1InsuxCJWO9aADLiHnaGUMxSf43yVMSmBU7d0TShOVEuBjI4jmxQspu+ZNVYK2omk7nqWfqDmiebicUIZtLsH5E2IXOK4XMGaaE7GCeR9I8wb5bF7VpSTBtS6C5UdP43APBfHPqQceRY5o9h+PFDg7XZZ9wouBJj0s+t43/0GoEsilCwkRKMt7SpppiKGQML7eodUwK7iuvzrfHbdjjShBrrJuWuzG0uPB1ef0BOCFKiZp2yMe7Y9nYpKZz8A01WLVpOKFFZ7ocSuWK+t16SkBR1hPIbsf7hGC+meSg5ABdikQEiyV5yJlFycQ/V7SxZQ095PexlSSeeJbOI0tLW7fQ0pRKJOufRlfmYAd0iMq6TqxU2NAOlZ6l7py4V6Fa9sQKHTU92fzXJ/6bJrJu1rLZliX73/V9q8SmfjdAcIuhhB6zRCcRMSONM8MQlmZJMZ8GhOg18txyZnUN3qfrDRGh6zpGWHI0GqyDUacg25VyZsW0sMgEk/VzwUDE6LqOPCc0ZUjJnTdjRsep7ICZ+6THCYBoJFiNVfODiypSQyspZWy8QdUFHXFtSCHSkbJ4dS+ZydITVAg6YOoHc+TqCnv+jHS4Ie6u6C4GUg/MRXu2DUFcZGN5viu027LvKwZEQWKHSETrQT7xpTao0ZlyNSlP0sx+PPD3/k//GvzKLwk3Lwk6cxkDL4rcvjORqN39p37MZx4H1TNWmnNu6cRK+rnNgcPF61Cl9wPl9xuCt5soip9FyTMEMtk6sEvggq7rgNkDvC2ARqLCLvlJt6nDNVpLCJ1XAMnOtWCALvrCXHxT3tV1Y8mxJAqujKII+hQA64gpEnVAD5nu8inHDiAhuae3splnQzaUo95TMIjsmPK+8AaFvEO0J2rZ6orbOEVFsxUaAHKx53oeoY/FtaAnizqH6uzbOE7u63q2zgfg5sjQX7LvDXpxd3QwUHNiYOe1NkPZhKP3NULcBYY+o534uO33cJOdeJrB5RXoiMnM9UfP+H4oQvZ+Ta9NOdXlK1bxkRedtb6zPvskZGUM6z6k2Rj6wDQD1kMYCllIwA5w65F7W+vvd1hQ9jqwH0dCHoALIGNkvOD2Ogc+0erUJaN10Mz1oOhVz/TCNTHpkluayHD1BF5kut1ACjekNJ0zh/ujerM5tw7eZfE9DdxXWE9KFr2yHF3wqFfpQQfIA7127OIFoyaQSG/CNCtGz3D1LtP1h+wujWP4yEsU2oCwp2NEmcmmi84DUD1hrjtWbSFC6EmmBBvp+svCszpIwWsBFEUXOihlO+tQgMf/CsBe3N22ud/aK37q1yuELKdA7wEzsD6SpAMZ4HAoipUuYYWrVhJIOTLE3q1pkiAmj1fNcjJQtU1V1o5pXAiA7HuO06GYJ1122kKwX+9RLRCXw3edH8Jf8uIWpbzvF3dD3wtztqK7GzsiA4ExQZifwZXB8B7TNXxxeJcXhxv0ImLHa/e8REP1ULxL4Gt6y2zKoRaxRSFch8YNCDGEpWS5ooS+p+s7ZJrQ8SVXlnkPCO9/i+Ov/Tq/9m/868I4wjhBHumYGevYLO24ew6cL1G79YTzBfYpQ12+bYUAbAxH46Ykgq7eB6sq2tuTseLtJoqUfNG4Yp2zQOwhdOT5umy0q5NJyuLzGL2qjZQUGbesandPofXVs9IqlVTWWCEVJMNlf+WJgKcDyIxZQMLgm+fuAhvHdfMu1/ISTu4Cz0zABNbh8RhWrBMGkjAT8tnKPUlA/QrtcP3jIUwrE4ORNRGnEfIIu1AsseZB3FXAW5msFrzaDQLSQX8J0pHHET2OLsg1AX44xlTcgjgmt8IGZb/r6c18fB+IV9391sr1u+Wa8OnndV5qWkldSjBGCAGr408HtsPHt44/vgGlBDqCJS/dZq7AyNBj2ev91pzrUN3o949NW+HtjLuBmex52eRdhtAxlbJycrnHphEYyIcZDOJu72Mfd5CPfDKM8a6xvHvzg816q5V5bOMare+FALFjGDpMJ8aXH8DFJcTIfJgwArurd5jmkRBgnG5ADvT74nunJzOeWnE3LruIcyZfCnvM3HoZsiHzRLp+Bpfv+DfVQL0sW14SVd950x+7opf7P5Fb94OZkQ8j+eamxJVAJCK1bQtPFXz1R1RLTxT5G7IrlB/X1leuwNvC7LUezYwUZpYY7yXh9ggkjOQHgMrRfSuK6eq2FIw9hI64d8NESgeIT5gn5eriKc/02pU9y2ClilQxXECgGt2X9F9VqdtOxBoUSfFgmRPVYBmOE3m85kkQvnyxJz6/4bf+xl/n+c/+BfiVXxVGTxwu6of+zgxq31X8v/LtzwzDSrfbsrHW5/PXbfORtwhvPVHsxOORLZVZoDPoTD9e8/QycpADWebiwinhPMFg0EIi90j+rpEmd2Kb7y8geEkqd5ta51prTebsVREG0Jln2VaGS4cwn2hDFjyjP3GiixOEA9K5y9utIFpOKwukPaKPMw1EFDs85yLMXPVKuL4GvXHCqNOyJ0Zzu6E7Q1erztGUrG5FIV5wEfa81z/hw0npxtkrHoae1Anj3JFTx5MeLhGOxxcwjnwCbOdREUovrZUccAbRKciRECdCPJQUIOXEKlriaSmTMENnSJwY9yPsJsgTlo6rhMi+l3e26jcPziEogARepMxFv+dGe/bSEVIipcTucmC6HskvR3YXlxhO7iWol5kraXQeTWpbCXa31Ueaca8i0fxELAfG6Tn7p+8icoDBFc1ZDgyXV4z5d+BwQ7zqgRtynIAZuokcRmfn1WC4mDErbQolmKHD0kAOPeRANyu7MDANez40V7aCGF3JUGBRPQiNAKlD9H7y66EYLPMjV+9wE3u+0XmYRC5ZAZeIA8MtzBL96WIBMkiZKAGRx5FfFjOEY2FqtdIWwEywAyFOIMeSz2kNmxHcYZIIjHSw3zH1g2e6sA5i4OXzFwxcueIcgocc4aEsSkBL3GMIno6nuk+thtxUsaYZiZEYO8iKZW9LDJFLgfcs8o7sef7rv8F/9Rf/M/i5vy48ew5pdIKavZSjHyB394WYV07yO337SNPbiLeaKIrhh5b9L0Ch77jc7fi+6wP9vuegI1k8YDso7DKoGC8nRSXQpx3dvYmiJ68OpuzUS+FN0fdudxN3hDGQo3CdjdwlBr3mnRfP+PZFh/UBRsg1s369DSuxTnnmvcOBWYyQE8E8p5ZXg3HLU8y7R9sowGO+dp3RzQe6Zx+6NVBn0HRCRhSoiXhWa12CdAM5c3XzgstvfZN+nnlXBmKaiRpBPd5t7IzMzK4z4uGG/vkLuLooLoY3FQErSWK0ljIDf9QZnj3jvcOBJEYmgcWyZykWsqca6nqCGcN85PLlNfbiI5cK1bJYUTYenzV3n9d8bZjCk579R9/mBy+ueCmJJ+NETIlsz9mlSNj1HDRzkY+kOXMzPWN48QH0gQcf5nogvEsit09MQl1/XA7sn32bL+0DfRcY5wPJEt00s88TMjzhKEfezYmUDzxPz+g+enZ2f7oemFoMgYGa99GqRSu7q/PJ4YbLw0v2F5H9YSJL4GIORPPE1SnAoXeX65B6gt4zxviBGGxGXnwA778POpdDJcUj4uGnxfIWFqXRYa61PP+IL91cc++M3w+EhYyFEUGLDC2hQ5KJHHnvcORrz575WtrEw9WskEYEZo9U+ubv8N4X32U/9OwkojKz1yPPX7zAQqLTXA71efyBlq07VO+WhZIfNpxWylFjnkdQ4XI/sI87rl8+5ze/9hsc/v7X+M7Xfx1+/Vfh/Y+EuZQynIv3heTXDubhS+BGDFt5aDi3ujV8LvFmm1MeCKHmtAqFgEQyA7nfwR/5CcMyDJf+YS0m/AQlCtkXz+0d4jVQnBAG6OTX7fJqKdHOcz8gcCHu0rCRoAn9W78ow5iY6IsWW2hUMRBdErhhB/+NP2ReK7p3c+hCuYpbN8By8OPThgQIu2I1Obib5pd/VeSjD7kKSs7KAb/9xVNW/TYACjuLjGYMP/bD8KX3bLLo1qYp+lj1u+KKnt3KExTyjATBfvlXhZc35fjem4hQDiGoWy0su2tL8VKL77yH/eSP+finvgSYKtEyJsnL1Io5KcluPeg+ei7pa7/JXqAj81JX93+Nw/MTnPVgxpagvnbzoYP+J36fzRdfgHAJNxH6QBcnUrr2OMXYg+7dot5l9kwc/4u/JpfmCbMfb6PqkOXU/wxLLegav9hBtyf8xE+YDkOJV8uw6wDzuK9ZisUou9l872PIX/m7cmW5JJjXJRJ5kmK1yh7Lt+siOSUikYTH+8kP/yD2xadGLx6ra6Emh2PJYt+VR60W0UeA4HkCP3oGf+9XJOYRYXRxGr1L+mpBo8MwD7MgozHDF96F3/PjRtw9TvtLSicPS+z8sGEMHgjaze6y/eWvSXz+gRddqPHoEiEFegsMjFwD3Z/4o5ZigHkHk7iF0kpd81Jez/ea6nLuy7qs6cnC2WOBqqdoI8KzD+F3viWLN+rywtOsHQ5u7ow9Q1JIN4XGBkYmnzYCi+Atyeh9TioPOkzW8EbgrSeKvnb9BFukR+g4CNg7FzAeT4XoYtZSFv+ITNyfKYq7GqC4krO7hCoZyp2TRRMYQvktj2J/cu0k90M6D7Bko7UqPDWY6BiH3l2zU1jdjpUoVsJ7Xjfq04L0hYiLE+VgcH3NvmyMGRjrIME6YPV5hn2RecdCOnwgu+IK6mAqGndQjzMQdeK46+EwL932ZiIQwh617BsTvnENhSxO9Oi+JHdPoRyoVSLZLYwBd3f10QlZTjAbe5S+uPjn8u8kTyT1MBEPI4riU1PBSWC8hJtCeIfk7q9BIF7AWBSqkCGPXCXFnbWlmsKjoCRsBrxz5+VQayV2FvZkivJS+9nUCcU8Qn/h6/c4+r0NCbKxPypXwKFYbDp8PRwJa26eEkslBgOBIeyZMMa+834rOV19uesy/ksjF+3rkdZ/iF5hyoDDTE/GCjGpaTQH+nLIyJX5iEEwEnORBVvN8VOGUQwIgUjn4yydk/BOwWbCMTEwo8H539Lm1DMAVzYyAdc9xZK/czI4XLglMh3wkJG6xsrhmbpvVKsfrLv5EqewaSewHAI0c2t3sVBKKDknLRVbZSAK5G3pOqopoiuXk+KSe8D6b3hj8Fa7nr3cU4d0kTTNYDOCHxjh5biJ4WINIq+LTikEa2NxuVcjPBhnKIHCS/oXhSWtfw5OGHVe2nGkxnrrqeulkKUxU9yNODGqhDdqCY7eBLM/mvcuwaFsmiX2aFcdMwIhCmM+ix6u/VPbXTIZ7To/r+KfSyUZ+Vj+Fs9CW0451o3pTZdvAkTNhdKFZUyTVKIyux8vbMafWvmiKCR5XIrPRonsQ6AroQhzISm3p4duXnxYJ6pRyL1BLooQ2Ql+wFOApBs/uJLwDVOMYykiMj8eSwROjK1LnFg9TC9QYm29AkSeM3k6AoZU62Mai2cjcsx5SWAcihVtYvI43S0Zqn0fgLDD1BizkXT21TNOS/58V4xYTknH2r4qv+wRremWyknSQBBXXlPtOA+H80IDWOmPRMZKaifKdx+RqNQONch5pkzkIpsU1NBS1UO3E6Um6EaYezhuImnQQoAPH7Io/icyuhRZWMJCNgUP7tqHYrlAZXq16cWRcDUMXI9HaqKEFCBlnzP7IWJjXvTvqjhOsJ6+V+4SEA2fM7zVRBEAS5iWKPEgBAlgCc0Qu+CLZquwLgs+rLvBJ7RQApwKBfPDCoYi4+zCpizQ3NXzLP6Jk2wFsjkwqMmvXGPxRGvgz+m/R8PosZPJk+500XPBZoNUSwwoLIOg66Yg5umIFk697IQC2YhDR54SQ/REvoyl5NR2PN9wIecOOSMTloPzWgPmA2hVEsr4C7qkWlwOk05O/LJmjptKJ1BOxC+nV9ZHYbU2PAh14h7yUlKiHwbmdPT3S6422Q3YNLmrNA5kG7l55IgBKU5RYM0cIEUBBTDogkFO5PkGLTGC+75jKufj+ujr+HIfmY/ZuyAII+puvxobul5+yWG6sClqvky39yQMQoflYmU2J5p1b69tY/v4GFCIxQoLRpZ1rkmIGNmTfRt0ix60JiUJ4UQcfPqo68gohzyKG7aSMlOCR3uc9LOI1xcG4WUl9FWZNbjaD1zfzIQholO+vceclBzkdB86J4tnKcCq8yh487gZjy4Kuo1heQ8kOE55qeC6oiql9onufQ2fbbzVrmc49WbWv2vlBaXY9LYbK/gf+ZNwd5Sd2kBKol0LaVFMMWDuEJOiUbPmRTQWa2SHEov1J9UcHZnl5GCNxVRcYzwhisupzUfAuTXgXOjU9pXO9/uwJWoJINEvmQpP8lpViWj+zTqm9bJrzrx6RObNQ8RjuAwY2SgAbG5/G1+Iz4MM5Oof3Vo6FvJw7s6r802Xa28j8+69V2yUro6eQFfGJYHMG6UmgO1AI1KCEozJLeMn1s1PF15B1/spU5Jin8iJguLic+ip0Nkqa1s5U5WjwgekuNonzq5fXJADdaVokVurNdgv6yek/TVZc/koPJrr2XQJMxkpKXdO5uO69tcX9TQG7zFdz6G0xTyJRA0Aqso63LEOS5/v8KogqRO3MBZvSE3J7/dZ7rd+z4JrF0vuRsNzpN4hvzby704sua701GV9Lg9ql7MNDd8eZnszZWfD6+GttygaLqBqIfmtzK5kcQnFqGaapcICnwDV9lW4yuqyM1Qt1LRYA9wBMxlOUt2vRSzEaVnIZ21awpG2759ZLR8NG004lnbUFImnpGV7Kts12uqQ0mWj0EKmt2SxXGJTkLR2TVxCsd9spbgSA7c0sfRpvafzajELtuO/7EelLwXWzoOaK/Du33/AYZKiCEQCQxlT30f1ZLNd3eqBvrRjqqvVeGXbfrdhhYxVNeVEeJz4pNk0MayK3snrnI5DvUb5V5WbE+sueFiBrhEZG1vjGapStiFftm3gp4+Ng8RJ4rkCu4x/JT2FmH1WLFlbS15BXSnBNl7ZGs5XPuNDuB2LsCj8oCw1r7f3eDLuyhJGc1dbvtf+2c6xOvfO97QySJ6mrfw0uhCHu0NTGj5veLuJYnW9icug6t7JRZkTVg3Rg33DIsi6srrM0kI07R6P26ZA2ew3679Di8VwXcMZyIWsxrK5Ll/bfN82AioXa8LJJkaNddF7t/8hj1DSzeEWEaWcZVh44daa4FUgpmrVWrbC6mTfkIvtDlT6JGUWb0n95ufFnF63m1rBRjdzq9a9reO/bF5ln4l5PfkPfhzD57x/QNaPLnk/rfzWlpjcB35tLXN8zUMY2BAHwOOyEl3JsQc+7+t6fTQIXjkI1nCy883WQCwwsCpspp3nbl3UHD2p35MJ3htCKaWy6evtgGy0wKQlvtmK0mtLE89WkZLRJVF3betjrP8q05b7qje5ZVQ1LYvC3RWgHk9+LfI7BLKeNp0ytouV1Nb40LpeI4lUfOe7Qr4q8eo211q9HxsFQ8ZlftWuWrzB5wSTU4WxYikUoSVGuX582TP0RK/AWOZena0tNc7bgbebKN6FuhmWxbJuuJ4SINmZJsxqDbtlpfseHhchuUUV9pzynfpRf023Hz8VUme/47prjS2pX10dCQ9p/4MeN/dUheTyQn1aPrtNTg5FyMm6iZ5c8i4GKCX2vXzwkZxVnzhqn1XeUIlBfX3timrBqH+GZfNaDlwiS+W0Gv7Xb66zHDSQckbmd+E+bk3Pze8H1nyFy7p5TLK4JbMbr/NJWFitCcyGKJYvK9FP8cJyoY6VQGWr7GMTD7qd29v1tFkfZpQye69udseGUDzi+l9IUOmkSiDXeOszcnh2/yf6xKfc/lyJ1rnFXVymLq/YOjcqF15knerJfrLlyHdN7yWyqBJWvss6/Jj1sZlai9eqloT1NeaVfBbhsrlkczi/XWhEsazYqOufJ4tUAAmQt5q53rLQ3xfVHZzrD26E3+als4UZFqOCsj2ZGk40TH9FN9/SxTJ6l5fh04a3weNdajqWkzhtVfryx7Q9pV1QyXS9FrBU01oG8gy1P+GBbtPPADwWzVHH/2TLstXi7HNEC/ELzMU4MZd+d4tuqGeOCwlfKc1JRID4JqX2sfvQd4UPVSCjbM+lnMRz2fazp5bNkws9FjZtrGGfoYaIBCDocpjB99tQ+t1RgybqPZvpQia2NbZPfg9WC+ZUr1LfDst1pbxy7t0+xePF6Bo+f7dWN1daAgn1PjxTGpcoEjtf+Z8+pE5KqkKlTKxyyZUrd6FXmZ7K5+rZu3qimHKpeoh/YJ1aWt3wG6ufKxK1Ja8ODTnHeXRnXdv13Xz2vhaBufxUGatlvT7m2mv41NCIIoCuHeELaSPMi6qnmXJSbfu5zUK+B2ps4ckiNK+4UOWjJz/ZuFXttkXTKpktrvGtFWm78IVVoJ3Sx8eB31MgWyWNG59GteSeW8KANd5q/asSpXrvsfzAIss35CIvffRm68Un98YmdrZiQzTq/HFLoC5WQxM/+OAfKC7Q7YEK883kfKNYrvlJQJwsAks9dXeJlfezu+lOlTc+4UbcE7I+uAfAyfrJoYbo4SyefrUoRCUPZa7EpwNQ8lxj1VjubbESbwiVsIYL2LKGV/Vw8/WNrFqfnepQj2NfXyyGy8GacJKZ8vxgyEINze+54jFXcSVbi0wV7nD93jaP56K09+UjNbNtXcJZayGIcGZJ1vVp2S/u2n+WWElq/5x6oOorkU1MMOc7w2nLlQ1R/6woag2fChpRhMXlUQkixbKyphFRLOli7kdKygMetkaWhVwXXhGWmCzXXdwyG5OOZSXZWVmr+v2aTwPDzr5r6ulkAD+hKeGkStunDgkQ3Cd80o+bG3MyrYslxlFccbLZaIvGbbZu1vU7bqksJphCilKJQ32jZZycPZYdxR+cTeSqKZRY3JTqfevKQGyzudXDAuXf9pDX8lsSNmP0CUygan2zqowFUl53oogt5GGxnn+WBk7WMBF34bsbL9Xk1uUzFqoVSEs/h9WsH2Gb62UbkwzntxuW38uFpKyKZADJp/GbctqOk/FehMQjQIAQNsSjEkW/n20IRHVJV1Tl8LGnQY0dFMreUIILl2JPi7lwM5KL9Xi9TqJkIijfz9Pm+rJsUCeX9KvVXeTUwlr75yQk6czDUi26tzwv5QurQn0HHrvjGz5VNKJYJvyJVibngrR+ZvO1T8CiYdsncvrCia3xfLUWwmPnFiS74+n2u8VluL55l7Xu04SWjW3jRqnxMOayUc8/W185J0mb51pOip/o1Lb5TPn3mSMcnwDOaZudvyZ33LLcQfc2lsjT+NfwyffZHS5WwTAEwRb32GfW/rtRGje2pfW9V+22tll/drrBv7KLN2+eWAyX9fCK9bGxRp6wzxN58IgoAXP10NWrFILq8fnMQO6IHz1fY3bHOiyfq7G+q2egfKXsQba9gJ3FN9bv2EbOrT958njnHDy3DNYvbOaE3fGRj9FgGj6neKXC8NZg48qBOu83gijAQjR+FxbFiTsNuJ3TUO8epVvujY/57vbm7Pw7r9viTxDVAsLq1t+617BTF/t3vRaccOsl/ut76cM3FScuoHDaDaKr1fSsX29/9+5rVoviQhZ/t1xOt9bhNu5uVePON9RHn7+lLecpFLfJ70/I2F19v/37FVN1+Wr9vbuUwruu+3F47Pl/ruQZdFaTXJU+3BjKTof98WMUb+FsPkBVzG+vy/rHmTPg1jxY7rMYB26txwWvoUqdKwx34bHnRkNDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ8MbB3nsBjw6Sg+IBQACigJ2V89YANS/U983f13Kd+sVrF7b/Kr14+UK/jKA6Mn1Y/laBqy+J+vPLh8lnH7fgl9dKL+w+W5pp9jZd1/dHeVelqus7V1Qr1EaVvqgL/2Xl9/Zfk7XNmz7r/xuAOLy6UBG/XPbG990l3+vAxQ776AKWz7oD+a/k89+f2mm+T8pL9y+blfe1/L+5v7OG3jenrO5cGdTQ7lG7Rc76cHTftv0jSgEArq0O91ug0Es7+fNuIFu+t3vSZYrbebrMp85nf+PiPX2OkAwDNBlfPzuwu31Zmdds7mfugaNMk/umn/bdcU6RrmuwTJHltfrdTb9tR3bfHozy/t9eT5v24jLq1B/76Q56ewiLGNc23k+j86myMlX74Ld9QHbrl6jyqC4aZ9tZev5j1pdF7q8dH4bjjKWopv+DLfuI5Q71ZN5ACZdaYARN/Mk3bqfu++93mE+a1ftz0W+rDddPncqJ27tL+Zr7nx5ncyr+obod193G7m6vdKrvnYqz0K5TyWLnsz18+uGW/JkfX+RGbJ+V17VDjn7voVVHtYNcStbt/L6HPaq/e1MNpe1ftd6OFmX2xv+jMm/TwvdYzfgUbGZxIG42SCUqc6WKmFyYLe/ZJqOLox35RozSIoMgCAYggETQAiQnTx2CLswoJqZqjgP5tdJk09u69hnFzMjkGIEmb2p6ptG3bR1KzAJxHBBzkDXQz4Q+oTmDBfA6JfpBbIFlIhIQETImllZR12XtggKwxdLPhGidVOwDdEN7IjsmDGUUXpGM4S+tHMGUWJZWEkACaBOHiM+GXcEAoHkzWYK5caL9A0Joni3mgY6BoyZJLpKcdl0FBBiERFxoB8THcZNVxtS7ifqKpCyz4YAzGi53VCYQw8I0XL5+nYDKGJlS/ADpwLWApH6L5JIy2ZG35OYypxTUOh1JfgEGEu3P7244sX1tfeNQDhCT4/fnRJiYNbpjAAHuvLCoswQCQgdmT7CIfvcGiSCzaUPIAUp0lTpekh1yiQeTVgK0AWIQZhTT2BHIgEzkbFMh4ARnWjBZpMNRTFRH/IISEdMMJjRkcnAjVA5KHQCN0YMQlZb2tCXj2QCWcIiM4LBHkMQXgZd5Unps1582kHHHISEgpQ5VKb9k3KvzylrJgAa6C0iRTEwAj2RgDHLgbxVEgyQQIwdnSUk+2ybyv3KrBt6p9utdNmjt5eqFHAhAa6nseuuGI9FhgwRnV7idxa5CntGPbry2CkjwB6fWPj9MPeleyYUOyXOVrtOUHp/r5vLWAbo9nCYGUJH1pmAcBGfcMwvvU+Byx5uZsi7KxgNbGaPETjSScdzSX7dKJDNSUQUcl4ZqNi6YWoZ5B4IXeRY1v6QihipnacQpKOnJ2ti6AbGdCTsYK5rRwOyobahzJ++dPoi70UgFpl7Ym1gXeesg1Tl6iADkylDv2dSI+UEQcB8RMX8PpDIZAHoilhRDnJYb9qAeTWKDJ0gKfj6gROyF6zsGbUfTCD7XfaxJwvMaQai93k81o5d5K+FnrxXyKmsJ8HIBN8oyPOmXbUvLJT9SdzwstuRx4PfZ1HCrXy27yDM3nYdIprysm4vCMx3KTbnRHH72ucYbzdR3MDnQig2ic1Gb3D5zo7jh8Z0zEAsAkphAHKPdQNjnayhLOZq1bu6guPEPCuzJnoCXehc17UJxlQkgsCkZIxLdtAZKa+L1ATUzltsSOywpGRNQAezEvsr8vgCYnZhPIBEYToY+/6SaU6YGWr55D4prY4ntofyEdtqwSuDlj5gqmDCaDBoR2Ji6sQNY1puoCuUs67SEP3fIN7+ORNx4iUImZ45ZNh3MF9TpdGyz4u3oyeiGNIn5irULYB0YIpYQsuwkZRAT2L2MVIgFKYVp83ij+TstlHrcGmC+jVDgCSYhHWjCixWCpDC7GwliVXQKJhkQMg6FSuBKxYikTTPzg72F3BzDeZjHoHcdb79lyF5+fK4tncxcgtDIUVZpvV3YdHmbTvYBkO/R/KMaGbOkLsBLPpmnjND2RIDsbRFqdNmYRiPBBOYBRKGEdBuh5lADKQ0ogJkV3tMAgR1ZmZADpgCQciWXWkRyCIcTRgQlwNdgEFgnOFo9IDVedYJlgy1qrhtqFXIZFWygQ8kfq2sDJcD0/XEBEihmabJ52TfQUp0fe9KYx5drNSbLkszF70oxkDKqSwPBUuE4H1jEdAOrCdnJVugq4pP6J2ESIea22FNimwrkywDXYiIgaqSvcO8DXEx80AH43FCuMTI6HSEOBO6SMgD12lC6DBgTOoybSo31QdIPcxduYdxVbBCkR2ayArZjEUgdrh8m4BpBgKjpkWWTfnIrhvo+8Q0GWkuI2MG/QDp/8/ef0dbdl3nnehvhb33STfVrVyoKuREEGAAM0USzDlTlERRklsObbvDs9vdft3/vB49Xttuv+ch221bsuW2LEqiKFIiJeYERpAEI4hAEBmFqkLluumkHdZa8/2x1j7nFEi1R1s9JD/BG+Pg3rr33HPOXmGub37zm3MKZSjpYpmIi/O0ABKV0YgsRI/Slol3rBOsiy6t+HRPsgCuZ06rJXhDJRqDxbkm+leSntMABIzO8EEjOfhQozIo68gjBAyi8mQzPSgV/zCkN1MzXmy+OdIy9KKptcZ5wTVpbDMNoQal6BQ51aQmvmKAogO6oJkmiG3nQ45XoAwica3VTshQkauenXtx/Hz7UXKdDi4DSkXM5xus0RgVQZ33bj5waZtqgSb4iAaLHHxAnGCxOFddyjZqFcdG2fgVOzt+fRDI4ihKiO5iVhiU9/hK0lvqRI3M+MM4Fk8Zy5+4ngYAsb3+tCF4WlyKuFejEc7SkegR3NwjJDr5ffp09ArDUFGjkDUN9QSyXlqcYcHAqWh0nIOmibtGm3j4Bw8hoLVEkqqWFGZmRoXPvHcVne3ZD2bsUnsogUqcVkCTk5NTIGSRtcwUgTEUBmof3Vyv6GhLFUaJ12xDGulrWvwm7bSFt17YFzaxpz4evFn6ezGRCRMPhY4f3nXie5gGpAKXDmqdxYNAuWhIHBAUGBsNWftmLr5z3wcUDSZ5ehWCzTr4JrInHhfDSqoAU0Sj4UqKUOGpcB0LDpTrIggsZVCXiSH0kI3nINNn6YANESQqF+/P5CCdRAUk8Ljoys8GqD1g2thGcgaallZkzsRJO/Y6HgBB4vuqgEKhxeJVBzrpnryOaypM0aom6DrOV/LCLYaGQKPrGelLfDk0OoHTGHKLa79Iq6ehVEB/Nc6jEpAapmPyIBiKxEE6SCwcBtzctv75X5q49vrAuAsUkXJWDVDN2Boki2OnAuBmrEU8aNMaNhqsBZPFA7Fq4jz4gBboKY1IBcTjxKFwer4jVEiHjSaecjqxeg5sgK7uUAWhxsZ1RLIJeT9GFJohxbKlGm8D0BGDOB8BMAAhMootu+7a9RlmbDE+kKdxqSEe8J0VkAJqF9/Hzjza+PDRHsX12jrIC4fkJRSjjvtTEVkefNwbDZhQsNpZQ0zNxmRjxnSjbKQvQ4fZgGQq2sHCgCuT8eum95jEOdFpzgDEQWiSfeml15lG0GQ60bYlBpy8jQzoZINrCNBpwBlwWRZthBKoqwXbqjA2x9c1INjM4Hw1u3XTkngakAwjNuGnhqACjYnO8sCraJ8yC9aA7sR12QSoa3IahJJGR2cjJ06Bx8Z7KJJNtCrNmQLJ09o26UxqwFdxXExrv9MHJHn0bfjVmPgcI+CqtCAVlEKuoU7DZQScBroadD9S6QYwk7iWRcUBDMmehzKuG1SyjclzEZkfXqTF2B60JhkM5yg8ZCJ4LA0Op+NCy0I8XQKaGoG+QtLZlakByus0ZQ21EchNAoo6rc/0ebSer98Q9zHeR6fCuxjJAgb9PsPxCJUO106nw3Q6nd2WtNtlTizPrqcRTnx6M4ptABXi8Re5nrgclMzxTMAy8oZREGApMgOru0RdfwVrVxylt28Pawf2UqyuoPMMXzcMNzcYb2xg65rh2dNsPPogPPqIYnMTXE2oG4ILaKvRzkcAaJJWJkUXjJ7vxRaEir9Uy2NRaAUVgdoGqsaDyule+wyprYKugC/jH2cFPP6kKjfOYns5buoSKGlfTy94onGELtV6tVf7XA1WY6+5StzK2gwE4+s4gE7ArMbnmgSumjoe3qobb1CnkEPdGjYdD4pyAuOp4uIInGI8ntDBYI2J3rDUuKYk05ZGAmIy2HcQtfeIiE6GeTqkfvwBVbiGIEIQjRiDOXRU/J6V6K2qbjTMJh080nqk6SDOAzRVAhV5BB2EyEDmOhoeSRQObdhDz8c0eJCG3EL96AOKahoXWnSwI6sV4sjm3R7NaALA0vIaO+MJHLwctb5fBBXjox7ybgc3OU947AFFI1gJaKUJ4iNbOnNYmAFSg07gLqFG165/A9ZShwbWVuHaWyQ6NiEeLI8/rOqLO2TJNUnBqvj/cKmu6s/9MkTK5bpnCNMiOm2ZjmHJMImftrZACxRJoIM5UJQq6R7M/JCpGhjuKLbGMHWESc3EOzqAiYEqijxju6lmBkTakFeAqJEgPjrgGsWkMXgKOtfdIGWWQa8DkzIC09DAheOq2nhyxrI1Ix/9ieTARQcxzL22lvlrB98k8OfTfFiwV14tzixFsOhU3Dc27XkM5EVi0GQOFGe2IH31rQEiHcAxUkBdwnSsOPckFJbgelycDMkZRQdkCZqSuN6uuV7I1hKNlmi3uoZuDlLGQ1266f3LOB7BzpGZCRGs6Cw6aqKBafx8xsK0BpvHuc2qCPgnDh57NEqYm+iTOgVcf5Og8+hMSAO9Hjz8qGKzxHuFISdQR3Z/wQecOcqJBZvrXhUBO9vDJeBUBtdcKaytwc4EdIH1CvfgQ6pufIzYpMiK0ilEawpWnnGLbHcLqCbQs3GMfLJFi0BRQrRdkpyc1lmgXX+JXVBEW6w99A3UUwoc1X0/mh0hLfs8O2OOXi4MdsHUQJYB4xR90VBLXNDGxtcMdVwPql0b7WdoHyoCw0xD10A5hlMnFeMp1dRRBch9dLs0cUiijYkiCI3AGGxHUwUd/ex8PfropoGlguK5zxa9vsTavr2s7dtDZ30XplsQjCKEQIZmuHGR6fkN6s0Nto8/yeiRx+HMGSX1hKFvIM8xJsNNJ5TTZgZspbWf8x2QLj3DDf4v0v79OV5Pa6DYXgJ4FdGZhHioGolhI+81dPpgBrC0TwbPeQFXvfAFqEO7GXc1m6FiWli2laJuYiikY3r0961i9l9B40rcFVey52dexGphZOuxxzn/la/DvfcpRlPCcAw0dPExdGqJoWIPblGDodokCphRRAlo1AJkIL0AJkO/6rVy9evfSr0yYBgmNL5huTfAn9uAx0/IsV//58r5VgvHPKw8YxTm7KKEOVj8CS2TyWCwzv5XvYvBc5/NVm4wuUEbQUtABw2NRVBUVlA4+o3HBIWnoDKaqnCAo1uCEsFZjcuhxpNNKxn98AFGX/waPPSEKqcTyjp6f51OTl3WhJDY36Ueg595gex59ZvwK+t0RHN4POL2v/FXI6ytPCG3sLLGje95O+EZVzPpLmEkqsDElHgd8ClMqUSjcChfIXgkRLDhyfDiCWaM1R5rTIo0Zwg2skpiI5kokDclfe/Itjf4zkc+KNzzQ0WYgKtiyN4kMsQF6vEIjUFnOTuNQLfLgV98l/RvvBnX3YUnI9Qlgxzq4Vke+dCHhK/cqVxZ0ck1vh7Pw0WQkKiaJWoJoRXFtauIBod4BZlFX3WlXP9L76feuw+tGlZG23z3H/0DYThRTaPmToWOgFWJSkZykXb6c7xsBi96qdzws+/DdfZS6QxvhaAblNtBiSezS3HOlEEUmCBogdzHefM2CvZd8DglkUxVCqlKsdtTTn37e3Dn9wiPHleTaspybvD1Jq6u2uGNlywkYoVoR2aXUXhdsPSi2+Ta972HjUGPkFma2tOTjFWpkeMPyPf/xT9RuCls7ERCzNjWe50zGw1zMLcQEo0iy6iUbCSDlWUOvfJNrL/4FYw7y4gonDhEVzipkWBQulVXtuRrSORajK0ogUybGHb2PuI8azA2xymhqEpRpx7jxKe/iHzjXkUvw08a1lYsF4bjSBIeOiDP+/t/h51iFzteyPMc5QO69hijwEIdFMEnRalpUNYAPQQT165qgAniPMHH9B6jPWSKCk1wnqVgyJXDNUOWtWVlDLf/r/9QOHVcUVdMCDBY5fl//b/jwuoyIQtoXUM55LGv3CH88ZcVF3cQ3CwImVtLXbsZYRtZW5PGK1ATzwoRmQEmpyysLrHnda9i6ZnXU6ztxk4ali4O+eY/+v/C1g5+UqMkgrtKANuH1YM8632/ytbu3WwUmpArrIG8dpig8SrDKUujozCo4zxGIpM583kSiBUVGTmvgY6hqkcU2tEfbrN3Z8id/6//GfwYX9eEZPwdCnbv59Bb3sfqLbfi6dIIKF2jTSQGag8VGUErtE7UivFzKkEMgsWIpmgMhYeuySjrKZPMowuFaWqZHD/B6S99E772VVVX43TQBYyd6w69FoxEnqMuA6wuQ5OByYXbXsoVL3sxy1cc5mJZIp2CrMgZGc2W8jTB473HEzDGYJZ34Q9WSONYeZlhV4CLZ8/J+InH4KufgxMnlRtVQEGnY5mWo+h0PAUBRkeB5Ovo2fbzf1H278/x+s9AERaYluhehZRw4FGwtBIP3FtvlWvf/Ha6uw+xEQLTbkalPdrmiBa0sXSKGKk0Lq59h6Iko3/kKqa+5OELZ1i98gZufubzufjjh+XJ278E3/+u4uIFplUV1WUpih3a6FAAxEIw6TCKi9IlD7AwitJLNAooGHTY88qX8/hyh7qTo5TCasWOV6weuoxBfxVe+jPC1z+jyIEyvY0sbISFBBV0CxaZBcFi+ktyR71FVg8y2XWIM76KNx8adGjoK4s2Fq8spQ1ARkd5TNAEKWiMplQNSgt5riIJaYWQK4IJmKxg9bnP5chNt3Dyi3fIzhdvh22tZLzBtKpY7lvqiZuN06g/INu/n82ig6pqQh1ZE+sdzk9i6GE6YtrJcf0Bk+U1puMYphGj8CrglZ4ZXIXDFjnKGrzu0sSUD9ANii7KTcidS4ApgUiVzw643AdWun1oapYwMQQoeWQZUXRMQ+UaREUSxDXQ7/QZ1g1kmt6b3yy95z+f03mBcxm1A7oZzk/ZfeQQa296E5v3HhNOn1OVG8+kkqo96ZxAsCnk3LJF8ZIEPkRJCpUagrJMVte42F+ibsbssQUsrYE9GRlaEtOoddL+/QVfKoeJY6u/m7q3zjBovI67rsg1hdFs1YInw2lLUKAlYANYbSMIsZqgFU55GhzaKqzVUHhUPmX91a/C3vgMzn7hS8I3vqF2qhIVFZtkLcmyoCiwxAz8qlUlKKAYgF5m+aUv5sndu9gqMtxkQn91wNjDTh1Yv/wI+pWvkvDxP1FRm+dSpnQbFgZCjBwbSXswve8s0Uxbgk+saNCofQc4N1jhpGjQBpvlmAC5sWjJmJYN6BxBR5mLSlUGkuQE2qWhINNJomYRo5NeUHHgumdweGUfR99u5Y5/+s/wj+6oCzs7mFWNDwF2xmpiC7mQZ2yiyYoOKgi2CzoItbj4btLaKodXmooeIpHWUbqhQKPyQPAWEUFT4zS4vEArRVkHOsHhVYOIJrMKtqeK0GWmwfAF9e5DnO5mTKVE58LK2i4uf90q51xXJn/8KRW2N5EQd4yr57IemUUN4vi0DpefpT+39GPUysnevciRy3nSNfRsQUcVkSF0Ue7TySyVc4g10Ik2odl7gPODJc4VBqcbCBV9rcl8ZPGdhlpHO1nomJbmEiPpNQg62SIN2BjONQryLkbXmNVdmKyTJEhJVDnzQjKYBnaKJereCkM6+BDoSI0ODZnShLxgnGU0BJREANmk8LwO7eq36GAosOQadO0h7zPpCRVRDrN89dUc2XWI4gUvkId/59/Ckw8rfATkrfQqJKI7tzD0RPnOLTfL7te8h7Ubn8nxasJxLazt24P4wMg5Ql0TXBMVHcaSZTm1q3DWQLdH04faZIjVNOvL9I7sZf+t1/PYxz8p3HGX4vwGU0n6DmVSqH6RSEkPP//26XI9rYFiG06IbH1rkDUiKmqJsgIGa6z+yvtk7YUv4ITzBAU26+J8TVcpip0huqwwKJayHl2VQSOREVSabRPYOXGRpmdZWj5E7T0PbE3p7r2S6953NScOXyGTb3wVfvxj5WvIlKNpZK6/qplpTiJnkEo+pJXqXZLhBg1Le+B1b5PlI1ez4TzeBXbXgYunzzI4dAQZ9NnJFQdf+0ZOPXQfPPEIJK2agiRSZi69m+2EhRhM6z21rIYDPfVUlYfMQL+HbqYMtrbYpRWmCXjlYqBIBbIQ0CmRRrwieAs6sl7eC8F5goOqUDjTYbKmeXx7xBVveyPn9u/mwr/5DcgzOoOCnQs75G24Q6Jov1JRfS0ZTPIMFEx9HRe6ErAa4zx6UuEZ00m5j145RAW8igZUSYTD03IMvT7TPBBC0ipqQ+4UWelYC0IehEYFnAo43eCTBsxIoJg6GA8x5TSG3VEQAoVvMDRkJLVjAGsUoSGGww8ekste9zrOKsvOtGHFFkxOnWb18kNUeY+NOrD7siuwt70S9/FPIKMpEM8A5ZmFV6OSSkc9qvYzvc1sJqWJzLAyoLs402foDZBDbznq6VxkE3OlIjAKHkuGQuPS3f6FXAIEiyHDezDakhtFMxpS+ClLRcYgZDgdcCHgFWgcOoEtEwyMFFjNxCimQciUIs81XmtKrRiu9dl76AB7Vwac6xrh9i8qEUNQLkrJpP0okYXLk36zaveOy6C7BK99vaibbuKCGLomZ6na5vzJR8ivOso2DWFpmZve+k7u+fY9wpNPKvwkSh5gLiUAdNDkQEjv42hJDkemfMz61hpCxVYzRdlk4fodlBLkwg6ZeFY6Pcq6wRhNUAkotsOqUikdCZFZV/EDNBJDwEGrKONUwunRmKWDB5DNmqt/9Vd55N/8c+HiSeXH56DXBbPKrh1P2ThUJ6eqS0wnJzQBJYEVq1AqCn68d/impFQW6Qwgj3o4aTymrCnEYXUHY6Juo9LCqCoxStH1CjUdUpgGXSdB4lJH2NlQUf2YMRWY+MBUBHRByHI2L1yEPYdYff1rmOCEL3xZyenTBO8TQxzrH/i2XEu7j2bRl1Rup5WeeA0TTzkOVJsTRtaixMSwOTp5cdA0ad94D24ERZ9NP2Gcr+A6GaqTIzslnRDoUaeEIk2doh2FKLRo6pY59IBoshCBpBKLqEATIODwfkpWjnE7OxE8hkCOovQ1JstxycFotKYRT2kgKzoMgoGtEl1OMYXDdgrq4DFSklsIKjL0EXDGyJwSjwkOIxplobKBkFm8NTgx7GiDLzIGvSOYt74a/2URHnpAhbIhZy7zLYENAboZvOm1cvD1b2K4cpDjg4Ja5fSMImxu0q1qrBdyFH2lyT1IXRPGDoxlJA2lVlSdjKEOjIODIkdWuwx39bji53+B5rpnycnPfxnuukehuiwXlnK8AVHMM5eStHvE/2eg+DS+QgJIRTysOz2u+W/+rlzct86ZPKfsaMykouumdCdjqlMnOfvdH8Cxk3DyFJRVjNKGZDR6S8KVl6NvvIn9z7wBvQsm1tDYPq5juSCOa9/8Zh7KDJPhVDh5TDXNCK1jJmUMO8UVaogZi5doBSUeFFm/Fw3U6kF5zuveyf1bE4r1ZbLJmHOf/yJ84zsc/If/mMfP75CtLNG57HLMS18q/vwphZ8QmvnrtmxFdDZbxBgvNdPlpHEigFIU3tF4B4VFh0B44gl27vohOzujVCdCJ3F7SJR+PFJnp5PRSUNmodtlZc8uVg+uE9aX2ennTDPDudzSvfE6eM2rhNs/r8qdM5gsYa9OHsO9laBKH93SLMN2O1BkyBB0rqJRrqY8efcPcU8+SSnRC45x4jrdZQRWtNIs4+HKK9DXPAO9todgDOxsUz16P9VjDzMa7SRBp4lCKGVoM2ijjiGD4RYHihwef1hRDtE+itpbCUyeR+dVGcPYB1heZvDu93Cu26NWGeu9gt75bbb/j99k6yUv5vCrXsmFzDANGde/+jXcd889wkObKoSkUUvYoNAWgr4UyM3EVgsEiWuSBsmjdQdMDyQmdcXclVj0ybTJGykOaviJqn1//pc2ZBLA1eQW1GjC6P77qI4/yoZ3SQ9r05wEZqKjkFh6l0c6N491l/RgmX37D7Jr7z7qlQGnBU6eP83eyw9x9B1v5okH7hOOH1PaKMKwnB0WISUItcWm4vrR0FmDYlWOvOb17PT7hKakX1WERx+Df/+bdP/h/wL9HhNtuUDBvnf9Imd//V8l1jklTC1MoEdHiVZrBaLfAg0pG1RH7Z9SFDaj1okO0Yrm4jn45rfZOH+OrW6XMK7mY4PmkmSW1qEQmGXaaYtaWWJ933727duLW1/h3NoqO8MRYbDC4euuYv/b38aZ3/m3MOnAqIFyi0c//QXO9wc03S6UOzFKU9YgwrZKzovXcV31LOw/CNfcRHboKOBpzp5l/PB9jM+cgkk6oU1rqw2IYmosbF9ELVt0U1FUwNYZhVQIDWDBFFTNFJ31CRJg6tF7DrO5dZ5qdYUr3/YmzmqR8Uc/pmRHMErjnGuHmVhSakYtxCsn0sq+RmEiey+WXj4g5APKLAfnqSfjtFA8WsUMbmOSbNMqMAplNCbLYFohZQ2PPsrFH9/LxbqKjJpKmsygmWVAap3mb0G/2moEFRHUFgaU46IrmTQOJiOQJiaO48ALKnikyTGZRgoV97+fcvbhBwnHjsPZc4CCbhE1775KGetpPlqgTNICt+9vNOxaYfmKI6wd3MsoN0wVjE2HsNLjite9lkfOnoJjx2E6TNpEABPLAWUGbrheLnvFbbiDhxhOHCZUZOWEbDJm45574ORJePQxOH1aMSqjrrbdM4pYRWLvunDl5WS33MzR668DZTi3M+K8UYy7XfbdeCPP2bWfH5w4JZw7p3bGJUt0qJmgCU+pp7oYav7LH3aGpzlQbEmzXEPlmXsNWQb9Fa7/b/6uTI8cpe53mU49ha84HDznvvc9LvzJH8WFWaUsKoA2C6VdUFOjuHiMcPd3OfX7Bm58phx569tQhw+x1e8wzhSPK03+7Odw+OAhHvxnvwbnAqGZoK0QvEQvMctRTZuBHEN+WkV63mVEFqG/ztW//Nc54wy91d1QbtM5e4rNz31GsTPlxx/5IznytrdzonLo5QH7X/t6nnzsAeE7dyvXTFkqCnANlXcYlbImk5dI+/2iIk0RqSs/IpcxWZiSS4GeDCk3zsEffUQxmkZL2MYUdAKK6CTQDkCdxiwnisxztr1nu1fA854lV/7iL3Cx02Xbl6hBn5tf83ruuftuYeei8k0VX6tW4IXlqbCrEs4UULkamU5jhrCGyiWBp6sYfflLagboJGVumtbgZXNDrInZ2zdcL1f8t9eyOd2h8ZrdXjj2g7uRz3xS0UyjEW+TWNqxUmk9EO/5dPBRpO8joxWIb1ErkBpWrWXoVGSxr79WVp79XC70emRVxdpkzOOf+RQ8cUyxtSlrV1xD2HuQutdlqyesvfMtbP7ajyN+m4wwPp49MbMvMCsK3uKAp4ZSIMorGonJug7QHYKbsIh8ah9i/bvEWIa/cCMZIJQU1HSpEN+w7Cu2vnI73PtDFZMB0hrW7fpNDkGbfKKzeOj1NARH8JbTZJzec0SOvPtd7L71JsZrK5yf7HBo9yr917yG8e98ADcexteZjd9CyRMHhUCll4EOB//KX2OyvIrq9uiNt9k9rbjvA78JW+fU9gf+vVz51/4GGypnpLocef5LOfu9u4U7vqSUqSGUc0kI4DONDwrlA51M40IE810MDSomv9Q16A6FF5rxlGxtjWY05AiW47/7EcVkSnBVKteTAIgsAkWZ73tt4sGrgE4PcY4LEriwukbxohfJwfe8C9fpUvkppxrHVc+5mTOfXhe2LirjIbgppz7+MUWepdMmvVeMlca910YEtECh4Ibr5MgtN3F+dBqAAz04/oVPwo8fVFTJ8Kk2yyDVrfABVIPYKV4LE4kZtja4mFlMBaEgNw7rqsSCaWzlGZHjJHA6s/Tf+hrGS7nw7z6qqp0pyhjEVykVzKFVwGaKupF4Py5GGZREhg4E70KMlgSNiEEkxIo2KWQdmhivFpJj3riYCSxgJiXLnZxOVXLu3h/DJz+lKMcgFTMhbFDzfTkzO8nWpPqrMbRAzDRuqy9I4LwAVTWrYQDgxWPxNExRakpwI3QW6E0b7PA8G7//76ItNzrZbw+hiqWcqjR/6qn8WoqKqcjY73T7YAv2/NW/Jvuuv45zWUAGA06Unqve+A4e/eTtYDJqV6GNZeoV2AI6BVe97T2Uuw6wtVOx3lsh29hm+dQpHvqNfwGb5xX1NN13WlsikRQQHUshjbdg86Li0cdobv86Tywvy8pLXsKNr30Nx/bv4+JoxGjPLpqm4er/4v088k//BThLVe4Qa5UuyD+S8xQW5BlPh+tpDRTbw7owGU6aSAx1u6At3be/RarDh7hgc7LuCv2Lm+xznkc+9Ltw13cUm+egKqEBiyCkgq2axayP+CblEDqrcNf31fEHfwxvfbNc/9Y3cGzaMF5Zp7P/EDta0X/Tm2T8u7+vEBBX0s9zxnWDd44sLcsSF0X5Lr1PRsz4e8mrxBy+mi2dUwTobW/z5Jc/B5unIWTw7W8Qnvs81i4/ysgF6C9TvPbNVPc+AlmX4dY2PWvRqXxIFOonDctTbmd2cOkAKuC1j5UTVNR/5c5RlyVMJ+AdBol6TyXMGB0sSDTiykIVYvazwsZaeLWFH/5QPdYt5Ppf+VVOqoyp8+xkBfZZt+COPRRZBQckLZMNgcw7rDhqlQ7A1pDOrGKzUCQ6oPApySPdUzrECohlkEIGdUUeGhQOLZbCe9bKho1J8qx9y0bKbLTmtTgvBVNt8exZln1KXGqcI6gl6Ha5+hfey8mswGcFe5RmfPcP8V/+rKIewbmJuudjfygv/rv/E/eMh9TLlvVn3sDmbS8TvvR5hUkJsD4KrtveFIZAkAVGup3aS7xkQRHmGf8LXrkQRfOt3Mtphwn/CZhKBaIDXscyNllIJanKCsoSFaTFboBHpe/a28+ZzwW0zFEXTjyujv/b3+Tw/v+naHOArNtl25UcvPmZPLxvn3A6KJpRPCx9dHZUlqo5eVi2K1Qug5e9VOSqKxlmGdXmBtcWlvv+8EOweUJRT+DeH6jN739fBs9+KdtFj0cmNYff83OceOA+kTMjpVT0YagXtNQmQ9kO03oSz2iBWFFU4ZSkzauxXpGZnFA1KO+i/GHcoMcViikqFcdfIJlnY9omzmmIBc2DINNRdK6MgTMjqi9uqccP7pd9r3g1W1lkL0ei4IZnwBPHUFVJl4APDVU9jYMTTQYFJO1si3csJSqyvPWUXGIdTA3kUkE9jfak8nQQAi7lxZqZZhQaXNWu02jHZiUAAXTAaWgM5B5yHxgff4K9+3azManw/Q5TJex/9esZNz0Z/s4HlVSxbFZwDkNcY74S1nctcXFzOI+spHeJEo+o9fQYvNJ4pZJjJnMbqOZDTQKtWmvEefS0plvHxEgmDUwrCGX8u7bkVTtw7SQtbsUwtzPSLurWhxWFDjKLZlx6zaNHWoRMGvJ6ErOVqwlWEdeXdijnYDJfOE8t7wbJR0skI6MpdFc4/0//tbL/9X8tS89+BmcnFSrrUmUODl0uHH9EuVAxEheLqBddWFpm/YabeUwbMpvTKT3u8ZM89M/+P4qt8xGwBkeiaWf3rok/cs00OsqqiVIGX8O4VNtf/hrfP3Vejv7Nv8lWp8f57S32715mYK+EG64Ufvhj5VIzgtlAXnIALsjWngaX/g8/5S/v1cKWcdNEB7XdVZdfLkde+XKGu9dwRRe/OeLwpOGxD30UvvgVxelTUXfWxPSGdp8amB++aXPmGVhpyKcXodyGySZ8/A/VA3/we1yuwQ2njEzO9toyh1/5crj8qMR+BhnULtZxFYfD0+gwKzo/uwGxsPewPPPN72IjZOjVFarpDuGxh+BLn1OoEbADZ06ok5/7LPuqCjMcU5Nz4IbnwItfFjFN1mHihMIU8XAQMGpuzX7qplAacs1OnrGTZ7isQ2UKvMqihQgBkw5nhWeWCqqgrc9SG+ZdcNK9xjphU9i8CF+7UxUXhhTOElRB2emwdtVVqZQJxFCHBg2N9ZSZp8wafOapbHiKkYRYhLvCUGFpYoLOImCSgMJhcLNSKOh4j5tFwXYnZ5hb6vb9W/CkJR0QLh4WKiwwNPOHKI1TloqYxRiCIniNoY/oHP3Ot4q77iqqosBXJbYac/qOz8PwPJQbUG/Cfd9Wjz10F70ly0R5xoMeV7/5jdDpQX+d2muMyvGp74vg2jScnwQF7fikzx+l+636LcwZcqPnzzVxgXgV5oD4L+JSGkzG2BaMsii0L42N4bi0YHMClsiYmJTRqiEBzNjpxqcSjBEQQGSJK6gbTnztToqhY6no441FVpZjTcvGRcDUeoeSyJZ0+g4bBUt7ZffrXkN55CCVbhhkgerEY/D1LyrCKI7txnk2P/UpliQwrqeUywPk6GHy17wWOh1EYmWTQuKDKExOfJCFkKMpyChQZKDaTOaYRFY1IUbiOgWSugtpGnKEjIBVikxDrmOWrTWpxnh6GIDQlhJX2DxL7GyAxsOd36dbK2xjKGwfrzIGK7vBaxyxcHvVJn+k9WNoAUVcP7HESCusjettYg1VnjPNcia2rR8Yfy/EjFbfPj9BfUWgAIoANHoWjY2fQYPNGGYFkhVUeZdGawbDi5z7wG+xGgKDUKAnBb67h/Can4FffZewq59qVwaKPH7ujoKtjSHG5DH6kKalUVATwAYqEwGpaE2jU/UvvbCfmJvvWFM2w9ucRglOAjmaTHRqixSrdOURC6Mc9CSWD+0IFD4pJ1x0OtuIwSxqEEB5C40FZ5BgaXRBhY7yYwGhA9JFpEuQaMMblaHyYmY/g28ig+ojYBUV1TbaKLRRGKPIVUx27wIDgWUNnQq6jYKRwFhz5p7HyaaWXr6GVl2cMzBYinKLjPjIU/PKq6+X86MKky9R0CUfN5z9ytegnIKrMc6RBcickAlkC2A1SCyzqAggTazZGVzU+Zw7A9/9nnri01/iWl3QFaH0U7Z1jX7GlVAEgpFUuEfPluYiCH+6gER4mgPFSCnYeYRV5aAy1l/3OkaDJbYAqxTFeMipO74Ot39BUQ1ZKRS5xKYhQEoHaYvDMj+NQ3RgBgV0CORMKfIsakQ++xl1/lvfZpe24D2TImOyMmDlxS8Cm6GwGCQ5kB5vPF410dhkFmXjIUnR4+Db3sWku4R0e4y2L7ALx+lPfRomk3T4p2LXd3xJXfzhd9hnwTvFRtBc/bo3wP6DQrcHOiOk+7DATOym5uqcS0BGGsM2464tPmVCBIkxISRuJ828r+olbJaav02eLSxHITIjDi48cRo39YgpkG6HOrcxthoWROU6ljnx+qdsX4kTrCQmH2SwUGidxaj6pZ45IY6fDtRGEzINmaK0KmlWJIHfBKwuAcILr7fo9SsWfmAiG9rtskMGR4/Kja9/PceG2xglrCk48e1vwQ/vUph4CBg8VCVnPvVR+vUI7TzbjWO4tIT+2fdG0WBvlam0ds0TktbtJ/i/BePXgmi9AOwvyWsO+tLn/qdyhRhCDhHyL5SrCQkc+vSbp/An7RSkeutU8WemZWw0cX2d22C1t8xwa4xK64/rr00stYBXZKaYhycE6A5obJf1172G7OgRxuLAT9mnA0986pOwuTFbMjQOHn5IPfCNr7KaK8BxcrjB0Ve+DJ55s2C7aJvPHNGuSsxJ41CdDi0LHPdnmhzl0lwGsk4eizgbyDtFCtk6HE3s4CMSaxEHiYWf20eIj36nS25s3CIiuCqBBdGR8Tl+jowcg8Y1Hq0so/Ekje+89/hcPxfH2aUhr1XK2p0NYNxDoU380Gb+Guk5PmnGRAV8+q9Oq7yd2njFVqAxH1CDsrHFYlsPkkDYPgd3fYsLv/XbHC6FXbXl/Lltxp2cXW9/M/oX3i30Mhh0mDSJXBDI8j7eSQp1LgAzZMbG2qBRXpF5TR5Csg9zGygkeXPqGhSMB9Ngs0BufAQ0qTC0QiXmdA60o8YwdnzJiL5OLswapLQ2z4imEzQdNDmx/5hTMqvJHX9iZ7bbBIMJGi2aMGsHFrDa/ASbGddLlEkFH0uwNukpntQ0h1jvl+ChtyRy/EmqymN0TGqyxsBkGp/ckhNtJf8DBzHdHjtVQwlU3sfuMa5CFVlcUmH+UCZWzdIpqjfLSidAqFDUWBtiyR9p4FOfYuXseY5qWHUV2k85cNke6Hdoa5UuRvb/k7J9f47X0xsoQgQChlgZXxew9zI5ctOtbDjBoSgmY5aG2+x89HcVbgvUmHE9oTZQZTpxT/FICizo29rdIjEKFlQMHrudzXg4jCZc/NjH2TUp6YlAaDgz2uLgLc+A3CIqQ7cBAhUgcwn0gTIZLuioZ3v2rbL6/Bdw0Ria0LBOzfnvfQvuv0dRN8ya3E6GUO1w7jMfYancpJvpmH122WUsv+sdEXQurzD0sXVTUWRtDdmfYBRn4RIJ4B1d39BxAdUEei7QdQGcJ4vVuX763mp/EVQs1RC6hGaJWEImMSM6+oYOg1eGICrWCNMqirRNSC60n7l5NkDmFaZRFI1lpkVLBrT1NpOjzU+LnsawURuOXDzh4hWU4GbxwIbch+jxS3xYWcCDl7CVaczEJ4Y1Cfk7PVjucuXPv5cLKDp5h049ZX2yg//0Z2BnDOOSTGBJcigbuPcedfbrX+OQzQiThkmnzxUvuw2e+WwBhWiTDq8YBlsMry5OQeEUxqU1KwEtLmZjB4dd0DtZUZGpqePa1i6O519o8DkALjCoA13vyIOPoefgQCKDuDh3LZBsc83iGuxHSjFNp24jC7qIa7AOqLxHHRSiLE3jYjavFghCD1hu9Ixl0KSxvOU6WXndyxkrhZlO2K+Fje9+C77yTdUbBoodMFNQKbFZ/uADarncRI8ukvVyRrtWWX/zW6G3m63GIjY6cKqp6acuHFKWoBpiYZ8xnhHoEagJqDGaKb7ZhmYE2xdo6jFoh8ktjRbaaY+QMnZ7eupeHZcVpQ8IqXC57aK6yzE0WAXYfRBvewSdUXtHlhvYOg+DLoSAxpCTkbuM3FnyEMFRZWMeUdso28U0dKL+DXKvY+0Xp+P3gfg7E+JzI2kaWXwdkCzgM5iqlHFuIovpbfTF2kS6IiRGzDfkUpHZEsYbiju+re77td/gSPDszTNMMGxMGrovfQH2b/11wXTAdKnIsPmAsm7lJnMnNIL5iLCXKs1KCWtTWCthkPbNDGy0GycQAYuqCIxRusJkNZ4JjZ/E+rha48hpVIY3Bc7kyf2xeAoCXRRdMgryONoYItOMFBgyLIouigIVy7DpOrZBSZ/Z4IjVGKL9Lnx8iEsbQjQ9XWDJIWSIm9Oi0WeOMWaf4jRTYkl0byHklqrIoGvBDxWHVrGDjOF0B6SmlyuYjsA7bCWYithtBw1bW0zLEdOuYpQFRoM+u172UlhaQoxCcou34AuDtzGvqPSx44yYWLChBY+R+K9xfkIII3CbML6gHvvEH/HAh/+AY5/8BE985cs8efcPYbINuBlZ03ZlRc14h6cVZvzPQNFFhi7Wv8rhmmewrTKC7ZLpjJ53PP6tr0KzDWoMyQMngJuGxLrUCD5q+lQSZYhFiaXIujg0pXhQBkWD8ROMn8KpE2r74YdYahwmgO0W9Pfvhr3r4sTREHs/z5gPBXiQKkRgt2s3u970Nk6bHLNrBTfaZu9oh+qjH1a4MtrdBlAZShq0reHx+9XDX/osyyhM0eWMgr3Pfx7ccJ3E1nQaqzKmVXIFW4PWsq6LiREhfqMkYERmTQL0guflFXgzh1kmGdX49xqCRUsBZLgg0WvWJiW+RGO2evQgdHMaD1SBQjTzZqIusiSpBiJi0KIxwZIFnehOPdOtQGQ/a1LVF5hjQT//3MIiO6Wx3hLbpumk3QsRLDxVg5hGyLS/WnzMrpC4jhCzGOsGXvZiyZ99C9OiRy/vsqtpeOyrX4JjxxSTEutjTuXUueh0T4dMvvg57IVt8qDprO3hrCguf/e7Y5afMTGzM30or1PtTTQqhVPifxbTitF1wBmPMw6vfWRnFaBUep4lj/TPXL/4F3kJEAJWAkok+hyz8F6YBTTbx6wd9+xvddI9dFA6gkUV2nBrAx0Dq302fIkd9HEuIJMGjj8JPnI8FkMtZVxbBkKngE6X7tvexPbeVcpMsawVy9sbbP7JR6Ge0MWTAzmxlCnOwXTCsT/6CFf0LD3l2AyO3rU3kr/2TULRZyKQ9yOD4iTEPQKzELrTHjcDHwEkwj6jM4rlZdRgLYI7k1OJinHlnkXyHMk7SN6JGq70vc86uKxDnXVxxTK+sxQdGm1ib2NtodfHvuF1jHFMp2PWujlmvAXHH4ZqG1STGG2NisFULMkBXpSEpPsgrc/IbGVon2FchglJyoK+1PFKU72o1ZNL7NTCG6T9XbhElYrHiGNgBdwUyhF855vqB//2N7kyCHsbBXVgPFhh/Wduo/Nzvyx0V6GzwriOhsJaldg9PXNAfLqXNo5iRLeY9dJ7FY0SG3+emim44AlGGNMw1AGWuzGxMu/iuz1Cdxn6A+gNmHQGDIseZbdH2c0Z2R7bps/QDpjmA3x3QOj1keVV6v4qIzpMZwKChX2gW5IwXGrLRMeWfr1OLMtgDFu1x2FBd8H2YrJJkcc1ZDuI7eCzPj7vI50eUnRotKW2Nmbf5wJX7ZelFz8b388oMsWuXFGePQVbFxR4Mom6YUOitn/8I3bleXSqC4svCrpHjtL/m39TePGLhdV1GKxC0YfuMnQHsUFGp0/IupBnBGNx2i7IZtpHAJly7iufVXz6k4qP/bFyH/uY4utfU9TRg7MzN2q+xtpI9NPpelons7RRGkPAUYDOWTp6DWNyHJZCAiviOPm1zylWFJzzoGM7zKzqJSNY0dBqUEhUlQZvIh/YBHq2T+lrKqkgU7GigQioKecfeZBDV19J1q3oFlCJhz1r8MRxnNO4VK2l/byZ2AiYel26L3uZLF11HadtBz8ZcVlueeADfwinngQVC/aaJsM2hkY1hKaMDOcXPqe2b36p2KuvY2otF0zg6DvfzhPHjkNTokURmqatPEHcFnOjq1nAaQpqo3Fa4bTGaYtOfTcbWm8+EmlKLIZoXINoYtBesCowSWGZHBdD7QroAS96hjS7C2qrUbWiWyvOPnY6op42mqhjSRxnwGkbj2EJ6GAgGPB6nquCpcbEla8A51ES0G3oMqFDT2rN5zNwOb06o9MYShTWRzDaZvTVPsyYApt4YJ2+BoljdUlyi2pDTile0uuy721v5LFC0R2sIBsbuMcew3/6MwpfoSTQpRPDdUqiZz4dwhOPqYc+/0U59I73cH5rguov4Q9l8KrbhE/8iWrrt/s2binE1tVoHCGpa010RoyCDEZFwOdxLqZ1iII1HddcZGEFVAIl/ym41emAboyi0ULVxuSspjEKlRaqtCVEiCDXB9Li9OAbRCqMgp6KvtVYlcCEzqufz3ZXcKEic541ck5cmILPMFRMCfOQtwL6OTzvVtl1802cFtC5wtZTTt3+ZXjscUVH2Kw0KvQSRK9iC7peDz7/eeVe+ELJ9h/B9XezpTQHbnsVT9x3l3Dsh6rMHHVbrz20FRTjl1qrVGCdCDxCRpCCSaWoJhp8lzNbI1g9JDSnFbaIYNH6+eu01yKYNlk8sNuST1pH8HL1VdJ73q3se+EtnFcVRiqWas2jX/8snH5EUVYp+cHhROEkguqcmPznE4ONSwoOnRapzkAKVChQoRsdkuDmkYZUN0wFSXI2jZO2akWYtRyufQukY3JWhqZ2Sc/nhcYEjHhUlXomFzqySHd+Q91ZjeWW//JXqFaW2DR9zm5scvT172Crv0+2f+NfKbKaDIdpaiAjCjZCGwuGAnY6EUdVOjKCE5fWpW4PihjeNSi870MoCFLgsh5lcFzsGrjuBnhrLspJHJ9E6iICro7jZ9O/m3YRpvfJdLQvpSOrA809D1I++KAq/Zisndtk1r1K+8FqKqNxVlNajSOjqqawtiyUQcX6kXnUD6omtYOs0jwWIJZZL/C2FJWEqG/u5nDoMum89U3k1xxmy5X0sg7ZuQsc//wXYTpOEopY7WxauwjgL1xUB0XLvZvb0FnCO03VXUFddyMHrrua6tiTMj57nurMWdjaiXKr0RDOn4fxWMWxKuOmEZecqBD/HWLVDpqdWPanbGafN3Ma4yuKNEwVzIGmxKf9hdu+P8fraQ0UFbFMk3ch/ivr0tm1Tmd1FV9OKQpDMZ3CZAzlZtykxLXYQ+iQU1FdKjuDaJxo9SNC7SpqXFTWim8bc0QDePJx7KMP0NEljprtqoHti0BsKWbaTdwSfCoZ08sukytf+UqOGU1tNP1xiT59GvnaVxRlhVrSyDgynopYW08F0BX4zU12vn0Huy87QLVi2dYZ+648in35S8T98cfVzrSkMBbxbg5+DVFz2WpmJNontMRuGLEbMU4Z6qyAbhdRA8iaODB1gXhDHRbHSnA4Kq0joIP0/TQqxq+5Rg6/+12cloraTxjonKVQ8cSP7gWVY8IkgiAJiVFsOxW09IKmFUAm2DbvUKKTSlEC886dpA+Wqnm1DEe63/ZhBMKsY0Z6L53CgRL/Js58m9XZ3rSfn+0CojIolll767uk3LWO6xdsnz/NNVnBw9++Ey5chLqkn2eE2kdgV2RQTWIkzTv40ueVetnPiNm3i6pXMO73OfDyl3P67rtFHvux8qGZ31rLhLbrlUAjPrEgbbmglrlpS0hHilgQasIsjyHe94KlbFmS2Qi2v23DW/PQ7/yz/BkvFaUHQfkoB9CKqbVQFNDtgNZIqy1Qca59K1rSJt1r6rXc6eCrMVsS4v5a38/gHe+U/NorGBYGpg27ROOPn4FHnlDUDVZZSqlBgS26cU30lzny9nexbTLEaDJXoi9cYPSZzyhsFnuYZx18ZWPWO6kV2MUtWF3hiQ/+ATf9D/8jx3ygzDoM9+yFN7wRfuck5daTCfm3A9hSaLIQSk/IWWmCUiwtrTBuNJgO3fWD2Pe/n3VXSmY102qCKXIaHSUKcZwkrvEQJ3Va1vR6g6hc9Z6s16G71MP2O0i/y6afspRZloxDjh1j+tEPK4JHKWZ5HuDBNWnK2wLt7f6MjE0QndbGgkOa1sgcxrZ7USctbawvG5d1mIVB4zUPDcS/ijbiUiZc4V2i/8RBqDBNg//R99Xd/87LDX/rbzIcWpql3ZwMigPPfyHFeCznfv+3VTOaJGlhyhufkQQGlKW0OmJsAt6njjeS9JGze4zh/rg2bbTteQ5VQ9Prk191DQeOXI8NUBlDmYBc0I7CNxGeqoARKFyMmjitqAxM8thGdck5do8rTijFzvFHYJo6T4XQes7zOZp73gRtqEzO7luezYXguUr3RI8rQt7FZxnDqsZkCm2jI2tC1Lc7ZWP9QwQjjoLAaLrDvisuw66vsmUzfKdAyobOzpDynrvhK7crVCDLDKbxsTZuss04z+f+wf/KM/+X/5lHNi5QZGtMa0/dWyZY2PXMvXSvKXFVDS7Q1ZZMK3IP2jfSFSg3N5luXsRPRjTDHTbOnGF84gk4f0oxugj1JEZ1ksOfNXFNRkzY9iNL1GtqvYgKc7LkaXA9rYGiECPPSuVYMbjSIRbqUGKUkE2m7Dx6MtKFPm2uLpDDpHJUhPb4n2+65KnlhFlRXK1NWmApLK1aY57DnV9XT3z3m1Ec5Su2kx4ELxixmCaqiKbJCjadDHTO/vf9HKfWVxkv5bC5w4G64ZHf/wBUFTYE/DguaJd5XBPo2k4ExErhSw9f+qTqv+BGGe25hbKcctx6rnzDq3noe3cJT55W1WRMF0MIPmYtRioghr69oggS25SpirxQWCVslk3UjuzaAz/3c8L2eeilsFFVxIFSEkFVm5HsibFpnwogi8Uu91m+6jJ6Vx3kVB7wvRymO/S1YevE/XDsfsV4GkvYSDJviZH0OpXHmHm1NYpmBnr8LDbuiLUcIyyU2RzGCZS2tE4KY1ZZQ5U1iIcQmvnB6vKYsdSGaWeC9QyPQbRJ9U1cBCRdjVEGO/RULMEzXyz9l7yO7aVlwmTE3lxonngYvnS7IgTwQu0ns8g4VQVtq7XgoTrPyQ/9Bpf9vb/HhSxnY1ix//BhVl//erZ++wQ0O9iJj/Iu04Zhw0ys6RYTcDx06wJVFYj2dF1b0qQB2yASNadGIvQWiU4ItIydJhO1wFhKeunQLp3IRKZ5XyzX9x91qQBhjDIlzhtCPmBscnjpy+DoFRI39+LhHMA3yWNK9ECjIwPnJYaAixy9bz9LV12BPbSfnUGXZnOD9aLHro0tTn7t67H8jhJK1SRmDxx9yHrwyndIOHAltTZ0Xc1RFD/+wz+M4zgsMT521ZjQgFHRiQiQicJVCnnwuLpw78NinnUrTSdjw8G+W1/I2TvuFO5pFNUmyjfkiuh0ik3dceI8ZCFm32KgNkI1HpKt7MUH2Kin7HnJsxgNh3SmBZ3OgGlw1JmjNg7RPmpUQ0yAQCyNKCbdAaOdMZlR7FrucmbzPKonZKFhuR6zNio59rWvsfHRjykaBz6bt8pVgDgU1Qzjxk4XSTRmXHSEVUjOSpu6G3V7cZ6b9LNYViZmSpOkFTqtyTBrQxpxRgI9kta8CpB7KhsdSUkav5Atg+pGHWfm8fUw6rkfDOrHv/6/y5H/8v/BZneZoa95spNzy6tfzXS4JcM/+ZCqpztomkhypv1kmhxfWowxBCMQPFYChSPJYFS0/xI/kxeJjnE2oPEV02YMVuFdQ7E8YHPYoEVTmQyn2i46jnFh0OLoNJo8aJzSOBO1n7VN9lUqciOUdWCsfbRDRhN0PivtBnEf5ngqX9FzntJrpsEiCsadJXa/8KWMRmUk5/odIKcZajq5pXQ7seNdVhC0ifgzCMZH5ncqNf2u4cTWOXpKMUAzGE/ITl/g+LfuJHzijxVVZCXrRlGQpZhTMuJNCadPqHv/xa/Jte95D80eTTVY5dTmmHzPOmfHG1ECUPRQaCYp/h8CKK8wKGx/F+ayK9Eh9sdel8AeFFZVcvqJ+xjfexd86cuKnTGUdWofqHEhYFIDBg14H+J+136ubFiQK/1lvp7WQBES3yE1kIP11NbhlCMoMMZQjSaRUg86utlTkkcRjz+RdPC0pFGYi/xb7FhLWlhKRWPYBFRQiPepB5iL7braQzsr4iGQhLQBwWqFQyJAeMXLRK64ikmvD+MJV+1e5/TtH4MnTyglseswLrJr0aUWCFFTlfYvDDd44uMfo1jfCwcPU3Qzxt5y8Gffw6n//deBDMFRoAl4GiTqkpSF0ET1V2LPvFNIFbOinSowhy5nsNRlkAllHjd9ty6wAYJuaExgkseaZlYbVK2wFeQhQ4nFAROrOZcJuqcI1Q4reNSpk5z84G/FkIQE1nqrnJ9szakL1YKWRWahzXrV84OrZcXEJb1euCS8f0lZmyQwjEkh7STDYqGyp3Br6ccBPyt6Fj9H+0Q/bej0dlHpHqtvfgvba6tUvqbvHauTCQ99+EOpDuA0tWxMc6mgLair0IgHplO47251/lvfluym57K6/wjD0Q4HnncrW/d+X/j2HSobaPyoibk/WUooFJ2Af5jfZ9BkQZN5S4Og20xnUu0NmS9RueRe05glRtHw02q0pWsG4pnrQ/8sV97D2D7QIfgc31tC3fhc1q97Jj2bUSqLS5mzRjxdXwNCbUBUbB1pfUyY8AJ1nlNazY4KiGtge4uV/oD904pzP/g229/5hsKNwVTgXSx8b5Lo6aZb5Ko3vIHHp1P6K8sUk4qzP/gBPHYsVjoIsRZf7NMoCbnXkZD2RDlBf8CZD36Qy669jm1xMOhSdguOvOUtHH/wARCPme7gpUk8eMsAh/mYJg2g05DnFvENoazAKraZ0OlniMupasF3Mqok2xCVoms6oIMlYBh70ApWjh5m89xZhhs77Bmssn3xFDunTnDxru/x+P33wMkTsflAXWNMjhcTs1PrSQTCadrnuuA5czgXzaXFRXLkVJt+5Z7yO5ndq5d5RPASp719+fYlNKBjpCAo/dRfxG9lgWXbuAgPPqiO/87vyfq7f5b+5UcYlxMen0y57FWv4KHRpvgvflaFaieykeljDtBsB4PUAWmLgRNZ0EgkJDZBBUTJrF833tNRij6akc3oOMFtXGCX7mKDxjkfe8IHCMrT2AZFoNvo1GdZ47Sm8prGBRrjyEPDoJ7Q2dymP52yIwpCQJygREfnQulo12RxsObraDotCQSWuh0cwlg5UBmZzfFY8uVdlH7K1Hsa78i0QRubEkQ1ogx+tM3+lX1Mjj3OxsOP0jz2OPzofjh3WlGNo0HSgLI07edQntSMHrYr+Pa31ENnTwvPfzFX/8wruaK/zs7Z86wu5zGHv/Y4H+v1apPHJhW9DrXzTJsGbS1F0SeEwHQ6RSRQdArMs57HoRtvIn/Bz8jpr3yN8stfUn44BImacD/L6FzgEfzCgnuaXE9voNg6d5oYIi1q6jw27RCtKVHs2b0Wn5vlMI0GQQtoMQgqgoF2wQQ9y34TFsoEJM83osaGAujRMKGgyrqweyWKv3GxNlkVIDfoIJTOk+caVwdY6sGgz9XvegdPdpYxakB35wzh1MOMP/MFuLCB9uWsXp4xKWytQHwsd5KhyLIieq4/+JHKX3xe9i9fyxPb56lzxYFn3ASveKnw+S8qVYKjjod/7Qm1RoyCkPgLY8F3kbqL1ctoO8BLh8xCbroUuWYSKlzbZspAYwyNjSHmoB24ISrT5HkBwaNCVG4ppeiEgB02mPEOh6zih7/+f8CZDcW4ROHZnGzNzxiZY7efds0UarLwCPGnsz9rQWR7LTw3lo3Q+NAmVKpYXJm2cFD82zBDjYkDVIBrwDSxPde4weuMMQFe8ULpXbufi52GMNnmYFFw8pt3wn0PK4JmGU2NxHyLmaYykpd5an8YaqjHiuqjX+aFN72S+8+MkH7BBZtz+J3v5MTDDzDdOB/HPtlfgkWRobxHdD0/syV96hQVDC37qub351vsm1qvydyOklq6pBFNzOrCgX7JIb6IC/5jwWLIYFhQT5aQ/gpIRh1ydNcgzZRp3VAZSyOGoHTKgjZoCYjTOB0ocyHkAs7jvUdUg7E5nTwjx9KtAv2L5zn/g7s4//lPw/Q8FDXLhWKyFW/FDfoEFDe+6408aUvs8oB68yL7JxUPf/lrcOyEoqnQqSRN0DXKQ44gWvCNxCYpocJtnYPJUJ3+3Cfl2re+mTMTh+lYspuPwOteLPzxp5TJcyrXROeh3eBpTB3Maj/FZOGAE4cymj3LXcann2BPr08BQE1Z13jXYKQtX+VTQoihUZaBjhmuGycfZTkv2Dn2OOfvfxQ+/1WopuBHCtvATqCX/OnK1VGXVqUMZuY2cbYGFj0J9dOdrZ96yQITLQuv+VOet2gTWqLfpL0sqTlA1tQpCxp0MMy6DTUOzm/AHd9UFxsvB/7KL2DXV2n6mvNZhyvf+hYeDiJ84XOKZgipJacwhdCna3N2agFTUCuozGgeyUiFs4WApcClDO9lZ+lPPMZBbzThwj33c/LLX00ZwCHeRJAITE0iKJRmHudPgnalkpbOc95a+rWjOfGkYqdMka5YSaKBmV2pBMhgkgUaGxL5UXNwZZnm7JPsdjmKwI6fkuuSbtMgdaAZlizbgNUZ2kbXpdSaLaMY6Vgnl8ePc+Yb34dv3wWjaWxGXW7H5BY/l+NgHGVrE5JWpRcgU9DonMkjDyueOMUjn/gMXPdMyQ8dxBw9SLayzK61Vforq6iioPJjxqMtxsHT7/VojGZaNgx3alRu6Qz6sb97VSGlYiQF117/bK4c7ObU8opsffqTio3zhOBm/kZ0TxLoJ8QgEU8bQvHpDRSVxAKzjSIKc7XHuxorMU43dcLK4UNR6K/7MJmQKejkBdMKZktE5t9q2jzoGeGWBOA6NiZOFlEBjRIOvOFNctltL8Pt6pJnQnb+Anf89u/CPQ+ouh6DhUqHqLnCon7252VzdRdlsYKpFNeuHeD+z/wObG0r8gLvM0Z5hrhJ3GyZgWApVavyh5hBNgAKhp/4Anb31axdfhlmteDC5mn2vfI2zt71HaanNkFiodcYOvQ4H4HxrOJ+Ftu4N5JCQVWJkSl6Z4deDbrQeKVnG8uJwwWJxWhVKlORGYRA1QghCIXOKYIirx12NOHcj37ED3/v92Krprqi6HRx1fTSAyIRp386WFSzOW/rNv4Hd/gMKCamLAAJMOqgFwDhvNOCqGTL06fLfNQR+XRIgcVnfTh0QK5+w2s4l8XknyLrcuHEk0w+8bnIYPuGHUzsumPDHChqTfCasm2BlpmITk+cU1/9yMfl2ve/n9PaIyt7UL0O5jWvF//RP1KYDBmPkVSxva+6NFLhQ4Mjxc7S77yKX0P7s2ASYxjmIK+9deGSUz4WtQhzQNCOS/s37cn+f4uF1dAbxFIgOq1t77B1TT4e0XGO5aJLrS3OgAmBIjSx7A8ar2BYjVGFwdrIgkjwhOkYP2rIygp9boNHP/c5+O53VWz1Z2CnYVxCv4BhpZEK7JtfLeWeNbbFk6FZybs89r174PHjKiY92STDbXAqIu5KGcgLUFPGnTyCPudhqcB/9XZVvvC5kh88wHbtGPmGa97xdh7+/j1SHX9MzdZDOwcLazXOmcIGaJRCa4UKDdX5Dca/+zs8Wk5hHPdtrHnkYmh8cT6UjhGEy47C+jpXvPSFNKph7/VXUK6scPVLXs4dH/4j3Le/DmVDpi3BTel0MsqQQEzSec386HZNSJtNSgohg0p2c2ZSk9PVtqqerR3RMREwPdGnV76E3Fl08NKPXNq7KuhZC00tYFu20seQKUCWK4IXlHe44RZ88w512lZy5Jd/ka0ipywyznR73PRzv8j9Dgnf+LJieoHCAE0AajKrY3KRjirxps2ybVlSIZ0N8xvOgkaagFaGrHE0Tx6HH/0otahzc5AoScrSmnSVvILUoWoGHlPcfewDVhz92fDIJfIT2nnRKfGNWCbLes+pH9wDn/8M56dlGu0KdAdcD0Y19C2xmHUVJRlFD44eYf2Wmzl4zTVs2ozihpvIdx9h8KKX8cDv/4HwwI8U0sSi2YsT14YjFi5jY5dANxoDFm08YXsDvnuHqu+ynMsMGM2TiUXHGlhaFtaWod+LCQUH9sOeWBvR7Fqjd+AAvaUBY1Wgdl3F+c0Rj+xUHNizj70vfwXDnU3xn/pElFFcsrDm4ZQ8/aTiT3FU/pJdT2ugCCSLQTTQeaA5t8HyxDPtW5xrmOQZHDwgHH9YmQQyJlWFJ8NmGTTNQj252FfXQwSHs8b1kSFs38tZ2KiAoma0ts7Gyl7GfYtvRhzavz/qR8TT7RZMQxVnKRh45nPkyItexknTRXQP33juf/Ah+O49UPSFXg8ylORA6KaYTKoR19go4G81WgVABuc32bzvfrLLD9PsTKC3RHH0ML03vFImH/5txaQN52pcaq2MSpvDO/ATHGO0LbFFhpMp4eIpzn77S0zKEU2IySzax44vIYVwVQJ2BcI4BEoCDQpbdCgFyq0h4cIG3PdAbBkRwNbg6wZfTVhfXWVjayvlxLTItQ3zsNCZQM1UAS2vOCupcYm/+JRLYFF4riWGKZVojKh5UduWNVRPfam2zzL0ioxJCU3Z0M13UyvF6rvfTX3kcghd3I6nk/XYvPcYSAeWC0EPFVLHrNR2HYmOlF4LBpQDVUVgOVgTvv9dTr7pjUyWuxT71jlxfshlr3gVJ+7/kXDfvSoywLFYslEq9iamSAdQDqFAUnEKsOhgYzaji1lcJnX0iKs8lWpBLhF1txjwEqOf2EQF4CLoLmLwnIq2w8Z/zOVBTWnCRawGZQ3dekr56IOcv/8+lsqKxoUYkjMKUUIWXGTPUnFhixBCTIRS1mCVZlpXVJsX4fwFOHYyhhjGqRBeU0NmCN5HkKjX4MBRufndP89juaa7vMZ0c8qFMxeRz38dbCasLCnoEtuNJRaoZX8IsaSHSSyOyeKAac/xb9zB6vt/iWY8hWKFatBh8K73MvrNf5laSo0TcPJkLkpWLVAGDbWmVyu2Jg1aeQqjWJk4tu++VzEaQ1PE7GWGcRxrneLCOrFTOsacuw+C8jz+lc/L6i++l+qKI7jL+jxgC3b9wqu5eLAr/uMfV43KCFNNVTWzpD/VsYQdN8Ofs2UiLcs4XzgR87b7LT7mCtiF8DBPJaTD7LWfChbbFsdppSAStWZqllSSwgM6Gmab0FJwEXhaKelKzXA0he/cqY5XE7n6b/wNNrIem4MOxym44l3v49GghK98Wk3LHYQYHy7LCYVRSBCMCLX1kYxItq9d8k7qOA8GXGaptMUVGdBLoauGKI1aDMWHhagIif1Lh1PQl4berYlhB2XwGirXRLuY6cRQ6vnEhEgKiI/VKLq1w1SBMz96SLGzEwGhrtL7LBHpP4mUX8dESUXl4e57uPjVO7m4vlfWf/699G66juroGo/mE678e+/jsQ9+ULj/R4pzU6ATM7jbAVlEXUozxMQSPVOHyXJ8NQVxGBXwjniutZnW7bV9XnGSeN4pgfvunmmSvdacVxoOHpLipuew/vK3sP/K6zhPxckwYW11jd3Pfz5nv/wlpKqiXbhk8eq01sJs3T4drqc9UJyFzryOPZceP0nvWRX1YJXaChd1wLz0RfjffRSd93D1JD7fBpybzJyyNrQ5ayA++4WOTEHpZ6elN0RLWRTkV1zJZn+Vka3RPqcKNUwrBcK0TCBRLHR73PCz7+VkYyjW15hMPUZpjtz8DMb/w99nWQd6BnLlpazH2H5OHQTRBVo00iisKAgObQK60IwmFSYMmHZXuNgtaJyCTLFpM47e9lIeufsbwn0PqLokGqMUWoiAcx43jId0IM8DupxSn3kCvvBZNdw8S4wPKQgLAaiFyOSotfAmjpVrWzeV9azchwo1BT6lSIAjcG5ri36/SzWexucv7NiWgZgfUHp2kMwzKfXsOf9BjzB1/hDVugMpDKHSuPyUawEjMS0bOkYx9oZJCHDTLbL7+S/iCQxWFWRWoYxi7Wduo//Cl9BtSlYLKwqPo54VBdeiUSFmUzdaI9oRwgjjAktmjR3JOGYzervXmVQNqr9G2ckZvOmtjB56OBrNKqCCowzbqVgJtHU/EZ06zpDC6LPTBoOP9RbTiM2JxTafOd6ttCPU/umMsdCJVVSpGkB83p/J0KoAbkQlY4LpYY0lr7aYPPA9wh//idqclnExqMTo60ATfNRBiZoDosUKMUIESG3XnQoIgS4aneWMrYVyQhYUzq4gvXXW3vJ2HgO2u31kc8KevZexsnqA8r//++SqpCuNdMShnUt33VaB1tR1yWB1mfOjLVQOvUGXnfEIYztURY/zQaC7hLY9jm9tc/T5L2R0z13CHV9R85XoI86MqyRNXgTCeaeLyXKsOAZawXgaWRbXxIPepHpxDnI0BpMgfIwK1qMxrlPAiSfU1j//Z/CrvywHXvRCTtcbLF++hyvf9lqOZyLVRz6ivM2Ivc/jspAyMjJe5uRnjKbo2Rqa+1hzIEi6s7bX84yJnD1HoxZ37cJ+V/NNn3616AyqtI/j9HsNta8jQ6cMmhyok4mKa9oSWKZiZ+si3P9j9ci//z254v2/gjpwGRc3R+Tre7j2PT/P8dxJ+cVPq3LiQVt8VZKpQKlqvKljolT76VsA6zW1DjHxJggqKBpRNF5STViJjoX3s881u7dFJhni38vMTYvnmiIykSI4QvwIs0EPcZ1XRGdDhxRtYFbZoXCBrKphNEldI6YRuAawocZiEQRXga99AqwayOBcgM2xuvjvflu6f+uvMb3mAPrACqcmW1z3t3+ZB/+3fyJsbynKAF6jJMRySpJsKzn0luLn7XXA1jHxR2LB9EyivL/xLmr9RWa31n5thyoF7rF5LxK+QeDBx1R1aodTj23I4Bfej7n+cnyWs5MPOHr5VdBfhZ0hSIPIQgKfipbL0WZFPz2upz1QbEOKPuTxH/c9TP7iiwzW17loFduDLmvPeTYXbv+yNCcej63UJFafCwurZLZvW8vXbuZGsGJnR7JThnrqI6P3zOdL78qrOdftUGeGVRWY/OgETGW+AhsLdgBveIvs7DlAp1hlvD2h1+lQuylPbJWsHdjFBVcSfE3W0WwPHXmnS+MCWucgBt1REALGFGS5xrkajGLJBbAl9XgTOxjghjs04tjat5fe297F5MS/gWpz7rlalcIg6f6w9EyHYVVT+iGFeArnqYY70bjMLHcMSkIcG5XqpwUl8TUlnSjjcRrIEENfoWZleZnQOIbTClGBzlIPN5kwLqfRIPwUtBFS6KrtYeyDiZAmhbNatclTw9ezcZ+9ZgSEopgXD/fMAdVP+ftWwh6IydzioWMKMDnsXufoz7+Xc1mPRuc0VaBjO2xsXWTXwb1sN2M2/ZTHp6PIvNlu6jaTWmphqIxmnGu8dqz317h4/AmWs4qlpS5Zo6nH2yA5gnBRGS676VmMXvAC4bvfUkwn5IDgaHCENs0gtXbz2sXsSO3wuk7Z6Q4fUulkK/H+JRA1ujNPi0XgJ08dR006RAQnLUgIfzZDq4ClPvlyF59BU4/JVB3XZz3BeodqPF7p2GXIEA+aAARLWzIHiBIKH6BOB3oWWadchAKNokIaTd5oMnp0ES64HG66UeQ5z2RndRXpFKCE8+fOcZ5Ad5DTBEee5ZimgqBiSaSgKXxBJgrJHee1phx0kVyYuimDtf3UoyG+rqiDore0zHQcgJytjqX/mjcwfuS48PijCl3ifSCkQ9brdJ9WUxnLBEUVHMG7uOcRTHAorQjSzIoPRCAX0raOdUyDBgkhhRVN1O39xu8q01uXvc+4hotNxcM9zZF3vpHjDz0g3H23omwwPhDySEC10QclNi6BVA6n7RR06fyr2XoRFYglmlgo3dP+76mr5k9npC/BjemeGq0QrdM9JqdAeWplCFiMtTg3xZqI7wKwYmD73AX42p3qcdWTg+/7eYr+EhcmJUtXX83Se95KaWrhi99VNNBVFhemuK6n9BW29NG+haggzzAoFHVIHV6agKoF28mompiQQpM+cEjGRgm0CTIpEUtCPHmsxHrA7Z7yIolFlfjctjUesVRarLsoKIlQWtKR0yiN0jq+rQbvU7NpDdo37RYm0wFRNU7ruQ1QJE2zwzYO50s4cVqd/Kf/Uq7+f//3nLddRkXGxTzj2r/xX/HQP/414dHHFBKzoY0opkBFTq6WqTvrcu3f+iuc7Rkmrma1rsjvvpcnP/spVYYpuYVQtQs+tiTU4mYSzdYGazRNgKZuAIvt9HC1h/EEjj1M8+A99I6sU/c7+ExT5l3o7xadbatQX0y3ZtGpkgXaU4XmEhf5L/ul/8NP+ct8aWJ6RwGo6GWfOqXU2dOo0TaNq6jyHDl0gKXXvQ66XegNYgTQR3kY/ClehQQIgVxiF4ZubFdPrXpglmFlH7tf9krGg14UfztHtwmcu/tHsLGTHMMcVA/2HpWrbnsjmxQYW7BkDHZ0lnU1Zn/m0cMNVDnE+ApXTljudOiIYqAz+qIoGkcPRUcrcgQ/HVOPhizlhl4eMJMLXCYVvYtnyQsLSwMuiGVw3TPh+ucKa4dAMvAaLTJnE00GjcK0IVml6eQZXaujXqVpULWLB4yrEtswBT8lkwpLhdY+/rwuoU7Fb30NvkK5CdY4tncusjPdRlILw3I0iT2ZWu9zxoDNBj/+f4Edg/nBNA9nXRo1/olr4e+9mle3aHTMEp2dsDMPfx5SbINlIkBHM/IerIXbXibqmiuY5B1QlkIF+lKyWij8xTPUF86S+5pupul1stipQKDnha4XigC5CFYEK4rx1oTVtT3kywU7O2dZbUYs7Wyw5ipyUQRTsJ0VHHnnO2HQA2PJ8znOF9VA+zAVoqsYXqKKP9NNAo4xNBqMJC2TT7AiomMlAZtCijkRX6qW4AjE/+m2i04EqW4GTf5jLw2jEu80EmLtn8zkqMR467ohl0Ae0hqs3awFoWkc1DVt+SMmJaaqKcSRi8PUNaoqCVLRMCW284rgtsEzIYOVJY6++x2wbz3qDydDloA1A3t0YDk09L2jKwHrwSqNNQYlmjwoCtFkCnTj6amcos4Y0KO6MOTgYJndKPaUFcujIVk9ptcv8Eqz5+jldJ//Isi6c+AA88LqGZDqqwYbQ3PG5rFIvIsdlFxo4n4J0VT5OCw0BGpiGSnRIU6mBPomoBsHo5KTH/wIxbkNCh+g2+WkNVz/y78cSxLRQ2NhunC4qBhGbtlkiA1xKtXuyYWe0MCs/FPag/KUDdq2G/w/vdTc7/PtWkkaPEm0k9eQFYkgUAqfCjo5H5nQSuZFLpqqIfMugouvf02d+vAH2Tcdsrra5fGzxxkf3Mvhn/sFuPVFQmdZXKeX3qch6AZNiAZKYiJZDHSrBQMUjUmedzBZhrV5rKkYhJjkJ2nTemJXGcGQws2zVNw4mopYLWPe81nNgGCrUSY5y5ck7ypFULFxgldJq6wNUe8YZgnb6Kh8qAIxK3gxDB4A53F+BGGE9hO4cE498ru/z+5xReY1F4Y1G91VDv/yX4OVZSgyBIUl3pMl4FJ70+5Vl6Ouu5r+C24lf9bNdG65GZaWwNro0ykDyqC0ib3IJepR64WHD2Eu5yTgyjJJQBRMt1W1eYblwqQIgksRvCVC2TArNN+W7ZHkYJp0Hvyfr8K/NNfTnFHUGIoo5lc1FBbqbR758AfUVS+8QfKiR+U81WCV7Hm3wsVzwldvVzQR3Hg/P+baDWclrqOWP4tBFketukxNHsHC+jL2bW+QwS23cDwD6pJVLL0LFzn91a9B5RioDiNx0Fvh6FvfjctXKXoDat/QUyWjcw9RT3fojDWdkApNJ60NgPFmBuBIxWy9DrEocDrgRTu26xKjLINiFVU51p73LM6JQWyHSb6bm37uV7nvrv8J6LPMhLKeUHRzRtM6VoXIND4I2hp0liNUVFUFODIbyR3f0rZtkWqBugm0BXfjRgwzpnF2BEjs4NAeFLPShqIxpY8hWECsSXor8N4TQkAphTFqDgRSyKA9QIJEOJcUpVGv91MRo4duJxqFVLU/OAhWcwnKDNEMqUsCH60RtbHzxt69cvXb38TjBLKsS5gO6U/Psfnwj+nXsG9pGSknVHWJGI2TQKYNNkDuI4OQozFGo63GK4MJNrbcG9RUW+fAF6x01zhlB+y76dlsmpztakR22WHMz71P/L/8DVU2kwjaJOL/WAvQQUcQNYktJVyFljoCRZ0EcCbRVkBmFb4Js6htW2ZzQXkXCfUUvU3NcmbzX3Ri7ek/k6UVBb5DLwywrkst4L0gXoHOkFzFrF6IWbg60BbVDW0bjeQ9KOYHCfj4VcV9JR0op0JReKoyroG661l6wwsk2zsgVGP6maUuRwy2L1IdO0nReDqZotMWqwM8htpYdDB0G4uSQLDxMDK+IBNDUIElGpwak6mGXBk2jMZecYTe2mVUm1Osybjhtpfzgx9+X3j0AYWbxtFub6JfgIA3irrx0FkilGMK0wWfykTZOCd1Kw8TUptLTVugP44xEXgGj/I+/uGZs+rE526Xq37pF3m01ogZUA08t7z3/dz9D/4xjVd0afCujjUNF/DQrHRSMpjexfewxqQqVx6MjoXRUzTCe5dOKg/WoAM4vxChSNcliWytzVAWH1xcu4okn/GQa+qJw3uJYMikCIarZ/ed2VgepZYWxglKpsg4wHe/qY5vnZEjf/e/Y9hRlCPPuFjh6vf9Co8c+QbDsqZjCwweW3kaL/H1fYPF4nHxQ7ZJSUWOKgpK5/BGI+LTvvRp5cTP5Ig1I4t08jjiMLS+++L+04AxWQzZagVFDlU9A8ahdthUgCtIDEWXvqGbZziJpWoybUBlMSvc5nji3zdAlmuaOhb87qSlMmkn2QKhQie2m7vvUjvfvFGWnnMLnX0HGTpD/8olOm94vZR//IdqVJdkEugAiooxGbiLakdPZUdrrFFUmWHPVVfCzc+O7PV4DN6hELQCL21qU5xSl6I7sbZ4oGNyau+TAEExbWpY6aN391KTphjCXjEFp85v8JPC14U9sSiteRqgxac5UIxifGstPoxTGRMD22d49E/+mH3veBfniiVGVcOuyw6z/21v58xyX/j0pxSbW7EDSKggNDjnZ0DGB2ZZey7TYLpUTkFu4cqrZen1r2HlOTczXFomKEcnVxwsp9z/+S/AxXMKVzMlgO3CM26QzrNvYdhfRkQoXMXw9EOM//U/YbyzoTanJp5mmhRKg0uSHgK03nTLCs2yOXSIIbYgnK40dPtsn3i1HPmFX+L4sGZsu0z2HqJ453uk+uDvqXIaQ73VtI57I7XqmzZ1LPthFHXtUFaBioBKwTzTeFE4kkIlPqQDfDHsS8t2pX+kzRhfQidPuIV4IYKYpkFLoJNbupmlrh1NXf1kKDlZ0fYgfAoJ+acskiqGYKwGMXgCQdqbiy+oZuoYnW4ldTYJCkwBnYLl9/88G90O3aU1Rk88yf6lHmc+8zH4wbcYntlWwyZEy68kOi3iE6PQxgHTDag47tGbXhIoFd0tyDyPTxrwGRy5QfL3ZzQHj2DWlrhQb7Hnludy/tYXSnPn1xXKzVmAGSvq8I1LXQqgsEUEjd1BbDNnFfhJBPqqSPKAmN5SeUeTsjFnMFnpyGDo9JM2Lb3xJNLmz2ZjBfCaatKQDwy6M8C4kljUXtM0rSjrJ+d4pnJLYxqfFWbLsGWDfQtmLFTBRUevMHDlfjnwxp/hYqHoDDrsbF9gaTTh9D/7V3D8tNpQCqoR86bfyYHQmnnCSEht0DQ03RiWVEQqVk2JiUpAL4dXv0IG73wnPTvg1MYFioOHOfDe93D6H/8j6PZw0x16/ZxJE2BaxR68PtDLC+oQUMoQQgQrSmWAj9RLOzweUgXWdvbiOBUQJjFHocgzJgCjMfzwR0xveYD8+uvQu5Y5L9tke/ez+81vlguf+Lia1mPMQnD5JzDcTCsXf+lCBIgAWIM1Ov0zsrAzfbSKbOhT18GfFhWog5sDY6PivtUCwZF1Miq/IKNpbZSK7FJTe7TSeIkOkVWBTAKNb5BzE5ChOv6vf00O/+pfZcN0aLIBm2sDile9hmz3CiM/grqhqyyZjYWqCQ1WKWqZUhNS4o8GXzMeD1G99bT2VNz7WQZ5gaOiTbrxopk0qSxb0t6KeFwIuJbhw87ZZp32YCDKX7SCspzV6FXEcmRiMpRSeO/x4slthm/CTGI0S9xLc9dUYeabtB1yjERZSju3QhNLv0nN+U9+huc/50WcKTOGknHRZlzx6tfy4x/cKZTH1NZkQo9oZpAJaMvZH9/L3he/hHOTMfnSKqXtcvDn3s+pJzeF5pQiK5FmGp0BlYF4RELsfkbcZia31HVgFFyMRJk8Jq92NTzrRrnmlS/nVFNhyeih2HjoYdi4oJSNVry9j/lZ0Y7J0+d6WgPFWBTZkVmZ17NRHsIQPvEZJbuOyoFX3sbFwrJdNej+gN1vewvmRc+Ts5++HW7/iqJO5QGsIOLjgiWW1yFLOyrLYO86PO9FcvhVryXs38dJ71FOyOoJ62XJ6Hv3wle+oqCC1S5+WMPaKgf+6i9y9uAaW9sTdhnLwULzg9s/AxvnYu/NOjBLzVoojRGLqC0cki1QhAQWk3VtYgiXuo49Mb/zHYqX3sbuw9ewqXOO1RWXve42jv/4+1J//9uKSpMTostmLQw6NLnGW50O1YauUpDnMwbBSIz6taFgFWIbZ00cdpc+VgsOn1paZfFyEsGiT2ocbS0+pRFabchQ6ODRTSCb1cGBp0KSFh+1rf1++hUSE6FRIdB24SBEL1YyS1v4y6RBbjmAVq1n8yUcGl70Auk+80Z2jIbxmIP9PsXpU3DHVxWbp1OMK0sDJSm27VPYh0vjHG3hQ8lSQccJ1DuRjm1v7IlH1MVvfE2u/aX/gpMuUHVW0J0Bu179ejbu+xGU46gH1SYyHU0DrqBQfQxLhKak8TpmPGfLRPpYovNCiAxqrudMrfcE1XYtSMBIFNhOvIcmhXEmEwgluop9VNtao/9RlwJ6GZ4G35T4IPhpGT9fnqMmE7SkAHkgLjzfFsSPCkuBCMhRKUwZB7lt24ukaJ8i7qfuCuQZ+p3v5OL+vQzpUg93ONTt8eRnvwjHnlSMpmjlCX4MnRDZqkUwMov5JbvjgSYHX4CyiTpP2jClIdRw+5dV9oIXi7nyGurD+7m/LDlw43WY19wm/tOfUqItflyj0EheQOVYBjbqmPFq8iyy4CJ4EZTK4516tzCYCyy5AnzATOOUAkyb5Cx54ImT6vQnvyA3XX8LT1aOatcy53LNnte9nAvf/6ZwxikfDLhJGt/EZLKw2TXRRtYJ3DiJgLBu8FWJzgtA46syOi+ElO0QbZeysZzMT5iJBQfT6thhxPmoXTU6oKxCmpLgGky3k+inQDck3a5ShDyKLCPgiPvN4VFtEccQYOMC3Pl1dSI0cvlf/9uclVgbN1s/QKkCsWqBUDYNodFR5ylQyZQmC5eMM8bQ0YaBtbi2febyrigvEEClKhZtyaqC+FW3oVGX9qhfcCgV5J1YYstVERw1DVRTjMBAF4yDQxmLhBp8oNCWTBl87dGNp5sVifVgDqQN5PTwNCgkFc0xc1mP9/Gz6OhoWKOo6grOnFGP3P4NOXDbG7B5hts14PSeg/C2d8Ov/zYSthjX21gDygekLpl84EPq6qPXSvfoFTy+ucPY9th9+TWs/p3/ka3v3Sl89sOKcYjOcVustWmSOEFwQfC1jussVzDoRGOwZ49w2yu48i1v59FKwBaoac0uURy76zvgR+CGszo4gVQsHwMiqdTZfFj+sl9Pa6AYL09ZVRgTbbRrIxqTknOf+CwHdu2jf8VRwp4VRoXmQvAM9uzmqre/i94rXitP/uh+JmdOUz72eOxOkNp7sb4mrC3BZQc58OxnM7j8CkZZwU4xoDI5uujQw7FeD+mfOsX9H/gtxXgYZ6Qew/59cOutMtmzwrYJ2L5hyXlOfedb8I1vKlSAcTqAZgIUH0NEAhl6gcALeJ8OvPa22186gRCwJuCUhhPH1MO/+3ty5L/6O1wwBRQZGz3LoXe/mScf/AFkferRMIKLEGA6JQQwGIwyFFkPpQqYhqQjSsxE8oSjNmYeIlcJUs0IxcWDioVfpMc8qNuGpWpSajg4R6hKRGUUYlnKO7SdTNp+0H/qtcBuqDSkSbAEKSPPABIEG6Jey7eM5WxQ568vSgCDaxzsPcCht72NrU6BUgq1scMe3eXu3/n3sahv2dBtoI9Q43DAtJm3ZbvkPdLniykoFvExdqibVKzWENtMjrfgi59VGzc/S+yVV2N372anbli/9lo2Xvta4eOfVuiQ6r4poABnsD4nC3mM0OqC/b/4K3DhvBivyI3G+RKPYE0HQeNUXO558IhyTDOfOgLFUHk5dSzlHWzdsDKp+NGffAIef0yBpqs0jUwvGbf/y5f26EKhrIqt0oyGqoGynKkaTJpGFLNSVrOxTYxBKwGLmtdUvgniudtSYFknsha3vkiOvOhlHGsmUBhMgOaRk/AnX1BMGzq+xjBF8Ewames027ecT+BMWpb7Gqip2zJPPv6BBZx0YNTw5O/8AYf/3t9hFBTiLdt5wVWvehUPffsbhJGF7W0KJGp4e11oSrSK2ai1OLzVYFKFzyaFPhcL1ymYt6KM2yULbeGFjKFvoo2xGVQVcs9d6vjXvirZC27F712mHOQM+nvhTa+F3/sQlM0CbbyoaF34po2ZKpVo3ADWUChFz8ZTulCKtkRWfE4cOPHzMEVraS6xb5L0hu0TJFCgsLXD48mDEEIMNxKgj2EKlG2DBK0WvBiJiSHEaiyiE8beKeHbd6pjtidX//W/w/FQ47XDlSWmU5AVGcW0xHofQZ21hHphYdZER8KV6AzqeoLvZPjMMLjhBpb+9n8rXV/H6kUGfAouGwEdVCxhpQJBeVA1RlL2scQqDaO6Js+jxmDgapbHQ374kY+ocP4iVajwGFwb+hGX2DKHRZNnKjopEplEbUy7LBMPmSGxZxf1zBFgvtAlLjMjPo6j82x8+tPsuuYm9tz8LM4aYaty7H/hyznzg0eE27+gyDu4uowJpmUJo5J7fuuDPOtv/W3Wuj2aQZ/zlWfl6OUc2LPO0ktultETD3P2seP4U2fgzAU4d0H5soplu/IMLr9MGPSgZzFXX87uqy6nu2cdtb7OY8MJerBGxwtLwdMcOwaf/7TClWQqtohFpfkObVH6+a55uhCLT3ug2BZ69Tru16KJxnEsDjlxXJ3+J/+S1Xe8WXa/5WcwqwXbkyle5UxWV5gurWIOXMaSCOs+kImSHIVRgguBWgWcUQwJjHs9grXUVcBgWA05g+0dTn72s/hP/XHUW7g6ekVFAUuZ3PS+d/GENeQqoHSJ27nImQ9/GHYqim7KcpwZXFI2tp1Fk2Y9US+539kviapkhahYOkGpFFK+5wdq/KN75MCtt3JOOUocK1cegre+XvjDjylsSmnsrILXrNolJrVGNYHCdBAXe8/khaauhsmAJzGOFnyACQqDR2iY9VrWC5+ttTphodJQ+4P5r9Amo7YKlKLQig6GIiiCc7EvctsA9idiX8w84J/GaM3AolJYa+kAupyCWPqAt5YLaAgt0BVmpZFasZQGlGX3C18k3T372Mlz1LjhSK/H1te/Dffeo1TI6DeKLkLsl6Bxi0Y3gdxF3DxXQUYGBKBI9Xe9BUpQTYPoKRe+8gVuueIoW+MJ55op477m6je9kUe+9M2YlVNVFDbDGwX5AN0opATlMqa5UFx2GbJ3DVE5YgyxnaOLels02sfElUY8XjumeWyPhyi0aLq2h69qloJmdTyBL98BWYfGKcYy+bMZWiUQaqRjCXgkBLp5F2sLHJas0yWUZfIBdBrHGLb0CRC2kz1LfGq1iWlxdDuWae1jH+diAL0BV7/prZwc+8j41A1XFss8/AcfgC2h3wiWOibrtEBwEcG0E9mKO9NHqBM+jGxsSABS49EoZxBTwAPH1Ynv3SXrt72SYd7HNQ3TA/tYed97Zftf/WsVOj1MWZJZRWMF0RVK12Az3KTEWwdZwK52CMMKG/SMnY5l19sweXSuYmJSKhjtiCDZ6BgSTyrs7a99jhufdxNTZykzy6lyypHbXsrxz39WOFfGnqGzNmg6DUfcN4v7UrcsmlJQN4RxiRQlAGGcGMXUI1mr2Nd5Uc8yW0eLjqaA0QZNIO93GPlA1wt6NKLbNfSCj3pqiXUDO2l1KEJMqFOANujYqmY2XS7M38M48Dsl3PEd9Yj7DTn8S3+FoWSMQo0tNXprQt9XSOrRHnlJ2kTdOMjagHFIRxjLhNosseMCS0cPo/fsoSYwtZbKxKxsUcTksaApnI2gytRIAovtoIpSWJNFFnQyoq8C+8sJfPDfI1mg9iBGQ5FFFqHI8KGCeoxSOdpoKj8BU4Np8JmadVNsXNv+NLUCXNzJC52cAHwDfTGUTcAPh+qRr39B9t+wj4YcBktc3Nzmhre8nR9/85tQQ+4USmq6WcFoZwoPHlM//K0PyrU/+262iw4jAel0OKc8/vAVlCur2OtupmMMubGIiFij6OQFw+GQoijQWjOdTjHG0F1eBeD85gb71/exfe4chwbLnLn3Lob/+jcU9QikItexm5WktdR+XUwA0vwZIiL/f3Q97YFi9G41uGh8jIkdkyJ8bJDxBlsf+ZDaeuxOsa97BVc942aczdgeV0xEI4MBTilEBKMUmtihSLfeqhZ8aLAabFOyXDkGTeDsj7/Hxuc/C4/epyiT4RUfjXGWs+9t72AsoBqH2d5kf2459q074MwplYsgQ09mEjAgJq5Y3xaNTYWQtUJ0QJSaycMUpFqC8ZAIoiLTpwPSgLEOX465+LGPcP3Rw4TVNZpMU04bXvymt/HNb35PeOJ4PDn+f+3d669c11nH8e9ae+/ZM3OOj+Nb7FzAqZukTWjSpDVEVdO0QFGriiKhokq86gvEf8I/AK8RbwAh2nARCFGoSio1aQRtCSU25Fo3Ns7Fji/nNvu+Fi+etWfmnEQI+o7m95GseOJz9uzr2s+6PWtvB+ZHKNoF07ZmXkyZEqmaGkJH3eyn1kNYNQcE+64wZkUMB1sPD7UkrncrrYeI43u36632jMuITUMZIkcmE/rYk3U21i6PKWheb5088DVrQcOyBTTFmH1Pv1iQdz0bswznMmZ9YL9qLNdjGAuL1E241tuPzzj6+MfjY5/9HBcXPd5PKLuB9t1rvPHXT1v3b18RiayygGW2TKIDoiPzkKWVUYKzgeGRuOwOHBdhWLbSpKCkANqmgh/8s3vz/gfivZ//PG2ZURPw0yl3/8aX45t/9nVHU9H0e2ka4w750HAst06WutqlnQTiLMe7iY1Dis5SPEVH9Bl5amWIoWfwnq4IDB5czHHB0ZIztDUFgf2Q5tZmPSF2dH231rL3U4gB+o6i2mca7KpNuhY/WMtI11tQOIYS41zZsLzO9rflknCrC8c44Liq0zjHfoC84/Svfykeu+tO3ukd0y5jq+u5/Mx34F9fcHlXAbsEGlrsUc7TOIro8uXtHV2wKlyEPGQ23GIyrGoA9ojgvcNnpU38qivwc/jGXzE79wDzM/excI69EHjwU5/h+9/6TuxevOACVt4QImUWKZqKrdkcIkxqyyrQ7+9ZLBg9k5QduyNiM9I5dCYmdKnC6ZwnBhuHajFCDZdeca//0z/Gu37zy4QQgIIQIx/+6ld5/Q9+Hwhry6KH1CLG6jn00cbHDcGCx9zmRc+zDOabAMy3b+HxVp72NjjAZd5a+Naf5fcZqhLTeMZ6d4D5BnndsjXfpHSectGxVc64nuUMdOzSWCXNRTvGaPdYxOGdS6lkrKI7PucZUARPvb0Pzz3rrrghnvva18hjxh0nTjJ0njPzLYo6zZ92ATLPJGa0TbrmhQXwDBVHZ0eYlQVN05C5nJh7epfT5AWdt9ZERyC4Hpuj4hmiY8jyVNmZ4MYWUTzBe2Lfg8vYx9GMQ02ctxfBEKCyBR7IaoquZcM5qz9UexydF/zXxEHVE9p2bdHusQxeb5mPy3M23sd56Rl6y26QxYFhqOCHz7lb//5gvO/TT7JXtzR1x/zUUWZf+kKsvv4N1/UWuMe2ZkJBu30L/uV598qVS5Ev/CqPfOmLvPPuG0ync+pFoM2nMNsgllP2PbRdSpHlHOV9Z9m+cROH4+jJo3S7e1y/vs1GUXI6P0J5/TZHbt7m1T/9E3jh+456z1pRg93zaTQvayMQUronDhz9z7oPeKDowRcQcsrQ09OxmKTpUn1kVji6dp++r+CFH7j+P3/Eyx9+OJ741Oe492OfIj95inf2d2kKR505aiJNiHgcG1nBRu4pGeh2b1HuNszbincvXOAn330OXv2xo25tPIcbVrOCB8ddDzwazz/0CV6rIsePZuTdwJ2X3+bS03/p6PaIWcQNqTsNAGtaHHNoBaBlHIi76loD+0frfhubNDylK4muoYmWFoOsh0uvuZ1nvxfPPvVZbnQ9R6dTws42D3/21/iPP/4j5tMNFotdmAwMty8zaT7EqflJQlORZwtuTttUOI6V+25V8xqbB8c351hVT8HseqwV4GDOwvVAMn3Mywl9UVgXYFUTCmstmaTWuJzVAz0Gi365fbfah7RBH1e7GPC4fsC1HTOsm9EtarLKlqnJx/M6tgaNXW2p1eHBT/8S/dac6eAZ9jqmceDqxRfhrZ+4jJahjOxnU7o2Qt/RERjL+awoLUDABogPY6uTg2rsSR/Gc5RbxNhF8hzcBBuPVC24/u1vujsf+0jcuOcMM3LaGzc4f/6T/N1zz8Th8k3HYh8KmExrXPMuZTNjg5Ldeoc+7lMUOX4Y8J3NbgxEmugYsozgM4oQmA4DLgbqwlY5yYccHx19X3FkNmWWB9ziNrga2IW8YTKx5YIPRWn/eyGQFTnHb9zEH4ViOqPcu810aGgnA3S15RJP1yPE1djDIT0reboxBjwxrlLNjMutOReZTAoaB+6uE5x/4lEu37rG/cfvpbp6nZNdxeVnvg1+Qc8tet8c7JcK4KJLIapfW3nPWmRySqswZXvpBWzx2jRAYKAODfiM/Nicvu3g2g239xd/Gx/+ra+wd/w4V/c7uvmUL37lt/nmq7+HDzlDuw+5Jx86tqqKI66mbAKb12/adPPdPQAmkwJaa8+PY/DH6npYZ7gNIfFFSexsZZm8sGcyth34PZpvfcsdP/9ELI6dwM82GW7c5hP3P8SVe8/G9qUX3YTVy3ZcLWkc62U38Cp5cZZZhaTfr1nc3rb9XFSUwJBNGPoqDesLjON3IxwMcNf+Pi1Khq6x4QcbG3TbO2xMN8nqjlnT0159x34hd2z3aaJLERnXonapBja4aCuxxgLnPH20sYFt7Cmix9ETqx248IL78R/uxPO/87u8dfk682KD2GS01962Mb1ZgFBAHdkg0g+BZlLCdE54d5utrKCNnqxpmSwqcnslMM8LBucphpC6l7uU27Ug4m18sAuWNic4spATYmFjB71jOtmkrHZgr4ONY7BT4fqBI5MZTbsgBxbFBscaKJsel3uK/QXVO2+nlvue5RJMnjTtydFbq0jq0VpmZV2mXOqrgPeeOnhiZp3U1Ds0332Ge87cyY4/yuyOY9y+doVPPvEoz/7D35PdbInDwBB7Ah2zrQ2qZg/eet3x9DVe/Js/Z/MzT8SPPfUr7M9OUhcbDJmjcgtqZ2nrYpHjipzmzbe4oywp+h6/d51jRcmRzU12r7/L7us/5o3nn6P/4fOWIa/esZdj06ZRIR6fMjIOqUfCJpr11uNwuKfqZ9j71ME+SHIbbN9H5lh+tK4IMC1hv8OFkAawBptEPJkAhSXA3jwZOXUaHrmf4sQW5cnjuI05bYj0/UDRB8oY2X7tVWj24dIrcOl1R9vYGKqmZ47HT2bsNRX4QDYvGRbAHafg/gcsGVbhrAv17WuOt9+0G7lakEdL2NqlCSq2HBm4NIqiJbJcnmotEBsDxfH4MwoCvQVyjlW6BmaweQzOnotsbkFd2wbafXj5oqOuLN/VBDh3X+TUz9lEh71tG+vyoxdc2a0CV2CVw+ywtf1bb9ZPr5FV1Hb4d9MP+ElhgfDpu+Ejj0Sb4BOhreDfnndl3yy3NaRtZDEn4FbdbWszr8elvyKQlzNbk/fTT6XtBihyePWi480rTNLYq2VexbHwCEBR4B4/H2MfYfOUTYypd+DqZcfVqxRDlwa1e8ZZMHYsaf9jSEG91W7jOAli7dgnztEGt2yJpm1x2HhB72DiSmrv4dw9cM/d0RbldrDo4a0rjhtXVv3ZW3N4+BcjNVBuwVCDq2z5yS5NOnBpAovDJjORWhH6FLWO+7dcahCbAFHtgO/hyiXH9vXVoMD1btn/qzyHcoZ/9PEYhtSFttiFa286brxlfV7jxNv0Z5K+a5w3u9zdlMXNjV1p3o4n956+72182V2n4a4zkXIDwhTqHvZ34Q17rrO8s5ZlD66EuCC9QC1fqwWKHk+gI+DJKShs1YxiL41Vg0lvLRkRWJDjNmbEriKlUYCihI89ZDWC46fg5g183xBeSusC+8FmSp8+A6c/FKnTg93VcPF7jr63ydeDrcYC0Lhw8N4aH9q8tJY+V0DfkTHgXaBLz5HLPZESzj0YOXHGJmMd3YJXXyLva9dfvWRBHmOgmC8DPAsUe/LML/tzexxM5/DkL9vzBhZgPfuMo16Qjxcy9/RDeG+X/vj3VGHLw+pc1nkJn3wyUsxs4l4ecdvXiS+/7PDeKlZj+ddai+I0t+J61e1oSe8jY8J2mxRVOGizYIHmtICPfjRSTCBkkJW4tiNeuGBrHA+Bsg1s4FlQUWcTm3Ty8ccik9xmrc9mVgaENGjep4szrvfs0vhPX6QAf60rP3gsXVdhrYcx7dP2TbvHLr7oqCpmzhNCT8bAFMdN5+ChX4hsHbPhT20Di9vw8kXnwoBvAyG3YsweIG/jkV1Yvlfy1alfTuoLOJzPrQU4S5O1cuDsfZHZcZhNrct8sQuvXXGuqol9w2Riv9P1nT1/pPIkcxbMFyWcOhe5++cpz55l684TZJsb9HlOT6ANA33bcerECapbt7n5kzdstZW334E3rjgWVapM74DrmG+VLHZtwYd5OaOtOzIsELekSQF8ZzW58Tn5gASLH/BAcWyiYTlIdZxQOhaUy/9vH1Kzfcot5f0qEPNpe4e6TolhWSDaxIpo/x0OjjtbfUgv4jxPud/SD3Qpl120t+uyO2cssKNnfddtm8uDOLBPq4t+sO1uuR8OLL2CSw+2X/1+6O0NM1gaFAtevKWA8elBHizB9uG5I++p+cf3fn6/WPB/vEuXrZLexg3kEzt/ETtfXUUWVvkuV++VtXGA6zu61lK5/JjlVihl69ttYVilTHj/ADjtU5bb/QKAnTu6DhfD6n4b75cD98F6tx1r14YD19J+xHNgpZGxW5X0cp5kKf1IGh82YNdyPdVIhgX7PmOZvsWlQHrc0XHz48t+3J/AaodSt/nB40kvuDCke+jg+f6pOJ/GzI3daTAOxrfvee8NeKhBeu3zeCFWndN23Gs/6NP1TF2Adq8HO64hPePrj9SBl4id+9X3BSzVk5UwcXzxH6qoDGOZMl7oMWFy4dN9lRIF993qmFP3ppVPBdZ6h/370Bw4L6tAee1krJ+g8fuXz0UqDw8EZrlNNhmDwIgF6elaZ6zXB9ZPEKzfp8uvHZ+3ZXA0QNcsy5wDu3fYoedwvYdi8N5mEfu0RyHaWMQ4rPUhHiwL1g59ufm49t4Yf8du+VSR8t5yvIxrxY/3SVpFhRAOTKoaGMuJdE3Xvn/1DK0deWStbE/7sX6vjhU0l15My4MI1oMVehiG1Wsr7X+Pt8kfWQr3QkzdsHZfubgKmN9T7sW11+DamVydu3E/mzQ5ygAAAXFJREFU1//49B4dT2yPVWTHGuTaSR+3MZ4Pj51nV6zuk/XtHjply3JxLKciqRzsU3dbOHgOIT2f/tBxBN7vfSEiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIv///Tee3L0AUEvDggAAAABJRU5ErkJggg==" 
              style={{ height: 48, width: "auto", maxWidth: 240, objectFit: "contain" }}
              alt="Leftfield Capital Partners"
            />
            <div className="ml-auto">
              <div style={{ color: "#4A6580", fontSize: 10, letterSpacing: 0.5 }}>Loan Pricing Tool</div>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            {["construction", "term"].map(t => (
              <button key={t} onClick={() => handleLoanTypeChange(t)}
                style={{ padding: "7px 18px", border: "none", cursor: "pointer", borderRadius: 20, fontWeight: 600, fontSize: 12, transition: "all 0.2s", background: loanType === t ? BRAND : "#1A2D42", color: loanType === t ? NAVY : "#5E7A90" }}>
                {t === "construction" ? "Construction Loan" : "Term Loan"}
              </button>
            ))}
          </div>

          <div className="flex" style={{ borderBottom: "1px solid #1A2D42" }}>
            {tabs.map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ flex: 1, padding: "10px 2px", border: "none", background: "transparent", cursor: "pointer", fontWeight: tab === t ? 700 : 500, fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase", color: tab === t ? BRAND : "#4A6580", borderBottom: tab === t ? `2px solid ${BRAND}` : "2px solid transparent", transition: "all 0.15s", whiteSpace: "nowrap" }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 pb-12">

        {/* ══════════ INPUTS TAB ══════════ */}
        {tab === "inputs" && (
          <div className="space-y-4">

            {/* Project Details */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <SectionTitle>Project Details</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Land Value / Purchase Price">
                  <NumInput value={landValue} onChange={setLandValue} />
                </Field>
                {isConstruction ? (
                  <Field label="GRV VALUE (NET)">
                    <NumInput value={grv} onChange={setGrv} />
                  </Field>
                ) : null}
                <Field label="LVR (%)">
                  <NumInput
                    value={isConstruction ? targetLVR : termLVR}
                    onChange={isConstruction ? setTargetLVR : setTermLVR}
                    prefix="%"
                    placeholder="65.00"
                  />
                </Field>
                <Field label="Facility Limit">
                  <div className="w-full rounded-lg px-3 py-2 text-sm font-bold border-2 flex items-center"
                    style={{ borderColor: BRAND, background: BRAND_LIGHT, color: BRAND_DARK, minHeight: 38 }}>
                    {c.facility > 0
                      ? fmt(c.facility)
                      : <span style={{ color: "#9CA3AF", fontWeight: 400 }}>
                          {isConstruction ? "Enter GRV + LVR" : "Enter Land Value + LVR"}
                        </span>}
                  </div>
                </Field>
              </div>
              {c.facility > 0 && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div style={{ background: "#F9FAFB", borderRadius: 8, padding: "8px 12px" }}>
                    <div className="text-xs text-gray-400 mb-0.5">{isConstruction ? "Gross LVR" : "LVR"}</div>
                    <div className="text-sm font-bold" style={{ color: BRAND_DARK }}>{fmtPct(isConstruction ? c.lvr : c.lvr)}</div>
                  </div>
                  <div style={{ background: "#F9FAFB", borderRadius: 8, padding: "8px 12px" }}>
                    <div className="text-xs text-gray-400 mb-0.5">{isConstruction ? "Cash Advance" : "Net Cashout"}</div>
                    <div className="text-sm font-bold" style={{ color: BRAND_DARK }}>{fmt(c.cashAdvance)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Loan Pricing */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <SectionTitle>Loan Pricing</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Interest Rate (% p.a.)">
                  <NumInput value={interestRate} onChange={setInterestRate} prefix="%" placeholder="9.25" />
                </Field>
                {isConstruction && (
                  <Field label="Line Fee (% p.a.)">
                    <NumInput value={lineFeeRate} onChange={setLineFeeRate} prefix="%" placeholder="1.95" />
                  </Field>
                )}
                <Field label="App Fee (% + GST)">
                  <NumInput value={appFeePct} onChange={setAppFeePct} prefix="%" placeholder="1.75" />
                </Field>
                <Field label="Broker Fee (% + GST)">
                  <NumInput value={brokerFeePct} onChange={setBrokerFeePct} prefix="%" placeholder="0.00" />
                </Field>
              </div>

              {/* Fee GST preview */}
              {(parseFloat(appFeePct) > 0 || parseFloat(brokerFeePct) > 0) && c.facility > 0 && (
                <div className="mt-3 rounded-xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
                  <div className="px-3 py-2" style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Fee Breakdown (ex/inc GST)</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {parseFloat(appFeePct) > 0 && (
                      <div className="px-3 py-2 flex justify-between text-xs">
                        <span className="text-gray-500">Application Fee ({appFeePct}% + GST)</span>
                        <span className="text-gray-700 font-semibold">{fmt(c.appFeeExGST)} + {fmt(c.appFeeGST)} GST = <span style={{ color: BRAND_DARK }}>{fmt(c.appFeeIncGST)}</span></span>
                      </div>
                    )}
                    {parseFloat(brokerFeePct) > 0 && (
                      <div className="px-3 py-2 flex justify-between text-xs">
                        <span className="text-gray-500">Broker Fee ({brokerFeePct}% + GST)</span>
                        <span className="text-gray-700 font-semibold">{fmt(c.brokerFeeExGST)} + {fmt(c.brokerFeeGST)} GST = <span style={{ color: BRAND_DARK }}>{fmt(c.brokerFeeIncGST)}</span></span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Term Structure */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <SectionTitle>Term Structure</SectionTitle>
              {isConstruction ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Facility Term">
                      <Sel value={facilityTerm} onChange={setFacilityTerm} options={MONTH_OPTS} />
                    </Field>
                    <Field label="Construction Period">
                      <Sel value={constructionPeriod} onChange={(v) => {
                        // Don't allow construction period >= facility term
                        const facN = parseInt(facilityTerm);
                        setConstructionPeriod(Math.min(parseInt(v), facN - 1) + "");
                      }} options={MONTH_OPTS.filter(o => parseInt(o.value) < parseInt(facilityTerm))} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "Construction", val: `${constructionPeriod} mo`, bg: BRAND_LIGHT, color: BRAND_DARK },
                      { label: "Tail Period", val: `${tailN} mo`, bg: "#FEF9EC", color: "#92400E" },
                      { label: "Total", val: `${facilityTerm} mo`, bg: "#F3F4F6", color: "#374151" },
                    ].map(item => (
                      <div key={item.label} style={{ background: item.bg, borderRadius: 10, padding: "10px 8px" }}>
                        <div style={{ color: item.color, fontSize: 20, fontWeight: 800 }}>{item.val}</div>
                        <div style={{ color: item.color, fontSize: 9, letterSpacing: 0.5, opacity: 0.7, marginTop: 2, textTransform: "uppercase" }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                  <Field label="Draw Schedule">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                      {[
                        { value: "scurve", label: "S-Curve", desc: "Slow start, ramps mid" },
                        { value: "equal", label: "Equal Monthly", desc: "Linear draw-down" },
                      ].map(opt => (
                        <button key={opt.value} onClick={() => setDrawSchedule(opt.value)}
                          style={{ border: `2px solid ${drawSchedule === opt.value ? BRAND : "#E5E7EB"}`, borderRadius: 10, padding: "10px 12px", background: drawSchedule === opt.value ? BRAND_LIGHT : "white", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: drawSchedule === opt.value ? BRAND_DARK : "#374151" }}>{opt.label}</div>
                          <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              ) : (
                <div className="space-y-3">
                  <Field label="Loan Term">
                    <Sel value={termMonths} onChange={setTermMonths} options={MONTH_OPTS} />
                  </Field>

                  {/* Interest prepayment option */}
                  <div>
                    <label className={lbl}>Interest Prepayment</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { value: "full", label: "Prepay Full Term", desc: "All interest capitalised upfront" },
                        { value: "partial", label: "Prepay Partial", desc: "Remainder serviced quarterly" },
                      ].map(opt => (
                        <button key={opt.value} onClick={() => setPrepayOption(opt.value)}
                          style={{ border: `2px solid ${prepayOption === opt.value ? BRAND : "#E5E7EB"}`, borderRadius: 10, padding: "10px 12px", background: prepayOption === opt.value ? BRAND_LIGHT : "white", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: prepayOption === opt.value ? BRAND_DARK : "#374151" }}>{opt.label}</div>
                          <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {prepayOption === "partial" && (
                    <div className="space-y-2">
                      <Field label="Months to Prepay">
                        <Sel
                          value={prepayMonths}
                          onChange={setPrepayMonths}
                          options={MONTH_OPTS.filter(o => parseInt(o.value) < parseInt(termMonths))}
                        />
                      </Field>
                      {servicedN > 0 && (
                        <InfoBox>
                          <strong>⚠ Note:</strong> The remaining <strong>{servicedN} month{servicedN !== 1 ? "s" : ""}</strong> of interest will need to be <strong>serviced quarterly in advance</strong> by the borrower outside the facility. Estimated quarterly payment: <strong>{fmt(((parseFloat(landValue) || 0) + (parseFloat(legalsVals) || 0)) * ((parseFloat(interestRate) || 0) / 100) / 4)}</strong>.
                        </InfoBox>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-center">
                        {[
                          { label: "Prepaid", val: `${prepayMonths} mo`, bg: BRAND_LIGHT, color: BRAND_DARK },
                          { label: "Serviced Qtly", val: `${servicedN} mo`, bg: "#FEF9EC", color: "#92400E" },
                        ].map(item => (
                          <div key={item.label} style={{ background: item.bg, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                            <div style={{ color: item.color, fontSize: 20, fontWeight: 800 }}>{item.val}</div>
                            <div style={{ color: item.color, fontSize: 9, letterSpacing: 0.5, opacity: 0.7, marginTop: 2, textTransform: "uppercase" }}>{item.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button onClick={() => setTab(isConstruction ? "costs" : "summary")}
              style={{ width: "100%", padding: "14px 0", background: BRAND, color: NAVY, border: "none", borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              {isConstruction ? "Enter Project Costs →" : "View Summary →"}
            </button>
          </div>
        )}

        {/* ══════════ COSTS TAB ══════════ */}
        {tab === "costs" && isConstruction && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <SectionTitle>Construction &amp; Development Costs</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Build Cost">
                  <NumInput value={buildCost} onChange={setBuildCost} />
                </Field>
                <Field label={`Contingency (${contingencyPct || 5}%)`}>
                  <NumInput value={contingencyPct} onChange={setContingencyPct} prefix="%" placeholder="5" />
                </Field>
                <Field label="Professional Fees">
                  <NumInput value={profFees} onChange={setProfFees} />
                </Field>
                <Field label="Statutory Fees">
                  <NumInput value={statFees} onChange={setStatFees} />
                </Field>
                <Field label="Marketing Costs">
                  <NumInput value={marketing} onChange={setMarketing} />
                </Field>
                <Field label="Legals & Valuations">
                  <NumInput value={legalsVals} onChange={setLegalsVals} placeholder="20000" />
                </Field>
                <Field label="Other Costs" span2>
                  <NumInput value={otherCosts} onChange={setOtherCosts} />
                </Field>
              </div>
            </div>

            {c.totalDevCost > 0 && (
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 py-3" style={{ background: NAVY }}>
                  <div style={{ color: BRAND, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Cost Summary</div>
                </div>
                <table className="w-full">
                  <tbody>
                    {c.land > 0 && <TRow label="Settlement (Land / Refi)" value={fmt(c.land)} indent />}
                    {c.build > 0 && <TRow label="Construction Drawdowns" value={fmt(c.build)} indent />}
                    {c.cont > 0 && <TRow label={`Contingency (${contingencyPct}%)`} value={fmt(c.cont)} indent />}
                    {c.prof > 0 && <TRow label="Professional Fees" value={fmt(c.prof)} indent />}
                    {c.stat > 0 && <TRow label="Statutory Fees" value={fmt(c.stat)} indent />}
                    {c.mkt > 0 && <TRow label="Marketing" value={fmt(c.mkt)} indent />}
                    {c.leg > 0 && <TRow label="Legals & Valuations" value={fmt(c.leg)} indent />}
                    {c.other > 0 && <TRow label="Other" value={fmt(c.other)} indent />}
                    <TRow label="Total Development Cost" value={fmt(c.totalDevCost)} bold highlight />
                    {c.grvVal > 0 && <TRow label="Net LVR (Dev Cost / GRV)" value={fmtPct(c.lvrNet)} />}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => setTab("inputs")}
                style={{ padding: "13px 0", background: "white", color: "#374151", border: "2px solid #E5E7EB", borderRadius: 14, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>← Back</button>
              <button onClick={() => setTab("breakdown")}
                style={{ padding: "13px 0", background: BRAND, color: NAVY, border: "none", borderRadius: 14, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>View Breakdown →</button>
            </div>
          </div>
        )}

        {/* ══════════ BREAKDOWN TAB ══════════ */}
        {tab === "breakdown" && isConstruction && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Cap. Interest", val: fmt(c.interestTotal) },
                { label: "Cap. Line Fee", val: fmt(c.lineFeeTotal) },
                { label: "Total Capitalised", val: fmt((c.interestTotal || 0) + (c.lineFeeTotal || 0)) },
              ].map(item => (
                <div key={item.label} style={{ background: "white", borderRadius: 12, padding: "12px 8px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: BRAND_DARK }}>{item.val}</div>
                  <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 3, letterSpacing: 0.4, textTransform: "uppercase" }}>{item.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3" style={{ background: NAVY }}>
                <div style={{ color: BRAND, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Monthly Schedule</div>
                <div style={{ color: "#4A6580", fontSize: 10, marginTop: 2 }}>
                  Interest on drawn balance · Line fee on full facility · {fmtPct(parseFloat(interestRate))} / {fmtPct(parseFloat(lineFeeRate))} p.a.
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full" style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "17%" }} />
                    <col style={{ width: "17%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "15%" }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: "#F9FAFB" }}>
                      {["Mo", "", "Draw", "Bal", "Int", "LF", "Cap"].map((h, i) => (
                        <th key={i} className={`px-1 py-2 font-medium ${i < 2 ? "text-left" : "text-right"}`} style={{ fontSize: 9, color: "#9CA3AF" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Day 0 — Settlement row */}
                    <tr style={{ background: "#EFF6FF", borderBottom: "2px solid #BFDBFE" }}>
                      <td className="px-1 py-1.5 text-gray-700 font-bold" style={{ fontSize: 9 }}>D0</td>
                      <td className="px-1 py-1.5">
                        <span style={{ background: "#DBEAFE", color: "#1E40AF", padding: "1px 4px", borderRadius: 3, fontWeight: 700, fontSize: 8 }}>SET</span>
                      </td>
                      <td className="px-1 py-1.5 text-right font-semibold text-gray-700">{fmt(c.day0Total)}</td>
                      <td className="px-1 py-1.5 text-right text-gray-600">{fmt(c.day0Total)}</td>
                      <td className="px-1 py-1.5 text-right text-gray-400">—</td>
                      <td className="px-1 py-1.5 text-right text-gray-400">—</td>
                      <td className="px-1 py-1.5 text-right text-gray-400">—</td>
                    </tr>
                    {c.breakdown.map((row, i) => (
                      <tr key={i} style={{ background: row.phase === "Tail" ? "#FFFBEB" : i % 2 === 0 ? "#FAFAFA" : "white", borderBottom: "1px solid #F3F4F6" }}>
                        <td className="px-1 py-1.5 text-gray-500">{row.month}</td>
                        <td className="px-1 py-1.5">
                          <span style={{ background: row.phase === "Construction" ? BRAND_LIGHT : "#FEF3C7", color: row.phase === "Construction" ? BRAND_DARK : "#92400E", padding: "1px 4px", borderRadius: 3, fontWeight: 600, fontSize: 8 }}>
                            {row.phase === "Construction" ? "CON" : "TAIL"}
                          </span>
                        </td>
                        <td className="px-1 py-1.5 text-right text-gray-500">{row.newDraw > 100 ? fmt(row.newDraw) : "-"}</td>
                        <td className="px-1 py-1.5 text-right text-gray-600">{fmt(row.drawnBal)}</td>
                        <td className="px-1 py-1.5 text-right text-gray-600">{fmt(row.interest)}</td>
                        <td className="px-1 py-1.5 text-right text-gray-600">{fmt(row.lineFeeChg)}</td>
                        <td className="px-1 py-1.5 text-right font-semibold" style={{ color: BRAND_DARK }}>{fmt(row.capitalised)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: BRAND_LIGHT }}>
                      <td colSpan={4} className="px-1 py-2 font-bold" style={{ fontSize: 9, color: BRAND_DARK }}>TOTALS</td>
                      <td className="px-1 py-2 text-right font-bold" style={{ fontSize: 9, color: BRAND_DARK }}>{fmt(c.interestTotal)}</td>
                      <td className="px-1 py-2 text-right font-bold" style={{ fontSize: 9, color: BRAND_DARK }}>{fmt(c.lineFeeTotal)}</td>
                      <td className="px-1 py-2 text-right font-bold" style={{ fontSize: 9, color: BRAND_DARK }}>{fmt((c.interestTotal || 0) + (c.lineFeeTotal || 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => setTab("costs")}
                style={{ padding: "13px 0", background: "white", color: "#374151", border: "2px solid #E5E7EB", borderRadius: 14, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>← Back</button>
              <button onClick={() => setTab("summary")}
                style={{ padding: "13px 0", background: BRAND, color: NAVY, border: "none", borderRadius: 14, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Funding Summary →</button>
            </div>
          </div>
        )}

        {/* ══════════ SUMMARY TAB ══════════ */}
        {tab === "summary" && (
          <div className="space-y-4">

            {/* Hero */}
            <div style={{ background: NAVY, borderRadius: 18, padding: "20px 24px" }}>
              <div style={{ color: "#4A6580", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                Total Facility Limit
                {isConstruction && (
                  <span style={{ marginLeft: 8, background: "#1A2D42", color: BRAND, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, letterSpacing: 0.5 }}>
                    {fmtPct(parseFloat(targetLVR))} of GRV
                  </span>
                )}
              </div>
              <div style={{ color: BRAND, fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>{fmt(c.facility)}</div>
              <div style={{ color: "#5E7A90", fontSize: 12, marginTop: 8, lineHeight: 1.8 }}>
                {isConstruction ? (
                  <>GRV <span style={{ color: "white", fontWeight: 600 }}>{fmt(c.grvVal)}</span>
                  {c.lvrNet !== null && <> &nbsp;·&nbsp; Net LVR <span style={{ color: "white", fontWeight: 700 }}>{fmtPct(c.lvrNet)}</span></>}
                  {c.ltc !== null && c.totalDevCost > 0 && <> &nbsp;·&nbsp; LTC <span style={{ color: "white", fontWeight: 700 }}>{fmtPct(c.ltc)}</span></>}</>
                ) : (
                  <>Net Cashout <span style={{ color: "white", fontWeight: 600 }}>{fmt(c.cashAdvance)}</span>
                  &nbsp;·&nbsp; {termMonths} month term</>
                )}
              </div>
            </div>

            {/* Pricing Summary */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3" style={{ background: NAVY }}>
                <div style={{ color: BRAND, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Pricing Summary</div>
              </div>
              <table className="w-full">
                <tbody>
                  {isConstruction ? (
                    <>
                      <TRow label="Interest Rate" value={fmtPct(parseFloat(interestRate))} sublabel="p.a. on drawn balance — capitalised monthly" />
                      <TRow label="Line Fee" value={fmtPct(parseFloat(lineFeeRate))} sublabel="p.a. on full facility limit — capitalised monthly" />
                      <TRow label="Application Fee" value={`${appFeePct}% + GST`} tag="incl. GST" sublabel={`${fmt(c.appFeeExGST)} + ${fmt(c.appFeeGST)} GST = ${fmt(c.appFeeIncGST)}`} />
                      {c.hasBroker && <TRow label="Broker Fee" value={`${brokerFeePct}% + GST`} tag="incl. GST" sublabel={`${fmt(c.brokerFeeExGST)} + ${fmt(c.brokerFeeGST)} GST = ${fmt(c.brokerFeeIncGST)}`} />}
                      <TRow separator />
                      <TRow label="Construction Period" value={`${constructionPeriod} months`} />
                      <TRow label="Tail / Sell-down Period" value={`${c.tailMonths} months`} />
                      <TRow label="Facility Term" value={`${facilityTerm} months`} bold />
                    </>
                  ) : (
                    <>
                      <TRow label="Interest Rate" value={fmtPct(parseFloat(interestRate))}
                        sublabel={prepayOption === "full"
                          ? `p.a. pre-paid for full ${termMonths} month term`
                          : `p.a. — ${prepayMonths} months prepaid, ${servicedN} months serviced quarterly in advance`} />
                      <TRow label="Application Fee" value={`${appFeePct}% + GST`} tag="incl. GST" sublabel={`${fmt(c.appFeeExGST)} + ${fmt(c.appFeeGST)} GST = ${fmt(c.appFeeIncGST)}`} />
                      <TRow label="Loan Term" value={`${termMonths} months`} />
                      {c.lvr !== null && <TRow label="LVR" value={fmtPct(c.lvr)} highlight bold />}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Serviced interest callout for partial prepay term loan */}
            {!isConstruction && prepayOption === "partial" && c.interestServiced > 0 && (
              <InfoBox>
                <strong>⚠ Quarterly servicing required:</strong> The borrower must service <strong>{fmt(c.interestServiced)}</strong> of interest over {servicedN} months, paid quarterly in advance (~<strong>{fmt(c.interestServiced / Math.ceil(servicedN / 3))}</strong> per quarter). This is <em>not</em> included in the facility.
              </InfoBox>
            )}

            {/* Funding Table */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3" style={{ background: NAVY }}>
                <div style={{ color: BRAND, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Funding Table</div>
              </div>
              <table className="w-full">
                <tbody>
                  {isConstruction ? (
                    <>
                      {/* Settlement — balancing item, editable */}
                      <tr style={{ background: "#FAFAFA" }}>
                        <td className="py-2 px-4 text-sm text-gray-700">
                          <div className="font-medium">Settlement (Land Purchase / Refi)</div>
                          <div className="text-xs mt-0.5" style={{ color: settlementOverride !== "" ? "#92400E" : "#9CA3AF" }}>
                            {settlementOverride !== "" ? "Manual override" : "Auto-calculated balancing item"}
                          </div>
                        </td>
                        <td className="py-2 px-4 w-40">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                            <input
                              type="text"
                              value={settlementOverride !== "" ? settlementOverride : (c.settlementBalancing > 0 ? Math.round(c.settlementBalancing).toLocaleString("en-AU") : "")}
                              placeholder={c.settlementBalancing > 0 ? Math.round(c.settlementBalancing).toLocaleString("en-AU") : "0"}
                              onFocus={(e) => { const raw = settlementOverride !== "" ? settlementOverride : String(Math.round(c.settlementBalancing)); e.target.value = raw; }}
                              onChange={(e) => setSettlementOverride(e.target.value.replace(/,/g, ""))}
                              onBlur={(e) => { if (e.target.value === "" || e.target.value === String(Math.round(c.settlementBalancing))) setSettlementOverride(""); }}
                              className="w-full text-right text-sm font-semibold text-gray-800 bg-white border-2 rounded-lg px-3 py-1.5 pl-7 focus:outline-none"
                              style={{ borderColor: settlementOverride !== "" ? "#F59E0B" : "#E5E7EB" }}
                            />
                          </div>
                          {settlementOverride !== "" && (
                            <button
                              onClick={() => setSettlementOverride("")}
                              className="mt-1 w-full text-xs font-semibold rounded-md py-1"
                              style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" }}
                            >
                              ↺ Reset to Balancing Item
                            </button>
                          )}
                        </td>
                      </tr>
                      <TRow label={`Application Fee (${appFeePct}% + GST)`} value={fmt(c.appFeeIncGST)}
                        sublabel={`${fmt(c.appFeeExGST)} + ${fmt(c.appFeeGST)} GST`} tag="+ GST" indent />
                      <TRow label="Legals & Vals (inc. GST)" value={fmt(c.leg)} indent />
                      <TRow label="Construction Drawdowns" value={fmt(c.build)} indent />
                      {c.cont > 0 && <TRow label={`Contingency (${contingencyPct}%)`} value={fmt(c.cont)} indent />}
                      {c.prof > 0 && <TRow label="Professional Fees" value={fmt(c.prof)} indent />}
                      {c.stat > 0 && <TRow label="Statutory Fees" value={fmt(c.stat)} indent />}
                      {c.mkt > 0 && <TRow label="Marketing Costs" value={fmt(c.mkt)} indent />}
                      {c.hasBroker && <TRow label={`Brokerage (${brokerFeePct}% + GST)`} value={fmt(c.brokerFeeIncGST)}
                        sublabel={`${fmt(c.brokerFeeExGST)} + ${fmt(c.brokerFeeGST)} GST`} tag="+ GST" indent />}
                      {c.other > 0 && <TRow label="Other Costs" value={fmt(c.other)} indent />}
                      <TRow separator />
                      <TRow label="Sub-Total" value={fmt(c.subTotal)} bold />
                      <TRow separator />
                      <TRow label="Capitalised Interest" value={fmt(c.interestTotal)}
                        sublabel={`${fmtPct(parseFloat(interestRate))} p.a. on progressive drawn balance`} indent />
                      <TRow label="Capitalised Line Fee" value={fmt(c.lineFeeTotal)}
                        sublabel={`${fmtPct(parseFloat(lineFeeRate))} p.a. on full facility × ${facilityTerm} months`} indent />
                      <TRow separator />
                      <TRow label="TOTAL FACILITY LIMIT" value={fmt(c.fundingTotal)} bold highlight />
                    </>
                  ) : (
                    <>
                      <TRow label="Application Fee (inc. GST)" value={fmt(c.appFeeIncGST)}
                        sublabel={`${appFeePct}% + GST on facility`} tag="+ GST" />
                      {c.hasBroker && <TRow label="Broker Fee (inc. GST)" value={fmt(c.brokerFeeIncGST)}
                        sublabel={`${brokerFeePct}% + GST on facility`} tag="+ GST" />}
                      <tr>
                        <td className="py-2 px-4 text-sm text-gray-600">
                          Legals &amp; Valuations Provision
                          <div className="text-xs text-gray-400 mt-0.5">Editable estimate</div>
                        </td>
                        <td className="py-2 px-4">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                            <input
                              type="text"
                              value={parseFloat(legalsVals) > 0 ? parseFloat(legalsVals).toLocaleString("en-AU") : legalsVals}
                              onFocus={(e) => { e.target.type = "number"; e.target.value = legalsVals; }}
                              onBlur={(e) => { e.target.type = "text"; e.target.value = parseFloat(legalsVals) > 0 ? parseFloat(legalsVals).toLocaleString("en-AU") : ""; }}
                              onChange={(e) => setLegalsVals(e.target.value.replace(/,/g, ""))}
                              placeholder="15,000"
                              className="w-full text-right text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 pl-7 focus:outline-none focus:ring-2 focus:ring-[#00BFCE]"
                            />
                          </div>
                        </td>
                      </tr>
                      <TRow
                        label={prepayOption === "full" ? `Interest Pre-paid (${termMonths} months)` : `Interest Pre-paid (${prepayMonths} months)`}
                        value={fmt(c.interestTotal)}
                        sublabel={`${fmtPct(parseFloat(interestRate))} p.a. × ${prepayOption === "full" ? termMonths : prepayMonths} months`}
                      />
                      <TRow separator />
                      <TRow label="Net Cashout to Borrower" value={fmt(c.cashAdvance)} bold />
                      <TRow separator />
                      <TRow label="TOTAL FACILITY LIMIT" value={fmt(c.facility)} bold highlight />
                      {prepayOption === "partial" && c.interestServiced > 0 && (
                        <TRow label="Interest Serviced Quarterly (outside facility)" value={fmt(c.interestServiced)}
                          sublabel={`${servicedN} months at ${fmtPct(parseFloat(interestRate))} p.a. — paid quarterly in advance`} />
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* LVR Analysis — construction only */}
            {isConstruction && c.grvVal > 0 && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3" style={{ background: NAVY }}>
                  <div style={{ color: BRAND, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>LVR Analysis</div>
                </div>
                <table className="w-full">
                  <tbody>
                    <TRow
                      label="Target LVR"
                      value={fmtPct(c.targetLVRpct)}
                      sublabel={`${fmt(c.grvVal)} GRV × ${targetLVR}% = ${fmt(c.facility)}`}
                      bold
                    />
                    <TRow
                      label="Actual LVR"
                      value={c.actualLVR !== null ? fmtPct(c.actualLVR) : "—"}
                      sublabel={`Funding table total ${fmt(c.fundingTotal)} ÷ GRV ${fmt(c.grvVal)}`}
                      bold
                    />
                    <TRow separator />
                    <tr>
                      <td className="py-3 px-4 text-sm font-semibold text-gray-700">Position vs Target</td>
                      <td className="py-3 px-4 text-right">
                        {c.lvrDiff !== null ? (
                          <span style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: 13,
                            fontWeight: 700,
                            background: Math.abs(c.lvrDiff) < 0.05 ? "#D1FAE5" : c.lvrDiff > 0 ? "#FEE2E2" : "#D1FAE5",
                            color: Math.abs(c.lvrDiff) < 0.05 ? "#065F46" : c.lvrDiff > 0 ? "#991B1B" : "#065F46",
                          }}>
                            {Math.abs(c.lvrDiff) < 0.05
                              ? "✓ On target"
                              : c.lvrDiff > 0
                                ? `▲ Over by ${fmtPct(Math.abs(c.lvrDiff))}`
                                : `▼ Under by ${fmtPct(Math.abs(c.lvrDiff))}`}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setTab("inputs")}
                style={{ flex: 1, padding: "13px 0", background: "white", color: "#374151", border: "2px solid #E5E7EB", borderRadius: 14, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                ← Edit Inputs
              </button>
              <button onClick={() => generatePDF(c, isConstruction)}
                style={{ flex: 1, padding: "13px 0", background: NAVY, color: BRAND, border: "none", borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                ⬇ PDF Summary
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
