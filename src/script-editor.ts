export interface ScriptEditorCallbacks {
    onApply: (script: string) => Promise<string | null>; // returns error message or null on success
    onReset: () => string; // returns the default script
}

export class ScriptEditorModal {
    private overlay: HTMLDivElement;
    private textarea: HTMLTextAreaElement;
    private errorDiv: HTMLDivElement;
    private titleEl: HTMLSpanElement;
    private callbacks: ScriptEditorCallbacks | null = null;
    private isOpen = false;

    constructor(container: HTMLElement) {
        this.overlay = document.createElement("div");
        this.overlay.style.cssText =
            "position:fixed;inset:0;background:rgba(0,0,0,0.85);" +
            "display:none;flex-direction:column;z-index:100;padding:24px;box-sizing:border-box;";

        const header = document.createElement("div");
        header.style.cssText =
            "display:flex;align-items:center;gap:12px;margin-bottom:12px;";

        this.titleEl = document.createElement("span");
        this.titleEl.style.cssText =
            "font-family:monospace;font-size:16px;color:#64b5f6;flex:1;";

        const applyBtn = this.makeButton("Apply", "#4caf50");
        const resetBtn = this.makeButton("Reset", "#ff9800");
        const closeBtn = this.makeButton("Close", "#666");

        header.appendChild(this.titleEl);
        header.appendChild(applyBtn);
        header.appendChild(resetBtn);
        header.appendChild(closeBtn);

        this.textarea = document.createElement("textarea");
        this.textarea.style.cssText =
            "flex:1;width:100%;background:#1e1e1e;color:#d4d4d4;" +
            "font-family:'Courier New',monospace;font-size:13px;line-height:1.5;" +
            "border:1px solid #444;border-radius:4px;padding:12px;box-sizing:border-box;" +
            "resize:none;outline:none;tab-size:4;";
        this.textarea.spellcheck = false;

        this.errorDiv = document.createElement("div");
        this.errorDiv.style.cssText =
            "font-family:monospace;font-size:12px;color:#f44336;" +
            "min-height:20px;margin-top:8px;white-space:pre-wrap;";

        this.overlay.appendChild(header);
        this.overlay.appendChild(this.textarea);
        this.overlay.appendChild(this.errorDiv);
        container.appendChild(this.overlay);

        applyBtn.addEventListener("click", () => this.handleApply());
        resetBtn.addEventListener("click", () => this.handleReset());
        closeBtn.addEventListener("click", () => this.close());

        // Tab key inserts 4 spaces instead of moving focus
        this.textarea.addEventListener("keydown", (e) => {
            if (e.key === "Tab") {
                e.preventDefault();
                const s = this.textarea.selectionStart;
                this.textarea.value =
                    this.textarea.value.substring(0, s) +
                    "    " +
                    this.textarea.value.substring(this.textarea.selectionEnd);
                this.textarea.selectionStart = this.textarea.selectionEnd = s + 4;
            }
        });

        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.isOpen) this.close();
        });
    }

    private makeButton(label: string, color: string): HTMLButtonElement {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.style.cssText =
            `background:${color};color:#fff;border:none;padding:6px 14px;` +
            "border-radius:3px;font-family:monospace;font-size:13px;cursor:pointer;";
        return btn;
    }

    open(unitName: string, script: string, errorLog: string[], callbacks: ScriptEditorCallbacks): void {
        this.callbacks = callbacks;
        this.titleEl.textContent = `Script Editor — ${unitName}`;
        this.textarea.value = script;
        this.errorDiv.textContent = errorLog.length > 0
            ? "Recent errors:\n" + errorLog.join("\n")
            : "";
        this.overlay.style.display = "flex";
        this.isOpen = true;
        this.textarea.focus();
    }

    close(): void {
        this.overlay.style.display = "none";
        this.isOpen = false;
        this.callbacks = null;
    }

    private async handleApply(): Promise<void> {
        if (!this.callbacks) return;
        const error = await this.callbacks.onApply(this.textarea.value);
        if (error) {
            this.errorDiv.textContent = `Compile error:\n${error}`;
        } else {
            this.errorDiv.textContent = "Applied successfully.";
        }
    }

    private handleReset(): void {
        if (!this.callbacks) return;
        this.textarea.value = this.callbacks.onReset();
        this.errorDiv.textContent = "";
    }
}
