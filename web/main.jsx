import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import "./styles.css";

const pages = ["Overview", "Astronomy", "Solar Activity", "Geomagnetic Weather", "Simulation", "3D Space", "Data Quality"];
const api = async (path) => {
  const response = await fetch(`/api/${path}`);
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json();
};
const tip = {
  contentStyle: { background: "#111a2c", border: "1px solid #2b4167", borderRadius: 10 },
  labelStyle: { color: "#dce8ff", fontWeight: 700 },
  itemStyle: { color: "#eef4ff" },
};
const readable = (value) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(Number(value) || 0);
function AsteroidTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload || {};
  return <div className="asteroid-tooltip">
    <strong>{item.name || "Near-Earth object"}</strong>
    <div><span>Approach date</span><b>{String(item.close_approach_date || "").slice(0, 10) || "Unknown"}</b></div>
    <div><span>Miss distance</span><b>{readable(item.miss_distance_km)} km</b></div>
    <div><span>Estimated diameter</span><b>{readable(item.estimated_diameter_km)} km</b></div>
    <div><span>Risk flag</span><b className={item.is_potentially_hazardous ? "risk" : "safe"}>{item.is_potentially_hazardous ? "Potentially hazardous" : "Not flagged"}</b></div>
  </div>;
}

function Card({ label, value, hint, accent = "" }) {
  return <div className={`metric ${accent}`}><small>{label}</small><strong>{value}</strong>{hint && <span>{hint}</span>}</div>;
}
function Chart({ children, height = 280 }) {
  return <div className="chart" style={{ height }}><ResponsiveContainer>{children}</ResponsiveContainer></div>;
}
function Meaning({ title, children, tone = "" }) {
  return <aside className={`meaning ${tone}`}><b>{title}</b><p>{children}</p></aside>;
}
function SectionTitle({ title, subtitle }) {
  return <div className="panel-title"><span>{title}</span><small>{subtitle}</small></div>;
}
function ActivityCalendar({ daily }) {
  const [selected, setSelected] = useState(daily[daily.length - 1] || null);
  const max = Math.max(1, ...daily.map((d) => Number(d.max_kp) || 0));
  const firstDate = daily.length ? String(daily[0].date || "").slice(0, 10) : "";
  const first = firstDate ? new Date(`${firstDate}T00:00:00`) : new Date();
  const offset = Number.isNaN(first.getTime()) ? 0 : (first.getDay() + 6) % 7;
  const cells = [...Array(offset).fill(null), ...daily];
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, week) => cells.slice(week * 7, week * 7 + 7));
  return <div className="calendar-wrap">
    <div className="activity-calendar" aria-label="Daily geomagnetic activity calendar">
      {weeks.map((week, wi) => <div className="calendar-week" key={wi}>{week.map((day, di) => day
        ? <button className={`activity-dot ${selected?.date === day.date ? "selected" : ""}`} key={day.date} aria-label={`${day.date}, maximum Kp ${readable(day.max_kp)}`} title={`${day.date} · Kp ${readable(day.max_kp)}`} onClick={() => setSelected(day)} style={{ opacity: .25 + (Number(day.max_kp || 0) / max) * .75 }} />
        : <span className="activity-dot empty" key={`empty-${wi}-${di}`} />)}</div>)}
    </div>
    <div className="calendar-legend"><span>Quiet</span><i className="activity-dot legend-dot" /><i className="activity-dot legend-dot mid" /><i className="activity-dot legend-dot high" /><span>Storm</span></div>
    {selected && <div className="date-detail"><b>{selected.date}</b><span>Peak Kp <strong>{readable(selected.max_kp)}</strong></span><span>Average Kp <strong>{readable(selected.avg_kp)}</strong></span><span>{Number(selected.max_kp) >= 5 ? "Storm-level activity" : "Below storm threshold"}</span></div>}
  </div>;
}

