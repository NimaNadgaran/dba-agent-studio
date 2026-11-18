"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Activity, ArrowDown, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Boxes, Braces, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Clock3, Code2, Copy, Database, Download, FileCheck2, FileCode2, FileText, Folder, GitBranch, LayoutDashboard, ListChecks, Loader2, LockKeyhole, Menu, MessageSquare, Network, Plus, Search, Settings2, ShieldCheck, Sparkles, Terminal, Workflow, X, Zap } from "lucide-react";
import Markdown, { Diagram } from "./markdown";
import { demoAnswers, demoBrief } from "@/lib/demo";
import { mermaidDiagram } from "@/lib/design";
import { sortedArtifacts } from "@/lib/artifacts";
import { designDocumentNames, designTextOutputs } from "@/lib/design-documents";
import { stageNames, type Artifact, type ProviderConfig, type Session, type SessionSummary } from "@/lib/types";

import { ProviderPicker } from "@/components/provider-picker";
import { normalizeApiKey } from "@/lib/provider-catalog";
import type { ApiKeys } from "@/lib/types";

type Screen = "overview" | "workspaces" | "workspace" | "prompts" | "activity" | "settings";
type Toast = { id: number; message: string; error?: boolean };
type SystemConfig = { config: ProviderConfig; hasApiKey: boolean; configuredProviders: string[]; storage: { mode: string; durable: boolean; outputDirectory: string }; engines: string[] };
const stageIcons = [MessageSquare, ListChecks, Database, Network, GitBranch, Code2];
const stageDescriptions = ["Tell us what you’re building", "Get the requirements right", "Find the right foundation", "Make every relationship clear", "Shape it until it’s right", "Bring your database to life"];
const stageOutputs = ["intake.md", "requirements.md", "dbms-choice.md", "conceptual-model.md", "changelog.md", "schema.sql"];
const defaultConfig: ProviderConfig = { provider: "demo", model: "", baseUrl: "https://api.openai.com/v1" };
const profileNameKey = "dba-profile-name";

