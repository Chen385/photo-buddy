/* 照片搭子 · 主逻辑 */
(function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    photoGrid: $("photoGrid"),
    countBadge: $("countBadge"),
    fileInput: $("fileInput"),
    descToggle: $("descToggle"),
    descBody: $("descBody"),
    descInput: $("descInput"),
    modeRow: document.querySelectorAll(".mode-btn"),
    btnGenerate: $("btnGenerate"),
    btnGenerateText: $("btnGenerateText"),
    formError: $("formError"),
    resultCard: $("resultCard"),
    modeBadge: $("modeBadge"),
    aiState: $("aiState"),
    captionText: $("captionText"),
    trackTitle: $("trackTitle"),
    trackSub: $("trackSub"),
    vinyl: $("vinyl"),
    btnPlay: $("btnPlay"),
    iconPlay: $("iconPlay"),
    iconPause: $("iconPause"),
    waveform: $("waveform"),
    progressTrack: $("progressTrack"),
    progressFill: $("progressFill"),
    progressThumb: $("progressThumb"),
    timeCurrent: $("timeCurrent"),
    timeTotal: $("timeTotal"),
    btnShuffle: $("btnShuffle"),
    btnCopy: $("btnCopy"),
    reasonToggle: $("reasonToggle"),
    reasonBody: $("reasonBody"),
    localAudioInput: $("localAudioInput"),
    libraryMask: $("libraryMask"),
    libraryList: $("libraryList"),
    btnOpenLibrary: $("btnOpenLibrary"),
    btnCloseLibrary: $("btnCloseLibrary"),
    aiMask: $("aiMask"),
    aiEndpoint: $("aiEndpoint"),
    aiModel: $("aiModel"),
    aiKey: $("aiKey"),
    btnCloseAi: $("btnCloseAi"),
    btnSaveAi: $("btnSaveAi"),
    btnClearAi: $("btnClearAi"),
    footerAiStatus: $("footerAiStatus"),
    toast: $("toast")
  };

  const state = {
    photos: [],
    mode: "decide",
    result: null,
    round: 0,
    generating: false,
    localFile: false
  };

  const MAX_SIZE = 25 * 1024 * 1024;
  const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

  /* ================= 工具 ================= */
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { els.toast.hidden = true; }, 2200);
  }

  function fmt(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function hashSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  function seededRandom(seed) {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  /* ================= 照片上传 ================= */
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("读取失败"));
      reader.readAsDataURL(file);
    });
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    const errs = [];
    for (const file of files) {
      if (state.photos.length >= 3) { errs.push("最多上传 3 张"); break; }
      if (!ALLOWED.includes(file.type)) { errs.push("仅支持 JPG / PNG / WebP"); continue; }
      if (file.size > MAX_SIZE) { errs.push("「" + file.name + "」超过 25MB"); continue; }
      try {
        const dataURL = await readFile(file);
        state.photos.push({ id: Date.now() + "_" + Math.random().toString(36).slice(2, 7), dataURL, name: file.name });
      } catch (e) {
        errs.push("「" + file.name + "」读取失败");
      }
    }
    renderGrid();
    if (errs.length) toast(errs[0]);
  }

  function removePhoto(id) {
    state.photos = state.photos.filter((p) => p.id !== id);
    renderGrid();
  }

  function renderGrid() {
    els.countBadge.textContent = state.photos.length + " / 3";
    els.photoGrid.innerHTML = "";

    state.photos.forEach((p, idx) => {
      const item = document.createElement("div");
      item.className = "photo-item";
      const img = document.createElement("img");
      img.src = p.dataURL;
      img.alt = "已上传照片 " + (idx + 1);
      const badge = document.createElement("span");
      badge.className = "photo-index";
      badge.textContent = String(idx + 1).padStart(2, "0");
      const rm = document.createElement("button");
      rm.className = "photo-remove";
      rm.type = "button";
      rm.setAttribute("aria-label", "删除第 " + (idx + 1) + " 张");
      rm.textContent = "×";
      rm.addEventListener("click", () => removePhoto(p.id));
      item.append(img, badge, rm);
      els.photoGrid.appendChild(item);
    });

    if (state.photos.length < 3) {
      const add = document.createElement("button");
      add.className = "add-tile";
      add.type = "button";
      add.innerHTML = '<span class="plus">＋</span><span>再加一张</span>';
      add.addEventListener("click", () => els.fileInput.click());
      els.photoGrid.appendChild(add);
    }
  }

  els.fileInput.addEventListener("change", (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  });

  /* ================= 模式切换 ================= */
  els.modeRow.forEach((btn) => {
    btn.addEventListener("click", () => {
      els.modeRow.forEach((b) => { b.classList.remove("active"); b.setAttribute("aria-checked", "false"); });
      btn.classList.add("active");
      btn.setAttribute("aria-checked", "true");
      state.mode = btn.dataset.mode;
    });
  });
  document.querySelector('.mode-btn[data-mode="decide"]').classList.add("active");
  document.querySelector('.mode-btn[data-mode="decide"]').setAttribute("aria-checked", "true");

  /* ================= 补充两句折叠 ================= */
  els.descToggle.addEventListener("click", () => {
    const open = els.descToggle.getAttribute("aria-expanded") === "true";
    els.descToggle.setAttribute("aria-expanded", String(!open));
    els.descBody.hidden = open;
  });

  /* ================= 波形 ================= */
  function buildWaveform(trackId) {
    els.waveform.innerHTML = "";
    const rand = seededRandom(hashSeed(trackId || "default"));
    const bars = 28;
    for (let i = 0; i < bars; i++) {
      const bar = document.createElement("div");
      bar.className = "bar";
      const h = 18 + rand() * 82;
      bar.style.height = h + "%";
      els.waveform.appendChild(bar);
    }
  }

  function paintWaveform(progress) {
    const bars = els.waveform.children;
    const active = Math.round(progress * bars.length);
    Array.from(bars).forEach((b, i) => b.classList.toggle("active", i < active));
  }

  /* ================= 播放器 UI 同步 ================= */
  function syncPlayUI(playing) {
    els.iconPlay.hidden = playing;
    els.iconPause.hidden = !playing;
    els.vinyl.classList.toggle("spinning", playing);
  }

  function updateProgress(elapsed, duration) {
    const ratio = duration > 0 ? Math.min(1, elapsed / duration) : 0;
    els.progressFill.style.width = ratio * 100 + "%";
    els.progressThumb.style.left = ratio * 100 + "%";
    els.timeCurrent.textContent = fmt(elapsed);
    els.timeTotal.textContent = fmt(duration);
    els.progressTrack.setAttribute("aria-valuenow", Math.round(elapsed));
    paintWaveform(ratio);
  }

  BGM.player.onTick = updateProgress;
  BGM.player.onStateChange = syncPlayUI;
  BGM.player.onEnded = () => {
    updateProgress(0, BGM.player.duration);
    syncPlayUI(false);
  };

  /* ================= 结果渲染 ================= */
  function renderResult(res) {
    state.result = res;
    state.localFile = false;
    els.modeBadge.textContent = CaptionEngine.MODE_LABELS[state.mode];
    els.captionText.textContent = res.caption;

    els.trackTitle.textContent = res.track.title;
    els.trackSub.textContent = res.track.sub;
    els.reasonBody.textContent = res.reason;
    els.reasonBody.hidden = true;
    els.reasonToggle.setAttribute("aria-expanded", "false");

    buildWaveform(res.track.id);
    els.captionText.style.display = "";
    updateProgress(0, BGM.DURATION);

    // AI 状态徽标
    els.aiState.hidden = false;
    if (res.source === "ai") {
      els.aiState.className = "ai-state live";
      els.aiState.textContent = "AI 生成";
    } else {
      els.aiState.className = "ai-state demo";
      els.aiState.innerHTML = "";
      const span = document.createElement("span");
      span.textContent = res.note || "演示模式：本地规则生成";
      const link = document.createElement("button");
      link.type = "button";
      link.textContent = "配置 AI";
      link.addEventListener("click", openAiModal);
      els.aiState.append(span, link);
    }

    els.resultCard.hidden = false;
    els.resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* ================= 生成 ================= */
  async function generate(excludeTrackId) {
    if (state.generating) return;
    if (!state.photos.length) {
      els.formError.hidden = false;
      els.formError.textContent = "先上传 1 张照片再开始配哦～";
      return;
    }
    els.formError.hidden = true;
    state.generating = true;
    els.btnGenerate.disabled = true;
    els.btnGenerateText.textContent = "正在配文配乐…";

    try {
      const res = await CaptionEngine.generate({
        images: state.photos.map((p) => p.dataURL),
        description: els.descInput.value,
        mode: state.mode,
        round: state.round,
        excludeTrackId
      });
      state.round += 1;
      BGM.player.stopInternal();
      syncPlayUI(false);
      renderResult(res);
    } catch (e) {
      toast("生成失败：" + (e && e.message ? e.message : "未知错误"));
    } finally {
      state.generating = false;
      els.btnGenerate.disabled = false;
      els.btnGenerateText.textContent = "给照片配个乐";
    }
  }

  els.btnGenerate.addEventListener("click", () => generate(null));

  /* ================= 试听 / 暂停 ================= */
  els.btnPlay.addEventListener("click", async () => {
    if (state.localFile) { BGM.player.toggle(); return; }
    if (!state.result) return;
    if (BGM.player.track && BGM.player.track.id === state.result.track.id) {
      BGM.player.toggle();
    } else {
      await BGM.player.playTrack(state.result.track);
    }
  });

  /* ================= 进度拖动 ================= */
  function seekFromEvent(e) {
    const rect = els.progressTrack.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    BGM.player.seek(ratio * BGM.player.duration);
  }
  els.progressTrack.addEventListener("click", seekFromEvent);
  els.progressTrack.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") BGM.player.seek(BGM.player.currentTime() + 2);
    if (e.key === "ArrowLeft") BGM.player.seek(BGM.player.currentTime() - 2);
  });

  /* ================= 换一版 ================= */
  els.btnShuffle.addEventListener("click", () => {
    if (!state.result) return;
    generate(state.result.track.id);
  });

  /* ================= 复制文案 ================= */
  els.btnCopy.addEventListener("click", async () => {
    if (!state.result) return;
    const text = state.result.caption;
    let ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch (e) { ok = false; }
    if (!ok) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
    }
    toast(ok ? "文案已复制 ✦" : "复制失败，请手动长按选择复制");
  });

  /* ================= 推荐理由 ================= */
  els.reasonToggle.addEventListener("click", () => {
    const open = els.reasonToggle.getAttribute("aria-expanded") === "true";
    els.reasonToggle.setAttribute("aria-expanded", String(!open));
    els.reasonBody.hidden = open;
  });

  /* ================= 本地音乐上传 ================= */
  els.localAudioInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) { toast("请选择音频文件"); return; }
    BGM.player.playFile(file);
    state.localFile = true;
    state.result = state.result || { caption: "", reason: "" };
    const name = file.name.replace(/\.[^.]+$/, "");
    els.trackTitle.textContent = name || "本地音频";
    els.trackSub.textContent = "本地音频 · 浏览器内播放";
    els.captionText.style.display = state.result.caption ? "" : "none";
    buildWaveform("local-" + file.name);
    els.resultCard.hidden = false;
    toast("已载入本地音频，仅在本机播放");
  });

  /* ================= 曲库弹窗 ================= */
  function renderLibrary() {
    els.libraryList.innerHTML = "";
    window.TRACKS.forEach((track) => {
      const item = document.createElement("div");
      item.className = "lib-item";
      item.dataset.id = track.id;

      const info = document.createElement("div");
      info.className = "lib-info";
      const t = document.createElement("div");
      t.className = "lib-title"; t.textContent = track.title;
      const s = document.createElement("div");
      s.className = "lib-sub"; s.textContent = track.sub;
      info.append(t, s);

      const btn = document.createElement("button");
      btn.className = "btn-play";
      btn.type = "button";
      btn.setAttribute("aria-label", "试听 " + track.title);
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

      btn.addEventListener("click", async () => {
        const playing = BGM.player.track && BGM.player.track.id === track.id && BGM.player.playing;
        if (playing) { BGM.player.toggle(); return; }
        await BGM.player.playTrack(track);
        // 若结果卡片已展示，同步为当前试听曲目
        if (!els.resultCard.hidden && state.result) {
          state.result.track = track;
          els.trackTitle.textContent = track.title;
          els.trackSub.textContent = track.sub;
          buildWaveform(track.id);
        }
        syncLibHighlight();
      });

      item.append(info, btn);
      els.libraryList.appendChild(item);
    });
  }

  function syncLibHighlight() {
    Array.from(els.libraryList.children).forEach((item) => {
      const active = BGM.player.track && item.dataset.id === BGM.player.track.id && BGM.player.playing;
      item.classList.toggle("playing", !!active);
    });
  }
  const _stateChange = BGM.player.onStateChange;
  BGM.player.onStateChange = (playing) => { _stateChange && _stateChange(playing); syncLibHighlight(); };

  els.btnOpenLibrary.addEventListener("click", () => { renderLibrary(); els.libraryMask.hidden = false; });
  els.btnCloseLibrary.addEventListener("click", () => { els.libraryMask.hidden = true; });
  els.libraryMask.addEventListener("click", (e) => { if (e.target === els.libraryMask) els.libraryMask.hidden = true; });

  /* ================= AI 设置弹窗 ================= */
  function openAiModal() {
    const cfg = window.APP_CONFIG.ai;
    els.aiEndpoint.value = cfg.endpoint || "";
    els.aiModel.value = cfg.model || "";
    els.aiKey.value = cfg.apiKey || "";
    els.aiMask.hidden = false;
  }
  els.btnCloseAi.addEventListener("click", () => { els.aiMask.hidden = true; });
  els.aiMask.addEventListener("click", (e) => { if (e.target === els.aiMask) els.aiMask.hidden = true; });

  els.btnSaveAi.addEventListener("click", () => {
    const saved = {
      endpoint: els.aiEndpoint.value.trim(),
      model: els.aiModel.value.trim(),
      apiKey: els.aiKey.value.trim()
    };
    localStorage.setItem("photoBuddy.ai", JSON.stringify(saved));
    window.APP_CONFIG.ai = saved;
    updateFooterStatus();
    els.aiMask.hidden = true;
    toast(saved.endpoint ? "已保存，下次生成将尝试调用 AI" : "已回到演示模式");
  });

  els.btnClearAi.addEventListener("click", () => {
    localStorage.removeItem("photoBuddy.ai");
    window.APP_CONFIG.ai = { endpoint: "", model: "", apiKey: "" };
    els.aiEndpoint.value = ""; els.aiModel.value = ""; els.aiKey.value = "";
    updateFooterStatus();
    toast("已清空，回到演示模式");
  });

  function updateFooterStatus() {
    const cfg = window.APP_CONFIG.ai;
    const configured = !!(cfg.endpoint && cfg.apiKey);
    els.footerAiStatus.innerHTML = "";
    const link = document.createElement("button");
    link.type = "button";
    link.textContent = configured ? "AI 接口已配置 · 点击管理" : "演示模式 · 未配置 AI 接口，点击配置";
    link.addEventListener("click", openAiModal);
    els.footerAiStatus.appendChild(link);
  }

  /* 初始化 */
  renderGrid();
  updateFooterStatus();
})();