function SpaceScene({ mode, hour, flare, speed, asteroids }) {
  const mount = useRef(null);
  useEffect(() => {
    const host = mount.current;
    if (!host) return undefined;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#08101f");
    const camera = new THREE.PerspectiveCamera(45, 1, .1, 100);
    camera.position.set(0, 2.8, 8);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight("#91b5e8", 1.4));
    const sun = new THREE.PointLight("#ffbf69", 12, 30); sun.position.set(-2.8, 0, 0); scene.add(sun);
    const group = new THREE.Group(); scene.add(group);
    const sphere = (radius, color, position, glow = false) => {
      const material = new THREE.MeshBasicMaterial({ color, transparent: glow, opacity: glow ? .82 : 1 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), material); mesh.position.set(...position); group.add(mesh); return mesh;
    };
    let animate;
    if (mode === "cme") {
      sphere(1.05, "#ff9f43", [-2.8, 0, 0], true);
      sphere(.52, "#78a7ff", [2.5, 0, 0]);
      const earthGlow = new THREE.Mesh(new THREE.SphereGeometry(.7, 24, 16), new THREE.MeshBasicMaterial({ color: "#60d6be", wireframe: true, transparent: true, opacity: .7 }));
      earthGlow.position.x = 2.5; group.add(earthGlow);
      const wave = new THREE.Mesh(new THREE.SphereGeometry(.55 + Math.min(hour / 18, 1) * 1.3, 24, 16), new THREE.MeshBasicMaterial({ color: "#ff7b9c", wireframe: true, transparent: true, opacity: .22 }));
      wave.position.x = -2.2 + Math.min(hour / Math.max(1, 18 - speed / 100), 1) * 4.2; group.add(wave);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.7, 0, 0), new THREE.Vector3(2, 0, 0)]), new THREE.LineBasicMaterial({ color: "#526b99" })); group.add(line);
    } else {
      sphere(.62, "#78a7ff", [0, 0, 0]);
      sphere(.2, "#60d6be", [2.2, 0, 0]);
      [1.3, 2.2, 3.05].forEach((radius) => { const orbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 65 }, (_, i) => new THREE.Vector3(Math.cos(i / 64 * Math.PI * 2) * radius, 0, Math.sin(i / 64 * Math.PI * 2) * radius))), new THREE.LineBasicMaterial({ color: "#304b72" })); group.add(orbit); });
      asteroids.slice(0, 24).forEach((item, i) => { const angle = i / 24 * Math.PI * 2; const radius = 1.5 + (Number(item.miss_distance_km) % 9000000) / 9000000 * 1.4; const asteroid = sphere(.045 + Math.min(Number(item.estimated_diameter_km) || .1, 1) * .035, item.is_potentially_hazardous ? "#ff7b9c" : "#d3a6ff", [Math.cos(angle) * radius, (i % 3 - 1) * .12, Math.sin(angle) * radius]); asteroid.userData = item; });
    }
    const resize = () => { const { width, height } = host.getBoundingClientRect(); renderer.setSize(width, height, false); camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix(); };
    resize(); window.addEventListener("resize", resize);
    const tick = () => { group.rotation.y += .002; renderer.render(scene, camera); animate = requestAnimationFrame(tick); }; tick();
    return () => { cancelAnimationFrame(animate); window.removeEventListener("resize", resize); renderer.dispose(); host.removeChild(renderer.domElement); };
  }, [mode, hour, flare, speed, asteroids]);
  return <div ref={mount} className="space-canvas" aria-label={mode === "cme" ? "Animated Sun CME and Earth magnetosphere visualization" : "Solar system and near Earth objects visualization"} />;
}

