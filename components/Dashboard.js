"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  LayoutDashboard,
  Building2,
  Plug,
  Package,
  SlidersHorizontal,
  FlaskConical,
  Clock3,
  Settings2,
  Plus,
  ChevronDown,
  Search,
  X,
  Check,
  CheckCircle2,
  ShieldCheck,
  Globe2,
  FileUp,
  ChevronRight,
  Activity,
  LogOut,
  Menu,
  Info,
  Download,
  LockKeyhole,
  Layers3,
} from "lucide-react";
import { connectors, defaults, currencies } from "../lib/connectors.js";
import {
  companySchema,
  productSchema,
  policySchema,
  parseMoney,
  parseCatalogCSV,
  simulationSchema,
} from "../lib/validation.js";
import { simulate } from "../lib/simulate.js";
import StoreConnection from "./StoreConnection.js";
import { authClient } from "../lib/auth-client.js";
const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];
function sample() {
  return {
    workspace: {
      id: "preview",
      name: "Northstar Supply",
      domain: "northstar.example",
      industry: "Retail & ecommerce",
      currency: "USD",
      domainVerified: false,
    },
    products: [
      {
        id: ids[0],
        sku: "TOTE-01",
        name: "Everyday canvas tote",
        priceMinor: 4900,
        floorMinor: 3900,
        stock: 42,
        source: "manual",
      },
      {
        id: ids[1],
        sku: "MUG-02",
        name: "Studio ceramic mug",
        priceMinor: 2800,
        floorMinor: 2200,
        stock: 8,
        source: "manual",
      },
      {
        id: ids[2],
        sku: "FLASK-03",
        name: "Travel flask · 500 ml",
        priceMinor: 3800,
        floorMinor: 3100,
        stock: 3,
        source: "manual",
      },
    ],
    policy: { ...defaults, dailyBudgetMinor: 25000 },
    policyVersion: 1,
    policyPublished: false,
    connections: [{ id: "manual", status: "manual_ready" }],
    simulations: [],
    activity: [],
  };
}
const nav = [
  ["Overview", LayoutDashboard],
  ["Companies", Building2],
  ["Connections", Plug],
  ["Products", Package],
  ["Rules", SlidersHorizontal],
  ["Simulator", FlaskConical],
  ["Activity", Clock3],
  ["Settings", Settings2],
];
const headings = {
  Overview: [
    "Your merchant workspace",
    "A clear path from first connection to your first negotiated offer.",
  ],
  Companies: [
    "Built for every business",
    "Create a separate workspace for each company or store.",
  ],
  Connections: [
    "Connect your business",
    "Bring the right data together. Keep control of what you share.",
  ],
  Products: [
    "Your negotiable catalog",
    "Choose the products, prices and boundaries behind every offer.",
  ],
  Rules: [
    "Your terms, always",
    "Set the limits. Let the conversation work within them.",
  ],
  Simulator: [
    "Try before you go live",
    "Explore how inventory, price and delivery reserves change an offer.",
  ],
  Activity: [
    "A record of every step",
    "Follow workspace changes and policy tests in one place.",
  ],
  Settings: [
    "Workspace settings",
    "Your company, ownership and activation requirements.",
  ],
};
function Pill({ children, tone = "" }) {
  return <span className={"pill " + tone}>{children}</span>;
}
function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <Layers3 size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export default function Dashboard({ demo = false, user }) {
  const [tab, setTab] = useState("Overview"),
    [workspaces, setWorkspaces] = useState([]),
    [active, setActive] = useState(demo ? "preview" : ""),
    [remote, setRemote] = useState(null),
    [stores, setStores] = useState(() => [sample()]),
    [loading, setLoading] = useState(!demo),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState(null),
    [filter, setFilter] = useState("All"),
    [query, setQuery] = useState(""),
    [mobile, setMobile] = useState(false),
    [result, setResult] = useState(null),
    [fileText, setFileText] = useState(""),
    [filePreview, setFilePreview] = useState(null);
  const data = demo ? stores.find((x) => x.workspace.id === active) : remote;
  const companyList = demo ? stores.map((x) => x.workspace) : workspaces;
  const workspace = data?.workspace;
  const money = (n) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: workspace?.currency || "USD",
    }).format(n / 100);
  async function api(path, body) {
    const res = await fetch("/api/platform/" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const value = await res.json();
    if (!res.ok) throw Error(value.error || "Request failed");
    return value;
  }
  async function refresh() {
    if (!demo && active) setRemote(await api("workspaces/" + active));
  }
  useEffect(() => {
    if (demo) return;
    let live = true;
    api("workspaces")
      .then((list) => {
        if (live) {
          setWorkspaces(list);
          setActive(list[0]?.id || "");
          setLoading(false);
        }
      })
      .catch((e) => {
        if (live) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, [demo]);
  useEffect(() => {
    setResult(null);
    if (demo || !active) return;
    let live = true;
    setLoading(true);
    setRemote(null);
    api("workspaces/" + active)
      .then((v) => {
        if (live) setRemote(v);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [active, demo]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  function select(t) {
    setTab(t);
    setMobile(false);
    setError("");
    setQuery("");
  }
  function updateDemo(fn) {
    setStores((list) =>
      list.map((s) => (s.workspace.id === active ? fn(structuredClone(s)) : s)),
    );
  }
  async function action(name, body) {
    setError("");
    if (name !== "simulate") setResult(null);
    setBusy(true);
    try {
      let response;
      if (demo) {
        if (name === "simulate") {
          response = simulate(
            data.products.find((p) => p.id === body.productId),
            data.policy,
            body,
          );
          updateDemo((s) => {
            s.simulations.unshift({
              id: crypto.randomUUID(),
              result: response,
              created_at: new Date().toISOString(),
            });
            s.activity.unshift({
              id: crypto.randomUUID(),
              name: "Simulation completed",
              detail: "Interactive preview only. No offer or order created.",
              created_at: new Date().toISOString(),
            });
            return s;
          });
        } else
          updateDemo((s) => {
            if (name === "product" || name === "import") {
              const list =
                name === "product" ? [body] : parseCatalogCSV(body.csv);
              for (const p of list) {
                const prior = s.products.findIndex((x) => x.sku === p.sku);
                const value = {
                  ...p,
                  id: prior >= 0 ? s.products[prior].id : crypto.randomUUID(),
                  source: "manual",
                };
                if (prior >= 0) s.products[prior] = value;
                else s.products.unshift(value);
              }
              if (!s.connections.some((c) => c.id === "manual"))
                s.connections.push({ id: "manual", status: "manual_ready" });
            }
            if (name === "policy") {
              s.policy = body.config;
              s.policyVersion++;
              s.policyPublished = true;
            }
            if (
              name === "connector" &&
              !s.connections.some((c) => c.id === body.connectorId)
            )
              s.connections.push({
                id: body.connectorId,
                status: "setup_required",
              });
            s.activity.unshift({
              id: crypto.randomUUID(),
              name:
                {
                  product: "Product saved",
                  import: "Catalog imported",
                  policy: "Rules published",
                  connector: "Connector selected",
                }[name] || "Workspace updated",
              detail: "Interactive preview only. No external service changed.",
              created_at: new Date().toISOString(),
            });
            return s;
          });
      } else {
        response = await api(`workspaces/${active}/${name}`, body);
        await refresh();
      }
      setToast(
        name === "connector"
          ? "Setup choice saved. Connection is not live."
          : name === "simulate"
            ? "Simulation saved. No order or payment created."
            : demo
              ? "Saved in this preview session."
              : "Changes saved to your workspace.",
      );
      return response;
    } finally {
      setBusy(false);
    }
  }
  function formError(e) {
    setError(e.issues?.[0]?.message || e.message || "Please check the form.");
  }
  async function createCompany(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = companySchema.parse(
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      const w = demo
        ? { ...body, id: crypto.randomUUID(), domainVerified: false }
        : await api("workspaces", body);
      if (demo)
        setStores((s) => [
          ...s,
          {
            workspace: w,
            products: [],
            policy: { ...defaults },
            policyVersion: 1,
            policyPublished: false,
            connections: [],
            activity: [],
            simulations: [],
          },
        ]);
      else setWorkspaces((s) => [...s, w]);
      setActive(w.id);
      setModal(null);
      setTab("Overview");
      setToast("Company created. Let’s set up your catalog.");
    } catch (e) {
      formError(e);
    } finally {
      setBusy(false);
    }
  }
  async function saveProduct(e) {
    e.preventDefault();
    try {
      const v = Object.fromEntries(new FormData(e.currentTarget));
      const p = productSchema.parse({
        sku: v.sku,
        name: v.name,
        priceMinor: parseMoney(v.price),
        floorMinor: parseMoney(v.floor),
        stock: v.stock === "" ? null : Number(v.stock),
      });
      await action("product", p);
      setModal(null);
    } catch (e) {
      formError(e);
    }
  }
  async function saveRules(e) {
    e.preventDefault();
    try {
      const f = Object.fromEntries(new FormData(e.currentTarget));
      const config = policySchema.parse({
        maxDiscountBps: Math.round(Number(f.discount) * 100),
        rounds: Number(f.rounds),
        ttlMinutes: Number(f.ttl),
        dailyBudgetMinor: parseMoney(f.budget),
        lowStockThreshold: Number(f.low),
        lowStockDiscountBps: Math.round(Number(f.lowDiscount) * 100),
        excessStockThreshold: Number(f.excess),
        historyEnabled: f.history === "on",
      });
      await action("policy", { config, expectedVersion: data.policyVersion });
    } catch (e) {
      formError(e);
    }
  }
  async function runSimulation(e) {
    e.preventDefault();
    try {
      const f = Object.fromEntries(new FormData(e.currentTarget));
      const body = simulationSchema.parse({
        productId: f.productId,
        targetMinor: parseMoney(f.target),
        shippingReserveMinor: parseMoney(f.shipping),
        round: Number(f.round),
        stock: f.stock === "" ? null : Number(f.stock),
        medianMinor: f.median === "" ? null : parseMoney(f.median),
        sampleCount: Number(f.samples || 0),
      });
      setResult(await action("simulate", body));
    } catch (e) {
      formError(e);
    }
  }
  const complete = workspace
    ? [
        true,
        Boolean(data.products.length),
        data.policyPublished,
        Boolean(data.simulations.length),
        false,
      ].filter(Boolean).length
    : 0;
  const steps = [
    [
      "Company details",
      "Your company and operating currency",
      "Companies",
      Boolean(workspace),
    ],
    [
      "Build your catalog",
      "Add products or choose a commerce connection",
      "Products",
      Boolean(data?.products.length),
    ],
    [
      "Set your boundaries",
      "Publish minimum prices and discount rules",
      "Rules",
      Boolean(data?.policyPublished),
    ],
    [
      "Test your rules",
      "Run scenarios without affecting your store",
      "Simulator",
      Boolean(data?.simulations.length),
    ],
    [
      "Install & activate",
      "Verify data, ownership and checkout enforcement",
      "Settings",
      false,
    ],
  ];
  const categories = [
    "All",
    "Commerce",
    "Catalog",
    "Data",
    "Shipping",
    "Payments",
  ];
  const productList =
    data?.products.filter((p) =>
      (p.name + " " + p.sku).toLowerCase().includes(query.toLowerCase()),
    ) || [];
  return (
    <div className="shell">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a className="brand" href={demo ? "/demo" : "/dashboard"}>
          <span className="brand-mark">
            <ArrowUpRight size={21} />
          </span>
          negotiation<span className="brand-dot">.</span>
        </a>
        <div className="workspace-picker">
          <span className="company-avatar">{workspace?.name?.[0] || "+"}</span>
          <div>
            <small>WORKSPACE</small>
            <select
              aria-label="Current company"
              disabled={busy}
              value={active}
              onChange={(e) => {
                setActive(e.target.value);
                setModal(null);
              }}
            >
              {!companyList.length && (
                <option value="">Create a company</option>
              )}
              {companyList.map((w) => (
                <option value={w.id} key={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <ChevronDown size={15} />
        </div>
        <p className="nav-label">MANAGE</p>
        <nav>
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              onClick={() => select(name)}
              className={tab === name ? "active" : ""}
            >
              <Icon size={18} />
              {name}
              {name === "Connections" && <span className="nav-count">9</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="safe-card">
            <ShieldCheck size={21} />
            <strong>Start in test mode</strong>
            <p>Explore your rules before a single live offer.</p>
            <button onClick={() => select("Simulator")}>
              Open simulator <ArrowRight size={14} />
            </button>
          </div>
          <div className="profile">
            <span className="avatar">{user.name?.[0] || "M"}</span>
            <div>
              <strong>{user.name || "Merchant"}</strong>
              <small>{demo ? "Preview workspace" : "Workspace owner"}</small>
            </div>
            {demo ? (
              <a href="/login" aria-label="Sign in">
                <ArrowUpRight size={17} />
              </a>
            ) : (
              <button
                aria-label="Sign out"
                onClick={async () => {
                  await authClient.signOut();
                  window.location.assign("/login");
                }}
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Open menu"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{tab}</strong>
          </div>
          <div className="top-actions">
            <span className="status-dot" />
            <span>
              {demo ? "Interactive preview" : "Development workspace"}
            </span>
            <a href={demo ? "/login" : "/demo"}>
              {demo ? "Sign in to save" : "View demo"}
              <ArrowUpRight size={14} />
            </a>
          </div>
        </header>
        <main className="content">
          <div className="page-head">
            <div>
              <span className="eyebrow">
                {tab === "Overview"
                  ? "A STRONG START"
                  : "MERCHANT CONTROL CENTER"}
              </span>
              <h1>{headings[tab][0]}</h1>
              <p>{headings[tab][1]}</p>
            </div>
            <button
              className="primary"
              onClick={() => {
                setError("");
                setModal({ type: "company" });
              }}
            >
              <Plus size={17} />
              Add company
            </button>
          </div>
          {demo && (
            <div className="preview-strip">
              <Info size={16} />
              <span>
                Sample workspace · changes stay in this preview session. No live
                connections, orders or payments.
              </span>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading">Loading your workspace…</div>
          ) : !workspace && tab !== "Companies" ? (
            <Empty
              title="Your next company starts here"
              action={
                <button
                  className="primary"
                  onClick={() => setModal({ type: "company" })}
                >
                  <Plus size={16} />
                  Create a company
                </button>
              }
            >
              Bring any store or business into its own workspace. Begin with
              manual data and connect your systems when ready.
            </Empty>
          ) : (
            <>
              {tab === "Overview" && (
                <>
                  <section className="welcome-panel">
                    <div>
                      <Pill tone="light">ONBOARDING IN PROGRESS</Pill>
                      <h2>
                        Connect once.
                        <br />
                        Negotiate on your terms.
                      </h2>
                      <p>
                        Your storefront, stock and sales. One connected
                        foundation for better customer conversations.
                      </p>
                      <button
                        className="light-button"
                        onClick={() => select("Connections")}
                      >
                        Explore connections <ArrowRight size={17} />
                      </button>
                    </div>
                    <div className="orbit-art" aria-hidden="true">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <div className="orbit-core">
                        <ArrowUpRight size={42} />
                      </div>
                      <span className="orbit-item item-one">
                        <Package size={21} />
                      </span>
                      <span className="orbit-item item-two">
                        <Plug size={21} />
                      </span>
                      <span className="orbit-item item-three">
                        <ShieldCheck size={21} />
                      </span>
                      <span className="orbit-label">COMMERCE, CONNECTED</span>
                    </div>
                  </section>
                  <div className="stats-grid">
                    {[
                      [Building2, "Company workspace", "01", workspace.name],
                      [
                        Plug,
                        "Live commerce connections",
                        "0",
                        "Setup comes before activation",
                      ],
                      [
                        Package,
                        "Products in catalog",
                        String(data.products.length).padStart(2, "0"),
                        "Merchant-entered snapshots",
                      ],
                      [
                        FlaskConical,
                        "Saved simulations",
                        String(data.simulations.length).padStart(2, "0"),
                        "Test outcomes, not paid orders",
                      ],
                    ].map(([Icon, label, value, note]) => (
                      <div className="stat-card" key={label}>
                        <div>
                          <span>{label}</span>
                          <Icon size={17} />
                        </div>
                        <strong>{value}</strong>
                        <small>{note}</small>
                      </div>
                    ))}
                  </div>
                  <div className="overview-columns">
                    <section className="panel setup-panel">
                      <div className="section-head">
                        <div>
                          <h2>Your launch checklist</h2>
                          <p>A few clear steps. No guesswork.</p>
                        </div>
                        <span className="progress-label">{complete} of 5</span>
                      </div>
                      <div className="progress-track">
                        <span style={{ width: `${complete * 20}%` }} />
                      </div>
                      {steps.map(([title, desc, to, done], i) => (
                        <button
                          className="checklist-row"
                          key={title}
                          onClick={() => select(to)}
                        >
                          <span
                            className={"step-circle " + (done ? "done" : "")}
                          >
                            {done ? <Check size={16} /> : i + 1}
                          </span>
                          <div>
                            <strong>{title}</strong>
                            <small>{desc}</small>
                          </div>
                          {i === 4 ? (
                            <LockKeyhole size={16} />
                          ) : (
                            <ChevronRight size={17} />
                          )}
                        </button>
                      ))}
                    </section>
                    <section className="panel data-panel">
                      <span className="eyebrow">A CONNECTED FOUNDATION</span>
                      <h2>
                        Every good offer
                        <br />
                        starts with good data.
                      </h2>
                      <p>
                        Connect what you have. We’ll make the gaps visible
                        before you go live.
                      </p>
                      {[
                        [
                          "Catalog & pricing",
                          data.products.length ? "Manual data" : "Not added",
                          !!data.products.length,
                        ],
                        ["Live availability", "Not connected", false],
                        ["Delivery quotes", "Not connected", false],
                        ["Checkout enforcement", "Not connected", false],
                      ].map(([label, status, done]) => (
                        <div className="data-line" key={label}>
                          <span>
                            <span
                              className={"tiny-dot " + (done ? "green" : "")}
                            />
                            {label}
                          </span>
                          <small>{status}</small>
                        </div>
                      ))}
                      <button
                        className="text-button"
                        onClick={() => select("Connections")}
                      >
                        Review your connections <ArrowRight size={15} />
                      </button>
                    </section>
                  </div>
                  <div className="section-head recommendations">
                    <div>
                      <h2>Built for the way you sell</h2>
                      <p>
                        Choose your starting point. Add more capabilities over
                        time.
                      </p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => select("Connections")}
                    >
                      View all connectors <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="connector-grid compact">
                    {connectors
                      .filter((c) =>
                        ["shopify", "woocommerce", "custom"].includes(c.id),
                      )
                      .map((c) => (
                        <Connector
                          key={c.id}
                          c={c}
                          onClick={() =>
                            setModal({ type: "connector", connector: c })
                          }
                        />
                      ))}
                  </div>
                </>
              )}
              {tab === "Companies" && (
                <>
                  <div className="company-grid">
                    {companyList.map((w) => (
                      <button
                        key={w.id}
                        className={
                          "company-card " + (active === w.id ? "selected" : "")
                        }
                        onClick={() => {
                          setActive(w.id);
                          select("Overview");
                        }}
                      >
                        <div className="company-card-top">
                          <span className="company-logo">{w.name[0]}</span>
                          <Pill>
                            {active === w.id
                              ? "Current workspace"
                              : "Open workspace"}
                          </Pill>
                        </div>
                        <h2>{w.name}</h2>
                        <p>
                          <Globe2 size={14} />
                          {w.domain}
                        </p>
                        <div className="company-card-bottom">
                          <span>{w.industry}</span>
                          <span>
                            {w.currency} <ArrowUpRight size={16} />
                          </span>
                        </div>
                      </button>
                    ))}
                    <button
                      className="company-card add-card"
                      onClick={() => setModal({ type: "company" })}
                    >
                      <Plus size={28} />
                      <h3>Add another company</h3>
                      <p>A separate catalog, rules and activity history.</p>
                    </button>
                  </div>
                  <div className="note-panel">
                    <ShieldCheck size={20} />
                    <div>
                      <strong>Separate companies. Separate data.</strong>
                      <p>
                        Each signed-in owner sees only their workspaces. Team
                        invitations and additional roles are a later release.
                      </p>
                    </div>
                  </div>
                </>
              )}
              {tab === "Connections" && (
                <>
                  {!demo && <StoreConnection key={workspace.id} workspace={workspace} />}
                  <div className="connector-toolbar">
                    <div className="filter-tabs">
                      {categories.map((c) => (
                        <button
                          key={c}
                          className={filter === c ? "selected" : ""}
                          onClick={() => setFilter(c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <label className="search-box">
                      <Search size={17} />
                      <input
                        aria-label="Search connectors"
                        placeholder="Find a connector"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="connector-grid">
                    {connectors
                      .filter(
                        (c) =>
                          (filter === "All" || c.category === filter) &&
                          (c.name + " " + c.description)
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                      )
                      .map((c) => (
                        <Connector
                          key={c.id}
                          c={c}
                          selected={data.connections.some((x) => x.id === c.id)}
                          onClick={() =>
                            setModal({ type: "connector", connector: c })
                          }
                        />
                      ))}
                  </div>
                  <div className="note-panel">
                    <ShieldCheck size={21} />
                    <div>
                      <strong>Your database stays yours</strong>
                      <p>
                        Commerce adapters request scoped access. Custom backends
                        share only approved business facts. We do not ask for a
                        master database password.
                      </p>
                    </div>
                  </div>
                </>
              )}
              {tab === "Products" && (
                <section className="panel">
                  <div className="section-head">
                    <div>
                      <h2>
                        Catalog{" "}
                        <span className="count">{data.products.length}</span>
                      </h2>
                      <p>
                        Prices are in {workspace.currency}. Up to 500 products.
                        Blank availability means unknown.
                      </p>
                    </div>
                    <div className="button-row">
                      <button
                        className="secondary"
                        onClick={() => {
                          setFileText("");
                          setFilePreview(null);
                          setModal({ type: "import" });
                        }}
                      >
                        <FileUp size={16} />
                        Import CSV
                      </button>
                      <button
                        className="primary"
                        onClick={() => setModal({ type: "product" })}
                      >
                        <Plus size={16} />
                        Add product
                      </button>
                    </div>
                  </div>
                  <label className="search-box table-search">
                    <Search size={17} />
                    <input
                      aria-label="Search products"
                      placeholder="Search product name or SKU"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  {!data.products.length ? (
                    <Empty title="Start with your first product">
                      Add a price and a minimum you are willing to accept. You
                      can connect live inventory later.
                    </Empty>
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Selling price</th>
                            <th>Minimum price</th>
                            <th>Availability</th>
                            <th>Source</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {productList.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <div className="product-cell">
                                  <span className="product-icon">
                                    <Package size={19} />
                                  </span>
                                  <div>
                                    <strong>{p.name}</strong>
                                    <small>{p.sku}</small>
                                  </div>
                                </div>
                              </td>
                              <td>{money(p.priceMinor)}</td>
                              <td>{money(p.floorMinor)}</td>
                              <td>
                                <Pill
                                  tone={
                                    p.stock !== null &&
                                    p.stock <= data.policy.lowStockThreshold
                                      ? "amber"
                                      : ""
                                  }
                                >
                                  {p.stock === null
                                    ? "Unknown"
                                    : `${p.stock} units`}
                                </Pill>
                              </td>
                              <td>
                                <span className="muted">Manual snapshot</span>
                              </td>
                              <td>
                                <button
                                  className="text-button"
                                  aria-label={"Edit " + p.name}
                                  onClick={() =>
                                    setModal({ type: "product", product: p })
                                  }
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!productList.length && (
                        <p className="no-results">
                          No products match your search.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="table-note">
                    <Info size={14} />
                    Manual stock is a snapshot. A live connector must revalidate
                    availability before checkout.
                  </div>
                </section>
              )}
              {tab === "Rules" && (
                <form
                  key={active + "-" + data.policyVersion}
                  onSubmit={saveRules}
                >
                  <div className="rules-grid">
                    <section className="panel">
                      <div className="section-head">
                        <div>
                          <h2>Commercial boundaries</h2>
                          <p>
                            Product-specific minimum prices are set in your
                            catalog.
                          </p>
                        </div>
                        <Pill>Version {data.policyVersion}</Pill>
                      </div>
                      <div className="form-grid">
                        <label>
                          Maximum discount (%)
                          <input
                            name="discount"
                            type="number"
                            min="0"
                            max="50"
                            step="0.01"
                            defaultValue={data.policy.maxDiscountBps / 100}
                            required
                          />
                          <small>
                            Always limited by the product’s minimum price.
                          </small>
                        </label>
                        <label>
                          Daily discount budget ({workspace.currency})
                          <input
                            name="budget"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={data.policy.dailyBudgetMinor / 100}
                            required
                          />
                          <small>
                            Simulator checks a single offer. Live reservations
                            are not enabled.
                          </small>
                        </label>
                        <label>
                          Maximum rounds
                          <input
                            name="rounds"
                            type="number"
                            min="1"
                            max="5"
                            defaultValue={data.policy.rounds}
                            required
                          />
                        </label>
                        <label>
                          Offer validity (minutes)
                          <input
                            name="ttl"
                            type="number"
                            min="1"
                            max="60"
                            defaultValue={data.policy.ttlMinutes}
                            required
                          />
                          <small>Saved setting for future live quotes.</small>
                        </label>
                      </div>
                    </section>
                    <section className="panel">
                      <div className="section-head">
                        <div>
                          <h2>Inventory & market context</h2>
                          <p>
                            Bounded adjustments that never override your
                            minimum.
                          </p>
                        </div>
                      </div>
                      <div className="form-grid">
                        <label>
                          Low-stock threshold (units)
                          <input
                            name="low"
                            type="number"
                            min="0"
                            defaultValue={data.policy.lowStockThreshold}
                            required
                          />
                        </label>
                        <label>
                          Low-stock discount cap (%)
                          <input
                            name="lowDiscount"
                            type="number"
                            min="0"
                            max="50"
                            step="0.01"
                            defaultValue={data.policy.lowStockDiscountBps / 100}
                            required
                          />
                        </label>
                        <label>
                          Excess-stock threshold (units)
                          <input
                            name="excess"
                            type="number"
                            min="1"
                            defaultValue={data.policy.excessStockThreshold}
                            required
                          />
                        </label>
                      </div>
                      <label className="checkbox">
                        <input
                          name="history"
                          type="checkbox"
                          defaultChecked={data.policy.historyEnabled}
                        />
                        <div>
                          <strong>Use comparable sales history</strong>
                          <small>
                            Requires at least five comparable sales. Exclude
                            bundles, refunds and unrelated promotions.
                          </small>
                        </div>
                      </label>
                    </section>
                  </div>
                  <div className="publish-bar">
                    <span>
                      <ShieldCheck size={17} />
                      Publishing creates a new test policy version. It does not
                      activate live negotiation.
                    </span>
                    <button className="primary" disabled={busy}>
                      {busy ? "Saving…" : "Publish rules"}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </form>
              )}
              {tab === "Simulator" &&
                (data.products.length ? (
                  <div className="sim-grid">
                    <section className="panel">
                      <div className="section-head">
                        <div>
                          <h2>Build a scenario</h2>
                          <p>
                            All values below are test inputs, not live merchant
                            facts.
                          </p>
                        </div>
                        <Pill tone="amber">Simulation</Pill>
                      </div>
                      <form
                        onSubmit={runSimulation}
                        onChange={() => setResult(null)}
                        key={active}
                      >
                        <label>
                          Product
                          <select
                            name="productId"
                            defaultValue={data.products[0].id}
                          >
                            {data.products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} · {money(p.priceMinor)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="form-grid">
                          <label>
                            Customer target ({workspace.currency})
                            <input
                              name="target"
                              type="number"
                              min="0.01"
                              step="0.01"
                              defaultValue={
                                Math.floor(data.products[0].priceMinor * 0.85) /
                                100
                              }
                              required
                            />
                          </label>
                          <label>
                            Negotiation round
                            <input
                              name="round"
                              type="number"
                              min="1"
                              max={data.policy.rounds}
                              defaultValue="1"
                              required
                            />
                          </label>
                          <label>
                            Available stock
                            <input
                              name="stock"
                              type="number"
                              min="0"
                              defaultValue={data.products[0].stock ?? ""}
                              placeholder="Unknown"
                            />
                          </label>
                          <label>
                            Extra shipping reserve ({workspace.currency})
                            <input
                              name="shipping"
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue="0"
                              required
                            />
                          </label>
                          <label>
                            Comparable median price
                            <input
                              name="median"
                              type="number"
                              min="0.01"
                              step="0.01"
                              placeholder="Optional"
                            />
                          </label>
                          <label>
                            Comparable sales count
                            <input
                              name="samples"
                              type="number"
                              min="0"
                              defaultValue="0"
                            />
                          </label>
                        </div>
                        <p className="fine">
                          The minimum price must already cover your approved
                          costs and tax basis. Extra shipping reserve increases
                          that minimum. This is not a carrier quote or a profit
                          calculation.
                        </p>
                        <button className="primary" disabled={busy}>
                          {busy ? "Evaluating…" : "Run simulation"}
                          <ArrowRight size={17} />
                        </button>
                      </form>
                    </section>
                    <section
                      className={
                        "panel result-panel " + (result ? "has-result" : "")
                      }
                    >
                      <span className="eyebrow">THE MERCHANT’S VIEW</span>
                      {!result ? (
                        <div className="result-empty">
                          <FlaskConical size={38} />
                          <h2>
                            See the reasoning
                            <br />
                            behind the offer.
                          </h2>
                          <p>
                            Test a scenario to see your approved price
                            boundaries in action.
                          </p>
                        </div>
                      ) : (
                        <>
                          <Pill
                            tone={
                              result.status === "unavailable"
                                ? "amber"
                                : "green"
                            }
                          >
                            {result.status === "accepted"
                              ? "Target accepted"
                              : result.status === "counteroffer"
                                ? "Counteroffer"
                                : "Unavailable"}
                          </Pill>
                          <h2 className="result-price">
                            {result.amountMinor
                              ? money(result.amountMinor)
                              : "No offer"}
                          </h2>
                          <p>
                            {result.reason ||
                              "Item price within the limits of this test policy."}
                          </p>
                          {result.amountMinor && (
                            <div className="result-facts">
                              <div>
                                <span>Discount</span>
                                <strong>{money(result.discountMinor)}</strong>
                              </div>
                              <div>
                                <span>Effective minimum</span>
                                <strong>{money(result.floorMinor)}</strong>
                              </div>
                            </div>
                          )}
                          <h3>Why this decision?</h3>
                          {result.reasons.map((s, i) => (
                            <div className="reason" key={i}>
                              <CheckCircle2 size={16} />
                              <span>{s}</span>
                            </div>
                          ))}
                          <p className="fine">
                            No customer offer, inventory reservation, payment or
                            order was created.
                          </p>
                        </>
                      )}
                    </section>
                  </div>
                ) : (
                  <Empty
                    title="Add a product to begin"
                    action={
                      <button
                        className="primary"
                        onClick={() => select("Products")}
                      >
                        Go to products <ArrowRight size={16} />
                      </button>
                    }
                  >
                    Your simulator uses saved catalog prices and merchant rules.
                  </Empty>
                ))}
              {tab === "Activity" && (
                <section className="panel">
                  <div className="section-head">
                    <div>
                      <h2>Workspace history</h2>
                      <p>Latest 20 changes, with the newest first.</p>
                    </div>
                    <Activity size={20} />
                  </div>
                  {data.activity.length ? (
                    data.activity.map((a) => (
                      <div className="activity-row" key={a.id}>
                        <span className="activity-icon">
                          <Clock3 size={17} />
                        </span>
                        <div>
                          <strong>{a.name}</strong>
                          <p>{a.detail}</p>
                        </div>
                        <time>{new Date(a.created_at).toLocaleString()}</time>
                      </div>
                    ))
                  ) : (
                    <Empty title="A clean slate">
                      Your company setup, product changes, published rules and
                      simulations will appear here.
                    </Empty>
                  )}
                </section>
              )}
              {tab === "Settings" && (
                <div className="rules-grid">
                  <section className="panel">
                    <div className="section-head">
                      <div>
                        <h2>Company profile</h2>
                        <p>Separate ownership and data for every company.</p>
                      </div>
                      <Building2 size={20} />
                    </div>
                    {[
                      ["Company", workspace.name],
                      ["Domain", workspace.domain],
                      ["Business type", workspace.industry],
                      ["Currency", workspace.currency],
                      ["Owner", user.email],
                      [
                        "Environment",
                        demo ? "Browser preview" : "Neon development branch",
                      ],
                    ].map(([k, v]) => (
                      <div className="setting-row" key={k}>
                        <span>{k}</span>
                        <strong>{v}</strong>
                      </div>
                    ))}
                  </section>
                  <section className="panel">
                    <div className="section-head">
                      <div>
                        <h2>Before going live</h2>
                        <p>
                          Activation is intentionally unavailable in this build.
                        </p>
                      </div>
                      <LockKeyhole size={20} />
                    </div>
                    {[
                      "Verify domain ownership",
                      "Connect and validate live business data",
                      "Confirm shipping and cost assumptions",
                      "Enforce accepted offers in checkout",
                      "Test payment events and budget reservations",
                    ].map((t) => (
                      <div className="gate" key={t}>
                        <span className="tiny-dot" />
                        {t}
                        <Pill>Required</Pill>
                      </div>
                    ))}
                    <p className="fine">
                      Team invitations, credential management and live
                      activation will be added after the native connector has
                      passed its end-to-end tests.
                    </p>
                  </section>
                </div>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>Negotiation starts with trust.</span>
            <span>
              <ShieldCheck size={13} />
              Merchant-controlled · Separate company workspaces
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal.type === "company"
              ? "Add a company"
              : modal.type === "product"
                ? modal.product
                  ? "Edit product"
                  : "Add a product"
                : modal.type === "import"
                  ? "Import your catalog"
                  : modal.connector.name
          }
          onClose={() => {
            if (!busy) {
              setModal(null);
              setError("");
            }
          }}
        >
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          {modal.type === "company" && (
            <form onSubmit={createCompany}>
              <p className="muted">
                Create an independent workspace. No website changes or external
                access are required.
              </p>
              <label>
                Company name
                <input
                  name="name"
                  placeholder="Your company"
                  required
                  maxLength={100}
                />
              </label>
              <label>
                Store or company domain
                <input name="domain" placeholder="yourcompany.com" required />
                <small>
                  We store the domain now; verification comes before activation.
                </small>
              </label>
              <div className="form-grid">
                <label>
                  Business type
                  <select name="industry">
                    {[
                      "Retail & ecommerce",
                      "Digital products",
                      "Services",
                      "B2B / wholesale",
                      "Other",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Operating currency
                  <select name="currency">
                    {currencies.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="fine">
                One currency per workspace. Currency conversion and
                service-booking adapters are not part of this release.
              </p>
              <button className="primary" disabled={busy}>
                Create workspace <ArrowRight size={16} />
              </button>
            </form>
          )}
          {modal.type === "product" && (
            <form onSubmit={saveProduct}>
              <label>
                Product or service name
                <input
                  name="name"
                  defaultValue={modal.product?.name}
                  required
                  maxLength={150}
                />
              </label>
              <label>
                Unique SKU / reference
                <input
                  name="sku"
                  defaultValue={modal.product?.sku}
                  required
                  maxLength={80}
                  readOnly={!!modal.product}
                />
              </label>
              <div className="form-grid">
                <label>
                  Selling price ({workspace.currency})
                  <input
                    name="price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue={
                      modal.product ? modal.product.priceMinor / 100 : ""
                    }
                    required
                  />
                </label>
                <label>
                  Minimum acceptable price
                  <input
                    name="floor"
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue={
                      modal.product ? modal.product.floorMinor / 100 : ""
                    }
                    required
                  />
                </label>
              </div>
              <label>
                Available units / capacity
                <input
                  name="stock"
                  type="number"
                  min="0"
                  defaultValue={modal.product?.stock ?? ""}
                  placeholder="Leave blank if unknown"
                />
              </label>
              <p className="fine">
                Manual snapshot only. Use a minimum price that already covers
                your approved costs and tax basis.
              </p>
              <button className="primary" disabled={busy}>
                Save product <Check size={16} />
              </button>
            </form>
          )}
          {modal.type === "import" && (
            <>
              <p className="muted">
                Use these exact columns. Prices use major currency units
                (49.00), not cents. Blank stock means unknown.
              </p>
              <pre>
                sku,name,price,floor,stock{"\n"}TOTE-01,Everyday
                tote,49.00,39.00,42
              </pre>
              <a className="text-button" href="/catalog-template.csv" download>
                <Download size={15} />
                Download template
              </a>
              <label>
                CSV file
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async (e) => {
                    setError("");
                    setFilePreview(null);
                    setFileText("");
                    try {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 200000)
                        throw Error("CSV must be smaller than 200 KB.");
                      const text = await file.text();
                      const parsed = parseCatalogCSV(text);
                      setFileText(text);
                      setFilePreview(parsed);
                    } catch (err) {
                      formError(err);
                    }
                  }}
                />
              </label>
              {filePreview && (
                <div className="import-preview">
                  <strong>{filePreview.length} valid products</strong>
                  <p>Existing SKUs will be updated. New SKUs will be added.</p>
                  {filePreview.slice(0, 5).map((p) => (
                    <div key={p.sku}>
                      {p.sku} · {p.name} <span>{money(p.priceMinor)}</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                className="primary"
                disabled={!filePreview || busy}
                onClick={async () => {
                  try {
                    await action("import", { csv: fileText });
                    setModal(null);
                  } catch (e) {
                    formError(e);
                  }
                }}
              >
                Import {filePreview?.length || ""} products{" "}
                <ArrowRight size={16} />
              </button>
            </>
          )}
          {modal.type === "connector" && (
            <>
              <div className="connector-detail">
                <span className={"connector-logo " + modal.connector.color}>
                  {modal.connector.mark}
                </span>
                <div>
                  <Pill>{modal.connector.label}</Pill>
                  <p>{modal.connector.description}</p>
                </div>
              </div>
              <h3>How it connects</h3>
              <p>{modal.connector.method}</p>
              <div className="tags">
                {modal.connector.data.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
              <div className="notice">
                <Info size={17} />
                <span>{modal.connector.next}</span>
              </div>
              {modal.connector.id === "manual" ? (
                <button
                  className="primary"
                  onClick={() => {
                    setModal(null);
                    select("Products");
                  }}
                >
                  Set up catalog <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await action("connector", {
                        connectorId: modal.connector.id,
                      });
                      setModal(null);
                    } catch (e) {
                      formError(e);
                    }
                  }}
                >
                  Save to setup plan <Plus size={16} />
                </button>
              )}
              <p className="fine">
                Saving a connector does not grant access, transmit credentials
                or connect an external service.
              </p>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
function Connector({ c, selected, onClick }) {
  return (
    <button className="connector-card" onClick={onClick}>
      <div className="connector-card-head">
        <span className={"connector-logo " + c.color}>{c.mark}</span>
        <Pill tone={c.stage === "available" ? "green" : ""}>
          {selected && c.id !== "manual" ? "Setup selected" : c.label}
        </Pill>
      </div>
      <h3>
        {c.name}
        <ArrowUpRight size={17} />
      </h3>
      <p>{c.description}</p>
      <div className="tags">
        {c.data.slice(0, 3).map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </button>
  );
}