function Brand({ small = false }: { small?: boolean }) { return <div className={`brand ${small ? "brand-small" : ""}`}><span className="brand-mark"><Boxes size={23} strokeWidth={1.7} /></span>{!small && <span>DBA<span className="brand-light">agent</span><span className="brand-dot">.</span></span>}</div>; }
function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "green" | "neutral" | "amber" }) { return <span className={`chip chip-${tone}`}>{children}</span>; }
function Button({ children, onClick, kind = "primary", disabled, type = "button", className = "" }: { children: ReactNode; onClick?: () => void; kind?: "primary" | "secondary" | "dark" | "ghost"; disabled?: boolean; type?: "button" | "submit"; className?: string }) { return <button type={type} className={`button button-${kind} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>; }
function dateLabel(value: string) { return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
function timeLabel(value: string) { return new Date(value).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }); }

function SchemaArt() {
  return <div className="schema-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><svg className="art-connections" viewBox="0 0 450 240"><path d="M105 74H205V135H260M205 135V197H320" /><circle cx="205" cy="135" r="4" /><circle cx="105" cy="74" r="3" /><circle cx="320" cy="197" r="3" /></svg><div className="art-table art-table-one"><div><Database size={13} /><b>your_ideas</b><span>01</span></div><p><span className="art-key">PK</span> a better way to build</p><p><span className="art-field" /> something meaningful</p></div><div className="art-table art-table-two"><div><Network size={13} /><b>great_databases</b><Sparkles size={12} /></div><p><span className="art-key">PK</span> thoughtfully designed</p><p><span className="art-key">FK</span> ready for what’s next</p><p><span className="art-field" /> built with confidence</p></div><span className="art-float"><span className="status-dot" /> Everything, connected.</span></div>;
}

export default function Studio() {
  const [screen, setScreen] = useState<Screen>("overview");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [session, setSession] = useState<Session>();
  const [activeStage, setActiveStage] = useState(1);
  const [config, setConfig] = useState<ProviderConfig>(defaultConfig);
  const [system, setSystem] = useState<SystemConfig>();
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});
  const [workspaceConfig, setWorkspaceConfig] = useState<ProviderConfig>(defaultConfig);
  const setProviderKey = (scope: string, key: string) => setApiKeys(current => ({ ...current, [scope]: normalizeApiKey(key) }));
  const [accessToken, setAccessToken] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSequence = useRef(0);
  const [designError, setDesignError] = useState("");
  const [designRunning, setDesignRunning] = useState(false);
  const [designPauseRequested, setDesignPauseRequested] = useState(false);
  const designPause = useRef(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newMode, setNewMode] = useState<"live" | "demo">("live");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [interviewError, setInterviewError] = useState("");
  const [revision, setRevision] = useState("");
  const [preview, setPreview] = useState<Artifact>();
  const [raw, setRaw] = useState(false);
  const [stageCollapsed, setStageCollapsed] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<"stage" | "files" | "diagram" | "history">("stage");
  const [prompts, setPrompts] = useState<{ name: string; content: string }[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState(0);
  const [selectedLog, setSelectedLog] = useState<string>();
  const helpRef = useRef<HTMLDialogElement>(null);
  const profileRef = useRef<HTMLDialogElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [profileDraft, setProfileDraft] = useState("");
  const [profileError, setProfileError] = useState("");
  const announce = (message: string, error = false) => {
    const notification = { id: ++toastSequence.current, message, error };
    setToasts(current => [...current, notification].slice(-3));
  };
  const request = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = sessionStorage.getItem("dba-access-token") || "";
    const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
    const body = await response.json();
    if (!response.ok) {
      if (body.session) setSession(body.session);
      throw new Error(body.error || `Request failed (${response.status}).`);
    }
    return body;
  }, []);
  const refresh = useCallback(async () => { const body = await request("/api/sessions"); setSessions(body.sessions); }, [request]);
  const openWorkspace = useCallback(async (id: string, pushHistory = true) => {
    setBusy("Opening workspace");
    try {
      const body = await request(`/api/sessions/${id}`);
      setSession(body.session); setActiveStage(body.session.stage); setScreen("workspace"); setWorkspaceTab("stage"); setAnswers({}); setRevision(""); setMobileOpen(false);
      if (pushHistory) window.history.pushState({}, "", `?workspace=${id}`);
    } catch (error) { announce((error as Error).message, true); } finally { setBusy(""); }
  }, [request]);
  useEffect(() => {
    setDisplayName((localStorage.getItem(profileNameKey) || "").trim().slice(0, 60));
    const saved = localStorage.getItem("dba-provider-config");
    localStorage.removeItem("dba-agent-configs");
    if (saved) { try { setConfig(JSON.parse(saved)); } catch { localStorage.removeItem("dba-provider-config"); } }
    setAccessToken(sessionStorage.getItem("dba-access-token") || "");
    Promise.all([request("/api/config"), refresh()]).then(([body]) => { setSystem(body); if (!saved) setConfig(body.config); }).catch(error => { announce(error.message, true); }).finally(() => setLoading(false));
    const id = new URLSearchParams(window.location.search).get("workspace");
    if (id) void openWorkspace(id, false);
    const pop = () => { const workspace = new URLSearchParams(window.location.search).get("workspace"); if (workspace) void openWorkspace(workspace, false); else setScreen("overview"); };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [request, refresh, openWorkspace]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setPreview(undefined); setNewOpen(false); setMobileOpen(false); } };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!newOpen && !preview) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.querySelector<HTMLElement>("button,textarea,input,select")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return;
      const elements = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href]')].filter(element => element.getClientRects().length > 0);
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", trap); previous?.focus(); };
  }, [newOpen, preview?.name]);
  useEffect(() => {
    if (!session || session.interview.ready) return;
    const saved = localStorage.getItem(`dba-answers-${session.id}`);
    if (saved) { try { setAnswers(JSON.parse(saved)); } catch { localStorage.removeItem(`dba-answers-${session.id}`); } }
  }, [session?.id]);

  useEffect(() => { if (session) setWorkspaceConfig(session.config); }, [session?.id, session?.config]);

  async function applyWorkspaceConfig() {
    if (!session || session.mode !== "live") return session;
    if (JSON.stringify(session.config) === JSON.stringify(workspaceConfig) && !Object.keys(session.agentConfigs || {}).length) return session;
    const body = await request(`/api/sessions/${session.id}`, { method: "POST", body: JSON.stringify({ action: "config", version: session.version, config: workspaceConfig, agentConfigs: {} }) });
    setSession(body.session);
    return body.session as Session;
  }

  async function saveWorkspaceConfig() {
    setBusy("Saving agent configuration");
    try { await applyWorkspaceConfig(); announce("Agent configuration saved for all workflow stages. Temporary keys remain in memory."); }
    catch (error) { announce((error as Error).message, true); } finally { setBusy(""); }
  }

  function navigate(next: Screen) { setScreen(next); setMobileOpen(false); if (next !== "workspace") window.history.pushState({}, "", "/"); if (next === "prompts" && !prompts.length) request("/api/prompts").then(body => setPrompts(body.prompts)).catch(error => announce(error.message, true)); }
  async function createWorkspace(mode: "demo" | "live") {
    if (mode === "live" && config.provider === "demo") { setNewOpen(false); navigate("settings"); announce("Connect a model first, or explore the offline example."); return; }
    setBusy("Creating workspace");
    try {
      const body = await request("/api/sessions", { method: "POST", body: JSON.stringify({ description: mode === "demo" ? demoBrief : description, config: mode === "demo" ? defaultConfig : config, agentConfigs: mode === "live" ? {} : undefined }) });
      setNewOpen(false); setDescription(""); setSession(body.session); setActiveStage(1); setWorkspaceTab("stage"); setScreen("workspace"); setAnswers({});
      window.history.pushState({}, "", `?workspace=${body.session.id}`); await refresh();
      announce(mode === "demo" ? "Example ready. Walk through each stage at your own pace." : "Workspace created. Your brief is ready for intake.");
    } catch (error) { announce((error as Error).message, true); } finally { setBusy(""); }
  }
  async function fillAutomatically() {
    if (!session || busy) return;
    setBusy("Drafting interview answers from your brief and earlier answers"); setInterviewError("");
    try {
      const current = await applyWorkspaceConfig();
      const body = await request(`/api/sessions/${session.id}`, { method: "POST", body: JSON.stringify({ action: "autofill", version: current!.version, answers, apiKeys }) });
      setSession(body.session); setAnswers(body.answers);
      localStorage.setItem(`dba-answers-${session.id}`, JSON.stringify(body.answers));
      announce("Draft answers filled. Review assumptions and edit before submitting; your existing answers were kept.");
    } catch (error) { setInterviewError((error as Error).message); announce((error as Error).message, true); }
    finally { setBusy(""); }
  }

  async function run(action: string, extra: object = {}) {
    if (!session || busy) return;
    if (action === "interview") setInterviewError("");
    if (action === "design") { setDesignError(""); setDesignRunning(true); setDesignPauseRequested(false); designPause.current = false; }
    setBusy(action === "sql" ? "Compiling and executing SQL in an isolated engine" : action === "interview" ? "Reviewing answers and planning follow-ups" : action === "revision" ? "Propagating your revision across every artifact" : `Working on ${stageNames[session.stage - 1].toLowerCase()}`);
    try {
      let current = (await applyWorkspaceConfig())!;
      let body: { session: Session };
      let parts = 0;
      do {
        if (action === "design" && current.mode === "live") {
          const draft = current.designDraft;
          setBusy(draft ? "Designing table " + (draft.tables.length + 1) + " of " + draft.plan.tables.length + ": " + draft.plan.tables[draft.tables.length].name : "Planning the design and table dependencies");
        }
        body = await request("/api/sessions/" + current.id, { method: "POST", body: JSON.stringify({ action, version: current.version, apiKeys, ...(current.mode === "live" ? { agentConfigs: {} } : {}), ...extra }) });
        current = body.session;
        setSession(current);
        parts += 1;
        if (action === "design" && !current.design) {
          if (designPause.current) { announce("Design paused. Completed parts are saved; resume whenever you are ready."); await refresh(); return; }
          if (parts >= 31) throw new Error("Design paused at the request safety limit. Saved parts are kept; resume to continue.");
        }
      } while (action === "design" && current.mode === "live" && !current.design);
      setAnswers({}); setRevision(""); localStorage.removeItem("dba-answers-" + session.id);
      if (action === "interview") {
        if (body.session.interview.ready) { setActiveStage(3); announce("Requirements complete. Continue with DBMS selection."); }
        else { announce("Answers saved. Please complete the targeted follow-up questions below."); }
        window.scrollTo({ top: 0, behavior: "smooth" });
        await refresh(); return;
      }
      await refresh();
      if (action === "sql") announce(body.session.completedStages.includes(6) ? body.session.validation?.status === "passed" ? "Schema and seed executed successfully. Your database bundle is ready." : "SQL compiled. Target-engine execution is still required; see validation report." : body.session.stage === 5 ? "Validation repaired the design. Please review and approve the changed version." : "Validation failed. Review the validation report and refine the design.", body.session.validation?.status === "failed");
      else announce(action === "approve" ? "Design approved. SQL generation is now unlocked." : action === "revision" ? "Revision applied. All affected files are updated; please review again." : "Stage output saved. Review it before moving forward.");
    } catch (error) { if (action === "interview") setInterviewError((error as Error).message); if (action === "design") setDesignError((error as Error).message); announce((error as Error).message, true); } finally { setBusy(""); if (action === "design") setDesignRunning(false); }
  }
  async function download() {
    if (!session) return;
    try {
      const token = sessionStorage.getItem("dba-access-token");
      const response = await fetch(`/api/sessions/${session.id}/export`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${session.title.replace(/[^a-zA-Z0-9-]/g, "-")}-v${session.designVersion}.zip`; anchor.click(); URL.revokeObjectURL(url);
      announce("Bundle exported, including stage artifacts and trace logs.");
    } catch (error) { announce((error as Error).message, true); }
  }
  async function copy(content: string) { try { await navigator.clipboard.writeText(content); announce("Copied to clipboard."); } catch { announce("Clipboard unavailable. Use the download instead.", true); } }
  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    try {
      sessionStorage.setItem("dba-access-token", accessToken); localStorage.setItem("dba-provider-config", JSON.stringify(config));
      if (session && ((config.provider === "demo") === (session.mode === "demo"))) {
        const body = await request(`/api/sessions/${session.id}`, { method: "POST", body: JSON.stringify({ action: "config", config, version: session.version, agentConfigs: session.mode === "live" ? {} : undefined }) });
        setSession(body.session);
      }
      const body = await request("/api/config"); setSystem(body); await refresh();
      announce("Configuration saved. Temporary API keys stay in memory only.");
    } catch (error) { announce((error as Error).message, true); }
  }
  function saveProfile(event: FormEvent) {
    event.preventDefault();
    const name = profileDraft.trim();
    try {
      if (name) localStorage.setItem(profileNameKey, name);
      else localStorage.removeItem(profileNameKey);
    } catch {
      setProfileError("Your browser could not save this profile.");
      return;
    }
    setDisplayName(name);
    profileRef.current?.close();
    announce("Profile saved.");
  }

  const initials = displayName.split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] || "").join("").toLocaleUpperCase() || "YO";
  const visibleSessions = sessions.filter(item => `${item.title} ${item.description} ${item.dbms || ""}`.toLowerCase().includes(search.toLowerCase()));
  const completed = sessions.filter(item => item.completedStages.includes(6)).length;
  const artifactCount = sessions.reduce((total, item) => total + item.artifacts, 0);
  const title = screen === "workspace" ? session?.title || "Workspace" : screen === "overview" ? "Overview" : screen === "workspaces" ? "Your workspaces" : screen === "prompts" ? "Prompt library" : screen === "activity" ? "Activity & traces" : "Settings";
  const currentArtifacts = session ? sortedArtifacts(session.artifacts) : [];
  const designOutputs = session?.design ? designTextOutputs(session) : session?.designTextParts ?? [];

  function artifactList(items: Artifact[]) {
    return <div className="artifact-list">{items.map(item => <button className="artifact-row" key={item.name} onClick={() => { setRaw(false); setPreview(item); }}><span className={`file-icon ${item.name.endsWith(".sql") ? "sql-icon" : ""}`}>{item.name.endsWith(".sql") ? <FileCode2 size={18} /> : <FileText size={18} />}</span><span><b>{item.name}</b><small>Stage {item.stage} · {item.version ? `v${item.version}` : "Source"} · {(new Blob([item.content]).size / 1024).toFixed(1)} KB</small></span><ArrowUpRight size={16} /></button>)}</div>;
  }
  function workspaceList() {
    return <div className="project-list">{visibleSessions.length ? visibleSessions.map(item => <button className="project-row" key={item.id} onClick={() => void openWorkspace(item.id)}><span className="project-icon"><Database size={21} /></span><span className="project-main"><b>{item.title}</b><small>{item.dbms || "Choosing a foundation"} <span>·</span> {item.mode === "demo" ? "Offline example" : "Live AI"}</small></span><span className="project-progress"><span>{item.completedStages.length} of 6 stages</span><span className="mini-progress"><i style={{ width: `${item.completedStages.length / 6 * 100}%` }} /></span></span><Chip tone={item.completedStages.includes(6) ? "green" : "neutral"}>{item.completedStages.includes(6) ? "Ready to export" : `Stage ${item.stage}`}</Chip><span className="project-date">{dateLabel(item.updatedAt)}</span><ArrowUpRight size={18} /></button>) : <div className="empty-workspaces"><div className="empty-icon"><Folder size={25} /></div><h3>{search ? "No matching workspaces" : "Your next great idea starts here"}</h3><p>{search ? "Try another name or database engine." : "Create a design workspace, or take the guided example for a spin."}</p>{!search && <Button kind="secondary" onClick={() => void createWorkspace("demo")}>Explore the example <ArrowRight size={15} /></Button>}</div>}</div>;
  }
  function outputPanel(stage: number) {
    const items = currentArtifacts.filter(item => stage === 4 ? designDocumentNames.includes(item.name) : item.stage === stage);
    return <section className="panel output-panel"><div className="panel-header"><div><span className="eyebrow">LIVING ARTIFACTS</span><h3>What this stage produces</h3></div><span className="count-pill">{items.length}</span></div>{items.length ? artifactList(items) : <div className="output-pending"><FileText size={27} /><p>Your output will appear here</p><small>Saved automatically, ready to inspect or export.</small></div>}<div className="panel-footnote"><ShieldCheck size={14} /> Every output is persisted before you move on.</div></section>;
  }
  function stagePanel() {
    if (!session) return null;
    const finished = session.completedStages.includes(activeStage as 1);
    const locked = activeStage > session.stage && !finished;
    const Icon = stageIcons[activeStage - 1];
    return <div className="stage-grid"><section className="panel stage-panel"><div className="stage-heading"><span className="stage-large-icon"><Icon size={23} /></span><div><span className="eyebrow">STAGE 0{activeStage} / 06</span><h2>{stageNames[activeStage - 1]}</h2></div><div className="stage-heading-actions"><Chip tone={finished ? "green" : locked ? "neutral" : "amber"}>{finished ? <><Check size={12} /> Complete</> : locked ? <><LockKeyhole size={11} /> Locked</> : "In progress"}</Chip>{activeStage === 2 && !locked && !session.interview.ready && <Button kind="secondary" disabled={Boolean(busy)} onClick={() => void fillAutomatically()}><Sparkles size={13} />Fill automatically</Button>}<button className="document-expand stage-toggle" aria-expanded={!stageCollapsed} onClick={() => setStageCollapsed(value => !value)}>{stageCollapsed ? "Show more" : "Show less"}</button></div></div>
      <div className={`stage-body ${stageCollapsed ? "collapsed" : ""}`}>
      {locked ? <div className="empty-state"><LockKeyhole size={28} /><h3>Good foundations come first.</h3><p>Complete stage {session.stage} before starting this step.</p><Button onClick={() => setActiveStage(session.stage)}>Back to current stage <ArrowLeft size={14} /></Button></div> : <>
      {activeStage === 1 && <><p className="stage-intro">Every thoughtful database begins with understanding the system. Here’s the brief we’re working from.</p><div className="brief-box"><span className="eyebrow">YOUR SYSTEM BRIEF</span><p>{session.description}</p></div>{session.intake && <div className="intake-result"><h3>Here’s what we understood</h3><p>{session.intake.summary}</p><div className="entity-tags">{session.intake.actors.map(actor => <span key={actor}>{actor}</span>)}</div><div className="small-divider" /><h4>Candidate entities</h4>{session.intake.entities.map(entity => <div className="check-line" key={entity}><Check size={14} /><span>{entity}</span></div>)}</div>}{!finished ? <Button disabled={Boolean(busy)} onClick={() => void run("intake")}><Sparkles size={16} /> Understand my system <ArrowRight size={15} /></Button> : <Button onClick={() => setActiveStage(2)}>Continue to the interview <ArrowRight size={15} /></Button>}</>}
      {activeStage === 2 && <>{session.interview.ready ? <div className="interview-complete"><span className="success-icon"><CheckCheck size={25} /></span><h3>A clearer picture. A stronger foundation.</h3><p>{session.interview.rationale}</p><div className="info-note"><MessageSquare size={16} /><span>{session.interview.rounds.length} rounds completed, including an adaptive follow-up. All seven requirement categories covered.</span></div><Button onClick={() => setActiveStage(3)}>Find the right DBMS <ArrowRight size={15} /></Button></div> : <><p className="stage-intro">{session.interview.rounds.length ? "A few thoughtful follow-ups, based on your answers. We’ll decide when the requirements are complete." : "Let’s get the important details right. Seven perspectives, one complete picture."}</p><div className="interview-round"><span className="status-dot" /> Round {session.interview.rounds.length + 1} <span>·</span> {session.interview.pending.length} questions{session.mode === "demo" && <button onClick={() => setAnswers(Object.fromEntries(session.interview.pending.map(question => [question.id, demoAnswers[question.id] || ""])))}>Fill example answers <Sparkles size={12} /></button>}</div>{session.interview.rounds.length > 0 && <div className="info-note" role="status"><MessageSquare size={16} /><span>More detail is needed before stage 3: {session.interview.rationale}</span></div>}<p className="helper-text">Automatic answers are editable drafts. Review any assumptions before submitting. At least one follow-up round is required.</p>{interviewError && <p className="provider-result provider-error" role="alert">{interviewError} Your answers are kept; correct the issue and retry.</p>}<form onSubmit={event => { event.preventDefault(); void run("interview", { answers }); }}><div className="question-list">{session.interview.pending.map((question, index) => <label className="question" key={question.id}><span className="question-category"><span>{String(index + 1).padStart(2, "0")}</span>{question.category}</span><b>{question.question}</b><textarea disabled={Boolean(busy)} required minLength={2} maxLength={12000} value={answers[question.id] || ""} onChange={event => { const next = { ...answers, [question.id]: event.target.value }; setAnswers(next); localStorage.setItem(`dba-answers-${session.id}`, JSON.stringify(next)); }} placeholder={question.hint} rows={3} /></label>)}</div><Button type="submit" disabled={Boolean(busy)}><Sparkles size={15} /> {session.interview.rounds.length ? "Review follow-up answers" : "Review my answers"}<ArrowRight size={15} /></Button></form></>}</>}
      {activeStage === 3 && <><p className="stage-intro">The best database is the one that fits your workload—not just the most popular option.</p>{session.choice ? <><div className="selected-engine"><span><Database size={28} /></span><div><small>RECOMMENDED FOUNDATION</small><h2>{session.choice.selected}</h2></div><Check size={21} /></div><p className="body-copy">{session.choice.rationale}</p><div className="engine-comparison">{session.choice.comparison.map(item => <div key={item.dbms}><span><b>{item.dbms}</b><small>{item.verdict}</small></span><span className="score-track"><i style={{ width: `${item.score * 10}%` }} /></span><b>{item.score}<small>/10</small></b></div>)}</div><Button onClick={() => setActiveStage(4)}>Build the design <ArrowRight size={15} /></Button></> : <><div className="engine-options">{["PostgreSQL", "MySQL / MariaDB", "SQLite", "SQL Server"].map(name => <div key={name}><Database size={19} /><b>{name}</b><span>Compared against your needs</span></div>)}</div><Button disabled={Boolean(busy)} onClick={() => void run("selection")}><Sparkles size={15} /> Compare & select a DBMS <ArrowRight size={15} /></Button></>}</>}
      {activeStage === 4 && <><p className="stage-intro">One API request returns four Markdown sections. Each section starts with # and is saved separately for download. No schema, SQL, or table generation runs here.</p>{designError && <p className="provider-result provider-error" role="alert">{designError} Your saved requirements are unchanged. Completed design parts are kept. Resume generation or adjust the model in Agent configuration.</p>}{session.design || session.designTextParts ? <><section className="design-documentation"><div className="design-text-outputs">{designOutputs.map((output, index) => <section className="design-text-output" key={output.name} aria-label={output.title}><h3>{index + 1}. {output.title}</h3><div className="design-output-markdown"><Markdown content={output.content} /></div></section>)}</div></section><Button onClick={() => void download()}>Download the four-part output <ArrowRight size={15} /></Button></> : <><p className="helper-text">Send one full prompt to the selected API. The response is saved as four Markdown files plus stage-4-output.md.</p><div className="design-deliverables">{["Conceptual model explanation", "Logical schema, types & indexes", "Functional dependencies & 3NF analysis", "Assumptions & remaining ambiguity"].map((item, index) => <div key={item}><span>0{index + 1}</span><FileCheck2 size={18} /><b>{item}</b><Check size={14} /></div>)}</div><Button disabled={Boolean(busy)} onClick={() => void run("design")}><Sparkles size={15} /> "Run one Stage 4 prompt" <ArrowRight size={15} /></Button></>}</>}
      {activeStage === 5 && <><p className="stage-intro">Good design is a conversation. Ask for a change in plain language—we’ll carry it through every affected file.</p><div className="revision-status"><span className="version-badge">v{session.designVersion}</span><span><b>{session.approvedAt ? "Design approved" : "Ready for your review"}</b><small>{session.approvedAt ? `Approved ${dateLabel(session.approvedAt)} at ${timeLabel(session.approvedAt)}` : "SQL stays locked until you explicitly approve this version."}</small></span><GitBranch size={21} /></div><form onSubmit={event => { event.preventDefault(); void run("revision", { request: revision }); }}><label className="field-label" htmlFor="revision">What would you like to change?</label><textarea id="revision" rows={4} minLength={8} maxLength={12000} required value={revision} onChange={event => setRevision(event.target.value)} placeholder="Add a new entity, change a relationship, or switch the target DBMS…" /><div className="revision-suggestions">{(session.mode === "demo" ? ["Add an optional phone number to members", "Switch to SQLite"] : ["Review deletion policies and preserve audit history", "Make the membership relationship many-to-many"]).map(item => <button type="button" key={item} onClick={() => setRevision(item)}><Plus size={11} /> {item}</button>)}</div>{session.mode === "demo" && <p className="helper-text">Offline revisions support adding phone numbers and DBMS switches only. Use live AI for arbitrary changes.</p>}<Button type="submit" kind="secondary" disabled={Boolean(busy)}><GitBranch size={15} /> Apply revision</Button></form><div className="approval-box"><ShieldCheck size={22} /><div><h4>Your design. Your sign-off.</h4><p>Review the documents and assumptions. Any revision invalidates approval and removes stale SQL.</p></div>{session.approvedAt ? <Button onClick={() => setActiveStage(6)}>Continue to SQL <ArrowRight size={14} /></Button> : <Button disabled={Boolean(busy)} onClick={() => void run("approve")}><Check size={15} /> Approve this design</Button>}</div></>}
      {activeStage === 6 && <><p className="stage-intro">From a considered design to executable SQL. Realistic data, safe insertion order, and transparent validation.</p>{!session.approvedAt ? <div className="info-note"><LockKeyhole size={19} /><span>The design changed during validation. Review the repaired version and explicitly approve it again.</span><Button onClick={() => setActiveStage(5)}>Review design</Button></div> : <><div className="sql-file-cards"><div><FileCode2 size={25} /><h3>schema.sql</h3><p>Tables, keys, constraints & indexes</p></div><div><Braces size={25} /><h3>seed.sql</h3><p>Meaningful, constraint-safe sample data</p></div></div>{session.validation && <div className={`validation-result validation-${session.validation.status}`}><div><ShieldCheck size={23} /><span><b>{session.validation.status === "passed" ? "Executed. Checked. Ready." : session.validation.status === "structural" ? "Compiled, not engine-executed" : "Validation found a problem"}</b><small>{session.validation.engine} · {session.validation.durationMs} ms · {session.validation.attempts} attempt(s)</small></span></div>{session.validation.checks.map(check => <p key={check.name}>{check.passed ? <Check size={13} /> : <X size={13} />}<b>{check.name}</b><span>{check.detail}</span></p>)}</div>}{!session.completedStages.includes(6) ? <Button disabled={Boolean(busy)} onClick={() => void run("sql")}><Terminal size={15} /> Generate & validate SQL <ArrowRight size={15} /></Button> : <div className="button-row"><Button onClick={() => void download()}><Download size={16} /> Download complete bundle</Button><Button kind="secondary" disabled={Boolean(busy)} onClick={() => void run("sql")}>Revalidate <ShieldCheck size={15} /></Button></div>}<p className="helper-text">PostgreSQL and SQLite execute in isolated engines. MySQL and SQL Server receive structural checks only. No production database is touched.</p></>}</>}
      </>}
      </div>
    </section><aside className="stage-aside">{outputPanel(activeStage)}{session.mode === "live" && <section className="panel agent-assignment"><span className="eyebrow">WORKSPACE AGENT</span><h3>Agent configuration</h3><p className="helper-text">One provider and model for every stage, including intake and interview. Changes are also saved when you run a stage.</p><ProviderPicker allowDemo={false} config={workspaceConfig} onChange={setWorkspaceConfig} apiKeys={apiKeys} onKeyChange={setProviderKey} configuredProviders={system?.configuredProviders} serverConfig={system?.config} hasServerKey={system?.hasApiKey} /><Button kind="secondary" disabled={Boolean(busy)} onClick={() => void saveWorkspaceConfig()}>Save agent configuration</Button></section>}<div className="quiet-note"><div className="note-icon"><Sparkles size={17} /></div><h4>Nothing behind the curtain.</h4><p>Inspect every prompt, answer, decision, and retry. Your workflow is transparent by design.</p><button onClick={() => navigate("activity")}>View the activity trail <ArrowUpRight size={13} /></button></div></aside></div>;
  }

  return <div className="app-shell"><div className={`sidebar-backdrop ${mobileOpen ? "visible" : ""}`} onClick={() => setMobileOpen(false)} /><aside className={`sidebar ${mobileOpen ? "open" : ""}`}><div className="sidebar-brand"><Brand /><span className="studio-label">STUDIO</span></div>
      <button type="button" className="workspace-switch" aria-current={screen === "workspaces" ? "page" : undefined} onClick={() => { setSearch(""); navigate("workspaces"); }}><span className="workspace-avatar" aria-hidden="true">P</span><span><b>Personal workspace</b><small>{loading ? "Browse saved designs" : `${sessions.length} saved ${sessions.length === 1 ? "design" : "designs"}`}</small></span></button>
      <span className="nav-label">WORKSPACE</span><nav aria-label="Main navigation">{([{ id: "overview", label: "Overview", icon: LayoutDashboard }, { id: "workspaces", label: "Design workspaces", icon: Folder }, { id: "prompts", label: "Prompt library", icon: BookOpen }, { id: "activity", label: "Activity & traces", icon: Activity }] as const).map(item => <button key={item.id} className={`nav-link ${screen === item.id || (item.id === "workspaces" && screen === "workspace") ? "active" : ""}`} onClick={() => navigate(item.id)}><item.icon size={18} strokeWidth={1.7} />{item.label}{item.id === "workspaces" && <span className="nav-count">{sessions.length}</span>}</button>)}</nav><div className="sidebar-recent"><span className="nav-label">RECENT DESIGNS</span>{sessions.slice(0, 3).map(item => <button key={item.id} onClick={() => void openWorkspace(item.id)}><span className={`tiny-square ${item.completedStages.includes(6) ? "complete" : ""}`} />{item.title}<ChevronRight size={12} /></button>)}{!sessions.length && <span className="no-recent">A little room for your next idea.</span>}</div><div className="sidebar-bottom"><div className="local-card"><span className="local-card-icon"><ShieldCheck size={19} /></span><h4>Your work, in your hands.</h4><p>Saved locally. Export anytime.<br />No black boxes, no lock-in.</p><button onClick={() => navigate("settings")}>Workspace settings <ArrowUpRight size={13} /></button></div><button className={`nav-link ${screen === "settings" ? "active" : ""}`} onClick={() => navigate("settings")}><Settings2 size={18} />Settings & providers</button><div className="profile"><span aria-hidden="true">{initials}</span><div><b>{displayName || "Your workspace"}</b><small><span className="status-dot" /> Personal profile</small></div></div></div></aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumbs"><button className="mobile-menu icon-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><span>Workspace</span><ChevronRight size={13} /><b>{title}</b></div><div className="topbar-actions"><span className="environment-badge"><span className="status-dot" /> Localhost</span><button className="help-button icon-button" type="button" onClick={() => helpRef.current?.showModal()} aria-label="Open workflow help" aria-haspopup="dialog"><CircleHelp size={19} /></button><button type="button" className="header-avatar" aria-label="Open personal profile" aria-haspopup="dialog" title={displayName || "Personal profile"} onClick={() => { setProfileDraft(displayName); setProfileError(""); profileRef.current?.showModal(); }}>{initials}</button></div></header>
    <dialog ref={profileRef} className="workflow-help profile-dialog" aria-labelledby="profile-title">
      <button type="button" className="modal-close icon-button" onClick={() => profileRef.current?.close()} aria-label="Close personal profile"><X size={20} /></button>
      <h2 id="profile-title">Personal profile</h2>
      <p>Your display name and initials are saved in this browser.</p>
      <form onSubmit={saveProfile}>
        <label htmlFor="profile-name">Display name</label>
        <input id="profile-name" autoComplete="nickname" maxLength={60} placeholder="Your name" value={profileDraft} onChange={event => { setProfileDraft(event.target.value); setProfileError(""); }} aria-describedby="profile-name-hint" />
        <p id="profile-name-hint">Leave blank to use the default initials.</p>
        {profileError && <p role="alert">{profileError}</p>}
        <Button type="submit">Save profile</Button>
      </form>
      <div className="button-row profile-links">
        <Button kind="secondary" onClick={() => { profileRef.current?.close(); setSearch(""); navigate("workspaces"); }}>My designs</Button>
        <Button kind="secondary" onClick={() => { profileRef.current?.close(); navigate("settings"); }}>Settings &amp; providers</Button>
      </div>
    </dialog>
    <dialog ref={helpRef} className="workflow-help" aria-labelledby="workflow-help-title">
      <button type="button" className="modal-close icon-button" onClick={() => helpRef.current?.close()} aria-label="Close workflow help"><X size={20} /></button>
      <h2 id="workflow-help-title">How to use DBA Agent Studio</h2>
      <p>Choose <strong>New design</strong> to describe your system. Include who uses it, what they do, and what data you need to keep. For a walkthrough without an API key, choose <strong>Explore an example</strong> on the overview.</p>
      <h3>From brief to SQL</h3>
      <ol>
        <li><strong>Intake:</strong> Review how the studio understood your brief.</li>
        <li><strong>Interview:</strong> Answer questions and follow-ups about your requirements.</li>
        <li><strong>DBMS selection:</strong> Review the recommended database engine and why it fits.</li>
        <li><strong>Design:</strong> Build the schema and inspect the relationships, normalization, and assumptions.</li>
        <li><strong>Review:</strong> Request changes and approve the design.</li>
        <li><strong>SQL:</strong> Generate and validate the SQL, then export the bundle.</li>
      </ol>
      <p>Open <strong>Personal workspace</strong> to resume a saved design. For live AI, choose a provider and model in <strong>Settings &amp; providers</strong>.</p>
      <Button kind="secondary" onClick={() => { helpRef.current?.close(); navigate("prompts"); }}>Open prompt library <ArrowUpRight size={15} /></Button>
    </dialog>
    <main className="main-content">{loading ? <div className="initial-loading"><Loader2 size={25} className="spin" /><p>Getting your studio ready…</p></div> : <>
    {(screen === "overview" || screen === "workspaces") && <><div className="page-heading"><div><div className="overline"><span className="tiny-spark">✳</span> A LITTLE STRUCTURE. A LOT OF POSSIBILITY.</div><h1>{screen === "overview" ? <>Good ideas deserve<br className="mobile-break" /> great databases<span className="heading-dot">.</span></> : <>A home for your next big idea<span className="heading-dot">.</span></>}</h1><p>{screen === "overview" ? "From your first thought to your final schema. Let’s make something solid." : "Pick up where you left off. Every stage, answer, and artifact is right here."}</p></div><Button onClick={() => { setNewMode("live"); setNewOpen(true); }}><Plus size={17} /> New design</Button></div>
    {screen === "overview" && <><section className="hero"><div className="hero-copy"><span className="hero-eyebrow"><Sparkles size={13} /> YOUR AI DATABASE DESIGN PARTNER</span><h2>A thoughtful process.<br />A powerful foundation.</h2><p>Describe your system. Explore the right questions.<br className="desktop-break" /> Build a database that’s made for what comes next.</p><div className="hero-actions"><Button onClick={() => { setNewMode("live"); setNewOpen(true); }}>Start a new design <ArrowUpRight size={16} /></Button><button className="hero-link" onClick={() => void createWorkspace("demo")}>Explore an example <ArrowRight size={14} /></button></div><div className="hero-foot"><span><Check size={12} /> Six connected stages</span><span><Check size={12} /> You’re in control</span><span><Check size={12} /> SQL, ready to run</span></div></div><SchemaArt /></section>
    <div className="stats-grid"><div className="stat-card"><span className="stat-icon"><Folder size={19} /></span><div><span>Total workspaces</span><b>{String(sessions.length).padStart(2, "0")}<small>ideas taking shape</small></b></div><ArrowUpRight size={15} /></div><div className="stat-card"><span className="stat-icon green"><FileCheck2 size={19} /></span><div><span>Ready to build</span><b>{String(completed).padStart(2, "0")}<small>completed workflows</small></b></div><ArrowUpRight size={15} /></div><div className="stat-card"><span className="stat-icon peach"><FileText size={19} /></span><div><span>Living artifacts</span><b>{String(artifactCount).padStart(2, "0")}<small>clear, connected outputs</small></b></div><ArrowUpRight size={15} /></div><div className="stat-card"><span className="stat-icon blue"><Database size={19} /></span><div><span>Database engines</span><b>04<small>the right fit, not a guess</small></b></div><span className="tiny-pill">SUPPORTED</span></div></div></>}
    <section className="workspace-section"><div className="section-heading"><div><h2>{screen === "overview" ? "Your design workspaces" : "All workspaces"}<span className="count-pill">{sessions.length}</span></h2><p>A clearer path from “what if” to “what’s next.”</p></div>{screen === "overview" ? <button className="text-button" onClick={() => navigate("workspaces")}>View all workspaces <ArrowRight size={14} /></button> : <label className="workspace-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search workspaces…" /></label>}</div>{workspaceList()}</section>
    {screen === "overview" && <section className="workflow-section"><div className="section-heading"><div><span className="eyebrow">A PROCESS YOU CAN TRUST</span><h2>Six stages. Zero guesswork.</h2></div><span className="workflow-caption">Review the output. Then take the next step. <ArrowDown size={13} /></span></div><div className="pipeline-cards">{stageNames.map((name, index) => { const Icon = stageIcons[index]; return <button key={name} className={`pipeline-card pipeline-${index}`} onClick={() => { if (session) { navigate("workspace"); setActiveStage(index + 1); } else { setNewMode("demo"); setNewOpen(true); } }}><div><span className="pipeline-icon"><Icon size={19} strokeWidth={1.6} /></span><span className="pipeline-number">0{index + 1}</span></div><h3>{name}</h3><p>{stageDescriptions[index]}</p><span className="pipeline-output">{stageOutputs[index]} <ArrowUpRight size={12} /></span>{index < 5 && <span className="pipeline-connector"><ChevronRight size={12} /></span>}</button>; })}</div></section>}
    <footer className="page-footer"><span><span className="status-dot" /> {system?.storage.durable === false ? "Temporary storage · configure Redis before deploying" : "Your progress is saved. Your ideas are yours."}</span><span>THOUGHTFULLY ORCHESTRATED <span className="footer-spark">✳</span> DBA AGENT</span></footer></>}
    {screen === "workspace" && session && <><div className="workspace-page-heading"><button className="back-link" onClick={() => navigate("workspaces")}><ArrowLeft size={14} /> All workspaces</button><div className="workspace-title-row"><div><div className="workspace-title"><h1>{session.title}<span className="heading-dot">.</span></h1><Chip tone={session.mode === "demo" ? "amber" : "green"}>{session.mode === "demo" ? "Offline example" : "Live AI"}</Chip></div><p>{session.choice?.selected || "A new foundation, taking shape"} <span>·</span> {session.designVersion ? `Design v${session.designVersion}` : "Design in progress"} <span>·</span> Saved {timeLabel(session.updatedAt)}</p></div><Button kind="secondary" onClick={() => void download()}><ArrowDownToLine size={16} /> Export bundle</Button></div></div>{session.mode === "demo" && <div className="demo-banner"><Sparkles size={15} /><span>You’re exploring the offline coworking example. No LLM calls or API credits are used.</span><button onClick={() => navigate("settings")}>Connect live AI <ArrowUpRight size={13} /></button></div>}<div className="stage-stepper">{stageNames.map((name, index) => <button key={name} onClick={() => { setActiveStage(index + 1); setWorkspaceTab("stage"); }} className={`${activeStage === index + 1 ? "selected" : ""} ${session.completedStages.includes((index + 1) as 1) ? "done" : ""}`}><span>{session.completedStages.includes((index + 1) as 1) ? <Check size={14} /> : `0${index + 1}`}</span><b>{name}</b><small>{session.completedStages.includes((index + 1) as 1) ? "Complete" : index + 1 === session.stage ? "In progress" : "Up next"}</small></button>)}</div><div className="workspace-tabs">{([{ id: "stage", label: "Stage workspace", icon: Workflow }, { id: "files", label: `Artifacts (${currentArtifacts.length})`, icon: FileText }, { id: "diagram", label: "Relationship map", icon: Network }, { id: "history", label: "Version history", icon: GitBranch }] as const).map(tab => <button key={tab.id} className={workspaceTab === tab.id ? "active" : ""} onClick={() => setWorkspaceTab(tab.id)}><tab.icon size={15} />{tab.label}</button>)}<span><span className="status-dot" /> Autosaved</span></div>{workspaceTab === "stage" && stagePanel()}{workspaceTab === "files" && <section className="panel"><div className="panel-header"><div><span className="eyebrow">ONE CONSISTENT SOURCE OF TRUTH</span><h3>Your living documents</h3></div><Button kind="secondary" onClick={() => void download()}><Download size={15} /> Download all</Button></div>{currentArtifacts.length ? artifactList(currentArtifacts) : <div className="empty-state"><FileText size={25} /><h3>Your story is just beginning.</h3><p>Complete the intake to create your first artifact.</p></div>}</section>}{workspaceTab === "diagram" && <section className="panel diagram-panel"><div className="panel-header"><div><span className="eyebrow">EVERYTHING, CONNECTED</span><h3>Entity relationship map</h3></div>{session.design && <Chip tone="green">{session.design.tables.length} entities · v{session.designVersion}</Chip>}</div>{session.design ? <><Diagram source={mermaidDiagram(session.design)} /><div className="panel-footnote"><Network size={14} /> Rendered from the same model as your SQL. The four stage-4 documents explain this model in text.</div></> : <div className="empty-state"><Network size={28} /><h3>A picture, once the pieces are ready.</h3><p>Your relationship map appears after design generation.</p></div>}</section>}{workspaceTab === "history" && <section className="panel"><div className="panel-header"><div><span className="eyebrow">A DESIGN THAT EVOLVES WITH YOU</span><h3>Version history</h3></div><Chip>{session.changes.length} revision(s)</Chip></div><div className="history-list">{session.changes.length ? [...session.changes].reverse().map(change => <div className="history-item" key={`${change.version}-${change.at}`}><span className="version-badge">v{change.version}</span><div><h4>{change.request}</h4><p>{change.summary}</p><small>{dateLabel(change.at)} at {timeLabel(change.at)} · {change.files.length} affected files</small><div className="entity-tags">{change.files.map(file => <span key={file}>{file}</span>)}</div></div></div>) : <div className="empty-state"><GitBranch size={25} /><h3>Every refinement has a reason.</h3><p>Your revision requests and affected files will appear here.</p></div>}</div></section>}</>}
    {screen === "prompts" && <><div className="page-heading"><div><div className="overline">THE THINKING BEHIND THE WORKFLOW</div><h1>Good questions. Better outcomes<span className="heading-dot">.</span></h1><p>Readable, separated prompts. Open them, understand them, make them yours.</p></div><Chip><BookOpen size={12} /> {prompts.length} prompt files</Chip></div><div className="prompt-layout"><section className="panel prompt-nav">{prompts.map((prompt, index) => <button key={prompt.name} className={selectedPrompt === index ? "active" : ""} onClick={() => setSelectedPrompt(index)}><FileText size={16} /><span>{prompt.name}</span><ChevronRight size={14} /></button>)}<p>Edit files in <code>prompts/</code>. The server reads them for each new call—no rebuild needed.</p></section><section className="panel prompt-content">{prompts[selectedPrompt] ? <><div className="panel-header"><b>{prompts[selectedPrompt].name}</b><button className="icon-button" onClick={() => void copy(prompts[selectedPrompt].content)} aria-label="Copy prompt"><Copy size={16} /></button></div><Markdown content={prompts[selectedPrompt].content} /></> : <div className="empty-state"><Loader2 className="spin" size={24} /><p>Loading the prompt library…</p><Button kind="secondary" onClick={() => navigate("prompts")}>Retry</Button></div>}</section></div></>}
    {screen === "activity" && <><div className="page-heading"><div><div className="overline">NOTHING BEHIND THE CURTAIN</div><h1>Every decision leaves a trail<span className="heading-dot">.</span></h1><p>Prompts, model outputs, retries, and timing. Inspect how your design came together.</p></div></div><div className="activity-workspace"><label htmlFor="trace-workspace">Inspect workspace</label><select id="trace-workspace" value={session?.id || ""} onChange={event => { request(`/api/sessions/${event.target.value}`).then(body => { setSession(body.session); setSelectedLog(undefined); }).catch(error => announce(error.message, true)); }}><option value="" disabled>Choose a workspace</option>{sessions.map(item => <option key={item.id} value={item.id}>{item.title} · {item.id.slice(0, 8)}</option>)}</select>{session && <Chip tone={session.mode === "demo" ? "amber" : "green"}>{session.mode === "demo" ? "Offline fixture traces, not LLM calls" : `${session.logs.length} logged attempts`}</Chip>}</div><section className="panel trace-panel">{session?.logs.length ? <><div className="trace-table-heading"><span>STAGE / PROVIDER</span><span>RESULT</span><span>ATTEMPT</span><span>DURATION</span><span>TIME</span></div>{[...session.logs].reverse().map(log => <div key={log.id}><button className={`trace-row ${selectedLog === log.id ? "selected" : ""}`} onClick={() => setSelectedLog(selectedLog === log.id ? undefined : log.id)}><span><Terminal size={16} /><span><b>{log.subtask || log.stage}</b><small>{log.provider} · {log.model}</small></span></span><Chip tone={log.status === "success" ? "green" : "amber"}>{log.status}</Chip><span>#{log.attempt}</span><span>{log.durationMs} ms</span><span>{timeLabel(log.at)} <ChevronDown size={12} /></span></button>{selectedLog === log.id && <div className="trace-detail">{log.error && <div className="error-detail">{log.error}</div>}{log.provider !== "offline-fixture" && <><h4>Provider token usage</h4><p>{log.usage ? `Input: ${log.usage.inputTokens?.toLocaleString() ?? "not reported"} · Output: ${log.usage.outputTokens?.toLocaleString() ?? "not reported"}${log.usage.reasoningTokens !== undefined ? ` · Reasoning: ${log.usage.reasoningTokens.toLocaleString()}` : ""}` : "Usage not reported. This does not indicate zero tokens."}</p>{(log.maxOutputTokens || log.finishReason || log.httpStatus) && <p>{[log.maxOutputTokens && `Requested output cap: ${log.maxOutputTokens.toLocaleString()}`, log.finishReason && `Finish reason: ${log.finishReason}`, log.httpStatus && `HTTP ${log.httpStatus}`].filter(Boolean).join(" · ")}</p>}</>}<h4>Input</h4><pre>{log.input}</pre><h4>Output</h4><pre>{log.output || "No output returned."}</pre></div>}</div>)}</> : <div className="empty-state"><Activity size={30} /><h3>A transparent process starts here.</h3><p>Choose a workspace and run a stage to see its trace.</p></div>}</section><p className="helper-text">Logs contain your brief, answers, and generated design. API keys are excluded. Treat exports as private.</p></>}
    {screen === "settings" && <><div className="page-heading"><div><div className="overline">YOUR WORKFLOW. YOUR CHOICES.</div><h1>A studio that works your way<span className="heading-dot">.</span></h1><p>Bring your preferred model. Keep your work portable.</p></div></div><div className="settings-grid"><form className="panel settings-form" onSubmit={event => void saveSettings(event)}><div className="panel-header"><div><span className="eyebrow">MODEL & PROVIDER</span><h3>Connect your design partner</h3></div><Sparkles size={20} /></div><div className="form-content"><ProviderPicker config={config} onChange={setConfig} apiKeys={apiKeys} onKeyChange={setProviderKey} configuredProviders={system?.configuredProviders} serverConfig={system?.config} hasServerKey={system?.hasApiKey} /><label className="field-label" htmlFor="access-token">Private workspace access token <span>Optional locally</span></label><input id="access-token" type="password" autoComplete="off" value={accessToken} onChange={event => setAccessToken(event.target.value)} placeholder="Matches APP_ACCESS_TOKEN on the server" /><p className="helper-text">Only needed when the server sets <code>APP_ACCESS_TOKEN</code>. Saved in this tab’s session storage, not shared with model providers.</p><Button type="submit"><Check size={15} /> Save configuration</Button></div></form><aside><section className="panel environment-panel"><div className="panel-header"><div><span className="eyebrow">ENVIRONMENT</span><h3>Local first. Future ready.</h3></div><ShieldCheck size={21} /></div><div className="environment-rows"><div><span>Persistence</span><Chip tone={system?.storage.durable ? "green" : "amber"}>{system?.storage.mode || "Not connected"}</Chip></div><div><span>Output directory</span><code>{system?.storage.outputDirectory || "outputs/<id>/"}</code></div><div><span>API key on server</span><span>{system?.hasApiKey ? "Configured" : "Not configured"}</span></div><div><span>Deployment</span><span>Localhost only</span></div></div></section><section className="quiet-note settings-note"><h4>Validation that tells the truth.</h4><p>PostgreSQL and SQLite run your SQL in real isolated engines. MySQL and SQL Server receive structural checks—not simulated execution.</p><div className="validation-engine-list">{["PostgreSQL · PGlite", "SQLite · sql.js"].map(item => <span key={item}><Check size={13} />{item}</span>)}</div><h4>When you’re ready for Vercel.</h4><p>Configure durable Redis storage and an access token first. The app is structured for Node server functions. Nothing has been deployed.</p></section></aside></div></>}
    </> }</main></div>
    {(busy || toasts.length > 0) && <section className="toast-stack" aria-label="Notifications">{busy && <div className="busy-indicator" role="status"><Loader2 size={17} className="spin" /><span>{busy}...</span><small>Keep this tab open</small></div>}{toasts.map(notification => <div key={notification.id} className={`toast ${notification.error ? "toast-error" : ""}`} role={notification.error ? "alert" : "status"}>{notification.error ? <CircleHelp size={19} /> : <Check size={19} />}<span>{notification.message}</span><button type="button" onClick={() => setToasts(current => current.filter(item => item.id !== notification.id))} aria-label="Dismiss message"><X size={15} /></button></div>)}</section>}
    {newOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setNewOpen(false); }}><section className="modal new-modal" role="dialog" aria-modal="true" aria-labelledby="new-title"><button className="modal-close icon-button" onClick={() => setNewOpen(false)} aria-label="Close new workspace"><X size={20} /></button><span className="modal-hero-icon"><Sparkles size={26} /></span><span className="eyebrow">EVERY GREAT DATABASE STARTS SOMEWHERE</span><h2 id="new-title">What are you building?</h2><p>Start with a system brief. We’ll find the structure together.</p><div className="mode-switch"><button className={newMode === "live" ? "active" : ""} onClick={() => setNewMode("live")}><Sparkles size={14} /> My own system</button><button className={newMode === "demo" ? "active" : ""} onClick={() => setNewMode("demo")}><BookOpen size={14} /> Explore an example</button></div>{newMode === "live" ? <><label className="field-label" htmlFor="description">Tell us about your system</label><textarea id="description" value={description} onChange={event => setDescription(event.target.value)} rows={6} minLength={30} maxLength={30000} placeholder="We’re building a platform where… Who uses it? What do they do? What information matters?" /><ProviderPicker config={config} onChange={setConfig} apiKeys={apiKeys} onKeyChange={setProviderKey} configuredProviders={system?.configuredProviders} serverConfig={system?.config} hasServerKey={system?.hasApiKey} allowDemo={false} /><div className="new-provider-note"><span><span className="status-dot" />{config.provider === "demo" ? "A live provider isn’t connected yet" : `${config.provider} · ${config.model || "Choose a model in Settings"}`}</span><button onClick={() => { setNewOpen(false); navigate("settings"); }}>Configure <ArrowUpRight size={12} /></button></div></> : <div className="example-brief"><span className="example-logo">L<span>✳</span></span><div><h3>Lumina coworking</h3><p>Members, memberships, bookable spaces, shared amenities, and billing. A complete eight-table example with realistic data.</p><Chip tone="green">No API key. No credits. Just explore.</Chip></div></div>}<div className="modal-bottom"><span><LockKeyhole size={12} /> Private by default</span><Button disabled={Boolean(busy) || (newMode === "live" && description.trim().length < 30)} onClick={() => void createWorkspace(newMode)}>{newMode === "live" ? "Create design workspace" : "Open the guided example"}<ArrowRight size={15} /></Button></div></section></div>}
    {preview && <div className="modal-backdrop preview-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setPreview(undefined); }}><section className="modal preview-modal" role="dialog" aria-modal="true" aria-label={preview.name}><div className="preview-header"><span className="file-icon"><FileText size={19} /></span><div><h3>{preview.name}</h3><small>Stage {preview.stage} · {preview.version ? `Version ${preview.version}` : "Source artifact"}</small></div><div className="preview-actions"><button className={!raw ? "active" : ""} onClick={() => setRaw(false)}>Preview</button><button className={raw ? "active" : ""} onClick={() => setRaw(true)}>Source</button><button className="icon-button" onClick={() => void copy(preview.content)} aria-label="Copy artifact"><Copy size={16} /></button><button className="icon-button" onClick={() => setPreview(undefined)} aria-label="Close artifact"><X size={20} /></button></div></div><div className="preview-content">{raw || !preview.name.endsWith(".md") ? <pre className="source-preview">{preview.content}</pre> : <Markdown content={preview.content} />}</div></section></div>}
  </div>;
}