function Space3D({ asteroids }) {
  const [mode, setMode] = useState("cme");
  const [flare, setFlare] = useState(6);
  const [speed, setSpeed] = useState(900);
  const [hour, setHour] = useState(8);
  return <><h1>See the system<br /><i>in motion.</i></h1><Meaning title="Interactive 3D space">Rotate your attention around a simplified model of the Sun–Earth system. Colors and distances are illustrative, while the asteroid markers are drawn from the current observation snapshot.</Meaning>
    <div className="space-tabs" role="tablist"><button className={mode === "cme" ? "active" : ""} onClick={() => setMode("cme")}>Sun → CME → Earth</button><button className={mode === "orbit" ? "active" : ""} onClick={() => setMode("orbit")}>Orbits + near-Earth objects</button></div>
    {mode === "cme" && <div className="space-controls"><label>Flare <input type="range" min="1" max="10" step=".1" value={flare} onChange={(e) => setFlare(Number(e.target.value))} /></label><label>CME speed <input type="range" min="300" max="1800" step="50" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} /></label><label>Model hour <input type="range" min="0" max="72" value={hour} onChange={(e) => setHour(Number(e.target.value))} /></label></div>}
    <section className="panel space-panel"><SpaceScene mode={mode} hour={hour} flare={flare} speed={speed} asteroids={asteroids} /><div className="space-caption"><b>{mode === "cme" ? "Coronal mass ejection in transit" : "Orbital neighborhood"} </b><span>{mode === "cme" ? `Model hour ${hour}; flare ${flare.toFixed(1)}× and CME ${speed} km/s drive the wave position.` : `${asteroids.length} asteroid records mapped to illustrative orbital markers.`}</span></div></section>
    <div className="legend"><span className="teal">● Earth / active response</span><span className="purple">● asteroid marker</span><span className="muted">WebGL visualization · not to scale</span></div>
  </>;
}
function Simulation({ solar }) {
  const [flare, setFlare] = useState(6);
  const [speed, setSpeed] = useState(900);
  const [duration, setDuration] = useState(72);
  const [hour, setHour] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setHour((current) => {
      if (current >= duration) { setPlaying(false); return 0; }
      return current + 1;
    }), 180);
    return () => window.clearInterval(timer);
  }, [playing, duration]);
  const curve = useMemo(() => Array.from({ length: duration + 1 }, (_, h) => {
    const arrival = Math.max(6, 18 - speed / 100);
    const distance = Math.abs(h - arrival);
    const pulse = Math.exp(-(distance * distance) / 80);
    const flareEffect = (flare / 10) * pulse * 4.5;
    return { hour: h, kp: Number(Math.min(9, 1.5 + flareEffect).toFixed(2)), active: h <= hour ? Number(Math.min(9, 1.5 + flareEffect).toFixed(2)) : null };
  }), [duration, flare, speed, hour]);
  const current = curve[hour] || curve[0];
  const arrival = Math.max(6, Math.round(18 - speed / 100));
  const stage = hour < 6 ? "Solar event released" : hour < arrival ? "Shockwave travelling" : hour < arrival + 12 ? "Magnetosphere responding" : "Recovery phase";
  const explanation = hour < 6
    ? "The flare has just happened. Radiation arrives quickly, but the particle cloud is still leaving the Sun."
    : hour < arrival
      ? `The CME is travelling toward Earth. At ${speed} km/s, the model estimates arrival in about ${arrival} hours.`
      : hour < arrival + 12
        ? "The charged-particle cloud is interacting with Earth’s magnetic field. This is where Kp rises in the model."
        : "The disturbance is fading. The magnetosphere is returning toward its quiet baseline.";
  return <><h1>Explore a<br /><i>space-weather scenario.</i></h1>
    <Meaning title="How to use this simulator">Adjust the flare strength and CME speed, then press play. This is an educational model, not a forecast: it illustrates timing and relative intensity, not a prediction of Earth’s weather.</Meaning>
    <section className="simulation-grid">
      <div className="panel controls"><SectionTitle title="Scenario controls" subtitle="CHANGE THE INPUTS" />
        <label>Flare energy <strong>{flare.toFixed(1)}×</strong><input type="range" min="1" max="10" step=".1" value={flare} onChange={(e) => { setFlare(Number(e.target.value)); setHour(0); }} /><small>Higher values represent a stronger solar flare.</small></label>
        <label>CME speed <strong>{speed} km/s</strong><input type="range" min="300" max="1800" step="50" value={speed} onChange={(e) => { setSpeed(Number(e.target.value)); setHour(0); }} /><small>A faster coronal mass ejection reaches Earth sooner.</small></label>
        <label>Simulation window <strong>{duration} hours</strong><input type="range" min="24" max="72" step="24" value={duration} onChange={(e) => { setDuration(Number(e.target.value)); setHour(0); }} /><small>Watch the event, arrival, peak response, and recovery.</small></label>
        <div className="sim-actions"><button onClick={() => setPlaying((value) => !value)}>{playing ? "Pause animation" : "Play animation"}</button><button className="secondary" onClick={() => { setHour(0); setPlaying(false); }}>Reset</button></div>
      </div>
      <div className="panel">
        <SectionTitle title="Animated response" subtitle={`HOUR ${hour} OF ${duration}`} />
        <div className="sim-stage"><span className="pulse-dot" /><b>{stage}</b><span className="sim-hour">Hour {hour} / {duration}</span></div>
        <p className="sim-explanation">{explanation}</p>
        <Chart height={330}><AreaChart data={curve}><CartesianGrid stroke="#24314a" vertical={false} /><ReferenceArea x1={0} x2={6} fill="#d3a6ff" fillOpacity=".08" /><ReferenceArea x1={arrival} x2={arrival + 12} fill="#ff7b9c" fillOpacity=".08" /><ReferenceLine x={hour} stroke="#60d6be" strokeWidth={2} label={{ value: "NOW", fill: "#60d6be", fontSize: 10 }} /><XAxis dataKey="hour" label={{ value: "Hours after event", position: "insideBottom", offset: -5, fill: "#7183a3" }} stroke="#7183a3" /><YAxis domain={[0, 9]} label={{ value: "Kp index", angle: -90, position: "insideLeft", fill: "#7183a3" }} stroke="#7183a3" /><Tooltip {...tip} formatter={(value) => [`${readable(value)} Kp`, "Geomagnetic intensity"]} /><Area type="monotone" dataKey="kp" stroke="#496281" fill="#263b5c" fillOpacity=".35" /><Area type="monotone" dataKey="active" stroke="#60d6be" fill="#60d6be" fillOpacity=".32" /></AreaChart></Chart>
        <div className="legend"><span className="teal">● animated path</span><span className="muted">● projected response</span></div>
      </div>
    </section>
    <div className="phase-row"><div className={hour < 6 ? "phase active" : "phase"}><b>1</b><span>Flare</span><small>Radiation released</small></div><div className={hour >= 6 && hour < arrival ? "phase active" : "phase"}><b>2</b><span>Travel</span><small>CME crosses space</small></div><div className={hour >= arrival && hour < arrival + 12 ? "phase active" : "phase"}><b>3</b><span>Impact</span><small>Magnetic field reacts</small></div><div className={hour >= arrival + 12 ? "phase active" : "phase"}><b>4</b><span>Recovery</span><small>Storm fades</small></div></div>
    <section className="metrics"><Card label="CURRENT MODEL Kp" value={readable(current?.active || 1.5)} hint={current?.active >= 5 ? "Storm threshold" : "Below storm threshold"} accent="pink" /><Card label="ESTIMATED ARRIVAL" value={`${arrival} h`} hint="Approximate travel time" accent="violet" /><Card label="REAL DATA CONTEXT" value={solar.flares.length} hint="Flares in this dataset" accent="amber" /></section>
  </>;
}
function App() {
  const [page, setPage] = useState("Overview");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const load = () => Promise.all(["summary", "daily", "asteroids", "solar", "quality"].map(api))
      .then(([summary, daily, asteroids, solar, quality]) => { setData({ summary, daily, asteroids, solar, quality }); setError(""); })
      .catch((e) => setError(e.message));
    load();
    const refresh = window.setInterval(load, 300000);
    return () => window.clearInterval(refresh);
  }, []);
  if (error) return <main className="shell"><div className="error"><b>Snapshot unavailable</b><p>{error}. Run <code>python run_pipeline.py --sample --days 365</code>, then start the API.</p></div></main>;
  if (!data) return <main className="shell"><div className="loading">Connecting to mission control<span>···</span></div></main>;
  const s = data.summary && typeof data.summary === "object" ? data.summary : {};
  const daily = Array.isArray(data.daily) ? data.daily : [];
  const asteroids = Array.isArray(data.asteroids) ? data.asteroids : [];
  const solar = data.solar && typeof data.solar === "object" ? data.solar : {};
  const flares = Array.isArray(solar.flares) ? solar.flares : [];
  const cmes = Array.isArray(solar.cmes) ? solar.cmes : [];
  const kp = Array.isArray(solar.kp) ? solar.kp : [];
  const quality = data.quality && typeof data.quality === "object" ? data.quality : {};
  return <><header><div className="brand"><span>✦</span> COSMOS <em>HUB</em></div><nav>{pages.map((item) => <button className={page === item ? "active" : ""} onClick={() => setPage(item)} key={item}>{item}</button>)}</nav><div className="signal">● LIVE SNAPSHOT</div></header>
    <main className="shell"><div className="eyebrow">DEEP SPACE INTELLIGENCE / {s.start_date} — {s.end_date}</div>
      {page === "Overview" && <><h1>Signals across our<br /><i>celestial neighborhood.</i></h1><div className="metrics"><Card label="OBSERVATION DAYS" value={s.days} hint="Days in the selected window" /><Card label="NEAR-EARTH OBJECTS" value={s.asteroids} hint="Recorded close approaches" accent="violet" /><Card label="SOLAR FLARES" value={s.flares} hint="Sudden bursts of solar energy" accent="amber" /><Card label="PEAK Kp INDEX" value={readable(s.peak_kp)} hint="Highest magnetic disturbance" accent="pink" /></div><Meaning title="What am I looking at?">The Kp index measures how disturbed Earth’s magnetic field is. Values of 5 or above indicate a geomagnetic storm. The green line is the daily peak; the purple line is the daily average across eight 3-hour readings.</Meaning><section className="panel"><SectionTitle title="Geomagnetic pulse" subtitle="DAILY MAGNETIC ACTIVITY" /><Chart><AreaChart data={daily}><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60d6be" stopOpacity=".45" /><stop offset="100%" stopColor="#60d6be" stopOpacity="0" /></linearGradient></defs><CartesianGrid stroke="#24314a" vertical={false} /><XAxis dataKey="date" hide /><YAxis domain={[0, 9]} label={{ value: "Kp index", angle: -90, position: "insideLeft", fill: "#7183a3" }} stroke="#7183a3" /><Tooltip {...tip} formatter={(value, name) => [`${readable(value)} Kp`, name === "max_kp" ? "Daily peak" : "Daily average"]} /><Area type="monotone" dataKey="max_kp" stroke="#60d6be" fill="url(#a)" strokeWidth={2} /><Line type="monotone" dataKey="avg_kp" stroke="#d3a6ff" dot={false} /></AreaChart></Chart><div className="legend"><span className="teal">● daily peak</span><span className="purple">● daily average</span></div></section><section className="panel"><SectionTitle title="Activity calendar" subtitle="WEEKS · SELECT A DAY FOR DETAILS" /><ActivityCalendar daily={daily} /></section></>}
      {page === "Astronomy" && <><h1>Objects passing<br /><i>through the dark.</i></h1><Meaning title="How to read this chart">Each bubble is a near-Earth object. Moving left means a closer approach; moving up means a larger estimated diameter. Bubble size repeats diameter. Purple points are objects flagged as potentially hazardous, based on NASA’s classification.</Meaning><section className="panel"><SectionTitle title="Distance × diameter" subtitle="NEAR-EARTH OBJECT APPROACHES" /><Chart height={360}><ScatterChart><CartesianGrid stroke="#24314a" /><XAxis type="number" dataKey="miss_distance_km" name="Miss distance" tickFormatter={(v) => `${Math.round(v / 1000000)}M`} label={{ value: "Distance from Earth (km)", position: "insideBottom", offset: -5, fill: "#7183a3" }} stroke="#7183a3" /><YAxis type="number" dataKey="estimated_diameter_km" name="Diameter" label={{ value: "Estimated diameter (km)", angle: -90, position: "insideLeft", fill: "#7183a3" }} stroke="#7183a3" /><ZAxis type="number" dataKey="estimated_diameter_km" range={[40, 500]} /><Tooltip content={<AsteroidTooltip />} cursor={{ stroke: "#9bb4d9", strokeDasharray: "4 4" }} /><Scatter data={asteroids} fill="#d3a6ff" /></ScatterChart></Chart></section></>}
      {page === "Solar Activity" && <><h1>The star at the<br /><i>center of it all.</i></h1><Meaning title="What is solar activity?">A flare is a burst of radiation from the Sun. A CME is a cloud of charged particles launched into space. Faster CMEs can disturb Earth’s magnetic field when they arrive, sometimes producing auroras.</Meaning><section className="split"><div className="panel"><SectionTitle title="Flare strength" subtitle="SOLAR ENERGY BURSTS" /><Chart><BarChart data={flares}><CartesianGrid stroke="#24314a" vertical={false} /><XAxis dataKey="flare_date" hide /><YAxis label={{ value: "Class magnitude", angle: -90, position: "insideLeft", fill: "#7183a3" }} stroke="#7183a3" /><Tooltip {...tip} formatter={(value) => [`${readable(value)}×`, "Flare magnitude"]} /><Bar dataKey="class_value" fill="#ffbf69" radius={[5, 5, 0, 0]} /></BarChart></Chart></div><div className="panel"><SectionTitle title="CME velocity" subtitle="PARTICLE CLOUD SPEED" /><Chart><LineChart data={cmes}><CartesianGrid stroke="#24314a" vertical={false} /><XAxis dataKey="cme_date" hide /><YAxis label={{ value: "Speed (km/s)", angle: -90, position: "insideLeft", fill: "#7183a3" }} stroke="#7183a3" /><Tooltip {...tip} formatter={(value) => [`${readable(value)} km/s`, "CME speed"]} /><Line type="monotone" dataKey="speed_km_s" stroke="#ff7b9c" strokeWidth={3} dot={{ fill: "#ff7b9c" }} /></LineChart></Chart></div></section></>}
      {page === "Geomagnetic Weather" && <><h1>Weather on the<br /><i>magnetic frontier.</i></h1><Meaning title="What does Kp mean?">Kp is a 0–9 planetary index calculated from magnetometer stations. 0–2 is generally quiet, 3–4 is unsettled, and 5+ is storm level. The chart shows each 3-hour measurement rather than hiding variation inside a daily average.</Meaning><section className="panel"><SectionTitle title="Magnetic field timeline" subtitle="EIGHT READINGS PER DAY · 0 QUIET → 9 EXTREME" /><Chart><LineChart data={kp}><CartesianGrid stroke="#24314a" vertical={false} /><XAxis dataKey="timestamp" hide /><YAxis domain={[0, 9]} label={{ value: "Kp index", angle: -90, position: "insideLeft", fill: "#7183a3" }} stroke="#7183a3" /><Tooltip {...tip} formatter={(value) => [`${readable(value)} Kp`, "Magnetic disturbance"]} /><Line type="step" dataKey="kp" stroke="#78a7ff" strokeWidth={2} dot={false} /></LineChart></Chart></section></>}
      {page === "Simulation" && <Simulation solar={{ flares }} />}
      {page === "3D Space" && <Space3D asteroids={asteroids} />}
      {page === "Data Quality" && <><h1>Trust the<br /><i>signal.</i></h1><Meaning title="Why this matters">The pipeline keeps raw source records, validates types and ranges, and fills missing observation days explicitly. This lets you distinguish a quiet day from a missing day.</Meaning><section className="panel quality">{Object.entries(quality).map(([key, value]) => <div className="quality-row" key={key}><span>{key.replaceAll("_", " ")}</span><b>{Array.isArray(value) ? `${value.length} tables` : String(value)}</b></div>)}<p className="muted">Kp observations are retained at their original 3-hour cadence.</p></section></>}
    </main></>;
}
createRoot(document.getElementById("root")).render(<App />);
