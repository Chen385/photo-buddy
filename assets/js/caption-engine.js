/*
 * 文案与匹配引擎：
 * - analyzeImage：本地读取画面主色/亮度/冷暖，给出情绪标签（演示模式下的启发式判断）；
 * - analyzeDescription：从补充描述提取关键词情绪；
 * - callAI：若已配置兼容 OpenAI 格式的视觉模型接口，真实调用 AI 识图；
 * - demoCaption：未配置或调用失败时，本地规则兜底生成；
 * - pickTrack：按情绪 + 模式匹配曲目；
 * - buildReason：生成「为什么配这首」的推荐理由。
 */
(function () {
  const MODE_LABELS = { decide: "帮我决定", serious: "认真配", fun: "放开整活" };

  /* ---------- 画面分析（本地启发式，不联网） ---------- */
  function analyzeImage(dataURL) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const size = 48;
          const c = document.createElement("canvas");
          c.width = c.height = size;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, size, size);
          const d = ctx.getImageData(0, 0, size, size).data;
          let r = 0, g = 0, b = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
          r /= n; g /= n; b /= n;
          const brightness = (r + g + b) / 3;
          const warmth = r - b;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const moods = [];
          if (brightness > 150) moods.push("sunny", "happy");
          else if (brightness < 90) moods.push("calm", "soft");
          if (warmth > 18) moods.push("sunset", "soft");
          else if (warmth < -12) moods.push("cool", "chill");
          if (max - min > 40) moods.push("energetic");
          resolve({
            moods: [...new Set(moods)],
            cues: {
              brightness: Math.round(brightness),
              warmth: Math.round(warmth),
              warm: warmth > 12,
              bright: brightness > 150
            }
          });
        } catch (e) {
          resolve({ moods: ["chill"], cues: {} });
        }
      };
      img.onerror = () => resolve({ moods: ["chill"], cues: {} });
      img.src = dataURL;
    });
  }

  function analyzeDescription(text) {
    const moods = new Set();
    const notes = [];
    if (!text) return { moods, notes };
    (window.KEYWORD_MOODS || []).forEach((k) => {
      k.words.forEach((w) => {
        if (text.includes(w)) {
          k.moods.forEach((m) => moods.add(m));
          if (!notes.includes(w)) notes.push(w);
        }
      });
    });
    return { moods, notes };
  }

  /* ---------- AI 真实调用 ---------- */
  async function callAI({ images, description, mode, moods }) {
    const cfg = window.APP_CONFIG.ai;
    if (!cfg.endpoint || !cfg.apiKey) return null;
    const sys =
      "你是一名擅长中文社交平台网感文案的写手。根据用户上传的照片图片和补充描述，" +
      "写一句自然、不尬、有情绪的配文。要求：短句优先，1-2 句，克制使用 emoji，不堆砌辞藻；" +
      "当前创作模式：" + MODE_LABELS[mode] + "。只返回配文正文本身，不要解释，不要加引号。";
    const content = [
      { type: "text", text: JSON.stringify({ 补充描述: description || "（无）", 推断情绪: moods, 照片数量: images.length, 模式: MODE_LABELS[mode] }) }
    ];
    images.slice(0, 3).forEach((d) => content.push({ type: "image_url", image_url: { url: d } }));

    const resp = await fetch(cfg.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + cfg.apiKey
      },
      body: JSON.stringify({
        model: cfg.model || "gpt-4o-mini",
        messages: [{ role: "system", content: sys }, { role: "user", content }],
        temperature: 0.85
      })
    });
    if (!resp.ok) throw new Error("AI 接口返回 " + resp.status);
    const data = await resp.json();
    const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text || typeof text !== "string") throw new Error("AI 返回格式异常");
    return text.trim().replace(/^["「]|["」]$/g, "");
  }

  /* ---------- 演示模式本地模板 ---------- */
  const SERIOUS = {
    soft: ["把今天的柔软，都轻轻留在镜头里了。", "这一刻很安静，刚好也很温柔。"],
    calm: ["什么都不想说，这一刻自己懂就好。", "情绪收着放，镜头替我记下了。"],
    sunset: ["光落下来的时候，刚好被我接住。", "暮色好看，照片里的人也好看。"],
    happy: ["此刻的快乐，照片已经替我说够了。", "今天的好心情，先存进相册再说。"],
    energetic: ["状态在线的一天，值得被认真记下来。", "活力满格，镜头也跟着亮了。"],
    cool: ["镜头一抬，氛围感自己就到位了。", "不用刻意，画面感已经拉满。"],
    cute: ["今天份的可爱，已存档。", "软乎乎的日常，值得一张特写。"],
    chill: ["慢慢过的日子，都值得被拍下来。", "松弛感拉满，今天也没在赶时间。"],
    fallback: ["这张照片里，藏着我今天的情绪。"]
  };

  const FUN = [
    "家人们谁懂啊，这张直接封神。",
    "今日人设：随便一站就好看的人。",
    "别夸了别夸了（其实可以继续夸）。",
    "这张要是不火，我就把相机吃了。",
    "建议配文：我和我的显眼包日常。",
    "朋友圈三连：好看、爱看、再发一张。",
    "本来想低调，照片没答应。",
    "今日份搞笑男女出街实录。"
  ];

  function pickFrom(arr, round) {
    return arr[(round + Math.floor(Math.random() * arr.length)) % arr.length];
  }

  function demoCaption({ description, moods, mode, round }) {
    const desc = (description || "").trim();
    let caption;
    if (mode === "fun") {
      caption = pickFrom(FUN, round);
      if (desc && Math.random() > 0.5) {
        caption = `「${desc.slice(0, 20)}」${caption}`;
      }
    } else {
      const pool = mode === "serious" ? SERIOUS : Object.assign({}, SERIOUS, { fallback: SERIOUS.fallback.concat(FUN.slice(0, 3)) });
      let matched = null;
      for (const m of moods) {
        if (pool[m] && pool[m].length) { matched = pickFrom(pool[m], round); break; }
      }
      caption = matched || pickFrom(pool.fallback, round);
      if (desc && Math.random() > 0.5) {
        caption = `${desc.slice(0, 20)}，先记在这一帧里。`;
      }
    }
    return caption;
  }

  /* ---------- 曲目匹配 ---------- */
  function pickTrack(moods, mode, excludeId) {
    const pool = (window.TRACKS || []).filter((t) => t.modes.includes(mode));
    const scored = pool.map((t) => {
      let score = 0;
      t.moods.forEach((m) => { if (moods.includes(m)) score += 2; });
      if (t.id === excludeId) score -= 10;
      return { t, score };
    });
    scored.sort((a, b) => b.score - a.score);
    if (mode === "decide") {
      const top = scored.filter((x) => x.score >= scored[0].score - 1);
      return top[Math.floor(Math.random() * top.length)].t;
    }
    if (mode === "fun") {
      const funny = scored.filter((x) => x.t.moods.includes("playful") || x.t.moods.includes("funny"));
      const list = funny.length ? funny : scored;
      return list[0].t;
    }
    return scored[0].t;
  }

  function buildReason(track, analysis, description) {
    const parts = [];
    if (analysis.cues && analysis.cues.warm) parts.push("整体偏暖");
    else if (analysis.cues) parts.push("色调偏沉静");
    if (analysis.cues && analysis.cues.bright) parts.push("光线明亮");
    if (analysis.notes && analysis.notes.length) parts.push("提到了「" + analysis.notes.slice(0, 2).join("、") + "」");
    const prefix = parts.length ? "结合画面" + parts.join("、") + "，" : "";
    return prefix + track.reason;
  }

  /* ---------- 主入口 ---------- */
  async function generate({ images, description, mode, round, excludeTrackId }) {
    // 汇总情绪
    const perImage = await Promise.all(images.map(analyzeImage));
    const desc = analyzeDescription(description);
    const moods = [...new Set([...perImage.flatMap((p) => p.moods), ...desc.moods])];
    const cues = perImage[0] ? perImage[0].cues : {};
    const analysis = { moods, cues, notes: desc.notes };

    let caption = null;
    let source = "demo";
    let note = "";
    const cfg = window.APP_CONFIG.ai;
    const aiConfigured = !!(cfg.endpoint && cfg.apiKey);

    if (aiConfigured) {
      try {
        caption = await callAI({ images, description, mode, moods });
        source = "ai";
      } catch (e) {
        caption = null;
        note = "AI 接口调用失败（" + (e && e.message ? e.message : "网络或配置异常") + "），已切换本地规则兜底。";
      }
    } else {
      note = "演示模式：未配置 AI 接口，文案由本地规则生成，照片未上传服务器。";
    }

    if (!caption) {
      caption = demoCaption({ description, moods, mode, round });
      source = source === "ai" ? "ai" : "demo";
    }

    const track = pickTrack(moods, mode, excludeTrackId);
    const reason = buildReason(track, analysis, description);

    return { caption, track, reason, source, note, analysis };
  }

  window.CaptionEngine = {
    MODE_LABELS,
    analyzeImage,
    analyzeDescription,
    generate,
    pickTrack,
    buildReason,
    demoCaption
  };
})();
