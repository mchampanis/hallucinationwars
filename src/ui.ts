import { UnitManager, Unit } from "./units";
import { InputManager } from "./input";

export class UIOverlay {
    private selectionPanel: HTMLDivElement;
    private resourceBar: HTMLDivElement;
    private minimap: HTMLCanvasElement;
    private minimapCtx: CanvasRenderingContext2D;
    private units: UnitManager;
    private lastSelectedIds: string;

    constructor(
        container: HTMLElement,
        units: UnitManager,
        _input: InputManager
    ) {
        this.units = units;
        this.lastSelectedIds = "";

        // Resource bar (placeholder)
        this.resourceBar = document.createElement("div");
        this.resourceBar.style.cssText =
            "position:absolute;top:0;left:0;right:0;height:32px;" +
            "background:rgba(0,0,0,0.7);display:flex;align-items:center;" +
            "padding:0 16px;font-family:monospace;font-size:13px;color:#ccc;" +
            "gap:24px;z-index:10;";
        this.resourceBar.innerHTML =
            '<span style="color:#f4d03f">&#9670; Tokens: 1000</span>' +
            '<span style="color:#aed581">&#9670; Wood: 0</span>' +
            '<span style="color:#90a4ae">&#9670; Stone: 0</span>' +
            '<span style="color:#e57373">&#9670; Iron: 0</span>' +
            '<span style="color:#ce93d8">&#9670; Sulphur: 0</span>' +
            '<span style="flex:1"></span>' +
            '<span style="color:#888">Hallucination Wars v0.1</span>';
        container.appendChild(this.resourceBar);

        // Selection panel
        this.selectionPanel = document.createElement("div");
        this.selectionPanel.style.cssText =
            "position:absolute;bottom:8px;left:50%;transform:translateX(-50%);" +
            "min-width:280px;max-width:500px;background:rgba(0,0,0,0.8);" +
            "border:1px solid #444;border-radius:4px;padding:10px 14px;" +
            "font-family:monospace;font-size:12px;color:#ddd;z-index:10;" +
            "display:none;";
        container.appendChild(this.selectionPanel);

        // Minimap
        this.minimap = document.createElement("canvas");
        this.minimap.width = 160;
        this.minimap.height = 160;
        this.minimap.style.cssText =
            "position:absolute;bottom:8px;right:8px;width:160px;height:160px;" +
            "border:1px solid #555;background:#1a1a2e;z-index:10;" +
            "border-radius:2px;";
        container.appendChild(this.minimap);
        this.minimapCtx = this.minimap.getContext("2d")!;

        // Controls hint
        const hints = document.createElement("div");
        hints.style.cssText =
            "position:absolute;bottom:8px;left:8px;font-family:monospace;" +
            "font-size:11px;color:#666;z-index:10;line-height:1.6;";
        hints.innerHTML =
            "Arrows: Pan | MMB Drag: Pan | Q/E: Rotate | R/F: Zoom | Z/X: Tilt | Scroll: Zoom | Edge: Pan<br>" +
            "LMB: Select | Shift+LMB: Add | Ctrl+LMB: Same team | LMB Drag: Box select | RMB: Move<br>" +
            "A+LMB: Attack-move | S: Stop | H: Hold | Ctrl+0-9: Set group | 0-9: Select group | Esc: Cancel";
        container.appendChild(hints);
    }

    update(): void {
        const selected = this.units.getSelected();
        const ids = selected.map((u) => u.id).join(",");

        if (ids !== this.lastSelectedIds) {
            this.lastSelectedIds = ids;
            this.updateSelectionPanel(selected);
        }

        this.updateMinimap();
    }

    private updateSelectionPanel(selected: Unit[]): void {
        if (selected.length === 0) {
            this.selectionPanel.style.display = "none";
            return;
        }

        this.selectionPanel.style.display = "block";

        if (selected.length === 1) {
            const u = selected[0];
            const teamColor = u.team === "red" ? "#e57373" : "#64b5f6";
            this.selectionPanel.innerHTML =
                `<div style="color:${teamColor};font-size:14px;margin-bottom:4px;">` +
                `${u.name}</div>` +
                `<div>Team: <span style="color:${teamColor}">${u.team}</span></div>` +
                `<div>Health: ${u.health}/${u.maxHealth}</div>` +
                `<div style="color:#888;margin-top:4px;">` +
                `Pos: ${u.position.x.toFixed(1)}, ${u.position.z.toFixed(1)}</div>`;
        } else {
            const redCount = selected.filter((u) => u.team === "red").length;
            const blueCount = selected.filter((u) => u.team === "blue").length;
            let html = `<div style="font-size:14px;margin-bottom:4px;">` +
                `${selected.length} units selected</div>`;
            if (redCount > 0) {
                html += `<div style="color:#e57373;">${redCount} red</div>`;
            }
            if (blueCount > 0) {
                html += `<div style="color:#64b5f6;">${blueCount} blue</div>`;
            }
            this.selectionPanel.innerHTML = html;
        }
    }

    private updateMinimap(): void {
        const ctx = this.minimapCtx;
        const w = this.minimap.width;
        const h = this.minimap.height;

        // Dim the minimap instead of clearing (persistent trail effect)
        ctx.fillStyle = "rgba(26, 26, 46, 0.3)";
        ctx.fillRect(0, 0, w, h);

        // Draw units as dots
        const allUnits = this.units.getAllUnits();
        const mapSize = 200; // Must match terrain MAP_SIZE

        for (const unit of allUnits) {
            const mx = ((unit.position.x + mapSize / 2) / mapSize) * w;
            const my = ((unit.position.z + mapSize / 2) / mapSize) * h;

            ctx.beginPath();
            ctx.arc(mx, my, unit.selected ? 4 : 2.5, 0, Math.PI * 2);
            ctx.fillStyle = unit.team === "red" ? "#e57373" : "#64b5f6";
            ctx.fill();

            if (unit.selected) {
                ctx.strokeStyle = "#0f0";
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }
}
