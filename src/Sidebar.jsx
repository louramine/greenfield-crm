import { useState, useEffect } from "react";

const navItems = [
  { id: "dashboard", icon: "◈", label: "Dashboard",      section: "Navigation" },
  { id: "pipeline",  icon: "⇄", label: "Pipeline Deals", section: null },
  { id: "carte",     icon: "🗺", label: "Carte Terrains", section: null },
  { id: "terrains",  icon: "▣", label: "Terrains",       section: "Données" },
  { id: "acheteurs", icon: "◎", label: "Acheteurs",      section: null },
];

export const SIDEBAR_FULL     = 220;
export const SIDEBAR_COLLAPSED = 60;

export default function Sidebar({ currentPage, onPageChange, collapsed, onToggle }) {
  const w = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_FULL;

  return (
    <aside style={{
      position: "fixed",
      left: 0, top: 0, bottom: 0,
      width: w,
      background: "rgba(7,26,15,0.97)",
      borderRight: "1px solid rgba(45,158,95,0.18)",
      zIndex: 100,
      display: "flex",
      flexDirection: "column",
      backdropFilter: "blur(12px)",
      transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
      overflow: "hidden",
    }}>

      {/* Logo + toggle */}
      <div style={{
        padding: collapsed ? "18px 0" : "18px 16px 16px",
        borderBottom: "1px solid rgba(45,158,95,0.15)",
        display: "flex", alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        minHeight: 64,
      }}>
        {!collapsed && (
          <div style={{ overflow: "hidden" }}>
            <div style={{ color: "#4eca82", fontWeight: 700, fontSize: 17, fontFamily: "Syne, sans-serif", whiteSpace: "nowrap" }}>GREENFIELD</div>
            <div style={{ color: "#8aab97", fontSize: 9, letterSpacing: "0.14em", marginTop: 2, textTransform: "uppercase" }}>CRM Foncier</div>
          </div>
        )}
        <button
          onClick={onToggle}
          style={{
            background: "rgba(45,158,95,0.12)", border: "1px solid rgba(45,158,95,0.2)",
            borderRadius: 7, cursor: "pointer", color: "#4eca82", fontSize: 13,
            width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, paddingTop: 8 }}>
        {navItems.map((item) => (
          <div key={item.id}>
            {item.section && !collapsed && (
              <div style={{ padding: "16px 14px 6px", fontSize: 9, letterSpacing: "0.18em", color: "#8aab97", textTransform: "uppercase", fontWeight: 500, whiteSpace: "nowrap" }}>
                {item.section}
              </div>
            )}
            {item.section && collapsed && <div style={{ height: 12 }} />}

            <div
              onClick={() => onPageChange(item.id)}
              title={collapsed ? item.label : ""}
              onMouseEnter={e => { if (currentPage !== item.id) e.currentTarget.style.background = "rgba(45,158,95,0.12)"; }}
              onMouseLeave={e => { if (currentPage !== item.id) e.currentTarget.style.background = "transparent"; }}
              style={{
                display: "flex", alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                gap: collapsed ? 0 : 9,
                padding: collapsed ? "11px 0" : "10px 12px",
                margin: "1px 6px", borderRadius: 9,
                cursor: "pointer", fontSize: 13,
                color: currentPage === item.id ? "#4eca82" : "#8aab97",
                fontWeight: currentPage === item.id ? 500 : 400,
                background: currentPage === item.id
                  ? "linear-gradient(135deg, rgba(45,158,95,0.25), rgba(78,202,130,0.12))"
                  : "transparent",
                transition: "all 0.2s", whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: 16, width: collapsed ? "100%" : 18, textAlign: "center", flexShrink: 0 }}>
                {item.icon}
              </span>
              {!collapsed && item.label}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(45,158,95,0.12)", fontSize: 10, color: "rgba(138,171,151,0.45)", textAlign: "center", whiteSpace: "nowrap" }}>
          © 2026 GREENFIELD
        </div>
      )}
    </aside>
  );
}