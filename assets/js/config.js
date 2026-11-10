/*
 * 全局配置
 * 注意：GitHub Pages 为纯静态托管，不能跑后端服务。
 * 真实 AI 识图需要视觉模型接口；密钥不得硬编码进公开仓库。
 * 默认为空 → 应用以「演示模式」运行，使用本地规则兜底生成文案。
 * 用户可在页面「AI 接口设置」中自行填写，仅保存在本机浏览器 localStorage。
 */
window.APP_CONFIG = {
  ai: {
    // 兼容 OpenAI 格式的 chat/completions 接口地址，例如：
    // https://api.example.com/v1/chat/completions
    endpoint: "",
    model: "",
    apiKey: ""
  }
};

(function applyLocalSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("photoBuddy.ai") || "null");
    if (saved && typeof saved === "object") {
      window.APP_CONFIG.ai = Object.assign(window.APP_CONFIG.ai, saved);
    }
  } catch (e) {
    // localStorage 不可用时保持默认空配置
  }
})();
